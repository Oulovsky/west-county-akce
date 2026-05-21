/**
 * Sdílené read-only dotazy skladu.
 * Zápisy / server actions zůstávají u stránek, dokud nebude sjednocená mutační vrstva.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  SKLAD_KUS_SELECT_FIELDS,
  SKLAD_POSKOZENI_SELECT_FIELDS,
  SKLAD_RPC,
  SKLAD_TABLE,
} from "@/lib/sklad/constants";
import { toNumber } from "@/lib/sklad/helpers";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
  SkladPolozkaRow,
} from "@/lib/sklad/types";

export type SkladSupabaseClient = SupabaseClient;

const SKLADOVE_POLOZKY_COLUMNS = `
  skladova_polozka_id,
  nazev,
  pozice,
  sklad_blok_id,
  kategorie_techniky_id,
  podkategorie_techniky_id,
  jednotka_id,
  interni_naklad,
  fakturacni_cena,
  aktivni,
  celkem
` as const;

const SKLADOVE_POLOZKY_COLUMNS_BASE = `
  skladova_polozka_id,
  nazev,
  pozice,
  sklad_blok_id,
  kategorie_techniky_id,
  podkategorie_techniky_id,
  jednotka_id,
  interni_naklad,
  fakturacni_cena,
  aktivni
` as const;

function isMissingCelkemColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("celkem") && (lower.includes("column") || lower.includes("schema"));
}

type SkladovePolozkyTableRow = {
  skladova_polozka_id: string;
  nazev: string;
  pozice?: number | string | null;
  sklad_blok_id: string | null;
  kategorie_techniky_id: string | null;
  podkategorie_techniky_id: string | null;
  jednotka_id: string | null;
  interni_naklad: number | string | null;
  fakturacni_cena: number | string | null;
  aktivni?: boolean | null;
  celkem?: number | string | null;
};

type SkladovePolozkyLookups = {
  kategorieNazev: Map<string, string>;
  podkategorieNazev: Map<string, string>;
  jednotkaNazev: Map<string, string>;
  blokNazev: Map<string, string>;
  kusyCountByPolozkaId: Map<string, number>;
};

function buildNazevMap(
  rows: Array<{ id: string; nazev: string | null }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const nazev = row.nazev?.trim();
    if (nazev) {
      map.set(row.id, nazev);
    }
  }
  return map;
}

function buildKusyCountByPolozkaId(
  rows: Array<{ skladova_polozka_id: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row.skladova_polozka_id;
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

function lookupNazev(map: Map<string, string>, id: string | null): string | null {
  if (!id) return null;
  return map.get(id) ?? null;
}

function mapSkladovePolozkyListRow(
  row: SkladovePolozkyTableRow,
  lookups: SkladovePolozkyLookups
): SkladPolozkaRow {
  const celkem = toNumber(row.celkem);
  const kusyCount = lookups.kusyCountByPolozkaId.get(row.skladova_polozka_id) ?? 0;
  const celkemKDispozici = celkem > 0 ? celkem : kusyCount;

  return {
    skladova_polozka_id: row.skladova_polozka_id,
    nazev: row.nazev,
    kategorie_techniky_id: row.kategorie_techniky_id,
    kategorie_nazev: lookupNazev(lookups.kategorieNazev, row.kategorie_techniky_id),
    podkategorie_techniky_id: row.podkategorie_techniky_id,
    podkategorie_nazev: lookupNazev(
      lookups.podkategorieNazev,
      row.podkategorie_techniky_id
    ),
    celkem_k_dispozici: celkemKDispozici,
    jednotka: lookupNazev(lookups.jednotkaNazev, row.jednotka_id),
    interni_naklad:
      row.interni_naklad == null ? null : toNumber(row.interni_naklad),
    fakturacni_cena:
      row.fakturacni_cena == null ? null : toNumber(row.fakturacni_cena),
    sklad_blok_id: row.sklad_blok_id,
    blok_nazev: lookupNazev(lookups.blokNazev, row.sklad_blok_id),
    na_sklade: celkemKDispozici,
    na_akcich: 0,
    poskozene: 0,
    pozice: row.pozice ?? null,
  };
}

async function fetchSkladovePolozkyTable(client: SkladSupabaseClient) {
  const withCelkem = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .select(SKLADOVE_POLOZKY_COLUMNS)
    .order("nazev", { ascending: true });

  if (withCelkem.error && isMissingCelkemColumnError(withCelkem.error.message)) {
    return client
      .from(SKLAD_TABLE.skladovePolozky)
      .select(SKLADOVE_POLOZKY_COLUMNS_BASE)
      .order("nazev", { ascending: true });
  }

  return withCelkem;
}

export function querySkladBloky(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getSkladBloky);
}

export type SkladovePolozkyQueryResult = {
  data: SkladPolozkaRow[] | null;
  error: PostgrestError | null;
};

/** Přehled položek skladu (samostatné dotazy + spojení v TS). */
export async function querySkladovePolozky(
  client: SkladSupabaseClient
): Promise<SkladovePolozkyQueryResult> {
  const [
    polozkyRes,
    kategorieRes,
    podkategorieRes,
    jednotkyRes,
    blokyRes,
    kusyRes,
  ] = await Promise.all([
    fetchSkladovePolozkyTable(client),
    queryKategorieTechnikyFull(client),
    queryPodkategorieTechnikyFull(client),
    queryJednotkySkladuFull(client),
    client.from(SKLAD_TABLE.skladBloky).select("sklad_blok_id, nazev"),
    client
      .from(SKLAD_TABLE.skladPolozkyKusy)
      .select("skladova_polozka_id"),
  ]);

  const firstError =
    polozkyRes.error ??
    podkategorieRes.error ??
    jednotkyRes.error ??
    blokyRes.error ??
    kusyRes.error ??
    null;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const polozky = (polozkyRes.data ?? []) as SkladovePolozkyTableRow[];

  const kategorieRows = (kategorieRes.data ?? []) as SkladKategorie[];
  const podkategorieRows = (podkategorieRes.data ?? []) as SkladPodkategorie[];
  const jednotkyRows = (jednotkyRes.data ?? []) as SkladJednotka[];
  const blokyRows = (blokyRes.data ?? []) as Array<
    Pick<SkladBlok, "sklad_blok_id" | "nazev">
  >;

  const lookups: SkladovePolozkyLookups = {
    kategorieNazev: buildNazevMap(
      kategorieRows.map((row) => ({
        id: row.kategorie_techniky_id,
        nazev: row.nazev,
      }))
    ),
    podkategorieNazev: buildNazevMap(
      podkategorieRows.map((row) => ({
        id: row.podkategorie_techniky_id,
        nazev: row.nazev,
      }))
    ),
    jednotkaNazev: buildNazevMap(
      jednotkyRows.map((row) => ({
        id: row.jednotka_id,
        nazev: row.nazev,
      }))
    ),
    blokNazev: buildNazevMap(
      blokyRows.map((row) => ({
        id: row.sklad_blok_id,
        nazev: row.nazev,
      }))
    ),
    kusyCountByPolozkaId: buildKusyCountByPolozkaId(
      (kusyRes.data ?? []) as Array<{ skladova_polozka_id: string }>
    ),
  };

  return {
    data: polozky.map((row) => mapSkladovePolozkyListRow(row, lookups)),
    error: null,
  };
}

