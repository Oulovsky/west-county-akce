import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import type { SkladKusHistorieRow, SkladKusHistorieTypAkce } from "@/lib/sklad/types";

const SKLAD_KUS_HISTORIE_SELECT =
  "historie_id, kus_id, zakazka_id, typ_akce, poznamka, created_at, zakazka:zakazky(zakazka_id, cislo_zakazky, nazev)" as const;

export function formatSkladKusHistorieTypAkce(
  typAkce: string | null | undefined
): string {
  switch (typAkce) {
    case "rezervovano":
      return "Rezervováno";
    case "nalozeno":
      return "Naloženo";
    case "vraceno":
      return "Vráceno";
    case "poskozeno":
      return "Poškozeno";
    case "blokovano":
      return "Blokováno";
    case "odblokovano":
      return "Odblokováno";
    case "v_oprave":
      return "V opravě";
    case "ceka_na_kontrolu":
      return "Čeká na kontrolu";
    case "zkontrolovano":
      return "Zkontrolováno";
    case "vyrazeno":
      return "Vyřazeno";
    case "servisni_poznamka":
      return "Servisní poznámka";
    case "vlozeno_do_case":
      return "Vloženo do case";
    case "vyjmuto_z_case":
      return "Vyňato z case";
    default:
      return typAkce?.trim() || "—";
  }
}

export function formatSkladKusHistorieZakazka(
  row: SkladKusHistorieRow
): string {
  const zakazka = row.zakazka;
  if (!zakazka) return "—";

  const cislo = zakazka.cislo_zakazky?.trim();
  const nazev = zakazka.nazev?.trim() || "Zakázka";
  return cislo ? `${cislo} — ${nazev}` : nazev;
}

export function querySkladKusHistorie(client: SupabaseClient, kusId: string) {
  return client
    .from(SKLAD_TABLE.skladKusHistorie)
    .select(SKLAD_KUS_HISTORIE_SELECT)
    .eq("kus_id", kusId)
    .order("created_at", { ascending: false });
}

export function insertSkladKusHistorie(
  client: SupabaseClient,
  payload: {
    kusId: string;
    typAkce: SkladKusHistorieTypAkce;
    zakazkaId?: string | null;
    poznamka?: string | null;
  }
) {
  return client.from(SKLAD_TABLE.skladKusHistorie).insert({
    kus_id: payload.kusId,
    zakazka_id: payload.zakazkaId ?? null,
    typ_akce: payload.typAkce,
    poznamka: payload.poznamka ?? null,
  });
}
