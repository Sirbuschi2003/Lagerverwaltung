import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import ExcelJS from "exceljs";
import { In, Repository } from "typeorm";

import { SystemConfig } from "../logging/entities/system-config.entity";
import { User } from "../users/entities/user.entity";

import { InventoryLine } from "./entities/inventory-line.entity";
import { InventorySession } from "./entities/inventory-session.entity";
import { groupInventoryLines, type InventoryGroup } from "./utils/group-inventory-lines";

const TEMPLATE_KEY = "inventory.template.xlsx";
const TEMPLATE_META_KEY = "inventory.template.meta";

export interface InventoryTemplateMeta {
  filename: string;
  size: number;
  mimeType: string;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface PlaceholderGroup {
  category: string;
  description?: string;
  placeholders: { token: string; description: string }[];
}

const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
  {
    category: "Allgemein",
    placeholders: [
      { token: "{{generatedAt}}", description: "Zeitpunkt, an dem das Dokument erstellt wurde (ISO-Format)" },
      { token: "{{session.name}}", description: "Name der Inventur" },
      { token: "{{session.location}}", description: "Ort/Bereich der Inventur" },
      { token: "{{session.startedAt}}", description: "Startzeit der Inventur" },
      { token: "{{session.completedAt}}", description: "Abschlusszeit der Inventur (falls vorhanden)" },
      { token: "{{session.createdBy}}", description: "Benutzer, der die Inventur gestartet hat" },
      { token: "{{session.lineCount}}", description: "Anzahl der gezÃ¤hlten Positionen" },
    ],
  },
  {
    category: "Gruppe",
    description: "Informationen zur aktuellen Hersteller/Warengruppe (pro Abschnitt).",
    placeholders: [
      { token: "{{group.manufacturer}}", description: "Aktueller Hersteller" },
      { token: "{{group.productGroup}}", description: "Aktuelle Warengruppe" },
    ],
  },
  {
    category: "Unternehmen",
    placeholders: [{ token: "{{company.name}}", description: "Firmenname aus den Einstellungen" }],
  },
  {
    category: "Fahrzeug",
    description: "Informationen zum ersten erkannten Fahrzeug (Inventuren sollten pro Fahrzeug durchgefÃ¼hrt werden).",
    placeholders: [
      { token: "{{session.vehicle.licensePlate}}", description: "Kennzeichen des Fahrzeugs" },
      { token: "{{session.vehicle.description}}", description: "Beschreibung / Name des Fahrzeugs" },
      { token: "{{session.vehicle.technician.displayName}}", description: "Angezeigter Name des Technikers, dem das Fahrzeug zugeordnet ist" },
      { token: "{{session.vehicle.technician.username}}", description: "Benutzername des Technikers" },
      { token: "{{session.vehicleSummary}}", description: "Alle Kennzeichen der Inventur, komma-getrennt" },
      { token: "{{session.technicianSummary}}", description: "Alle Techniker (Anzeige-Namen), komma-getrennt" },
    ],
  },
  {
    category: "Summen",
    placeholders: [
      { token: "{{totals.expected}}", description: "Summe aller erwarteten Mengen" },
      { token: "{{totals.counted}}", description: "Summe aller gezÃ¤hlten Mengen" },
      { token: "{{totals.difference}}", description: "Gesamtdifferenz (gezÃ¤hlt âˆ’ erwartet)" },
    ],
  },
  {
    category: "Position (Zeile)",
    description: "Diese Platzhalter dÃ¼rfen nur innerhalb der Tabellenzeile mit {{line.*}} verwendet werden.",
    placeholders: [
      { token: "{{line.index}}", description: "Laufende Positionsnummer (beginnend bei 1)" },
      { token: "{{line.globalIndex}}", description: "Fortlaufende Positionsnummer über alle Gruppen" },
      { token: "{{line.item.code}}", description: "Artikelnummer" },
      { token: "{{line.item.description}}", description: "Artikelbeschreibung (Bezeichnung 1)" },
      { token: "{{line.item.descriptionSecondary}}", description: "Zweite Bezeichnung / Zusatztext" },
      { token: "{{line.item.manufacturer}}", description: "Hersteller" },
      { token: "{{line.item.productGroup}}", description: "Warengruppe" },
      { token: "{{line.vehicle}}", description: "Kennzeichen / Fahrzeug" },
      { token: "{{line.expected}}", description: "Erwartete Menge der Position" },
      { token: "{{line.counted}}", description: "GezÃ¤hlte Menge" },
      { token: "{{line.difference}}", description: "Differenz (gezÃ¤hlt âˆ’ erwartet)" },
      { token: "{{line.note}}", description: "Bemerkung zur Position" },
    ],
  },
];

