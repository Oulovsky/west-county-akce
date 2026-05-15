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
  selectedKategorieId: string;
  selectedPodkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  celkemKusu: number;
  poskozeneKusy: number;
  pouzitelneKusy: number;
  updateAction: (formData: FormData) => Promise<void>;
};

export function SkladDetailMainRow({
  row,
  editFormId,
  rowGridClassName,
  kategorie,
  selectedKategorieId,
  selectedPodkategorie,
  jednotky,
  celkemKusu,
  poskozeneKusy,
  pouzitelneKusy,
  updateAction,
}: SkladDetailMainRowProps) {
  const centerCellClassName = SKLAD_DETAIL_CENTER_CELL_CLASS_NAME;

  return (
    <>
      <form
        id={editFormId}
        action={updateAction}
        key={`${row.skladova_polozka_id}-${row.kategorie_techniky_id ?? "bez"}-${row.podkategorie_techniky_id ?? "bez"}-${row.pozice ?? "bez"}-${row.upraveno_dne}`}
      >
        <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
        <input type="hidden" name="celkem_k_dispozici" value={celkemKusu} />
      </form>

      <div className="bg-slate-950/30 px-3 py-3">
        <div className={rowGridClassName}>
          <div className="flex items-center px-2">
            <input
              form={editFormId}
              name="nazev"
              defaultValue={row.nazev}
              className={fieldClassName()}
            />
          </div>

          <div className="flex items-center px-2">
            <select
              form={editFormId}
              name="kategorie_techniky_id"
              defaultValue={selectedKategorieId}
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
              form={editFormId}
              name="podkategorie_techniky_id"
              defaultValue={row.podkategorie_techniky_id ?? ""}
              className={fieldClassName()}
            >
              <option value="">Bez podkategorie</option>
              {selectedPodkategorie.map((item) => (
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
              className={fieldClassName("text-center")}
            />
          </div>

          <div className={centerCellClassName}>
            <input
              form={editFormId}
              name="fakturacni_cena"
              defaultValue={row.fakturacni_cena ?? ""}
              inputMode="decimal"
              className={fieldClassName("text-center")}
            />
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
