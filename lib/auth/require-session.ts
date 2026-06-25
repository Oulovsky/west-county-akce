import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  assertInternalApiAccess,
  resolveAuthAccessContext,
} from "@/lib/auth/internal-access-server";

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

  const context = await resolveAuthAccessContext(supabase);
  if (!context.isInternalEmployee) {
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
