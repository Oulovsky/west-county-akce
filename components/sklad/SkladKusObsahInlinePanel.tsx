import Link from "next/link";
import { SkladKusObsahChildPicker } from "@/components/sklad/SkladKusObsahChildPicker";
import {
  insertKusIntoCaseAction,
  removeKusFromCaseAction,
} from "@/app/sklad/kusObsahActions";
import { formatDateTime, formatSkladKusStav } from "@/lib/sklad/helpers";
import {
  filterChildOptionsForParent,
  type SkladKusObsahChildOption,
  type SkladKusObsahChildRow,
} from "@/lib/sklad/kusObsah";

type SkladKusObsahInlinePanelProps = {
  parentKusId: string;
  parentDisplayLabel: string;
  activeChildren: SkladKusObsahChildRow[];
  availableOptions: SkladKusObsahChildOption[];
  canEdit: boolean;
  returnPolozkaId?: string | null;
  obsahMessage?: string | null;
  obsahError?: string | null;
};

export function SkladKusObsahInlinePanel({
  parentKusId,
  parentDisplayLabel,
  activeChildren,
  availableOptions,
  canEdit,
  returnPolozkaId = null,
  obsahMessage,
  obsahError,
}: SkladKusObsahInlinePanelProps) {
  const pickerOptions = filterChildOptionsForParent(
    availableOptions,
    parentKusId,
    activeChildren
  );

  return (
    <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div>
        <h4 className="text-sm font-black text-white">Obsah case: {parentDisplayLabel}</h4>
        <p className="mt-1 text-xs text-slate-500">
          Aktuálně vloženo: {activeChildren.length}{" "}
          {activeChildren.length === 1 ? "kus" : activeChildren.length < 5 ? "kusy" : "kusů"}
        </p>
      </div>

      {obsahMessage === "inserted" ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Kus byl vložen do case.
        </p>
      ) : null}
      {obsahMessage === "removed" ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Kus byl vyjmut z case.
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
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-950/80 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Položka / kus</th>
                <th className="px-3 py-2 font-medium">Ev. číslo</th>
                <th className="px-3 py-2 font-medium">Stav</th>
                <th className="px-3 py-2 font-medium">Pozice</th>
                <th className="px-3 py-2 font-medium">Poznámka</th>
                <th className="px-3 py-2 font-medium">Vloženo</th>
                {canEdit ? <th className="px-3 py-2 font-medium" /> : null}
              </tr>
            </thead>
            <tbody>
              {activeChildren.map((child) => (
                <tr key={child.obsahId} className="border-t border-slate-800 text-slate-200">
                  <td className="px-3 py-2">
                    <Link
                      href={`/sklad/kus/${child.childKusId}`}
                      className="font-semibold text-blue-300 hover:text-blue-200"
                    >
                      {child.displayLabel}
                    </Link>
                    <div className="text-xs text-slate-500">{child.polozkaNazev}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{child.evidencniCislo ?? "—"}</td>
                  <td className="px-3 py-2">{formatSkladKusStav(child.stav)}</td>
                  <td className="px-3 py-2">{child.pozice ?? "—"}</td>
                  <td className="px-3 py-2">{child.poznamka ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(child.vlozenoAt)}</td>
                  {canEdit ? (
                    <td className="px-3 py-2 text-right">
                      <form action={removeKusFromCaseAction}>
                        <input type="hidden" name="parent_kus_id" value={parentKusId} />
                        {returnPolozkaId ? (
                          <input type="hidden" name="return_polozka_id" value={returnPolozkaId} />
                        ) : null}
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
          className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 lg:grid-cols-2"
        >
          <input type="hidden" name="parent_kus_id" value={parentKusId} />
          {returnPolozkaId ? (
            <input type="hidden" name="return_polozka_id" value={returnPolozkaId} />
          ) : null}

          <div className="lg:col-span-2">
            <SkladKusObsahChildPicker options={pickerOptions} />
          </div>

          <label className="block text-sm font-semibold text-slate-200 lg:col-span-2">
            Rychlý scan / kus_id (volitelné)
            <input
              name="child_kus_id"
              placeholder="kus_id z QR — přepíše výběr ze seznamu, pokud je vyplněno"
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

          <div className="lg:col-span-2">
            <button
              type="submit"
              className="min-h-11 w-full rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-600"
            >
              Vložit do case
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-slate-500">Úpravy obsahu case jsou dostupné jen pro skladníky.</p>
      )}
    </div>
  );
}
