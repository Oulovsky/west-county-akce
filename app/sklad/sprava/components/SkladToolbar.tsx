"use client";

import Link from "next/link";

type Props = {
  onAddClick: () => void;
};

export function SkladToolbar({ onAddClick }: Props) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Správa skladu
        </h1>

        <p className="text-sm text-slate-400">
          Přehled skladových položek, rychlá editace a hlášení poškození.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/sklad/konfigurace"
          className="inline-flex items-center justify-center rounded-xl border border-blue-700 bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          Konfigurace skladu
        </Link>

        <button
          onClick={onAddClick}
          className="inline-flex items-center justify-center rounded-xl border border-blue-500 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Přidat položku
        </button>

        <Link
          href="/sklad"
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Zpět
        </Link>
      </div>
    </div>
  );
}
