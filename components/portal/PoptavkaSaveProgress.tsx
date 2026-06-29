"use client";

import type { PoptavkaSaveProgressState } from "@/lib/client-portal/poptavka-save-progress";

export default function PoptavkaSaveProgress({
  progress,
  longRunning,
}: {
  progress: PoptavkaSaveProgressState;
  longRunning?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, progress.percent));

  return (
    <div
      className="w-full basis-full space-y-2 rounded-xl border border-blue-500/25 bg-blue-950/30 px-4 py-4"
      role="status"
      aria-live="polite"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-blue-100">{progress.label}</span>
        <span className="tabular-nums text-blue-200/80">{clamped} %</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {longRunning ? (
        <p className="text-xs text-slate-400">
          Ukládání stále probíhá — u větších fotek to může trvat déle. Nechte prosím stránku
          otevřenou.
        </p>
      ) : null}
    </div>
  );
}
