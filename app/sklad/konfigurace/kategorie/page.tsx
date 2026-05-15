"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { SKLAD_RPC } from "@/lib/sklad/constants";
import { queryKonfiguraceKategorie } from "@/lib/sklad/queries";
import type { SkladBlok, SkladKategorie } from "@/lib/sklad/types";

export default function Page() {
  const [data, setData] = useState<SkladKategorie[]>([]);
  const [bloky, setBloky] = useState<SkladBlok[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState("");
  const [newBlokId, setNewBlokId] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftBlokId, setDraftBlokId] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const editRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [kategorieRes, blokyRes] = await queryKonfiguraceKategorie(supabase);

    setLoading(false);

    if (kategorieRes.error) {
      alert(kategorieRes.error.message);
      return;
    }

    if (blokyRes.error) {
      alert(blokyRes.error.message);
      return;
    }

    const loadedKategorie = (kategorieRes.data ?? []) as SkladKategorie[];
    const loadedBloky = (blokyRes.data ?? []) as SkladBlok[];

    setData(loadedKategorie);
    setBloky(loadedBloky);

    if (!newBlokId && loadedBloky.length > 0) {
      setNewBlokId(loadedBloky[0].sklad_blok_id);
    }
  }, [newBlokId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const save = useCallback(
    async (id: string) => {
      const trimmed = draftName.trim();

      if (!trimmed) {
        alert("Název je povinný.");
        return;
      }

      if (!draftBlokId) {
        alert("Vyber okruh.");
        return;
      }

      setSavingId(id);

      const { error } = await supabase.rpc(SKLAD_RPC.updateKategorieTechniky, {
        p_id: id,
        p_nazev: trimmed,
        p_sklad_blok_id: draftBlokId,
      });

      setSavingId(null);

      if (error) {
        alert(error.message);
        return;
      }

      setEditingId(null);
      setDraftName("");
      setDraftBlokId("");

      await load();
    },
    [draftName, draftBlokId, load]
  );

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
      setDraftName("");
      setDraftBlokId("");
    }

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingId, save]);

  const grouped = useMemo(() => {
    const result = bloky.map((blok) => ({
      id: blok.sklad_blok_id,
      nazev: blok.nazev,
      items: data.filter((item) => item.sklad_blok_id === blok.sklad_blok_id),
    }));

    const withoutBlock = data.filter((item) => !item.sklad_blok_id);

    if (withoutBlock.length > 0) {
      result.push({
        id: "__bez_okruhu__",
        nazev: "Bez okruhu",
        items: withoutBlock,
      });
    }

    return result;
  }, [bloky, data]);

  function openCreateModal() {
    setNewName("");
    setNewBlokId(bloky[0]?.sklad_blok_id ?? "");
    setOpen(true);
  }

  async function create() {
    const trimmed = newName.trim();

    if (!trimmed) {
      alert("Název je povinný.");
      return;
    }

    if (!newBlokId) {
      alert("Vyber okruh.");
      return;
    }

    setCreating(true);

    const { error } = await supabase.rpc(SKLAD_RPC.createKategorieTechniky, {
      p_nazev: trimmed,
      p_sklad_blok_id: newBlokId,
    });

    setCreating(false);

    if (error) {
      alert(error.message);
      return;
    }

    setNewName("");
    setNewBlokId("");
    setOpen(false);

    await load();
  }

  function startEdit(item: SkladKategorie) {
    setEditingId(item.kategorie_techniky_id);
    setDraftName(item.nazev);
    setDraftBlokId(item.sklad_blok_id ?? "");
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
            Kategorie jsou navázané na konkrétní okruh skladu. Například:
            Stage → Truss, Zábradlí, Desky, Plachty.
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
            onClick={openCreateModal}
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
          {grouped.map((group) => (
            <Card
              key={group.id}
              className="border-slate-700 bg-slate-950/40"
            >
              <div className="space-y-4">
                <div>
                  <div className="text-xl font-bold text-white">
                    {group.nazev}
                  </div>

                  <div className="mt-1 text-sm text-slate-400">
                    {group.items.length} kategorií
                  </div>
                </div>

                {group.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 px-4 py-4 text-sm text-slate-400">
                    Tento okruh zatím nemá žádnou kategorii.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {group.items.map((kategorie) => {
                      const isEditing =
                        editingId === kategorie.kategorie_techniky_id;

                      const isSaving =
                        savingId === kategorie.kategorie_techniky_id;

                      const isRemoving =
                        removingId === kategorie.kategorie_techniky_id;

                      return (
                        <Card
                          key={kategorie.kategorie_techniky_id}
                          className="border-slate-700 bg-slate-900/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                                  <input
                                    ref={editRef}
                                    autoFocus
                                    value={draftName}
                                    onChange={(e) =>
                                      setDraftName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void save(
                                          kategorie.kategorie_techniky_id
                                        );
                                      }

                                      if (e.key === "Escape") {
                                        e.preventDefault();
                                        setEditingId(null);
                                        setDraftName("");
                                        setDraftBlokId("");
                                      }
                                    }}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                                  />

                                  <select
                                    value={draftBlokId}
                                    onChange={(e) =>
                                      setDraftBlokId(e.target.value)
                                    }
                                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
                                  >
                                    <option value="">Vyber okruh</option>

                                    {bloky.map((blok) => (
                                      <option
                                        key={blok.sklad_blok_id}
                                        value={blok.sklad_blok_id}
                                      >
                                        {blok.nazev}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-lg font-semibold text-white">
                                    {kategorie.nazev}
                                  </div>

                                  <div className="mt-1 text-sm text-slate-400">
                                    Okruh:{" "}
                                    {kategorie.blok_nazev ?? "Nepřiřazeno"}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  isEditing
                                    ? void save(
                                        kategorie.kategorie_techniky_id
                                      )
                                    : startEdit(kategorie)
                                }
                                disabled={isSaving || isRemoving}
                                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                              >
                                {isSaving
                                  ? "Ukládám..."
                                  : isEditing
                                    ? "Uložit"
                                    : "Upravit"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void remove(
                                    kategorie.kategorie_techniky_id
                                  )
                                }
                                disabled={isSaving || isRemoving}
                                className="rounded-xl border border-red-500/40 px-4 py-2 font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
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
        title="Nová kategorie"
        widthClassName="max-w-xl"
      >
        <div className="grid gap-4">
          <div>
            <div className="mb-2 text-sm text-slate-300">Okruh</div>

            <select
              value={newBlokId}
              onChange={(e) => setNewBlokId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
            >
              <option value="">Vyber okruh</option>

              {bloky.map((blok) => (
                <option
                  key={blok.sklad_blok_id}
                  value={blok.sklad_blok_id}
                >
                  {blok.nazev}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 text-sm text-slate-300">
              Název kategorie
            </div>

            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Např. Truss, Zábradlí, Desky"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void create();
                }
              }}
            />
          </div>

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
              disabled={
                creating || !newName.trim() || !newBlokId
              }
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
