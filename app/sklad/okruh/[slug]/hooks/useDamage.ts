"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type DamageItem = {
  skladova_polozka_id: string;
  nazev: string;
  jednotka: string | null;
  celkem_k_dispozici: number;
};

export type DamageRow = {
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

export function useDamage(onAfterChange?: () => Promise<void> | void) {
  const [isDamageOpen, setIsDamageOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<DamageItem | null>(null);
  const [itemPoskozeni, setItemPoskozeni] = useState<DamageRow[]>([]);
  const [damageLoading, setDamageLoading] = useState(false);
  const [damageSaving, setDamageSaving] = useState(false);

  const [reportCount, setReportCount] = useState("1");
  const [reportType, setReportType] = useState("mechanicke");
  const [reportPriority, setReportPriority] = useState("stredni");
  const [reportBlocksUse, setReportBlocksUse] = useState(true);
  const [reportDescription, setReportDescription] = useState("");

  // 🔥 NOVÉ
  const [reportZakazkaId, setReportZakazkaId] = useState<string | null>(null);

  const [unblockReason, setUnblockReason] = useState("");

  async function loadDamageForItem(itemId: string) {
    setDamageLoading(true);

    const { data, error } = await supabase
      .from("hlaseni_poskozeni")
      .select("*")
      .eq("skladova_polozka_id", itemId)
      .order("datum_nahlaseni", { ascending: false });

    if (error) {
      window.alert("Chyba: " + error.message);
      setItemPoskozeni([]);
      setDamageLoading(false);
      return;
    }

    setItemPoskozeni((data ?? []) as DamageRow[]);
    setDamageLoading(false);
  }

  function openDamageModal(item: DamageItem) {
    setActiveItem(item);
    setIsDamageOpen(true);

    setReportCount("1");
    setReportType("mechanicke");
    setReportPriority("stredni");
    setReportBlocksUse(true);
    setReportDescription("");
    setReportZakazkaId(null);

    setUnblockReason("");
    setItemPoskozeni([]);

    void loadDamageForItem(item.skladova_polozka_id);
  }

  function closeDamageModal() {
    if (damageSaving) return;
    setIsDamageOpen(false);
    setActiveItem(null);
    setItemPoskozeni([]);
    setUnblockReason("");
  }

  async function runAfterChange() {
    if (onAfterChange) {
      await onAfterChange();
    }

    if (activeItem?.skladova_polozka_id) {
      await loadDamageForItem(activeItem.skladova_polozka_id);
    }
  }

  async function handleReportDamage() {
    if (!activeItem) return;

    const pocetKusu = Number(reportCount);

    if (!Number.isFinite(pocetKusu) || pocetKusu <= 0) {
      window.alert("Počet kusů musí být číslo větší než 0.");
      return;
    }

    setDamageSaving(true);

    const { error } = await supabase.rpc("nahlasit_poskozeni", {
      p_skladova_polozka_id: activeItem.skladova_polozka_id,
      p_pocet_kusu: pocetKusu,
      p_zakazka_id: reportZakazkaId, // 🔥 už se ukládá
      p_popis: reportDescription.trim() || null,
      p_typ_poskozeni: reportType || null,
      p_priorita: reportPriority || "stredni",
      p_blokuje_pouziti: reportBlocksUse,
    });

    setDamageSaving(false);

    if (error) {
      window.alert("Chyba: " + error.message);
      return;
    }

    await runAfterChange();

    setReportCount("1");
    setReportType("mechanicke");
    setReportPriority("stredni");
    setReportBlocksUse(true);
    setReportDescription("");
    setReportZakazkaId(null);
  }

  async function handleUnblockDamage(poskozeniId: string) {
    if (!activeItem) return;

    setDamageSaving(true);

    const { error } = await supabase
      .from("hlaseni_poskozeni")
      .update({
        blokuje_pouziti: false,
        datum_odblokovani: new Date().toISOString(),
        duvod_odblokovani: unblockReason.trim() || null,
        stav_reseni: "odblokovano",
      })
      .eq("poskozeni_id", poskozeniId);

    setDamageSaving(false);

    if (error) {
      window.alert("Chyba: " + error.message);
      return;
    }

    setUnblockReason("");
    await runAfterChange();
  }

  async function handleCloseDamage(poskozeniId: string) {
    if (!activeItem) return;

    setDamageSaving(true);

    const { error } = await supabase
      .from("hlaseni_poskozeni")
      .update({
        blokuje_pouziti: false,
        datum_uzavreni: new Date().toISOString(),
        stav_reseni: "uzavreno",
      })
      .eq("poskozeni_id", poskozeniId);

    setDamageSaving(false);

    if (error) {
      window.alert("Chyba: " + error.message);
      return;
    }

    await runAfterChange();
  }

  useEffect(() => {
    if (!activeItem?.skladova_polozka_id) return;

    const channel = supabase
      .channel(`damage-${activeItem.skladova_polozka_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "hlaseni_poskozeni",
          filter: `skladova_polozka_id=eq.${activeItem.skladova_polozka_id}`,
        },
        async () => {
          await loadDamageForItem(activeItem.skladova_polozka_id);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeItem?.skladova_polozka_id]);

  return {
    isDamageOpen,
    activeItem,
    itemPoskozeni,
    damageLoading,
    damageSaving,

    reportCount,
    setReportCount,
    reportType,
    setReportType,
    reportPriority,
    setReportPriority,
    reportBlocksUse,
    setReportBlocksUse,
    reportDescription,
    setReportDescription,

    reportZakazkaId,
    setReportZakazkaId,

    unblockReason,
    setUnblockReason,

    openDamageModal,
    closeDamageModal,
    handleReportDamage,
    handleUnblockDamage,
    handleCloseDamage,
  };
}