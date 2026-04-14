import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Warehouse } from "./entities/warehouse.entity";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly repository: Repository<Warehouse>,
  ) {}

  findAll(branchId?: string | null): Promise<Warehouse[]> {
    // Super-Admin (branchId = null, explicitly passed as null) → alle Lager
    // Branch-Manager (branchId gesetzt) → nur Lager dieser Niederlassung
    if (branchId === undefined) {
      return this.repository.find({ order: { name: "ASC" } });
    }
    if (branchId === null) {
      return this.repository.find({ order: { name: "ASC" } });
    }
    return this.repository.find({ where: { branchId }, order: { name: "ASC" } });
  }

  findOne(id: string): Promise<Warehouse | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByBranch(branchId: string): Promise<Warehouse[]> {
    return this.repository.find({ where: { branchId, active: true }, order: { name: "ASC" } });
  }

  async create(dto: CreateWarehouseDto, callerBranchId?: string | null): Promise<Warehouse> {
    // Branch-Manager: Lager gehört immer zur eigenen Niederlassung
    const branchId = callerBranchId !== null && callerBranchId !== undefined
      ? callerBranchId
      : (dto.branchId ?? null);

    const entity = this.repository.create({
      name: dto.name.trim(),
      code: dto.code?.trim().toUpperCase() || null,
      description: dto.description?.trim() || null,
      branchId,
      active: dto.active ?? true,
    });
    return this.repository.save(entity);
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<Warehouse> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException("Lager nicht gefunden");
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.code !== undefined) entity.code = dto.code?.trim().toUpperCase() || null;
    if (dto.description !== undefined) entity.description = dto.description?.trim() || null;
    if (dto.active !== undefined) entity.active = dto.active;
    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException("Lager nicht gefunden");
    await this.repository.remove(entity);
  }
}
