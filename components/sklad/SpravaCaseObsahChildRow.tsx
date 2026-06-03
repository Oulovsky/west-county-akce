"use client";

import Link from "next/link";
import { KusQrActionMenu } from "@/components/sklad/KusQrActionMenu";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getSkladKusFuturePath } from "@/lib/sklad/kusLabels";
import { formatMoney } from "@/app/sklad/sprava/components/formatMoney";
import { formatNumber } from "@/app/sklad/sprava/components/formatNumber";
import { spravaTableGridStyle } from "@/app/sklad/sprava/components/spravaTableLayout";
import {
  SKLAD_EMPTY_LABEL,
  SKLAD_EMPTY_LABEL_EM,
  SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
} from "@/lib/sklad/constants";
import { formatSkladKusStav } from "@/lib/sklad/helpers";
import type { SkladKusObsahChildRow } from "@/lib/sklad/kusObsahRead";
import type { SkladKusZakazkaAssignmentRow } from "@/lib/sklad/types";
import {
  formatZakazkaKusStav,
  formatZakazkaKusZakazkaLabel,
} from "@/lib/sklad/zakazkaKusy";
import { removeKusFromCaseAction } from "@/app/sklad/kusObsahActions";
import type { SpravaObsahReturnTo } from "@/lib/sklad/spravaObsahUrl";
import {
  tableDangerBoxRight,
  tableMutedBoxRight,
  tableValueBoxLeft,
  tableValueBoxRight,
} from "@/app/sklad/sprava/components/styles";

const SPRAVA_QR_TRIGGER =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-950 text-slate-300 outline-none transition hover:border-slate-500 hover:bg-slate-900 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-500/60";

const CHILD_DETAIL_LINK_CLASS =
  "inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-slate-600 bg-slate-900 px-1.5 text-[10px] font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white";

const CHILD_SUBROW_GRID_CLASS = "grid items-start px-2 py-1 text-xs text-slate-300";

function inheritedBoxText(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : SKLAD_EMPTY_LABEL_EM;
}

function kusSklademCell(stav: string): number {
  const s = stav?.trim();
  if (s === "na_akci" || s === "odpis") return 0;
  if (s === "skladem" || s === "poskozeno") return 1;
  return 0;
}

function kusNaZakazkachCell(stav: string): number {
  return stav?.trim() === "na_akci" ? 1 : 0;
}

function kusPoskozeneCell(stav: string): number {
  const s = stav?.trim();
  if (s === "poskozeno" || s === "odpis") return 1;
  return 0;
}

type Props = {
  child: SkladKusObsahChildRow;
  parentKusId: string;
  returnPolozkaId: string;
  returnTo: SpravaObsahReturnTo;
  canEdit: boolean;
  assignment: SkladKusZakazkaAssignmentRow | null;
};

export function SpravaCaseObsahChildRow({
  child,
  parentKusId,
  returnPolozkaId,
  returnTo,
  canEdit,
  assignment,
}: Props) {
  const labelTitle = `${child.displayLabel} · ${formatSkladKusStav(child.stav)}`;
  const skladem = assignment ? 0 : kusSklademCell(child.stav);
  const naZakazkach = assignment ? 1 : kusNaZakazkachCell(child.stav);
  const fyzickyNaZakazkach = assignment ? 1 : 0;
  const poskozene = kusPoskozeneCell(child.stav);
  const assignmentLabel = formatZakazkaKusZakazkaLabel(assignment);
  const assignmentTitle = assignment
    ? `${assignmentLabel} · ${formatZakazkaKusStav(assignment.stav)}`
    : "Kus není přiřazen k aktivní zakázce.";

  return (
    <li className="border-t border-slate-800/60" role="listitem">
      <div className={CHILD_SUBROW_GRID_CLASS} style={spravaTableGridStyle}>
        <div className="sticky left-0 z-10 flex min-h-8 min-w-0 items-center gap-1 bg-slate-950/95 pr-1 pt-0.5">
          <span className="inline-block h-8 w-8 shrink-0" aria-hidden />
          <span className="inline-block h-8 w-4 shrink-0 border-l-2 border-emerald-700/50" aria-hidden />
          <span
            className="min-w-0 flex-1 truncate pl-0.5 font-medium text-slate-200"
            title={labelTitle}
          >
            {child.displayLabel}
          </span>
        </div>

        <div className="flex min-h-8 min-w-0 items-center px-1 pt-0.5">
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={inheritedBoxText(child.blokNazev)}
          >
            {inheritedBoxText(child.blokNazev)}
          </span>
        </div>

        <div className="flex min-h-8 min-w-0 items-center px-1 pt-0.5">
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={inheritedBoxText(child.kategorieNazev)}
          >
            {inheritedBoxText(child.kategorieNazev)}
          </span>
        </div>

        <div className="flex min-h-8 min-w-0 items-center px-1 pt-0.5">
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={inheritedBoxText(child.podkategorieNazev)}
          >
            {inheritedBoxText(child.podkategorieNazev)}
          </span>
        </div>

        <div className="flex min-h-8 min-w-0 items-center justify-center px-1 pt-0.5 text-center">
          <span
            style={tableValueBoxLeft}
            className="truncate text-[11px]"
            title={inheritedBoxText(child.technickyVlastnikNazev)}
          >
            {inheritedBoxText(child.technickyVlastnikNazev)}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          <span style={tableValueBoxRight} className="truncate text-[11px]">
            {child.polozkaPozice != null && String(child.polozkaPozice).trim() !== ""
              ? formatNumber(child.polozkaPozice)
              : SKLAD_EMPTY_LABEL_EM}
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
            {child.jednotka ?? SKLAD_EMPTY_LABEL}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          <span style={tableValueBoxRight} className="truncate text-[11px]">
            {formatMoney(child.cenaAkce)}
          </span>
        </div>

        <div className="flex min-h-8 w-full min-w-0 items-center justify-center gap-0.5 px-0.5 pt-0.5">
          <Link
            href={getSkladKusFuturePath(child.childKusId)}
            className={CHILD_DETAIL_LINK_CLASS}
            title={`Detail kusu ${child.displayLabel}`}
          >
            Detail
          </Link>
          <KusQrActionMenu
            kusId={child.childKusId}
            label={{
              kusId: child.childKusId,
              itemName: child.polozkaNazev,
              poradoveCislo: child.poradoveCislo,
              position: child.polozkaPozice,
              sector: child.blokNazev,
            }}
            triggerClassName={SPRAVA_QR_TRIGGER}
            iconClassName="h-3.5 w-3.5"
            menuVariant="sprava"
            hideDetailLink
          />
          {canEdit ? (
            <form action={removeKusFromCaseAction} className="min-w-0 flex-1">
              <input type="hidden" name="parent_kus_id" value={parentKusId} />
              <input type="hidden" name="return_polozka_id" value={returnPolozkaId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="obsah_id" value={child.obsahId} />
              <SubmitButton
                pendingText="Odebírám…"
                className="flex h-7 w-full min-w-0 items-center justify-center rounded-md border border-amber-700/90 bg-amber-950 px-1 text-[10px] font-semibold text-amber-100 transition hover:bg-amber-900 disabled:hover:bg-amber-950"
              >
                Odebrat
              </SubmitButton>
            </form>
          ) : null}
        </div>
      </div>
    </li>
  );
}
