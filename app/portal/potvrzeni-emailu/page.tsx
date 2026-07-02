import { redirect } from "next/navigation";
import PortalPotvrzeniEmailuClient from "./PortalPotvrzeniEmailuClient";
import { PortalShell } from "@/components/portal/PortalShell";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { isClientEmailVerified } from "@/lib/auth/client-email-verification";
import { createClient } from "@/lib/supabase/server";

export default async function PortalPotvrzeniEmailuPage({
  searchParams,
}: {
  searchParams?: Promise<{
    email?: string;
    registered?: string;
    status?: string;
    error?: string;
    wait?: string;
  }>;
}) {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);
  const resolved = searchParams ? await searchParams : undefined;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isClientEmailVerified(user) && session.kind === "active") {
    redirect("/portal");
  }

  const email =
    session.kind === "email_unverified"
      ? session.email
      : String(resolved?.email ?? user?.email ?? "").trim().toLowerCase();

  const canChangeEmail = session.kind === "email_unverified";
  const lastSentAt =
    session.kind === "email_unverified" ? session.emailConfirmationLastSentAt : null;

  return (
    <PortalShell>
      <PortalPotvrzeniEmailuClient
        email={email}
        canChangeEmail={canChangeEmail}
        lastSentAt={lastSentAt}
        registered={resolved?.registered === "1"}
        status={resolved?.status}
        error={resolved?.error}
        waitSeconds={resolved?.wait ? Number(resolved.wait) : undefined}
      />
    </PortalShell>
  );
}
