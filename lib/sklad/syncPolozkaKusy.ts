/**
 * Synchronizace počtu řádků v sklad_polozky_kusy s hodnotou Celkem.
 * Konvence insertu odpovídá server action pridatKus v app/sklad/[id]/page.tsx.
 */
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { toNumber } from "@/lib/sklad/helpers";
import type { SkladSupabaseClient } from "@/lib/sklad/queries";

export type SyncPolozkaKusyResult = {
  ok: boolean;
  error?: string;
  created: number;
  existingCount: number;
  targetCount: number;
  /** Evidence má více kusů než cílové Celkem — kusy se nesmažou automaticky. */
  excessKusy: boolean;
};

const KUS_STAV_SKLADEM = "skladem";

/** Stejný formát jako pridatKus na detailu položky. */
export function buildSkladKusEvidencniCislo(
  polozkaNazev: string,
  poradoveCislo: number
): string {
  const nazev = polozkaNazev.trim() || "Kus";
  return `${nazev} #${poradoveCislo}`;
}

/**
 * Zajistí, že počet řádků v sklad_polozky_kusy je alespoň targetCount.
 * Při targetCount < existingCount nic nemazá (excessKusy).
 */
export async function syncPolozkaKusyToCelkem(
  client: SkladSupabaseClient,
  skladovaPolozkaId: string,
  polozkaNazev: string,
  targetCount: number
): Promise<SyncPolozkaKusyResult> {
  const target = Math.max(0, Math.floor(targetCount));

  const { data: existing, error: fetchError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, poradove_cislo")
    .eq("skladova_polozka_id", skladovaPolozkaId)
    .order("poradove_cislo", { ascending: true });

  if (fetchError) {
    return {
      ok: false,
      error: fetchError.message,
      created: 0,
      existingCount: 0,
      targetCount: target,
      excessKusy: false,
    };
  }

  const rows = existing ?? [];
  const existingCount = rows.length;

  if (existingCount > target) {
    return {
      ok: true,
      created: 0,
      existingCount,
      targetCount: target,
      excessKusy: true,
    };
  }

  const toCreate = target - existingCount;
  if (toCreate === 0) {
    return {
      ok: true,
      created: 0,
      existingCount,
      targetCount: target,
      excessKusy: false,
    };
  }

  const maxPoradi = rows.reduce(
    (max, row) => Math.max(max, toNumber(row.poradove_cislo)),
    0
  );

  const inserts = Array.from({ length: toCreate }, (_, index) => {
    const poradoveCislo = maxPoradi + index + 1;
    return {
      skladova_polozka_id: skladovaPolozkaId,
      poradove_cislo: poradoveCislo,
      evidencni_cislo: buildSkladKusEvidencniCislo(polozkaNazev, poradoveCislo),
      stav: KUS_STAV_SKLADEM,
      aktivni: true,
    };
  });

  const { error: insertError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .insert(inserts);

  if (insertError) {
    return {
      ok: false,
      error: insertError.message,
      created: 0,
      existingCount,
      targetCount: target,
      excessKusy: false,
    };
  }

  return {
    ok: true,
    created: toCreate,
    existingCount,
    targetCount: target,
    excessKusy: false,
  };
}
