"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deletePoptavkaFotkaAction,
  uploadPoptavkaFotkyAction,
} from "@/app/portal/poptavky/actions";
import {
  POPTAVKA_FOTKY_ACCEPT,
  POPTAVKA_FOTKA_TYP_LABELS,
  validatePoptavkaPhotoFile,
} from "@/lib/client-portal/poptavka-fotky-shared";
import { appendClientPhotoThumbnailToFormData } from "@/lib/client-portal/poptavka-fotky-thumbnail-client";
import type { PoptavkaFotkaTyp } from "@/lib/client-portal/types";
import { POPTAVKA_FOTKA_TYPY } from "@/lib/client-portal/types";

type FotkaRow = {
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
  typ: PoptavkaFotkaTyp;
  popis: string;
};

const UPLOAD_ERRORS: Record<string, string> = {
  invalid_type: "Povolené formáty: JPG, PNG, WebP, HEIC.",
  upload_failed: "Nahrání fotek se nezdařilo.",
  no_files: "Vyberte alespoň jednu fotku.",
  not_editable: "Poptávku už nelze upravovat.",
};

export default function PoptavkaFotkyClient({
  poptavkaId,
  initialFotky,
  readOnly = false,
}: {
  poptavkaId: string;
  initialFotky: FotkaRow[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [fotky, setFotky] = useState(initialFotky);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none ring-amber-500/40 focus:ring-2";

  function addPending(files: FileList | null) {
    if (!files || readOnly) return;
    setError(null);

    const next: PendingPhoto[] = [];
    for (const file of Array.from(files)) {
      const validation = validatePoptavkaPhotoFile(file);
      if (!validation.ok) {
        setError(validation.message);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        typ: "misto_akce",
        popis: "",
      });
    }

    if (next.length) {
      setPending((current) => [...current, ...next]);
    }
  }

  function removePending(id: string) {
    setPending((current) => {
      const removed = current.find((row) => row.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((row) => row.id !== id);
    });
  }

  function uploadPending() {
    if (!pending.length || readOnly) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("poptavka_id", poptavkaId);
      for (const photo of pending) {
        formData.append("photo_files", photo.file, photo.file.name);
        formData.append("photo_types", photo.typ);
        formData.append("photo_descriptions", photo.popis);
        formData.append("photo_client_ids", photo.id);
        await appendClientPhotoThumbnailToFormData(formData, photo.id, photo.file);
      }

      const result = await uploadPoptavkaFotkyAction(formData);
      if (!result.ok) {
        setError(UPLOAD_ERRORS[result.error ?? ""] ?? UPLOAD_ERRORS.upload_failed);
        return;
      }

      for (const photo of pending) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      setPending([]);
      router.refresh();
    });
  }

  function deleteFotka(fotkaId: string) {
    if (readOnly) return;

    const formData = new FormData();
    formData.set("poptavka_id", poptavkaId);
    formData.set("fotka_id", fotkaId);

    startTransition(async () => {
      const result = await deletePoptavkaFotkaAction(formData);
      if (!result.ok) {
        setError("Smazání fotky se nezdařilo.");
        return;
      }
      setFotky((current) => current.filter((row) => row.id !== fotkaId));
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">5. Fotografie místa</h2>
        <p className="mt-1 text-sm text-slate-400">
          Přiložte fotky rozvaděče, příjezdu, plochy pro stage nebo místa akce.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </p>
      ) : null}

      {!readOnly ? (
        <label className="block cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-5 text-center text-sm font-semibold text-slate-200 transition hover:border-amber-500/40 hover:bg-white/[0.04]">
          Vybrat fotky
          <input
            type="file"
            accept={POPTAVKA_FOTKY_ACCEPT}
            multiple
            className="sr-only"
            onChange={(event) => {
              addPending(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : null}

      {pending.length > 0 && !readOnly ? (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Připraveno k nahrání: {pending.length}</p>
          {pending.map((photo) => (
            <div
              key={photo.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                <img
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  className="h-24 w-full rounded-lg object-cover sm:w-24"
                />
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white">{photo.file.name}</div>
                  <select
                    value={photo.typ}
                    onChange={(event) =>
                      setPending((current) =>
                        current.map((row) =>
                          row.id === photo.id
                            ? { ...row, typ: event.target.value as PoptavkaFotkaTyp }
                            : row
                        )
                      )
                    }
                    className={inputClass}
                  >
                    {POPTAVKA_FOTKA_TYPY.map((typ) => (
                      <option key={typ} value={typ}>
                        {POPTAVKA_FOTKA_TYP_LABELS[typ]}
                      </option>
                    ))}
                  </select>
                  <input
                    value={photo.popis}
                    onChange={(event) =>
                      setPending((current) =>
                        current.map((row) =>
                          row.id === photo.id ? { ...row, popis: event.target.value } : row
                        )
                      )
                    }
                    className={inputClass}
                    placeholder="Volitelný popis"
                  />
                  <button
                    type="button"
                    onClick={() => removePending(photo.id)}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Odebrat
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={isPending}
            onClick={uploadPending}
            className="rounded-xl border border-amber-500/60 bg-amber-500/20 px-4 py-2.5 text-sm font-bold text-amber-50 disabled:opacity-60"
          >
            {isPending ? "Nahrávám…" : "Nahrát fotky"}
          </button>
        </div>
      ) : null}

      {fotky.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {fotky.map((fotka) => (
            <li
              key={fotka.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
            >
              {fotka.signedUrl ? (
                <img
                  src={fotka.signedUrl}
                  alt={fotka.original_filename ?? POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-slate-500">
                  Náhled nedostupný
                </div>
              )}
              <div className="space-y-1 px-3 py-3 text-sm">
                <div className="font-medium text-white">
                  {POPTAVKA_FOTKA_TYP_LABELS[fotka.typ]}
                </div>
                {fotka.popis ? <div className="text-slate-400">{fotka.popis}</div> : null}
                {!readOnly ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => deleteFotka(fotka.id)}
                    className="text-xs text-red-300 hover:text-red-200"
                  >
                    Smazat
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Zatím nejsou nahrány žádné fotky.</p>
      )}
    </section>
  );
}
