import Link from "next/link";
import { verifyInternalPoptavkyReadPage } from "@/lib/auth/admin-access-server";
import { POPTAVKA_STAV_LABELS } from "@/lib/client-portal/labels";
import { formatPoptavkaDateRange } from "@/lib/client-portal/poptavka-form";
import {
  countPendingInternalPoptavky,
  loadInternalPoptavkyInbox,
} from "@/lib/client-portal/poptavka-internal-server";
import { createClient } from "@/lib/supabase/server";

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ZakazkyPoptavkyPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const tab = resolvedSearchParams?.tab === "rejected" ? "rejected" : "active";

  const supabase = await createClient();
  const access = await verifyInternalPoptavkyReadPage(supabase);

  if (!access.ok) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Poptávky klientů</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const rows = await loadInternalPoptavkyInbox(supabase, tab);
  const pendingCount = await countPendingInternalPoptavky(supabase);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Poptávky klientů</h1>
            {pendingCount > 0 ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-100">
                {pendingCount} čeká na zpracování
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Odeslané a zpracované klientské poptávky z portálu. Po potvrzení závazné objednávky
            klientem lze poptávku schválit k převodu na zakázku.
          </p>
        </div>
        <Link href="/zakazky" className="text-sm text-blue-300 hover:text-blue-200">
          ← Zakázky
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/zakazky/poptavky"
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            tab === "active"
              ? "border-blue-500/50 bg-blue-600/20 text-blue-50"
              : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600"
          }`}
        >
          Aktuální poptávky
        </Link>
        <Link
          href="/zakazky/poptavky?tab=rejected"
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            tab === "rejected"
              ? "border-red-500/50 bg-red-600/20 text-red-50"
              : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600"
          }`}
        >
          Odmítnuté
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-slate-500">
          {tab === "rejected"
            ? "Zatím žádné odmítnuté poptávky."
            : "Zatím žádné aktivní poptávky ve frontě."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Číslo</th>
                <th className="px-4 py-3 font-medium">Klient</th>
                <th className="px-4 py-3 font-medium">Akce</th>
                <th className="px-4 py-3 font-medium">Místo</th>
                <th className="px-4 py-3 font-medium">Termín</th>
                <th className="px-4 py-3 font-medium">Stav</th>
                <th className="px-4 py-3 font-medium">
                  {tab === "rejected" ? "Odmítnuto" : "Odesláno"}
                </th>
                {tab === "rejected" ? (
                  <th className="px-4 py-3 font-medium">Interní důvod</th>
                ) : null}
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.poptavka_id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-4 py-3 font-medium text-white">{row.cislo_poptavky}</td>
                  <td className="px-4 py-3">
                    <div>{row.klient?.nazev ?? "—"}</div>
                    {row.klient?.ico ? (
                      <div className="text-xs text-slate-500">IČO {row.klient.ico}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.misto_nazev ?? "—"}</td>
                  <td className="px-4 py-3">{row.misto_adresa ?? "—"}</td>
                  <td className="px-4 py-3">
                    {formatPoptavkaDateRange(row.datum_od, row.datum_do)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold">
                      {POPTAVKA_STAV_LABELS[row.stav]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {formatTimestamp(
                      tab === "rejected" ? row.updated_at : row.odeslano_at
                    )}
                  </td>
                  {tab === "rejected" ? (
                    <td className="max-w-xs px-4 py-3 text-xs text-slate-400">
                      {row.zamitnuto_duvod?.trim() || "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <Link
                      href={`/zakazky/poptavky/${row.poptavka_id}`}
                      className="font-semibold text-blue-300 hover:text-blue-200"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
