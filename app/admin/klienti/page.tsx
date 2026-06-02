import Link from "next/link";
import { verifyInternalKlientiReadPage } from "@/lib/auth/admin-access-server";
import { loadInternalKlientiList } from "@/lib/admin/klienti-server";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function accountStavClass(stav: string) {
  if (stav === "aktivní účet") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
  }
  if (stav === "deaktivovaný účet") {
    return "border-red-500/40 bg-red-500/10 text-red-100";
  }
  if (stav === "čeká na aktivaci") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }
  return "border-slate-600 bg-slate-900 text-slate-300";
}

export default async function AdminKlientiPage() {
  const supabase = await createClient();
  const access = await verifyInternalKlientiReadPage(supabase);

  if (!access.ok) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Klienti</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const rows = await loadInternalKlientiList(supabase);

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Klienti</h1>
          <p className="mt-2 text-sm text-slate-400">
            Přehled registrovaných firem z klientského portálu (účty, poptávky, zakázky).
            Interní zaměstnanci zde nejsou uvedeni.
          </p>
        </div>
        <Link href="/zakazky" className="text-sm text-blue-300 hover:text-blue-200">
          ← Zakázky
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-slate-500">
          Zatím nejsou žádní registrovaní klienti z portálu.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Firma</th>
                <th className="px-4 py-3 font-medium">IČO</th>
                <th className="px-4 py-3 font-medium">Kontakt</th>
                <th className="px-4 py-3 font-medium">Účty</th>
                <th className="px-4 py-3 font-medium">Poptávky</th>
                <th className="px-4 py-3 font-medium">Zakázky</th>
                <th className="px-4 py-3 font-medium">Stav účtu</th>
                <th className="px-4 py-3 font-medium">Registrace</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.klient_id} className="border-t border-slate-800 text-slate-200">
                  <td className="px-4 py-3 font-medium text-white">{row.nazev}</td>
                  <td className="px-4 py-3">{row.ico ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div>{row.email ?? "—"}</div>
                    {row.telefon ? (
                      <div className="text-xs text-slate-500">{row.telefon}</div>
                    ) : null}
                    {row.adresa ? (
                      <div className="text-xs text-slate-500">{row.adresa}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{row.accounts_count}</td>
                  <td className="px-4 py-3">{row.poptavky_count}</td>
                  <td className="px-4 py-3">{row.zakazky_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${accountStavClass(row.account_stav)}`}
                    >
                      {row.account_stav}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.registered_at)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/klienti/${row.klient_id}`}
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
