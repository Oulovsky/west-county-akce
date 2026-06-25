import type { SetupOblast } from "@/lib/client-portal/types";

export type StageTyp = "mobilni" | "zastresene";

export type SchodyStrana = "vlevo" | "vpravo";

export type KotveniTyp = "zatloukane" | "ibc_boxy";

export type PraktikablTyp = "zadny" | "bicí" | "jiny";

export type PraktikablUmisteni = "stred_vzadu" | "vlevo_vzadu" | "vpravo_vzadu" | "vlastni";

export type LedTypKod =
  | "p2_indoor"
  | "p2_6_outdoor"
  | "p3_9_outdoor"
  | "p4_8_outdoor"
  | "p6_4_mantel";

export type LedUmisteni = "stack_na_podiu" | "mimo_stage_branka" | "mantinel";

export type LedObsluhaObsahu = "klient_sam" | "nase_obsahu";

export type PresetVelikost = "mala" | "stredni" | "velka";

export type SestavaKonfiguratorRezim = "standard" | "atypicka";

export type SestavaKonfiguratorState = {
  rezim: SestavaKonfiguratorRezim;
  atypicka_poptavka_text: string;
  stage_typ: StageTyp | null;
  zastreseni_variant_id: string | null;
  zastreseni_sirka_m: number | null;
  zastreseni_hloubka_m: number | null;
  cista_vyska_m: number | null;
  podium_sirka_m: number | null;
  podium_hloubka_m: number | null;
  podium_vyska_m: number | null;
  schody_pocet: number;
  schody_strany: SchodyStrana[];
  praktikabl_typ: PraktikablTyp;
  praktikabl_variant_id: string | null;
  praktikabl_vyska_m: number | null;
  praktikabl_umisteni: PraktikablUmisteni | null;
  praktikabl_schudky: boolean;
  praktikabl_poznamka: string;
  kotveni_typ: KotveniTyp | null;
  kotveni_povrch: string;
  led_pozadovano: boolean;
  led_typ_kod: LedTypKod | null;
  led_sirka_m: number | null;
  led_vyska_m: number | null;
  led_umisteni: LedUmisteni | null;
  led_rohy: boolean;
  led_obsluha_obsahu: LedObsluhaObsahu | null;
  zvuk_preset: PresetVelikost | null;
  svetla_preset: PresetVelikost | null;
  kamery_pocet: number;
  dron: boolean;
  poznamka: string;
};

export type PortalLedTypKatalog = {
  kod: LedTypKod;
  nazev: string;
  aktivni?: boolean;
  poradi?: number;
  pixel_pitch: string;
  prostredi: "indoor" | "outdoor";
  panel_sirka_m: number;
  panel_vyska_m: number;
  panel_plocha_m2: number;
  je_mantinel: boolean;
  sklad_polozka_id: string | null;
  dostupnych_panelu: number;
  max_plocha_m2: number;
  default_sirka_m: number;
  default_vyska_m: number;
};

export type PortalZastreseniVarianta = {
  id: string;
  nazev: string;
  aktivni?: boolean;
  poradi?: number;
  min_sirka_m: number;
  max_sirka_m: number;
  min_hloubka_m: number;
  max_hloubka_m: number;
  max_cista_vyska_m: number;
  doporucena_sirky_m: number[];
  doporucene_hloubky_m: number[];
};

export type PortalPraktikablVarianta = {
  id: string;
  nazev: string;
  aktivni?: boolean;
  poradi?: number;
  sirka_m: number;
  hloubka_m: number;
  vyska_m: number;
};

export type PortalPresetKatalog = {
  kod: PresetVelikost;
  nazev: string;
  oblast: SetupOblast;
  setup_id: string | null;
  aktivni?: boolean;
  poradi?: number;
};

export type PortalKameryDronKatalog = {
  max_pocet_kamer: number;
  dron_povolen: boolean;
  poznamka: string;
};

export type PortalKonfiguratorKatalogRow = {
  katalog_id: string | null;
  kod: string;
  verze: number;
  aktivni: boolean;
  updated_at: string | null;
  obsah: PortalSestavaKatalog;
  from_db: boolean;
};

export type PortalSestavaKatalog = {
  zastreseni_varianty: PortalZastreseniVarianta[];
  mobilni_stage: {
    nazev: string;
    default_sirka_m: number;
    default_hloubka_m: number;
    max_cista_vyska_m: number;
    pa_na_stativech: true;
  };
  praktikabl_varianty: PortalPraktikablVarianta[];
  podium_modul_sirka_m: number;
  podium_modul_hloubka_m: number;
  podium_vysky_m: number[];
  led_typy: PortalLedTypKatalog[];
  zvuk_presety: PortalPresetKatalog[];
  svetla_presety: PortalPresetKatalog[];
  kamery_dron: PortalKameryDronKatalog;
};

export type SestavaKonfiguratorValidation = {
  warnings: string[];
  errors: string[];
};

export type SestavaOdhadModulu = {
  podium_modulu: number;
  odhad_noh: number;
  odhad_schodu: number;
};
