/** Sdílená mřížka tabulky správy skladu — širší sloupce konfigurace, užší čísla. */
export const SPRAVA_TABLE_GRID =
  "grid-cols-[minmax(188px,1.55fr)_minmax(136px,1.1fr)_minmax(136px,1.1fr)_minmax(144px,1.1fr)_minmax(90px,0.67fr)_minmax(50px,0.42fr)_minmax(50px,0.42fr)_minmax(50px,0.42fr)_minmax(76px,0.82fr)_minmax(76px,0.82fr)_minmax(64px,0.6fr)_minmax(58px,0.54fr)_minmax(72px,0.68fr)_minmax(52px,0.46fr)]";

/** Vertikální střed buněk; výška řádku = nejvyšší prvek (sjednocené controls h-8). */
export const SPRAVA_TABLE_ROW_CLASS =
  "border-t border-slate-800 px-1.5 py-1.5 text-[13px] transition items-center";

export const SPRAVA_TABLE_HEADER_CLASS =
  "border-b border-slate-700 bg-slate-900/95 px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-tight text-slate-300 items-center min-h-[2.75rem]";

/** Hlavička — zalamování dlouhých popisků bez překryvu sousedních sloupců. */
export const SPRAVA_TABLE_HEADER_CELL =
  "flex min-w-0 items-center justify-center px-0.5 text-center leading-[1.2] whitespace-normal break-words hyphens-auto";

export const SPRAVA_TABLE_HEADER_CELL_STICKY =
  "sticky left-0 z-20 flex min-w-0 items-center bg-slate-900/95 pr-1 leading-[1.2] whitespace-normal";

/** Minimální šířka tabulky — odpovídá součtu minmax min; zbytek roztáhne fr jednotky. */
export const SPRAVA_TABLE_MIN_WIDTH = 1280;
