"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  getPhotoExtension,
  mapStorageUploadErrorMessage,
  PHOTO_UPLOAD_ACCEPT,
  PHOTO_UPLOAD_INFO_TEXT,
  PHOTO_UPLOAD_SIZE_MESSAGE,
  validatePhotoUploadFile,
} from "@/lib/photos/upload-limits";
import { uploadPlaceTechnicalPhotosAction } from "@/app/actions/place-technical-photos";

export type PlaceTechnicalPhotoGalleryItem = {
  id: string;
  signedUrl: string | null;
  typ: string | null;
  popis: string | null;
  dulezite: boolean | null;
  originalFilename: string | null;
  createdAt: string | null;
  authorLabel: string;
  zakazkaId: string | null;
  zakazkaLabel: string | null;
};

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  typ: string;
  popis: string;
  dulezite: boolean;
};

function fieldClassName() {
  return "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white";
}

function formatPhotoType(type: string | null) {
  if (type === "rozvadec") return "Rozvaděč";
  if (type === "prijezd") return "Příjezd";
  if (type === "parkovani") return "Parkování";
  if (type === "kabel") return "Kabelová trasa";
  if (type === "stage") return "Stage prostor";
  if (type === "omezeni") return "Omezení";
  if (type === "problem") return "Problém";
  if (type === "jina") return "Jiná";
  return "Jiná";
}

function formatUploadedAt(value: string | null) {
  if (!value) return "Datum není uložené";
  return new Date(value).toLocaleString("cs-CZ");
}

function photoTypeOptions() {
  return [
    ["rozvadec", "Rozvaděč"],
    ["prijezd", "Příjezd"],
    ["parkovani", "Parkování"],
    ["kabel", "Kabelová trasa"],
    ["stage", "Stage prostor"],
    ["omezeni", "Omezení"],
    ["problem", "Problém"],
    ["jina", "Jiná"],
  ];
}

