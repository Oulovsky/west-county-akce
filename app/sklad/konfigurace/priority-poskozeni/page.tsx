"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";

type Priorita = {
  priorita_id: string;
  nazev: string;
  poradi: number | null;
};

export default function Page() {
  const [data, setData] = useState<Priorita[]>([]);
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

    const { data, error } = await supabase.rpc("get_priority_poskozeni_full");

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setData((data ?? []) as Priorita[]);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("priority-poskozeni-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "priority_poskozeni",
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

    const { error } = await supabase.rpc("create_priorita_poskozeni", {
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

  function startEdit(item: Priorita) {
    setEditingId(item.priorita_id);
    setDraft(item.nazev);
  }

  async function save(id: string) {
    const trimmed = draft.trim();

    if (!trimmed) {
      alert("Název je povinný.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase.rpc("update_priorita_poskozeni", {
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
    const ok = window.confirm("Smazat prioritu?");

    if (!ok) return;

    setRemovingId(id);

    const { error } = await supabase.rpc("delete_priorita_poskozeni", {
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

    const from = newOrder.findIndex((item) => item.priorita_id === draggingId);
    const to = newOrder.findIndex((item) => item.priorita_id === targetId);

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

    const { error } = await supabase.rpc("set_priority_poskozeni_poradi", {
      p_ids: newOrder.map((item) => item.priorita_id),
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
          <h1 className="text-3xl font-bold text-white">Priority poškození</h1>

          <div className="text-sm text-slate-400">
            Správa priorit poškození. Enter uloží, Esc zruší, klik mimo také
            uloží. Pořadí měníš přetažením.
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/sklad/konfigurace"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            Zpět
          </Link>

          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
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
            const isEditing = editingId === item.priorita_id;
            const isSaving = savingId === item.priorita_id;
            const isRemoving = removingId === item.priorita_id;
            const isDragging = draggingId === item.priorita_id;
            const isDragOver = dragOverId === item.priorita_id;

            return (
              <div
                key={item.priorita_id}
                draggable={!isEditing && !isSaving && !isRemoving}
                onDragStart={(e) => handleDragStart(e, item.priorita_id)}
                onDragEnd={handleDragEnd}
                onDragEnter={() => handleDragEnter(item.priorita_id)}
                onDragOver={(e) => handleDragOver(e, item.priorita_id)}
                onDragLeave={(e) => handleDragLeave(e, item.priorita_id)}
                onDrop={() => void handleDrop(item.priorita_id)}
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
                  <Card className="border-slate-700 bg-slate-950/40 p-4">
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
                                void save(item.priorita_id);
                              }

                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingId(null);
                                setDraft("");
                              }
                            }}
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                          />
                        ) : (
                          <div className="text-lg font-semibold text-white">
                            {item.nazev}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            isEditing ? void save(item.priorita_id) : startEdit(item)
                          }
                          disabled={isSaving || isRemoving}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                        >
                          {isSaving ? "Ukládám..." : isEditing ? "Uložit" : "Upravit"}
                        </button>

                        <button
                          onClick={() => void remove(item.priorita_id)}
                          disabled={isSaving || isRemoving}
                          className="rounded-xl border border-red-500/40 px-4 py-2 font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
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
        title="Nová priorita"
        widthClassName="max-w-xl"
      >
        <div className="grid gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            placeholder="Název priority"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setOpen(false)}
              disabled={creating}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              Zrušit
            </button>

            <button
              onClick={() => void create()}
              disabled={creating || !newName.trim()}
              className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              {creating ? "Ukládám..." : "Uložit"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
