"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { SKLAD_RPC } from "@/lib/sklad/constants";
import { queryKategorieTechnikyFull } from "@/lib/sklad/queries";
import type { SkladKategorie } from "@/lib/sklad/types";

function sortKategorieRows(rows: SkladKategorie[]): SkladKategorie[] {
  return [...rows].sort((a, b) => {
    const pa = a.poradi ?? 999999;
    const pb = b.poradi ?? 999999;
    if (pa !== pb) return pa - pb;
    return a.nazev.localeCompare(b.nazev, "cs");
  });
}

export default function Page() {
  const [data, setData] = useState<SkladKategorie[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const editRef = useRef<HTMLInputElement | null>(null);

  const sorted = useMemo(() => sortKategorieRows(data), [data]);

  async function load() {
    setLoading(true);

    const { data: rows, error } = await queryKategorieTechnikyFull(supabase);

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    setData((rows ?? []) as SkladKategorie[]);
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
  }, [editingId, draft, data]);

  async function create() {
    const trimmed = newName.trim();

    if (!trimmed) return;

    setCreating(true);

    const { error } = await supabase.rpc(SKLAD_RPC.createKategorieTechniky, {
      p_nazev: trimmed,
      p_sklad_blok_id: null,
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

  function startEdit(item: SkladKategorie) {
    setEditingId(item.kategorie_techniky_id);
    setDraft(item.nazev);
  }

  async function save(id: string) {
    const trimmed = draft.trim();

    if (!trimmed) {
      alert("Název je povinný.");
      return;
    }

    const row = data.find((r) => r.kategorie_techniky_id === id);
    if (!row) return;

    setSavingId(id);

    const { error } = await supabase.rpc(SKLAD_RPC.updateKategorieTechniky, {
      p_id: id,
      p_nazev: trimmed,
      p_sklad_blok_id: row.sklad_blok_id ?? null,
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
    const ok = window.confirm("Smazat kategorii?");

    if (!ok) return;

    setRemovingId(id);

    const { error } = await supabase.rpc(SKLAD_RPC.deleteKategorieTechniky, {
      p_id: id,
    });

    setRemovingId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await load();
  }

  return (
    <div className="w-full py-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Kategorie</h1>

          <div className="text-sm text-slate-400">
            Jednoduchý seznam kategorií techniky (např. Truss, Zábradlí,
            Desky). Enter uloží, Esc zruší, klik mimo také uloží.
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
            const isEditing = editingId === item.kategorie_techniky_id;
            const isSaving = savingId === item.kategorie_techniky_id;
            const isRemoving = removingId === item.kategorie_techniky_id;

            return (
              <Card
                key={item.kategorie_techniky_id}
                className="border-slate-700 bg-slate-950/40"
              >
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
                            void save(item.kategorie_techniky_id);
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
                        isEditing
                          ? void save(item.kategorie_techniky_id)
                          : startEdit(item)
                      }
                      disabled={isSaving || isRemoving}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
                    >
                      {isSaving ? "Ukládám..." : isEditing ? "Uložit" : "Upravit"}
                    </button>

                    <button
                      type="button"
                      onClick={() => void remove(item.kategorie_techniky_id)}
                      disabled={isSaving || isRemoving}
                      className="rounded-xl border border-red-500 px-4 py-2 text-red-300 disabled:opacity-60"
                    >
                      {isRemoving ? "Mažu..." : "Smazat"}
                    </button>
                  </div>
                </div>
              </Card>
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
        title="Nová kategorie"
      >
        <div className="grid gap-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
            placeholder="Název kategorie"
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
