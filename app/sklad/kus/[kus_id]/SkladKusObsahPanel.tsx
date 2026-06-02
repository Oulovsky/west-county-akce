import Link from "next/link";
import { formatDateTime, formatSkladKusStav } from "@/lib/sklad/helpers";
import type {
  SkladKusObsahChildRow,
  SkladKusObsahParentPlacement,
} from "@/lib/sklad/kusObsah";
import {
  insertKusIntoCaseAction,
  removeKusFromCaseAction,
} from "./kusObsahActions";

type SkladKusObsahPanelProps = {
  kusId: string;
  activeChildren: SkladKusObsahChildRow[];
  parentPlacement: SkladKusObsahParentPlacement | null;
  canEdit: boolean;
  obsahMessage?: string | null;
  obsahError?: string | null;
};

export function SkladKusObsahPanel({
  kusId,
  activeChildren,
  parentPlacement,
  canEdit,
  obsahMessage,
  obsahError,
}: SkladKusObsahPanelProps) {
  const showContainsSection = activeChildren.length > 0 || canEdit;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div>
        <h2 className="text-xl font-black tracking-tight text-white">Obsah case / vnoření</h2>
        <p className="mt-1 text-sm text-slate-400">
          Evidence fyzického obsahu přepravních celků. Při nakládce se skenuje case, systém zná
          konkrétní kusy uvnitř.
        </p>
      </div>

      {obsahMessage === "inserted" ? (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Kus byl vložen do case.
        </p>
      ) : null}
      {obsahMessage === "removed" ? (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Kus byl vyjmut z case.
        </p>
      ) : null}
      {obsahError ? (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {obsahError}
        </p>
      ) : null}

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
              <dt className="text-slate-500">Položka</dt>
              <dd className="text-slate-200">{parentPlacement.polozkaNazev}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-500">Evidenční číslo</dt>
              <dd className="font-mono text-xs text-slate-300">
                {parentPlacement.evidencniCislo ?? "—"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-500">Vloženo od</dt>
              <dd className="text-slate-200">{formatDateTime(parentPlacement.vlozenoAt)}</dd>
            </div>
            {parentPlacement.pozice ? (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-slate-500">Pozice v case</dt>
                <dd className="text-slate-200">{parentPlacement.pozice}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {showContainsSection ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">Obsahuje</h3>
          {activeChildren.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Case zatím neobsahuje žádné kusy.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Položka / kus</th>
                    <th className="px-3 py-2 font-medium">Evidenční číslo</th>
                    <th className="px-3 py-2 font-medium">Stav</th>
                    <th className="px-3 py-2 font-medium">Pozice</th>
                    <th className="px-3 py-2 font-medium">Poznámka</th>
                    <th className="px-3 py-2 font-medium">Vloženo</th>
                    {canEdit ? <th className="px-3 py-2 font-medium" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {activeChildren.map((child) => (
                    <tr
                      key={child.obsahId}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/sklad/kus/${child.childKusId}`}
                          className="font-semibold text-blue-300 hover:text-blue-200"
                        >
                          {child.displayLabel}
                        </Link>
                        <div className="text-xs text-slate-500">{child.polozkaNazev}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {child.evidencniCislo ?? "—"}
                      </td>
                      <td className="px-3 py-2">{formatSkladKusStav(child.stav)}</td>
                      <td className="px-3 py-2">{child.pozice ?? "—"}</td>
                      <td className="px-3 py-2">{child.poznamka ?? "—"}</td>
                      <td className="px-3 py-2">{formatDateTime(child.vlozenoAt)}</td>
                      {canEdit ? (
                        <td className="px-3 py-2 text-right">
                          <form action={removeKusFromCaseAction}>
                            <input type="hidden" name="parent_kus_id" value={kusId} />
                            <input type="hidden" name="obsah_id" value={child.obsahId} />
                            <button
                              type="submit"
                              className="rounded-lg border border-amber-700 bg-amber-900 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-800"
                            >
                              Vyjmout
                            </button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canEdit ? (
            <form
              action={insertKusIntoCaseAction}
              className="mt-5 grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-2"
            >
              <input type="hidden" name="parent_kus_id" value={kusId} />
              <label className="block text-sm font-semibold text-slate-200 sm:col-span-2">
                Vložit kus do case
                <input
                  name="child_kus_id"
                  required
                  placeholder="kus_id z QR nebo vyhledání"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-200">
                Pozice v case
                <input
                  name="pozice"
                  placeholder="např. řada 1 / slot A"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-200">
                Poznámka
                <input
                  name="poznamka"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600"
                >
                  Vložit kus do case
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {!showContainsSection && !parentPlacement ? (
        <p className="mt-4 text-sm text-slate-500">
          Tento kus není v case a zatím neobsahuje jiné kusy.
        </p>
      ) : null}
    </section>
  );
}
