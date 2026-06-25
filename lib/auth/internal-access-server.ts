import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { checkSystemAdminEmail } from "@/lib/auth/admin-access";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";
import { isInternalProtectedPath } from "@/lib/auth/internal-routes";

export { isInternalProtectedPath } from "@/lib/auth/internal-routes";

export type InternalAccessDecision =
  | "internal_allowed"
  | "client_redirect_portal"
  | "login_required"
  | "forbidden";

export type AuthAccessContext = {
  userId: string | null;
  email: string | null;
  hasProfile: boolean;
  hasActiveClientAccount: boolean;
  isInternalEmployee: boolean;
  isClientOnly: boolean;
};

export function logInternalAccessGuard(
  path: string,
  context: AuthAccessContext,
  decision: InternalAccessDecision
) {
  console.info("[internal-access-guard]", {
    path,
    userId: context.userId,
    hasProfile: context.hasProfile,
    hasActiveClientAccount: context.hasActiveClientAccount,
    decision,
  });
}

export async function resolveAuthAccessContext(
  supabase: SupabaseClient
): Promise<AuthAccessContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      email: null,
      hasProfile: false,
      hasActiveClientAccount: false,
      isInternalEmployee: false,
      isClientOnly: false,
    };
  }

  const email = user.email?.trim().toLowerCase() ?? null;
  const [{ data: profile }, clientSession] = await Promise.all([
    loadEmployeeProfile(supabase, user.id),
    loadClientPortalSession(supabase),
  ]);

  let isInternalEmployee = false;

  if (email && profile) {
    const systemAdminCheck = await checkSystemAdminEmail(supabase, email);
    isInternalEmployee = isEmployeeLoginAllowed(profile, {
      isSystemAdminEmail: systemAdminCheck.isSystemAdmin,
    });
  }

  const hasActiveClientAccount = clientSession.kind === "active";
  const isClientOnly = hasActiveClientAccount && !isInternalEmployee;

  return {
    userId: user.id,
    email,
    hasProfile: Boolean(profile),
    hasActiveClientAccount,
    isInternalEmployee,
    isClientOnly,
  };
}

export function decideInternalRouteAccess(
  pathname: string,
  context: AuthAccessContext
): InternalAccessDecision {
  if (!isInternalProtectedPath(pathname)) {
    return "internal_allowed";
  }

  if (!context.userId || !context.email) {
    return "login_required";
  }

  if (context.isClientOnly) {
    return "client_redirect_portal";
  }

  if (context.isInternalEmployee) {
    return "internal_allowed";
  }

  return "login_required";
}

export async function enforceInternalPageAccess(
  supabase: SupabaseClient,
  pathname: string
): Promise<InternalAccessDecision> {
  const context = await resolveAuthAccessContext(supabase);
  const decision = decideInternalRouteAccess(pathname, context);
  logInternalAccessGuard(pathname, context, decision);
  return decision;
}

/** Server layout/page guard — redirect dřív než se vykreslí interní UI. */
export async function requireInternalEmployeePage(sectionLabel = "internal-section") {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const context = await resolveAuthAccessContext(supabase);

  if (!context.userId || !context.email) {
    logInternalAccessGuard(sectionLabel, context, "login_required");
    redirect("/login?error=not_allowed");
  }

  if (context.isClientOnly) {
    logInternalAccessGuard(sectionLabel, context, "client_redirect_portal");
    redirect("/portal");
  }

  if (!context.isInternalEmployee) {
    logInternalAccessGuard(sectionLabel, context, "login_required");
    redirect("/login?error=not_allowed");
  }

  logInternalAccessGuard(sectionLabel, context, "internal_allowed");
}

export async function isInternalEmployeeAllowed(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const context = await resolveAuthAccessContext(supabase);
  return context.userId === userId && context.email === email && context.isInternalEmployee;
}

export async function isActiveClientOnlyUser(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const context = await resolveAuthAccessContext(supabase);
  return context.userId === userId && context.email === email && context.isClientOnly;
}

export async function assertInternalApiAccess(
  supabase: SupabaseClient
): Promise<
  | { ok: true; context: AuthAccessContext }
  | { ok: false; status: 401 | 403; decision: InternalAccessDecision }
> {
  const context = await resolveAuthAccessContext(supabase);

  if (!context.userId) {
    logInternalAccessGuard("/api", context, "login_required");
    return { ok: false, status: 401, decision: "login_required" };
  }

  if (context.isClientOnly) {
    logInternalAccessGuard("/api", context, "client_redirect_portal");
    return { ok: false, status: 403, decision: "client_redirect_portal" };
  }

  if (!context.isInternalEmployee) {
    logInternalAccessGuard("/api", context, "forbidden");
    return { ok: false, status: 403, decision: "login_required" };
  }

  logInternalAccessGuard("/api", context, "internal_allowed");
  return { ok: true, context };
}
