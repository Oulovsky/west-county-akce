/**
 * Sloupec na_akcich z get_skladove_polozky je součet všech řádků technika_na_zakazce
 * bez filtru. Pro správu skladu přepočítáme součet jen pro zakázky v režimu „Zakázky“
 * (nezrušená, konec ještě nenastal) — viz zakazkyRezervaceFilter.ts.
 */
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { toNumber } from "@/lib/sklad/helpers";
import type { SkladSupabaseClient } from "@/lib/sklad/queries";
import {
  isMissingSkladResourceError,
  logSkladQueryFallback,
  runSkladTableQuery,
} from "@/lib/sklad/tableQuery";
import {
  zakazkaPocitaSeDoSkladovychRezervaci,
  type ZakazkaRezervaceProSklad,
} from "@/lib/sklad/zakazkyRezervaceFilter";

const ZAKAZKY_SELECT_REZERVACE =
  "zakazka_id, datum_od, datum_do, cas_od, cas_do, zrusena" as const;

type TechnikaRow = {
  skladova_polozka_id: string;
  zakazka_id: string;
  mnozstvi: number | string | null;
};

type ZakazkaKusRow = {
  kus_id: string;
  stav: string | null;
};

type SkladKusRow = {
  kus_id: string;
  skladova_polozka_id: string;
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export async function querySpravaNaZakazkachCountsByPolozka(
  client: SkladSupabaseClient,
  ted: Date
): Promise<{
  map: Map<string, number> | null;
  error: { message: string } | null;
}> {
  const techRes = await runSkladTableQuery<TechnikaRow>(
    SKLAD_TABLE.technikaNaZakazce,
    () =>
      client
        .from(SKLAD_TABLE.technikaNaZakazce)
        .select("skladova_polozka_id, zakazka_id, mnozstvi")
  );

  if (techRes.error) {
    return { map: null, error: techRes.error };
  }

  const tech = techRes.data;
  if (tech.length === 0) {
    return { map: new Map(), error: null };
  }

  const zakazkaIds = [
    ...new Set(tech.map((t) => t.zakazka_id).filter(Boolean)),
  ] as string[];

  const zakRows: Array<
    ZakazkaRezervaceProSklad & { zakazka_id: string }
  > = [];

  for (const part of chunk(zakazkaIds, 200)) {
    const { data: zRaw, error: zErr } = await client
      .from(SKLAD_TABLE.zakazky)
      .select(ZAKAZKY_SELECT_REZERVACE)
      .in("zakazka_id", part);

    if (zErr) {
      if (isMissingSkladResourceError(zErr.message)) {
        logSkladQueryFallback(SKLAD_TABLE.zakazky, zErr);
        return { map: new Map(), error: null };
      }
      return { map: null, error: zErr };
    }

    for (const row of zRaw ?? []) {
      zakRows.push(row as ZakazkaRezervaceProSklad & { zakazka_id: string });
    }
  }

  const zakMap = new Map(
    zakRows.map((z) => [z.zakazka_id, z] as const)
  );

  const totals = new Map<string, number>();

  for (const row of tech) {
    const z = zakMap.get(row.zakazka_id);
    if (!zakazkaPocitaSeDoSkladovychRezervaci(z ?? null, ted)) {
      continue;
    }

    const id = row.skladova_polozka_id;
    const m = toNumber(row.mnozstvi);
    totals.set(id, (totals.get(id) ?? 0) + m);
  }

  return { map: totals, error: null };
}

export async function querySpravaFyzickyNaZakazkachCountsByPolozka(
  client: SkladSupabaseClient
): Promise<{
  map: Map<string, number> | null;
  error: { message: string } | null;
}> {
  const assignmentsRes = await runSkladTableQuery<ZakazkaKusRow>(
    SKLAD_TABLE.zakazkaKusy,
    () => client.from(SKLAD_TABLE.zakazkaKusy).select("kus_id, stav")
  );

  if (assignmentsRes.error) {
    return { map: null, error: assignmentsRes.error };
  }

  const assignments = assignmentsRes.data.filter(
    (row) => row.stav?.trim() !== "vraceno"
  );
  const kusIds = [
    ...new Set(assignments.map((row) => row.kus_id).filter(Boolean)),
  ];
  if (kusIds.length === 0) {
    return { map: new Map(), error: null };
  }

  const kusRows: SkladKusRow[] = [];
  for (const part of chunk(kusIds, 200)) {
    const { data: kusRaw, error: kusError } = await client
      .from(SKLAD_TABLE.skladPolozkyKusy)
      .select("kus_id, skladova_polozka_id")
      .in("kus_id", part);

    if (kusError) {
      if (isMissingSkladResourceError(kusError.message)) {
        logSkladQueryFallback(SKLAD_TABLE.skladPolozkyKusy, kusError);
        return { map: new Map(), error: null };
      }
      return { map: null, error: kusError };
    }

    kusRows.push(...((kusRaw ?? []) as SkladKusRow[]));
  }

  const kusToPolozka = new Map(
    kusRows.map((row) => [row.kus_id, row.skladova_polozka_id] as const)
  );
  const totals = new Map<string, number>();

  for (const assignment of assignments) {
    const polozkaId = kusToPolozka.get(assignment.kus_id);
    if (!polozkaId) continue;

    totals.set(polozkaId, (totals.get(polozkaId) ?? 0) + 1);
  }

  return { map: totals, error: null };
}
