"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

  if (pathname.startsWith("/dotaznik/")) {
    return null;
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <nav className="flex items-center gap-2">
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

      <NavLink href="/admin" danger>
        Admin
      </NavLink>

      <button
        onClick={() => void handleLogout()}
        className="ml-4 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
      >
        Odhlásit
      </button>
    </nav>
  );
}
