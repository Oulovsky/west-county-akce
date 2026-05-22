import { getAttendanceMinutes } from "@/lib/zakazka-attendance";

export type PaymentStatus = "ceka_na_proplaceni" | "proplaceno";

export function normalizePaymentStatus(value?: string | null): PaymentStatus {
  return value === "proplaceno" ? "proplaceno" : "ceka_na_proplaceni";
}

export function getPaymentStatusLabel(value?: string | null) {
  return normalizePaymentStatus(value) === "proplaceno" ? "Proplaceno" : "Čeká na proplacení";
}

export function getMeasuredMinutes(checkinAt?: string | null, checkoutAt?: string | null) {
  return getAttendanceMinutes(checkinAt, checkoutAt);
}

export function getClaimedMinutes(row: {
  claimed_duration_minutes?: number | string | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
}) {
  const claimed = Number(row.claimed_duration_minutes ?? NaN);
  if (Number.isFinite(claimed) && claimed >= 0) return Math.round(claimed);
  return getMeasuredMinutes(row.checkin_at, row.checkout_at);
}

export function getApprovedMinutes(row: {
  approved_duration_minutes?: number | string | null;
  claimed_duration_minutes?: number | string | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
}) {
  const approved = Number(row.approved_duration_minutes ?? NaN);
  if (Number.isFinite(approved) && approved >= 0) return Math.round(approved);
  return getClaimedMinutes(row);
}

export function getPaymentAmount(minutes: number, hourlyRate: number) {
  if (!Number.isFinite(minutes) || !Number.isFinite(hourlyRate)) return 0;
  return Math.round((Math.max(0, minutes) / 60) * Math.max(0, hourlyRate));
}

export function getWorkClaimedAmount(row: {
  claimed_amount_czk?: number | string | null;
  claimed_duration_minutes?: number | string | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
  hourlyRate?: number | string | null;
}) {
  const stored = Number(row.claimed_amount_czk ?? NaN);
  if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);
  return getPaymentAmount(getClaimedMinutes(row), Number(row.hourlyRate ?? 0));
}

export function getWorkApprovedAmount(row: {
  approved_amount_czk?: number | string | null;
  approved_duration_minutes?: number | string | null;
  claimed_duration_minutes?: number | string | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
  hourlyRate?: number | string | null;
}) {
  const stored = Number(row.approved_amount_czk ?? NaN);
  if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);
  return getPaymentAmount(getApprovedMinutes(row), Number(row.hourlyRate ?? 0));
}

export function defaultApprovedAmountFromMinutes(minutes: number, hourlyRate: number) {
  return getPaymentAmount(minutes, hourlyRate);
}

export function formatMoneyCzk(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatHours(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
