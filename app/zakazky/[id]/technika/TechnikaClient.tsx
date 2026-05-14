"use client";

import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

type Radek = {
  skladova_polozka_id: string;
  nazev: string;
  sklad_celkem: number;
  poskozene: number;
  na_zakazce: number;
  skutecne_na_zakazce: number;
  rezervovano_jinde: number;
  k_dispozici: number;
  max_na_teto_zakazce: number;
};

type TechnikaNaZakazceRow = {
  skladova_polozka_id: string;
  mnozstvi: number;
};

type StavTechnikyNaZakazceRow = {
  skladova_polozka_id: string;
  nazev: string;
  mnozstvi: number;
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

export default function TechnikaClient({
  initialData,
  zakazkaId,
  pridejAction,
  uberAction,
  canEdit,
}: {
  initialData: Radek[];
  zakazkaId: string;
  pridejAction: (formData: FormData) => Promise<void>;
  uberAction: (formData: FormData) => Promise<void>;
  canEdit: boolean;
}) {
  const data = initialData;

  useEffect(() => {
    async function refreshPlanned() {
      const { data: freshRaw } = await supabase
        .from("technika_na_zakazce")
        .select("skladova_polozka_id, mnozstvi")
        .eq("zakazka_id", zakazkaId);

      const fresh = (freshRaw || []) as TechnikaNaZakazceRow[];

      setData((prev) =>
        prev.map((r) => {
          const noveNaZakazce =
            fresh.find(
              (f: TechnikaNaZakazceRow) => f.skladova_polozka_id === r.skladova_polozka_id
            )?.mnozstvi || 0;

          return {
            ...r,
            na_zakazce: noveNaZakazce,
            k_dispozici: Math.max(0, r.max_na_teto_zakazce - noveNaZakazce),
          };
        })
      );
    }

    async function refreshReal() {
      const { data: freshRealRaw, error } = await supabase.rpc("get_stav_techniky_na_zakazce", {
        p_zakazka_id: zakazkaId,
      });

      if (error) return;

      const freshReal = (freshRealRaw || []) as StavTechnikyNaZakazceRow[];

      setData((prev) =>
        prev.map((r) => {
          const skutecne =
            freshReal.find(
              (f: StavTechnikyNaZakazceRow) => f.skladova_polozka_id === r.skladova_polozka_id
            )?.mnozstvi || 0;

          return {
            ...r,
            skutecne_na_zakazce: skutecne,
          };
        })
      );
    }

    const technikaChannel = supabase
      .channel(`technika-plan-${zakazkaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "technika_na_zakazce",
          filter: `zakazka_id=eq.${zakazkaId}`,
        },
        async () => {
          await refreshPlanned();
        }
      )
      .subscribe();

    const pohybChannel = supabase
      .channel(`technika-real-${zakazkaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pohyb_polozky",
        },
        async () => {
          await refreshReal();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(technikaChannel);
      void supabase.removeChannel(pohybChannel);
    };
  }, [zakazkaId]);

  const celkemPlan = useMemo(
    () => data.reduce((sum, r) => sum + r.na_zakazce, 0),
    [data]
  );

  const celkemReal = useMemo(
    () => data.reduce((sum, r) => sum + r.skutecne_na_zakazce, 0),
    [data]
  );

  const celkemPoskozeno = useMemo(
    () => data.reduce((sum, r) => sum + r.poskozene, 0),
    [data]
  );

  const pocetPolozek = data.length;

  const aktivnichPolozek = useMemo(
    () => data.filter((r) => r.na_zakazce > 0 || r.skutecne_na_zakazce > 0).length,
    [data]
  );

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-3 md:grid-cols-5">
          <StatBox label="PlĂˇnovĂˇno na zakĂˇzce" value={`${celkemPlan} ks`} />
          <StatBox label="SkuteÄŤnÄ› na zakĂˇzce" value={`${celkemReal} ks`} />
          <StatBox label="PoĹˇkozenĂ© kusy" value={`${celkemPoskozeno} ks`} />
          <StatBox label="PoÄŤet poloĹľek" value={pocetPolozek} />
          <StatBox label="AktivnĂ­ poloĹľky" value={aktivnichPolozek} />
        </div>
      </Card>

      <div className="grid gap-4">
        {data.map((radek) => {
          const plusDisabled = radek.na_zakazce >= radek.max_na_teto_zakazce;
          const minusDisabled = radek.na_zakazce <= 0;
          const rozdil = radek.skutecne_na_zakazce - radek.na_zakazce;

          return (
            <Card key={radek.skladova_polozka_id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-white">{radek.nazev}</div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">PlĂˇn: {radek.na_zakazce} ks</Badge>
                    <Badge variant="success">SkuteÄŤnÄ›: {radek.skutecne_na_zakazce} ks</Badge>

                    {rozdil === 0 ? (
                      <Badge variant="success">SedĂ­ s realitou</Badge>
                    ) : rozdil > 0 ? (
                      <Badge variant="warning">NavĂ­c na akci: +{rozdil} ks</Badge>
                    ) : (
                      <Badge variant="danger">ChybĂ­ proti plĂˇnu: {Math.abs(rozdil)} ks</Badge>
                    )}

                    {radek.rezervovano_jinde > 0 ? (
                      <Badge variant="warning">
                        RezervovĂˇno jinde: {radek.rezervovano_jinde} ks
                      </Badge>
                    ) : (
                      <Badge variant="success">Bez kolize skladu</Badge>
                    )}

                    {radek.poskozene > 0 ? (
                      <Badge variant="danger">PoĹˇkozenĂ©: {radek.poskozene} ks</Badge>
                    ) : null}
                  </div>
                </div>

                {!canEdit ? (
                  <div className="grid min-w-[180px] gap-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-center text-lg font-bold text-white">
                      PlĂˇn: {radek.na_zakazce} ks
                    </div>
                    <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3 text-center text-lg font-bold text-emerald-100">
                      ReĂˇl: {radek.skutecne_na_zakazce} ks
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-6">
                <StatBox label="Sklad celkem" value={`${radek.sklad_celkem} ks`} />
                <StatBox label="PoĹˇkozenĂ©" value={`${radek.poskozene} ks`} />
                <StatBox label="RezervovĂˇno jinde" value={`${radek.rezervovano_jinde} ks`} />
                <StatBox label="K dispozici" value={`${radek.k_dispozici} ks`} />
                <StatBox label="Maximum pro zakĂˇzku" value={`${radek.max_na_teto_zakazce} ks`} />
                <StatBox label="ReĂˇlnĂ˝ stav" value={`${radek.skutecne_na_zakazce} ks`} />
              </div>

              {canEdit ? (
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <form action={uberAction}>
                    <input type="hidden" name="zakazka_id" value={zakazkaId} />
                    <input
                      type="hidden"
                      name="skladova_polozka_id"
                      value={radek.skladova_polozka_id}
                    />
                    <button
                      type="submit"
                      disabled={minusDisabled}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-3xl font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      -
                    </button>
                  </form>

                  <div className="grid min-w-[150px] gap-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-center text-2xl font-bold text-white">
                      PlĂˇn: {radek.na_zakazce} ks
                    </div>
                    <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3 text-center text-lg font-bold text-emerald-100">
                      ReĂˇl: {radek.skutecne_na_zakazce} ks
                    </div>
                  </div>

                  <form action={pridejAction}>
                    <input type="hidden" name="zakazka_id" value={zakazkaId} />
                    <input
                      type="hidden"
                      name="skladova_polozka_id"
                      value={radek.skladova_polozka_id}
                    />
                    <button
                      type="submit"
                      disabled={plusDisabled}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/40 bg-blue-600 text-3xl font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      +
                    </button>
                  </form>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

