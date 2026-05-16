"use client";

import { useMemo, useState } from "react";
import { KusLabelPrintDialog } from "@/components/sklad/KusLabelPrintDialog";
import type { SkladKusLabelPayload } from "@/lib/sklad/kusLabels";
import type { SkladDetailRow, SkladKusRow } from "@/lib/sklad/types";

type Props = {
  row: Pick<SkladDetailRow, "nazev" | "pozice">;
  kusy: Pick<SkladKusRow, "kus_id" | "poradove_cislo">[];
};

export function SkladBulkLabelsButton({ row, kusy }: Props) {
  const [open, setOpen] = useState(false);

  const labels = useMemo<SkladKusLabelPayload[]>(
    () =>
      kusy.map((kus) => ({
        kusId: kus.kus_id,
        itemName: row.nazev,
        poradoveCislo: kus.poradove_cislo,
        position: row.pozice,
      })),
    [kusy, row.nazev, row.pozice]
  );

  if (labels.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-800"
      >
        Tisk všech štítků
      </button>

      <KusLabelPrintDialog
        open={open}
        labels={labels}
        autoPrintOnOpen
        onClose={() => setOpen(false)}
      />
    </>
  );
}
