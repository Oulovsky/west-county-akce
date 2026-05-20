import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
  OAUTH_PROFILE_GATE_COOKIE,
} from "@/lib/auth/employee-access";
import { getSafeNextPath } from "@/lib/auth/oauth-redirect";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/dotaznik/")) return true;
  if (pathname.startsWith("/schvaleni/")) return true;
  if (pathname.startsWith("/faktura-render/")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;

  return false;
}

function redirectToLogin(req: NextRequest, params: Record<string, string>) {
  const redirectUrl = req.nextUrl.clone();

  redirectUrl.pathname = "/login";
  redirectUrl.search = "";

  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }

  const res = NextResponse.redirect(redirectUrl);
  if (params.error === "not_allowed") {
    res.cookies.set(OAUTH_PROFILE_GATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const oauthCode = req.nextUrl.searchParams.get("code");

  if (oauthCode && !pathname.startsWith("/auth/callback")) {
    const callbackUrl = req.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.search = "";
    callbackUrl.searchParams.set("code", oauthCode);
    const nextFromQuery = req.nextUrl.searchParams.get("next");
    const nextFallback =
      pathname === "/" ? "/zakazky" : `${pathname}${req.nextUrl.search}`;
    callbackUrl.searchParams.set(
      "next",
      getSafeNextPath(nextFromQuery ?? nextFallback)
    );
    return NextResponse.redirect(callbackUrl);
  }

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  await supabase.auth.getSession();

  let {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user && session?.user) {
    user = session.user;
  }

  const oauthGate = req.cookies.get(OAUTH_PROFILE_GATE_COOKIE)?.value === "1";

  if (!user && oauthGate && !isPublicPath(pathname)) {
    await supabase.auth.getSession();
    const {
      data: { user: uAfter },
    } = await supabase.auth.getUser();
    user = uAfter ?? user;
    if (!user) {
      const {
        data: { session: s2 },
      } = await supabase.auth.getSession();
      user = s2?.user ?? null;
    }
  }

  if (!user && !isPublicPath(pathname)) {
    const nextPath = `${pathname}${req.nextUrl.search}`;
    return redirectToLogin(req, { next: nextPath });
  }

  if (user && !isPublicPath(pathname)) {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return redirectToLogin(req, { error: "not_allowed" });
    }

    let { data: profile } = await loadEmployeeProfile(supabase, user.id);

    if ((!profile || !isEmployeeLoginAllowed(profile)) && oauthGate) {
      await supabase.auth.getSession();
      const {
        data: { user: refreshedUser },
      } = await supabase.auth.getUser();
      if (refreshedUser) {
        user = refreshedUser;
      }
      const reread = await loadEmployeeProfile(supabase, user.id);
      profile = reread.data;
      res.cookies.set(OAUTH_PROFILE_GATE_COOKIE, "", {
        path: "/",
        maxAge: 0,
      });
    }

    if (!profile || !isEmployeeLoginAllowed(profile)) {
      return redirectToLogin(req, { error: "not_allowed" });
    }

    res.cookies.set(OAUTH_PROFILE_GATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
