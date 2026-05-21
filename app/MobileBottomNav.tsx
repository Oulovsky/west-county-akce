"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useActiveZakazkaId } from "@/components/mobile/useActiveZakazkaId";
import {
  getMobileDochazkaNavHref,
  getMobileScanNavHref,
  MOBILE_NAV_ITEMS,
} from "@/lib/mobile/routes";
import { supabase } from "@/lib/supabase";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeZakazkaId = useActiveZakazkaId();
  const [unreadCount, setUnreadCount] = useState(0);

  const scanHref = getMobileScanNavHref(pathname, activeZakazkaId);
  const dochazkaHref = getMobileDochazkaNavHref(
    pathname,
    activeZakazkaId,
    searchParams.get("zakazka")
  );

  useEffect(() => {
    let active = true;

    async function loadUnreadCount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (active) setUnreadCount(0);
        return;
      }

      const { count, error } = await supabase
        .from("notifikace")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null)
        .is("dismissed_at", null);

      if (!active || error) return;
      setUnreadCount(count ?? 0);
    }

    void loadUnreadCount();
    const interval = window.setInterval(() => void loadUnreadCount(), 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pathname]);

  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur-md lg:hidden"
      aria-label="Mobilní navigace"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const href =
            item.id === "scan"
              ? scanHref
              : item.id === "dochazka"
                ? dochazkaHref
                : item.href;
          const isActive = item.match(pathname);
          const showBadge = item.id === "upozorneni" && unreadCount > 0;

          return (
            <Link
              key={item.id}
              href={href}
              className={`relative flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-semibold transition ${
                isActive
                  ? "bg-blue-600/20 text-blue-100"
                  : "text-slate-400 hover:bg-slate-900/80 hover:text-slate-200"
              }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {item.id === "zakazky"
                  ? "📋"
                  : item.id === "scan"
                    ? "▣"
                    : item.id === "dochazka"
                      ? "⏱"
                      : item.id === "upozorneni"
                        ? "🔔"
                        : "☰"}
              </span>
              <span>{item.label}</span>
              {showBadge ? (
                <span className="absolute right-1 top-1 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-black text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
