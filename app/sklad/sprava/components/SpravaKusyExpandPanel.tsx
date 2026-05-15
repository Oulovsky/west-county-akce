"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  formatSkladKusStav,
  getSpravaKusDisplayLabel,
  getSpravaKusyCountMismatchMessage,
  getSpravaKusyEmptyMessage,
  toNumber,
} from "@/lib/sklad/helpers";
import { querySkladPolozkyKusyForPolozka } from "@/lib/sklad/queries";
import type { SkladKusRow } from "@/lib/sklad/types";

type Props = {
  skladovaPolozkaId: string;
  polozkaNazev: string;
  celkemKDispozici: number;
  /** Zvýšení po uložení řádku — znovu načte kusy v rozbaleném panelu. */
  reloadToken?: number;
};

function KusyList({
  kusy,
  polozkaNazev,
}: {
  kusy: SkladKusRow[];
  polozkaNazev: string;
}) {
  return (
    <ul className="divide-y divide-slate-800/80">
      {kusy.map((kus) => (
        <li
          key={kus.kus_id}
          className={[
            "grid grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 py-1 text-xs",
            kus.aktivni ? "" : "opacity-60",
          ].join(" ")}
        >
          <span
            className="truncate font-medium text-slate-200"
            title={getSpravaKusDisplayLabel(polozkaNazev, kus)}
          >
            {getSpravaKusDisplayLabel(polozkaNazev, kus)}
          </span>
          <span
            className="shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[11px] font-medium text-slate-300"
            title={kus.stav}
          >
            {formatSkladKusStav(kus.stav)}
          </span>
          <span
            className="truncate text-slate-400"
            title={kus.poznamka?.trim() || undefined}
          >
            {kus.poznamka?.trim() ? kus.poznamka : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SpravaKusyExpandPanel({
  skladovaPolozkaId,
  polozkaNazev,
  celkemKDispozici,
  reloadToken = 0,
}: Props) {
  const celkem = toNumber(celkemKDispozici);
  const [kusy, setKusy] = useState<SkladKusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadKusy() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await querySkladPolozkyKusyForPolozka(
        supabase,
        skladovaPolozkaId
      );

      if (cancelled) return;

      if (fetchError) {
        setKusy(null);
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setKusy((data ?? []) as SkladKusRow[]);
      setLoading(false);
    }

    void loadKusy();

    return () => {
      cancelled = true;
    };
  }, [skladovaPolozkaId, reloadToken]);

  const mismatchMessage =
    !loading && !error && kusy
      ? getSpravaKusyCountMismatchMessage(celkem, kusy.length)
      : null;

  return (
    <div
      className="border-t border-slate-800/80 bg-slate-950/50 px-2 py-1.5"
      aria-label="Rozpis kusů"
    >
      <div className="pl-9">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kusy
        </div>

        {loading ? (
          <p className="py-1 text-xs text-slate-500">Načítám kusy…</p>
        ) : error ? (
          <p className="py-1 text-xs text-red-300">{error}</p>
        ) : !kusy || kusy.length === 0 ? (
          <p className="py-1 text-xs leading-relaxed text-slate-500">
            {getSpravaKusyEmptyMessage(celkem)}
          </p>
        ) : (
          <>
            {mismatchMessage ? (
              <p className="mb-1 text-xs text-amber-400/90">{mismatchMessage}</p>
            ) : null}
            <KusyList kusy={kusy} polozkaNazev={polozkaNazev} />
          </>
        )}
      </div>
    </div>
  );
}
