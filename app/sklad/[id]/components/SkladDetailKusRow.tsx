import { SkladKusCaseTreePanel } from "@/components/sklad/SkladKusCaseTreePanel";
import { KusQrActionMenu } from "@/components/sklad/KusQrActionMenu";
import {
  formatMoney,
  formatNumber,
  getKusStatus,
  getSkladKusDisplayLabel,
} from "@/lib/sklad/helpers";
import Link from "next/link";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  formatKusObsahContainedHint,
  formatKusObsahContainedLabel,
  formatKusObsahParentHint,
  type SkladKusObsahChildOption,
  type SkladKusObsahChildRow,
  type SkladKusObsahKusSummary,
} from "@/lib/sklad/kusObsah";
import type {
  SkladBlok,
  SkladDetailRow,
  SkladJednotka,
  SkladKategorie,
  SkladKusRow,
  SkladOdpisovePasmo,
  SkladPodkategorie,
  SkladPoskozeniRow,
  TechnickyVlastnik,
} from "@/lib/sklad/types";
import type { UpdateKusPoradiResult } from "../actions/updateKusPoradi";
import { boxClassName, statusBoxClassName } from "../helpers/classNames";
import { SKLAD_DETAIL_CENTER_CELL_CLASS_NAME } from "../helpers/tableLayout";
import { SkladKusAssetFields, SkladKusAssetSummary } from "./SkladKusAssetFields";
import { SkladDetailKusPoradiField } from "./SkladDetailKusPoradiField";

const QR_TRIGGER =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 outline-none transition hover:border-slate-600 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/50";

const TREE_CHEVRON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-800/60 bg-emerald-950/40 text-sm font-bold text-emerald-200 transition hover:border-emerald-600 hover:bg-emerald-900/60 hover:text-white";

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
  isCasePolozka: boolean;
  obsahSummary?: SkladKusObsahKusSummary | null;
  activeChildren?: SkladKusObsahChildRow[];
  availableChildOptions?: SkladKusObsahChildOption[];
  openCaseKusId?: string | null;
  obsahMode?: string | null;
  returnPolozkaId?: string;
  readOnly?: boolean;
  formDefaults: {
    skladBlokId: string | null;
    kategorieTechnikyId: string | null;
    podkategorieTechnikyId: string | null;
    technickyVlastnikId: string | null;
    jednotka: string;
  };
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  vlastnici: TechnickyVlastnik[];
};

export function SkladDetailKusRow({
  kus,
  row,
  poskozeni,
  odpisovaPasma,
  rowGridClassName,
  deleteKusAction,
  updateKusPoradiAction,
  isCasePolozka,
  obsahSummary = null,
  activeChildren = [],
  availableChildOptions = [],
  openCaseKusId = null,
  obsahMode = null,
  returnPolozkaId,
  readOnly = false,
  formDefaults,
  bloky,
  kategorie,
  podkategorie,
  jednotky,
  vlastnici,
}: SkladDetailKusRowProps) {
  const stav = getKusStatus(kus, poskozeni);
  const centerCellClassName = SKLAD_DETAIL_CENTER_CELL_CLASS_NAME;
  const label = getSkladKusDisplayLabel(row.nazev, kus);
  const parentPlacement = obsahSummary?.parentPlacement ?? null;
  const containedCount = activeChildren.length;
  const isCaseExpanded = isCasePolozka && openCaseKusId === kus.kus_id;
  const showInsertForm = isCaseExpanded && obsahMode === "insert";
  const showObsahMessages = isCaseExpanded;
  const expandHref =
    returnPolozkaId != null
      ? `/sklad/${returnPolozkaId}?obsahCase=${kus.kus_id}`
      : null;
  const collapseHref = returnPolozkaId != null ? `/sklad/${returnPolozkaId}` : null;
  const collapsedContainedHint =
    formatKusObsahContainedHint(containedCount) ??
    (isCasePolozka ? formatKusObsahContainedLabel(0).toLowerCase() : null);

  return (
    <div
      className={[
        "rounded-xl border bg-slate-950",
        isCaseExpanded
          ? "border-emerald-800/50 ring-1 ring-emerald-900/30"
          : "border-slate-800",
      ].join(" ")}
    >
      <div className={rowGridClassName}>
        <div className="flex min-w-0 items-start gap-1 px-1">
          {isCasePolozka && expandHref && collapseHref ? (
            <Link
              href={isCaseExpanded ? collapseHref : expandHref}
              className={TREE_CHEVRON}
              title={isCaseExpanded ? "Sbalit obsah case" : "Rozbalit obsah case"}
              aria-expanded={isCaseExpanded}
            >
              {isCaseExpanded ? "▾" : "▸"}
            </Link>
          ) : null}

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
            {isCasePolozka && !isCaseExpanded && collapsedContainedHint ? (
              <span className="mt-1 block text-[10px] font-semibold text-emerald-300/90">
                {collapsedContainedHint}
              </span>
            ) : null}
            {!isCasePolozka && parentPlacement ? (
              <span className="mt-1 block text-[10px] font-semibold text-blue-300/90">
                <Link
                  href={`/sklad/kus/${parentPlacement.parentKusId}`}
                  className="hover:text-blue-200"
                >
                  {formatKusObsahParentHint(parentPlacement)}
                </Link>
              </span>
            ) : null}
            {isCasePolozka && !isCaseExpanded ? (
              <Link
                href={`/sklad/kus/${kus.kus_id}`}
                className="mt-1 inline-flex text-[10px] font-semibold text-slate-400 hover:text-white"
              >
                Detail kusu
              </Link>
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
            triggerClassName={QR_TRIGGER}
            iconClassName="h-[18px] w-[18px]"
            hideDetailLink={isCasePolozka}
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
            <span className="flex h-10 w-full items-center justify-center text-xs text-slate-500">
              —
            </span>
          ) : (
            <form action={deleteKusAction} className="w-full">
              <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
              <input type="hidden" name="kus_id" value={kus.kus_id} />
              <SubmitButton
                pendingText="Mažu…"
                className="h-10 w-full rounded-lg border border-red-800 bg-red-950 px-2 text-xs font-semibold text-red-100 transition hover:bg-red-900 disabled:hover:bg-red-950"
              >
                Smazat
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {isCaseExpanded && returnPolozkaId ? (
        <SkladKusCaseTreePanel
          parentKusId={kus.kus_id}
          parentDisplayLabel={label}
          activeChildren={activeChildren}
          availableOptions={availableChildOptions}
          canEdit={!readOnly}
          returnPolozkaId={returnPolozkaId}
          showInsertForm={showInsertForm}
          showUrlFlash={showObsahMessages}
          formDefaults={formDefaults}
          bloky={bloky}
          kategorie={kategorie}
          podkategorie={podkategorie}
          jednotky={jednotky}
          vlastnici={vlastnici}
        />
      ) : null}

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
