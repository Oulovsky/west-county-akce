export type ApprovalStatus = "ceka_na_schvaleni" | "schvaleno" | "zamitneto";

export function normalizeApprovalStatus(value?: string | null): ApprovalStatus {
  if (value === "schvaleno" || value === "zamitneto") return value;
  return "ceka_na_schvaleni";
}

export function getApprovalStatusLabel(value?: string | null) {
  const status = normalizeApprovalStatus(value);
  if (status === "schvaleno") return "Schváleno";
  if (status === "zamitneto") return "Zamítnuto";
  return "Čeká na schválení";
}

export function isApprovalResolved(value?: string | null) {
  const status = normalizeApprovalStatus(value);
  return status === "schvaleno" || status === "zamitneto";
}
