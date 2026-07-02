import "server-only";

import {
  isEmailConfirmationResendAllowed,
} from "@/lib/auth/client-email-verification";
import { buildClientEmailConfirmationRedirectUrl } from "@/lib/auth/client-email-confirmation-url";
import { sendResendEmailSafe } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SendClientEmailConfirmationResult =
  | { ok: true; sent: true }
  | { ok: true; sent: false; skipped: true; reason: "rate_limited" | "missing_link" }
  | { ok: false; code: "env_missing" | "user_not_found" | "send_failed" | "generate_failed" };

export async function sendClientEmailConfirmation(input: {
  email: string;
  password?: string;
  lastSentAt?: string | null;
  logContext?: string;
}): Promise<SendClientEmailConfirmationResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    return { ok: false, code: "user_not_found" };
  }

  if (!isEmailConfirmationResendAllowed(input.lastSentAt)) {
    return { ok: true, sent: false, skipped: true, reason: "rate_limited" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, code: "env_missing" };
  }

  const redirectTo = buildClientEmailConfirmationRedirectUrl();

  if (!input.password) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      console.info("[portal-email-confirmation] resend failed", {
        email,
        code: error.code,
        message: error.message,
      });
      return { ok: false, code: "generate_failed" };
    }

    return { ok: true, sent: true };
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: input.password,
    options: { redirectTo },
  });

  if (error || !data.properties?.action_link) {
    console.info("[portal-email-confirmation] generateLink failed", {
      email,
      code: error?.code,
      message: error?.message,
    });
    return { ok: false, code: "generate_failed" };
  }

  const actionLink = data.properties.action_link;
  const sendResult = await sendResendEmailSafe({
    to: email,
    subject: "Potvrďte e-mail pro klientskou zónu WEST COUNTY",
    text: [
      "Dobrý den,",
      "",
      "pro dokončení registrace do klientské zóny WEST COUNTY potvrďte svou e-mailovou adresu:",
      actionLink,
      "",
      "Pokud jste registraci nezadávali, tento e-mail ignorujte.",
    ].join("\n"),
    html: [
      "<p>Dobrý den,</p>",
      "<p>pro dokončení registrace do klientské zóny WEST COUNTY potvrďte svou e-mailovou adresu:</p>",
      `<p><a href="${actionLink}">Potvrdit e-mail</a></p>`,
      "<p>Pokud jste registraci nezadávali, tento e-mail ignorujte.</p>",
    ].join(""),
    logContext: input.logContext ?? "client_email_confirmation",
  });

  if (!sendResult.ok) {
    return { ok: false, code: "send_failed" };
  }

  if (!sendResult.sent) {
    return { ok: true, sent: false, skipped: true, reason: "missing_link" };
  }

  return { ok: true, sent: true };
}

export async function loadClientAccountMetaByEmail(email: string): Promise<{
  userId: string;
  lastSentAt: string | null;
} | null> {
  const admin = createAdminClient();
  const normalized = email.trim().toLowerCase();

  const { data: klient } = await admin
    .from("klienti")
    .select("klient_id")
    .eq("email", normalized)
    .maybeSingle();

  if (!klient?.klient_id) {
    return null;
  }

  const { data: account } = await admin
    .from("client_accounts")
    .select("user_id, email_confirmation_last_sent_at")
    .eq("klient_id", klient.klient_id as string)
    .maybeSingle();

  if (!account?.user_id) {
    return null;
  }

  return {
    userId: account.user_id as string,
    lastSentAt: (account.email_confirmation_last_sent_at as string | null) ?? null,
  };
}

export async function markClientEmailConfirmationSent(
  userId: string,
  sentAt = new Date().toISOString()
) {
  const admin = createAdminClient();
  await admin
    .from("client_accounts")
    .update({
      email_confirmation_last_sent_at: sentAt,
      updated_at: sentAt,
    })
    .eq("user_id", userId);
}

export async function loadClientEmailConfirmationLastSentAt(
  userId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_accounts")
    .select("email_confirmation_last_sent_at")
    .eq("user_id", userId)
    .maybeSingle();

  return (data?.email_confirmation_last_sent_at as string | null) ?? null;
}
