"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { MobileFieldLayout } from "@/components/mobile/MobileFieldLayout";
import { rememberActiveZakazka } from "@/components/mobile/useActiveZakazkaId";
import { Card } from "@/components/ui/card";
import { getDochazkaPath, isZakazkaId } from "@/lib/mobile/routes";
import type { TransportVehicleOption } from "@/lib/transport-attendance";
import { DochazkaZakazkaCard } from "./DochazkaZakazkaCard";
import { sortGroupsWithHighlight, type DochazkaZakazkaGroup } from "./dochazka-shared";

type TransportState = {
  active: boolean;
  mode: "firemni" | "vlastni" | null;
};

export function DochazkaWorkClient({
  groups,
  transportByZakazka,
  companyVehicles,
  privateVehicles,
  highlightZakazkaId,
}: {
  groups: DochazkaZakazkaGroup[];
  transportByZakazka: Record<string, TransportState>;
  companyVehicles: TransportVehicleOption[];
  privateVehicles: TransportVehicleOption[];
  highlightZakazkaId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryZakazkaId = searchParams.get("zakazka");

  const orderedGroups = useMemo(
    () => sortGroupsWithHighlight(groups, highlightZakazkaId),
    [groups, highlightZakazkaId]
  );

  useEffect(() => {
    if (!isZakazkaId(highlightZakazkaId) || isZakazkaId(queryZakazkaId)) return;
    router.replace(getDochazkaPath(highlightZakazkaId), { scroll: false });
  }, [highlightZakazkaId, queryZakazkaId, router]);

  useEffect(() => {
    const first = orderedGroups[0];
    if (!first) return;
    rememberActiveZakazka(first.zakazkaId, {
      nazev: [first.zakazka?.cislo_zakazky, first.zakazka?.nazev].filter(Boolean).join(" · ") || null,
    });
  }, [orderedGroups]);

  useEffect(() => {
    if (!isZakazkaId(highlightZakazkaId)) return;
    const element = document.getElementById(`dochazka-zakazka-${highlightZakazkaId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlightZakazkaId, orderedGroups.length]);

  return (
    <MobileFieldLayout className="space-y-4">
      <div>
        <h1 className="text-2xl font-black text-white lg:text-3xl">Docházka</h1>
        <p className="mt-1 text-sm text-slate-400">
          Práce a přeprava na potvrzených zakázkách. Účast potvrzujte v sekci{" "}
          <Link href="/moje" className="font-semibold text-blue-300 hover:text-blue-200">
            Moje
          </Link>
          .
        </p>
      </div>

      {orderedGroups.length === 0 ? (
        <Card className="border-slate-700 p-5">
          <p className="text-sm leading-relaxed text-slate-300">
            Nemáte žádnou potvrzenou zakázku pro docházku. Účast potvrďte v sekci Moje.
          </p>
          <Link
            href="/moje"
            className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
          >
            Přejít na Moje zakázky
          </Link>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {orderedGroups.map((group) => (
            <DochazkaZakazkaCard
              key={group.zakazkaId}
              group={group}
              transport={transportByZakazka[group.zakazkaId] ?? null}
              companyVehicles={companyVehicles}
              privateVehicles={privateVehicles}
              highlighted={highlightZakazkaId === group.zakazkaId}
            />
          ))}
        </div>
      )}
    </MobileFieldLayout>
  );
}
