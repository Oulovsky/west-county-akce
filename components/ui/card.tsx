import * as React from "react";

export function Card({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-[#081225] p-6 shadow-lg ${className}`.trim()}
    >
      {children}
    </div>
  );
}