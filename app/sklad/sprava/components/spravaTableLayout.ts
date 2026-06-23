import type { CSSProperties } from "react";

/**
 * Sloupce tabulky skladu — min šířky zachovávají čitelnost, fr jednotky vyplní panel.
 * Stejná šablona musí být na hlavičce i každém řádku (společná šířka kontejneru).
 */
export const SPRAVA_TABLE_GRID_TEMPLATE = [
  "minmax(12rem, 2.2fr)", // Název (+ checkbox / expand)
  "minmax(4.5rem, 1fr)", // Okruh
  "minmax(4.5rem, 1fr)", // Kategorie
  "minmax(4.75rem, 1.1fr)", // Podkategorie
  "minmax(3.5rem, 0.75fr)", // Vlastník
  "minmax(2.5rem, 0.5fr)", // Pozice
  "minmax(2.5rem, 0.5fr)", // Celkem
  "minmax(2.5rem, 0.5fr)", // Skladem
  "minmax(4.5rem, 1fr)", // Plánováno na zakázkách
  "minmax(4.5rem, 1fr)", // Fyzicky na zakázkách
  "minmax(2.5rem, 0.5fr)", // Poškozené
  "minmax(2.5rem, 0.5fr)", // Jednotka
  "minmax(3.5rem, 0.75fr)", // Cena pro akce
].join(" ");

/** Minimální šířka tabulky — pod touto hodnotou zapne horizontální scroll. */
export const SPRAVA_TABLE_MIN_WIDTH = 1080;

export const spravaTableGridStyle: CSSProperties = {
  gridTemplateColumns: SPRAVA_TABLE_GRID_TEMPLATE,
};

export const spravaTableContainerStyle: CSSProperties = {
  width: "100%",
  minWidth: SPRAVA_TABLE_MIN_WIDTH,
};

/** Odsazení řádku kusu pod položkou. */
export const SPRAVA_KUS_NAME_INDENT_CLASS = "pl-4";

/** Odsazení child kusu v case stromu (checkbox pod case kusem). */
export const SPRAVA_CASE_CHILD_NAME_INDENT_CLASS = "pl-10";

export const SPRAVA_TABLE_ROW_CLASS =
  "grid border-t border-slate-800 py-1.5 text-[13px] transition items-center";

export const SPRAVA_TABLE_HEADER_CLASS =
  "grid border-b border-slate-700 bg-slate-900/95 py-1 text-[9px] font-semibold uppercase tracking-normal text-slate-300 items-center min-h-[2.5rem]";

export const SPRAVA_TABLE_CHEVRON_SPACER = "h-8 w-8 shrink-0";

export const SPRAVA_TABLE_CELL =
  "flex min-h-8 min-w-0 items-center px-1";

export const SPRAVA_TABLE_CELL_CENTER =
  "flex min-h-8 min-w-0 items-center justify-center px-1 text-center";

export const SPRAVA_TABLE_CELL_STICKY =
  "sticky left-0 z-10 flex min-h-8 min-w-0 items-center gap-1.5 bg-inherit px-1";

export const SPRAVA_TABLE_HEADER_CELL =
  "flex min-h-8 min-w-0 items-center justify-center overflow-hidden px-0.5 text-center leading-tight";

export const SPRAVA_TABLE_HEADER_CELL_SHORT =
  "flex min-h-8 min-w-0 items-center justify-center overflow-hidden px-0.5 text-center leading-tight whitespace-nowrap";

export const SPRAVA_TABLE_HEADER_CELL_MULTILINE =
  "flex min-h-8 min-w-0 flex-col items-center justify-center gap-0 overflow-hidden px-0.5 text-center leading-none";

export const SPRAVA_TABLE_HEADER_CELL_STICKY =
  "sticky left-0 z-20 flex min-h-8 min-w-0 items-center gap-1.5 overflow-hidden bg-slate-900/95 px-0.5 leading-tight whitespace-nowrap";

/** Rozbalený case kus + jeho child obsah. */
export const SPRAVA_CASE_EXPANDED_BLOCK_CLASS =
  "border-l-2 border-emerald-600/45 bg-emerald-950/15 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.07)]";

export const SPRAVA_CASE_CHILD_ROW_BG_CLASS = "bg-emerald-950/20";

export const SPRAVA_CASE_CHILD_STICKY_BG_CLASS = "bg-emerald-950/35";
