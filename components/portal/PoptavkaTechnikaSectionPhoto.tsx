"use client";

import { useRef, useState } from "react";
import PoptavkaFotkaImage from "@/components/portal/PoptavkaFotkaImage";
import {
  POPTAVKA_FOTKY_ACCEPT,
  POPTAVKA_FOTKA_TYP_LABELS,
} from "@/lib/client-portal/poptavka-fotky-shared";
import { preparePhotoFileForUpload } from "@/lib/photos/prepare-photo-upload-client";
import {
  PHOTO_TECHNICAL_CAPTURE_HINT,
  PHOTO_UPLOAD_INFO_TEXT,
} from "@/lib/photos/upload-limits";
import type { TechnikaSectionPhotoKey } from "@/lib/client-portal/poptavka-technika-podminky";
import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";
import {
  emptySectionPhotoState,
  type PendingPhoto,
  type SectionPhotoState,
} from "@/lib/client-portal/poptavka-section-photo-state";

export type { PendingPhoto, SectionPhotoState };
export { emptySectionPhotoState };

export default function PoptavkaTechnikaSectionPhoto({
  sectionKey,
  typ,
  captureLabel,
  uploadLabel,
  poptavkaId,
  readOnly,
  state,
  onPendingChange,
  onPendingPhotosAdded,
}: {
  sectionKey: TechnikaSectionPhotoKey;
  typ: PoptavkaFotkaTyp;
  captureLabel: string;
  uploadLabel: string;
  poptavkaId?: string;
  readOnly?: boolean;
  state: SectionPhotoState;
  onPendingChange: (next: SectionPhotoState) => void;
  onPendingPhotosAdded?: (photos: PendingPhoto[]) => void;
}) {
  const captureInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files || readOnly) return;
    setError(null);
    setProcessing(true);

    const nextPending = [...state.pending];
    const added: PendingPhoto[] = [];

    try {
      for (const file of Array.from(files)) {
        const prepared = await preparePhotoFileForUpload(file);
        if (!prepared.ok) {
          setError(prepared.message);
          continue;
        }

        const fileToUse = prepared.file;
        const photo: PendingPhoto = {
          id: `${sectionKey}-${fileToUse.name}-${fileToUse.size}-${crypto.randomUUID()}`,
          file: fileToUse,
          previewUrl: URL.createObjectURL(fileToUse),
          status: "pending",
        };
        nextPending.push(photo);
        added.push(photo);
      }

      if (added.length > 0) {
        onPendingChange({ ...state, pending: nextPending });
        onPendingPhotosAdded?.(added);
      }
    } finally {
      setProcessing(false);
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

  function retryPending(photo: PendingPhoto) {
    const nextPending = state.pending.map((row) =>
      row.id === photo.id
        ? { ...row, status: "pending" as const, errorMessage: undefined }
        : row
    );
    onPendingChange({ ...state, pending: nextPending });
    onPendingPhotosAdded?.([{ ...photo, status: "pending", errorMessage: undefined }]);
  }

  const hasPhotos = state.pending.length > 0 || state.saved.length > 0;
  const actionButtonClass =
    "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-amber-500/40 hover:bg-white/[0.04]";

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      {!readOnly ? (
        <>
          <p className="text-[11px] leading-relaxed text-slate-500">{PHOTO_UPLOAD_INFO_TEXT}</p>
          <p className="text-[11px] leading-relaxed text-slate-500">{PHOTO_TECHNICAL_CAPTURE_HINT}</p>
        </>
      ) : null}
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={actionButtonClass}
            disabled={processing}
            onClick={() => captureInputRef.current?.click()}
          >
            {captureLabel}
          </button>
          <button
            type="button"
            className={actionButtonClass}
            disabled={processing}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploadLabel}
          </button>
          <input
            ref={captureInputRef}
            type="file"
            accept={POPTAVKA_FOTKY_ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept={POPTAVKA_FOTKY_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </div>
      ) : null}

      {processing ? (
        <p className="text-xs text-blue-200/80">Zpracovávám fotku…</p>
      ) : null}

      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      {state.pending.length > 0 || state.saved.length > 0 ? (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {state.pending.map((photo) => (
            <div
              key={photo.id}
              className={`relative overflow-hidden rounded-lg border ${
                photo.status === "failed"
                  ? "border-red-500/50"
                  : photo.status === "uploading"
                    ? "border-amber-500/50"
                    : "border-white/10"
              }`}
            >
              <img
                src={photo.previewUrl}
                alt={photo.file.name}
                className={`aspect-square w-full bg-black/20 object-contain ${
                  photo.status === "uploading" ? "opacity-60" : ""
                }`}
                loading="lazy"
                decoding="async"
              />
              {photo.status === "uploading" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-semibold text-amber-100">
                  Ukládám…
                </div>
              ) : null}
              {photo.status === "failed" ? (
                <div className="absolute inset-x-0 bottom-0 space-y-1 bg-red-950/90 px-1 py-1">
                  <p className="text-[10px] leading-tight text-red-100">
                    {photo.errorMessage ?? "Nepodařilo se uložit"}
                  </p>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => retryPending(photo)}
                      className="text-[10px] font-semibold text-amber-200 hover:text-amber-100"
                    >
                      Zkusit znovu
                    </button>
                  ) : null}
                </div>
              ) : photo.status === "pending" || !photo.status ? (
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[10px] text-slate-200">
                  Čeká na uložení
                </div>
              ) : null}
              {!readOnly && photo.status !== "uploading" ? (
                <button
                  type="button"
                  onClick={() => removePending(photo.id)}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-red-200 hover:bg-black/80"
                >
                  Odebrat
                </button>
              ) : null}
            </div>
          ))}

          {state.saved.map((fotka) => (
            <div key={fotka.id} className="relative overflow-hidden rounded-lg border border-emerald-500/30">
              <PoptavkaFotkaImage
                fotkaId={fotka.id}
                poptavkaId={poptavkaId}
                alt={fotka.original_filename ?? POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
                thumbnailSignedUrl={fotka.thumbnailSignedUrl}
                signedUrl={fotka.signedUrl}
                lazyOriginalFallback={!fotka.thumbnailSignedUrl}
                className="aspect-square w-full bg-black/20 object-contain"
              />
              <div className="absolute inset-x-0 bottom-0 bg-emerald-950/80 px-1 py-0.5 text-[10px] text-emerald-100">
                Uložená
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!readOnly && !poptavkaId && state.pending.length > 0 ? (
        <p className="text-[11px] text-slate-500">
          Po uložení konceptu se fotky nahrávají průběžně na pozadí.
        </p>
      ) : null}
      {!readOnly && poptavkaId && state.pending.some((photo) => photo.status === "uploading") ? (
        <p className="text-[11px] text-blue-200/80">Nahrávám na server…</p>
      ) : null}

      {readOnly && !hasPhotos ? (
        <p className="text-xs text-slate-500">Bez fotky</p>
      ) : null}
    </div>
  );
}
