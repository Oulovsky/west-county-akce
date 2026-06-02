import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import { getSkladKusDisplayLabel } from "@/lib/sklad/helpers";
import { insertSkladKusHistorie } from "@/lib/sklad/kusHistorie";
import type { SkladKusRow } from "@/lib/sklad/types";

export const SKLAD_KUS_OBSAH_TABLE = SKLAD_TABLE.skladKusObsah;

const OBSah_CHILD_SELECT =
  "id, parent_kus_id, child_kus_id, pozice, poznamka, vlozeno_at, child:sklad_polozky_kusy!sklad_kus_obsah_child_kus_id_fkey(kus_id, evidencni_cislo, poradove_cislo, stav, skladova_polozka_id, polozka:skladove_polozky(nazev))" as const;

const OBSah_PARENT_SELECT =
  "id, parent_kus_id, child_kus_id, pozice, poznamka, vlozeno_at, parent:sklad_polozky_kusy!sklad_kus_obsah_parent_kus_id_fkey(kus_id, evidencni_cislo, poradove_cislo, stav, skladova_polozka_id, polozka:skladove_polozky(nazev))" as const;

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

export type SkladKusObsahParentPlacement = {
  obsahId: string;
  parentKusId: string;
  vlozenoAt: string;
  pozice: string | null;
  evidencniCislo: string | null;
  poradoveCislo: number;
  polozkaNazev: string;
  displayLabel: string;
};

export type SkladKusObsahKusSummary = {
  containedCount: number;
  parentPlacement: SkladKusObsahParentPlacement | null;
};

type ObsahKusJoinRow = {
  kus_id: string;
  evidencni_cislo: string | null;
  poradove_cislo: number;
  stav: string;
  skladova_polozka_id: string;
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

type ObsahParentDbRow = {
  id: string;
  parent_kus_id: string;
  child_kus_id: string;
  pozice: string | null;
  poznamka: string | null;
  vlozeno_at: string;
  parent: ObsahKusJoinRow | ObsahKusJoinRow[] | null;
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
  const kusLike = {
    kus_id: child.kus_id,
    poradove_cislo: child.poradove_cislo,
    evidencni_cislo: child.evidencni_cislo,
  } as Pick<SkladKusRow, "kus_id" | "poradove_cislo" | "evidencni_cislo">;

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
    displayLabel: getSkladKusDisplayLabel(polozkaNazev, kusLike),
  };
}

