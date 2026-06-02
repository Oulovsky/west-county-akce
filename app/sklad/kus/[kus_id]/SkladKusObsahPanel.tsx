import Link from "next/link";
import { SkladKusObsahInlinePanel } from "@/components/sklad/SkladKusObsahInlinePanel";
import type {
  SkladKusObsahChildOption,
  SkladKusObsahChildRow,
  SkladKusObsahParentPlacement,
} from "@/lib/sklad/kusObsah";
import { formatDateTime } from "@/lib/sklad/helpers";

type SkladKusObsahPanelProps = {
  kusId: string;
  skladovaPolozkaId: string;
  parentDisplayLabel: string;
  isCasePolozka: boolean;
  activeChildren: SkladKusObsahChildRow[];
  parentPlacement: SkladKusObsahParentPlacement | null;
  availableOptions: SkladKusObsahChildOption[];
  canEdit: boolean;
  obsahMessage?: string | null;
  obsahError?: string | null;
};

export function SkladKusObsahPanel({
  kusId,
  skladovaPolozkaId,
  parentDisplayLabel,
  isCasePolozka,
  activeChildren,
  parentPlacement,
  availableOptions,
  canEdit,
  obsahMessage,
  obsahError,
}: SkladKusObsahPanelProps) {
  if (!isCasePolozka && !parentPlacement) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div>
        <h2 className="text-xl font-black tracking-tight text-white">Obsah case / vnoření</h2>
        <p className="mt-1 text-sm text-slate-400">
          {isCasePolozka
            ? "Hlavní plnění case je na stránce skladové položky — rozbalte case a použijte tlačítko Vložit."
            : "Umístění kusu v case."}
        </p>
        {isCasePolozka ? (
          <Link
            href={`/sklad/${skladovaPolozkaId}`}
            className="mt-2 inline-flex text-sm font-semibold text-blue-300 hover:text-blue-200"
          >
            Otevřít položku a plnit case →
          </Link>
        ) : null}
      </div>

      {parentPlacement ? (
        <div className="mt-5 rounded-2xl border border-blue-800/60 bg-blue-950/40 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-blue-200">
            Umístění v case
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-500">Case</dt>
              <dd className="font-semibold text-white">
                <Link
                  href={`/sklad/kus/${parentPlacement.parentKusId}`}
                  className="text-blue-300 hover:text-blue-200"
                >
                  {parentPlacement.displayLabel}
                </Link>
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-500">Vloženo od</dt>
              <dd className="text-slate-200">{formatDateTime(parentPlacement.vlozenoAt)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {isCasePolozka && (activeChildren.length > 0 || canEdit) ? (
        <div className="mt-5">
          <SkladKusObsahInlinePanel
            parentKusId={kusId}
            parentDisplayLabel={parentDisplayLabel}
            activeChildren={activeChildren}
            availableOptions={availableOptions}
            canEdit={canEdit}
            obsahMessage={obsahMessage}
            obsahError={obsahError}
          />
        </div>
      ) : isCasePolozka ? (
        <p className="mt-4 text-sm text-slate-500">Case zatím neobsahuje žádné kusy.</p>
      ) : null}
    </section>
  );
}
