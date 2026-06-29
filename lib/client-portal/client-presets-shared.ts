import type { PoptavkaTechnikaFormValues } from "@/lib/client-portal/poptavka-technika-form";
import type { SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";
import type { ClientPortalPreviousTechnikaSetupRow } from "@/lib/client-portal/client-previous-technika-shared";

export type ClientPlacePreset = {
  preset_id: string;
  nazev: string;
  adresa_text: string | null;
  lat: number | null;
  lng: number | null;
  presny_popis_mista: string | null;
  poznamka_prijezd: string | null;
  omezeni_vjezdu: string | null;
  poznamka_manipulace: string | null;
  interni_poznamka_klienta: string | null;
  source_poptavka_id: string | null;
  source_misto_id: string | null;
  updated_at: string;
};

export type ClientTechnicalPreset = {
  preset_id: string;
  nazev: string;
  technicke_data: PoptavkaTechnikaFormValues;
  source_poptavka_id: string | null;
  source_misto_id: string | null;
  updated_at: string;
};

export type ClientSetupPresetSetupRow = {
  setup_id: string;
  mnozstvi: number;
  poznamka_klienta: string | null;
};

export type ClientSetupPreset = {
  preset_id: string;
  nazev: string;
  sestava_konfigurator: SestavaKonfiguratorState;
  setupy: ClientSetupPresetSetupRow[];
  popis: string | null;
  source_poptavka_id: string | null;
  source_misto_id: string | null;
  updated_at: string;
};

export type ClientSetupPresetView = ClientSetupPreset & {
  setup_rows: ClientPortalPreviousTechnikaSetupRow[];
  summary_lines: string[];
};
