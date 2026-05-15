"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KusQrActionMenu } from "@/components/sklad/KusQrActionMenu";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import {
  formatSkladKusStav,
  formatSkladKusDuplicatePoradiMessage,
  getSpravaKusDisplayLabel,
  getSpravaKusyCountMismatchMessage,
  getSpravaKusyEmptyMessage,
  isKusEvidencniAutoForPoradi,
  toNumber,
} from "@/lib/sklad/helpers";
import { querySkladPolozkyKusyForPolozka } from "@/lib/sklad/queries";
import { buildSkladKusEvidencniCislo } from "@/lib/sklad/syncPolozkaKusy";
import { supabase } from "@/lib/supabase";
import type { SkladKusRow } from "@/lib/sklad/types";

type Props = {
  skladovaPolozkaId: string;
  polozkaNazev: string;
  celkemKDispozici: number;
  /** Zvýšení po uložení řádku — znovu načte kusy v rozbaleném panelu. */
  reloadToken?: number;
};

const SPRAVA_QR_TRIGGER =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-950 text-slate-300 outline-none transition hover:border-slate-500 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/60";

function SpravaExpandKusRow({
  kus,
  polozkaNazev,
  siblingKusy,
  onUpdated,
}: {
  kus: SkladKusRow;
  polozkaNazev: string;
  siblingKusy: SkladKusRow[];
  onUpdated: () => Promise<void>;
}) {
  const [poradiDraft, setPoradiDraft] = useState(() => String(kus.poradove_cislo));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const committedRef = useRef(kus.poradove_cislo);

  useEffect(() => {
    committedRef.current = kus.poradove_cislo;
    setPoradiDraft(String(kus.poradove_cislo));
    setError(null);
  }, [kus.kus_id, kus.poradove_cislo]);

  async function savePoradi() {
    const n = Number(poradiDraft.trim());
    if (!Number.isInteger(n) || n < 1) {
      setError("Pořadové číslo musí být celé číslo 1 nebo vyšší.");
      return;
    }
    if (n === committedRef.current) {
      setError(null);
      return;
    }
    if (
      siblingKusy.some(
        (k) => k.kus_id !== kus.kus_id && toNumber(k.poradove_cislo) === n
      )
    ) {
      setError(formatSkladKusDuplicatePoradiMessage(n));
      return;
    }

    const oldPoradi = committedRef.current;
    const oldEvid = kus.evidencni_cislo?.trim() ?? "";

    const payload: { poradove_cislo: number; evidencni_cislo?: string } = {
      poradove_cislo: n,
    };
    if (oldEvid && isKusEvidencniAutoForPoradi(oldEvid, oldPoradi)) {
      payload.evidencni_cislo = buildSkladKusEvidencniCislo(polozkaNazev, n);
    }

    setSaving(true);
    setError(null);
    const { error: updErr } = await supabase
      .from(SKLAD_TABLE.skladPolozkyKusy)
      .update(payload)
      .eq("kus_id", kus.kus_id);
    setSaving(false);

    if (updErr) {
      setError(updErr.message);
      return;
    }

    committedRef.current = n;
    await onUpdated();
  }

  const label = getSpravaKusDisplayLabel(polozkaNazev, kus);

  return (
    <li
      className={[
        "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-x-2 gap-y-0.5 py-1 text-xs",
        kus.aktivni ? "" : "opacity-60",
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1">
          <input
            type="number"
            min={1}
            step={1}
            disabled={saving}
            value={poradiDraft}
            onChange={(e) => setPoradiDraft(e.target.value)}
            onBlur={() => void savePoradi()}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void savePoradi();
            }}
            aria-label="Pořadové číslo"
            aria-invalid={error ? true : undefined}
            className="h-8 w-12 shrink-0 rounded-md border border-slate-700 bg-slate-950 px-1 text-center text-[11px] text-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500/60 disabled:opacity-60"
          />
          <span className="min-w-0 flex-1 truncate font-medium text-slate-200" title={label}>
            {label}
          </span>
          <KusQrActionMenu
            kusId={kus.kus_id}
            triggerClassName={SPRAVA_QR_TRIGGER}
            iconClassName="h-[18px] w-[18px]"
          />
        </div>
        {error ? (
          <p className="text-[10px] leading-snug text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>
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

  const fetchKusy = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await querySkladPolozkyKusyForPolozka(
      supabase,
      skladovaPolozkaId
    );

    if (fetchError) {
      setKusy(null);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setKusy((data ?? []) as SkladKusRow[]);
    setLoading(false);
  }, [skladovaPolozkaId]);

  useEffect(() => {
    void fetchKusy();
  }, [fetchKusy, reloadToken]);

  const refreshAfterPoradi = useCallback(async () => {
    const { data, error: fetchError } = await querySkladPolozkyKusyForPolozka(
      supabase,
      skladovaPolozkaId
    );
    if (fetchError) {
      window.alert(fetchError.message);
      return;
    }
    setKusy((data ?? []) as SkladKusRow[]);
  }, [skladovaPolozkaId]);

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
            <ul className="divide-y divide-slate-800/80">
              {kusy.map((kus) => (
                <SpravaExpandKusRow
                  key={kus.kus_id}
                  kus={kus}
                  polozkaNazev={polozkaNazev}
                  siblingKusy={kusy}
                  onUpdated={refreshAfterPoradi}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
