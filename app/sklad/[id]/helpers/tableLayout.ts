export const SKLAD_DETAIL_TABLE_MIN_WIDTH = "min-w-[1900px]";

export const SKLAD_DETAIL_TABLE_GRID =
  "grid-cols-[minmax(360px,1.8fr)_150px_170px_90px_90px_110px_110px_90px_110px_120px_135px_150px_130px_130px_130px]";

export const SKLAD_DETAIL_CENTER_CELL_CLASS_NAME =
  "flex items-center justify-center px-2";

export function skladDetailRowGridClassName() {
  return [
    "grid",
    SKLAD_DETAIL_TABLE_GRID,
    "rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200",
  ].join(" ");
}

export function skladDetailHeaderGridClassName() {
  return [
    "grid",
    SKLAD_DETAIL_TABLE_GRID,
    "rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200",
  ].join(" ");
}
