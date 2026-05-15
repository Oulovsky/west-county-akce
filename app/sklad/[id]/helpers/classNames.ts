export function fieldClassName(extra = "") {
  return [
    "h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 font-semibold text-white outline-none",
    extra,
  ].join(" ");
}

export function boxClassName(extra = "") {
  return [
    "flex h-12 w-full items-center rounded-xl border border-slate-700 bg-slate-950 px-3 font-semibold text-white",
    extra,
  ].join(" ");
}

export function statusBoxClassName(extra = "") {
  return [
    "flex h-12 w-full items-center rounded-xl border px-3 font-semibold",
    extra,
  ].join(" ");
}

export function headerBoxClassName(extra = "") {
  return [
    "flex h-10 w-full items-center rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold uppercase tracking-wide text-slate-300",
    extra,
  ].join(" ");
}
