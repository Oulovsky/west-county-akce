import type { PoptavkaFotkaTyp, PoptavkaFotka } from "@/lib/client-portal/types";
import { POPTAVKA_FOTKA_TYPY } from "@/lib/client-portal/types";
import {
  PHOTO_UPLOAD_ACCEPT,
  PHOTO_INVALID_TYPE_MESSAGE,
  PHOTO_UPLOAD_SIZE_MESSAGE,
  getPhotoExtension,
  mapStorageUploadErrorMessage,
  photoValidationMessage,
  resolvePhotoMimeType,
  validatePhotoUploadFile,
  type PhotoValidationErrorCode,
} from "@/lib/photos/upload-limits";

export type PoptavkaFotkaWithUrl = PoptavkaFotka & {
  /** Signed URL náhledu (primární pro UI). */
  thumbnailSignedUrl: string | null;
  /** Signed URL originálu — null při seznamovém načtení, na vyžádání po kliknutí. */
  signedUrl: string | null;
};

/** URL pro zobrazení v mřížce — náhled, případně fallback na originál. */
export function poptavkaFotkaPreviewUrl(
  fotka: Pick<PoptavkaFotkaWithUrl, "thumbnailSignedUrl" | "signedUrl">
): string | null {
  return fotka.thumbnailSignedUrl ?? fotka.signedUrl;
}

export const POPTAVKA_FOTKY_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const POPTAVKA_FOTKY_ACCEPT = PHOTO_UPLOAD_ACCEPT;

export const POPTAVKA_FOTKA_TYP_LABELS: Record<PoptavkaFotkaTyp, string> = {
  rozvadec: "Rozvaděč",
  prijezd: "Příjezd",
  plocha_stage: "Plocha pro stage",
  povrch_pristup: "Povrch a přístup",
  misto_akce: "Místo akce",
  jina: "Jiné",
};

export type PoptavkaPhotoValidationError = PhotoValidationErrorCode;

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
  return resolvePhotoMimeType(file);
}

export function validatePoptavkaPhotoFile(
  file: Pick<File, "type" | "name" | "size">
):
  | { ok: true; mimeType: string }
  | { ok: false; code: PoptavkaPhotoValidationError; message: string } {
  return validatePhotoUploadFile(file);
}

export function isValidPoptavkaUploadFile(file: File): boolean {
  return validatePoptavkaPhotoFile(file).ok;
}

export function getPoptavkaFotkaExtension(mimeType: string) {
  return getPhotoExtension(mimeType);
}

/** Vrátí klientský thumbnail z FormData podle clientId (volitelný). */
export function getPoptavkaPhotoThumbnailFromFormData(
  formData: FormData,
  clientId: string
): File | null {
  if (!clientId) return null;
  const value = formData.get(`photo_thumbnail_${clientId}`);
  if (value != null && isFormDataUploadFile(value) && value.size > 0) {
    return value;
  }
  return null;
}

export function collectPoptavkaPhotoThumbnailsForUpload(
  files: File[],
  clientIds: string[] | undefined,
  formData: FormData
): Array<File | null> {
  return files.map((_, index) => {
    const clientId = clientIds?.[index]?.trim();
    if (!clientId) return null;
    return getPoptavkaPhotoThumbnailFromFormData(formData, clientId);
  });
}

export function poptavkaPhotoValidationMessage(code: PoptavkaPhotoValidationError): string {
  return photoValidationMessage(code);
}

export { mapStorageUploadErrorMessage, PHOTO_UPLOAD_SIZE_MESSAGE, PHOTO_INVALID_TYPE_MESSAGE };
