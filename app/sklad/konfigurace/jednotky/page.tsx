"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { queryJednotkySkladuFull } from "@/lib/sklad/queries";
import type { SkladJednotka } from "@/lib/sklad/types";

export default function Page() {
  const [data, setData] = useState<SkladJednotka[]>([]);
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

    const { data, error } = await queryJednotkySkladuFull(supabase);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setData((data ?? []) as SkladJednotka[]);
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

    const { error } = await supabase.rpc("create_jednotka_skladu", {
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

  function startEdit(item: SkladJednotka) {
    setEditingId(item.jednotka_id);
    setDraft(item.nazev);
  }

  async function save(id: string) {
    const trimmed = draft.trim();

    if (!trimmed) {
      alert("Název je povinný.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase.rpc("update_jednotka_skladu", {
      p_id: id,
      p_nazev: trimmed,
    });

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
    const ok = window.confirm("Smazat jednotku?");

    if (!ok) return;

    setRemovingId(id);

    const { error } = await supabase.rpc("delete_jednotka_skladu", {
      p_id: id,
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
    const from = newOrder.findIndex((item) => item.jednotka_id === draggingId);
    const to = newOrder.findIndex((item) => item.jednotka_id === targetId);

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

    const orderedIds = newOrder.map((item) => item.jednotka_id);

    const { error } = await supabase.rpc("set_jednotky_skladu_poradi", {
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
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Jednotky</h1>

          <div className="text-sm text-slate-400">
            Správa jednotek (ks, m, pár...). Enter uloží, Esc zruší, klik mimo
            také uloží. Pořadí měníš přetažením.
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
          {data.map((item) => {
            const isEditing = editingId === item.jednotka_id;
            const isSaving = savingId === item.jednotka_id;
            const isRemoving = removingId === item.jednotka_id;
            const isDragging = draggingId === item.jednotka_id;
            const isDragOver = dragOverId === item.jednotka_id;

            return (
              <div
                key={item.jednotka_id}
                draggable={!isEditing && !isSaving && !isRemoving}
                onDragStart={(e) => handleDragStart(e, item.jednotka_id)}
                onDragEnd={handleDragEnd}
                onDragEnter={() => handleDragEnter(item.jednotka_id)}
                onDragOver={(e) => handleDragOver(e, item.jednotka_id)}
                onDragLeave={(e) => handleDragLeave(e, item.jednotka_id)}
                onDrop={() => void handleDrop(item.jednotka_id)}
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
                    cursor: isEditing ? "default" : isDragging ? "grabbing" : "grab",
                    boxShadow: isDragOver
                      ? "0 0 0 1px rgba(96,165,250,0.25), 0 10px 28px rgba(37,99,235,0.18)"
                      : undefined,
                    transition:
                      "transform 0.16s ease, opacity 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease",
                  }}
                >
                  <Card className="border-slate-700 bg-slate-950/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        {isEditing ? (
                          <input
                            ref={editRef}
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                void save(item.jednotka_id);
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
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            isEditing ? void save(item.jednotka_id) : startEdit(item)
                          }
                          disabled={isSaving || isRemoving}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
                        >
                          {isSaving ? "Ukládám..." : isEditing ? "Uložit" : "Upravit"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void remove(item.jednotka_id)}
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
        title="Nová jednotka"
      >
        <div className="grid gap-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            placeholder="Název jednotky"
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
