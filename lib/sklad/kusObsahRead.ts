import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { getSkladKusDisplayLabel, formatSkladKusStav } from "@/lib/sklad/helpers";
import type { SkladKusRow } from "@/lib/sklad/types";
import { ZAKAZKA_KUS_ACTIVE_STAVY } from "@/lib/sklad/zakazkaKusy";

export const SKLAD_KUS_OBSAH_TABLE = SKLAD_TABLE.skladKusObsah;

const OBSah_CHILD_SELECT =
  "id, parent_kus_id, child_kus_id, pozice, poznamka, vlozeno_at, child:sklad_polozky_kusy!sklad_kus_obsah_child_kus_id_fkey(kus_id, evidencni_cislo, poradove_cislo, stav, skladova_polozka_id, polozka:skladove_polozky(nazev))" as const;

export type SkladKusObsahChildRow = {
  obsahId: string;
  childKusId: string;
  pozice: string | null;
  poznamka: string | null;
  vlozenoAt: string;
  evidencniCislo: string | null;
  poradoveCislo: number;
  stav: string;
  polozkaNazev: string;
  displayLabel: string;
};

export type SkladKusObsahChildOption = {
  kusId: string;
  displayLabel: string;
  polozkaNazev: string;
  stav: string;
  stavLabel: string;
};

type ObsahKusJoinRow = {
  kus_id: string;
  evidencni_cislo: string | null;
  poradove_cislo: number;
  stav: string;
  polozka: { nazev: string } | { nazev: string }[] | null;
};

type ObsahChildDbRow = {
  id: string;
  parent_kus_id: string;
  child_kus_id: string;
  pozice: string | null;
  poznamka: string | null;
  vlozeno_at: string;
  child: ObsahKusJoinRow | ObsahKusJoinRow[] | null;
};

function unwrapKusJoin(
  value: ObsahKusJoinRow | ObsahKusJoinRow[] | null | undefined
): ObsahKusJoinRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function unwrapPolozkaNazev(
  polozka: { nazev: string } | { nazev: string }[] | null | undefined
): string {
  if (!polozka) return "—";
  if (Array.isArray(polozka)) return polozka[0]?.nazev?.trim() || "—";
  return polozka.nazev?.trim() || "—";
}

function mapChildRow(row: ObsahChildDbRow): SkladKusObsahChildRow | null {
  const child = unwrapKusJoin(row.child);
  if (!child) return null;

  const polozkaNazev = unwrapPolozkaNazev(child.polozka);
  return {
    obsahId: row.id,
    childKusId: child.kus_id,
    pozice: row.pozice,
    poznamka: row.poznamka,
    vlozenoAt: row.vlozeno_at,
    evidencniCislo: child.evidencni_cislo,
    poradoveCislo: child.poradove_cislo,
    stav: child.stav,
    polozkaNazev,
    displayLabel: getSkladKusDisplayLabel(polozkaNazev, {
      poradove_cislo: child.poradove_cislo,
      evidencni_cislo: child.evidencni_cislo,
    }),
  };
}

export async function queryActiveChildrenInCase(
  client: SupabaseClient,
  parentKusId: string
): Promise<SkladKusObsahChildRow[]> {
  const { data, error } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select(OBSah_CHILD_SELECT)
    .eq("parent_kus_id", parentKusId)
    .is("vyjmuto_at", null)
    .order("vlozeno_at", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as ObsahChildDbRow[])
    .map(mapChildRow)
    .filter((row): row is SkladKusObsahChildRow => row != null);
}

export async function loadActiveChildrenByParentKusIds(
  client: SupabaseClient,
  parentKusIds: string[]
): Promise<Map<string, SkladKusObsahChildRow[]>> {
  const map = new Map<string, SkladKusObsahChildRow[]>();
  if (parentKusIds.length === 0) return map;

  for (const parentKusId of parentKusIds) {
    map.set(parentKusId, []);
  }

  const { data, error } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select(OBSah_CHILD_SELECT)
    .in("parent_kus_id", parentKusIds)
    .is("vyjmuto_at", null)
    .order("vlozeno_at", { ascending: true });

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as unknown as ObsahChildDbRow[]) {
    const mapped = mapChildRow(row);
    if (!mapped) continue;
    const list = map.get(row.parent_kus_id) ?? [];
    list.push(mapped);
    map.set(row.parent_kus_id, list);
  }

  return map;
}

