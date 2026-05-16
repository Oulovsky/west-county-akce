import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

function isPublicPath(pathname: string) {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/dotaznik/")) return true;
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

  return NextResponse.redirect(redirectUrl);
}

export async function proxy(req: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = req.nextUrl.pathname;
  if (!user && !isPublicPath(pathname)) {
    const nextPath = `${pathname}${req.nextUrl.search}`;
    return redirectToLogin(req, { next: nextPath });
  }

  if (user && !isPublicPath(pathname)) {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return redirectToLogin(req, { error: "not_allowed" });
    }

    const { data: allowed, error: allowedError } = await supabase
      .from("povolene_emaily")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (allowedError || !allowed) {
      return redirectToLogin(req, { error: "not_allowed" });
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
