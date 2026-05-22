import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { verifyAppAdminPage } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";
import { formatMoneyCzk } from "@/lib/payments";
import { sendAccountingExportToAccountantAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ stav?: string; od?: string; do?: string; ucetni?: string; message?: string }>;
};

type InvoiceRow = {
  id: string;
  zakazka_id: string;
  cislo_dokladu: string;
  variabilni_symbol: string | null;
  vystaveno_at: string | null;
  splatnost_at: string | null;
  duzp_at: string | null;
  stav: string;
  payment_status: string | null;
  paid_at: string | null;
  zaklad_dane: number | string | null;
  dph_castka: number | string | null;
  celkem_s_dph: number | string | null;
  supplier_snapshot: { name?: string | null } | null;
  customer_snapshot: { name?: string | null; ico?: string | null; dic?: string | null } | null;
  order_snapshot: { orderNumber?: string | null; title?: string | null } | null;
};

const filterOptions = [
  ["neuhrazeno", "Neuhrazené"],
  ["uhrazeno", "Uhrazené"],
  ["po_splatnosti", "Po splatnosti"],
  ["stornovano", "Stornované"],
  ["vse", "Vše"],
] as const;

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium" }).format(date);
}

function derivedPaymentStatus(row: InvoiceRow) {
  if (row.stav === "stornovano" || row.payment_status === "stornovano") return "stornovano";
  if (row.payment_status === "uhrazeno") return "uhrazeno";
  const due = row.splatnost_at ? new Date(row.splatnost_at).getTime() : NaN;
  if (Number.isFinite(due) && due < Date.now()) return "po_splatnosti";
  return "neuhrazeno";
}

function paymentStatusLabel(status: string) {
  if (status === "uhrazeno") return "Uhrazeno";
  if (status === "po_splatnosti") return "Po splatnosti";
  if (status === "stornovano") return "Stornováno";
  return "Neuhrazeno";
}

function paymentStatusVariant(status: string): "default" | "success" | "warning" | "danger" {
  if (status === "uhrazeno") return "success";
  if (status === "po_splatnosti") return "danger";
  if (status === "stornovano") return "default";
  return "warning";
}

function buildQuery(params: { stav: string; od?: string; do?: string }) {
  const query = new URLSearchParams();
  query.set("stav", params.stav);
  if (params.od) query.set("od", params.od);
  if (params.do) query.set("do", params.do);
  return query.toString();
}

