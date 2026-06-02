import type {
  SkladKusObsahChildOption,
  SkladKusObsahChildRow,
  SkladKusObsahKusSummary,
} from "@/lib/sklad/kusObsah";
import type {
  SkladDetailRow,
  SkladJednotka,
  SkladKategorie,
  SkladKusRow,
  SkladOdpisovePasmo,
  SkladPodkategorie,
  SkladPoskozeniRow,
} from "@/lib/sklad/types";
import type { UpdateKusPoradiResult } from "../actions/updateKusPoradi";
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
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  celkemKusu: number;
  poskozeneKusy: number;
  pouzitelneKusy: number;
  kusy: SkladKusRow[];
  poskozeni: SkladPoskozeniRow[];
  odpisovaPasma: SkladOdpisovePasmo[];
  kusyError: { message: string } | null;
  updateAction: (formData: FormData) => Promise<void>;
  addKusAction: (formData: FormData) => Promise<void>;
  deleteKusAction: (formData: FormData) => Promise<void>;
  updateKusPoradiAction: (
    formData: FormData
  ) => Promise<UpdateKusPoradiResult>;
  obsahSummaries?: Map<string, SkladKusObsahKusSummary>;
  childrenByParent?: Map<string, SkladKusObsahChildRow[]>;
  availableChildOptions?: SkladKusObsahChildOption[];
  openCaseKusId?: string | null;
  returnPolozkaId?: string;
  obsahMessage?: string | null;
  obsahError?: string | null;
  readOnly?: boolean;
};

export function SkladDetailItemsTable({
  row,
  kategorie,
  podkategorie,
  jednotky,
  celkemKusu,
  poskozeneKusy,
  pouzitelneKusy,
  kusy,
  poskozeni,
  odpisovaPasma,
  kusyError,
  updateAction,
  addKusAction,
  deleteKusAction,
  updateKusPoradiAction,
  obsahSummaries,
  childrenByParent,
  availableChildOptions = [],
  openCaseKusId = null,
  returnPolozkaId,
  obsahMessage = null,
  obsahError = null,
  readOnly = false,
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
              key={row.upraveno_dne}
              row={row}
              editFormId={editFormId}
              rowGridClassName={rowGridClassName}
              kategorie={kategorie}
              podkategorie={podkategorie}
              jednotky={jednotky}
              celkemKusu={celkemKusu}
              poskozeneKusy={poskozeneKusy}
              pouzitelneKusy={pouzitelneKusy}
              updateAction={updateAction}
              readOnly={readOnly}
            />
          </summary>

          <SkladDetailKusySection
            row={row}
            kusy={kusy}
            poskozeni={poskozeni}
            odpisovaPasma={odpisovaPasma}
            kusyError={kusyError}
            addKusAction={addKusAction}
            deleteKusAction={deleteKusAction}
            updateKusPoradiAction={updateKusPoradiAction}
            obsahSummaries={obsahSummaries}
            childrenByParent={childrenByParent}
            availableChildOptions={availableChildOptions}
            openCaseKusId={openCaseKusId}
            returnPolozkaId={returnPolozkaId}
            obsahMessage={obsahMessage}
            obsahError={obsahError}
            readOnly={readOnly}
          />
        </details>
      </div>
    </section>
  );
}
