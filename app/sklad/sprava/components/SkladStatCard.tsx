"use client";

import { formatNumber } from "@/lib/sklad/helpers";

type Props = {
  value: number;
  label: string;
  accent?: boolean;
  hint?: string;
};

export function SkladStatCard({
  value,
  label,
  accent = false,
  hint,
}: Props) {
  return (
    <div
      className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
      title={hint}
    >
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div
        className={[
          "mt-1 text-2xl font-semibold",
          accent ? "text-amber-300" : "text-white",
        ].join(" ")}
      >
        {formatNumber(value)}
      </div>
    </div>
  );
}
