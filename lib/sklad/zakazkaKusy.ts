import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import type {
  SkladKusZakazkaAssignmentRow,
  SkladZakazkaAssignmentOption,
  ZakazkaKusStav,
} from "@/lib/sklad/types";
import { zakazkaPocitaSeDoSkladovychRezervaci } from "@/lib/sklad/zakazkyRezervaceFilter";

export const ZAKAZKA_KUS_ACTIVE_STAVY: ZakazkaKusStav[] = [
  "rezervovano",
  "nalozeno",
  "vratit",
  "poskozeno",
];

const ZAKAZKA_KUS_ASSIGNMENT_SELECT =
  "id, zakazka_id, kus_id, stav, is_rezerva, created_at, zakazka:zakazky(zakazka_id, cislo_zakazky, nazev, datum_od, datum_do)" as const;

export function formatZakazkaKusStav(stav: string | null | undefined): string {
  switch (stav) {
    case "rezervovano":
      return "Rezervováno";
    case "nalozeno":
      return "Naloženo";
    case "vratit":
      return "Vrátit";
    case "vraceno":
      return "Vráceno";
    case "poskozeno":
      return "Poškozeno";
    default:
      return stav?.trim() || "—";
  }
}

export function formatZakazkaKusZakazkaLabel(
  assignment: SkladKusZakazkaAssignmentRow | null | undefined
): string {
  const zakazka = assignment?.zakazka;
  if (!zakazka) return "—";

  const cislo = zakazka.cislo_zakazky?.trim();
  const nazev = zakazka.nazev?.trim() || "Zakázka";
  return cislo ? `${cislo} — ${nazev}` : nazev;
}

export function formatZakazkaKusDatum(
  assignment: SkladKusZakazkaAssignmentRow | null | undefined
): string {
  const zakazka = assignment?.zakazka;
  if (!zakazka?.datum_od && !zakazka?.datum_do) return "—";

  if (zakazka.datum_od && zakazka.datum_do) {
    return `${zakazka.datum_od} – ${zakazka.datum_do}`;
  }

  return zakazka.datum_od ?? zakazka.datum_do ?? "—";
}

export function formatZakazkaAssignmentOptionLabel(
  zakazka: SkladZakazkaAssignmentOption
): string {
  const cislo = zakazka.cislo_zakazky?.trim();
  const nazev = zakazka.nazev?.trim() || "Zakázka";
  return cislo ? `${cislo} — ${nazev}` : nazev;
}

export function formatZakazkaAssignmentOptionDatum(
  zakazka: SkladZakazkaAssignmentOption
): string {
  if (zakazka.datum_od && zakazka.datum_do) {
    return `${zakazka.datum_od} – ${zakazka.datum_do}`;
  }
  return zakazka.datum_od ?? zakazka.datum_do ?? "—";
}

export function queryAktivniZakazkaKusu(
  client: SupabaseClient,
  kusId: string
) {
  return client
    .from(SKLAD_TABLE.zakazkaKusy)
    .select(ZAKAZKA_KUS_ASSIGNMENT_SELECT)
    .eq("kus_id", kusId)
    .in("stav", ZAKAZKA_KUS_ACTIVE_STAVY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export function queryAktivniZakazkyKusu(
  client: SupabaseClient,
  kusIds: string[]
) {
  if (kusIds.length === 0) {
    return Promise.resolve({
      data: [] as SkladKusZakazkaAssignmentRow[],
      error: null,
    });
  }

  return client
    .from(SKLAD_TABLE.zakazkaKusy)
    .select(ZAKAZKA_KUS_ASSIGNMENT_SELECT)
    .in("kus_id", kusIds)
    .in("stav", ZAKAZKA_KUS_ACTIVE_STAVY)
    .order("created_at", { ascending: false });
}

export async function queryAktivniZakazkyProPrirazeni(client: SupabaseClient) {
  const { data, error } = await client
    .from(SKLAD_TABLE.zakazky)
    .select("zakazka_id, cislo_zakazky, nazev, datum_od, datum_do, cas_od, cas_do, zrusena")
    .or("zrusena.is.null,zrusena.eq.false")
    .order("datum_od", { ascending: true })
    .order("cas_od", { ascending: true });

  if (error) return { data: null, error };

  const now = new Date();
  const active = ((data ?? []) as SkladZakazkaAssignmentOption[]).filter((zakazka) =>
    zakazkaPocitaSeDoSkladovychRezervaci(
      {
        datum_od: zakazka.datum_od ?? "",
        datum_do: zakazka.datum_do ?? "",
        cas_od: zakazka.cas_od ?? null,
        cas_do: zakazka.cas_do ?? null,
        zrusena: zakazka.zrusena,
      },
      now
    )
  );

  return { data: active, error: null };
}
