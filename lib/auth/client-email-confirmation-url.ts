/** URL pro Supabase signup confirmation redirectTo (klientský portál). */
export function buildClientEmailConfirmationRedirectUrl(baseUrl?: string): string {
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!base) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
  }

  return `${base}/auth/callback?next=${encodeURIComponent("/portal/potvrzeni-emailu?verified=1")}`;
}
