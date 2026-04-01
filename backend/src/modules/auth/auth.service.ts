import * as crypto from "crypto";

import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
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

import { PasswordHistory } from "./entities/password-history.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";

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
  ) {}

  private static readonly PASSWORD_HISTORY_LIMIT = 5;

  /** Prüft ob das neue Passwort in der Passwort-Historie vorkommt */
  private async isPasswordInHistory(userId: string, newPassword: string): Promise<boolean> {
    const history = await this.passwordHistoryRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
      take: AuthService.PASSWORD_HISTORY_LIMIT,
      relations: ["user"],
    });
    for (const entry of history) {
      if (await bcrypt.compare(newPassword, entry.passwordHash)) return true;
    }
    return false;
  }

  /** Speichert einen neuen Hash in der Passwort-Historie und bereinigt ältere Einträge */
  private async addToPasswordHistory(userId: string, passwordHash: string): Promise<void> {
    await this.passwordHistoryRepository.save(
      this.passwordHistoryRepository.create({ user: { id: userId }, passwordHash })
    );
    // Nur die letzten N Hashes behalten
    const all = await this.passwordHistoryRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: "DESC" },
      relations: ["user"],
    });
    if (all.length > AuthService.PASSWORD_HISTORY_LIMIT) {
      const toDelete = all.slice(AuthService.PASSWORD_HISTORY_LIMIT);
      await this.passwordHistoryRepository.remove(toDelete);
    }
  }

  // Dummy-Hash fuer Timing-Attack-Schutz: verhindert, dass Angreifer anhand der
  // Antwortzeit gueltige Benutzernamen erraten koennen (immer bcrypt.compare ausfuehren)
  private static readonly DUMMY_HASH = "$2b$12$invalidhashfortimingnulluser00000000000000000000000000";

  async validateUser(username: string, password: string, context?: { ipAddress?: string; userAgent?: string }): Promise<User> {
    const user = await this.usersService.findOneByUsername(username);

    // Immer bcrypt.compare ausfuehren – auch wenn User nicht existiert (Timing-Attack-Schutz)
    const hashToCompare = user?.passwordHash ?? AuthService.DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user) {
      // Log fehlgeschlagenen Login-Versuch
      await this.loggingService.logSecurity(
        'LOGIN_FAILED_USER_NOT_FOUND',
        `Login-Versuch mit unbekanntem Benutzernamen: ${username}`,
        { ...context, metadata: { username } }
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!isMatch) {
      // Log fehlgeschlagenen Login-Versuch
      await this.loggingService.logSecurity(
        'LOGIN_FAILED_WRONG_PASSWORD',
        `Falsches Passwort für Benutzer: ${username}`,
        { ...context, userId: user.id, metadata: { username } }
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    return user;
  }

  async login(user: User, context?: { ipAddress?: string; userAgent?: string }) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      branchId: user.branchId ?? null,
    };

    const refreshPayload = { ...payload, tokenType: "refresh" };
    const refreshExpiresIn =
      this.configService.get<string>("auth.jwtRefreshExpiresIn") || "30d";

    // Log erfolgreichen Login
    await this.loggingService.logUserLogin(user, context);

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken: await this.jwtService.signAsync(refreshPayload, { expiresIn: refreshExpiresIn }),
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

      const userId = decoded.sub;
      const user = await this.usersService.findOneById(userId);
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        branchId: user.branchId ?? null,
      };
      const refreshPayload = { ...payload, tokenType: "refresh" };
      const refreshExpiresIn =
        this.configService.get<string>("auth.jwtRefreshExpiresIn") || "30d";

      return {
        accessToken: await this.jwtService.signAsync(payload),
        refreshToken: await this.jwtService.signAsync(refreshPayload, { expiresIn: refreshExpiresIn }),
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
    await this.emailService.sendPasswordResetEmail(user.email!, token, user.displayName);

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
    const isInHistory = await this.isPasswordInHistory(user.id, newPassword);
    const isSameAsCurrent = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSameAsCurrent || isInHistory) {
      throw new BadRequestException(
        `Das neue Passwort darf nicht eines der letzten ${AuthService.PASSWORD_HISTORY_LIMIT} Passwörter sein`
      );
    }

    // Hash neues Passwort
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Aktuellen Hash in Historie speichern, dann updaten
    await this.addToPasswordHistory(user.id, user.passwordHash);
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
      permissions: permissionBundle.permissions,
      permissionOverrides: permissionBundle.overrides,
      permissionDenials: permissionBundle.denials,
    };
  }
}




