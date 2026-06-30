import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { checkSystemAdminEmail } from "@/lib/auth/admin-access";
import {
  emailsMatchForAuthComparison,
  getAuthEmailDisplayValue,
} from "@/lib/auth/normalize-auth-email";
import { loadClientPortalSession } from "@/lib/auth/client-portal-access-server";
import {
  getAuthProvidersFromUser,
  isEmployeeLoginAllowed,
  isProvisionedInternalProfile,
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
  authProviders: string[];
  hasProfile: boolean;
  profileRole: string | null;
  profileAktivni: boolean | null;
  profileProvisioned: boolean;
  employeeLoginAllowed: boolean;
  hasActiveClientAccount: boolean;
  isInternalEmployee: boolean;
  isClientOnly: boolean;
};

function emptyContext(): AuthAccessContext {
  return {
    userId: null,
    email: null,
    authProviders: [],
    hasProfile: false,
    profileRole: null,
    profileAktivni: null,
    profileProvisioned: false,
    employeeLoginAllowed: false,
    hasActiveClientAccount: false,
    isInternalEmployee: false,
    isClientOnly: false,
  };
}

export function logInternalAccessGuard(
  path: string,
  context: AuthAccessContext,
  decision: InternalAccessDecision
) {
  console.info("[internal-access-guard]", {
    path,
    userId: context.userId,
    email: context.email,
    providers: context.authProviders,
    hasProfile: context.hasProfile,
    profileRole: context.profileRole,
    profileAktivni: context.profileAktivni,
    profileProvisioned: context.profileProvisioned,
    employeeLoginAllowed: context.employeeLoginAllowed,
    hasActiveClientAccount: context.hasActiveClientAccount,
    decision,
  });
}

function buildAuthAccessContext(
  user: User | null,
  profile: Awaited<ReturnType<typeof loadEmployeeProfile>>["data"],
  hasActiveClientAccount: boolean,
  isSystemAdminEmail: boolean
): AuthAccessContext {
  if (!user) {
    return emptyContext();
  }

  const email = getAuthEmailDisplayValue(user.email);
  const authProviders = getAuthProvidersFromUser(user);
  const profileRole = profile?.role ?? null;
  const profileProvisioned = isProvisionedInternalProfile(profile ?? null);
  const employeeLoginAllowed = isEmployeeLoginAllowed(profile ?? null, {
    isSystemAdminEmail,
    authProviders,
    hasActiveClientAccount,
  });

  const isInternalEmployee = employeeLoginAllowed;
  const isClientOnly = hasActiveClientAccount && !isInternalEmployee;

  return {
    userId: user.id,
    email,
    authProviders,
    hasProfile: Boolean(profile),
    profileRole,
    profileAktivni: profile?.aktivni ?? null,
    profileProvisioned,
    employeeLoginAllowed,
    hasActiveClientAccount,
    isInternalEmployee,
    isClientOnly,
  };
}

export async function resolveAuthAccessContext(
  supabase: SupabaseClient
): Promise<AuthAccessContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return emptyContext();
  }

  const displayEmail = getAuthEmailDisplayValue(user.email);
  const [{ data: profile }, clientSession, systemAdminCheck] = await Promise.all([
    loadEmployeeProfile(supabase, user.id),
    loadClientPortalSession(supabase),
    displayEmail
      ? checkSystemAdminEmail(supabase, displayEmail)
      : Promise.resolve({ isSystemAdmin: false, error: null }),
  ]);

  const hasActiveClientAccount = clientSession.kind === "active";

  return buildAuthAccessContext(
    user,
    profile,
    hasActiveClientAccount,
    systemAdminCheck.isSystemAdmin
  );
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

  if (context.hasActiveClientAccount && !context.isInternalEmployee) {
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

  if (context.hasActiveClientAccount && !context.isInternalEmployee) {
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
  return (
    context.userId === userId &&
    emailsMatchForAuthComparison(context.email, email) &&
    context.isInternalEmployee
  );
}

export async function isActiveClientOnlyUser(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<boolean> {
  const context = await resolveAuthAccessContext(supabase);
  return (
    context.userId === userId &&
    emailsMatchForAuthComparison(context.email, email) &&
    context.isClientOnly
  );
}

export async function assertInternalApiAccess(
  supabase: SupabaseClient
): Promise<
  | { ok: true; context: AuthAccessContext }
  | { ok: false; status: 401 | 403; decision: InternalAccessDecision }
> {
  const context = await resolveAuthAccessContext(supabase);
  const decision = decideInternalRouteAccess("/api/internal", context);

  if (!context.userId) {
    logInternalAccessGuard("/api", context, "login_required");
    return { ok: false, status: 401, decision: "login_required" };
  }

  if (context.hasActiveClientAccount && !context.isInternalEmployee) {
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
