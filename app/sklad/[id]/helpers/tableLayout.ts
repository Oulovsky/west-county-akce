export const SKLAD_DETAIL_TABLE_MIN_WIDTH = "w-full min-w-[1060px]";

export const SKLAD_DETAIL_TABLE_GRID =
  "grid-cols-[minmax(190px,1.15fr)_minmax(100px,0.7fr)_minmax(115px,0.85fr)_minmax(42px,0.25fr)_minmax(44px,0.25fr)_minmax(56px,0.34fr)_minmax(56px,0.34fr)_minmax(48px,0.28fr)_minmax(62px,0.36fr)_minmax(150px,0.75fr)_minmax(86px,0.48fr)_minmax(54px,0.28fr)]";

export const SKLAD_DETAIL_CENTER_CELL_CLASS_NAME =
  "flex min-w-0 items-center justify-center px-0.5";

export function skladDetailRowGridClassName() {
  return [
    "grid",
    SKLAD_DETAIL_TABLE_GRID,
    "rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-sm text-slate-200",
  ].join(" ");
}

export function skladDetailHeaderGridClassName() {
  return [
    "grid",
    SKLAD_DETAIL_TABLE_GRID,
    "rounded-xl border border-slate-800 bg-slate-950 px-2 py-2 text-sm text-slate-200",
  ].join(" ");
}
