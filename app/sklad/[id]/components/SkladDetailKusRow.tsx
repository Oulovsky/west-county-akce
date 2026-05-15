import { KusQrActionMenu } from "@/components/sklad/KusQrActionMenu";
import {
  formatMoney,
  formatNumber,
  getKusStatus,
  getSkladKusDisplayLabel,
} from "@/lib/sklad/helpers";
import type { SkladDetailRow, SkladKusRow, SkladPoskozeniRow } from "@/lib/sklad/types";
import type { UpdateKusPoradiResult } from "../actions/updateKusPoradi";
import { boxClassName, statusBoxClassName } from "../helpers/classNames";
import { SKLAD_DETAIL_CENTER_CELL_CLASS_NAME } from "../helpers/tableLayout";
import { SkladDetailKusPoradiField } from "./SkladDetailKusPoradiField";

const QR_DETAIL_TRIGGER =
  "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300 outline-none transition hover:border-slate-600 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/50";

type SkladDetailKusRowProps = {
  kus: SkladKusRow;
  row: SkladDetailRow;
  poskozeni: SkladPoskozeniRow[];
  rowGridClassName: string;
  deleteKusAction: (formData: FormData) => Promise<void>;
  updateKusPoradiAction: (
    formData: FormData
  ) => Promise<UpdateKusPoradiResult>;
};

export function SkladDetailKusRow({
  kus,
  row,
  poskozeni,
  rowGridClassName,
  deleteKusAction,
  updateKusPoradiAction,
}: SkladDetailKusRowProps) {
  const stav = getKusStatus(kus, poskozeni);
  const centerCellClassName = SKLAD_DETAIL_CENTER_CELL_CLASS_NAME;
  const label = getSkladKusDisplayLabel(row.nazev, kus);

  return (
    <div key={kus.kus_id} className={rowGridClassName}>
      <div className="flex min-w-0 items-start gap-1.5 px-2">
        <SkladDetailKusPoradiField
          skladovaPolozkaId={row.skladova_polozka_id}
          kusId={kus.kus_id}
          committedPoradi={kus.poradove_cislo}
          updateKusPoradiAction={updateKusPoradiAction}
        />

        <span
          className={[boxClassName(), "min-w-0 flex-1 truncate"].join(" ")}
          title={label}
        >
          {label}
        </span>

        <KusQrActionMenu
          kusId={kus.kus_id}
          triggerClassName={QR_DETAIL_TRIGGER}
          iconClassName="h-[26px] w-[26px]"
        />
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
