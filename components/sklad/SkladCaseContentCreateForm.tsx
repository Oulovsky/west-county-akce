"use client";

import { useMemo, useState } from "react";
import { SelectWithQuickCreate } from "@/app/sklad/sprava/components/SelectWithQuickCreate";
import { createCaseContentAction } from "@/app/sklad/kusObsahActions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { useSkladInlineConfigQuickCreate } from "@/lib/sklad/hooks/useSkladInlineConfigQuickCreate";
import {
  listActiveKategorie,
  listJednotkaSelectOptions,
  listPodkategorieSelectOptions,
} from "@/lib/sklad/kategorieCatalog";
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
  /** Po vytvoření číselníku — obnoví katalog v nadřazeném panelu. */
  onCatalogConfigChanged?: () => void | Promise<void>;
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
  onCatalogConfigChanged,
}: SkladCaseContentCreateFormProps) {
  const [blokId, setBlokId] = useState(defaults.skladBlokId ?? bloky[0]?.sklad_blok_id ?? "");
  const [kategorieId, setKategorieId] = useState(
    defaults.kategorieTechnikyId ?? ""
  );
  const [podkategorieId, setPodkategorieId] = useState(
    defaults.podkategorieTechnikyId ?? ""
  );
  const [jednotka, setJednotka] = useState(defaults.jednotka || "ks");

  const {
    bloky: blokyList,
    kategorie: kategorieList,
    podkategorie: podkategorieList,
    jednotky: jednotkyList,
    onQuickCreateBlok,
    onQuickCreateKategorie,
    onQuickCreatePodkategorie,
    onQuickCreateJednotka,
  } = useSkladInlineConfigQuickCreate({
    bloky,
    kategorie,
    podkategorie,
    jednotky,
    selection: {
      blokId,
      kategorieId,
      setBlokId,
      setKategorieId,
      setPodkategorieId,
      setJednotka,
    },
    onAfterCreate: onCatalogConfigChanged,
  });

  const kategorieOptions = useMemo(
    () => listActiveKategorie(kategorieList),
    [kategorieList]
  );

  const podkategorieOptions = useMemo(
    () =>
      listPodkategorieSelectOptions(
        podkategorieList,
        kategorieId || null,
        podkategorieId || null
      ),
    [podkategorieList, kategorieId, podkategorieId]
  );

  const jednotkaOptions = useMemo(
    () => listJednotkaSelectOptions(jednotkyList, jednotka),
    [jednotkyList, jednotka]
  );

  const inputClass =
    "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

  const selectClass = `${inputClass} min-w-0 flex-1`;

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
        <input name="nazev" required placeholder="Kabinet P3.9 outdoor" className={`mt-2 ${inputClass}`} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block text-sm font-semibold text-slate-200">
          Okruh *
          <div className="mt-2 flex min-w-0 items-center">
            <SelectWithQuickCreate
              name="sklad_blok_id"
              value={blokId}
              required
              onChange={(value) => {
                setBlokId(value);
              }}
              placeholder="Vyberte okruh"
              selectClassName={selectClass}
              variant="form"
              options={blokyList.map((blok) => ({
                value: blok.sklad_blok_id,
                label: blok.nazev,
              }))}
              quickCreateTitle="Přidat okruh"
              quickCreatePlaceholder="Název okruhu"
              onQuickCreate={onQuickCreateBlok}
            />
          </div>
        </div>

        <div className="block text-sm font-semibold text-slate-200">
          Kategorie
          <div className="mt-2 flex min-w-0 items-center">
            <SelectWithQuickCreate
              name="kategorie_techniky_id"
              value={kategorieId}
              onChange={(value) => {
                setKategorieId(value);
                setPodkategorieId("");
              }}
              placeholder="Bez kategorie"
              selectClassName={selectClass}
              variant="form"
              options={kategorieOptions.map((row) => ({
                value: row.kategorie_techniky_id,
                label: row.nazev,
              }))}
              quickCreateTitle="Přidat kategorii"
              quickCreatePlaceholder="Název kategorie"
              quickCreateDisabled={!blokId}
              quickCreateDisabledTitle="Nejdřív vyber okruh"
              onQuickCreate={onQuickCreateKategorie}
            />
          </div>
        </div>

        <div className="block text-sm font-semibold text-slate-200">
          Podkategorie
          <div className="mt-2 flex min-w-0 items-center">
            <SelectWithQuickCreate
              name="podkategorie_techniky_id"
              value={podkategorieId}
              onChange={setPodkategorieId}
              placeholder="Bez podkategorie"
              selectClassName={selectClass}
              variant="form"
              options={podkategorieOptions.map((row) => ({
                value: row.podkategorie_techniky_id,
                label: row.nazev,
              }))}
              quickCreateTitle="Přidat podkategorii"
              quickCreatePlaceholder="Název podkategorie"
              quickCreateDisabled={!kategorieId}
              quickCreateDisabledTitle="Nejdřív vyber kategorii"
              onQuickCreate={onQuickCreatePodkategorie}
            />
          </div>
        </div>

        <div className="block text-sm font-semibold text-slate-200">
          Jednotka *
          <div className="mt-2 flex min-w-0 items-center">
            <SelectWithQuickCreate
              name="jednotka"
              value={jednotka}
              required
              onChange={setJednotka}
              selectClassName={selectClass}
              variant="form"
              options={jednotkaOptions.map((row) => ({
                value: row.nazev,
                label: row.nazev,
              }))}
              quickCreateTitle="Přidat jednotku"
              quickCreatePlaceholder="Název jednotky"
              onQuickCreate={onQuickCreateJednotka}
            />
          </div>
        </div>

        <label className="block text-sm font-semibold text-slate-200">
          Počet kusů *
          <input
            name="count"
            type="number"
            min={1}
            max={200}
            required
            defaultValue={8}
            className={`mt-2 ${inputClass}`}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-200">
          Vlastník *
          <select
            name="technicky_vlastnik_id"
            required
            defaultValue={defaults.technickyVlastnikId ?? ""}
            className={`mt-2 ${inputClass}`}
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
        <input name="poznamka" className={`mt-2 ${inputClass}`} />
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
