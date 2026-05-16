"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
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
  vraceno_ze_zakazky: number;
  poskozeno_na_zakazce: number;
  rezerva_na_zakazce: number;
  rezervovano_jinde: number;
  k_dispozici: number;
  max_na_teto_zakazce: number;
};

type TechnikaNaZakazceRow = {
  skladova_polozka_id: string;
  mnozstvi: number;
};

type ZakazkaKusRow = {
  kus_id: string;
  stav: string | null;
  is_rezerva: boolean | null;
};

type SkladKusRow = {
  kus_id: string;
  skladova_polozka_id: string;
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
  const [data, setData] = useState<Radek[]>(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

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
      const { data: assignmentsRaw, error: assignmentsError } = await supabase
        .from("zakazka_kusy")
        .select("kus_id, stav, is_rezerva")
        .eq("zakazka_id", zakazkaId);

      if (assignmentsError) return;

      const assignments = (assignmentsRaw || []) as ZakazkaKusRow[];
      const kusIds = assignments.map((row) => row.kus_id).filter(Boolean);
      let kusRows: SkladKusRow[] = [];

      if (kusIds.length > 0) {
        const { data: kusRowsRaw, error: kusRowsError } = await supabase
          .from("sklad_polozky_kusy")
          .select("kus_id, skladova_polozka_id")
          .in("kus_id", kusIds);

        if (kusRowsError) return;
        kusRows = (kusRowsRaw || []) as SkladKusRow[];
      }

      const kusToPolozka = new Map(
        kusRows.map((row) => [row.kus_id, row.skladova_polozka_id])
      );
      const countsByPolozka = new Map<
        string,
        { aktivni: number; vraceno: number; poskozeno: number; rezerva: number }
      >();

      for (const assignment of assignments) {
        const polozkaId = kusToPolozka.get(assignment.kus_id);
        if (!polozkaId) continue;

        const counts = countsByPolozka.get(polozkaId) ?? {
          aktivni: 0,
          vraceno: 0,
          poskozeno: 0,
          rezerva: 0,
        };

        if (assignment.stav === "vraceno") {
          counts.vraceno += 1;
        } else {
          counts.aktivni += 1;
          if (assignment.is_rezerva) counts.rezerva += 1;
          if (assignment.stav === "poskozeno") counts.poskozeno += 1;
        }

        countsByPolozka.set(polozkaId, counts);
      }

      setData((prev) =>
        prev.map((r) => {
          const counts = countsByPolozka.get(r.skladova_polozka_id) ?? {
            aktivni: 0,
            vraceno: 0,
            poskozeno: 0,
            rezerva: 0,
          };

          return {
            ...r,
            skutecne_na_zakazce: counts.aktivni,
            vraceno_ze_zakazky: counts.vraceno,
            poskozeno_na_zakazce: counts.poskozeno,
            rezerva_na_zakazce: counts.rezerva,
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

    const realChannel = supabase
      .channel(`technika-real-${zakazkaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "zakazka_kusy",
          filter: `zakazka_id=eq.${zakazkaId}`,
        },
        async () => {
          await refreshReal();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(technikaChannel);
      void supabase.removeChannel(realChannel);
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
    () => data.reduce((sum, r) => sum + r.poskozeno_na_zakazce, 0),
    [data]
  );

  const celkemRezerva = useMemo(
    () => data.reduce((sum, r) => sum + r.rezerva_na_zakazce, 0),
    [data]
  );

  const celkemVraceno = useMemo(
    () => data.reduce((sum, r) => sum + r.vraceno_ze_zakazky, 0),
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
          <StatBox label="Plánováno na zakázce" value={`${celkemPlan} ks`} />
          <StatBox label="Skutečně na zakázce" value={`${celkemReal} ks`} />
          <StatBox label="Poškozené na zakázce" value={`${celkemPoskozeno} ks`} />
          <StatBox label="Rezerva" value={`${celkemRezerva} ks`} />
          <StatBox label="Vráceno" value={`${celkemVraceno} ks`} />
          <StatBox label="Počet položek" value={pocetPolozek} />
          <StatBox label="Aktivní položky" value={aktivnichPolozek} />
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
                    <Badge variant="default">Plán: {radek.na_zakazce} ks</Badge>
                    <Badge variant="success">Skutečně: {radek.skutecne_na_zakazce} ks</Badge>

                    {rozdil === 0 ? (
                      <Badge variant="success">Sedí s realitou</Badge>
                    ) : rozdil > 0 ? (
                      <Badge variant="warning">Navíc na akci: +{rozdil} ks</Badge>
                    ) : (
                      <Badge variant="danger">Chybí proti plánu: {Math.abs(rozdil)} ks</Badge>
                    )}

                    {radek.rezervovano_jinde > 0 ? (
                      <Badge variant="warning">
                        Rezervováno jinde: {radek.rezervovano_jinde} ks
                      </Badge>
                    ) : (
                      <Badge variant="success">Bez kolize skladu</Badge>
                    )}

                    {radek.poskozene > 0 ? (
                      <Badge variant="danger">Poškozené: {radek.poskozene} ks</Badge>
                    ) : null}
                    {radek.rezerva_na_zakazce > 0 ? (
                      <Badge variant="warning">Rezerva: {radek.rezerva_na_zakazce} ks</Badge>
                    ) : null}
                    {radek.vraceno_ze_zakazky > 0 ? (
                      <Badge variant="default">Vráceno: {radek.vraceno_ze_zakazky} ks</Badge>
                    ) : null}
                    {radek.poskozeno_na_zakazce > 0 ? (
                      <Badge variant="danger">
                        Poškozeno na zakázce: {radek.poskozeno_na_zakazce} ks
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {!canEdit ? (
                  <div className="grid min-w-[180px] gap-2">
                    <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-center text-lg font-bold text-white">
                      Plán: {radek.na_zakazce} ks
                    </div>
                    <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3 text-center text-lg font-bold text-emerald-100">
                      Reál: {radek.skutecne_na_zakazce} ks
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-6">
                <StatBox label="Sklad celkem" value={`${radek.sklad_celkem} ks`} />
                <StatBox label="Poškozené" value={`${radek.poskozene} ks`} />
                <StatBox label="Rezervováno jinde" value={`${radek.rezervovano_jinde} ks`} />
                <StatBox label="K dispozici" value={`${radek.k_dispozici} ks`} />
                <StatBox label="Maximum pro zakázku" value={`${radek.max_na_teto_zakazce} ks`} />
                <StatBox label="Reálný stav" value={`${radek.skutecne_na_zakazce} ks`} />
                <StatBox label="Rezerva" value={`${radek.rezerva_na_zakazce} ks`} />
                <StatBox label="Vráceno" value={`${radek.vraceno_ze_zakazky} ks`} />
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
                      Plán: {radek.na_zakazce} ks
                    </div>
                    <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/30 px-4 py-3 text-center text-lg font-bold text-emerald-100">
                      Reál: {radek.skutecne_na_zakazce} ks
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


