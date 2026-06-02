import type { SkladKusRow, SkladPrioritaOption, SkladTypPoskozeniOption } from "@/lib/sklad/types";
import { SkladDetailReportDamageForm } from "./SkladDetailReportDamageForm";

type SkladDetailReportDamageSectionProps = {
  skladovaPolozkaId: string;
  polozkaNazev: string;
  kusy: SkladKusRow[];
  typyPoskozeni: SkladTypPoskozeniOption[];
  priority: SkladPrioritaOption[];
  typyError: { message: string } | null;
  priorityError: { message: string } | null;
  reportAction: (formData: FormData) => Promise<void>;
  readOnly?: boolean;
};

export function SkladDetailReportDamageSection({
  skladovaPolozkaId,
  polozkaNazev,
  kusy,
  typyPoskozeni,
  priority,
  typyError,
  priorityError,
  reportAction,
  readOnly = false,
}: SkladDetailReportDamageSectionProps) {
  if (readOnly) return null;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">Nahlásit poškození</h2>

      {typyError || priorityError ? (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-200">
          Chyba konfigurace poškození:{" "}
          {[typyError?.message, priorityError?.message].filter(Boolean).join(" | ")}
        </div>
      ) : (
        <SkladDetailReportDamageForm
          skladovaPolozkaId={skladovaPolozkaId}
          polozkaNazev={polozkaNazev}
          kusy={kusy}
          typyPoskozeni={typyPoskozeni}
          priority={priority}
          reportAction={reportAction}
        />
      )}
    </section>
  );
}
