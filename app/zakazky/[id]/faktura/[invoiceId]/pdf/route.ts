import { NextRequest, NextResponse } from "next/server";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { buildInvoiceRenderPath } from "@/lib/invoice-render-token";

type RouteContext = {
  params: Promise<{ id: string; invoiceId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { invoiceId } = await params;
  const renderUrl = new URL(buildInvoiceRenderPath(invoiceId), req.url);
  let pdf: Uint8Array;

  try {
    pdf = await renderInvoicePdf({ url: renderUrl.toString() });
  } catch (error) {
    console.error("Invoice PDF render failed, falling back to HTML render:", error);
    renderUrl.searchParams.set("fallback", "pdf_unavailable");
    return NextResponse.redirect(renderUrl);
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="faktura-${invoiceId}.pdf"`,
    },
  });
}
