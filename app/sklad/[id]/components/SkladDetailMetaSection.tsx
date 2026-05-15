import { formatDateTime } from "@/lib/sklad/helpers";
import type { SkladDetailRow } from "@/lib/sklad/types";
import { InfoRow } from "./InfoRow";

type SkladDetailMetaSectionProps = {
  row: SkladDetailRow;
};

export function SkladDetailMetaSection({ row }: SkladDetailMetaSectionProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">Další</h2>

      <div className="grid gap-3 text-sm text-slate-200">
        <InfoRow label="Poznámka" gridClassName="grid-cols-[120px_1fr]">
          {row.poznamka ?? "-"}
        </InfoRow>
        <InfoRow label="Vytvořeno" gridClassName="grid-cols-[120px_1fr]">
          {formatDateTime(row.vytvoreno_dne)}
        </InfoRow>
        <InfoRow label="Upraveno" gridClassName="grid-cols-[120px_1fr]">
          {formatDateTime(row.upraveno_dne)}
        </InfoRow>
      </div>
    </section>
  );
}
