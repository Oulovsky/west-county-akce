"use client";

import { badgeStyle, toNumber } from "@/lib/sklad/helpers";
import type { SkladOkruhDamageSummary, SkladOkruhTableItem } from "@/lib/sklad/types";

type Props = {
  items: SkladOkruhTableItem[];
  getSummary: (itemId: string) => SkladOkruhDamageSummary;
  onDamageClick: (item: SkladOkruhTableItem) => void;
};

export default function ItemsTable({
  items,
  getSummary,
  onDamageClick,
}: Props) {
  if (items.length === 0) {
    return (
      <div
        style={{
          border: "1px solid #30466d",
          borderRadius: 12,
          padding: 18,
          background: "#07152d",
        }}
      >
        V tomto okruhu zatím nejsou žádné položky.
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid #30466d",
        borderRadius: 12,
        overflow: "hidden",
        background: "#07152d",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 120px 120px 120px 200px",
          padding: "14px 16px",
          background: "#0f2347",
          fontWeight: 700,
          columnGap: 12,
        }}
      >
        <div>Název</div>
        <div>Celkem</div>
        <div>Poškozené</div>
        <div>Použitelné</div>
        <div>Akce</div>
      </div>

      {items.map((item, index) => {
        const summary = getSummary(item.skladova_polozka_id);

        return (
          <div
            key={item.skladova_polozka_id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 120px 120px 120px 200px",
              padding: "14px 16px",
              borderTop: index === 0 ? "none" : "1px solid #1c3157",
              columnGap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                {item.nazev ?? "Položka"}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {summary.totalReports > 0 ? (
                  <span style={badgeStyle("#334155")}>
                    hlášení: {summary.totalReports}
                  </span>
                ) : (
                  <span style={badgeStyle("#166534")}>bez závad</span>
                )}

                {summary.openReports > 0 ? (
                  <span style={badgeStyle("#991b1b")}>
                    otevřené: {summary.openReports}
                  </span>
                ) : null}

                {summary.blockedCount > 0 ? (
                  <span style={badgeStyle("#b91c1c")}>
                    blokuje: {summary.blockedCount} {item.jednotka ?? "ks"}
                  </span>
                ) : null}
              </div>

              {item.poznamka ? (
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
                  {item.poznamka}
                </div>
              ) : null}
            </div>

            <div>{toNumber(item.celkem_k_dispozici)}</div>
            <div>{summary.blockedCount}</div>
            <div>{Math.max(0, toNumber(item.celkem_k_dispozici) - summary.blockedCount)}</div>

            <div>
              <button
                type="button"
                onClick={() => onDamageClick(item)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #b45309",
                  background: "#92400e",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Poškození
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}