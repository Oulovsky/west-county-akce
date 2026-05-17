"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
};

export default function Toast({ message, type = "success", onClose }: Props) {
  useEffect(() => {
    const timeout = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [onClose]);

  const toneClass =
    type === "success"
      ? "border-emerald-500/40 bg-emerald-950/95 text-emerald-100"
      : "border-red-500/40 bg-red-950/95 text-red-100";

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-4">
      <div
        className={`w-full rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm sm:w-auto sm:min-w-[260px] sm:max-w-[360px] ${toneClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium">{message}</div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-1 text-xs opacity-70 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}