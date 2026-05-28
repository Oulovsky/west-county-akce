"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KusQrActionMenu } from "@/components/sklad/KusQrActionMenu";
import {
  SKLAD_EMPTY_LABEL,
  SKLAD_EMPTY_LABEL_EM,
  SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
  SKLAD_TABLE,
} from "@/lib/sklad/constants";
import {
  formatSkladKusDuplicatePoradiMessage,
  formatSkladKusStav,
  getSpravaKusDisplayLabel,
  getSpravaKusyCountMismatchMessage,
  getSpravaKusyEmptyMessage,
  isKusEvidencniAutoForPoradi,
  toNumber,
} from "@/lib/sklad/helpers";
import { querySkladPolozkyKusyForPolozka } from "@/lib/sklad/queries";
import { buildSkladKusEvidencniCislo } from "@/lib/sklad/syncPolozkaKusy";
import type {
  SkladKusRow,
  SkladKusZakazkaAssignmentRow,
  SkladPolozkaRow,
} from "@/lib/sklad/types";
import {
  formatZakazkaKusStav,
  formatZakazkaKusZakazkaLabel,
  queryAktivniZakazkyKusu,
} from "@/lib/sklad/zakazkaKusy";
import { supabase } from "@/lib/supabase";
import { formatMoney } from "./formatMoney";
import { formatNumber } from "./formatNumber";
import { spravaTableGridStyle } from "./spravaTableLayout";
import {
  tableDangerBoxRight,
  tableMutedBoxRight,
  tableValueBoxLeft,
  tableValueBoxRight,
} from "./styles";

export type SpravaKusyInheritedColumns = Pick<
  SkladPolozkaRow,
  | "blok_nazev"
  | "kategorie_nazev"
  | "podkategorie_nazev"
  | "pozice"
  | "jednotka"
  | "interni_naklad"
>;

type Props = {
  skladovaPolozkaId: string;
  polozkaNazev: string;
  celkemKDispozici: number;
  inherited: SpravaKusyInheritedColumns;
  /** Zvýšení po uložení řádku — znovu načte kusy v rozbaleném panelu. */
  reloadToken?: number;
};

const SPRAVA_QR_TRIGGER =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-950 text-slate-300 outline-none transition hover:border-slate-500 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/60";

const KUS_SUBROW_GRID_CLASS = "grid items-start px-2 py-1 text-xs text-slate-300";

/** Hodnota ve čtecích boxech správy — prázdná buňka jako „—“. */
function inheritedBoxText(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : SKLAD_EMPTY_LABEL_EM;
}

/** „Skladem“ bucket — kus ve skladu nebo poškozený, ale evidovaný na položce (ne „na akci“). */
function kusSklademCell(kus: SkladKusRow): number {
  const s = kus.stav?.trim();
  if (s === "na_akci" || s === "odpis") return 0;
  if (s === "skladem" || s === "poskozeno") return 1;
  return 0;
}

function kusNaZakazkachCell(kus: SkladKusRow): number {
  /* TODO(sklad-sprava-kus-columns): Nahradit výpisem rezervací / zakázek pro kus_id, až bude API. */
  return kus.stav?.trim() === "na_akci" ? 1 : 0;
}

function kusPoskozeneCell(kus: SkladKusRow): number {
  /* TODO(sklad-sprava-kus-columns): Preferovat otevřená poškození pro kus_id místo hrubého stavu. */
  const s = kus.stav?.trim();
  if (s === "poskozeno" || s === "odpis") return 1;
  return 0;
}

