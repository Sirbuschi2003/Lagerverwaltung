import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";

import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findAll(branchId?: string | null, warehouseId?: string | null): Promise<User[]> {
    // Manager ohne Warehouse-Zuweisung sieht alle User seiner Niederlassung
    const where: Record<string, unknown> = {};
    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else if (branchId) {
      where.branchId = branchId;
    }
    return this.repository.find({ where, order: { displayName: "ASC" } });
  }

  async findTechnicians(branchId?: string | null): Promise<Array<{ id: string; displayName: string; vehicleId: string | null }>> {
    const where: any = { role: "TECHNICIAN" };
    if (branchId) where.branchId = branchId;
    const technicians = await this.repository.find({ where, order: { displayName: "ASC" } });
    return technicians.map(t => ({
      id: t.id,
      displayName: t.displayName,
      vehicleId: t.vehicleId,
    }));
  }

  findOneById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  findOneByUsername(username: string): Promise<User | null> {
    return this.repository.findOne({ where: { username } });
  }

  findOneByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.repository.findOne({ where: { username: dto.username } });
    if (exists) {
      throw new Error('Benutzername bereits vergeben');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const entity = this.repository.create({
      username: dto.username,
      passwordHash,
      displayName: dto.displayName,
      email: dto.email ?? null,
      role: dto.role,
      vehicleId: dto.vehicleId ?? null,
      branchId: dto.branchId ?? null,
      warehouseId: (dto as any).warehouseId ?? null,
    });
    return this.repository.save(entity);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const updateData: any = {
      id,
      displayName: dto.displayName,
      email: dto.email ?? null,
      role: dto.role,
      vehicleId: dto.vehicleId ?? null,
    };
    if (dto.branchId !== undefined) updateData.branchId = dto.branchId;
    if ((dto as any).warehouseId !== undefined) updateData.warehouseId = (dto as any).warehouseId;
    const entity = await this.repository.preload(updateData);

    if (!entity) {
      throw new NotFoundException("User not found");
    }

    if (dto.password) {
      entity.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * DSGVO Art. 17: Anonymisierung statt Hard-Delete.
   * Personenbezogene Daten werden überschrieben, der User-Datensatz bleibt für die
   * Referenzintegrität mit Lagerbewegungen/Inventur erhalten (GoBD: 10 Jahre Aufbewahrung).
   * Art. 17 Abs. 3 lit. b DSGVO: Recht auf Löschung entfällt bei gesetzlichen Aufbewahrungspflichten.
   */
  async anonymizeUser(id: string): Promise<{ message: string; anonymizedId: string }> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }

    // Anonymisierten Ersatznamen generieren (kein Rückschluss auf Person möglich)
    const anonymizedSuffix = id.substring(0, 8);
    await this.repository.update(id, {
      username: `deleted_${anonymizedSuffix}`,
      displayName: "Gelöschter Benutzer",
      email: null,
      passwordHash: "$2b$12$ANONYMIZED_ACCOUNT_NO_LOGIN_POSSIBLE_PLACEHOLDER_XXXXXX",
      settings: null,
      vehicleId: null,
    });

    return {
      message: "Benutzerdaten wurden anonymisiert. Der Datensatz bleibt für Revisionszwecke erhalten.",
      anonymizedId: id,
    };
  }

  /**
   * Gibt alle personenbezogenen Daten eines Benutzers zurück (DSGVO Art. 15 Auskunftsrecht).
   */
  async getUserDataExport(id: string): Promise<Record<string, unknown>> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      vehicleId: user.vehicleId,
      // passwordHash wird NICHT exportiert
      exportedAt: new Date().toISOString(),
      note: "Gemäß DSGVO Art. 15 — nur für den betroffenen Benutzer bestimmt",
    };
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.repository.update(userId, { passwordHash });
  }

  async getUserSettings(userId: string): Promise<Record<string, unknown>> {
    const user = await this.repository.findOne({ where: { id: userId } });
    return (user?.settings as Record<string, unknown>) ?? {};
  }

  async updateUserSettings(userId: string, settings: Record<string, unknown>): Promise<void> {
    await this.repository.update(userId, { settings: settings as object });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.repository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Benutzer nicht gefunden");
    }

    // Aktuelles Passwort prüfen
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new Error("Aktuelles Passwort ist falsch");
    }

    // Neues Passwort hashen und speichern
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.repository.update(userId, { passwordHash: newPasswordHash });
  }
}

