import type { SkladDetailRow, SkladKusRow, SkladPoskozeniRow } from "@/lib/sklad/types";
import type { UpdateKusPoradiResult } from "../actions/updateKusPoradi";
import { skladDetailRowGridClassName } from "../helpers/tableLayout";
import { SkladBulkLabelsButton } from "./SkladBulkLabelsButton";
import { SkladDetailKusRow } from "./SkladDetailKusRow";

type SkladDetailKusySectionProps = {
  row: SkladDetailRow;
  kusy: SkladKusRow[];
  poskozeni: SkladPoskozeniRow[];
  kusyError: { message: string } | null;
  addKusAction: (formData: FormData) => Promise<void>;
  deleteKusAction: (formData: FormData) => Promise<void>;
  updateKusPoradiAction: (
    formData: FormData
  ) => Promise<UpdateKusPoradiResult>;
};

export function SkladDetailKusySection({
  row,
  kusy,
  poskozeni,
  kusyError,
  addKusAction,
  deleteKusAction,
  updateKusPoradiAction,
}: SkladDetailKusySectionProps) {
  const rowGridClassName = skladDetailRowGridClassName();

  return (
    <div className="bg-slate-950/30 px-3 py-4">
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {!kusyError && kusy.length > 0 ? (
          <SkladBulkLabelsButton row={row} kusy={kusy} />
        ) : null}
        <form action={addKusAction}>
          <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
          <input type="hidden" name="nazev" value={row.nazev} />
          <button
            type="submit"
            className="rounded-xl border border-blue-700 bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            + Přidat kus
          </button>
        </form>
      </div>

      {kusyError ? (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-200">
          Chyba: {kusyError.message}
        </div>
      ) : kusy.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">
          Pro tuto položku zatím nejsou založené jednotlivé kusy.
        </div>
      ) : (
        <div className="grid gap-2">
          {kusy.map((kus) => (
            <SkladDetailKusRow
              key={kus.kus_id}
              kus={kus}
              row={row}
              poskozeni={poskozeni}
              rowGridClassName={rowGridClassName}
              deleteKusAction={deleteKusAction}
              updateKusPoradiAction={updateKusPoradiAction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
