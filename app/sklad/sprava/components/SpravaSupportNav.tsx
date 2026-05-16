"use client";

import Link from "next/link";
import { formatNumber } from "@/lib/sklad/helpers";

const chipLinkClass =
  "inline-flex items-center rounded-lg border border-slate-700/80 bg-slate-900/50 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:bg-slate-900 hover:text-slate-200";

const panelLinkClass =
  "mt-3 inline-flex text-sm font-semibold text-slate-400 transition hover:text-white";

type Props = {
  totalPoskozene?: number;
};

export function SpravaSupportNav({ totalPoskozene = 0 }: Props) {
  return (
    <nav
      className="grid gap-3 lg:grid-cols-3"
      aria-label="Doplňková navigace skladu"
    >
      <section
        className={[
          "rounded-xl border bg-slate-950/30 p-4",
          totalPoskozene > 0
            ? "border-amber-900/50"
            : "border-slate-800/80",
        ].join(" ")}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Poškození
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Evidence hlášení a statistiky nad stejnými položkami z tohoto katalogu.
        </p>
        {totalPoskozene > 0 ? (
          <p className="mt-2 text-xs text-amber-400/90">
            V katalogu je právě {formatNumber(totalPoskozene)} poškozených kusů.
          </p>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          <Link href="/sklad/poskozeni" className={chipLinkClass}>
            Otevřená poškození
          </Link>
          <Link href="/sklad/statistika" className={chipLinkClass}>
            Statistika poškození
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800/80 bg-slate-950/30 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Konfigurace
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Číselníky kategorií, jednotek a typů poškození — podpora pro správu položek.
        </p>
        <Link href="/sklad/konfigurace" className={panelLinkClass}>
          Konfigurace skladu →
        </Link>
      </section>

      <section className="rounded-xl border border-slate-800/80 bg-slate-950/30 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Setupy
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Knihovna opakovatelných sestav ze skladových položek bez konkrétních kusů.
        </p>
        <Link href="/sklad/setupy" className={panelLinkClass}>
          Setupy skladu →
        </Link>
      </section>
    </nav>
  );
}
