export function fieldClassName(extra = "") {
  return [
    "h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm font-semibold text-white outline-none",
    extra,
  ].join(" ");
}

export function boxClassName(extra = "") {
  return [
    "flex h-9 w-full min-w-0 items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-950 px-1.5 text-[11px] font-semibold text-white",
    extra,
  ].join(" ");
}

export function statusBoxClassName(extra = "") {
  return [
    "flex h-9 w-full min-w-0 items-center overflow-hidden rounded-lg border px-1.5 text-[11px] font-semibold",
    extra,
  ].join(" ");
}

export function headerBoxClassName(extra = "") {
  return [
    "flex min-h-9 w-full min-w-0 items-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900 px-1 text-[9px] font-semibold uppercase leading-tight tracking-wide text-slate-300",
    extra,
  ].join(" ");
}
