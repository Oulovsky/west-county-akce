"use client";

import Link from "next/link";

const secondaryCtaClass =
  "inline-flex items-center justify-center rounded-xl border border-slate-600 bg-slate-900 px-5 py-3 text-sm font-bold text-slate-100 shadow-lg shadow-black/20 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400";

type Props = {
  readOnly?: boolean;
};

export function SpravaManagementHeader({ readOnly = false }: Props) {
  return (
    <header className="rounded-2xl border border-blue-900/40 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="w-full min-w-0 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/90">
            Hlavní pracovní prostor
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Správa skladu</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            {readOnly
              ? "Centrální katalog všech položek v režimu pouze pro čtení."
              : "Centrální katalog všech položek. Zde přidáváš a upravuješ techniku, přiřazuješ okruhy a kategorie a řídíš dostupnost — ostatní stránky skladu jen doplňují přehledy, filtry a nastavení."}
          </p>
        </div>

        {readOnly ? null : (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Link href="/sklad/scan" className={secondaryCtaClass}>
              Skenovat QR
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
