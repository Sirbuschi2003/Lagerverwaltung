import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type PDFKit from "pdfkit";
import puppeteer from 'puppeteer';
import QRCode from "qrcode";
import ExcelJS from "exceljs";

import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { SystemConfigService } from "../system-config/system-config.service";
import { groupInventoryLines } from "../inventory/utils/group-inventory-lines";
import { Item } from "../items/entities/item.entity";

@Injectable()
export class ExportService {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  async exportMovementsToCsv(movements: StockMovement[]): Promise<Buffer> {
    const headers = ['Datum/Zeit', 'Bewegungsart', 'Artikel-Code', 'Artikelbeschreibung', 'Fahrzeug', 'Menge', 'Benutzer', 'Bemerkung', 'Quelle'];
    
    const rows = movements.map(movement => [
      movement.occurredAt.toLocaleString('de-DE'),
      this.translateMovementType(movement.type),
      movement.item?.code || 'N/A',
      movement.item?.description || 'N/A',
      movement.vehicle?.licensePlate || 'N/A',
      movement.quantity.toString(),
      movement.user?.displayName || 'System',
      movement.note || '',
      movement.source,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    return Buffer.from('\ufeff' + csvContent, 'utf8'); // UTF-8 BOM for Excel compatibility
  }

  async exportStockToCsv(stockLevels: StockLevel[]): Promise<Buffer> {
    const headers = ['Fahrzeug', 'Artikel-Code', 'Artikelbeschreibung', 'Hersteller', 'Warengruppe', 'Ist-Bestand', 'Soll-Bestand', 'Differenz'];
    
    const rows = stockLevels.map(level => [
      level.vehicle?.licensePlate || 'N/A',
      level.item?.code || 'N/A',
      level.item?.description || 'N/A',
      level.item?.manufacturer || 'N/A',
      level.item?.productGroup || 'N/A',
      level.quantity.toString(),
      level.targetQuantity.toString(),
      (level.quantity - level.targetQuantity).toString(),
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    return Buffer.from('\ufeff' + csvContent, 'utf8');
  }

  async exportInventoryToCsv(session: InventorySession): Promise<Buffer> {
    const headers = ['Inventur-Session', 'Warenort', 'Fahrzeug', 'Artikel-Code', 'Artikelbeschreibung', 'Erwartete Menge', 'Gezählte Menge', 'Differenz', 'Bemerkung'];
    
    const rows = session.lines?.map(line => [
      session.name,
      session.location || '',
      line.vehicle?.licensePlate || 'N/A',
      line.item?.code || 'N/A',
      line.item?.description || 'N/A',
      line.expectedQuantity.toString(),
      line.countedQuantity.toString(),
      (line.countedQuantity - line.expectedQuantity).toString(),
      line.note || '',
    ]) || [];

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    return Buffer.from('\ufeff' + csvContent, 'utf8');
  }

  async exportInventoryProtocolCsv(session: InventorySession, movements: StockMovement[]): Promise<Buffer> {
    const linesHeaders = ['Inventur', 'Ort', 'Fahrzeug', 'Artikel-Code', 'Beschreibung', 'Erwartet', 'Gezählt', 'Differenz', 'Bemerkung'];
    const lineRows = (session.lines ?? []).map(line => [
      session.name,
      session.location || '',
      line.vehicle?.licensePlate || 'N/A',
      line.item?.code || 'N/A',
      line.item?.description || 'N/A',
      line.expectedQuantity.toString(),
      line.countedQuantity.toString(),
      (line.countedQuantity - line.expectedQuantity).toString(),
      line.note || '',
    ]);

    const movementHeaders = ['Datum/Zeit', 'Art', 'Artikel-Code', 'Beschreibung', 'Fahrzeug', 'Menge', 'Benutzer', 'Bemerkung', 'Quelle'];
    const movementRows = movements.map(m => [
      m.occurredAt.toLocaleString('de-DE'),
      this.translateMovementType(m.type),
      m.item?.code || 'N/A',
      m.item?.description || 'N/A',
      m.vehicle?.licensePlate || 'N/A',
      m.quantity.toString(),
      m.user?.displayName || 'System',
      m.note || '',
      m.source || '',
    ]);

    const parts: string[] = [];
    const csvEscape = (val: any) => '"' + String(val).replace(/"/g, '""') + '"';

    // Abschnitt 1: Inventur-Positionen
    parts.push(linesHeaders.map(csvEscape).join(';'));
    for (const row of lineRows) parts.push(row.map(csvEscape).join(';'));

    // Leerzeilen + Abschnitt 2: Buchungen
    parts.push('');
    parts.push('"Buchungen aus Inventur"');
    parts.push(movementHeaders.map(csvEscape).join(';'));
    for (const row of movementRows) parts.push(row.map(csvEscape).join(';'));

    return Buffer.from('\ufeff' + parts.join('\n'), 'utf8');
  }

  async exportInventoryProtocolXlsx(session: InventorySession, movements: StockMovement[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lagerverwaltung';
    wb.created = new Date();

    // Blatt 1: Inventur-Positionen
    const wsLines = wb.addWorksheet('Positionen');
    wsLines.columns = [
      { header: 'Inventur', key: 'inventur', width: 24 },
      { header: 'Ort', key: 'ort', width: 18 },
      { header: 'Fahrzeug', key: 'fahrzeug', width: 16 },
      { header: 'Artikel-Code', key: 'code', width: 20 },
      { header: 'Beschreibung', key: 'beschreibung', width: 40 },
      { header: 'Erwartet', key: 'erwartet', width: 12 },
      { header: 'Gezählt', key: 'gezaehlt', width: 12 },
      { header: 'Differenz', key: 'differenz', width: 12 },
      { header: 'Bemerkung', key: 'bemerkung', width: 24 },
    ];
    const lines = session.lines ?? [];
    for (const line of lines) {
      wsLines.addRow({
        inventur: session.name,
        ort: session.location || '',
        fahrzeug: line.vehicle?.licensePlate || 'N/A',
        code: line.item?.code || 'N/A',
        beschreibung: line.item?.description || 'N/A',
        erwartet: line.expectedQuantity,
        gezaehlt: line.countedQuantity,
        differenz: (line.countedQuantity - line.expectedQuantity),
        bemerkung: line.note || '',
      });
    }
    // Formatierung
    wsLines.getRow(1).font = { bold: true };
    wsLines.autoFilter = 'A1:I1';
    for (let r = 2; r <= wsLines.rowCount; r++) {
      const diffCell = wsLines.getCell(`H${r}`);
      const val = Number(diffCell.value ?? 0);
      diffCell.font = { color: { argb: val < 0 ? 'FFCC0000' : val > 0 ? 'FF008800' : 'FF000000' } };
    }

    // Blatt 2: Buchungen
    const wsMov = wb.addWorksheet('Buchungen');
    wsMov.columns = [
      { header: 'Datum/Zeit', key: 'zeit', width: 22 },
      { header: 'Art', key: 'art', width: 14 },
      { header: 'Artikel-Code', key: 'code', width: 20 },
      { header: 'Beschreibung', key: 'beschreibung', width: 40 },
      { header: 'Fahrzeug', key: 'fahrzeug', width: 16 },
      { header: 'Menge', key: 'menge', width: 12 },
      { header: 'Benutzer', key: 'benutzer', width: 18 },
      { header: 'Bemerkung', key: 'bemerkung', width: 24 },
      { header: 'Quelle', key: 'quelle', width: 20 },
    ];
    for (const m of movements) {
      wsMov.addRow({
        zeit: m.occurredAt.toLocaleString('de-DE'),
        art: this.translateMovementType(m.type),
        code: m.item?.code || 'N/A',
        beschreibung: m.item?.description || 'N/A',
        fahrzeug: m.vehicle?.licensePlate || 'N/A',
        menge: m.quantity,
        benutzer: m.user?.displayName || 'System',
        bemerkung: m.note || '',
        quelle: m.source || '',
      });
    }
    wsMov.getRow(1).font = { bold: true };
    wsMov.autoFilter = 'A1:I1';

    // Zusammenfassung als drittes Blatt
    const wsSummary = wb.addWorksheet('Übersicht');
    const totalItems = lines.length;
    const totalCounted = lines.reduce((sum, l) => sum + (l.countedQuantity || 0), 0);
    const totalExpected = lines.reduce((sum, l) => sum + (l.expectedQuantity || 0), 0);
    const totalDiff = totalCounted - totalExpected;
    wsSummary.addRow(['Inventur', session.name]);
    wsSummary.addRow(['Ort', session.location || '']);
    wsSummary.addRow(['Positionen', totalItems]);
    wsSummary.addRow(['Gezählt', totalCounted]);
    wsSummary.addRow(['Erwartet', totalExpected]);
    wsSummary.addRow(['Differenz', totalDiff]);
    wsSummary.getColumn(1).width = 20;
    wsSummary.getColumn(2).width = 30;
    wsSummary.getRow(1).font = { bold: true };

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // TODO: Implement PDF export with puppeteer when package is installed
  // npm install puppeteer @types/puppeteer
  async exportMovementsToPdf(movements: StockMovement[]): Promise<Buffer> {
    throw new Error('PDF export not yet implemented. Install puppeteer package first.');
  }


    async exportVehicleStockQrCatalogToPdf(stockLevels: StockLevel[], meta?: { vehicle?: string; technician?: string }): Promise<Buffer> {
      const company = await this.systemConfigService.getCompanyConfig();
      const tpl = await this.systemConfigService.getVehicleQrTemplateConfig();
      const effectiveTitle = (tpl.title?.trim() || (company.name?.trim() || "Lagerverwaltung") + " - QR-Katalog (Wagenbestand)");
      const items = stockLevels
        .filter(l => !!l.item)
        .map(l => l.item!)
        .sort((a, b) =>
          (a.productGroup || '').localeCompare(b.productGroup || '', 'de', { sensitivity: 'base' }) ||
          (a.manufacturer || '').localeCompare(b.manufacturer || '', 'de', { sensitivity: 'base' }) ||
          (a.description || '').localeCompare(b.description || '', 'de', { sensitivity: 'base' })
        );

      return this.createPdfBuffer(async (doc) => {
        const renderHeader = () => {
          if (tpl.showLogo !== false && company.logoDataUrl) {
            const buf = this.tryParseDataUrl(company.logoDataUrl);
            if (buf) doc.image(buf, doc.page.width - doc.page.margins.right - 120, doc.page.margins.top, { fit: [120, 60] });
          }
          doc.font('Helvetica-Bold').fontSize(18).text(effectiveTitle, { align: 'left' }).moveDown(0.2);
          const metaLine = [
            `Erstellt am ${new Date().toLocaleString('de-DE')}`,
            tpl.showVehicle !== false && meta?.vehicle ? `Fahrzeug: ${meta.vehicle}` : null,
            tpl.showTechnician !== false && meta?.technician ? `Techniker: ${meta.technician}` : null,
          ].filter(Boolean).join('  |  ');
          doc.font('Helvetica').fontSize(10).fillColor('#555').text(metaLine).moveDown(0.5);
          doc.fillColor('#000');
          // Tabellenkopf
          doc.font('Helvetica-Bold').fontSize(11);
          const leftX = doc.page.margins.left;
          const colCode = leftX;
          const colDesc = colCode + (tpl.codeWidth ?? 110);
          const qrSize = tpl.qrSize ?? 48;
          const colQr = doc.page.width - doc.page.margins.right - qrSize; // QR rechts mit Platz nach Größe
          doc.text('Artikelnummer', colCode, doc.y, { width: tpl.codeWidth ?? 110 });
          doc.text('Bezeichnung', colDesc, doc.y, { width: colQr - colDesc - 10 });
          doc.text('QR-Code', colQr, doc.y);
          doc.moveDown(0.4);
          const y = doc.y;
          doc.moveTo(leftX, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
        };

        renderHeader();
        const qrSize = tpl.qrSize ?? 48;
        const baseRowHeight = Math.max(64, qrSize + 16);
        const marginY = 8;
        let currentGroup: string | null = null;

        for (const it of items) {
          const group = it.productGroup || '';
          if (tpl.showGroupHeaders !== false && group !== currentGroup) {
            // Platz prüfen, dann Gruppen-Überschrift
            if (doc.y + baseRowHeight > doc.page.height - doc.page.margins.bottom) {
              doc.addPage();
              renderHeader();
            }
            doc.moveDown(0.6);
            doc.font('Helvetica-Bold').fontSize(12).text(group || 'Warengruppe', { align: 'left' });
            currentGroup = group;
          }

          if (doc.y + baseRowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            renderHeader();
          }

          const yStart = doc.y + marginY;
          const colCode = doc.page.margins.left;
          const colDesc = colCode + (tpl.codeWidth ?? 110);
          const colQr = doc.page.width - doc.page.margins.right - (qrSize + 4);

          const codeVal = it.qrCodeValue?.trim() || it.code;
          const parts: string[] = [];
          if (tpl.showManufacturerTag !== false && it.manufacturer) parts.push(`[${it.manufacturer}]`);
          if (it.description) parts.push(it.description);
          if (tpl.showSecondaryDescription !== false && it.descriptionSecondary) parts.push('— ' + it.descriptionSecondary);
          const desc = parts.join(' ');

          const codeWidth = tpl.codeWidth ?? 110;
          const descWidth = tpl.descWidth ?? (colQr - colDesc - 10);
          const textHeight = Math.max(
            doc.heightOfString(codeVal, { width: codeWidth, lineBreak: false }),
            doc.heightOfString(desc, { width: descWidth, lineBreak: false }),
          );
          const yText = yStart + Math.max(0, (baseRowHeight - textHeight) / 2);
          const yQr = yStart + Math.max(0, (baseRowHeight - qrSize) / 2);

          doc.font('Helvetica-Bold').fontSize(11).text(codeVal, colCode, yText, { width: codeWidth, lineBreak: false });
          doc.font('Helvetica').fontSize(10).text(desc, colDesc, yText, { width: descWidth, lineBreak: false });

          // eslint-disable-next-line no-await-in-loop
          const png = await QRCode.toBuffer(codeVal, { type: 'png', errorCorrectionLevel: 'M', margin: 0, scale: 4 });
          doc.image(png, colQr, yQr, { width: qrSize, height: qrSize, align: 'right' });

          const afterY = yStart + baseRowHeight;
          doc.moveTo(doc.page.margins.left, afterY).lineTo(doc.page.width - doc.page.margins.right, afterY).stroke();
          doc.y = afterY;
        }
      });
    }
  async exportStockToPdf(stockLevels: StockLevel[]): Promise<Buffer> {
    throw new Error('PDF export not yet implemented. Install puppeteer package first.');
  }

  async exportInventoryToPdf(session: InventorySession): Promise<Buffer> {
    const company = await this.systemConfigService.getCompanyConfig();

    const groupedLines = groupInventoryLines(session.lines ?? []);

    return this.createPdfBuffer((doc) => {
      this.renderInventoryPdf(doc, session, groupedLines, company);
    });
  }

  async exportInventoryProtocolPdf(session: InventorySession, movements: StockMovement[]): Promise<Buffer> {
    const company = await this.systemConfigService.getCompanyConfig();
    const groups = groupInventoryLines(session.lines ?? []);

    return this.createPdfBuffer((doc) => {
      this.renderInventoryPdf(doc, session, groups, company);

      // Neue Seite für Buchungen, falls nötig
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }

      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(12).text('Buchungen aus Inventur', { align: 'left' }).moveDown(0.4);

      // Tabellenkopf (dynamische Spaltenbreiten für sauberes Layout)
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const gapSize = 6; // Abstand zwischen Spalten
      const gaps = 6; // 7 Spalten => 6 Zwischenräume
      const avail = contentWidth - gaps * gapSize;
      const cols = [
        { label: 'Datum/Zeit', width: Math.round(avail * 0.18) },
        { label: 'Art', width: Math.round(avail * 0.09) },
        { label: 'Artikel', width: Math.round(avail * 0.14) },
        { label: 'Beschreibung', width: Math.round(avail * 0.27) },
        { label: 'Fahrzeug', width: Math.round(avail * 0.11) },
        { label: 'Menge', width: Math.round(avail * 0.08), align: 'right' as const },
        { label: 'Benutzer', width: Math.round(avail * 0.13) },
      ];
      const pos: number[] = [];
      cols.forEach((c, i) => pos.push(i === 0 ? doc.page.margins.left : pos[i-1] + cols[i-1].width + gapSize));
      doc.font('Helvetica-Bold').fontSize(9);
      cols.forEach((c, i) => doc.text(c.label, pos[i], doc.y, { width: c.width, align: c.align || 'left' }));
      doc.moveDown(0.3);
      const ySep = doc.y; doc.moveTo(doc.page.margins.left, ySep).lineTo(doc.page.width - doc.page.margins.right, ySep).stroke();
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(8.5);

      const ensure = (h: number) => {
        if (doc.y + h > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          doc.font('Helvetica-Bold').fontSize(9);
          cols.forEach((c, i) => doc.text(c.label, pos[i], doc.y, { width: c.width, align: c.align || 'left' }));
          doc.moveDown(0.3);
          const y = doc.y; doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
          doc.moveDown(0.2);
          doc.font('Helvetica').fontSize(8.5);
        }
      };

      for (const m of movements) {
        ensure(16);
        const vals = [
          m.occurredAt.toLocaleString('de-DE'),
          this.translateMovementType(m.type),
          m.item?.code || '—',
          m.item?.description || '—',
          m.vehicle?.licensePlate || '—',
          String(m.quantity),
          m.user?.displayName || 'System',
        ];
        vals.forEach((v, i) => doc.text(v, pos[i], doc.y, { width: cols[i].width, align: cols[i].align || 'left' }));
        doc.moveDown(0.3);
      }
    }, { layout: 'landscape', margin: 36 });
  }

  async exportItemsQrCatalogToPdf(items: Item[]): Promise<Buffer> {
    const company = await this.systemConfigService.getCompanyConfig();
    const title = (company.name?.trim() || "Lagerverwaltung") + " - QR-Katalog";

    // Sortierung nach Hersteller, Warengruppe, Beschreibung
    const sorted = [...items].sort((a, b) =>
      (a.manufacturer || '').localeCompare(b.manufacturer || '', 'de', { sensitivity: 'base' }) ||
      (a.productGroup || '').localeCompare(b.productGroup || '', 'de', { sensitivity: 'base' }) ||
      (a.description || '').localeCompare(b.description || '', 'de', { sensitivity: 'base' })
    );

    return this.createPdfBuffer(async (doc) => {
      const renderHeader = () => {
        if (company.logoDataUrl) {
          const buf = this.tryParseDataUrl(company.logoDataUrl);
          if (buf) doc.image(buf, doc.page.width - doc.page.margins.right - 120, doc.page.margins.top, { fit: [120, 60] });
        }
        doc.font('Helvetica-Bold').fontSize(18).text(title, { align: 'left' }).moveDown(0.3);
        doc.font('Helvetica').fontSize(10).fillColor('#555').text(`Erstellt am ${new Date().toLocaleString('de-DE')}`).moveDown(0.6);
        doc.fillColor('#000');
        // Tabellenkopf
        doc.font('Helvetica-Bold').fontSize(11);
        const leftX = doc.page.margins.left;
        const colCode = leftX;
        const colDesc = colCode + 140;
        const colQr = doc.page.width - doc.page.margins.right - 80; // QR rechts
        doc.text('Artikelnummer', colCode, doc.y, { width: 130 });
        doc.text('Bezeichnung', colDesc, doc.y, { width: colQr - colDesc - 10 });
        doc.text('QR-Code', colQr, doc.y);
        doc.moveDown(0.4);
        const y = doc.y;
        doc.moveTo(leftX, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
      };

      renderHeader();

      const rowHeight = 80; // Platz für 64x64 QR
      const qrSize = 64;
      const marginY = 8;

      for (const it of sorted) {
        // Platz prüfen
        if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          renderHeader();
        }

        const yStart = doc.y + marginY;
        const colCode = doc.page.margins.left;
        const colDesc = colCode + 140;
        const colQr = doc.page.width - doc.page.margins.right - (qrSize + 4);

        const codeVal = it.qrCodeValue?.trim() || it.code;

        // Textspalten
        doc.font('Helvetica-Bold').fontSize(11).text(codeVal, colCode, yStart, { width: 130 });
        doc.font('Helvetica').fontSize(10).text(`${it.description || ''}${it.descriptionSecondary ? ' — ' + it.descriptionSecondary : ''}`,
          colDesc, yStart, { width: colQr - colDesc - 10 });

        // QR-Code rendern
        // Erzeuge synchrones Buffer via toBuffer (Promise)
        // Wir rendern seriell, PDFKit ist stream-basiert
        // Hohe Fehlerkorrektur für zuverlässiges Scannen (M)
        // Falls Code zu lang ist, wird er trotzdem erzeugt
        // eslint-disable-next-line no-await-in-loop
        const png = await QRCode.toBuffer(codeVal, { type: 'png', errorCorrectionLevel: 'M', margin: 0, scale: 4 });
        doc.image(png, colQr, yStart, { width: qrSize, height: qrSize, align: 'right' });

        // Trennlinie
        const afterY = Math.max(yStart + qrSize + marginY, doc.y + 12);
        doc.moveTo(doc.page.margins.left, afterY).lineTo(doc.page.width - doc.page.margins.right, afterY).stroke();
        doc.y = afterY;
      }
    });
  }

  private createPdfBuffer(
    builder: (doc: PDFKit.PDFDocument) => void | Promise<void>,
    options?: PDFKit.PDFDocumentOptions,
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margin: 50, ...(options || {}) });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk as Buffer));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (error) => reject(error));

      try {
        await builder(doc);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private renderInventoryPdf(
    doc: PDFKit.PDFDocument,
    session: InventorySession,
    groups: ReturnType<typeof groupInventoryLines>,
    company: { name: string | null; logoDataUrl: string | null },
  ) {
    const title = company.name?.trim() || "Lagerverwaltung";

    const renderPageHeader = () => {
      if (company.logoDataUrl) {
        const logoBuffer = this.tryParseDataUrl(company.logoDataUrl);
        if (logoBuffer) {
          const maxWidth = 120;
          const maxHeight = 60;
          doc.image(logoBuffer, doc.page.width - doc.page.margins.right - maxWidth, doc.page.margins.top, {
            fit: [maxWidth, maxHeight],
            align: "right",
          });
        }
      }

      doc.font("Helvetica-Bold").fontSize(20).text(title, { align: "left" }).moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(16).text(`Inventurbericht: ${session.name}`, { align: "left" }).moveDown(0.8);

      doc.font("Helvetica").fontSize(11);
      const infoLeftX = 50;
      const infoRightX = 300;
      const startY = doc.y;

      doc.text(`Freigegeben durch:`, infoLeftX, startY);
      doc.text(`${session.createdBy}`, infoLeftX + 120, startY);

      if (session.location) {
        doc.text(`Warenort/Lagerort:`, infoRightX, startY);
        doc.text(`${session.location}`, infoRightX + 120, startY);
      }

      doc.y = startY + 20;
      doc.text(`Gestartet am:`, infoLeftX, doc.y);
      doc.text(`${session.startedAt.toLocaleString("de-DE")}`, infoLeftX + 120, doc.y);

      if (session.completedAt) {
        doc.text(`Abgeschlossen am:`, infoRightX, doc.y);
        doc.text(`${session.completedAt.toLocaleString("de-DE")}`, infoRightX + 120, doc.y);
      }

      doc.moveDown(1);
    };

    renderPageHeader();

    const statistics = (() => {
      const allLines = groups.flatMap((group) => group.lines);
      const totalItems = allLines.length;
      const totalCounted = allLines.reduce((sum, line) => sum + (line.countedQuantity || 0), 0);
      const totalExpected = allLines.reduce((sum, line) => sum + (line.expectedQuantity || 0), 0);
      const totalDiff = totalCounted - totalExpected;
      return { totalItems, totalCounted, totalExpected, totalDiff };
    })();

    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(
        `Gesamt: ${statistics.totalItems} Positionen | Gezählt: ${statistics.totalCounted} | Erwartet: ${statistics.totalExpected} | Differenz: ${statistics.totalDiff >= 0 ? "+" : ""}${statistics.totalDiff}`,
        { align: "left" },
      )
      .moveDown(0.6);

    let positionCounter = 1;
    groups.forEach((group, index) => {
      if (index > 0) {
        doc.addPage();
        renderPageHeader();
      }

      doc.font("Helvetica-Bold").fontSize(12).text(`${group.manufacturer} – ${group.productGroup}`, { align: "left" }).moveDown(0.4);

      positionCounter = this.drawInventoryTable(doc, group.lines, positionCounter);
    });

    if (doc.y > doc.page.height - 160) {
      doc.addPage();
      renderPageHeader();
    }

    doc.moveDown(1.5);
    const signatureY = doc.y;
    doc.font("Helvetica").fontSize(11).text("Unterschrift Prüfer:", 50, signatureY).text("______________________________", 50, signatureY + 20);
    doc
      .text("Unterschrift Verantwortlicher:", 320, signatureY)
      .text("______________________________", 320, signatureY + 20);

    doc
      .fontSize(9)
      .fillColor("#666666")
      .text(`Erstellt am: ${new Date().toLocaleString("de-DE")}`, 50, doc.page.height - 30, { align: "right" });
  }

  private drawInventoryTable(
    doc: PDFKit.PDFDocument,
    lines: InventorySession["lines"],
    positionStart: number,
  ) {
    const tableTop = doc.y;
    const columnDefinitions = [
      { label: "Pos.", width: 35 },
      { label: "Artikel-Nr.", width: 75 },
      { label: "Bezeichnung 1", width: 125 },
      { label: "Bezeichnung 2", width: 110 },
      { label: "Soll", width: 35, align: "right" as const },
      { label: "Ist", width: 35, align: "right" as const },
      { label: "Diff", width: 35, align: "right" as const },
      { label: "Bemerkung", width: 110 },
    ];

    const columnPositions = columnDefinitions.reduce<number[]>((positions, column, index) => {
      if (index === 0) {
        positions.push(doc.page.margins.left);
      } else {
        const prevPosition = positions[index - 1];
        positions.push(prevPosition + columnDefinitions[index - 1].width + 3);
      }
      return positions;
    }, []);

    const drawHeader = () => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");

      columnDefinitions.forEach((column, index) => {
        doc.text(column.label, columnPositions[index], doc.y, {
          width: column.width,
          align: column.align || "left",
        });
      });

      doc.moveDown();
      const headerBottom = doc.y;
      doc
        .moveTo(columnPositions[0], tableTop - 4)
        .lineTo(doc.page.width - doc.page.margins.right, tableTop - 4)
        .stroke();
      doc
        .moveTo(columnPositions[0], headerBottom)
        .lineTo(doc.page.width - doc.page.margins.right, headerBottom)
        .stroke();
      doc.moveDown(0.3);
    };

    const ensureSpaceForRow = (rowHeight: number) => {
      if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage();
        doc.moveDown(0.5);
        drawHeader();
      }
    };

    drawHeader();

    doc.font("Helvetica").fontSize(8.5).fillColor("#000000");

    let position = positionStart;

    lines.forEach((line) => {
      const rowHeight = 16;
      ensureSpaceForRow(rowHeight);

      const diff = (line.countedQuantity || 0) - (line.expectedQuantity || 0);
      const diffColor = diff < 0 ? "#CC0000" : diff > 0 ? "#008800" : "#000000";

      const values = [
        position.toString(),
        line.item?.code || "",
        line.item?.description || "",
        line.item?.descriptionSecondary || "",
        (line.expectedQuantity || 0).toString(),
        (line.countedQuantity || 0).toString(),
        (diff >= 0 ? "+" : "") + diff.toString(),
        line.note || "",
      ];

      values.forEach((value, index) => {
        if (index === 6) {
          doc.fillColor(diffColor);
        }

        doc.text(value, columnPositions[index], doc.y, {
          width: columnDefinitions[index].width,
          align: columnDefinitions[index].align || "left",
        });

        if (index === 6) {
          doc.fillColor("#000000");
        }
      });

      doc.moveDown(0.5);
      position += 1;
    });

    return position;
  }  private tryParseDataUrl(dataUrl: string): Buffer | null {
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return null;
    }

    try {
      return Buffer.from(match[2], "base64");
    } catch {
      return null;
    }
  }

