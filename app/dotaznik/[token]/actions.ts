"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import {
  getRiskCodes,
  hashClientQuestionnaireToken,
  type QuestionnaireDecision,
} from "@/lib/client-questionnaire";
import { createAdminClient } from "@/lib/supabase/admin";

const PHOTO_BUCKET = "dotaznik-fotky";
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_PHOTO_KINDS = new Set(["rozvadec", "prijezd", "parkovani", "prostor", "jina"]);

type LinkRow = {
  link_id: string;
  zakazka_id: string;
  revoked_at: string | null;
};

function toOptionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function normalizeDecision(value: FormDataEntryValue | null): QuestionnaireDecision {
  return value === "technician_visit" ? "technician_visit" : "self";
}

function normalizeChoice(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || "nevim";
}

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function getStringList(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? "").trim());
}

async function loadValidLink(rawToken: string) {
  const supabase = createAdminClient();
  const tokenHash = hashClientQuestionnaireToken(rawToken);

  const { data, error } = await supabase
    .from("zakazka_client_links")
    .select("link_id, zakazka_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const link = (data ?? null) as LinkRow | null;
  if (!link || link.revoked_at) {
    return { supabase, link: null };
  }

  return { supabase, link };
}

function formError(errorMessage: string) {
  return { ok: false, errorMessage };
}

export async function submitPublicQuestionnaireAction(formData: FormData) {
  const rawToken = String(formData.get("token") ?? "").trim();
  if (!rawToken) {
    return formError("Chybí token dotazníku.");
  }

  const { supabase, link } = await loadValidLink(rawToken);
  if (!link) {
    return formError("Odkaz už není platný. Požádejte prosím organizátora akce o nový odkaz.");
  }

  const decision = normalizeDecision(formData.get("decision"));
  const kontaktJmeno = String(formData.get("kontakt_jmeno") ?? "").trim();
  const kontaktTelefon = String(formData.get("kontakt_telefon") ?? "").trim();
  const lzeZajetAutem = normalizeChoice(formData.get("lze_zajet_autem"));
  const mistoZpevnene = normalizeChoice(formData.get("misto_zpevnene"));
  const prijezdPoznamka = String(formData.get("prijezd_poznamka") ?? "").trim();
  const parkovaniPoznamka = String(formData.get("parkovani_poznamka") ?? "").trim();
  const elektroPripravena = normalizeChoice(formData.get("elektro_pripravena"));
  const elektroPripojka = String(formData.get("elektro_pripojka") ?? "").trim();
  const elektroJisteni = String(formData.get("elektro_jisteni") ?? "").trim();
  const elektroZasuvka = normalizeChoice(formData.get("elektro_zasuvka"));
  const elektroVzdalenostM = toOptionalNumber(formData.get("elektro_vzdalenost_m"));
  const kabelPresSilnici = normalizeChoice(formData.get("kabel_pres_silnici"));
  const potvrzeniPravdivosti = formData.get("potvrzeni_pravdivosti") === "on";
  const potvrzeniDoctovani = formData.get("potvrzeni_doctovani") === "on";
  const potvrzeniVyjezdu = formData.get("potvrzeni_vyjezdu") === "on";

  if (!kontaktJmeno || !kontaktTelefon) {
    return formError("Vyplňte prosím jméno a telefon kontaktní osoby na místě.");
  }

  if (decision === "technician_visit") {
    if (!potvrzeniVyjezdu) {
      return formError("Potvrďte prosím objednání výjezdu technika před akcí.");
    }
  } else {
    if (!potvrzeniPravdivosti) {
      return formError("Potvrďte prosím pravdivost údajů podle nejlepšího vědomí.");
    }

    if (!potvrzeniDoctovani) {
      return formError("Při vlastním vyplnění potvrďte prosím i možné dodatečné náklady při nesouladu na místě.");
    }

    if (elektroPripravena === "ano" && elektroVzdalenostM == null) {
      return formError("Pokud je elektro přípojka připravená, vyplňte prosím přibližnou vzdálenost v metrech.");
    }
  }

  const files = formData.getAll("photo_files").filter((value): value is File => value instanceof File && value.size > 0);
  const photoTypes = getStringList(formData, "photo_types");
  const photoDescriptions = getStringList(formData, "photo_descriptions");

  for (const file of files) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      return formError("Fotky musí být ve formátu JPG, PNG nebo WebP.");
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return formError("Jedna fotka může mít maximálně 10 MB.");
    }
  }

  const risks = getRiskCodes({
    decision,
    lzeZajetAutem,
    mistoZpevnene,
    elektroPripravena,
    elektroPripojka,
    elektroJisteni,
    elektroZasuvka,
    elektroVzdalenostM,
    kabelPresSilnici,
    parkovaniPoznamka,
  });
  const submittedAt = new Date().toISOString();
  const stav = decision === "technician_visit" ? "pozadovan_vyjezd_technika" : "vyplneno";

  const { data: existing, error: existingError } = await supabase
    .from("zakazka_dotazniky")
    .select("dotaznik_id")
    .eq("link_id", link.link_id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const payload = {
    zakazka_id: link.zakazka_id,
    link_id: link.link_id,
    stav,
    kontakt_jmeno: kontaktJmeno || null,
    kontakt_telefon: kontaktTelefon || null,
    prijezd_poznamka: prijezdPoznamka || null,
    parkovani_poznamka: parkovaniPoznamka || null,
    elektro_pripojka: elektroPripojka || null,
    elektro_jisteni: elektroJisteni || null,
    elektro_zasuvka: elektroZasuvka || null,
    elektro_vzdalenost_m: elektroVzdalenostM,
    pozadovan_vyjezd_technika: decision === "technician_visit",
    potvrzeni_pravdivosti: potvrzeniPravdivosti,
    potvrzeni_doctovani: potvrzeniDoctovani,
    rizika: risks,
    odpovedi_extra: {
      decision,
      lze_zajet_autem: lzeZajetAutem,
      misto_zpevnene: mistoZpevnene,
      elektro_pripravena: elektroPripravena,
      kabel_pres_silnici: kabelPresSilnici,
      potvrzeni_vyjezdu: potvrzeniVyjezdu,
    },
    submitted_at: submittedAt,
    updated_at: submittedAt,
  };

  const result = existing?.dotaznik_id
    ? await supabase
        .from("zakazka_dotazniky")
        .update(payload)
        .eq("dotaznik_id", existing.dotaznik_id)
        .select("dotaznik_id")
        .single()
    : await supabase.from("zakazka_dotazniky").insert(payload).select("dotaznik_id").single();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const dotaznikId = result.data.dotaznik_id as string;

  if (files.length > 0) {
    const metadataRows = [];

    for (const [index, file] of files.entries()) {
      const kind = ALLOWED_PHOTO_KINDS.has(photoTypes[index]) ? photoTypes[index] : "jina";
      const extension = getExtension(file);
      const storagePath = `questionnaire/${link.zakazka_id}/${dotaznikId}/${randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        return formError(`Nahrání fotky selhalo: ${uploadError.message}`);
      }

      metadataRows.push({
        zakazka_id: link.zakazka_id,
        dotaznik_odpoved_id: dotaznikId,
        token_id: link.link_id,
        storage_bucket: PHOTO_BUCKET,
        storage_path: storagePath,
        typ: kind,
        popis: photoDescriptions[index] || null,
        poradi: index,
        original_filename: file.name || null,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
    }

    const { error: metadataError } = await supabase.from("dotaznik_fotky").insert(metadataRows);
    if (metadataError) {
      return formError(`Uložení metadat fotek selhalo: ${metadataError.message}`);
    }
  }

  await supabase
    .from("zakazky")
    .update({ client_approval_status: "technical_info_received" })
    .eq("zakazka_id", link.zakazka_id)
    .neq("client_approval_status", "approved");

  revalidatePath(`/zakazky/${link.zakazka_id}`);
  return { ok: true, errorMessage: null };
}
