"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";

type Kategorie = {
  kategorie_techniky_id: string;
  nazev: string;
  poradi?: number | null;
};

type Podkategorie = {
  podkategorie_techniky_id: string;
  kategorie_techniky_id: string;
  kategorie_nazev: string | null;
  nazev: string;
  poradi: number | null;
};

export default function Page() {
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [data, setData] = useState<Podkategorie[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newKategorieId, setNewKategorieId] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftKategorieId, setDraftKategorieId] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const editNameRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);

    const [kategorieRes, podkategorieRes] = await Promise.all([
      supabase.rpc("get_kategorie_techniky_full"),
      supabase.rpc("get_podkategorie_techniky_full"),
    ]);

    setLoading(false);

    if (kategorieRes.error) {
      alert(kategorieRes.error.message);
      return;
    }

    if (podkategorieRes.error) {
      alert(podkategorieRes.error.message);
      return;
    }

    const loadedKategorie = (kategorieRes.data ?? []) as Kategorie[];
    const loadedPodkategorie = (podkategorieRes.data ?? []) as Podkategorie[];

    setKategorie(loadedKategorie);
    setData(loadedPodkategorie);

    if (!newKategorieId && loadedKategorie.length > 0) {
      setNewKategorieId(loadedKategorie[0].kategorie_techniky_id);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!editingId) return;

    const currentEditingId = editingId;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!editNameRef.current) return;
      if (target && editNameRef.current.contains(target)) return;
      void save(currentEditingId);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setEditingId(null);
      setDraftName("");
      setDraftKategorieId("");
    }

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingId, draftName, draftKategorieId]);

  const grouped = useMemo(() => {
    return kategorie.map((kat) => ({
      ...kat,
      items: data.filter(
        (item) => item.kategorie_techniky_id === kat.kategorie_techniky_id
      ),
    }));
  }, [kategorie, data]);

  async function create() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (!newKategorieId) {
      alert("Vyber kategorii.");
      return;
    }

    setCreating(true);

    const { error } = await supabase.rpc("create_podkategorie_techniky", {
      p_kategorie_techniky_id: newKategorieId,
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

  function startEdit(item: Podkategorie) {
    setEditingId(item.podkategorie_techniky_id);
    setDraftName(item.nazev);
    setDraftKategorieId(item.kategorie_techniky_id);
  }

  async function save(id: string) {
    const trimmed = draftName.trim();

    if (!trimmed) {
      alert("Název je povinný.");
      return;
    }

    if (!draftKategorieId) {
      alert("Vyber kategorii.");
      return;
    }

    setSavingId(id);

    const { error } = await supabase.rpc("update_podkategorie_techniky", {
      p_id: id,
      p_kategorie_techniky_id: draftKategorieId,
      p_nazev: trimmed,
    });

    setSavingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingId(null);
    setDraftName("");
    setDraftKategorieId("");
    await load();
  }

  async function remove(id: string) {
    const ok = window.confirm("Smazat podkategorii?");
    if (!ok) return;

    setRemovingId(id);

    const { error } = await supabase.rpc("delete_podkategorie_techniky", {
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

  async function handleDrop(kategorieId: string, targetId: string) {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const inGroup = data.filter((item) => item.kategorie_techniky_id === kategorieId);
    const draggingItem = data.find(
      (item) => item.podkategorie_techniky_id === draggingId
    );

    if (!draggingItem || draggingItem.kategorie_techniky_id !== kategorieId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const newOrder = [...inGroup];
    const from = newOrder.findIndex(
      (item) => item.podkategorie_techniky_id === draggingId
    );
    const to = newOrder.findIndex(
      (item) => item.podkategorie_techniky_id === targetId
    );

    if (from < 0 || to < 0) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);

    const other = data.filter((item) => item.kategorie_techniky_id !== kategorieId);
    setData([...other, ...newOrder]);

    setDraggingId(null);
    setDragOverId(null);

    const orderedIds = newOrder.map((item) => item.podkategorie_techniky_id);

    const { error } = await supabase.rpc("set_podkategorie_poradi", {
      p_kategorie_techniky_id: kategorieId,
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
          <h1 className="text-3xl font-bold text-white">Podkategorie</h1>
          <div className="text-sm text-slate-400">
            Správa podkategorií navázaných na hlavní kategorie. Enter uloží, Esc
            zruší, klik mimo také uloží. Pořadí měníš přetažením v rámci jedné
            kategorie.
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/sklad/konfigurace"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            Zpět na konfiguraci
          </Link>

          <button
            type="button"
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
        <div className="grid gap-6">
          {grouped.map((kat) => (
            <Card key={kat.kategorie_techniky_id} className="border-slate-700 bg-slate-950/40">
              <div className="space-y-4">
                <div className="text-lg font-semibold text-white">{kat.nazev}</div>

                {kat.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
                    Kategorie zatím nemá žádnou podkategorii.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {kat.items.map((item) => {
                      const isEditing = editingId === item.podkategorie_techniky_id;
                      const isSaving = savingId === item.podkategorie_techniky_id;
                      const isRemoving = removingId === item.podkategorie_techniky_id;
                      const isDragging = draggingId === item.podkategorie_techniky_id;
                      const isDragOver = dragOverId === item.podkategorie_techniky_id;

                      return (
                        <div
                          key={item.podkategorie_techniky_id}
                          draggable={!isEditing && !isSaving && !isRemoving}
                          onDragStart={(e) =>
                            handleDragStart(e, item.podkategorie_techniky_id)
                          }
                          onDragEnd={handleDragEnd}
                          onDragEnter={() =>
                            handleDragEnter(item.podkategorie_techniky_id)
                          }
                          onDragOver={(e) =>
                            handleDragOver(e, item.podkategorie_techniky_id)
                          }
                          onDragLeave={(e) =>
                            handleDragLeave(e, item.podkategorie_techniky_id)
                          }
                          onDrop={() =>
                            void handleDrop(
                              kat.kategorie_techniky_id,
                              item.podkategorie_techniky_id
                            )
                          }
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
                            <Card className="border-slate-700 bg-slate-900/40">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-3">
                                  {isEditing ? (
                                    <>
                                      <select
                                        value={draftKategorieId}
                                        onChange={(e) =>
                                          setDraftKategorieId(e.target.value)
                                        }
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                                      >
                                        <option value="">Vyber kategorii</option>
                                        {kategorie.map((k) => (
                                          <option
                                            key={k.kategorie_techniky_id}
                                            value={k.kategorie_techniky_id}
                                          >
                                            {k.nazev}
                                          </option>
                                        ))}
                                      </select>

                                      <input
                                        ref={editNameRef}
                                        autoFocus
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            void save(item.podkategorie_techniky_id);
                                          }

                                          if (e.key === "Escape") {
                                            e.preventDefault();
                                            setEditingId(null);
                                            setDraftName("");
                                            setDraftKategorieId("");
                                          }
                                        }}
                                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                                      />
                                    </>
                                  ) : (
                                    <div className="text-lg font-semibold text-white">
                                      {item.nazev}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditing
                                        ? void save(item.podkategorie_techniky_id)
                                        : startEdit(item)
                                    }
                                    disabled={isSaving || isRemoving}
                                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                  >
                                    {isSaving ? "Ukládám..." : isEditing ? "Uložit" : "Upravit"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void remove(item.podkategorie_techniky_id)
                                    }
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
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => {
          if (creating) return;
          setOpen(false);
        }}
        title="Nová podkategorie"
        widthClassName="max-w-xl"
      >
        <div className="grid gap-4">
          <select
            value={newKategorieId}
            onChange={(e) => setNewKategorieId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
          >
            <option value="">Vyber kategorii</option>
            {kategorie.map((k) => (
              <option key={k.kategorie_techniky_id} value={k.kategorie_techniky_id}>
                {k.nazev}
              </option>
            ))}
          </select>

          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Název podkategorie"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={creating}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 font-semibold text-white disabled:opacity-60"
            >
              Zrušit
            </button>

            <button
              type="button"
              onClick={() => void create()}
              disabled={creating || !newName.trim() || !newKategorieId}
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