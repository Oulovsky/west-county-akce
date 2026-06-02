import Link from "next/link";
import { verifyInternalKlientiReadPage } from "@/lib/auth/admin-access-server";
import { loadInternalKlientDetail } from "@/lib/admin/klienti-server";
import { POPTAVKA_STAV_LABELS } from "@/lib/client-portal/labels";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminKlientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await verifyInternalKlientiReadPage(supabase);

  if (!access.ok) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Detail klienta</h1>
        <p className="mt-4 text-red-400">{access.message}</p>
      </div>
    );
  }

  const detail = await loadInternalKlientDetail(supabase, id);

  if (!detail) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold text-white">Detail klienta</h1>
        <p className="mt-4 text-slate-300">Klient nenalezen nebo není z klientského portálu.</p>
        <Link href="/admin/klienti" className="mt-4 inline-block text-blue-300">
          ← Seznam klientů
        </Link>
      </div>
    );
  }

  const { klient } = detail;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.14em] text-slate-500">
            Klient · {detail.account_stav}
          </div>
          <h1 className="mt-1 text-3xl font-bold text-white">{klient.nazev}</h1>
          <p className="mt-2 text-slate-400">
            {klient.ico ? `IČO ${klient.ico}` : "bez IČO"}
            {klient.dic ? ` · DIČ ${klient.dic}` : ""}
          </p>
        </div>
        <Link href="/admin/klienti" className="text-sm text-blue-300 hover:text-blue-200">
          ← Seznam klientů
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Firma / fakturační údaje</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">E-mail firmy</dt>
            <dd className="text-slate-100">{klient.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Telefon</dt>
            <dd className="text-slate-100">{klient.telefon ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Adresa</dt>
            <dd className="text-slate-100">
              {[klient.ulice, klient.mesto, klient.psc].filter(Boolean).join(", ") || "—"}
            </dd>
          </div>
          {klient.poznamka ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Poznámka</dt>
              <dd className="whitespace-pre-wrap text-slate-100">{klient.poznamka}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Klientské účty</h2>
        {detail.accounts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Žádný portálový účet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Jméno</th>
                  <th className="px-3 py-2 font-medium">E-mail</th>
                  <th className="px-3 py-2 font-medium">Telefon</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Stav</th>
                  <th className="px-3 py-2 font-medium">Vytvořeno</th>
                </tr>
              </thead>
              <tbody>
                {detail.accounts.map((account) => (
                  <tr key={account.account_id} className="border-t border-slate-800 text-slate-200">
                    <td className="px-3 py-2">
                      {[account.jmeno, account.prijmeni].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-3 py-2">{account.email ?? "—"}</td>
                    <td className="px-3 py-2">{account.telefon ?? "—"}</td>
                    <td className="px-3 py-2">{account.role}</td>
                    <td className="px-3 py-2">{account.stav}</td>
                    <td className="px-3 py-2">{formatDate(account.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Poptávky</h2>
        {detail.poptavky.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Žádné poptávky.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {detail.poptavky.map((row) => (
              <li
                key={row.poptavka_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-white">
                    {row.cislo_poptavky} · {row.misto_nazev ?? "—"}
                  </div>
                  <div className="text-slate-500">
                    {POPTAVKA_STAV_LABELS[row.stav as keyof typeof POPTAVKA_STAV_LABELS] ??
                      row.stav}{" "}
                    · odesláno {formatDate(row.odeslano_at)}
                  </div>
                </div>
                <Link
                  href={`/zakazky/poptavky/${row.poptavka_id}`}
                  className="font-semibold text-blue-300 hover:text-blue-200"
                >
                  Detail poptávky
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Zakázky</h2>
        {detail.zakazky.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Žádné zakázky.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {detail.zakazky.map((row) => (
              <li
                key={row.zakazka_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-white">
                    {row.cislo_zakazky ?? row.zakazka_id} · {row.nazev ?? "—"}
                  </div>
                  <div className="text-slate-500">
                    {formatDate(row.datum_od)}
                    {row.zrusena ? " · zrušeno" : ""}
                  </div>
                </div>
                <Link
                  href={`/zakazky/${row.zakazka_id}`}
                  className="font-semibold text-blue-300 hover:text-blue-200"
                >
                  Detail zakázky
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Místa konání</h2>
        {detail.mista.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Žádná místa.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {detail.mista.map((row) => (
              <li
                key={row.misto_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium text-white">{row.nazev}</div>
                  <div className="text-slate-500">{row.adresa_text ?? "—"}</div>
                </div>
                <Link
                  href={`/mista/${row.misto_id}`}
                  className="font-semibold text-blue-300 hover:text-blue-200"
                >
                  Detail místa
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
