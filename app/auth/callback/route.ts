import { createClient } from "@/lib/supabase/server";
import { OAUTH_PROFILE_GATE_COOKIE } from "@/lib/auth/employee-access";
import {
  getAppBaseUrlFromRequest,
  getSafeNextPath,
} from "@/lib/auth/oauth-redirect";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const baseUrl = getAppBaseUrlFromRequest(request);

  if (code) {
    const supabase = await createClient();

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth exchange error:", error);
    }
  }

  const destination = new URL(nextPath, baseUrl);
  destination.search = "";

  const res = NextResponse.redirect(destination);

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
