"use client";

type Props = {
  children: React.ReactNode;
};

export function SkladTableWrapper({ children }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
