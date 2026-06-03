"use client";

import { updateSkladKusAssetValueAction } from "@/app/sklad/kus/[kus_id]/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { SkladKusRow, SkladOdpisovePasmo } from "@/lib/sklad/types";

type SkladKusAssetValueFormProps = {
  kus: SkladKusRow;
  odpisovaPasma: SkladOdpisovePasmo[];
};

export function SkladKusAssetValueForm({ kus, odpisovaPasma }: SkladKusAssetValueFormProps) {
  return (
    <form
      action={updateSkladKusAssetValueAction}
      className="mt-4 grid gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="kus_id" value={kus.kus_id} />
      <label className="block text-sm font-semibold text-slate-200">
        Pořizovací hodnota / hodnota kusu
        <input
          name="porizovaci_hodnota"
          defaultValue={kus.porizovaci_hodnota ?? ""}
          inputMode="decimal"
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-200">
        Datum pořízení
        <input
          name="datum_porizeni"
          type="date"
          defaultValue={kus.datum_porizeni ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-200">
        Odpisové pásmo
        <select
          name="odpisove_pasmo_id"
          defaultValue={kus.odpisove_pasmo_id ?? ""}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">Bez odpisového pásma</option>
          {odpisovaPasma.map((pasmo) => (
            <option key={pasmo.odpisove_pasmo_id} value={pasmo.odpisove_pasmo_id}>
              {pasmo.nazev} · {pasmo.pocet_mesicu} měsíců{pasmo.aktivni ? "" : " · neaktivní"}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <SubmitButton
          pendingText="Ukládám…"
          className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600 disabled:hover:bg-blue-700"
        >
          Uložit hodnotu kusu
        </SubmitButton>
      </div>
    </form>
  );
}
