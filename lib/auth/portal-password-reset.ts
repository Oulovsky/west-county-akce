/** URL pro Supabase resetPasswordForEmail redirectTo (klientský portál). */
export function buildPortalPasswordResetRedirectUrl(baseUrl?: string): string {
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (!base) {
    throw new Error("Missing NEXT_PUBLIC_APP_URL");
  }

  return `${base}/portal/nove-heslo`;
}
