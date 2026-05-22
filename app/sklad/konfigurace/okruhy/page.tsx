"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { supabase } from "@/lib/supabase";
import { SKLAD_RPC, SKLAD_TABLE } from "@/lib/sklad/constants";
import { formatNumber } from "@/lib/sklad/helpers";
import { querySkladBloky } from "@/lib/sklad/queries";
import type { SkladBlok } from "@/lib/sklad/types";

export default function SkladOkruhyKonfiguracePage() {
  const [data, setData] = useState<SkladBlok[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const editRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);

    const { data: rows, error } = await querySkladBloky(supabase);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setData((rows ?? []) as SkladBlok[]);
  }

  useEffect(() => {
    void load();
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
      setDraft("");
    }

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingId, draft]);

  async function create() {
    const trimmed = newName.trim();

    if (!trimmed) return;

    setCreating(true);

    const { error } = await supabase.rpc(SKLAD_RPC.createSkladBlok, {
      p_nazev: trimmed,
    });

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewName("");
    setOpen(false);

    await load();
  }

  function startEdit(item: SkladBlok) {
    setEditingId(item.sklad_blok_id);
    setDraft(item.nazev);
  }

  async function save(id: string) {
    const trimmed = draft.trim();

    if (!trimmed) {
      alert("Název je povinný.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase
      .from(SKLAD_TABLE.skladBloky)
      .update({ nazev: trimmed })
      .eq("sklad_blok_id", id);

    setSavingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingId(null);
    setDraft("");

    await load();
  }

  async function remove(id: string) {
    const ok = window.confirm("Opravdu chcete okruh skladu smazat?");

    if (!ok) return;

    setRemovingId(id);

    const { error } = await supabase.rpc(SKLAD_RPC.deleteSkladBlok, {
      p_sklad_blok_id: id,
    });

    setRemovingId(null);

    if (error) {
      alert(error.message);
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

    const newOrder = [...data];
    const from = newOrder.findIndex((item) => item.sklad_blok_id === draggingId);
    const to = newOrder.findIndex((item) => item.sklad_blok_id === targetId);

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

    const orderedIds = newOrder.map((item) => item.sklad_blok_id);

    const { error } = await supabase.rpc(SKLAD_RPC.setSkladBlokPoradi, {
      p_ids: orderedIds,
    });

    if (error) {
      alert(error.message);
      await load();
      return;
    }

    await load();
  }

  return (
    <div className="w-full py-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="w-full min-w-0 space-y-2">
          <h1 className="text-3xl font-bold text-white">Okruhy skladu</h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Členění skladu používané pro filtrování a přiřazení položek ve správě
            skladu. Okruh není samostatná evidence — jen metadata a pohled nad
            společným katalogem.
          </p>
          <p className="text-xs text-slate-500">
            Přetažením změníš pořadí. Enter uloží název, Esc zruší úpravu.
          </p>
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
            Přidat okruh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-300">Načítám...</div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center text-sm text-slate-400">
          Zatím nemáš žádné okruhy. Přidej první okruh nebo přiřaď položky ve{" "}
          <Link
            href="/sklad/sprava"
            className="font-semibold text-blue-400 hover:text-blue-300"
          >
            správě skladu
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-3">
          {data.map((item) => {
            const isEditing = editingId === item.sklad_blok_id;
            const isSaving = savingId === item.sklad_blok_id;
            const isRemoving = removingId === item.sklad_blok_id;
            const isDragging = draggingId === item.sklad_blok_id;
            const isDragOver = dragOverId === item.sklad_blok_id;

            return (
              <div
                key={item.sklad_blok_id}
                draggable={!isEditing && !isSaving && !isRemoving}
                onDragStart={(e) => handleDragStart(e, item.sklad_blok_id)}
                onDragEnd={handleDragEnd}
                onDragEnter={() => handleDragEnter(item.sklad_blok_id)}
                onDragOver={(e) => handleDragOver(e, item.sklad_blok_id)}
                onDragLeave={(e) => handleDragLeave(e, item.sklad_blok_id)}
                onDrop={() => void handleDrop(item.sklad_blok_id)}
              >
                <div
                  style={{
                    opacity: isDragging || isSaving || isRemoving ? 0.6 : 1,
                    borderColor: isDragOver ? "#60a5fa" : undefined,
                    background: isDragOver ? "#0f172a" : undefined,
                    transform: isDragging
                      ? "scale(0.985)"
                      : isDragOver
                        ? "translateY(-2px)"
                        : "translateY(0)",
                    cursor: isEditing
                      ? "default"
                      : isDragging
                        ? "grabbing"
                        : "grab",
                    boxShadow: isDragOver
                      ? "0 0 0 1px rgba(96,165,250,0.25), 0 10px 28px rgba(37,99,235,0.18)"
                      : undefined,
                    transition:
                      "transform 0.16s ease, opacity 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease",
                  }}
                >
                  <Card className="border-slate-700 bg-slate-950/40">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        {isEditing ? (
                          <input
                            ref={editRef}
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void save(item.sklad_blok_id);
                              }

                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingId(null);
                                setDraft("");
                              }
                            }}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                          />
                        ) : (
                          <div className="text-lg font-semibold text-white">
                            {item.nazev}
                          </div>
                        )}

                        <p className="text-xs text-slate-500">
                          Položek: {formatNumber(item.pocet_polozek)} · Kusů:{" "}
                          {formatNumber(item.kusu_celkem)} · Pořadí:{" "}
                          {formatNumber(item.poradi)}
                        </p>

                        <Link
                          href={`/sklad/okruh/${item.sklad_blok_id}`}
                          className="inline-flex text-xs font-semibold text-blue-400 hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Pohled položek okruhu →
                        </Link>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            isEditing
                              ? void save(item.sklad_blok_id)
                              : startEdit(item)
                          }
                          disabled={isSaving || isRemoving}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
                        >
                          {isSaving
                            ? "Ukládám..."
                            : isEditing
                              ? "Uložit"
                              : "Upravit"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void remove(item.sklad_blok_id)}
                          disabled={isSaving || isRemoving}
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
        title="Nový okruh skladu"
      >
        <div className="grid gap-4">
          <p className="text-sm text-slate-400">
            Okruh slouží jako filtr a přiřazení položek, ne jako oddělený sklad.
          </p>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            placeholder="Název okruhu"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />

          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || !newName.trim()}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-white disabled:opacity-60"
          >
            {creating ? "Ukládám..." : "Uložit"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
