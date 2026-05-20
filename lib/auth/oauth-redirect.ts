/** Cílová cesta po přihlášení (bez OAuth query parametrů). */
export function getSafeNextPath(value: string | null | undefined): string {
  if (!value) return "/zakazky";

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/zakazky";

  if (trimmed.includes("code=")) return "/zakazky";

  const pathOnly = trimmed.split("?")[0] || "/zakazky";
  if (!pathOnly.startsWith("/") || pathOnly.startsWith("//")) return "/zakazky";
  if (pathOnly === "/") return "/zakazky";

  return pathOnly;
}

export function getAppBaseUrlClient(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin.replace(/\/+$/, "");
  return "";
}

export function getAppBaseUrlFromRequest(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  return new URL(request.url).origin.replace(/\/+$/, "");
}

/**
 * Supabase OAuth redirectTo — vždy /auth/callback, nikdy kořen aplikace.
 */
export function buildOAuthCallbackRedirectUrl(
  nextPath: string,
  baseUrl?: string
): string {
  const base = (baseUrl ?? getAppBaseUrlClient()).replace(/\/+$/, "");
  if (!base) {
    throw new Error("Missing app base URL for OAuth callback");
  }

  const next = getSafeNextPath(nextPath);
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}
