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
import { spravaTableGridStyle } from "@/app/sklad/sprava/components/spravaTableLayout";
import type { SpravaCaseObsahTreeBindings } from "@/app/sklad/sprava/components/spravaCaseObsahTreeTypes";
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

type DetailFormDefaults = {
  skladBlokId: string | null;
  kategorieTechnikyId: string | null;
  podkategorieTechnikyId: string | null;
  technickyVlastnikId: string | null;
  jednotka: string;
};

type SkladKusCaseTreePanelProps = {
  parentKusId: string;
  parentDisplayLabel: string;
  activeChildren: SkladKusObsahChildRow[];
  returnTo?: SpravaObsahReturnTo;
  layout?: "sprava" | "detail";
  showInsertForm: boolean;
  showUrlFlash?: boolean;
  /** Pracovní tabulka /sklad — sdílený strom expand + child data. */
  obsahTree?: SpravaCaseObsahTreeBindings;
  /** Detail položky — klasické props (bez obsahTree). */
  availableOptions?: SkladKusObsahChildOption[];
  canEdit?: boolean;
  returnPolozkaId?: string;
  assignmentsByChildKusId?: Record<string, SkladKusZakazkaAssignmentRow>;
  formDefaults?: DetailFormDefaults;
  bloky?: SkladBlok[];
  kategorie?: SkladKategorie[];
  podkategorie?: SkladPodkategorie[];
  jednotky?: SkladJednotka[];
  vlastnici?: TechnickyVlastnik[];
  /** Hloubka vnoření pro odsazení child řádků (0 = první úroveň pod case kusem). */
  depth?: number;
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
  returnTo = "polozka",
  layout = "detail",
  showInsertForm,
  showUrlFlash = false,
  obsahTree,
  availableOptions = [],
  canEdit = false,
  returnPolozkaId = "",
  assignmentsByChildKusId = {},
  formDefaults = {
    skladBlokId: null,
    kategorieTechnikyId: null,
    podkategorieTechnikyId: null,
    technickyVlastnikId: null,
    jednotka: "ks",
  },
  bloky = [],
  kategorie = [],
  podkategorie = [],
  jednotky = [],
  vlastnici = [],
  depth = 0,
}: SkladKusCaseTreePanelProps) {
  const resolvedReturnPolozkaId = obsahTree?.returnPolozkaId ?? returnPolozkaId;
  const resolvedCanEdit = obsahTree?.canEditObsah ?? canEdit;
  const resolvedOptions = obsahTree?.availableChildOptions ?? availableOptions;
  const resolvedAssignments =
    obsahTree?.childAssignmentsByKusId ?? assignmentsByChildKusId;
  const resolvedFormDefaults = obsahTree?.formDefaults ?? formDefaults;
  const resolvedBloky = obsahTree?.bloky ?? bloky;
  const resolvedKategorie = obsahTree?.kategorie ?? kategorie;
  const resolvedPodkategorie = obsahTree?.podkategorie ?? podkategorie;
  const resolvedJednotky = obsahTree?.jednotky ?? jednotky;
  const resolvedVlastnici = obsahTree?.vlastnici ?? vlastnici;
  const tableScroll = useSpravaTableScroll();

  const containedLabel = formatKusObsahContainedLabel(activeChildren.length);
  const pickerOptions = filterChildOptionsForParent(
    resolvedOptions,
    parentKusId,
    activeChildren
  );
  const expandHref = buildObsahHref(
    returnTo,
    resolvedReturnPolozkaId,
    parentKusId
  );
  const insertHref = buildObsahHref(returnTo, resolvedReturnPolozkaId, parentKusId, {
    insert: true,
  });

  const toolbarIndentClass = depth <= 0 ? "pl-10" : "pl-16";
  const resolvedShowInsertForm = obsahTree
    ? obsahTree.insertFormKusId === parentKusId
    : showInsertForm;

  function handleSpravaInsertToggle() {
    if (!obsahTree) return;

    const apply = () => {
      if (!resolvedShowInsertForm && !obsahTree.expandedKusIds.has(parentKusId)) {
        obsahTree.onToggleExpand(
          parentKusId,
          depth === 0 && obsahTree.syncObsahUrl !== false
        );
      }
      obsahTree.onToggleInsertForm(parentKusId);
    };

    if (tableScroll) {
      tableScroll.runPreservingScroll(apply);
    } else {
      apply();
    }
  }

  const toolbar = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-emerald-300/95">{containedLabel}</span>
        {resolvedCanEdit ? (
          resolvedShowInsertForm ? (
            layout === "sprava" && obsahTree ? (
              <button
                type="button"
                onClick={handleSpravaInsertToggle}
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-600 bg-slate-900 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Zavřít formulář
              </button>
            ) : (
              <ObsahToolbarNav
                href={expandHref}
                returnTo={returnTo}
                className="inline-flex min-h-8 items-center rounded-lg border border-slate-600 bg-slate-900 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Zavřít formulář
              </ObsahToolbarNav>
            )
          ) : layout === "sprava" && obsahTree ? (
            <button
              type="button"
              onClick={handleSpravaInsertToggle}
              className="inline-flex min-h-8 items-center rounded-lg border border-blue-600 bg-blue-800 px-3 text-xs font-bold text-white hover:bg-blue-700"
            >
              + Vložit
            </button>
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

  const createNewContentForm =
    resolvedCanEdit && resolvedShowInsertForm ? (
      <SkladCaseContentCreateForm
        parentKusId={parentKusId}
        returnPolozkaId={resolvedReturnPolozkaId}
        returnTo={returnTo}
        parentCaseLabel={parentDisplayLabel}
        defaults={resolvedFormDefaults}
        bloky={resolvedBloky}
        kategorie={resolvedKategorie}
        podkategorie={resolvedPodkategorie}
        jednotky={resolvedJednotky}
        vlastnici={resolvedVlastnici}
        onCatalogConfigChanged={obsahTree?.onCatalogConfigChanged}
      />
    ) : null;

  const servisniInsertForm =
    layout !== "sprava" && resolvedCanEdit && resolvedShowInsertForm ? (
      <details className="rounded-xl border border-slate-800 bg-slate-950/50">
        <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
          Vložit existující kus (servisní)
        </summary>
        <form
          action={insertKusIntoCaseAction}
          className="grid gap-3 border-t border-slate-800 p-4 lg:grid-cols-2"
        >
          <input type="hidden" name="parent_kus_id" value={parentKusId} />
          <input type="hidden" name="return_polozka_id" value={resolvedReturnPolozkaId} />
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
    ) : null;

  const insertForms =
    createNewContentForm || servisniInsertForm ? (
      <div className="mt-4 space-y-4">
        {createNewContentForm}
        {servisniInsertForm}
      </div>
    ) : null;

  if (layout === "sprava") {
    if (!obsahTree) {
      return null;
    }

    return (
      <div
        className="w-full min-w-0 border-t border-emerald-800/25"
        role="group"
        aria-label={`Obsah case ${parentDisplayLabel}`}
      >
        <div
          className="grid items-start border-b border-emerald-900/20 px-2 py-2"
          style={spravaTableGridStyle}
        >
          <div
            className={`sticky left-0 z-10 flex min-w-0 flex-col gap-2 bg-emerald-950/35 py-0.5 pr-1 ${toolbarIndentClass}`}
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
                returnPolozkaId={resolvedReturnPolozkaId}
                returnTo={returnTo}
                canEdit={resolvedCanEdit}
                assignment={resolvedAssignments[child.childKusId] ?? null}
                obsahTree={obsahTree}
                depth={depth}
              />
            ))}
          </ul>
        ) : (
          <p className="px-4 py-2 text-xs text-slate-500">Case zatím neobsahuje žádné kusy.</p>
        )}

        {!resolvedCanEdit ? (
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
          returnPolozkaId={resolvedReturnPolozkaId}
          returnTo={returnTo}
          canEdit={resolvedCanEdit}
        />
        {insertForms}
        {!resolvedCanEdit ? (
          <p className="mt-2 text-xs text-slate-500">Úpravy obsahu jsou dostupné jen pro skladníky.</p>
        ) : null}
      </div>
    </div>
  );
}
