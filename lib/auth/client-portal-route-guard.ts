import { redirect } from "next/navigation";
import type { ClientPortalSession } from "@/lib/auth/client-portal-access-server";

export function guardVerifiedClientPortalPage(
  session: ClientPortalSession,
  nextPath?: string
): asserts session is Extract<ClientPortalSession, { kind: "active" }> {
  if (session.kind === "email_unverified") {
    redirect("/portal/potvrzeni-emailu");
  }

  if (session.kind !== "active") {
    const next = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/portal/prihlaseni${next}`);
  }
}
