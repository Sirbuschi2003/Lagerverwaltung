import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Supplier } from "./entities/supplier.entity";

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repository: Repository<Supplier>,
  ) {}

  findAll(branchId?: string | null): Promise<Supplier[]> {
    const where = branchId ? { branchId } : {};
    return this.repository.find({ where, order: { name: "ASC" } });
  }

  findOne(id: string): Promise<Supplier | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(data: Partial<Supplier>, branchId?: string | null): Promise<Supplier> {
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
    });
    return this.repository.save(entity);
  }

  async update(id: string, data: Partial<Supplier>): Promise<Supplier> {
    const entity = await this.repository.findOne({ where: { id } });
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

    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
