/** Veřejný marketingový web. */
export function isPublicLandingPath(pathname: string): boolean {
  return pathname === "/";
}

/** Portál: přihlášení / registrace / obnova hesla bez aktivní klientské session. */
export function isPublicPortalAuthPath(pathname: string): boolean {
  return (
    pathname === "/portal/prihlaseni" ||
    pathname === "/portal/registrace" ||
    pathname === "/portal/zapomenute-heslo" ||
    pathname === "/portal/nove-heslo"
  );
}

/** Portál: dashboard / — veřejný, stav řeší stránka. */
export function isPublicPortalHomePath(pathname: string): boolean {
  return pathname === "/portal";
}

export function isProtectedPortalPath(pathname: string): boolean {
  return pathname.startsWith("/portal/") && !isPublicPortalAuthPath(pathname);
}

export function isPublicMarketingPath(pathname: string): boolean {
  return (
    isPublicLandingPath(pathname) ||
    isPublicPortalHomePath(pathname) ||
    isPublicPortalAuthPath(pathname)
  );
}

export function isPublicAppPath(pathname: string): boolean {
  if (isPublicMarketingPath(pathname)) return true;
  if (isProtectedPortalPath(pathname)) return true;
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/dotaznik/")) return true;
  if (pathname.startsWith("/schvaleni/")) return true;
  if (pathname.startsWith("/poptavka-objednavka/")) return true;
  if (pathname.startsWith("/faktura-render/")) return true;
  return false;
}

export function shouldHideAppChrome(pathname: string): boolean {
  return (
    isPublicAppPath(pathname) ||
    pathname.startsWith("/portal/")
  );
}