export function querySkladBlokDetail(
  client: SkladSupabaseClient,
  skladBlokId: string
) {
  return client.rpc(SKLAD_RPC.getSkladBlokDetail, {
    p_sklad_blok_id: skladBlokId,
  });
}

export function queryKategorieTechnikyFull(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getKategorieTechnikyFull);
}

export function queryPodkategorieTechnikyFull(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getPodkategorieTechnikyFull);
}

export function queryJednotkySkladuFull(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getJednotkySkladuFull);
}

export function queryTypyPoskozeniFull(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getTypyPoskozeniFull);
}

export function queryPriorityPoskozeniFull(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getPriorityPoskozeniFull);
}

export function queryStatistikaPoskozeni(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getStatistikaPoskozeni);
}

/** Otevřená hlášení pro dashboard. */
export function queryOtevrenaPoskozeni(client: SkladSupabaseClient) {
  return client
    .from(SKLAD_TABLE.hlaseniPoskozeni)
    .select(SKLAD_POSKOZENI_SELECT_FIELDS)
    .is("datum_uzavreni", null);
}

/** Poškození pro položky v okruhu. */
export function queryPoskozeniProPolozky(
  client: SkladSupabaseClient,
  skladovaPolozkaIds: string[]
) {
  if (skladovaPolozkaIds.length === 0) {
    return Promise.resolve({ data: [] as unknown[], error: null });
  }

  return client
    .from(SKLAD_TABLE.hlaseniPoskozeni)
    .select("*")
    .in("skladova_polozka_id", skladovaPolozkaIds)
    .order("datum_nahlaseni", { ascending: false });
}

/** Jednotlivé kusy položky (tabulka sklad_polozky_kusy). */
export function querySkladPolozkyKusyForPolozka(
  client: SkladSupabaseClient,
  skladovaPolozkaId: string
) {
  return client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select(SKLAD_KUS_SELECT_FIELDS)
    .eq("skladova_polozka_id", skladovaPolozkaId)
    .order("poradove_cislo", { ascending: true });
}

/** Podkategorie přiřazené položkám (záloha pro enrichSpravaPolozkyWithPodkategorie). */
export function querySkladovePolozkyPodkategorie(client: SkladSupabaseClient) {
  return client
    .from(SKLAD_TABLE.skladovePolozky)
    .select("skladova_polozka_id, podkategorie_techniky_id");
}

/** Katalog pro /sklad/sprava. */
export function querySpravaKatalog(client: SkladSupabaseClient) {
  return Promise.all([
    querySkladovePolozky(client),
    queryKategorieTechnikyFull(client),
    queryPodkategorieTechnikyFull(client),
    queryJednotkySkladuFull(client),
    querySkladBloky(client),
    querySkladovePolozkyPodkategorie(client),
  ] as const);
}

/** Číselníky pro konfiguraci / formuláře. */
export function queryPolozkaKonfigurace(client: SkladSupabaseClient) {
  return Promise.all([
    queryKategorieTechnikyFull(client),
    queryPodkategorieTechnikyFull(client),
    queryJednotkySkladuFull(client),
  ] as const);
}

/** Konfigurace kategorií — kategorie + okruhy. */
export function queryKonfiguraceKategorie(client: SkladSupabaseClient) {
  return Promise.all([
    queryKategorieTechnikyFull(client),
    querySkladBloky(client),
  ] as const);
}

/** Konfigurace podkategorií — kategorie + podkategorie. */
export function queryKonfiguracePodkategorie(client: SkladSupabaseClient) {
  return Promise.all([
    queryKategorieTechnikyFull(client),
    queryPodkategorieTechnikyFull(client),
  ] as const);
}
