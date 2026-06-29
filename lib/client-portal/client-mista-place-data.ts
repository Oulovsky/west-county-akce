import type { ClientPortalMistoSummary } from "@/lib/client-portal/client-mista-shared";
import type { ClientPlacePreset } from "@/lib/client-portal/client-presets-shared";
import type { PoptavkaFormValues } from "@/lib/client-portal/poptavka-form";

/** Pouze údaje místa — bez sestavy, setupů ani technických podmínek. */
export function buildPlaceFieldsFromSavedMisto(
  misto: ClientPortalMistoSummary,
  current?: Pick<
    PoptavkaFormValues,
    "misto_nazev" | "misto_adresa" | "misto_poznamka" | "presny_popis_mista"
  >
): Pick<
  PoptavkaFormValues,
  | "misto_source"
  | "misto_id"
  | "misto_adresa"
  | "misto_lat"
  | "misto_lng"
  | "misto_poznamka"
> {
  return {
    misto_source: "saved",
    misto_id: misto.misto_id,
    misto_adresa: misto.adresa_text?.trim() || current?.misto_adresa?.trim() || "",
    misto_lat: misto.lat,
    misto_lng: misto.lng,
    misto_poznamka: misto.poznamka?.trim() || current?.misto_poznamka?.trim() || "",
  };
}

/** Údaje místa z klientského presetu — bez sestavy a technických podmínek. */
export function buildPlaceFieldsFromPlacePreset(
  preset: ClientPlacePreset,
  current?: Pick<
    PoptavkaFormValues,
    "misto_nazev" | "misto_adresa" | "misto_poznamka" | "presny_popis_mista"
  >
): Pick<
  PoptavkaFormValues,
  | "misto_source"
  | "misto_id"
  | "misto_nazev"
  | "misto_adresa"
  | "misto_lat"
  | "misto_lng"
  | "misto_poznamka"
  | "presny_popis_mista"
> {
  const poznamky = [
    preset.poznamka_prijezd?.trim(),
    preset.omezeni_vjezdu?.trim() ? `Omezení vjezdu: ${preset.omezeni_vjezdu.trim()}` : null,
    preset.poznamka_manipulace?.trim()
      ? `Manipulace: ${preset.poznamka_manipulace.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    misto_source: preset.source_misto_id ? "saved" : "new",
    misto_id: preset.source_misto_id,
    misto_nazev: preset.nazev.trim() || current?.misto_nazev?.trim() || "",
    misto_adresa: preset.adresa_text?.trim() || current?.misto_adresa?.trim() || "",
    misto_lat: preset.lat,
    misto_lng: preset.lng,
    presny_popis_mista:
      preset.presny_popis_mista?.trim() || current?.presny_popis_mista?.trim() || "",
    misto_poznamka: poznamky || current?.misto_poznamka?.trim() || "",
  };
}
