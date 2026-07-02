import type { User } from "@supabase/supabase-js";

export const CLIENT_EMAIL_NOT_VERIFIED = "CLIENT_EMAIL_NOT_VERIFIED";

/** Minimální interval mezi resend požadavky (60 s). */
export const CLIENT_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS = 60_000;

export type ClientEmailVerificationUser = Pick<User, "email" | "email_confirmed_at">;

/** Zdroj pravdy: Supabase Auth `email_confirmed_at`. */
export function isClientEmailVerified(
  user: ClientEmailVerificationUser | null | undefined
): boolean {
  return Boolean(user?.email_confirmed_at);
}

export function getClientEmailVerifiedAt(
  user: ClientEmailVerificationUser | null | undefined
): string | null {
  return user?.email_confirmed_at ?? null;
}

export function isEmailNotConfirmedAuthError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email address is not confirmed")
  );
}

export function isEmailConfirmationResendAllowed(
  lastSentAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!lastSentAt) return true;
  const lastMs = new Date(lastSentAt).getTime();
  if (Number.isNaN(lastMs)) return true;
  return nowMs - lastMs >= CLIENT_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS;
}

export function secondsUntilEmailConfirmationResend(
  lastSentAt: string | null | undefined,
  nowMs = Date.now()
): number {
  if (!lastSentAt) return 0;
  const lastMs = new Date(lastSentAt).getTime();
  if (Number.isNaN(lastMs)) return 0;
  const remaining = CLIENT_EMAIL_CONFIRMATION_RESEND_COOLDOWN_MS - (nowMs - lastMs);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/** Cesty portálu vyžadující ověřený e-mail (požadavek #5). */
export const PORTAL_PATHS_REQUIRING_VERIFIED_EMAIL = [
  "/portal/poptavka/nova",
  "/portal/poptavky",
  "/portal/zakazky",
  "/portal/presety",
  "/portal/profil",
] as const;

export function isPortalPathRequiringVerifiedEmail(pathname: string): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  return PORTAL_PATHS_REQUIRING_VERIFIED_EMAIL.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function shouldTreatClientAsEmailUnverified(
  account: { stav: string; klient_id: string | null },
  user: ClientEmailVerificationUser | null | undefined
): boolean {
  return (
    account.stav === "active" &&
    Boolean(account.klient_id) &&
    Boolean(user) &&
    !isClientEmailVerified(user)
  );
}

export const CLIENT_EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Nejdříve potvrďte e-mailovou adresu.";

/** Parametry pro Supabase Admin createUser při registraci klienta. */
export function portalAuthUserCreateParams(email: string, password: string) {
  return {
    email,
    password,
    email_confirm: false,
  } as const;
}
