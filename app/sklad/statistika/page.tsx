"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Row = {
  skladova_polozka_id: string;
  nazev: string;
  jednotka: string | null;
  celkem_k_dispozici: number;
  blokovane_kusy: number;
  otevrena_hlaseni: number;
  celkem_hlaseni: number;
};

function formatNumber(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("cs-CZ").format(parsed);
}

export default function SkladStatistikaPage() {
  const [data, setData] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    void supabase.rpc("get_statistika_poskozeni").then(({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error(error);
        setLoaded(true);
        return;
      }

      setData((data ?? []) as Row[]);
      setLoaded(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const totalBlokovane = useMemo(
    () => data.reduce((sum, row) => sum + Number(row.blokovane_kusy ?? 0), 0),
    [data]
  );

  const totalOtevrena = useMemo(
    () => data.reduce((sum, row) => sum + Number(row.otevrena_hlaseni ?? 0), 0),
    [data]
  );

  const totalHlaseni = useMemo(
    () => data.reduce((sum, row) => sum + Number(row.celkem_hlaseni ?? 0), 0),
    [data]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Statistika poškození
          </h1>
          <p className="text-sm text-slate-400">
            Souhrn poškození po jednotlivých skladových položkách.
          </p>
        </div>

        <Link
          href="/sklad"
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Zpět na sklad
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Položek ve výpisu
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {formatNumber(data.length)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Blokované kusy
          </div>
          <div className="mt-1 text-2xl font-semibold text-amber-300">
            {formatNumber(totalBlokovane)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Otevřená hlášení
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {formatNumber(totalOtevrena)}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Celkem hlášení
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {formatNumber(totalHlaseni)}
          </div>
        </div>
      </div>

      {!loaded ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-300">
          Načítám...
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-8 text-sm text-slate-300">
          Žádná data.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[minmax(320px,2fr)_140px_140px_140px_140px] border-b border-slate-700 bg-slate-900/95 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
                <div className="sticky left-0 z-20 bg-slate-900/95 pr-3">
                  Položka
                </div>
                <div className="px-2 text-right">Blokováno</div>
                <div className="px-2 text-right">Otevřené</div>
                <div className="px-2 text-right">Hlášení</div>
                <div className="px-2 text-right">Celkem</div>
              </div>

              {data.map((row) => (
                <div
                  key={row.skladova_polozka_id}
                  className="grid grid-cols-[minmax(320px,2fr)_140px_140px_140px_140px] border-t border-slate-800 px-3 py-3"
                >
                  <div className="sticky left-0 z-10 bg-inherit pr-3">
                    <Link
                      href={`/sklad/${row.skladova_polozka_id}`}
                      className="block text-white no-underline transition hover:text-blue-300"
                    >
                      <div className="font-semibold">{row.nazev}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {row.jednotka ?? "ks"}
                      </div>
                    </Link>
                  </div>

                  <div className="flex items-center justify-end px-2 text-right font-semibold text-amber-300">
                    {formatNumber(row.blokovane_kusy)}
                  </div>

                  <div className="flex items-center justify-end px-2 text-right text-slate-200">
                    {formatNumber(row.otevrena_hlaseni)}
                  </div>

                  <div className="flex items-center justify-end px-2 text-right text-slate-200">
                    {formatNumber(row.celkem_hlaseni)}
                  </div>

                  <div className="flex items-center justify-end px-2 text-right text-slate-200">
                    {formatNumber(row.celkem_k_dispozici)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
