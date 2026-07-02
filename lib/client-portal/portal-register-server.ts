import "server-only";

import type { AuthError } from "@supabase/supabase-js";
import type { AresSubject } from "@/lib/ares/klient-ares";
import { isEmailNotConfirmedAuthError, portalAuthUserCreateParams } from "@/lib/auth/client-email-verification";
import { activateClientPortalRegistration } from "@/lib/client-portal/register-client-server";
import {
  markClientEmailConfirmationSent,
  sendClientEmailConfirmation,
} from "@/lib/client-portal/portal-email-confirmation-server";
import {
  buildClientRegistrationSnapshot,
  type ClientRegistrationSnapshot,
} from "@/lib/client-portal/registration-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isEmailProviderDisabledError } from "@/lib/auth/portal-auth-errors";

export type PortalRegisterErrorCode =
  | "password_mismatch"
  | "missing_fields"
  | "email_exists"
  | "weak_password"
  | "auth_failed"
  | "client_create_failed"
  | "env_missing"
  | "sign_up_failed"
  | "email_provider_disabled"
  | "invalid_ico"
  | "already_signed_in"
  | "confirmation_email_failed";

export type PortalRegisterInput = {
  email: string;
  password: string;
  passwordConfirm: string;
  ico: string;
  nazev: string;
  ulice: string;
  mesto: string;
  psc: string;
  dic: string;
  telefon: string;
  kontaktJmeno: string;
  poznamka: string;
  aresSubject: AresSubject | null;
};

type EnvCheckResult =
  | { ok: true }
  | { ok: false; missing: string[] };

function logPortalRegister(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(message, details);
    return;
  }
  console.info(message);
}

function checkPortalRegisterEnv(): EnvCheckResult {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.NEXT_PUBLIC_APP_URL?.trim()) {
    missing.push("NEXT_PUBLIC_APP_URL");
  }

  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

function mapAuthErrorToCode(error: AuthError | null | undefined): PortalRegisterErrorCode {
  if (!error) {
    return "sign_up_failed";
  }

  const message = error.message.toLowerCase();

  if (
    error.code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  ) {
    return "email_exists";
  }

  if (
    error.code === "weak_password" ||
    message.includes("password should be at least") ||
    message.includes("password is too weak")
  ) {
    return "weak_password";
  }

  if (isEmailProviderDisabledError(error)) {
    return "email_provider_disabled";
  }

  return "auth_failed";
}

async function cleanupAuthUser(userId: string) {
  logPortalRegister("[portal-register] cleanup auth user start", { userId });

  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) {
      logPortalRegister("[portal-register] cleanup auth user failed", {
        userId,
        message: error.message,
      });
      return;
    }

    logPortalRegister("[portal-register] cleanup auth user ok", { userId });
  } catch (error) {
    logPortalRegister("[portal-register] cleanup auth user failed", {
      userId,
      message: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

/** Parametry pro Supabase Admin createUser při registraci klienta. */
export { portalAuthUserCreateParams } from "@/lib/auth/client-email-verification";

async function createUnverifiedAuthUser(
  email: string,
  password: string
): Promise<
  | { ok: true; userId: string }
  | { ok: false; code: PortalRegisterErrorCode; status?: number; message?: string }
> {
  logPortalRegister("[portal-register] auth create start", { email });

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    logPortalRegister("[portal-register] auth create failed", {
      email,
      code: "env_missing",
      message: error instanceof Error ? error.message : "admin_client_unavailable",
    });
    return { ok: false, code: "env_missing" };
  }

  const { data, error } = await admin.auth.admin.createUser(
    portalAuthUserCreateParams(email, password)
  );

  if (error || !data.user?.id) {
    const code = mapAuthErrorToCode(error);
    logPortalRegister("[portal-register] auth create failed", {
      email,
      status: error?.status,
      code: error?.code ?? code,
      message: error?.message ?? "missing_user",
    });
    return {
      ok: false,
      code,
      status: error?.status,
      message: error?.message,
    };
  }

  logPortalRegister("[portal-register] auth user created (unverified)", {
    userId: data.user.id,
    email,
  });

  return { ok: true, userId: data.user.id };
}

async function signInRegisteredUser(
  email: string,
  password: string
): Promise<
  | { ok: true }
  | { ok: false; code: PortalRegisterErrorCode; emailNotConfirmed?: boolean }
> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (isEmailNotConfirmedAuthError(error)) {
      logPortalRegister("[portal-register] auth sign-in blocked until email confirmed", {
        email,
      });
      return { ok: false, code: "auth_failed", emailNotConfirmed: true };
    }

    const code = isEmailProviderDisabledError(error)
      ? "email_provider_disabled"
      : "auth_failed";
    logPortalRegister("[portal-register] auth sign-in after create failed", {
      email,
      status: error.status,
      code: error.code,
      message: error.message,
    });
    return { ok: false, code };
  }

  return { ok: true };
}

