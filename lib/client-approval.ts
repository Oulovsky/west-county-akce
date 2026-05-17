import { createHash, randomBytes } from "crypto";
import { normalizeBaseUrl } from "@/lib/client-questionnaire";

export type ClientApprovalStatus =
  | "draft"
  | "questionnaire_sent"
  | "technical_info_received"
  | "sent_for_approval"
  | "approved"
  | "declined";

export function createClientApprovalToken() {
  return randomBytes(32).toString("base64url");
}

export function hashClientApprovalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildApprovalUrl(baseUrl: string, rawToken: string) {
  return `${normalizeBaseUrl(baseUrl)}/schvaleni/${encodeURIComponent(rawToken)}`;
}

export function normalizeClientApprovalStatus(value?: string | null): ClientApprovalStatus {
  if (value === "questionnaire_sent") return "questionnaire_sent";
  if (value === "technical_info_received") return "technical_info_received";
  if (value === "sent_for_approval") return "sent_for_approval";
  if (value === "approved") return "approved";
  if (value === "declined") return "declined";
  return "draft";
}

export function getClientApprovalStatusLabel(value?: string | null) {
  const status = normalizeClientApprovalStatus(value);
  if (status === "questionnaire_sent") return "Dotazník odeslán";
  if (status === "technical_info_received") return "Technické informace doplněny";
  if (status === "sent_for_approval") return "Odesláno ke schválení";
  if (status === "approved") return "Schváleno klientem";
  if (status === "declined") return "Odmítnuto klientem";
  return "Rozpracovaná / návrh";
}
