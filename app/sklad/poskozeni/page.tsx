"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";

type Row = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  kus_id: string | null;
  nazev: string;
  pocet_kusu: number;
  typ_poskozeni: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  datum_nahlaseni: string;
  datum_uzavreni: string | null;
};

type KusInfo = {
  kus_id: string;
  skladova_polozka_id: string;
  poradove_cislo: number;
  evidencni_cislo: string | null;
};

function slug(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function colorClass(value: string | null) {
  const s = slug(value);

  if (s.includes("krit")) return "bg-red-600";
  if (s.includes("vys")) return "bg-orange-500";
  if (s.includes("stred")) return "bg-yellow-500 text-slate-950";
  if (s.includes("niz")) return "bg-slate-500";
  return "bg-slate-600";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function getKusLabel(row: Row, kusyById: Record<string, KusInfo>) {
  if (!row.kus_id) return row.nazev;

  const kus = kusyById[row.kus_id];

  if (!kus) return row.nazev;

  return kus.evidencni_cislo?.trim()
    ? kus.evidencni_cislo
    : `${row.nazev} #${kus.poradove_cislo}`;
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "border-blue-500 bg-blue-600 text-white"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function Page() {
  const [data, setData] = useState<Row[]>([]);
  const [kusyById, setKusyById] = useState<Record<string, KusInfo>>({});
  const [loading, setLoading] = useState(true);

  const [stav, setStav] = useState("open");
  const [blokuje, setBlokuje] = useState("all");
  const [priorita, setPriorita] = useState("all");

  const [actionRow, setActionRow] = useState<Row | null>(null);
  const [savingAction, setSavingAction] = useState<string | null>(null);

  async function loadKusy(rows: Row[]) {
    const kusIds = Array.from(
      new Set(
        rows
          .map((row) => row.kus_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (kusIds.length === 0) {
      setKusyById({});
      return;
    }

    const { data, error } = await supabase
      .from("sklad_polozky_kusy")
      .select("kus_id, skladova_polozka_id, poradove_cislo, evidencni_cislo")
      .in("kus_id", kusIds)
      .order("poradove_cislo", { ascending: true });

    if (error) {
      console.error(error);
      setKusyById({});
      return;
    }

    const map: Record<string, KusInfo> = {};

    ((data ?? []) as KusInfo[]).forEach((kus) => {
      map[kus.kus_id] = kus;
    });

    setKusyById(map);
  }

  async function load() {
    setLoading(true);

    const { data, error } = await supabase.rpc("get_poskozeni_full");

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data ?? []) as Row[];

    setData(rows);
    await loadKusy(rows);
  }

  useEffect(() => {
    const run = async () => {
      await load();
    };

    void run();

    const ch = supabase
      .channel("poskozeni-all")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hlaseni_poskozeni" },
        async () => {
          await load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (stav === "open" && r.datum_uzavreni) return false;
      if (stav === "closed" && !r.datum_uzavreni) return false;

      if (blokuje === "yes" && !r.blokuje_pouziti) return false;
      if (blokuje === "no" && r.blokuje_pouziti) return false;

      if (priorita !== "all" && slug(r.priorita) !== priorita) return false;

      return true;
    });
  }, [data, stav, blokuje, priorita]);

  function openActionDialog(row: Row) {
    setActionRow(row);
  }

  function closeActionDialog() {
    if (savingAction) return;
    setActionRow(null);
  }

  async function odblokovatZachovatHlaseni() {
    if (!actionRow) return;

    setSavingAction("odblokovat");

    const { error } = await supabase
      .from("hlaseni_poskozeni")
      .update({
        blokuje_pouziti: false,
        stav_reseni: "otevrene",
        datum_uzavreni: null,
      })
      .eq("poskozeni_id", actionRow.poskozeni_id);

    setSavingAction(null);

    if (error) {
      alert(error.message);
      return;
    }

    setActionRow(null);
    await load();
  }

  async function opravenoUzavrit() {
    if (!actionRow) return;

    setSavingAction("uzavrit");

    const { error } = await supabase
      .from("hlaseni_poskozeni")
      .update({
        blokuje_pouziti: false,
        stav_reseni: "uzavrene",
        datum_uzavreni: new Date().toISOString(),
      })
      .eq("poskozeni_id", actionRow.poskozeni_id);

    setSavingAction(null);

    if (error) {
      alert(error.message);
      return;
    }

    setActionRow(null);
    await load();
  }

  const openCount = data.filter((r) => !r.datum_uzavreni).length;
  const blockingCount = data.filter(
    (r) => !r.datum_uzavreni && r.blokuje_pouziti
  ).length;
  const closedCount = data.filter((r) => !!r.datum_uzavreni).length;
  const totalPieces = filtered.reduce(
    (sum, item) => sum + Number(item.pocet_kusu ?? 0),
    0
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <div>
            <Link
              href="/sklad"
              className="inline-flex items-center text-sm font-medium text-slate-300 transition hover:text-white"
            >
              ← Zpět na sklad
            </Link>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Poškození
          </h1>
          <p className="text-sm text-slate-400">
            Centrální přehled hlášení poškození napříč skladem.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Otevřená hlášení
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">{openCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Blokující
          </div>
          <div className="mt-1 text-2xl font-semibold text-rose-400">
            {blockingCount}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Uzavřená
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">{closedCount}</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Kusů ve filtru
          </div>
          <div className="mt-1 text-2xl font-semibold text-amber-300">
            {new Intl.NumberFormat("cs-CZ").format(totalPieces)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 text-sm font-semibold text-white">Filtry</div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[90px] text-xs font-semibold uppercase tracking-wide text-slate-500">
              Stav
            </div>
            <FilterButton active={stav === "all"} onClick={() => setStav("all")}>
              Vše
            </FilterButton>
            <FilterButton active={stav === "open"} onClick={() => setStav("open")}>
              Otevřené
            </FilterButton>
            <FilterButton
              active={stav === "closed"}
              onClick={() => setStav("closed")}
            >
              Uzavřené
            </FilterButton>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[90px] text-xs font-semibold uppercase tracking-wide text-slate-500">
              Použití
            </div>
            <FilterButton
              active={blokuje === "all"}
              onClick={() => setBlokuje("all")}
            >
              Vše
            </FilterButton>
            <FilterButton
              active={blokuje === "yes"}
              onClick={() => setBlokuje("yes")}
            >
              Blokuje
            </FilterButton>
            <FilterButton active={blokuje === "no"} onClick={() => setBlokuje("no")}>
              Neblokuje
            </FilterButton>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[90px] text-xs font-semibold uppercase tracking-wide text-slate-500">
              Priorita
            </div>
            <FilterButton
              active={priorita === "all"}
              onClick={() => setPriorita("all")}
            >
              Všechny
            </FilterButton>
            <FilterButton
              active={priorita === "kriticka"}
              onClick={() => setPriorita("kriticka")}
            >
              Kritická
            </FilterButton>
            <FilterButton
              active={priorita === "vysoka"}
              onClick={() => setPriorita("vysoka")}
            >
              Vysoká
            </FilterButton>
            <FilterButton
              active={priorita === "stredni"}
              onClick={() => setPriorita("stredni")}
            >
              Střední
            </FilterButton>
            <FilterButton
              active={priorita === "nizka"}
              onClick={() => setPriorita("nizka")}
            >
              Nízká
            </FilterButton>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-300">
          Načítám...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-400">
          Tomuto filtru nic neodpovídá.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => {
            const isClosed = !!r.datum_uzavreni;
            const isSaving = actionRow?.poskozeni_id === r.poskozeni_id && !!savingAction;
            const kusLabel = getKusLabel(r, kusyById);

            return (
              <div
                key={r.poskozeni_id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/sklad/${r.skladova_polozka_id}`}
                        className="text-lg font-semibold text-white transition hover:text-blue-300"
                      >
                        {kusLabel}
                      </Link>

                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white">
                        {r.nazev}
                      </span>

                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white">
                        {new Intl.NumberFormat("cs-CZ").format(r.pocet_kusu)} ks
                      </span>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold text-white",
                          colorClass(r.priorita),
                        ].join(" ")}
                      >
                        {r.priorita ?? "bez priority"}
                      </span>

                      <span className="rounded-full bg-blue-900 px-2.5 py-1 text-xs font-semibold text-blue-100">
                        {r.typ_poskozeni ?? "bez typu"}
                      </span>

                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          isClosed
                            ? "bg-emerald-900 text-emerald-100"
                            : "bg-rose-900 text-rose-100",
                        ].join(" ")}
                      >
                        {isClosed ? "uzavřené" : "otevřené"}
                      </span>

                      {r.blokuje_pouziti ? (
                        <span className="rounded-full bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white">
                          blokuje použití
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-900 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                          neblokuje použití
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                      <div>
                        <span className="text-slate-500">Kus:</span>{" "}
                        <span className="font-semibold text-white">
                          {kusLabel}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500">Nahlášeno:</span>{" "}
                        {formatDateTime(r.datum_nahlaseni)}
                      </div>

                      <div>
                        <span className="text-slate-500">Uzavřeno:</span>{" "}
                        {formatDateTime(r.datum_uzavreni)}
                      </div>
                    </div>
                  </div>

                  {!isClosed ? (
                    <div className="flex shrink-0 items-start">
                      <button
                        onClick={() => openActionDialog(r)}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-default disabled:opacity-70"
                      >
                        {isSaving ? "Ukládám..." : "Vyřešit"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!actionRow} onClose={closeActionDialog} title="Vyřešit hlášení poškození">
        {actionRow ? (
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200">
              <div className="font-semibold text-white">
                {getKusLabel(actionRow, kusyById)}
              </div>
              <div className="mt-1 text-slate-400">
                {actionRow.nazev} · {actionRow.typ_poskozeni ?? "bez typu"} · {actionRow.priorita ?? "bez priority"}
              </div>
            </div>

            <div className="grid gap-3">
              <button
                onClick={() => void odblokovatZachovatHlaseni()}
                disabled={!!savingAction}
                className="rounded-xl border border-amber-700 bg-amber-900 px-4 py-4 text-left text-sm text-white transition hover:bg-amber-800 disabled:opacity-60"
              >
                <span className="block font-semibold">
                  Stále poškozené, ale odblokovat
                </span>
                <span className="mt-1 block text-amber-100/80">
                  Hlášení zůstane otevřené v evidenci poškození, ale nebude blokovat použití položky.
                </span>
              </button>

              <button
                onClick={() => void opravenoUzavrit()}
                disabled={!!savingAction}
                className="rounded-xl border border-emerald-600 bg-emerald-700 px-4 py-4 text-left text-sm text-white transition hover:bg-emerald-600 disabled:opacity-60"
              >
                <span className="block font-semibold">
                  Opraveno, uzavřít
                </span>
                <span className="mt-1 block text-emerald-100/80">
                  Hlášení se uzavře, nastaví se datum uzavření a položka nebude blokovaná.
                </span>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={closeActionDialog}
                disabled={!!savingAction}
                className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                Zrušit
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}