import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const manualDir = path.join(rootDir, "docs", "interni-manual");
const htmlPath = path.join(manualDir, "index.html");
const pdfPath = path.join(manualDir, "WEST-COUNTY-AKCE-Interni-manual.pdf");

if (!fs.existsSync(htmlPath)) {
  console.error("Chybí:", htmlPath);
  process.exit(1);
}

const htmlUrl = "file:///" + htmlPath.replace(/\\/g, "/");

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.goto(htmlUrl, { waitUntil: "networkidle0", timeout: 120000 });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: {
      top: "16mm",
      right: "12mm",
      bottom: "16mm",
      left: "12mm",
    },
  });
  console.log("PDF vytvořeno:", pdfPath);
} finally {
  await browser.close();
}
