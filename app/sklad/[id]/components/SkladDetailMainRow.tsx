"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatNumber } from "@/lib/sklad/helpers";
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

  useEffect(() => {
    setKategorieId(String(row.kategorie_techniky_id ?? ""));
    setPodkategorieId(String(row.podkategorie_techniky_id ?? ""));
  }, [
    row.skladova_polozka_id,
    row.kategorie_techniky_id,
    row.podkategorie_techniky_id,
    row.upraveno_dne,
  ]);

  const filteredPodkategorie = useMemo(
    () =>
      allPodkategorie.filter(
        (p) => !kategorieId || p.kategorie_techniky_id === kategorieId
      ),
    [allPodkategorie, kategorieId]
  );

  const scheduleSubmit = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      formRef.current?.requestSubmit();
    }, 0);
  }, []);

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

  const onJednotkaChange = () => {
    scheduleSubmit();
  };

  return (
    <>
      <form
        ref={formRef}
        id={editFormId}
        action={updateAction}
        key={`${row.skladova_polozka_id}-${row.kategorie_techniky_id ?? "bez"}-${row.podkategorie_techniky_id ?? "bez"}-${row.pozice ?? "bez"}-${row.upraveno_dne}`}
      >
        <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
        <input type="hidden" name="celkem_k_dispozici" value={celkemKusu} />
        <input type="hidden" name="kategorie_techniky_id" value={kategorieId} />
        <input type="hidden" name="podkategorie_techniky_id" value={podkategorieId} />
      </form>

      <div className="bg-slate-950/30 px-3 py-3">
        <div className={rowGridClassName}>
          <div className="flex items-center px-2">
            <input
              form={editFormId}
              name="nazev"
              defaultValue={row.nazev}
              onBlur={scheduleSubmit}
              className={fieldClassName()}
            />
          </div>

          <div className="flex items-center px-2">
            <select
              value={kategorieId}
              onChange={(e) => onKategorieChange(e.target.value)}
              className={fieldClassName()}
            >
              <option value="">Bez kategorie</option>
              {kategorie.map((item) => (
                <option key={item.kategorie_techniky_id} value={item.kategorie_techniky_id}>
                  {item.nazev}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center px-2">
            <select
              value={podkategorieId}
              onChange={(e) => onPodkategorieChange(e.target.value)}
              className={fieldClassName()}
            >
              <option value="">Bez podkategorie</option>
              {filteredPodkategorie.map((item) => (
                <option key={item.podkategorie_techniky_id} value={item.podkategorie_techniky_id}>
                  {item.nazev}
                </option>
              ))}
            </select>
          </div>

          <div className={centerCellClassName}>
            <input
              form={editFormId}
              name="pozice"
              defaultValue={row.pozice ?? ""}
              inputMode="decimal"
              onBlur={scheduleSubmit}
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
              form={editFormId}
              name="jednotka"
              defaultValue={row.jednotka}
              onChange={onJednotkaChange}
              className={fieldClassName("text-center")}
            >
              {jednotky.map((item) => (
                <option key={item.jednotka_id} value={item.nazev}>
                  {item.nazev}
                </option>
              ))}
            </select>
          </div>

          <div className={centerCellClassName}>
            <input
              form={editFormId}
              name="interni_naklad"
              defaultValue={row.interni_naklad ?? ""}
              inputMode="decimal"
              onBlur={scheduleSubmit}
              className={fieldClassName("text-center")}
            />
          </div>

          <div className={centerCellClassName}>
            <span className={boxClassName("justify-center text-center text-slate-500")}>—</span>
          </div>

          <div className={centerCellClassName}>
            <span className={boxClassName("justify-center text-center text-slate-500")}>—</span>
          </div>

          <div className={centerCellClassName}>
            <span className={boxClassName("justify-center text-center text-slate-500")}>—</span>
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
            <button
              type="submit"
              form={editFormId}
              className="h-12 w-full rounded-xl border border-emerald-700 bg-emerald-900 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              Uložit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
