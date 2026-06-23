"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ObsahUrlFlash } from "@/components/sklad/ObsahUrlFlash";
import { useSpravaTableScroll } from "@/app/sklad/sprava/components/SpravaTableScrollContext";
import { SkladCaseContentCreateForm } from "@/components/sklad/SkladCaseContentCreateForm";
import { SkladKusObsahChildPicker } from "@/components/sklad/SkladKusObsahChildPicker";
import { SpravaCaseObsahChildRow } from "@/components/sklad/SpravaCaseObsahChildRow";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  insertKusIntoCaseAction,
  removeKusFromCaseAction,
} from "@/app/sklad/kusObsahActions";
import { spravaTableGridStyle, SPRAVA_TABLE_MIN_WIDTH } from "@/app/sklad/sprava/components/spravaTableLayout";
import {
  filterChildOptionsForParent,
  formatKusObsahContainedLabel,
  type SkladKusObsahChildOption,
  type SkladKusObsahChildRow,
} from "@/lib/sklad/kusObsahRead";
import {
  buildPolozkaObsahHref,
  buildSpravaObsahHref,
  type SpravaObsahReturnTo,
} from "@/lib/sklad/spravaObsahUrl";
import type { SkladKusZakazkaAssignmentRow } from "@/lib/sklad/types";
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
  returnTo?: SpravaObsahReturnTo;
  layout?: "sprava" | "detail";
  showInsertForm: boolean;
  showUrlFlash?: boolean;
  assignmentsByChildKusId?: Record<string, SkladKusZakazkaAssignmentRow>;
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

function buildObsahHref(
  returnTo: SpravaObsahReturnTo,
  returnPolozkaId: string,
  parentKusId: string,
  opts?: { insert?: boolean }
): string {
  if (returnTo === "sprava") {
    return buildSpravaObsahHref(returnPolozkaId, parentKusId, opts);
  }
  return buildPolozkaObsahHref(returnPolozkaId, parentKusId, opts);
}

function ObsahToolbarNav({
  href,
  className,
  children,
  returnTo,
}: {
  href: string;
  className: string;
  children: ReactNode;
  returnTo: SpravaObsahReturnTo;
}) {
  const tableScroll = useSpravaTableScroll();

  if (returnTo === "sprava" && tableScroll) {
    return (
      <button
        type="button"
        onClick={() => tableScroll.navigateObsah(href)}
        className={className}
      >
        {children}
      </button>
    );
  }

  return (
    <Link href={href} className={className} scroll={false}>
      {children}
    </Link>
  );
}

