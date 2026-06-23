import type { CSSProperties } from "react";

/** Pevné šířky sloupců — stejné pro hlavičku i každý řádek (fr rozjíždí samostatné gridy). */
export const SPRAVA_TABLE_COLUMN_WIDTHS = [
  240, // Název (+ chevron)
  124, // Okruh
  124, // Kategorie
  132, // Podkategorie
  96, // Vlastník
  60, // Pozice
  60, // Celkem
  60, // Skladem
  96, // Plánováno na zakázkách
  96, // Fyzicky na zakázkách
  76, // Poškozené
  68, // Jednotka
  84, // Cena pro akce
] as const;

export const SPRAVA_TABLE_MIN_WIDTH = SPRAVA_TABLE_COLUMN_WIDTHS.reduce(
  (sum, width) => sum + width,
  0
);

export const SPRAVA_TABLE_GRID_TEMPLATE = SPRAVA_TABLE_COLUMN_WIDTHS.map(
  (width) => `${width}px`
).join(" ");

export const spravaTableGridStyle: CSSProperties = {
  gridTemplateColumns: SPRAVA_TABLE_GRID_TEMPLATE,
};

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
