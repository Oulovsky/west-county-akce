import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { getSkladKusDisplayLabel, formatSkladKusStav } from "@/lib/sklad/helpers";
import type { SkladKusRow } from "@/lib/sklad/types";
import { ZAKAZKA_KUS_ACTIVE_STAVY } from "@/lib/sklad/zakazkaKusy";

export const SKLAD_KUS_OBSAH_TABLE = SKLAD_TABLE.skladKusObsah;

/** Bez vnořeného joinu — spolehlivé pro klienta i server. */
const OBSah_LINK_SELECT =
  "id, parent_kus_id, child_kus_id, pozice, poznamka, vlozeno_at" as const;

const POLOZKA_META_SELECT =
  "skladova_polozka_id, nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, technicky_vlastnik_id, jednotka, interni_naklad, fakturacni_cena" as const;

export type SkladKusObsahChildRow = {
  obsahId: string;
  childKusId: string;
  skladovaPolozkaId: string;
  pozice: string | null;
  poznamka: string | null;
  vlozenoAt: string;
  evidencniCislo: string | null;
  poradoveCislo: number;
  stav: string;
  polozkaNazev: string;
  displayLabel: string;
  polozkaPozice: number | string | null;
  skladBlokId: string | null;
  kategorieTechnikyId: string | null;
  podkategorieTechnikyId: string | null;
  technickyVlastnikId: string | null;
  interniNaklad: number | string | null;
  fakturacniCena: number | string | null;
  blokNazev?: string | null;
  kategorieNazev?: string | null;
  podkategorieNazev?: string | null;
  technickyVlastnikNazev?: string | null;
  jednotka?: string | null;
  cenaAkce?: number | null;
};

export type SkladKusObsahChildOption = {
  kusId: string;
  displayLabel: string;
  polozkaNazev: string;
  stav: string;
  stavLabel: string;
};

type ObsahPolozkaJoinRow = {
  nazev: string;
  pozice: number | string | null;
  sklad_blok_id: string | null;
  kategorie_techniky_id: string | null;
  podkategorie_techniky_id: string | null;
  technicky_vlastnik_id: string | null;
  jednotka: string | null;
  interni_naklad: number | string | null;
  fakturacni_cena: number | string | null;
};

type ObsahKusJoinRow = {
  kus_id: string;
  evidencni_cislo: string | null;
  poradove_cislo: number;
  stav: string;
  skladova_polozka_id: string;
  polozka: ObsahPolozkaJoinRow | ObsahPolozkaJoinRow[] | null;
};

type ObsahLinkDbRow = {
  id: string;
  parent_kus_id: string;
  child_kus_id: string;
  pozice: string | null;
  poznamka: string | null;
  vlozeno_at: string;
};

type ObsahChildDbRow = ObsahLinkDbRow & {
  child: ObsahKusJoinRow | ObsahKusJoinRow[] | null;
};

function unwrapKusJoin(
  value: ObsahKusJoinRow | ObsahKusJoinRow[] | null | undefined
): ObsahKusJoinRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function unwrapPolozkaJoin(
  polozka: ObsahPolozkaJoinRow | ObsahPolozkaJoinRow[] | null | undefined
): ObsahPolozkaJoinRow | null {
  if (!polozka) return null;
  if (Array.isArray(polozka)) return polozka[0] ?? null;
  return polozka;
}

function mapObsahLinkWithKusMeta(
  link: ObsahLinkDbRow,
  child: ObsahKusJoinRow,
  polozka: ObsahPolozkaJoinRow | null
): SkladKusObsahChildRow {
  const polozkaNazev = polozka?.nazev?.trim() || "—";
  return {
    obsahId: link.id,
    childKusId: child.kus_id,
    skladovaPolozkaId: child.skladova_polozka_id,
    pozice: link.pozice,
    poznamka: link.poznamka,
    vlozenoAt: link.vlozeno_at,
    evidencniCislo: child.evidencni_cislo,
    poradoveCislo: child.poradove_cislo,
    stav: child.stav,
    polozkaNazev,
    displayLabel: getSkladKusDisplayLabel(polozkaNazev, {
      poradove_cislo: child.poradove_cislo,
      evidencni_cislo: child.evidencni_cislo,
    }),
    polozkaPozice: polozka?.pozice ?? null,
    skladBlokId: polozka?.sklad_blok_id ?? null,
    kategorieTechnikyId: polozka?.kategorie_techniky_id ?? null,
    podkategorieTechnikyId: polozka?.podkategorie_techniky_id ?? null,
    technickyVlastnikId: polozka?.technicky_vlastnik_id ?? null,
    jednotka: polozka?.jednotka?.trim() || null,
    interniNaklad: polozka?.interni_naklad ?? null,
    fakturacniCena: polozka?.fakturacni_cena ?? null,
  };
}

/** @deprecated Prefer mapObsahLinkWithKusMeta — zachováno pro server embed fallback. */
export function mapObsahChildRow(row: ObsahChildDbRow): SkladKusObsahChildRow | null {
  const child = unwrapKusJoin(row.child);
  if (!child) return null;
  const polozka = unwrapPolozkaJoin(child.polozka);
  return mapObsahLinkWithKusMeta(row, child, polozka);
}

