import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Location } from "../locations/entities/location.entity";
import { Supplier } from "./entities/supplier.entity";

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repository: Repository<Supplier>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  // Gibt für eine Liste von locationIds alle Ancestor-IDs zurück (parent + grandparent).
  // Nötig weil User auf Regal/Fach-Ebene zugeordnet sein können,
  // Lieferanten aber auf WAREHOUSE-Ebene gespeichert werden.
  private async resolveWarehouseIds(locationIds: string[]): Promise<string[]> {
    const all = new Set<string>(locationIds);
    const locs = await this.locationRepository.find({
      where: locationIds.map((id) => ({ id })),
      relations: ["parent", "parent.parent"],
    });
    for (const loc of locs) {
      if (loc.parent?.id) all.add(loc.parent.id);
      if (loc.parent?.parent?.id) all.add(loc.parent.parent.id);
    }
    return [...all];
  }

  async findAll(branchId?: string | null, locationIds?: string[]): Promise<Supplier[]> {
    const qb = this.repository.createQueryBuilder("supplier").orderBy("supplier.name", "ASC");

    if (branchId) {
      qb.andWhere("supplier.branchId = :branchId", { branchId });
    }

    if (locationIds?.length) {
      // Hierarchie-aware: User kann auf Regal/Fach-Ebene zugeordnet sein,
      // Lieferant ist auf WAREHOUSE-Ebene gespeichert → Ancestors einschließen
      const warehouseIds = await this.resolveWarehouseIds(locationIds);
      qb.andWhere("supplier.locationId IN (:...warehouseIds)", { warehouseIds });
    }

    return qb.getMany();
  }

  findOne(id: string, branchId?: string | null): Promise<Supplier | null> {
    const where: Record<string, unknown> = { id };
    if (branchId) where.branchId = branchId;
    return this.repository.findOne({ where });
  }

  async create(data: Partial<Supplier>, branchId?: string | null, locationId?: string | null): Promise<Supplier> {
    const entity = this.repository.create({
      name: data.name?.trim(),
      addressLine1: data.addressLine1?.trim() || null,
      addressLine2: data.addressLine2?.trim() || null,
      postalCode: data.postalCode?.trim() || null,
      city: data.city?.trim() || null,
      country: data.country?.trim() || null,
      contactName: data.contactName?.trim() || null,
      email: data.email?.trim() || null,
      customerNumber: data.customerNumber?.trim() || null,
      phone: data.phone?.trim() || null,
      notes: data.notes?.trim() || null,
      branchId: branchId ?? null,
      locationId: locationId ?? null,
    });
    return this.repository.save(entity);
  }

  async update(id: string, data: Partial<Supplier>, branchId?: string | null): Promise<Supplier> {
    const where: Record<string, unknown> = { id };
    if (branchId) where.branchId = branchId;
    const entity = await this.repository.findOne({ where });
    if (!entity) {
      throw new NotFoundException("Supplier not found");
    }

    if (data.name !== undefined) entity.name = data.name?.trim() || "";
    if (data.addressLine1 !== undefined) entity.addressLine1 = data.addressLine1?.trim() || null;
    if (data.addressLine2 !== undefined) entity.addressLine2 = data.addressLine2?.trim() || null;
    if (data.postalCode !== undefined) entity.postalCode = data.postalCode?.trim() || null;
    if (data.city !== undefined) entity.city = data.city?.trim() || null;
    if (data.country !== undefined) entity.country = data.country?.trim() || null;
    if (data.contactName !== undefined) entity.contactName = data.contactName?.trim() || null;
    if (data.email !== undefined) entity.email = data.email?.trim() || null;
    if (data.customerNumber !== undefined) entity.customerNumber = data.customerNumber?.trim() || null;
    if (data.phone !== undefined) entity.phone = data.phone?.trim() || null;
    if (data.notes !== undefined) entity.notes = data.notes?.trim() || null;
    if (data.locationId !== undefined) {
      entity.locationId = data.locationId ?? null;
      // branchId automatisch aus der Location ableiten wenn noch nicht gesetzt
      if (data.locationId && !entity.branchId) {
        const loc = await this.locationRepository.findOne({ where: { id: data.locationId } });
        if (loc?.branchId) entity.branchId = loc.branchId;
      }
    }

    return this.repository.save(entity);
  }

  async remove(id: string, branchId?: string | null): Promise<void> {
    if (branchId) {
      const entity = await this.repository.findOne({ where: { id, branchId } as any });
      if (!entity) throw new NotFoundException("Supplier not found");
    }
    await this.repository.delete(id);
  }
}
