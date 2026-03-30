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

  findAll(): Promise<Vehicle[]> {
    return this.repository.find({ order: { licensePlate: "ASC" } });
  }

  findOne(id: string): Promise<Vehicle | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(data: Pick<Vehicle, "licensePlate" | "description">): Promise<Vehicle> {
    const exists = await this.repository.findOne({ where: { licensePlate: data.licensePlate } });
    if (exists) {
      throw new Error('Kennzeichen bereits vergeben');
    }
    const entity = this.repository.create(data);
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
