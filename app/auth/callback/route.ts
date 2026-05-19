import { createClient } from "@/lib/supabase/server";
import { OAUTH_PROFILE_GATE_COOKIE } from "@/lib/auth/employee-access";
import { NextResponse } from "next/server";

function getSafeNextPath(value: string | null) {
  if (!value) return "/zakazky";
  if (!value.startsWith("/") || value.startsWith("//")) return "/zakazky";
  return value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextPath = getSafeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const res = NextResponse.redirect(`${origin}${nextPath}`);
  if (code) {
    res.cookies.set(OAUTH_PROFILE_GATE_COOKIE, "1", {
      path: "/",
      maxAge: 120,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
