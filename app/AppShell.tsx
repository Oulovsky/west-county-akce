"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AuthGate from "@/app/AuthGate";
import { MobileActiveZakazkaTracker } from "@/components/mobile/MobileActiveZakazkaTracker";
import { MobileZakazkaWorkflowBar } from "@/components/mobile/MobileZakazkaWorkflowBar";
import {
  getActiveMobileZakazkaTab,
  getWorkflowZakazkaId,
  shouldHideAppChrome,
  shouldShowMobileZakazkaWorkflowBar,
} from "@/lib/mobile/routes";
import MobileBottomNav from "./MobileBottomNav";
import MobileTopBar from "./MobileTopBar";
import SidebarNav from "./SidebarNav";

function MobileAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zakazkaId = getWorkflowZakazkaId(pathname, searchParams.get("zakazka"));
  const activeTab = getActiveMobileZakazkaTab(pathname, zakazkaId);
  const hasWorkflowBar = shouldShowMobileZakazkaWorkflowBar(pathname, zakazkaId, activeTab);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="hidden border-b border-slate-800 bg-slate-900/95 lg:block">
        <div className="flex w-full min-w-0 items-center justify-between px-2 py-4 sm:px-3 lg:px-4 2xl:px-5">
          <div className="text-sm font-semibold tracking-wide text-white">WEST COUNTY</div>
          <SidebarNav />
        </div>
      </div>

      <MobileTopBar />
      <main
        className={[
          "mobile-main page-shell w-full px-2 py-4 sm:px-3 lg:px-4 lg:py-5 xl:px-5 2xl:px-6",
          hasWorkflowBar ? "mobile-main--workflow" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <AuthGate>{children}</AuthGate>
      </main>
      <MobileActiveZakazkaTracker />
      <MobileZakazkaWorkflowBar />
      <MobileBottomNav />
    </div>
  );
}

export default function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  if (shouldHideAppChrome(pathname)) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <MobileAppLayout>{children}</MobileAppLayout>
    </Suspense>
  );
}
