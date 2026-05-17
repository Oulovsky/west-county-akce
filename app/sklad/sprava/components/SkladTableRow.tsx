"use client";

import Link from "next/link";
import {
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatMoney } from "./formatMoney";
import { formatNumber } from "./formatNumber";
import { toNumber } from "./toNumber";
import { SelectWithQuickCreate } from "./SelectWithQuickCreate";
import { SpravaKusyExpandPanel } from "./SpravaKusyExpandPanel";
import {
  SPRAVA_TABLE_GRID,
  SPRAVA_TABLE_ROW_CLASS,
} from "./spravaTableLayout";
import {
  SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH,
  SKLAD_SPRAVA_HINT_NA_ZAKAZKACH,
} from "@/lib/sklad/constants";
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

/** Které pole zaměřit po přepnutí řádku do režimu úprav (stejné kliknutí). */
type EditFocusTarget = "nazev" | "pozice" | "kusy" | "naklad" | "rent" | "jednotka";

type Draft = {
  nazev: string;
  kusy: string;
  pozice: string;
  jednotka: string;
  naklad: string;
  rent: string;
};

type Props = {
  item: SkladPolozkaRow;
  isEditing: boolean;
  isSaving: boolean;
  isHighlight: boolean;
  kusyReloadToken?: number;
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
  /** Called after jednotka select change — persists immediately (správa table). */
  onCommitJednotka?: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onQuickCreateBlok: QuickCreateHandler;
  onQuickCreateKategorie: QuickCreateHandler;
  onQuickCreatePodkategorie: QuickCreateHandler;
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
  kusyReloadToken = 0,
  draft,
  bloky,
  jednotky,
  kategorieOptions,
  podkategorieOptions,
  onStartEdit,
  onUpdateZaklad,
  onDraftChange,
  onCommitJednotka,
  onKeyDown,
  onQuickCreateBlok,
  onQuickCreateKategorie,
  onQuickCreatePodkategorie,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const pendingEditFocus = useRef<EditFocusTarget | null>(null);
  const nazevInputRef = useRef<HTMLInputElement>(null);
  const poziceInputRef = useRef<HTMLInputElement>(null);
  const kusyInputRef = useRef<HTMLInputElement>(null);
  const nakladInputRef = useRef<HTMLInputElement>(null);
  const rentInputRef = useRef<HTMLInputElement>(null);
  const jednotkaCellRef = useRef<HTMLDivElement>(null);

  function beginEdit(target: EditFocusTarget) {
    if (isEditing) return;
    pendingEditFocus.current = target;
    onStartEdit();
  }

  useLayoutEffect(() => {
    if (!isEditing) return;
    const target = pendingEditFocus.current;
    if (target == null) return;
    pendingEditFocus.current = null;

    const map: Record<EditFocusTarget, RefObject<HTMLElement | null> | null> = {
      nazev: nazevInputRef,
      pozice: poziceInputRef,
      kusy: kusyInputRef,
      naklad: nakladInputRef,
      rent: rentInputRef,
      jednotka: null,
    };
    if (target === "jednotka") {
      jednotkaCellRef.current?.querySelector<HTMLSelectElement>("select")?.focus();
      return;
    }
    map[target]?.current?.focus();
  }, [isEditing]);

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
          onClick={() => !isEditing && beginEdit("nazev")}
          className="sticky left-0 z-10 flex min-h-8 min-w-0 items-center gap-1.5 bg-inherit pr-1"
          style={{ cursor: isEditing ? "default" : "pointer" }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-md border border-slate-700 bg-slate-900 text-slate-400 outline-none transition hover:border-slate-600 hover:text-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/60"
            aria-expanded={isExpanded}
            aria-label={
              isExpanded ? "Sbalit rozpis kusů" : "Rozbalit rozpis kusů"
            }
          >
            <ChevronIcon expanded={isExpanded} />
          </button>

          {isEditing ? (
            <input
              ref={nazevInputRef}
              value={draft.nazev}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  nazev: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyle}
              className="min-w-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            />
          ) : (
            <div
              className="flex min-h-8 min-w-0 flex-1 items-center truncate text-sm font-medium leading-normal text-white"
              title={item.nazev}
            >
              {item.nazev}
            </div>
          )}
        </div>

        <div className="flex min-h-8 min-w-0 items-center px-1">
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

        <div className="flex min-h-8 min-w-0 items-center px-1">
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

        <div className="flex min-h-8 min-w-0 items-center px-1">
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
            placeholder="Bez podkategorie"
            options={podkategorieOptions.map((p) => ({
              value: p.podkategorie_techniky_id,
              label: p.nazev,
            }))}
            quickCreateTitle="Nová podkategorie"
            quickCreatePlaceholder="Název podkategorie"
            quickCreateDisabled={!item.kategorie_techniky_id}
            quickCreateDisabledTitle="Nejdřív vyber kategorii"
            onQuickCreate={onQuickCreatePodkategorie}
          />
        </div>

        <div
          onClick={() => !isEditing && beginEdit("pozice")}
          className="flex min-h-8 items-center justify-center px-1 text-center"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <input
              ref={poziceInputRef}
              value={draft.pozice}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  pozice: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyleSmall}
              inputMode="decimal"
              className="min-w-0 max-w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            />
          ) : (
            <span style={tableValueBoxRight}>
              {formatNumber(item.pozice)}
            </span>
          )}
        </div>

        <div
          onClick={() => !isEditing && beginEdit("kusy")}
          className="flex min-h-8 items-center justify-center px-1 text-center"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <input
              ref={kusyInputRef}
              value={draft.kusy}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  kusy: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyleSmall}
              className="min-w-0 max-w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            />
          ) : (
            <span style={tableValueBoxRight}>
              {formatNumber(item.celkem_k_dispozici)}
            </span>
          )}
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 text-center">
          <span style={tableValueBoxRight}>
            {formatNumber(item.na_sklade)}
          </span>
        </div>

        <div
          className="flex min-h-8 items-center justify-center px-1 text-center"
          title={SKLAD_SPRAVA_HINT_NA_ZAKAZKACH}
        >
          <span
            style={item.availability_future_collision ? tableDangerBoxRight : tableValueBoxRight}
            title={
              item.availability_future_collision
                ? `Budoucí kapacitní kolize: plán/fyzicky ${formatNumber(item.availability_future_planned)} ks, použitelné ${formatNumber(item.availability_usable)} ks`
                : SKLAD_SPRAVA_HINT_NA_ZAKAZKACH
            }
          >
            {formatNumber(item.na_akcich)}
          </span>
        </div>

        <div
          className="flex min-h-8 items-center justify-center px-1 text-center"
          title={SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH}
        >
          <span style={tableValueBoxRight}>
            {formatNumber(item.na_zakazkach_fyzicky)}
          </span>
        </div>

        <div className="flex min-h-8 items-center justify-center px-1 text-center">
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
          ref={jednotkaCellRef}
          onClick={() => !isEditing && beginEdit("jednotka")}
          className="flex min-h-8 w-full min-w-0 items-center justify-center px-1"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <SelectWithQuickCreate
              variant="table"
              showQuickCreate={false}
              value={draft.jednotka}
              onChange={(value) => {
                onDraftChange((prev) => ({
                  ...prev,
                  jednotka: value,
                }));
                onCommitJednotka?.(value);
              }}
              selectStyle={tableSelectStyle}
              options={jednotky.map((j) => ({
                value: j.nazev,
                label: j.nazev,
              }))}
            />
          ) : (
            <span style={tableValueBoxLeft} className="truncate">
              {item.jednotka ?? "-"}
            </span>
          )}
        </div>

        <div
          onClick={() => !isEditing && beginEdit("naklad")}
          className="flex min-h-8 items-center justify-center px-1 text-center"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <input
              ref={nakladInputRef}
              value={draft.naklad}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  naklad: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyleSmall}
              className="min-w-0 max-w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            />
          ) : (
            <span style={tableValueBoxRight} className="truncate text-xs">
              {formatMoney(item.interni_naklad)}
            </span>
          )}
        </div>

        <div
          onClick={() => !isEditing && beginEdit("rent")}
          className="flex min-h-8 items-center justify-center px-1 text-center"
          style={{ cursor: "pointer" }}
        >
          {isEditing ? (
            <input
              ref={rentInputRef}
              value={draft.rent}
              onChange={(e) =>
                onDraftChange((prev) => ({
                  ...prev,
                  rent: e.target.value,
                }))
              }
              onKeyDown={onKeyDown}
              style={tableInputStyleSmall}
              className="min-w-0 max-w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            />
          ) : (
            <span style={tableValueBoxRight} className="truncate text-xs">
              {formatMoney(item.fakturacni_cena)}
            </span>
          )}
        </div>

        <div className="flex min-h-8 items-center justify-center px-1">
          <Link
            href={`/sklad/${item.skladova_polozka_id}`}
            className="inline-flex h-8 max-h-8 w-full min-w-0 items-center justify-center rounded-md border border-amber-700 bg-amber-800 px-2 py-0 text-xs font-semibold leading-none text-white outline-none transition hover:bg-amber-700 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/70"
          >
            Detail
          </Link>
        </div>
      </div>

      {isExpanded ? (
        <SpravaKusyExpandPanel
          skladovaPolozkaId={item.skladova_polozka_id}
          polozkaNazev={item.nazev}
          celkemKDispozici={item.celkem_k_dispozici}
          inherited={{
            blok_nazev: item.blok_nazev,
            kategorie_nazev: item.kategorie_nazev,
            podkategorie_nazev: item.podkategorie_nazev,
            pozice: item.pozice,
            jednotka: item.jednotka,
            interni_naklad: item.interni_naklad,
            fakturacni_cena: item.fakturacni_cena,
          }}
          reloadToken={kusyReloadToken}
        />
      ) : null}
    </div>
  );
}
