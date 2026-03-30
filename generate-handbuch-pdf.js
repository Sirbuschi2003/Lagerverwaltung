#!/usr/bin/env node
/**
 * Handbuch PDF-Generator
 * Konvertiert HANDBUCH.md → HANDBUCH.pdf
 *
 * Verwendung:
 *   node generate-handbuch-pdf.js
 *
 * Voraussetzungen (einmalig installieren):
 *   npm install marked puppeteer
 */

const fs = require("fs");
const path = require("path");

const HANDBUCH_MD = path.join(__dirname, "HANDBUCH.md");
const HANDBUCH_PDF = path.join(__dirname, "HANDBUCH.pdf");

async function generate() {
  // Abhängigkeiten prüfen
  let marked, puppeteer;
  try {
    marked = require("marked");
    puppeteer = require("puppeteer");
  } catch {
    console.error(
      "\n❌ Fehlende Abhängigkeiten. Bitte zuerst ausführen:\n\n   npm install marked puppeteer\n"
    );
    process.exit(1);
  }

  console.log("📖 Lese HANDBUCH.md ...");
  const markdown = fs.readFileSync(HANDBUCH_MD, "utf8");

  console.log("🔄 Konvertiere Markdown → HTML ...");
  const { marked: markedFn } = marked;
  const body = (markedFn || marked)(markdown);

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KFZ-Lagerverwaltung – Benutzerhandbuch</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    padding: 0;
  }

  /* Deckblatt */
  .cover {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    text-align: center;
    background: linear-gradient(135deg, #1976d2 0%, #0d47a1 100%);
    color: white;
    page-break-after: always;
  }
  .cover h1 { font-size: 32pt; font-weight: 700; margin-bottom: 12px; }
  .cover .subtitle { font-size: 14pt; opacity: 0.85; margin-bottom: 32px; }
  .cover .meta { font-size: 10pt; opacity: 0.6; }

  /* Inhaltsbereich */
  .content {
    max-width: 100%;
    padding: 20mm 22mm;
  }

  h1 { font-size: 22pt; color: #0d47a1; margin: 32px 0 16px; border-bottom: 2px solid #1976d2; padding-bottom: 6px; }
  h2 { font-size: 16pt; color: #1565c0; margin: 28px 0 12px; border-bottom: 1px solid #bbdefb; padding-bottom: 4px; }
  h3 { font-size: 12pt; color: #1976d2; margin: 20px 0 8px; }
  h4 { font-size: 11pt; color: #333; margin: 14px 0 6px; }

  p { margin-bottom: 10px; }

  ul, ol { margin: 8px 0 12px 24px; }
  li { margin-bottom: 4px; }

  /* Tabellen */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 20px;
    font-size: 10pt;
  }
  thead { background-color: #1976d2; color: white; }
  thead th { padding: 8px 10px; text-align: left; font-weight: 600; }
  tbody tr:nth-child(even) { background-color: #f5f9ff; }
  tbody tr:nth-child(odd) { background-color: #ffffff; }
  td { padding: 7px 10px; border-bottom: 1px solid #e3f2fd; vertical-align: top; }

  /* Code/Inline Code */
  code {
    background: #e8f4fd;
    border: 1px solid #90caf9;
    border-radius: 3px;
    padding: 1px 5px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9.5pt;
    color: #0d47a1;
  }
  pre {
    background: #f1f8ff;
    border: 1px solid #bbdefb;
    border-radius: 4px;
    padding: 12px 16px;
    margin: 10px 0;
    overflow-x: auto;
  }
  pre code { background: none; border: none; padding: 0; }

  /* Blockquotes (Tipps/Hinweise) */
  blockquote {
    border-left: 4px solid #1976d2;
    background: #e3f2fd;
    margin: 14px 0;
    padding: 10px 16px;
    border-radius: 0 4px 4px 0;
    color: #0d47a1;
  }
  blockquote p { margin: 0; }

  /* Horizontale Linie */
  hr { border: none; border-top: 1px solid #bbdefb; margin: 24px 0; }

  /* Seitenumbrüche */
  h1 { page-break-before: always; }
  h1:first-child { page-break-before: avoid; }
  h2, h3 { page-break-after: avoid; }
  table { page-break-inside: avoid; }

  /* Kopf- und Fußzeile */
  @page {
    margin: 18mm 18mm 22mm 18mm;
    @bottom-center {
      content: "KFZ-Lagerverwaltung – Benutzerhandbuch  |  Seite " counter(page);
      font-size: 9pt;
      color: #666;
    }
  }
</style>
</head>
<body>
  <div class="cover">
    <h1>KFZ-Lagerverwaltung</h1>
    <div class="subtitle">Benutzerhandbuch</div>
    <div class="meta">Vollständige Dokumentation aller Funktionen</div>
  </div>
  <div class="content">
    ${body}
  </div>
</body>
</html>`;

  console.log("🚀 Starte Puppeteer ...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  console.log("📄 Erzeuge PDF ...");
  await page.pdf({
    path: HANDBUCH_PDF,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: false,
    margin: { top: "18mm", right: "18mm", bottom: "22mm", left: "18mm" },
  });

  await browser.close();

  const stats = fs.statSync(HANDBUCH_PDF);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`\n✅ PDF erstellt: HANDBUCH.pdf (${sizeMB} MB)\n`);
}

generate().catch((err) => {
  console.error("❌ Fehler:", err.message);
  process.exit(1);
});
