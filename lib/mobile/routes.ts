export const MOBILE_HOME_PATH = "/mobile";
export const MOBILE_SCAN_PICKER_PATH = "/mobile/scan";

export type MobileZakazkaWorkflowTab = "detail" | "scan" | "dochazka";

export const MOBILE_NAV_ITEMS = [
  {
    id: "zakazky",
    label: "Zakázky",
    href: "/moje",
    match: (pathname: string) =>
      pathname === "/moje" ||
      pathname.startsWith("/moje/") ||
      pathname === MOBILE_HOME_PATH,
  },
  {
    id: "scan",
    label: "Scan",
    href: MOBILE_SCAN_PICKER_PATH,
    match: (pathname: string) =>
      pathname === MOBILE_SCAN_PICKER_PATH ||
      pathname === "/sklad/scan" ||
      pathname.endsWith("/scan") ||
      pathname.endsWith("/nakladka"),
  },
  {
    id: "dochazka",
    label: "Docházka",
    href: "/dochazka",
    match: (pathname: string) => pathname === "/dochazka" || pathname.startsWith("/dochazka/"),
  },
  {
    id: "upozorneni",
    label: "Upozornění",
    href: "/notifikace",
    match: (pathname: string) =>
      pathname === "/notifikace" || pathname.startsWith("/notifikace/"),
  },
  {
    id: "profil",
    label: "Profil",
    href: "/mobile/profil",
    match: (pathname: string) =>
      pathname === "/mobile/profil" || pathname.startsWith("/mobile/profil/"),
  },
] as const;

const ZAKAZKA_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isZakazkaId(value: string | null | undefined): value is string {
  return Boolean(value && ZAKAZKA_ID_PATTERN.test(value));
}

export function getZakazkaIdFromPathname(pathname: string): string | null {
  const mojeMatch = pathname.match(/^\/moje\/zakazky\/([^/]+)/);
  if (mojeMatch && isZakazkaId(mojeMatch[1])) return mojeMatch[1];

  const zakazkaMatch = pathname.match(/^\/zakazky\/([^/]+)/);
  if (zakazkaMatch && isZakazkaId(zakazkaMatch[1])) return zakazkaMatch[1];

  return null;
}

export function getMobileScanNavHref(
  pathname: string,
  activeZakazkaId?: string | null
): string {
  const fromPath = getZakazkaIdFromPathname(pathname);
  if (fromPath) return getZakazkaScanPath(fromPath);
  if (isZakazkaId(activeZakazkaId)) return getZakazkaScanPath(activeZakazkaId);
  return MOBILE_SCAN_PICKER_PATH;
}

export function getMobileDochazkaNavHref(
  pathname: string,
  activeZakazkaId?: string | null,
  queryZakazkaId?: string | null
): string {
  const contextual = getWorkflowZakazkaId(pathname, queryZakazkaId);
  if (contextual) return getDochazkaPath(contextual);
  if (isZakazkaId(activeZakazkaId)) return getDochazkaPath(activeZakazkaId);
  return "/dochazka";
}

export function getWorkflowZakazkaId(
  pathname: string,
  dochazkaZakazkaId?: string | null
): string | null {
  const fromPath = getZakazkaIdFromPathname(pathname);
  if (fromPath) return fromPath;
  if (pathname === "/dochazka" && isZakazkaId(dochazkaZakazkaId)) return dochazkaZakazkaId;
  return null;
}

export function getActiveMobileZakazkaTab(
  pathname: string,
  zakazkaId: string | null
): MobileZakazkaWorkflowTab | null {
  if (!zakazkaId) return null;

  if (pathname === `/moje/zakazky/${zakazkaId}` || pathname.startsWith(`/moje/zakazky/${zakazkaId}/`)) {
    return "detail";
  }

  if (
    pathname === `/zakazky/${zakazkaId}/scan` ||
    pathname === `/zakazky/${zakazkaId}/nakladka` ||
    pathname.startsWith(`/zakazky/${zakazkaId}/scan/`)
  ) {
    return "scan";
  }

  if (pathname === "/dochazka") {
    return "dochazka";
  }

  return null;
}

export function shouldShowMobileZakazkaWorkflowBar(
  pathname: string,
  zakazkaId: string | null,
  activeTab: MobileZakazkaWorkflowTab | null
) {
  if (!zakazkaId || !activeTab) return false;
  if (pathname === MOBILE_SCAN_PICKER_PATH) return false;
  return true;
}

export function getMojeZakazkaDetailPath(zakazkaId: string) {
  return `/moje/zakazky/${zakazkaId}`;
}

export function getZakazkaScanPath(zakazkaId: string) {
  return `/zakazky/${zakazkaId}/scan`;
}

export function getDochazkaPath(zakazkaId?: string | null) {
  if (zakazkaId) return `/dochazka?zakazka=${encodeURIComponent(zakazkaId)}`;
  return "/dochazka";
}

export function shouldHideAppChrome(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/dotaznik/") ||
    pathname.startsWith("/schvaleni/") ||
    pathname.startsWith("/faktura-render/")
  );
}
