"use client";

type Props = {
  value: number;
  label: string;
  accent?: boolean;
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("cs-CZ").format(value);
}

export function SkladStatCard({
  value,
  label,
  accent = false,
}: Props) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
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
