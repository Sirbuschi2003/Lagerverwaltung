import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { LocationsService } from "../locations/locations.service";
import { StockMovement, StockMovementType } from "./entities/stock-movement.entity";

interface MovementSummaryRow {
  type: StockMovementType;
  qty: string | number | null;
  cnt: string | number | null;
}

@Injectable()
export class MovementQueryService {
  private readonly logger = new Logger(MovementQueryService.name);

  constructor(
    @InjectRepository(StockMovement)
    private readonly movementsRepository: Repository<StockMovement>,
    private readonly locationsService: LocationsService,
  ) {}

  async findMovements(limit = 100, branchId?: string | null): Promise<StockMovement[]> {
    try {
      if (!branchId) {
        return this.movementsRepository.find({
          order: { occurredAt: "DESC" },
          take: limit,
          relations: ["item", "vehicle", "user"],
        });
      }
      return this.movementsRepository
        .createQueryBuilder("movement")
        .leftJoinAndSelect("movement.item", "item")
        .leftJoinAndSelect("movement.vehicle", "vehicle")
        .leftJoinAndSelect("movement.user", "user")
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
    includeVehicleMovements?: boolean;
  }): Promise<{
    movements: StockMovement[];
    total: number;
    summary: {
      totalCheckinQty: number;
      totalCheckoutQty: number;
      totalCheckinCount: number;
      totalCheckoutCount: number;
    };
  }> {
    const effectiveLocationIds = params.warehouseId
      ? await this.locationsService.getDescendantLocationIds(params.warehouseId, params.branchId)
      : params.locationIds;

    const excludeVehicles = effectiveLocationIds?.length && !params.includeVehicleMovements;

    const qb = this.movementsRepository
      .createQueryBuilder("movement")
      .leftJoinAndSelect("movement.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent")
      .leftJoinAndSelect("movement.vehicle", "vehicle")
      .leftJoinAndSelect("movement.user", "user")
      .orderBy("movement.occurredAt", "DESC");

    if (params.branchId) qb.andWhere("item.branchId = :branchId", { branchId: params.branchId });
    if (effectiveLocationIds?.length) {
      qb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }
    if (excludeVehicles) qb.andWhere("movement.vehicleId IS NULL");
    if (params.itemId) qb.andWhere("item.id = :itemId", { itemId: params.itemId });
    if (params.vehicleId) qb.andWhere("vehicle.id = :vehicleId", { vehicleId: params.vehicleId });
    if (params.userId) qb.andWhere("user.id = :userId", { userId: params.userId });
    if (params.type) qb.andWhere("movement.type = :type", { type: params.type });
    if (params.from) qb.andWhere("movement.occurredAt >= :from", { from: params.from });
    if (params.to) qb.andWhere("movement.occurredAt <= :to", { to: params.to });
    qb.andWhere("movement.source NOT LIKE :importPattern", { importPattern: "%import%" });
    if (params.source) qb.andWhere("movement.source LIKE :source", { source: `%${params.source}%` });

    const limit = Math.min(params.limit || 50, 500);
    const offset = params.offset || 0;
    qb.take(limit).skip(offset);

    const [movements, total] = await qb.getManyAndCount();

    const summaryQb = this.movementsRepository
      .createQueryBuilder("movement")
      .leftJoin("movement.item", "item")
      .leftJoin("item.storageLocation", "storageLocation")
      .leftJoin("storageLocation.parent", "slParent")
      .select("movement.type", "type")
      .addSelect("SUM(movement.quantity)", "qty")
      .addSelect("COUNT(*)", "cnt");

    if (params.branchId) summaryQb.andWhere("item.branchId = :branchId", { branchId: params.branchId });
    if (effectiveLocationIds?.length) {
      summaryQb.andWhere(
        "(storageLocation.id IN (:...locationIds) OR slParent.id IN (:...locationIds))",
        { locationIds: effectiveLocationIds },
      );
    }
    if (excludeVehicles) summaryQb.andWhere("movement.vehicleId IS NULL");
    if (params.itemId) summaryQb.andWhere("movement.itemId = :itemId", { itemId: params.itemId });
    if (params.vehicleId) summaryQb.andWhere("movement.vehicleId = :vehicleId", { vehicleId: params.vehicleId });
    if (params.userId) summaryQb.andWhere("movement.userId = :userId", { userId: params.userId });
    if (params.type) summaryQb.andWhere("movement.type = :type", { type: params.type });
    if (params.from) summaryQb.andWhere("movement.occurredAt >= :from", { from: params.from });
    if (params.to) summaryQb.andWhere("movement.occurredAt <= :to", { to: params.to });
    summaryQb.andWhere("movement.source NOT LIKE :importPattern", { importPattern: "%import%" });

    const raw = await summaryQb.groupBy("movement.type").getRawMany<MovementSummaryRow>();
    const summary = {
      totalCheckinQty: 0,
      totalCheckoutQty: 0,
      totalCheckinCount: 0,
      totalCheckoutCount: 0,
    };
    raw.forEach((row) => {
      if (row.type === "CHECKIN") {
        summary.totalCheckinQty = Number(row.qty) || 0;
        summary.totalCheckinCount = Number(row.cnt) || 0;
      } else if (row.type === "CHECKOUT") {
        summary.totalCheckoutQty = Number(row.qty) || 0;
        summary.totalCheckoutCount = Number(row.cnt) || 0;
      }
    });

    return { movements, total, summary };
  }

  async cleanupMovements(before: Date, type?: StockMovementType, voidedBy?: string): Promise<number> {
    const formatMySqlDate = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
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

    if (type) qb.andWhere("type = :type", { type });

    const res = await qb.execute();
    return res.affected || 0;
  }

  async voidMovement(id: string, voidedBy: string, voidReason: string): Promise<StockMovement> {
    const movement = await this.movementsRepository.findOne({ where: { id } });
    if (!movement) throw new NotFoundException(`Lagerbewegung ${id} nicht gefunden`);
    if (movement.isVoided) throw new BadRequestException(`Lagerbewegung ${id} ist bereits storniert`);

    movement.isVoided = true;
    movement.voidedAt = new Date();
    movement.voidedBy = voidedBy;
    movement.voidReason = voidReason;
    return this.movementsRepository.save(movement);
  }
}
