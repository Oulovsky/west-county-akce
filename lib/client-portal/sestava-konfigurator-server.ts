import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PORTAL_SESTAVA_KATALOG,
  computeLedMaxFromStock,
  isKatalogPolozkaAktivni,
  normalizePortalSestavaKatalog,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";

type KatalogRow = {
  kod: string;
  obsah: PortalSestavaKatalog;
  aktivni: boolean;
};

type SetupRow = {
  setup_id: string;
  nazev: string;
  oblast: string;
};

function matchSetupByNazev(setupy: SetupRow[], nazev: string | null | undefined) {
  if (!nazev?.trim()) return null;
  const lower = nazev.toLowerCase().trim();
  return (
    setupy.find((row) => row.nazev.toLowerCase().trim() === lower)?.setup_id ??
    setupy.find((row) => row.nazev.toLowerCase().includes(lower))?.setup_id ??
    null
  );
}

async function loadKatalogFromDb(): Promise<PortalSestavaKatalog | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("portal_konfigurator_katalog")
      .select("kod, obsah, aktivni")
      .eq("kod", "default")
      .eq("aktivni", true)
      .maybeSingle();

    if (error || !data?.obsah) return null;
    return normalizePortalSestavaKatalog(data.obsah as PortalSestavaKatalog);
  } catch {
    return null;
  }
}

async function enrichLedStock(katalog: PortalSestavaKatalog): Promise<PortalSestavaKatalog> {
  const ids = katalog.led_typy
    .map((row) => row.sklad_polozka_id)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return katalog;
  }

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("skladove_polozky")
      .select("skladova_polozka_id, celkem_k_dispozici")
      .in("skladova_polozka_id", ids);

    const stockById = new Map(
      (data ?? []).map((row) => [row.skladova_polozka_id, Number(row.celkem_k_dispozici ?? 0)])
    );

    return {
      ...katalog,
      led_typy: katalog.led_typy.map((led) => {
        if (!led.sklad_polozka_id) return led;
        const dostupnych = stockById.get(led.sklad_polozka_id) ?? 0;
        const maxFromStock = computeLedMaxFromStock(led.panel_plocha_m2, dostupnych);
        return {
          ...led,
          dostupnych_panelu: dostupnych,
          max_plocha_m2: Math.min(led.max_plocha_m2, maxFromStock || led.max_plocha_m2),
        };
      }),
    };
  } catch {
    return katalog;
  }
}

async function enrichKatalogSetupIds(katalog: PortalSestavaKatalog): Promise<PortalSestavaKatalog> {
  try {
    const admin = createAdminClient();
    const { data: setupy } = await admin
      .from("setupy")
      .select("setup_id, nazev, oblast, dostupne_v_portalu")
      .eq("dostupne_v_portalu", true)
      .eq("aktivni", true);

    if (!setupy?.length) return katalog;

    const rows = setupy as SetupRow[];

    return {
      ...katalog,
      mobilni_stage: {
        ...katalog.mobilni_stage,
        setup_id:
          katalog.mobilni_stage.setup_id ??
          matchSetupByNazev(rows, katalog.mobilni_stage.nazev),
      },
      zastreseni_varianty: katalog.zastreseni_varianty.map((variant) => ({
        ...variant,
        setup_id: variant.setup_id ?? matchSetupByNazev(rows, variant.nazev),
      })),
      podium_varianty: katalog.podium_varianty.map((variant) => ({
        ...variant,
        setup_id: variant.setup_id ?? matchSetupByNazev(rows, variant.nazev),
      })),
      praktikabl_varianty: katalog.praktikabl_varianty.map((variant) => ({
        ...variant,
        setup_id: variant.setup_id ?? matchSetupByNazev(rows, variant.nazev),
      })),
      zvuk_presety: katalog.zvuk_presety.map((preset) => ({
        ...preset,
        setup_id: preset.setup_id ?? matchSetupByNazev(rows, preset.nazev),
      })),
      svetla_presety: katalog.svetla_presety.map((preset) => ({
        ...preset,
        setup_id: preset.setup_id ?? matchSetupByNazev(rows, preset.nazev),
      })),
    };
  } catch {
    return katalog;
  }
}

function sortByPoradi<T extends { poradi?: number; nazev: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = a.poradi ?? 999;
    const pb = b.poradi ?? 999;
    if (pa !== pb) return pa - pb;
    return a.nazev.localeCompare(b.nazev, "cs");
  });
}

function filterActiveKatalogForPortal(katalog: PortalSestavaKatalog): PortalSestavaKatalog {
  return {
    ...katalog,
    zastreseni_varianty: sortByPoradi(
      katalog.zastreseni_varianty.filter((row) => isKatalogPolozkaAktivni(row.aktivni))
    ),
    podium_varianty: sortByPoradi(
      katalog.podium_varianty.filter((row) => isKatalogPolozkaAktivni(row.aktivni))
    ),
    praktikabl_varianty: sortByPoradi(
      katalog.praktikabl_varianty.filter((row) => isKatalogPolozkaAktivni(row.aktivni))
    ),
    led_typy: sortByPoradi(
      katalog.led_typy.filter((row) => isKatalogPolozkaAktivni(row.aktivni))
    ),
    zvuk_presety: sortByPoradi(
      katalog.zvuk_presety.filter((row) => isKatalogPolozkaAktivni(row.aktivni))
    ),
    svetla_presety: sortByPoradi(
      katalog.svetla_presety.filter((row) => isKatalogPolozkaAktivni(row.aktivni))
    ),
  };
}

export const loadPortalSestavaKatalog = cache(async function loadPortalSestavaKatalog(): Promise<PortalSestavaKatalog> {
  const fromDb = await loadKatalogFromDb();
  const base = normalizePortalSestavaKatalog(fromDb ?? DEFAULT_PORTAL_SESTAVA_KATALOG);
  const withStock = await enrichLedStock(base);
  const withSetups = await enrichKatalogSetupIds(withStock);
  return filterActiveKatalogForPortal(withSetups);
});

export type { KatalogRow };
