import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";
import { POPTAVKA_FOTKA_TYPY } from "@/lib/client-portal/types";

export const POPTAVKA_FOTKY_MAX_SIZE_BYTES = 25 * 1024 * 1024;

export const POPTAVKA_FOTKY_MAX_SIZE_LABEL = "25 MB";

export const POPTAVKA_FOTKY_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const POPTAVKA_FOTKY_ACCEPT = POPTAVKA_FOTKY_ALLOWED_MIME_TYPES.join(",");

export const POPTAVKA_FOTKA_TYP_LABELS: Record<PoptavkaFotkaTyp, string> = {
  rozvadec: "Rozvaděč",
  prijezd: "Příjezd",
  plocha_stage: "Plocha pro stage",
  povrch_pristup: "Povrch a přístup",
  misto_akce: "Místo akce",
  jina: "Jiné",
};

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
    typeof file.arrayBuffer === "function"
  );
}

export function resolvePoptavkaPhotoMimeType(file: File): string | null {
  if ((POPTAVKA_FOTKY_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

export function isValidPoptavkaUploadFile(file: File): boolean {
  return (
    resolvePoptavkaPhotoMimeType(file) !== null && file.size <= POPTAVKA_FOTKY_MAX_SIZE_BYTES
  );
}

export function getPoptavkaFotkaExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
