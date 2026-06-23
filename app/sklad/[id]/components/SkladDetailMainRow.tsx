"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatNumber } from "@/lib/sklad/helpers";
import {
  listActiveKategorie,
  listJednotkaSelectOptions,
  listPodkategorieSelectOptions,
} from "@/lib/sklad/kategorieCatalog";
import type {
  SkladDetailRow,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
} from "@/lib/sklad/types";
import {
  boxClassName,
  fieldClassName,
  statusBoxClassName,
} from "../helpers/classNames";
import { SKLAD_DETAIL_CENTER_CELL_CLASS_NAME } from "../helpers/tableLayout";

type SkladDetailMainRowProps = {
  row: SkladDetailRow;
  editFormId: string;
  rowGridClassName: string;
  kategorie: SkladKategorie[];
  /** Celý katalog podkategorií — výběr se filtruje podle aktuální kategorie v UI. */
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  celkemKusu: number;
  poskozeneKusy: number;
  pouzitelneKusy: number;
  updateAction: (formData: FormData) => Promise<void>;
  readOnly?: boolean;
};

function podkategorieJeProKategorii(
  podkategorieId: string,
  kategorieId: string,
  all: SkladPodkategorie[]
) {
  if (!podkategorieId) return true;
  return all.some(
    (p) =>
      p.podkategorie_techniky_id === podkategorieId &&
      (!kategorieId || p.kategorie_techniky_id === kategorieId)
  );
}

