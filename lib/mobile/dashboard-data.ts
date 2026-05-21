import type { SupabaseClient } from "@supabase/supabase-js";

export type MobileZakazkaCard = {
  zakazkaId: string;
  cislo: string;
  nazev: string;
  misto: string | null;
  whenLabel: string;
  isToday: boolean;
};

type AssignmentRow = {
  zakazka_id: string;
  datum_od: string | null;
  datum_do: string | null;
  confirmation_status: string | null;
};

type ZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  misto: string | null;
  akce_od: string | null;
  akce_do: string | null;
  datum_od: string | null;
  datum_do: string | null;
  zrusena: boolean | null;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function resolveEventStart(zakazka: ZakazkaRow) {
  const candidates = [zakazka.akce_od, zakazka.datum_od].filter(Boolean) as string[];
  for (const value of candidates) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function formatWhenLabel(date: Date | null) {
  if (!date) return "Termín neuveden";
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const tomorrowEnd = endOfDay(tomorrowStart);

  if (date >= todayStart && date <= todayEnd) {
    return `Dnes ${date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (date >= tomorrowStart && date <= tomorrowEnd) {
    return `Zítra ${date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleString("cs-CZ", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isAcceptedStatus(status: string | null) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "accepted" || normalized === "potvrzeno" || normalized === "";
}

export async function loadMobileDashboardCards(
  supabase: SupabaseClient,
  userId: string
): Promise<MobileZakazkaCard[]> {
  const { data: assignmentsRaw, error: assignmentsError } = await supabase
    .from("zakazka_lide")
    .select("zakazka_id, datum_od, datum_do, confirmation_status")
    .eq("user_id", userId)
    .order("datum_od", { ascending: true, nullsFirst: false });

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const assignments = ((assignmentsRaw ?? []) as AssignmentRow[]).filter((row) =>
    isAcceptedStatus(row.confirmation_status)
  );

  const zakazkaIds = [...new Set(assignments.map((row) => row.zakazka_id).filter(Boolean))];
  if (zakazkaIds.length === 0) return [];

  const { data: zakazkyRaw, error: zakazkyError } = await supabase
    .from("zakazky")
    .select(
      "zakazka_id, cislo_zakazky, nazev, misto, akce_od, akce_do, datum_od, datum_do, zrusena"
    )
    .in("zakazka_id", zakazkaIds);

  if (zakazkyError) {
    throw new Error(zakazkyError.message);
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const horizon = new Date(todayStart);
  horizon.setDate(horizon.getDate() + 14);

  const cards = ((zakazkyRaw ?? []) as ZakazkaRow[])
    .filter((zakazka) => zakazka.zrusena !== true)
    .map((zakazka) => {
      const start = resolveEventStart(zakazka);
      return {
        zakazka,
        start,
        isToday: Boolean(start && start >= todayStart && start <= todayEnd),
      };
    })
    .filter((item) => {
      if (!item.start) return true;
      return item.start <= horizon;
    })
    .sort((a, b) => {
      if (!a.start && !b.start) return 0;
      if (!a.start) return 1;
      if (!b.start) return -1;
      return a.start.getTime() - b.start.getTime();
    })
    .slice(0, 8)
    .map(({ zakazka, start, isToday }) => ({
      zakazkaId: zakazka.zakazka_id,
      cislo: zakazka.cislo_zakazky?.trim() || "—",
      nazev: zakazka.nazev?.trim() || "Bez názvu",
      misto: zakazka.misto?.trim() || null,
      whenLabel: formatWhenLabel(start),
      isToday,
    }));

  return cards;
}
