"use client";

import { useSpravaKusSelection } from "@/app/sklad/sprava/components/SpravaKusSelectionContext";
import { formatMoney } from "@/app/sklad/sprava/components/formatMoney";
import { formatNumber } from "@/app/sklad/sprava/components/formatNumber";
import {
  spravaTableGridStyle,
  SPRAVA_CASE_CHILD_NAME_INDENT_CLASS,
  SPRAVA_CASE_CHILD_ROW_BG_CLASS,
  SPRAVA_CASE_CHILD_STICKY_BG_CLASS,
} from "@/app/sklad/sprava/components/spravaTableLayout";
import {
  SKLAD_EMPTY_LABEL,
  SKLAD_EMPTY_LABEL_EM,
  SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
} from "@/lib/sklad/constants";
import { buildSpravaVybranyKusFromObsahChild } from "@/lib/sklad/caseKus";
import { formatSkladKusStav } from "@/lib/sklad/helpers";
import type { SkladKusObsahChildRow } from "@/lib/sklad/kusObsahRead";
import type { SkladKusZakazkaAssignmentRow } from "@/lib/sklad/types";
import {
  formatZakazkaKusStav,
  formatZakazkaKusZakazkaLabel,
} from "@/lib/sklad/zakazkaKusy";
import type { SpravaObsahReturnTo } from "@/lib/sklad/spravaObsahUrl";
import {
  tableDangerBoxRight,
  tableMutedBoxRight,
  tableValueBoxLeft,
  tableValueBoxRight,
} from "@/app/sklad/sprava/components/styles";

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
  parentCaseLabel: string;
  returnPolozkaId: string;
  returnTo: SpravaObsahReturnTo;
  canEdit: boolean;
  assignment: SkladKusZakazkaAssignmentRow | null;
};

export function SpravaCaseObsahChildRow({
  child,
  parentKusId,
  parentCaseLabel,
  returnPolozkaId: _returnPolozkaId,
  returnTo: _returnTo,
  canEdit,
  assignment,
}: Props) {
  const { isKusSelected, toggleKus } = useSpravaKusSelection();
  const vybranyKus = buildSpravaVybranyKusFromObsahChild(
    child,
    parentKusId,
    parentCaseLabel
  );
  const checked = isKusSelected(child.childKusId);

  const labelTitle = `${child.displayLabel} · ${formatSkladKusStav(child.stav)}`;
  const skladem = assignment ? 0 : kusSklademCell(child.stav);
  const naZakazkach = assignment ? 1 : kusNaZakazkachCell(child.stav);
  const fyzickyNaZakazkach = assignment ? 1 : 0;
  const poskozene = kusPoskozeneCell(child.stav);
  const assignmentTitle = assignment
    ? `${formatZakazkaKusZakazkaLabel(assignment)} · ${formatZakazkaKusStav(assignment.stav)}`
    : "Kus není přiřazen k aktivní zakázce.";

  return (
    <li
      className={`border-t border-emerald-900/25 ${SPRAVA_CASE_CHILD_ROW_BG_CLASS}`}
      role="listitem"
    >
      <div className={CHILD_SUBROW_GRID_CLASS} style={spravaTableGridStyle}>
        <div
          className={`sticky left-0 z-10 flex min-h-8 min-w-0 items-center gap-1.5 ${SPRAVA_CASE_CHILD_NAME_INDENT_CLASS} ${SPRAVA_CASE_CHILD_STICKY_BG_CLASS} pr-1 pt-0.5`}
        >
          <span
            className="inline-block h-8 w-4 shrink-0 border-l-2 border-emerald-600/55"
            aria-hidden
          />
          <input
            type="checkbox"
            checked={checked}
            onChange={() => toggleKus(vybranyKus)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Vybrat ${child.displayLabel}`}
            className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-950 text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/60 disabled:opacity-50"
          />
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
      </div>
    </li>
  );
}
