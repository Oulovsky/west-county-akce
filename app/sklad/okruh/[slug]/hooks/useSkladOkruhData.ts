"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SKLAD_TABLE } from "@/lib/sklad/constants";
import {
  queryPoskozeniProPolozky,
  querySkladBlokDetail,
  querySkladovePolozky,
} from "@/lib/sklad/queries";
import type {
  SkladOkruhItem,
  SkladOkruhPoskozeniRow,
  SkladOkruhRow,
} from "@/lib/sklad/types";

export type { SkladOkruhItem, SkladOkruhPoskozeniRow, SkladOkruhRow };

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
      querySkladBlokDetail(supabase, blokId),
      querySkladovePolozky(supabase),
    ]);

    const loadedRows = (blokDetailRes.data ?? []) as SkladOkruhRow[];
    const loadedItems = (itemsRes.data ?? []) as SkladOkruhItem[];

    setRows(loadedRows);
    setAllItems(loadedItems);

    const itemIds = loadedRows
      .map((r) => r.skladova_polozka_id)
      .filter((v): v is string => Boolean(v));

    if (itemIds.length > 0) {
      const { data } = await queryPoskozeniProPolozky(supabase, itemIds);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SKLAD_TABLE.hlaseniPoskozeni },
        reloadIfCurrent
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: SKLAD_TABLE.skladovePolozky },
        reloadIfCurrent
      )
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
