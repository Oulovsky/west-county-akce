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
import { isPolozkaCase } from "@/lib/sklad/caseKus";
import { useSpravaKusSelection } from "./SpravaKusSelectionContext";
import { useSpravaTableScroll } from "./SpravaTableScrollContext";
import {
  SPRAVA_TABLE_CELL,
  SPRAVA_TABLE_CELL_CENTER,
  SPRAVA_TABLE_CELL_STICKY,
  SPRAVA_TABLE_INHERITED_CELL,
  SPRAVA_TABLE_ROW_CLASS,
  spravaTableGridStyle,
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
  TechnickyVlastnik,
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

/** Které pole zaměřit po přepnutí řádku do režimu úprav (stejné kliknutí). */
type EditFocusTarget = "nazev" | "pozice" | "kusy" | "naklad" | "jednotka";

type Draft = {
  nazev: string;
  kusy: string;
  pozice: string;
  jednotka: string;
  naklad: string;
};

type CaseObsahFormDefaults = {
  skladBlokId: string | null;
  kategorieTechnikyId: string | null;
  podkategorieTechnikyId: string | null;
  technickyVlastnikId: string | null;
  jednotka: string;
};

type Props = {
  item: SkladPolozkaRow;
  isEditing: boolean;
  isSaving: boolean;
  isHighlight: boolean;
  kusyReloadToken?: number;
  obsahReloadKey?: string;
  autoExpandKusy?: boolean;
  openCaseKusId?: string | null;
  obsahMode?: string | null;
  caseObsahFormDefaults: CaseObsahFormDefaults;
  draft: Draft;
  bloky: SkladBlok[];
  jednotky: SkladJednotka[];
  vlastnici: TechnickyVlastnik[];
  kategorieOptions: SkladKategorie[];
  podkategorieOptions: SkladPodkategorie[];
  allKategorie: SkladKategorie[];
  allPodkategorie: SkladPodkategorie[];
  onStartEdit: () => void;
  onUpdateZaklad: (
    kategorieId: string | null,
    podkategorieId: string | null,
    blokId: string | null
  ) => void;
  onUpdateVlastnik: (vlastnikId: string) => void;
  onDraftChange: Dispatch<SetStateAction<Draft>>;
  /** Called after jednotka select change — persists immediately (správa table). */
  onCommitJednotka?: (value: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
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
  obsahReloadKey = "",
  autoExpandKusy = false,
  openCaseKusId = null,
  obsahMode = null,
  caseObsahFormDefaults,
  draft,
  bloky,
  jednotky,
  vlastnici,
  kategorieOptions,
  podkategorieOptions,
  allKategorie,
  allPodkategorie,
  onStartEdit,
  onUpdateZaklad,
  onUpdateVlastnik,
  onDraftChange,
  onCommitJednotka,
  onKeyDown,
  readOnly = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(autoExpandKusy);
  const {
    caseMetadata,
    isPolozkaSelected,
    togglePolozka,
  } = useSpravaKusSelection();
  const tableScroll = useSpravaTableScroll();

  const polozkaChecked = isPolozkaSelected(item.skladova_polozka_id);
  const polozkaJeCase = isPolozkaCase(
    item.skladova_polozka_id,
    item.nazev,
    caseMetadata.polozkaFlags
  );

  useLayoutEffect(() => {
    if (autoExpandKusy) {
      setIsExpanded(true);
    }
  }, [autoExpandKusy, item.skladova_polozka_id]);

  const pendingEditFocus = useRef<EditFocusTarget | null>(null);
  const nazevInputRef = useRef<HTMLInputElement>(null);
  const poziceInputRef = useRef<HTMLInputElement>(null);
  const kusyInputRef = useRef<HTMLInputElement>(null);
  const nakladInputRef = useRef<HTMLInputElement>(null);
  const jednotkaCellRef = useRef<HTMLDivElement>(null);

  function beginEdit(target: EditFocusTarget) {
    if (readOnly || isEditing) return;
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
      jednotka: null,
    };
    if (target === "jednotka") {
      jednotkaCellRef.current?.querySelector<HTMLSelectElement>("select")?.focus();
      return;
    }
    map[target]?.current?.focus();
  }, [isEditing]);

  const rowClass = [
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
      <div className={rowClass} style={spravaTableGridStyle}>
        <div
          onClick={() => !readOnly && !isEditing && beginEdit("nazev")}
          className={SPRAVA_TABLE_CELL_STICKY}
          style={{ cursor: readOnly || isEditing ? "default" : "pointer" }}
        >
          <input
            type="checkbox"
            checked={polozkaChecked}
            onChange={() =>
              togglePolozka({
                skladovaPolozkaId: item.skladova_polozka_id,
                nazev: item.nazev,
                isCase: polozkaJeCase,
              })
            }
            onClick={(e) => e.stopPropagation()}
            aria-label={`Vybrat položku ${item.nazev}`}
            className="h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-blue-500/50"
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const toggle = () => setIsExpanded((prev) => !prev);
              if (tableScroll) {
                tableScroll.runPreservingScroll(toggle);
              } else {
                toggle();
              }
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
              className="flex min-h-8 min-w-0 flex-1 items-center truncate text-[13px] font-medium leading-normal text-white"
              title={item.nazev}
            >
              {item.nazev}
            </div>
          )}
        </div>

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <SelectWithQuickCreate
            variant="table"
            showQuickCreate={false}
            value={item.sklad_blok_id ?? ""}
            disabled={isSaving || readOnly}
            onChange={(value) => onUpdateZaklad(null, null, value || null)}
            selectStyle={tableSelectStyle}
            selectClassName="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            placeholder="Nepřiřazeno"
            options={bloky.map((b) => ({
              value: b.sklad_blok_id,
              label: b.nazev,
            }))}
          />
        </div>

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <SelectWithQuickCreate
            variant="table"
            showQuickCreate={false}
            value={item.kategorie_techniky_id ?? ""}
            disabled={isSaving || !item.sklad_blok_id}
            onChange={(value) =>
              onUpdateZaklad(value || null, null, item.sklad_blok_id)
            }
            selectStyle={tableSelectStyle}
            selectClassName="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            placeholder="Bez kategorie"
            options={kategorieOptions.map((k) => ({
              value: k.kategorie_techniky_id,
              label: k.nazev,
            }))}
          />
        </div>

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <SelectWithQuickCreate
            variant="table"
            showQuickCreate={false}
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
            selectClassName="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            placeholder="Bez podkategorie"
            options={podkategorieOptions.map((p) => ({
              value: p.podkategorie_techniky_id,
              label: p.nazev,
            }))}
          />
        </div>

        <div className={SPRAVA_TABLE_INHERITED_CELL}>
          <select
            value={item.technicky_vlastnik_id ?? ""}
            disabled={isSaving || readOnly}
            onChange={(e) => {
              const value = e.target.value;
              if (value) onUpdateVlastnik(value);
            }}
            style={tableSelectStyle}
            className="min-w-0 w-full truncate text-center text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600/50"
            title="Vlastník techniky"
          >
            {(item.technicky_vlastnik_id &&
            !vlastnici.some((v) => v.id === item.technicky_vlastnik_id && v.aktivni)
              ? [
                  {
                    id: item.technicky_vlastnik_id,
                    nazev: item.technicky_vlastnik_nazev ?? "Neznámý vlastník",
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
            {vlastnici
              .filter((v) => v.aktivni)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nazev}
                </option>
              ))}
          </select>
        </div>

        <div
          onClick={() => !isEditing && beginEdit("pozice")}
          className={SPRAVA_TABLE_CELL_CENTER}
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
          className={SPRAVA_TABLE_CELL_CENTER}
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

        <div className={SPRAVA_TABLE_CELL_CENTER}>
          <span style={tableValueBoxRight}>
            {formatNumber(item.na_sklade)}
          </span>
        </div>

        <div
          className={SPRAVA_TABLE_CELL_CENTER}
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
          className={SPRAVA_TABLE_CELL_CENTER}
          title={SKLAD_SPRAVA_HINT_FYZICKY_NA_ZAKAZKACH}
        >
          <span style={tableValueBoxRight}>
            {formatNumber(item.na_zakazkach_fyzicky)}
          </span>
        </div>

        <div className={SPRAVA_TABLE_CELL_CENTER}>
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
          className={SPRAVA_TABLE_CELL_CENTER}
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
          className={SPRAVA_TABLE_CELL_CENTER}
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
      </div>

      {isExpanded ? (
        <SpravaKusyExpandPanel
          skladovaPolozkaId={item.skladova_polozka_id}
          polozkaNazev={item.nazev}
          polozkaJednotka={item.jednotka}
          celkemKDispozici={item.celkem_k_dispozici}
          inherited={{
            blok_nazev: item.blok_nazev,
            kategorie_nazev: item.kategorie_nazev,
            podkategorie_nazev: item.podkategorie_nazev,
            technicky_vlastnik_nazev: item.technicky_vlastnik_nazev,
            pozice: item.pozice,
            jednotka: item.jednotka,
            interni_naklad: item.interni_naklad,
          }}
          reloadToken={kusyReloadToken}
          obsahReloadKey={obsahReloadKey}
          readOnly={readOnly}
          openCaseKusId={openCaseKusId}
          obsahMode={obsahMode}
          formDefaults={caseObsahFormDefaults}
          bloky={bloky}
          kategorie={allKategorie}
          podkategorie={allPodkategorie}
          jednotky={jednotky}
          vlastnici={vlastnici}
        />
      ) : null}
    </div>
  );
}
