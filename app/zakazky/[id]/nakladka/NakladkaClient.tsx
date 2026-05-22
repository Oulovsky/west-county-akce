"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

type Radek = {
  skladova_polozka_id: string;
  nazev: string;
  plan: number;
  nalozeno: number;
};

type NakladkaRow = {
  skladova_polozka_id: string;
  nalozeno: number;
};

type CompareItem = {
  skladova_polozka_id: string;
  nazev: string;
  plan: number;
};

type CompareZakazkaOption = {
  zakazka_id: string;
  label: string;
  items: CompareItem[];
};

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export default function NakladkaClient({
  initialData,
  zakazkaId,
  pridejAction,
  uberAction,
  canEdit,
  compareOptions = [],
  autoCompareZakazkaId = null,
}: {
  initialData: Radek[];
  zakazkaId: string;
  pridejAction: (fd: FormData) => Promise<void>;
  uberAction: (fd: FormData) => Promise<void>;
  canEdit: boolean;
  compareOptions?: CompareZakazkaOption[];
  autoCompareZakazkaId?: string | null;
}) {
  const [data, setData] = useState<Radek[]>(initialData);
  const [compareMode, setCompareMode] = useState<"auto" | "manual">("auto");
  const [selectedCompareZakazkaId, setSelectedCompareZakazkaId] = useState("");

  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suppressClickRef = useRef(false);
  const lastZakazkaIdRef = useRef(zakazkaId);

  useEffect(() => {
    if (lastZakazkaIdRef.current !== zakazkaId) {
      setData(initialData);
      lastZakazkaIdRef.current = zakazkaId;
    }
  }, [initialData, zakazkaId]);

  const stopHold = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`nakladka-${zakazkaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nakladka",
          filter: `zakazka_id=eq.${zakazkaId}`,
        },
        async () => {
          const { data: freshRaw } = await supabase
            .from("nakladka")
            .select("skladova_polozka_id, nalozeno")
            .eq("zakazka_id", zakazkaId);

          const fresh = (freshRaw || []) as NakladkaRow[];

          setData((prev) =>
            prev.map((r) => ({
              ...r,
              nalozeno:
                fresh.find(
                  (f: NakladkaRow) => f.skladova_polozka_id === r.skladova_polozka_id
                )?.nalozeno ?? 0,
            }))
          );
        }
      )
      .subscribe();

    return () => {
      stopHold();
      void supabase.removeChannel(channel);
    };
  }, [stopHold, zakazkaId]);

  function makeFormData(r: Radek) {
    const fd = new FormData();
    fd.set("zakazka_id", zakazkaId);
    fd.set("skladova_polozka_id", r.skladova_polozka_id);
    return fd;
  }

  function updateLocalValue(r: Radek, delta: number) {
    setData((prev) =>
      prev.map((item) => {
        if (item.skladova_polozka_id !== r.skladova_polozka_id) {
          return item;
        }

        const noveNalozeno = Math.max(0, Math.min(item.plan, item.nalozeno + delta));

        return {
          ...item,
          nalozeno: noveNalozeno,
        };
      })
    );
  }

  async function runAction(
    action: (fd: FormData) => Promise<void>,
    r: Radek,
    delta: number
  ) {
    updateLocalValue(r, delta);

    try {
      await action(makeFormData(r));
    } catch (error) {
      updateLocalValue(r, -delta);
      throw error;
    }
  }

  function startHold(
    action: (fd: FormData) => Promise<void>,
    r: Radek,
    delta: number
  ) {
    stopHold();
    suppressClickRef.current = false;

    holdTimeoutRef.current = setTimeout(() => {
      suppressClickRef.current = true;

      holdIntervalRef.current = setInterval(() => {
        void runAction(action, r, delta);
      }, 500);
    }, 500);
  }

  async function handleClick(
    action: (fd: FormData) => Promise<void>,
    r: Radek,
    delta: number
  ) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    await runAction(action, r, delta);
  }

  const celkemPlan = useMemo(
    () => data.reduce((sum, r) => sum + r.plan, 0),
    [data]
  );

  const celkemNalozeno = useMemo(
    () => data.reduce((sum, r) => sum + r.nalozeno, 0),
    [data]
  );

  const hotovoPolozek = useMemo(
    () => data.filter((r) => r.plan > 0 && r.nalozeno >= r.plan).length,
    [data]
  );

  const activeCompareZakazka = useMemo(() => {
    if (compareMode === "auto") {
      if (!autoCompareZakazkaId) return null;
      return compareOptions.find((item) => item.zakazka_id === autoCompareZakazkaId) ?? null;
    }

    if (!selectedCompareZakazkaId) return null;
    return compareOptions.find((item) => item.zakazka_id === selectedCompareZakazkaId) ?? null;
  }, [autoCompareZakazkaId, compareMode, compareOptions, selectedCompareZakazkaId]);

  const compareRows = useMemo(() => {
    if (!activeCompareZakazka) return [];

    const nextMap = new Map<string, CompareItem>();
    activeCompareZakazka.items.forEach((item) => {
      nextMap.set(item.skladova_polozka_id, item);
    });

    const currentMap = new Map<string, Radek>();
    data.forEach((item) => {
      currentMap.set(item.skladova_polozka_id, item);
    });

    const allIds = Array.from(new Set([...currentMap.keys(), ...nextMap.keys()]));

    const rows = allIds.map((id) => {
      const current = currentMap.get(id);
      const next = nextMap.get(id);

      const naAute = current?.nalozeno ?? 0;
      const planDalsi = next?.plan ?? 0;
      const nazev = current?.nazev ?? next?.nazev ?? "Neznámá položka";

      const nechatNaAute = Math.min(naAute, planDalsi);
      const vylozit = Math.max(naAute - planDalsi, 0);
      const dolozit = Math.max(planDalsi - naAute, 0);

      return {
        skladova_polozka_id: id,
        nazev,
        naAute,
        planDalsi,
        nechatNaAute,
        vylozit,
        dolozit,
      };
    });

    return rows.sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));
  }, [activeCompareZakazka, data]);

  const summaryNechat = useMemo(
    () => compareRows.reduce((sum, row) => sum + row.nechatNaAute, 0),
    [compareRows]
  );

  const summaryVylozit = useMemo(
    () => compareRows.reduce((sum, row) => sum + row.vylozit, 0),
    [compareRows]
  );

  const summaryDolozit = useMemo(
    () => compareRows.reduce((sum, row) => sum + row.dolozit, 0),
    [compareRows]
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <StatBox label="Plán celkem" value={`${celkemPlan} ks`} />
          <StatBox label="Naloženo celkem" value={`${celkemNalozeno} ks`} />
          <StatBox label="Hotové položky" value={hotovoPolozek} />
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <div className="text-lg font-semibold text-white">Porovnání s další zakázkou</div>
            <div className="mt-1 text-sm text-slate-400">
              Skladník uvidí, co má nechat na autě, co vyložit a co doložit.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCompareMode("auto")}
              className={`rounded-xl px-4 py-2 font-semibold transition ${
                compareMode === "auto"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              }`}
            >
              Porovnat s další zakázkou
            </button>

            <button
              type="button"
              onClick={() => setCompareMode("manual")}
              className={`rounded-xl px-4 py-2 font-semibold transition ${
                compareMode === "manual"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              }`}
            >
              Vybrat zakázku
            </button>
          </div>

          {compareMode === "manual" ? (
            <div className="w-full min-w-0">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Porovnávací zakázka
              </label>
              <select
                value={selectedCompareZakazkaId || autoCompareZakazkaId || compareOptions[0]?.zakazka_id || ""}
                onChange={(e) => setSelectedCompareZakazkaId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
              >
                <option value="">Nevybráno</option>
                {compareOptions.map((option) => (
                  <option key={option.zakazka_id} value={option.zakazka_id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {activeCompareZakazka ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Porovnání</Badge>
                <Badge variant="warning">{activeCompareZakazka.label}</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <StatBox label="Nechat na autě" value={`${summaryNechat} ks`} />
                <StatBox label="Vyložit" value={`${summaryVylozit} ks`} />
                <StatBox label="Doložit" value={`${summaryDolozit} ks`} />
              </div>

              <div className="grid gap-4">
                {compareRows.map((row) => (
                  <Card key={row.skladova_polozka_id}>
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="text-2xl font-bold text-white">{row.nazev}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="default">Na autě: {row.naAute} ks</Badge>
                            <Badge variant="warning">Další zakázka: {row.planDalsi} ks</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <StatBox label="Nechat na autě" value={`${row.nechatNaAute} ks`} />
                        <StatBox label="Vyložit" value={`${row.vylozit} ks`} />
                        <StatBox label="Doložit" value={`${row.dolozit} ks`} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
              Není k dispozici žádná navazující zakázka pro porovnání.
            </div>
          )}
        </div>
      </Card>

      {data.length === 0 ? (
        <Card>
          <div className="text-sm text-slate-400">
            Zatím není co nakládat. Nejprve doplň techniku na zakázce.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data.map((r) => {
            const hotovo = r.plan > 0 && r.nalozeno >= r.plan;
            const plusDisabled = r.nalozeno >= r.plan;
            const minusDisabled = r.nalozeno <= 0;
            const progress = r.plan > 0 ? (r.nalozeno / r.plan) * 100 : 0;

            return (
              <Card
                key={r.skladova_polozka_id}
                className={hotovo ? "border-green-700/40 bg-green-950/10" : ""}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="text-2xl font-bold text-white">{r.nazev}</div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default">Plán: {r.plan} ks</Badge>
                        <Badge variant={hotovo ? "success" : "warning"}>
                          {hotovo ? "Hotovo" : "Rozpracováno"}
                        </Badge>
                      </div>
                    </div>

                    {!canEdit ? (
                      <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-lg font-bold text-white">
                        {r.nalozeno} / {r.plan} ks
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <StatBox label="Plán" value={`${r.plan} ks`} />
                    <StatBox label="Naloženo" value={`${r.nalozeno} ks`} />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm text-slate-400">
                      <span>Průběh</span>
                      <span>{Math.round(progress)} %</span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full transition-all ${
                          hotovo ? "bg-green-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      <button
                        type="button"
                        disabled={minusDisabled}
                        onMouseDown={() => !minusDisabled && startHold(uberAction, r, -1)}
                        onMouseUp={stopHold}
                        onMouseLeave={stopHold}
                        onTouchStart={() => !minusDisabled && startHold(uberAction, r, -1)}
                        onTouchEnd={stopHold}
                        onClick={() => !minusDisabled && void handleClick(uberAction, r, -1)}
                        className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-3xl font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        -
                      </button>

                      <div className="min-w-[120px] rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-center text-2xl font-bold text-white">
                        {r.nalozeno} / {r.plan}
                      </div>

                      <button
                        type="button"
                        disabled={plusDisabled}
                        onMouseDown={() => !plusDisabled && startHold(pridejAction, r, 1)}
                        onMouseUp={stopHold}
                        onMouseLeave={stopHold}
                        onTouchStart={() => !plusDisabled && startHold(pridejAction, r, 1)}
                        onTouchEnd={stopHold}
                        onClick={() => !plusDisabled && void handleClick(pridejAction, r, 1)}
                        className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600 text-3xl font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        +
                      </button>

                      {hotovo ? (
                        <div className="text-sm font-semibold text-green-400">Hotovo</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}


