/** URL pro Supabase signup confirmation redirectTo (klientský portál). */
export function buildClientEmailConfirmationRedirectUrl(baseUrl?: string): string {
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!base) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
  }

  // Supabase vrací tokeny v URL hash fragmentu (#access_token=...), který server
  // nevidí. Míříme proto na klientskou potvrzovací stránku, která hash zpracuje.
  return `${base}/portal/potvrzeni-emailu`;
}
