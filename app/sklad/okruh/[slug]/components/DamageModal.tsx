"use client";

import { Modal } from "@/components/ui/modal";
import {
  badgeStyle,
  buildZakazkaLabel,
  formatPrioritaLabel,
  formatTypPoskozeniLabel,
  toNumber,
} from "@/lib/sklad/helpers";
import type {
  SkladDamageModalItem,
  SkladOkruhPoskozeniRow,
  SkladZakazkaOption,
} from "@/lib/sklad/types";
import { formatDateTime } from "../helpers";

type Props = {
  open: boolean;
  onClose: () => void;
  item: SkladDamageModalItem | null;
  data: SkladOkruhPoskozeniRow[];
  loading: boolean;

  zakazky?: SkladZakazkaOption[];

  damageSaving?: boolean;

  reportZakazkaId?: string | null;
  setReportZakazkaId?: (value: string | null) => void;

  reportCount?: string;
  setReportCount?: (value: string) => void;

  reportType?: string;
  setReportType?: (value: string) => void;

  reportPriority?: string;
  setReportPriority?: (value: string) => void;

  reportBlocksUse?: boolean;
  setReportBlocksUse?: (value: boolean) => void;

  reportDescription?: string;
  setReportDescription?: (value: string) => void;

  unblockReason?: string;
  setUnblockReason?: (value: string) => void;

  onReportDamage?: () => void | Promise<void>;
  onUnblockDamage?: (poskozeniId: string) => void | Promise<void>;
  onCloseDamage?: (poskozeniId: string) => void | Promise<void>;
};

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div style={statBoxStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

export function DamageModal({
  open,
  onClose,
  item,
  data,
  loading,
  zakazky = [],
  damageSaving = false,
  reportZakazkaId = null,
  setReportZakazkaId,
  reportCount = "1",
  setReportCount,
  reportType = "mechanicke",
  setReportType,
  reportPriority = "stredni",
  setReportPriority,
  reportBlocksUse = true,
  setReportBlocksUse,
  reportDescription = "",
  setReportDescription,
  unblockReason = "",
  setUnblockReason,
  onReportDamage,
  onUnblockDamage,
  onCloseDamage,
}: Props) {
  const openItems = data.filter((p) => !p.datum_uzavreni);
  const blocked = openItems.filter((p) => p.blokuje_pouziti);
  const blockedCount = blocked.reduce(
    (sum, r) => sum + toNumber(r.pocet_kusu),
    0
  );

  const zakazkaMap = new Map(
    zakazky.map((z) => [z.zakazka_id, buildZakazkaLabel(z)])
  );

  const hasReportSection =
    !!item &&
    !!setReportCount &&
    !!setReportType &&
    !!setReportPriority &&
    !!setReportBlocksUse &&
    !!setReportDescription &&
    !!onReportDamage;

  const hasActionSection =
    !!item &&
    !!setUnblockReason &&
    !!onUnblockDamage &&
    !!onCloseDamage;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? `Poškození — ${item.nazev}` : "Poškození"}
      widthClassName="max-w-4xl"
    >
      <div
        style={{
          maxHeight: "calc(100vh - 180px)",
          overflowY: "auto",
          paddingRight: 6,
        }}
      >
        <div className="grid gap-6">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <StatBox label="Otevřená hlášení" value={openItems.length} />
            <StatBox
              label="Blokované kusy"
              value={`${blockedCount} ${item?.jednotka ?? "ks"}`}
            />
            <StatBox
              label="Použitelné kusy"
              value={`${Math.max(
                0,
                toNumber(item?.celkem_k_dispozici) - blockedCount
              )} ${item?.jednotka ?? "ks"}`}
            />
          </div>

          {hasReportSection ? (
            <div
              style={{
                border: "1px solid #30466d",
                borderRadius: 12,
                padding: 16,
                background: "#07152d",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
                1) Nahlásit poškození
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <div>
                  <div className="mb-2 text-sm text-slate-300">Počet kusů</div>
                  <input
                    value={reportCount}
                    onChange={(e) => setReportCount(e.target.value)}
                    inputMode="numeric"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div className="mb-2 text-sm text-slate-300">Typ poškození</div>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="mechanicke">mechanické</option>
                    <option value="elektricke">elektrické</option>
                    <option value="vizualni">vizuální</option>
                    <option value="jine">jiné</option>
                  </select>
                </div>

                <div>
                  <div className="mb-2 text-sm text-slate-300">Priorita</div>
                  <select
                    value={reportPriority}
                    onChange={(e) => setReportPriority(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="nizka">nízká</option>
                    <option value="stredni">střední</option>
                    <option value="vysoka">vysoká</option>
                    <option value="kriticka">kritická</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={reportBlocksUse}
                      onChange={(e) => setReportBlocksUse(e.target.checked)}
                    />
                    <span>Blokuje použití</span>
                  </label>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="mb-2 text-sm text-slate-300">Zakázka</div>
                  <select
                    value={reportZakazkaId ?? ""}
                    onChange={(e) => setReportZakazkaId?.(e.target.value || null)}
                    style={inputStyle}
                  >
                    <option value="">Bez vazby na zakázku</option>
                    {zakazky.map((zakazka) => (
                      <option key={zakazka.zakazka_id} value={zakazka.zakazka_id}>
                        {buildZakazkaLabel(zakazka)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="mb-2 text-sm text-slate-300">Popis</div>
                  <textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    rows={4}
                    placeholder="Popis poškození"
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      minHeight: 110,
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => void onReportDamage()}
                  disabled={damageSaving || loading}
                  className="rounded-xl border border-orange-700 bg-orange-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {damageSaving ? "Ukládám..." : "Nahlásit poškození"}
                </button>
              </div>
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid #30466d",
              borderRadius: 12,
              padding: 16,
              background: "#07152d",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              {hasReportSection ? "2) Stav poškození" : "Stav poškození"}
            </div>

            {loading ? (
              <div>Načítám...</div>
            ) : data.length === 0 ? (
              <div style={{ opacity: 0.8 }}>Bez hlášení poškození.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {data.map((row) => {
                  const isClosed = Boolean(row.datum_uzavreni);
                  const isBlocked = row.blokuje_pouziti && !isClosed;
                  const zakazkaLabel = row.zakazka_id
                    ? zakazkaMap.get(row.zakazka_id) ?? row.zakazka_id
                    : null;

                  return (
                    <div
                      key={row.poskozeni_id}
                      style={{
                        border: "1px solid #30466d",
                        borderRadius: 10,
                        padding: 12,
                        background: "#0b1d3d",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={badgeStyle("#7c2d12")}>
                          {toNumber(row.pocet_kusu)} {item?.jednotka ?? "ks"}
                        </span>
                        <span style={badgeStyle("#1d4ed8")}>
                          {formatTypPoskozeniLabel(row.typ_poskozeni)}
                        </span>
                        <span style={badgeStyle("#475569")}>
                          {formatPrioritaLabel(row.priorita)}
                        </span>
                        <span style={badgeStyle(isClosed ? "#166534" : "#991b1b")}>
                          {isClosed ? "uzavřeno" : "otevřené"}
                        </span>
                        {isBlocked ? (
                          <span style={badgeStyle("#b91c1c")}>blokuje použití</span>
                        ) : (
                          <span style={badgeStyle("#0f766e")}>neblokuje použití</span>
                        )}
                        {zakazkaLabel ? (
                          <span style={badgeStyle("#374151")}>{zakazkaLabel}</span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
                        nahlášeno: {formatDateTime(row.datum_nahlaseni)}
                      </div>

                      {row.datum_odblokovani ? (
                        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
                          odblokováno: {formatDateTime(row.datum_odblokovani)}
                        </div>
                      ) : null}

                      {row.datum_uzavreni ? (
                        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
                          uzavřeno: {formatDateTime(row.datum_uzavreni)}
                        </div>
                      ) : null}

                      <div style={{ marginBottom: 8 }}>
                        {row.popis?.trim() ? row.popis : "Bez popisu"}
                      </div>

                      {row.duvod_odblokovani?.trim() ? (
                        <div style={{ fontSize: 13, opacity: 0.85 }}>
                          důvod odblokování: {row.duvod_odblokovani}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {hasActionSection ? (
            <div
              style={{
                border: "1px solid #30466d",
                borderRadius: 12,
                padding: 16,
                background: "#07152d",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
                3) Odblokovat poškození / uzavřít
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="mb-2 text-sm text-slate-300">Důvod odblokování</div>
                <textarea
                  value={unblockReason}
                  onChange={(e) => setUnblockReason(e.target.value)}
                  rows={3}
                  placeholder="Např. otestováno, dočasně použitelné, opraveno..."
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    minHeight: 90,
                  }}
                />
              </div>

              {loading ? (
                <div>Načítám...</div>
              ) : openItems.length === 0 ? (
                <div style={{ opacity: 0.8 }}>Není co odblokovat ani uzavírat.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {openItems.map((row) => (
                    <div
                      key={row.poskozeni_id}
                      style={{
                        border: "1px solid #30466d",
                        borderRadius: 10,
                        padding: 12,
                        background: "#0b1d3d",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, marginBottom: 6 }}>
                            {toNumber(row.pocet_kusu)} {item?.jednotka ?? "ks"} —{" "}
                            {formatTypPoskozeniLabel(row.typ_poskozeni)}
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.8 }}>
                            {row.popis?.trim() ? row.popis : "Bez popisu"}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {row.blokuje_pouziti ? (
                            <button
                              type="button"
                              onClick={() => void onUnblockDamage(row.poskozeni_id)}
                              disabled={damageSaving}
                              className="rounded-xl border border-amber-700 bg-amber-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
                            >
                              Odblokovat
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void onCloseDamage(row.poskozeni_id)}
                            disabled={damageSaving}
                            className="rounded-xl border border-green-700 bg-green-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
                          >
                            Uzavřít
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#0b1d3d",
  border: "1px solid #30466d",
  borderRadius: 8,
  color: "#fff",
};

const statBoxStyle: React.CSSProperties = {
  padding: 12,
  border: "1px solid #30466d",
  borderRadius: 10,
  background: "#0b1d3d",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
  marginBottom: 6,
  textTransform: "uppercase",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
};