async function loadKusMetaByIds(
  client: SupabaseClient,
  childKusIds: string[]
): Promise<Map<string, { kus: ObsahKusJoinRow; polozka: ObsahPolozkaJoinRow | null }>> {
  const map = new Map<string, { kus: ObsahKusJoinRow; polozka: ObsahPolozkaJoinRow | null }>();
  if (childKusIds.length === 0) return map;

  const { data: kusyRaw, error: kusyError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, evidencni_cislo, poradove_cislo, stav, skladova_polozka_id")
    .in("kus_id", childKusIds);

  if (kusyError) throw new Error(kusyError.message);

  const polozkaIds = [
    ...new Set(
      (kusyRaw ?? [])
        .map((row) => row.skladova_polozka_id as string)
        .filter(Boolean)
    ),
  ];

  const polozkaById = new Map<string, ObsahPolozkaJoinRow>();
  if (polozkaIds.length > 0) {
    const { data: polozkyRaw, error: polozkyError } = await client
      .from(SKLAD_TABLE.skladovePolozky)
      .select(POLOZKA_META_SELECT)
      .in("skladova_polozka_id", polozkaIds);

    if (polozkyError) throw new Error(polozkyError.message);

    for (const row of (polozkyRaw ?? []) as unknown as (ObsahPolozkaJoinRow & {
      skladova_polozka_id: string;
    })[]) {
      polozkaById.set(row.skladova_polozka_id, row);
    }
  }

  for (const row of kusyRaw ?? []) {
    const kusId = row.kus_id as string;
    const polozkaId = row.skladova_polozka_id as string;
    map.set(kusId, {
      kus: {
        kus_id: kusId,
        evidencni_cislo: row.evidencni_cislo as string | null,
        poradove_cislo: row.poradove_cislo as number,
        stav: row.stav as string,
        skladova_polozka_id: polozkaId,
        polozka: null,
      },
      polozka: polozkaById.get(polozkaId) ?? null,
    });
  }

  return map;
}

async function loadActiveObsahLinks(
  client: SupabaseClient,
  filter: { parentKusId: string } | { parentKusIds: string[] }
): Promise<ObsahLinkDbRow[]> {
  let query = client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select(OBSah_LINK_SELECT)
    .is("vyjmuto_at", null)
    .order("vlozeno_at", { ascending: true });

  if ("parentKusId" in filter) {
    query = query.eq("parent_kus_id", filter.parentKusId);
  } else {
    if (filter.parentKusIds.length === 0) return [];
    query = query.in("parent_kus_id", filter.parentKusIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ObsahLinkDbRow[];
}

async function mapObsahLinksToChildRows(
  client: SupabaseClient,
  links: ObsahLinkDbRow[]
): Promise<SkladKusObsahChildRow[]> {
  if (links.length === 0) return [];

  const childKusIds = [...new Set(links.map((row) => row.child_kus_id))];
  const kusMetaById = await loadKusMetaByIds(client, childKusIds);

  const rows: SkladKusObsahChildRow[] = [];
  for (const link of links) {
    const meta = kusMetaById.get(link.child_kus_id);
    if (!meta) continue;
    rows.push(mapObsahLinkWithKusMeta(link, meta.kus, meta.polozka));
  }

  return rows;
}

export async function countActiveObsahForParent(
  client: SupabaseClient,
  parentKusId: string
): Promise<number> {
  const { count, error } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("parent_kus_id", parentKusId)
    .is("vyjmuto_at", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function queryActiveChildrenInCase(
  client: SupabaseClient,
  parentKusId: string
): Promise<SkladKusObsahChildRow[]> {
  const links = await loadActiveObsahLinks(client, { parentKusId });
  return mapObsahLinksToChildRows(client, links);
}

export async function loadActiveChildCountsByParentKusIds(
  client: SupabaseClient,
  parentKusIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (parentKusIds.length === 0) return counts;

  for (const parentKusId of parentKusIds) {
    counts.set(parentKusId, 0);
  }

  const { data, error } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select("parent_kus_id")
    .in("parent_kus_id", parentKusIds)
    .is("vyjmuto_at", null);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const parentId = row.parent_kus_id as string;
    counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
  }

  return counts;
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

  const links = await loadActiveObsahLinks(client, { parentKusIds });
  if (links.length === 0) return map;

  const childKusIds = [...new Set(links.map((row) => row.child_kus_id))];
  const kusMetaById = await loadKusMetaByIds(client, childKusIds);

  for (const link of links) {
    const meta = kusMetaById.get(link.child_kus_id);
    if (!meta) continue;
    const mapped = mapObsahLinkWithKusMeta(link, meta.kus, meta.polozka);
    const list = map.get(link.parent_kus_id) ?? [];
    list.push(mapped);
    map.set(link.parent_kus_id, list);
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

    const polozka = unwrapPolozkaJoin(
      (row as unknown as { polozka: ObsahPolozkaJoinRow | ObsahPolozkaJoinRow[] | null })
        .polozka
    );
    const polozkaNazev = polozka?.nazev?.trim() || "—";
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
