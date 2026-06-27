"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireActiveClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  isFormDataUploadFile,
  isValidPoptavkaUploadFile,
} from "@/lib/client-portal/poptavka-fotky-shared";
import {
  deletePoptavkaFotkaForClient,
  uploadPoptavkaFotkyForClient,
} from "@/lib/client-portal/poptavka-fotky-server";
import {
  buildTechnikaRowPayload,
  parseTechnikaFormData,
} from "@/lib/client-portal/poptavka-technika-form";
import { validateTechnickePodminkyForSave, type TechnikaSectionPhotoKey } from "@/lib/client-portal/poptavka-technika-podminky";
import {
  validateKlientSubmitComplete,
  validateKlientSubmitDetailed,
  validateTechnikVyjezdOrderComplete,
} from "@/lib/client-portal/poptavka-wizard-validation";
import {
  buildSestavaOdpovediExtra,
  deriveSetupSelectionsFromSestava,
  mergeSetupSelections,
  parseSestavaFormData,
  validateSestavaKonfigurator,
} from "@/lib/client-portal/sestava-konfigurator-form";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import {
  buildPoptavkaRowPayload,
  parsePoptavkaFormData,
  validatePoptavkaDraftMinima,
} from "@/lib/client-portal/poptavka-form";
import { assertClientCanUseMistoId } from "@/lib/client-portal/client-mista-server";
import {
  generateCisloPoptavky,
  filterPortalSetupSelections,
  isPoptavkaEditable,
  loadPoptavkaDetail,
  loadPortalSetups,
} from "@/lib/client-portal/poptavka-server";
import type { PoptavkaFormValues } from "@/lib/client-portal/poptavka-form";
import { notifyInternalTeamAboutSubmittedPoptavka } from "@/lib/client-portal/poptavka-notifications-server";
import {
  getPortalAppBaseUrl,
  trySendPoptavkaSubmittedConfirmation,
} from "@/lib/client-portal/poptavka-email-server";
import { loadInternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";
import { calculateTechnikVyjezdDoprava } from "@/lib/client-portal/technik-vyjezd-pricing";
import { createClient } from "@/lib/supabase/server";

function redirectWithError(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function getStringList(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? "").trim());
}

const TECHNIKA_SECTION_PHOTO_KEYS: TechnikaSectionPhotoKey[] = [
  "rozvadec",
  "prijezd",
  "plocha_stage",
  "povrch_pristup",
  "jina",
  "misto_akce",
];

function validateTechnickeForSave(formData: FormData, errorPath: string) {
  const wizardStep = Number(String(formData.get("wizard_step") ?? "0"));
  const technika = parseTechnikaFormData(formData);
  const technickeError = validateTechnickePodminkyForSave({
    wizardStep,
    technickeRezim: technika.technicke_rezim,
    potvrzeniOdpovednosti: technika.technicke_potvrzeni_odpovednosti,
    potvrzeniVyjezdCeny: technika.technicke_potvrzeni_vyjezd_ceny,
    technika,
  });
  if (technickeError) {
    redirectWithError(errorPath, technickeError);
  }
}

async function uploadTechnickeSectionPhotosFromFormData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  formData: FormData
) {
  const files: File[] = [];
  const photoTypes: string[] = [];
  let rejectedEntries = 0;

  for (const sectionKey of TECHNIKA_SECTION_PHOTO_KEYS) {
    for (const value of formData.getAll(`technicke_foto_${sectionKey}`)) {
      if (!isFormDataUploadFile(value)) continue;
      if (!isValidPoptavkaUploadFile(value)) {
        rejectedEntries += 1;
        continue;
      }
      files.push(value);
      photoTypes.push(sectionKey);
    }
  }

  if (files.length === 0) {
    if (rejectedEntries > 0) {
      throw new Error("Invalid section photo upload");
    }
    return;
  }

  await uploadPoptavkaFotkyForClient(
    supabase,
    poptavkaId,
    files,
    photoTypes,
    photoTypes.map(() => "")
  );
}

