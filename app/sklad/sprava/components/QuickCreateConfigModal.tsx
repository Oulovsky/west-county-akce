"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
  saving: boolean;
  onSubmit: (name: string) => void | Promise<void>;
};

export function QuickCreateConfigModal({
  open,
  onClose,
  title,
  placeholder,
  saving,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setName(""), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={title} widthClassName="max-w-md">
      <div className="grid gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          autoFocus
          disabled={saving}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-blue-500 disabled:opacity-60"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Zrušit
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || !name.trim()}
            className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Ukládám..." : "Vytvořit"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
