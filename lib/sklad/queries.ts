/**
 * Sdílené read-only dotazy skladu.
 * Zápisy / server actions zůstávají u stránek, dokud nebude sjednocená mutační vrstva.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  SKLAD_KUS_SELECT_FIELDS,
  SKLAD_POSKOZENI_SELECT_FIELDS,
  SKLAD_TABLE,
} from "@/lib/sklad/constants";
import { toNumber } from "@/lib/sklad/helpers";
import {
  isMissingColumnError,
  isMissingSkladResourceError,
  logSkladQueryFallback,
  runSkladTableQuery,
} from "@/lib/sklad/tableQuery";
import type {
  SkladBlok,
  SkladDetailRow,
  SkladJednotka,
  SkladKategorie,
  SkladOkruhRow,
  SkladPodkategorie,
  SkladPolozkaRow,
  SkladPoskozeniListRow,
  SkladPrioritaOption,
  SkladStatistikaRow,
  SkladTypPoskozeniOption,
} from "@/lib/sklad/types";

export type SkladSupabaseClient = SupabaseClient;

/** Produkční schéma (jednotka text, celkem_k_dispozici). */
const SKLADOVE_POLOZKY_COLUMNS_PROD =
  "skladova_polozka_id, nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, jednotka, interni_naklad, fakturacni_cena, aktivni, celkem_k_dispozici" as const;

const SKLADOVE_POLOZKY_COLUMNS =
  "skladova_polozka_id, nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, jednotka_id, interni_naklad, fakturacni_cena, aktivni, celkem" as const;

const SKLADOVE_POLOZKY_COLUMNS_BASE =
  "skladova_polozka_id, nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, jednotka_id, interni_naklad, fakturacni_cena, aktivni" as const;

const SKLADOVE_POLOZKY_COLUMNS_MINIMAL =
  "skladova_polozka_id, nazev, pozice, sklad_blok_id, jednotka, celkem_k_dispozici, aktivni" as const;

function isMissingCelkemColumnError(message: string | undefined): boolean {
  return (
    isMissingColumnError(message, "celkem") ||
    isMissingColumnError(message, "celkem_k_dispozici")
  );
}

type SkladovePolozkyTableRow = {
  skladova_polozka_id: string;
  nazev: string;
  pozice?: number | string | null;
  sklad_blok_id?: string | null;
  kategorie_techniky_id?: string | null;
  podkategorie_techniky_id?: string | null;
  jednotka_id?: string | null;
  /** Textový sloupec v produkční DB (bez číselníku jednotky_skladu). */
  jednotka?: string | null;
  interni_naklad?: number | string | null;
  fakturacni_cena?: number | string | null;
  aktivni?: boolean | null;
  celkem?: number | string | null;
  celkem_k_dispozici?: number | string | null;
};

type SkladovePolozkyLookups = {
  kategorieNazev: Map<string, string>;
  podkategorieNazev: Map<string, string>;
  jednotkaNazev: Map<string, string>;
  blokNazev: Map<string, string>;
  kusyCountByPolozkaId: Map<string, number>;
};

function buildNazevMap(
  rows: Array<{ id: string; nazev: string | null }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const nazev = row.nazev?.trim();
    if (nazev) {
      map.set(row.id, nazev);
    }
  }
  return map;
}

