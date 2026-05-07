import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";

interface InventoryRequest extends Request {
  user?: { id?: string; role?: string; username?: string; vehicleId?: string | null; branchId?: string | null; locationIds?: string[] };
}

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { ExportService } from "../reports/export.service";

import { CompleteInventoryDto } from "./dto/complete-inventory.dto";
import { RecordInventoryLineDto } from "./dto/record-inventory-line.dto";
import { RemoveVehicleStockDto } from "./dto/remove-vehicle-stock.dto";
import { StartInventoryDto } from "./dto/start-inventory.dto";
import { FinalizeInventoryDto } from "./dto/finalize-inventory.dto";
import { InventoryService } from "./inventory.service";
import { SubmitInventoryDto } from "./dto/submit-inventory.dto";
import { InventoryTemplateService, type InventoryTemplateUpload } from "./inventory-template.service";
import { UsersService } from "../users/users.service";
import type { InventorySession } from "./entities/inventory-session.entity";
import { StockService } from "../stock/stock.service";
import type { Response } from "express";
import { VehicleStatusDto } from "./dto/vehicle-status.dto";

@Controller("inventory")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly exportService: ExportService,
    private readonly templateService: InventoryTemplateService,
    private readonly usersService: UsersService,
    private readonly stockService: StockService,
  ) {}

  @Get()
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  findSessions(@Req() req: InventoryRequest) {
    const isManager = req.user?.role === "MANAGER";
    return this.inventoryService.findSessions(req.user?.branchId, req.user?.id, isManager);
  }

  @Post("start")
  @Roles("MANAGER")
  startSession(@Body() dto: StartInventoryDto, @Req() req: InventoryRequest) {
    return this.inventoryService.startSession({ ...dto, branchId: req.user?.branchId });
  }

  @Post("line")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  recordLine(@Body() dto: RecordInventoryLineDto) {
    return this.inventoryService.recordLine(dto);
  }

  @Post("remove-vehicle-stock")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  async removeVehicleStock(@Body() dto: RemoveVehicleStockDto) {
    return this.inventoryService.removeVehicleStock(dto);
  }

  @Post("complete")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  completeSession(@Body() dto: CompleteInventoryDto) {
    return this.inventoryService.completeSession(dto);
  }

  @Patch("sessions/:sessionId/submit")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  submitSession(
    @Param("sessionId") sessionId: string,
    @Body() body: SubmitInventoryDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const username = user?.username ?? "Unknown";
    const userRole: string = user?.role ?? "";

    // Sicherheit: applyAdjustments darf nur von Managern gesetzt werden.
    // Techniker/Warehouse reichen nur zur Prüfung ein — der Manager bucht die Differenzen.
    const securedBody: SubmitInventoryDto = {
      ...body,
      applyAdjustments: userRole === "MANAGER" ? (body.applyAdjustments ?? false) : false,
    };

    return this.inventoryService.submitSession(sessionId, username, user, securedBody);
  }

  @Patch("sessions/:sessionId/reopen")
  @Roles("MANAGER")
  reopenSession(@Param("sessionId") sessionId: string, @Req() req: InventoryRequest) {
    const username = (req.user as any)?.username ?? "Unknown";
    return this.inventoryService.reopenSession(sessionId, username, req.user?.branchId);
  }

  @Patch("sessions/:sessionId/vehicle-reopen/:vehicleId")
  @Roles("MANAGER")
  reopenVehicle(
    @Param("sessionId") sessionId: string,
    @Param("vehicleId") vehicleId: string,
    @Req() req: InventoryRequest,
  ) {
    const username = (req.user as any)?.username ?? "Unknown";
    return this.inventoryService.reopenVehicle(sessionId, vehicleId, username, req.user?.branchId);
  }

  @Patch("sessions/:sessionId/finalize")
  @Roles("MANAGER")
  finalizeSession(
    @Param("sessionId") sessionId: string,
    @Body() body: FinalizeInventoryDto,
    @Req() req: InventoryRequest,
  ) {
    const username = (req.user as any)?.username ?? "Unknown";
    return this.inventoryService.finalizeSession(sessionId, username, body, req.user?.branchId);
  }

  @Get(":sessionId/export")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  async exportSession(
    @Param("sessionId") sessionId: string,
    @Req() req: InventoryRequest,
    @Res() res: Response,
    @Query("format") format: 'csv' | 'pdf' | 'xlsx' = 'csv',
    @Query("vehicleId") vehicleId?: string,
    @Query("technicianId") technicianId?: string,
  ) {
    const session = await this.inventoryService.findSessionById(sessionId, req.user?.branchId);

    if (!session) {
      res.status(404).send('Session not found');
      return;
    }

    const { filteredSession, appliedVehicleId } = await this.filterSessionLines(
      session,
      vehicleId,
      technicianId,
    );

    if (appliedVehicleId && (filteredSession.lines?.length ?? 0) === 0) {
      res
        .status(404)
        .send("Keine Inventurpositionen für das ausgewählte Fahrzeug/Techniker gefunden.");
      return;
    }
    
    if (format === 'csv') {
      const csvBuffer = await this.exportService.exportInventoryToCsv(filteredSession);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inventur_${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvBuffer);
    } else if (format === 'xlsx') {
      const xlsxBuffer = await this.templateService.renderSessionToXlsx(filteredSession);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="inventur_${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`);
      res.send(xlsxBuffer);
    } else {
      const pdfBuffer = await this.exportService.exportInventoryToPdf(filteredSession);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="inventur_${session.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    }
  }

  @Get(":sessionId/export-protocol")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  async exportInventoryProtocol(
    @Param("sessionId") sessionId: string,
    @Req() req: InventoryRequest,
    @Query("format") format: "csv" | "pdf" | "xlsx" = "csv",
    @Res() res: Response,
  ) {
    const session = await this.inventoryService.getSessionForExport(sessionId, req.user?.branchId);
    const movements = await this.stockService.findMovementsBySource(`inventory:${sessionId}`);

    if (format === "pdf") {
      const pdf = await this.exportService.exportInventoryProtocolPdf(session, movements);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="inventur_protokoll_${session.name}.pdf"`);
      return res.send(pdf);
    }

    if (format === "xlsx") {
      const xlsx = await this.exportService.exportInventoryProtocolXlsx(session, movements);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="inventur_protokoll_${session.name}.xlsx"`);
      return res.send(xlsx);
    }

    const csv = await this.exportService.exportInventoryProtocolCsv(session, movements);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="inventur_protokoll_${session.name}.csv"`);
    return res.send(csv);
  }

  @Get("sessions/:sessionId/differences")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  getSessionDifferences(@Param("sessionId") sessionId: string, @Req() req: Request) {
    const user = (req.user as any) || {};
    return this.inventoryService.getSessionDifferences(sessionId, user);
  }

  @Get("sessions/:sessionId/vehicle-statuses")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  async getVehicleStatuses(@Param("sessionId") sessionId: string, @Req() req: InventoryRequest): Promise<VehicleStatusDto[]> {
    const session = await this.inventoryService.findSessionById(sessionId, req.user?.branchId);
    if (!session) {
      throw new BadRequestException("Session not found");
    }

    const vehicleMap: VehicleStatusDto[] = (session.vehicleStatuses || []).map((vs) => ({
      vehicleId: vs.vehicle?.id || "",
      vehicleLabel: vs.vehicle?.licensePlate || vs.vehicle?.description || "Fahrzeug",
      status: vs.status,
      submittedBy: vs.submittedBy,
      submittedAt: vs.submittedAt,
      adjustmentsApplied: vs.adjustmentsApplied,
    }));

    // Ensure vehicles present in lines but not yet in status table appear as DRAFT
    const lineVehicles = Array.from(new Set((session.lines || []).map((l) => l.vehicle?.id).filter(Boolean))) as string[];
    for (const vid of lineVehicles) {
      const exists = vehicleMap.find((v) => v.vehicleId === vid);
      if (!exists) {
        const vehicle = session.lines.find((l) => l.vehicle?.id === vid)?.vehicle;
        vehicleMap.push({
          vehicleId: vid,
          vehicleLabel: vehicle?.licensePlate || vehicle?.description || "Fahrzeug",
          status: "DRAFT" as any,
          submittedBy: null,
          submittedAt: null,
          adjustmentsApplied: false,
        });
      }
    }

    return vehicleMap;
  }

  @Delete("line/:lineId")
  @Roles("MANAGER", "WAREHOUSE", "TECHNICIAN")
  deleteLine(@Param("lineId") lineId: string) {
    return this.inventoryService.deleteLine(lineId);
  }

  @Delete("session/:sessionId")
  @Roles("MANAGER")
  deleteSession(
    @Param("sessionId") sessionId: string,
    @Req() req: InventoryRequest,
    @Query("force") force?: string,
  ) {
    const isSuperAdmin = req.user?.role === "MANAGER" && req.user?.branchId === null;
    const forceDelete = force === "true" && isSuperAdmin;
    return this.inventoryService.deleteSession(sessionId, req.user?.branchId, forceDelete);
  }

  @Get("template/meta")
  @Roles("MANAGER")
  async templateMeta() {
    const meta = await this.templateService.getTemplateMeta();
    return {
      hasTemplate: Boolean(meta),
      meta,
      placeholders: this.templateService.getPlaceholderLegend(),
    };
  }

  @Get("template/download")
  @Roles("MANAGER")
  async downloadTemplate(@Res() res: Response) {
    const { buffer, meta } = await this.templateService.downloadTemplate();
    res.setHeader("Content-Type", meta.mimeType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${meta.filename || "inventur_template.xlsx"}"`);
    res.send(buffer);
  }

  @Post("template")
  @Roles("MANAGER")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadTemplate(@UploadedFile() file: InventoryTemplateUpload, @Req() req: Request) {
    const uploadedBy = (req.user as any)?.username ?? "Unbekannt";
    return this.templateService.saveTemplate(file, uploadedBy);
  }

  @Delete("template")
  @Roles("MANAGER")
  clearTemplate() {
    return this.templateService.deleteTemplate().then(() => ({ success: true }));
  }



  private async filterSessionLines(
    session: InventorySession,
    vehicleId?: string,
    technicianId?: string,
  ) {
    let appliedVehicleId = vehicleId;

    if (!appliedVehicleId && technicianId) {
      const technician = await this.usersService.findOneById(technicianId);
      if (!technician) {
        throw new BadRequestException("Techniker nicht gefunden.");
      }
      if (!technician.vehicleId) {
        throw new BadRequestException(
          "Dem Techniker ist kein Fahrzeug zugeordnet. Bitte zuerst zuweisen.",
        );
      }
      appliedVehicleId = technician.vehicleId;
    }

    if (!appliedVehicleId) {
      return { filteredSession: session, appliedVehicleId: null };
    }

    const filteredLines = (session.lines ?? []).filter(
      (line) => line.vehicle?.id === appliedVehicleId,
    );

    return {
      filteredSession: {
        ...session,
        lines: filteredLines,
      },
      appliedVehicleId,
    };
  }
}
