"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { checkSystemAdminEmail } from "@/lib/auth/admin-access";
import {
  getAuthProvidersFromUser,
  isEmployeeLoginAllowed,
  loadEmployeeProfile,
} from "@/lib/auth/employee-access";
import { isInternalProtectedPath } from "@/lib/auth/internal-routes";
import { isPublicAppPath } from "@/lib/public-routes";

type AuthStatus = "loading" | "authorized" | "public" | "unauthorized";

function isPublicPath(pathname: string) {
  return isPublicAppPath(pathname);
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

      if (pathname.startsWith("/dotaznik/") || isPublicPath(pathname)) {
        setStatus("public");
        return;
      }

      if (!session) {
        if (isPublicPath(pathname)) {
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

      const [{ data: clientAccount }, { data: profile }] = await Promise.all([
        supabase
          .from("client_accounts")
          .select("account_id, stav, klient_id")
          .eq("user_id", session.user.id)
          .maybeSingle(),
        loadEmployeeProfile(supabase, session.user.id),
      ]);

      const hasActiveClientAccount =
        clientAccount?.stav === "active" && Boolean(clientAccount.klient_id);

      const systemAdminCheck = await checkSystemAdminEmail(supabase, email);
      const authProviders = getAuthProvidersFromUser(session.user);
      const employeeLoginAllowed = isEmployeeLoginAllowed(profile ?? null, {
        isSystemAdminEmail: systemAdminCheck.isSystemAdmin,
        authProviders,
        hasActiveClientAccount,
      });

      const isClientOnly = hasActiveClientAccount && !employeeLoginAllowed;

      if (isClientOnly && isInternalProtectedPath(pathname)) {
        if (!mounted) return;
        setStatus("unauthorized");
        router.replace("/portal");
        return;
      }

      if (!employeeLoginAllowed) {
        if (hasActiveClientAccount) {
          if (!mounted) return;
          setStatus("unauthorized");
          router.replace("/portal");
          return;
        }

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

      if (isPublicPath(pathname)) {
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
