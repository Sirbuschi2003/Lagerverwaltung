import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, Repository } from "typeorm";
import AdmZip from "adm-zip";

import { StockMovement } from "../stock/entities/stock-movement.entity";
import { PurchaseOrder } from "../purchasing/entities/purchase-order.entity";
import { PurchaseOrderLine } from "../purchasing/entities/purchase-order-line.entity";
import { Item } from "../items/entities/item.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";

export interface GdpduExportOptions {
  from: Date;
  to: Date;
  branchId?: string | null;
  companyName?: string;
  taxId?: string;
}

@Injectable()
export class GdpduExportService {
  constructor(
    @InjectRepository(StockMovement)
    private readonly movementsRepo: Repository<StockMovement>,
    @InjectRepository(PurchaseOrder)
    private readonly ordersRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderLine)
    private readonly linesRepo: Repository<PurchaseOrderLine>,
    @InjectRepository(Item)
    private readonly itemsRepo: Repository<Item>,
    @InjectRepository(Supplier)
    private readonly suppliersRepo: Repository<Supplier>,
  ) {}

  async buildExportZip(opts: GdpduExportOptions): Promise<Buffer> {
    const { from, to, branchId, companyName = "Lagerverwaltung", taxId = "" } = opts;

    const [movements, orders, items, suppliers] = await Promise.all([
      this.fetchMovements(from, to, branchId),
      this.fetchOrders(from, to, branchId),
      this.fetchItems(branchId),
      this.fetchSuppliers(branchId),
    ]);

    const orderLines: OrderLineWithContext[] = orders.flatMap((o) =>
      (o.lines ?? []).map((l) => ({ line: l, orderId: o.id, orderNumber: o.orderNumber ?? undefined })),
    );

    const tables: GdpduTable[] = [
      buildLagerbewegungTable(movements),
      buildBestellungTable(orders),
      buildBestellpositionTable(orderLines),
      buildArtikelTable(items),
      buildLieferantTable(suppliers),
    ];

    const indexXml = buildIndexXml(companyName, taxId, from, to, tables);

    const zip = new AdmZip();
    zip.addFile("index.xml", Buffer.from(indexXml, "utf-8"));
    for (const table of tables) {
      zip.addFile(table.filename, Buffer.from("﻿" + table.csvContent, "utf-8"));
    }
    zip.addFile("gdpdu-01-09-2004.dtd", Buffer.from(DTD_CONTENT, "utf-8"));

    return zip.toBuffer();
  }

  private async fetchMovements(from: Date, to: Date, branchId?: string | null): Promise<StockMovement[]> {
    const qb = this.movementsRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.item", "item")
      .leftJoinAndSelect("m.location", "loc")
      .leftJoinAndSelect("m.user", "u")
      .where("m.occurredAt BETWEEN :from AND :to", { from, to });
    if (branchId) qb.andWhere("item.branchId = :branchId", { branchId });
    return qb.orderBy("m.occurredAt", "ASC").getMany();
  }

  private async fetchOrders(from: Date, to: Date, branchId?: string | null): Promise<PurchaseOrder[]> {
    const qb = this.ordersRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.supplier", "sup")
      .leftJoinAndSelect("o.lines", "lines")
      .leftJoinAndSelect("lines.item", "item")
      .where("o.createdAt BETWEEN :from AND :to", { from, to });
    if (branchId) qb.andWhere("o.branchId = :branchId", { branchId });
    return qb.orderBy("o.createdAt", "ASC").getMany();
  }

  private async fetchItems(branchId?: string | null): Promise<Item[]> {
    const where: Record<string, unknown> = {};
    if (branchId) where.branchId = branchId;
    return this.itemsRepo.find({ where: where as any, relations: ["supplier"], take: 50000 });
  }

  private async fetchSuppliers(branchId?: string | null): Promise<Supplier[]> {
    const where: Record<string, unknown> = {};
    if (branchId) where.branchId = branchId;
    return this.suppliersRepo.find({ where: where as any, take: 10000 });
  }
}

// ─── Table builders ────────────────────────────────────────────────────────────

interface OrderLineWithContext {
  line: PurchaseOrderLine;
  orderId: string;
  orderNumber?: string;
}

interface GdpduTable {
  name: string;
  filename: string;
  description: string;
  columns: GdpduColumn[];
  csvContent: string;
}