type Context = Record<string, unknown>;
interface VehicleContext {
  id: string;
  licensePlate: string;
  description: string;
  technician?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
}

export interface InventoryTemplateUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class InventoryTemplateService {
  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  getPlaceholderLegend() {
    return PLACEHOLDER_GROUPS;
  }

  async getTemplateBuffer(): Promise<Buffer | null> {
    const record = await this.configRepository.findOne({ where: { key: TEMPLATE_KEY } });
    if (!record?.value) {
      return null;
    }
    return Buffer.from(record.value, "base64");
  }

  async getTemplateMeta(): Promise<InventoryTemplateMeta | null> {
    const record = await this.configRepository.findOne({ where: { key: TEMPLATE_META_KEY } });
    if (!record?.value) {
      return null;
    }
    try {
      return JSON.parse(record.value) as InventoryTemplateMeta;
    } catch {
      return null;
    }
  }

  async deleteTemplate() {
    await this.configRepository.delete({ key: TEMPLATE_KEY });
    await this.configRepository.delete({ key: TEMPLATE_META_KEY });
  }

  async saveTemplate(file: InventoryTemplateUpload, uploadedBy?: string) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Keine Datei hochgeladen.");
    }
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
      throw new BadRequestException("Es werden nur .xlsx-Dateien unterst\u00fctzt.");
    }
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    } catch (error) {
      throw new BadRequestException("Vorlage konnte nicht gelesen werden. Bitte stelle sicher, dass die Datei ein g\u00fcltiges XLSX ist.");
    }

    await this.configRepository.upsert(
      {
        key: TEMPLATE_KEY,
        value: file.buffer.toString("base64"),
        description: "Benutzerdefinierte Inventur-Exportvorlage",
      },
      ["key"]
    );

    const meta: InventoryTemplateMeta = {
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
    };

    await this.configRepository.upsert(
      {
        key: TEMPLATE_META_KEY,
        value: JSON.stringify(meta),
        description: "Metadaten zur Inventurvorlage",
      },
      ["key"]
    );

    return meta;
  }

  async downloadTemplate(): Promise<{ buffer: Buffer; meta: InventoryTemplateMeta }> {
    const buffer = await this.getTemplateBuffer();
    const meta = await this.getTemplateMeta();
    if (!buffer || !meta) {
      throw new NotFoundException("Es ist keine Inventurvorlage gespeichert.");
    }
    return { buffer, meta };
  }

  async renderSessionToXlsx(
    session: InventorySession,
    options?: { grouped?: boolean },
  ): Promise<Buffer> {
    const templateBuffer = await this.getTemplateBuffer();
    const context = await this.buildSessionContext(session);
    const groupedLines = groupInventoryLines(session.lines ?? []);

    if (!templateBuffer || options?.grouped) {
      return this.renderGroupedWorkbook(session, groupedLines, context);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer as unknown as ExcelJS.Buffer);

    const sortedLines = this.sortLinesByGroup(session.lines ?? []);
    const groupedEntries = this.groupLines(sortedLines);

    workbook.worksheets.forEach((sheet) => {
      this.replaceSessionPlaceholders(sheet, context);
      this.populateLinesWithTemplate(sheet, context, groupedEntries);
      this.replaceHeaderFooterPlaceholders(sheet, context);
    });

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async buildSessionContext(session: InventorySession) {
    const totals = (session.lines ?? []).reduce(
      (acc, line) => {
        acc.expected += line.expectedQuantity ?? 0;
        acc.counted += line.countedQuantity ?? 0;
        return acc;
      },
      { expected: 0, counted: 0 },
    );
    const difference = totals.counted - totals.expected;

    const [vehicleContext, companyName] = await Promise.all([
      this.buildVehicleContext(session),
      this.fetchCompanyName(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      session: {
        name: session.name,
        location: session.location ?? "",
        startedAt: session.startedAt?.toISOString() ?? "",
        completedAt: session.completedAt?.toISOString() ?? "",
        createdBy: session.createdBy ?? "",
        lineCount: session.lines?.length ?? 0,
        vehicle: vehicleContext.primaryVehicle
          ? {
              licensePlate: vehicleContext.primaryVehicle.licensePlate,
              description: vehicleContext.primaryVehicle.description,
              technician: vehicleContext.primaryVehicle.technician
                ? {
                    displayName: vehicleContext.primaryVehicle.technician.displayName,
                    username: vehicleContext.primaryVehicle.technician.username,
                  }
                : null,
            }
          : null,
        vehicles: vehicleContext.vehicles.map((vehicle) => ({
          licensePlate: vehicle.licensePlate,
          description: vehicle.description,
          technician: vehicle.technician
            ? {
                displayName: vehicle.technician.displayName,
                username: vehicle.technician.username,
              }
            : null,
        })),
        vehicleSummary: vehicleContext.vehicleSummary,
        technicianSummary: vehicleContext.technicianSummary,
      },
      totals: {
        expected: totals.expected,
        counted: totals.counted,
        difference,
      },
      company: {
        name: companyName,
      },
    };
  }

  private async buildVehicleContext(session: InventorySession) {
    const vehicleMap = new Map<string, VehicleContext>();
    for (const line of session.lines ?? []) {
      if (line.vehicle?.id && !vehicleMap.has(line.vehicle.id)) {
        vehicleMap.set(line.vehicle.id, {
          id: line.vehicle.id,
          licensePlate: line.vehicle.licensePlate ?? "",
          description: line.vehicle.description ?? "",
          technician: null,
        });
      }
    }

    const vehicles = Array.from(vehicleMap.values());
    if (vehicles.length > 0) {
      const users = await this.usersRepository.find({
        where: {
          vehicleId: In(vehicles.map((vehicle) => vehicle.id)),
        },
      });
      const technicianMap = new Map<string, User>();
      users.forEach((user) => {
        if (user.vehicleId) {
          technicianMap.set(user.vehicleId, user);
        }
      });
      vehicles.forEach((vehicle) => {
        const technician = technicianMap.get(vehicle.id);
        if (technician) {
          vehicle.technician = {
            id: technician.id,
            username: technician.username,
            displayName: technician.displayName,
          };
        }
      });
    }

    return {
      vehicles,
      primaryVehicle: vehicles[0] ?? null,
      vehicleSummary: vehicles.map((v) => v.licensePlate).filter(Boolean).join(", "),
      technicianSummary: vehicles
        .map((v) => v.technician?.displayName)
        .filter((name): name is string => Boolean(name))
        .join(", "),
    };
  }

  private async fetchCompanyName() {
    const record = await this.configRepository.findOne({ where: { key: "company.name" } });
    return record?.value ?? "";
  }

  private replaceSessionPlaceholders(sheet: ExcelJS.Worksheet, context: Context) {
    sheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (this.hasLineOrGroupPlaceholder(cell.value)) {
          return;
        }
        cell.value = this.replacePlaceholders(cell.value, context);
      });
    });
  }

  private hasLineOrGroupPlaceholder(value: ExcelJS.CellValue) {
    return (
      this.cellIncludesPlaceholder(value, "{{line.") ||
      this.cellIncludesPlaceholder(value, "{{group.")
    );
  }

  private cellIncludesPlaceholder(value: ExcelJS.CellValue, pattern: string) {
    if (typeof value === "string") {
      return value.includes(pattern);
    }
    if (value && typeof value === "object") {
      if ("richText" in value && Array.isArray(value.richText)) {
        return value.richText.some(
          (segment) => typeof segment.text === "string" && segment.text.includes(pattern),
        );
      }
      if ("formula" in value && typeof value.formula === "string") {
        return value.formula.includes(pattern);
      }
    }
    return false;
  }

  private replaceHeaderFooterPlaceholders(sheet: ExcelJS.Worksheet, context: Context) {
    const headerFooter = sheet.headerFooter;
    if (!headerFooter) {
      return;
    }

    const replaceSection = (value?: string | null) => {
      if (!value) {
        return undefined;
      }
      const replaced = this.replacePlaceholders(value, context);
      return typeof replaced === "string" ? replaced : String(replaced);
    };

    headerFooter.firstHeader = replaceSection(headerFooter.firstHeader);
    headerFooter.firstFooter = replaceSection(headerFooter.firstFooter);
    headerFooter.evenHeader = replaceSection(headerFooter.evenHeader);
    headerFooter.evenFooter = replaceSection(headerFooter.evenFooter);
    headerFooter.oddHeader = replaceSection(headerFooter.oddHeader);
    headerFooter.oddFooter = replaceSection(headerFooter.oddFooter);
  }

  private populateLinesWithTemplate(
    sheet: ExcelJS.Worksheet,
    context: Context,
    groups: Array<{ manufacturer: string; productGroup: string; lines: InventoryLine[] }>,
  ) {
    const templateInfo = this.findLineTemplateRow(sheet);
    if (!templateInfo) {
      return;
    }

    const groupTemplates = this.findGroupTemplateRows(sheet);
    const removedBeforeTemplate = groupTemplates.filter((template) => template.rowNumber < templateInfo.rowNumber).length;

    const lineTemplateRowNumber = templateInfo.rowNumber - removedBeforeTemplate;
    sheet.spliceRows(lineTemplateRowNumber, 1);

    let insertIndex = lineTemplateRowNumber;
    let positionCounter = 1;

    groups.forEach((group, groupIndex) => {
      let groupPosition = 1;
      const groupMeta = {
        manufacturer: group.manufacturer,
        productGroup: group.productGroup,
      };

      if (groupIndex > 0) {
        const spacer = sheet.insertRow(insertIndex, []);
        spacer.addPageBreak();
        insertIndex += 1;
      }

      if (groupTemplates.length > 0) {
        groupTemplates.forEach((groupTemplate) => {
          const headerRow = sheet.insertRow(insertIndex, []);
          headerRow.height = groupTemplate.height ?? headerRow.height;

          groupTemplate.cells.forEach((cellInfo, cellIndex) => {
            const targetCell = headerRow.getCell(cellIndex + 1);
            targetCell.style = cellInfo.style ? JSON.parse(JSON.stringify(cellInfo.style)) : {};
            if (cellInfo.numFmt) {
              targetCell.numFmt = cellInfo.numFmt;
            }
            targetCell.value = this.replacePlaceholders(cellInfo.value, {
              ...context,
              group: groupMeta,
            });
          });

          insertIndex += 1;
        });
      }

      group.lines.forEach((line) => {
        const row = sheet.insertRow(insertIndex, []);
        row.height = templateInfo.height ?? row.height;
        insertIndex += 1;

        templateInfo.cells.forEach((cellInfo, cellIndex) => {
          const targetCell = row.getCell(cellIndex + 1);
          targetCell.style = cellInfo.style ? JSON.parse(JSON.stringify(cellInfo.style)) : {};
          if (cellInfo.numFmt) {
            targetCell.numFmt = cellInfo.numFmt;
          }

          const lineContext = {
            ...context,
            group: groupMeta,
            line: {
              index: groupPosition,
              globalIndex: positionCounter,
              item: {
                code: line.item?.code ?? "",
                description: line.item?.description ?? "",
                descriptionSecondary: line.item?.descriptionSecondary ?? "",
                manufacturer: line.item?.manufacturer ?? "",
                productGroup: line.item?.productGroup ?? "",
              },
              vehicle: line.vehicle?.licensePlate ?? "",
              expected: line.expectedQuantity ?? 0,
              counted: line.countedQuantity ?? 0,
              difference: (line.countedQuantity ?? 0) - (line.expectedQuantity ?? 0),
              note: line.note ?? "",
            },
          };

          const value = this.replacePlaceholders(cellInfo.value, lineContext);
          targetCell.value = value;
        });

        positionCounter += 1;
        groupPosition += 1;
      });
    });
  }

  private findLineTemplateRow(sheet: ExcelJS.Worksheet) {
    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      let hasLinePlaceholder = false;
      const cells: { value: ExcelJS.CellValue; style: Partial<ExcelJS.Style>; numFmt?: string }[] = [];

      row.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        if (this.cellIncludesPlaceholder(value, "{{line.")) {
          hasLinePlaceholder = true;
        }
        cells.push({
          value,
          style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : {},
          numFmt: cell.numFmt,
        });
      });

      if (hasLinePlaceholder) {
        return {
          rowNumber,
          height: row.height,
          cells,
        };
      }
    }
    return null;
  }

  private replacePlaceholders(value: ExcelJS.CellValue, context: Context) {
    if (typeof value === "string") {
      return this.replaceInString(value, context);
    }

    if (value && typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
      return {
        ...value,
        richText: value.richText.map((segment) => ({
          ...segment,
          text:
            typeof segment.text === "string" ? this.replaceInString(segment.text, context) : segment.text ?? "",
        })),
      };
    }

    return value;
  }

  private replaceInString(template: string, context: Context) {
    return template.replace(/{{\s*([^}]+)\s*}}/g, (_, path) => {
      const resolved = this.getByPath(context, path.trim());
      return resolved === undefined || resolved === null ? "" : `${resolved}`;
    });
  }

  private findGroupTemplateRows(sheet: ExcelJS.Worksheet) {
    const templates: {
      rowNumber: number;
      height?: number;
      cells: { value: ExcelJS.CellValue; style: Partial<ExcelJS.Style>; numFmt?: string }[];
    }[] = [];

    for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      let hasGroupPlaceholder = false;
      let hasLinePlaceholder = false;
      const cells: { value: ExcelJS.CellValue; style: Partial<ExcelJS.Style>; numFmt?: string }[] = [];

      row.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value;
        if (this.cellIncludesPlaceholder(value, "{{group.")) {
          hasGroupPlaceholder = true;
        }
        if (this.cellIncludesPlaceholder(value, "{{line.")) {
          hasLinePlaceholder = true;
        }
        cells.push({
          value,
          style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : {},
          numFmt: cell.numFmt,
        });
      });

      if (hasGroupPlaceholder && !hasLinePlaceholder) {
        templates.push({
          rowNumber,
          height: row.height,
          cells,
        });
      }
    }

    templates
      .slice()
      .sort((a, b) => b.rowNumber - a.rowNumber)
      .forEach((template) => {
        sheet.spliceRows(template.rowNumber, 1);
      });

    return templates.sort((a, b) => a.rowNumber - b.rowNumber);
  }

  private getByPath(object: Context, path: string) {
    const segments = path.split(".");
    let current: any = object;
    for (const segment of segments) {
      if (current == null) {
        return undefined;
      }
      current = current[segment];
    }
    return current;
  }

  private applyFallbackTemplate(workbook: ExcelJS.Workbook) {
    const sheet = workbook.addWorksheet("Inventur");
    sheet.columns = [
      { header: "Pos.", width: 6 },
      { header: "Artikel", width: 18 },
      { header: "Beschreibung", width: 32 },
      { header: "Hersteller", width: 16 },
      { header: "Warengruppe", width: 16 },
      { header: "Fahrzeug", width: 14 },
      { header: "Erwartet", width: 12 },
      { header: "Gez\u00e4hlt", width: 12 },
      { header: "Differenz", width: 12 },
      { header: "Notiz", width: 22 },
    ];

    sheet.addRow(["Inventur", "{{session.name}}"]);
    sheet.addRow(["Standort", "{{session.location}}"]);
    sheet.addRow(["Generiert am", "{{generatedAt}}"]);
    sheet.addRow([]);

    sheet.addRow([
      "{{line.index}}",
      "{{line.item.code}}",
      "{{line.item.description}}",
      "{{line.item.manufacturer}}",
      "{{line.item.productGroup}}",
      "{{line.vehicle}}",
      "{{line.expected}}",
      "{{line.counted}}",
      "{{line.difference}}",
      "{{line.note}}",
    ]);

    sheet.addRow([]);
    sheet.addRow(["Summe erwartet", "{{totals.expected}}"]);
    sheet.addRow(["Summe gez\u00e4hlt", "{{totals.counted}}"]);
    sheet.addRow(["Differenz", "{{totals.difference}}"]);
  }

  private sortLinesByGroup(lines: InventoryLine[]): InventoryLine[] {
    return [...lines].sort((a, b) => {
      const manufacturerDiff = this.normalizeGroupValue(a.item?.manufacturer).localeCompare(
        this.normalizeGroupValue(b.item?.manufacturer),
        "de",
        { sensitivity: "base" },
      );
      if (manufacturerDiff !== 0) {
        return manufacturerDiff;
      }
      const groupDiff = this.normalizeGroupValue(a.item?.productGroup).localeCompare(
        this.normalizeGroupValue(b.item?.productGroup),
        "de",
        { sensitivity: "base" },
      );
      if (groupDiff !== 0) {
        return groupDiff;
      }
      return (a.item?.code || "").localeCompare(b.item?.code || "", "de", { sensitivity: "base" });
    });
  }

  private groupLines(lines: InventoryLine[]) {
    const map = new Map<string, InventoryLine[]>();
    lines.forEach((line) => {
      const key = this.getLineGroupKey(line);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(line);
    });

    return Array.from(map.values()).map((groupLines) => ({
      manufacturer: this.normalizeGroupValue(groupLines[0]?.item?.manufacturer),
      productGroup: this.normalizeGroupValue(groupLines[0]?.item?.productGroup),
      lines: groupLines,
    }));
  }

  private getLineGroupKey(line: InventoryLine) {
    return `${this.normalizeGroupValue(line.item?.manufacturer)}||${this.normalizeGroupValue(
      line.item?.productGroup,
    )}`;
  }

  private normalizeGroupValue(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Allgemein";
  }

  private async renderGroupedWorkbook(
    session: InventorySession,
    groups: InventoryGroup[],
    context: Context,
  ) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Inventur", {
      properties: { defaultRowHeight: 18 },
      views: [{ state: "frozen", ySplit: 8 }],
      pageSetup: {
        paperSize: 9, // A4
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
      },
    });

    sheet.columns = [
      { header: "Pos.", width: 6 },
      { header: "Artikel-Nr.", width: 18 },
      { header: "Bezeichnung 1", width: 32 },
      { header: "Bezeichnung 2", width: 28 },
      { header: "Soll", width: 10 },
      { header: "Ist", width: 10 },
      { header: "Differenz", width: 12 },
      { header: "Bemerkung", width: 24 },
    ];

    this.writeWorkbookHeader(sheet, session, context);

    let positionCounter = 1;
    const insertTableHeader = () => {
      const headerRow = sheet.addRow([
        "Pos.",
        "Artikel-Nr.",
        "Bezeichnung 1",
        "Bezeichnung 2",
        "Soll",
        "Ist",
        "Differenz",
        "Bemerkung",
      ]);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D47A1" },
      };
    };

    groups.forEach((group, index) => {
      if (index > 0) {
        const spacer = sheet.addRow([]);
        spacer.addPageBreak();
        sheet.addRow([]);
      }

      const groupHeaderRow = sheet.addRow([
        `${group.manufacturer} â€“ ${group.productGroup}`,
      ]);
      sheet.mergeCells(groupHeaderRow.number, 1, groupHeaderRow.number, sheet.columnCount);
      groupHeaderRow.font = { bold: true, size: 12 };
      groupHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE3F2FD" },
      };

      insertTableHeader();

      group.lines.forEach((line) => {
        const diff =
          (line.countedQuantity ?? 0) - (line.expectedQuantity ?? 0);
        const row = sheet.addRow([
          positionCounter,
          line.item?.code || "",
          line.item?.description || "",
          line.item?.descriptionSecondary || "",
          line.expectedQuantity ?? 0,
          line.countedQuantity ?? 0,
          diff,
          line.note || "",
        ]);

        row.getCell(5).alignment = { horizontal: "center" };
        row.getCell(6).alignment = { horizontal: "center" };
        const diffCell = row.getCell(7);
        diffCell.alignment = { horizontal: "center" };
        diffCell.font = {
          color:
            diff < 0
              ? { argb: "FFC62828" }
              : diff > 0
              ? { argb: "FF2E7D32" }
              : { argb: "FF212121" },
        };

        positionCounter += 1;
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private writeWorkbookHeader(
    sheet: ExcelJS.Worksheet,
    session: InventorySession,
    context: Context,
  ) {
    const sessionCtx = (context.session ?? {}) as any;
    const totalsCtx = (context.totals ?? {}) as any;
    const companyCtx = (context.company ?? {}) as any;

    const companyName = companyCtx?.name || "Lagerverwaltung";
    const technicianName = sessionCtx?.vehicle?.technician?.displayName || sessionCtx?.createdBy || "";
    const vehiclePlate = sessionCtx?.vehicle?.licensePlate || "";

    const headerRows = [
      [`Firma: ${companyName}`],
      [`Inventur: ${session.name}`],
      [`Techniker: ${technicianName}`],
      [`Fahrzeug: ${vehiclePlate}`],
      [
        `Zeitraum: ${session.startedAt.toLocaleString("de-DE")} ${
          session.completedAt ? `â€“ ${session.completedAt.toLocaleString("de-DE")}` : ""
        }`,
      ],
      [
        `Positionen: ${sessionCtx?.lineCount ?? 0} | Erwartet: ${totalsCtx?.expected ?? 0} | GezÃ¤hlt: ${
          totalsCtx?.counted ?? 0
        } | Differenz: ${totalsCtx?.difference ?? 0}`,
      ],
    ];

    headerRows.forEach((values) => {
      const row = sheet.addRow(values);
      sheet.mergeCells(row.number, 1, row.number, sheet.columnCount);
      row.font = { bold: true };
    });

    sheet.addRow([]);
  }
}



