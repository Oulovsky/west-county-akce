import "server-only";

import { buildClientEmailConfirmationRedirectUrl } from "@/lib/auth/client-email-confirmation-url";
import {
  mapSendResendResultToConfirmation,
  resolveConfirmationLinkType,
  type ResendConfirmationCode,
} from "@/lib/client-portal/portal-email-confirmation-flow";
import { sendResendEmailSafe } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export type SendClientEmailConfirmationResult =
  | { ok: true }
  | { ok: false; code: ResendConfirmationCode };

/**
 * Jednotný mechanismus pro registrační i resend potvrzovací e-mail:
 * Supabase admin generateLink → odkaz pošleme přes sendResendEmailSafe (Resend, FROM z RESEND_FROM_EMAIL).
 * Vrací úspěch jen tehdy, když generateLink i Resend odeslání reálně uspěly.
 */
export async function sendClientEmailConfirmation(input: {
  email: string;
  password?: string;
  logContext?: string;
}): Promise<SendClientEmailConfirmationResult> {
  const email = input.email.trim().toLowerCase();
  const ctx = input.logContext ?? "client_email_confirmation";
  const linkType = resolveConfirmationLinkType(Boolean(input.password));

  if (!email) {
    return { ok: false, code: "user_not_found" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    console.warn("[portal-email-confirmation] admin client unavailable", {
      email,
      context: ctx,
    });
    return { ok: false, code: "env_missing" };
  }

  const redirectTo = buildClientEmailConfirmationRedirectUrl();

  const { data, error } =
    linkType === "signup"
      ? await admin.auth.admin.generateLink({
          type: "signup",
          email,
          password: input.password ?? "",
          options: { redirectTo },
        })
      : await admin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo },
        });

  if (error || !data?.properties?.action_link) {
    console.warn("[portal-email-confirmation] generateLink failed", {
      email,
      type: linkType,
      context: ctx,
      code: error?.code,
      message: error?.message,
    });
    return { ok: false, code: "generate_link_failed" };
  }

  console.info("[portal-email-confirmation] generateLink ok", {
    email,
    type: linkType,
    context: ctx,
  });

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
    logContext: ctx,
  });

  const mapped = mapSendResendResultToConfirmation(sendResult);

  if (!mapped.ok) {
    console.warn("[portal-email-confirmation] resend email failed", {
      email,
      type: linkType,
      context: ctx,
      code: mapped.code,
    });
    return { ok: false, code: mapped.code };
  }

  console.info("[portal-email-confirmation] resend email sent", {
    email,
    type: linkType,
    context: ctx,
  });

  return { ok: true };
}

/** Vrátí stav auth uživatele (existence + potvrzení e-mailu) pro guardy resendu. */
export async function loadPortalAuthUserById(userId: string): Promise<{
  exists: boolean;
  emailConfirmed: boolean;
  email: string | null;
}> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    const user = data.user;
    return {
      exists: Boolean(user),
      emailConfirmed: Boolean(user?.email_confirmed_at),
      email: user?.email ?? null,
    };
  } catch {
    return { exists: false, emailConfirmed: false, email: null };
  }
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
