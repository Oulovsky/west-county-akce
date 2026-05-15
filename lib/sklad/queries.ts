/**
 * Sdílené read-only dotazy skladu.
 * Zápisy / server actions zůstávají u stránek, dokud nebude sjednocená mutační vrstva.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SKLAD_POSKOZENI_SELECT_FIELDS,
  SKLAD_RPC,
  SKLAD_TABLE,
} from "@/lib/sklad/constants";

export type SkladSupabaseClient = SupabaseClient;

export function querySkladBloky(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getSkladBloky);
}

export function querySkladovePolozky(client: SkladSupabaseClient) {
  return client.rpc(SKLAD_RPC.getSkladovePolozky);
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

/** Podkategorie přiřazené položkám — get_skladove_polozky je nevrací. */
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
