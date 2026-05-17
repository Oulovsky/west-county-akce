import { unstable_noStore as noStore } from "next/cache";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import { buildInvoiceDataFromRow } from "@/lib/invoice-data";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string; invoiceId: string }>;
};

export default async function InvoicePrintPage({ params }: PageProps) {
  noStore();
  const { id, invoiceId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("zakazka_faktury")
    .select("*")
    .eq("id", invoiceId)
    .eq("zakazka_id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return <div>Faktura nebyla nalezena.</div>;

  return (
    <main className="min-h-screen bg-white py-6 print:py-0">
      <InvoiceDocument data={buildInvoiceDataFromRow(data as any)} />
    </main>
  );
}