async function finalizePoptavkaSubmission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  detail: NonNullable<Awaited<ReturnType<typeof loadPoptavkaDetail>>>,
  options?: { redirectQuery?: string }
) {
  console.info("[poptavka submit] finalize start", { poptavkaId, stavBefore: detail.stav });

  if (
    !detail.kontakt_jmeno ||
    !detail.kontakt_email ||
    !detail.misto_nazev ||
    !detail.datum_od ||
    !detail.datum_do ||
    detail.misto_lat == null ||
    detail.misto_lng == null ||
    !detail.presny_popis_mista?.trim()
  ) {
    console.warn("[poptavka submit] finalize incomplete detail", { poptavkaId });
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "submit_incomplete");
  }

  const wasRevision = detail.stav === "v_revizi";
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("poptavky")
    .update({
      stav: "odeslana",
      odeslano_at: now,
      zamitnuto_duvod: null,
      updated_at: now,
    })
    .eq("poptavka_id", poptavkaId);

  if (error) {
    console.error("[poptavka submit] finalize db update failed", {
      poptavkaId,
      message: error.message,
    });
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "submit_failed");
  }

  console.info("[poptavka submit] stav updated", { poptavkaId, stav: "odeslana" });

  try {
    await notifyInternalTeamAboutSubmittedPoptavka({
      poptavkaId,
      cisloPoptavky: detail.cislo_poptavky,
      mistoNazev: detail.misto_nazev,
      isResubmit: wasRevision,
    });
  } catch (notifyError) {
    console.warn("[poptavka submit] internal notification failed:", notifyError);
  }

  try {
    const internalDetail = await loadInternalPoptavkaDetail(supabase, poptavkaId);
    if (internalDetail) {
      console.info("[poptavka submit] confirmation email attempt", { poptavkaId });
      const emailResult = await trySendPoptavkaSubmittedConfirmation({
        detail: internalDetail,
        baseUrl: getPortalAppBaseUrl(await headers()),
      });
      if (!emailResult.ok || (emailResult.ok && !emailResult.sent)) {
        const reason =
          emailResult.ok && !emailResult.sent
            ? emailResult.reason
            : emailResult.ok
              ? "unknown"
              : emailResult.reason;
        console.warn("[poptavka submit] confirmation email not sent", { poptavkaId, reason });
      } else {
        console.info("[poptavka submit] confirmation email sent", { poptavkaId });
      }
    }
  } catch (emailError) {
    console.warn("[poptavka submit] confirmation email failed:", emailError);
  }

  revalidatePath("/portal/poptavky");
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  revalidatePath("/zakazky/poptavky");
  revalidatePath(`/zakazky/poptavky/${poptavkaId}`);
  const redirectTarget = `/portal/poptavka/${poptavkaId}?${options?.redirectQuery ?? "submitted=1"}`;
  console.info("[poptavka submit] redirect", { poptavkaId, redirectTarget });
  redirect(redirectTarget);
}

async function assertEditablePoptavka(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string
) {
  const detail = await loadPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    throw new Error("NOT_FOUND");
  }
  if (!isPoptavkaEditable(detail)) {
    throw new Error("NOT_EDITABLE");
  }
  return detail;
}

