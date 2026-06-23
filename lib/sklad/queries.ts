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
import { getSpravaKusDisplayLabel } from "@/lib/sklad/helpers";
import {
  EMPTY_SPRAVA_CASE_METADATA,
  type SpravaCaseMetadata,
  type SpravaPolozkaCaseFlags,
} from "@/lib/sklad/caseKus";
import type {
  SkladKusObsahRow,
  SkladKusRow,
  SpravaDostupnyKusOption,
} from "@/lib/sklad/types";

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

type PolozkaCaseFlagsRow = {
  skladova_polozka_id: string;
  nazev: string;
  je_case?: boolean | null;
  je_obsah_case?: boolean | null;
};

/**
 * Metadata pro case workflow ve správě skladu.
 * Při chybějících sloupcích/tabulce vrátí prázdné mapy (kusy = běžné).
 */
export async function querySpravaCaseMetadata(
  client: SkladSupabaseClient
): Promise<{ data: SpravaCaseMetadata; error: string | null }> {
  const polozkaFlags = new Map<string, SpravaPolozkaCaseFlags>();
  const polozkaNazevById = new Map<string, string>();

  const { data: polozkyRaw, error: polozkyError } = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .select("skladova_polozka_id, nazev, je_case, je_obsah_case");

  if (polozkyError) {
    const { data: fallbackRaw, error: fallbackError } = await client
      .from(SKLAD_TABLE.skladovePolozky)
      .select("skladova_polozka_id, nazev");

    if (fallbackError) {
      return { data: EMPTY_SPRAVA_CASE_METADATA, error: null };
    }

    for (const row of (fallbackRaw ?? []) as Array<{
      skladova_polozka_id: string;
      nazev: string;
    }>) {
      polozkaNazevById.set(row.skladova_polozka_id, row.nazev);
      polozkaFlags.set(row.skladova_polozka_id, {
        je_case: false,
        je_obsah_case: false,
      });
    }
  } else {
    for (const row of (polozkyRaw ?? []) as PolozkaCaseFlagsRow[]) {
      polozkaNazevById.set(row.skladova_polozka_id, row.nazev);
      polozkaFlags.set(row.skladova_polozka_id, {
        je_case: row.je_case === true,
        je_obsah_case: row.je_obsah_case === true,
      });
    }
  }

  const activeObsahByChildKusId = new Map<string, SkladKusObsahRow>();
  const childrenByParentCaseKusId = new Map<string, SkladKusObsahRow[]>();
  const childKusById = new Map<string, SkladKusRow>();

  const { data: obsahRaw, error: obsahError } = await client
    .from(SKLAD_TABLE.skladKusObsah)
    .select(
      "obsah_id, parent_case_kus_id, child_kus_id, vlozeno_at, vyjmuto_at, vyjmul_user_id"
    )
    .is("vyjmuto_at", null);

  if (obsahError) {
    return {
      data: {
        polozkaFlags,
        activeObsahByChildKusId,
        childrenByParentCaseKusId,
        childKusById,
        polozkaNazevById,
      },
      error: null,
    };
  }

  const obsahRows = (obsahRaw ?? []) as SkladKusObsahRow[];
  const childKusIds = new Set<string>();
  const parentCaseKusIds = new Set<string>();

  for (const row of obsahRows) {
    activeObsahByChildKusId.set(row.child_kus_id, row);
    childKusIds.add(row.child_kus_id);
    parentCaseKusIds.add(row.parent_case_kus_id);

    const siblings = childrenByParentCaseKusId.get(row.parent_case_kus_id) ?? [];
    siblings.push(row);
    childrenByParentCaseKusId.set(row.parent_case_kus_id, siblings);
  }

  const allKusIds = [...new Set([...childKusIds, ...parentCaseKusIds])];
  if (allKusIds.length > 0) {
    const { data: kusyRaw } = await client
      .from(SKLAD_TABLE.skladPolozkyKusy)
      .select(SKLAD_KUS_SELECT_FIELDS)
      .in("kus_id", allKusIds);

    for (const kus of (kusyRaw ?? []) as SkladKusRow[]) {
      childKusById.set(kus.kus_id, kus);
    }
  }

  return {
    data: {
      polozkaFlags,
      activeObsahByChildKusId,
      childrenByParentCaseKusId,
      childKusById,
      polozkaNazevById,
    },
    error: null,
  };
}

/** Kusy volné pro vložení do case (nejsou aktivně v jiném case, stav skladem). */
export async function queryDostupneKusyProVlozeniDoCase(
  client: SkladSupabaseClient,
  metadata: SpravaCaseMetadata,
  excludeCaseKusId?: string
): Promise<{ data: SpravaDostupnyKusOption[]; error: string | null }> {
  const { data: kusyRaw, error: kusyError } = await client
    .from(SKLAD_TABLE.skladPolozkyKusy)
    .select(SKLAD_KUS_SELECT_FIELDS)
    .eq("stav", "skladem")
    .eq("aktivni", true)
    .order("poradove_cislo", { ascending: true });

  if (kusyError) {
    return { data: [], error: kusyError.message };
  }

  const options: SpravaDostupnyKusOption[] = [];

  for (const kus of (kusyRaw ?? []) as SkladKusRow[]) {
    if (excludeCaseKusId && kus.kus_id === excludeCaseKusId) continue;
    if (metadata.activeObsahByChildKusId.has(kus.kus_id)) continue;

    const polozkaNazev =
      metadata.polozkaNazevById.get(kus.skladova_polozka_id) ?? "Kus";
    const flags = metadata.polozkaFlags.get(kus.skladova_polozka_id);
    if (flags?.je_case) continue;

    options.push({
      kusId: kus.kus_id,
      label: getSpravaKusDisplayLabel(polozkaNazev, kus),
      skladovaPolozkaId: kus.skladova_polozka_id,
      polozkaNazev,
    });
  }

  return { data: options, error: null };
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
