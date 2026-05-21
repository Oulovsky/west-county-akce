"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveAppAdminAccess } from "@/lib/auth/admin-access";
import { supabase } from "@/lib/supabase";

function NavLink({
  href,
  children,
  danger = false,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  danger?: boolean;
  exact?: boolean;
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
    <Link href={href} className={`${base} ${active ? activeClass : idleClass}`}>
      {children}
    </Link>
  );
}

export default function SidebarNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadNavAccess() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setShowAdmin(false);
        return;
      }

      const isAdmin = await resolveAppAdminAccess(
        supabase,
        user.id,
        user.email
      );
      if (!active) return;
      setShowAdmin(isAdmin);

      const { count, error } = await supabase
        .from("notifikace")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null)
        .is("dismissed_at", null);

      if (!active || error) return;
      setUnreadCount(count ?? 0);
    }

    void loadNavAccess();
    const interval = window.setInterval(() => void loadNavAccess(), 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
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
      <NavLink href="/moje" exact>
        Moje
      </NavLink>

      <NavLink href="/dashboard" exact>
        Dashboard
      </NavLink>

      <NavLink href="/kalendar" exact>
        Kalendář
      </NavLink>

      <NavLink href="/zakazky" exact>
        Zakázky
      </NavLink>

      <NavLink href="/mista">
        Místa
      </NavLink>

      <NavLink href="/sklad/sprava" exact>
        Správa skladu
      </NavLink>

      <NavLink href="/sklad/setupy">
        Setupy
      </NavLink>

      {showAdmin ? (
        <NavLink href="/admin" danger>
          Admin
        </NavLink>
      ) : null}

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

      <button
        onClick={() => void handleLogout()}
        className="ml-4 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
      >
        Odhlásit
      </button>
    </nav>
  );
}
