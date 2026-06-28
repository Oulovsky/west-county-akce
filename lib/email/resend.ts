import "server-only";

import { Resend } from "resend";

export type SendResendEmailSafeResult =
  | { ok: true; sent: true }
  | {
      ok: true;
      sent: false;
      skipped: true;
      skipReason: "missing_api_key" | "missing_from" | "missing_recipient";
    }
  | { ok: false; sent: false; error: string };

export function getResendFromEmail(): string | null {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  return from || null;
}

export function getResendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key || null;
}

export async function sendResendEmailSafe(input: {
  to: string | null | undefined;
  subject: string;
  text: string;
  html: string;
  /** Kontext pro log (např. "poptavka binding_order"). */
  logContext?: string;
}): Promise<SendResendEmailSafeResult> {
  const ctx = input.logContext ? `[email:${input.logContext}]` : "[email]";

  const apiKey = getResendApiKey();
  if (!apiKey) {
    console.warn(`${ctx} RESEND_API_KEY is missing, skipping email send.`);
    return { ok: true, sent: false, skipped: true, skipReason: "missing_api_key" };
  }

  const from = getResendFromEmail();
  if (!from) {
    console.warn(`${ctx} RESEND_FROM_EMAIL is missing, skipping email send.`);
    return { ok: true, sent: false, skipped: true, skipReason: "missing_from" };
  }

  const to = input.to?.trim().toLowerCase();
  if (!to) {
    console.warn(`${ctx} recipient email is missing, skipping email send.`);
    return { ok: true, sent: false, skipped: true, skipReason: "missing_recipient" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (error) {
      console.warn(`${ctx} Resend API error:`, error.message);
      return { ok: false, sent: false, error: error.message };
    }

    return { ok: true, sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`${ctx} unexpected send error:`, message);
    return { ok: false, sent: false, error: message };
  }
}

export function sendResendResultToQuery(
  result: SendResendEmailSafeResult
): "sent" | "missing_email" | "missing_resend_key" | "missing_from" | "failed" {
  if (result.ok && result.sent) return "sent";
  if (result.ok && !result.sent && result.skipped) {
    switch (result.skipReason) {
      case "missing_api_key":
        return "missing_resend_key";
      case "missing_from":
        return "missing_from";
      case "missing_recipient":
        return "missing_email";
    }
  }
  return "failed";
}
