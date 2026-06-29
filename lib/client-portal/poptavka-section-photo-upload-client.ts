"use client";

import { TECHNIKA_SECTION_PHOTOS } from "@/lib/client-portal/poptavka-technika-podminky";
import type { TechnikaSectionPhotoKey } from "@/lib/client-portal/poptavka-technika-podminky";
import type { PoptavkaFotkaWithUrl } from "@/lib/client-portal/poptavka-fotky-shared";
import {
  emptySectionPhotoState,
  type PendingPhoto,
  type SectionPhotoState,
} from "@/lib/client-portal/poptavka-section-photo-state";
import { mergeSavedSectionFotky } from "@/lib/client-portal/poptavka-fotky-dedup";

export type PendingSectionPhoto = PendingPhoto;

export type SectionPhotoUploadItemResult =
  | { ok: true; clientId: string; fotka: PoptavkaFotkaWithUrl }
  | { ok: false; clientId: string; code: string; message: string };

export type SectionPhotoUploadResult = {
  uploaded: Extract<SectionPhotoUploadItemResult, { ok: true }>[];
  errors: Extract<SectionPhotoUploadItemResult, { ok: false }>[];
  hadPending: boolean;
};

export type AllSectionsPhotoUploadResult = {
  bySection: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoUploadResult>>;
  totalUploaded: number;
  totalErrors: number;
  anyPendingRemaining: boolean;
};

type UploadApiResponse = {
  ok: boolean;
  uploaded?: Array<{ clientId: string | null; fotka: PoptavkaFotkaWithUrl }>;
  errors?: Array<{ clientId: string | null; code: string; message: string }>;
  error?: string;
};

type PendingUploadTask = {
  sectionKey: TechnikaSectionPhotoKey;
  typ: string;
  photo: PendingSectionPhoto;
};

const UPLOAD_CONCURRENCY = 3;

async function uploadSectionPhotosViaApi(
  poptavkaId: string,
  sectionKey: TechnikaSectionPhotoKey,
  typ: string,
  photos: PendingSectionPhoto[]
): Promise<SectionPhotoUploadResult> {
  if (photos.length === 0) {
    return { uploaded: [], errors: [], hadPending: false };
  }

  const formData = new FormData();
  formData.set("poptavka_id", poptavkaId);
  for (const photo of photos) {
    formData.append("photo_files", photo.file, photo.file.name);
    formData.append("photo_types", typ);
    formData.append("photo_descriptions", "");
    formData.append("photo_client_ids", photo.id);
  }

  const response = await fetch("/api/portal/poptavka-fotky/upload", {
    method: "POST",
    body: formData,
  });

  let payload: UploadApiResponse;
  try {
    payload = (await response.json()) as UploadApiResponse;
  } catch {
    return {
      hadPending: true,
      uploaded: [],
      errors: photos.map((photo) => ({
        ok: false as const,
        clientId: photo.id,
        code: "upload_failed",
        message: "Nahrání fotky se nezdařilo.",
      })),
    };
  }

  if (!response.ok && !payload.uploaded?.length) {
    const message =
      payload.error === "no_files"
        ? "Soubor se na server nedostal. Zkuste nahrát znovu."
        : "Nahrání fotky se nezdařilo.";
    return {
      hadPending: true,
      uploaded: [],
      errors: photos.map((photo) => ({
        ok: false as const,
        clientId: photo.id,
        code: payload.error ?? "upload_failed",
        message,
      })),
    };
  }

  const uploaded: SectionPhotoUploadResult["uploaded"] = [];
  const errors: SectionPhotoUploadResult["errors"] = [];

  for (const row of payload.uploaded ?? []) {
    if (!row.clientId) continue;
    uploaded.push({ ok: true, clientId: row.clientId, fotka: row.fotka });
  }

  for (const row of payload.errors ?? []) {
    if (!row.clientId) continue;
    errors.push({
      ok: false,
      clientId: row.clientId,
      code: row.code,
      message: row.message,
    });
  }

  const handled = new Set([
    ...uploaded.map((row) => row.clientId),
    ...errors.map((row) => row.clientId),
  ]);
  for (const photo of photos) {
    if (handled.has(photo.id)) continue;
    errors.push({
      ok: false,
      clientId: photo.id,
      code: "upload_failed",
      message: "Nahrání fotky se nezdařilo.",
    });
  }

  return { hadPending: true, uploaded, errors };
}

async function uploadSinglePhotoViaApi(
  poptavkaId: string,
  sectionKey: TechnikaSectionPhotoKey,
  typ: string,
  photo: PendingSectionPhoto
): Promise<SectionPhotoUploadResult> {
  return uploadSectionPhotosViaApi(poptavkaId, sectionKey, typ, [photo]);
}

