"use client";

import { reportSkladKusDamageAction } from "@/app/sklad/kus/[kus_id]/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

type SkladKusReportDamageFormProps = {
  kusId: string;
  skladovaPolozkaId: string;
};

export function SkladKusReportDamageForm({
  kusId,
  skladovaPolozkaId,
}: SkladKusReportDamageFormProps) {
  return (
    <form
      action={reportSkladKusDamageAction}
      className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3"
    >
      <input type="hidden" name="kus_id" value={kusId} />
      <input type="hidden" name="skladova_polozka_id" value={skladovaPolozkaId} />
      <label className="text-sm font-semibold text-amber-100">
        Nahlásit poškození
        <textarea
          name="note"
          required
          rows={3}
          placeholder="Co je poškozené? Kdy a jak se to zjistilo?"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
        />
      </label>
      <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-100">
        <input type="checkbox" name="blocks_use" value="true" className="h-4 w-4" />
        Blokuje použití
      </label>
      <SubmitButton
        pendingText="Ukládám…"
        className="mt-3 min-h-12 w-full rounded-xl bg-amber-700 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-600 disabled:hover:bg-amber-700"
      >
        Nahlásit poškození
      </SubmitButton>
    </form>
  );
}