function buildKusyCountByPolozkaId(
  rows: Array<{ skladova_polozka_id: string }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row.skladova_polozka_id;
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

function lookupNazev(map: Map<string, string>, id: string | null): string | null {
  if (!id) return null;
  return map.get(id) ?? null;
}

function mapSkladovePolozkyListRow(
  row: SkladovePolozkyTableRow,
  lookups: SkladovePolozkyLookups
): SkladPolozkaRow {
  const celkemRaw = toNumber(row.celkem ?? row.celkem_k_dispozici);
  const kusyCount = lookups.kusyCountByPolozkaId.get(row.skladova_polozka_id) ?? 0;
  const celkemKDispozici = celkemRaw > 0 ? celkemRaw : kusyCount;

  const jednotkaText = row.jednotka?.trim() || null;
  const jednotkaFromCatalog = lookupNazev(lookups.jednotkaNazev, row.jednotka_id ?? null);

  return {
    skladova_polozka_id: row.skladova_polozka_id,
    nazev: row.nazev,
    kategorie_techniky_id: row.kategorie_techniky_id ?? null,
    kategorie_nazev: lookupNazev(lookups.kategorieNazev, row.kategorie_techniky_id ?? null),
    podkategorie_techniky_id: row.podkategorie_techniky_id ?? null,
    podkategorie_nazev: lookupNazev(
      lookups.podkategorieNazev,
      row.podkategorie_techniky_id ?? null
    ),
    celkem_k_dispozici: celkemKDispozici,
    jednotka: jednotkaText ?? jednotkaFromCatalog,
    interni_naklad:
      row.interni_naklad == null ? null : toNumber(row.interni_naklad),
    fakturacni_cena:
      row.fakturacni_cena == null ? null : toNumber(row.fakturacni_cena),
    sklad_blok_id: row.sklad_blok_id ?? null,
    blok_nazev: lookupNazev(lookups.blokNazev, row.sklad_blok_id ?? null),
    na_sklade: celkemKDispozici,
    na_akcich: 0,
    poskozene: 0,
    pozice: row.pozice ?? null,
  };
}

type SkladovePolozkyFetchResult = {
  data: SkladovePolozkyTableRow[] | null;
  error: PostgrestError | null;
};

async function fetchSkladovePolozkyTable(
  client: SkladSupabaseClient
): Promise<SkladovePolozkyFetchResult> {
  const attempts = [
    SKLADOVE_POLOZKY_COLUMNS_PROD,
    SKLADOVE_POLOZKY_COLUMNS,
    SKLADOVE_POLOZKY_COLUMNS_BASE,
    SKLADOVE_POLOZKY_COLUMNS_MINIMAL,
    "skladova_polozka_id, nazev",
  ] as const;

  let lastError: PostgrestError | null = null;

  for (const columns of attempts) {
    const result = await client
      .from(SKLAD_TABLE.skladovePolozky)
      .select(columns)
      .order("nazev", { ascending: true });

    if (!result.error && Array.isArray(result.data)) {
      return {
        data: result.data as unknown as SkladovePolozkyTableRow[],
        error: null,
      };
    }

    const err = result.error;
    if (!err) {
      continue;
    }

    lastError = err;

    if (isMissingSkladResourceError(err.message)) {
      logSkladQueryFallback(SKLAD_TABLE.skladovePolozky, err);
      return { data: [], error: null };
    }

    if (!isMissingColumnError(err.message)) {
      return { data: null, error: err };
    }
  }

  if (lastError && process.env.NODE_ENV === "development") {
    console.error(
      `[sklad] ${SKLAD_TABLE.skladovePolozky} (všechny SELECT varianty selhaly):`,
      lastError.message
    );
  }

  return { data: [], error: null };
}

type CatalogNazevMaps = {
  kategorieNazev: Map<string, string>;
  podkategorieNazev: Map<string, string>;
  jednotkaNazev: Map<string, string>;
  blokNazev: Map<string, string>;
  kategoriePoradi: Map<string, number>;
  podkategoriePoradi: Map<string, number>;
};

async function loadCatalogNazevMaps(
  client: SkladSupabaseClient
): Promise<CatalogNazevMaps> {
  const [kategorieRes, podkategorieRes, jednotkyRes, blokyRes] = await Promise.all([
    queryKategorieTechnikyFull(client),
    queryPodkategorieTechnikyFull(client),
    queryJednotkySkladuFull(client),
    querySkladBloky(client),
  ]);

  const kategorieRows = (kategorieRes.data ?? []) as SkladKategorie[];
  const podkategorieRows = (podkategorieRes.data ?? []) as SkladPodkategorie[];

  return {
    kategorieNazev: buildNazevMap(
      kategorieRows.map((row) => ({
        id: row.kategorie_techniky_id,
        nazev: row.nazev,
      }))
    ),
    podkategorieNazev: buildNazevMap(
      podkategorieRows.map((row) => ({
        id: row.podkategorie_techniky_id,
        nazev: row.nazev,
      }))
    ),
    jednotkaNazev: buildNazevMap(
      ((jednotkyRes.data ?? []) as SkladJednotka[]).map((row) => ({
        id: row.jednotka_id,
        nazev: row.nazev,
      }))
    ),
    blokNazev: buildNazevMap(
      ((blokyRes.data ?? []) as SkladBlok[]).map((row) => ({
        id: row.sklad_blok_id,
        nazev: row.nazev,
      }))
    ),
    kategoriePoradi: new Map(
      kategorieRows
        .filter((row) => row.poradi != null)
        .map((row) => [row.kategorie_techniky_id, Number(row.poradi)])
    ),
    podkategoriePoradi: new Map(
      podkategorieRows
        .filter((row) => row.poradi != null)
        .map((row) => [row.podkategorie_techniky_id, Number(row.poradi)])
    ),
  };
}

/** Okruhy skladu — tabulka sklad_bloky (+ volitelné součty položek/kusů). */
export async function querySkladBloky(client: SkladSupabaseClient) {
  const blokyRes = await runSkladTableQuery<SkladBlok>(
    SKLAD_TABLE.skladBloky,
    () =>
      client
        .from(SKLAD_TABLE.skladBloky)
        .select("sklad_blok_id, nazev, poradi")
        .order("poradi", { ascending: true })
        .order("nazev", { ascending: true })
  );

  if (blokyRes.error || blokyRes.data.length === 0) {
    return blokyRes;
  }

  const [polozkyRes, kusyRes] = await Promise.all([
    runSkladTableQuery<{ sklad_blok_id: string | null; skladova_polozka_id: string }>(
      `${SKLAD_TABLE.skladovePolozky} (blok counts)`,
      () =>
        client
          .from(SKLAD_TABLE.skladovePolozky)
          .select("skladova_polozka_id, sklad_blok_id")
    ),
    runSkladTableQuery<{ skladova_polozka_id: string }>(
      `${SKLAD_TABLE.skladPolozkyKusy} (blok counts)`,
      () =>
        client.from(SKLAD_TABLE.skladPolozkyKusy).select("skladova_polozka_id")
    ),
  ]);

  if (polozkyRes.error) {
    return { data: blokyRes.data, error: polozkyRes.error };
  }

  const polozkyByBlok = new Map<string, string[]>();
  for (const row of polozkyRes.data) {
    if (!row.sklad_blok_id) continue;
    const list = polozkyByBlok.get(row.sklad_blok_id) ?? [];
    list.push(row.skladova_polozka_id);
    polozkyByBlok.set(row.sklad_blok_id, list);
  }

  const kusyByPolozka = buildKusyCountByPolozkaId(kusyRes.data);

  const enriched = blokyRes.data.map((blok) => {
    const polozkaIds = polozkyByBlok.get(blok.sklad_blok_id) ?? [];
    const kusuCelkem = polozkaIds.reduce(
      (sum, polozkaId) => sum + (kusyByPolozka.get(polozkaId) ?? 0),
      0
    );

    return {
      ...blok,
      poradi: blok.poradi == null ? undefined : Number(blok.poradi),
      pocet_polozek: polozkaIds.length,
      kusu_celkem: kusuCelkem,
    };
  });

  return { data: enriched, error: null };
}

/** Kategorie techniky — tabulka + názvy okruhů v TS. */
export async function queryKategorieTechnikyFull(client: SkladSupabaseClient) {
  const [kategorieRes, blokyRes] = await Promise.all([
    runSkladTableQuery<
      Pick<
        SkladKategorie,
        "kategorie_techniky_id" | "nazev" | "poradi" | "sklad_blok_id" | "aktivni"
      >
    >(SKLAD_TABLE.kategorieTechniky, () =>
      client
        .from(SKLAD_TABLE.kategorieTechniky)
        .select("kategorie_techniky_id, nazev, poradi, sklad_blok_id, aktivni")
        .order("poradi", { ascending: true })
        .order("nazev", { ascending: true })
    ),
    runSkladTableQuery<Pick<SkladBlok, "sklad_blok_id" | "nazev">>(
      `${SKLAD_TABLE.skladBloky} (kategorie lookup)`,
      () =>
        client.from(SKLAD_TABLE.skladBloky).select("sklad_blok_id, nazev")
    ),
  ]);

  if (kategorieRes.error) {
    return kategorieRes;
  }

  const blokNazev = buildNazevMap(
    blokyRes.data.map((row) => ({ id: row.sklad_blok_id, nazev: row.nazev }))
  );

  return {
    data: kategorieRes.data.map((row) => ({
      ...row,
      blok_nazev: row.sklad_blok_id
        ? (blokNazev.get(row.sklad_blok_id) ?? null)
        : null,
    })),
    error: null,
  };
}

/** Podkategorie — tabulka + názvy kategorií v TS. */
export async function queryPodkategorieTechnikyFull(client: SkladSupabaseClient) {
  const [podkategorieRes, kategorieRes] = await Promise.all([
    runSkladTableQuery<
      Pick<
        SkladPodkategorie,
        "podkategorie_techniky_id" | "kategorie_techniky_id" | "nazev" | "poradi"
      >
    >(SKLAD_TABLE.podkategorieTechniky, () =>
      client
        .from(SKLAD_TABLE.podkategorieTechniky)
        .select(
          "podkategorie_techniky_id, kategorie_techniky_id, nazev, poradi"
        )
        .order("poradi", { ascending: true })
        .order("nazev", { ascending: true })
    ),
    runSkladTableQuery<Pick<SkladKategorie, "kategorie_techniky_id" | "nazev">>(
      `${SKLAD_TABLE.kategorieTechniky} (podkategorie lookup)`,
      () =>
        client
          .from(SKLAD_TABLE.kategorieTechniky)
          .select("kategorie_techniky_id, nazev")
    ),
  ]);

  if (podkategorieRes.error) {
    return podkategorieRes;
  }

  const kategorieNazev = buildNazevMap(
    kategorieRes.data.map((row) => ({
      id: row.kategorie_techniky_id,
      nazev: row.nazev,
    }))
  );

  return {
    data: podkategorieRes.data.map((row) => ({
      ...row,
      kategorie_nazev: kategorieNazev.get(row.kategorie_techniky_id) ?? null,
    })),
    error: null,
  };
}

/** Jednotky skladu. */
export async function queryJednotkySkladuFull(client: SkladSupabaseClient) {
  return runSkladTableQuery<SkladJednotka>(SKLAD_TABLE.jednotkySkladu, () =>
    client
      .from(SKLAD_TABLE.jednotkySkladu)
      .select("jednotka_id, nazev, poradi")
      .order("poradi", { ascending: true, nullsFirst: false })
      .order("nazev", { ascending: true })
  );
}

/** Typy poškození. */
export async function queryTypyPoskozeniFull(client: SkladSupabaseClient) {
  return runSkladTableQuery<SkladTypPoskozeniOption>(
    SKLAD_TABLE.typyPoskozeni,
    () =>
      client
        .from(SKLAD_TABLE.typyPoskozeni)
        .select("typ_id, nazev, poradi")
        .order("poradi", { ascending: true })
        .order("nazev", { ascending: true })
  );
}

/** Priority poškození. */
export async function queryPriorityPoskozeniFull(client: SkladSupabaseClient) {
  return runSkladTableQuery<SkladPrioritaOption>(
    SKLAD_TABLE.priorityPoskozeni,
    () =>
      client
        .from(SKLAD_TABLE.priorityPoskozeni)
        .select("priorita_id, nazev, poradi")
        .order("poradi", { ascending: true })
        .order("nazev", { ascending: true })
  );
}

export type SkladovePolozkyQueryResult = {
  data: SkladPolozkaRow[] | null;
  error: PostgrestError | null;
};

/** Přehled položek skladu (samostatné dotazy + spojení v TS). */
export async function querySkladovePolozky(
  client: SkladSupabaseClient
): Promise<SkladovePolozkyQueryResult> {
  const [
    polozkyRes,
    kategorieRes,
    podkategorieRes,
    jednotkyRes,
    blokyRes,
    kusyRes,
  ] = await Promise.all([
    fetchSkladovePolozkyTable(client),
    queryKategorieTechnikyFull(client),
    queryPodkategorieTechnikyFull(client),
    queryJednotkySkladuFull(client),
    runSkladTableQuery<Pick<SkladBlok, "sklad_blok_id" | "nazev">>(
      SKLAD_TABLE.skladBloky,
      () => client.from(SKLAD_TABLE.skladBloky).select("sklad_blok_id, nazev")
    ),
    runSkladTableQuery<{ skladova_polozka_id: string }>(
      SKLAD_TABLE.skladPolozkyKusy,
      () =>
        client.from(SKLAD_TABLE.skladPolozkyKusy).select("skladova_polozka_id")
    ),
  ]);

  const catalogRows = {
    kategorie: (kategorieRes.data ?? []) as SkladKategorie[],
    podkategorie: (podkategorieRes.data ?? []) as SkladPodkategorie[],
    jednotky: (jednotkyRes.data ?? []) as SkladJednotka[],
    bloky: blokyRes.data,
  };

  if (polozkyRes.error) {
    return { data: null, error: polozkyRes.error };
  }

  const polozky = polozkyRes.data ?? [];

  const kategorieRows = catalogRows.kategorie;
  const podkategorieRows = catalogRows.podkategorie;
  const jednotkyRows = catalogRows.jednotky;
  const blokyRows = catalogRows.bloky;

  const lookups: SkladovePolozkyLookups = {
    kategorieNazev: buildNazevMap(
      kategorieRows.map((row) => ({
        id: row.kategorie_techniky_id,
        nazev: row.nazev,
      }))
    ),
    podkategorieNazev: buildNazevMap(
      podkategorieRows.map((row) => ({
        id: row.podkategorie_techniky_id,
        nazev: row.nazev,
      }))
    ),
    jednotkaNazev: buildNazevMap(
      jednotkyRows.map((row) => ({
        id: row.jednotka_id,
        nazev: row.nazev,
      }))
    ),
    blokNazev: buildNazevMap(
      blokyRows.map((row) => ({
        id: row.sklad_blok_id,
        nazev: row.nazev,
      }))
    ),
    kusyCountByPolozkaId: buildKusyCountByPolozkaId(kusyRes.data),
  };

  return {
    data: polozky.map((row) => mapSkladovePolozkyListRow(row, lookups)),
    error: null,
  };
}

type SkladBlokPolozkaRow = {
  skladova_polozka_id: string;
  nazev: string;
  sklad_blok_id: string | null;
  kategorie_techniky_id: string | null;
  podkategorie_techniky_id: string | null;
  jednotka_id: string | null;
  aktivni: boolean | null;
  poznamka: string | null;
  celkem?: number | string | null;
};

/** Položky v okruhu — tabulky + mapování názvů v TS (bez RPC). */
export async function querySkladBlokDetail(
  client: SkladSupabaseClient,
  skladBlokId: string
) {
  const blokRes = await runSkladTableQuery<Pick<SkladBlok, "sklad_blok_id" | "nazev">>(
    SKLAD_TABLE.skladBloky,
    () =>
      client
        .from(SKLAD_TABLE.skladBloky)
        .select("sklad_blok_id, nazev")
        .eq("sklad_blok_id", skladBlokId)
        .limit(1)
  );

  if (blokRes.error) {
    return blokRes;
  }

  const blok = blokRes.data[0];
  if (!blok) {
    return { data: [] as SkladOkruhRow[], error: null };
  }

  const polozkyWithCelkem = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .select(
      "skladova_polozka_id, nazev, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, jednotka_id, aktivni, poznamka, celkem"
    )
    .eq("sklad_blok_id", skladBlokId)
    .order("nazev", { ascending: true });

  const polozkyQuery =
    polozkyWithCelkem.error &&
    isMissingCelkemColumnError(polozkyWithCelkem.error.message)
      ? await client
          .from(SKLAD_TABLE.skladovePolozky)
          .select(
            "skladova_polozka_id, nazev, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, jednotka_id, aktivni, poznamka"
          )
          .eq("sklad_blok_id", skladBlokId)
          .order("nazev", { ascending: true })
      : polozkyWithCelkem;

  if (polozkyQuery.error) {
    if (isMissingSkladResourceError(polozkyQuery.error.message)) {
      logSkladQueryFallback(SKLAD_TABLE.skladovePolozky, polozkyQuery.error);
      return { data: [] as SkladOkruhRow[], error: null };
    }
    return { data: [] as SkladOkruhRow[], error: polozkyQuery.error };
  }

  const polozky = (polozkyQuery.data ?? []) as SkladBlokPolozkaRow[];
  const maps = await loadCatalogNazevMaps(client);

  const polozkaIds = polozky.map((row) => row.skladova_polozka_id);
  const kusyRes =
    polozkaIds.length === 0
      ? { data: [] as Array<{ skladova_polozka_id: string }>, error: null }
      : await runSkladTableQuery<{ skladova_polozka_id: string }>(
          `${SKLAD_TABLE.skladPolozkyKusy} (okruh detail)`,
          () =>
            client
              .from(SKLAD_TABLE.skladPolozkyKusy)
              .select("skladova_polozka_id")
              .in("skladova_polozka_id", polozkaIds)
        );

  const kusyByPolozka = buildKusyCountByPolozkaId(kusyRes.data);

  const rows: SkladOkruhRow[] = polozky.map((row) => {
    const celkem = toNumber(row.celkem);
    const kusyCount = kusyByPolozka.get(row.skladova_polozka_id) ?? 0;
    const celkemKDispozici = celkem > 0 ? celkem : kusyCount;

    return {
      sklad_blok_id: skladBlokId,
      blok_nazev: blok.nazev,
      skladova_polozka_id: row.skladova_polozka_id,
      nazev: row.nazev,
      jednotka: lookupNazev(maps.jednotkaNazev, row.jednotka_id),
      celkem_k_dispozici: celkemKDispozici,
      aktivni: row.aktivni,
      poznamka: row.poznamka,
      na_sklade: celkemKDispozici,
      na_akcich: 0,
      poskozene: 0,
      kategorie_techniky_id: row.kategorie_techniky_id,
      kategorie_nazev: lookupNazev(maps.kategorieNazev, row.kategorie_techniky_id),
      kategorie_poradi: row.kategorie_techniky_id
        ? (maps.kategoriePoradi.get(row.kategorie_techniky_id) ?? null)
        : null,
      podkategorie_techniky_id: row.podkategorie_techniky_id,
      podkategorie_nazev: lookupNazev(
        maps.podkategorieNazev,
        row.podkategorie_techniky_id
      ),
      podkategorie_poradi: row.podkategorie_techniky_id
        ? (maps.podkategoriePoradi.get(row.podkategorie_techniky_id) ?? null)
        : null,
    };
  });

  return { data: rows, error: null };
}

/** Detail skladové položky — tabulka + číselníky v TS. */
export async function querySkladovaPolozkaDetail(
  client: SkladSupabaseClient,
  skladovaPolozkaId: string
) {
  let polozkaRes = await client
    .from(SKLAD_TABLE.skladovePolozky)
    .select(
      "skladova_polozka_id, nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, jednotka_id, interni_naklad, fakturacni_cena, aktivni, poznamka, created_at, updated_at, celkem"
    )
    .eq("skladova_polozka_id", skladovaPolozkaId)
    .maybeSingle();

  if (polozkaRes.error && isMissingCelkemColumnError(polozkaRes.error.message)) {
    polozkaRes = await client
      .from(SKLAD_TABLE.skladovePolozky)
      .select(
        "skladova_polozka_id, nazev, pozice, sklad_blok_id, kategorie_techniky_id, podkategorie_techniky_id, jednotka_id, interni_naklad, fakturacni_cena, aktivni, poznamka, created_at, updated_at"
      )
      .eq("skladova_polozka_id", skladovaPolozkaId)
      .maybeSingle();
  }

  if (polozkaRes.error) {
    return { data: null as SkladDetailRow[] | null, error: polozkaRes.error };
  }

  if (!polozkaRes.data) {
    return { data: [] as SkladDetailRow[], error: null };
  }

  const row = polozkaRes.data as SkladovePolozkyTableRow & {
    poznamka: string | null;
    created_at: string;
    updated_at: string;
  };

  const maps = await loadCatalogNazevMaps(client);

  const kusyRes = await runSkladTableQuery<{ skladova_polozka_id: string }>(
    `${SKLAD_TABLE.skladPolozkyKusy} (detail)`,
    () =>
      client
        .from(SKLAD_TABLE.skladPolozkyKusy)
        .select("skladova_polozka_id")
        .eq("skladova_polozka_id", skladovaPolozkaId)
  );

  const celkem = toNumber(row.celkem ?? row.celkem_k_dispozici);
  const kusyCount = kusyRes.data.length;
  const celkemKDispozici = celkem > 0 ? celkem : kusyCount;

  const jednotkaText = row.jednotka?.trim() || null;
  const jednotkaFromCatalog = lookupNazev(maps.jednotkaNazev, row.jednotka_id ?? null);

  const detail: SkladDetailRow = {
    skladova_polozka_id: row.skladova_polozka_id,
    nazev: row.nazev,
    kategorie_techniky_id: row.kategorie_techniky_id ?? null,
    kategorie_nazev: lookupNazev(maps.kategorieNazev, row.kategorie_techniky_id ?? null),
    podkategorie_techniky_id: row.podkategorie_techniky_id ?? null,
    podkategorie_nazev: lookupNazev(
      maps.podkategorieNazev,
      row.podkategorie_techniky_id ?? null
    ),
    pozice: row.pozice ?? null,
    jednotka: jednotkaText ?? jednotkaFromCatalog ?? "",
    celkem_k_dispozici: celkemKDispozici,
    interni_naklad:
      row.interni_naklad == null ? null : toNumber(row.interni_naklad),
    fakturacni_cena:
      row.fakturacni_cena == null ? null : toNumber(row.fakturacni_cena),
    aktivni: row.aktivni ?? true,
    poznamka: row.poznamka ?? null,
    vytvoreno_dne: row.created_at,
    upraveno_dne: row.updated_at,
  };

  return { data: [detail], error: null };
}

/** Centrální přehled poškození — tabulky + názvy položek v TS. */
export async function queryPoskozeniFull(client: SkladSupabaseClient) {
  const hlaseniRes = await runSkladTableQuery<{
    poskozeni_id: string;
    skladova_polozka_id: string;
    kus_id: string | null;
    pocet_kusu: number;
    typ_poskozeni: string | null;
    priorita: string | null;
    blokuje_pouziti: boolean;
    datum_nahlaseni: string;
    datum_uzavreni: string | null;
  }>(SKLAD_TABLE.hlaseniPoskozeni, () =>
    client
      .from(SKLAD_TABLE.hlaseniPoskozeni)
      .select(
        "poskozeni_id, skladova_polozka_id, kus_id, pocet_kusu, typ_poskozeni, priorita, blokuje_pouziti, datum_nahlaseni, datum_uzavreni"
      )
      .order("datum_nahlaseni", { ascending: false })
  );

  if (hlaseniRes.error) {
    return hlaseniRes;
  }

  const polozkaIds = Array.from(
    new Set(hlaseniRes.data.map((row) => row.skladova_polozka_id).filter(Boolean))
  );

  if (polozkaIds.length === 0) {
    return { data: [] as SkladPoskozeniListRow[], error: null };
  }

  const polozkyRes = await runSkladTableQuery<{
    skladova_polozka_id: string;
    nazev: string;
  }>(`${SKLAD_TABLE.skladovePolozky} (poskozeni)`, () =>
    client
      .from(SKLAD_TABLE.skladovePolozky)
      .select("skladova_polozka_id, nazev")
      .in("skladova_polozka_id", polozkaIds)
  );

  if (polozkyRes.error) {
    return { data: [] as SkladPoskozeniListRow[], error: polozkyRes.error };
  }

  const nazevByPolozkaId = new Map(
    polozkyRes.data.map((row) => [row.skladova_polozka_id, row.nazev])
  );

  return {
    data: hlaseniRes.data.map((row) => ({
      poskozeni_id: row.poskozeni_id,
      skladova_polozka_id: row.skladova_polozka_id,
      kus_id: row.kus_id,
      nazev: nazevByPolozkaId.get(row.skladova_polozka_id) ?? "—",
      pocet_kusu: Number(row.pocet_kusu ?? 0),
      typ_poskozeni: row.typ_poskozeni,
      priorita: row.priorita,
      blokuje_pouziti: row.blokuje_pouziti,
      datum_nahlaseni: row.datum_nahlaseni,
      datum_uzavreni: row.datum_uzavreni,
    })),
    error: null,
  };
}

/** Statistika poškození — agregace z tabulek v TS. */
export async function queryStatistikaPoskozeni(client: SkladSupabaseClient) {
  const [polozkyRes, hlaseniRes, kusyRes, jednotkyRes] = await Promise.all([
    runSkladTableQuery<{
      skladova_polozka_id: string;
      nazev: string;
      jednotka_id: string | null;
      celkem?: number | string | null;
    }>(SKLAD_TABLE.skladovePolozky, async () => {
      const withCelkem = await client
        .from(SKLAD_TABLE.skladovePolozky)
        .select("skladova_polozka_id, nazev, jednotka_id, celkem")
        .order("nazev", { ascending: true });

      if (withCelkem.error && isMissingCelkemColumnError(withCelkem.error.message)) {
        return client
          .from(SKLAD_TABLE.skladovePolozky)
          .select("skladova_polozka_id, nazev, jednotka_id")
          .order("nazev", { ascending: true });
      }

      return withCelkem;
    }),
    runSkladTableQuery<{
      skladova_polozka_id: string;
      pocet_kusu: number | string;
      blokuje_pouziti: boolean;
      datum_uzavreni: string | null;
    }>(SKLAD_TABLE.hlaseniPoskozeni, () =>
      client
        .from(SKLAD_TABLE.hlaseniPoskozeni)
        .select("skladova_polozka_id, pocet_kusu, blokuje_pouziti, datum_uzavreni")
    ),
    runSkladTableQuery<{ skladova_polozka_id: string; stav: string }>(
      SKLAD_TABLE.skladPolozkyKusy,
      () =>
        client.from(SKLAD_TABLE.skladPolozkyKusy).select("skladova_polozka_id, stav")
    ),
    queryJednotkySkladuFull(client),
  ]);

  const firstError =
    polozkyRes.error ?? hlaseniRes.error ?? kusyRes.error ?? jednotkyRes.error ?? null;

  if (firstError) {
    return { data: null as SkladStatistikaRow[] | null, error: firstError };
  }

  const jednotkaNazev = buildNazevMap(
    ((jednotkyRes.data ?? []) as SkladJednotka[]).map((row) => ({
      id: row.jednotka_id,
      nazev: row.nazev,
    }))
  );

  const kusyByPolozka = buildKusyCountByPolozkaId(
    kusyRes.data.map((row) => ({ skladova_polozka_id: row.skladova_polozka_id }))
  );

  const blokovaneByPolozka = new Map<string, number>();
  for (const kus of kusyRes.data) {
    if (kus.stav !== "blokovano" && kus.stav !== "poskozeno") continue;
    blokovaneByPolozka.set(
      kus.skladova_polozka_id,
      (blokovaneByPolozka.get(kus.skladova_polozka_id) ?? 0) + 1
    );
  }

  const hlaseniStats = new Map<
    string,
    { otevrena: number; celkem: number; blokujiciKusy: number }
  >();

  for (const row of hlaseniRes.data) {
    const id = row.skladova_polozka_id;
    const current = hlaseniStats.get(id) ?? {
      otevrena: 0,
      celkem: 0,
      blokujiciKusy: 0,
    };
    current.celkem += 1;
    if (!row.datum_uzavreni) {
      current.otevrena += 1;
      if (row.blokuje_pouziti) {
        current.blokujiciKusy += Number(row.pocet_kusu ?? 0);
      }
    }
    hlaseniStats.set(id, current);
  }

  const rows: SkladStatistikaRow[] = polozkyRes.data.map((row) => {
    const celkem = toNumber(row.celkem);
    const kusyCount = kusyByPolozka.get(row.skladova_polozka_id) ?? 0;
    const stats = hlaseniStats.get(row.skladova_polozka_id);

    return {
      skladova_polozka_id: row.skladova_polozka_id,
      nazev: row.nazev,
      jednotka: lookupNazev(jednotkaNazev, row.jednotka_id),
      celkem_k_dispozici: celkem > 0 ? celkem : kusyCount,
      blokovane_kusy: Math.max(
        blokovaneByPolozka.get(row.skladova_polozka_id) ?? 0,
        stats?.blokujiciKusy ?? 0
      ),
      otevrena_hlaseni: stats?.otevrena ?? 0,
      celkem_hlaseni: stats?.celkem ?? 0,
    };
  });

  return { data: rows, error: null };
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

/** Podkategorie přiřazené položkám (záloha pro enrichSpravaPolozkyWithPodkategorie). */
export async function querySkladovePolozkyPodkategorie(
  client: SkladSupabaseClient
) {
  return runSkladTableQuery<{
    skladova_polozka_id: string;
    podkategorie_techniky_id: string | null;
  }>(`${SKLAD_TABLE.skladovePolozky} (podkategorie)`, () =>
    client
      .from(SKLAD_TABLE.skladovePolozky)
      .select("skladova_polozka_id, podkategorie_techniky_id")
  );
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
