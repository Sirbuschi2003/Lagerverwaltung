import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { In, Repository } from "typeorm";

import { addToPasswordHistory, isPasswordInHistory, PASSWORD_HISTORY_LIMIT } from "../../common/utils/password-history.util";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { User } from "./entities/user.entity";
import { Location } from "../locations/entities/location.entity";
import { PasswordHistory } from "../auth/entities/password-history.entity";
import { RefreshToken } from "../auth/entities/refresh-token.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(PasswordHistory)
    private readonly passwordHistoryRepository: Repository<PasswordHistory>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
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
   * Löscht: Passwort, E-Mail, Namen, Einstellungen, alle Refresh-Tokens, Passwort-History.
   * Behält: userId in system_logs (Audit-Trail), anonymisierter Datensatz für Revisionszwecke.
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

    // Alle aktiven Refresh-Tokens ungültig machen (sofortiger Logout auf allen Geräten)
    await this.refreshTokenRepository.update(
      { userId: id, isRevoked: false },
      { isRevoked: true, revokedAt: new Date() },
    );

    // Passwort-History löschen (keine personenbezogenen Daten mehr nötig nach Anonymisierung)
    await this.passwordHistoryRepository
      .createQueryBuilder()
      .delete()
      .where('userId = :id', { id })
      .execute();

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
    const user = await this.repository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException("Benutzer nicht gefunden");

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) throw new Error("Aktuelles Passwort ist falsch");

    if (!newPassword || newPassword.length < 8) {
      throw new Error("Neues Passwort muss mindestens 8 Zeichen lang sein");
    }

    // Prüfen ob das neue Passwort mit dem aktuellen oder einem der letzten N Passwörter übereinstimmt
    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    const isInHistory = await isPasswordInHistory(this.passwordHistoryRepository, userId, newPassword);
    if (isSameAsCurrent || isInHistory) {
      throw new ForbiddenException(
        `Das neue Passwort darf nicht eines der letzten ${PASSWORD_HISTORY_LIMIT} Passwörter sein`,
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Aktuellen Hash in Passwort-Historie aufnehmen, dann Passwort wechseln
    await addToPasswordHistory(this.passwordHistoryRepository, userId, user.passwordHash);
    await this.repository.update(userId, { passwordHash: newPasswordHash });
  }
}
