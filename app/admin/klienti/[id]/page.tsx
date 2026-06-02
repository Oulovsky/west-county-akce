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

function displayValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="text-sm leading-relaxed">
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-100">{displayValue(value)}</span>
    </div>
  );
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
        </div>
        <Link href="/admin/klienti" className="text-sm text-blue-300 hover:text-blue-200">
          ← Seznam klientů
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
        <h2 className="text-lg font-semibold text-white">Firma / fakturační údaje</h2>
        <div className="mt-5 grid gap-8 md:grid-cols-2 md:gap-10">
          <div className="space-y-3">
            <DetailField label="Jednatel" value={detail.jednatel} />
            <DetailField
              label="Adresa"
              value={[klient.ulice, klient.mesto, klient.psc].filter(Boolean).join(", ")}
            />
            <DetailField label="IČO" value={klient.ico} />
            <DetailField label="DIČ" value={klient.dic} />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-400">Kontakt</p>
            <DetailField label="Telefon" value={klient.telefon} />
            <DetailField label="Email" value={klient.email} />
            <DetailField label="Poznámka" value={klient.poznamka} />
            <DetailField
              label="Datum založení / registrace"
              value={formatDate(detail.registered_at)}
            />
          </div>
        </div>
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
