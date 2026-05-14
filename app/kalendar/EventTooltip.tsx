"use client";

import { SharedTooltipData, formatDateTime, getToneBadgeClass } from "./calendarShared";

export default function EventTooltip({
  x,
  y,
  data,
}: {
  x: number;
  y: number;
  data: SharedTooltipData;
}) {
  const maxLeft =
    typeof window === "undefined"
      ? x + 16
      : Math.max(12, Math.min(x + 16, window.innerWidth - 440));

  const top =
    typeof window === "undefined"
      ? y - 12
      : Math.max(y - 12, 12);

  return (
    <div
      className="pointer-events-none fixed z-[9999] max-w-[420px] rounded-lg border border-zinc-700 bg-[#0f172a] px-3 py-2 text-sm text-slate-100 shadow-2xl"
      style={{
        left: `${maxLeft}px`,
        top: `${top}px`,
        transform: "translateY(-100%)",
      }}
    >
      <div className="font-semibold text-white">{data.title}</div>

      <div className="mt-1 text-xs text-slate-300">
        {formatDateTime(data.from)} – {formatDateTime(data.to)}
      </div>

      {data.people && data.people.length > 0 ? (
        <div className="mt-1 text-xs text-slate-400">{data.people.join(", ")}</div>
      ) : null}

      {data.metaLabel ? (
        <div className="mt-1 text-xs text-slate-400">{data.metaLabel}</div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div
          className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold ${getToneBadgeClass(data.statusTone)}`}
        >
          {data.statusLabel}
        </div>

        {data.warningLabel ? (
          <div className="inline-flex rounded border border-orange-400/30 bg-orange-500/15 px-2 py-1 text-[11px] font-semibold text-orange-200">
            {data.warningLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}