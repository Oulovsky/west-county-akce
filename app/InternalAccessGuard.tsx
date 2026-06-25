import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  enforceInternalPageAccess,
} from "@/lib/auth/internal-access-server";
import { isInternalProtectedPath } from "@/lib/auth/internal-routes";
import { createClient } from "@/lib/supabase/server";

export async function InternalAccessGuard({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get("x-wc-pathname") ?? "";

  if (!pathname || !isInternalProtectedPath(pathname)) {
    return children;
  }

  const supabase = await createClient();
  const decision = await enforceInternalPageAccess(supabase, pathname);

  if (decision === "client_redirect_portal") {
    redirect("/portal");
  }

  if (decision === "login_required" || decision === "forbidden") {
    redirect("/login?error=not_allowed");
  }

  return children;
}
