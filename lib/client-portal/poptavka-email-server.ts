import "server-only";

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InternalPoptavkaDetail } from "@/lib/client-portal/poptavka-internal-server";

export function getPortalAppBaseUrl(headersList?: Headers) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  if (!headersList) return "";

  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) return "";

  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export function buildPortalPoptavkaUrl(poptavkaId: string, baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/portal/poptavka/${poptavkaId}`;
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

export async function resolvePoptavkaClientEmail(
  detail: Pick<
    InternalPoptavkaDetail,
    "poptavka_id" | "kontakt_email" | "vytvoril_account_id" | "klient_id"
  > & {
    klient?: { email: string | null } | null;
  }
): Promise<string | null> {
  const admin = createAdminClient();

  const { data: account } = await admin
    .from("client_accounts")
    .select("user_id, stav")
    .eq("account_id", detail.vytvoril_account_id)
    .maybeSingle();

  if (account?.stav === "active" && account.user_id) {
    const { data: userData, error } = await admin.auth.admin.getUserById(account.user_id);
    if (!error) {
      const authEmail = normalizeEmail(userData.user?.email);
      if (authEmail) return authEmail;
    }
  }

  const kontaktEmail = normalizeEmail(detail.kontakt_email);
  if (kontaktEmail) return kontaktEmail;

  const klientEmail = normalizeEmail(detail.klient?.email);
  if (klientEmail) return klientEmail;

  if (detail.klient_id) {
    const { data: klient } = await admin
      .from("klienti")
      .select("email")
      .eq("klient_id", detail.klient_id)
      .maybeSingle();

    const fallbackKlientEmail = normalizeEmail(klient?.email as string | null | undefined);
    if (fallbackKlientEmail) return fallbackKlientEmail;
  }

  return null;
}

export type SendRevisionEmailResult =
  | { ok: true; sent: true }
  | {
      ok: true;
      sent: false;
      reason: "missing_email" | "missing_resend_key" | "missing_base_url";
    }
  | { ok: false; reason: "send_failed"; message: string };

function buildRevisionEmailContent(link: string) {
  const text = [
    "Děkujeme za Vaši poptávku.",
    "Pro další zpracování je potřeba doplnit nebo upravit zadání.",
    `Více informací najdete v klientské zóně: ${link}`,
  ].join("\n\n");

  const html = `
    <p>Děkujeme za Vaši poptávku.</p>
    <p>Pro další zpracování je potřeba doplnit nebo upravit zadání.</p>
    <p>Více informací najdete v klientské zóně:</p>
    <p><a href="${link}">${link}</a></p>
  `.trim();

  return { text, html };
}

export async function sendPoptavkaRevisionEmail({
  detail,
  baseUrl,
}: {
  detail: InternalPoptavkaDetail;
  baseUrl: string;
}): Promise<SendRevisionEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return { ok: true, sent: false, reason: "missing_resend_key" };
  }

  if (!baseUrl.trim()) {
    return { ok: true, sent: false, reason: "missing_base_url" };
  }

  const emailTo = await resolvePoptavkaClientEmail(detail);
  if (!emailTo) {
    return { ok: true, sent: false, reason: "missing_email" };
  }

  const link = buildPortalPoptavkaUrl(detail.poptavka_id, baseUrl);
  const { text, html } = buildRevisionEmailContent(link);
  const resend = new Resend(resendApiKey);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL?.trim() || "WEST COUNTY <onboarding@resend.dev>",
    to: emailTo,
    subject: "WEST COUNTY – poptávka vyžaduje doplnění",
    text,
    html,
  });

  if (error) {
    console.warn("Poptavka revision email failed:", error.message);
    return { ok: false, reason: "send_failed", message: error.message };
  }

  return { ok: true, sent: true };
}
