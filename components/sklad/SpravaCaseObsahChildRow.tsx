"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { SelectWithQuickCreate } from "@/app/sklad/sprava/components/SelectWithQuickCreate";
import { SkladKusCaseTreePanel } from "@/components/sklad/SkladKusCaseTreePanel";
import { useSpravaKusSelection } from "@/app/sklad/sprava/components/SpravaKusSelectionContext";
import { SpravaObsahExpandControl } from "@/app/sklad/sprava/components/SpravaObsahExpandControl";
import { formatMoney } from "@/app/sklad/sprava/components/formatMoney";
import { formatNumber } from "@/app/sklad/sprava/components/formatNumber";
import type { SpravaCaseObsahTreeBindings } from "@/app/sklad/sprava/components/spravaCaseObsahTreeTypes";
import {
  spravaTableGridStyle,
  SPRAVA_CASE_CHILD_ROW_BG_CLASS,
  SPRAVA_CASE_CHILD_STICKY_BG_CLASS,
  SPRAVA_CASE_EXPANDED_BLOCK_CLASS,
  SPRAVA_TABLE_BODY_SUBROW_GRID,
  SPRAVA_TABLE_INHERITED_CELL,
} from "@/app/sklad/sprava/components/spravaTableLayout";
import {
  tableSelectStyle,
  tableValueBoxLeft,
  tableValueBoxRight,
  tableMutedBoxRight,
  tableDangerBoxRight,
} from "@/app/sklad/sprava/components/styles";
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

  const polozkaUpdaters = obsahTree.polozkaUpdaters;
  const canEditFields = canEdit && obsahTree.canEditObsah && !!polozkaUpdaters;
  const isSaving =
    polozkaUpdaters?.savingPolozkaId === child.skladovaPolozkaId;

  const podkategorieOptions = useMemo(
    () =>
      polozkaUpdaters?.getPodkategorieOptions(child.podkategorieTechnikyId) ??
      [],
    [child.podkategorieTechnikyId, polozkaUpdaters]
  );

  const jednotkaOptions = useMemo(
    () =>
      polozkaUpdaters?.getJednotkaOptions(child.jednotka) ?? [],
    [child.jednotka, polozkaUpdaters]
  );

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

  const polozkaId = child.skladovaPolozkaId;

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

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          {canEditFields ? (
            <SelectWithQuickCreate
              variant="table"
              showQuickCreate={false}
              value={child.skladBlokId ?? ""}
              disabled={isSaving}
              onChange={(value) =>
                polozkaUpdaters.onUpdateZaklad(polozkaId, {
                  blokId: value || null,
                })
              }
              selectStyle={tableSelectStyle}
              selectClassName="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
              placeholder="Nepřiřazeno"
              options={obsahTree.bloky.map((b) => ({
                value: b.sklad_blok_id,
                label: b.nazev,
              }))}
            />
          ) : (
            <span
              style={tableValueBoxLeft}
              className="truncate text-[11px]"
              title={inheritedBoxText(child.blokNazev)}
            >
              {inheritedBoxText(child.blokNazev)}
            </span>
          )}
        </div>

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          {canEditFields ? (
            <SelectWithQuickCreate
              variant="table"
              showQuickCreate={false}
              value={child.kategorieTechnikyId ?? ""}
              disabled={isSaving}
              onChange={(value) =>
                polozkaUpdaters.onUpdateZaklad(polozkaId, {
                  kategorieId: value || null,
                })
              }
              selectStyle={tableSelectStyle}
              selectClassName="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
              placeholder="Bez kategorie"
              options={polozkaUpdaters.kategorieOptions.map((k) => ({
                value: k.kategorie_techniky_id,
                label: k.nazev,
              }))}
            />
          ) : (
            <span
              style={tableValueBoxLeft}
              className="truncate text-[11px]"
              title={inheritedBoxText(child.kategorieNazev)}
            >
              {inheritedBoxText(child.kategorieNazev)}
            </span>
          )}
        </div>

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          {canEditFields ? (
            <SelectWithQuickCreate
              variant="table"
              showQuickCreate={false}
              value={child.podkategorieTechnikyId ?? ""}
              disabled={isSaving}
              onChange={(value) =>
                polozkaUpdaters.onUpdateZaklad(polozkaId, {
                  podkategorieId: value || null,
                })
              }
              selectStyle={tableSelectStyle}
              selectClassName="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
              placeholder="Bez podkategorie"
              options={podkategorieOptions.map((p) => ({
                value: p.podkategorie_techniky_id,
                label: p.nazev,
              }))}
            />
          ) : (
            <span
              style={tableValueBoxLeft}
              className="truncate text-[11px]"
              title={inheritedBoxText(child.podkategorieNazev)}
            >
              {inheritedBoxText(child.podkategorieNazev)}
            </span>
          )}
        </div>

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          {canEditFields ? (
            <select
              value={child.technickyVlastnikId ?? ""}
              disabled={isSaving}
              onChange={(e) => {
                const value = e.target.value;
                if (value) polozkaUpdaters.onUpdateVlastnik(polozkaId, value);
              }}
              style={tableSelectStyle}
              className="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
              title="Vlastník techniky"
            >
              {(child.technickyVlastnikId &&
              !obsahTree.vlastnici.some(
                (v) => v.id === child.technickyVlastnikId && v.aktivni
              )
                ? [
                    {
                      id: child.technickyVlastnikId,
                      nazev:
                        child.technickyVlastnikNazev ?? "Neznámý vlastník",
                      aktivni: false,
                    },
                  ]
                : []
              ).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nazev}
                  {!v.aktivni ? " (neaktivní)" : ""}
                </option>
              ))}
              {obsahTree.vlastnici
                .filter((v) => v.aktivni)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nazev}
                  </option>
                ))}
            </select>
          ) : (
            <span
              style={tableValueBoxLeft}
              className="truncate text-[11px]"
              title={inheritedBoxText(child.technickyVlastnikNazev)}
            >
              {inheritedBoxText(child.technickyVlastnikNazev)}
            </span>
          )}
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
          {canEditFields ? (
            <SelectWithQuickCreate
              variant="table"
              showQuickCreate={false}
              value={child.jednotka ?? ""}
              disabled={isSaving}
              onChange={(value) =>
                polozkaUpdaters.onUpdateJednotka(polozkaId, value)
              }
              selectStyle={tableSelectStyle}
              selectClassName="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
              placeholder="Jednotka"
              options={jednotkaOptions.map((j) => ({
                value: j.nazev,
                label: j.nazev,
              }))}
            />
          ) : (
            <span style={tableValueBoxLeft} className="truncate text-[11px]">
              {child.jednotka ?? SKLAD_EMPTY_LABEL}
            </span>
          )}
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