interface GdpduColumn {
  name: string;
  description: string;
  type: "Text" | "Numeric" | "Date" | "AlphaNumeric";
  maxLength?: number;
  decimals?: number;
}

function buildLagerbewegungTable(rows: StockMovement[]): GdpduTable {
  const columns: GdpduColumn[] = [
    { name: "BewegungsID", description: "Eindeutige Bewegungs-ID", type: "AlphaNumeric", maxLength: 36 },
    { name: "Datum", description: "Buchungsdatum", type: "Date" },
    { name: "Bewegungsart", description: "Art der Bewegung (IN/OUT/ADJUST)", type: "Text", maxLength: 20 },
    { name: "ArtikelCode", description: "Artikel-Nummer", type: "Text", maxLength: 50 },
    { name: "Artikelbeschreibung", description: "Artikel-Bezeichnung", type: "Text", maxLength: 255 },
    { name: "LagerortCode", description: "Code des Lagerorts", type: "Text", maxLength: 50 },
    { name: "Menge", description: "Bewegte Menge", type: "Numeric", decimals: 0 },
    { name: "Benutzer", description: "Buchender Benutzer", type: "Text", maxLength: 100 },
    { name: "Bemerkung", description: "Bemerkungsfeld", type: "Text", maxLength: 500 },
  ];

  const csvRows = rows.map((m) => [
    m.id,
    formatDate(m.occurredAt),
    m.type,
    m.item?.code ?? "",
    m.item?.description ?? "",
    m.location?.code ?? "",
    m.quantity,
    m.user?.displayName ?? "System",
    m.note ?? "",
  ]);

  return { name: "Lagerbewegungen", filename: "Lagerbewegungen.csv", description: "Alle Lagerbewegungen im Zeitraum", columns, csvContent: toCsv(columns, csvRows) };
}

function buildBestellungTable(rows: PurchaseOrder[]): GdpduTable {
  const columns: GdpduColumn[] = [
    { name: "BestellungID", description: "Eindeutige Bestell-ID", type: "AlphaNumeric", maxLength: 36 },
    { name: "Bestellnummer", description: "Menschenlesbare Bestellnummer", type: "Text", maxLength: 50 },
    { name: "ErstelltAm", description: "Erstellungsdatum", type: "Date" },
    { name: "BestelltAm", description: "Bestelldatum", type: "Date" },
    { name: "Status", description: "Bestellstatus", type: "Text", maxLength: 30 },
    { name: "LieferantID", description: "Lieferanten-ID", type: "AlphaNumeric", maxLength: 36 },
    { name: "Lieferant", description: "Lieferantenname", type: "Text", maxLength: 255 },
    { name: "Gesamtbetrag", description: "Netto-Gesamtbetrag in EUR", type: "Numeric", decimals: 4 },
    { name: "Bemerkung", description: "Bemerkungsfeld", type: "Text", maxLength: 500 },
  ];

  const csvRows = rows.map((o) => {
    const totalNet = (o.lines ?? []).reduce((sum, l) => {
      if (l.unitPriceNet == null) return sum;
      return sum + Number(l.unitPriceNet) * l.quantity;
    }, 0);
    return [
      o.id,
      o.orderNumber ?? "",
      formatDate(o.createdAt),
      o.orderedAt ? formatDate(o.orderedAt) : "",
      o.status,
      o.supplier?.id ?? "",
      o.supplier?.name ?? "",
      totalNet.toFixed(4).replace(".", ","),
      o.note ?? "",
    ];
  });

  return { name: "Bestellungen", filename: "Bestellungen.csv", description: "Bestellkopfdaten", columns, csvContent: toCsv(columns, csvRows) };
}

