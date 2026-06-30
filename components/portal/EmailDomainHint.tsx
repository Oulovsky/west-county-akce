"use client";

import { getEmailComTypoHint } from "@/lib/client-portal/email-domain-hint";

export default function EmailDomainHint({ email }: { email: string }) {
  const hint = getEmailComTypoHint(email);
  if (!hint) {
    return null;
  }

  return (
    <p className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
      {hint}
    </p>
  );
}
