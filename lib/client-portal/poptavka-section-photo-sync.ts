import { dedupeSavedSectionFotky, buildPoptavkaFotkaSemanticKeys } from "@/lib/client-portal/poptavka-fotky-dedup";
import type {
  SavedSectionFotka,
  SectionPhotoState,
} from "@/lib/client-portal/poptavka-section-photo-state";

export type SectionPhotoSyncStats = {
  pendingBefore: number;
  localSavedBefore: number;
  serverSavedCount: number;
  mergedSavedCount: number;
  skippedOverwriteCount: number;
  pendingAfter: number;
};

function isSameSavedSectionFotka(a: SavedSectionFotka, b: SavedSectionFotka) {
  const keysA = buildPoptavkaFotkaSemanticKeys({
    id: a.id,
    typ: a.typ,
    storage_path: a.storage_path ?? null,
    source_fotka_id: a.source_fotka_id ?? null,
    original_filename: a.original_filename,
    size_bytes: a.size_bytes ?? null,
  });
  const keysB = new Set(
    buildPoptavkaFotkaSemanticKeys({
      id: b.id,
      typ: b.typ,
      storage_path: b.storage_path ?? null,
      source_fotka_id: b.source_fotka_id ?? null,
      original_filename: b.original_filename,
      size_bytes: b.size_bytes ?? null,
    })
  );
  return keysA.some((key) => keysB.has(key));
}

export function mergeSectionPhotoStateFromServer(
  current: SectionPhotoState,
  serverSaved: SavedSectionFotka[]
): { state: SectionPhotoState; stats: SectionPhotoSyncStats } {
  const serverDeduped = dedupeSavedSectionFotky(serverSaved);
  const localDeduped = dedupeSavedSectionFotky(current.saved);
  const pendingBefore = current.pending.length;

  const serverOnly = serverDeduped.filter(
    (row) => !localDeduped.some((local) => isSameSavedSectionFotka(local, row))
  );
  const skippedOverwriteCount = serverDeduped.length - serverOnly.length;
  const mergedSaved = dedupeSavedSectionFotky([...localDeduped, ...serverOnly]);

  return {
    state: {
      pending: current.pending,
      saved: mergedSaved,
    },
    stats: {
      pendingBefore,
      localSavedBefore: localDeduped.length,
      serverSavedCount: serverDeduped.length,
      mergedSavedCount: mergedSaved.length,
      skippedOverwriteCount,
      pendingAfter: current.pending.length,
    },
  };
}

export function logSectionPhotoSync(scope: string, stats: SectionPhotoSyncStats) {
  console.info(`[poptavka fotky sync] ${scope}`, stats);
}