function mapParentPlacement(row: ObsahParentDbRow): SkladKusObsahParentPlacement | null {
  const parent = unwrapKusJoin(row.parent);
  if (!parent) return null;

  const polozkaNazev = unwrapPolozkaNazev(parent.polozka);
  const kusLike = {
    kus_id: parent.kus_id,
    poradove_cislo: parent.poradove_cislo,
    evidencni_cislo: parent.evidencni_cislo,
  } as Pick<SkladKusRow, "kus_id" | "poradove_cislo" | "evidencni_cislo">;

  return {
    obsahId: row.id,
    parentKusId: parent.kus_id,
    vlozenoAt: row.vlozeno_at,
    pozice: row.pozice,
    evidencniCislo: parent.evidencni_cislo,
    poradoveCislo: parent.poradove_cislo,
    polozkaNazev,
    displayLabel: getSkladKusDisplayLabel(polozkaNazev, kusLike),
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

export async function queryActiveParentPlacement(
  client: SupabaseClient,
  childKusId: string
): Promise<SkladKusObsahParentPlacement | null> {
  const { data, error } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select(OBSah_PARENT_SELECT)
    .eq("child_kus_id", childKusId)
    .is("vyjmuto_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) return null;
  return mapParentPlacement(data as unknown as ObsahParentDbRow);
}

/** Scan / nakládka — aktivní obsah case (child kusy uvnitř parent). */
export async function getActiveContainedPieces(
  client: SupabaseClient,
  parentKusId: string
): Promise<SkladKusObsahChildRow[]> {
  return queryActiveChildrenInCase(client, parentKusId);
}

export async function loadKusObsahSummariesForKusIds(
  client: SupabaseClient,
  kusIds: string[]
): Promise<Map<string, SkladKusObsahKusSummary>> {
  const summary = new Map<string, SkladKusObsahKusSummary>();
  if (kusIds.length === 0) return summary;

  for (const kusId of kusIds) {
    summary.set(kusId, { containedCount: 0, parentPlacement: null });
  }

  const [{ data: asParentRows, error: parentError }, { data: asChildRows, error: childError }] =
    await Promise.all([
      client
        .from(SKLAD_KUS_OBSAH_TABLE)
        .select("parent_kus_id")
        .in("parent_kus_id", kusIds)
        .is("vyjmuto_at", null),
      client
        .from(SKLAD_KUS_OBSAH_TABLE)
        .select(OBSah_PARENT_SELECT)
        .in("child_kus_id", kusIds)
        .is("vyjmuto_at", null),
    ]);

  if (parentError) throw new Error(parentError.message);
  if (childError) throw new Error(childError.message);

  for (const row of asParentRows ?? []) {
    const parentId = row.parent_kus_id as string;
    const current = summary.get(parentId);
    if (current) {
      current.containedCount += 1;
    }
  }

  for (const row of asChildRows ?? []) {
    const childKusId = row.child_kus_id as string;
    const placement = mapParentPlacement(row as unknown as ObsahParentDbRow);
    if (!placement) continue;
    const current = summary.get(childKusId);
    if (current) {
      current.parentPlacement = placement;
    }
  }

  return summary;
}

async function loadKusWithPolozka(
  client: SupabaseClient,
  kusId: string
): Promise<{
  kus_id: string;
  skladova_polozka_id: string;
  evidencni_cislo: string | null;
  poradove_cislo: number;
  polozkaNazev: string;
  displayLabel: string;
} | null> {
  const { data, error } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select("kus_id, skladova_polozka_id, evidencni_cislo, poradove_cislo, polozka:skladove_polozky(nazev)")
    .eq("kus_id", kusId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const polozkaNazev = unwrapPolozkaNazev(
    (data as { polozka: { nazev: string } | { nazev: string }[] | null }).polozka
  );

  return {
    kus_id: data.kus_id as string,
    skladova_polozka_id: data.skladova_polozka_id as string,
    evidencni_cislo: data.evidencni_cislo as string | null,
    poradove_cislo: data.poradove_cislo as number,
    polozkaNazev,
    displayLabel: getSkladKusDisplayLabel(polozkaNazev, {
      poradove_cislo: data.poradove_cislo as number,
      evidencni_cislo: data.evidencni_cislo as string | null,
    }),
  };
}

async function assertNoActiveChildPlacement(
  client: SupabaseClient,
  childKusId: string,
  excludeParentKusId?: string
) {
  const { data, error } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select("id, parent_kus_id")
    .eq("child_kus_id", childKusId)
    .is("vyjmuto_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return;

  if (excludeParentKusId && data.parent_kus_id === excludeParentKusId) return;

  throw new Error("Kus je už aktivně vložený v jiném case.");
}

async function assertNoDirectCycle(
  client: SupabaseClient,
  parentKusId: string,
  childKusId: string
) {
  if (parentKusId === childKusId) {
    throw new Error("Kus nelze vložit sám do sebe.");
  }

  const { data, error } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select("id")
    .eq("parent_kus_id", childKusId)
    .eq("child_kus_id", parentKusId)
    .is("vyjmuto_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) {
    throw new Error("Nelze vytvořit cyklus — case je už uvnitř tohoto kusu.");
  }
}

export async function insertKusIntoCase(
  client: SupabaseClient,
  input: {
    parentKusId: string;
    childKusId: string;
    pozice?: string | null;
    poznamka?: string | null;
    userId?: string | null;
  }
) {
  const parentKusId = input.parentKusId.trim();
  const childKusId = input.childKusId.trim();

  if (!parentKusId || !childKusId) {
    throw new Error("Chybí ID case nebo vkládaného kusu.");
  }

  const [parent, child] = await Promise.all([
    loadKusWithPolozka(client, parentKusId),
    loadKusWithPolozka(client, childKusId),
  ]);

  if (!parent) throw new Error("Case (parent kus) neexistuje.");
  if (!child) throw new Error("Vkládaný kus neexistuje.");

  await assertNoDirectCycle(client, parentKusId, childKusId);
  await assertNoActiveChildPlacement(client, childKusId);

  const pozice = input.pozice?.trim() || null;
  const poznamka = input.poznamka?.trim() || null;

  const { error: insertError } = await client.from(SKLAD_KUS_OBSAH_TABLE).insert({
    parent_kus_id: parentKusId,
    child_kus_id: childKusId,
    pozice,
    poznamka,
    vlozil_user_id: input.userId ?? null,
    vlozeno_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error("Kus je už aktivně vložený v jiném case.");
    }
    throw new Error(insertError.message);
  }

  await insertSkladKusHistorie(client, {
    kusId: childKusId,
    typAkce: "vlozeno_do_case",
    poznamka: `Kus vložen do case: ${parent.displayLabel}`,
  });

  return { parent, child };
}

export async function removeKusFromCase(
  client: SupabaseClient,
  input: {
    obsahId: string;
    userId?: string | null;
  }
) {
  const { data: row, error: loadError } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .select(OBSah_PARENT_SELECT)
    .eq("id", input.obsahId)
    .is("vyjmuto_at", null)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!row) throw new Error("Aktivní vazba v case nebyla nalezena.");

  const placement = mapParentPlacement(row as unknown as ObsahParentDbRow);
  if (!placement) throw new Error("Case pro vyjmutí nebyl nalezen.");

  const childKusId = row.child_kus_id as string;
  const now = new Date().toISOString();

  const { error: updateError } = await client
    .from(SKLAD_KUS_OBSAH_TABLE)
    .update({
      vyjmuto_at: now,
      vyjmul_user_id: input.userId ?? null,
      updated_at: now,
    })
    .eq("id", input.obsahId)
    .is("vyjmuto_at", null);

  if (updateError) throw new Error(updateError.message);

  await insertSkladKusHistorie(client, {
    kusId: childKusId,
    typAkce: "vyjmuto_z_case",
    poznamka: `Kus vyjmut z case: ${placement.displayLabel}`,
  });

  return { childKusId, parentKusId: placement.parentKusId };
}

export function formatKusObsahParentHint(placement: SkladKusObsahParentPlacement): string {
  return `v case: ${placement.displayLabel}`;
}

export function formatKusObsahContainedHint(count: number): string | null {
  if (count <= 0) return null;
  const suffix = count === 1 ? "kus" : count < 5 ? "kusy" : "kusů";
  return `obsahuje ${count} ${suffix}`;
}
