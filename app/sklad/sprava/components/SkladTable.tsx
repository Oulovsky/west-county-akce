"use client";

import { ReactNode } from "react";
import { SkladLoading } from "./SkladLoading";
import { SkladTableHeader } from "./SkladTableHeader";
import { SPRAVA_TABLE_MIN_WIDTH } from "./spravaTableLayout";

type Props = {
  loading: boolean;
  children: ReactNode;
};

export function SkladTable({ loading, children }: Props) {
  if (loading) {
    return <SkladLoading />;
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="overflow-x-auto">
        <div style={{ width: SPRAVA_TABLE_MIN_WIDTH, minWidth: SPRAVA_TABLE_MIN_WIDTH }}>
          <SkladTableHeader />
          {children}
        </div>
      </div>
    </div>
  );
}
