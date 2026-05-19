import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type RequireSessionResult =
  | {
      ok: true;
      supabase: SupabaseServerClient;
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

  if (!profile || !isEmployeeLoginAllowed(profile)) {
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