async function upsertTechnickeUdaje(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  formData: FormData
) {
  const technikaValues = parseTechnikaFormData(formData);
  const poptavkaValues = parsePoptavkaFormData(formData);
  const sestava = parseSestavaFormData(formData);
  const payload = buildTechnikaRowPayload(technikaValues, {
    ...buildSestavaOdpovediExtra(sestava),
    misto_source: poptavkaValues.misto_source,
  });

  const { data: existing } = await supabase
    .from("poptavka_technicke_udaje")
    .select(
      "poptavka_id, technicke_potvrzeni_odpovednosti_at, technicke_potvrzeni_vyjezd_ceny_at, technik_vyjezd_potvrzeni_fakturace_at"
    )
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (
    technikaValues.technicke_rezim === "klient_vyplni" &&
    technikaValues.technicke_potvrzeni_odpovednosti &&
    existing?.technicke_potvrzeni_odpovednosti_at
  ) {
    payload.technicke_potvrzeni_odpovednosti_at = existing.technicke_potvrzeni_odpovednosti_at;
  }

  if (
    technikaValues.technicke_rezim === "vyjezd_technika" &&
    technikaValues.technicke_potvrzeni_vyjezd_ceny &&
    existing?.technicke_potvrzeni_vyjezd_ceny_at
  ) {
    payload.technicke_potvrzeni_vyjezd_ceny_at = existing.technicke_potvrzeni_vyjezd_ceny_at;
  }

  if (
    technikaValues.technik_vyjezd_potvrzeni_fakturace &&
    existing?.technik_vyjezd_potvrzeni_fakturace_at
  ) {
    payload.technik_vyjezd_potvrzeni_fakturace_at = existing.technik_vyjezd_potvrzeni_fakturace_at;
  }

  if (!technikaValues.technik_vyjezd_potvrzeni_fakturace) {
    payload.technik_vyjezd_potvrzeni_fakturace_at = null;
  }

  if (existing?.poptavka_id) {
    const { error } = await supabase
      .from("poptavka_technicke_udaje")
      .update(payload)
      .eq("poptavka_id", poptavkaId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("poptavka_technicke_udaje").insert({
    poptavka_id: poptavkaId,
    ...payload,
  });
  if (error) throw new Error(error.message);
}

async function upsertTechnikVyjezdOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  formData: FormData,
  values: PoptavkaFormValues
) {
  const technikaValues = parseTechnikaFormData(formData);
  const sestava = parseSestavaFormData(formData);
  const now = new Date().toISOString();
  const calc = calculateTechnikVyjezdDoprava(values.misto_lat!, values.misto_lng!);
  const payload = {
    ...buildTechnikaRowPayload(technikaValues, buildSestavaOdpovediExtra(sestava)),
    technicke_rezim: "vyjezd_technika" as const,
    pozadovan_vyjezd_technika: true,
    technicke_potvrzeni_vyjezd_ceny_at: now,
    technik_vyjezd_objednan_at: now,
    technik_vyjezd_potvrzeni_fakturace_at: now,
    technik_vyjezd_kontakt_jmeno: technikaValues.technik_vyjezd_kontakt_jmeno,
    technik_vyjezd_kontakt_telefon: technikaValues.technik_vyjezd_kontakt_telefon || null,
    technik_vyjezd_kontakt_email: technikaValues.technik_vyjezd_kontakt_email,
    technik_vyjezd_preferuje_telefon: technikaValues.technik_vyjezd_preferuje_telefon,
    technik_vyjezd_preferuje_email: technikaValues.technik_vyjezd_preferuje_email,
    technik_vyjezd_vzdalenost_km: calc.roundTripKm,
    technik_vyjezd_doprava_kc: calc.dopravaKc,
    technik_vyjezd_vypocet_typ: calc.vypocetTyp,
    updated_at: now,
  };

  const { data: existing } = await supabase
    .from("poptavka_technicke_udaje")
    .select("poptavka_id")
    .eq("poptavka_id", poptavkaId)
    .maybeSingle();

  if (existing?.poptavka_id) {
    const { error } = await supabase
      .from("poptavka_technicke_udaje")
      .update(payload)
      .eq("poptavka_id", poptavkaId);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("poptavka_technicke_udaje").insert({
    poptavka_id: poptavkaId,
    ...payload,
  });
  if (error) throw new Error(error.message);
}

function readWizardKrok(formData: FormData) {
  const step = Number(String(formData.get("wizard_step") ?? "1"));
  if (!Number.isFinite(step)) return 1;
  return Math.min(4, Math.max(1, Math.floor(step)));
}

async function saveDraftPoptavkaFromFormData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: Awaited<ReturnType<typeof requireActiveClientPortalSession>>,
  formData: FormData,
  existingPoptavkaId?: string
) {
  const values = parsePoptavkaFormData(formData);
  const wizardKrok = readWizardKrok(formData);
  const errorPath = existingPoptavkaId
    ? `/portal/poptavka/${existingPoptavkaId}`
    : "/portal/poptavka/nova";

  console.info("[poptavka draft] start", {
    poptavkaId: existingPoptavkaId ?? "new",
    wizardKrok,
    intent: "draft",
  });

  const validationError = validatePoptavkaDraftMinima(values);
  if (validationError) {
    console.info("[poptavka draft] validation failed", {
      poptavkaId: existingPoptavkaId ?? "new",
      code: validationError,
    });
    redirectWithError(errorPath, validationError);
  }

  const mistoResult = await resolveValidatedMistoIdForSave(supabase, values, { draft: true });
  if (!mistoResult.ok) {
    console.info("[poptavka draft] misto validation failed", {
      poptavkaId: existingPoptavkaId ?? "new",
      code: mistoResult.error,
    });
    redirectWithError(errorPath, mistoResult.error);
  }

  const setupResult = await resolveSetupsForDraft(supabase, formData);
  let draftSetups: ReturnType<typeof parsePoptavkaFormData>["setupy"] | null = null;
  if (setupResult.ok) {
    draftSetups = setupResult.setupy;
  } else if ("skipReplace" in setupResult && setupResult.skipReplace) {
    draftSetups = null;
  } else if ("error" in setupResult) {
    console.info("[poptavka draft] setups validation failed", {
      poptavkaId: existingPoptavkaId ?? "new",
      code: setupResult.error,
    });
    redirectWithError(errorPath, setupResult.error);
  } else {
    redirectWithError(errorPath, "invalid_setups");
  }

  const payload = buildPoptavkaRowPayload(
    {
      ...values,
      misto_id: mistoResult.mistoId,
    },
    { wizardKrok }
  );

  if (existingPoptavkaId) {
    const detail = await loadPoptavkaDetail(supabase, existingPoptavkaId);
    if (!detail) redirectWithError("/portal/poptavky", "not_found");
    if (!isPoptavkaEditable(detail)) {
      redirectWithError(`/portal/poptavka/${existingPoptavkaId}`, "not_editable");
    }

    const { error } = await supabase
      .from("poptavky")
      .update(payload)
      .eq("poptavka_id", existingPoptavkaId);

    if (error) {
      console.error("[poptavka draft] db update failed", {
        poptavkaId: existingPoptavkaId,
        message: error.message,
      });
      redirectWithError(`/portal/poptavka/${existingPoptavkaId}`, "draft_save_failed");
    }

    if (draftSetups !== null) {
      await replacePoptavkaSetups(supabase, existingPoptavkaId, draftSetups);
    }
    await upsertTechnickeUdaje(supabase, existingPoptavkaId, formData);
    await uploadTechnickeSectionPhotosFromFormData(supabase, existingPoptavkaId, formData);
    console.info("[poptavka draft] saved", { poptavkaId: existingPoptavkaId });
    return existingPoptavkaId;
  }

  const cisloPoptavky = await generateCisloPoptavky(supabase);
  const { data: created, error } = await supabase
    .from("poptavky")
    .insert({
      ...payload,
      cislo_poptavky: cisloPoptavky,
      klient_id: session.account.klient_id!,
      vytvoril_account_id: session.account.account_id,
      stav: "koncept",
    })
    .select("poptavka_id")
    .single();

  if (error || !created) {
    console.error("[poptavka draft] db insert failed", {
      message: error?.message ?? "no row returned",
    });
    redirectWithError("/portal/poptavka/nova", "draft_save_failed");
  }

  if (draftSetups !== null) {
    await replacePoptavkaSetups(supabase, created.poptavka_id, draftSetups);
  }
  await upsertTechnickeUdaje(supabase, created.poptavka_id, formData);
  await uploadTechnickeSectionPhotosFromFormData(supabase, created.poptavka_id, formData);
  console.info("[poptavka draft] saved", { poptavkaId: created.poptavka_id });
  return created.poptavka_id;
}

async function persistPoptavkaFromFormData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: Awaited<ReturnType<typeof requireActiveClientPortalSession>>,
  formData: FormData,
  existingPoptavkaId?: string
) {
  const values = parsePoptavkaFormData(formData);
  const wizardKrok = readWizardKrok(formData);
  const errorPath = existingPoptavkaId
    ? `/portal/poptavka/${existingPoptavkaId}`
    : "/portal/poptavka/nova";

  const mistoResult = await resolveValidatedMistoIdForSave(supabase, values);
  if (!mistoResult.ok) {
    redirectWithError(errorPath, mistoResult.error);
  }

  const setupResult = await resolveSetupsWithSestava(supabase, formData);
  if (!setupResult.ok) {
    redirectWithError(errorPath, setupResult.error);
  }

  const payload = buildPoptavkaRowPayload(
    {
      ...values,
      misto_id: mistoResult.mistoId,
    },
    { wizardKrok }
  );

  if (existingPoptavkaId) {
    const detail = await loadPoptavkaDetail(supabase, existingPoptavkaId);
    if (!detail) redirectWithError("/portal/poptavky", "not_found");
    if (!isPoptavkaEditable(detail)) {
      redirectWithError(`/portal/poptavka/${existingPoptavkaId}`, "not_editable");
    }

    const { error } = await supabase
      .from("poptavky")
      .update(payload)
      .eq("poptavka_id", existingPoptavkaId);

    if (error) redirectWithError(`/portal/poptavka/${existingPoptavkaId}`, "save_failed");

    await replacePoptavkaSetups(supabase, existingPoptavkaId, setupResult.setupy);
    await upsertTechnickeUdaje(supabase, existingPoptavkaId, formData);
    await uploadTechnickeSectionPhotosFromFormData(supabase, existingPoptavkaId, formData);
    return existingPoptavkaId;
  }

  const cisloPoptavky = await generateCisloPoptavky(supabase);
  const { data: created, error } = await supabase
    .from("poptavky")
    .insert({
      ...payload,
      cislo_poptavky: cisloPoptavky,
      klient_id: session.account.klient_id!,
      vytvoril_account_id: session.account.account_id,
      stav: "koncept",
    })
    .select("poptavka_id")
    .single();

  if (error || !created) {
    redirectWithError("/portal/poptavka/nova", "save_failed");
  }

  await replacePoptavkaSetups(supabase, created.poptavka_id, setupResult.setupy);
  await upsertTechnickeUdaje(supabase, created.poptavka_id, formData);
  await uploadTechnickeSectionPhotosFromFormData(supabase, created.poptavka_id, formData);
  return created.poptavka_id;
}