  private generateMovementsHtml(movements: StockMovement[]): string {
    const rows = movements.map(movement => `
      <tr>
        <td>${movement.occurredAt.toLocaleString('de-DE')}</td>
        <td>${this.translateMovementType(movement.type)}</td>
        <td>${movement.item?.code || 'N/A'}</td>
        <td>${movement.item?.description || 'N/A'}</td>
        <td>${movement.vehicle?.licensePlate || 'N/A'}</td>
        <td>${movement.quantity}</td>
        <td>${movement.user?.displayName || 'System'}</td>
        <td>${movement.note || ''}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bewegungsbericht</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .header { text-align: center; margin-bottom: 30px; }
          .date { color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lagerverwaltung - Bewegungsbericht</h1>
          <div class="date">Erstellt am: ${new Date().toLocaleString('de-DE')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Datum/Zeit</th>
              <th>Art</th>
              <th>Artikel-Code</th>
              <th>Beschreibung</th>
              <th>Fahrzeug</th>
              <th>Menge</th>
              <th>Benutzer</th>
              <th>Bemerkung</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;
  }

  private generateStockHtml(stockLevels: StockLevel[]): string {
    const rows = stockLevels.map(level => {
      const difference = level.quantity - level.targetQuantity;
      const diffClass = difference < 0 ? 'negative' : difference > 0 ? 'positive' : '';
      
      return `
        <tr>
          <td>${level.vehicle?.licensePlate || 'N/A'}</td>
          <td>${level.item?.code || 'N/A'}</td>
          <td>${level.item?.description || 'N/A'}</td>
          <td>${level.item?.manufacturer || 'N/A'}</td>
          <td>${level.quantity}</td>
          <td>${level.targetQuantity}</td>
          <td class="${diffClass}">${difference > 0 ? '+' : ''}${difference}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Bestandsbericht</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .header { text-align: center; margin-bottom: 30px; }
          .date { color: #666; font-size: 14px; }
          .negative { color: red; font-weight: bold; }
          .positive { color: green; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lagerverwaltung - Bestandsbericht</h1>
          <div class="date">Erstellt am: ${new Date().toLocaleString('de-DE')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fahrzeug</th>
              <th>Artikel-Code</th>
              <th>Beschreibung</th>
              <th>Hersteller</th>
              <th>Ist-Bestand</th>
              <th>Soll-Bestand</th>
              <th>Differenz</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;
  }

  private generateInventoryHtml(session: InventorySession): string {
    const rows = session.lines?.map(line => {
      const difference = line.countedQuantity - line.expectedQuantity;
      const diffClass = difference < 0 ? 'negative' : difference > 0 ? 'positive' : '';
      
      return `
        <tr>
          <td>${line.vehicle?.licensePlate || 'N/A'}</td>
          <td>${line.item?.code || 'N/A'}</td>
          <td>${line.item?.description || 'N/A'}</td>
          <td>${line.expectedQuantity}</td>
          <td>${line.countedQuantity}</td>
          <td class="${diffClass}">${difference > 0 ? '+' : ''}${difference}</td>
          <td>${line.note || ''}</td>
        </tr>
      `;
    }).join('') || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Inventurbericht</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          h1 { color: #333; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .header { text-align: center; margin-bottom: 30px; }
          .session-info { margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
          .date { color: #666; font-size: 14px; }
          .negative { color: red; font-weight: bold; }
          .positive { color: green; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Lagerverwaltung - Inventurbericht</h1>
          <div class="date">Erstellt am: ${new Date().toLocaleString('de-DE')}</div>
        </div>
        <div class="session-info">
          <h2>Inventur-Session: ${session.name}</h2>
          <p><strong>Erstellt von:</strong> ${session.createdBy}</p>
          <p><strong>Gestartet am:</strong> ${session.startedAt.toLocaleString('de-DE')}</p>
          ${session.completedAt ? `<p><strong>Abgeschlossen am:</strong> ${session.completedAt.toLocaleString('de-DE')}</p>` : '<p><strong>Status:</strong> In Bearbeitung</p>'}
        </div>
        <table>
          <thead>
            <tr>
              <th>Fahrzeug</th>
              <th>Artikel-Code</th>
              <th>Beschreibung</th>
              <th>Erwartet</th>
              <th>Gezählt</th>
              <th>Differenz</th>
              <th>Bemerkung</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Render HTML template to PDF using Puppeteer with Mustache-style placeholders
   */
  async renderHtmlToPdf(items: Item[], vehicleName?: string, technicianName?: string): Promise<Buffer> {
    const template = await this.systemConfigService.getPdfHtmlTemplate();
    const company = await this.systemConfigService.getCompanyConfig();

    // Sort items by productGroup > manufacturer > description
    const sorted = [...items].sort((a, b) =>
      (a.productGroup || '').localeCompare(b.productGroup || '', 'de', { sensitivity: 'base' }) ||
      (a.manufacturer || '').localeCompare(b.manufacturer || '', 'de', { sensitivity: 'base' }) ||
      (a.description || '').localeCompare(b.description || '', 'de', { sensitivity: 'base' })
    );

    // Group items by product group for headers
    const groups: { groupName: string; items: Item[] }[] = [];
    let currentGroup: string | null = null;
    let currentItems: Item[] = [];

    for (const item of sorted) {
      const group = item.productGroup || 'Ohne Warengruppe';
      if (group !== currentGroup) {
        if (currentItems.length > 0) {
          groups.push({ groupName: currentGroup!, items: currentItems });
        }
        currentGroup = group;
        currentItems = [];
      }
      currentItems.push(item);
    }
    if (currentItems.length > 0) {
      groups.push({ groupName: currentGroup!, items: currentItems });
    }

    // Generate QR codes for all items
    const qrCodes = new Map<string, string>();
    for (const item of sorted) {
      const codeVal = item.qrCodeValue?.trim() || item.code;
      if (!qrCodes.has(codeVal)) {
        const dataUrl = await QRCode.toDataURL(codeVal, { 
          errorCorrectionLevel: 'M', 
          margin: 0, 
          width: 256 
        });
        qrCodes.set(codeVal, dataUrl);
      }
    }

    // Prepare template data
    const title = (company.name?.trim() || "Lagerverwaltung") + " - QR-Katalog";
    const subtitle = `Erstellt am ${new Date().toLocaleString('de-DE')}`;

    // Replace placeholders using simple string replacement (Mustache-style)
    let html = template.html;
    
    // Simple conditionals: {{#key}}...{{/key}} (show if truthy), {{^key}}...{{/key}} (show if falsy)
    const replaceConditional = (text: string, key: string, value: any, content: string) => {
      const showPattern = new RegExp(`\\{\\{#${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
      const hidePattern = new RegExp(`\\{\\{\\^${key}\\}\\}([\\s\\S]*?)\\{\\{\\/${key}\\}\\}`, 'g');
      text = text.replace(showPattern, value ? content : '');
      text = text.replace(hidePattern, value ? '' : content);
      return text;
    };

    // Replace header values
    html = html.replace(/\{\{title\}\}/g, this.escapeHtml(title));
    html = html.replace(/\{\{subtitle\}\}/g, this.escapeHtml(subtitle));
    html = replaceConditional(html, 'logo', company.logoDataUrl, company.logoDataUrl || '');
    html = html.replace(/\{\{logo\}\}/g, company.logoDataUrl || '');
    html = replaceConditional(html, 'vehicle', vehicleName, vehicleName || '');
    html = html.replace(/\{\{vehicle\}\}/g, this.escapeHtml(vehicleName || ''));
    html = replaceConditional(html, 'technician', technicianName, technicianName || '');
    html = html.replace(/\{\{technician\}\}/g, this.escapeHtml(technicianName || ''));

    // Build group headers HTML
    let groupHeadersHtml = '';
    let itemsHtml = '';

    for (const group of groups) {
      // Extract template for group header
      const groupHeaderMatch = html.match(/\{\{#groupHeaders\}\}([\s\S]*?)\{\{\/groupHeaders\}\}/);
      if (groupHeaderMatch) {
        let groupHeaderTemplate = groupHeaderMatch[1];
        groupHeaderTemplate = groupHeaderTemplate.replace(/\{\{groupName\}\}/g, this.escapeHtml(group.groupName));
        groupHeadersHtml += groupHeaderTemplate;
      }

      // Build items for this group
      const itemMatch = html.match(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/);
      if (itemMatch) {
        const itemTemplate = itemMatch[1];
        for (const item of group.items) {
          let itemHtml = itemTemplate;
          const codeVal = item.qrCodeValue?.trim() || item.code;
          
          itemHtml = replaceConditional(itemHtml, 'manufacturerTag', item.manufacturer, item.manufacturer || '');
          itemHtml = itemHtml.replace(/\{\{manufacturer\}\}/g, this.escapeHtml(item.manufacturer || ''));
          itemHtml = itemHtml.replace(/\{\{code\}\}/g, this.escapeHtml(codeVal));
          itemHtml = itemHtml.replace(/\{\{description\}\}/g, this.escapeHtml(item.description || ''));
          itemHtml = replaceConditional(itemHtml, 'secondaryDescription', item.descriptionSecondary, item.descriptionSecondary || '');
          itemHtml = itemHtml.replace(/\{\{secondaryDescription\}\}/g, this.escapeHtml(item.descriptionSecondary || ''));
          itemHtml = itemHtml.replace(/\{\{qrCodeDataUrl\}\}/g, qrCodes.get(codeVal) || '');
          
          itemsHtml += itemHtml;
        }
      }
    }

    // Replace group headers and items blocks
    html = html.replace(/\{\{#groupHeaders\}\}[\s\S]*?\{\{\/groupHeaders\}\}/g, groupHeadersHtml);
    html = html.replace(/\{\{#items\}\}[\s\S]*?\{\{\/items\}\}/g, itemsHtml);

    // Inject CSS
    const fullHtml = html.replace('</head>', `<style>${template.css}</style></head>`);

    // Render with Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private translateMovementType(type: string): string {
    const translations: Record<string, string> = {
      'CHECKIN': 'Einlagerung',
      'CHECKOUT': 'Entnahme',
      'ADJUSTMENT': 'Korrektur'
    };
    return translations[type] || type;
  }
}

