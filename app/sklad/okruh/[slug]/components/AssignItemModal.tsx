"use client";

import { Modal } from "@/components/ui/modal";

type Item = {
  skladova_polozka_id: string;
  nazev: string;
  blok_nazev: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
  selectedId: string;
  setSelectedId: (v: string) => void;
  items: Item[];
};

export default function AssignItemModal({
  open,
  onClose,
  onSubmit,
  saving,
  selectedId,
  setSelectedId,
  items,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Přidat ze skladu" widthClassName="max-w-xl">
      <div className="grid gap-4">
        <div>
          <div className="mb-2 text-sm text-slate-300">Položka</div>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          >
            <option value="">Vyber položku</option>
            {items.map((item) => (
              <option key={item.skladova_polozka_id} value={item.skladova_polozka_id}>
                {item.nazev}
                {item.blok_nazev ? ` — ${item.blok_nazev}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={saving}>Zrušit</button>
          <button onClick={onSubmit} disabled={!selectedId || saving}>
            {saving ? "Přidávám..." : "Přidat"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
