"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SpravaInventoryFilters } from "./components/SpravaInventoryFilters";
import { supabase } from "@/lib/supabase";
import { SkladToolbar } from "./components/SkladToolbar";
import { SkladStats } from "./components/SkladStats";
import { AddItemModal } from "./components/AddItemModal";
import { SkladTable } from "./components/SkladTable";
import { SkladTableRow } from "./components/SkladTableRow";
import { SPRAVA_TABLE_GRID } from "./components/spravaTableLayout";
import {
  SKLAD_DEFAULT_JEDNOTKA,
  SKLAD_REALTIME_CHANNEL,
  SKLAD_RPC,
  SKLAD_TABLE,
} from "@/lib/sklad/constants";
import {
  enrichSpravaPolozkyWithPodkategorie,
  filterSpravaInventoryItems,
  toNumber,
} from "@/lib/sklad/helpers";
import {
  createInlineKategorie,
  createInlinePodkategorie,
  createInlineSkladBlok,
  type InlineConfigCreateResult,
} from "@/lib/sklad/inlineConfigCreate";
import {
  queryJednotkySkladuFull,
  queryKategorieTechnikyFull,
  queryPodkategorieTechnikyFull,
  querySkladBloky,
  querySkladovePolozkyPodkategorie,
  querySpravaKatalog,
} from "@/lib/sklad/queries";
import { querySpravaNaZakazkachCountsByPolozka } from "@/lib/sklad/spravaNaZakazkach";
import {
  computeSpravaNaSklade,
  querySpravaBlokujiciPoskozeneByPolozka,
} from "@/lib/sklad/spravaSkladem";
import { syncPolozkaKusyToCelkem } from "@/lib/sklad/syncPolozkaKusy";
import {
  SPRAVA_INVENTORY_FILTERS_EMPTY,
  type SkladBlok,
  type SkladJednotka,
  type SkladKategorie,
  type SkladPodkategorie,
  type SkladPolozkaRow,
  type SpravaInventoryFilters as SpravaInventoryFiltersState,
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
    pozice: "",
    jednotka: "ks",
    naklad: "",
    rent: "",
  });

  const [savingId, setSavingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [kusyReloadById, setKusyReloadById] = useState<Record<string, number>>(
    {}
  );
  const [inventoryFilters, setInventoryFilters] =
    useState<SpravaInventoryFiltersState>(SPRAVA_INVENTORY_FILTERS_EMPTY);

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

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const bumpKusyReload = useCallback((polozkaId: string) => {
    setKusyReloadById((prev) => ({
      ...prev,
      [polozkaId]: (prev[polozkaId] ?? 0) + 1,
    }));
  }, []);

  const applyKusySyncAfterCelkemSave = useCallback(
    async (polozkaId: string, nazev: string, celkem: number) => {
      const sync = await syncPolozkaKusyToCelkem(
        supabase,
        polozkaId,
        nazev,
        celkem
      );

      if (!sync.ok) {
        alert(
          `Položka uložena, ale evidenci kusů se nepodařilo doplnit: ${sync.error}\n\n` +
            "Přidejte kusy v detailu položky, nebo požádejte o úpravu oprávnění v databázi."
        );
        return;
      }

      bumpKusyReload(polozkaId);
    },
    [bumpKusyReload]
  );

  const reloadCatalog = useCallback(async () => {
    const [kategorieRes, podkategorieRes, jednotkyRes, blokyRes] =
      await Promise.all([
        queryKategorieTechnikyFull(supabase),
        queryPodkategorieTechnikyFull(supabase),
        queryJednotkySkladuFull(supabase),
        querySkladBloky(supabase),
      ]);

    if (kategorieRes.error) {
      alert(kategorieRes.error.message);
      return false;
    }

    if (podkategorieRes.error) {
      alert(podkategorieRes.error.message);
      return false;
    }

    if (jednotkyRes.error) {
      alert(jednotkyRes.error.message);
      return false;
    }

    if (blokyRes.error) {
      alert(blokyRes.error.message);
      return false;
    }

    setKategorie((kategorieRes.data ?? []) as SkladKategorie[]);
    setPodkategorie((podkategorieRes.data ?? []) as SkladPodkategorie[]);
    setJednotky((jednotkyRes.data ?? []) as SkladJednotka[]);
    setBloky((blokyRes.data ?? []) as SkladBlok[]);
    return true;
  }, []);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }

      const [
        itemsRes,
        kategorieRes,
        podkategorieRes,
        jednotkyRes,
        blokyRes,
        polozkyPodkategorieRes,
      ] = await querySpravaKatalog(supabase);

      if (itemsRes.error) {
        alert(itemsRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (kategorieRes.error) {
        alert(kategorieRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (podkategorieRes.error) {
        alert(podkategorieRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (jednotkyRes.error) {
        alert(jednotkyRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (blokyRes.error) {
        alert(blokyRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      if (polozkyPodkategorieRes.error) {
        alert(polozkyPodkategorieRes.error.message);
        if (!options?.silent) setLoading(false);
        return;
      }

      const podkategorieCatalog = (podkategorieRes.data ??
        []) as SkladPodkategorie[];

      const { data: pozRows, error: pozErr } = await supabase
        .from(SKLAD_TABLE.skladovePolozky)
        .select("skladova_polozka_id, pozice");

      if (pozErr && !options?.silent) {
        alert(pozErr.message);
      }

      const pozMap = new Map<string, string | number | null>(
        (pozRows ?? []).map(
          (r: { skladova_polozka_id: string; pozice: string | number | null }) => [
            r.skladova_polozka_id,
            r.pozice ?? null,
          ]
        )
      );

      const rawItems = ((itemsRes.data ?? []) as SkladPolozkaRow[]).map(
        (item) => ({
          ...item,
          pozice:
            pozMap.get(item.skladova_polozka_id) ?? item.pozice ?? null,
        })
      );

      const enrichedPodkategorie = enrichSpravaPolozkyWithPodkategorie(
        rawItems,
        (polozkyPodkategorieRes.data ?? []) as Array<{
          skladova_polozka_id: string;
          podkategorie_techniky_id: string | null;
        }>,
        podkategorieCatalog
      );

      const [{ map: naZakazkachMap, error: naZakazkachErr }, { map: blokujiciMap, error: blokujiciErr }] =
        await Promise.all([
          querySpravaNaZakazkachCountsByPolozka(supabase, new Date()),
          querySpravaBlokujiciPoskozeneByPolozka(supabase),
        ]);

      const mergedItems = enrichedPodkategorie.map((item) => {
        const id = item.skladova_polozka_id;
        const celkem = toNumber(item.celkem_k_dispozici);

        if (naZakazkachErr || !naZakazkachMap) {
          return item;
        }

        const naZakazkach = naZakazkachMap.get(id) ?? 0;

        if (blokujiciErr || !blokujiciMap) {
          return {
            ...item,
            na_akcich: naZakazkach,
          };
        }

        const blok = blokujiciMap.get(id) ?? 0;

        return {
          ...item,
          na_akcich: naZakazkach,
          na_sklade: computeSpravaNaSklade(celkem, naZakazkach, blok),
        };
      });

      if (!options?.silent && (naZakazkachErr || blokujiciErr)) {
        const parts: string[] = [];
        if (naZakazkachErr) {
          parts.push(`Rezervace v zakázkách: ${naZakazkachErr.message}`);
        }
        if (blokujiciErr) {
          parts.push(`Blokující poškození: ${blokujiciErr.message}`);
        }
        alert(
          `${parts.join(" ")}\n\nSloupce „Na zakázkách“ a „Skladem“ zůstávají u části dat ze serveru.`
        );
      }
      setItems(mergedItems);
      setKategorie((kategorieRes.data ?? []) as SkladKategorie[]);
      setPodkategorie(podkategorieCatalog);
      setJednotky((jednotkyRes.data ?? []) as SkladJednotka[]);
      setBloky((blokyRes.data ?? []) as SkladBlok[]);
      if (!options?.silent) {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load, reloadCatalog]);

  useEffect(() => {
    const channels = [
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaKategorie)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.kategorieTechniky },
          () => {
            void reloadCatalog();
          }
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaPodkategorie)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.podkategorieTechniky },
          () => {
            void reloadCatalog();
          }
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaJednotky)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.jednotkySkladu },
          () => {
            void reloadCatalog();
          }
        )
        .subscribe(),
      supabase
        .channel("sklad-sprava-na-zakazkach")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: SKLAD_TABLE.technikaNaZakazce,
          },
          () => {
            void load({ silent: true });
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.zakazky },
          () => {
            void load({ silent: true });
          }
        )
        .subscribe(),
      supabase
        .channel(SKLAD_REALTIME_CHANNEL.spravaPoskozeni)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: SKLAD_TABLE.hlaseniPoskozeni },
          () => {
            void load({ silent: true });
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [load, reloadCatalog]);

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

  function inlineCreateError(
    result: InlineConfigCreateResult
  ): { error?: string } {
    if (result.ok) return {};
    return { error: result.message };
  }

  const handleQuickCreateBlok = useCallback(
    async (nazev: string) => {
      const result = await createInlineSkladBlok(supabase, nazev);
      if (!result.ok) return inlineCreateError(result);

      const catalogOk = await reloadCatalog();
      if (!catalogOk) return { error: "Nepodařilo se načíst katalog." };

      const { data: kategorieData } = await queryKategorieTechnikyFull(supabase);
      const firstKategorieId =
        ((kategorieData ?? []) as SkladKategorie[]).find(
          (k) => k.sklad_blok_id === result.value
        )?.kategorie_techniky_id ?? "";

      setNewBlokId(result.value);
      setNewKategorieId(firstKategorieId);
      setNewPodkategorieId("");

      return {};
    },
    [reloadCatalog]
  );

  const handleQuickCreateKategorie = useCallback(
    async (nazev: string) => {
      if (!newBlokId) return { error: "Nejdřív vyber okruh." };

      const result = await createInlineKategorie(supabase, nazev, newBlokId);
      if (!result.ok) return inlineCreateError(result);

      setKategorie((prev) => {
        if (prev.some((k) => k.kategorie_techniky_id === result.value)) {
          return prev;
        }
        return [
          ...prev,
          {
            kategorie_techniky_id: result.value,
            nazev: result.nazev,
            sklad_blok_id: newBlokId,
          },
        ];
      });

      await reloadCatalog();
      setNewKategorieId(result.value);
      setNewPodkategorieId("");

      return {};
    },
    [newBlokId, reloadCatalog]
  );

  const handleQuickCreatePodkategorie = useCallback(
    async (nazev: string) => {
      if (!newKategorieId) return { error: "Nejdřív vyber kategorii." };

      const result = await createInlinePodkategorie(
        supabase,
        nazev,
        newKategorieId
      );
      if (!result.ok) return inlineCreateError(result);

      setPodkategorie((prev) => {
        if (prev.some((p) => p.podkategorie_techniky_id === result.value)) {
          return prev;
        }
        return [
          ...prev,
          {
            podkategorie_techniky_id: result.value,
            nazev: result.nazev,
            kategorie_techniky_id: newKategorieId,
            kategorie_nazev: null,
          },
        ];
      });

      await reloadCatalog();
      setNewPodkategorieId(result.value);

      return {};
    },
    [newKategorieId, reloadCatalog]
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
      pozice:
        item.pozice == null || item.pozice === ""
          ? ""
          : String(item.pozice),
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
      pozice: "",
      jednotka: "ks",
      naklad: "",
      rent: "",
    });
  }

  const commitRowSave = useCallback(
    async (
      id: string,
      snapshot: {
        nazev: string;
        kusy: string;
        pozice: string;
        jednotka: string;
        naklad: string;
        rent: string;
      },
      options: { exitEdit: boolean }
    ) => {
      const oldItem = items.find((i) => i.skladova_polozka_id === id);
      if (!oldItem) return;

      const parsedKusy = Number(snapshot.kusy);
      const parsedNaklad = snapshot.naklad === "" ? null : Number(snapshot.naklad);
      const parsedRent = snapshot.rent === "" ? null : Number(snapshot.rent);
      const parsedPozice =
        snapshot.pozice.trim() === "" ? null : Number(snapshot.pozice);

      if (!snapshot.nazev.trim()) {
        alert("Název je povinný.");
        return;
      }

      if (!snapshot.jednotka.trim()) {
        alert("Jednotka je povinná.");
        return;
      }

      if (!Number.isFinite(parsedKusy) || parsedKusy < 0) {
        alert("Kusy musí být číslo 0 nebo vyšší.");
        return;
      }

      if (parsedPozice !== null && !Number.isFinite(parsedPozice)) {
        alert("Pozice musí být číslo.");
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
        nazev: snapshot.nazev.trim(),
        celkem_k_dispozici: parsedKusy,
        jednotka: snapshot.jednotka.trim(),
        interni_naklad: parsedNaklad,
        fakturacni_cena: parsedRent,
        pozice: parsedPozice,
      };

      lastChange.current = { before: oldItem, after: updated };

      setItems((prev) =>
        prev.map((i) => (i.skladova_polozka_id === id ? updated : i))
      );

      if (options.exitEdit) {
        setEditingId(null);
      }

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
        await load({ silent: true });
        return;
      }

      const { error: pozUpdateErr } = await supabase
        .from(SKLAD_TABLE.skladovePolozky)
        .update({
          pozice: parsedPozice,
          upraveno_dne: new Date().toISOString(),
        })
        .eq("skladova_polozka_id", id);

      if (pozUpdateErr) {
        alert(pozUpdateErr.message);
        await load({ silent: true });
        return;
      }

      await applyKusySyncAfterCelkemSave(
        id,
        updated.nazev,
        updated.celkem_k_dispozici
      );

      await load({ silent: true });
    },
    [applyKusySyncAfterCelkemSave, items, load]
  );

  const saveEdit = useCallback(
    async (id: string) => {
      await commitRowSave(id, draftRef.current, { exitEdit: true });
    },
    [commitRowSave]
  );

  const commitJednotkaChange = useCallback(
    (polozkaId: string, jednotkaValue: string) => {
      if (editingId !== polozkaId) return;
      const snapshot = { ...draftRef.current, jednotka: jednotkaValue };
      void commitRowSave(polozkaId, snapshot, { exitEdit: true });
    },
    [commitRowSave, editingId]
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
        .then(async (result: RpcErrorResult) => {
          setSavingId(null);

          if (result.error) {
            alert(result.error.message);
            void load({ silent: true });
            return;
          }

          const rawPoz = before.pozice;
          const parsedUndoPoz =
            rawPoz == null || rawPoz === ""
              ? null
              : Number(rawPoz);
          const poziceUndo =
            parsedUndoPoz !== null && Number.isFinite(parsedUndoPoz)
              ? parsedUndoPoz
              : null;

          const { error: pozUndoErr } = await supabase
            .from(SKLAD_TABLE.skladovePolozky)
            .update({
              pozice: poziceUndo,
              upraveno_dne: new Date().toISOString(),
            })
            .eq("skladova_polozka_id", before.skladova_polozka_id);

          if (pozUndoErr) {
            alert(pozUndoErr.message);
            void load({ silent: true });
            return;
          }

          void applyKusySyncAfterCelkemSave(
            before.skladova_polozka_id,
            before.nazev,
            before.celkem_k_dispozici
          );

          setHighlightId(before.skladova_polozka_id);
          window.setTimeout(() => setHighlightId(null), 1000);
        });

      lastChange.current = null;
    }

    window.addEventListener("keydown", handleUndo);
    return () => window.removeEventListener("keydown", handleUndo);
  }, [applyKusySyncAfterCelkemSave, load, reloadCatalog]);

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

  function resolveKategorieForBlokChange(
    targetBlokId: string | null,
    previousKategorieId: string | null
  ): string | null {
    if (!targetBlokId) return previousKategorieId;

    const options = getKategorieOptions(targetBlokId);
    if (
      previousKategorieId &&
      options.some((k) => k.kategorie_techniky_id === previousKategorieId)
    ) {
      return previousKategorieId;
    }

    return options[0]?.kategorie_techniky_id ?? previousKategorieId;
  }

  async function updateZaklad(
    id: string,
    kategorieId: string | null,
    podkategorieId: string | null,
    blokId: string | null,
    labelOverrides?: {
      kategorieNazev?: string | null;
      podkategorieNazev?: string | null;
      blokNazev?: string | null;
    }
  ) {
    const previous = items;
    const oldItem = items.find((item) => item.skladova_polozka_id === id);
    if (!oldItem) return;

    const isBlokOnlyChange =
      kategorieId === null &&
      podkategorieId === null &&
      blokId !== oldItem.sklad_blok_id;

    const isKategorieChange =
      kategorieId !== null && kategorieId !== oldItem.kategorie_techniky_id;

    const isPodkategorieChange =
      !isBlokOnlyChange &&
      !isKategorieChange &&
      podkategorieId !== oldItem.podkategorie_techniky_id;

    const finalBlokId = isBlokOnlyChange ? blokId : (blokId ?? oldItem.sklad_blok_id);

    let finalKategorieId = oldItem.kategorie_techniky_id;
    if (isKategorieChange) {
      finalKategorieId = kategorieId;
    } else if (isBlokOnlyChange) {
      finalKategorieId = resolveKategorieForBlokChange(
        blokId,
        oldItem.kategorie_techniky_id
      );
    }

    let finalPodkategorieId = oldItem.podkategorie_techniky_id;
    if (isPodkategorieChange) {
      finalPodkategorieId = podkategorieId;
    } else if (isKategorieChange || isBlokOnlyChange) {
      finalPodkategorieId = null;
    }

    const zakladChanged =
      finalKategorieId !== oldItem.kategorie_techniky_id ||
      finalBlokId !== oldItem.sklad_blok_id;

    const podkategorieChanged =
      finalPodkategorieId !== oldItem.podkategorie_techniky_id;

    if (!zakladChanged && !podkategorieChanged) return;

    const novaKategorie =
      labelOverrides?.kategorieNazev ??
      kategorie.find((k) => k.kategorie_techniky_id === finalKategorieId)?.nazev ??
      null;

    const novaPodkategorie =
      labelOverrides?.podkategorieNazev ??
      podkategorie.find((p) => p.podkategorie_techniky_id === finalPodkategorieId)
        ?.nazev ??
      null;

    const novyBlok =
      labelOverrides?.blokNazev ??
      bloky.find((b) => b.sklad_blok_id === finalBlokId)?.nazev ??
      null;

    setSavingId(id);

    setItems((prev) =>
      prev.map((item) =>
        item.skladova_polozka_id === id
          ? {
              ...item,
              kategorie_techniky_id: finalKategorieId,
              kategorie_nazev: novaKategorie,
              podkategorie_techniky_id: finalPodkategorieId,
              podkategorie_nazev: novaPodkategorie,
              sklad_blok_id: finalBlokId,
              blok_nazev: novyBlok,
            }
          : item
      )
    );

    if (zakladChanged) {
      if (!finalKategorieId) {
        setSavingId(null);
        setItems(previous);
        alert("Kategorie je povinná — vyber kategorii v rámci okruhu.");
        return;
      }

      const { error } = await supabase.rpc(SKLAD_RPC.updateSkladovaPolozkaZaklad, {
        p_id: id,
        p_kategorie_techniky_id: finalKategorieId,
        p_sklad_blok_id: finalBlokId,
      });

      if (error) {
        setSavingId(null);
        setItems(previous);
        alert(error.message);
        return;
      }
    }

    if (podkategorieChanged) {
      if (!finalKategorieId) {
        setSavingId(null);
        setItems(previous);
        alert("Kategorie je povinná — podkategorii lze uložit až po přiřazení kategorie.");
        return;
      }

      const { error } = await supabase.rpc(SKLAD_RPC.updateSkladovaPolozka, {
        p_skladova_polozka_id: id,
        p_nazev: oldItem.nazev,
        p_kategorie_techniky_id: finalKategorieId,
        p_podkategorie_techniky_id: finalPodkategorieId,
        p_jednotka: oldItem.jednotka ?? SKLAD_DEFAULT_JEDNOTKA,
        p_celkem_k_dispozici: oldItem.celkem_k_dispozici,
        p_interni_naklad: oldItem.interni_naklad,
        p_fakturacni_cena: oldItem.fakturacni_cena,
        p_aktivni: true,
      });

      if (error) {
        setSavingId(null);
        setItems(previous);
        alert(error.message);
        await load({ silent: true });
        return;
      }

      const { data: podkategorieRows, error: podkategorieMapError } =
        await querySkladovePolozkyPodkategorie(supabase);

      if (!podkategorieMapError && podkategorieRows) {
        setPodkategorie((currentPodkategorie) => {
          setItems((prev) =>
            enrichSpravaPolozkyWithPodkategorie(
              prev,
              podkategorieRows,
              currentPodkategorie
            )
          );
          return currentPodkategorie;
        });
      }
    }

    setSavingId(null);
    setHighlightId(id);
    window.setTimeout(() => setHighlightId(null), 1000);
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

    await applyKusySyncAfterCelkemSave(
      createdId,
      newNazev.trim(),
      parsedKusy
    );

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

  const totalSkladem = items.reduce(
    (sum, item) => sum + toNumber(item.na_sklade),
    0
  );

  const filteredItems = useMemo(
    () => filterSpravaInventoryItems(items, inventoryFilters),
    [items, inventoryFilters]
  );

  return (
    <div className="flex flex-col gap-6">
      <SkladToolbar
        onAddClick={openAddModal}
        totalPoskozene={totalPoskozene}
      />

      <section
        aria-labelledby="sprava-polozky-heading"
        className="flex flex-col gap-4"
      >
        <div className="border-b border-slate-800 pb-4">
          <h2
            id="sprava-polozky-heading"
            className="text-lg font-semibold text-white"
          >
            Položky skladu
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Kompletní katalog. Editace přímo v tabulce, Enter uloží řádek, Ctrl+Z
            vrátí poslední změnu.
          </p>
        </div>

        <SkladStats
          itemsCount={items.length}
          totalKusy={totalKusy}
          totalSkladem={totalSkladem}
          totalAkce={totalAkce}
          totalPoskozene={totalPoskozene}
        />

        <SpravaInventoryFilters
          filters={inventoryFilters}
          onChange={setInventoryFilters}
          bloky={bloky}
          kategorie={kategorie}
          filteredCount={filteredItems.length}
          totalCount={items.length}
        />

        <AddItemModal
        open={isAddOpen}
        onClose={closeAddModal}
        onSave={handleCreateItem}
        isCreating={isCreating}
        bloky={bloky}
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
        onQuickCreateBlok={handleQuickCreateBlok}
        onQuickCreateKategorie={handleQuickCreateKategorie}
        onQuickCreatePodkategorie={handleQuickCreatePodkategorie}
        />

        <SkladTable loading={loading} tableGrid={SPRAVA_TABLE_GRID}>
          {!loading && filteredItems.length === 0 ? (
            <div className="border-t border-slate-800 px-4 py-10 text-center text-sm text-slate-400">
              Žádná položka nevyhovuje zadaným filtrům.
            </div>
          ) : null}
          {filteredItems.map((i) => {
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
              kusyReloadToken={kusyReloadById[i.skladova_polozka_id] ?? 0}
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
              onCommitJednotka={
                isEditing
                  ? (value) => commitJednotkaChange(i.skladova_polozka_id, value)
                  : undefined
              }
              onKeyDown={(e) => handleKeyDown(e, i.skladova_polozka_id)}
              onQuickCreateBlok={async (nazev) => {
                const polozkaId = i.skladova_polozka_id;
                const result = await createInlineSkladBlok(supabase, nazev);
                if (!result.ok) return inlineCreateError(result);

                const { data: kategorieData } =
                  await queryKategorieTechnikyFull(supabase);
                const firstKategorie = ((kategorieData ?? []) as SkladKategorie[]).find(
                  (k) => k.sklad_blok_id === result.value
                );

                await reloadCatalog();
                await updateZaklad(
                  polozkaId,
                  firstKategorie?.kategorie_techniky_id ?? null,
                  null,
                  result.value,
                  {
                    blokNazev: result.nazev,
                    kategorieNazev: firstKategorie?.nazev ?? null,
                  }
                );
                return {};
              }}
              onQuickCreateKategorie={async (nazev) => {
                const polozkaId = i.skladova_polozka_id;
                const blokId = i.sklad_blok_id;
                if (!blokId) {
                  return { error: "Nejdřív přiřaď okruh." };
                }
                const result = await createInlineKategorie(
                  supabase,
                  nazev,
                  blokId
                );
                if (!result.ok) return inlineCreateError(result);

                setKategorie((prev) => {
                  if (prev.some((k) => k.kategorie_techniky_id === result.value)) {
                    return prev;
                  }
                  return [
                    ...prev,
                    {
                      kategorie_techniky_id: result.value,
                      nazev: result.nazev,
                      sklad_blok_id: blokId,
                    },
                  ];
                });

                await reloadCatalog();
                await updateZaklad(polozkaId, result.value, null, blokId, {
                  kategorieNazev: result.nazev,
                });
                return {};
              }}
              onQuickCreatePodkategorie={async (nazev) => {
                const polozkaId = i.skladova_polozka_id;
                const kategorieTechnikyId = i.kategorie_techniky_id;
                const blokId = i.sklad_blok_id;
                if (!kategorieTechnikyId) {
                  return { error: "Nejdřív vyber kategorii." };
                }
                const result = await createInlinePodkategorie(
                  supabase,
                  nazev,
                  kategorieTechnikyId
                );
                if (!result.ok) return inlineCreateError(result);

                setPodkategorie((prev) => {
                  if (
                    prev.some((p) => p.podkategorie_techniky_id === result.value)
                  ) {
                    return prev;
                  }
                  return [
                    ...prev,
                    {
                      podkategorie_techniky_id: result.value,
                      nazev: result.nazev,
                      kategorie_techniky_id: kategorieTechnikyId,
                      kategorie_nazev: null,
                    },
                  ];
                });

                await reloadCatalog();
                await updateZaklad(
                  polozkaId,
                  kategorieTechnikyId,
                  result.value,
                  blokId,
                  { podkategorieNazev: result.nazev }
                );
                return {};
              }}
              />
            );
          })}
        </SkladTable>
      </section>
    </div>
  );
}
