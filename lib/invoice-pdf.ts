import puppeteer from "puppeteer";

export async function renderInvoicePdf({
  url,
}: {
  url: string;
}) {
  // TODO: Before deploying PDF generation to Vercel/serverless, replace bundled
  // Chromium with a serverless-compatible strategy, for example puppeteer-core
  // plus @sparticuz/chromium or an external PDF renderer.
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const response = await page.goto(url, { waitUntil: "networkidle0" });
    if (!response || !response.ok()) {
      throw new Error(`Render faktury selhal: HTTP ${response?.status() ?? "bez odpovědi"}.`);
    }

    const hasRenderMarker = await page.$("#invoice-render-ok");
    if (!hasRenderMarker) {
      throw new Error("Render faktury selhal: stránka neobsahuje platný fakturační dokument.");
    }

    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm",
      },
    });
  } finally {
    await browser.close();
  }
}
