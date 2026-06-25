import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";

/** Výchozí katalog — lze přepsat z DB tabulky portal_konfigurator_katalog. */
export const DEFAULT_PORTAL_SESTAVA_KATALOG: PortalSestavaKatalog = {
  mobilni_stage: {
    nazev: "Mobilní stage",
    default_sirka_m: 8,
    default_hloubka_m: 6,
    max_cista_vyska_m: 5.5,
    pa_na_stativech: true,
  },
  zastreseni_varianty: [
    {
      id: "mala",
      nazev: "Malé zastřešení",
      min_sirka_m: 6,
      max_sirka_m: 10,
      min_hloubka_m: 4,
      max_hloubka_m: 8,
      max_cista_vyska_m: 5.0,
      doporucena_sirky_m: [8, 10],
      doporucene_hloubky_m: [6, 8],
    },
    {
      id: "velka",
      nazev: "Velké zastřešení",
      min_sirka_m: 10,
      max_sirka_m: 14,
      min_hloubka_m: 8,
      max_hloubka_m: 12,
      max_cista_vyska_m: 6.5,
      doporucena_sirky_m: [12, 14],
      doporucene_hloubky_m: [10, 12],
    },
    {
      id: "nejvetsi",
      nazev: "Největší zastřešení",
      min_sirka_m: 14,
      max_sirka_m: 20,
      min_hloubka_m: 10,
      max_hloubka_m: 16,
      max_cista_vyska_m: 8.0,
      doporucena_sirky_m: [16, 20],
      doporucene_hloubky_m: [12, 16],
    },
  ],
  podium_modul_sirka_m: 2,
  podium_modul_hloubka_m: 1,
  podium_vysky_m: [0.4, 0.6, 0.8, 1.0, 1.2, 1.4],
  praktikabl_varianty: [
    { id: "maly", nazev: "Malý (2×2 m)", sirka_m: 2, hloubka_m: 2, vyska_m: 0.4 },
    { id: "standard", nazev: "Standard (3×2 m)", sirka_m: 3, hloubka_m: 2, vyska_m: 0.4 },
    { id: "velky", nazev: "Velký (4×2 m)", sirka_m: 4, hloubka_m: 2, vyska_m: 0.6 },
  ],
  led_typy: [
    {
      kod: "p2_indoor",
      nazev: "P2 indoor",
      pixel_pitch: "P2",
      prostredi: "indoor",
      panel_sirka_m: 0.5,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.25,
      je_mantinel: false,
      sklad_polozka_id: null,
      dostupnych_panelu: 98,
      max_plocha_m2: 24.5,
      default_sirka_m: 7,
      default_vyska_m: 3.5,
    },
    {
      kod: "p2_6_outdoor",
      nazev: "P2,6 outdoor",
      pixel_pitch: "P2,6",
      prostredi: "outdoor",
      panel_sirka_m: 0.5,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.25,
      je_mantinel: false,
      sklad_polozka_id: null,
      dostupnych_panelu: 70,
      max_plocha_m2: 17.5,
      default_sirka_m: 7,
      default_vyska_m: 2.5,
    },
    {
      kod: "p3_9_outdoor",
      nazev: "P3,9 outdoor",
      pixel_pitch: "P3,9",
      prostredi: "outdoor",
      panel_sirka_m: 0.5,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.25,
      je_mantinel: false,
      sklad_polozka_id: null,
      dostupnych_panelu: 180,
      max_plocha_m2: 45,
      default_sirka_m: 8,
      default_vyska_m: 4.5,
    },
    {
      kod: "p4_8_outdoor",
      nazev: "P4,8 outdoor",
      pixel_pitch: "P4,8",
      prostredi: "outdoor",
      panel_sirka_m: 0.5,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.25,
      je_mantinel: false,
      sklad_polozka_id: null,
      dostupnych_panelu: 90,
      max_plocha_m2: 22.5,
      default_sirka_m: 7.5,
      default_vyska_m: 3,
    },
    {
      kod: "p6_4_mantel",
      nazev: "P6,4 mantinel",
      pixel_pitch: "P6,4",
      prostredi: "outdoor",
      panel_sirka_m: 0.96,
      panel_vyska_m: 0.96,
      panel_plocha_m2: 0.9216,
      je_mantinel: true,
      sklad_polozka_id: null,
      dostupnych_panelu: 22,
      max_plocha_m2: 21,
      default_sirka_m: 21,
      default_vyska_m: 1,
    },
  ],
  zvuk_presety: [
    { kod: "mala", nazev: "Malá sestava", oblast: "sound", setup_id: null },
    { kod: "stredni", nazev: "Střední sestava", oblast: "sound", setup_id: null },
    { kod: "velka", nazev: "Velká sestava", oblast: "sound", setup_id: null },
  ],
  svetla_presety: [
    { kod: "mala", nazev: "Malá sestava", oblast: "lights", setup_id: null, aktivni: true, poradi: 1 },
    { kod: "stredni", nazev: "Střední sestava", oblast: "lights", setup_id: null, aktivni: true, poradi: 2 },
    { kod: "velka", nazev: "Velká sestava", oblast: "lights", setup_id: null, aktivni: true, poradi: 3 },
  ],
  kamery_dron: {
    max_pocet_kamer: 3,
    dron_povolen: true,
    poznamka: "Kamery a dron jsou vždy včetně obsluhy WEST COUNTY.",
  },
};

