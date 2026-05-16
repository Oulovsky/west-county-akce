"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { submitPublicQuestionnaireAction } from "./actions";

type SelectedPhoto = {
  id: string;
  file: File;
  previewUrl: string;
  typ: string;
  popis: string;
};

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function fieldClassName() {
  return "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white";
}

function optionCardClassName() {
  return "flex gap-2 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200";
}

export function DotaznikFormClient({ token }: { token: string }) {
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
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        setPhotoError("Nahrajte prosím jen fotky JPG, PNG nebo WebP.");
        continue;
      }

      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setPhotoError("Jedna fotka může mít maximálně 10 MB.");
        continue;
      }

      nextPhotos.push({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        typ: "rozvadec",
        popis: "",
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

  function updatePhoto(id: string, patch: Partial<Pick<SelectedPhoto, "typ" | "popis">>) {
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo))
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const source = new FormData(event.currentTarget);
    const formData = new FormData();

    for (const [key, value] of source.entries()) {
      if (key === "photo_input") continue;
      formData.append(key, value);
    }

    for (const photo of photos) {
      formData.append("photo_files", photo.file, photo.file.name);
      formData.append("photo_types", photo.typ);
      formData.append("photo_descriptions", photo.popis);
    }

    startTransition(async () => {
      try {
        const result = await submitPublicQuestionnaireAction(formData);
        if (result.ok) {
          window.location.href = `/dotaznik/${encodeURIComponent(token)}?odeslano=1`;
          return;
        }

        setSubmitError(result.errorMessage || "Odeslání se nepodařilo. Zkuste to prosím znovu.");
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Odeslání se nepodařilo. Zkuste to prosím znovu."
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <input type="hidden" name="token" value={token} />

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-xl font-bold text-white">1. Kontakt na místě</h2>
        <label className="block text-sm font-semibold text-slate-200">
          Jméno kontaktní osoby na místě
          <input
            name="kontakt_jmeno"
            required
            className={fieldClassName()}
            placeholder="Např. Jan Novák"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-200">
          Telefon kontaktní osoby
          <input
            name="kontakt_telefon"
            required
            type="tel"
            className={fieldClassName()}
            placeholder="Např. +420 777 123 456"
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-xl font-bold text-white">2. Příjezd a parkování</h2>

        <div>
          <div className="text-sm font-semibold text-slate-200">
            Lze zajet dodávkou nebo nákladním autem až k místu?
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["ano", "Ano"],
              ["ne", "Ne"],
              ["nevim", "Nevím"],
            ].map(([value, label]) => (
              <label key={value} className={optionCardClassName()}>
                <input type="radio" name="lze_zajet_autem" value={value} defaultChecked={value === "nevim"} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold text-slate-200">Je místo zpevněné?</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["ano", "Ano"],
              ["ne", "Ne"],
              ["nevim", "Nevím"],
            ].map(([value, label]) => (
              <label key={value} className={optionCardClassName()}>
                <input type="radio" name="misto_zpevnene" value={value} defaultChecked={value === "nevim"} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-200">
          Kde lze parkovat?
          <textarea
            name="parkovani_poznamka"
            className={`${fieldClassName()} min-h-24`}
            placeholder="Např. za budovou, na dvoře, u zadního vjezdu..."
          />
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Poznámka k příjezdu
          <textarea
            name="prijezd_poznamka"
            className={`${fieldClassName()} min-h-28`}
            placeholder="Přesný vjezd, brána, areál, backstage, omezení pro auto..."
          />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-xl font-bold text-white">3. Elektro</h2>

        <div>
          <div className="text-sm font-semibold text-slate-200">Je na místě připravená elektro přípojka?</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["ano", "Ano"],
              ["ne", "Ne"],
              ["nevim", "Nevím"],
            ].map(([value, label]) => (
              <label key={value} className={optionCardClassName()}>
                <input type="radio" name="elektro_pripravena" value={value} defaultChecked={value === "nevim"} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-200">
          Jaká přípojka je k dispozici?
          <input
            name="elektro_pripojka"
            className={fieldClassName()}
            placeholder="Např. 32A, 63A, 2×32A, 230V, nevím"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Jištění / počet okruhů, pokud víte
          <input
            name="elektro_jisteni"
            className={fieldClassName()}
            placeholder="Např. samostatný jistič 32A, 2 okruhy, nevím"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Jaký je typ zásuvky?
          <select name="elektro_zasuvka" defaultValue="nevim" className={fieldClassName()}>
            <option value="230V běžná zásuvka">230V běžná zásuvka</option>
            <option value="16A 5pin">16A 5pin</option>
            <option value="32A 5pin">32A 5pin</option>
            <option value="63A 5pin">63A 5pin</option>
            <option value="nevim">Nevím</option>
            <option value="Jiné">Jiné</option>
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Přibližná vzdálenost přípojky od místa podia/techniky v metrech
          <input
            name="elektro_vzdalenost_m"
            inputMode="decimal"
            className={fieldClassName()}
            placeholder="Např. 15"
          />
        </label>

        <div>
          <div className="text-sm font-semibold text-slate-200">
            Musí kabel vést přes silnici, chodník nebo veřejný průchod?
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              ["ano", "Ano"],
              ["ne", "Ne"],
              ["nevim", "Nevím"],
            ].map(([value, label]) => (
              <label key={value} className={optionCardClassName()}>
                <input type="radio" name="kabel_pres_silnici" value={value} defaultChecked={value === "nevim"} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <div>
          <h2 className="text-xl font-bold text-white">4. Fotky</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Přiložte fotky rozvaděče, příjezdu, parkování nebo prostoru. Jedna fotka může mít maximálně 10 MB.
          </p>
        </div>

        <label className="block rounded-2xl border border-dashed border-slate-600 bg-slate-950 px-4 py-5 text-center text-sm font-semibold text-slate-200">
          Vybrat fotky
          <input
            type="file"
            name="photo_input"
            accept="image/jpeg,image/png,image/webp"
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
                    className="h-28 w-full rounded-xl object-cover sm:w-28"
                  />
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-white">{photo.file.name}</div>
                    <div className="text-xs text-slate-400">{(photo.file.size / 1024 / 1024).toFixed(1)} MB</div>
                    <select
                      value={photo.typ}
                      onChange={(event) => updatePhoto(photo.id, { typ: event.target.value })}
                      className={fieldClassName()}
                    >
                      <option value="rozvadec">Rozvaděč / elektro</option>
                      <option value="prijezd">Příjezd</option>
                      <option value="parkovani">Parkování</option>
                      <option value="prostor">Prostor akce</option>
                      <option value="jina">Jiná fotka</option>
                    </select>
                    <input
                      value={photo.popis}
                      onChange={(event) => updatePhoto(photo.id, { popis: event.target.value })}
                      className={fieldClassName()}
                      placeholder="Volitelný popis fotky"
                    />
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
            ))}
          </div>
        ) : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-xl font-bold text-white">5. Rozhodnutí</h2>
        <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <input type="radio" name="decision" value="self" defaultChecked />
          <span>Vyplním technické údaje sám/sama.</span>
        </label>
        <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <input type="radio" name="decision" value="technician_visit" />
          <span>Chci objednat výjezd technika před akcí.</span>
        </label>
        <p className="rounded-xl border border-blue-500/30 bg-blue-950/20 px-4 py-3 text-sm leading-relaxed text-blue-100">
          Pokud zvolíte výjezd technika, technik místo zkontroluje, zakázka se následně upraví podle
          skutečného stavu a finální cena se stanoví podle ověřených údajů.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-xl font-bold text-white">6. Potvrzení</h2>
        <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <input type="checkbox" name="potvrzeni_pravdivosti" />
          <span>Potvrzuji, že údaje vyplňuji pravdivě podle svého nejlepšího vědomí.</span>
        </label>
        <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <input type="checkbox" name="potvrzeni_doctovani" />
          <span>
            Beru na vědomí, že pokud budou údaje na místě nepravdivé nebo neúplné,
            může být doúčtován potřebný materiál, práce nebo doprava.
          </span>
        </label>
        <label className="flex gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-200">
          <input type="checkbox" name="potvrzeni_vyjezdu" />
          <span>Objednávám výjezd technika před akcí.</span>
        </label>
      </section>

      {submitError ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/20 px-4 py-3 text-sm text-red-200">
          {submitError}
        </div>
      ) : null}

      <button
        disabled={isPending}
        className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-base font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? "Odesílám..." : "Odeslat dotazník"}
      </button>
    </form>
  );
}
