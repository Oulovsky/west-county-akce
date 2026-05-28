/**
 * Sdílené read-only dotazy skladu.
 * Zápisy / server actions zůstávají u stránek, dokud nebude sjednocená mutační vrstva.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SKLAD_KUS_SELECT_FIELDS,
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

/** Podkategorie přiřazené položkám — get_skladove_polozky je nevrací. */
export function querySkladovePolozkyPodkategorie(client: SkladSupabaseClient) {
  return client
    .from(SKLAD_TABLE.skladovePolozky)
    .select("skladova_polozka_id, podkategorie_techniky_id");
}

export function queryTechnickyVlastniciFull(client: SkladSupabaseClient) {
  return client
    .from(SKLAD_TABLE.technickyVlastnici)
    .select("id, nazev, kod, poznamka, poradi, aktivni")
    .order("aktivni", { ascending: false })
    .order("poradi", { ascending: true })
    .order("nazev", { ascending: true });
}

export function querySkladovePolozkyVlastnici(client: SkladSupabaseClient) {
  return client
    .from(SKLAD_TABLE.skladovePolozky)
    .select("skladova_polozka_id, technicky_vlastnik_id");
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
    queryTechnickyVlastniciFull(client),
    querySkladovePolozkyVlastnici(client),
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
