"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveAppAdminAccess, resolveAppAdminOrSefAccess } from "@/lib/auth/admin-access";
import { useProfileRole } from "@/lib/auth/use-profile-role";
import { subscribeNotificationsUnreadChanged } from "@/lib/notifications/unread-count-sync";
import { supabase } from "@/lib/supabase";

function NavLink({
  href,
  children,
  danger = false,
  exact = false,
  badgeCount = 0,
}: {
  href: string;
  children: React.ReactNode;
  danger?: boolean;
  exact?: boolean;
  badgeCount?: number;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active =
    mounted &&
    (exact
      ? pathname === href
      : pathname === href || pathname.startsWith(href + "/"));

  const base = "rounded-md border px-3 py-2 text-sm transition";
  const activeClass = danger
    ? "border-red-500 bg-red-600/20 text-red-200"
    : "border-blue-500 bg-blue-600/20 text-white";
  const idleClass = danger
    ? "border-transparent text-slate-300 hover:bg-red-600/10 hover:text-red-200"
    : "border-transparent text-slate-300 hover:bg-blue-600/10 hover:text-blue-200";

  return (
    <Link href={href} className={`relative ${base} ${active ? activeClass : idleClass}`}>
      {children}
      {badgeCount > 0 ? (
        <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-amber-500 px-1.5 py-0.5 text-center text-[11px] font-black text-slate-950">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

export default function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingPoptavkyCount, setPendingPoptavkyCount] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPoptavkyInbox, setShowPoptavkyInbox] = useState(false);
  const { nav } = useProfileRole();

  useEffect(() => {
    let active = true;

    async function loadNavAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setShowAdmin(false);
        setShowPoptavkyInbox(false);
        setPendingPoptavkyCount(0);
        return;
      }

      const [isAdmin, canManagePoptavky] = await Promise.all([
        resolveAppAdminAccess(supabase, user.id, user.email),
        resolveAppAdminOrSefAccess(supabase, user.id, user.email),
      ]);
      if (!active) return;
      setShowAdmin(isAdmin);
      setShowPoptavkyInbox(canManagePoptavky);

      const queries = [
        supabase
          .from("notifikace")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .is("read_at", null)
          .is("dismissed_at", null),
      ];

      if (canManagePoptavky) {
        queries.push(
          supabase
            .from("poptavky")
            .select("poptavka_id", { count: "exact", head: true })
            .in("stav", ["odeslana", "ceka_na_schvaleni"])
        );
      }

      const [notificationsResult, pendingPoptavkyResult] = await Promise.all(queries);

      if (!active) return;

      if (!notificationsResult.error) {
        setUnreadCount(notificationsResult.count ?? 0);
      }

      if (canManagePoptavky && pendingPoptavkyResult && !pendingPoptavkyResult.error) {
        setPendingPoptavkyCount(pendingPoptavkyResult.count ?? 0);
      } else {
        setPendingPoptavkyCount(0);
      }
    }

    void loadNavAccess();
    const interval = window.setInterval(() => void loadNavAccess(), 60000);
    const unsubscribe = subscribeNotificationsUnreadChanged(() => void loadNavAccess());
    return () => {
      active = false;
      window.clearInterval(interval);
      unsubscribe();
    };
  }, [pathname]);

  if (pathname.startsWith("/dotaznik/")) {
    return null;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <nav className="flex items-center gap-2">
      {nav.showMoje ? (
        <NavLink href="/moje" exact>
          Moje
        </NavLink>
      ) : null}

      {nav.showDashboard ? (
        <NavLink href="/dashboard" exact>
          Dashboard
        </NavLink>
      ) : null}

      {nav.showKalendar ? (
        <NavLink href="/kalendar" exact>
          Kalendář
        </NavLink>
      ) : null}

      {nav.showZakazky ? (
        <NavLink href="/zakazky" exact>
          Zakázky
        </NavLink>
      ) : null}

      {showPoptavkyInbox ? (
        <NavLink href="/zakazky/poptavky" badgeCount={pendingPoptavkyCount}>
          Poptávky
        </NavLink>
      ) : null}

      {nav.showMista ? (
        <NavLink href="/mista">
          Místa
        </NavLink>
      ) : null}

      {nav.showSkladSprava ? (
        <NavLink href="/sklad/sprava" exact>
          Správa skladu
        </NavLink>
      ) : null}

      {nav.showSkladSetupy ? (
        <NavLink href="/sklad/setupy">
          Setupy
        </NavLink>
      ) : null}

      {showAdmin ? (
        <NavLink href="/admin" danger>
          Admin
        </NavLink>
      ) : null}

      {nav.showNotifikace ? (
        <Link
          href="/notifikace"
          className="relative rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 transition hover:bg-blue-600/10 hover:text-blue-100"
          title="Notifikace"
        >
          Upozornění
          {unreadCount > 0 ? (
            <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-black text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Link>
      ) : null}

      <button
        onClick={() => void handleLogout()}
        className="ml-4 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
      >
        Odhlásit
      </button>
    </nav>
  );
}