async function countSectionPhotosForSubmit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  formData: FormData
) {
  const detail = await loadPoptavkaDetail(supabase, poptavkaId);
  const counts: Partial<Record<TechnikaSectionPhotoKey, number>> = {};

  for (const key of TECHNIKA_SECTION_PHOTO_KEYS) {
    const saved =
      detail?.fotky.filter((row) => row.typ === key).length ?? 0;
    const pending = formData
      .getAll(`technicke_foto_${key}`)
      .filter(isFormDataUploadFile)
      .filter((value) => value.size > 0).length;
    counts[key] = saved + pending;
  }

  return counts;
}

async function resolveValidatedMistoIdForSave(
  supabase: Awaited<ReturnType<typeof createClient>>,
  values: PoptavkaFormValues,
  options?: { draft?: boolean }
) {
  if (values.misto_source === "saved" && !values.misto_id) {
    if (options?.draft) {
      return { ok: true as const, mistoId: null };
    }
    return { ok: false as const, error: "missing_saved_misto" as const };
  }

  const mistoIdCandidate = values.misto_source === "saved" ? values.misto_id : null;
  const access = await assertClientCanUseMistoId(supabase, mistoIdCandidate);

  if (!access.ok) {
    return { ok: false as const, error: "invalid_misto" as const };
  }

  return { ok: true as const, mistoId: access.mistoId };
}

