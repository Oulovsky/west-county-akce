import type { SavedSectionFotka } from "@/lib/client-portal/poptavka-section-photo-state";
import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";

export type PoptavkaFotkaDedupRow = {
  id: string;
  typ: PoptavkaFotkaTyp | string;
  storage_path?: string | null;
  source_fotka_id?: string | null;
};

export function dedupeSavedSectionFotky(saved: SavedSectionFotka[]): SavedSectionFotka[] {
  const seen = new Set<string>();
  const result: SavedSectionFotka[] = [];

  for (const row of saved) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
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

export function buildPoptavkaFotkaDedupKey(row: PoptavkaFotkaDedupRow) {
  if (row.source_fotka_id) {
    return `${row.typ}:source:${row.source_fotka_id}`;
  }
  if (row.storage_path) {
    return `${row.typ}:path:${row.storage_path}`;
  }
  return `${row.typ}:id:${row.id}`;
}

export function dedupePoptavkaFotkaRows<T extends PoptavkaFotkaDedupRow>(rows: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const row of rows) {
    const key = buildPoptavkaFotkaDedupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }

  return result;
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
