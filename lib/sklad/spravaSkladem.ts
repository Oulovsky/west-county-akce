/**
 * Otevřená hlášení poškození s blokací (stejný význam jako sumBlokujiciPoskozeneKusy na řádku).
 */
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { toNumber } from "@/lib/sklad/helpers";
import type { SkladSupabaseClient } from "@/lib/sklad/queries";
import { runSkladTableQuery } from "@/lib/sklad/tableQuery";

const BLOKUJICI_POSKOZENI_SELECT =
  "skladova_polozka_id, pocet_kusu, blokuje_pouziti, datum_uzavreni" as const;

export function computeSpravaNaSklade(
  celkemKDispozici: number,
  naZakazkach: number,
  otevreneBlokujiciKusy: number
): number {
  return Math.max(
    0,
    celkemKDispozici - naZakazkach - otevreneBlokujiciKusy
  );
}

/** Součet pocet_kusu z otevřených hlášení, kde blokuje_pouziti = true. */
export async function querySpravaBlokujiciPoskozeneByPolozka(
  client: SkladSupabaseClient
): Promise<{
  map: Map<string, number> | null;
  error: { message: string } | null;
}> {
  type Row = {
    skladova_polozka_id: string;
    pocet_kusu: number | string | null;
  };

  const { data, error } = await runSkladTableQuery<Row>(
    SKLAD_TABLE.hlaseniPoskozeni,
    () =>
      client
        .from(SKLAD_TABLE.hlaseniPoskozeni)
        .select(BLOKUJICI_POSKOZENI_SELECT)
        .eq("blokuje_pouziti", true)
        .is("datum_uzavreni", null)
  );

  if (error) {
    return { map: null, error };
  }

  const totals = new Map<string, number>();
  for (const row of data) {
    const id = String(row.skladova_polozka_id);
    const n = toNumber(row.pocet_kusu);
    totals.set(id, (totals.get(id) ?? 0) + n);
  }

  return { map: totals, error: null };
}
