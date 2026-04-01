import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Vehicle } from "./entities/vehicle.entity";
import { LocationsService } from "../locations/locations.service";

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repository: Repository<Vehicle>,
    private readonly locationsService: LocationsService,
  ) {}

  findAll(branchId?: string | null): Promise<Vehicle[]> {
    const where = branchId ? { branchId } : {};
    return this.repository.find({ where, order: { licensePlate: "ASC" } });
  }

  findOne(id: string): Promise<Vehicle | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(data: Pick<Vehicle, "licensePlate" | "description">, branchId?: string | null): Promise<Vehicle> {
    const where = branchId ? { licensePlate: data.licensePlate, branchId } : { licensePlate: data.licensePlate };
    const exists = await this.repository.findOne({ where });
    if (exists) {
      throw new Error('Kennzeichen bereits vergeben');
    }
    const entity = this.repository.create({ ...data, branchId: branchId ?? null });
    const saved = await this.repository.save(entity);
    await this.locationsService.ensureVehicleLocation(saved);
    return saved;
  }

  async update(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const entity = await this.repository.preload({ id, ...data });
    if (!entity) {
      throw new NotFoundException("Vehicle not found");
    }
    const saved = await this.repository.save(entity);
    await this.locationsService.ensureVehicleLocation(saved);
    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
