"use client";

import Link from "next/link";

const linkClass =
  "inline-flex min-h-9 items-center rounded-lg border border-slate-600 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800";

type Props = {
  readOnly?: boolean;
};

export function SkladPolozkyHeader({ readOnly = false }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-white">Sklad</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Položky, kusy a case strom. Enter uloží řádek, Ctrl+Z vrátí poslední změnu.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/sklad/sprava" className={linkClass}>
          Správa skladu
        </Link>
        {readOnly ? null : (
          <Link href="/sklad/scan" className={linkClass}>
            Skenovat QR
          </Link>
        )}
      </div>
    </header>
  );

}
