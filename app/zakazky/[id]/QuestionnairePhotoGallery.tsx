"use client";

import { useState, useTransition } from "react";
import { promoteQuestionnairePhotoToPlaceKnowHowAction } from "@/app/actions/place-technical-photos";

export type QuestionnairePhotoGalleryItem = {
  id: string;
  signedUrl: string | null;
  typ: string | null;
  popis: string | null;
  originalFilename: string | null;
  createdAt: string | null;
};

type PromoteConfig = {
  zakazkaId: string;
  mistoId: string;
};

function formatPhotoType(type: string | null) {
  if (type === "rozvadec") return "Rozvaděč";
  if (type === "prijezd") return "Příjezd";
  if (type === "parkovani") return "Parkování";
  if (type === "prostor") return "Prostor";
  if (type === "jina") return "Jiná";
  return "Jiná";
}

function formatUploadedAt(value: string | null) {
  if (!value) return "Datum není uložené";
  return new Date(value).toLocaleString("cs-CZ");
}

function mapQuestionnaireTypeToPlaceType(type: string | null) {
  if (type === "rozvadec") return "rozvadec";
  if (type === "prijezd") return "prijezd";
  if (type === "parkovani") return "parkovani";
  if (type === "prostor") return "stage";
  return "jina";
}

function placePhotoTypeOptions() {
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

export function QuestionnairePhotoGallery({
  photos,
  promoteConfig,
}: {
  photos: QuestionnairePhotoGalleryItem[];
  promoteConfig?: PromoteConfig | null;
}) {
  const [activePhoto, setActivePhoto] = useState<QuestionnairePhotoGalleryItem | null>(null);
  const [promotePhoto, setPromotePhoto] = useState<QuestionnairePhotoGalleryItem | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function openPromoteModal(photo: QuestionnairePhotoGalleryItem) {
    setMessage(null);
    setPromotePhoto(photo);
  }

  function handlePromoteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!promotePhoto || !promoteConfig) return;

    const source = new FormData(event.currentTarget);
    const formData = new FormData();
    formData.append("questionnaire_photo_id", promotePhoto.id);
    formData.append("zakazka_id", promoteConfig.zakazkaId);
    formData.append("misto_id", promoteConfig.mistoId);
    formData.append("typ", String(source.get("typ") ?? ""));
    formData.append("popis", String(source.get("popis") ?? ""));
    if (source.get("dulezite") === "on") {
      formData.append("dulezite", "on");
    }

    startTransition(async () => {
      try {
        const result = await promoteQuestionnairePhotoToPlaceKnowHowAction(formData);
        if (result.ok) {
          setPromotePhoto(null);
          setMessage({ type: "success", text: "Fotka byla uložená do know-how místa jako samostatná kopie." });
          return;
        }

        setMessage({
          type: "error",
          text: result.errorMessage || "Uložení do know-how místa se nepodařilo.",
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Uložení do know-how místa se nepodařilo.",
        });
      }
    });
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
        Klient k dotazníku zatím nepřiložil žádné fotky.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm font-semibold",
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
              : "border-red-500/40 bg-red-950/20 text-red-200",
          ].join(" ")}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo) => (
          <div
            key={photo.id}
            className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 transition hover:border-blue-500/70"
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
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-3 text-center text-xs text-slate-500">
                    Náhled se nepodařilo připravit
                  </div>
                )}
              </div>
            </button>

            <div className="space-y-2 p-3">
              <div className="text-sm font-black text-white">{formatPhotoType(photo.typ)}</div>
              {photo.popis ? (
                <div className="line-clamp-2 text-xs leading-relaxed text-slate-300">{photo.popis}</div>
              ) : null}
              <div className="text-xs text-slate-500">{formatUploadedAt(photo.createdAt)}</div>
              {promoteConfig ? (
                <button
                  type="button"
                  onClick={() => openPromoteModal(photo)}
                  disabled={isPending}
                  className="w-full rounded-xl border border-emerald-500/40 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Uložit do know-how místa
                </button>
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
          aria-label="Náhled fotky z dotazníku"
          onClick={() => setActivePhoto(null)}
        >
          <div
            className="max-h-full w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-[#0b1324] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-4 py-3 sm:px-5">
              <div>
                <div className="text-lg font-black text-white">{formatPhotoType(activePhoto.typ)}</div>
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

            <div className="space-y-3 px-4 py-3 text-sm text-slate-300 sm:px-5">
              {activePhoto.popis ? <div>{activePhoto.popis}</div> : null}
              {activePhoto.originalFilename ? (
                <div className="text-xs text-slate-500">{activePhoto.originalFilename}</div>
              ) : null}
              {promoteConfig ? (
                <button
                  type="button"
                  onClick={() => {
                    setActivePhoto(null);
                    openPromoteModal(activePhoto);
                  }}
                  disabled={isPending}
                  className="rounded-xl border border-emerald-500/40 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Uložit do know-how místa
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {promotePhoto && promoteConfig ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Uložit fotku do know-how místa"
          onClick={() => {
            if (!isPending) setPromotePhoto(null);
          }}
        >
          <form
            key={promotePhoto.id}
            onSubmit={handlePromoteSubmit}
            className="w-full max-w-xl rounded-3xl border border-slate-700 bg-[#0b1324] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xl font-black text-white">Uložit do know-how místa</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Vznikne samostatná kopie interní fotky místa. Původní fotka v dotazníku zůstane beze změny.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPromotePhoto(null)}
                disabled={isPending}
                className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Zavřít
              </button>
            </div>

            {message?.type === "error" ? (
              <div className="mt-4 rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
                {message.text}
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
              {promotePhoto.signedUrl ? (
                <img
                  src={promotePhoto.signedUrl}
                  alt={promotePhoto.popis || formatPhotoType(promotePhoto.typ)}
                  className="h-32 w-full rounded-2xl object-cover sm:w-32"
                />
              ) : (
                <div className="flex h-32 rounded-2xl bg-slate-950 px-3 text-center text-xs text-slate-500">
                  Náhled není dostupný
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-200">
                  Typ fotky
                  <select
                    name="typ"
                    defaultValue={mapQuestionnaireTypeToPlaceType(promotePhoto.typ)}
                    className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                  >
                    {placePhotoTypeOptions().map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-slate-200">
                  Popis
                  <textarea
                    name="popis"
                    className="mt-2 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                    placeholder="Volitelný interní popis pro know-how místa"
                  />
                </label>

                <label className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-100">
                  <input type="checkbox" name="dulezite" />
                  <span>Označit jako důležité</span>
                </label>
              </div>
            </div>

            <button
              disabled={isPending}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? "Ukládám..." : "Uložit kopii do know-how místa"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
