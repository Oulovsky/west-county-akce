"use client";

import { useMemo, useState } from "react";
import { createCaseContentAction } from "@/app/sklad/kusObsahActions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { SpravaObsahReturnTo } from "@/lib/sklad/spravaObsahUrl";
import type { SkladJednotka, SkladKategorie, SkladPodkategorie } from "@/lib/sklad/types";
import type { SkladBlok } from "@/lib/sklad/types";
import type { TechnickyVlastnik } from "@/lib/sklad/types";

type SkladCaseContentCreateFormProps = {
  parentKusId: string;
  returnPolozkaId: string;
  returnTo?: SpravaObsahReturnTo;
  parentCaseLabel: string;
  defaults: {
    skladBlokId: string | null;
    kategorieTechnikyId: string | null;
    podkategorieTechnikyId: string | null;
    technickyVlastnikId: string | null;
    jednotka: string;
  };
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  vlastnici: TechnickyVlastnik[];
};

export function SkladCaseContentCreateForm({
  parentKusId,
  returnPolozkaId,
  returnTo = "polozka",
  parentCaseLabel,
  defaults,
  bloky,
  kategorie,
  podkategorie,
  jednotky,
  vlastnici,
}: SkladCaseContentCreateFormProps) {
  const [blokId, setBlokId] = useState(defaults.skladBlokId ?? bloky[0]?.sklad_blok_id ?? "");
  const [kategorieId, setKategorieId] = useState(
    defaults.kategorieTechnikyId ?? ""
  );
  const [podkategorieId, setPodkategorieId] = useState(
    defaults.podkategorieTechnikyId ?? ""
  );

  const kategorieOptions = useMemo(
    () => kategorie.filter((row) => (row.sklad_blok_id ?? null) === (blokId || null)),
    [kategorie, blokId]
  );

  const podkategorieOptions = useMemo(
    () =>
      podkategorie.filter((row) => row.kategorie_techniky_id === kategorieId),
    [podkategorie, kategorieId]
  );

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

  return (
    <form
      action={createCaseContentAction}
      className="space-y-3 rounded-xl border border-blue-800/50 bg-blue-950/30 p-4"
    >
      <input type="hidden" name="parent_kus_id" value={parentKusId} />
      <input type="hidden" name="return_polozka_id" value={returnPolozkaId} />
      <input type="hidden" name="return_to" value={returnTo} />

      <div>
        <h4 className="text-sm font-black text-white">Zadat nový obsah</h4>
        <p className="mt-1 text-xs text-slate-400">
          Vytvoří položku a kusy a rovnou je vloží do {parentCaseLabel}.
        </p>
      </div>

      <label className="block text-sm font-semibold text-slate-200">
        Název položky *
        <input name="nazev" required placeholder="Kabinet P3.9 outdoor" className={inputClass} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-200">
          Okruh *
          <select
            name="sklad_blok_id"
            required
            value={blokId}
            onChange={(event) => {
              setBlokId(event.target.value);
              setKategorieId("");
              setPodkategorieId("");
            }}
            className={inputClass}
          >
            <option value="">Vyberte okruh</option>
            {bloky.map((blok) => (
              <option key={blok.sklad_blok_id} value={blok.sklad_blok_id}>
                {blok.nazev}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Kategorie *
          <select
            name="kategorie_techniky_id"
            required
            value={kategorieId}
            onChange={(event) => {
              setKategorieId(event.target.value);
              setPodkategorieId("");
            }}
            className={inputClass}
          >
            <option value="">Vyberte kategorii</option>
            {kategorieOptions.map((row) => (
              <option key={row.kategorie_techniky_id} value={row.kategorie_techniky_id}>
                {row.nazev}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Podkategorie
          <select
            name="podkategorie_techniky_id"
            value={podkategorieId}
            onChange={(event) => setPodkategorieId(event.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {podkategorieOptions.map((row) => (
              <option
                key={row.podkategorie_techniky_id}
                value={row.podkategorie_techniky_id}
              >
                {row.nazev}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Jednotka *
          <select name="jednotka" required defaultValue={defaults.jednotka || "ks"} className={inputClass}>
            {jednotky.map((row) => (
              <option key={row.jednotka_id} value={row.nazev}>
                {row.nazev}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Počet kusů *
          <input
            name="count"
            type="number"
            min={1}
            max={200}
            required
            defaultValue={8}
            className={inputClass}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Vlastník *
          <select
            name="technicky_vlastnik_id"
            required
            defaultValue={defaults.technickyVlastnikId ?? ""}
            className={inputClass}
          >
            <option value="">Vyberte vlastníka</option>
            {vlastnici.map((row) => (
              <option key={row.id} value={row.id}>
                {row.nazev}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-semibold text-slate-200">
        Poznámka (volitelně)
        <input name="poznamka" className={inputClass} />
      </label>

      <SubmitButton
        pendingText="Vytvářím…"
        className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600 disabled:hover:bg-blue-700"
      >
        Vytvořit a vložit
      </SubmitButton>
    </form>
  );
}
