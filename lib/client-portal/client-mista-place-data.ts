import type { ClientPortalMistoSummary } from "@/lib/client-portal/client-mista-shared";
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
