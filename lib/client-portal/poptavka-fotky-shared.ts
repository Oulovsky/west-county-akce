import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";
import { POPTAVKA_FOTKA_TYPY } from "@/lib/client-portal/types";

export const POPTAVKA_FOTKY_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const POPTAVKA_FOTKY_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

export const POPTAVKA_FOTKA_TYP_LABELS: Record<PoptavkaFotkaTyp, string> = {
  rozvadec: "Rozvaděč",
  prijezd: "Příjezd",
  plocha_stage: "Plocha pro stage",
  povrch_pristup: "Povrch a přístup",
  misto_akce: "Místo akce",
  jina: "Jiné",
};

export type PoptavkaPhotoValidationError = "invalid_type" | "empty_file";

export function isAllowedPoptavkaFotkaTyp(value: string): value is PoptavkaFotkaTyp {
  return (POPTAVKA_FOTKA_TYPY as readonly string[]).includes(value);
}

/** Server/client: FormData file entry (avoids brittle `instanceof File` on server). */
export function isFormDataUploadFile(value: FormDataEntryValue): value is File {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const file = value as File;
  return (
    typeof file.size === "number" &&
    file.size > 0 &&
    (typeof file.arrayBuffer === "function" ||
      typeof file.stream === "function" ||
      typeof (file as Blob).arrayBuffer === "function")
  );
}

/** Odstraní všechny File/Blob položky — hlavní formulář nesmí posílat fotky. */
export function stripFilesFromFormData(formData: FormData): FormData {
  const clean = new FormData();
  for (const [key, value] of formData.entries()) {
    if (isFormDataUploadFile(value)) continue;
    clean.append(key, value);
  }
  return clean;
}

export function resolvePoptavkaPhotoMimeType(file: Pick<File, "type" | "name">): string | null {
  const normalizedType = file.type.trim().toLowerCase();
  if ((POPTAVKA_FOTKY_ALLOWED_MIME_TYPES as readonly string[]).includes(normalizedType)) {
    return normalizedType;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return null;
}

export function validatePoptavkaPhotoFile(
  file: Pick<File, "type" | "name" | "size">
):
  | { ok: true; mimeType: string }
  | { ok: false; code: PoptavkaPhotoValidationError; message: string } {
  if (file.size <= 0) {
    return { ok: false, code: "empty_file", message: "Soubor je prázdný." };
  }
  const mimeType = resolvePoptavkaPhotoMimeType(file);
  if (!mimeType) {
    return {
      ok: false,
      code: "invalid_type",
      message: "Povolené formáty: JPG, PNG, WebP, HEIC.",
    };
  }
  return { ok: true, mimeType };
}

export function isValidPoptavkaUploadFile(file: File): boolean {
  return validatePoptavkaPhotoFile(file).ok;
}

export function getPoptavkaFotkaExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic" || mimeType === "image/heif") return "heic";
  return "jpg";
}

export function poptavkaPhotoValidationMessage(code: PoptavkaPhotoValidationError): string {
  if (code === "empty_file") return "Soubor je prázdný.";
  return "Povolené formáty: JPG, PNG, WebP, HEIC.";
}
