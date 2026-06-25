const INTERNAL_ROOT_PREFIXES = [
  "/zakazky",
  "/sklad",
  "/admin",
  "/mobile",
  "/dochazka",
  "/kalendar",
  "/mista",
  "/templates",
  "/setupy",
  "/dashboard",
  "/notifikace",
  "/moje",
] as const;

/** Interní app routy mimo klientský portál a veřejné tokeny. */
export function isInternalProtectedPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname === "/login") return false;
  if (pathname.startsWith("/portal")) return false;
  if (pathname.startsWith("/auth/")) return false;
  if (pathname.startsWith("/dotaznik/")) return false;
  if (pathname.startsWith("/schvaleni/")) return false;
  if (pathname.startsWith("/poptavka-objednavka/")) return false;
  if (pathname.startsWith("/faktura-render/")) return false;

  return INTERNAL_ROOT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
