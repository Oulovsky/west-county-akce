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
      ? "border-green-200 bg-green-50 text-green-800"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`min-w-[260px] max-w-[360px] rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm ${toneClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium">{message}</div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs opacity-70 transition hover:opacity-100"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}