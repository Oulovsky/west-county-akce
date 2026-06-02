import Link from "next/link";
import { SkladCaseContentCreateForm } from "@/components/sklad/SkladCaseContentCreateForm";
import { SkladKusObsahChildPicker } from "@/components/sklad/SkladKusObsahChildPicker";
import {
  insertKusIntoCaseAction,
  removeKusFromCaseAction,
} from "@/app/sklad/kusObsahActions";
import { formatDateTime, formatSkladKusStav } from "@/lib/sklad/helpers";
import {
  filterChildOptionsForParent,
  formatKusObsahContainedHint,
  type SkladKusObsahChildOption,
  type SkladKusObsahChildRow,
} from "@/lib/sklad/kusObsah";
import type {
  SkladBlok,
  SkladJednotka,
  SkladKategorie,
  SkladPodkategorie,
  TechnickyVlastnik,
} from "@/lib/sklad/types";

type SkladKusCaseTreePanelProps = {
  parentKusId: string;
  parentDisplayLabel: string;
  activeChildren: SkladKusObsahChildRow[];
  availableOptions: SkladKusObsahChildOption[];
  canEdit: boolean;
  returnPolozkaId: string;
  isExpanded: boolean;
  showInsertForm: boolean;
  obsahMessage?: string | null;
  obsahError?: string | null;
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

export function SkladKusCaseTreePanel({
  parentKusId,
  parentDisplayLabel,
  activeChildren,
  availableOptions,
  canEdit,
  returnPolozkaId,
  isExpanded,
  showInsertForm,
  obsahMessage,
  obsahError,
  formDefaults,
  bloky,
  kategorie,
  podkategorie,
  jednotky,
  vlastnici,
}: SkladKusCaseTreePanelProps) {
  const containedHint =
    formatKusObsahContainedHint(activeChildren.length) ?? "Obsahuje 0 kusů";
  const pickerOptions = filterChildOptionsForParent(
    availableOptions,
    parentKusId,
    activeChildren
  );
  const expandHref = `/sklad/${returnPolozkaId}?obsahCase=${parentKusId}`;
  const insertHref = `/sklad/${returnPolozkaId}?obsahCase=${parentKusId}&obsahMode=insert`;
  const collapseHref = `/sklad/${returnPolozkaId}`;

  return (
    <div className="border-t border-slate-800 bg-slate-950/50">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="text-xs font-medium text-emerald-300/90">{containedHint}</div>
        <div className="flex flex-wrap items-center gap-2">
          {isExpanded ? (
            <Link
              href={collapseHref}
              className="text-xs font-semibold text-slate-400 hover:text-slate-200"
            >
              Sbalit
            </Link>
          ) : (
            <Link
              href={expandHref}
              className="text-xs font-semibold text-slate-300 hover:text-white"
            >
              Rozbalit
            </Link>
          )}
          {canEdit ? (
            showInsertForm ? (
              <Link
                href={expandHref}
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-600 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Zavřít formulář
              </Link>
            ) : (
              <Link
                href={insertHref}
                className="inline-flex min-h-8 items-center rounded-lg border border-blue-700 bg-blue-900 px-3 text-xs font-bold text-blue-100 hover:bg-blue-800"
              >
                + Vložit
              </Link>
            )
          ) : null}
          <Link
            href={`/sklad/kus/${parentKusId}`}
            className="inline-flex min-h-8 items-center rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Detail kusu
          </Link>
        </div>
      </div>

      {isExpanded ? (
        <div className="space-y-3 border-t border-slate-800 px-3 py-3">

          {obsahMessage === "created" ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Obsah byl vytvořen a vložen do case.
            </p>
          ) : null}
          {obsahMessage === "removed" ? (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
              Kus odebrán z case.
            </p>
          ) : null}
          {obsahError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {obsahError}
            </p>
          ) : null}

          {activeChildren.length === 0 ? (
            <p className="text-sm text-slate-500">Case zatím neobsahuje žádné kusy.</p>
          ) : (
            <ul className="space-y-2">
              {activeChildren.map((child) => (
                <li
                  key={child.obsahId}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/sklad/kus/${child.childKusId}`}
                      className="font-semibold text-blue-300 hover:text-blue-200"
                    >
                      {child.displayLabel}
                    </Link>
                    <div className="text-xs text-slate-500">{child.polozkaNazev}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      <span>{formatSkladKusStav(child.stav)}</span>
                      {child.evidencniCislo ? (
                        <span className="font-mono">{child.evidencniCislo}</span>
                      ) : null}
                      {child.pozice ? <span>Pozice: {child.pozice}</span> : null}
                      <span>{formatDateTime(child.vlozenoAt)}</span>
                    </div>
                  </div>
                  {canEdit ? (
                    <form action={removeKusFromCaseAction} className="shrink-0">
                      <input type="hidden" name="parent_kus_id" value={parentKusId} />
                      <input type="hidden" name="return_polozka_id" value={returnPolozkaId} />
                      <input type="hidden" name="obsah_id" value={child.obsahId} />
                      <button
                        type="submit"
                        className="rounded-lg border border-amber-700/80 bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-900"
                      >
                        Odebrat
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canEdit && showInsertForm ? (
            <>
              <SkladCaseContentCreateForm
                parentKusId={parentKusId}
                returnPolozkaId={returnPolozkaId}
                parentCaseLabel={parentDisplayLabel}
                defaults={formDefaults}
                bloky={bloky}
                kategorie={kategorie}
                podkategorie={podkategorie}
                jednotky={jednotky}
                vlastnici={vlastnici}
              />

              <details className="rounded-xl border border-slate-800 bg-slate-950/50">
                <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Vložit existující kus (servisní)
                </summary>
                <form
                  action={insertKusIntoCaseAction}
                  className="grid gap-3 border-t border-slate-800 p-4 lg:grid-cols-2"
                >
                  <input type="hidden" name="parent_kus_id" value={parentKusId} />
                  <input type="hidden" name="return_polozka_id" value={returnPolozkaId} />

                  <div className="lg:col-span-2">
                    <SkladKusObsahChildPicker options={pickerOptions} />
                  </div>

                  <label className="block text-sm font-semibold text-slate-200 lg:col-span-2">
                    Scan / kus_id
                    <input
                      name="child_kus_id"
                      placeholder="kus_id z QR"
                      className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    />
                  </label>

                  <div className="lg:col-span-2">
                    <button
                      type="submit"
                      className="min-h-10 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                    >
                      Vložit existující kus
                    </button>
                  </div>
                </form>
              </details>
            </>
          ) : null}

          {!canEdit ? (
            <p className="text-xs text-slate-500">Úpravy obsahu jsou dostupné jen pro skladníky.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
