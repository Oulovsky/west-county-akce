/** Veřejné marketingové a klientské vstupní cesty (bez interního auth). */
export function isPublicMarketingPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/portal" || pathname.startsWith("/portal/");
}

export function isPublicAppPath(pathname: string): boolean {
  if (isPublicMarketingPath(pathname)) return true;
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/dotaznik/")) return true;
  if (pathname.startsWith("/schvaleni/")) return true;
  if (pathname.startsWith("/faktura-render/")) return true;
  return false;
}

export function shouldHideAppChrome(pathname: string): boolean {
  return isPublicAppPath(pathname);
}
