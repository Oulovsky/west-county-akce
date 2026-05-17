"use client";

import { Modal } from "@/components/ui/modal";
import { SelectWithQuickCreate } from "./SelectWithQuickCreate";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
} from "@/lib/sklad/types";

const modalSelectClass =
  "min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none disabled:opacity-50";

type QuickCreateHandler = (name: string) => Promise<{ error?: string } | void>;

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  isCreating: boolean;
  bloky: SkladBlok[];
  jednotky: SkladJednotka[];
  newBlokId: string;
  setNewBlokId: (value: string) => void;
  newKategorieId: string;
  setNewKategorieId: (value: string) => void;
  newPodkategorieId: string;
  setNewPodkategorieId: (value: string) => void;
  newNazev: string;
  setNewNazev: (value: string) => void;
  newKusy: string;
  setNewKusy: (value: string) => void;
  newJednotka: string;
  setNewJednotka: (value: string) => void;
  newNaklad: string;
  setNewNaklad: (value: string) => void;
  newRent: string;
  setNewRent: (value: string) => void;
  newKategorieOptions: SkladKategorie[];
  newPodkategorieOptions: SkladPodkategorie[];
  onQuickCreateBlok: QuickCreateHandler;
  onQuickCreateKategorie: QuickCreateHandler;
  onQuickCreatePodkategorie: QuickCreateHandler;
};

export function AddItemModal({
  open,
  onClose,
  onSave,
  isCreating,
  bloky,
  jednotky,
  newBlokId,
  setNewBlokId,
  newKategorieId,
  setNewKategorieId,
  newPodkategorieId,
  setNewPodkategorieId,
  newNazev,
  setNewNazev,
  newKusy,
  setNewKusy,
  newJednotka,
  setNewJednotka,
  newNaklad,
  setNewNaklad,
  newRent,
  setNewRent,
  newKategorieOptions,
  newPodkategorieOptions,
  onQuickCreateBlok,
  onQuickCreateKategorie,
  onQuickCreatePodkategorie,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Přidat položku"
      widthClassName="max-w-3xl"
    >
      <div className="grid gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-300">Okruh</div>

          <SelectWithQuickCreate
            value={newBlokId}
            onChange={setNewBlokId}
            placeholder="Vyber okruh"
            disabled={isCreating}
            selectClassName={modalSelectClass}
            options={bloky.map((b) => ({
              value: b.sklad_blok_id,
              label: b.nazev,
            }))}
            quickCreateTitle="Nový okruh"
            quickCreatePlaceholder="Název okruhu"
            onQuickCreate={onQuickCreateBlok}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm text-slate-300">Kategorie</div>

            <SelectWithQuickCreate
              value={newKategorieId}
              onChange={(value) => {
                setNewKategorieId(value);
                setNewPodkategorieId("");
              }}
              placeholder="Vyber kategorii"
              disabled={isCreating || !newBlokId}
              selectClassName={modalSelectClass}
              options={newKategorieOptions.map((k) => ({
                value: k.kategorie_techniky_id,
                label: k.nazev,
              }))}
              quickCreateTitle="Nová kategorie"
              quickCreatePlaceholder="Název kategorie"
              quickCreateDisabled={!newBlokId}
              quickCreateDisabledTitle="Nejdřív vyber okruh"
              onQuickCreate={onQuickCreateKategorie}
            />
          </div>

          <div>
            <div className="mb-2 text-sm text-slate-300">Podkategorie</div>

            <SelectWithQuickCreate
              value={newPodkategorieId}
              onChange={setNewPodkategorieId}
              placeholder="Bez podkategorie"
              disabled={isCreating || !newKategorieId}
              selectClassName={modalSelectClass}
              options={newPodkategorieOptions.map((p) => ({
                value: p.podkategorie_techniky_id,
                label: p.nazev,
              }))}
              quickCreateTitle="Nová podkategorie"
              quickCreatePlaceholder="Název podkategorie"
              quickCreateDisabled={!newKategorieId}
              quickCreateDisabledTitle="Nejdřív vyber kategorii"
              onQuickCreate={onQuickCreatePodkategorie}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm text-slate-300">Název položky</div>

          <input
            value={newNazev}
            onChange={(e) => setNewNazev(e.target.value)}
            placeholder="Např. Zábradlí 2m"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm text-slate-300">Kusy</div>

            <input
              value={newKusy}
              onChange={(e) => setNewKusy(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              inputMode="decimal"
            />
          </div>

          <div>
            <div className="mb-2 text-sm text-slate-300">Jednotka</div>

            <SelectWithQuickCreate
              value={newJednotka}
              onChange={setNewJednotka}
              disabled={isCreating}
              showQuickCreate={false}
              selectClassName={modalSelectClass}
              options={jednotky.map((j) => ({
                value: j.nazev,
                label: j.nazev,
              }))}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm text-slate-300">Cena pro akce</div>

            <input
              value={newNaklad}
              onChange={(e) => setNewNaklad(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              inputMode="decimal"
            />
          </div>

          <div>
            <div className="mb-2 text-sm text-slate-300">Rent</div>

            <input
              value={newRent}
              onChange={(e) => setNewRent(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            Zrušit
          </button>

          <button
            onClick={onSave}
            disabled={isCreating}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {isCreating ? "Ukládám..." : "Uložit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
