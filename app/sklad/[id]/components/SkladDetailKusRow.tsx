import {
  formatMoney,
  formatNumber,
  getKusLabel,
  getKusStatus,
} from "@/lib/sklad/helpers";
import type { SkladDetailRow, SkladKusRow, SkladPoskozeniRow } from "@/lib/sklad/types";
import { boxClassName, statusBoxClassName } from "../helpers/classNames";
import { SKLAD_DETAIL_CENTER_CELL_CLASS_NAME } from "../helpers/tableLayout";

type SkladDetailKusRowProps = {
  kus: SkladKusRow;
  row: SkladDetailRow;
  poskozeni: SkladPoskozeniRow[];
  rowGridClassName: string;
  deleteKusAction: (formData: FormData) => Promise<void>;
};

export function SkladDetailKusRow({
  kus,
  row,
  poskozeni,
  rowGridClassName,
  deleteKusAction,
}: SkladDetailKusRowProps) {
  const stav = getKusStatus(kus, poskozeni);
  const centerCellClassName = SKLAD_DETAIL_CENTER_CELL_CLASS_NAME;

  return (
    <div key={kus.kus_id} className={rowGridClassName}>
      <div className="flex items-center px-2">
        <span className={boxClassName()}>{getKusLabel(kus)}</span>
      </div>

      <div className="flex items-center px-2">
        <span className={boxClassName()}>{row.kategorie_nazev ?? "-"}</span>
      </div>

      <div className="flex items-center px-2">
        <span className={boxClassName()}>{row.podkategorie_nazev ?? "-"}</span>
      </div>

      <div className={centerCellClassName}>
        <span className={boxClassName("justify-center text-center")}>
          {formatNumber(row.pozice)}
        </span>
      </div>

      <div className={centerCellClassName}>
        <span className={boxClassName("justify-center text-center")}>1</span>
      </div>

      <div className={centerCellClassName}>
        <span
          className={statusBoxClassName(
            [
              "justify-center text-center",
              stav.blokovano
                ? "border-red-700 bg-red-950 text-red-200"
                : "border-emerald-700 bg-emerald-950 text-emerald-200",
            ].join(" ")
          )}
        >
          {stav.blokovano ? "1 ks" : "OK"}
        </span>
      </div>

      <div className={centerCellClassName}>
        <span
          className={statusBoxClassName("justify-center text-center " + stav.className)}
          title={stav.text}
        >
          {stav.pouzitelne}
        </span>
      </div>

      <div className={centerCellClassName}>
        <span className={boxClassName("justify-center text-center")}>{row.jednotka}</span>
      </div>

      <div className={centerCellClassName}>
        <span className={boxClassName("justify-center text-center")}>
          {formatMoney(row.interni_naklad)}
        </span>
      </div>

      <div className={centerCellClassName}>
        <span className={boxClassName("justify-center text-center")}>
          {formatMoney(row.fakturacni_cena)}
        </span>
      </div>

      <div className={centerCellClassName}>
        <span
          className={[
            "flex h-12 w-full items-center justify-center rounded-xl border px-3 text-xs font-semibold text-center",
            stav.className,
          ].join(" ")}
        >
          {stav.text}
        </span>
      </div>

      <div className={centerCellClassName}>
        <form action={deleteKusAction} className="w-full">
          <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
          <input type="hidden" name="kus_id" value={kus.kus_id} />
          <button
            type="submit"
            className="h-12 w-full rounded-xl border border-red-800 bg-red-950 px-3 text-sm font-semibold text-red-100 transition hover:bg-red-900"
          >
            Smazat
          </button>
        </form>
      </div>
    </div>
  );
}
