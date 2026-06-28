import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { finalizeObjednavkaDraftPricing } from "@/lib/client-portal/poptavka-objednavka-pricing";
import type { ObjednavkaPricingCatalog } from "@/lib/client-portal/poptavka-objednavka-pricing";
import { normalizePoptavkaObjednavkaDraftData } from "@/lib/client-portal/poptavka-objednavka-draft";
import { syncPoptavkaObjednavkaDraftDerived } from "@/lib/client-portal/poptavka-objednavka-draft-sync";
import type { PoptavkaObjednavkaDraftData } from "@/lib/client-portal/poptavka-objednavka-types";
import { loadPortalSetups } from "@/lib/client-portal/poptavka-server";
import { loadPortalSestavaKatalog } from "@/lib/client-portal/sestava-konfigurator-server";
import type { SetupOblast } from "@/lib/client-portal/types";
function toOptionalPrice(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function loadObjednavkaPricingCatalog(
  supabase: SupabaseClient
): Promise<ObjednavkaPricingCatalog> {
  const [
    { data: polozkyRaw, error: polozkyError },
    { data: setupPolozkyRaw, error: setupPolozkyError },
    { data: setupyRaw, error: setupyError },
    { data: blokyRaw, error: blokyError },
    { data: kategorieRaw, error: kategorieError },
  ] = await Promise.all([
    supabase
      .from("skladove_polozky")
      .select(
        "skladova_polozka_id, nazev, fakturacni_cena, aktivni, sklad_blok_id, kategorie_techniky_id"
      )
      .eq("aktivni", true)
      .order("nazev", { ascending: true }),
    supabase
      .from("setup_polozky")
      .select("setup_id, skladova_polozka_id, mnozstvi")
      .order("poradi", { ascending: true }),
    supabase
      .from("setupy")
      .select("setup_id, nazev, oblast")
      .eq("aktivni", true),
    supabase.from("sklad_bloky").select("sklad_blok_id, nazev"),
    supabase.from("kategorie_techniky").select("kategorie_techniky_id, nazev"),
  ]);

  const error =
    polozkyError?.message ??
    setupPolozkyError?.message ??
    setupyError?.message ??
    blokyError?.message ??
    kategorieError?.message;

  if (error) {
    throw new Error(error);
  }

  const blokMap = new Map(
    (blokyRaw ?? []).map((row) => [row.sklad_blok_id as string, row.nazev as string])
  );
  const kategorieMap = new Map(
    (kategorieRaw ?? []).map((row) => [row.kategorie_techniky_id as string, row.nazev as string])
  );

  const skladPolozky = (polozkyRaw ?? []).map((row) => ({
    skladovaPolozkaId: row.skladova_polozka_id as string,
    nazev: String(row.nazev ?? "").trim() || (row.skladova_polozka_id as string),
    fakturacniCena: toOptionalPrice(row.fakturacni_cena),
    okruhNazev: row.sklad_blok_id ? blokMap.get(row.sklad_blok_id as string) ?? null : null,
    kategorieNazev: row.kategorie_techniky_id
      ? kategorieMap.get(row.kategorie_techniky_id as string) ?? null
      : null,
  }));

  const setupPolozkyBySetupId: ObjednavkaPricingCatalog["setupPolozkyBySetupId"] = {};
  for (const row of setupPolozkyRaw ?? []) {
    const setupId = row.setup_id as string;
    const list = setupPolozkyBySetupId[setupId] ?? [];
    list.push({
      setupId,
      skladovaPolozkaId: row.skladova_polozka_id as string,
      mnozstvi: Math.max(0, Number(row.mnozstvi) || 0),
    });
    setupPolozkyBySetupId[setupId] = list;
  }

  const setupNazvy: ObjednavkaPricingCatalog["setupNazvy"] = {};
  for (const row of setupyRaw ?? []) {
    setupNazvy[row.setup_id as string] = {
      nazev: String(row.nazev ?? "").trim() || (row.setup_id as string),
      oblast: row.oblast as SetupOblast,
    };
  }

  return { skladPolozky, setupPolozkyBySetupId, setupNazvy };
}

export async function prepareObjednavkaDraftForSave(
  supabase: SupabaseClient,
  draft: PoptavkaObjednavkaDraftData,
  options: { freezeBreakdown?: boolean } = {}
): Promise<PoptavkaObjednavkaDraftData> {
  const [katalog, portalSetups, pricingCatalog] = await Promise.all([
    loadPortalSestavaKatalog(),
    loadPortalSetups(supabase),
    loadObjednavkaPricingCatalog(supabase),
  ]);

  let next = normalizePoptavkaObjednavkaDraftData(draft);
  next = syncPoptavkaObjednavkaDraftDerived(next, { katalog });
  next = finalizeObjednavkaDraftPricing(next, {
    pricingCatalog,
    katalog,
    portalSetups,
    freezeBreakdown: options.freezeBreakdown,
  });
  return next;
}
