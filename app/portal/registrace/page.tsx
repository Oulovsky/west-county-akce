import { Suspense } from "react";
import { redirect } from "next/navigation";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { createClient } from "@/lib/supabase/server";
import PortalRegistraceClient from "./PortalRegistraceClient";

export default async function PortalRegistracePage() {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);

  if (session.kind === "active") {
    redirect("/portal");
  }

  if (session.kind === "authenticated_pending") {
    redirect("/portal");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030712]" />}>
      <PortalRegistraceClient />
    </Suspense>
  );
}
