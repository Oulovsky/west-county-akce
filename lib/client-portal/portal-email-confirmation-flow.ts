export type ConfirmationLinkType = "signup" | "magiclink";

export type ResendConfirmationCode =
  | "user_not_found"
  | "already_confirmed"
  | "cooldown"
  | "env_missing"
  | "generate_link_failed"
  | "missing_resend_key"
  | "missing_from"
  | "send_failed";

/**
 * První registrační e-mail má heslo → generateLink typu signup.
 * Resend nemá heslo → magiclink (potvrdí e-mail bez znalosti hesla).
 */
export function resolveConfirmationLinkType(hasPassword: boolean): ConfirmationLinkType {
  return hasPassword ? "signup" : "magiclink";
}

export type SendResendLikeResult =
  | { ok: true; sent: true }
  | {
      ok: true;
      sent: false;
      skipped: true;
      skipReason: "missing_api_key" | "missing_from" | "missing_recipient";
    }
  | { ok: false; sent: false; error: string };

/** Převod výsledku sendResendEmailSafe na granularní confirmation kód. */
export function mapSendResendResultToConfirmation(
  result: SendResendLikeResult
): { ok: true } | { ok: false; code: ResendConfirmationCode } {
  if (result.ok && result.sent) {
    return { ok: true };
  }

  if (result.ok && !result.sent) {
    if (result.skipReason === "missing_api_key") {
      return { ok: false, code: "missing_resend_key" };
    }
    if (result.skipReason === "missing_from") {
      return { ok: false, code: "missing_from" };
    }
    return { ok: false, code: "send_failed" };
  }

  return { ok: false, code: "send_failed" };
}

/** Rozhodne, zda vůbec resend odeslat (guardy před voláním Supabase/Resend). */
export function planResendConfirmation(input: {
  userExists: boolean;
  emailConfirmed: boolean;
  secondsUntilResend: number;
}): { ok: true } | { ok: false; code: ResendConfirmationCode; waitSeconds?: number } {
  if (!input.userExists) {
    return { ok: false, code: "user_not_found" };
  }
  if (input.emailConfirmed) {
    return { ok: false, code: "already_confirmed" };
  }
  if (input.secondsUntilResend > 0) {
    return { ok: false, code: "cooldown", waitSeconds: input.secondsUntilResend };
  }
  return { ok: true };
}

/**
 * Klíčová garance: status=resent smí vzniknout jen při skutečném úspěchu.
 * Jakékoli selhání se mapuje na konkrétní error kód, nikdy na "resent".
 */
export function resendResultToRedirectStatus(
  result: { ok: true } | { ok: false; code: ResendConfirmationCode }
): { status: "resent" } | { error: ResendConfirmationCode } {
  if (result.ok) {
    return { status: "resent" };
  }
  return { error: result.code };
}
