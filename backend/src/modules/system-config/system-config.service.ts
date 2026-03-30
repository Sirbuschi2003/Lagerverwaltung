import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import { SystemConfig } from "../logging/entities/system-config.entity";

export interface CompanyConfig {
  name: string | null;
  logoDataUrl: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
}

export interface VehicleQrTemplateConfig {
  title?: string | null;
  showLogo?: boolean; // default: true
  showVehicle?: boolean; // default: true
  showTechnician?: boolean; // default: true
  qrSize?: number; // points (PDFKit), default: 48
  codeWidth?: number; // points, default: 110
  descWidth?: number; // points, default: 300
  showManufacturerTag?: boolean; // default: true
  showGroupHeaders?: boolean; // default: true
  showSecondaryDescription?: boolean; // default: true
}

export interface PdfHtmlTemplate {
  html: string;
  css: string;
}

export interface PurchaseOrderDesignerElement {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
  content?: string;
}

export interface PurchaseOrderDesignerConfig {
  version: number;
  page: {
    width: number;
    height: number;
    orientation: "portrait" | "landscape";
  };
  elements: PurchaseOrderDesignerElement[];
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

@Injectable()
export class SystemConfigService {
  private ensureValueColumnPromise?: Promise<void>;

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async getCompanyConfig(): Promise<CompanyConfig> {
    const [
      nameConfig,
      logoConfig,
      addressLine1Config,
      addressLine2Config,
      postalCodeConfig,
      cityConfig,
      countryConfig,
      phoneConfig,
      emailConfig,
    ] = await Promise.all([
      this.configRepository.findOne({ where: { key: "company.name" } }),
      this.configRepository.findOne({ where: { key: "company.logo" } }),
      this.configRepository.findOne({ where: { key: "company.addressLine1" } }),
      this.configRepository.findOne({ where: { key: "company.addressLine2" } }),
      this.configRepository.findOne({ where: { key: "company.postalCode" } }),
      this.configRepository.findOne({ where: { key: "company.city" } }),
      this.configRepository.findOne({ where: { key: "company.country" } }),
      this.configRepository.findOne({ where: { key: "company.phone" } }),
      this.configRepository.findOne({ where: { key: "company.email" } }),
    ]);

    return {
      name: nameConfig?.value ?? null,
      logoDataUrl: logoConfig?.value ?? null,
      addressLine1: addressLine1Config?.value ?? null,
      addressLine2: addressLine2Config?.value ?? null,
      postalCode: postalCodeConfig?.value ?? null,
      city: cityConfig?.value ?? null,
      country: countryConfig?.value ?? null,
      phone: phoneConfig?.value ?? null,
      email: emailConfig?.value ?? null,
    };
  }

  async updateCompanyConfig(payload: {
    name: string;
    logoDataUrl?: string | null;
    removeLogo?: boolean;
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
  }): Promise<CompanyConfig> {
    await this.ensureValueColumnIsLongText();

    await this.saveConfig(
      "company.name",
      payload.name.trim(),
      "Firmenname fuer Dokumente und Login-Seite",
    );

    if (payload.removeLogo) {
      await this.configRepository.delete({ key: "company.logo" });
    } else if (payload.logoDataUrl) {
      await this.saveConfig("company.logo", payload.logoDataUrl, "Firmenlogo (Data URL)");
    }

    const saveOptional = async (key: string, value?: string | null, description?: string) => {
      if (value === undefined) return;
      const trimmed = value?.trim() ?? "";
      if (trimmed) {
        await this.saveConfig(key, trimmed, description);
      } else {
        await this.configRepository.delete({ key });
      }
    };

    await saveOptional("company.addressLine1", payload.addressLine1, "Firmenadresse Zeile 1");
    await saveOptional("company.addressLine2", payload.addressLine2, "Firmenadresse Zeile 2");
    await saveOptional("company.postalCode", payload.postalCode, "Firmenadresse PLZ");
    await saveOptional("company.city", payload.city, "Firmenadresse Ort");
    await saveOptional("company.country", payload.country, "Firmenadresse Land");
    await saveOptional("company.phone", payload.phone, "Firmen-Telefon");
    await saveOptional("company.email", payload.email, "Firmen-E-Mail");

    return this.getCompanyConfig();
  }

