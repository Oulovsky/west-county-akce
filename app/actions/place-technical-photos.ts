"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PHOTO_BUCKET = "mista-fotky";
const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_PHOTO_KINDS = new Set([
  "rozvadec",
  "prijezd",
  "parkovani",
  "kabel",
  "stage",
  "omezeni",
  "problem",
  "jina",
]);

function getRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`Chybí ${label}.`);
  }
  return value;
}

function getStringList(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value ?? "").trim());
}

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function getExtensionFromMetadata(mimeType: string | null, storagePath: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg") return "jpg";

  const extension = storagePath.split(".").pop()?.toLowerCase();
  if (extension === "png" || extension === "webp" || extension === "jpg" || extension === "jpeg") {
    return extension === "jpeg" ? "jpg" : extension;
  }

  return "jpg";
}

function formError(errorMessage: string) {
  return { ok: false, errorMessage };
}

export async function uploadPlaceTechnicalPhotosAction(formData: FormData) {
  const mistoId = getRequiredText(formData, "misto_id", "ID místa");
  const zakazkaId = String(formData.get("zakazka_id") ?? "").trim() || null;
  const files = formData.getAll("photo_files").filter((value): value is File => value instanceof File && value.size > 0);
  const photoTypes = getStringList(formData, "photo_types");
  const photoDescriptions = getStringList(formData, "photo_descriptions");
  const photoImportant = getStringList(formData, "photo_important");

  if (files.length === 0) {
    return formError("Vyberte prosím alespoň jednu fotku.");
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return formError("Pro nahrání interních fotek musíte být přihlášeni.");
  }

  const adminSupabase = createAdminClient();

  if (zakazkaId) {
    const { data: zakazka, error: zakazkaError } = await adminSupabase
      .from("zakazky")
      .select("zakazka_id, misto_id")
      .eq("zakazka_id", zakazkaId)
      .maybeSingle();

    if (zakazkaError) {
      return formError(`Ověření zakázky selhalo: ${zakazkaError.message}`);
    }

    if (!zakazka) {
      return formError("Zakázka pro interní fotku nebyla nalezena.");
    }

    if (zakazka.misto_id !== mistoId) {
      return formError("Fotku lze nahrát jen k místu, které je navázané na tuto zakázku.");
    }
  }

  for (const file of files) {
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      return formError("Fotky musí být ve formátu JPG, PNG nebo WebP.");
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      return formError("Jedna fotka může mít maximálně 10 MB.");
    }
  }

  const metadataRows = [];

  for (const [index, file] of files.entries()) {
    const typ = ALLOWED_PHOTO_KINDS.has(photoTypes[index]) ? photoTypes[index] : "jina";
    const extension = getExtension(file);
    const storagePath = `mista/${mistoId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await adminSupabase.storage
      .from(PHOTO_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return formError(`Nahrání fotky selhalo: ${uploadError.message}`);
    }

    metadataRows.push({
      misto_id: mistoId,
      zakazka_id: zakazkaId,
      autor_id: userData.user.id,
      storage_bucket: PHOTO_BUCKET,
      storage_path: storagePath,
      typ,
      popis: photoDescriptions[index] || null,
      dulezite: photoImportant[index] === "true",
      original_filename: file.name || null,
      mime_type: file.type || null,
      size_bytes: file.size,
    });
  }

  const { error: metadataError } = await adminSupabase.from("misto_technicke_fotky").insert(metadataRows);
  if (metadataError) {
    return formError(`Uložení metadat fotek selhalo: ${metadataError.message}`);
  }

  revalidatePath(`/mista/${mistoId}`);
  if (zakazkaId) {
    revalidatePath(`/zakazky/${zakazkaId}`);
  }

  return { ok: true, errorMessage: null };
}

export async function promoteQuestionnairePhotoToPlaceKnowHowAction(formData: FormData) {
  const questionnairePhotoId = getRequiredText(formData, "questionnaire_photo_id", "ID fotky");
  const mistoId = getRequiredText(formData, "misto_id", "ID místa");
  const zakazkaId = getRequiredText(formData, "zakazka_id", "ID zakázky");
  const requestedType = getRequiredText(formData, "typ", "typ fotky");
  const typ = ALLOWED_PHOTO_KINDS.has(requestedType) ? requestedType : "jina";
  const popis = String(formData.get("popis") ?? "").trim() || null;
  const dulezite = formData.get("dulezite") === "on";

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return formError("Pro uložení fotky do know-how místa musíte být přihlášeni.");
  }

  const adminSupabase = createAdminClient();

  const { data: zakazka, error: zakazkaError } = await adminSupabase
    .from("zakazky")
    .select("zakazka_id, misto_id")
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (zakazkaError) {
    return formError(`Ověření zakázky selhalo: ${zakazkaError.message}`);
  }

  if (!zakazka || zakazka.misto_id !== mistoId) {
    return formError("Fotku lze uložit jen k místu, které je navázané na tuto zakázku.");
  }

  const { data: sourcePhoto, error: sourceError } = await adminSupabase
    .from("dotaznik_fotky")
    .select("id, zakazka_id, storage_bucket, storage_path, original_filename, mime_type, size_bytes")
    .eq("id", questionnairePhotoId)
    .eq("zakazka_id", zakazkaId)
    .maybeSingle();

  if (sourceError) {
    return formError(`Načtení zdrojové fotky selhalo: ${sourceError.message}`);
  }

  if (!sourcePhoto) {
    return formError("Zdrojová fotka dotazníku nebyla nalezena.");
  }

  const { data: sourceBlob, error: downloadError } = await adminSupabase.storage
    .from(sourcePhoto.storage_bucket)
    .download(sourcePhoto.storage_path);

  if (downloadError || !sourceBlob) {
    return formError(`Stažení zdrojové fotky selhalo: ${downloadError?.message ?? "soubor není dostupný"}`);
  }

  const extension = getExtensionFromMetadata(sourcePhoto.mime_type, sourcePhoto.storage_path);
  const targetPath = `mista/${mistoId}/promoted/${randomUUID()}.${extension}`;

  const { error: uploadError } = await adminSupabase.storage
    .from(PHOTO_BUCKET)
    .upload(targetPath, sourceBlob, {
      contentType: sourcePhoto.mime_type || sourceBlob.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    return formError(`Uložení kopie do interních fotek selhalo: ${uploadError.message}`);
  }

  const { error: insertError } = await adminSupabase.from("misto_technicke_fotky").insert({
    misto_id: mistoId,
    zakazka_id: zakazkaId,
    autor_id: userData.user.id,
    storage_bucket: PHOTO_BUCKET,
    storage_path: targetPath,
    typ,
    popis,
    dulezite,
    original_filename: sourcePhoto.original_filename,
    mime_type: sourcePhoto.mime_type || sourceBlob.type || null,
    size_bytes: sourcePhoto.size_bytes ?? sourceBlob.size ?? null,
  });

  if (insertError) {
    return formError(`Uložení záznamu do know-how místa selhalo: ${insertError.message}`);
  }

  revalidatePath(`/zakazky/${zakazkaId}`);
  revalidatePath(`/mista/${mistoId}`);

  return { ok: true, errorMessage: null };
}
