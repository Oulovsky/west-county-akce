"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_HOME_PATH, MOBILE_SCAN_PICKER_PATH } from "@/lib/mobile/routes";

function resolveTitle(pathname: string) {
  if (pathname === MOBILE_HOME_PATH) return "Přehled";
  if (pathname === MOBILE_SCAN_PICKER_PATH) return "Scan";
  if (pathname === "/moje" || pathname.startsWith("/moje/")) return "Moje zakázky";
  if (pathname === "/dochazka") return "Docházka";
  if (pathname === "/notifikace") return "Upozornění";
  if (pathname === "/sklad/scan") return "Scan skladu";
  if (pathname === "/mobile/profil") return "Profil";
  if (pathname.startsWith("/zakazky/") && pathname.endsWith("/scan")) return "Scan zakázky";
  if (pathname.startsWith("/zakazky/")) return "Zakázka";
  return "WEST COUNTY";
}

export default function MobileTopBar() {
  const pathname = usePathname();
  const title = resolveTitle(pathname);
  const showHomeLink = pathname !== MOBILE_HOME_PATH;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md lg:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300/80">
            LITE
          </div>
          <h1 className="truncate text-base font-black text-white">{title}</h1>
        </div>
        {showHomeLink ? (
          <Link
            href={MOBILE_HOME_PATH}
            className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-blue-500/50 hover:bg-blue-600/10 hover:text-blue-100"
          >
            Domů
          </Link>
        ) : (
          <span className="shrink-0 rounded-xl border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-500">
            Terén
          </span>
        )}
      </div>
    </header>
  );
}
