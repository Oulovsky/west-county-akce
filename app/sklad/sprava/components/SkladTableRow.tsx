"use client";

import Link from "next/link";
import { Dispatch, KeyboardEvent, SetStateAction, useState } from "react";
import { formatMoney } from "./formatMoney";
import { formatNumber } from "./formatNumber";
import { toNumber } from "./toNumber";
import { SelectWithQuickCreate } from "./SelectWithQuickCreate";
import {
  SPRAVA_TABLE_GRID,
  SPRAVA_TABLE_ROW_CLASS,
} from "./spravaTableLayout";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
  SkladPolozkaRow,
} from "@/lib/sklad/types";
import {
  tableDangerBoxRight,
  tableInputStyle,
  tableInputStyleSmall,
  tableMutedBoxRight,
  tableSelectStyle,
  tableValueBoxLeft,
  tableValueBoxRight,
} from "./styles";

type QuickCreateHandler = (name: string) => Promise<{ error?: string } | void>;

type Draft = {
  nazev: string;
  kusy: string;
  jednotka: string;
  naklad: string;
  rent: string;
};

type Props = {
  item: SkladPolozkaRow;
  isEditing: boolean;
  isSaving: boolean;
  isHighlight: boolean;
  draft: Draft;
  bloky: SkladBlok[];
  jednotky: SkladJednotka[];
  kategorieOptions: SkladKategorie[];
  podkategorieOptions: SkladPodkategorie[];
  onStartEdit: () => void;
  onUpdateZaklad: (
    kategorieId: string | null,
    podkategorieId: string | null,
    blokId: string | null
  ) => void;
  onDraftChange: Dispatch<SetStateAction<Draft>>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onQuickCreateBlok: QuickCreateHandler;
  onQuickCreateKategorie: QuickCreateHandler;
  onQuickCreatePodkategorie: QuickCreateHandler;
  onQuickCreateJednotka: QuickCreateHandler;
};

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={[
        "h-3.5 w-3.5 transition-transform",
        expanded ? "rotate-90" : "",
      ].join(" ")}
      fill="currentColor"
    >
      <path d="M6 4l5 4-5 4V4z" />
    </svg>
  );
}

