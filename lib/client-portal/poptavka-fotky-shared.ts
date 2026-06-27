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

export function getPoptavkaFotkaExtension(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
