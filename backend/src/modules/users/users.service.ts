import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { In, Repository } from "typeorm";

import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./entities/user.entity";
import { Location } from "../locations/entities/location.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
  ) {}

  findAll(branchId?: string | null): Promise<User[]> {
    const where: Record<string, unknown> = {};
    if (branchId) where.branchId = branchId;
    return this.repository.find({ where, relations: ["locations"], order: { displayName: "ASC" } });
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
    return this.repository.findOne({ where: { id }, relations: ["locations"] });
  }

  findOneByUsername(username: string): Promise<User | null> {
    return this.repository.findOne({ where: { username }, relations: ["locations"] });
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
    const locations = dto.locationIds?.length
      ? await this.locationRepository.find({ where: { id: In(dto.locationIds) } })
      : [];
    const entity = this.repository.create({
      username: dto.username,
      passwordHash,
      displayName: dto.displayName,
      email: dto.email ?? null,
      role: dto.role,
      vehicleId: dto.vehicleId ?? null,
      branchId: dto.branchId ?? null,
      locations,
    });
    return this.repository.save(entity);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const entity = await this.repository.findOne({ where: { id }, relations: ["locations"] });
    if (!entity) throw new NotFoundException("User not found");

    if (dto.displayName !== undefined) entity.displayName = dto.displayName;
    if (dto.email !== undefined) entity.email = dto.email ?? null;
    if (dto.role !== undefined) entity.role = dto.role;
    if (dto.vehicleId !== undefined) entity.vehicleId = dto.vehicleId ?? null;
    if (dto.branchId !== undefined) entity.branchId = dto.branchId ?? null;
    if (dto.password) entity.passwordHash = await bcrypt.hash(dto.password, 12);

    if (dto.locationIds !== undefined) {
      entity.locations = dto.locationIds.length
        ? await this.locationRepository.find({ where: { id: In(dto.locationIds) } })
        : [];
    }

    return this.repository.save(entity);
  }

  async remove(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * DSGVO Art. 17: Anonymisierung statt Hard-Delete.
   */
  async anonymizeUser(id: string): Promise<{ message: string; anonymizedId: string }> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) throw new NotFoundException("Benutzer nicht gefunden");

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
    if (!user) throw new NotFoundException("Benutzer nicht gefunden");
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      vehicleId: user.vehicleId,
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
    // TODO (Fix A5): AuthService.changePassword() enthält vollständige Passwort-Historie-Prüfung
    // (isPasswordInHistory / addToPasswordHistory). Eine direkte Injektion von AuthService hier
    // ist nicht möglich, da AuthModule → UsersModule eine zirkuläre Abhängigkeit entstehen würde.
    // Lösung: PasswordHistory-Entity in UsersModule registrieren, PasswordHistoryRepository
    // hier injizieren und die Logik aus auth.service.ts (Zeilen 78–106, 328–379) übertragen.
    const user = await this.repository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Benutzer nicht gefunden");

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) throw new Error("Aktuelles Passwort ist falsch");

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.repository.update(userId, { passwordHash: newPasswordHash });
  }
}
