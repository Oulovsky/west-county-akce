import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_PORTAL_SESTAVA_KATALOG,
  computeLedMaxFromStock,
} from "@/lib/client-portal/sestava-konfigurator-katalog";
import type { PortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-types";

type KatalogRow = {
  kod: string;
  obsah: PortalSestavaKatalog;
  aktivni: boolean;
};

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
    return data.obsah as PortalSestavaKatalog;
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
        const maxFromStock = computeLedMaxFromStock(
          led.panel_sirka_m,
          led.panel_vyska_m,
          dostupnych
        );
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

async function enrichPresetSetupIds(katalog: PortalSestavaKatalog): Promise<PortalSestavaKatalog> {
  try {
    const admin = createAdminClient();
    const { data: setupy } = await admin
      .from("setupy")
      .select("setup_id, nazev, oblast, dostupne_v_portalu")
      .eq("dostupne_v_portalu", true)
      .eq("aktivni", true);

    if (!setupy?.length) return katalog;

    const matchSetup = (oblast: string, kod: string) => {
      const normalized = kod.toLowerCase();
      const found = setupy.find(
        (row) =>
          row.oblast === oblast &&
          String(row.nazev ?? "")
            .toLowerCase()
            .includes(normalized)
      );
      return found?.setup_id ?? null;
    };

    return {
      ...katalog,
      zvuk_presety: katalog.zvuk_presety.map((preset) => ({
        ...preset,
        setup_id: preset.setup_id ?? matchSetup("sound", preset.kod),
      })),
      svetla_presety: katalog.svetla_presety.map((preset) => ({
        ...preset,
        setup_id: preset.setup_id ?? matchSetup("lights", preset.kod),
      })),
    };
  } catch {
    return katalog;
  }
}

export async function loadPortalSestavaKatalog(): Promise<PortalSestavaKatalog> {
  const fromDb = await loadKatalogFromDb();
  const base = fromDb ?? DEFAULT_PORTAL_SESTAVA_KATALOG;
  const withStock = await enrichLedStock(base);
  return enrichPresetSetupIds(withStock);
}

export type { KatalogRow };
