"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useSpravaKusSelection } from "@/app/sklad/sprava/components/SpravaKusSelectionContext";
import {
  buildSetupPolozkyFromSelection,
  setupQuantityMapToEntries,
} from "@/lib/sklad/setupSelectionToPolozky";
import { supabase } from "@/lib/supabase";
import { addSelectionToSetupAction } from "../setupActions";

type Props = {
  setupId: string;
};

export function SetupSelectionPanel({ setupId }: Props) {
  const router = useRouter();
  const { selectedPolozka, selectedKusList, hasSelection, clearSelection } =
    useSpravaKusSelection();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectionLabel = selectedPolozka
    ? `Položka: ${selectedPolozka.nazev}`
    : selectedKusList.length > 0
      ? `Kusů: ${selectedKusList.length}`
      : "Nic není vybráno";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Výběr ze skladu
          </div>
          <p className="mt-1 truncate text-sm text-slate-300">{selectionLabel}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasSelection || pending}
            onClick={() => clearSelection()}
            className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Zrušit výběr
          </button>
          <button
            type="button"
            disabled={!hasSelection || pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  const map = await buildSetupPolozkyFromSelection(supabase, {
                    selectedPolozka,
                    selectedKusy: selectedKusList,
                  });
                  const entries = setupQuantityMapToEntries(map);
                  if (entries.length === 0) {
                    setError("Ve výběru nejsou žádné položky k přidání.");
                    return;
                  }
                  await addSelectionToSetupAction(setupId, entries);
                  clearSelection();
                  router.refresh();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Nepodařilo se přidat do setupu."
                  );
                }
              });
            }}
            className="rounded-lg border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? "Přidávám…" : "Přidat do setupu"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
