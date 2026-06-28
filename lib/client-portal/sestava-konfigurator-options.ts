import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";
import type { SestavaKonfiguratorState } from "@/lib/client-portal/sestava-konfigurator-types";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";
import type { PortalSetup } from "@/lib/client-portal/types";

/** Normalizace pro porovnání názvů a rozměrů (trim, lowercase, ×/x, mezery, volitelné „m“). */
export function normalizeKonfiguratorMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/×/g, "x")
    .replace(/\*/g, "x")
    .replace(/\s*m\b/g, "")
    .trim();
}

function dimensionsInText(text: string, sirka: number, hloubka: number): boolean {
  const norm = normalizeKonfiguratorMatchText(text).replace(/\s/g, "");
  const compact = `${sirka}x${hloubka}`;
  return norm.includes(compact);
}

/** Obchodní volba v konfigurátoru — klient vidí label, interně může mít setup_id. */
export type KonfiguratorVolba = {
  value: string;
  label: string;
  setup_id: string | null;
  source: "setup" | "catalog";
};

function setupLabel(setup: PortalSetup): string {
  return setup.portal_popis?.trim() || setup.nazev;
}

function mapSetupVolby(setupy: PortalSetup[]): KonfiguratorVolba[] {
  return setupy.map((setup) => ({
    value: setup.setup_id,
    label: setupLabel(setup),
    setup_id: setup.setup_id,
    source: "setup" as const,
  }));
}

/** Zastřešení / rozměry stage — preferuje setupy ze skladu (oblast stage). */
export function buildZastreseniVolby(
  katalog: PortalSestavaKatalog,
  portalSetups: PortalSetupsByOblast
): KonfiguratorVolba[] {
  const stageSetups = portalSetups.stage ?? [];
  const zastreseneSetups = stageSetups.filter((row) => {
    const text = `${row.nazev} ${row.portal_popis ?? ""}`.toLowerCase();
    if (
      text.includes("pódium") ||
      text.includes("podium") ||
      text.includes("praktikábl") ||
      text.includes("praktikabl") ||
      text.includes("branka")
    ) {
      return false;
    }
    return text.includes("zastřeš") || text.includes("zastres");
  });

  if (zastreseneSetups.length > 0) {
    return mapSetupVolby(zastreseneSetups);
  }

  return katalog.zastreseni_varianty.map((variant) => ({
    value: variant.id,
    label: variant.nazev,
    setup_id: variant.setup_id ?? null,
    source: "catalog" as const,
  }));
}

/** Mobilní stage — preferuje setupy ze skladu. */
export function buildMobilniStageVolby(
  katalog: PortalSestavaKatalog,
  portalSetups: PortalSetupsByOblast
): KonfiguratorVolba[] {
  const stageSetups = portalSetups.stage ?? [];
  const mobilniSetups = stageSetups.filter((row) => {
    const text = `${row.nazev} ${row.portal_popis ?? ""}`.toLowerCase();
    return text.includes("mobil");
  });

  if (mobilniSetups.length > 0) {
    return mapSetupVolby(mobilniSetups);
  }

  return [
    {
      value: "mobilni_default",
      label: katalog.mobilni_stage.nazev,
      setup_id: katalog.mobilni_stage.setup_id ?? null,
      source: "catalog" as const,
    },
  ];
}

/** PA / zvuk — preferuje setupy (oblast sound). */
export function buildZvukVolby(
  katalog: PortalSestavaKatalog,
  portalSetups: PortalSetupsByOblast
): KonfiguratorVolba[] {
  const soundSetups = portalSetups.sound ?? [];
  if (soundSetups.length > 0) {
    return mapSetupVolby(soundSetups);
  }

  return katalog.zvuk_presety.map((preset) => ({
    value: preset.kod,
    label: preset.nazev,
    setup_id: preset.setup_id ?? null,
    source: "catalog" as const,
  }));
}