async function resolvePortalSetupsForSave(
  supabase: Awaited<ReturnType<typeof createClient>>,
  setupy: PoptavkaFormValues["setupy"]
) {
  const { setupy: filtered, rejectedCount } = await filterPortalSetupSelections(
    supabase,
    setupy
  );

  if (setupy.length > 0 && filtered.length === 0) {
    return { ok: false as const, error: "invalid_setups" as const };
  }

  return { ok: true as const, setupy: filtered, rejectedCount };
}

async function resolveSetupsForDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
) {
  const sestava = parseSestavaFormData(formData);
  const katalog = await loadPortalSestavaKatalog();
  const validation = validateSestavaKonfigurator(sestava, katalog);

  if (validation.errors.length > 0) {
    return { ok: false as const, skipReplace: true as const };
  }

  const portalSetups = await loadPortalSetups(supabase);
  const derived =
    sestava.rezim === "atypicka"
      ? []
      : deriveSetupSelectionsFromSestava(sestava, katalog, portalSetups);
  const merged = sestava.rezim === "atypicka" ? [] : mergeSetupSelections([], derived);

  return resolvePortalSetupsForSave(supabase, merged);
}

async function resolveSetupsWithSestava(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData
) {
  const sestava = parseSestavaFormData(formData);
  const katalog = await loadPortalSestavaKatalog();
  const validation = validateSestavaKonfigurator(sestava, katalog);

  if (validation.errors.length > 0) {
    return { ok: false as const, error: "invalid_sestava" as const };
  }

  const portalSetups = await loadPortalSetups(supabase);
  const derived =
    sestava.rezim === "atypicka"
      ? []
      : deriveSetupSelectionsFromSestava(sestava, katalog, portalSetups);
  const merged = sestava.rezim === "atypicka" ? [] : mergeSetupSelections([], derived);

  return resolvePortalSetupsForSave(supabase, merged);
}

