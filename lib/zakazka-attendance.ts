export type AttendancePhase = "nakladka" | "stavba" | "provoz" | "bourani" | "preprava";

export type TransportVehicleMode = "firemni" | "vlastni";

export type AttendanceGpsInput = {
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
};

export function isPrepravaTypBloku(value?: string | null) {
  return String(value ?? "").trim().toLowerCase() === "preprava";
}

export function normalizeTransportVehicleMode(value?: string | null): TransportVehicleMode | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "firemni" || raw === "firemni_auto") return "firemni";
  if (raw === "vlastni" || raw === "soukrome" || raw === "soukrome_auto") return "vlastni";
  return null;
}

export function normalizeAttendancePhase(value?: string | null): AttendancePhase {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "preprava" || raw === "prejezd" || raw === "přejezd") return "preprava";
  if (raw === "sklad" || raw === "nakladka" || raw === "nakládka") return "nakladka";
  if (raw === "stavba") return "stavba";
  if (raw === "bourani" || raw === "bourání") return "bourani";
  return "provoz";
}

export function getAttendancePhaseLabel(value?: string | null) {
  const phase = normalizeAttendancePhase(value);
  if (phase === "nakladka") return "Nakládka";
  if (phase === "stavba") return "Stavba";
  if (phase === "bourani") return "Bourání";
  if (phase === "preprava") return "Přeprava";
  return "Provoz";
}

export function getAttendanceMinutes(checkinAt?: string | null, checkoutAt?: string | null) {
  if (!checkinAt || !checkoutAt) return 0;
  const start = new Date(checkinAt).getTime();
  const end = new Date(checkoutAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function getPlannedMinutes(from?: string | null, to?: string | null) {
  return getAttendanceMinutes(from, to);
}

export function formatAttendanceDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function normalizeGpsNumber(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