/** Světla — preferuje setupy (oblast lights). */
export function buildSvetlaVolby(
  katalog: PortalSestavaKatalog,
  portalSetups: PortalSetupsByOblast
): KonfiguratorVolba[] {
  const lightSetups = portalSetups.lights ?? [];
  if (lightSetups.length > 0) {
    return mapSetupVolby(lightSetups);
  }

  return katalog.svetla_presety.map((preset) => ({
    value: preset.kod,
    label: preset.nazev,
    setup_id: preset.setup_id ?? null,
    source: "catalog" as const,
  }));
}

export function isSetupBackedVolba(volba: KonfiguratorVolba | undefined): boolean {
  return Boolean(volba?.setup_id);
}

/**
 * Hodnota `<select>` pro zastřešení — musí odpovídat `KonfiguratorVolba.value`
 * (setup_id ze skladu, nebo catalog variant id).
 */
export function resolveZastreseniVolbaValue(
  volby: KonfiguratorVolba[],
  state: Pick<
    SestavaKonfiguratorState,
    "zastreseni_setup_id" | "zastreseni_variant_id" | "zastreseni_sirka_m" | "zastreseni_hloubka_m"
  >,
  katalog: PortalSestavaKatalog
): string {
  if (volby.length === 0) return "";

  const pick = (predicate: (volba: KonfiguratorVolba) => boolean): string => {
    const found = volby.find(predicate);
    return found?.value ?? "";
  };

  if (state.zastreseni_setup_id) {
    const bySetup = pick(
      (volba) =>
        volba.value === state.zastreseni_setup_id || volba.setup_id === state.zastreseni_setup_id
    );
    if (bySetup) return bySetup;
  }

  if (state.zastreseni_variant_id) {
    const byVariantValue = pick((volba) => volba.value === state.zastreseni_variant_id);
    if (byVariantValue) return byVariantValue;

    const variant = katalog.zastreseni_varianty.find((row) => row.id === state.zastreseni_variant_id);
    if (variant) {
      if (variant.setup_id) {
        const byCatalogSetup = pick(
          (volba) => volba.setup_id === variant.setup_id || volba.value === variant.setup_id
        );
        if (byCatalogSetup) return byCatalogSetup;
      }

      const byNazev = pick(
        (volba) =>
          normalizeKonfiguratorMatchText(volba.label) ===
          normalizeKonfiguratorMatchText(variant.nazev)
      );
      if (byNazev) return byNazev;

      const byDims = pick((volba) =>
        dimensionsInText(volba.label, variant.sirka_m, variant.hloubka_m)
      );
      if (byDims) return byDims;
    }

    const normVariantId = normalizeKonfiguratorMatchText(state.zastreseni_variant_id);
    const byNormId = pick(
      (volba) => normalizeKonfiguratorMatchText(volba.label).includes(normVariantId)
    );
    if (byNormId) return byNormId;
  }

  if (state.zastreseni_sirka_m && state.zastreseni_hloubka_m) {
    const { zastreseni_sirka_m: sirka, zastreseni_hloubka_m: hloubka } = state;
    const byDims = pick((volba) => dimensionsInText(volba.label, sirka, hloubka));
    if (byDims) return byDims;

    const catalogVariant = katalog.zastreseni_varianty.find(
      (row) => row.sirka_m === sirka && row.hloubka_m === hloubka
    );
    if (catalogVariant) {
      if (catalogVariant.setup_id) {
        const bySetup = pick(
          (volba) =>
            volba.setup_id === catalogVariant.setup_id || volba.value === catalogVariant.setup_id
        );
        if (bySetup) return bySetup;
      }
      const byName = pick(
        (volba) =>
          normalizeKonfiguratorMatchText(volba.label) ===
          normalizeKonfiguratorMatchText(catalogVariant.nazev)
      );
      if (byName) return byName;
    }
  }

  return "";
}
