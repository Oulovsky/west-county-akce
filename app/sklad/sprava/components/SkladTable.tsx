"use client";

import { ReactNode } from "react";
import { SkladLoading } from "./SkladLoading";
import { SkladTableHeader } from "./SkladTableHeader";

type Props = {
  loading: boolean;
  tableGrid: string;
  children: ReactNode;
};

export function SkladTable({
  loading,
  tableGrid,
  children,
}: Props) {
  if (loading) {
    return <SkladLoading />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <SkladTableHeader tableGrid={tableGrid} />

          {children}
        </div>
      </div>
    </div>
  );
}
