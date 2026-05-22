"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MobileFieldLayout } from "@/components/mobile/MobileFieldLayout";
import { rememberActiveZakazka } from "@/components/mobile/useActiveZakazkaId";
import { Card } from "@/components/ui/card";
import { getDochazkaPath, isZakazkaId } from "@/lib/mobile/routes";

type ZakazkaOption = {
  zakazkaId: string;
  label: string;
};

export function DochazkaPlaceholderClient({
  zakazky,
  initialZakazkaId,
}: {
  zakazky: ZakazkaOption[];
  initialZakazkaId?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryZakazkaId = searchParams.get("zakazka");

  const preferredId =
    (isZakazkaId(initialZakazkaId) ? initialZakazkaId : null) ??
    (isZakazkaId(queryZakazkaId) ? queryZakazkaId : null) ??
    zakazky[0]?.zakazkaId ??
    "";

  const [selectedZakazkaId, setSelectedZakazkaId] = useState(preferredId);
  const [workState, setWorkState] = useState<"idle" | "active">("idle");

  const selectedOption = useMemo(
    () => zakazky.find((item) => item.zakazkaId === selectedZakazkaId) ?? null,
    [selectedZakazkaId, zakazky]
  );

  useEffect(() => {
    if (!isZakazkaId(preferredId) || isZakazkaId(queryZakazkaId)) return;
    router.replace(getDochazkaPath(preferredId), { scroll: false });
  }, [preferredId, queryZakazkaId, router]);

  useEffect(() => {
    if (!isZakazkaId(selectedZakazkaId)) return;
    rememberActiveZakazka(selectedZakazkaId, {
      nazev: selectedOption?.label ?? null,
    });
  }, [selectedZakazkaId, selectedOption?.label]);

  function handleZakazkaChange(nextId: string) {
    setSelectedZakazkaId(nextId);
    if (isZakazkaId(nextId)) {
      router.replace(getDochazkaPath(nextId), { scroll: false });
    }
  }

  return (
    <MobileFieldLayout>
      <label className="block space-y-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Zakázka</span>
        <select
          value={selectedZakazkaId}
          onChange={(event) => handleZakazkaChange(event.target.value)}
          className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 text-base font-semibold text-white outline-none focus:border-blue-500"
          disabled={zakazky.length === 0}
        >
          {zakazky.length === 0 ? (
            <option value="">Žádná zakázka</option>
          ) : (
            zakazky.map((zakazka) => (
              <option key={zakazka.zakazkaId} value={zakazka.zakazkaId}>
                {zakazka.label}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setWorkState("active")}
          disabled={!selectedZakazkaId || workState === "active"}
          className="min-h-[3.5rem] rounded-2xl bg-emerald-600 text-lg font-black text-white disabled:opacity-50"
        >
          Zahájit práci
        </button>
        <button
          type="button"
          onClick={() => setWorkState("idle")}
          disabled={workState !== "active"}
          className="min-h-[3.5rem] rounded-2xl border border-slate-700 bg-slate-900 text-lg font-black text-slate-100 disabled:opacity-50"
        >
          Ukončit práci
        </button>
      </div>

      <Card className="p-4 text-sm text-slate-400 lg:hidden">
        {workState === "active" ? (
          <span className="font-bold text-emerald-300">Práce běží</span>
        ) : (
          <span>Neaktivní</span>
        )}
        {selectedOption ? (
          <div className="mt-1 text-slate-300">{selectedOption.label}</div>
        ) : null}
      </Card>

      <p className="hidden text-sm text-slate-500 lg:block">
        Plná docházková logika se napojí v další fázi. UI je připravené pro terén.
      </p>
    </MobileFieldLayout>
  );
}
