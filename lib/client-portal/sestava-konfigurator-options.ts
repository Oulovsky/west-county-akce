import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";
import type { PortalSetupsByOblast } from "@/lib/client-portal/poptavka-server";
import type { PortalSetup } from "@/lib/client-portal/types";

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
    return (
      text.includes("zastřeš") ||
      text.includes("zastres") ||
      /\d+\s*[×x]\s*\d+/.test(text)
    );
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
