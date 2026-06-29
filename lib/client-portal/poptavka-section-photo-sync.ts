import { dedupeSavedSectionFotky } from "@/lib/client-portal/poptavka-fotky-dedup";
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

export function mergeSectionPhotoStateFromServer(
  current: SectionPhotoState,
  serverSaved: SavedSectionFotka[]
): { state: SectionPhotoState; stats: SectionPhotoSyncStats } {
  const serverDeduped = dedupeSavedSectionFotky(serverSaved);
  const localDeduped = dedupeSavedSectionFotky(current.saved);
  const pendingBefore = current.pending.length;

  const savedById = new Map<string, SavedSectionFotka>();
  let skippedOverwriteCount = 0;

  for (const row of localDeduped) {
    savedById.set(row.id, row);
  }

  for (const row of serverDeduped) {
    const existing = savedById.get(row.id);
    if (!existing) {
      savedById.set(row.id, row);
      continue;
    }

    skippedOverwriteCount += 1;
    savedById.set(row.id, {
      ...existing,
      popis: existing.popis ?? row.popis,
      original_filename: existing.original_filename ?? row.original_filename,
      thumbnailSignedUrl: existing.thumbnailSignedUrl ?? row.thumbnailSignedUrl,
      signedUrl: existing.signedUrl ?? row.signedUrl,
    });
  }

  const mergedSaved = dedupeSavedSectionFotky(Array.from(savedById.values()));
  const pending = current.pending;

  return {
    state: {
      pending,
      saved: mergedSaved,
    },
    stats: {
      pendingBefore,
      localSavedBefore: localDeduped.length,
      serverSavedCount: serverDeduped.length,
      mergedSavedCount: mergedSaved.length,
      skippedOverwriteCount,
      pendingAfter: pending.length,
    },
  };
}

export function logSectionPhotoSync(scope: string, stats: SectionPhotoSyncStats) {
  console.info(`[poptavka fotky sync] ${scope}`, stats);
}
