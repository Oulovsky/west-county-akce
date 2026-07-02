export const PHOTO_HEIC_MIME_TYPES = ["image/heic", "image/heif"] as const;

export type PhotoHeicMimeType = (typeof PHOTO_HEIC_MIME_TYPES)[number];

export const PHOTO_HEIC_UNSUPPORTED_MESSAGE =
  "Fotka z iPhonu je ve formátu HEIC. Převeďte ji prosím na JPG, nebo v iPhonu nastavte Fotoaparát → Formáty → Nejkompatibilnější.";

export const PHOTO_STORAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PhotoStorageMimeType = (typeof PHOTO_STORAGE_MIME_TYPES)[number];

export const PHOTO_SELECTABLE_MIME_TYPES = [
  ...PHOTO_STORAGE_MIME_TYPES,
  ...PHOTO_HEIC_MIME_TYPES,
] as const;

export type PhotoSelectableMimeType = (typeof PHOTO_SELECTABLE_MIME_TYPES)[number];

export function isHeicPhotoMime(mime: string | null | undefined): mime is PhotoHeicMimeType {
  const normalized = (mime ?? "").trim().toLowerCase();
  return (PHOTO_HEIC_MIME_TYPES as readonly string[]).includes(normalized);
}

export function isHeicPhotoFile(file: Pick<File, "type" | "name">): boolean {
  if (isHeicPhotoMime(file.type.trim().toLowerCase())) {
    return true;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension === "heic" || extension === "heif";
}

export function isStorageReadyPhotoMime(
  mime: string | null | undefined
): mime is PhotoStorageMimeType {
  const normalized = (mime ?? "").trim().toLowerCase();
  return (PHOTO_STORAGE_MIME_TYPES as readonly string[]).includes(normalized);
}

export function heicFileToJpegName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim() || "photo";
  return `${base}.jpg`;
}
