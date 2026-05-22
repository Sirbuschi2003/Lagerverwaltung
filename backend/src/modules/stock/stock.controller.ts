import { Body, Controller, Get, Logger, Param, Patch, Post, Query, Req, UseGuards, BadRequestException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import type { Request } from "express";

import { Permissions } from "../access-control/decorators/permissions.decorator";
import { PermissionsGuard } from "../access-control/guards/permissions.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

import { CloneVehicleStockDto } from "./dto/clone-vehicle-stock.dto";
import { RecordMovementDto } from "./dto/record-movement.dto";
import { SyncPayloadDto } from "./dto/sync-payload.dto";
import { UpdateRestockStatusDto } from "./dto/update-restock-status.dto";
import { UpdateTargetDto } from "./dto/update-target.dto";
import type { RestockRequestStatus } from "./entities/restock-request.entity";
import { StockGateway } from "./stock.gateway";
import { FleetOverviewResult, StockService } from "./stock.service";

interface StockRequestUser {
  id?: string;
  username?: string;
  role?: string;
  vehicleId?: string | null;
  branchId?: string | null;
  locationIds?: string[];
}

interface StockRequest extends Request {
  user?: StockRequestUser;
}

type HistoryMovementType = "CHECKIN" | "CHECKOUT";

@Controller("stock")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class StockController {
  private readonly logger = new Logger(StockController.name);
  constructor(
    private readonly stockService: StockService,
    private readonly stockGateway: StockGateway,
  ) {}

  @Get("dashboard")
  getDashboardSnapshot(@Req() req: StockRequest) {
    return this.stockService.findDashboardSnapshot(req.user);
  }

  @Get("movements")
  findMovements(@Req() req: StockRequest, @Query("limit") limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return this.stockService.findMovements(parsed, req.user?.branchId);
  }

  @Get("location-stock")
  getLocationStock(@Req() req: StockRequest) {
    const locationIds = req.user?.locationIds ?? [];
    return this.stockService.getLocationStock(locationIds, req.user?.branchId);
  }

  @Get("vehicle/:vehicleId")
  getVehicleStock(@Req() req: StockRequest, @Param("vehicleId") vehicleId: string) {
    const user = req.user;
    this.logger.debug(`getVehicleStock vehicleId=${vehicleId} user=${user?.username} userVehicleId=${user?.vehicleId} role=${user?.role}`);
    return this.stockService.getVehicleStock(vehicleId);
  }

  @Get("vehicle/:vehicleId/shortages")
  getVehicleShortages(@Param("vehicleId") vehicleId: string) {
    this.logger.debug(`getVehicleShortages vehicleId=${vehicleId}`);
    return this.stockService.getVehicleShortages(vehicleId);
  }

  @Get("fleet")
  getFleetOverview(@Req() req: StockRequest, @Query("vehicleId") vehicleId?: string, @Query("search") search?: string): Promise<FleetOverviewResult[]> {
    const user = req.user;
    this.logger.debug(`getFleetOverview vehicleId=${vehicleId} search=${search} user=${user?.username} userVehicleId=${user?.vehicleId} role=${user?.role}`);
    return this.stockService.getFleetOverview({ vehicleId, search, branchId: user?.branchId });
  }

  @Get("shortages")
  getRestockOverview(@Req() req: StockRequest, @Query("status") status?: string) {
    this.logger.debug(`getRestockOverview status=${status}`);
    return this.stockService.getRestockOverview(
      { status: this.parseRestockStatus(status) },
      req.user?.branchId,
      req.user?.locationIds,
    );
  }

  @Patch("vehicle/:vehicleId/target")
  async updateTargetQuantity(@Req() req: StockRequest, @Param("vehicleId") vehicleId: string, @Body() dto: UpdateTargetDto) {
    const result = await this.stockService.updateTargetQuantity(vehicleId, dto, req.user?.id);
    this.stockGateway.broadcastRestockUpdate();
    return result;
  }

  @Post("vehicle/:vehicleId/remove/:itemId")
  async removeFromVehicle(@Req() req: StockRequest, @Param("vehicleId") vehicleId: string, @Param("itemId") itemId: string) {
    const result = await this.stockService.removeFromVehicle(vehicleId, itemId, req.user?.id);
    this.stockGateway.broadcastRestockUpdate();
    return result;
  }

  @Patch("shortages/:id")
  async updateRestockStatus(@Req() req: StockRequest, @Param("id") id: string, @Body() dto: UpdateRestockStatusDto) {
    this.logger.log(`updateRestockStatus id=${id} status=${dto.status}`);
    const user = req.user;
    const actor = user?.id
      ? {
          id: user.id,
          role: user.role ?? "",
          vehicleId: user.vehicleId ?? null,
        }
      : undefined;
    const result = await this.stockService.updateRestockStatus(id, dto, actor);
    this.stockGateway.broadcastRestockUpdate();
    return result;
  }

  @Post("movement")
  @SkipThrottle()
  async recordMovement(@Body() dto: RecordMovementDto) {
    this.logger.log(`recordMovement vehicleId=${dto.vehicleId} itemId=${dto.itemId} type=${dto.type} qty=${dto.quantity}`);
    const result = await this.stockService.recordMovement(dto);
    this.stockGateway.broadcastRestockUpdate();
    return result;
  }

  /**
   * Fahrzeug-Bestand klonen (Manager)
   */
  @Post("vehicle/clone")
  @Roles("MANAGER")
  @Permissions("stock.manage")
  async cloneVehicleStock(@Body() dto: CloneVehicleStockDto) {
    this.logger.log(`cloneVehicleStock source=${dto.sourceVehicleId} target=${dto.targetVehicleId}`);
    const result = await this.stockService.cloneVehicleStock(dto);
    this.stockGateway.broadcastRestockUpdate();
    return result;
  }

  /**
   * Bewegungsverlauf
   */
  @Get("movements/history")
  @Permissions("movements.view")
  async getMovementHistory(
    @Req() req: StockRequest,
    @Query("itemId") itemId?: string,
    @Query("vehicleId") vehicleId?: string,
    @Query("userId") userId?: string,
    @Query("type") type?: HistoryMovementType,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("warehouseId") warehouseId?: string,
    @Query("source") source?: string,
    @Query("includeVehicles") includeVehicles?: string,
  ) {
    const parsedFrom = from ? new Date(from) : undefined;
    // Date-only strings (YYYY-MM-DD) are parsed as midnight UTC; extend to end of day to include all movements on that date
    const parsedTo = to ? (to.length === 10 ? new Date(new Date(to).getTime() + 86399999) : new Date(to)) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;
    const data = await this.stockService.getMovements({
      itemId,
      vehicleId,
      userId,
      type,
      from: parsedFrom,
      to: parsedTo,
      limit: parsedLimit,
      offset: parsedOffset,
      branchId: req.user?.branchId,
      locationIds: req.user?.locationIds,
      warehouseId,
      source: source || undefined,
      includeVehicleMovements: includeVehicles === "true",
    });
    return data;
  }

  /**
   * Bewegungen stornieren (GoBD-konform: kein Hard-Delete, nur Soft-Void).
   * Stornierte Buchungen bleiben dauerhaft in der Datenbank erhalten (10 Jahre GoBD-Aufbewahrungspflicht).
   */
  @Patch("movements/void-batch")
  @Roles("MANAGER")
  @Permissions("movements.cleanup")
  async voidMovementsBatch(
    @Req() req: StockRequest,
    @Query("before") before: string,
    @Query("type") type?: HistoryMovementType,
  ) {
    if (!before) {
      throw new BadRequestException("Parameter 'before' (ISO-Datum) ist erforderlich");
    }
    const parsed = new Date(before);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Parameter 'before' ist kein gültiges Datum");
    }
    if (type && type !== "CHECKIN" && type !== "CHECKOUT") {
      throw new BadRequestException("Parameter 'type' muss CHECKIN oder CHECKOUT sein");
    }

    const voided = await this.stockService.cleanupMovements(parsed, type, req.user?.username);
    return { success: true, voided, note: "GoBD: Buchungen storniert, nicht gelöscht" };
  }

  /**
   * Einzelne Lagerbewegung stornieren (GoBD-konform).
   */
  @Patch("movements/:id/void")
  @Roles("MANAGER")
  @Permissions("movements.cleanup")
  async voidMovement(
    @Req() req: StockRequest,
    @Param("id") id: string,
    @Body("reason") reason: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException("Stornierungsgrund (reason) ist erforderlich");
    }
    const actor = req.user?.username ?? "unknown";
    return this.stockService.voidMovement(id, actor, reason.trim());
  }

  @Post("sync")
  syncMovements(@Body() dto: SyncPayloadDto) {
    this.logger.log(`syncMovements count=${dto.movements?.length ?? 0}`);
    return this.stockService.syncMovements(dto);
  }

  /**
   * RestockRequest-Duplikate bereinigen (nur Manager)
   * Findet und entfernt alle duplicate RestockRequests für dieselbe stockLevelId
   */
  @Post("restock-requests/cleanup-duplicates")
  @Roles("MANAGER")
  @Permissions("stock.manage")
  async cleanupRestockRequestDuplicates() {
    this.logger.log("cleanupRestockRequestDuplicates aufgerufen");
    const result = await this.stockService.cleanupRestockRequestDuplicates();
    return result;
  }

  private parseRestockStatus(status?: string): RestockRequestStatus | "OPEN" | undefined {
    if (!status) {
      return undefined;
    }

    if (status === "OPEN" || status === "PENDING" || status === "APPROVED" || status === "FULFILLED" || status === "CANCELLED") {
      return status;
    }

    return undefined;
  }
}
