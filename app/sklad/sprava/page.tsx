"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SkladToolbar } from "./components/SkladToolbar";
import { SkladStats } from "./components/SkladStats";
import { AddItemModal } from "./components/AddItemModal";
import { SkladTable } from "./components/SkladTable";
import { SkladTableRow } from "./components/SkladTableRow";
import { toNumber } from "./components/toNumber";

type Item = {
  skladova_polozka_id: string;
  nazev: string;
  kategorie_techniky_id: string | null;
  kategorie_nazev: string | null;
  podkategorie_techniky_id: string | null;
  podkategorie_nazev: string | null;
  celkem_k_dispozici: number;
  jednotka: string | null;
  interni_naklad: number | null;
  fakturacni_cena: number | null;
  sklad_blok_id: string | null;
  blok_nazev: string | null;
  na_sklade: number | null;
  na_akcich: number | null;
  poskozene: number | null;
};

type Kategorie = {
  kategorie_techniky_id: string;
  sklad_blok_id: string | null;
  blok_nazev: string | null;
  nazev: string;
  poradi?: number | null;
};

type Podkategorie = {
  podkategorie_techniky_id: string;
  kategorie_techniky_id: string;
  kategorie_nazev: string | null;
  nazev: string;
  poradi?: number | null;
};

type Jednotka = {
  jednotka_id: string;
  nazev: string;
  poradi?: number | null;
};

type Blok = {
  sklad_blok_id: string;
  nazev: string;
};

type RpcErrorResult = {
  error: { message: string } | null;
};

