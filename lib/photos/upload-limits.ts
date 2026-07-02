import {
  isHeicPhotoMime,
  PHOTO_HEIC_UNSUPPORTED_MESSAGE,
  PHOTO_SELECTABLE_MIME_TYPES,
  PHOTO_STORAGE_MIME_TYPES,
  type PhotoSelectableMimeType,
  type PhotoStorageMimeType,
} from "@/lib/photos/heic-support";

/** Maximální velikost jedné fotky v bajtech (ne rozměr obrázku). */
export const MAX_PHOTO_UPLOAD_SIZE_MB = 20;
export const MAX_PHOTO_UPLOAD_SIZE_BYTES = MAX_PHOTO_UPLOAD_SIZE_MB * 1024 * 1024;

export {
  PHOTO_HEIC_UNSUPPORTED_MESSAGE,
  PHOTO_SELECTABLE_MIME_TYPES,
  PHOTO_STORAGE_MIME_TYPES,
  isHeicPhotoFile,
  isHeicPhotoMime,
} from "@/lib/photos/heic-support";

export const PHOTO_ALLOWED_MIME_TYPES = PHOTO_STORAGE_MIME_TYPES;

export type PhotoAllowedMimeType = PhotoStorageMimeType;

export const PHOTO_UPLOAD_ACCEPT =
  ".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif";

export type PhotoValidationErrorCode =
  | "empty_file"
  | "invalid_type"
  | "file_too_large"
  | "heic_unsupported";

export const PHOTO_UPLOAD_SIZE_MESSAGE =
  "Fotka je příliš velká. Maximální velikost jedné fotky je 20 MB.";

export const PHOTO_STORAGE_LIMIT_MESSAGE = "Fotka překročila limit 20 MB.";

export const PHOTO_INVALID_TYPE_MESSAGE =
  "Povolené formáty: JPG, PNG, WebP nebo HEIC (iPhone).";

export const PHOTO_UPLOAD_INFO_TEXT =
  "Maximální velikost jedné fotky je 20 MB. Fotky se v systému zobrazují přes náhledy, originál se načítá až po otevření.";

export const PHOTO_TECHNICAL_CAPTURE_HINT =
  "Foťte celý rozvaděč, příjezd nebo místo tak, aby byly čitelné důležité detaily.";

export function isAllowedPhotoMimeType(value: string | null | undefined): value is PhotoStorageMimeType {
  const normalized = (value ?? "").trim().toLowerCase();
  return (PHOTO_STORAGE_MIME_TYPES as readonly string[]).includes(normalized);
}

export function resolvePhotoMimeType(
  file: Pick<File, "type" | "name">
): PhotoSelectableMimeType | null {
  const normalizedType = file.type.trim().toLowerCase();
  if ((PHOTO_SELECTABLE_MIME_TYPES as readonly string[]).includes(normalizedType)) {
    return normalizedType as PhotoSelectableMimeType;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  return null;
}

/** Validace při výběru souboru (klient) — povolí i HEIC z iPhonu. */
export function validatePhotoFileSelection(
  file: Pick<File, "type" | "name" | "size">
):
  | { ok: true; mimeType: PhotoSelectableMimeType; isHeic: boolean }
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

  return { ok: true, mimeType, isHeic: isHeicPhotoMime(mimeType) };
}

/**
 * Validace před uložením do Storage (server / po konverzi HEIC).
 * HEIC bez konverze odmítne srozumitelnou hláškou — bucket nemusí povolovat image/heic.
 */
export function validatePhotoUploadFile(
  file: Pick<File, "type" | "name" | "size">
):
  | { ok: true; mimeType: PhotoStorageMimeType }
  | { ok: false; code: PhotoValidationErrorCode; message: string } {
  const selection = validatePhotoFileSelection(file);
  if (!selection.ok) {
    return selection;
  }

  if (selection.isHeic || isHeicPhotoMime(selection.mimeType)) {
    return {
      ok: false,
      code: "heic_unsupported",
      message: PHOTO_HEIC_UNSUPPORTED_MESSAGE,
    };
  }

  return { ok: true, mimeType: selection.mimeType as PhotoStorageMimeType };
}

export function photoValidationMessage(code: PhotoValidationErrorCode): string {
  if (code === "empty_file") return "Soubor je prázdný.";
  if (code === "file_too_large") return PHOTO_UPLOAD_SIZE_MESSAGE;
  if (code === "heic_unsupported") return PHOTO_HEIC_UNSUPPORTED_MESSAGE;
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
