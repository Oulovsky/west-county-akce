import { Suspense } from "react";
import { redirect } from "next/navigation";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import { createClient } from "@/lib/supabase/server";
import PortalPrihlaseniClient from "./PortalPrihlaseniClient";

export default async function PortalPrihlaseniPage() {
  const supabase = await createClient();
  const session = await loadClientPortalSession(supabase);

  if (session.kind === "email_unverified") {
    redirect("/portal/potvrzeni-emailu");
  }

  if (session.kind === "active") {
    redirect("/portal");
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030712]" />}>
      <PortalPrihlaseniClient />
    </Suspense>
  );
}