async function replacePoptavkaSetups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  poptavkaId: string,
  setupy: ReturnType<typeof parsePoptavkaFormData>["setupy"]
) {
  const { error: deleteError } = await supabase
    .from("poptavka_setupy")
    .delete()
    .eq("poptavka_id", poptavkaId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (setupy.length === 0) {
    return;
  }

  const rows = setupy.map((row, index) => ({
    poptavka_id: poptavkaId,
    setup_id: row.setup_id,
    mnozstvi: row.mnozstvi,
    poznamka_klienta: row.poznamka_klienta,
    poradi: index,
  }));

  const { error: insertError } = await supabase.from("poptavka_setupy").insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function createPoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  const session = await requireActiveClientPortalSession(supabase);
  console.info("[poptavka draft] action create");
  const poptavkaId = await saveDraftPoptavkaFromFormData(supabase, session, formData);
  revalidatePath("/portal/poptavky");
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  console.info("[poptavka draft] redirect saved", { poptavkaId });
  redirect(`/portal/poptavka/${poptavkaId}?saved=1`);
}

export async function updatePoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  if (!poptavkaId) {
    redirectWithError("/portal/poptavky", "missing_id");
  }

  console.info("[poptavka draft] action update", { poptavkaId });
  await saveDraftPoptavkaFromFormData(
    supabase,
    await requireActiveClientPortalSession(supabase),
    formData,
    poptavkaId
  );

  revalidatePath("/portal/poptavky");
  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  console.info("[poptavka draft] redirect saved", { poptavkaId });
  redirect(`/portal/poptavka/${poptavkaId}?saved=1`);
}

export async function uploadPoptavkaFotkyAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  if (!poptavkaId) {
    return { ok: false as const, error: "missing_id" };
  }

  try {
    await assertEditablePoptavka(supabase, poptavkaId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "forbidden";
    return { ok: false as const, error: code === "NOT_FOUND" ? "not_found" : "not_editable" };
  }

  const files = formData
    .getAll("photo_files")
    .filter(isFormDataUploadFile)
    .filter((value) => value.size > 0);
  const photoTypes = getStringList(formData, "photo_types");
  const photoDescriptions = getStringList(formData, "photo_descriptions");

  if (files.length === 0) {
    return { ok: false as const, error: "no_files" };
  }

  for (const file of files) {
    if (!isValidPoptavkaUploadFile(file)) {
      return { ok: false as const, error: "invalid_type" };
    }
  }

  try {
    await uploadPoptavkaFotkyForClient(supabase, poptavkaId, files, photoTypes, photoDescriptions);
  } catch {
    return { ok: false as const, error: "upload_failed" };
  }

  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  return { ok: true as const, error: null };
}

export async function deletePoptavkaFotkaAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  const fotkaId = String(formData.get("fotka_id") ?? "").trim();

  if (!poptavkaId || !fotkaId) {
    return { ok: false as const, error: "missing_id" };
  }

  try {
    await assertEditablePoptavka(supabase, poptavkaId);
    await deletePoptavkaFotkaForClient(supabase, poptavkaId, fotkaId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "forbidden";
    return { ok: false as const, error: code === "NOT_FOUND" ? "not_found" : "delete_failed" };
  }

  revalidatePath(`/portal/poptavka/${poptavkaId}`);
  return { ok: true as const, error: null };
}

export async function submitKlientPoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  const session = await requireActiveClientPortalSession(supabase);

  const existingPoptavkaId = String(formData.get("poptavka_id") ?? "").trim() || undefined;
  const errorPath = existingPoptavkaId
    ? `/portal/poptavka/${existingPoptavkaId}`
    : "/portal/poptavka/nova";

  const wizardKrok = readWizardKrok(formData);
  console.info("[poptavka submit] start", {
    poptavkaId: existingPoptavkaId ?? "new",
    wizardKrok,
    intent: "submit_klient",
  });

  if (wizardKrok < 4) {
    console.warn("[poptavka submit] blocked wizard step", { poptavkaId: existingPoptavkaId, wizardKrok });
    redirectWithError(errorPath, "wizard_step_locked");
  }

  const values = parsePoptavkaFormData(formData);
  const technika = parseTechnikaFormData(formData);
  const sestava = parseSestavaFormData(formData);
  const katalog = await loadPortalSestavaKatalog();

  let photoCounts: Partial<Record<TechnikaSectionPhotoKey, number>> = {};
  if (existingPoptavkaId) {
    photoCounts = await countSectionPhotosForSubmit(supabase, existingPoptavkaId, formData);
  } else {
    for (const key of TECHNIKA_SECTION_PHOTO_KEYS) {
      photoCounts[key] = formData
        .getAll(`technicke_foto_${key}`)
        .filter(isFormDataUploadFile)
        .filter((value) => value.size > 0).length;
    }
  }

  const validationInput = {
    form: values,
    sestava,
    katalog,
    technika,
    photoCounts,
  };

  const submitError = validateKlientSubmitComplete(validationInput);
  if (submitError) {
    const detailed = validateKlientSubmitDetailed(validationInput);
    console.info("[poptavka submit] validation failed", {
      poptavkaId: existingPoptavkaId ?? "new",
      code: submitError,
      issueCodes: detailed.ok ? [] : detailed.issues.map((issue) => issue.code),
      issueCount: detailed.ok ? 0 : detailed.issues.length,
    });
    redirectWithError(errorPath, submitError);
  }

  let poptavkaId: string;
  try {
    poptavkaId = await persistPoptavkaFromFormData(supabase, session, formData, existingPoptavkaId);
  } catch (persistError) {
    console.error("[poptavka submit] persist failed", {
      poptavkaId: existingPoptavkaId ?? "new",
      message: persistError instanceof Error ? persistError.message : "unknown",
    });
    redirectWithError(errorPath, "setups_failed");
  }

  console.info("[poptavka submit] persisted", { poptavkaId });

  photoCounts = await countSectionPhotosForSubmit(supabase, poptavkaId, formData);
  const photoRecheck = validateKlientSubmitComplete({
    form: values,
    sestava,
    katalog,
    technika,
    photoCounts,
  });
  if (photoRecheck) {
    const detailed = validateKlientSubmitDetailed({
      form: values,
      sestava,
      katalog,
      technika,
      photoCounts,
    });
    console.info("[poptavka submit] post-persist validation failed", {
      poptavkaId,
      code: photoRecheck,
      issueCodes: detailed.ok ? [] : detailed.issues.map((issue) => issue.code),
    });
    redirectWithError(`/portal/poptavka/${poptavkaId}`, photoRecheck);
  }

  const detail = await loadPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    console.error("[poptavka submit] detail missing after persist", { poptavkaId });
    redirectWithError(errorPath, "save_failed");
  }

  await finalizePoptavkaSubmission(supabase, poptavkaId, detail);
}

