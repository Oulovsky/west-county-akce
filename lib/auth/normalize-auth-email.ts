const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Zobrazovaná adresa — pouze trim, bez Gmail transformací. */
export function getAuthEmailDisplayValue(email?: string | null): string | null {
  const trimmed = email?.trim();
  return trimmed || null;
}

/**
 * Normalizace pro interní allowlist/login porovnání a dedupe.
 * Gmail/googlemail: lowercase, bez teček v local-part, bez +tag.
 * Ostatní domény: pouze lowercase + trim.
 */
export function normalizeAuthEmailForComparison(email?: string | null): string | null {
  const trimmed = email?.trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const atIndex = lower.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === lower.length - 1) {
    return lower;
  }

  let localPart = lower.slice(0, atIndex);
  let domain = lower.slice(atIndex + 1);

  if (domain === "googlemail.com") {
    domain = "gmail.com";
  }

  if (GMAIL_DOMAINS.has(domain)) {
    const plusIndex = localPart.indexOf("+");
    if (plusIndex >= 0) {
      localPart = localPart.slice(0, plusIndex);
    }
    localPart = localPart.replace(/\./g, "");
    domain = "gmail.com";
  }

  return `${localPart}@${domain}`;
}

export function emailsMatchForAuthComparison(
  left?: string | null,
  right?: string | null
): boolean {
  const normalizedLeft = normalizeAuthEmailForComparison(left);
  const normalizedRight = normalizeAuthEmailForComparison(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
}

/** @deprecated Prefer getAuthEmailDisplayValue or normalizeAuthEmailForComparison explicitly. */
export function normalizeAuthEmail(email?: string | null): string | null {
  return normalizeAuthEmailForComparison(email);
}
