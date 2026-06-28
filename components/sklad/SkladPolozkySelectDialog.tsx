"use client";

import { Suspense, useEffect, useState } from "react";
import { SkladPolozkyCatalog } from "@/app/sklad/sprava/components/SkladPolozkyCatalog";
import {
  SpravaKusSelectionProvider,
  useSpravaKusSelection,
} from "@/app/sklad/sprava/components/SpravaKusSelectionContext";

export type SkladPolozkaSelectResult =
  | {
      typVyberu: "polozka";
      skladovaPolozkaId: string;
      nazev: string;
      mnozstvi: number;
    }
  | {
      typVyberu: "kus";
      skladovaPolozkaId: string;
      skladovyKusId: string;
      nazev: string;
      polozkaNazev: string;
      mnozstvi: 1;
    };

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: SkladPolozkaSelectResult) => void;
  disabled?: boolean;
  title?: string;
  confirmLabel?: string;
};

function SkladPolozkySelectDialogBody({
  onClose,
  onConfirm,
  disabled,
  confirmLabel = "Přidat položku",
}: Omit<Props, "open" | "title">) {
  const { selectedPolozka, selectedKusList, hasSelection, clearSelection } =
    useSpravaKusSelection();
  const [mnozstvi, setMnozstvi] = useState("1");

  const selectedKus = selectedKusList.length === 1 ? selectedKusList[0]! : null;
  const isKusSelection = selectedKus !== null;
  const isPolozkaSelection = selectedPolozka !== null && !isKusSelection;

  useEffect(() => {
    return () => {
      clearSelection();
    };
  }, [clearSelection]);

  function handleConfirm() {
    if (disabled) return;

    if (isKusSelection && selectedKus) {
      onConfirm({
        typVyberu: "kus",
        skladovaPolozkaId: selectedKus.skladovaPolozkaId,
        skladovyKusId: selectedKus.kusId,
        nazev: selectedKus.label,
        polozkaNazev: selectedKus.polozkaNazev,
        mnozstvi: 1,
      });
      clearSelection();
      setMnozstvi("1");
      onClose();
      return;
    }

    if (!selectedPolozka) return;
    const qty = Math.max(0.01, Number(mnozstvi.replace(",", ".")) || 1);
    onConfirm({
      typVyberu: "polozka",
      skladovaPolozkaId: selectedPolozka.skladovaPolozkaId,
      nazev: selectedPolozka.nazev,
      mnozstvi: qty,
    });
    clearSelection();
    setMnozstvi("1");
    onClose();
  }

  const canConfirm = isKusSelection || isPolozkaSelection;

  return (
    <>
      <div
        className="min-h-0 flex-1 overflow-hidden p-4"
        style={{ ["--sprava-sklad-workspace-top" as string]: "22rem" }}
      >
        <Suspense
          fallback={
            <div className="py-10 text-center text-sm text-slate-400">Načítám sklad…</div>
          }
        >
          <SkladPolozkyCatalog catalogMode="select" />
        </Suspense>
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950/90 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vybraná položka
            </div>
            {!hasSelection ? (
              <p className="text-sm text-slate-500">Nic není vybráno</p>
            ) : isKusSelection && selectedKus ? (
              <>
                <p className="truncate text-sm text-white">
                  Konkrétní kus:{" "}
                  <span className="font-medium text-indigo-200">{selectedKus.label}</span>
                </p>
                <p className="truncate text-sm text-slate-400">
                  Skladová položka: {selectedKus.polozkaNazev}
                </p>
                <p className="text-xs text-slate-500">Režim: konkrétní kus</p>
              </>
            ) : isPolozkaSelection && selectedPolozka ? (
              <>
                <p className="truncate text-sm text-white">
                  Položka:{" "}
                  <span className="font-medium text-indigo-200">{selectedPolozka.nazev}</span>
                </p>
                <p className="text-xs text-slate-500">Režim: obecná položka</p>
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-slate-400">Množství</span>
              <input
                type="number"
                min={isKusSelection ? "1" : "0.01"}
                max={isKusSelection ? "1" : undefined}
                step={isKusSelection ? "1" : "0.01"}
                value={isKusSelection ? "1" : mnozstvi}
                onChange={(e) => setMnozstvi(e.target.value)}
                disabled={disabled || isKusSelection}
                readOnly={isKusSelection}
                className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 read-only:cursor-default"
              />
              {isKusSelection ? (
                <span className="text-[11px] text-slate-500">1 ks (konkrétní kus)</span>
              ) : null}
            </label>
            <button
              type="button"
              disabled={disabled || !hasSelection}
              onClick={() => clearSelection()}
              className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Zrušit výběr
            </button>
            <button
              type="button"
              disabled={disabled || !canConfirm}
              onClick={handleConfirm}
              className="rounded-lg border border-indigo-500 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SkladPolozkySelectDialog({
  open,
  onClose,
  onConfirm,
  disabled,
  title = "Vybrat ze skladu",
  confirmLabel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Zavřít"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sklad-polozky-select-title"
        className="relative flex max-h-[92dvh] w-full max-w-[min(100%,96rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
          <div>
            <h2 id="sklad-polozky-select-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Vyberte obecnou položku (množství) nebo konkrétní kus v rozpisu — checkboxem nebo
              kliknutím na řádek.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Zavřít
          </button>
        </div>

        <SpravaKusSelectionProvider singleKusSelection>
          <SkladPolozkySelectDialogBody
            onClose={onClose}
            onConfirm={onConfirm}
            disabled={disabled}
            confirmLabel={confirmLabel}
          />
        </SpravaKusSelectionProvider>
      </div>
    </div>
  );
}