export function SkladDetailMainRow({
  row,
  editFormId,
  rowGridClassName,
  kategorie,
  podkategorie: allPodkategorie,
  jednotky,
  celkemKusu,
  poskozeneKusy,
  pouzitelneKusy,
  updateAction,
  readOnly = false,
}: SkladDetailMainRowProps) {
  const centerCellClassName = SKLAD_DETAIL_CENTER_CELL_CLASS_NAME;
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [kategorieId, setKategorieId] = useState(() =>
    String(row.kategorie_techniky_id ?? "")
  );
  const [podkategorieId, setPodkategorieId] = useState(() =>
    String(row.podkategorie_techniky_id ?? "")
  );
  const [jednotka, setJednotka] = useState(() => row.jednotka || "ks");

  useEffect(() => {
    setKategorieId(String(row.kategorie_techniky_id ?? ""));
    setPodkategorieId(String(row.podkategorie_techniky_id ?? ""));
    setJednotka(row.jednotka || "ks");
  }, [
    row.skladova_polozka_id,
    row.kategorie_techniky_id,
    row.podkategorie_techniky_id,
    row.jednotka,
    row.upraveno_dne,
  ]);

  const kategorieOptions = useMemo(
    () => listActiveKategorie(kategorie),
    [kategorie]
  );

  const podkategorieOptions = useMemo(
    () =>
      listPodkategorieSelectOptions(
        allPodkategorie,
        kategorieId || null,
        podkategorieId || null
      ),
    [allPodkategorie, kategorieId, podkategorieId]
  );

  const jednotkaOptions = useMemo(
    () => listJednotkaSelectOptions(jednotky, jednotka),
    [jednotky, jednotka]
  );

  const scheduleSubmit = useCallback(() => {
    if (readOnly) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      formRef.current?.requestSubmit();
    }, 0);
  }, [readOnly]);

  const onKategorieChange = (next: string) => {
    setKategorieId(next);
    setPodkategorieId((prev) =>
      podkategorieJeProKategorii(prev, next, allPodkategorie) ? prev : ""
    );
    scheduleSubmit();
  };

  const onPodkategorieChange = (next: string) => {
    setPodkategorieId(next);
    scheduleSubmit();
  };

  const onJednotkaChange = (next: string) => {
    setJednotka(next);
    scheduleSubmit();
  };

  return (
    <form
      ref={formRef}
      id={editFormId}
      action={updateAction}
      className="contents"
      key={`${row.skladova_polozka_id}-${row.kategorie_techniky_id ?? "bez"}-${row.podkategorie_techniky_id ?? "bez"}-${row.pozice ?? "bez"}-${row.upraveno_dne}`}
    >
      <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
      <input type="hidden" name="celkem_k_dispozici" value={celkemKusu} />
      <input type="hidden" name="kategorie_techniky_id" value={kategorieId} />
      <input type="hidden" name="podkategorie_techniky_id" value={podkategorieId} />
      <input type="hidden" name="jednotka" value={jednotka} />

      <div className="bg-slate-950/30 px-3 py-3">
        <div className={rowGridClassName}>
          <div className="flex min-w-0 items-center px-1">
            <input
              name="nazev"
              defaultValue={row.nazev}
              onBlur={readOnly ? undefined : scheduleSubmit}
              disabled={readOnly}
              className={fieldClassName()}
            />
          </div>

          <div className="flex min-w-0 items-center px-1">
            <select
              value={kategorieId}
              onChange={(e) => onKategorieChange(e.target.value)}
              disabled={readOnly}
              className={fieldClassName()}
            >
              <option value="">Bez kategorie</option>
              {kategorieOptions.map((item) => (
                <option key={item.kategorie_techniky_id} value={item.kategorie_techniky_id}>
                  {item.nazev}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-0 items-center px-1">
            <select
              value={podkategorieId}
              onChange={(e) => onPodkategorieChange(e.target.value)}
              disabled={readOnly}
              className={fieldClassName()}
            >
              <option value="">Bez podkategorie</option>
              {podkategorieOptions.map((item) => (
                <option key={item.podkategorie_techniky_id} value={item.podkategorie_techniky_id}>
                  {item.nazev}
                </option>
              ))}
            </select>
          </div>

          <div className={centerCellClassName}>
            <input
              name="pozice"
              defaultValue={row.pozice ?? ""}
              inputMode="decimal"
              onBlur={readOnly ? undefined : scheduleSubmit}
              disabled={readOnly}
              className={fieldClassName("text-center")}
            />
          </div>

          <div className={centerCellClassName}>
            <span className={boxClassName("justify-center text-center")}>
              {formatNumber(celkemKusu)}
            </span>
          </div>

          <div className={centerCellClassName}>
            <span
              className={statusBoxClassName(
                [
                  "justify-center text-center",
                  poskozeneKusy > 0
                    ? "border-red-700 bg-red-950 text-red-200"
                    : "border-emerald-700 bg-emerald-950 text-emerald-200",
                ].join(" ")
              )}
            >
              {formatNumber(poskozeneKusy)}
            </span>
          </div>

          <div className={centerCellClassName}>
            <span
              className={statusBoxClassName(
                "justify-center text-center border-emerald-700 bg-emerald-950 text-emerald-200"
              )}
            >
              {formatNumber(pouzitelneKusy)}
            </span>
          </div>

          <div className={centerCellClassName}>
            <select
              value={jednotka}
              onChange={(e) => onJednotkaChange(e.target.value)}
              disabled={readOnly}
              className={fieldClassName("text-center")}
            >
              {jednotkaOptions.map((item) => (
                <option key={item.jednotka_id} value={item.nazev}>
                  {item.nazev}
                </option>
              ))}
            </select>
          </div>

          <div className={centerCellClassName}>
            <input
              name="interni_naklad"
              defaultValue={row.interni_naklad ?? ""}
              inputMode="decimal"
              onBlur={readOnly ? undefined : scheduleSubmit}
              disabled={readOnly}
              className={fieldClassName("text-center")}
            />
          </div>

          <div className={centerCellClassName}>
            <span className={boxClassName("justify-center text-center text-slate-500")}>—</span>
          </div>

          <div className={centerCellClassName}>
            <span
              className={[
                boxClassName("justify-center text-center"),
                row.aktivni
                  ? "border-emerald-800 bg-emerald-950 text-emerald-100"
                  : "border-slate-700 bg-slate-950 text-slate-100",
              ].join(" ")}
            >
              {row.aktivni ? "aktivní" : "neaktivní"}
            </span>
          </div>

          <div className={centerCellClassName}>
            {readOnly ? null : (
              <SubmitButton
                pendingText="Ukládám…"
                className="h-9 w-full rounded-lg border border-emerald-700 bg-emerald-900 px-1 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:hover:bg-emerald-900"
              >
                Uložit
              </SubmitButton>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