export default function Page() {
  const [items, setItems] = useState<Item[]>([]);
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [podkategorie, setPodkategorie] = useState<Podkategorie[]>([]);
  const [jednotky, setJednotky] = useState<Jednotka[]>([]);
  const [bloky, setBloky] = useState<Blok[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    nazev: "",
    kusy: "",
    jednotka: "ks",
    naklad: "",
    rent: "",
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newNazev, setNewNazev] = useState("");
  const [newKusy, setNewKusy] = useState("1");
  const [newJednotka, setNewJednotka] = useState("ks");
  const [newKategorieId, setNewKategorieId] = useState("");
  const [newPodkategorieId, setNewPodkategorieId] = useState("");
  const [newBlokId, setNewBlokId] = useState("");
  const [newNaklad, setNewNaklad] = useState("");
  const [newRent, setNewRent] = useState("");

  const lastChange = useRef<{ before: Item; after: Item } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [itemsRes, kategorieRes, podkategorieRes, jednotkyRes, blokyRes] =
      await Promise.all([
        supabase.rpc("get_skladove_polozky"),
        supabase.rpc("get_kategorie_techniky_full"),
        supabase.rpc("get_podkategorie_techniky_full"),
        supabase.rpc("get_jednotky_skladu_full"),
        supabase.rpc("get_sklad_bloky"),
      ]);

    if (itemsRes.error) {
      alert(itemsRes.error.message);
      setLoading(false);
      return;
    }

    if (kategorieRes.error) {
      alert(kategorieRes.error.message);
      setLoading(false);
      return;
    }

    if (podkategorieRes.error) {
      alert(podkategorieRes.error.message);
      setLoading(false);
      return;
    }

    if (jednotkyRes.error) {
      alert(jednotkyRes.error.message);
      setLoading(false);
      return;
    }

    if (blokyRes.error) {
      alert(blokyRes.error.message);
      setLoading(false);
      return;
    }

    setItems((itemsRes.data ?? []) as Item[]);
    setKategorie((kategorieRes.data ?? []) as Kategorie[]);
    setPodkategorie((podkategorieRes.data ?? []) as Podkategorie[]);
    setJednotky((jednotkyRes.data ?? []) as Jednotka[]);
    setBloky((blokyRes.data ?? []) as Blok[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const channels = [
      supabase
        .channel("sklad-sprava-kategorie")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "kategorie_techniky" },
          load
        )
        .subscribe(),
      supabase
        .channel("sklad-sprava-podkategorie")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "podkategorie_techniky" },
          load
        )
        .subscribe(),
      supabase
        .channel("sklad-sprava-jednotky")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "jednotky_skladu" },
          load
        )
        .subscribe(),
      supabase
        .channel("sklad-sprava-poskozeni")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "hlaseni_poskozeni" },
          load
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [load]);

  const getKategorieOptions = useCallback(
    (blokId: string | null) => {
      if (!blokId) return [];
      return kategorie.filter((k) => k.sklad_blok_id === blokId);
    },
    [kategorie]
  );

  const getPodkategorieOptions = useCallback(
    (kategorieId: string | null) => {
      if (!kategorieId) return [];
      return podkategorie.filter((p) => p.kategorie_techniky_id === kategorieId);
    },
    [podkategorie]
  );

  const newKategorieOptions = useMemo(
    () => getKategorieOptions(newBlokId || null),
    [getKategorieOptions, newBlokId]
  );

  const newPodkategorieOptions = useMemo(
    () => getPodkategorieOptions(newKategorieId || null),
    [getPodkategorieOptions, newKategorieId]
  );

  function resetAddForm() {
    const firstBlokId = bloky[0]?.sklad_blok_id ?? "";
    const firstKategorieId =
      kategorie.find((k) => k.sklad_blok_id === firstBlokId)
        ?.kategorie_techniky_id ?? "";

    setNewBlokId(firstBlokId);
    setNewKategorieId(firstKategorieId);
    setNewPodkategorieId("");
    setNewNazev("");
    setNewKusy("1");
    setNewJednotka(jednotky[0]?.nazev ?? "ks");
    setNewNaklad("");
    setNewRent("");
  }

  function openAddModal() {
    resetAddForm();
    setIsAddOpen(true);
  }

  function closeAddModal() {
    if (isCreating) return;
    setIsAddOpen(false);
  }

  function startEdit(item: Item) {
    setEditingId(item.skladova_polozka_id);
    setDraft({
      nazev: item.nazev,
      kusy: String(toNumber(item.celkem_k_dispozici)),
      jednotka: item.jednotka ?? "ks",
      naklad: item.interni_naklad == null ? "" : String(item.interni_naklad),
      rent: item.fakturacni_cena == null ? "" : String(item.fakturacni_cena),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({
      nazev: "",
      kusy: "",
      jednotka: "ks",
      naklad: "",
      rent: "",
    });
  }

  const saveEdit = useCallback(
    async (id: string) => {
      const oldItem = items.find((i) => i.skladova_polozka_id === id);
      if (!oldItem) return;

      const parsedKusy = Number(draft.kusy);
      const parsedNaklad = draft.naklad === "" ? null : Number(draft.naklad);
      const parsedRent = draft.rent === "" ? null : Number(draft.rent);

      if (!draft.nazev.trim()) {
        alert("Název je povinný.");
        return;
      }

      if (!draft.jednotka.trim()) {
        alert("Jednotka je povinná.");
        return;
      }

      if (!Number.isFinite(parsedKusy) || parsedKusy < 0) {
        alert("Kusy musí být číslo 0 nebo vyšší.");
        return;
      }

      if (parsedNaklad !== null && !Number.isFinite(parsedNaklad)) {
        alert("Náklad musí být číslo.");
        return;
      }

      if (parsedRent !== null && !Number.isFinite(parsedRent)) {
        alert("Rent musí být číslo.");
        return;
      }

      const updated: Item = {
        ...oldItem,
        nazev: draft.nazev.trim(),
        celkem_k_dispozici: parsedKusy,
        jednotka: draft.jednotka.trim(),
        interni_naklad: parsedNaklad,
        fakturacni_cena: parsedRent,
      };

      lastChange.current = { before: oldItem, after: updated };

      setItems((prev) =>
        prev.map((i) => (i.skladova_polozka_id === id ? updated : i))
      );

      setEditingId(null);
      setSavingId(id);
      setHighlightId(id);

      const { error } = await supabase.rpc("update_skladova_polozka_detail", {
        p_id: id,
        p_nazev: updated.nazev,
        p_kusy: updated.celkem_k_dispozici,
        p_jednotka: updated.jednotka,
        p_naklad: updated.interni_naklad,
        p_rent: updated.fakturacni_cena,
      });

      setSavingId(null);
      window.setTimeout(() => setHighlightId(null), 1000);

      if (error) {
        alert(error.message);
        await load();
        return;
      }

      await load();
    },
    [draft, items, load]
  );

  useEffect(() => {
    function handleUndo(e: KeyboardEvent) {
      if (!(e.ctrlKey && e.key.toLowerCase() === "z")) return;
      if (!lastChange.current) return;

      e.preventDefault();

      const before = lastChange.current.before;

      setItems((prev) =>
        prev.map((i) =>
          i.skladova_polozka_id === before.skladova_polozka_id ? before : i
        )
      );

      setSavingId(before.skladova_polozka_id);

      supabase
        .rpc("update_skladova_polozka_detail", {
          p_id: before.skladova_polozka_id,
          p_nazev: before.nazev,
          p_kusy: before.celkem_k_dispozici,
          p_jednotka: before.jednotka ?? "ks",
          p_naklad: before.interni_naklad,
          p_rent: before.fakturacni_cena,
        })
        .then((result: RpcErrorResult) => {
          setSavingId(null);

          if (result.error) {
            alert(result.error.message);
            void load();
            return;
          }

          setHighlightId(before.skladova_polozka_id);
          window.setTimeout(() => setHighlightId(null), 1000);
        });

      lastChange.current = null;
    }

    window.addEventListener("keydown", handleUndo);
    return () => window.removeEventListener("keydown", handleUndo);
  }, [load]);

  useEffect(() => {
    function handleGlobalEnter(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      if (!editingId) return;

      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === "TEXTAREA") return;

      e.preventDefault();
      void saveEdit(editingId);
    }

    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [editingId, saveEdit]);

  async function updateZaklad(
    id: string,
    kategorieId: string | null,
    podkategorieId: string | null,
    blokId: string | null
  ) {
    const previous = items;

    const novaKategorie =
      kategorie.find((k) => k.kategorie_techniky_id === kategorieId)?.nazev ??
      null;

    const novaPodkategorie =
      podkategorie.find((p) => p.podkategorie_techniky_id === podkategorieId)
        ?.nazev ?? null;

    const novyBlok =
      bloky.find((b) => b.sklad_blok_id === blokId)?.nazev ?? null;

    setSavingId(id);

    setItems((prev) =>
      prev.map((item) =>
        item.skladova_polozka_id === id
          ? {
              ...item,
              kategorie_techniky_id: kategorieId,
              kategorie_nazev: novaKategorie,
              podkategorie_techniky_id: podkategorieId,
              podkategorie_nazev: novaPodkategorie,
              sklad_blok_id: blokId,
              blok_nazev: novyBlok,
            }
          : item
      )
    );

    const { error } = await supabase.rpc("update_skladova_polozka_zaklad", {
      p_id: id,
      p_kategorie_techniky_id: kategorieId,
      p_podkategorie_techniky_id: podkategorieId,
      p_sklad_blok_id: blokId,
    });

    setSavingId(null);

    if (error) {
      setItems(previous);
      alert(error.message);
      return;
    }

    setHighlightId(id);
    window.setTimeout(() => setHighlightId(null), 1000);
    await load();
  }

  async function handleCreateItem() {
    const parsedKusy = Number(newKusy);
    const parsedNaklad = newNaklad === "" ? null : Number(newNaklad);
    const parsedRent = newRent === "" ? null : Number(newRent);

    if (!newBlokId) {
      alert("Vyber okruh.");
      return;
    }

    if (!newKategorieId) {
      alert("Vyber kategorii.");
      return;
    }

    if (!newNazev.trim()) {
      alert("Název je povinný.");
      return;
    }

    if (!newJednotka.trim()) {
      alert("Jednotka je povinná.");
      return;
    }

    if (!Number.isFinite(parsedKusy) || parsedKusy < 0) {
      alert("Kusy musí být číslo 0 nebo vyšší.");
      return;
    }

    if (parsedNaklad !== null && !Number.isFinite(parsedNaklad)) {
      alert("Náklad musí být číslo.");
      return;
    }

    if (parsedRent !== null && !Number.isFinite(parsedRent)) {
      alert("Rent musí být číslo.");
      return;
    }

    setIsCreating(true);

    const createRes = await supabase.rpc("create_skladova_polozka", {
      p_nazev: newNazev.trim(),
      p_kategorie_techniky_id: newKategorieId,
      p_podkategorie_techniky_id: newPodkategorieId || null,
      p_jednotka: newJednotka.trim(),
      p_celkem_k_dispozici: parsedKusy,
      p_interni_naklad: parsedNaklad,
      p_fakturacni_cena: parsedRent,
      p_aktivni: true,
      p_poznamka: null,
    });

    if (createRes.error) {
      setIsCreating(false);
      alert(createRes.error.message);
      return;
    }

    const createdRows = (createRes.data ?? []) as Array<{
      skladova_polozka_id: string;
    }>;

    const createdId = createdRows[0]?.skladova_polozka_id;

    if (!createdId) {
      setIsCreating(false);
      alert("Položka byla vytvořena, ale nepodařilo se získat její ID.");
      return;
    }

    const assignRes = await supabase.rpc("set_sklad_polozka_blok", {
      p_polozka_id: createdId,
      p_blok_id: newBlokId,
    });

    if (assignRes.error) {
      setIsCreating(false);
      alert(
        "Položka byla vytvořena, ale nepodařilo se ji přiřadit do okruhu: " +
          assignRes.error.message
      );
      await load();
      return;
    }

    setIsCreating(false);
    setIsAddOpen(false);
    await load();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, id: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveEdit(id);
    }

    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }

  const totalKusy = items.reduce(
    (sum, item) => sum + toNumber(item.celkem_k_dispozici),
    0
  );

  const totalAkce = items.reduce(
    (sum, item) => sum + toNumber(item.na_akcich),
    0
  );

  const totalPoskozene = items.reduce(
    (sum, item) => sum + toNumber(item.poskozene),
    0
  );

  const tableGrid =
    "grid-cols-[minmax(190px,2fr)_120px_130px_150px_70px_80px_80px_90px_90px_100px_90px_100px]";

  return (
    <div className="flex flex-col gap-5">
      <SkladToolbar onAddClick={openAddModal} />

      <SkladStats
        itemsCount={items.length}
        totalKusy={totalKusy}
        totalAkce={totalAkce}
        totalPoskozene={totalPoskozene}
      />

      <AddItemModal
        open={isAddOpen}
        onClose={closeAddModal}
        onSave={handleCreateItem}
        isCreating={isCreating}
        bloky={bloky}
        kategorie={kategorie}
        podkategorie={podkategorie}
        jednotky={jednotky}
        newBlokId={newBlokId}
        setNewBlokId={setNewBlokId}
        newKategorieId={newKategorieId}
        setNewKategorieId={setNewKategorieId}
        newPodkategorieId={newPodkategorieId}
        setNewPodkategorieId={setNewPodkategorieId}
        newNazev={newNazev}
        setNewNazev={setNewNazev}
        newKusy={newKusy}
        setNewKusy={setNewKusy}
        newJednotka={newJednotka}
        setNewJednotka={setNewJednotka}
        newNaklad={newNaklad}
        setNewNaklad={setNewNaklad}
        newRent={newRent}
        setNewRent={setNewRent}
        newKategorieOptions={newKategorieOptions}
        newPodkategorieOptions={newPodkategorieOptions}
      />

      <SkladTable loading={loading} tableGrid={tableGrid}>
        {items.map((i) => {
          const isEditing = editingId === i.skladova_polozka_id;
          const isSaving = savingId === i.skladova_polozka_id;
          const isHighlight = highlightId === i.skladova_polozka_id;

          const kategorieOptions = getKategorieOptions(i.sklad_blok_id);
          const podkategorieOptions = getPodkategorieOptions(
            i.kategorie_techniky_id
          );

          return (
            <SkladTableRow
              key={i.skladova_polozka_id}
              item={i}
              isEditing={isEditing}
              isSaving={isSaving}
              isHighlight={isHighlight}
              draft={draft}
              bloky={bloky}
              jednotky={jednotky}
              kategorieOptions={kategorieOptions}
              podkategorieOptions={podkategorieOptions}
              onStartEdit={() => startEdit(i)}
              onUpdateZaklad={(kategorieId, podkategorieId, blokId) =>
                updateZaklad(
                  i.skladova_polozka_id,
                  kategorieId,
                  podkategorieId,
                  blokId
                )
              }
              onDraftChange={setDraft}
              onKeyDown={(e) => handleKeyDown(e, i.skladova_polozka_id)}
            />
          );
        })}
      </SkladTable>
    </div>
  );
}
