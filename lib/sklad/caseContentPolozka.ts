import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSkladJednotkaKey } from "@/lib/sklad/caseJednotka";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import type { SkladPolozkaRow } from "@/lib/sklad/types";

/** ID položek označených jako obsah case (skryté v hlavním katalogu). */
export async function queryJeObsahCasePolozkaIdSet(
  client: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .select("skladova_polozka_id")
    .eq("je_obsah_case", true);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => row.skladova_polozka_id as string));
}

export function isCatalogVisiblePolozka(
  polozkaId: string,
  obsahCaseIds: Set<string>
): boolean {
  return !obsahCaseIds.has(polozkaId);
}

/** Položky pro hlavní katalog skladu — bez obsahu case. */
export function filterCatalogPolozky<T extends { skladova_polozka_id: string }>(
  items: T[],
  obsahCaseIds: Set<string>
): T[] {
  if (obsahCaseIds.size === 0) {
    return items;
  }
  return items.filter((item) => isCatalogVisiblePolozka(item.skladova_polozka_id, obsahCaseIds));
}

export async function markPolozkaAsCaseContent(
  client: SupabaseClient,
  skladovaPolozkaId: string
) {
  const { error } = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .update({
      je_obsah_case: true,
      upraveno_dne: new Date().toISOString(),
    })
    .eq("skladova_polozka_id", skladovaPolozkaId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function findMatchingCaseContentPolozka(
  client: SupabaseClient,
  input: {
    nazev: string;
    skladBlokId: string;
    kategorieTechnikyId: string;
    podkategorieTechnikyId: string | null;
    jednotka: string;
  }
): Promise<SkladPolozkaRow | null> {
  const { data: rpcData, error: rpcError } = await client.rpc("get_skladove_polozky");
  if (rpcError) {
    throw new Error(rpcError.message);
  }

  const obsahCaseIds = await queryJeObsahCasePolozkaIdSet(client);
  const targetJednotka = normalizeSkladJednotkaKey(input.jednotka);
  const targetPodkategorie = input.podkategorieTechnikyId ?? null;
  const targetNazev = input.nazev.trim();

  const match = ((rpcData ?? []) as SkladPolozkaRow[]).find((row) => {
    if (!obsahCaseIds.has(row.skladova_polozka_id)) return false;
    if (row.nazev.trim() !== targetNazev) return false;
    if (row.kategorie_techniky_id !== input.kategorieTechnikyId) return false;
    if ((row.sklad_blok_id ?? null) !== input.skladBlokId) return false;
    if ((row.podkategorie_techniky_id ?? null) !== targetPodkategorie) return false;
    if (normalizeSkladJednotkaKey(row.jednotka) !== targetJednotka) return false;
    return true;
  });

  return match ?? null;
}
