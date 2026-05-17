import { formatDateTime, formatMoney } from "@/lib/sklad/helpers";
import type { SkladDetailRow } from "@/lib/sklad/types";
import { InfoRow } from "./InfoRow";

type SkladDetailFinanceProps = {
  row: SkladDetailRow;
};

export function SkladDetailFinance({ row }: SkladDetailFinanceProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">Finance</h2>

      <div className="grid gap-3 text-sm text-slate-200">
        <InfoRow label="Cena pro akce">{formatMoney(row.interni_naklad)}</InfoRow>
        <InfoRow label="Vytvořeno">{formatDateTime(row.vytvoreno_dne)}</InfoRow>
        <InfoRow label="Upraveno">{formatDateTime(row.upraveno_dne)}</InfoRow>
      </div>
    </section>
  );
}
