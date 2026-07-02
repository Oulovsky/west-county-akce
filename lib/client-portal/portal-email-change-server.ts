import "server-only";

import { isEmailNotConfirmedAuthError } from "@/lib/auth/client-email-verification";
import {
  buildUnverifiedEmailChangeTargets,
  planUnverifiedEmailChange,
  validateUnverifiedEmailChangeInput,
  type UnverifiedEmailChangeCode,
} from "@/lib/client-portal/portal-email-change-flow";
import {
  markClientEmailConfirmationSent,
  sendClientEmailConfirmation,
} from "@/lib/client-portal/portal-email-confirmation-server";
import { parseClientRegistrationSnapshot } from "@/lib/client-portal/registration-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ChangeUnverifiedClientEmailResult =
  | { ok: true; email: string }
  | { ok: false; code: UnverifiedEmailChangeCode; waitSeconds?: number };

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) {
      return null;
    }

    const found = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalized
    );
    if (found) {
      return found;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

async function verifyClientPortalPassword(
  email: string,
  password: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) {
    await supabase.auth.signOut();
    return true;
  }

  if (isEmailNotConfirmedAuthError(error)) {
    return true;
  }

  return false;
}

export async function changeUnverifiedClientEmailByCredentials(input: {
  currentEmail: string;
  newEmail: string;
  password: string;
}): Promise<ChangeUnverifiedClientEmailResult> {
  const validated = validateUnverifiedEmailChangeInput(input);
  if (!validated.ok) {
    return { ok: false, code: validated.code };
  }

  const { currentEmail, newEmail } = validated;

  console.info("[portal-email-change] start", { email: currentEmail });

  const authUser = await findAuthUserByEmail(currentEmail);
  if (!authUser) {
    console.info("[portal-email-change] user not found", { email: currentEmail });
    return { ok: false, code: "user_not_found" };
  }

  console.info("[portal-email-change] user found", {
    userId: authUser.id,
    email: currentEmail,
  });

  const passwordVerified = await verifyClientPortalPassword(
    currentEmail,
    input.password
  );
  if (!passwordVerified) {
    console.info("[portal-email-change] password failed", { email: currentEmail });
    return { ok: false, code: "wrong_password" };
  }

  console.info("[portal-email-change] password verified", { email: currentEmail });

  const admin = createAdminClient();

  const [{ data: account }, { data: profile }] = await Promise.all([
    admin
      .from("client_accounts")
      .select("account_id, klient_id, stav, user_id")
      .eq("user_id", authUser.id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("role, aktivni, jmeno, prijmeni")
      .eq("user_id", authUser.id)
      .maybeSingle(),
  ]);

  const plan = planUnverifiedEmailChange({
    userExists: true,
    emailConfirmed: Boolean(authUser.email_confirmed_at),
    passwordVerified: true,
    hasActiveClientAccount:
      account?.stav === "active" && Boolean(account.klient_id),
    profile: profile
      ? {
          role: profile.role as string,
          aktivni: profile.aktivni as boolean | null,
          jmeno: profile.jmeno as string | null,
          prijmeni: profile.prijmeni as string | null,
        }
      : null,
  });

  if (!plan.ok) {
    console.info("[portal-email-change] blocked", {
      email: currentEmail,
      code: plan.code,
    });
    return { ok: false, code: plan.code };
  }

  if (!account?.account_id || !account.klient_id) {
    return { ok: false, code: "not_client_account" };
  }

  const { data: klient } = await admin
    .from("klienti")
    .select("klient_id, email")
    .eq("klient_id", account.klient_id)
    .maybeSingle();

  const { count: poptavkyCount } = await admin
    .from("poptavky")
    .select("poptavka_id", { count: "exact", head: true })
    .eq("vytvoril_account_id", account.account_id)
    .ilike("kontakt_email", currentEmail);

  const targets = buildUnverifiedEmailChangeTargets({
    userId: authUser.id,
    accountId: account.account_id as string,
    klientId: account.klient_id as string,
    klientEmail: (klient?.email as string | null) ?? null,
    currentAuthEmail: currentEmail,
    hasPoptavkyWithKontaktEmail: (poptavkyCount ?? 0) > 0,
  });

  const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
    email: newEmail,
    email_confirm: false,
  });

  if (updateError) {
    const message = updateError.message.toLowerCase();
    if (
      updateError.code === "email_exists" ||
      message.includes("already been registered") ||
      message.includes("already registered")
    ) {
      return { ok: false, code: "email_exists" };
    }
    console.warn("[portal-email-change] auth update failed", {
      userId: authUser.id,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, code: "auth_update_failed" };
  }

  console.info("[portal-email-change] email updated", {
    userId: authUser.id,
    from: currentEmail,
    to: newEmail,
  });

  const now = new Date().toISOString();

  if (targets.updateKlientEmail) {
    await admin
      .from("klienti")
      .update({ email: newEmail })
      .eq("klient_id", targets.klientId);
  }

  if (targets.updatePoptavkyKontakt) {
    await admin
      .from("poptavky")
      .update({ kontakt_email: newEmail, updated_at: now })
      .eq("vytvoril_account_id", targets.accountId)
      .ilike("kontakt_email", currentEmail);
  }

  const { data: registration } = await admin
    .from("client_registrations")
    .select("registration_id, ares_snapshot")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (registration?.registration_id) {
    const snapshot = parseClientRegistrationSnapshot(registration.ares_snapshot);
    if (snapshot) {
      snapshot.form.email = newEmail;
      await admin
        .from("client_registrations")
        .update({
          ares_snapshot: snapshot,
          updated_at: now,
        })
        .eq("registration_id", registration.registration_id);
    }
  }

  const confirmation = await sendClientEmailConfirmation({
    email: newEmail,
    password: input.password,
    logContext: "portal_email_change",
  });

  if (!confirmation.ok) {
    console.warn("[portal-email-change] confirmation failed", {
      userId: authUser.id,
      email: newEmail,
      code: confirmation.code,
    });
    return { ok: false, code: confirmation.code };
  }

  console.info("[portal-email-change] confirmation sent", {
    userId: authUser.id,
    email: newEmail,
  });

  await markClientEmailConfirmationSent(authUser.id);

  return { ok: true, email: newEmail };
}

/** @deprecated Použij changeUnverifiedClientEmailByCredentials. Zachováno pro zpětnou kompatibilitu. */
export async function updateUnverifiedClientEmail(input: {
  userId: string;
  klientId: string;
  currentEmail: string;
  newEmail: string;
  password?: string;
}): Promise<ChangeUnverifiedClientEmailResult> {
  if (!input.password) {
    return { ok: false, code: "missing_fields" };
  }

  return changeUnverifiedClientEmailByCredentials({
    currentEmail: input.currentEmail,
    newEmail: input.newEmail,
    password: input.password,
  });
}
