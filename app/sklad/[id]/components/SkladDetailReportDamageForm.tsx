import { getKusLabel, slugifyCz } from "@/lib/sklad/helpers";
import type {
  SkladKusRow,
  SkladPrioritaOption,
  SkladTypPoskozeniOption,
} from "@/lib/sklad/types";

type SkladDetailReportDamageFormProps = {
  skladovaPolozkaId: string;
  kusy: SkladKusRow[];
  typyPoskozeni: SkladTypPoskozeniOption[];
  priority: SkladPrioritaOption[];
  reportAction: (formData: FormData) => Promise<void>;
};

export function SkladDetailReportDamageForm({
  skladovaPolozkaId,
  kusy,
  typyPoskozeni,
  priority,
  reportAction,
}: SkladDetailReportDamageFormProps) {
  return (
    <form action={reportAction} className="grid gap-4">
      <input type="hidden" name="skladova_polozka_id" value={skladovaPolozkaId} />

      <div>
        <div className="mb-2 text-sm text-slate-300">Konkrétní kus</div>
        <select
          name="kus_id"
          required
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
        >
          <option value="">Vyber kus</option>
          {kusy.map((kus) => (
            <option key={kus.kus_id} value={kus.kus_id}>
              {getKusLabel(kus)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-sm text-slate-300">Typ poškození</div>
          <select
            name="typ_poskozeni"
            defaultValue={slugifyCz(typyPoskozeni[0]?.nazev ?? "mechanické")}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            {typyPoskozeni.length > 0 ? (
              typyPoskozeni.map((item) => (
                <option key={item.typ_id} value={slugifyCz(item.nazev)}>
                  {item.nazev}
                </option>
              ))
            ) : (
              <>
                <option value="mechanicke">mechanické</option>
                <option value="elektricke">elektrické</option>
                <option value="vizualni">vizuální</option>
                <option value="jine">jiné</option>
              </>
            )}
          </select>
        </div>

        <div>
          <div className="mb-2 text-sm text-slate-300">Priorita</div>
          <select
            name="priorita"
            defaultValue={slugifyCz(priority[1]?.nazev ?? priority[0]?.nazev ?? "střední")}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
          >
            {priority.length > 0 ? (
              priority.map((item) => (
                <option key={item.priorita_id} value={slugifyCz(item.nazev)}>
                  {item.nazev}
                </option>
              ))
            ) : (
              <>
                <option value="nizka">nízká</option>
                <option value="stredni">střední</option>
                <option value="vysoka">vysoká</option>
                <option value="kriticka">kritická</option>
              </>
            )}
          </select>
        </div>
      </div>

      <label className="inline-flex w-fit items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
        <input type="checkbox" name="blokuje_pouziti" value="true" defaultChecked className="h-4 w-4" />
        <span>Blokuje použití</span>
      </label>

      <div>
        <div className="mb-2 text-sm text-slate-300">Popis</div>
        <textarea
          name="popis"
          rows={5}
          placeholder="Co je poškozené, jak se to projevuje..."
          className="min-h-[120px] w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl border border-amber-700 bg-amber-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Nahlásit poškození
        </button>
      </div>
    </form>
  );
}