export function PlaceTechnicalPhotoUpload({
  mistoId,
  currentZakazkaId,
}: {
  mistoId: string;
  currentZakazkaId?: string | null;
}) {
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const photosRef = useRef<SelectedPhoto[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  const totalPhotoSize = useMemo(
    () => photos.reduce((total, photo) => total + photo.file.size, 0),
    [photos]
  );

  function addPhotos(files: FileList | null) {
    if (!files) return;

    setPhotoError(null);
    const nextPhotos: SelectedPhoto[] = [];

    for (const file of Array.from(files)) {
      const validation = validatePhotoUploadFile(file);
      if (!validation.ok) {
        setPhotoError(validation.message);
        continue;
      }

      nextPhotos.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        typ: "rozvadec",
        popis: "",
        dulezite: false,
      });
    }

    if (nextPhotos.length > 0) {
      setPhotos((current) => [...current, ...nextPhotos]);
    }
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((photo) => photo.id !== id);
    });
  }

  function updatePhoto(id: string, patch: Partial<Pick<SelectedPhoto, "typ" | "popis" | "dulezite">>) {
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo))
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const formData = new FormData();
    formData.append("misto_id", mistoId);
    if (currentZakazkaId) {
      formData.append("zakazka_id", currentZakazkaId);
    }

    for (const photo of photos) {
      formData.append("photo_files", photo.file, photo.file.name);
      formData.append("photo_types", photo.typ);
      formData.append("photo_descriptions", photo.popis);
      formData.append("photo_important", photo.dulezite ? "true" : "false");
    }

    startTransition(async () => {
      try {
        const result = await uploadPlaceTechnicalPhotosAction(formData);
        if (result.ok) {
          window.location.reload();
          return;
        }

        setSubmitError(result.errorMessage || "Nahrání se nepodařilo. Zkuste to prosím znovu.");
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "Nahrání se nepodařilo. Zkuste to prosím znovu."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div>
        <div className="text-base font-bold text-white">Nahrát interní fotky místa</div>
        <p className="mt-1 text-sm text-slate-400">
          Fotky se uloží jako dlouhodobé know-how místa. Nepropisují se do klientských dotazníků ani
          snapshotů zakázek. {PHOTO_UPLOAD_INFO_TEXT}
        </p>
      </div>

      <label className="block rounded-2xl border border-dashed border-slate-600 bg-slate-950 px-4 py-5 text-center text-sm font-semibold text-slate-200">
        Vybrat fotky
        <input
          type="file"
          accept={PHOTO_UPLOAD_ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            addPhotos(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </label>

      {photoError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {photoError}
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="space-y-3">
          <div className="text-xs text-slate-400">
            Vybráno {photos.length} fotek, celkem {(totalPhotoSize / 1024 / 1024).toFixed(1)} MB.
          </div>

          {photos.map((photo) => (
            <div key={photo.id} className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
              <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
                <img
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  className="h-28 w-full rounded-xl bg-black/20 object-contain sm:w-28"
                />
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-white">{photo.file.name}</div>
                  <div className="text-xs text-slate-400">{(photo.file.size / 1024 / 1024).toFixed(1)} MB</div>
                  <select
                    value={photo.typ}
                    onChange={(event) => updatePhoto(photo.id, { typ: event.target.value })}
                    className={fieldClassName()}
                  >
                    {photoTypeOptions().map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={photo.popis}
                    onChange={(event) => updatePhoto(photo.id, { popis: event.target.value })}
                    className={fieldClassName()}
                    placeholder="Volitelný popis fotky"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-sm font-semibold text-amber-100">
                      <input
                        type="checkbox"
                        checked={photo.dulezite}
                        onChange={(event) => updatePhoto(photo.id, { dulezite: event.target.checked })}
                      />
                      <span>Důležité</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="rounded-xl border border-red-500/40 px-3 py-2 text-sm font-semibold text-red-200"
                    >
                      Odebrat fotku
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {submitError}
        </div>
      ) : null}

      <button
        disabled={isPending || photos.length === 0}
        className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Nahrávám..." : "Nahrát fotky"}
      </button>
    </form>
  );
}

export function PlaceTechnicalPhotoGallery({ photos }: { photos: PlaceTechnicalPhotoGalleryItem[] }) {
  const [activePhoto, setActivePhoto] = useState<PlaceTechnicalPhotoGalleryItem | null>(null);

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
        K tomuto místu zatím nejsou uložené žádné interní technické fotky.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={[
              "overflow-hidden rounded-2xl border bg-slate-950",
              photo.dulezite ? "border-amber-500/60" : "border-slate-700",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => setActivePhoto(photo)}
              className="group block w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900">
                {photo.signedUrl ? (
                  <img
                    src={photo.signedUrl}
                    alt={photo.popis || formatPhotoType(photo.typ)}
                    loading="lazy"
                    className="h-full w-full bg-black/20 object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-500">
                    Náhled se nepodařilo připravit
                  </div>
                )}
              </div>
            </button>
            <div className="space-y-1 p-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg border border-blue-500/30 bg-blue-950/30 px-2 py-1 text-xs font-black text-blue-100">
                  {formatPhotoType(photo.typ)}
                </span>
                {photo.dulezite ? (
                  <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-2 py-1 text-xs font-black text-amber-100">
                    Důležité
                  </span>
                ) : null}
              </div>
              {photo.popis ? (
                <div className="line-clamp-2 text-xs leading-relaxed text-slate-300">{photo.popis}</div>
              ) : null}
              <div className="text-xs text-slate-500">{formatUploadedAt(photo.createdAt)}</div>
              <div className="text-xs text-slate-500">Autor: {photo.authorLabel}</div>
              {photo.zakazkaId && photo.zakazkaLabel ? (
                <Link
                  href={`/zakazky/${photo.zakazkaId}`}
                  className="inline-flex text-xs font-semibold text-blue-200 hover:text-blue-100 hover:underline"
                >
                  {photo.zakazkaLabel}
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {activePhoto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Náhled interní fotky místa"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="max-h-full w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1324] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-3 sm:px-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-lg font-black text-white">{formatPhotoType(activePhoto.typ)}</div>
                  {activePhoto.dulezite ? (
                    <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-2 py-1 text-xs font-black text-amber-100">
                      Důležité
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-xs text-slate-400">{formatUploadedAt(activePhoto.createdAt)}</div>
              </div>
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                Zavřít
              </button>
            </div>

            <div className="max-h-[72vh] overflow-auto bg-black">
              {activePhoto.signedUrl ? (
                <img
                  src={activePhoto.signedUrl}
                  alt={activePhoto.popis || formatPhotoType(activePhoto.typ)}
                  className="mx-auto h-auto max-h-[72vh] w-auto max-w-full object-contain"
                />
              ) : (
                <div className="flex min-h-64 items-center justify-center px-6 text-center text-slate-400">
                  Náhled se nepodařilo připravit. Obnovte stránku a zkuste to znovu.
                </div>
              )}
            </div>

            <div className="space-y-1 px-4 py-3 text-sm text-slate-300 sm:px-5">
              {activePhoto.popis ? <div>{activePhoto.popis}</div> : null}
              <div className="text-xs text-slate-500">Autor: {activePhoto.authorLabel}</div>
              {activePhoto.originalFilename ? (
                <div className="text-xs text-slate-500">{activePhoto.originalFilename}</div>
              ) : null}
              {activePhoto.zakazkaId && activePhoto.zakazkaLabel ? (
                <Link
                  href={`/zakazky/${activePhoto.zakazkaId}`}
                  className="inline-flex text-xs font-semibold text-blue-200 hover:text-blue-100 hover:underline"
                >
                  {activePhoto.zakazkaLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
