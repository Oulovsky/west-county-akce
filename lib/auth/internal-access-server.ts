import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { checkSystemAdminEmail } from "@/lib/auth/admin-access";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";

export async function isInternalEmployeeAllowed(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const { data: profile } = await loadEmployeeProfile(supabase, userId);
  const systemAdminCheck = await checkSystemAdminEmail(supabase, email);

  return Boolean(
    profile &&
      isEmployeeLoginAllowed(profile, {
        isSystemAdminEmail: systemAdminCheck.isSystemAdmin,
      })
  );
}

/** Cesty interní aplikace (ne portál, ne veřejné tokeny / marketing). */
export function isInternalProtectedPath(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname === "/login") return false;
  if (pathname.startsWith("/portal")) return false;
  if (pathname.startsWith("/auth/")) return false;
  if (pathname.startsWith("/dotaznik/")) return false;
  if (pathname.startsWith("/schvaleni/")) return false;
  if (pathname.startsWith("/poptavka-objednavka/")) return false;
  if (pathname.startsWith("/faktura-render/")) return false;
  return true;
}

export async function isActiveClientOnlyUser(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const clientSession = await loadClientPortalSession(supabase);
  if (clientSession.kind !== "active") {
    return false;
  }

  return !(await isInternalEmployeeAllowed(supabase, userId, email));
}
