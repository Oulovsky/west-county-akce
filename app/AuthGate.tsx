"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";

type AuthStatus = "loading" | "authorized" | "public" | "unauthorized";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/dotaznik/") ||
    pathname.startsWith("/schvaleni/") ||
    pathname.startsWith("/faktura-render/")
  );
}

export default function AuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let mounted = true;

    setStatus("loading");

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      const publicPath = isPublicPath(pathname);

      if (pathname.startsWith("/dotaznik/")) {
        setStatus("public");
        return;
      }

      if (!session) {
        if (publicPath) {
          setStatus("public");
          return;
        }

        setStatus("unauthorized");
        router.replace("/login");
        return;
      }

      const email = session.user.email?.trim().toLowerCase();
      if (!email) {
        await supabase.auth.signOut();
        if (!mounted) return;
        setStatus("unauthorized");
        router.replace("/login");
        return;
      }

      const { data: profile } = await loadEmployeeProfile(
        supabase,
        session.user.id
      );

      if (!profile || !isEmployeeLoginAllowed(profile)) {
        await supabase.auth.signOut();
        if (!mounted) return;
        setStatus("unauthorized");
        router.replace("/login");
        return;
      }

      if (pathname === "/login") {
        router.replace("/zakazky");
        return;
      }

      if (publicPath) {
        setStatus("public");
        return;
      }

      setStatus("authorized");
    }

    void check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (status === "authorized" || status === "public") {
    return <>{children}</>;
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      Načítání…
    </main>
  );
}