function DetailChildList({
  activeChildren,
  parentKusId,
  returnPolozkaId,
  returnTo,
  canEdit,
}: {
  activeChildren: SkladKusObsahChildRow[];
  parentKusId: string;
  returnPolozkaId: string;
  returnTo: SpravaObsahReturnTo;
  canEdit: boolean;
}) {
  if (activeChildren.length === 0) {
    return <p className="mt-2 text-sm text-slate-500">Case zatím neobsahuje žádné kusy.</p>;
  }

  return (
    <ul className="mt-3 space-y-1.5" role="list">
      {activeChildren.map((child) => (
        <li
          key={child.obsahId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/50 py-2 pl-3 pr-2"
          role="listitem"
        >
          <Link
            href={`/sklad/kus/${child.childKusId}`}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-100 hover:text-blue-200"
            title={child.polozkaNazev}
          >
            {child.displayLabel}
          </Link>
          {canEdit ? (
            <form action={removeKusFromCaseAction} className="shrink-0">
              <input type="hidden" name="parent_kus_id" value={parentKusId} />
              <input type="hidden" name="return_polozka_id" value={returnPolozkaId} />
              <input type="hidden" name="return_to" value={returnTo} />
              <input type="hidden" name="obsah_id" value={child.obsahId} />
              <SubmitButton
                pendingText="Odebírám…"
                className="rounded-lg border border-amber-700/90 bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-900 disabled:hover:bg-amber-950"
              >
                Odebrat
              </SubmitButton>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SkladKusCaseTreePanel({
  parentKusId,
  parentDisplayLabel,
  activeChildren,
  availableOptions,
  canEdit,
  returnPolozkaId,
  returnTo = "polozka",
  layout = "detail",
  showInsertForm,
  showUrlFlash = false,
  assignmentsByChildKusId = {},
  formDefaults,
  bloky,
  kategorie,
  podkategorie,
  jednotky,
  vlastnici,
}: SkladKusCaseTreePanelProps) {
  const containedLabel = formatKusObsahContainedLabel(activeChildren.length);
  const pickerOptions = filterChildOptionsForParent(
    availableOptions,
    parentKusId,
    activeChildren
  );
  const expandHref = buildObsahHref(returnTo, returnPolozkaId, parentKusId);
  const insertHref = buildObsahHref(returnTo, returnPolozkaId, parentKusId, {
    insert: true,
  });

  const toolbar = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-emerald-300/95">{containedLabel}</span>
        {canEdit ? (
          showInsertForm ? (
            <ObsahToolbarNav
              href={expandHref}
              returnTo={returnTo}
              className="inline-flex min-h-8 items-center rounded-lg border border-slate-600 bg-slate-900 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              Zavřít formulář
            </ObsahToolbarNav>
          ) : (
            <ObsahToolbarNav
              href={insertHref}
              returnTo={returnTo}
              className="inline-flex min-h-8 items-center rounded-lg border border-blue-600 bg-blue-800 px-3 text-xs font-bold text-white hover:bg-blue-700"
            >
              + Vložit
            </ObsahToolbarNav>
          )
        ) : null}
        {layout !== "sprava" ? (
          <Link
            href={`/sklad/kus/${parentKusId}`}
            className="inline-flex min-h-8 items-center rounded-lg border border-slate-600 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:border-slate-500 hover:text-white"
          >
            Detail kusu
          </Link>
        ) : null}
      </div>

      {showUrlFlash ? <ObsahUrlFlash className="mt-2" /> : null}
    </>
  );

  const insertForms = canEdit && showInsertForm ? (
    <div className="mt-4 space-y-4">
      <SkladCaseContentCreateForm
        parentKusId={parentKusId}
        returnPolozkaId={returnPolozkaId}
        returnTo={returnTo}
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
          <input type="hidden" name="return_to" value={returnTo} />

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
            <SubmitButton
              pendingText="Vkládám…"
              className="min-h-10 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:hover:bg-slate-800"
            >
              Vložit existující kus
            </SubmitButton>
          </div>
        </form>
      </details>
    </div>
  ) : null;

  if (layout === "sprava") {
    return (
      <div
        className="w-full min-w-0 border-t border-emerald-900/30 bg-slate-950/90"
        style={{ minWidth: SPRAVA_TABLE_MIN_WIDTH }}
        role="group"
        aria-label={`Obsah case ${parentDisplayLabel}`}
      >
        <div
          className="grid items-start border-b border-emerald-900/20 px-2 py-2"
          style={spravaTableGridStyle}
        >
          <div
            className="sticky left-0 z-10 flex min-w-0 flex-col gap-2 bg-slate-950/95 py-0.5 pl-10 pr-1"
            style={{ gridColumn: "1 / -1" }}
          >
            {toolbar}
            {insertForms}
          </div>
        </div>

        {activeChildren.length > 0 ? (
          <ul className="min-w-0 divide-y divide-slate-800/50" role="list">
            {activeChildren.map((child) => (
              <SpravaCaseObsahChildRow
                key={child.obsahId}
                child={child}
                parentKusId={parentKusId}
                parentCaseLabel={parentDisplayLabel}
                returnPolozkaId={returnPolozkaId}
                returnTo={returnTo}
                canEdit={canEdit}
                assignment={assignmentsByChildKusId[child.childKusId] ?? null}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-2 text-xs text-slate-500">Case zatím neobsahuje žádné kusy.</p>
        )}

        {!canEdit ? (
          <p className="px-4 py-2 text-xs text-slate-500">
            Úpravy obsahu jsou dostupné jen pro skladníky.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="border-t border-emerald-900/30 bg-slate-950/80 py-3 pr-3"
      role="group"
      aria-label={`Obsah case ${parentDisplayLabel}`}
    >
      <div className="ml-8 border-l-2 border-emerald-700/40 pl-4">
        {toolbar}
        <DetailChildList
          activeChildren={activeChildren}
          parentKusId={parentKusId}
          returnPolozkaId={returnPolozkaId}
          returnTo={returnTo}
          canEdit={canEdit}
        />
        {insertForms}
        {!canEdit ? (
          <p className="mt-2 text-xs text-slate-500">Úpravy obsahu jsou dostupné jen pro skladníky.</p>
        ) : null}
      </div>
    </div>
  );
}
