import { Body, Controller, Get, ParseIntPipe, Put, Query, Res, UseGuards, Req, ForbiddenException, Request } from "@nestjs/common";
import { Response } from 'express';

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { ExportService } from "./export.service";
import { ReportsService } from "./reports.service";
import { ItemsService } from "../items/items.service";

@Controller("reports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
    private readonly itemsService: ItemsService,
  ) {}

  @Get("consumption")
  @Roles("MANAGER", "WAREHOUSE")
  async consumption(@Req() req: any, @Query("from") from: string, @Query("to") to: string) {
    const fallbackTo = new Date();
    const end = to ? new Date(to) : fallbackTo;
    const start = from ? new Date(from) : new Date(end.getTime() - 1000 * 60 * 60 * 24 * 30);
    return this.reportsService.consumptionReport(start, end, req.user?.branchId);
  }

  @Get("stock-status")
  @Roles("MANAGER", "WAREHOUSE")
  stockStatus(@Req() req: any) {
    return this.reportsService.stockStatusSummary(req.user?.branchId);
  }

  @Get("consumption/export")
  @Roles("MANAGER", "WAREHOUSE")
  async exportConsumption(
    @Req() req: any,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("format") format: 'csv' | 'pdf' = 'csv',
    @Res() res: Response,
  ) {
    const fallbackTo = new Date();
    const end = to ? new Date(to) : fallbackTo;
    const start = from ? new Date(from) : new Date(end.getTime() - 1000 * 60 * 60 * 24 * 30);

    const movements = await this.reportsService.consumptionReport(start, end, req.user?.branchId);
    
    if (format === 'csv') {
      const csvBuffer = await this.exportService.exportMovementsToCsv(movements);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bewegungsbericht_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv"`);
      res.send(csvBuffer);
    } else {
      const pdfBuffer = await this.exportService.exportMovementsToPdf(movements);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bewegungsbericht_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    }
  }

  @Get("stock-status/export")
  @Roles("MANAGER", "WAREHOUSE")
  async exportStockStatus(
    @Req() req: any,
    @Query("format") format: 'csv' | 'pdf' = 'csv',
    @Res() res: Response,
  ) {
    const stockLevels = await this.reportsService.stockStatusSummary(req.user?.branchId);
    
    if (format === 'csv') {
      const csvBuffer = await this.exportService.exportStockToCsv(stockLevels);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="bestandsbericht_${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvBuffer);
    } else {
      const pdfBuffer = await this.exportService.exportStockToPdf(stockLevels);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bestandsbericht_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    }
  }

  @Get("consumption-trend")
  @Roles("MANAGER", "WAREHOUSE")
  async consumptionTrend(@Req() req: any, @Query("months") monthsParam?: string) {
    const months = monthsParam === "6" ? 6 : 12;
    return this.reportsService.consumptionTrend(months, req.user?.branchId);
  }

  @Get("slow-movers/settings")
  @Roles("MANAGER", "WAREHOUSE")
  async getSlowMoverSettings(@Req() req: any) {
    const days = await this.reportsService.getSlowMoverThreshold(req.user?.branchId);
    return { days };
  }

  @Put("slow-movers/settings")
  @Roles("MANAGER")
  async setSlowMoverSettings(@Req() req: any, @Body("days", ParseIntPipe) days: number) {
    const saved = await this.reportsService.setSlowMoverThreshold(Math.max(1, Math.min(3650, days)), req.user?.branchId);
    return { days: saved };
  }

  @Get("slow-movers")
  @Roles("MANAGER", "WAREHOUSE")
  async slowMovers(@Req() req: any, @Query("days") daysParam?: string) {
    let days: number;
    if (daysParam) {
      const parsed = Number.parseInt(daysParam, 10);
      days = Number.isNaN(parsed) || parsed < 1 ? await this.reportsService.getSlowMoverThreshold(req.user?.branchId) : parsed;
    } else {
      days = await this.reportsService.getSlowMoverThreshold(req.user?.branchId);
    }
    return this.reportsService.slowMoverReport(days, req.user?.branchId);
  }

  /**
   * QR-Katalog (Artikelnummer | Bezeichnung | QR-Code) als PDF
   * Nur für MANAGER
   */
  @Get("items/qr-catalog")
  @Roles("MANAGER")
  async exportItemsQrCatalog(
    @Req() req: any,
    @Res() res: Response,
    @Query("search") search?: string,
    @Query("manufacturer") manufacturer?: string,
    @Query("productGroup") productGroup?: string,
  ) {
    const { items } = await this.itemsService.findAll({
      limit: 200000,
      search,
      manufacturer,
      productGroup,
      branchId: req.user?.branchId,
    });
    const pdfBuffer = await this.exportService.exportItemsQrCatalogToPdf(items);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="artikel_qr_katalog_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
  }

  /**
   * QR-Katalog für Wagenbestand (technikerfähig) - NEW: uses HTML template
   * Rollen: TECHNICIAN, WAREHOUSE, MANAGER
   * - Techniker: nur eigenes Fahrzeug (req.user.vehicleId)
   * - Manager/Warehouse: optional ?vehicleId, sonst kein Ergebnis
   */
  @Get("vehicle/qr-catalog")
  @Roles("TECHNICIAN", "WAREHOUSE", "MANAGER")
  async exportVehicleQrCatalog(
    @Req() req: any,
    @Res() res: Response,
    @Query("vehicleId") vehicleId?: string,
  ) {
    const user = req.user;
    let effectiveVehicleId: string | undefined = vehicleId;
    if (user?.role === "TECHNICIAN") {
      effectiveVehicleId = user?.vehicleId;
      if (!effectiveVehicleId) {
        throw new ForbiddenException("Kein Fahrzeug zugeordnet");
      }
    }
    if (!effectiveVehicleId) {
      throw new ForbiddenException("vehicleId erforderlich (außer Techniker)");
    }

    const stock = await this.reportsService.getVehicleStockLevels(effectiveVehicleId);
    const items = stock.map(s => s.item).filter(Boolean);
    
    const pdfBuffer = await this.exportService.renderHtmlToPdf(
      items,
      stock[0]?.vehicle?.licensePlate || effectiveVehicleId,
      req?.user?.displayName || undefined,
    );
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wagen_qr_katalog_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);
  }
}

