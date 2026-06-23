import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { queryActiveChildrenInCase } from "@/lib/sklad/kusObsahRead";
import type { SpravaVybranaPolozka, SpravaVybranyKus } from "@/lib/sklad/types";

export type SetupPolozkaQuantityMap = Map<string, number>;

function addQuantity(map: SetupPolozkaQuantityMap, polozkaId: string, delta: number) {
  if (!polozkaId || delta <= 0) return;
  map.set(polozkaId, (map.get(polozkaId) ?? 0) + delta);
}

/** Case kus + aktivní obsah case → položky a množství v mapě. */
export async function expandCaseKusIntoQuantityMap(
  client: SupabaseClient,
  caseKusId: string,
  map: SetupPolozkaQuantityMap
) {
  const { data: kusRow, error: kusError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("skladova_polozka_id")
    .eq("kus_id", caseKusId)
    .maybeSingle();

  if (kusError) throw new Error(kusError.message);

  if (kusRow?.skladova_polozka_id) {
    addQuantity(map, kusRow.skladova_polozka_id as string, 1);
  }

  const children = await queryActiveChildrenInCase(client, caseKusId);
  for (const child of children) {
    addQuantity(map, child.skladovaPolozkaId, 1);
  }
}

export async function buildSetupPolozkyFromSelection(
  client: SupabaseClient,
  input: {
    selectedPolozka: SpravaVybranaPolozka | null;
    selectedKusy: SpravaVybranyKus[];
  }
): Promise<SetupPolozkaQuantityMap> {
  const map: SetupPolozkaQuantityMap = new Map();

  if (input.selectedPolozka) {
    const polozka = input.selectedPolozka;
    if (polozka.isCase) {
      const { data: kusy, error } = await client
        .from(SKLAD_TABLE.skladPolozkyKusy)
        .select("kus_id")
        .eq("skladova_polozka_id", polozka.skladovaPolozkaId)
        .neq("stav", "vyrazeno");

      if (error) throw new Error(error.message);

      for (const row of kusy ?? []) {
        await expandCaseKusIntoQuantityMap(client, row.kus_id as string, map);
      }
    } else {
      addQuantity(map, polozka.skladovaPolozkaId, polozka.celkemKDispozici);
    }
  }

  const caseKusy = input.selectedKusy.filter((kus) => kus.kind === "case");
  const ostatniKusy = input.selectedKusy.filter((kus) => kus.kind !== "case");

  const byPolozka = new Map<string, number>();
  for (const kus of ostatniKusy) {
    byPolozka.set(
      kus.skladovaPolozkaId,
      (byPolozka.get(kus.skladovaPolozkaId) ?? 0) + 1
    );
  }
  for (const [polozkaId, count] of byPolozka) {
    addQuantity(map, polozkaId, count);
  }

  for (const kus of caseKusy) {
    await expandCaseKusIntoQuantityMap(client, kus.kusId, map);
  }

  return map;
}

export function setupQuantityMapToEntries(
  map: SetupPolozkaQuantityMap
): { skladovaPolozkaId: string; mnozstvi: number }[] {
  return [...map.entries()].map(([skladovaPolozkaId, mnozstvi]) => ({
    skladovaPolozkaId,
    mnozstvi,
  }));
}
