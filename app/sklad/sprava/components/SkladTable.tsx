"use client";

import { ReactNode } from "react";
import { SkladLoading } from "./SkladLoading";
import { SkladTableHeader } from "./SkladTableHeader";
import { SpravaTableScrollProvider, useSpravaTableScroll } from "./SpravaTableScrollContext";
import { spravaTableContainerStyle } from "./spravaTableLayout";

type Props = {
  loading: boolean;
  children: ReactNode;
};

function SkladTableBody({ children }: { children: ReactNode }) {
  const { scrollRef } = useSpravaTableScroll()!;

  return (
    <div className="flex min-h-[280px] max-h-[calc(100dvh-var(--sprava-sklad-workspace-top,20rem))] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="shrink-0 overflow-x-auto">
        <div style={spravaTableContainerStyle}>
          <SkladTableHeader />
        </div>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain"
        aria-label="Scrollovatelný katalog skladu"
      >
        <div style={spravaTableContainerStyle}>{children}</div>
      </div>
    </div>
  );
}

export function SkladTable({ loading, children }: Props) {
  if (loading) {
    return <SkladLoading />;
  }

  return (
    <SpravaTableScrollProvider>
      <SkladTableBody>{children}</SkladTableBody>
    </SpravaTableScrollProvider>
  );
}
