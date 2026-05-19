import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";

function serializeSupabaseError(err: unknown) {
  if (!err || typeof err !== "object") return err;
  const o = err as Record<string, unknown>;
  return {
    message: o.message,
    code: o.code,
    details: o.details,
    hint: o.hint,
  };
}

/**
 * Dočasný diagnostický endpoint (odstraň po vyřešení produkčního loginu).
 */
export async function GET() {
  const supabase = await createClient();

  await supabase.auth.getSession();

  const {
    data: { user },
    error: authUserError,
  } = await supabase.auth.getUser();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const rawEmail = user?.email ?? null;
  const normalizedEmail =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : null;

  const profileResult = user?.id
    ? await loadEmployeeProfile(supabase, user.id)
    : { data: null, error: null as unknown };

  const loginAllowed = profileResult.data
    ? isEmployeeLoginAllowed(profileResult.data)
    : false;

  return NextResponse.json({
    note: "Přihlášení: proxy používá NEXT_PUBLIC_SUPABASE_ANON_KEY + profiles (ne povolene_emaily).",
    supabaseClient: {
      usesAnonKey: true,
      anonKeyPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseUrlPresent: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    authUid: user?.id ?? null,
    authUser: user
      ? {
          id: user.id,
          email: user.email,
          app_metadata: user.app_metadata,
          user_metadata: user.user_metadata,
        }
      : null,
    authUserError: serializeSupabaseError(authUserError),
    session: {
      exists: Boolean(session),
      expires_at: session?.expires_at ?? null,
      user_id: session?.user.id ?? null,
    },
    sessionError: serializeSupabaseError(sessionError),
    emailRaw: rawEmail,
    emailNormalized: normalizedEmail,
    profiles: {
      maybeSingle_by_user_id: {
        data: profileResult.data,
        error: serializeSupabaseError(profileResult.error),
      },
      isEmployeeLoginAllowed: loginAllowed,
    },
  });
}
