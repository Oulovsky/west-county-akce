import { assertAppAdminWithClient } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type InvoiceExportRow = {
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
  paid_note: string | null;
  storno_reason: string | null;
  supplier_snapshot: { name?: string | null } | null;
  customer_snapshot: { name?: string | null; ico?: string | null; dic?: string | null } | null;
  order_snapshot: { orderNumber?: string | null; title?: string | null; note?: string | null } | null;
};

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function derivedPaymentStatus(row: InvoiceExportRow) {
  if (row.stav === "stornovano" || row.payment_status === "stornovano") return "stornovano";
  if (row.payment_status === "uhrazeno") return "uhrazeno";
  const due = row.splatnost_at ? new Date(row.splatnost_at).getTime() : NaN;
  if (Number.isFinite(due) && due < Date.now()) return "po_splatnosti";
  return "neuhrazeno";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    await assertAppAdminWithClient(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    const status = message === "Unauthorized" ? 401 : 403;
    return new Response(message, { status });
  }

  const url = new URL(request.url);
  const invoiceId = url.searchParams.get("invoice_id");
  const status = url.searchParams.get("stav");
  const from = url.searchParams.get("od");
  const to = url.searchParams.get("do");

  let query = supabase
    .from("zakazka_faktury")
    .select(
      "id, zakazka_id, cislo_dokladu, variabilni_symbol, vystaveno_at, splatnost_at, duzp_at, stav, payment_status, paid_at, zaklad_dane, dph_castka, celkem_s_dph, paid_note, storno_reason, supplier_snapshot, customer_snapshot, order_snapshot"
    )
    .order("vystaveno_at", { ascending: false });

  if (invoiceId) query = query.eq("id", invoiceId);
  if (from) query = query.gte("vystaveno_at", from);
  if (to) query = query.lte("vystaveno_at", `${to}T23:59:59.999`);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  const rows = ((data ?? []) as InvoiceExportRow[]).filter((row) => {
    if (!status || status === "vse") return true;
    return derivedPaymentStatus(row) === status;
  });

  const header = [
    "cislo_faktury",
    "variabilni_symbol",
    "datum_vystaveni",
    "splatnost",
    "duzp",
    "klient",
    "ico",
    "dic",
    "fakturacni_firma",
    "zaklad_dane",
    "dph",
    "celkem_s_dph",
    "stav_uhrady",
    "datum_uhrady",
    "zakazka",
    "poznamka",
  ];

  const body = rows.map((row) => {
    const customer = row.customer_snapshot ?? {};
    const supplier = row.supplier_snapshot ?? {};
    const order = row.order_snapshot ?? {};
    const note = [row.paid_note, row.storno_reason, order.note].filter(Boolean).join(" | ");
    return [
      row.cislo_dokladu,
      row.variabilni_symbol,
      formatDate(row.vystaveno_at),
      formatDate(row.splatnost_at),
      formatDate(row.duzp_at),
      customer.name,
      customer.ico,
      customer.dic,
      supplier.name,
      toNumber(row.zaklad_dane),
      toNumber(row.dph_castka),
      toNumber(row.celkem_s_dph),
      derivedPaymentStatus(row),
      formatDate(row.paid_at),
      [order.orderNumber, order.title].filter(Boolean).join(" - "),
      note,
    ]
      .map(csvEscape)
      .join(",");
  });

  const csv = [header.map(csvEscape).join(","), ...body].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="faktury-ucetni-podklady.csv"`,
    },
  });
}
