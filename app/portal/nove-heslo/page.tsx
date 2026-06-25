import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import PortalNoveHesloClient from "./PortalNoveHesloClient";

export default async function PortalNoveHesloPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#030712]" />}>
      <PortalNoveHesloClient hasSession={Boolean(user)} />
    </Suspense>
  );
}
