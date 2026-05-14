"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type SkladOkruhRow = {
  sklad_blok_id: string;
  blok_nazev: string;
  skladova_polozka_id: string | null;
  nazev: string | null;
  jednotka: string | null;
  celkem_k_dispozici: number | null;
  aktivni: boolean | null;
  poznamka: string | null;
  na_sklade: number | null;
  na_akcich: number | null;
  poskozene: number | null;
  kategorie_techniky_id: string | null;
  kategorie_nazev: string | null;
  kategorie_poradi: number | null;
  podkategorie_techniky_id: string | null;
  podkategorie_nazev: string | null;
  podkategorie_poradi: number | null;
};

export type SkladOkruhItem = {
  skladova_polozka_id: string;
  nazev: string;
  sklad_blok_id: string | null;
  blok_nazev: string | null;
  jednotka: string | null;
  celkem_k_dispozici: number;
};

export type SkladOkruhPoskozeniRow = {
  poskozeni_id: string;
  skladova_polozka_id: string;
  zakazka_id: string | null;
  pocet_kusu: number | string;
  popis: string | null;
  typ_poskozeni: string | null;
  priorita: string | null;
  blokuje_pouziti: boolean;
  stav_reseni: string;
  datum_nahlaseni: string;
  datum_uzavreni: string | null;
  datum_odblokovani: string | null;
  duvod_odblokovani: string | null;
};

export function useSkladOkruhData(blokId: string) {
  const [rows, setRows] = useState<SkladOkruhRow[]>([]);
  const [allItems, setAllItems] = useState<SkladOkruhItem[]>([]);
  const [allPoskozeni, setAllPoskozeni] = useState<SkladOkruhPoskozeniRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!blokId) return;

    setLoading(true);

    const [blokDetailRes, itemsRes] = await Promise.all([
      supabase.rpc("get_sklad_blok_detail", {
        p_sklad_blok_id: blokId,
      }),
      supabase.rpc("get_skladove_polozky"),
    ]);

    const loadedRows = (blokDetailRes.data ?? []) as SkladOkruhRow[];
    const loadedItems = (itemsRes.data ?? []) as SkladOkruhItem[];

    setRows(loadedRows);
    setAllItems(loadedItems);

    const itemIds = loadedRows
      .map((r) => r.skladova_polozka_id)
      .filter((v): v is string => Boolean(v));

    if (itemIds.length > 0) {
      const { data } = await supabase
        .from("hlaseni_poskozeni")
        .select("*")
        .in("skladova_polozka_id", itemIds)
        .order("datum_nahlaseni", { ascending: false });

      setAllPoskozeni((data ?? []) as SkladOkruhPoskozeniRow[]);
    } else {
      setAllPoskozeni([]);
    }

    setLoading(false);
  }, [blokId]);

  async function assignItemToBlock(selectedId: string) {
    if (!selectedId || !blokId) return { error: null as string | null };

    setSaving(true);

    const assignRes = await supabase.rpc("set_sklad_polozka_blok", {
      p_polozka_id: selectedId,
      p_blok_id: blokId,
    });

    setSaving(false);

    if (assignRes.error) {
      return { error: assignRes.error.message };
    }

    await load();
    return { error: null as string | null };
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!blokId) return;

    let cancelled = false;

    async function reloadIfCurrent() {
      if (cancelled) return;
      await load();
    }

    const channel = supabase
      .channel(`sklad-okruh-${blokId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hlaseni_poskozeni" }, reloadIfCurrent)
      .on("postgres_changes", { event: "*", schema: "public", table: "skladove_polozky" }, reloadIfCurrent)
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [blokId, load]);

  const blokNazev = rows[0]?.blok_nazev ?? "Okruh";

  const items = useMemo(
    () =>
      rows.filter(
        (r): r is SkladOkruhRow & { skladova_polozka_id: string } =>
          Boolean(r.skladova_polozka_id)
      ),
    [rows]
  );

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.celkem_k_dispozici ?? 0), 0),
    [items]
  );

  const availableItems = useMemo(() => {
    return allItems
      .filter((item) => item.sklad_blok_id !== blokId)
      .sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));
  }, [allItems, blokId]);

  function getItemDamageSummary(itemId: string) {
    const related = allPoskozeni.filter((p) => p.skladova_polozka_id === itemId);
    const open = related.filter((p) => !p.datum_uzavreni);
    const blocked = open.filter((p) => p.blokuje_pouziti);
    const blockedCount = blocked.reduce(
      (sum, row) => sum + Number(row.pocet_kusu ?? 0),
      0
    );

    return {
      totalReports: related.length,
      openReports: open.length,
      blockedCount,
    };
  }

  return {
    rows,
    allItems,
    allPoskozeni,
    loading,
    saving,
    blokNazev,
    items,
    total,
    availableItems,
    load,
    assignItemToBlock,
    getItemDamageSummary,
  };
}
