"use client";

import { updateSkladKusServiceStateAction } from "@/app/sklad/kus/[kus_id]/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

type SkladKusServiceStateFormProps = {
  kusId: string;
  action: string;
  label: string;
  pendingText: string;
  notePlaceholder: string;
  danger?: boolean;
};

export function SkladKusServiceStateForm({
  kusId,
  action,
  label,
  pendingText,
  notePlaceholder,
  danger = false,
}: SkladKusServiceStateFormProps) {
  return (
    <form
      action={updateSkladKusServiceStateAction}
      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3"
    >
      <input type="hidden" name="kus_id" value={kusId} />
      <input type="hidden" name="action" value={action} />
      <textarea
        name="note"
        rows={2}
        placeholder={notePlaceholder}
        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
      />
      <SubmitButton
        pendingText={pendingText}
        className={[
          "mt-2 min-h-12 w-full rounded-xl px-4 py-3 text-sm font-black text-white transition",
          danger
            ? "bg-red-700 hover:bg-red-600 disabled:hover:bg-red-700"
            : "bg-blue-700 hover:bg-blue-600 disabled:hover:bg-blue-700",
        ].join(" ")}
      >
        {label}
      </SubmitButton>
    </form>
  );
}
