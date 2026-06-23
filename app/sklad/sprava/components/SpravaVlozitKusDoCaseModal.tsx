"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { queryDostupneKusyProVlozeniDoCase } from "@/lib/sklad/queries";
import { vlozitExistujiciKusDoCase } from "@/lib/sklad/spravaKusActions";
import type { SpravaDostupnyKusOption } from "@/lib/sklad/types";
import { supabase } from "@/lib/supabase";
import { useSpravaKusSelection } from "./SpravaKusSelectionContext";

type Props = {
  open: boolean;
  onClose: () => void;
  parentCaseKusId: string;
  parentCaseLabel: string;
  onSuccess: () => void;
};

export function SpravaVlozitKusDoCaseModal({
  open,
  onClose,
  parentCaseKusId,
  parentCaseLabel,
  onSuccess,
}: Props) {
  const { caseMetadata } = useSpravaKusSelection();
  const [options, setOptions] = useState<SpravaDostupnyKusOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKusId, setSelectedKusId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedKusId("");

    void queryDostupneKusyProVlozeniDoCase(
      supabase,
      caseMetadata,
      parentCaseKusId
    ).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        setOptions([]);
        return;
      }
      setOptions(res.data);
    });

    return () => {
      cancelled = true;
    };
  }, [open, caseMetadata, parentCaseKusId]);

  async function handleSubmit() {
    if (!selectedKusId) {
      setError("Vyber kus, který chceš vložit do case.");
      return;
    }

    setSaving(true);
    setError(null);
    const result = await vlozitExistujiciKusDoCase(
      supabase,
      parentCaseKusId,
      selectedKusId
    );
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onSuccess();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Vložit kus do case"
      widthClassName="max-w-lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Cílový case:{" "}
          <span className="font-medium text-slate-200">{parentCaseLabel}</span>
        </p>
        <p className="text-xs text-slate-500">
          Vyber existující volný kus ze skladu. Nevytváří se nová katalogová
          položka — pouze vazba case → child kus.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500">Načítám dostupné kusy…</p>
        ) : (
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Dostupný kus
            </label>
            <select
              value={selectedKusId}
              onChange={(e) => setSelectedKusId(e.target.value)}
              disabled={saving || options.length === 0}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            >
              <option value="">
                {options.length === 0
                  ? "Žádný volný kus k vložení"
                  : "Vyber kus"}
              </option>
              {options.map((opt) => (
                <option key={opt.kusId} value={opt.kusId}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Zrušit
          </button>
          <button
            type="button"
            disabled={saving || loading || !selectedKusId}
            onClick={() => void handleSubmit()}
            className="rounded-lg border border-blue-700 bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Vkládám…" : "Vložit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
