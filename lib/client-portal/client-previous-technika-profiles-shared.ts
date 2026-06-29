import type { PoptavkaTechnikaFormValues } from "@/lib/client-portal/poptavka-technika-form";

export type ClientPortalPreviousTechnikaProfileOption = {
  option_id: string;
  poptavka_id: string;
  akce_nazev: string;
  datum_label: string;
  misto_id: string | null;
  misto_label: string | null;
  technika_summary: string;
  technika_values: PoptavkaTechnikaFormValues;
  photo_count: number;
  has_photos: boolean;
};

export const PREVIOUS_TECHNIKA_PROFILE_WARNING =
  "Načtou se technické údaje a fotky z předchozí akce. Zkontrolujte prosím aktuálnost údajů — elektro, přístup, terén i omezení se mohly změnit.";