  async getJsonConfig<T = any>(key: string): Promise<T | null> {
    const rec = await this.configRepository.findOne({ where: { key } });
    if (!rec?.value) return null;
    try {
      return JSON.parse(rec.value) as T;
    } catch {
      return null;
    }
  }

  async setJsonConfig(key: string, value: any, description?: string): Promise<void> {
    await this.ensureValueColumnIsLongText();
    await this.saveConfig(key, JSON.stringify(value ?? {}), description);
  }

  async getVehicleQrTemplateConfig(): Promise<VehicleQrTemplateConfig> {
    const tpl = await this.getJsonConfig<VehicleQrTemplateConfig>("reports.vehicleQrTemplate");
    return {
      title: tpl?.title ?? null,
      showLogo: tpl?.showLogo ?? true,
      showVehicle: tpl?.showVehicle ?? true,
      showTechnician: tpl?.showTechnician ?? true,
      qrSize: tpl?.qrSize ?? 48,
      codeWidth: tpl?.codeWidth ?? 110,
      descWidth: tpl?.descWidth ?? 300,
      showManufacturerTag: tpl?.showManufacturerTag ?? true,
      showGroupHeaders: tpl?.showGroupHeaders ?? true,
      showSecondaryDescription: tpl?.showSecondaryDescription ?? true,
    };
  }

  async setVehicleQrTemplateConfig(cfg: VehicleQrTemplateConfig): Promise<VehicleQrTemplateConfig> {
    await this.setJsonConfig("reports.vehicleQrTemplate", cfg, "Vorlage fuer Wagen-QR-Katalog");
    return this.getVehicleQrTemplateConfig();
  }

  async getPdfHtmlTemplate(): Promise<PdfHtmlTemplate> {
    const tpl = await this.getJsonConfig<PdfHtmlTemplate>("reports.pdfHtmlTemplate");
    if (tpl?.html && tpl?.css) {
      return tpl;
    }
    // Return default template if not configured
    return this.getDefaultPdfHtmlTemplate();
  }

  async setPdfHtmlTemplate(template: PdfHtmlTemplate): Promise<PdfHtmlTemplate> {
    await this.setJsonConfig("reports.pdfHtmlTemplate", template, "HTML/CSS Template fuer PDF-Generierung");
    return this.getPdfHtmlTemplate();
  }

  async getPurchaseOrderPdfTemplate(): Promise<PdfHtmlTemplate> {
    const tpl = await this.getJsonConfig<PdfHtmlTemplate>("purchaseOrders.pdfTemplate");
    if (tpl?.html && tpl?.css) {
      return tpl;
    }
    return this.getDefaultPurchaseOrderPdfTemplate();
  }

  async setPurchaseOrderPdfTemplate(template: PdfHtmlTemplate): Promise<PdfHtmlTemplate> {
    await this.setJsonConfig(
      "purchaseOrders.pdfTemplate",
      template,
      "HTML/CSS Template fuer Bestell-PDF",
    );
    return this.getPurchaseOrderPdfTemplate();
  }

  async getPurchaseOrderPdfDesigner(): Promise<PurchaseOrderDesignerConfig> {
    const cfg = await this.getJsonConfig<PurchaseOrderDesignerConfig>("purchaseOrders.pdfDesigner");
    if (cfg?.elements && cfg?.page) {
      return cfg;
    }
    return this.getDefaultPurchaseOrderDesigner();
  }

  async setPurchaseOrderPdfDesigner(
    config: PurchaseOrderDesignerConfig,
  ): Promise<PurchaseOrderDesignerConfig> {
    await this.setJsonConfig(
      "purchaseOrders.pdfDesigner",
      config,
      "Designer Konfiguration fuer Bestell-PDF",
    );
    return this.getPurchaseOrderPdfDesigner();
  }

