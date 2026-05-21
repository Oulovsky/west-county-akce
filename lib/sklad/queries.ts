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
import type { SkladPolozkaRow } from "@/lib/sklad/types";

export type SkladSupabaseClient = SupabaseClient;

const SKLADOVE_POLOZKY_LIST_SELECT_BASE = `
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
  kategorie_techniky ( nazev ),
  jednotky_skladu ( nazev ),
  sklad_bloky ( nazev ),
  podkategorie_techniky ( nazev ),
  sklad_polozky_kusy ( count )
` as const;

const SKLADOVE_POLOZKY_LIST_SELECT = `
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
  celkem,
  kategorie_techniky ( nazev ),
  jednotky_skladu ( nazev ),
  sklad_bloky ( nazev ),
  podkategorie_techniky ( nazev ),
  sklad_polozky_kusy ( count )
` as const;

function isMissingCelkemColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("celkem") && (lower.includes("column") || lower.includes("schema"));
}

type SkladovePolozkyRelationNazev =
  | { nazev: string | null }
  | { nazev: string | null }[]
  | null;

type SkladovePolozkyListRawRow = {
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
  kategorie_techniky?: SkladovePolozkyRelationNazev;
  jednotky_skladu?: SkladovePolozkyRelationNazev;
  sklad_bloky?: SkladovePolozkyRelationNazev;
  podkategorie_techniky?: SkladovePolozkyRelationNazev;
  sklad_polozky_kusy?: { count: number | string }[] | { count: number | string } | null;
};

function relationNazev(
  relation: SkladovePolozkyRelationNazev | undefined
): string | null {
  if (!relation) return null;
  const row = Array.isArray(relation) ? relation[0] : relation;
  const nazev = row?.nazev;
  return typeof nazev === "string" && nazev.trim() ? nazev : null;
}

function kusyCountFromRow(row: SkladovePolozkyListRawRow): number {
  const rel = row.sklad_polozky_kusy;
  if (!rel) return 0;
  if (Array.isArray(rel)) {
    return toNumber(rel[0]?.count);
  }
  return toNumber(rel.count);
}

function mapSkladovePolozkyListRow(row: SkladovePolozkyListRawRow): SkladPolozkaRow {
  const celkem = toNumber(row.celkem);
  const kusyCount = kusyCountFromRow(row);
  const celkemKDispozici = celkem > 0 ? celkem : kusyCount;

  return {
    skladova_polozka_id: row.skladova_polozka_id,
    nazev: row.nazev,
    kategorie_techniky_id: row.kategorie_techniky_id,
    kategorie_nazev: relationNazev(row.kategorie_techniky),
    podkategorie_techniky_id: row.podkategorie_techniky_id,
    podkategorie_nazev: relationNazev(row.podkategorie_techniky),
    celkem_k_dispozici: celkemKDispozici,
    jednotka: relationNazev(row.jednotky_skladu),
    interni_naklad:
      row.interni_naklad == null ? null : toNumber(row.interni_naklad),
    fakturacni_cena:
      row.fakturacni_cena == null ? null : toNumber(row.fakturacni_cena),
    sklad_blok_id: row.sklad_blok_id,
    blok_nazev: relationNazev(row.sklad_bloky),
    na_sklade: celkemKDispozici,
    na_akcich: 0,
    poskozene: 0,
    pozice: row.pozice ?? null,
  };
}

export function querySkladBloky(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getSkladBloky);
}

export type SkladovePolozkyQueryResult = {
  data: SkladPolozkaRow[] | null;
  error: PostgrestError | null;
};

/** Přehled položek skladu (tabulka skladove_polozky + joiny). */
export async function querySkladovePolozky(
  client: SkladSupabaseClient
): Promise<SkladovePolozkyQueryResult> {
  const withCelkem = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .select(SKLADOVE_POLOZKY_LIST_SELECT)
    .order("nazev", { ascending: true });

  const result =
    withCelkem.error && isMissingCelkemColumnError(withCelkem.error.message)
      ? await client
          .from(SKLAD_TABLE.skladovePolozky)
          .select(SKLADOVE_POLOZKY_LIST_SELECT_BASE)
          .order("nazev", { ascending: true })
      : withCelkem;

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: ((result.data ?? []) as SkladovePolozkyListRawRow[]).map(
      mapSkladovePolozkyListRow
    ),
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
