"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { buildCurrentInvoiceData } from "@/lib/invoice-data";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { buildInvoiceRenderPath } from "@/lib/invoice-render-token";
import { logZakazkaHistory } from "@/lib/zakazka-history";
import {
  getWorkflowStatusLabel,
  normalizeWorkflowStatus,
  setZakazkaWorkflowStatus,
} from "@/lib/zakazka-workflow";

type ActionResult = {
  ok: boolean;
  error?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Neznámá chyba";
}

async function getUserOrThrow(supabase: any) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Pro fakturační akci musíte být přihlášeni.");
  return user;
}

function getPublicBaseUrl(headersList: Headers) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  if (!host) return "";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function issueInvoiceAction(zakazkaId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const user = await getUserOrThrow(supabase);
    const { data: existingInvoice, error: existingInvoiceError } = await supabase
      .from("zakazka_faktury")
      .select("id")
      .eq("zakazka_id", zakazkaId)
      .limit(1)
      .maybeSingle();

    if (existingInvoiceError) throw new Error(existingInvoiceError.message);
    if (existingInvoice) return { ok: false, error: "Faktura už existuje." };

    const { data: zakazkaRaw, error: zakazkaError } = await supabase
      .from("zakazky")
      .select("fakturacni_firma_id, workflow_stav")
      .eq("zakazka_id", zakazkaId)
      .maybeSingle();

    if (zakazkaError) throw new Error(zakazkaError.message);
    if (!zakazkaRaw) return { ok: false, error: "Zakázka nebyla nalezena." };

    const workflowStatus = normalizeWorkflowStatus(zakazkaRaw.workflow_stav);
    if (workflowStatus !== "dokonceno") {
      return {
        ok: false,
        error: `Fakturu lze vystavit až ve stavu Dokončeno. Aktuální stav: ${getWorkflowStatusLabel(workflowStatus)}.`,
      };
    }

    const invoiceData = await buildCurrentInvoiceData(supabase, zakazkaId);
    const now = new Date();
    const due = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const { data: numberRaw, error: numberError } = await supabase.rpc("next_zakazka_faktura_cislo");

    if (numberError) throw new Error(numberError.message);
    const documentNumber = String(numberRaw);

    const { data: invoiceRaw, error: invoiceError } = await supabase
      .from("zakazka_faktury")
      .insert({
        zakazka_id: zakazkaId,
        cislo_dokladu: documentNumber,
        stav: "vystaveno",
        vystaveno_at: now.toISOString(),
        splatnost_at: due.toISOString(),
        fakturacni_firma_id: zakazkaRaw?.fakturacni_firma_id ?? null,
        supplier_snapshot: invoiceData.supplier,
        customer_snapshot: invoiceData.customer,
        order_snapshot: invoiceData.order,
        cena_techniky: invoiceData.pricing.techPrice,
        cena_personalu: invoiceData.pricing.staffPrice,
        cena_pred_slevou: invoiceData.pricing.beforeDiscount,
        sleva_percent: invoiceData.pricing.discountPercent,
        sleva_castka: invoiceData.pricing.discountAmount,
        konecna_cena: invoiceData.pricing.finalPrice,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (invoiceError) throw new Error(invoiceError.message);

    await setZakazkaWorkflowStatus(supabase, {
      zakazkaId,
      nextStatus: "fakturovano",
      actorId: user.id,
      source: "invoice_issue",
      metadata: { invoice_id: invoiceRaw.id, cislo_dokladu: documentNumber },
    });

    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "invoice_issued",
      actorId: user.id,
      title: `Faktura ${documentNumber} byla vystavena.`,
      detail: `Konečná cena: ${new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(invoiceData.pricing.finalPrice)}.`,
      metadata: { invoice_id: invoiceRaw.id, cislo_dokladu: documentNumber },
    });

    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/zakazky");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function sendInvoiceEmailAction(
  zakazkaId: string,
  invoiceId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const user = await getUserOrThrow(supabase);
    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    if (!resendApiKey) return { ok: false, error: "Chybí RESEND_API_KEY." };

    const { data: invoiceRaw, error: invoiceError } = await supabase
      .from("zakazka_faktury")
      .select("id, cislo_dokladu, customer_snapshot")
      .eq("id", invoiceId)
      .eq("zakazka_id", zakazkaId)
      .maybeSingle();

    if (invoiceError) throw new Error(invoiceError.message);
    if (!invoiceRaw) return { ok: false, error: "Faktura nebyla nalezena." };

    const customer = (invoiceRaw.customer_snapshot ?? {}) as { email?: string | null; name?: string | null };
    const emailTo = customer.email?.trim();
    if (!emailTo) return { ok: false, error: "Odběratel nemá vyplněný email." };

    const headersList = await headers();
    const baseUrl = getPublicBaseUrl(headersList);
    const pdfUrl = `${baseUrl}${buildInvoiceRenderPath(invoiceId)}`;
    const pdf = await renderInvoicePdf({ url: pdfUrl });

    const resend = new Resend(resendApiKey);
    const { error: resendError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL?.trim() || "WEST COUNTY <onboarding@resend.dev>",
      to: emailTo,
      subject: `Faktura ${invoiceRaw.cislo_dokladu}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;max-width:640px;margin:0 auto;padding:24px">
          <h1 style="font-size:24px;margin:0 0 16px">Faktura ${invoiceRaw.cislo_dokladu}</h1>
          <p>Dobrý den,</p>
          <p>v příloze posíláme doklad k zakázce.</p>
        </div>
      `,
      attachments: [
        {
          filename: `faktura-${invoiceRaw.cislo_dokladu}.pdf`,
          content: Buffer.from(pdf).toString("base64"),
        },
      ],
    });

    if (resendError) throw new Error(resendError.message);

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("zakazka_faktury")
      .update({ stav: "odeslano", odeslano_at: now, email_to: emailTo, updated_at: now })
      .eq("id", invoiceId);

    if (updateError) throw new Error(updateError.message);

    await logZakazkaHistory(supabase, {
      zakazkaId,
      eventType: "invoice_sent",
      actorId: user.id,
      title: `Faktura ${invoiceRaw.cislo_dokladu} byla odeslána klientovi.`,
      detail: emailTo,
      metadata: { invoice_id: invoiceId, email_to: emailTo },
    });

    revalidatePath(`/zakazky/${zakazkaId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function archiveZakazkaAction(zakazkaId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const user = await getUserOrThrow(supabase);
    const result = await setZakazkaWorkflowStatus(supabase, {
      zakazkaId,
      nextStatus: "archiv",
      actorId: user.id,
      source: "manual_archive",
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath(`/zakazky/${zakazkaId}`);
    revalidatePath("/zakazky");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
