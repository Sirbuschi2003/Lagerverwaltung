import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Vehicle } from "../vehicles/entities/vehicle.entity";
import { Location } from "./entities/location.entity";

const AUTO_CODE_BASE_BY_TYPE: Record<string, string> = {
  WAREHOUSE: "LAGER",
  SHELF: "REGAL",
  BIN: "FACH",
};

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly repository: Repository<Location>,
  ) {}

  async findAll(params?: { type?: string; parentId?: string | null; includeVehicles?: boolean; branchId?: string | null }) {
    const qb = this.repository.createQueryBuilder("location")
      .leftJoinAndSelect("location.parent", "parent")
      .leftJoinAndSelect("location.vehicle", "vehicle");

    if (params?.branchId) {
      qb.andWhere("location.branchId = :branchId", { branchId: params.branchId });
    }

    if (params?.type) {
      qb.andWhere("location.type = :type", { type: params.type });
    }

    if (params?.parentId === "null") {
      qb.andWhere("location.parentId IS NULL");
    } else if (params?.parentId) {
      qb.andWhere("location.parentId = :parentId", { parentId: params.parentId });
    }

    if (!params?.includeVehicles) {
      qb.andWhere("location.type != 'VEHICLE'");
    }

    qb.orderBy("location.type", "ASC").addOrderBy("location.code", "ASC");
    return qb.getMany();
  }

  async findOne(id: string, branchId?: string | null): Promise<Location> {
    const where: Record<string, unknown> = { id };
    if (branchId) where.branchId = branchId;
    const location = await this.repository.findOne({
      where,
      relations: ["parent", "vehicle"],
    });
    if (!location) {
      throw new NotFoundException("Location not found");
    }
    return location;
  }

  async create(data: { type: string; code?: string; name?: string; parentId?: string; branchId?: string | null }) {
    if (data.type === "VEHICLE") {
      throw new BadRequestException("Vehicle locations are managed by the system.");
    }

    const parent = data.parentId ? await this.repository.findOne({ where: { id: data.parentId } }) : null;
    if (data.parentId && !parent) {
      throw new NotFoundException("Parent location not found");
    }

    const parentId = parent?.id ?? null;
    const manualCode = data.code?.trim() ?? "";
    let resolvedCode = manualCode;

    if (manualCode) {
      const duplicateCode = await this.codeExists(parentId, manualCode);
      if (duplicateCode) {
        throw new BadRequestException("Code existiert im ausgewaehlten Parent bereits.");
      }
    } else {
      const generatedBase = this.buildAutoCodeBase(data.type, data.name);
      resolvedCode = await this.generateUniqueCode(parentId, generatedBase);
    }

    const entity = this.repository.create({
      type: data.type as any,
      code: resolvedCode,
      name: data.name?.trim() || null,
      parent,
      vehicle: null,
      branchId: data.branchId ?? null,
    });
    return this.repository.save(entity);
  }

  async update(id: string, data: { code?: string; name?: string; parentId?: string | null }) {
    const location = await this.findOne(id);
    if (location.type === "VEHICLE" || location.vehicle) {
      throw new BadRequestException("Vehicle locations cannot be edited here.");
    }

    if (data.code !== undefined) {
      const nextCode = data.code.trim();
      if (!nextCode) {
        throw new BadRequestException("Code darf nicht leer sein.");
      }
      location.code = nextCode;
    }
    if (data.name !== undefined) {
      location.name = data.name?.trim() || null;
    }
    if (data.parentId !== undefined) {
      if (!data.parentId) {
        location.parent = null;
      } else {
        const parent = await this.repository.findOne({ where: { id: data.parentId } });
        if (!parent) {
          throw new NotFoundException("Parent location not found");
        }
        location.parent = parent;
      }
    }

    if (data.code !== undefined || data.parentId !== undefined) {
      const duplicateCode = await this.codeExists(location.parent?.id ?? null, location.code, location.id);
      if (duplicateCode) {
        throw new BadRequestException("Code existiert im ausgewaehlten Parent bereits.");
      }
    }

    return this.repository.save(location);
  }

  private buildAutoCodeBase(type: string, name?: string): string {
    const fromName = this.slugifyCodePart(name);
    if (fromName) {
      return fromName;
    }
    return AUTO_CODE_BASE_BY_TYPE[type] ?? "ORT";
  }

  private slugifyCodePart(value?: string | null): string {
    const cleaned = value?.trim() ?? "";
    if (!cleaned) return "";
    const withoutUmlauts = cleaned
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const slug = withoutUmlauts
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase();
    return slug.slice(0, 120);
  }

  private async generateUniqueCode(parentId: string | null, baseCode: string): Promise<string> {
    const maxLength = 120;
    const initialBase = (baseCode || "ORT").slice(0, maxLength) || "ORT";

    let candidate = initialBase;
    let index = 2;

    while (await this.codeExists(parentId, candidate)) {
      const suffix = `-${index}`;
      const trimmedBase = initialBase.slice(0, Math.max(1, maxLength - suffix.length));
      candidate = `${trimmedBase}${suffix}`;
      index += 1;
    }

    return candidate;
  }

  private async codeExists(parentId: string | null, code: string, ignoreId?: string): Promise<boolean> {
    const qb = this.repository
      .createQueryBuilder("location")
      .where("location.code = :code", { code });

    if (parentId) {
      qb.andWhere("location.parentId = :parentId", { parentId });
    } else {
      qb.andWhere("location.parentId IS NULL");
    }

    if (ignoreId) {
      qb.andWhere("location.id != :ignoreId", { ignoreId });
    }

    const count = await qb.getCount();
    return count > 0;
  }

  async remove(id: string): Promise<void> {
    const location = await this.findOne(id);
    if (location.type === "VEHICLE" || location.vehicle) {
      throw new BadRequestException("Vehicle locations cannot be deleted here.");
    }
    await this.repository.delete(id);
  }

  findByVehicleId(vehicleId: string): Promise<Location | null> {
    return this.repository.findOne({
      where: { vehicle: { id: vehicleId } },
    });
  }

  async ensureVehicleLocation(vehicle: Vehicle): Promise<Location> {
    const existing = await this.repository.findOne({
      where: { vehicle: { id: vehicle.id } },
    });

    if (existing) {
      const nextCode = vehicle.licensePlate?.trim() || existing.code;
      const nextName = vehicle.description?.trim() || null;
      if (existing.code !== nextCode || existing.name !== nextName) {
        existing.code = nextCode;
        existing.name = nextName;
        return this.repository.save(existing);
      }
      return existing;
    }

    const entity = this.repository.create({
      type: "VEHICLE",
      code: vehicle.licensePlate?.trim() || vehicle.id,
      name: vehicle.description?.trim() || null,
      vehicle,
      branchId: vehicle.branchId ?? null,
    });
    return this.repository.save(entity);
  }
}
