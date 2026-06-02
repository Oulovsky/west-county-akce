import { SkladKusObsahInlinePanel } from "@/components/sklad/SkladKusObsahInlinePanel";
import { KusQrActionMenu } from "@/components/sklad/KusQrActionMenu";
import {
  formatMoney,
  formatNumber,
  getKusStatus,
  getSkladKusDisplayLabel,
} from "@/lib/sklad/helpers";
import Link from "next/link";
import {
  formatKusObsahContainedHint,
  formatKusObsahParentHint,
  type SkladKusObsahChildOption,
  type SkladKusObsahChildRow,
  type SkladKusObsahKusSummary,
} from "@/lib/sklad/kusObsah";
import type { SkladDetailRow, SkladKusRow, SkladOdpisovePasmo, SkladPoskozeniRow } from "@/lib/sklad/types";
import type { UpdateKusPoradiResult } from "../actions/updateKusPoradi";
import { boxClassName, statusBoxClassName } from "../helpers/classNames";
import { SKLAD_DETAIL_CENTER_CELL_CLASS_NAME } from "../helpers/tableLayout";
import { SkladKusAssetFields, SkladKusAssetSummary } from "./SkladKusAssetFields";
import { SkladDetailKusPoradiField } from "./SkladDetailKusPoradiField";

const QR_DETAIL_TRIGGER =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 outline-none transition hover:border-slate-600 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/50";

type SkladDetailKusRowProps = {
  kus: SkladKusRow;
  row: SkladDetailRow;
  poskozeni: SkladPoskozeniRow[];
  odpisovaPasma: SkladOdpisovePasmo[];
  rowGridClassName: string;
  deleteKusAction: (formData: FormData) => Promise<void>;
  updateKusPoradiAction: (
    formData: FormData
  ) => Promise<UpdateKusPoradiResult>;
  obsahSummary?: SkladKusObsahKusSummary | null;
  activeChildren?: SkladKusObsahChildRow[];
  availableChildOptions?: SkladKusObsahChildOption[];
  openCaseKusId?: string | null;
  returnPolozkaId?: string;
  obsahMessage?: string | null;
  obsahError?: string | null;
  readOnly?: boolean;
};

export function SkladDetailKusRow({
  kus,
  row,
  poskozeni,
  odpisovaPasma,
  rowGridClassName,
  deleteKusAction,
  updateKusPoradiAction,
  obsahSummary = null,
  activeChildren = [],
  availableChildOptions = [],
  openCaseKusId = null,
  returnPolozkaId,
  obsahMessage = null,
  obsahError = null,
  readOnly = false,
}: SkladDetailKusRowProps) {
  const stav = getKusStatus(kus, poskozeni);
  const centerCellClassName = SKLAD_DETAIL_CENTER_CELL_CLASS_NAME;
  const label = getSkladKusDisplayLabel(row.nazev, kus);
  const containedCount = obsahSummary?.containedCount ?? activeChildren.length;
  const containedHint = formatKusObsahContainedHint(containedCount);
  const parentPlacement = obsahSummary?.parentPlacement ?? null;
  const isCaseOpen = openCaseKusId === kus.kus_id;
  const showObsahMessages = isCaseOpen;

  return (
    <div key={kus.kus_id} className="rounded-xl border border-slate-800 bg-slate-950">
      <div className={rowGridClassName}>
      <div className="flex min-w-0 items-start gap-1 px-1">
        <SkladDetailKusPoradiField
          skladovaPolozkaId={row.skladova_polozka_id}
          kusId={kus.kus_id}
          committedPoradi={kus.poradove_cislo}
          updateKusPoradiAction={updateKusPoradiAction}
          readOnly={readOnly}
        />

        <div className="min-w-0 flex-1">
          <span className={[boxClassName(), "block truncate"].join(" ")} title={label}>
            {label}
          </span>
          {containedHint ? (
            <span className="mt-1 block text-[10px] font-semibold text-emerald-300/90">
              {containedHint}
            </span>
          ) : null}
          {parentPlacement ? (
            <span className="mt-0.5 block text-[10px] font-semibold text-blue-300/90">
              <Link
                href={`/sklad/kus/${parentPlacement.parentKusId}`}
                className="hover:text-blue-200"
              >
                {formatKusObsahParentHint(parentPlacement)}
              </Link>
            </span>
          ) : null}
        </div>

        <KusQrActionMenu
          kusId={kus.kus_id}
          label={{
            kusId: kus.kus_id,
            itemName: row.nazev,
            poradoveCislo: kus.poradove_cislo,
            position: row.pozice,
          }}
          triggerClassName={QR_DETAIL_TRIGGER}
          iconClassName="h-[18px] w-[18px]"
        />
      </div>

      <div className="flex items-center px-2">
        <span className={boxClassName("truncate")} title={row.kategorie_nazev ?? "-"}>
          {row.kategorie_nazev ?? "-"}
        </span>
      </div>

      <div className="flex items-center px-2">
        <span className={boxClassName("truncate")} title={row.podkategorie_nazev ?? "-"}>
          {row.podkategorie_nazev ?? "-"}
        </span>
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
        <SkladKusAssetSummary kus={kus} odpisovaPasma={odpisovaPasma} />
      </div>

      <div className={centerCellClassName}>
        <span
          className={[
            "flex min-h-9 w-full min-w-0 items-center justify-center rounded-lg border px-2 text-center text-[10px] font-semibold leading-tight",
            stav.className,
          ].join(" ")}
          title={stav.text}
        >
          <span className="whitespace-normal break-words">{stav.text}</span>
        </span>
      </div>

      <div className={centerCellClassName}>
        {readOnly ? (
          <span className="flex h-10 w-full items-center justify-center text-xs text-slate-500">—</span>
        ) : (
          <form action={deleteKusAction} className="w-full">
            <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
            <input type="hidden" name="kus_id" value={kus.kus_id} />
            <button
              type="submit"
              className="h-10 w-full rounded-lg border border-red-800 bg-red-950 px-2 text-xs font-semibold text-red-100 transition hover:bg-red-900"
            >
              Smazat
            </button>
          </form>
        )}
      </div>
    </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-3 py-2">
        <details className="min-w-0 flex-1" open={isCaseOpen}>
          <summary className="cursor-pointer list-none">
            <span className="inline-flex min-h-9 items-center rounded-lg border border-emerald-700/80 bg-emerald-950/60 px-3 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-900/80">
              {containedHint ? `${containedHint} · ` : ""}
              Spravovat obsah case
            </span>
          </summary>
          <div className="mt-3">
            <SkladKusObsahInlinePanel
              parentKusId={kus.kus_id}
              parentDisplayLabel={label}
              activeChildren={activeChildren}
              availableOptions={availableChildOptions}
              canEdit={!readOnly}
              returnPolozkaId={returnPolozkaId}
              obsahMessage={showObsahMessages ? obsahMessage : null}
              obsahError={showObsahMessages ? obsahError : null}
            />
          </div>
        </details>
        <Link
          href={`/sklad/kus/${kus.kus_id}`}
          className="inline-flex min-h-9 items-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white"
        >
          Detail kusu
        </Link>
      </div>

      <details className="border-t border-slate-800 px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-blue-200 transition hover:text-blue-100">
          Upravit hodnotu a odpisy kusu
        </summary>
        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <SkladKusAssetFields kus={kus} odpisovaPasma={odpisovaPasma} />
        </div>
      </details>
    </div>
  );
}