export function validatePortalRegisterInput(
  input: PortalRegisterInput
): PortalRegisterErrorCode | null {
  if (
    !input.email ||
    !input.password ||
    !input.nazev ||
    !input.ico ||
    !input.kontaktJmeno ||
    !input.telefon
  ) {
    return "missing_fields";
  }

  if (input.password.length < 8) {
    return "weak_password";
  }

  if (input.password !== input.passwordConfirm) {
    return "password_mismatch";
  }

  if (!/^\d{8}$/.test(input.ico)) {
    return "invalid_ico";
  }

  return null;
}

export async function registerClientPortalAccount(
  input: PortalRegisterInput
): Promise<
  | {
      ok: true;
      userId: string;
      klientId: string;
      email: string;
      needsEmailConfirmation: true;
      signedIn: boolean;
    }
  | { ok: false; code: PortalRegisterErrorCode }
> {
  logPortalRegister("[portal-register] start", {
    email: input.email,
    ico: input.ico,
    nazevFirmy: input.nazev,
  });

  const envCheck = checkPortalRegisterEnv();
  if (!envCheck.ok) {
    logPortalRegister("[portal-register] env missing", { missing: envCheck.missing });
    return { ok: false, code: "env_missing" };
  }

  const validationError = validatePortalRegisterInput(input);
  if (validationError) {
    logPortalRegister("[portal-register] validation failed", { reason: validationError });
    return { ok: false, code: validationError };
  }

  logPortalRegister("[portal-register] validation ok");

  const supabase = await createClient();
  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  let userId: string;
  let createdAuthUser = false;

  if (existingUser) {
    userId = existingUser.id;
    logPortalRegister("[portal-register] using existing auth session", {
      userId,
      email: input.email,
    });
  } else {
    const authResult = await createUnverifiedAuthUser(input.email, input.password);
    if (!authResult.ok) {
      return { ok: false, code: authResult.code };
    }

    userId = authResult.userId;
    createdAuthUser = true;
  }

  const snapshot: ClientRegistrationSnapshot = buildClientRegistrationSnapshot({
    aresSubject: input.aresSubject,
    form: {
      nazev: input.nazev,
      ulice: input.ulice,
      mesto: input.mesto,
      psc: input.psc,
      ico: input.ico,
      dic: input.dic,
      telefon: input.telefon,
      email: input.email,
      kontakt_jmeno: input.kontaktJmeno,
      poznamka: input.poznamka,
    },
  });

  logPortalRegister("[portal-register] klient insert start", {
    userId,
    email: input.email,
    ico: input.ico,
  });

  let klientId: string;

  try {
    const activation = await activateClientPortalRegistration({
      userId,
      snapshot,
      ico: input.ico,
      nazev: input.nazev,
    });
    klientId = activation.klientId;
  } catch (error) {
    const err = error as {
      message?: string;
      code?: string;
      details?: string;
      hint?: string;
    };

    logPortalRegister("[portal-register] klient insert failed", {
      userId,
      email: input.email,
      code: err.code ?? "unknown",
      message: err.message ?? "unknown_error",
      details: err.details,
      hint: err.hint,
    });

    if (createdAuthUser) {
      await cleanupAuthUser(userId);
    } else {
      await supabase.auth.signOut();
    }

    return { ok: false, code: "client_create_failed" };
  }

  const confirmation = await sendClientEmailConfirmation({
    email: input.email,
    password: createdAuthUser ? input.password : undefined,
    logContext: "portal_register",
  });

  if (!confirmation.ok) {
    logPortalRegister("[portal-register] confirmation email failed", {
      userId,
      email: input.email,
      code: confirmation.code,
    });

    if (createdAuthUser) {
      await cleanupAuthUser(userId);
    } else {
      await supabase.auth.signOut();
    }

    return { ok: false, code: "confirmation_email_failed" };
  }

  await markClientEmailConfirmationSent(userId);

  let signedIn = false;

  if (createdAuthUser) {
    const signedInResult = await signInRegisteredUser(input.email, input.password);
    if (signedInResult.ok) {
      signedIn = true;
    } else if (!signedInResult.emailNotConfirmed) {
      await cleanupAuthUser(userId);
      return { ok: false, code: signedInResult.code };
    }
  } else {
    signedIn = true;
  }

  logPortalRegister("[portal-register] success (awaiting email confirmation)", {
    userId,
    klientId,
    email: input.email,
    signedIn,
  });

  return {
    ok: true,
    userId,
    klientId,
    email: input.email,
    needsEmailConfirmation: true,
    signedIn,
  };
}