export async function submitPoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  await requireActiveClientPortalSession(supabase);

  const poptavkaId = String(formData.get("poptavka_id") ?? "").trim();
  if (!poptavkaId) {
    redirectWithError("/portal/poptavky", "missing_id");
  }

  let detail;
  try {
    detail = await assertEditablePoptavka(supabase, poptavkaId);
  } catch {
    redirectWithError(`/portal/poptavka/${poptavkaId}`, "not_editable");
  }

  await finalizePoptavkaSubmission(supabase, poptavkaId, detail);
}

export async function orderTechnikVyjezdAndSubmitPoptavkaAction(formData: FormData) {
  const supabase = await createClient();
  const session = await requireActiveClientPortalSession(supabase);

  const existingPoptavkaId = String(formData.get("poptavka_id") ?? "").trim() || undefined;
  const errorPath = existingPoptavkaId
    ? `/portal/poptavka/${existingPoptavkaId}`
    : "/portal/poptavka/nova";

  const wizardStep = Number(String(formData.get("wizard_step") ?? "0"));
  if (wizardStep < 4) {
    redirectWithError(errorPath, "wizard_step_locked");
  }

  const values = parsePoptavkaFormData(formData);
  const technika = parseTechnikaFormData(formData);
  const sestava = parseSestavaFormData(formData);
  const katalog = await loadPortalSestavaKatalog();

  const vyjezdError = validateTechnikVyjezdOrderComplete({
    values,
    technika,
    sestava,
    katalog,
  });
  if (vyjezdError) {
    redirectWithError(errorPath, vyjezdError);
  }

  let poptavkaId: string;
  try {
    poptavkaId = await persistPoptavkaFromFormData(supabase, session, formData, existingPoptavkaId);
    await upsertTechnikVyjezdOrder(supabase, poptavkaId, formData, values);
  } catch {
    redirectWithError(errorPath, "setups_failed");
  }

  const detail = await loadPoptavkaDetail(supabase, poptavkaId);
  if (!detail) {
    redirectWithError(errorPath, "save_failed");
  }

  await finalizePoptavkaSubmission(supabase, poptavkaId, detail, {
    redirectQuery: "technik_vyjezd_ordered=1",
  });
}
