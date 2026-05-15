"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SkladToolbar } from "./components/SkladToolbar";
import { SkladStats } from "./components/SkladStats";
import { AddItemModal } from "./components/AddItemModal";
import { SkladTable } from "./components/SkladTable";
import { SkladTableRow } from "./components/SkladTableRow";
import { SKLAD_DEFAULT_JEDNOTKA, SKLAD_REALTIME_CHANNEL, SKLAD_TABLE } from "@/lib/sklad/constants";
import { toNumber } from "@/lib/sklad/helpers";
import { querySpravaKatalog } from "@/lib/sklad/queries";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
  SkladPolozkaRow,
} from "@/lib/sklad/types";

type RpcErrorResult = {
  error: { message: string } | null;
};

export default function Page() {
  const [items, setItems] = useState<SkladPolozkaRow[]>([]);
  const [kategorie, setKategorie] = useState<SkladKategorie[]>([]);
  const [podkategorie, setPodkategorie] = useState<SkladPodkategorie[]>([]);
  const [jednotky, setJednotky] = useState<SkladJednotka[]>([]);
  const [bloky, setBloky] = useState<SkladBlok[]>([]);
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

  const lastChange = useRef<{ before: SkladPolozkaRow; after: SkladPolozkaRow } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const [itemsRes, kategorieRes, podkategorieRes, jednotkyRes, blokyRes] =
      await querySpravaKatalog(supabase);

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

    setItems((itemsRes.data ?? []) as SkladPolozkaRow[]);
    setKategorie((kategorieRes.data ?? []) as SkladKategorie[]);
    setPodkategorie((podkategorieRes.data ?? []) as SkladPodkategorie[]);
    setJednotky((jednotkyRes.data ?? []) as SkladJednotka[]);
    setBloky((blokyRes.data ?? []) as SkladBlok[]);
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
        .channel(SKLAD_REALTIME_CHANNEL.spravaKategorie)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.kategorieTechniky },
          load
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaPodkategorie)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.podkategorieTechniky },
          load
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaJednotky)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.jednotkySkladu },
          load
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaPoskozeni)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.hlaseniPoskozeni },
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
      if (blokId) {
        const assignedToBlock = kategorie.filter(
          (k) => k.sklad_blok_id === blokId
        );

        if (assignedToBlock.length > 0) {
          return assignedToBlock;
        }
      }

      return kategorie.filter((k) => k.sklad_blok_id === null);
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
      getKategorieOptions(firstBlokId || null)[0]?.kategorie_techniky_id ?? "";

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

  function startEdit(item: SkladPolozkaRow) {
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

      const updated: SkladPolozkaRow = {
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
        setNewBlokId={(blokId) => {
          const firstKategorieId =
            getKategorieOptions(blokId || null)[0]?.kategorie_techniky_id ?? "";

          setNewBlokId(blokId);
          setNewKategorieId(firstKategorieId);
          setNewPodkategorieId("");
        }}
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
