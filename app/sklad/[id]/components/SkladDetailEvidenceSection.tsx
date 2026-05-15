import Link from "next/link";
import { EvidencePoskozeniClient } from "@/components/sklad/evidence-poskozeni-client";
import type { SkladPoskozeniRow, SkladPrioritaOption } from "@/lib/sklad/types";

type SkladDetailEvidenceSectionProps = {
  poskozeni: SkladPoskozeniRow[];
  priority: SkladPrioritaOption[];
  jednotka: string;
  poskozeniError: { message: string } | null;
};

export function SkladDetailEvidenceSection({
  poskozeni,
  priority,
  jednotka,
  poskozeniError,
}: SkladDetailEvidenceSectionProps) {
  return (
    <section
      id="evidence-poskozeni"
      className="scroll-mt-24 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
    >
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Evidence poškození</h2>
          <p className="text-sm text-slate-400">
            Filtrace přehledu poškození pro tuto položku.
          </p>
        </div>

        <Link
          href="/sklad/poskozeni"
          className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          Centrální přehled poškození
        </Link>
      </div>

      {poskozeniError ? (
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-4 text-sm text-red-200">
          Chyba: {poskozeniError.message}
        </div>
      ) : (
        <EvidencePoskozeniClient
          poskozeni={poskozeni}
          priority={priority}
          jednotka={jednotka}
        />
      )}
    </section>
  );
}
