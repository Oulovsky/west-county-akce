"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  getActiveMobileZakazkaTab,
  getDochazkaPath,
  getMojeZakazkaDetailPath,
  getWorkflowZakazkaId,
  getZakazkaScanPath,
  shouldShowMobileZakazkaWorkflowBar,
  type MobileZakazkaWorkflowTab,
} from "@/lib/mobile/routes";

function WorkflowButton({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[3rem] flex-1 items-center justify-center rounded-2xl px-2 text-sm font-black transition active:scale-[0.98] ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
          : "border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}

const TAB_LABELS: Record<MobileZakazkaWorkflowTab, string> = {
  detail: "Zakázka",
  scan: "Scan",
  dochazka: "Docházka",
};

export function MobileZakazkaWorkflowBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const zakazkaId = getWorkflowZakazkaId(pathname, searchParams.get("zakazka"));
  const activeTab = getActiveMobileZakazkaTab(pathname, zakazkaId);

  if (!shouldShowMobileZakazkaWorkflowBar(pathname, zakazkaId, activeTab) || !zakazkaId || !activeTab) {
    return null;
  }

  const tabs: Array<{ key: MobileZakazkaWorkflowTab; href: string }> = [
    { key: "detail", href: getMojeZakazkaDetailPath(zakazkaId) },
    { key: "scan", href: getZakazkaScanPath(zakazkaId) },
    { key: "dochazka", href: getDochazkaPath(zakazkaId) },
  ];

  return (
    <div
      className="mobile-workflow-bar fixed inset-x-0 z-[45] border-t border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur-md lg:hidden"
      style={{ bottom: "calc(var(--mobile-bottom-nav-height) + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
        {tabs.map((tab) => (
          <WorkflowButton
            key={tab.key}
            href={tab.href}
            label={TAB_LABELS[tab.key]}
            active={activeTab === tab.key}
          />
        ))}
      </div>
    </div>
  );
}
