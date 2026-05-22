export type VehicleType = "firemni" | "soukrome";
export type TransportType = "firemni_auto" | "soukrome_auto" | "pouze_presun_cloveka";
export type TravelDopravaRezim = "firemni_auto" | "soukrome_auto" | "spolujizda" | "bez_nahrady";
export type AttendanceDopravaRezim = "firemni" | "soukrome" | "spolujizda" | "bez_nahrady";
/** @deprecated Legacy combined status on cestovni_nahrady.status */
export type TravelReimbursementStatus =
  | "ceka_na_schvaleni"
  | "schvaleno"
  | "zamitneto"
  | "proplaceno";

export const DEFAULT_KM_RATE = 7;

export function normalizeTravelDopravaRezim(value?: string | null): TravelDopravaRezim {
  if (value === "firemni_auto" || value === "spolujizda" || value === "bez_nahrady") return value;
  return "soukrome_auto";
}

export function getTravelDopravaRezimLabel(value?: string | null) {
  const mode = normalizeTravelDopravaRezim(value);
  if (mode === "firemni_auto") return "Firemní vozidlo";
  if (mode === "spolujizda") return "Spolujízda";
  if (mode === "bez_nahrady") return "Bez náhrady";
  return "Soukromé vozidlo";
}

export function getAttendanceDopravaRezimLabel(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (raw === "firemni") return "Firemní vozidlo";
  if (raw === "spolujizda") return "Spolujízda";
  if (raw === "bez_nahrady") return "Bez náhrady";
  if (raw === "soukrome") return "Soukromé vozidlo";
  return "—";
}

export function calcFuelClaimAmount(
  km: number | string | null | undefined,
  spotreba: number | string | null | undefined,
  cenaPaliva: number | string | null | undefined
) {
  const parsedKm = Number(km ?? 0);
  const parsedSpotreba = Number(spotreba ?? 0);
  const parsedCena = Number(cenaPaliva ?? 0);
  if (!Number.isFinite(parsedKm) || !Number.isFinite(parsedSpotreba) || !Number.isFinite(parsedCena)) {
    return 0;
  }
  return Math.round((Math.max(0, parsedKm) / 100) * Math.max(0, parsedSpotreba) * Math.max(0, parsedCena));
}

export function getTravelClaimedKm(row: { claimed_km?: number | string | null; km?: number | string | null }) {
  const claimed = Number(row.claimed_km ?? NaN);
  if (Number.isFinite(claimed) && claimed >= 0) return claimed;
  return Number(row.km ?? 0);
}

export function getTravelClaimedAmount(row: {
  doprava_rezim?: string | null;
  claimed_amount_czk?: number | string | null;
  claimed_km?: number | string | null;
  km?: number | string | null;
  sazba_za_km?: number | string | null;
  spotreba_l_100km?: number | string | null;
  cena_paliva_kc_l?: number | string | null;
}) {
  const stored = Number(row.claimed_amount_czk ?? NaN);
  if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);

  const mode = normalizeTravelDopravaRezim(row.doprava_rezim);
  if (mode === "firemni_auto" || mode === "spolujizda" || mode === "bez_nahrady") return 0;

  const km = getTravelClaimedKm(row);
  const fuel = calcFuelClaimAmount(km, row.spotreba_l_100km, row.cena_paliva_kc_l);
  if (fuel > 0) return fuel;
  return Math.round(getTravelAmount(km, row.sazba_za_km));
}

export function getTravelApprovedAmount(row: {
  approved_amount_czk?: number | string | null;
  approved_km?: number | string | null;
  claimed_amount_czk?: number | string | null;
  claimed_km?: number | string | null;
  km?: number | string | null;
  sazba_za_km?: number | string | null;
  doprava_rezim?: string | null;
  spotreba_l_100km?: number | string | null;
  cena_paliva_kc_l?: number | string | null;
}) {
  const stored = Number(row.approved_amount_czk ?? NaN);
  if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);
  return getTravelClaimedAmount(row);
}

export function getTravelApprovedKm(row: {
  approved_km?: number | string | null;
  claimed_km?: number | string | null;
  km?: number | string | null;
}) {
  const approved = Number(row.approved_km ?? NaN);
  if (Number.isFinite(approved) && approved >= 0) return approved;
  return getTravelClaimedKm(row);
}

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
  if (value === "schvaleno" || value === "proplaceno") return value;
  if (value === "zamitneto" || value === "zamitnuto") return "zamitneto";
  return "ceka_na_schvaleni";
}

export function getTravelStatusLabel(value?: string | null) {
  const normalized = normalizeTravelStatus(value);
  if (normalized === "schvaleno") return "Schváleno";
  if (normalized === "zamitneto") return "Zamítnuto";
  if (normalized === "proplaceno") return "Proplaceno";
  return "Čeká na schválení";
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
