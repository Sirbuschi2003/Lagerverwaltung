import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository, LessThan } from "typeorm";

import { AccessControlService } from "../access-control/access-control.service";
import { InventorySession, InventorySessionStatus } from "../inventory/entities/inventory-session.entity";
import { ItemsService } from "../items/items.service";
import { Location } from "../locations/entities/location.entity";
import { LocationsService } from "../locations/locations.service";
import { LogCategory, LogLevel } from "../logging/entities/system-log.entity";
import { LoggingService } from "../logging/services/logging.service";
import { NotificationsService } from "../notifications/notifications.service";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { VehiclesService } from "../vehicles/vehicles.service";

import { CloneVehicleStockDto } from "./dto/clone-vehicle-stock.dto";
import { RecordMovementDto } from "./dto/record-movement.dto";
import { SyncPayloadDto } from "./dto/sync-payload.dto";
import { UpdateRestockStatusDto } from "./dto/update-restock-status.dto";
import { UpdateTargetDto } from "./dto/update-target.dto";
import { RestockRequest, RestockRequestStatus } from "./entities/restock-request.entity";
import { StockLevel } from "./entities/stock-level.entity";
import { StockMovement, StockMovementType } from "./entities/stock-movement.entity";

export interface FleetOverviewStockEntry {
  stockLevelId: string;
  itemId: string;
  code: string;
  description: string;
  manufacturer: string;
  productGroup: string;
  quantity: number;
  targetQuantity: number;
}

export interface FleetOverviewResult {
  vehicle: {
    id: string;
    licensePlate: string;
    description: string;
    technicianName: string | null;
  };
  totalQuantity: number;
  itemCount: number;
  stock: FleetOverviewStockEntry[];
}

export interface RestockRequestView {
  id: string;
  status: RestockRequestStatus;
  quantityNeeded: number;
  quantityProvided: number;
  note: string | null;
  readyAt: Date | null;
  fulfilledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stockLevelId: string;
  targetQuantity: number;
  currentQuantity: number;
  item: {
    id: string;
    code: string;
    description: string;
    manufacturer: string;
    productGroup: string;
  };
  vehicle: {
    id: string;
    licensePlate: string;
    description: string;
  };
  preparedBy: {
    id: string;
    displayName: string;
  } | null;
  location: {
    id: string;
    type: string;
    code: string;
    name: string | null;
    parentId: string | null;
  } | null;
  warehouseAvailable: number;
}

interface RestockActorContext {
  id: string;
  role: string;
  vehicleId: string | null;
}

type VehicleStockLevel = StockLevel & { vehicle: NonNullable<StockLevel["vehicle"]> };

interface DuplicateStockLevelInfo {
  id: string;
  quantity: number;
  targetQuantity: number;
  item: StockLevel["item"];
  vehicle: NonNullable<StockLevel["vehicle"]>;
}

interface DuplicateStockGroup {
  key: string;
  item: string;
  vehicle: string;
  count: number;
  stockLevels: DuplicateStockLevelInfo[];
}

export interface RepairResult {
  itemCode: string;
  vehiclesConsolidated: string[];
  finalStockLevel: {
    vehicleId: string;
    vehicleLicensePlate: string;
    currentStock: number;
    targetStock: number;
  };
}