export function SkladTableRow({
  item,
  isEditing,
  isSaving,
  isHighlight,
  draft,
  bloky,
  jednotky,
  kategorieOptions,
  podkategorieOptions,
  onStartEdit,
  onUpdateZaklad,
  onDraftChange,
  onKeyDown,
  onQuickCreateBlok,
  onQuickCreateKategorie,
  onQuickCreatePodkategorie,
  onQuickCreateJednotka,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const rowClass = [
    "grid",
    SPRAVA_TABLE_GRID,
    SPRAVA_TABLE_ROW_CLASS,
    isHighlight ? "bg-blue-950/40" : "bg-transparent",
    isSaving ? "opacity-60" : "opacity-100",
  ].join(" ");

  return (
    <div
      className={[
        "border-t border-slate-800",
        isExpanded ? "bg-slate-950/30" : "",
      ].join(" ")}
    >
      <div className={rowClass}>
        <div
          onClick={() => !isEditing && onStartEdit()}
          className="sticky left-0 z-10 flex min-w-0 items-center gap-1.5 bg-inherit pr-1"
          style={{ cursor: isEditing ? "default" : "pointer" }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-400 transition hover:border-slate-600 hover:text-white"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? "Sbalit rozpis kusů" : "Rozbalit rozpis kusů"
            }
          >
            <ChevronIcon expanded={isExpanded} />
          </button>

          {isEditing ? (
            <input
              autoFocus
              value={draft.nazev}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  nazev: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyle}
              className="min-w-0 flex-1"
            />
          ) : (
            <div
              className="min-w-0 flex-1 truncate text-sm font-medium text-white"
              title={item.nazev}
            >
              {item.nazev}
            </div>
          )}
        </div>

        <div className="flex min-w-0 items-center px-1">
          <SelectWithQuickCreate
            variant="table"
            value={item.sklad_blok_id ?? ""}
            disabled={isSaving}
            onChange={(value) => onUpdateZaklad(null, null, value || null)}
            selectStyle={tableSelectStyle}
            placeholder="Nepřiřazeno"
            options={bloky.map((b) => ({
              value: b.sklad_blok_id,
              label: b.nazev,
            }))}
            quickCreateTitle="Nový okruh"
            quickCreatePlaceholder="Název okruhu"
            onQuickCreate={onQuickCreateBlok}
          />
        </div>

        <div className="flex min-w-0 items-center px-1">
          <SelectWithQuickCreate
            variant="table"
            value={item.kategorie_techniky_id ?? ""}
            disabled={isSaving || !item.sklad_blok_id}
            onChange={(value) =>
              onUpdateZaklad(value || null, null, item.sklad_blok_id)
            }
            selectStyle={tableSelectStyle}
            placeholder="Bez kategorie"
            options={kategorieOptions.map((k) => ({
              value: k.kategorie_techniky_id,
              label: k.nazev,
            }))}
            quickCreateTitle="Nová kategorie"
            quickCreatePlaceholder="Název kategorie"
            quickCreateDisabled={!item.sklad_blok_id}
            quickCreateDisabledTitle="Nejdřív přiřaď okruh"
            onQuickCreate={onQuickCreateKategorie}
          />
        </div>

        <div className="flex min-w-0 items-center px-1">
          <SelectWithQuickCreate
            variant="table"
            value={item.podkategorie_techniky_id ?? ""}
            disabled={isSaving || !item.kategorie_techniky_id}
            onChange={(value) =>
              onUpdateZaklad(
                item.kategorie_techniky_id,
                value || null,
                item.sklad_blok_id
              )
            }
            selectStyle={tableSelectStyle}
            placeholder="Bez typu"
            options={podkategorieOptions.map((p) => ({
              value: p.podkategorie_techniky_id,
              label: p.nazev,
            }))}
            quickCreateTitle="Nový typ / rozměr"
            quickCreatePlaceholder="Název typu / rozměru"
            quickCreateDisabled={!item.kategorie_techniky_id}
            quickCreateDisabledTitle="Nejdřív vyber kategorii"
            onQuickCreate={onQuickCreatePodkategorie}
          />
        </div>

        <div
          onClick={() => !isEditing && onStartEdit()}
          className="flex items-center justify-end px-1 text-right"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <input
              value={draft.kusy}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  kusy: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyleSmall}
            />
          ) : (
            <span style={tableValueBoxRight}>
              {formatNumber(item.celkem_k_dispozici)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-end px-1 text-right">
          <span style={tableValueBoxRight}>
            {formatNumber(item.na_sklade)}
          </span>
        </div>

        <div className="flex items-center justify-end px-1 text-right">
          <span style={tableValueBoxRight}>
            {formatNumber(item.na_akcich)}
          </span>
        </div>

        <div className="flex items-center justify-end px-1 text-right">
          {toNumber(item.poskozene) > 0 ? (
            <Link
              href={`/sklad/${item.skladova_polozka_id}`}
              style={tableDangerBoxRight}
            >
              {formatNumber(item.poskozene)}
            </Link>
          ) : (
            <span style={tableMutedBoxRight}>
              {formatNumber(item.poskozene)}
            </span>
          )}
        </div>

        <div
          onClick={() => !isEditing && onStartEdit()}
          className="flex items-center px-1"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <SelectWithQuickCreate
              variant="table"
              value={draft.jednotka}
              onChange={(value) =>
                onDraftChange((prev) => ({
                  ...prev,
                  jednotka: value,
                }))
              }
              selectStyle={tableSelectStyle}
              options={jednotky.map((j) => ({
                value: j.nazev,
                label: j.nazev,
              }))}
              quickCreateTitle="Nová jednotka"
              quickCreatePlaceholder="Název jednotky"
              onQuickCreate={onQuickCreateJednotka}
            />
          ) : (
            <span style={tableValueBoxLeft} className="truncate">
              {item.jednotka ?? "-"}
            </span>
          )}
        </div>

        <div
          onClick={() => !isEditing && onStartEdit()}
          className="flex items-center justify-end px-1 text-right"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <input
              value={draft.naklad}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  naklad: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyleSmall}
            />
          ) : (
            <span style={tableValueBoxRight} className="truncate text-xs">
              {formatMoney(item.interni_naklad)}
            </span>
          )}
        </div>

        <div
          onClick={() => !isEditing && onStartEdit()}
          className="flex items-center justify-end px-1 text-right"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <input
              value={draft.rent}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  rent: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyleSmall}
            />
          ) : (
            <span style={tableValueBoxRight} className="truncate text-xs">
              {formatMoney(item.fakturacni_cena)}
            </span>
          )}
        </div>

        <div className="flex items-center px-1">
          <Link
            href={`/sklad/${item.skladova_polozka_id}`}
            className="inline-flex w-full items-center justify-center rounded-md border border-amber-700 bg-amber-800 px-2 py-1 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Detail
          </Link>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-slate-800/80 bg-slate-950/50 px-2 py-2">
          <div className="flex items-start gap-3 pl-9">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Kusy
            </span>
            <p className="text-sm text-slate-400">
              Rozpis kusů bude doplněn z evidence kusů.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
