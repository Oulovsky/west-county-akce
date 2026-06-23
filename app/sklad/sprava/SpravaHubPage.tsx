"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProfileRole } from "@/lib/auth/use-profile-role";
import { supabase } from "@/lib/supabase";
import { toNumber } from "@/lib/sklad/helpers";
import { querySpravaKatalog } from "@/lib/sklad/queries";
import type { SkladPolozkaRow } from "@/lib/sklad/types";
import { SkladStats } from "./components/SkladStats";
import { SpravaSupportNav } from "./components/SpravaSupportNav";

const primaryCtaClass =
  "inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-600 bg-blue-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-600";

export function SpravaHubPage() {
  const { nav } = useProfileRole();
  const readOnly = nav.readOnly;
  const [items, setItems] = useState<SkladPolozkaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadSummary() {
      const [itemsRes] = await querySpravaKatalog(supabase);
      if (!alive) return;
      if (itemsRes.error) {
        setLoading(false);
        return;
      }
      setItems((itemsRes.data ?? []) as SkladPolozkaRow[]);
      setLoading(false);
    }

    void loadSummary();
    return () => {
      alive = false;
    };
  }, []);

  const totals = useMemo(() => {
    return {
      itemsCount: items.length,
      totalKusy: items.reduce((sum, item) => sum + toNumber(item.celkem_k_dispozici), 0),
      totalSkladem: items.reduce((sum, item) => sum + toNumber(item.na_sklade), 0),
      totalAkce: items.reduce((sum, item) => sum + toNumber(item.na_akcich), 0),
      totalFyzickyNaZakazkach: items.reduce(
        (sum, item) => sum + toNumber(item.na_zakazkach_fyzicky),
        0
      ),
      totalPoskozene: items.reduce((sum, item) => sum + toNumber(item.poskozene), 0),
      totalProblemove: items.reduce(
        (sum, item) => sum + toNumber(item.kusy_blokovane_servis),
        0
      ),
      totalFutureCollisions: items.filter((item) => item.availability_future_collision).length,
    };
  }, [items]);

  return (
    <div className="flex flex-col gap-6">
      <header className="rounded-2xl border border-blue-900/40 bg-gradient-to-br from-slate-900/90 via-slate-950 to-slate-950 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400/90">
              Administrace skladu
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white">Správa skladu</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
              Přehledy, poškození, konfigurace, setupy a servis. Denní práce s položkami a
              kusy probíhá v hlavním seznamu skladu.
            </p>
          </div>
          <Link href="/sklad" className={primaryCtaClass}>
            Otevřít položky skladu
          </Link>
        </div>
      </header>

      {!loading ? (
        <SkladStats
          itemsCount={totals.itemsCount}
          totalKusy={totals.totalKusy}
          totalSkladem={totals.totalSkladem}
          totalAkce={totals.totalAkce}
          totalFyzickyNaZakazkach={totals.totalFyzickyNaZakazkach}
          totalPoskozene={totals.totalPoskozene}
          totalProblemove={totals.totalProblemove}
          totalFutureCollisions={totals.totalFutureCollisions}
        />
      ) : null}

      <SpravaSupportNav totalPoskozene={totals.totalPoskozene} readOnly={readOnly} />

      {readOnly ? null : (
        <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
            Servis a blokace
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Přehled blokovaných a servisních stavů kusů mimo hlavní seznam položek.
          </p>
          <Link
            href="/sklad/servis"
            className="mt-3 inline-flex rounded-lg border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-900/40"
          >
            Otevřít servis a blokace kusů →
          </Link>
        </section>
      )}
    </div>
  );
}
