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

export function getApprovedMinutes(row: {
  approved_duration_minutes?: number | string | null;
  checkin_at?: string | null;
  checkout_at?: string | null;
}) {
  const approved = Number(row.approved_duration_minutes ?? NaN);
  if (Number.isFinite(approved) && approved >= 0) return Math.round(approved);
  return getMeasuredMinutes(row.checkin_at, row.checkout_at);
}

export function getPaymentAmount(minutes: number, hourlyRate: number) {
  if (!Number.isFinite(minutes) || !Number.isFinite(hourlyRate)) return 0;
  return Math.round((Math.max(0, minutes) / 60) * Math.max(0, hourlyRate));
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
