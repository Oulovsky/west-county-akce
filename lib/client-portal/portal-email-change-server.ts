import "server-only";

import {
  markClientEmailConfirmationSent,
  sendClientEmailConfirmation,
} from "@/lib/client-portal/portal-email-confirmation-server";
import { parseClientRegistrationSnapshot } from "@/lib/client-portal/registration-snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

export type UpdateUnverifiedClientEmailResult =
  | { ok: true; email: string }
  | {
      ok: false;
      code:
        | "invalid_email"
        | "same_email"
        | "email_exists"
        | "auth_update_failed"
        | "confirmation_failed";
    };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function updateUnverifiedClientEmail(input: {
  userId: string;
  klientId: string;
  currentEmail: string;
  newEmail: string;
  password?: string;
}): Promise<UpdateUnverifiedClientEmailResult> {
  const newEmail = input.newEmail.trim().toLowerCase();
  const currentEmail = input.currentEmail.trim().toLowerCase();

  if (!isValidEmail(newEmail)) {
    return { ok: false, code: "invalid_email" };
  }

  if (newEmail === currentEmail) {
    return { ok: false, code: "same_email" };
  }

  const admin = createAdminClient();

  const { error: updateError } = await admin.auth.admin.updateUserById(input.userId, {
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
    return { ok: false, code: "auth_update_failed" };
  }

  const now = new Date().toISOString();

  await admin.from("klienti").update({ email: newEmail }).eq("klient_id", input.klientId);

  const { data: registration } = await admin
    .from("client_registrations")
    .select("registration_id, ares_snapshot")
    .eq("user_id", input.userId)
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
    logContext: "portal_change_email",
  });

  if (!confirmation.ok) {
    return { ok: false, code: "confirmation_failed" };
  }

  if (confirmation.sent) {
    await markClientEmailConfirmationSent(input.userId);
  }

  return { ok: true, email: newEmail };
}
