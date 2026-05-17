import { createHmac, timingSafeEqual } from "crypto";

function getInvoiceRenderSecret() {
  const secret =
    process.env.INVOICE_RENDER_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.RESEND_API_KEY?.trim();

  if (!secret) {
    throw new Error("Chybí INVOICE_RENDER_SECRET pro bezpečný render faktury.");
  }

  return secret;
}

export function createInvoiceRenderToken(invoiceId: string) {
  return createHmac("sha256", getInvoiceRenderSecret()).update(invoiceId).digest("hex");
}

export function verifyInvoiceRenderToken(invoiceId: string, token?: string | null) {
  if (!token) return false;

  const expected = createInvoiceRenderToken(invoiceId);
  const expectedBuffer = Buffer.from(expected, "hex");
  const tokenBuffer = Buffer.from(token, "hex");

  if (expectedBuffer.length !== tokenBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function buildInvoiceRenderPath(invoiceId: string) {
  const token = createInvoiceRenderToken(invoiceId);
  return `/faktura-render/${invoiceId}?token=${encodeURIComponent(token)}`;
}
