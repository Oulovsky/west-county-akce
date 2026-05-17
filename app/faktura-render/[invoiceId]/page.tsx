import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { buildInvoiceDataFromRow } from "@/lib/invoice-data";
import { verifyInvoiceRenderToken } from "@/lib/invoice-render-token";
import { createAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{ invoiceId: string }>;
  searchParams?: Promise<{ token?: string }>;
};

export default async function InvoiceServerRenderPage({ params, searchParams }: PageProps) {
  noStore();
  const { invoiceId } = await params;
  const resolvedSearchParams = await searchParams;

  if (!verifyInvoiceRenderToken(invoiceId, resolvedSearchParams?.token)) {
    notFound();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("zakazka_faktury")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-white py-6 print:py-0">
      <div id="invoice-render-ok" className="sr-only">
        Invoice render OK
      </div>
      <InvoiceDocument data={buildInvoiceDataFromRow(data as any)} />
    </main>
  );
}
