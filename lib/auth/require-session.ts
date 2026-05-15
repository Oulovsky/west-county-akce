import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: allowed, error: allowedError } = await supabase
    .from("povolene_emaily")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (allowedError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authorization check failed" },
        { status: 500 }
      ),
    };
  }

  if (!allowed) {
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