interface MovementSummaryRow {
  type: StockMovementType;
  qty: string | number | null;
  cnt: string | number | null;
}

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  // TTL cache for technician map (vehicleId → displayName) — expires after 5 minutes
  private technicianCache: { data: Map<string, string>; expiresAt: number } | null = null;
  private readonly TECHNICIAN_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    @InjectRepository(StockLevel)
    private readonly stockLevelsRepository: Repository<StockLevel>,
    @InjectRepository(StockMovement)
    private readonly movementsRepository: Repository<StockMovement>,
    @InjectRepository(RestockRequest)
    private readonly restockRepository: Repository<RestockRequest>,
    @InjectRepository(InventorySession)
    private readonly inventorySessionRepository: Repository<InventorySession>,
    private readonly itemsService: ItemsService,
    private readonly accessControlService: AccessControlService,
    private readonly usersService: UsersService,
    private readonly vehiclesService: VehiclesService,
    private readonly locationsService: LocationsService,
    private readonly notificationsService: NotificationsService,
    private readonly loggingService: LoggingService,
  ) {}

  private filterStockLevelsByUser(
    levels: StockLevel[],
    user?: { role?: string; vehicleId?: string | null; branchId?: string | null; locationIds?: string[] },
  ): StockLevel[] {
    let filtered = levels;
    // Branch-Filter: Nur Bestände der eigenen Niederlassung (via item.branchId oder vehicle.branchId)
    if (user?.branchId) {
      filtered = filtered.filter((l) => {
        const itemBranch = (l.item as any)?.branchId ?? null;
        const vehicleBranch = (l.vehicle as any)?.branchId ?? null;
        return itemBranch === user.branchId || vehicleBranch === user.branchId;
      });
    }
    // Lager-Filter: nur Bestände des zugewiesenen Lagers (location oder location.parent in locationIds)
    if (user?.locationIds?.length) {
      const ids = new Set(user.locationIds);
      filtered = filtered.filter((l) => {
        if (l.vehicle) return false; // Fahrzeugbestände nie nach Lager filtern
        const locId = (l.location as any)?.id ?? null;
        const parentId = (l.location as any)?.parent?.id ?? null;
        return locId && (ids.has(locId) || (parentId && ids.has(parentId)));
      });
    }
    if (!user?.role) return filtered;
    if (user.role === "TECHNICIAN") {
      if (!user.vehicleId) return [];
      return filtered.filter((l) => l.vehicle?.id === user.vehicleId);
    }
    if (user.role === "WAREHOUSE") {
      return filtered.filter((l) => l.vehicle === null);
    }
    return filtered;
  }

  async findDashboardSnapshot(user?: { role?: string; vehicleId?: string | null; branchId?: string | null; locationIds?: string[] }) {
    try {
      const [allStockLevels, totalItems, openInventorySessions] = await Promise.all([
        this.stockLevelsRepository.find({ relations: ["item", "vehicle", "location", "location.parent"] }),
        this.itemsService.countItems(user?.branchId, user?.locationIds),
        this.inventorySessionRepository.count({
          where: [
            { status: InventorySessionStatus.DRAFT },
            { status: InventorySessionStatus.SUBMITTED },
          ],
        }),
      ]);

      const stockLevels = this.filterStockLevelsByUser(allStockLevels, user);

      const belowTarget = stockLevels.filter((level) => {
        if (level.targetQuantity > 0 && level.quantity < level.targetQuantity) return true;
        // Mindestbestand (globaler Artikelwert) nur für Lager-Bestände, nicht für Fahrzeuge
        if (!level.vehicle && level.item?.minimumStock != null && level.item.minimumStock > 0 && level.quantity < level.item.minimumStock) return true;
        return false;
      }).length;

      return { totalItems, belowTarget, openInventorySessions };
    } catch (error) {
      this.logger.error("Fehler beim Laden des Dashboard-Snapshots:", error);
      throw error;
    }
  }

  async findBelowTargetItems(user?: { role?: string; vehicleId?: string | null; branchId?: string | null; locationIds?: string[] }) {
    try {
      const allStockLevels = await this.stockLevelsRepository.find({
        relations: ["item", "vehicle", "location", "location.parent"],
      });

      const stockLevels = this.filterStockLevelsByUser(allStockLevels, user);

      const belowLevels = stockLevels.filter((level) => {
        if (level.targetQuantity > 0 && level.quantity < level.targetQuantity) return true;
        // Mindestbestand (globaler Artikelwert) nur für Lager-Bestände, nicht für Fahrzeuge
        if (!level.vehicle && level.item?.minimumStock != null && level.item.minimumStock > 0 && level.quantity < level.item.minimumStock) return true;
        return false;
      });

      return belowLevels.map((level) => {
        const isWarehouse = !level.vehicle;
        const minStock = isWarehouse ? (level.item.minimumStock ?? 0) : 0;
        const shortage = Math.max(0, level.targetQuantity - level.quantity, minStock - level.quantity);
        const effectiveTarget = level.targetQuantity > 0
          ? Math.max(level.targetQuantity, minStock)
          : minStock || level.targetQuantity;
        const drivenByMinStock = isWarehouse && minStock > 0 && (minStock - level.quantity) >= (level.targetQuantity - level.quantity);
        return {
          stockLevelId: level.id,
          itemId: level.item.id,
          itemCode: level.item.code,
          itemDescription: level.item.description,
          locationLabel: level.vehicle
            ? (level.vehicle.licensePlate || level.vehicle.id)
            : level.location
              ? level.location.name
              : "Lager",
          quantity: level.quantity,
          targetQuantity: level.targetQuantity,
          minimumStock: level.item.minimumStock ?? null,
          effectiveTarget,
          drivenByMinStock,
          shortage,
        };
      });
    } catch (error) {
      this.logger.error("Fehler beim Laden der Unterbestand-Artikel:", error);
      throw error;
    }
  }

  async findMovements(limit = 100, branchId?: string | null) {
    try {
      if (!branchId) {
        return this.movementsRepository.find({
          order: { occurredAt: "DESC" },
          take: limit,
        });
      }
      return this.movementsRepository
        .createQueryBuilder("movement")
        .leftJoin("movement.item", "item")
        .where("item.branchId = :branchId", { branchId })
        .orderBy("movement.occurredAt", "DESC")
        .take(limit)
        .getMany();
    } catch (error) {
      this.logger.error("Fehler beim Laden der Bewegungen:", error);
      throw error;
    }
  }

  async findMovementsBySource(source: string): Promise<StockMovement[]> {
    try {
      return await this.movementsRepository.find({
        where: { source },
        relations: ["item", "vehicle", "user"],
        order: { occurredAt: "ASC" },
      });
    } catch (error) {
      this.logger.error(`Fehler beim Laden der Bewegungen fuer Quelle '${source}':`, error);
      throw error;
    }
  }

  async recordMovement(dto: RecordMovementDto) {
    const item = await this.resolveItem(dto);

    const vehicle = dto.vehicleId ? await this.vehiclesService.findOne(dto.vehicleId) : null;
    const user = dto.userId ? await this.usersService.findOneById(dto.userId) : null;
    const location = dto.locationId
      ? await this.locationsService.findOne(dto.locationId)
      : vehicle
        ? await this.locationsService.ensureVehicleLocation(vehicle)
        : null;

    await this.ensureMovementAllowed(item.id, vehicle?.id ?? null, location?.id ?? null, dto.type, dto.quantity);

    const movement = this.movementsRepository.create({
      item,
      vehicle: vehicle ?? null,
      location: location ?? null,
      user: user ?? null,
      type: dto.type,
      quantity: dto.quantity,
      note: dto.note ?? null,
      source: dto.source,
      occurredAt: new Date(dto.occurredAt),
    });

    await this.movementsRepository.save(movement);
    await this.applyMovementToStock(movement);

    // Erweiterte Protokollierung fuer alle Stock-Bewegungen
    await this.logStockMovement(movement, user);

    return movement;
  }

  async syncMovements(payload: SyncPayloadDto) {
    const results: Array<{ status: "ok" | "conflict"; occurredAt: string; reason?: string }> = [];
    for (const movement of payload.movements) {
      try {
        await this.recordMovement(movement);
        results.push({ status: "ok", occurredAt: movement.occurredAt });
      } catch (error) {
        results.push({
          status: "conflict",
          occurredAt: movement.occurredAt,
          reason: (error as Error).message,
        });
      }
    }
    return { results };
  }

  async updateTargetQuantity(vehicleId: string, dto: UpdateTargetDto, actorId?: string) {
    const vehicle = await this.vehiclesService.findOne(vehicleId);
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }

    const item = await this.itemsService.findOne(dto.itemId);
    if (!item) {
      throw new NotFoundException("Item not found");
    }

    const location = await this.locationsService.ensureVehicleLocation(vehicle);

    let stockLevel = await this.stockLevelsRepository.findOne({
      where: {
        item: { id: item.id },
        vehicle: { id: vehicle.id },
      },
    });

    const previousTarget = stockLevel?.targetQuantity ?? null;

    if (!stockLevel) {
      stockLevel = this.stockLevelsRepository.create({
        item,
        vehicle,
        location,
        quantity: 0,
        targetQuantity: dto.targetQuantity,
      });
    } else {
      stockLevel.targetQuantity = dto.targetQuantity;
      if (!stockLevel.location) {
        stockLevel.location = location;
      }
    }

    const saved = await this.stockLevelsRepository.save(stockLevel);
    await this.syncRestockRequest(saved.id);

    // Audit-Log: Zielmengen-Aenderung nachvollziehbar machen
    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.STOCK,
      'target_quantity_updated',
      JSON.stringify({
        vehicleId,
        vehicleLicensePlate: vehicle.licensePlate,
        itemId: item.id,
        itemCode: item.code,
        previousTarget,
        newTarget: dto.targetQuantity,
        actorId: actorId ?? null,
      }),
      { userId: actorId },
    );

    return saved;
  }

  async removeFromVehicle(vehicleId: string, itemId: string, actorId?: string) {
    const vehicle = await this.vehiclesService.findOne(vehicleId);
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }

    const item = await this.itemsService.findOne(itemId);
    if (!item) {
      throw new NotFoundException("Item not found");
    }

    const stockLevel = await this.stockLevelsRepository.findOne({
      where: {
        item: { id: item.id },
        vehicle: { id: vehicle.id },
      },
    });

    if (stockLevel) {
      // Artikel komplett aus Fahrzeug entfernen (StockLevel + RestockRequests)
      await this.stockLevelsRepository.remove(stockLevel);

      const restockRequests = await this.restockRepository.find({
        where: {
          item: { id: item.id },
          vehicle: { id: vehicle.id },
        },
      });
      if (restockRequests.length > 0) {
        await this.restockRepository.remove(restockRequests);
      }
    }

    // Audit-Log: Loeschvorgang fuer Nachvollziehbarkeit protokollieren
    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.STOCK,
      'item_removed_from_vehicle',
      JSON.stringify({
        vehicleId,
        vehicleLicensePlate: vehicle.licensePlate,
        itemId: item.id,
        itemCode: item.code,
        itemDescription: item.description,
        hadStockLevel: !!stockLevel,
        actorId: actorId ?? null,
      }),
      { userId: actorId },
    );

    return { success: true, message: "Artikel komplett aus Fahrzeug entfernt" };
  }

  async getVehicleStock(vehicleId: string) {
    const vehicle = await this.vehiclesService.findOne(vehicleId);
    if (!vehicle) {
      throw new NotFoundException("Vehicle not found");
    }

    const levels = await this.stockLevelsRepository.find({
      where: { vehicle: { id: vehicleId } },
      order: { item: { manufacturer: "ASC", productGroup: "ASC", description: "ASC" } },
    });
    return levels.filter((l) => l.item != null);
  }

  /**
   * Klont den Bestand eines Fahrzeugs auf ein anderes.
   * - Kopiert quantity (Ist) und targetQuantity (Soll)
   * - Ãœberschreibt bestehende Ziel-BestÃ¤nde fÃ¼r dieselben Artikel
   */
  async cloneVehicleStock(dto: CloneVehicleStockDto) {
    const { sourceVehicleId, targetVehicleId, copyQuantities = true } = dto;

    if (sourceVehicleId === targetVehicleId) {
      throw new BadRequestException("Quell- und Zielfahrzeug dÃ¼rfen nicht identisch sein.");
    }

    const sourceVehicle = await this.vehiclesService.findOne(sourceVehicleId);
    if (!sourceVehicle) {
      throw new NotFoundException("Quellfahrzeug nicht gefunden");
    }

    const targetVehicle = await this.vehiclesService.findOne(targetVehicleId);
    if (!targetVehicle) {
      throw new NotFoundException("Zielfahrzeug nicht gefunden");
    }

    const sourceLevels = await this.stockLevelsRepository.find({
      where: { vehicle: { id: sourceVehicleId } },
      relations: { item: true, location: true },
    });

    const targetLevels = await this.stockLevelsRepository.find({
      where: { vehicle: { id: targetVehicleId } },
      relations: { item: true, location: true },
    });

    const targetLocation = await this.locationsService.ensureVehicleLocation(targetVehicle);

    const targetMap = new Map<string, StockLevel>();
    targetLevels.forEach((level) => targetMap.set(level.item.id, level));

    const toSave: StockLevel[] = [];

    for (const source of sourceLevels) {
      const existing = targetMap.get(source.item.id);
      if (existing) {
        existing.quantity = copyQuantities ? source.quantity : 0;
        existing.targetQuantity = source.targetQuantity;
        if (!existing.location) {
          existing.location = targetLocation;
        }
        toSave.push(existing);
      } else {
        const created = this.stockLevelsRepository.create({
          item: source.item,
          vehicle: targetVehicle,
          location: targetLocation,
          quantity: copyQuantities ? source.quantity : 0,
          targetQuantity: source.targetQuantity,
        });
        toSave.push(created);
      }
    }

    if (toSave.length === 0) {
      return { success: true, cloned: 0, message: "Keine BestÃ¤nde im Quellfahrzeug gefunden" };
    }

    const saved = await this.stockLevelsRepository.save(toSave);

    // Restock-Requests fÃ¼r alle aktualisierten Levels synchronisieren
    for (const level of saved) {
      await this.syncRestockRequest(level.id);
    }

    await this.loggingService.log(
      LogLevel.INFO,
      LogCategory.STOCK,
      'vehicle_stock_cloned',
      JSON.stringify({
        sourceVehicleId,
        targetVehicleId,
        itemsCloned: saved.length,
        copyQuantities,
      }),
    );

    return { success: true, cloned: saved.length, copyQuantities };
  }

  async getVehicleShortages(vehicleId: string): Promise<RestockRequestView[]> {
    const vehicle = await this.vehiclesService.findOne(vehicleId);
    if (!vehicle) {
      // Fallback: Gib eine leere Liste zurÃ¼ck, wenn das Fahrzeug nicht existiert
      return [];
    }

    const requests = await this.restockRepository.find({
      where: { vehicle: { id: vehicleId }, status: Not<RestockRequestStatus>("FULFILLED") },
      relations: ["item", "vehicle", "stockLevel", "location", "location.parent"],
      order: { status: "ASC", createdAt: "ASC" },
    });
    const warehouseAvailability = await this.getWarehouseAvailabilityByItemIds(
      requests.map((request) => request.item.id),
    );
    return requests.map((request: RestockRequest) => this.mapRestockRequest(request, warehouseAvailability));
  }

  async getRestockOverview(params: { status?: RestockRequestStatus | "OPEN" }, branchId?: string | null): Promise<RestockRequestView[]> {
    // Erledigte Requests aelter als 5 Stunden bereinigen
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    await this.restockRepository.delete({ status: "FULFILLED", fulfilledAt: LessThan(fiveHoursAgo) });

    // Alle StockLevels laden und Fehlbestaende synchronisieren (nach Branch filtern)
    const stockLevelsQb = this.stockLevelsRepository
      .createQueryBuilder("level")
      .leftJoinAndSelect("level.item", "item")
      .leftJoinAndSelect("level.vehicle", "vehicle")
      .leftJoinAndSelect("level.location", "location");
    if (branchId) {
      stockLevelsQb.andWhere("vehicle.branchId = :branchId", { branchId });
    }
    const allStockLevels = await stockLevelsQb.getMany();

    // Nur die relevanten Stock-Levels bestimmen (Performance: nicht alle einzeln abfragen)
    const levelsWithShortage = allStockLevels.filter(
      (level) => level.item && level.vehicle && level.targetQuantity > 0 && level.quantity < level.targetQuantity,
    );

    // Parallel synchronisieren (jeder Level ist unabhaengig voneinander)
    await Promise.all(levelsWithShortage.map((level) => this.syncRestockRequest(level.id)));

    const requestsQb = this.restockRepository
      .createQueryBuilder("request")
      .leftJoinAndSelect("request.item", "item")
      .leftJoinAndSelect("request.vehicle", "vehicle")
      .leftJoinAndSelect("request.stockLevel", "stockLevel")
      .leftJoinAndSelect("request.location", "location")
      .leftJoinAndSelect("location.parent", "locationParent")
      .orderBy("request.status", "ASC")
      .addOrderBy("request.createdAt", "ASC");

    if (params.status) {
      if (params.status === "OPEN") {
        requestsQb.andWhere("request.status != :fulfilled", { fulfilled: "FULFILLED" });
      } else {
        requestsQb.andWhere("request.status = :status", { status: params.status });
      }
    }
    if (branchId) {
      requestsQb.andWhere("vehicle.branchId = :branchId", { branchId });
    }

    const requests = await requestsQb.getMany();
    const warehouseAvailability = await this.getWarehouseAvailabilityByItemIds(
      requests.map((request) => request.item.id),
    );
    return requests.map((request: RestockRequest) => this.mapRestockRequest(request, warehouseAvailability));
  }

  async updateRestockStatus(
    id: string,
    dto: UpdateRestockStatusDto,
    actor?: RestockActorContext,
  ): Promise<RestockRequestView> {
    let request = await this.reloadRestockRequest(id);
    if (!request) {
      throw new NotFoundException("Restock request not found");
    }

    await this.assertRestockMutationAllowed(request, dto, actor);

    const previousStatus = request.status;
    const previousProvided = Number(request.quantityProvided ?? 0);
    const requestedProvided = typeof dto.quantityProvided === "number"
      ? Math.max(0, Math.floor(dto.quantityProvided))
      : previousProvided;
    const requestedStatus = dto.status;

    let preparedBy = request.preparedBy ?? null;
    if (dto.preparedByUserId) {
      const user = await this.usersService.findOneById(dto.preparedByUserId);
      if (!user) {
        throw new NotFoundException("Prepared by user not found");
      }
      preparedBy = user;
    } else if (actor?.id && actor.role !== "TECHNICIAN" && requestedStatus !== "FULFILLED") {
      const actorUser = await this.usersService.findOneById(actor.id);
      preparedBy = actorUser ?? preparedBy;
    }

    if (requestedStatus === "FULFILLED") {
      const pickupQuantity = previousProvided;
      if (pickupQuantity <= 0) {
        throw new BadRequestException("Es ist keine bereitgestellte Menge zum Abholen vorhanden.");
      }

      await this.recordMovement({
        itemId: request.item.id,
        vehicleId: request.vehicle.id,
        userId: actor?.id ?? undefined,
        type: "CHECKIN",
        quantity: pickupQuantity,
        occurredAt: new Date().toISOString(),
        note: dto.note?.trim() || `Lagerausgabe uebernommen (${pickupQuantity} Stueck)`,
        source: `restock-pickup:${request.id}`,
      });

      request = (await this.reloadRestockRequest(id)) ?? request;
      const remainingPrepared = Math.max(
        0,
        Number(request.quantityProvided ?? previousProvided) - pickupQuantity,
      );
      request.quantityProvided = remainingPrepared;
      request.note = dto.note?.trim() || request.note || null;
      request.status = remainingPrepared > 0 ? "APPROVED" : "FULFILLED";
      request.readyAt = request.status === "APPROVED" ? (request.readyAt ?? new Date()) : request.readyAt;
      request.fulfilledAt = request.status === "FULFILLED" ? new Date() : null;
      if (request.status !== "APPROVED") {
        request.preparedBy = null;
      }

      await this.restockRepository.save(request);
      await this.syncRestockRequest(request.stockLevel.id);

      const finalized = await this.reloadRestockRequest(id);
      if (!finalized) {
        throw new NotFoundException("Restock request not found");
      }

      await this.logRestockRequest(finalized, finalized.preparedBy);
      const warehouseAvailability = await this.getWarehouseAvailabilityByItemIds([finalized.item.id]);
      return this.mapRestockRequest(finalized, warehouseAvailability);
    }

    const effectiveStatus: RestockRequestStatus =
      requestedStatus === "CANCELLED"
        ? "CANCELLED"
        : requestedProvided > 0
          ? "APPROVED"
          : "PENDING";
    const targetProvided = effectiveStatus === "CANCELLED" ? 0 : requestedProvided;
    if (targetProvided > request.quantityNeeded) {
      throw new BadRequestException("Bereitgestellte Menge darf den Fehlbestand nicht uebersteigen.");
    }

    const sourceLocation = await this.resolveRestockSourceLocation(request, dto.locationId);
    if (
      previousProvided > 0
      && targetProvided === previousProvided
      && request.location?.id
      && sourceLocation?.id
      && request.location.id !== sourceLocation.id
    ) {
      throw new BadRequestException(
        "Lagerortwechsel bei bereits bereitgestellter Menge nur mit Mengenanpassung erlaubt.",
      );
    }
    await this.applyPreparedQuantityDelta(
      request,
      previousProvided,
      targetProvided,
      sourceLocation,
      actor?.id ?? undefined,
    );

    request = (await this.reloadRestockRequest(id)) ?? request;
    request.quantityProvided = targetProvided;
    request.status = effectiveStatus;
    request.location = sourceLocation;
    request.note = dto.note?.trim() || null;

    if (effectiveStatus === "APPROVED" && targetProvided > 0) {
      request.readyAt = request.readyAt ?? new Date();
      request.fulfilledAt = null;
      request.preparedBy = preparedBy;
    } else if (effectiveStatus === "CANCELLED") {
      request.readyAt = null;
      request.fulfilledAt = new Date();
      request.preparedBy = null;
    } else {
      request.readyAt = null;
      request.fulfilledAt = null;
      request.preparedBy = null;
    }

    await this.restockRepository.save(request);

    const updated = await this.reloadRestockRequest(id);
    if (!updated) {
      throw new NotFoundException("Restock request not found");
    }

    await this.logRestockRequest(updated, updated.preparedBy);

    const shouldNotifyReady =
      updated.status === "APPROVED" &&
      (previousStatus !== "APPROVED" || Number(updated.quantityProvided ?? 0) !== previousProvided);
    if (shouldNotifyReady) {
      const allUsers = await this.usersService.findAll(updated.vehicle.branchId ?? null);
      const targetUsers = allUsers.filter((u) => u.vehicleId === updated.vehicle.id);
      if (targetUsers.length > 0) {
        await this.notificationsService.sendRestockApproved(targetUsers, {
          itemCode: updated.item.code,
          itemDescription: updated.item.description,
          quantity: updated.quantityProvided ?? updated.quantityNeeded,
          quantityNeeded: updated.quantityNeeded,
          partial: (updated.quantityProvided ?? 0) < updated.quantityNeeded,
          vehicle: updated.vehicle.licensePlate || updated.vehicle.description,
          note: updated.note,
          url: "/my-vehicle",
        });
      }
    }

    const warehouseAvailability = await this.getWarehouseAvailabilityByItemIds([updated.item.id]);
    return this.mapRestockRequest(updated, warehouseAvailability);
  }

  private async getWarehouseAvailabilityByItemIds(itemIds: string[]): Promise<Map<string, number>> {
    const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
    const result = new Map<string, number>();
    if (uniqueItemIds.length === 0) {
      return result;
    }

    const rows = await this.stockLevelsRepository
      .createQueryBuilder("stock")
      .leftJoin("stock.location", "location")
      .select("stock.itemId", "itemId")
      .addSelect("COALESCE(SUM(stock.quantity), 0)", "quantity")
      .where("stock.itemId IN (:...itemIds)", { itemIds: uniqueItemIds })
      .andWhere("stock.vehicleId IS NULL")
      .andWhere("(location.type IS NULL OR location.type != :vehicleType)", { vehicleType: "VEHICLE" })
      .groupBy("stock.itemId")
      .getRawMany<{ itemId: string; quantity: string }>();

    for (const row of rows) {
      result.set(row.itemId, Number(row.quantity) || 0);
    }

    for (const itemId of uniqueItemIds) {
      if (!result.has(itemId)) {
        result.set(itemId, 0);
      }
    }

    return result;
  }

  private async assertRestockMutationAllowed(
    request: RestockRequest,
    dto: UpdateRestockStatusDto,
    actor?: RestockActorContext,
  ) {
    if (!actor?.id) {
      throw new ForbiddenException("Unbekannter Benutzerkontext fuer Restock-Aktion.");
    }

    const permissionBundle = await this.accessControlService.getEffectivePermissionsForUserId(actor.id);
    const effectivePermissions = new Set(permissionBundle.permissions ?? []);
    const canManageRestock = effectivePermissions.has("restock.manage") || effectivePermissions.has("restock.edit");
    const canWriteStock = effectivePermissions.has("stock.write");
    const isOwnVehicle = Boolean(actor.vehicleId && actor.vehicleId === request.vehicle.id);
    const requestedStatus = dto.status;

    if (requestedStatus === "FULFILLED") {
      if (!canManageRestock && !(isOwnVehicle && canWriteStock)) {
        throw new ForbiddenException("Nur das zugeordnete Fahrzeug darf diese Bereitstellung bestaetigen.");
      }
      return;
    }

    if (!canManageRestock) {
      throw new ForbiddenException("Nur Lager/Manager duerfen Restock-Bereitstellungen bearbeiten.");
    }
  }

  private async reloadRestockRequest(id: string): Promise<RestockRequest | null> {
    return this.restockRepository.findOne({
      where: { id },
      relations: [
        "stockLevel",
        "stockLevel.location",
        "stockLevel.vehicle",
        "stockLevel.item",
        "item",
        "item.storageLocation",
        "vehicle",
        "location",
        "location.parent",
        "preparedBy",
      ],
    });
  }

  private async getDefaultWarehouseLocation(): Promise<Location | null> {
    const warehouses = await this.locationsService.findAll({ type: "WAREHOUSE", includeVehicles: true });
    return warehouses[0] ?? null;
  }

  private async resolveRestockSourceLocation(
    request: RestockRequest,
    preferredLocationId?: string,
  ): Promise<Location | null> {
    if (preferredLocationId) {
      const explicit = await this.locationsService.findOne(preferredLocationId);
      if (explicit.type === "VEHICLE") {
        throw new BadRequestException("Fahrzeug-Lagerorte koennen nicht als Bereitstellungsort genutzt werden.");
      }
      return explicit;
    }

    if (request.location && request.location.type !== "VEHICLE") {
      return request.location;
    }

    if (request.item.storageLocation && request.item.storageLocation.type !== "VEHICLE") {
      return request.item.storageLocation;
    }

    return this.getDefaultWarehouseLocation();
  }

  private async applyPreparedQuantityDelta(
    request: RestockRequest,
    currentProvided: number,
    targetProvided: number,
    sourceLocation: Location | null,
    actorUserId?: string,
  ) {
    const delta = targetProvided - currentProvided;
    if (delta === 0) return;
    if (!sourceLocation) {
      throw new BadRequestException("Kein Lagerort fuer die Bereitstellung hinterlegt.");
    }

    if (delta > 0) {
      await this.recordMovement({
        itemId: request.item.id,
        locationId: sourceLocation.id,
        userId: actorUserId,
        type: "CHECKOUT",
        quantity: delta,
        occurredAt: new Date().toISOString(),
        note: `Bereitgestellt fuer ${request.vehicle.licensePlate || request.vehicle.description}`,
        source: `restock-prepare:${request.id}`,
      });
      return;
    }

    await this.recordMovement({
      itemId: request.item.id,
      locationId: sourceLocation.id,
      userId: actorUserId,
      type: "CHECKIN",
      quantity: Math.abs(delta),
      occurredAt: new Date().toISOString(),
      note: `Bereitstellung reduziert/storniert (${request.vehicle.licensePlate || request.vehicle.description})`,
      source: `restock-release:${request.id}`,
    });
  }

  private async syncRestockRequest(stockLevelId: string) {
    const stockLevel = await this.stockLevelsRepository.findOne({
      where: { id: stockLevelId },
      relations: { item: { storageLocation: true }, vehicle: true, location: true },
    });
    if (!stockLevel) {
      return;
    }
    if (!stockLevel.vehicle) {
      return;
    }

    const preferredSourceLocation =
      stockLevel.item.storageLocation && stockLevel.item.storageLocation.type !== "VEHICLE"
        ? stockLevel.item.storageLocation
        : await this.getDefaultWarehouseLocation();

    const shortage = Math.max(0, stockLevel.targetQuantity - stockLevel.quantity);

    // WICHTIG: Finde ALLE RestockRequests fÃ¼r diesen StockLevel (nicht nur den ersten!)
    const allRequests = await this.restockRepository.find({
      where: { stockLevel: { id: stockLevel.id } },
      order: { createdAt: 'ASC' } // Ã„ltester zuerst
    });

    // Wenn mehrere Requests existieren, bereinigen wir Duplikate
    if (allRequests.length > 1) {
      this.logger.debug(`[RestockRequest] WARNUNG: ${allRequests.length} Duplikate fÃ¼r StockLevel ${stockLevel.id} gefunden - bereinige...`);
      
      // Behalte den ersten Request (Ã¤ltester), lÃ¶sche alle anderen
      const duplicates = allRequests.slice(1);
      
      for (const dup of duplicates) {
        this.logger.debug(`[RestockRequest] LÃ¶sche Duplikat-Request ${dup.id} fÃ¼r StockLevel ${stockLevel.id}`);
        await this.restockRepository.remove(dup);
      }
      
      // Verwende nur den primÃ¤ren Request weiter
      allRequests.length = 1;
    }

    let request = allRequests.length > 0 ? allRequests[0] : null;

    if (shortage <= 0) {
      if (request && request.status !== "FULFILLED") {
        request.status = "FULFILLED";
        request.quantityNeeded = 0;
        request.quantityProvided = 0;
        request.readyAt = request.readyAt ?? new Date();
        request.fulfilledAt = new Date();
        request.preparedBy = null;
        request.note = null;
        await this.restockRepository.save(request);
      }
      return;
    }

    if (!request) {
      this.logger.debug(`[RestockRequest] Erstelle neuen Request fÃ¼r StockLevel ${stockLevel.id}, Artikel ${stockLevel.item.code}, Fahrzeug ${stockLevel.vehicle.licensePlate}, Menge fehlt: ${shortage}`);
      request = this.restockRepository.create({
        stockLevel,
        item: stockLevel.item,
        vehicle: stockLevel.vehicle,
        location: preferredSourceLocation ?? null,
        status: "PENDING",
        quantityNeeded: shortage,
        note: null,
        preparedBy: null,
        readyAt: null,
        fulfilledAt: null,
      });
    } else {
      this.logger.debug(`[RestockRequest] Aktualisiere Request fÃ¼r StockLevel ${stockLevel.id}, Artikel ${stockLevel.item.code}, Fahrzeug ${stockLevel.vehicle.licensePlate}, Menge fehlt: ${shortage}`);
      request.quantityNeeded = shortage;
      if ((!request.location || request.location.type === "VEHICLE") && preferredSourceLocation) {
        request.location = preferredSourceLocation;
      }
      
      // Status-Regeln fÃ¼r Synchronisation:
      if (request.status === "FULFILLED") {
        // FULFILLED â†’ PENDING: Nur wenn wieder Bedarf besteht
        request.status = "PENDING";
        request.readyAt = null;
        request.fulfilledAt = null;
        request.preparedBy = null;
        request.note = null;
        request.quantityProvided = 0;
      } else if (request.status === "APPROVED") {
        // SCHUTZ: APPROVED bleibt APPROVED - Lager hat bereitgestellt
        // Bereitgestellte Menge bleibt erhalten (NICHT Ã¼berschreiben!)
        this.logger.debug(`[RestockRequest] SCHUTZ: Status APPROVED beibehalten fÃ¼r ${stockLevel.item.code} - quantityProvided: ${request.quantityProvided} bleibt erhalten`);
        // NICHT request.quantityProvided = 0; - das wÃ¼rde das Problem verursachen
      } else if (request.status === "CANCELLED") {
        this.logger.debug(`[RestockRequest] Status CANCELLED beibehalten fÃ¼r ${stockLevel.item.code}`);
      }
      // PENDING bleibt PENDING (Standardfall)
    }

    await this.restockRepository.save(request);
  }

  private mapRestockRequest(
    request: RestockRequest,
    warehouseAvailability: Map<string, number> = new Map<string, number>(),
  ): RestockRequestView {
    return {
      id: request.id,
      status: request.status,
      quantityNeeded: request.quantityNeeded,
      quantityProvided: request.quantityProvided ?? 0,
      note: request.note,
      readyAt: request.readyAt,
      fulfilledAt: request.fulfilledAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      stockLevelId: request.stockLevel.id,
      targetQuantity: request.stockLevel.targetQuantity,
      currentQuantity: request.stockLevel.quantity,
      item: {
        id: request.item.id,
        code: request.item.code,
        description: request.item.description,
        manufacturer: request.item.manufacturer,
        productGroup: request.item.productGroup,
      },
      vehicle: {
        id: request.vehicle.id,
        licensePlate: request.vehicle.licensePlate,
        description: request.vehicle.description,
      },
      preparedBy: request.preparedBy
        ? { id: request.preparedBy.id, displayName: request.preparedBy.displayName }
        : null,
      location: request.location
        ? {
            id: request.location.id,
            type: request.location.type,
            code: request.location.code,
            name: request.location.name ?? null,
            parentId: request.location.parent?.id ?? null,
          }
        : null,
      warehouseAvailable: warehouseAvailability.get(request.item.id) ?? 0,
    };
  }

  async getFleetOverview(params: { vehicleId?: string; search?: string; branchId?: string | null }) {
    const qb = this.stockLevelsRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.vehicle', 'vehicle')
      .leftJoinAndSelect('stock.item', 'item');

    qb.andWhere('vehicle.id IS NOT NULL');

    if (params.branchId) {
      qb.andWhere('vehicle.branchId = :branchId', { branchId: params.branchId });
    }

    if (params.vehicleId) {
      qb.andWhere('vehicle.id = :vehicleId', { vehicleId: params.vehicleId });
    }

    if (params.search) {
      const term = `%${params.search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(item.code) LIKE :term OR LOWER(item.description) LIKE :term OR LOWER(item.manufacturer) LIKE :term OR LOWER(item.productGroup) LIKE :term OR LOWER(vehicle.licensePlate) LIKE :term OR LOWER(vehicle.description) LIKE :term)',
        { term },
      );
    }

    qb.orderBy('vehicle.licensePlate', 'ASC').addOrderBy('item.description', 'ASC');

    const levels = await qb.getMany();

    // Techniker-Mapping aufbauen: vehicleId -> displayName (gecacht für 5 Minuten)
    const vehicleTechnicianMap = await this.getTechnicianMap(params.branchId);

    if (levels.length === 0 && params.vehicleId) {
      const vehicle = await this.vehiclesService.findOne(params.vehicleId);
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }
      return [
        {
          vehicle: {
            id: vehicle.id,
            licensePlate: vehicle.licensePlate,
            description: vehicle.description,
            technicianName: vehicleTechnicianMap.get(vehicle.id) ?? null,
          },
          totalQuantity: 0,
          itemCount: 0,
          stock: [],
        },
      ];
    }

    const grouped = new Map<string, FleetOverviewResult>();

    for (const level of levels) {
      const vehicle = level.vehicle;
      if (!vehicle) {
        continue;
      }
      // Typisierung erzwingen, damit bucket.stock als FleetOverviewStockEntry[] erkannt wird
      if (!level.item) continue;

      const bucket: FleetOverviewResult = grouped.get(vehicle.id) ?? {
        vehicle: {
          id: vehicle.id,
          licensePlate: vehicle.licensePlate,
          description: vehicle.description,
          technicianName: vehicleTechnicianMap.get(vehicle.id) ?? null,
        },
        totalQuantity: 0,
        itemCount: 0,
        stock: [] as FleetOverviewStockEntry[],
      };

      bucket.stock.push({
        stockLevelId: level.id,
        itemId: level.item.id,
        code: level.item.code,
        description: level.item.description,
        manufacturer: level.item.manufacturer,
        productGroup: level.item.productGroup,
        quantity: level.quantity,
        targetQuantity: level.targetQuantity,
      });
      bucket.itemCount += 1;
      bucket.totalQuantity += level.quantity;

      grouped.set(vehicle.id, bucket);
    }

    return Array.from(grouped.values());
  }

  private async resolveItem(dto: RecordMovementDto) {
    if (dto.itemId) {
      const item = await this.itemsService.findOne(dto.itemId);
      if (item) {
        return item;
      }
    }

    if (dto.itemCode) {
      const item = await this.itemsService.findOneByAnyCode(dto.itemCode);
      if (item) {
        return item;
      }
    }

    throw new NotFoundException("Item not found");
  }

  private async ensureMovementAllowed(
    itemId: string,
    vehicleId: string | null,
    locationId: string | null,
    type: StockMovementType,
    quantity: number,
  ) {
    if (type !== "CHECKOUT") {
      return;
    }

    if (vehicleId) {
      const stockLevels = await this.stockLevelsRepository.find({
        where: {
          item: { id: itemId },
          vehicle: { id: vehicleId },
        },
      });

      const available = stockLevels.reduce((sum, level) => sum + level.quantity, 0);
      if (quantity > available) {
        throw new BadRequestException(
          `Nicht genug Bestand auf dem Fahrzeug. Verfuegbar: ${available}.`,
        );
      }
      return;
    }

    if (locationId) {
      const stockLevels = await this.stockLevelsRepository.find({
        where: {
          item: { id: itemId },
          location: { id: locationId },
        },
      });

      const available = stockLevels.reduce((sum, level) => sum + level.quantity, 0);
      if (quantity > available) {
        throw new BadRequestException(
          `Nicht genug Bestand am Lagerplatz. Verfuegbar: ${available}.`,
        );
      }
    }
  }

  private async applyMovementToStock(movement: StockMovement) {
    const direction = this.resolveDirection(movement.type);
    const quantityDelta = movement.quantity * direction;
    const location = movement.location ?? (movement.vehicle ? await this.locationsService.ensureVehicleLocation(movement.vehicle) : null);
    const locationId = location?.id ?? null;

    if (!locationId) {
      if (movement.type === "CHECKIN" || movement.type === "CHECKOUT") {
        throw new BadRequestException(
          "Für diese Buchung ist ein Lagerort oder Fahrzeug erforderlich.",
        );
      }
      return;
    }

    let stockLevel: StockLevel;

    if (movement.vehicle && location) {
      stockLevel = await this.normalizeVehicleStockLevels(
        movement.item.id,
        movement.vehicle.id,
        location,
        movement.item,
        movement.vehicle,
      );
    } else {
      const existing = await this.stockLevelsRepository.findOne({
        where: {
          item: { id: movement.item.id },
          location: { id: locationId },
        },
      });

      if (!existing) {
        stockLevel = this.stockLevelsRepository.create({
          item: movement.item,
          vehicle: movement.vehicle ?? null,
          location,
          quantity: 0,
          targetQuantity: 0, // Neuer Fahrzeugartikel startet immer mit Soll = 0
        });
      } else {
        if (!existing.location) {
          existing.location = location ?? null;
        }
        if (!existing.vehicle && movement.vehicle) {
          existing.vehicle = movement.vehicle;
        }
        stockLevel = existing;
      }
    }

    const nextQuantity = stockLevel.quantity + quantityDelta;
    if (nextQuantity < 0) {
      throw new BadRequestException('Der Bestand kann nicht negativ werden.');
    }

    // Nur lÃ¶schen wenn SOWOHL quantity ALS AUCH targetQuantity = 0 sind
    if (nextQuantity === 0 && stockLevel.targetQuantity === 0) {
      // Artikel ist komplett irrelevant fÃ¼r das Fahrzeug (kein Soll, kein Ist)
      await this.stockLevelsRepository.remove(stockLevel);
      // Keine Restock-Synchronisation nÃ¶tig, da gelÃ¶scht
      return;
    }

    stockLevel.quantity = nextQuantity;
    await this.stockLevelsRepository.save(stockLevel);
    await this.syncRestockRequest(stockLevel.id);
  }

  private async normalizeVehicleStockLevels(
    itemId: string,
    vehicleId: string,
    location: Location,
    itemFallback: StockMovement["item"],
    vehicleFallback: NonNullable<StockMovement["vehicle"]>,
  ): Promise<StockLevel> {
    const levels = await this.stockLevelsRepository.find({
      where: {
        item: { id: itemId },
        vehicle: { id: vehicleId },
      },
      relations: { location: true },
      order: { createdAt: "ASC" },
    });

    if (levels.length === 0) {
      return this.stockLevelsRepository.create({
        item: itemFallback,
        vehicle: vehicleFallback,
        location,
        quantity: 0,
        targetQuantity: 0,
      });
    }

    if (levels.length === 1) {
      const single = levels[0];
      if (!single.location || single.location.id !== location.id) {
        single.location = location;
        return this.stockLevelsRepository.save(single);
      }
      return single;
    }

    const primary = levels.find((level) => level.location?.id === location.id) ?? levels[0];
    const duplicates = levels.filter((level) => level.id !== primary.id);

    primary.quantity = levels.reduce((sum, level) => sum + level.quantity, 0);
    primary.targetQuantity = levels.reduce(
      (maxTarget, level) => Math.max(maxTarget, level.targetQuantity),
      0,
    );
    primary.location = location;

    const savedPrimary = await this.stockLevelsRepository.save(primary);

    for (const duplicate of duplicates) {
      const requests = await this.restockRepository.find({
        where: { stockLevel: { id: duplicate.id } },
      });

      for (const request of requests) {
        request.stockLevel = savedPrimary;
        request.stockLevelId = savedPrimary.id;
        await this.restockRepository.save(request);
      }
    }

    if (duplicates.length > 0) {
      await this.stockLevelsRepository.remove(duplicates);
    }

    return savedPrimary;
  }

  private resolveDirection(type: StockMovementType) {
    switch (type) {
      case "CHECKIN":
        return 1;
      case "CHECKOUT":
        return -1;
      case "ADJUSTMENT":
      default:
        return 1;
    }
  }

  /**
   * Erweiterte Logging fÃ¼r alle Stock-Bewegungen
   */
  private async logStockMovement(movement: StockMovement, user: User | null) {
    const actionMap = {
      CHECKIN: 'Einbuchung',
      CHECKOUT: 'Ausbuchung',
      ADJUSTMENT: 'Korrektur',
    };

    const action = actionMap[movement.type] || movement.type;
    
    const metadata = {
      itemId: movement.item.id,
      itemCode: movement.item.code,
      itemDescription: movement.item.description,
      manufacturer: movement.item.manufacturer,
      productGroup: movement.item.productGroup,
      quantity: movement.quantity,
      type: movement.type,
      source: movement.source,
      vehicleId: movement.vehicle?.id,
      vehicleLicense: movement.vehicle?.licensePlate,
      note: movement.note,
      occurredAt: movement.occurredAt,
    };

    // Logging nur wenn User vorhanden
    if (user && user.id) {
      await this.loggingService.logStockMovement(
        user,
        action,
        movement.item.id,
        movement.quantity,
        { metadata }
      );
    }
  }

  /**
   * Logging fÃ¼r Restock-Request Ã„nderungen
   */
  private async logRestockRequest(request: RestockRequest, preparedBy: User | null) {
    const statusMap = {
      PENDING: 'Offen',
      APPROVED: 'Bereitgestellt',
      FULFILLED: 'Erledigt',
      CANCELLED: 'Storniert',
    };

    const action = `Status: ${statusMap[request.status] || request.status}`;
    
    // Verwende eine fortlaufende Nummer oder die ersten 8 Zeichen der UUID fÃ¼r Anzeige
    if (preparedBy?.id && preparedBy.id !== 'system') {
      try {
        await this.loggingService.logRestockRequest(
          preparedBy,
          action,
          request.id,
          {
            metadata: {
              requestId: request.id,
              status: request.status,
              quantityNeeded: request.quantityNeeded,
              quantityProvided: request.quantityProvided,
              note: request.note,
              stockLevelId: request.stockLevel.id,
            }
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unbekannter Fehler";
        this.logger.warn(`Logging-Fehler bei RestockRequest: ${message}`);
        // Logging-Fehler nicht weiterwerfen, damit der eigentliche Request nicht fehlschlÃ¤gt
      }
    }
  }

  // ADMIN: Diagnose und Reparatur von doppelten StockLevels
  async diagnoseStockLevels() {
    this.logger.debug('=== STOCKLEVEL DIAGNOSE GESTARTET ===');
    
    // 1. Finde alle StockLevels
    const allStockLevels = await this.stockLevelsRepository.find({
      relations: ['item', 'vehicle']
    });
    
    this.logger.debug(`Total StockLevels: ${allStockLevels.length}`);
    
    // 2. Gruppiere nach Item+Vehicle Kombination
    const combinations = new Map<string, VehicleStockLevel[]>();
    
    allStockLevels.forEach((stockLevel) => {
      if (!stockLevel.vehicle) {
        return;
      }
      const level = stockLevel as VehicleStockLevel;
      const key = `${level.item.id}_${level.vehicle.id}`;
      if (!combinations.has(key)) {
        combinations.set(key, []);
      }
      combinations.get(key)!.push(level);
    });
    
    // 3. Finde Duplikate
    const duplicates: DuplicateStockGroup[] = [];
    for (const [key, stockLevels] of combinations.entries()) {
      if (stockLevels.length > 1) {
        const first = stockLevels[0];
        if (!first) {
          continue;
        }
        duplicates.push({
          key,
          item: first.item.code,
          vehicle: first.vehicle.licensePlate,
          count: stockLevels.length,
          stockLevels: stockLevels.map((level) => ({
            id: level.id,
            quantity: level.quantity,
            targetQuantity: level.targetQuantity,
            item: level.item,
            vehicle: level.vehicle,
          }))
        });
      }
    }
    
    this.logger.debug('=== DUPLIKATE GEFUNDEN ===');
    duplicates.forEach((duplicate) => {
      if (duplicate.stockLevels.length === 0) {
        return;
      }
      this.logger.debug(`Duplikat: ${duplicate.item} auf ${duplicate.vehicle} - ${duplicate.count} StockLevels:`);
      duplicate.stockLevels.forEach((stockLevel) => {
        this.logger.debug(`  - ID: ${stockLevel.id}, Ist: ${stockLevel.quantity}, Soll: ${stockLevel.targetQuantity}`);
      });
    });
    
    // Format fÃ¼r Frontend anpassen
    const duplicateGroups = duplicates.map((duplicate) => ({
      itemCode: duplicate.item,
      itemDescription: duplicate.stockLevels[0]?.item?.description || 'Unbekannt',
      duplicateStockLevels: duplicate.stockLevels.map((stockLevel) => ({
        id: stockLevel.id,
        vehicleId: stockLevel.vehicle.id,
        vehicleLicensePlate: stockLevel.vehicle.licensePlate || duplicate.vehicle,
        currentStock: stockLevel.quantity,
        targetStock: stockLevel.targetQuantity,
      }))
    }));

    return {
      duplicateGroups,
      totalDuplicateGroups: duplicates.length,
      totalAffectedStockLevels: duplicates.reduce((sum, duplicate) => sum + duplicate.count, 0),
      summary: `${duplicates.length} Duplikat-Probleme gefunden`
    };
  }

  async repairDuplicateStockLevels() {
    this.logger.debug('=== STOCKLEVEL REPARATUR GESTARTET ===');
    
    // Hole direkt die Original-Duplikate
    const allStockLevels = await this.stockLevelsRepository.find({
      relations: ['item', 'vehicle']
    });
    
    // Gruppiere nach Item+Vehicle Kombination
    const combinations = new Map<string, VehicleStockLevel[]>();
    
    allStockLevels.forEach((stockLevel) => {
      if (!stockLevel.vehicle) {
        return;
      }
      const level = stockLevel as VehicleStockLevel;
      const key = `${level.item.id}_${level.vehicle.id}`;
      if (!combinations.has(key)) {
        combinations.set(key, []);
      }
      combinations.get(key)!.push(level);
    });
    
    // Finde Duplikate
    const duplicates: Array<{
      key: string;
      item: string;
      vehicle: string;
      count: number;
      stockLevels: VehicleStockLevel[];
    }> = [];
    for (const [key, stockLevels] of combinations.entries()) {
      if (stockLevels.length > 1) {
        const first = stockLevels[0];
        if (!first) {
          continue;
        }
        duplicates.push({
          key,
          item: first.item.code,
          vehicle: first.vehicle.licensePlate,
          count: stockLevels.length,
          stockLevels,
        });
      }
    }
    
    if (duplicates.length === 0) {
      return { 
        totalGroupsRepaired: 0,
        totalStockLevelsRemoved: 0,
        details: [],
        message: 'Keine Duplikate gefunden - keine Reparatur nÃ¶tig' 
      };
    }
    
    const repairResults: RepairResult[] = [];
    let totalRemoved = 0;
    
    for (const duplicate of duplicates) {
      this.logger.debug(`Repariere Duplikat: ${duplicate.item} auf ${duplicate.vehicle}`);
      
      const stockLevels = duplicate.stockLevels;
      
      if (stockLevels.length <= 1) {
        continue;
      }
      
      // Behalte das erste StockLevel, kombiniere die Werte
      const primaryStockLevel = stockLevels[0];
      const duplicateStockLevels = stockLevels.slice(1);
      
      // Kombiniere Mengen (nehme Maximum)
      let maxQuantity = primaryStockLevel.quantity;
      let maxTargetQuantity = primaryStockLevel.targetQuantity;
      
      duplicateStockLevels.forEach((stockLevel) => {
        maxQuantity = Math.max(maxQuantity, stockLevel.quantity);
        maxTargetQuantity = Math.max(maxTargetQuantity, stockLevel.targetQuantity);
      });
      
      // Update primÃ¤res StockLevel
      primaryStockLevel.quantity = maxQuantity;
      primaryStockLevel.targetQuantity = maxTargetQuantity;
      await this.stockLevelsRepository.save(primaryStockLevel);
      
      // Verschiebe alle RestockRequests zum primÃ¤ren StockLevel
      for (const duplicateSL of duplicateStockLevels) {
        const requests = await this.restockRepository.find({
          where: { stockLevel: { id: duplicateSL.id } }
        });
        
        for (const request of requests) {
          request.stockLevel = primaryStockLevel;
          request.stockLevelId = primaryStockLevel.id;
          await this.restockRepository.save(request);
        }
        
        // LÃ¶sche doppeltes StockLevel
        await this.stockLevelsRepository.remove(duplicateSL);
      }
      
      totalRemoved += duplicateStockLevels.length;
      
      repairResults.push({
        itemCode: duplicate.item,
        vehiclesConsolidated: [duplicate.vehicle],
        finalStockLevel: {
          vehicleId: primaryStockLevel.vehicle.id,
          vehicleLicensePlate: duplicate.vehicle,
          currentStock: maxQuantity,
          targetStock: maxTargetQuantity
        }
      });
    }
    
    this.logger.debug('=== REPARATUR ABGESCHLOSSEN ===');
    return {
      totalGroupsRepaired: duplicates.length,
      totalStockLevelsRemoved: totalRemoved,
      details: repairResults,
    };
  }

  async getMovements(params: {
    itemId?: string;
    vehicleId?: string;
    userId?: string;
    from?: Date;
    to?: Date;
    type?: StockMovementType;
    limit?: number;
    offset?: number;
    branchId?: string | null;
    locationIds?: string[];
    warehouseId?: string;
    source?: string;
  }): Promise<{ movements: StockMovement[]; total: number; summary: { totalCheckinQty: number; totalCheckoutQty: number; totalCheckinCount: number; totalCheckoutCount: number } }> {
    const effectiveLocationIds = params.warehouseId
      ? await this.locationsService.getDescendantLocationIds(params.warehouseId, params.branchId)
      : params.locationIds;

    const qb = this.movementsRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.item', 'item')
      .leftJoin('item.storageLocation', 'storageLocation')
      .leftJoin('storageLocation.parent', 'slParent')
      .leftJoinAndSelect('movement.vehicle', 'vehicle')
      .leftJoinAndSelect('movement.user', 'user')
      .orderBy('movement.occurredAt', 'DESC');

    if (params.branchId) qb.andWhere('item.branchId = :branchId', { branchId: params.branchId });
    if (effectiveLocationIds?.length) {
      qb.andWhere(
        '(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))',
        { locationIds: effectiveLocationIds },
      );
    }
    if (params.itemId) qb.andWhere('item.id = :itemId', { itemId: params.itemId });
    if (params.vehicleId) qb.andWhere('vehicle.id = :vehicleId', { vehicleId: params.vehicleId });
    if (params.userId) qb.andWhere('user.id = :userId', { userId: params.userId });
    if (params.type) qb.andWhere('movement.type = :type', { type: params.type });
    if (params.from) qb.andWhere('movement.occurredAt >= :from', { from: params.from });
    if (params.to) qb.andWhere('movement.occurredAt <= :to', { to: params.to });
    if (params.source) qb.andWhere('movement.source LIKE :source', { source: `%${params.source}%` });

    const limit = Math.min(params.limit || 50, 500);
    const offset = params.offset || 0;
    qb.take(limit).skip(offset);

    const [movements, total] = await qb.getManyAndCount();

    const summaryQb = this.movementsRepository
      .createQueryBuilder('movement')
      .leftJoin('movement.item', 'item')
      .leftJoin('item.storageLocation', 'storageLocation')
      .leftJoin('storageLocation.parent', 'slParent')
      .select('movement.type', 'type')
      .addSelect('SUM(movement.quantity)', 'qty')
      .addSelect('COUNT(*)', 'cnt');

    if (params.branchId) summaryQb.andWhere('item.branchId = :branchId', { branchId: params.branchId });
    if (effectiveLocationIds?.length) {
      summaryQb.andWhere(
        '(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))',
        { locationIds: effectiveLocationIds },
      );
    }
    if (params.itemId) summaryQb.andWhere('movement.itemId = :itemId', { itemId: params.itemId });
    if (params.vehicleId) summaryQb.andWhere('movement.vehicleId = :vehicleId', { vehicleId: params.vehicleId });
    if (params.userId) summaryQb.andWhere('movement.userId = :userId', { userId: params.userId });
    if (params.type) summaryQb.andWhere('movement.type = :type', { type: params.type });
    if (params.from) summaryQb.andWhere('movement.occurredAt >= :from', { from: params.from });
    if (params.to) summaryQb.andWhere('movement.occurredAt <= :to', { to: params.to });

    const raw = await summaryQb.groupBy('movement.type').getRawMany<MovementSummaryRow>();
    const summary = {
      totalCheckinQty: 0,
      totalCheckoutQty: 0,
      totalCheckinCount: 0,
      totalCheckoutCount: 0,
    };
    raw.forEach((row) => {
      if (row.type === 'CHECKIN') {
        summary.totalCheckinQty = Number(row.qty) || 0;
        summary.totalCheckinCount = Number(row.cnt) || 0;
      } else if (row.type === 'CHECKOUT') {
        summary.totalCheckoutQty = Number(row.qty) || 0;
        summary.totalCheckoutCount = Number(row.cnt) || 0;
      }
    });

    return { movements, total, summary };
  }

  /**
   * GoBD-konforme Stornierung: Lagerbewegungen werden NICHT gelöscht, sondern als
   * storniert markiert (isVoided=true). Originaldatensatz bleibt dauerhaft erhalten.
   * Für echte Korrekturen eine neue ADJUSTMENT-Buchung anlegen.
   */
  async cleanupMovements(before: Date, type?: StockMovementType, voidedBy?: string): Promise<number> {
    const formatMySqlDate = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');
    const formatted = formatMySqlDate(before);
    const now = new Date();

    const qb = this.movementsRepository.createQueryBuilder()
      .update(StockMovement)
      .set({
        isVoided: true,
        voidedAt: now,
        voidedBy: voidedBy ?? "system",
        voidReason: `Massen-Stornierung vor ${before.toISOString().slice(0, 10)}`,
      })
      .where("occurredAt < :before", { before: formatted })
      .andWhere("isVoided = :notVoided", { notVoided: false });

    if (type) {
      qb.andWhere("type = :type", { type });
    }

    const res = await qb.execute();
    return res.affected || 0;
  }

  /**
   * Einzelne Lagerbewegung stornieren (GoBD-konform: kein Hard-Delete).
   */
  async voidMovement(id: string, voidedBy: string, voidReason: string): Promise<StockMovement> {
    const movement = await this.movementsRepository.findOne({ where: { id } });
    if (!movement) {
      throw new NotFoundException(`Lagerbewegung ${id} nicht gefunden`);
    }
    if (movement.isVoided) {
      throw new BadRequestException(`Lagerbewegung ${id} ist bereits storniert`);
    }
    movement.isVoided = true;
    movement.voidedAt = new Date();
    movement.voidedBy = voidedBy;
    movement.voidReason = voidReason;
    return this.movementsRepository.save(movement);
  }

  /**
   * Bereinigt alle duplicate RestockRequests fÃ¼r dieselbe stockLevelId
   * BehÃ¤lt nur den Ã¤ltesten Request pro StockLevel, lÃ¶scht alle neueren
   */
  async cleanupRestockRequestDuplicates(): Promise<{
    totalDuplicatesFound: number;
    totalDuplicatesRemoved: number;
    affectedStockLevels: string[];
  }> {
    this.logger.debug('=== RESTOCK REQUEST DUPLIKATE CLEANUP GESTARTET ===');
    
    // Alle RestockRequests laden
    const allRequests = await this.restockRepository.find({
      order: { createdAt: 'ASC' }
    });
    
    // Gruppieren nach stockLevelId
    const grouped = new Map<string, typeof allRequests>();
    for (const req of allRequests) {
      const key = req.stockLevelId;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(req);
    }
    
    // Finde Duplikate
    const duplicateGroups = Array.from(grouped.entries())
      .filter(([, requests]) => requests.length > 1);
    
    this.logger.debug(`Gefunden: ${duplicateGroups.length} StockLevels mit Duplikaten`);
    
    let totalRemoved = 0;
    const affectedStockLevels: string[] = [];
    
    for (const [stockLevelId, requests] of duplicateGroups) {
      this.logger.debug(`StockLevel ${stockLevelId}: ${requests.length} RestockRequests`);
      
      // Behalte den Ã¤ltesten (ersten), lÃ¶sche den Rest
      const primary = requests[0];
      const duplicates = requests.slice(1);
      
      this.logger.debug(`  - Behalte: ${primary.id} (erstellt: ${primary.createdAt.toISOString()})`);
      
      for (const dup of duplicates) {
        this.logger.debug(`  - LÃ¶sche: ${dup.id} (erstellt: ${dup.createdAt.toISOString()})`);
        await this.restockRepository.remove(dup);
        totalRemoved++;
      }
      
      affectedStockLevels.push(stockLevelId);
    }
    
    this.logger.debug(`=== CLEANUP ABGESCHLOSSEN: ${totalRemoved} Duplikate entfernt ===`);
    
    return {
      totalDuplicatesFound: duplicateGroups.reduce((sum, [, reqs]) => sum + (reqs.length - 1), 0),
      totalDuplicatesRemoved: totalRemoved,
      affectedStockLevels
    };
  }

  private async getTechnicianMap(branchId: string | null | undefined): Promise<Map<string, string>> {
    const now = Date.now();
    if (this.technicianCache && now < this.technicianCache.expiresAt) {
      return this.technicianCache.data;
    }
    const users = await this.usersService.findAll(branchId ?? undefined);
    const map = new Map<string, string>();
    for (const u of users) {
      if (u.vehicleId && u.displayName) {
        map.set(u.vehicleId, u.displayName);
      }
    }
    this.technicianCache = { data: map, expiresAt: now + this.TECHNICIAN_CACHE_TTL_MS };
    return map;
  }
}




















