"use client";

import { Modal } from "@/components/ui/modal";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
} from "@/lib/sklad/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  isCreating: boolean;
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
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
};

export function AddItemModal({
  open,
  onClose,
  onSave,
  isCreating,
  bloky,
  kategorie,
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

          <select
            value={newBlokId}
            onChange={(e) => {
              const blokId = e.target.value;
              const firstKategorieId =
                kategorie.find((k) => k.sklad_blok_id === blokId)
                  ?.kategorie_techniky_id ?? "";

              setNewBlokId(blokId);
              setNewKategorieId(firstKategorieId);
              setNewPodkategorieId("");
            }}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            <option value="">Vyber okruh</option>

            {bloky.map((b) => (
              <option key={b.sklad_blok_id} value={b.sklad_blok_id}>
                {b.nazev}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm text-slate-300">Kategorie</div>

            <select
              value={newKategorieId}
              disabled={!newBlokId}
              onChange={(e) => {
                setNewKategorieId(e.target.value);
                setNewPodkategorieId("");
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none disabled:opacity-50"
            >
              <option value="">Vyber kategorii</option>

              {newKategorieOptions.map((k) => (
                <option
                  key={k.kategorie_techniky_id}
                  value={k.kategorie_techniky_id}
                >
                  {k.nazev}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-sm text-slate-300">Typ / rozměr</div>

            <select
              value={newPodkategorieId}
              disabled={!newKategorieId}
              onChange={(e) => setNewPodkategorieId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none disabled:opacity-50"
            >
              <option value="">Bez typu / rozměru</option>

              {newPodkategorieOptions.map((p) => (
                <option
                  key={p.podkategorie_techniky_id}
                  value={p.podkategorie_techniky_id}
                >
                  {p.nazev}
                </option>
              ))}
            </select>
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

            <select
              value={newJednotka}
              onChange={(e) => setNewJednotka(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            >
              {jednotky.map((j) => (
                <option key={j.jednotka_id} value={j.nazev}>
                  {j.nazev}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-sm text-slate-300">Interní náklad</div>

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