  async getPurchaseOrderEmailTemplate(): Promise<EmailTemplate> {
    const tpl = await this.getJsonConfig<EmailTemplate>("purchaseOrders.emailTemplate");
    if (tpl?.subject && tpl?.body) {
      return tpl;
    }
    // Return default template
    return {
      subject: "Bestellung {{orderNumber}}",
      body: "Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unsere Bestellung {{orderNumber}}.\n\nMit freundlichen Grüßen\n{{companyName}}\n{{userName}}",
    };
  }

  async setPurchaseOrderEmailTemplate(template: EmailTemplate): Promise<EmailTemplate> {
    await this.setJsonConfig(
      "purchaseOrders.emailTemplate",
      template,
      "E-Mail-Vorlage für Bestellungen",
    );
    return this.getPurchaseOrderEmailTemplate();
  }

  private getDefaultPdfHtmlTemplate(): PdfHtmlTemplate {
    return {
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
</head>
<body>
  <div class="header">
    {{#logo}}<img src="{{logo}}" class="logo" />{{/logo}}
    <h1>{{title}}</h1>
    <p class="subtitle">{{subtitle}}</p>
  </div>

  {{#vehicle}}
  <div class="metadata">
    <strong>Fahrzeug:</strong> {{vehicle}}
  </div>
  {{/vehicle}}

  {{#technician}}
  <div class="metadata">
    <strong>Monteur:</strong> {{technician}}
  </div>
  {{/technician}}

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-code">Artikelnummer</th>
        <th class="col-description">Bezeichnung</th>
        <th class="col-qr">QR-Code</th>
      </tr>
    </thead>
    <tbody>
      {{#groupHeaders}}
      <tr class="group-header">
        <td colspan="3">{{groupName}}</td>
      </tr>
      {{/groupHeaders}}
      {{#items}}
      <tr class="item-row">
        <td class="col-code">{{#manufacturerTag}}[{{manufacturer}}] {{/manufacturerTag}}{{code}}</td>
        <td class="col-description">{{description}}{{#secondaryDescription}} — {{secondaryDescription}}{{/secondaryDescription}}</td>
        <td class="col-qr"><img src="{{qrCodeDataUrl}}" class="qr-code" /></td>
      </tr>
      {{/items}}
    </tbody>
  </table>
</body>
</html>`,
      css: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Helvetica', 'Arial', sans-serif;
  font-size: 10pt;
  line-height: 1.4;
  padding: 20px;
}

.header {
  position: relative;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #333;
}

.logo {
  position: absolute;
  top: 0;
  right: 0;
  max-width: 120px;
  max-height: 60px;
}

.header h1 {
  font-size: 18pt;
  margin-bottom: 5px;
}

.subtitle {
  color: #555;
  font-size: 9pt;
}

.metadata {
  margin-bottom: 8px;
  font-size: 9pt;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

.items-table thead th {
  background-color: #f0f0f0;
  padding: 8px;
  text-align: left;
  border-bottom: 2px solid #333;
  font-weight: bold;
}

.col-code {
  width: 20%;
}

.col-description {
  width: 60%;
}

.col-qr {
  width: 20%;
  text-align: center;
}

.group-header td {
  background-color: #e8e8e8;
  font-weight: bold;
  padding: 6px 8px;
  border-top: 1px solid #ccc;
}

.item-row td {
  padding: 8px;
  border-bottom: 1px solid #ddd;
  vertical-align: middle;
}

.qr-code {
  width: 64px;
  height: 64px;
}

@media print {
  body {
    padding: 10px;
  }
  
  .items-table {
    page-break-inside: auto;
  }
  
  .item-row {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  
  .group-header {
    page-break-after: avoid;
  }
}`
    };
  }

  private getDefaultPurchaseOrderPdfTemplate(): PdfHtmlTemplate {
    return {
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
</head>
<body>
  <div class="header">
    <div class="company">
      <div class="company-name">{{companyName}}</div>
      {{#companyLogo}}<img src="{{companyLogo}}" class="logo" />{{/companyLogo}}
      <div class="company-details">
        {{#companyAddressLine1}}<div>{{companyAddressLine1}}</div>{{/companyAddressLine1}}
        {{#companyAddressLine2}}<div>{{companyAddressLine2}}</div>{{/companyAddressLine2}}
        {{#companyCityLine}}<div>{{companyCityLine}}</div>{{/companyCityLine}}
        {{#companyCountry}}<div>{{companyCountry}}</div>{{/companyCountry}}
        {{#companyPhone}}<div>Telefon: {{companyPhone}}</div>{{/companyPhone}}
        {{#companyEmail}}<div>E-Mail: {{companyEmail}}</div>{{/companyEmail}}
      </div>
    </div>
    <div class="doc">
      <div class="doc-title">{{title}}</div>
      <div class="doc-meta">
        <div>Bestellnr.: {{orderNumber}}</div>
        <div>Datum: {{orderDate}}</div>
      </div>
    </div>
  </div>

  <div class="address-block">
    <div class="label">Lieferant</div>
    <div class="value">
      <div class="strong">{{supplierName}}</div>
      {{#supplierAddressLine1}}<div>{{supplierAddressLine1}}</div>{{/supplierAddressLine1}}
      {{#supplierAddressLine2}}<div>{{supplierAddressLine2}}</div>{{/supplierAddressLine2}}
      {{#supplierCity}}<div>{{supplierPostalCode}} {{supplierCity}}</div>{{/supplierCity}}
      {{#supplierCountry}}<div>{{supplierCountry}}</div>{{/supplierCountry}}
      {{#supplierContactName}}<div>Kontakt: {{supplierContactName}}</div>{{/supplierContactName}}
      {{#supplierEmail}}<div>E-Mail: {{supplierEmail}}</div>{{/supplierEmail}}
      {{#supplierPhone}}<div>Telefon: {{supplierPhone}}</div>{{/supplierPhone}}
      {{#supplierCustomerNumber}}<div>Kundennr.: {{supplierCustomerNumber}}</div>{{/supplierCustomerNumber}}
    </div>
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-pos">Pos</th>
        <th class="col-code">Artikel</th>
        <th class="col-desc">Beschreibung</th>
        <th class="col-qty">Menge</th>
        <th class="col-pack">VE</th>
        <th class="col-rec">Geliefert</th>
        <th class="col-rem">Offen</th>
      </tr>
    </thead>
    <tbody>
      {{#lines}}
      <tr>
        <td class="col-pos">{{lineIndex}}</td>
        <td class="col-code">{{itemCode}}</td>
        <td class="col-desc">{{itemDescription}}</td>
        <td class="col-qty">{{quantity}}</td>
        <td class="col-pack">{{#packSize}}{{packSize}}{{/packSize}}{{^packSize}}-{{/packSize}}</td>
        <td class="col-rec">{{receivedQuantity}}</td>
        <td class="col-rem">{{remainingQuantity}}</td>
      </tr>
      {{/lines}}
    </tbody>
  </table>

  <div class="totals">
    <div>Gesamtmenge: {{totalQuantity}}</div>
    <div>Geliefert: {{totalReceived}}</div>
    <div>Offen: {{totalRemaining}}</div>
  </div>

  {{#note}}
  <div class="note">
    <div class="label">Notiz</div>
    <div class="value">{{note}}</div>
  </div>
  {{/note}}
</body>
</html>`,
      css: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

@page {
  size: A4 portrait;
  margin: 24px;
}

body {
  font-family: "Helvetica", "Arial", sans-serif;
  font-size: 10pt;
  color: #222;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #222;
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.company {
  position: relative;
  padding-right: 120px;
}

.company-name {
  font-size: 16pt;
  font-weight: bold;
}

.company-details {
  margin-top: 6px;
  font-size: 9pt;
  color: #444;
}

.logo {
  position: absolute;
  top: 0;
  right: 0;
  max-width: 110px;
  max-height: 60px;
}

.doc {
  text-align: right;
}

.doc-title {
  font-size: 14pt;
  font-weight: bold;
  margin-bottom: 6px;
}

.doc-meta div {
  font-size: 9pt;
}

.address-block {
  border: 1px solid #ddd;
  padding: 10px 12px;
  margin-bottom: 18px;
}

.label {
  font-size: 9pt;
  text-transform: uppercase;
  color: #555;
  margin-bottom: 4px;
}

.value .strong {
  font-weight: bold;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}

.items-table th,
.items-table td {
  border-bottom: 1px solid #ddd;
  padding: 6px 6px;
  vertical-align: top;
}

.items-table thead th {
  background: #f2f2f2;
  font-weight: bold;
}

.col-pos {
  width: 4%;
}

.col-code {
  width: 12%;
}

.col-desc {
  width: 48%;
}

.col-qty,
.col-pack,
.col-rec,
.col-rem {
  width: 9%;
  text-align: right;
}

.totals {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  font-size: 9pt;
  margin-bottom: 16px;
}

.note {
  border-top: 1px solid #ddd;
  padding-top: 8px;
  font-size: 9pt;
}
`
    };
  }

  private getDefaultPurchaseOrderDesigner(): PurchaseOrderDesignerConfig {
    return {
      version: 1,
      page: {
        width: 794,
        height: 1123,
        orientation: "portrait",
      },
      elements: [
        {
          id: "company-name",
          type: "companyName",
          x: 32,
          y: 24,
          w: 360,
          h: 32,
          fontSize: 18,
          align: "left",
        },
        {
          id: "company-details",
          type: "companyDetails",
          x: 32,
          y: 58,
          w: 360,
          h: 70,
          fontSize: 10,
          align: "left",
        },
        {
          id: "company-logo",
          type: "companyLogo",
          x: 560,
          y: 24,
          w: 200,
          h: 60,
        },
        {
          id: "order-meta",
          type: "orderMeta",
          x: 520,
          y: 95,
          w: 240,
          h: 60,
          fontSize: 10,
          align: "right",
        },
        {
          id: "supplier-block",
          type: "supplierBlock",
          x: 32,
          y: 150,
          w: 360,
          h: 140,
          fontSize: 10,
          align: "left",
        },
        {
          id: "lines-table",
          type: "linesTable",
          x: 32,
          y: 320,
          w: 730,
          h: 320,
        },
        {
          id: "totals-block",
          type: "totalsBlock",
          x: 420,
          y: 660,
          w: 340,
          h: 40,
          fontSize: 10,
          align: "right",
        },
        {
          id: "note-block",
          type: "noteBlock",
          x: 32,
          y: 660,
          w: 360,
          h: 60,
          fontSize: 10,
          align: "left",
        },
        {
          id: "footer-block",
          type: "footerBlock",
          x: 32,
          y: 1040,
          w: 730,
          h: 40,
          fontSize: 9,
          align: "center",
        },
      ],
    };
  }

  /**
   * Defensive: Stelle sicher, dass system_config.value als LONGTEXT definiert ist,
   * damit große Logos (Data URLs) gespeichert werden können, auch wenn eine Migration
   * einmal nicht gelaufen ist.
   */
  private async ensureValueColumnIsLongText(): Promise<void> {
    if (!this.ensureValueColumnPromise) {
      this.ensureValueColumnPromise = (async () => {
        const rows: any[] = await this.configRepository.query(
          `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_config' AND COLUMN_NAME = 'value' LIMIT 1`,
        );
        const extractRows = (raw: any): any[] => {
          if (Array.isArray(raw)) {
            if (raw.length > 0 && Array.isArray(raw[0])) return raw[0];
            return raw;
          }
          return [];
        };
        const normalized = extractRows(rows);
        const currentType = normalized[0]?.DATA_TYPE?.toString().toLowerCase();
        if (currentType !== "longtext") {
          await this.dataSource.query(
            `ALTER TABLE \`system_config\` MODIFY \`value\` LONGTEXT NULL`,
          );
        }
      })();
    }
    await this.ensureValueColumnPromise;
  }

  /**
   * Speicher-Helfer ohne TypeORM-Upsert (vermeidet "entity id not set" Fehler).
   * Legt an, wenn der Key nicht existiert, sonst aktualisiert er den vorhandenen Datensatz.
   */
  private async saveConfig(key: string, value: string, description?: string): Promise<void> {
    const existing = await this.configRepository.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      if (description) existing.description = description;
      await this.configRepository.save(existing);
    } else {
      await this.configRepository.insert({
        key,
        value,
        description,
      });
    }
  }

}
