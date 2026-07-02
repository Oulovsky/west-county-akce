/** Maximální velikost jedné fotky v bajtech (ne rozměr obrázku). */
export const MAX_PHOTO_UPLOAD_SIZE_MB = 20;
export const MAX_PHOTO_UPLOAD_SIZE_BYTES = MAX_PHOTO_UPLOAD_SIZE_MB * 1024 * 1024;

export const PHOTO_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoAllowedMimeType = (typeof PHOTO_ALLOWED_MIME_TYPES)[number];

export const PHOTO_UPLOAD_ACCEPT =
  ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

export type PhotoValidationErrorCode = "empty_file" | "invalid_type" | "file_too_large";

export const PHOTO_UPLOAD_SIZE_MESSAGE =
  "Fotka je příliš velká. Maximální velikost jedné fotky je 20 MB.";

export const PHOTO_STORAGE_LIMIT_MESSAGE = "Fotka překročila limit 20 MB.";

export const PHOTO_INVALID_TYPE_MESSAGE = "Povolené formáty: JPG, PNG, WebP.";

export const PHOTO_UPLOAD_INFO_TEXT =
  "Maximální velikost jedné fotky je 20 MB. Fotky se v systému zobrazují přes náhledy, originál se načítá až po otevření.";

export const PHOTO_TECHNICAL_CAPTURE_HINT =
  "Foťte celý rozvaděč, příjezd nebo místo tak, aby byly čitelné důležité detaily.";

export function isAllowedPhotoMimeType(value: string | null | undefined): value is PhotoAllowedMimeType {
  const normalized = (value ?? "").trim().toLowerCase();
  return (PHOTO_ALLOWED_MIME_TYPES as readonly string[]).includes(normalized);
}

export function resolvePhotoMimeType(file: Pick<File, "type" | "name">): PhotoAllowedMimeType | null {
  const normalizedType = file.type.trim().toLowerCase();
  if (isAllowedPhotoMimeType(normalizedType)) {
    return normalizedType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

export function validatePhotoUploadFile(
  file: Pick<File, "type" | "name" | "size">
):
  | { ok: true; mimeType: PhotoAllowedMimeType }
  | { ok: false; code: PhotoValidationErrorCode; message: string } {
  if (file.size <= 0) {
    return { ok: false, code: "empty_file", message: "Soubor je prázdný." };
  }

  if (file.size > MAX_PHOTO_UPLOAD_SIZE_BYTES) {
    return { ok: false, code: "file_too_large", message: PHOTO_UPLOAD_SIZE_MESSAGE };
  }

  const mimeType = resolvePhotoMimeType(file);
  if (!mimeType) {
    return { ok: false, code: "invalid_type", message: PHOTO_INVALID_TYPE_MESSAGE };
  }

  return { ok: true, mimeType };
}

export function photoValidationMessage(code: PhotoValidationErrorCode): string {
  if (code === "empty_file") return "Soubor je prázdný.";
  if (code === "file_too_large") return PHOTO_UPLOAD_SIZE_MESSAGE;
  return PHOTO_INVALID_TYPE_MESSAGE;
}

/** Převod technické chyby Supabase Storage na srozumitelnou hlášku. */
export function mapStorageUploadErrorMessage(message: string | null | undefined): string | null {
  const lower = (message ?? "").toLowerCase();
  if (!lower) return null;

  if (
    lower.includes("payload too large") ||
    lower.includes("file size") ||
    lower.includes("too large") ||
    lower.includes("exceeded the maximum") ||
    lower.includes("maximum allowed size")
  ) {
    return PHOTO_STORAGE_LIMIT_MESSAGE;
  }

  return null;
}

export function getPhotoExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
