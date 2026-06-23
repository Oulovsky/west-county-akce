"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removeSetupPolozkaAction } from "../setupActions";

export type SetupContentItem = {
  setupPolozkaId: string;
  skladovaPolozkaId: string;
  nazev: string;
  mnozstvi: number;
  okruh: string;
  kategorie: string;
  jednotka: string;
};

type Props = {
  setupId: string;
  items: SetupContentItem[];
  readOnly?: boolean;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 2 }).format(value);
}

export function SetupContentSummary({ setupId, items, readOnly = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const celkemKusu = items.reduce((sum, item) => sum + item.mnozstvi, 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-white">Obsah setupu</h2>
        <div className="flex gap-2 text-xs font-semibold text-slate-300">
          <span className="rounded-md bg-slate-800 px-2 py-1">
            položek: {items.length}
          </span>
          <span className="rounded-md bg-slate-800 px-2 py-1">
            kusů: {formatNumber(celkemKusu)}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Setup zatím neobsahuje žádné položky.</p>
      ) : (
        <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Položka</th>
                <th className="px-3 py-2 font-semibold">Okruh</th>
                <th className="px-3 py-2 font-semibold">Kategorie</th>
                <th className="px-3 py-2 text-right font-semibold">Množství</th>
                {!readOnly ? (
                  <th className="px-3 py-2 text-right font-semibold">Akce</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {items.map((item) => (
                <tr key={item.setupPolozkaId} className="text-slate-200">
                  <td className="px-3 py-2 font-medium">{item.nazev}</td>
                  <td className="px-3 py-2 text-slate-400">{item.okruh}</td>
                  <td className="px-3 py-2 text-slate-400">{item.kategorie}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(item.mnozstvi)} {item.jednotka}
                  </td>
                  {!readOnly ? (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          startTransition(async () => {
                            await removeSetupPolozkaAction(
                              setupId,
                              item.setupPolozkaId
                            );
                            router.refresh();
                          });
                        }}
                        className="rounded-md border border-red-800 bg-red-950 px-2 py-1 text-xs font-bold text-red-100 transition hover:bg-red-900 disabled:opacity-60"
                      >
                        Odebrat
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
