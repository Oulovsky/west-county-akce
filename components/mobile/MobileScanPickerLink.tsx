"use client";

import Link from "next/link";
import { rememberActiveZakazka } from "@/components/mobile/useActiveZakazkaId";
import { getZakazkaScanPath } from "@/lib/mobile/routes";

export function MobileScanPickerLink({
  zakazkaId,
  cislo,
  nazev,
  whenLabel,
  highlight = false,
  className = "",
}: {
  zakazkaId: string;
  cislo: string;
  nazev: string;
  whenLabel: string;
  highlight?: boolean;
  className?: string;
}) {
  const baseClass = highlight
    ? "block rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-5 transition active:scale-[0.99] hover:border-emerald-400/50"
    : "block rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-4 transition active:scale-[0.99] hover:bg-slate-900";

  return (
    <Link
      href={getZakazkaScanPath(zakazkaId)}
      onClick={() => rememberActiveZakazka(zakazkaId, { cislo, nazev })}
      className={`${baseClass} ${className}`.trim()}
    >
      <div
        className={`text-xs font-bold uppercase tracking-wide ${highlight ? "text-emerald-300" : "text-slate-500"}`}
      >
        {cislo}
      </div>
      <div className="mt-1 text-lg font-black text-white">{nazev}</div>
      <div className="mt-1 text-sm text-slate-400">{whenLabel}</div>
      <div className={`mt-3 text-sm font-black ${highlight ? "text-emerald-200" : "text-blue-200"}`}>
        Scan →
      </div>
    </Link>
  );
}
