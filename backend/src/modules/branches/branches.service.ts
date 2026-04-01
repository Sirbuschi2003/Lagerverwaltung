import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Branch } from "./entities/branch.entity";
import { CreateBranchDto } from "./dto/create-branch.dto";
import { UpdateBranchDto } from "./dto/update-branch.dto";

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly repository: Repository<Branch>,
  ) {}

  findAll(): Promise<Branch[]> {
    return this.repository.find({ order: { name: "ASC" } });
  }

  findOne(id: string): Promise<Branch | null> {
    return this.repository.findOne({ where: { id } });
  }

  findOneByExternalCode(externalCode: string): Promise<Branch | null> {
    return this.repository.findOne({ where: { externalCode } });
  }

  async create(dto: CreateBranchDto): Promise<Branch> {
    const entity = this.repository.create({
      name: dto.name.trim(),
      externalCode: dto.externalCode?.trim() || null,
      address: dto.address?.trim() || null,
      active: dto.active ?? true,
    });
    return this.repository.save(entity);
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException("Niederlassung nicht gefunden");
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.externalCode !== undefined) entity.externalCode = dto.externalCode?.trim() || null;
    if (dto.address !== undefined) entity.address = dto.address?.trim() || null;
    if (dto.active !== undefined) entity.active = dto.active;
    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) throw new NotFoundException("Niederlassung nicht gefunden");
    await this.repository.remove(entity);
  }
}