const UNAVAILABLE_KUS_STAVY = ["vyrazeno", "odpis"] as const;
const AVAILABLE_KUS_OPTIONS_LIMIT = 400;

export async function loadAvailableChildKusOptions(
  client: SupabaseClient,
  input?: { search?: string; limit?: number }
): Promise<SkladKusObsahChildOption[]> {
  const search = input?.search?.trim().toLowerCase() ?? "";
  const limit = input?.limit ?? AVAILABLE_KUS_OPTIONS_LIMIT;

  const [{ data: inCaseRows, error: inCaseError }, { data: onZakazkaRows, error: onZakazkaError }] =
    await Promise.all([
      client.from(SKLAD_KUS_OBSAH_TABLE).select("child_kus_id").is("vyjmuto_at", null),
      client
        .from(SKLAD_TABLE.zakazkaKusy)
        .select("kus_id")
        .in("stav", [...ZAKAZKA_KUS_ACTIVE_STAVY]),
    ]);

  if (inCaseError) throw new Error(inCaseError.message);
  if (onZakazkaError) throw new Error(onZakazkaError.message);

  const excludedKusIds = new Set<string>();
  for (const row of inCaseRows ?? []) {
    if (row.child_kus_id) excludedKusIds.add(row.child_kus_id as string);
  }
  for (const row of onZakazkaRows ?? []) {
    if (row.kus_id) excludedKusIds.add(row.kus_id as string);
  }

  const { data: kusyRaw, error: kusyError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select(
      "kus_id, evidencni_cislo, poradove_cislo, stav, aktivni, polozka:skladove_polozky(nazev)"
    )
    .eq("aktivni", true)
    .order("poradove_cislo", { ascending: true })
    .limit(limit * 2);

  if (kusyError) throw new Error(kusyError.message);

  const options: SkladKusObsahChildOption[] = [];

  for (const row of kusyRaw ?? []) {
    const kusId = row.kus_id as string;
    const stav = row.stav as string;
    if (!row.aktivni) continue;
    if (UNAVAILABLE_KUS_STAVY.includes(stav as (typeof UNAVAILABLE_KUS_STAVY)[number])) continue;
    if (excludedKusIds.has(kusId)) continue;

    const polozkaNazev = unwrapPolozkaNazev(
      (row as { polozka: { nazev: string } | { nazev: string }[] | null }).polozka
    );
    const displayLabel = getSkladKusDisplayLabel(polozkaNazev, {
      poradove_cislo: row.poradove_cislo as number,
      evidencni_cislo: row.evidencni_cislo as string | null,
    });

    if (search) {
      const haystack = `${polozkaNazev} ${displayLabel} ${row.evidencni_cislo ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) continue;
    }

    options.push({
      kusId,
      displayLabel,
      polozkaNazev,
      stav,
      stavLabel: formatSkladKusStav(stav),
    });

    if (options.length >= limit) break;
  }

  return options.sort((a, b) =>
    `${a.polozkaNazev} ${a.displayLabel}`.localeCompare(`${b.polozkaNazev} ${b.displayLabel}`, "cs")
  );
}

export function filterChildOptionsForParent(
  options: SkladKusObsahChildOption[],
  parentKusId: string,
  activeChildren: SkladKusObsahChildRow[]
): SkladKusObsahChildOption[] {
  const alreadyInside = new Set(activeChildren.map((row) => row.childKusId));
  return options.filter(
    (option) => option.kusId !== parentKusId && !alreadyInside.has(option.kusId)
  );
}

export function formatKusObsahContainedLabel(count: number): string {
  if (count <= 0) return "Obsahuje 0 kusů";
  const suffix = count === 1 ? "kus" : count < 5 ? "kusy" : "kusů";
  return `Obsahuje ${count} ${suffix}`;
}