function mergeSectionResult(
  current: SectionPhotoUploadResult | undefined,
  next: SectionPhotoUploadResult
): SectionPhotoUploadResult {
  if (!current) return next;
  return {
    hadPending: current.hadPending || next.hadPending,
    uploaded: [...current.uploaded, ...next.uploaded],
    errors: [...current.errors, ...next.errors],
  };
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  onTaskDone?: () => void
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
      onTaskDone?.();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function uploadPendingSectionPhotosForPoptavka(
  poptavkaId: string,
  pendingBySection: Partial<Record<TechnikaSectionPhotoKey, PendingSectionPhoto[]>>,
  options?: {
    onPhotoUploaded?: (uploaded: number, total: number) => void;
  }
): Promise<AllSectionsPhotoUploadResult> {
  const bySection: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoUploadResult>> = {};
  let totalUploaded = 0;
  let totalErrors = 0;

  const tasks: PendingUploadTask[] = [];
  for (const section of TECHNIKA_SECTION_PHOTOS) {
    const photos = (pendingBySection[section.key] ?? []).filter(
      (photo) => photo.status !== "uploading" && photo.status !== "failed"
    );
    for (const photo of photos) {
      tasks.push({ sectionKey: section.key, typ: section.typ, photo });
    }
  }

  const total = tasks.length;
  let uploadedCount = 0;

  await runWithConcurrency(
    tasks.map((task) => async () => {
      const result = await uploadSinglePhotoViaApi(
        poptavkaId,
        task.sectionKey,
        task.typ,
        task.photo
      );
      bySection[task.sectionKey] = mergeSectionResult(bySection[task.sectionKey], result);
      totalUploaded += result.uploaded.length;
      totalErrors += result.errors.length;
      if (result.uploaded.length > 0) {
        uploadedCount += result.uploaded.length;
        options?.onPhotoUploaded?.(uploadedCount, total);
      }
      return result;
    }),
    UPLOAD_CONCURRENCY
  );

  const anyPendingRemaining = Object.values(pendingBySection).some(
    (photos) => (photos?.length ?? 0) > 0
  );

  return {
    bySection,
    totalUploaded,
    totalErrors,
    anyPendingRemaining,
  };
}

export async function uploadSinglePendingSectionPhoto(
  poptavkaId: string,
  sectionKey: TechnikaSectionPhotoKey,
  typ: string,
  photo: PendingSectionPhoto
): Promise<SectionPhotoUploadResult> {
  return uploadSinglePhotoViaApi(poptavkaId, sectionKey, typ, photo);
}

export function applySectionPhotoUploadResults(
  current: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>>,
  uploadResults: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoUploadResult>>
): Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>> {
  const next = { ...current };

  for (const section of TECHNIKA_SECTION_PHOTOS) {
    const result = uploadResults[section.key];
    if (!result) continue;

    const state = next[section.key] ?? emptySectionPhotoState();
    const uploadedIds = new Set(result.uploaded.map((row) => row.clientId));
    const errorByClientId = new Map(
      result.errors.map((row) => [row.clientId, row.message] as const)
    );

    const remainingPending = state.pending
      .filter((photo) => !uploadedIds.has(photo.id))
      .map((photo) => {
        const errorMessage = errorByClientId.get(photo.id);
        if (!errorMessage) return photo;
        return {
          ...photo,
          status: "failed" as const,
          errorMessage,
        };
      });

    for (const photo of state.pending) {
      if (uploadedIds.has(photo.id)) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    }

    next[section.key] = {
      pending: remainingPending,
      saved: mergeSavedSectionFotky(
        state.saved,
        result.uploaded.map((row) => ({
          id: row.fotka.id,
          typ: row.fotka.typ,
          popis: row.fotka.popis,
          original_filename: row.fotka.original_filename,
          thumbnailSignedUrl: row.fotka.thumbnailSignedUrl,
          signedUrl: row.fotka.signedUrl,
        }))
      ),
    };
  }

  return next;
}

export function markPendingPhotosUploading(
  current: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>>,
  pendingBySection: Partial<Record<TechnikaSectionPhotoKey, PendingSectionPhoto[]>>
): Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>> {
  const next = { ...current };

  for (const [key, photos] of Object.entries(pendingBySection)) {
    if (!photos?.length) continue;
    const sectionKey = key as TechnikaSectionPhotoKey;
    const state = next[sectionKey] ?? emptySectionPhotoState();
    const uploadingIds = new Set(photos.map((photo) => photo.id));
    next[sectionKey] = {
      ...state,
      pending: state.pending.map((photo) =>
        uploadingIds.has(photo.id)
          ? { ...photo, status: "uploading" as const, errorMessage: undefined }
          : photo
      ),
    };
  }

  return next;
}

export function collectPendingPhotosBySection(
  sectionPhotos: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>>
): Partial<Record<TechnikaSectionPhotoKey, PendingSectionPhoto[]>> {
  const pendingBySection: Partial<Record<TechnikaSectionPhotoKey, PendingSectionPhoto[]>> = {};

  for (const [key, state] of Object.entries(sectionPhotos)) {
    const uploadable = (state?.pending ?? []).filter(
      (photo) => photo.status !== "uploading" && photo.status !== "failed"
    );
    if (uploadable.length) {
      pendingBySection[key as TechnikaSectionPhotoKey] = uploadable;
    }
  }

  return pendingBySection;
}

export function countPendingUploadablePhotos(
  sectionPhotos: Partial<Record<TechnikaSectionPhotoKey, SectionPhotoState>>
) {
  return Object.values(collectPendingPhotosBySection(sectionPhotos)).reduce(
    (sum, photos) => sum + (photos?.length ?? 0),
    0
  );
}
