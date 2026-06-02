import { isReadOnlyInternalRole } from "@/lib/roles";

export const INTERNAL_WRITE_FORBIDDEN_MESSAGE =
  "Nemáte dostatečná práva pro tuto akci.";

export const READ_ONLY_INTERNAL_REDIRECT = "/zakazky";

/** HDT smí načíst pouze read-only podstránky adminu (ne celý /admin). */
export function isAdminPathAllowedForReadOnlyInternalRole(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return path === "/admin/klienti" || path.startsWith("/admin/klienti/");
}

export function isPathForbiddenForReadOnlyInternalRole(pathname: string): boolean {
  const path = pathname.split("?")[0];

  if (path === "/" || path === "/dashboard") return true;
  if (path === "/moje" || path.startsWith("/moje/")) return true;
  if (path === "/mobile" || path.startsWith("/mobile/")) return true;
  if (path === "/dochazka" || path.startsWith("/dochazka/")) return true;
  if (path === "/zakazky/nova") return true;
  if (/^\/zakazky\/[^/]+\/edit(\/|$)/.test(path)) return true;
  if (/^\/zakazky\/[^/]+\/(scan|nakladka)(\/|$)/.test(path)) return true;
  if (/^\/zakazky\/[^/]+\/poskozeni(\/|$)/.test(path)) return true;
  if (/^\/zakazky\/[^/]+\/people(\/|$)/.test(path)) return true;
  if (path === "/sklad/scan" || path.startsWith("/sklad/scan/")) return true;
  if (path.startsWith("/sklad/konfigurace")) return true;
  if (path === "/sklad/poskozeni" || path.startsWith("/sklad/poskozeni/")) return true;
  if (path === "/sklad/servis" || path.startsWith("/sklad/servis/")) return true;

  if (path.startsWith("/admin")) {
    return !isAdminPathAllowedForReadOnlyInternalRole(path);
  }

  return false;
}

export type InternalNavVisibility = {
  readOnly: boolean;
  showMoje: boolean;
  showDashboard: boolean;
  showKalendar: boolean;
  showZakazky: boolean;
  showPoptavkyInbox: boolean;
  showKlienti: boolean;
  showMista: boolean;
  showSkladSprava: boolean;
  showSkladSetupy: boolean;
  showNotifikace: boolean;
  canCreateZakazka: boolean;
};

export function getInternalNavVisibility(role: string | null | undefined): InternalNavVisibility {
  const readOnly = isReadOnlyInternalRole(role);
  const isAdminOrSef = role === "admin" || role === "sef";

  return {
    readOnly,
    showMoje: !readOnly,
    showDashboard: !readOnly,
    showKalendar: true,
    showZakazky: true,
    showPoptavkyInbox: isAdminOrSef || readOnly,
    showKlienti: isAdminOrSef || readOnly,
    showMista: true,
    showSkladSprava: true,
    showSkladSetupy: true,
    showNotifikace: !readOnly,
    canCreateZakazka: !readOnly,
  };
}