function buildBestellpositionTable(rows: OrderLineWithContext[]): GdpduTable {
  const columns: GdpduColumn[] = [
    { name: "PositionID", description: "Eindeutige Positions-ID", type: "AlphaNumeric", maxLength: 36 },
    { name: "BestellungID", description: "Bezug zur Bestellung", type: "AlphaNumeric", maxLength: 36 },
    { name: "Bestellnummer", description: "Menschenlesbare Bestellnummer", type: "Text", maxLength: 50 },
    { name: "ArtikelCode", description: "Artikel-Nummer", type: "Text", maxLength: 50 },
    { name: "Artikelbeschreibung", description: "Artikel-Bezeichnung", type: "Text", maxLength: 255 },
    { name: "Menge", description: "Bestellmenge", type: "Numeric", decimals: 0 },
    { name: "EinstandspreisNetto", description: "Einstandspreis je Einheit (netto) in EUR", type: "Numeric", decimals: 4 },
    { name: "MwStSatz", description: "MwSt-Satz in %", type: "Numeric", decimals: 2 },
    { name: "GesamtpreisNetto", description: "Gesamt netto in EUR", type: "Numeric", decimals: 4 },
    { name: "Waehrung", description: "Währung", type: "Text", maxLength: 3 },
  ];

  const csvRows = rows.map(({ line, orderId, orderNumber }) => {
    const unitNet = line.unitPriceNet != null ? Number(line.unitPriceNet) : null;
    const totalNet = unitNet != null ? unitNet * line.quantity : null;
    return [
      line.id,
      orderId,
      orderNumber ?? "",
      line.item?.code ?? "",
      line.item?.description ?? "",
      line.quantity,
      unitNet != null ? unitNet.toFixed(4).replace(".", ",") : "",
      line.taxRate != null ? Number(line.taxRate).toFixed(2).replace(".", ",") : "",
      totalNet != null ? totalNet.toFixed(4).replace(".", ",") : "",
      line.currency ?? "EUR",
    ];
  });

  return { name: "Bestellpositionen", filename: "Bestellpositionen.csv", description: "Bestellpositionen mit Einstandspreisen (§240 HGB)", columns, csvContent: toCsv(columns, csvRows) };
}

function buildArtikelTable(rows: Item[]): GdpduTable {
  const columns: GdpduColumn[] = [
    { name: "ArtikelID", description: "Eindeutige Artikel-ID", type: "AlphaNumeric", maxLength: 36 },
    { name: "ArtikelCode", description: "Artikel-Nummer", type: "Text", maxLength: 50 },
    { name: "Beschreibung", description: "Artikel-Bezeichnung", type: "Text", maxLength: 255 },
    { name: "Hersteller", description: "Herstellername", type: "Text", maxLength: 120 },
    { name: "Warengruppe", description: "Warengruppe", type: "Text", maxLength: 120 },
    { name: "Mindestbestand", description: "Mindestbestand", type: "Numeric", decimals: 0 },
    { name: "Sollbestand", description: "Sollbestand", type: "Numeric", decimals: 0 },
    { name: "LieferantID", description: "Standard-Lieferant-ID", type: "AlphaNumeric", maxLength: 36 },
    { name: "ErstelltAm", description: "Erstellungsdatum", type: "Date" },
  ];

  const csvRows = rows.map((item) => [
    item.id,
    item.code,
    item.description ?? "",
    item.manufacturer ?? "",
    item.productGroup ?? "",
    item.minimumStock ?? 0,
    item.targetStock ?? 0,
    item.supplier?.id ?? "",
    formatDate(item.createdAt),
  ]);

  return { name: "Artikel", filename: "Artikel.csv", description: "Artikelstammdaten", columns, csvContent: toCsv(columns, csvRows) };
}

function buildLieferantTable(rows: Supplier[]): GdpduTable {
  const columns: GdpduColumn[] = [
    { name: "LieferantID", description: "Eindeutige Lieferanten-ID", type: "AlphaNumeric", maxLength: 36 },
    { name: "Name", description: "Lieferantenname", type: "Text", maxLength: 255 },
    { name: "Kundennummer", description: "Eigene Kundennummer beim Lieferanten", type: "Text", maxLength: 120 },
    { name: "Strasse", description: "Straße / Adresszeile 1", type: "Text", maxLength: 255 },
    { name: "PLZ", description: "Postleitzahl", type: "Text", maxLength: 32 },
    { name: "Ort", description: "Ort", type: "Text", maxLength: 120 },
    { name: "Land", description: "Land", type: "Text", maxLength: 120 },
    { name: "Email", description: "E-Mail-Adresse", type: "Text", maxLength: 120 },
    { name: "Telefon", description: "Telefonnummer", type: "Text", maxLength: 60 },
    { name: "ErstelltAm", description: "Erstellungsdatum", type: "Date" },
  ];

  const csvRows = rows.map((s) => [
    s.id,
    s.name,
    s.customerNumber ?? "",
    s.addressLine1 ?? "",
    s.postalCode ?? "",
    s.city ?? "",
    s.country ?? "",
    s.email ?? "",
    s.phone ?? "",
    formatDate(s.createdAt),
  ]);

  return { name: "Lieferanten", filename: "Lieferanten.csv", description: "Lieferantenstammdaten", columns, csvContent: toCsv(columns, csvRows) };
}

