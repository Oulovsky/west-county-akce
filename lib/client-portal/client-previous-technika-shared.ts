import type { SetupOblast } from "@/lib/client-portal/types";

export type ClientPortalPreviousTechnikaSourceKind = "confirmed_order" | "previous_poptavka";

export type ClientPortalPreviousTechnikaSetupRow = {
  setup_id: string;
  nazev: string;
  oblast: SetupOblast;
  mnozstvi: number;
  poznamka_klienta: string | null;
};

export type ClientPortalPreviousTechnikaOption = {
  option_id: string;
  poptavka_id: string;
  source_kind: ClientPortalPreviousTechnikaSourceKind;
  source_label: string;
  akce_nazev: string;
  datum_label: string;
  misto_id: string | null;
  misto_label: string | null;
  setupy: ClientPortalPreviousTechnikaSetupRow[];
  oblast_badges: SetupOblast[];
  skipped_setup_count: number;
  warnings: string[];
};

export const PREVIOUS_TECHNIKA_DISCLAIMER =
  "Toto je návrh podle předchozí akce. Dostupnost a finální rozsah potvrdíme až v závazné objednávce.";
