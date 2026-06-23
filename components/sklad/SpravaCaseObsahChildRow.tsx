"use client";

import type { CSSProperties } from "react";
import { SkladKusCaseTreePanel } from "@/components/sklad/SkladKusCaseTreePanel";
import { useSpravaKusSelection } from "@/app/sklad/sprava/components/SpravaKusSelectionContext";
import { SpravaObsahExpandControl } from "@/app/sklad/sprava/components/SpravaObsahExpandControl";
import {
  SpravaPolozkaInlineJednotkaSelect,
  SpravaPolozkaInlineSelects,
} from "@/app/sklad/sprava/components/SpravaPolozkaInlineSelects";
import { formatMoney } from "@/app/sklad/sprava/components/formatMoney";
import { formatNumber } from "@/app/sklad/sprava/components/formatNumber";
import type { SpravaCaseObsahTreeBindings } from "@/app/sklad/sprava/components/spravaCaseObsahTreeTypes";
import {
  spravaTableGridStyle,
  SPRAVA_CASE_CHILD_ROW_BG_CLASS,
  SPRAVA_CASE_CHILD_STICKY_BG_CLASS,
  SPRAVA_CASE_EXPANDED_BLOCK_CLASS,
  SPRAVA_TABLE_BODY_SUBROW_GRID,
} from "@/app/sklad/sprava/components/spravaTableLayout";
import {
  tableValueBoxRight,
  tableMutedBoxRight,
  tableDangerBoxRight,
} from "@/app/sklad/sprava/components/styles";
import {
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

function childNameIndentStyle(depth: number): CSSProperties {
  return { paddingLeft: `${2.5 + depth * 1.5}rem` };
}

type Props = {
  child: SkladKusObsahChildRow;
  parentKusId: string;
  parentCaseLabel: string;
  returnPolozkaId: string;
  returnTo: SpravaObsahReturnTo;
  canEdit: boolean;
  assignment: SkladKusZakazkaAssignmentRow | null;
  obsahTree: SpravaCaseObsahTreeBindings;
  depth?: number;
};

export function SpravaCaseObsahChildRow({
  child,
  parentKusId,
  parentCaseLabel,
  returnPolozkaId: _returnPolozkaId,
  returnTo,
  canEdit,
  assignment,
  obsahTree,
  depth = 0,
}: Props) {
  const { isKusSelected, toggleKus } = useSpravaKusSelection();
  const vybranyKus = buildSpravaVybranyKusFromObsahChild(
    child,
    parentKusId,
    parentCaseLabel
  );
  const checked = isKusSelected(child.childKusId);

  const readOnly = !canEdit || !obsahTree.canEditObsah;
  const polozkaId = child.skladovaPolozkaId;

  const labelTitle = `${child.displayLabel} · ${formatSkladKusStav(child.stav)}`;
  const skladem = assignment ? 0 : kusSklademCell(child.stav);
  const naZakazkach = assignment ? 1 : kusNaZakazkachCell(child.stav);
  const fyzickyNaZakazkach = assignment ? 1 : 0;
  const poskozene = kusPoskozeneCell(child.stav);
  const assignmentTitle = assignment
    ? `${formatZakazkaKusZakazkaLabel(assignment)} · ${formatZakazkaKusStav(assignment.stav)}`
    : "Kus není přiřazen k aktivní zakázce.";

  const nestedChildren =
    obsahTree.childrenByParentKusId.get(child.childKusId) ?? [];
  const isObsahExpanded = obsahTree.expandedKusIds.has(child.childKusId);
  const showInsertForm = obsahTree.insertFormKusId === child.childKusId;
  const showUrlFlash =
    isObsahExpanded && obsahTree.openCaseKusId === child.childKusId;

  return (
    <li
      className={[
        "border-t border-emerald-900/25",
        SPRAVA_CASE_CHILD_ROW_BG_CLASS,
        isObsahExpanded ? SPRAVA_CASE_EXPANDED_BLOCK_CLASS : "",
      ].join(" ")}
      role="listitem"
    >
      <div className={SPRAVA_TABLE_BODY_SUBROW_GRID} style={spravaTableGridStyle}>
        <div
          className={`sticky left-0 z-10 flex min-h-8 min-w-0 items-center gap-1.5 ${SPRAVA_CASE_CHILD_STICKY_BG_CLASS} pr-1 pt-0.5`}
          style={childNameIndentStyle(depth)}
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
          <SpravaObsahExpandControl
            isExpanded={isObsahExpanded}
            onToggle={() => obsahTree.onToggleExpand(child.childKusId)}
            label={child.displayLabel}
          />
          <span
            className="min-w-0 flex-1 truncate pl-0.5 font-medium text-slate-200"
            title={labelTitle}
          >
            {child.displayLabel}
          </span>
        </div>

        <SpravaPolozkaInlineSelects
          polozkaId={polozkaId}
          fields={{
            skladBlokId: child.skladBlokId,
            kategorieTechnikyId: child.kategorieTechnikyId,
            podkategorieTechnikyId: child.podkategorieTechnikyId,
            technickyVlastnikId: child.technickyVlastnikId,
            technickyVlastnikNazev: child.technickyVlastnikNazev,
            jednotka: child.jednotka ?? null,
          }}
          labels={{
            blokNazev: child.blokNazev,
            kategorieNazev: child.kategorieNazev,
            podkategorieNazev: child.podkategorieNazev,
            technickyVlastnikNazev: child.technickyVlastnikNazev,
          }}
          polozkaUpdaters={obsahTree.polozkaUpdaters}
          bloky={obsahTree.bloky}
          vlastnici={obsahTree.vlastnici}
          readOnly={readOnly}
        />

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
          <SpravaPolozkaInlineJednotkaSelect
            polozkaId={polozkaId}
            jednotka={child.jednotka ?? null}
            polozkaUpdaters={obsahTree.polozkaUpdaters}
            readOnly={readOnly}
          />
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 pt-0.5 text-center">
          <span style={tableValueBoxRight} className="truncate text-[11px]">
            {formatMoney(child.cenaAkce)}
          </span>
        </div>
      </div>

      {isObsahExpanded ? (
        <SkladKusCaseTreePanel
          parentKusId={child.childKusId}
          parentDisplayLabel={child.displayLabel}
          activeChildren={nestedChildren}
          obsahTree={obsahTree}
          returnTo={returnTo}
          layout="sprava"
          showInsertForm={showInsertForm}
          showUrlFlash={showUrlFlash}
          depth={depth + 1}
        />
      ) : null}
    </li>
  );
}
