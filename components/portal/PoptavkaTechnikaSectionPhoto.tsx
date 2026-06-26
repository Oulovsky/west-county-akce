"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { uploadPoptavkaFotkyAction } from "@/app/portal/poptavky/actions";
import {
  POPTAVKA_FOTKY_ACCEPT,
  POPTAVKA_FOTKY_MAX_SIZE_BYTES,
  POPTAVKA_FOTKA_TYP_LABELS,
} from "@/lib/client-portal/poptavka-fotky-shared";
import type { TechnikaSectionPhotoKey } from "@/lib/client-portal/poptavka-technika-podminky";
import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";

type SavedFotka = {
  id: string;
  typ: PoptavkaFotkaTyp;
  popis: string | null;
  original_filename: string | null;
  signedUrl: string | null;
};

type PendingPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

export type SectionPhotoState = {
  pending: PendingPhoto[];
  saved: SavedFotka[];
};

export function emptySectionPhotoState(): SectionPhotoState {
  return { pending: [], saved: [] };
}

export function appendPendingSectionPhotos(
  formData: FormData,
  pendingBySection: Partial<Record<TechnikaSectionPhotoKey, PendingPhoto[]>>
) {
  for (const [sectionKey, photos] of Object.entries(pendingBySection)) {
    for (const photo of photos ?? []) {
      formData.append(`technicke_foto_${sectionKey}`, photo.file, photo.file.name);
    }
  }
}

export default function PoptavkaTechnikaSectionPhoto({
  sectionKey,
  typ,
  captureLabel,
  poptavkaId,
  readOnly,
  state,
  onPendingChange,
}: {
  sectionKey: TechnikaSectionPhotoKey;
  typ: PoptavkaFotkaTyp;
  captureLabel: string;
  poptavkaId?: string;
  readOnly?: boolean;
  state: SectionPhotoState;
  onPendingChange: (next: SectionPhotoState) => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addFiles(files: FileList | null) {
    if (!files || readOnly) return;
    setError(null);

    const nextPending = [...state.pending];
    for (const file of Array.from(files)) {
      if (!POPTAVKA_FOTKY_ACCEPT.split(",").includes(file.type)) {
        setError("Povolené formáty: JPG, PNG, WebP.");
        continue;
      }
      if (file.size > POPTAVKA_FOTKY_MAX_SIZE_BYTES) {
        setError("Fotka může mít maximálně 10 MB.");
        continue;
      }
      nextPending.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    if (nextPending.length !== state.pending.length) {
      onPendingChange({ ...state, pending: nextPending });
    }
  }

  function removePending(id: string) {
    const removed = state.pending.find((row) => row.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    onPendingChange({
      ...state,
      pending: state.pending.filter((row) => row.id !== id),
    });
  }

  function uploadPending() {
    if (!poptavkaId || !state.pending.length || readOnly) return;

    const formData = new FormData();
    formData.set("poptavka_id", poptavkaId);
    for (const photo of state.pending) {
      formData.append("photo_files", photo.file, photo.file.name);
      formData.append("photo_types", typ);
      formData.append("photo_descriptions", "");
    }

    startTransition(async () => {
      const result = await uploadPoptavkaFotkyAction(formData);
      if (!result.ok) {
        setError("Nahrání fotky se nezdařilo.");
        return;
      }
      for (const photo of state.pending) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      onPendingChange({ ...state, pending: [] });
      router.refresh();
    });
  }

  const hasPhotos = state.pending.length > 0 || state.saved.length > 0;

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      {!readOnly ? (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-500/40 hover:bg-white/[0.04]">
          {captureLabel}
          <input
            type="file"
            accept={POPTAVKA_FOTKY_ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : null}

      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      {state.pending.map((photo) => (
        <div key={photo.id} className="mt-2 flex items-center gap-3">
          <img
            src={photo.previewUrl}
            alt={photo.file.name}
            className="h-16 w-16 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1 text-xs text-slate-300">
            <div className="truncate">{photo.file.name}</div>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => removePending(photo.id)}
                className="mt-1 text-red-300 hover:text-red-200"
              >
                Odebrat
              </button>
            ) : null}
          </div>
        </div>
      ))}

      {state.saved.map((fotka) => (
        <div key={fotka.id} className="mt-2 flex items-center gap-3">
          {fotka.signedUrl ? (
            <img
              src={fotka.signedUrl}
              alt={fotka.original_filename ?? POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/5 text-[10px] text-slate-500">
              Náhled
            </div>
          )}
          <div className="text-xs text-slate-400">
            {POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
          </div>
        </div>
      ))}

      {!readOnly && poptavkaId && state.pending.length > 0 ? (
        <button
          type="button"
          disabled={isPending}
          onClick={uploadPending}
          className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-50 disabled:opacity-60"
        >
          {isPending ? "Nahrávám…" : "Nahrát fotku"}
        </button>
      ) : null}

      {!readOnly && !poptavkaId && state.pending.length > 0 ? (
        <p className="text-[11px] text-slate-500">
          Fotka se nahraje po uložení konceptu.
        </p>
      ) : null}

      {readOnly && !hasPhotos ? (
        <p className="text-xs text-slate-500">Bez fotky</p>
      ) : null}
    </div>
  );
}
