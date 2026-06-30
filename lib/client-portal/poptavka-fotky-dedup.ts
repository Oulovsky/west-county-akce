import type { SavedSectionFotka } from "@/lib/client-portal/poptavka-section-photo-state";
import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";

export type PoptavkaFotkaDedupRow = {
  id: string;
  typ: PoptavkaFotkaTyp | string;
  storage_path?: string | null;
  source_fotka_id?: string | null;
  original_filename?: string | null;
  size_bytes?: number | null;
  created_at?: string;
};

export function getCanonicalSourceFotkaId(row: {
  id: string;
  source_fotka_id?: string | null;
}) {
  return row.source_fotka_id ?? row.id;
}

export function buildPoptavkaFotkaHeuristicKey(row: {
  typ: string;
  original_filename?: string | null;
  size_bytes?: number | null;
}) {
  return `${row.typ}:heuristic:${row.original_filename ?? ""}:${row.size_bytes ?? -1}`;
}

export function buildPoptavkaFotkaDedupKey(row: PoptavkaFotkaDedupRow) {
  if (row.source_fotka_id) {
    return `${row.typ}:source:${row.source_fotka_id}`;
  }
  if (row.storage_path) {
    return `${row.typ}:path:${row.storage_path}`;
  }
  if (row.original_filename != null && row.size_bytes != null) {
    return buildPoptavkaFotkaHeuristicKey(row);
  }
  return `${row.typ}:id:${row.id}`;
}

export function buildPoptavkaFotkaSemanticKeys(row: PoptavkaFotkaDedupRow): string[] {
  const keys = new Set<string>();
  keys.add(`${row.typ}:canonical:${getCanonicalSourceFotkaId(row)}`);
  keys.add(buildPoptavkaFotkaDedupKey(row));
  if (row.original_filename != null && row.size_bytes != null) {
    keys.add(buildPoptavkaFotkaHeuristicKey(row));
  }
  keys.add(`${row.typ}:id:${row.id}`);
  return [...keys];
}

function sortByCreatedAtAsc<T extends { created_at?: string; id: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

export function dedupePoptavkaFotkaRows<T extends PoptavkaFotkaDedupRow>(rows: T[]): T[] {
  return normalizePoptavkaFotkyRows(rows).rows;
}

export function normalizePoptavkaFotkyRows<T extends PoptavkaFotkaDedupRow>(rows: T[]) {
  const sorted = sortByCreatedAtAsc(rows);
  const seen = new Set<string>();
  const result: T[] = [];
  let duplicatesRemoved = 0;

  for (const row of sorted) {
    const keys = buildPoptavkaFotkaSemanticKeys(row);
    if (keys.some((key) => seen.has(key))) {
      duplicatesRemoved += 1;
      continue;
    }
    for (const key of keys) seen.add(key);
    result.push(row);
  }

  const byTyp: Record<string, number> = {};
  for (const row of result) {
    byTyp[row.typ as string] = (byTyp[row.typ as string] ?? 0) + 1;
  }

  return { rows: result, duplicatesRemoved, byTyp };
}

export function dedupeSavedSectionFotky(saved: SavedSectionFotka[]): SavedSectionFotka[] {
  const seen = new Set<string>();
  const result: SavedSectionFotka[] = [];

  for (const row of saved) {
    const keys = buildPoptavkaFotkaSemanticKeys({
      id: row.id,
      typ: row.typ,
      storage_path: row.storage_path ?? null,
      source_fotka_id: row.source_fotka_id ?? null,
      original_filename: row.original_filename,
      size_bytes: row.size_bytes ?? null,
    });
    if (keys.some((key) => seen.has(key))) continue;
    for (const key of keys) seen.add(key);
    result.push(row);
  }

  return result;
}

export function mergeSavedSectionFotky(
  existing: SavedSectionFotka[],
  incoming: SavedSectionFotka[]
): SavedSectionFotka[] {
  return dedupeSavedSectionFotky([...existing, ...incoming]);
}

export function hasExistingPoptavkaFotkaDuplicate(
  existingRows: PoptavkaFotkaDedupRow[],
  candidate: PoptavkaFotkaDedupRow
) {
  const candidateKeys = new Set(buildPoptavkaFotkaSemanticKeys(candidate));
  return existingRows.some((row) =>
    buildPoptavkaFotkaSemanticKeys(row).some((key) => candidateKeys.has(key))
  );
}

export type PoptavkaFotkyPersistStats = {
  pendingUploadCount: number;
  existingKeptCount: number;
  copiedFromHistoryCount: number;
  skippedDuplicateCount: number;
  finalCount: number;
};

export function logPoptavkaFotkyPersistStats(
  scope: string,
  poptavkaId: string,
  stats: Partial<PoptavkaFotkyPersistStats>
) {
  console.info(`[poptavka fotky] ${scope}`, {
    poptavkaId,
    pendingUploadCount: stats.pendingUploadCount ?? 0,
    existingKeptCount: stats.existingKeptCount ?? 0,
    copiedFromHistoryCount: stats.copiedFromHistoryCount ?? 0,
    skippedDuplicateCount: stats.skippedDuplicateCount ?? 0,
    finalCount: stats.finalCount ?? 0,
  });
}

export function logPoptavkaFotkyLoadStats(
  poptavkaId: string,
  dbCount: number,
  afterNormalizeCount: number,
  duplicatesRemoved: number,
  byTyp: Record<string, number>
) {
  console.info("[poptavka fotky load] db count", { poptavkaId, count: dbCount });
  console.info("[poptavka fotky load] after normalize count", {
    poptavkaId,
    count: afterNormalizeCount,
  });
  console.info("[poptavka fotky load] duplicates removed count", {
    poptavkaId,
    count: duplicatesRemoved,
  });
  console.info("[poptavka fotky load] by section counts", { poptavkaId, byTyp });
}
