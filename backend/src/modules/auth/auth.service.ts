import * as crypto from "crypto";

import { Injectable, Logger, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { Repository } from "typeorm";

import { AccessControlService } from "../access-control/access-control.service";
import { EmailService } from "../email/email.service";
import { LoggingService } from "../logging/services/logging.service";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";

import { addToPasswordHistory, isPasswordInHistory, PASSWORD_HISTORY_LIMIT } from "../../common/utils/password-history.util";
import { PasswordHistory } from "./entities/password-history.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { RefreshToken } from "./entities/refresh-token.entity";

interface RefreshTokenPayload {
  sub: string;
  tokenType?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly loggingService: LoggingService,
    private readonly emailService: EmailService,
    private readonly accessControlService: AccessControlService,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(PasswordHistory)
    private readonly passwordHistoryRepository: Repository<PasswordHistory>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  /**
   * In-Memory-Tracking fehlgeschlagener Login-Versuche für Account-Lockout.
   *
   * BEKANNTE EINSCHRÄNKUNG: Der Map-Inhalt geht bei jedem Server-Neustart verloren.
   * Das bedeutet: Ein gesperrtes Konto ist nach einem Neustart sofort wieder entsperrt.
   * Für persistente Lockouts muss eine `failed_login_attempts`-Tabelle (DB-Migration)
   * implementiert werden, die Zähler und `locked_until` pro Benutzer speichert.
   */
  private static readonly failedAttempts = new Map<string, { count: number; lockedUntil: number | null }>();
  private static readonly MAX_FAILED_ATTEMPTS = 10;
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Minuten

  private checkLockout(username: string): void {
    const key = `user:${username.toLowerCase()}`;
    const entry = AuthService.failedAttempts.get(key);
    if (entry?.lockedUntil && Date.now() < entry.lockedUntil) {
      const remaining = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Konto temporär gesperrt – zu viele Fehlversuche. Bitte in ${remaining} Minute(n) erneut versuchen.`,
      );
    }
    // Abgelaufene Sperren aufräumen
    if (entry?.lockedUntil && Date.now() >= entry.lockedUntil) {
      AuthService.failedAttempts.delete(key);
    }
  }

  private recordFailedAttempt(username: string): void {
    const key = `user:${username.toLowerCase()}`;
    const entry = AuthService.failedAttempts.get(key) ?? { count: 0, lockedUntil: null };
    entry.count++;
    if (entry.count >= AuthService.MAX_FAILED_ATTEMPTS) {
      entry.lockedUntil = Date.now() + AuthService.LOCKOUT_DURATION_MS;
      entry.count = 0; // Counter zurücksetzen nach Sperre
      this.logger.warn(
        `Account-Lockout ausgelöst für "${username}". ` +
        "HINWEIS: Lockout ist In-Memory und geht bei Server-Neustart verloren. " +
        "Für persistente Lockouts: failed_login_attempts-Tabelle (DB-Migration) implementieren.",
      );
    }
    AuthService.failedAttempts.set(key, entry);
  }

  private clearFailedAttempts(username: string): void {
    AuthService.failedAttempts.delete(`user:${username.toLowerCase()}`);
  }

  /** SHA-256-Hash eines Refresh-Tokens (kein Klartext in der DB) */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Parst eine JWT-ExpiresIn-Angabe (z.B. "30d", "1h") in ein absolutes Ablaufdatum.
   * Unterstuetzte Einheiten: s (Sekunden), m (Minuten), h (Stunden), d (Tage).
   */
  private parseExpiryToDate(expiresIn: string): Date {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) {
      throw new Error(`Ungueltiges expiresIn-Format: ${expiresIn}`);
    }
    const value = parseInt(match[1], 10);
    const unitMs: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(Date.now() + value * unitMs[match[2]]);
  }

  // Dummy-Hash fuer Timing-Attack-Schutz: verhindert, dass Angreifer anhand der
  // Antwortzeit gueltige Benutzernamen erraten koennen (immer bcrypt.compare ausfuehren)
  private static readonly DUMMY_HASH = "$2b$12$invalidhashfortimingnulluser00000000000000000000000000";

  async validateUser(username: string, password: string, context?: { ipAddress?: string; userAgent?: string }): Promise<User> {
    // Lockout prüfen BEVOR Datenbankzugriff (verhindert Enumeration + DoS)
    this.checkLockout(username);

    const user = await this.usersService.findOneByUsername(username);

    // Immer bcrypt.compare ausfuehren – auch wenn User nicht existiert (Timing-Attack-Schutz)
    const hashToCompare = user?.passwordHash ?? AuthService.DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user) {
      this.recordFailedAttempt(username);
      await this.loggingService.logSecurity(
        'LOGIN_FAILED_USER_NOT_FOUND',
        `Login-Versuch mit unbekanntem Benutzernamen: ${username}`,
        { ...context, metadata: { username } }
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!isMatch) {
      this.recordFailedAttempt(username);
      await this.loggingService.logSecurity(
        'LOGIN_FAILED_WRONG_PASSWORD',
        `Falsches Passwort für Benutzer: ${username}`,
        { ...context, userId: user.id, metadata: { username } }
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    // Erfolgreicher Login: Fehlversuche zurücksetzen
    this.clearFailedAttempts(username);
    return user;
  }

  async login(user: User, context?: { ipAddress?: string; userAgent?: string }) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      branchId: user.branchId ?? null,
      locationIds: user.locations?.map(l => l.id) ?? [],
    };

    const refreshPayload = { ...payload, tokenType: "refresh" };
    const refreshExpiresIn =
      this.configService.get<string>("auth.jwtRefreshExpiresIn") || "30d";

    // Log erfolgreichen Login
    await this.loggingService.logUserLogin(user, context);

    const refreshToken = await this.jwtService.signAsync(refreshPayload, { expiresIn: refreshExpiresIn });

    // Refresh-Token in Datenbank persistieren (SEC-002)
    await this.refreshTokenRepo.save({
      userId: user.id,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: this.parseExpiryToDate(refreshExpiresIn),
      revokedAt: null,
      isRevoked: false,
    });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
      user: await this.buildProfile(user),
    };
  }

  async refresh(refreshToken: string, context?: { ipAddress?: string; userAgent?: string }) {
    try {
      const decoded = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.configService.get<string>("auth.jwtSecret"),
      });

      if (decoded.tokenType !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }

      // DB-seitige Validierung: Token muss existieren, aktiv und nicht abgelaufen sein (SEC-002)
      const hash = this.hashToken(refreshToken);
      const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash: hash, isRevoked: false } });
      if (!stored || stored.expiresAt < new Date()) {
        throw new UnauthorizedException("Refresh token ungueltig oder abgelaufen");
      }

      const userId = decoded.sub;
      const user = await this.usersService.findOneById(userId);
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      // Alten Token invalidieren (Token-Rotation)
      stored.isRevoked = true;
      stored.revokedAt = new Date();
      await this.refreshTokenRepo.save(stored);

      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        branchId: user.branchId ?? null,
        locationIds: user.locations?.map(l => l.id) ?? [],
      };
      const refreshPayload = { ...payload, tokenType: "refresh" };
      const refreshExpiresIn =
        this.configService.get<string>("auth.jwtRefreshExpiresIn") || "30d";

      const newRefreshToken = await this.jwtService.signAsync(refreshPayload, { expiresIn: refreshExpiresIn });

      // Neuen Token persistieren
      await this.refreshTokenRepo.save({
        userId: user.id,
        tokenHash: this.hashToken(newRefreshToken),
        expiresAt: this.parseExpiryToDate(refreshExpiresIn),
        revokedAt: null,
        isRevoked: false,
      });

      return {
        accessToken: await this.jwtService.signAsync(payload),
        refreshToken: newRefreshToken,
        user: await this.buildProfile(user),
      };
    } catch (err) {
      await this.loggingService.logSecurity(
        "REFRESH_TOKEN_INVALID",
        "Ungültiger oder abgelaufener Refresh-Token",
        { ...context, metadata: { reason: (err as Error)?.message } },
      );
      throw new UnauthorizedException("Refresh token invalid");
    }
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    const hash = this.hashToken(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash: hash, isRevoked: false } });
    if (stored) {
      stored.isRevoked = true;
      stored.revokedAt = new Date();
      await this.refreshTokenRepo.save(stored);
    }
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException("Invalid token");
    }
    return this.buildProfile(user);
  }

  async requestPasswordReset(
    email: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      // Log Versuch für unbekannte E-Mail, aber gib keine Information preis
      await this.loggingService.logSecurity(
        'PASSWORD_RESET_UNKNOWN_EMAIL',
        `Passwort-Reset angefordert für unbekannte E-Mail: ${email}`,
        { ...context, metadata: { email } }
      );
      // Gib immer die gleiche Antwort zurück (Security by Obscurity)
      return { message: 'Falls die E-Mail-Adresse in unserem System existiert, wurde eine Reset-E-Mail gesendet.' };
    }

    // Invalidiere alle bestehenden Tokens für diesen Benutzer
    await this.passwordResetTokenRepository.update(
      { userId: user.id, used: false },
      { used: true, usedAt: new Date() }
    );

    // Generiere neues Token (sicher & kryptographisch stark)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token gültig für 1 Stunde

    // Speichere Token in Datenbank
    const passwordResetToken = this.passwordResetTokenRepository.create({
      token,
      userId: user.id,
      expiresAt,
      requestedFromIp: context?.ipAddress,
    });
    await this.passwordResetTokenRepository.save(passwordResetToken);

    // Sende Reset-E-Mail
    await this.emailService.sendPasswordResetEmail(user.email!, user.displayName, token);

    // Log erfolgreiche Anfrage
    await this.loggingService.logSecurity(
      'PASSWORD_RESET_REQUESTED',
      `Passwort-Reset angefordert für Benutzer: ${user.username}`,
      { ...context, userId: user.id, metadata: { email } }
    );

    return { message: 'Falls die E-Mail-Adresse in unserem System existiert, wurde eine Reset-E-Mail gesendet.' };
  }

  async resetPassword(
    token: string,
    newPassword: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ message: string }> {
    // Finde Token
    const passwordResetToken = await this.passwordResetTokenRepository.findOne({
      where: { token, used: false },
      relations: ['user'],
    });

    if (!passwordResetToken) {
      await this.loggingService.logSecurity(
        'PASSWORD_RESET_INVALID_TOKEN',
        'Ungültiger Passwort-Reset Token verwendet',
        { ...context, metadata: { token: token.substring(0, 8) + '...' } }
      );
      throw new BadRequestException('Ungültiger oder bereits verwendeter Token');
    }

    // Prüfe Ablaufzeit
    if (passwordResetToken.expiresAt < new Date()) {
      await this.loggingService.logSecurity(
        'PASSWORD_RESET_EXPIRED_TOKEN',
        'Abgelaufener Passwort-Reset Token verwendet',
        { ...context, userId: passwordResetToken.userId, metadata: { expiredAt: passwordResetToken.expiresAt } }
      );
      throw new BadRequestException('Token ist abgelaufen');
    }

    // Validiere neues Passwort
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Passwort muss mindestens 8 Zeichen lang sein');
    }

    // Hash neues Passwort
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update Benutzer-Passwort
    await this.usersService.updatePassword(passwordResetToken.user.id, passwordHash);

    // Markiere Token als verwendet
    passwordResetToken.used = true;
    passwordResetToken.usedAt = new Date();
    await this.passwordResetTokenRepository.save(passwordResetToken);

    // Log erfolgreichen Reset
    await this.loggingService.logSecurity(
      'PASSWORD_RESET_COMPLETED',
      `Passwort erfolgreich zurückgesetzt für Benutzer: ${passwordResetToken.user.username}`,
      { ...context, userId: passwordResetToken.user.id }
    );

    return { message: 'Passwort wurde erfolgreich zurückgesetzt' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ message: string }> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new UnauthorizedException('Benutzer nicht gefunden');
    }

    // Validiere aktuelles Passwort
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      await this.loggingService.logSecurity(
        'PASSWORD_CHANGE_FAILED',
        `Fehlgeschlagener Passwort-Änderungsversuch - falsches aktuelles Passwort für Benutzer: ${user.username}`,
        { ...context, userId: user.id }
      );
      throw new BadRequestException('Aktuelles Passwort ist falsch');
    }

    // Validiere neues Passwort
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Neues Passwort muss mindestens 8 Zeichen lang sein');
    }

    // Prüfe ob neues Passwort in der Passwort-Historie vorkommt (inkl. aktuelles Passwort)
    const isInHistory = await isPasswordInHistory(this.passwordHistoryRepository, user.id, newPassword);
    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent || isInHistory) {
      throw new BadRequestException(
        `Das neue Passwort darf nicht eines der letzten ${PASSWORD_HISTORY_LIMIT} Passwörter sein`
      );
    }

    // Hash neues Passwort
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Aktuellen Hash in Historie speichern, dann updaten
    await addToPasswordHistory(this.passwordHistoryRepository, user.id, user.passwordHash);
    await this.usersService.updatePassword(user.id, passwordHash);

    // Log erfolgreiche Passwort-Änderung
    await this.loggingService.logSecurity(
      'PASSWORD_CHANGED',
      `Passwort erfolgreich geändert für Benutzer: ${user.username}`,
      { ...context, userId: user.id }
    );

    return { message: 'Passwort wurde erfolgreich geändert' };
  }

  private async buildProfile(user: User) {
    const permissionBundle = await this.accessControlService.getEffectivePermissionsForUserId(user.id);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      email: user.email ?? null,
      vehicleId: user.vehicleId ?? null,
      branchId: user.branchId ?? null,
      locationIds: user.locations?.map(l => l.id) ?? [],
      permissions: permissionBundle.permissions,
      permissionOverrides: permissionBundle.overrides,
      permissionDenials: permissionBundle.denials,
    };
  }
}
