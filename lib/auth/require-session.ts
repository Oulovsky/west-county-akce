import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertInternalApiAccess,
  logInternalAccessGuard,
  resolveAuthAccessContext,
} from "@/lib/auth/internal-access-server";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";
import { checkSystemAdminEmail } from "@/lib/auth/admin-access";

export type RequireSessionResult =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createClient>>;
      user: {
        id: string;
        email?: string | null;
      };
      email: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireSession(): Promise<RequireSessionResult> {
  const supabase = await createClient();

  await supabase.auth.getSession();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const email = user.email?.trim().toLowerCase();

  if (!email) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const apiAccess = await assertInternalApiAccess(supabase);
  if (!apiAccess.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: apiAccess.status === 401 ? "Unauthorized" : "Forbidden" },
        { status: apiAccess.status }
      ),
    };
  }

  const { data: profile, error: profileError } = await loadEmployeeProfile(
    supabase,
    user.id
  );

  if (profileError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authorization check failed" },
        { status: 500 }
      ),
    };
  }

  const systemAdminCheck = await checkSystemAdminEmail(supabase, email);
  const loginAllowed =
    profile &&
    isEmployeeLoginAllowed(profile, {
      isSystemAdminEmail: systemAdminCheck.isSystemAdmin,
    });

  if (!loginAllowed) {
    const context = await resolveAuthAccessContext(supabase);
    logInternalAccessGuard("/api", context, "forbidden");
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    supabase,
    user,
    email,
  };
}
