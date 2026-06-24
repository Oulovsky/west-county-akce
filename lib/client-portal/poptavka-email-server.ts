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

export type PoptavkaOutboundKind = "revision" | "rejected" | "approved";

export type PoptavkaOutboundMessage = {
  kind: PoptavkaOutboundKind;
  subject: string;
  text: string;
  html: string;
  link: string;
  emailTo: string | null;
};

export type PoptavkaOutboundSkipReason =
  | "missing_email"
  | "missing_resend_key"
  | "missing_base_url";

export type TrySendPoptavkaOutboundResult =
  | { ok: true; sent: true; outbound: PoptavkaOutboundMessage }
  | {
      ok: true;
      sent: false;
      reason: PoptavkaOutboundSkipReason;
      outbound: PoptavkaOutboundMessage;
    }
  | {
      ok: false;
      reason: "send_failed";
      message: string;
      outbound: PoptavkaOutboundMessage;
    };

/** @deprecated Use TrySendPoptavkaOutboundResult */
export type SendRevisionEmailResult =
  | { ok: true; sent: true }
  | {
      ok: true;
      sent: false;
      reason: PoptavkaOutboundSkipReason;
    }
  | { ok: false; reason: "send_failed"; message: string };

const OUTBOUND_SUBJECTS: Record<PoptavkaOutboundKind, string> = {
  revision: "WEST COUNTY – poptávka vyžaduje doplnění",
  rejected: "WEST COUNTY – poptávka byla zamítnuta",
  approved: "WEST COUNTY – poptávka byla schválena",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRevisionEmailBody(link: string, duvod: string | null | undefined) {
  const paragraphs = [
    "Děkujeme za Vaši poptávku.",
    "Pro další zpracování je potřeba doplnit nebo upravit zadání.",
  ];

  if (duvod?.trim()) {
    paragraphs.push(`Poznámka od našeho týmu:\n${duvod.trim()}`);
  }

  paragraphs.push(`Více informací a úpravu poptávky najdete v klientské zóně: ${link}`);
  const text = paragraphs.join("\n\n");

  const reasonHtml = duvod?.trim()
    ? `<p><strong>Poznámka od našeho týmu:</strong><br>${escapeHtml(duvod.trim()).replace(/\n/g, "<br>")}</p>`
    : "";

  const html = `
    <p>Děkujeme za Vaši poptávku.</p>
    <p>Pro další zpracování je potřeba doplnit nebo upravit zadání.</p>
    ${reasonHtml}
    <p>Více informací a úpravu poptávky najdete v klientské zóně:</p>
    <p><a href="${link}">${link}</a></p>
  `.trim();

  return { text, html };
}

function buildRejectedEmailBody(
  link: string,
  duvod: string,
  cisloPoptavky: string | null | undefined
) {
  const reference = cisloPoptavky?.trim()
    ? ` (${cisloPoptavky.trim()})`
    : "";

  const text = [
    `Vaše poptávka${reference} bohužel nemůže být v tuto chvíli přijata.`,
    "",
    "Důvod:",
    duvod.trim(),
    "",
    `Stav poptávky můžete zkontrolovat v klientské zóně: ${link}`,
  ].join("\n");

  const html = `
    <p>Vaše poptávka${escapeHtml(reference)} bohužel nemůže být v tuto chvíli přijata.</p>
    <p><strong>Důvod:</strong><br>${escapeHtml(duvod.trim()).replace(/\n/g, "<br>")}</p>
    <p>Stav poptávky můžete zkontrolovat v klientské zóně:</p>
    <p><a href="${link}">${link}</a></p>
  `.trim();

  return { text, html };
}

/** Připraveno pro budoucí krok schválení — zatím se nevolá z approve akce. */
function buildApprovedEmailBody(link: string) {
  const text = [
    "Vaše poptávka byla schválena.",
    "Další kroky a podrobnosti najdete v klientské zóně.",
    `Odkaz: ${link}`,
  ].join("\n\n");

  const html = `
    <p>Vaše poptávka byla schválena.</p>
    <p>Další kroky a podrobnosti najdete v klientské zóně.</p>
    <p><a href="${link}">${link}</a></p>
  `.trim();

  return { text, html };
}

function buildOutboundContent(
  kind: PoptavkaOutboundKind,
  link: string,
  options: { duvod?: string | null; cisloPoptavky?: string | null }
) {
  switch (kind) {
    case "revision":
      return buildRevisionEmailBody(link, options.duvod);
    case "rejected":
      return buildRejectedEmailBody(link, options.duvod?.trim() || "—", options.cisloPoptavky);
    case "approved":
      return buildApprovedEmailBody(link);
  }
}

export async function preparePoptavkaOutboundMessage({
  kind,
  detail,
  baseUrl,
  duvod,
}: {
  kind: PoptavkaOutboundKind;
  detail: InternalPoptavkaDetail;
  baseUrl: string;
  duvod?: string | null;
}): Promise<PoptavkaOutboundMessage> {
  const link = baseUrl.trim()
    ? buildPortalPoptavkaUrl(detail.poptavka_id, baseUrl)
    : `/portal/poptavka/${detail.poptavka_id}`;

  const resolvedDuvod = duvod ?? detail.zamitnuto_duvod;
  const { text, html } = buildOutboundContent(kind, link, {
    duvod: resolvedDuvod,
    cisloPoptavky: detail.cislo_poptavky,
  });

  const emailTo = await resolvePoptavkaClientEmail(detail);

  return {
    kind,
    subject: OUTBOUND_SUBJECTS[kind],
    text,
    html,
    link,
    emailTo,
  };
}

export function formatPoptavkaOutboundForCopy(outbound: PoptavkaOutboundMessage) {
  const toLine = outbound.emailTo ? `Komu: ${outbound.emailTo}` : "Komu: (e-mail klienta není k dispozici)";
  return [`Předmět: ${outbound.subject}`, toLine, "", outbound.text].join("\n");
}

export function outboundResultToEmailQuery(result: TrySendPoptavkaOutboundResult): string {
  if (result.ok && result.sent) return "sent";
  if (result.ok && !result.sent) return result.reason;
  return "failed";
}

export async function trySendPoptavkaOutbound({
  kind,
  detail,
  baseUrl,
  duvod,
}: {
  kind: PoptavkaOutboundKind;
  detail: InternalPoptavkaDetail;
  baseUrl: string;
  duvod?: string | null;
}): Promise<TrySendPoptavkaOutboundResult> {
  const outbound = await preparePoptavkaOutboundMessage({ kind, detail, baseUrl, duvod });

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return { ok: true, sent: false, reason: "missing_resend_key", outbound };
  }

  if (!baseUrl.trim()) {
    return { ok: true, sent: false, reason: "missing_base_url", outbound };
  }

  if (!outbound.emailTo) {
    return { ok: true, sent: false, reason: "missing_email", outbound };
  }

  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL?.trim() || "WEST COUNTY <onboarding@resend.dev>",
    to: outbound.emailTo,
    subject: outbound.subject,
    text: outbound.text,
    html: outbound.html,
  });

  if (error) {
    console.warn(`Poptavka outbound email (${kind}) failed:`, error.message);
    return { ok: false, reason: "send_failed", message: error.message, outbound };
  }

  return { ok: true, sent: true, outbound };
}

export async function sendPoptavkaRevisionEmail({
  detail,
  baseUrl,
  duvod,
}: {
  detail: InternalPoptavkaDetail;
  baseUrl: string;
  duvod?: string | null;
}): Promise<SendRevisionEmailResult> {
  const result = await trySendPoptavkaOutbound({
    kind: "revision",
    detail,
    baseUrl,
    duvod,
  });

  if (result.ok && result.sent) {
    return { ok: true, sent: true };
  }

  if (result.ok && !result.sent) {
    return { ok: true, sent: false, reason: result.reason };
  }

  return { ok: false, reason: "send_failed", message: result.message };
}