function SpravaExpandKusRow({
  kus,
  polozkaNazev,
  siblingKusy,
  inherited,
  assignment,
  onUpdated,
}: {
  kus: SkladKusRow;
  polozkaNazev: string;
  siblingKusy: SkladKusRow[];
  inherited: SpravaKusyInheritedColumns;
  assignment: SkladKusZakazkaAssignmentRow | null;
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
  const stavHint = formatSkladKusStav(kus.stav);
  const labelTitle = `${label} · ${stavHint}`;

  const skladem = kusSklademCell(kus);
  const naZakazkach = assignment ? 1 : kusNaZakazkachCell(kus);
  const fyzickyNaZakazkach = assignment ? 1 : 0;
  const poskozene = kusPoskozeneCell(kus);
  const assignmentLabel = formatZakazkaKusZakazkaLabel(assignment);
  const assignmentTitle = assignment
    ? `${assignmentLabel} · ${formatZakazkaKusStav(assignment.stav)}`
    : "Kus není přiřazen k aktivní zakázce.";

  return (
    <li className={kus.aktivni ? "" : "opacity-60"}>
      <div className={KUS_SUBROW_GRID_CLASS} style={spravaTableGridStyle}>
        <div className="sticky left-0 z-10 flex min-h-8 min-w-0 flex-col gap-0.5 bg-slate-950/95 pr-1 pt-0.5">
          <div className="flex min-h-8 min-w-0 items-center gap-1.5">
            <span className="inline-block h-8 w-8 shrink-0" aria-hidden />
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
              aria-describedby={error ? `${kus.kus_id}-sprava-poradi-err` : undefined}
              className="h-8 w-12 shrink-0 rounded-md border border-slate-700 bg-slate-950 px-1 text-center text-[11px] text-white outline-none focus-visible:ring-1 focus-visible:ring-blue-500/60 disabled:opacity-60"
            />
            <span
              className="min-w-0 flex-1 truncate font-medium text-slate-200"
              title={labelTitle}
            >
              {label}
            </span>
            <KusQrActionMenu
              kusId={kus.kus_id}
              label={{
                kusId: kus.kus_id,
                itemName: polozkaNazev,
                poradoveCislo: kus.poradove_cislo,
                position: inherited.pozice,
                sector: inherited.blok_nazev,
              }}
              triggerClassName={SPRAVA_QR_TRIGGER}
              iconClassName="h-[18px] w-[18px]"
              menuVariant="sprava"
            />
          </div>
          {error ? (
            <p
              id={`${kus.kus_id}-sprava-poradi-err`}
              className="max-w-full break-words rounded border border-red-900/60 bg-red-950/35 px-1.5 py-0.5 text-[10px] leading-snug text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex min-h-8 min-w-0 items-center px-1 pt-0.5">
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={inheritedBoxText(inherited.blok_nazev)}
          >
            {inheritedBoxText(inherited.blok_nazev)}
          </span>
        </div>

        <div className="flex min-h-8 min-w-0 items-center px-1 pt-0.5">
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={inheritedBoxText(inherited.kategorie_nazev)}
          >
            {inheritedBoxText(inherited.kategorie_nazev)}
          </span>
        </div>

        <div className="flex min-h-8 min-w-0 items-center px-1 pt-0.5">
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={inheritedBoxText(inherited.podkategorie_nazev)}
          >
            {inheritedBoxText(inherited.podkategorie_nazev)}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          <span style={tableValueBoxRight} className="truncate text-[11px]">
            {formatNumber(inherited.pozice)}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          <span style={tableValueBoxRight}>{formatNumber(1)}</span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          <span style={tableValueBoxRight}>{formatNumber(skladem)}</span>
        </div>

        <div
          className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center"
          title={SKLAD_SPRAVA_HINT_NA_ZAKAZKACH}
        >
          <span
            style={assignment ? tableValueBoxRight : tableMutedBoxRight}
            title={assignmentTitle}
          >
            {formatNumber(naZakazkach)}
          </span>
        </div>

        <div
          className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center"
          title={SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH}
        >
          <span
            style={fyzickyNaZakazkach ? tableValueBoxRight : tableMutedBoxRight}
            title={assignmentTitle}
          >
            {formatNumber(fyzickyNaZakazkach)}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          {poskozene > 0 ? (
            <span style={tableDangerBoxRight}>{formatNumber(poskozene)}</span>
          ) : (
            <span style={tableMutedBoxRight}>{formatNumber(poskozene)}</span>
          )}
        </div>

        <div className="flex min-h-8 w-full min-w-0 items-center justify-center px-1 pt-0.5">
          <span style={tableValueBoxLeft} className="truncate text-[11px]">
            {inherited.jednotka ?? SKLAD_EMPTY_LABEL}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          <span style={tableValueBoxRight} className="truncate text-[11px]">
            {formatMoney(inherited.interni_naklad)}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5">
          {assignment ? (
            <Link
              href={`/zakazky/${assignment.zakazka_id}`}
              className="flex h-8 w-full min-w-0 items-center justify-center truncate rounded-md border border-blue-700 bg-blue-950 px-1.5 text-[10px] font-semibold text-blue-100"
              title={assignmentTitle}
            >
              {assignmentLabel}
            </Link>
          ) : (
            <span style={tableMutedBoxRight} className="text-[11px]">
              {SKLAD_EMPTY_LABEL_EM}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function SpravaKusyExpandPanel({
  skladovaPolozkaId,
  polozkaNazev,
  celkemKDispozici,
  inherited,
  reloadToken = 0,
}: Props) {
  const celkem = toNumber(celkemKDispozici);
  const [kusy, setKusy] = useState<SkladKusRow[] | null>(null);
  const [assignmentsByKusId, setAssignmentsByKusId] = useState<
    Record<string, SkladKusZakazkaAssignmentRow>
  >({});
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

  useEffect(() => {
    if (!kusy || kusy.length === 0) {
      setAssignmentsByKusId({});
      return;
    }

    let alive = true;
    const currentKusy = kusy;

    async function loadAssignments() {
      const { data, error: assignmentError } = await queryAktivniZakazkyKusu(
        supabase,
        currentKusy.map((kus) => kus.kus_id)
      );

      if (!alive) return;

      if (assignmentError) {
        setAssignmentsByKusId({});
        return;
      }

      const next: Record<string, SkladKusZakazkaAssignmentRow> = {};
      for (const row of (data ?? []) as SkladKusZakazkaAssignmentRow[]) {
        if (!next[row.kus_id]) next[row.kus_id] = row;
      }
      setAssignmentsByKusId(next);
    }

    void loadAssignments();

    return () => {
      alive = false;
    };
  }, [kusy]);

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
      className="border-t border-slate-800/80 bg-slate-950/80"
      aria-label="Rozpis kusů"
    >
      <div className="min-w-0 px-0 py-1.5">
        <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kusy
        </div>

        {loading ? (
          <p className="px-2 py-1 text-xs text-slate-500">Načítám kusy…</p>
        ) : error ? (
          <p className="px-2 py-1 text-xs text-red-300">{error}</p>
        ) : !kusy || kusy.length === 0 ? (
          <p className="px-2 py-1 text-xs leading-relaxed text-slate-500">
            {getSpravaKusyEmptyMessage(celkem)}
          </p>
        ) : (
          <>
            {mismatchMessage ? (
              <p className="mb-1 px-2 text-xs text-amber-400/90">{mismatchMessage}</p>
            ) : null}
            <ul className="min-w-0 divide-y divide-slate-800/80">
              {kusy.map((kus) => (
                <SpravaExpandKusRow
                  key={kus.kus_id}
                  kus={kus}
                  polozkaNazev={polozkaNazev}
                  siblingKusy={kusy}
                  inherited={inherited}
                  assignment={assignmentsByKusId[kus.kus_id] ?? null}
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
