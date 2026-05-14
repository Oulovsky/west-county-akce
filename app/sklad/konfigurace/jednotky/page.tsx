"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";

type Jednotka = {
  jednotka_id: string;
  nazev: string;
  poradi: number | null;
};

export default function Page() {
  const [data, setData] = useState<Jednotka[]>([]);
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

    const { data, error } = await supabase.rpc("get_jednotky_skladu_full");

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setData((data ?? []) as Jednotka[]);
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

  function startEdit(item: Jednotka) {
    setEditingId(item.jednotka_id);
    setDraft(item.nazev);
  }

  async function save(id: string) {
    const trimmed = draft.trim();

    if (!trimmed) {
      alert("NĂˇzev je povinnĂ˝.");
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
            SprĂˇva jednotek (ks, m, pĂˇr...). Enter uloĹľĂ­, Esc zruĹˇĂ­, klik mimo takĂ© uloĹľĂ­. PoĹ™adĂ­ mÄ›nĂ­Ĺˇ pĹ™etaĹľenĂ­m.
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/sklad/konfigurace"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-white"
          >
            ZpÄ›t
          </Link>

          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 font-semibold text-white"
          >
            PĹ™idat
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-300">NaÄŤĂ­tĂˇm...</div>
      ) : (
        <div className="grid gap-3">
          {data.map((j) => {
            const isEditing = editingId === j.jednotka_id;
            const isSaving = savingId === j.jednotka_id;
            const isRemoving = removingId === j.jednotka_id;
            const isDragging = draggingId === j.jednotka_id;
            const isDragOver = dragOverId === j.jednotka_id;

            return (
              <div
                key={j.jednotka_id}
                draggable={!isEditing && !isSaving && !isRemoving}
                onDragStart={(e) => handleDragStart(e, j.jednotka_id)}
                onDragEnd={handleDragEnd}
                onDragEnter={() => handleDragEnter(j.jednotka_id)}
                onDragOver={(e) => handleDragOver(e, j.jednotka_id)}
                onDragLeave={(e) => handleDragLeave(e, j.jednotka_id)}
                onDrop={() => void handleDrop(j.jednotka_id)}
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
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
                        />
                      ) : (
                        <div className="text-lg font-semibold text-white">
                          {j.nazev}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          isEditing ? void save(j.jednotka_id) : startEdit(j)
                        }
                        className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-white"
                      >
                        {isEditing ? "UloĹľit" : "Upravit"}
                      </button>

                      <button
                        onClick={() => void remove(j.jednotka_id)}
                        className="rounded-xl border border-red-500 px-4 py-2 text-red-300"
                      >
                        Smazat
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="NovĂˇ jednotka">
        <div className="grid gap-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
          />

          <button
            onClick={() => void create()}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-3 text-white"
          >
            UloĹľit
          </button>
        </div>
      </Modal>
    </div>
  );
}