export function normalizePortalSestavaKatalog(
  input: Partial<PortalSestavaKatalog> | null | undefined
): PortalSestavaKatalog {
  const base = { ...DEFAULT_PORTAL_SESTAVA_KATALOG, ...input };
  return {
    ...base,
    kamery_dron: {
      ...DEFAULT_PORTAL_SESTAVA_KATALOG.kamery_dron,
      ...(input?.kamery_dron ?? {}),
    },
    zastreseni_varianty: (input?.zastreseni_varianty ?? base.zastreseni_varianty).map((row, index) => ({
      aktivni: true,
      poradi: index + 1,
      ...row,
    })),
    praktikabl_varianty: (input?.praktikabl_varianty ?? base.praktikabl_varianty).map((row, index) => ({
      aktivni: true,
      poradi: index + 1,
      ...row,
    })),
    led_typy: (input?.led_typy ?? base.led_typy).map((row, index) => ({
      aktivni: true,
      poradi: index + 1,
      ...row,
    })),
    zvuk_presety: (input?.zvuk_presety ?? base.zvuk_presety).map((row, index) => ({
      aktivni: true,
      poradi: index + 1,
      ...row,
    })),
    svetla_presety: (input?.svetla_presety ?? base.svetla_presety).map((row, index) => ({
      aktivni: true,
      poradi: index + 1,
      ...row,
    })),
  };
}

export function isKatalogPolozkaAktivni(aktivni: boolean | undefined) {
  return aktivni !== false;
}

export function findZastreseniVariant(
  katalog: PortalSestavaKatalog,
  id: string | null | undefined
) {
  if (!id) return null;
  return katalog.zastreseni_varianty.find((row) => row.id === id) ?? null;
}

export function findLedTyp(katalog: PortalSestavaKatalog, kod: string | null | undefined) {
  if (!kod) return null;
  return katalog.led_typy.find((row) => row.kod === kod) ?? null;
}

export function findPraktikablVariant(
  katalog: PortalSestavaKatalog,
  id: string | null | undefined
) {
  if (!id) return null;
  return katalog.praktikabl_varianty.find((row) => row.id === id) ?? null;
}

export function getMaxCistaVyska(
  katalog: PortalSestavaKatalog,
  stageTyp: "mobilni" | "zastresene" | null,
  zastreseniVariantId: string | null
): number | null {
  if (stageTyp === "mobilni") return katalog.mobilni_stage.max_cista_vyska_m;
  const variant = findZastreseniVariant(katalog, zastreseniVariantId);
  return variant?.max_cista_vyska_m ?? null;
}

export function computeLedMaxFromStock(
  panelSirkaM: number,
  panelVyskaM: number,
  dostupnychPanelu: number
): number {
  if (panelSirkaM <= 0 || panelVyskaM <= 0 || dostupnychPanelu <= 0) return 0;
  return dostupnychPanelu * panelSirkaM * panelVyskaM;
}

export function computePodiumModuly(
  katalog: PortalSestavaKatalog,
  sirkaM: number | null,
  hloubkaM: number | null
): number {
  if (!sirkaM || !hloubkaM || sirkaM <= 0 || hloubkaM <= 0) return 0;
  const cols = Math.ceil(sirkaM / katalog.podium_modul_sirka_m);
  const rows = Math.ceil(hloubkaM / katalog.podium_modul_hloubka_m);
  return cols * rows;
}

export function estimatePodiumLegs(modulu: number): number {
  if (modulu <= 0) return 0;
  return Math.max(4, Math.ceil(modulu / 2) + 2);
}