// ─── XML / CSV helpers ─────────────────────────────────────────────────────────

function formatDate(d: Date | string | undefined | null): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10); // YYYY-MM-DD (ISO 8601 per GDPdU-Spezifikation)
}

function toCsv(columns: GdpduColumn[], rows: unknown[][]): string {
  const header = columns.map((c) => `"${c.name}"`).join(";");
  const dataRows = rows.map((row) =>
    row.map((cell) => {
      const str = cell == null ? "" : String(cell);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(";"),
  );
  return [header, ...dataRows].join("\r\n");
}

function buildIndexXml(companyName: string, taxId: string, from: Date, to: Date, tables: GdpduTable[]): string {
  const tablesXml = tables
    .map(
      (t) => `  <Table>
    <URL>${t.filename}</URL>
    <Name>${escapeXml(t.name)}</Name>
    <Description>${escapeXml(t.description)}</Description>
    <Validity>
      <Range>
        <From>${formatDate(from)}</From>
        <To>${formatDate(to)}</To>
      </Range>
    </Validity>
    <UTF8/>
    <DecimalSymbol>,</DecimalSymbol>
    <DigitGroupingSymbol>.</DigitGroupingSymbol>
    <ColumnDelimiter>;</ColumnDelimiter>
    <TextEncapsulator>"</TextEncapsulator>
    <VariableLength>
      ${t.columns
        .map(
          (c) => `<Column>
        <Name>${escapeXml(c.name)}</Name>
        <Description>${escapeXml(c.description)}</Description>
        <${c.type}${c.maxLength ? ` MaxLength="${c.maxLength}"` : ""}${c.decimals != null ? ` Accuracy="${c.decimals}"` : ""}/>
      </Column>`,
        )
        .join("\n      ")}
    </VariableLength>
  </Table>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE DataSet SYSTEM "gdpdu-01-09-2004.dtd">
<DataSet>
  <Version>1.0</Version>
  <DataSupplier>
    <Name>${escapeXml(companyName)}</Name>
    <Location>${escapeXml(companyName)}</Location>
    <Comment>GDPdU-Export gem. §147 AO / §257 HGB – erstellt am ${formatDate(new Date())}</Comment>
  </DataSupplier>
  <Media>
    <Name>GDPdU-Export ${formatDate(from)} bis ${formatDate(to)}</Name>
    ${tablesXml}
  </Media>
</DataSet>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// GDPdU DTD (Kurzfassung, ausreichend für Steuerprüfer-Software)
const DTD_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<!ELEMENT DataSet (Version,DataSupplier,Media+)>
<!ELEMENT Version (#PCDATA)>
<!ELEMENT DataSupplier (Name,Location,Comment?)>
<!ELEMENT Name (#PCDATA)>
<!ELEMENT Location (#PCDATA)>
<!ELEMENT Comment (#PCDATA)>
<!ELEMENT Media (Name,Table+)>
<!ELEMENT Table (URL,Name,Description?,Validity,UTF8?,DecimalSymbol?,DigitGroupingSymbol?,ColumnDelimiter?,TextEncapsulator?,VariableLength)>
<!ELEMENT URL (#PCDATA)>
<!ELEMENT Description (#PCDATA)>
<!ELEMENT Validity (Range*)>
<!ELEMENT Range (From,To)>
<!ELEMENT From (#PCDATA)>
<!ELEMENT To (#PCDATA)>
<!ELEMENT UTF8 EMPTY>
<!ELEMENT DecimalSymbol (#PCDATA)>
<!ELEMENT DigitGroupingSymbol (#PCDATA)>
<!ELEMENT ColumnDelimiter (#PCDATA)>
<!ELEMENT TextEncapsulator (#PCDATA)>
<!ELEMENT VariableLength (Column+)>
<!ELEMENT Column (Name,Description?,Text|Numeric|Date|AlphaNumeric)>
<!ELEMENT Text EMPTY>
<!ATTLIST Text MaxLength CDATA #IMPLIED>
<!ELEMENT Numeric EMPTY>
<!ATTLIST Numeric Accuracy CDATA #IMPLIED>
<!ELEMENT Date EMPTY>
<!ELEMENT AlphaNumeric EMPTY>
<!ATTLIST AlphaNumeric MaxLength CDATA #IMPLIED>
`;
