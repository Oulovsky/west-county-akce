"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";

type Blok = {
  sklad_blok_id: string;
  nazev: string;
  poradi: number;
  pocet_polozek: number;
  kusu_celkem: number;
};

type PoskozeniStatRow = {
  poskozeni_id: string;
  pocet_kusu: number | string;
  blokuje_pouziti: boolean;
  datum_uzavreni: string | null;
};

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: number | string | null | undefined): string {
  const parsed = Number(value ?? 0);
  return new Intl.NumberFormat("cs-CZ").format(parsed);
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3",
        tone === "danger"
          ? "border-amber-900 bg-amber-950/30"
          : "border-slate-800 bg-slate-900/70",
      ].join(" ")}
    >
      <div className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div
        className={[
          "mt-1 text-2xl font-semibold",
          tone === "danger" ? "text-amber-300" : "text-white",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

export default function SkladPage() {
  const [bloky, setBloky] = useState<Blok[]>([]);
  const [poskozeniStats, setPoskozeniStats] = useState<PoskozeniStatRow[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNazev, setNewNazev] = useState("");
  const [saving, setSaving] = useState(false);

  const menuRef = useRef<HTMLDivElement | null>(null);

  async function loadBloky() {
    const { data, error } = await supabase.rpc("get_sklad_bloky");

    if (error) {
      console.error(error);
      return;
    }

    setBloky((data ?? []) as Blok[]);
  }

  async function loadPoskozeniStats() {
    const { data, error } = await supabase
      .from("hlaseni_poskozeni")
      .select("poskozeni_id, pocet_kusu, blokuje_pouziti, datum_uzavreni")
      .is("datum_uzavreni", null);

    if (error) {
      console.error(error);
      return;
    }

    setPoskozeniStats((data ?? []) as PoskozeniStatRow[]);
  }

  async function load() {
    await Promise.all([loadBloky(), loadPoskozeniStats()]);
  }

  async function handleDelete(id: string) {
    const ok = window.confirm("Opravdu chcete blok smazat?");
    if (!ok) return;

    const { error } = await supabase.rpc("delete_sklad_blok", {
      p_sklad_blok_id: id,
    });

    if (error) {
      console.error(error);
      return;
    }

    setOpenMenuId(null);
    await loadBloky();
  }

  async function handleEdit(blok: Blok) {
    const name = window.prompt("Nový název", blok.nazev);

    if (!name || !name.trim()) return;

    const { error } = await supabase
      .from("sklad_bloky")
      .update({ nazev: name.trim() })
      .eq("sklad_blok_id", blok.sklad_blok_id);

    if (error) {
      console.error(error);
      return;
    }

    setOpenMenuId(null);
    await loadBloky();
  }

  function openAddModal() {
    setNewNazev("");
    setIsAddOpen(true);
  }

  function closeAddModal() {
    if (saving) return;
    setIsAddOpen(false);
  }

  async function handleAdd() {
    if (!newNazev.trim()) return;

    setSaving(true);

    const { error } = await supabase.rpc("create_sklad_blok", {
      p_nazev: newNazev.trim(),
    });

    setSaving(false);

    if (error) {
      console.error(error);
      return;
    }

    setIsAddOpen(false);
    setNewNazev("");
    await loadBloky();
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDraggingId(id);
    setDragOverId(null);
    setOpenMenuId(null);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
  }

  function handleDragEnter(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    setDragOverId(targetId);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;

    if (dragOverId !== targetId) {
      setDragOverId(targetId);
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;

    if (dragOverId === targetId) {
      setDragOverId(null);
    }
  }

  async function handleDrop(targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const newOrder = [...bloky];
    const from = newOrder.findIndex((b) => b.sklad_blok_id === draggingId);
    const to = newOrder.findIndex((b) => b.sklad_blok_id === targetId);

    if (from < 0 || to < 0) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);

    setBloky(newOrder);
    setDraggingId(null);
    setDragOverId(null);

    const orderedIds = newOrder.map((b) => b.sklad_blok_id);

    const { error } = await supabase.rpc("set_sklad_blok_poradi", {
      p_ids: orderedIds,
    });

    if (error) {
      console.error(error);
      await loadBloky();
      return;
    }

    await loadBloky();
  }

  useEffect(() => {
    const run = async () => {
      await load();
    };

    void run();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("sklad-home-poskozeni")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hlaseni_poskozeni",
        },
        async () => {
          await loadPoskozeniStats();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current || !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenuId(null);
        setIsAddOpen(false);
        setDraggingId(null);
        setDragOverId(null);
      }
    }

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const otevrenaHlaseni = useMemo(() => poskozeniStats.length, [poskozeniStats]);

  const blokovaneKusy = useMemo(
    () =>
      poskozeniStats.reduce(
        (sum, row) => sum + (row.blokuje_pouziti ? toNumber(row.pocet_kusu) : 0),
        0
      ),
    [poskozeniStats]
  );

  const celkemPolozek = useMemo(
    () => bloky.reduce((sum, blok) => sum + toNumber(blok.pocet_polozek), 0),
    [bloky]
  );

  const celkemKusu = useMemo(
    () => bloky.reduce((sum, blok) => sum + toNumber(blok.kusu_celkem), 0),
    [bloky]
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-white">Sklad</h1>
          <p className="text-sm text-slate-400">
            Přehled skladových okruhů a rychlé vstupy do správy skladu.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/sklad/sprava"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Správa skladu
          </Link>

          <Link
            href="/sklad/konfigurace"
            className="inline-flex items-center justify-center rounded-xl border border-blue-700 bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Konfigurace skladu
          </Link>

          <Link
            href="/sklad/poskozeni"
            className="inline-flex items-center justify-center rounded-xl border border-amber-700 bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
          >
            Otevřená poškození
          </Link>

          <Link
            href="/sklad/statistika"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Statistika poškození
          </Link>

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-xl border border-blue-500 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Přidat okruh
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <StatCard label="Skladové okruhy" value={formatNumber(bloky.length)} />
        <StatCard label="Položek v okruzích" value={formatNumber(celkemPolozek)} />
        <StatCard label="Kusů celkem" value={formatNumber(celkemKusu)} />
        <StatCard
          label="Otevřená poškození"
          value={formatNumber(otevrenaHlaseni)}
          tone="danger"
        />
        <StatCard
          label="Blokované kusy"
          value={formatNumber(blokovaneKusy)}
          tone="danger"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 text-sm font-semibold text-white">Okruhy skladu</div>
        <div className="text-sm text-slate-400">
          Drag and drop mění pořadí okruhů. Klik na kartu otevře detail okruhu.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {bloky.map((blok) => {
          const isDragging = draggingId === blok.sklad_blok_id;
          const isDragOver = dragOverId === blok.sklad_blok_id;

          return (
            <div
              key={blok.sklad_blok_id}
              draggable
              onDragStart={(e) => handleDragStart(e, blok.sklad_blok_id)}
              onDragEnd={handleDragEnd}
              onDragEnter={() => handleDragEnter(blok.sklad_blok_id)}
              onDragOver={(e) => handleDragOver(e, blok.sklad_blok_id)}
              onDragLeave={(e) => handleDragLeave(e, blok.sklad_blok_id)}
              onDrop={() => void handleDrop(blok.sklad_blok_id)}
              className={[
                "relative overflow-hidden rounded-2xl border transition",
                isDragOver
                  ? "border-blue-400 bg-blue-950/30 shadow-[0_0_0_1px_rgba(96,165,250,0.25),0_10px_28px_rgba(37,99,235,0.18)]"
                  : "border-slate-800 bg-slate-900/70 shadow-[0_6px_18px_rgba(0,0,0,0.18)]",
                isDragging ? "scale-[0.985] opacity-45" : "",
              ].join(" ")}
              style={{
                cursor: isDragging ? "grabbing" : "grab",
                transform:
                  !isDragging && isDragOver ? "translateY(-2px)" : undefined,
              }}
            >
              <Link
                href={`/sklad/okruh/${blok.sklad_blok_id}`}
                title={blok.nazev}
                className="block min-h-[190px] p-6 pr-20 text-white no-underline"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="break-words text-3xl font-extrabold leading-none tracking-tight">
                    {blok.nazev}
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-slate-300">
                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <div className="text-slate-500">Položek</div>
                    <div className="font-semibold text-white">
                      {formatNumber(blok.pocet_polozek)}
                    </div>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <div className="text-slate-500">Kusů celkem</div>
                    <div className="font-semibold text-white">
                      {formatNumber(blok.kusu_celkem)}
                    </div>
                  </div>

                  <div className="grid grid-cols-[120px_1fr] gap-3">
                    <div className="text-slate-500">Pořadí</div>
                    <div className="font-semibold text-white">
                      {formatNumber(blok.poradi)}
                    </div>
                  </div>
                </div>
              </Link>

              <div
                ref={openMenuId === blok.sklad_blok_id ? menuRef : null}
                className="absolute right-3 top-3 z-30"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setOpenMenuId(
                      openMenuId === blok.sklad_blok_id ? null : blok.sklad_blok_id
                    );
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-xl text-white transition hover:bg-slate-700"
                >
                  ⋮
                </button>

                {openMenuId === blok.sklad_blok_id && (
                  <div
                    className="absolute right-0 top-12 z-40 min-w-[160px] rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleEdit(blok);
                      }}
                      className="mb-2 block w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-white transition hover:bg-slate-700"
                    >
                      Upravit
                    </button>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleDelete(blok.sklad_blok_id);
                      }}
                      className="block w-full rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-left text-sm text-white transition hover:bg-red-900/60"
                    >
                      Smazat
                    </button>
                  </div>
                )}
              </div>

              {isDragOver && (
                <div className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_0_0_2px_rgba(96,165,250,0.65)]" />
              )}
            </div>
          );
        })}
      </div>

      <Modal open={isAddOpen} onClose={closeAddModal} title="Přidat okruh">
        <div className="grid gap-4">
          <input
            value={newNazev}
            onChange={(e) => setNewNazev(e.target.value)}
            placeholder="Název okruhu"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleAdd();
              }
            }}
          />

          <div className="flex justify-end gap-3">
            <button
              onClick={closeAddModal}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-white"
            >
              Zrušit
            </button>

            <button
              onClick={() => void handleAdd()}
              disabled={!newNazev.trim() || saving}
              className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Ukládám..." : "Uložit"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}