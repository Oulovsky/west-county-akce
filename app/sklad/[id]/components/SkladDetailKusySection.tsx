import { SubmitButton } from "@/components/ui/SubmitButton";
import type {
  SkladKusObsahChildOption,
  SkladKusObsahChildRow,
  SkladKusObsahKusSummary,
} from "@/lib/sklad/kusObsah";
import type {
  SkladBlok,
  SkladDetailRow,
  SkladJednotka,
  SkladKategorie,
  SkladKusRow,
  SkladOdpisovePasmo,
  SkladPodkategorie,
  SkladPoskozeniRow,
  TechnickyVlastnik,
} from "@/lib/sklad/types";
import type { UpdateKusPoradiResult } from "../actions/updateKusPoradi";
import { skladDetailRowGridClassName } from "../helpers/tableLayout";
import { SkladBulkLabelsButton } from "./SkladBulkLabelsButton";
import { SkladDetailKusRow } from "./SkladDetailKusRow";

type SkladDetailKusySectionProps = {
  row: SkladDetailRow;
  kusy: SkladKusRow[];
  poskozeni: SkladPoskozeniRow[];
  odpisovaPasma: SkladOdpisovePasmo[];
  kusyError: { message: string } | null;
  addKusAction: (formData: FormData) => Promise<void>;
  deleteKusAction: (formData: FormData) => Promise<void>;
  updateKusPoradiAction: (
    formData: FormData
  ) => Promise<UpdateKusPoradiResult>;
  obsahSummaries?: Map<string, SkladKusObsahKusSummary>;
  childrenByParent?: Map<string, SkladKusObsahChildRow[]>;
  availableChildOptions?: SkladKusObsahChildOption[];
  openCaseKusId?: string | null;
  obsahMode?: string | null;
  returnPolozkaId?: string;
  readOnly?: boolean;
  isCasePolozka: boolean;
  formDefaults: {
    skladBlokId: string | null;
    kategorieTechnikyId: string | null;
    podkategorieTechnikyId: string | null;
    technickyVlastnikId: string | null;
    jednotka: string;
  };
  bloky: SkladBlok[];
  kategorie: SkladKategorie[];
  podkategorie: SkladPodkategorie[];
  jednotky: SkladJednotka[];
  vlastnici: TechnickyVlastnik[];
};

export function SkladDetailKusySection({
  row,
  kusy,
  poskozeni,
  odpisovaPasma,
  kusyError,
  addKusAction,
  deleteKusAction,
  updateKusPoradiAction,
  obsahSummaries,
  childrenByParent,
  availableChildOptions = [],
  openCaseKusId = null,
  obsahMode = null,
  returnPolozkaId,
  readOnly = false,
  isCasePolozka,
  formDefaults,
  bloky,
  kategorie,
  podkategorie,
  jednotky,
  vlastnici,
}: SkladDetailKusySectionProps) {
  const rowGridClassName = skladDetailRowGridClassName();

  return (
    <div className="bg-slate-950/30 px-3 py-4">
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {!readOnly && !kusyError && kusy.length > 0 ? (
          <SkladBulkLabelsButton row={row} kusy={kusy} />
        ) : null}
        {readOnly ? null : (
          <form action={addKusAction}>
            <input type="hidden" name="skladova_polozka_id" value={row.skladova_polozka_id} />
            <input type="hidden" name="nazev" value={row.nazev} />
            <SubmitButton
              pendingText="Přidávám…"
              className="rounded-xl border border-blue-700 bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:hover:bg-blue-900"
            >
              + Přidat kus
            </SubmitButton>
          </form>
        )}
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
          {isCasePolozka ? (
            <p className="mb-1 px-1 text-xs text-slate-500">
              Položka typu case — rozbalte konkrétní case (▸) a vložte obsah přímo zde. QR menu
              slouží jen pro štítky.
            </p>
          ) : null}
          {kusy.map((kus) => (
            <SkladDetailKusRow
              key={kus.kus_id}
              kus={kus}
              row={row}
              poskozeni={poskozeni}
              odpisovaPasma={odpisovaPasma}
              rowGridClassName={rowGridClassName}
              deleteKusAction={deleteKusAction}
              updateKusPoradiAction={updateKusPoradiAction}
              isCasePolozka={isCasePolozka}
              obsahSummary={obsahSummaries?.get(kus.kus_id) ?? null}
              activeChildren={childrenByParent?.get(kus.kus_id) ?? []}
              availableChildOptions={availableChildOptions}
              openCaseKusId={openCaseKusId}
              obsahMode={obsahMode}
              returnPolozkaId={returnPolozkaId}
              readOnly={readOnly}
              formDefaults={formDefaults}
              bloky={bloky}
              kategorie={kategorie}
              podkategorie={podkategorie}
              jednotky={jednotky}
              vlastnici={vlastnici}
            />
          ))}
        </div>
      )}
    </div>
  );
}