export default async function AdminInvoicesPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const activeFilter = resolvedSearchParams?.stav ?? "neuhrazeno";
  const od = resolvedSearchParams?.od ?? "";
  const doValue = resolvedSearchParams?.do ?? "";
  const accountantMessage = resolvedSearchParams?.ucetni ?? "";
  const supabase = await createClient();
  const access = await verifyAppAdminPage(supabase);
  if (!access.ok) {
    return <div className="p-6 text-red-300">{access.message}</div>;
  }

  let query = supabase
    .from("zakazka_faktury")
    .select(
      "id, zakazka_id, cislo_dokladu, variabilni_symbol, vystaveno_at, splatnost_at, duzp_at, stav, payment_status, paid_at, zaklad_dane, dph_castka, celkem_s_dph, supplier_snapshot, customer_snapshot, order_snapshot"
    )
    .order("vystaveno_at", { ascending: false });

  if (od) query = query.gte("vystaveno_at", od);
  if (doValue) query = query.lte("vystaveno_at", `${doValue}T23:59:59.999`);

  const { data, error } = await query;
  if (error) {
    return <div className="p-6 text-red-300">Chyba faktur: {error.message}</div>;
  }

  const allRows = (data ?? []) as InvoiceRow[];
  const rows = allRows.filter((row) => activeFilter === "vse" || derivedPaymentStatus(row) === activeFilter);
  const total = rows.reduce((sum, row) => sum + toNumber(row.celkem_s_dph), 0);
  const taxBase = rows.reduce((sum, row) => sum + toNumber(row.zaklad_dane), 0);
  const vat = rows.reduce((sum, row) => sum + toNumber(row.dph_castka), 0);

  return (
    <div className="page-shell w-full space-y-5 text-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Faktury / podklady pro účetní</h1>
          <p className="mt-2 text-sm text-slate-400">
            Interní přehled vystavených dokladů a CSV export. Účetní systém zůstává zdrojem účetní evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/admin/faktury/export?${buildQuery({ stav: activeFilter, od, do: doValue })}`}
            className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-3 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/25"
          >
            Export CSV
          </a>
          <form action={sendAccountingExportToAccountantAction}>
            <input type="hidden" name="stav" value={activeFilter} />
            <input type="hidden" name="od" value={od} />
            <input type="hidden" name="do" value={doValue} />
            <button className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-100 transition hover:bg-emerald-500/25">
              Poslat účetní
            </button>
          </form>
        </div>
      </div>

      {accountantMessage ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            accountantMessage === "sent"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/30 bg-red-500/10 text-red-100"
          }`}
        >
          {accountantMessage === "sent"
            ? "Export byl odeslán účetní na uložený email."
            : resolvedSearchParams?.message || "Export se nepodařilo odeslat účetní."}
        </div>
      ) : null}

      <Card className="space-y-4">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" action="/admin/faktury">
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Od</span>
            <input name="od" type="date" defaultValue={od} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-white" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Do</span>
            <input name="do" type="date" defaultValue={doValue} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-white" />
          </label>
          <input type="hidden" name="stav" value={activeFilter} />
          <button className="self-end rounded-xl border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-sm font-bold text-blue-100">
            Filtrovat období
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/faktury?${buildQuery({ stav: value, od, do: doValue })}`}
              className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                activeFilter === value
                  ? "border-blue-400 bg-blue-500/20 text-blue-100"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Základ daně</div>
          <div className="mt-1 text-2xl font-black text-white">{formatMoneyCzk(taxBase)}</div>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">DPH</div>
          <div className="mt-1 text-2xl font-black text-white">{formatMoneyCzk(vat)}</div>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3">
          <div className="text-xs uppercase tracking-wide text-slate-500">Celkem s DPH</div>
          <div className="mt-1 text-2xl font-black text-white">{formatMoneyCzk(total)}</div>
        </div>
      </section>

      <Card className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Faktura</th>
              <th className="px-3 py-2">Klient</th>
              <th className="px-3 py-2">Zakázka</th>
              <th className="px-3 py-2">Vystaveno</th>
              <th className="px-3 py-2">Splatnost</th>
              <th className="px-3 py-2">DUZP</th>
              <th className="px-3 py-2">Základ</th>
              <th className="px-3 py-2">DPH</th>
              <th className="px-3 py-2">Celkem</th>
              <th className="px-3 py-2">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                  Žádné faktury pro zvolený filtr.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const status = derivedPaymentStatus(row);
                const order = row.order_snapshot ?? {};
                const customer = row.customer_snapshot ?? {};
                return (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="px-3 py-3">
                      <Link href={`/zakazky/${row.zakazka_id}`} className="font-bold text-blue-200 hover:text-blue-100">
                        {row.cislo_dokladu}
                      </Link>
                      <div className="text-xs text-slate-500">VS {row.variabilni_symbol || "—"}</div>
                    </td>
                    <td className="px-3 py-3">{customer.name || "—"}</td>
                    <td className="px-3 py-3">{[order.orderNumber, order.title].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-3">{formatDate(row.vystaveno_at)}</td>
                    <td className="px-3 py-3">{formatDate(row.splatnost_at)}</td>
                    <td className="px-3 py-3">{formatDate(row.duzp_at)}</td>
                    <td className="px-3 py-3">{formatMoneyCzk(toNumber(row.zaklad_dane))}</td>
                    <td className="px-3 py-3">{formatMoneyCzk(toNumber(row.dph_castka))}</td>
                    <td className="px-3 py-3 font-bold text-white">{formatMoneyCzk(toNumber(row.celkem_s_dph))}</td>
                    <td className="px-3 py-3">
                      <Badge variant={paymentStatusVariant(status)}>{paymentStatusLabel(status)}</Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
