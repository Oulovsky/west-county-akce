"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

import AssignItemModal from "./components/AssignItemModal";
import { DamageModal } from "./components/DamageModal";
import ItemsTable from "./components/ItemsTable";
import { useSkladOkruhData } from "./hooks/useSkladOkruhData";
import { useDamage } from "./hooks/useDamage";
import type { SkladOkruhTableItem, SkladZakazkaOption } from "@/lib/sklad/types";

type KategorieGroup = {
  id: string;
  nazev: string;
  poradi: number;
  itemCount: number;
  total: number;
  subcategories: string[];
};

const UNCATEGORIZED_ID = "__bez_kategorie__";

export default function SkladOkruhDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const blokId = params?.slug ?? "";
  const itemFromUrl = searchParams.get("item");

  const {
    items,
    loading,
    saving,
    blokNazev,
    total,
    availableItems,
    assignItemToBlock,
    getItemDamageSummary,
    load,
  } = useSkladOkruhData(blokId);

  const damage = useDamage(load);

  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [zakazky, setZakazky] = useState<SkladZakazkaOption[]>([]);

  const loadZakazky = useCallback(async () => {
    const { data, error } = await supabase
      .from("zakazky")
      .select("zakazka_id, cislo_zakazky, nazev, datum_od, datum_do")
      .order("datum_od", { ascending: false })
      .limit(100);

    if (error) {
      console.error(error);
      return;
    }

    setZakazky((data ?? []) as SkladZakazkaOption[]);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadZakazky();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadZakazky]);

  const categoryGroups = useMemo<KategorieGroup[]>(() => {
    const map = new Map<string, KategorieGroup>();

    for (const item of items) {
      const id = item.kategorie_techniky_id ?? UNCATEGORIZED_ID;
      const nazev = item.kategorie_nazev ?? "Bez kategorie";
      const poradi = item.kategorie_poradi ?? 999999;

      const existing =
        map.get(id) ??
        {
          id,
          nazev,
          poradi,
          itemCount: 0,
          total: 0,
          subcategories: [],
        };

      existing.itemCount += 1;
      existing.total += Number(item.celkem_k_dispozici ?? 0);

      if (item.podkategorie_nazev && !existing.subcategories.includes(item.podkategorie_nazev)) {
        existing.subcategories.push(item.podkategorie_nazev);
      }

      map.set(id, existing);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.poradi !== b.poradi) return a.poradi - b.poradi;
      return a.nazev.localeCompare(b.nazev, "cs");
    });
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!selectedCategoryId) return [];

    return items.filter((item) => {
      const id = item.kategorie_techniky_id ?? UNCATEGORIZED_ID;
      return id === selectedCategoryId;
    });
  }, [items, selectedCategoryId]);

  const selectedCategory = useMemo(() => {
    return categoryGroups.find((group) => group.id === selectedCategoryId) ?? null;
  }, [categoryGroups, selectedCategoryId]);

  const filteredZakazky = useMemo(() => {
    const now = new Date();

    return [...zakazky]
      .filter((z) => {
        if (!z.datum_do) return true;

        const datumDo = new Date(z.datum_do);
        const diffDays = (now.getTime() - datumDo.getTime()) / (1000 * 60 * 60 * 24);

        return diffDays <= 2;
      })
      .sort((a, b) => {
        const nowTime = now.getTime();

        const aStart = a.datum_od ? new Date(a.datum_od).getTime() : 0;
        const aEnd = a.datum_do ? new Date(a.datum_do).getTime() : 0;
        const bStart = b.datum_od ? new Date(b.datum_od).getTime() : 0;
        const bEnd = b.datum_do ? new Date(b.datum_do).getTime() : 0;

        const aActive = aStart <= nowTime && aEnd >= nowTime;
        const bActive = bStart <= nowTime && bEnd >= nowTime;

        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;

        return bStart - aStart;
      });
  }, [zakazky]);

  const getActiveZakazkaId = useCallback(() => {
    const now = new Date().getTime();

    const active = filteredZakazky.find((z) => {
      const start = z.datum_od ? new Date(z.datum_od).getTime() : 0;
      const end = z.datum_do ? new Date(z.datum_do).getTime() : 0;

      return start <= now && end >= now;
    });

    return active?.zakazka_id ?? null;
  }, [filteredZakazky]);

  function openAssignModal() {
    setSelectedId("");
    setIsAssignOpen(true);
  }

  function closeAssignModal() {
    if (saving) return;
    setIsAssignOpen(false);
  }

  async function handleAssignItem() {
    const { error } = await assignItemToBlock(selectedId);

    if (error) {
      alert("Chyba: " + error);
      return;
    }

    setIsAssignOpen(false);
    setSelectedId("");
  }

  const handleDamageClick = useCallback(
    (item: SkladOkruhTableItem) => {
      damage.openDamageModal({
        skladova_polozka_id: item.skladova_polozka_id,
        nazev: item.nazev ?? "Položka",
        jednotka: item.jednotka,
        celkem_k_dispozici: Number(item.celkem_k_dispozici ?? 0),
      });

      damage.setReportZakazkaId(getActiveZakazkaId());
    },
    [damage, getActiveZakazkaId]
  );

  function closeDamageModalAndCleanUrl() {
    damage.closeDamageModal();

    if (itemFromUrl) {
      router.replace(`/sklad/okruh/${blokId}`);
    }
  }

  const tableItems: SkladOkruhTableItem[] = visibleItems.map((item) => ({
    skladova_polozka_id: item.skladova_polozka_id,
    nazev: item.nazev,
    jednotka: item.jednotka,
    celkem_k_dispozici: item.celkem_k_dispozici,
    poznamka: item.poznamka,
  }));

  useEffect(() => {
    if (!itemFromUrl || items.length === 0) return;

    const timer = window.setTimeout(() => {
      const found = items.find((item) => item.skladova_polozka_id === itemFromUrl);
      if (!found) return;

      setSelectedCategoryId(found.kategorie_techniky_id ?? UNCATEGORIZED_ID);

      handleDamageClick({
        skladova_polozka_id: found.skladova_polozka_id,
        nazev: found.nazev,
        jednotka: found.jednotka,
        celkem_k_dispozici: found.celkem_k_dispozici,
        poznamka: found.poznamka,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [itemFromUrl, items, handleDamageClick]);

  return (
    <div style={{ padding: 28 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>{blokNazev}</h1>

          <div style={{ fontSize: 14, opacity: 0.8, marginTop: 8 }}>
            Kategorie: {categoryGroups.length} | Položek: {items.length} | Kusů celkem: {total}
            {saving ? " • ukládám..." : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/sklad" style={btnStyle}>
            Položky skladu
          </Link>

          <Link href="/sklad/poskozeni" style={dangerBtnStyle}>
            Otevřená poškození
          </Link>

          <Link href="/sklad/statistika" style={secondaryBtnStyle}>
            Statistika poškození
          </Link>

          <button type="button" onClick={openAssignModal} disabled={saving} style={primaryBtnStyle}>
            + Přidat ze skladu
          </button>
        </div>
      </div>

      <AssignItemModal
        open={isAssignOpen}
        onClose={closeAssignModal}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        items={availableItems}
        saving={saving}
        onSubmit={handleAssignItem}
      />

      <DamageModal
        open={damage.isDamageOpen}
        onClose={closeDamageModalAndCleanUrl}
        item={damage.activeItem}
        data={damage.itemPoskozeni}
        loading={damage.damageLoading}
        zakazky={filteredZakazky}
        damageSaving={damage.damageSaving}
        reportZakazkaId={damage.reportZakazkaId}
        setReportZakazkaId={damage.setReportZakazkaId}
        reportCount={damage.reportCount}
        setReportCount={damage.setReportCount}
        reportType={damage.reportType}
        setReportType={damage.setReportType}
        reportPriority={damage.reportPriority}
        setReportPriority={damage.setReportPriority}
        reportBlocksUse={damage.reportBlocksUse}
        setReportBlocksUse={damage.setReportBlocksUse}
        reportDescription={damage.reportDescription}
        setReportDescription={damage.setReportDescription}
        unblockReason={damage.unblockReason}
        setUnblockReason={damage.setUnblockReason}
        onReportDamage={damage.handleReportDamage}
        onUnblockDamage={damage.handleUnblockDamage}
        onCloseDamage={damage.handleCloseDamage}
      />

      {loading ? (
        <div>Načítám...</div>
      ) : (
        <>
          <div style={sectionHeaderStyle}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Kategorie v okruhu {blokNazev}</h2>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
                Vyber kategorii, například Truss, Desky, Plachty nebo Zábradlí.
              </div>
            </div>

            {selectedCategory ? (
              <button type="button" onClick={() => setSelectedCategoryId(null)} style={secondaryBtnStyle}>
                Zobrazit všechny kategorie
              </button>
            ) : null}
          </div>

          {categoryGroups.length === 0 ? (
            <div style={emptyStyle}>V tomto okruhu zatím nejsou žádné položky.</div>
          ) : !selectedCategory ? (
            <div style={categoryGridStyle}>
              {categoryGroups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(group.id)}
                  style={categoryCardStyle}
                >
                  <div style={{ fontSize: 26, fontWeight: 900, marginBottom: 16 }}>
                    {group.nazev}
                  </div>

                  <div style={categoryRowStyle}>
                    <span>Položek</span>
                    <strong>{group.itemCount}</strong>
                  </div>

                  <div style={categoryRowStyle}>
                    <span>Kusů celkem</span>
                    <strong>{group.total}</strong>
                  </div>

                  <div style={{ marginTop: 14, fontSize: 13, opacity: 0.75 }}>
                    {group.subcategories.length > 0
                      ? group.subcategories.slice(0, 4).join(" / ")
                      : "Bez podkategorií"}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <button type="button" onClick={() => setSelectedCategoryId(null)} style={btnStyle}>
                  ← Zpět na kategorie
                </button>

                <h2 style={{ marginTop: 20, marginBottom: 8, fontSize: 24 }}>
                  {selectedCategory.nazev}
                </h2>

                <div style={{ fontSize: 14, opacity: 0.75 }}>
                  Položek: {selectedCategory.itemCount} | Kusů celkem: {selectedCategory.total}
                </div>
              </div>

              <ItemsTable
                items={tableItems}
                getSummary={getItemDamageSummary}
                onDamageClick={handleDamageClick}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "1px solid #30466d",
  background: "#0f2347",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "1px solid #4b5563",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
  cursor: "pointer",
};

const dangerBtnStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "1px solid #7c2d12",
  background: "#7c2d12",
  color: "#fff",
  fontWeight: 700,
  textDecoration: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 10,
  border: "1px solid #3b82f6",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const sectionHeaderStyle: React.CSSProperties = {
  border: "1px solid #1f355a",
  borderRadius: 14,
  padding: 18,
  background: "#07152d",
  marginBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "center",
};

const categoryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
};

const categoryCardStyle: React.CSSProperties = {
  border: "1px solid #1f355a",
  borderRadius: 14,
  background: "#07152d",
  color: "#fff",
  padding: 22,
  textAlign: "left",
  cursor: "pointer",
};

const categoryRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 12,
  fontSize: 14,
  marginTop: 8,
  color: "#bcd3f7",
};

const emptyStyle: React.CSSProperties = {
  border: "1px solid #30466d",
  borderRadius: 12,
  padding: 18,
  background: "#07152d",
};
