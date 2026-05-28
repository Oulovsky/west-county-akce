"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { supabase } from "@/lib/supabase";
import { SKLAD_REALTIME_CHANNEL, SKLAD_TABLE } from "@/lib/sklad/constants";
import { queryTechnickyVlastniciFull } from "@/lib/sklad/queries";
import type { TechnickyVlastnik } from "@/lib/sklad/types";

type EditDraft = {
  nazev: string;
  kod: string;
  poznamka: string;
};

function sortVlastniciRows(rows: TechnickyVlastnik[]): TechnickyVlastnik[] {
  return [...rows].sort((a, b) => {
    if (a.aktivni !== b.aktivni) return a.aktivni ? -1 : 1;
    if (a.poradi !== b.poradi) return a.poradi - b.poradi;
    return a.nazev.localeCompare(b.nazev, "cs");
  });
}

function nextPoradi(rows: TechnickyVlastnik[]) {
  const max = rows.reduce((acc, row) => Math.max(acc, row.poradi ?? 0), 0);
  return max + 10;
}

export default function SkladVlastniciKonfiguracePage() {
  const [data, setData] = useState<TechnickyVlastnik[]>([]);
  const [loading, setLoading] = useState(true);

  const [newNazev, setNewNazev] = useState("");
  const [newKod, setNewKod] = useState("");
  const [newPoznamka, setNewPoznamka] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({
    nazev: "",
    kod: "",
    poznamka: "",
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const editRef = useRef<HTMLDivElement | null>(null);

  const sorted = useMemo(() => sortVlastniciRows(data), [data]);

  async function load() {
    setLoading(true);

    const { data: rows, error } = await queryTechnickyVlastniciFull(supabase);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setData((rows ?? []) as TechnickyVlastnik[]);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(SKLAD_REALTIME_CHANNEL.spravaTechnickyVlastnici)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: SKLAD_TABLE.technickyVlastnici,
        },
        async () => {
          await load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!editingId) return;

    const currentEditingId = editingId;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;

      if (!editRef.current) return;
      if (target && editRef.current.contains(target)) return;

      void save(currentEditingId);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setEditingId(null);
      setDraft({ nazev: "", kod: "", poznamka: "" });
    }

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingId, draft]);

  async function create() {
    const nazev = newNazev.trim();
    const kod = newKod.trim();
    const poznamka = newPoznamka.trim();

    if (!nazev || !kod) return;

    setCreating(true);

    const { error } = await supabase.from(SKLAD_TABLE.technickyVlastnici).insert({
      nazev,
      kod,
      poznamka: poznamka || null,
      poradi: nextPoradi(data),
      aktivni: true,
    });

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewNazev("");
    setNewKod("");
    setNewPoznamka("");
    setOpen(false);

    await load();
  }

  function startEdit(item: TechnickyVlastnik) {
    setEditingId(item.id);
    setDraft({
      nazev: item.nazev,
      kod: item.kod,
      poznamka: item.poznamka ?? "",
    });
  }

  async function save(id: string) {
    const nazev = draft.nazev.trim();
    const kod = draft.kod.trim();
    const poznamka = draft.poznamka.trim();

    if (!nazev || !kod) {
      alert("Název a kód jsou povinné.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase
      .from(SKLAD_TABLE.technickyVlastnici)
      .update({
        nazev,
        kod,
        poznamka: poznamka || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    setSavingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingId(null);
    setDraft({ nazev: "", kod: "", poznamka: "" });

    await load();
  }

  async function toggleAktivni(item: TechnickyVlastnik) {
    setTogglingId(item.id);

    const { error } = await supabase
      .from(SKLAD_TABLE.technickyVlastnici)
      .update({
        aktivni: !item.aktivni,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    setTogglingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  }

  async function remove(id: string) {
    const ok = window.confirm("Smazat vlastníka techniky?");

    if (!ok) return;

    setRemovingId(id);

    const { error } = await supabase
      .from(SKLAD_TABLE.technickyVlastnici)
      .delete()
      .eq("id", id);

    setRemovingId(null);

    if (error) {
      alert(
        error.message.includes("violates foreign key")
          ? "Vlastníka nelze smazat — je přiřazen ke skladovým položkám. Deaktivujte ho místo smazání."
          : error.message
      );
      return;
    }

    await load();
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDraggingId(id);
    setDragOverId(null);

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

    const newOrder = [...sorted];
    const from = newOrder.findIndex((item) => item.id === draggingId);
    const to = newOrder.findIndex((item) => item.id === targetId);

    if (from < 0 || to < 0) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);

    setData(newOrder);
    setDraggingId(null);
    setDragOverId(null);

    const updates = newOrder.map((item, index) =>
      supabase
        .from(SKLAD_TABLE.technickyVlastnici)
        .update({
          poradi: (index + 1) * 10,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      alert(failed.error.message);
      await load();
      return;
    }

    await load();
  }

  return (
    <div className="w-full py-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Vlastníci techniky</h1>

          <div className="text-sm text-slate-400">
            Evidence vlastníků techniky ve skladu. Pořadí měníš přetažením.
            Neaktivní vlastník nelze přiřadit novým položkám.
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/sklad/konfigurace"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            Zpět
          </Link>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 font-semibold text-white"
          >
            Přidat
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-300">Načítám...</div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((item) => {
            const isEditing = editingId === item.id;
            const isSaving = savingId === item.id;
            const isRemoving = removingId === item.id;
            const isToggling = togglingId === item.id;
            const isDragging = draggingId === item.id;
            const isDragOver = dragOverId === item.id;

            return (
              <div
                key={item.id}
                draggable={!isEditing && !isSaving && !isRemoving && !isToggling}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                onDragEnter={() => handleDragEnter(item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={(e) => handleDragLeave(e, item.id)}
                onDrop={() => void handleDrop(item.id)}
              >
                <div
                  style={{
                    opacity:
                      isDragging || isSaving || isRemoving || isToggling ? 0.6 : 1,
                    borderColor: isDragOver ? "#60a5fa" : undefined,
                    background: isDragOver ? "#0f172a" : undefined,
                    transform: isDragging
                      ? "scale(0.985)"
                      : isDragOver
                        ? "translateY(-2px)"
                        : "translateY(0)",
                    cursor: isEditing ? "default" : isDragging ? "grabbing" : "grab",
                    boxShadow: isDragOver
                      ? "0 0 0 1px rgba(96,165,250,0.25), 0 10px 28px rgba(37,99,235,0.18)"
                      : undefined,
                    transition:
                      "transform 0.16s ease, opacity 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease",
                  }}
                >
                  <Card className="border-slate-700 bg-slate-950/40">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div ref={isEditing ? editRef : undefined} className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <input
                              autoFocus
                              value={draft.nazev}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, nazev: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  void save(item.id);
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  setEditingId(null);
                                  setDraft({ nazev: "", kod: "", poznamka: "" });
                                }
                              }}
                              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                              placeholder="Název"
                            />
                            <input
                              value={draft.kod}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, kod: e.target.value }))
                              }
                              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white"
                              placeholder="Kód (např. WEST_COUNTY)"
                            />
                            <textarea
                              value={draft.poznamka}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  poznamka: e.target.value,
                                }))
                              }
                              rows={2}
                              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white md:col-span-2"
                              placeholder="Poznámka (volitelné)"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-lg font-semibold text-white">
                                {item.nazev}
                              </div>
                              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-xs text-slate-300">
                                {item.kod}
                              </span>
                              {!item.aktivni ? (
                                <span className="rounded-full border border-amber-700/60 bg-amber-950/40 px-2 py-0.5 text-xs font-semibold text-amber-200">
                                  Neaktivní
                                </span>
                              ) : null}
                            </div>
                            {item.poznamka ? (
                              <div className="text-sm text-slate-400">{item.poznamka}</div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleAktivni(item)}
                          disabled={isSaving || isRemoving || isToggling}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
                        >
                          {isToggling
                            ? "Ukládám..."
                            : item.aktivni
                              ? "Deaktivovat"
                              : "Aktivovat"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? void save(item.id) : startEdit(item)
                          }
                          disabled={isSaving || isRemoving || isToggling}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
                        >
                          {isSaving ? "Ukládám..." : isEditing ? "Uložit" : "Upravit"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void remove(item.id)}
                          disabled={isSaving || isRemoving || isToggling}
                          className="rounded-xl border border-red-500 px-4 py-2 text-red-300 disabled:opacity-60"
                        >
                          {isRemoving ? "Mažu..." : "Smazat"}
                        </button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (creating) return;
          setOpen(false);
        }}
        title="Nový vlastník techniky"
      >
        <div className="grid gap-4">
          <input
            value={newNazev}
            onChange={(e) => setNewNazev(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            placeholder="Název (např. WEST COUNTY)"
          />
          <input
            value={newKod}
            onChange={(e) => setNewKod(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-white"
            placeholder="Kód (např. WEST_COUNTY)"
          />
          <textarea
            value={newPoznamka}
            onChange={(e) => setNewPoznamka(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            placeholder="Poznámka (volitelné)"
          />

          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !newNazev.trim() || !newKod.trim()}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-white disabled:opacity-60"
          >
            {creating ? "Ukládám..." : "Uložit"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
