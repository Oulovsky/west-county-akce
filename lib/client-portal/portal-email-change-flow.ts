import type { ResendConfirmationCode } from "@/lib/client-portal/portal-email-confirmation-flow";
import {
  isProvisionedInternalProfile,
  type InternalProfileForAccess,
} from "@/lib/auth/internal-access-rules";

export type UnverifiedEmailChangeCode =
  | "missing_fields"
  | "invalid_email"
  | "same_email"
  | "user_not_found"
  | "wrong_password"
  | "already_confirmed"
  | "internal_user_forbidden"
  | "not_client_account"
  | "email_exists"
  | "auth_update_failed"
  | ResendConfirmationCode;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPortalEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function validateUnverifiedEmailChangeInput(input: {
  currentEmail: string;
  newEmail: string;
  password: string;
}):
  | { ok: true; currentEmail: string; newEmail: string }
  | { ok: false; code: UnverifiedEmailChangeCode } {
  const currentEmail = input.currentEmail.trim().toLowerCase();
  const newEmail = input.newEmail.trim().toLowerCase();
  const password = input.password;

  if (!currentEmail || !newEmail || !password) {
    return { ok: false, code: "missing_fields" };
  }

  if (!isValidPortalEmail(newEmail)) {
    return { ok: false, code: "invalid_email" };
  }

  if (newEmail === currentEmail) {
    return { ok: false, code: "same_email" };
  }

  return { ok: true, currentEmail, newEmail };
}

/** Aktualizovat klienti.email jen pokud odpovídá původnímu auth e-mailu registranta. */
export function shouldUpdateKlientContactEmail(input: {
  klientEmail: string | null | undefined;
  currentAuthEmail: string;
}): boolean {
  const klientEmail = (input.klientEmail ?? "").trim().toLowerCase();
  const currentAuthEmail = input.currentAuthEmail.trim().toLowerCase();
  return Boolean(klientEmail) && klientEmail === currentAuthEmail;
}

export type UnverifiedEmailChangePlanInput = {
  userExists: boolean;
  emailConfirmed: boolean;
  passwordVerified: boolean;
  hasActiveClientAccount: boolean;
  profile: InternalProfileForAccess | null;
};

/** Guardy před změnou e-mailu — čistá logika pro testy i server. */
export function planUnverifiedEmailChange(
  input: UnverifiedEmailChangePlanInput
): { ok: true } | { ok: false; code: UnverifiedEmailChangeCode } {
  if (!input.userExists) {
    return { ok: false, code: "user_not_found" };
  }

  if (input.emailConfirmed) {
    return { ok: false, code: "already_confirmed" };
  }

  if (!input.passwordVerified) {
    return { ok: false, code: "wrong_password" };
  }

  if (isProvisionedInternalProfile(input.profile)) {
    return { ok: false, code: "internal_user_forbidden" };
  }

  if (!input.hasActiveClientAccount) {
    return { ok: false, code: "not_client_account" };
  }

  return { ok: true };
}

/** Co se má aktualizovat — explicitně bez profiles a bez jiných client_accounts. */
export type UnverifiedEmailChangeTargets = {
  userId: string;
  accountId: string;
  klientId: string;
  updateKlientEmail: boolean;
  updatePoptavkyKontakt: boolean;
};

export function buildUnverifiedEmailChangeTargets(input: {
  userId: string;
  accountId: string;
  klientId: string;
  klientEmail: string | null | undefined;
  currentAuthEmail: string;
  hasPoptavkyWithKontaktEmail: boolean;
}): UnverifiedEmailChangeTargets {
  return {
    userId: input.userId,
    accountId: input.accountId,
    klientId: input.klientId,
    updateKlientEmail: shouldUpdateKlientContactEmail({
      klientEmail: input.klientEmail,
      currentAuthEmail: input.currentAuthEmail,
    }),
    updatePoptavkyKontakt: input.hasPoptavkyWithKontaktEmail,
  };
}
