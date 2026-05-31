"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal/poptavky", label: "Poptávky" },
  { href: "/portal/zakazky", label: "Zakázky" },
  { href: "/portal/profil", label: "Profil" },
] as const;

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2 sm:gap-3">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:text-sm",
              active
                ? "bg-amber-500/20 text-amber-50"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
