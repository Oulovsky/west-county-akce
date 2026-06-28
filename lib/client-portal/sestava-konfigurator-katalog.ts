import type { PortalSestavaKatalog, SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";
import type { KotveniTyp } from "@/lib/client-portal/sestava-konfigurator-types";
import { ZASTRESENI_CISTA_VYSKA_OPTIONS } from "@/lib/client-portal/sestava-konfigurator-types";
import { normalizeKonfiguratorMatchText } from "@/lib/client-portal/sestava-konfigurator-options";

/** Standardní LED panel 1 × 0,5 m = 0,5 m². */
export const STANDARD_LED_PANEL_PLOCHA_M2 = 0.5;

/** Výchozí katalog — lze přepsat z DB tabulky portal_konfigurator_katalog. */
export const DEFAULT_PODIUM_VARIANTY = [
  { id: "6x2", nazev: "Pódium 6 × 2", sirka_m: 6, hloubka_m: 2, poradi: 1 },
  { id: "6x3", nazev: "Pódium 6 × 3", sirka_m: 6, hloubka_m: 3, poradi: 2 },
  { id: "6x4", nazev: "Pódium 6 × 4", sirka_m: 6, hloubka_m: 4, poradi: 3 },
  { id: "6x6", nazev: "Pódium 6 × 6", sirka_m: 6, hloubka_m: 6, poradi: 4 },
  { id: "8x5", nazev: "Pódium 8 × 5", sirka_m: 8, hloubka_m: 5, poradi: 5 },
  { id: "8x6", nazev: "Pódium 8 × 6", sirka_m: 8, hloubka_m: 6, poradi: 6 },
  { id: "8x8", nazev: "Pódium 8 × 8", sirka_m: 8, hloubka_m: 8, poradi: 7 },
] as const;

export const DEFAULT_PORTAL_SESTAVA_KATALOG: PortalSestavaKatalog = {
  mobilni_stage: {
    nazev: "Mobilní stage",
    default_sirka_m: 8,
    default_hloubka_m: 6,
    max_cista_vyska_m: 5.5,
    pa_na_stativech: true,
    setup_id: null,
  },
  zastreseni_varianty: [
    {
      id: "8x3",
      nazev: "Zastřešení 8 × 3 m",
      sirka_m: 8,
      hloubka_m: 3,
      min_sirka_m: 8,
      max_sirka_m: 8,
      min_hloubka_m: 3,
      max_hloubka_m: 3,
      max_cista_vyska_m: 5.0,
      doporucena_sirky_m: [8],
      doporucene_hloubky_m: [3],
      povolene_podium_ids: ["6x2"],
      setup_id: null,
    },
    {
      id: "8x4",
      nazev: "Zastřešení 8 × 4 m",
      sirka_m: 8,
      hloubka_m: 4,
      min_sirka_m: 8,
      max_sirka_m: 8,
      min_hloubka_m: 4,
      max_hloubka_m: 4,
      max_cista_vyska_m: 5.0,
      doporucena_sirky_m: [8],
      doporucene_hloubky_m: [4],
      povolene_podium_ids: ["6x3"],
      setup_id: null,
    },
    {
      id: "8x6",
      nazev: "Zastřešení 8 × 6 m",
      sirka_m: 8,
      hloubka_m: 6,
      min_sirka_m: 8,
      max_sirka_m: 8,
      min_hloubka_m: 6,
      max_hloubka_m: 6,
      max_cista_vyska_m: 6.0,
      doporucena_sirky_m: [8],
      doporucene_hloubky_m: [6],
      povolene_podium_ids: ["6x4", "6x6", "8x5"],
      setup_id: null,
    },
    {
      id: "8x7",
      nazev: "Zastřešení 8 × 7 m",
      sirka_m: 8,
      hloubka_m: 7,
      min_sirka_m: 8,
      max_sirka_m: 8,
      min_hloubka_m: 7,
      max_hloubka_m: 7,
      max_cista_vyska_m: 6.0,
      doporucena_sirky_m: [8],
      doporucene_hloubky_m: [7],
      povolene_podium_ids: ["6x6"],
      setup_id: null,
    },
    {
      id: "10x8",
      nazev: "Zastřešení 10 × 8 m",
      sirka_m: 10,
      hloubka_m: 8,
      min_sirka_m: 10,
      max_sirka_m: 10,
      min_hloubka_m: 8,
      max_hloubka_m: 8,
      max_cista_vyska_m: 7.0,
      doporucena_sirky_m: [10],
      doporucene_hloubky_m: [8],
      povolene_podium_ids: ["8x6", "8x8"],
      setup_id: null,
    },
  ],
  podium_varianty: DEFAULT_PODIUM_VARIANTY.map((row) => ({ ...row, setup_id: null })),
  podium_modul_sirka_m: 2,
  podium_modul_hloubka_m: 1,
  podium_vysky_m: [0.4, 0.6, 0.8, 1.0, 1.2, 1.4],
  praktikabl_varianty: [
    { id: "2x1", nazev: "Praktikábl 2 × 1", sirka_m: 2, hloubka_m: 1, vyska_m: 0.4, setup_id: null },
    { id: "2x2", nazev: "Praktikábl 2 × 2", sirka_m: 2, hloubka_m: 2, vyska_m: 0.4, setup_id: null },
    { id: "2x3", nazev: "Praktikábl 2 × 3", sirka_m: 2, hloubka_m: 3, vyska_m: 0.4, setup_id: null },
  ],
  led_typy: [
    {
      kod: "p2_indoor",
      nazev: "P2 indoor",
      pixel_pitch: "P2",
      prostredi: "indoor",
      panel_sirka_m: 1,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.5,
      je_mantinel: false,
      podporuje_rohy: true,
      sklad_polozka_id: null,
      dostupnych_panelu: 49,
      max_plocha_m2: 24.5,
      default_sirka_m: 7,
      default_vyska_m: 3.5,
    },
    {
      kod: "p2_6_outdoor",
      nazev: "P2,6 outdoor",
      pixel_pitch: "P2,6",
      prostredi: "outdoor",
      panel_sirka_m: 1,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.5,
      je_mantinel: false,
      podporuje_rohy: true,
      sklad_polozka_id: null,
      dostupnych_panelu: 35,
      max_plocha_m2: 17.5,
      default_sirka_m: 7,
      default_vyska_m: 2.5,
    },
    {
      kod: "p3_9_outdoor",
      nazev: "P3,9 outdoor",
      pixel_pitch: "P3,9",
      prostredi: "outdoor",
      panel_sirka_m: 1,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.5,
      je_mantinel: false,
      podporuje_rohy: true,
      sklad_polozka_id: null,
      dostupnych_panelu: 90,
      max_plocha_m2: 45,
      default_sirka_m: 8,
      default_vyska_m: 4.5,
    },
    {
      kod: "p4_8_outdoor",
      nazev: "P4,8 outdoor",
      pixel_pitch: "P4,8",
      prostredi: "outdoor",
      panel_sirka_m: 1,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.5,
      je_mantinel: false,
      podporuje_rohy: true,
      sklad_polozka_id: null,
      dostupnych_panelu: 45,
      max_plocha_m2: 22.5,
      default_sirka_m: 7.5,
      default_vyska_m: 3,
    },
    {
      kod: "p6_4_mantel",
      nazev: "P6,4 mantinel",
      pixel_pitch: "P6,4",
      prostredi: "outdoor",
      panel_sirka_m: 0.5,
      panel_vyska_m: 0.5,
      panel_plocha_m2: 0.25,
      je_mantinel: true,
      podporuje_rohy: false,
      sklad_polozka_id: null,
      dostupnych_panelu: 22,
      max_plocha_m2: 21,
      default_sirka_m: 21,
      default_vyska_m: 1,
    },
  ],
  zvuk_presety: [
    { kod: "mala", nazev: "Malý PA systém", oblast: "sound", setup_id: null },
    { kod: "stredni", nazev: "Střední PA systém", oblast: "sound", setup_id: null },
    { kod: "velka", nazev: "Velký PA systém", oblast: "sound", setup_id: null },
  ],
  svetla_presety: [
    {
      kod: "mala",
      nazev: "Malá světelná sestava",
      oblast: "lights",
      setup_id: null,
      aktivni: true,
      poradi: 1,
    },
    {
      kod: "stredni",
      nazev: "Střední světelná sestava",
      oblast: "lights",
      setup_id: null,
      aktivni: true,
      poradi: 2,
    },
    {
      kod: "velka",
      nazev: "Velká světelná sestava",
      oblast: "lights",
      setup_id: null,
      aktivni: true,
      poradi: 3,
    },
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
    mobilni_stage: {
      ...DEFAULT_PORTAL_SESTAVA_KATALOG.mobilni_stage,
      ...(input?.mobilni_stage ?? {}),
    },
    zastreseni_varianty: (input?.zastreseni_varianty ?? base.zastreseni_varianty).map((row, index) => {
      const fallback = DEFAULT_PORTAL_SESTAVA_KATALOG.zastreseni_varianty.find((v) => v.id === row.id);
      const sirka = row.sirka_m ?? fallback?.sirka_m ?? row.min_sirka_m;
      const hloubka = row.hloubka_m ?? fallback?.hloubka_m ?? row.min_hloubka_m;
      return {
        aktivni: true,
        poradi: index + 1,
        setup_id: null,
        povolene_podium_ids: fallback?.povolene_podium_ids ?? row.povolene_podium_ids ?? [],
        ...row,
        sirka_m: sirka,
        hloubka_m: hloubka,
      };
    }),
    podium_varianty: (input?.podium_varianty ?? base.podium_varianty ?? DEFAULT_PODIUM_VARIANTY).map(
      (row, index) => {
        const fallback = DEFAULT_PODIUM_VARIANTY.find((v) => v.id === row.id);
        return {
          aktivni: true,
          poradi: index + 1,
          setup_id: null,
          ...fallback,
          ...row,
        };
      }
    ),
    praktikabl_varianty: (input?.praktikabl_varianty ?? base.praktikabl_varianty).map((row, index) => ({
      aktivni: true,
      poradi: index + 1,
      ...row,
    })),
    led_typy: (input?.led_typy ?? base.led_typy).map((row, index) => ({
      aktivni: true,
      poradi: index + 1,
      ...row,
      podporuje_rohy: row.je_mantinel ? false : row.podporuje_rohy !== false,
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

export function findPodiumVariant(
  katalog: PortalSestavaKatalog,
  id: string | null | undefined
) {
  if (!id) return null;
  return katalog.podium_varianty.find((row) => row.id === id) ?? null;
}

export function findZastreseniVariantByNazev(
  katalog: PortalSestavaKatalog,
  nazev: string | null | undefined
) {
  if (!nazev?.trim()) return null;
  const norm = normalizeKonfiguratorMatchText(nazev);
  return (
    katalog.zastreseni_varianty.find(
      (row) => normalizeKonfiguratorMatchText(row.nazev) === norm
    ) ?? null
  );
}

export function getPodiumVolbyProZastreseni(
  katalog: PortalSestavaKatalog,
  zastreseniVariantId: string | null | undefined
) {
  if (!zastreseniVariantId) return [];
  const variant = findZastreseniVariant(katalog, zastreseniVariantId);
  if (!variant) return [];
  const allowed = new Set(variant.povolene_podium_ids ?? []);
  return katalog.podium_varianty.filter(
    (row) => allowed.has(row.id) && isKatalogPolozkaAktivni(row.aktivni)
  );
}

export function resolvePodiumVariantFromDimensions(
  katalog: PortalSestavaKatalog,
  zastreseniVariantId: string | null | undefined,
  sirkaM: number | null,
  hloubkaM: number | null
) {
  if (!sirkaM || !hloubkaM) return null;
  return (
    getPodiumVolbyProZastreseni(katalog, zastreseniVariantId).find(
      (row) => row.sirka_m === sirkaM && row.hloubka_m === hloubkaM
    ) ?? null
  );
}

export function sanitizePodiumForZastreseni(
  katalog: PortalSestavaKatalog,
  state: Pick<
    SestavaKonfiguratorState,
    "zastreseni_variant_id" | "podium_variant_id" | "podium_setup_id" | "podium_sirka_m" | "podium_hloubka_m"
  >
): Pick<
  SestavaKonfiguratorState,
  "podium_variant_id" | "podium_setup_id" | "podium_sirka_m" | "podium_hloubka_m"
> {
  const allowed = getPodiumVolbyProZastreseni(katalog, state.zastreseni_variant_id);
  const current =
    findPodiumVariant(katalog, state.podium_variant_id) ??
    resolvePodiumVariantFromDimensions(
      katalog,
      state.zastreseni_variant_id,
      state.podium_sirka_m,
      state.podium_hloubka_m
    );

  if (current && allowed.some((row) => row.id === current.id)) {
    return {
      podium_variant_id: current.id,
      podium_setup_id: current.setup_id ?? null,
      podium_sirka_m: current.sirka_m,
      podium_hloubka_m: current.hloubka_m,
    };
  }

  return {
    podium_variant_id: null,
    podium_setup_id: null,
    podium_sirka_m: null,
    podium_hloubka_m: null,
  };
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

/** Odhad počtu standardních LED panelů (1 × 0,5 m) ze skladu — interní. */
export function computeStandardLedPanelCount(plochaM2: number): number {
  if (plochaM2 <= 0) return 0;
  return Math.round(plochaM2 / STANDARD_LED_PANEL_PLOCHA_M2);
}

export function computeLedMaxFromStock(
  panelPlochaM2: number,
  dostupnychPanelu: number
): number {
  if (panelPlochaM2 <= 0 || dostupnychPanelu <= 0) return 0;
  return dostupnychPanelu * panelPlochaM2;
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

/** Každá Nivtec deska 1 × 2 m má 4 nohy. */
export function estimatePodiumLegs(modulu: number): number {
  if (modulu <= 0) return 0;
  return modulu * 4;
}

/** Počet LED panelů z rozměru wall a rozměru jednoho panelu (mřížka nahoru). */
export function computeLedPanelCountFromDimensions(
  sirkaM: number,
  vyskaM: number,
  panelSirkaM: number,
  panelVyskaM: number
): number {
  if (sirkaM <= 0 || vyskaM <= 0 || panelSirkaM <= 0 || panelVyskaM <= 0) return 0;
  const cols = Math.ceil(sirkaM / panelSirkaM);
  const rows = Math.ceil(vyskaM / panelVyskaM);
  return cols * rows;
}

export function isIntegerMeter(value: number | null | undefined): boolean {
  if (value == null) return false;
  return Number.isInteger(value) && value > 0;
}

export function buildPodiumMeterOptions(maxM: number): number[] {
  const limit = Math.max(1, Math.min(30, Math.floor(maxM)));
  return Array.from({ length: limit }, (_, index) => index + 1);
}

export function getZastreseniHeightOptions(maxCista: number | null): number[] {
  if (maxCista == null) return [...ZASTRESENI_CISTA_VYSKA_OPTIONS];
  return ZASTRESENI_CISTA_VYSKA_OPTIONS.filter((h) => h <= maxCista + 0.001);
}

export function getAvailableKotveniTypy(
  povrch: "trava_hlina" | "asfalt_beton" | null
): KotveniTyp[] {
  if (!povrch) return [];
  if (povrch === "trava_hlina") return ["zatloukane", "ibc_boxy"];
  return ["ibc_boxy"];
}
