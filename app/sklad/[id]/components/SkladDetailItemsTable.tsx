import type {
  SkladDetailRow,
  SkladJednotka,
  SkladKategorie,
  SkladKusRow,
  SkladPodkategorie,
  SkladPoskozeniRow,
} from "@/lib/sklad/types";
import {
  SKLAD_DETAIL_TABLE_MIN_WIDTH,
  skladDetailRowGridClassName,
} from "../helpers/tableLayout";
import { SkladDetailKusySection } from "./SkladDetailKusySection";
import { SkladDetailMainRow } from "./SkladDetailMainRow";
import { SkladDetailTableHeader } from "./SkladDetailTableHeader";

type SkladDetailItemsTableProps = {
  row: SkladDetailRow;
  kategorie: SkladKategorie[];
  selectedKategorieId: string;
  selectedPodkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  celkemKusu: number;
  poskozeneKusy: number;
  pouzitelneKusy: number;
  kusy: SkladKusRow[];
  poskozeni: SkladPoskozeniRow[];
  kusyError: { message: string } | null;
  updateAction: (formData: FormData) => Promise<void>;
  addKusAction: (formData: FormData) => Promise<void>;
  deleteKusAction: (formData: FormData) => Promise<void>;
};

export function SkladDetailItemsTable({
  row,
  kategorie,
  selectedKategorieId,
  selectedPodkategorie,
  jednotky,
  celkemKusu,
  poskozeneKusy,
  pouzitelneKusy,
  kusy,
  poskozeni,
  kusyError,
  updateAction,
  addKusAction,
  deleteKusAction,
}: SkladDetailItemsTableProps) {
  const editFormId = `upravit-polozku-${row.skladova_polozka_id}`;
  const rowGridClassName = skladDetailRowGridClassName();

  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className={SKLAD_DETAIL_TABLE_MIN_WIDTH}>
        <SkladDetailTableHeader />

        <details className="group" open>
          <summary className="cursor-pointer list-none">
            <SkladDetailMainRow
              row={row}
              editFormId={editFormId}
              rowGridClassName={rowGridClassName}
              kategorie={kategorie}
              selectedKategorieId={selectedKategorieId}
              selectedPodkategorie={selectedPodkategorie}
              jednotky={jednotky}
              celkemKusu={celkemKusu}
              poskozeneKusy={poskozeneKusy}
              pouzitelneKusy={pouzitelneKusy}
              updateAction={updateAction}
            />
          </summary>

          <SkladDetailKusySection
            row={row}
            kusy={kusy}
            poskozeni={poskozeni}
            kusyError={kusyError}
            addKusAction={addKusAction}
            deleteKusAction={deleteKusAction}
          />
        </details>
      </div>
    </section>
  );
}
