import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Not, Repository, LessThan } from "typeorm";

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

import { MovementQueryService } from "./movement-query.service";
import { StockDiagnosticsService, RepairResult } from "./stock-diagnostics.service";
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

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  // TTL cache for technician map (vehicleId → displayName) — expires after 5 minutes
  private technicianCache: { data: Map<string, string>; expiresAt: number } | null = null;
  private readonly TECHNICIAN_CACHE_TTL_MS = 5 * 60 * 1000;

  // Throttle restock sync to at most once every 30 seconds per branch
  private restockSyncLastRun = new Map<string, number>();
  private readonly RESTOCK_SYNC_THROTTLE_MS = 30_000;

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
    private readonly dataSource: DataSource,
    private readonly movementQueryService: MovementQueryService,
    private readonly diagnosticsService: StockDiagnosticsService,
  ) {}

  /**
   * Builds a QueryBuilder for stock_levels filtered to the user's scope.
   * Includes SELECT for item, vehicle and location so results are fully
   * hydrated. For COUNT-only queries TypeORM wraps this in a subquery,
   * so the extra selects have no performance cost there.
   */
  private buildScopedStockLevelQuery(
    user?: { role?: string; vehicleId?: string | null; branchId?: string | null; locationIds?: string[] },
  ) {
    const qb = this.stockLevelsRepository
      .createQueryBuilder("sl")
      .innerJoinAndSelect("sl.item", "item")
      .leftJoinAndSelect("sl.vehicle", "vehicle")
      .leftJoinAndSelect("sl.location", "location")
      .leftJoin("location.parent", "locParent")
      .leftJoin("locParent.parent", "locGrand");

    if (user?.branchId) {
      qb.andWhere("(item.branchId = :branchId OR vehicle.branchId = :branchId)", {
        branchId: user.branchId,
      });
    }

    if (user?.locationIds?.length) {
      // Vehicle stock is never scoped to a warehouse location
      qb.andWhere("sl.vehicleId IS NULL");
      qb.andWhere(
        "(location.id IN (:...locationIds) OR locParent.id IN (:...locationIds) OR locGrand.id IN (:...locationIds))",
        { locationIds: user.locationIds },
      );
    }

    if (user?.role === "TECHNICIAN") {
      if (!user.vehicleId) {
        // No vehicle assigned → no results
        qb.andWhere("1 = 0");
      } else {
        qb.andWhere("sl.vehicleId = :techVehicleId", { techVehicleId: user.vehicleId });
      }
    }

    if (user?.role === "WAREHOUSE") {
      qb.andWhere("sl.vehicleId IS NULL");
    }

    return qb;
  }

  async findDashboardSnapshot(user?: { id?: string; role?: string; vehicleId?: string | null; branchId?: string | null; locationIds?: string[] }) {
    try {
      const openSessionsQb = this.inventorySessionRepository
        .createQueryBuilder("session")
        .select(["session.id", "session.assignedUserIds"])
        .where("session.status IN (:...statuses)", {
          statuses: [InventorySessionStatus.DRAFT, InventorySessionStatus.SUBMITTED],
        });

      // Sessions mit branchId=null (Super-Admin) sind niederlassungsübergreifend sichtbar.
      if (user?.branchId) {
        openSessionsQb.andWhere("(session.branchId = :branchId OR session.branchId IS NULL)", {
          branchId: user.branchId,
        });
      }

      const [totalItems, openSessions] = await Promise.all([
        this.itemsService.countItems(user?.branchId, user?.locationIds),
        openSessionsQb.getMany(),
      ]);

      // Nicht-Manager sehen nur Sessions ohne Zuordnung ODER die ihnen zugeordnet sind
      const isManager = user?.role === "MANAGER";
      const visibleSessions = isManager
        ? openSessions
        : openSessions.filter(
            (s) => !s.assignedUserIds?.length || (!!user?.id && s.assignedUserIds.includes(user.id)),
          );

      return { totalItems, openInventorySessions: visibleSessions.length };
    } catch (error) {
      this.logger.error("Fehler beim Laden des Dashboard-Snapshots:", error);
      throw error;
    }
  }



  findMovements(limit = 100, branchId?: string | null) {
    return this.movementQueryService.findMovements(limit, branchId);
  }

  findMovementsBySource(source: string) {
    return this.movementQueryService.findMovementsBySource(source);
  }

  async recordMovement(dto: RecordMovementDto, manager?: EntityManager) {
    const item = await this.resolveItem(dto);

    const vehicle = dto.vehicleId ? await this.vehiclesService.findOne(dto.vehicleId) : null;
    const user = dto.userId ? await this.usersService.findOneById(dto.userId) : null;
    const location = dto.locationId
      ? await this.locationsService.findOne(dto.locationId)
      : vehicle
        ? await this.locationsService.ensureVehicleLocation(vehicle)
        : null;

    await this.ensureMovementAllowed(item.id, vehicle?.id ?? null, location?.id ?? null, dto.type, dto.quantity);

    // Wenn ein externer EntityManager übergeben wird (z.B. aus einer umgebenden Transaktion),
    // nutzen wir diesen für create/save, damit StockMovement atomar mit der äußeren Transaktion committed wird.
    // applyMovementToStock und logStockMovement nutzen noch eigene Repositories (partieller Fix);
    // vollständige Atomarität erfordert eine spätere Umstellung aller Helfer auf EntityManager.
    const movementData = {
      item,
      vehicle: vehicle ?? null,
      location: location ?? null,
      user: user ?? null,
      type: dto.type,
      quantity: dto.quantity,
      note: dto.note ?? null,
      source: dto.source?.trim() || "manual",
      occurredAt: new Date(dto.occurredAt),
    };

    const movement = manager
      ? manager.create(StockMovement, movementData)
      : this.movementsRepository.create(movementData);

    if (manager) {
      await manager.save(StockMovement, movement);
    } else {
      await this.movementsRepository.save(movement);
    }
    try {
      await this.applyMovementToStock(movement);
    } catch (err) {
      if (!manager) {
        // Ohne externe Transaktion: Bewegung manuell entfernen, damit der Audit-Trail konsistent bleibt.
        // Mit externem Manager übernimmt der Transaktion-Rollback das Rückgängigmachen.
        await this.movementsRepository.remove(movement);
      }
      throw err;
    }

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
      relations: ["item", "vehicle", "location"],
    });
    return levels.filter((l) => l.item != null);
  }

  async getLocationStock(locationIds: string[], branchId?: string | null) {
    if (!locationIds?.length) return [];

    // QueryBuilder for proper DB-level isolation:
    // 1. Only non-vehicle stock (vehicleId IS NULL)
    // 2. Location hierarchy: direct match OR parent OR grandparent in user's assigned warehouses
    // 3. Branch filter: item must belong to the same branch as the requesting user
    const qb = this.stockLevelsRepository
      .createQueryBuilder("sl")
      .leftJoinAndSelect("sl.item", "item")
      .leftJoinAndSelect("sl.location", "location")
      .leftJoin("location.parent", "locParent")
      .leftJoin("locParent.parent", "locGrandparent")
      .where("sl.vehicleId IS NULL")
      .andWhere(
        "(location.id IN (:...locationIds) OR locParent.id IN (:...locationIds) OR locGrandparent.id IN (:...locationIds))",
        { locationIds },
      );

    if (branchId) {
      qb.andWhere("item.branchId = :branchId", { branchId });
    }

    qb.orderBy("item.manufacturer", "ASC").addOrderBy("item.productGroup", "ASC").addOrderBy("item.description", "ASC");

    const levels = await qb.getMany();
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

    // Restock-Requests für alle aktualisierten Levels synchronisieren (parallel)
    // Promise.allSettled verhindert fail-fast: alle Levels werden verarbeitet, Fehler einzeln geloggt.
    const syncResults = await Promise.allSettled(saved.map((level) => this.syncRestockRequest(level.id)));
    syncResults.forEach((r) => {
      if (r.status === 'rejected') {
        this.logger.error(`syncRestockRequest nach cloneVehicleStock fehlgeschlagen: ${r.reason?.message}`, r.reason?.stack);
      }
    });

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
      vehicle.branchId ?? undefined,
    );
    return requests.map((request: RestockRequest) => this.mapRestockRequest(request, warehouseAvailability));
  }

  async getRestockOverview(params: { status?: RestockRequestStatus | "OPEN" }, branchId?: string | null, locationIds?: string[]): Promise<RestockRequestView[]> {
    // Erledigte Requests aelter als 5 Stunden bereinigen
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);
    await this.restockRepository.delete({ status: "FULFILLED", fulfilledAt: LessThan(fiveHoursAgo) });

    // Throttled background sync: load shortage levels and sync restock requests at most once per 30s
    const throttleKey = branchId ?? "ALL";
    const now = Date.now();
    const lastRun = this.restockSyncLastRun.get(throttleKey) ?? 0;
    if (now - lastRun >= this.RESTOCK_SYNC_THROTTLE_MS) {
      this.restockSyncLastRun.set(throttleKey, now);
      const stockLevelsQb = this.stockLevelsRepository
        .createQueryBuilder("level")
        .leftJoinAndSelect("level.item", "item")
        .leftJoinAndSelect("level.vehicle", "vehicle")
        .select(["level.id", "level.quantity", "level.targetQuantity", "item.id", "vehicle.id", "vehicle.branchId"]);
      if (branchId) {
        stockLevelsQb.andWhere("vehicle.branchId = :branchId", { branchId });
      }
      const allStockLevels = await stockLevelsQb.getMany();
      const levelsWithShortage = allStockLevels.filter(
        (level) => level.item && level.vehicle && level.targetQuantity > 0 && level.quantity < level.targetQuantity,
      );
      // Fire-and-forget — do not block the response
      Promise.all(levelsWithShortage.map((level) => this.syncRestockRequest(level.id))).catch((err) =>
        this.logger.warn("Background restock sync error", err),
      );
    }

    const requestsQb = this.restockRepository
      .createQueryBuilder("request")
      .leftJoinAndSelect("request.item", "item")
      .leftJoin("item.storageLocation", "itemStorageLocation")
      .leftJoin("itemStorageLocation.parent", "itemStorageLocationParent")
      .leftJoin("itemStorageLocationParent.parent", "itemStorageLocationGrandparent")
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
    if (locationIds?.length) {
      requestsQb.andWhere(
        "(itemStorageLocation.id IN (:...locationIds) OR itemStorageLocationParent.id IN (:...locationIds) OR itemStorageLocationGrandparent.id IN (:...locationIds))",
        { locationIds },
      );
    }

    const requests = await requestsQb.getMany();
    const warehouseAvailability = await this.getWarehouseAvailabilityByItemIds(
      requests.map((request) => request.item.id),
      branchId,
      locationIds,
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

      const resolvedRequest = request;
      const savedRequest = await this.dataSource.transaction(async (manager): Promise<RestockRequest> => {
        await this.recordMovement({
          itemId: resolvedRequest.item.id,
          vehicleId: resolvedRequest.vehicle.id,
          userId: actor?.id ?? undefined,
          type: "CHECKIN",
          quantity: pickupQuantity,
          occurredAt: new Date().toISOString(),
          note: dto.note?.trim() || `Lagerausgabe uebernommen (${pickupQuantity} Stueck)`,
          source: `restock-pickup:${resolvedRequest.id}`,
        }, manager);

        // Reloaden innerhalb der Transaktion, damit Status-Update und Reload atomar sind.
        // Falls nicht gefunden: Fallback auf das bereits geladene request-Objekt.
        const fresh: RestockRequest = (await this.reloadRestockRequest(id)) ?? request!;
        const remainingPrepared = Math.max(
          0,
          Number(fresh.quantityProvided ?? previousProvided) - pickupQuantity,
        );
        fresh.quantityProvided = remainingPrepared;
        fresh.note = dto.note?.trim() || fresh.note || null;
        fresh.status = remainingPrepared > 0 ? "APPROVED" : "FULFILLED";
        fresh.readyAt = fresh.status === "APPROVED" ? (fresh.readyAt ?? new Date()) : fresh.readyAt;
        fresh.fulfilledAt = fresh.status === "FULFILLED" ? new Date() : null;
        if (fresh.status !== "APPROVED") {
          fresh.preparedBy = null;
        }
        return manager.save(fresh);
      });
      request = savedRequest;
      await this.syncRestockRequest(request.stockLevel.id);

      const finalized = await this.reloadRestockRequest(id);
      if (!finalized) {
        throw new NotFoundException("Restock request not found");
      }

      await this.logRestockRequest(finalized, finalized.preparedBy);
      const warehouseAvailability = await this.getWarehouseAvailabilityByItemIds(
        [finalized.item.id],
        finalized.vehicle?.branchId ?? undefined,
      );
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

    const warehouseAvailability = await this.getWarehouseAvailabilityByItemIds(
      [updated.item.id],
      updated.vehicle?.branchId ?? undefined,
    );
    return this.mapRestockRequest(updated, warehouseAvailability);
  }

  private async getWarehouseAvailabilityByItemIds(
    itemIds: string[],
    branchId?: string | null,
    locationIds?: string[],
  ): Promise<Map<string, number>> {
    const uniqueItemIds = Array.from(new Set(itemIds.filter(Boolean)));
    const result = new Map<string, number>();
    if (uniqueItemIds.length === 0) {
      return result;
    }

    const qb = this.stockLevelsRepository
      .createQueryBuilder("stock")
      .leftJoin("stock.location", "location")
      .select("stock.itemId", "itemId")
      .addSelect("COALESCE(SUM(stock.quantity), 0)", "quantity")
      .where("stock.itemId IN (:...itemIds)", { itemIds: uniqueItemIds })
      .andWhere("stock.vehicleId IS NULL")
      .andWhere("(location.type IS NULL OR location.type != :vehicleType)", { vehicleType: "VEHICLE" });

    if (branchId) {
      qb.andWhere("location.branchId = :branchId", { branchId });
    }

    if (locationIds?.length) {
      qb.leftJoin("location.parent", "locationParent")
        .leftJoin("locationParent.parent", "locationGrandparent");
      qb.andWhere(
        "(location.id IN (:...locationIds) OR locationParent.id IN (:...locationIds) OR locationGrandparent.id IN (:...locationIds))",
        { locationIds },
      );
    }

    const rows = await qb.groupBy("stock.itemId").getRawMany<{ itemId: string; quantity: string }>();

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
        source: "Bereitstellung",
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
      source: "Bereitstellung-Ruecknahme",
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

    await this.dataSource.transaction(async (manager) => {
      // Write lock serializes concurrent syncRestockRequest calls for the same
      // StockLevel so that the SELECT + INSERT on RestockRequest is atomic.
      const lockedStockLevel = await manager.findOne(StockLevel, {
        where: { id: stockLevelId },
        lock: { mode: "pessimistic_write" },
      });
      if (!lockedStockLevel) return;

      const shortage = Math.max(0, lockedStockLevel.targetQuantity - lockedStockLevel.quantity);

      // WICHTIG: Finde ALLE RestockRequests fÃ¼r diesen StockLevel (nicht nur den ersten!)
      const allRequests = await manager.find(RestockRequest, {
        where: { stockLevel: { id: stockLevelId } },
        order: { createdAt: "ASC" },
        relations: ["location"],
      });

      // Wenn mehrere Requests existieren, bereinigen wir Duplikate
      if (allRequests.length > 1) {
        this.logger.debug(`[RestockRequest] WARNUNG: ${allRequests.length} Duplikate fÃ¼r StockLevel ${stockLevelId} gefunden - bereinige...`);

        const duplicates = allRequests.slice(1);
        for (const dup of duplicates) {
          this.logger.debug(`[RestockRequest] LÃ¶sche Duplikat-Request ${dup.id} fÃ¼r StockLevel ${stockLevelId}`);
          await manager.remove(dup);
        }
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
          await manager.save(request);
        }
        return;
      }

      if (!request) {
        this.logger.debug(`[RestockRequest] Erstelle neuen Request fÃ¼r StockLevel ${stockLevel.id}, Artikel ${stockLevel.item.code}, Fahrzeug ${stockLevel.vehicle?.licensePlate}, Menge fehlt: ${shortage}`);
        request = manager.create(RestockRequest, {
          stockLevel,
          item: stockLevel.item,
          vehicle: stockLevel.vehicle ?? undefined,
          location: preferredSourceLocation ?? null,
          status: "PENDING",
          quantityNeeded: shortage,
          note: null,
          preparedBy: null,
          readyAt: null,
          fulfilledAt: null,
        });
      } else {
        this.logger.debug(`[RestockRequest] Aktualisiere Request fÃ¼r StockLevel ${stockLevel.id}, Artikel ${stockLevel.item.code}, Fahrzeug ${stockLevel.vehicle?.licensePlate}, Menge fehlt: ${shortage}`);
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

      await manager.save(request);
    });
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

    if (stockLevel.id) {
      // Atomic conditional UPDATE: prevents race conditions from concurrent bookings.
      // The WHERE quantity check runs on the current DB value, not the stale in-memory read.
      const result = await this.dataSource
        .createQueryBuilder()
        .update(StockLevel)
        .set({ quantity: () => `quantity + (${quantityDelta})` })
        .where('id = :id AND (quantity + :delta) >= 0', { id: stockLevel.id, delta: quantityDelta })
        .execute();

      if ((result.affected ?? 0) === 0) {
        throw new BadRequestException('Bestand reicht nicht aus (gleichzeitige Buchung erkannt).');
      }
      stockLevel.quantity = nextQuantity;
    } else {
      stockLevel.quantity = nextQuantity;
      await this.stockLevelsRepository.save(stockLevel);
    }

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

    return this.dataSource.transaction(async (manager) => {
      const savedPrimary = await manager.save(StockLevel, primary);

      for (const duplicate of duplicates) {
        const requests = await manager.find(RestockRequest, {
          where: { stockLevel: { id: duplicate.id } },
        });
        for (const request of requests) {
          request.stockLevel = savedPrimary;
          request.stockLevelId = savedPrimary.id;
          await manager.save(RestockRequest, request);
        }
      }

      if (duplicates.length > 0) {
        await manager.remove(StockLevel, duplicates);
      }

      return savedPrimary;
    });
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

  diagnoseStockLevels(branchId?: string | null) {
    return this.diagnosticsService.diagnoseStockLevels(branchId);
  }

  repairDuplicateStockLevels(branchId?: string | null) {
    return this.diagnosticsService.repairDuplicateStockLevels(branchId);
  }

  getMovements(params: Parameters<MovementQueryService['getMovements']>[0]) {
    return this.movementQueryService.getMovements(params);
  }

  cleanupMovements(before: Date, type?: StockMovementType, voidedBy?: string) {
    return this.movementQueryService.cleanupMovements(before, type, voidedBy);
  }

  voidMovement(id: string, voidedBy: string, voidReason: string) {
    return this.movementQueryService.voidMovement(id, voidedBy, voidReason);
  }

  cleanupRestockRequestDuplicates() {
    return this.diagnosticsService.cleanupRestockRequestDuplicates();
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




















