export type VehicleType = "firemni" | "soukrome";
export type TransportType = "firemni_auto" | "soukrome_auto" | "pouze_presun_cloveka";
export type TravelReimbursementStatus =
  | "ceka_na_schvaleni"
  | "schvaleno"
  | "zamitnuto"
  | "proplaceno";

export const DEFAULT_KM_RATE = 7;

export function normalizeVehicleType(value?: string | null): VehicleType {
  return value === "soukrome" ? "soukrome" : "firemni";
}

export function getVehicleTypeLabel(value?: string | null) {
  return normalizeVehicleType(value) === "soukrome" ? "Soukromé" : "Firemní";
}

export function normalizeTransportType(value?: string | null): TransportType {
  if (value === "soukrome_auto" || value === "pouze_presun_cloveka") return value;
  return "firemni_auto";
}

export function getTransportTypeLabel(value?: string | null) {
  const normalized = normalizeTransportType(value);
  if (normalized === "soukrome_auto") return "Soukromé auto";
  if (normalized === "pouze_presun_cloveka") return "Pouze přesun člověka";
  return "Firemní auto";
}

export function normalizeTravelStatus(value?: string | null): TravelReimbursementStatus {
  if (value === "schvaleno" || value === "zamitnuto" || value === "proplaceno") return value;
  return "ceka_na_schvaleni";
}

export function getTravelStatusLabel(value?: string | null) {
  const normalized = normalizeTravelStatus(value);
  if (normalized === "schvaleno") return "Schváleno";
  if (normalized === "zamitnuto") return "Zamítnuto";
  if (normalized === "proplaceno") return "Proplaceno";
  return "Čeká na schválení";
}

/** Popisky stavu pro zaměstnance na /moje (oddělené od admin štítků). */
export function getEmployeeTravelStatusLabel(value?: string | null) {
  const normalized = normalizeTravelStatus(value);
  if (normalized === "schvaleno") return "Schváleno k proplacení";
  if (normalized === "zamitnuto") return "Zamítnuto";
  if (normalized === "proplaceno") return "Proplaceno";
  return "Čeká na schválení";
}

export function getTravelStatusBadgeVariant(
  value?: string | null
): "success" | "danger" | "warning" | "default" {
  const normalized = normalizeTravelStatus(value);
  if (normalized === "proplaceno") return "success";
  if (normalized === "zamitnuto") return "danger";
  if (normalized === "schvaleno") return "warning";
  return "default";
}

export function getTravelRowAmount(
  row: { km: number | string; sazba_za_km: number | string; castka?: number | string | null }
) {
  return Number(row.castka ?? getTravelAmount(row.km, row.sazba_za_km));
}

export function getTravelAmount(km: number | string | null | undefined, rate: number | string | null | undefined) {
  const parsedKm = Number(km ?? 0);
  const parsedRate = Number(rate ?? 0);
  if (!Number.isFinite(parsedKm) || !Number.isFinite(parsedRate)) return 0;
  return Math.max(0, parsedKm) * Math.max(0, parsedRate);
}

export function formatKm(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return `${new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 1 }).format(
    Number.isFinite(parsed) ? parsed : 0
  )} km`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("cs-CZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
