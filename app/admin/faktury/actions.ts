"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import { assertAppAdminWithClient } from "@/lib/auth/admin-access-server";
import { createClient } from "@/lib/supabase/server";

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

function buildCsv(rows: InvoiceExportRow[]) {
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

  return `\uFEFF${[header.map(csvEscape).join(","), ...body].join("\r\n")}`;
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  await assertAppAdminWithClient(supabase);
}

export async function sendAccountingExportToAccountantAction(formData: FormData) {
  const stav = String(formData.get("stav") ?? "neuhrazeno");
  const od = String(formData.get("od") ?? "");
  const doValue = String(formData.get("do") ?? "");
  const returnQuery = new URLSearchParams();
  returnQuery.set("stav", stav);
  if (od) returnQuery.set("od", od);
  if (doValue) returnQuery.set("do", doValue);

  try {
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (!resendApiKey) throw new Error("Chybí RESEND_API_KEY.");

    const supabase = await createClient();
    await requireAdmin(supabase);

    const { data: accountant, error: accountantError } = await supabase
      .from("ucetni_konfigurace")
      .select("jmeno, nazev_firmy, email")
      .eq("aktivni", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountantError) throw new Error(accountantError.message);
    const emailTo = String(accountant?.email ?? "").trim();
    if (!emailTo) throw new Error("Účetní nemá uložený email.");

    let query = supabase
      .from("zakazka_faktury")
      .select(
        "id, zakazka_id, cislo_dokladu, variabilni_symbol, vystaveno_at, splatnost_at, duzp_at, stav, payment_status, paid_at, zaklad_dane, dph_castka, celkem_s_dph, paid_note, storno_reason, supplier_snapshot, customer_snapshot, order_snapshot"
      )
      .order("vystaveno_at", { ascending: false });

    if (od) query = query.gte("vystaveno_at", od);
    if (doValue) query = query.lte("vystaveno_at", `${doValue}T23:59:59.999`);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const rows = ((data ?? []) as InvoiceExportRow[]).filter((row) => {
      if (!stav || stav === "vse") return true;
      return derivedPaymentStatus(row) === stav;
    });

    const csv = buildCsv(rows);
    const resend = new Resend(resendApiKey);
    const { error: resendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL?.trim() || "WEST COUNTY <onboarding@resend.dev>",
      to: emailTo,
      subject: "WEST COUNTY - účetní podklady faktur",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:640px;margin:0 auto;padding:24px">
          <h1 style="font-size:22px;margin:0 0 16px">Účetní podklady faktur</h1>
          <p>V příloze posíláme CSV export faktur z interního systému WEST COUNTY AKCE.</p>
          <p>Počet záznamů: <strong>${rows.length}</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: "faktury-ucetni-podklady.csv",
          content: Buffer.from(csv).toString("base64"),
        },
      ],
    });

    if (resendError) throw new Error(resendError.message);
    returnQuery.set("ucetni", "sent");
  } catch (error) {
    returnQuery.set("ucetni", "error");
    returnQuery.set("message", error instanceof Error ? error.message : "Odeslání se nepovedlo.");
  }

  redirect(`/admin/faktury?${returnQuery.toString()}`);
}
