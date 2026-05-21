import { isZakazkaId } from "@/lib/mobile/routes";

export const LAST_ACTIVE_ZAKAZKA_STORAGE_KEY = "wc_mobile_active_zakazka";

export type ActiveZakazkaContext = {
  zakazkaId: string;
  cislo?: string | null;
  nazev?: string | null;
};

export function saveActiveZakazka(context: ActiveZakazkaContext) {
  if (typeof window === "undefined" || !isZakazkaId(context.zakazkaId)) return;
  sessionStorage.setItem(LAST_ACTIVE_ZAKAZKA_STORAGE_KEY, JSON.stringify(context));
}

export function readActiveZakazka(): ActiveZakazkaContext | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(LAST_ACTIVE_ZAKAZKA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveZakazkaContext;
    if (!isZakazkaId(parsed?.zakazkaId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveZakazka() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LAST_ACTIVE_ZAKAZKA_STORAGE_KEY);
}
