import * as crypto from "crypto";

import { Injectable, Logger, UnauthorizedException, BadRequestException, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcrypt";
import { generateSecret as otpGenerateSecret, generateURI as otpGenerateURI, verifySync as otpVerifySync } from "otplib";
import * as QRCode from "qrcode";
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  private static readonly MAX_FAILED_ATTEMPTS = 10;
  private static readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Minuten

  private async checkLockout(username: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { username: username.toLowerCase() },
      select: ["id", "username", "lockedUntil"],
    });
    if (user?.lockedUntil && new Date() < user.lockedUntil) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Konto temporär gesperrt – zu viele Fehlversuche. Bitte in ${remaining} Minute(n) erneut versuchen.`,
      );
    }
    // Abgelaufene Sperre in DB bereinigen
    if (user?.lockedUntil && new Date() >= user.lockedUntil) {
      await this.userRepo.update(user.id, { lockedUntil: null, failedLoginAttempts: 0 });
    }
  }

  private async recordFailedAttempt(username: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { username: username.toLowerCase() },
      select: ["id", "username", "failedLoginAttempts"],
    });
    if (!user) return; // Unbekannter User – kein DB-Eintrag nötig (Timing-Attack-Schutz im Aufrufer)
    const newCount = (user.failedLoginAttempts ?? 0) + 1;
    if (newCount >= AuthService.MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + AuthService.LOCKOUT_DURATION_MS);
      await this.userRepo.update(user.id, { failedLoginAttempts: 0, lockedUntil });
      this.logger.warn(`Account-Lockout ausgelöst für "${username}" bis ${lockedUntil.toISOString()}.`);
    } else {
      await this.userRepo.update(user.id, { failedLoginAttempts: newCount });
    }
  }

  private async clearFailedAttempts(username: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { username: username.toLowerCase() },
      select: ["id", "failedLoginAttempts", "lockedUntil"],
    });
    if (user && (user.failedLoginAttempts > 0 || user.lockedUntil)) {
      await this.userRepo.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }
  }

  /** SHA-256-Hash eines Tokens (kein Klartext in der DB) */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /** Kürzt IP-Adressen auf Subnetz-Ebene (DSGVO: kein vollständiges Logging personenbezogener IPs) */
  private anonymizeIpAddress(ip?: string): string | undefined {
    if (!ip) return undefined;
    const ipv4Match = /^(\d+\.\d+\.\d+\.)\d+$/.exec(ip);
    if (ipv4Match) return ipv4Match[1] + "0";
    if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":*:*:*:*:*";
    return ip;
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
    await this.checkLockout(username);

    const user = await this.usersService.findOneByUsername(username);

    // Immer bcrypt.compare ausfuehren – auch wenn User nicht existiert (Timing-Attack-Schutz)
    const hashToCompare = user?.passwordHash ?? AuthService.DUMMY_HASH;
    const isMatch = await bcrypt.compare(password, hashToCompare);

    if (!user) {
      await this.recordFailedAttempt(username);
      await this.loggingService.logSecurity(
        'LOGIN_FAILED_USER_NOT_FOUND',
        `Login-Versuch mit unbekanntem Benutzernamen: ${username}`,
        { ...context, metadata: { username } }
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!isMatch) {
      await this.recordFailedAttempt(username);
      await this.loggingService.logSecurity(
        'LOGIN_FAILED_WRONG_PASSWORD',
        `Falsches Passwort für Benutzer: ${username}`,
        { ...context, userId: user.id, metadata: { username } }
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    // Erfolgreicher Login: Fehlversuche zurücksetzen
    await this.clearFailedAttempts(username);
    return user;
  }

  async login(user: User, context?: { ipAddress?: string; userAgent?: string }) {
    // If MFA is enabled, return a short-lived MFA challenge token instead of full auth tokens.
    // The client must call POST /auth/mfa/verify with this token + the TOTP code to complete login.
    if (user.mfaEnabled && user.mfaTotpSecret) {
      const mfaToken = await this.jwtService.signAsync(
        { sub: user.id, tokenType: 'mfa-challenge' },
        { expiresIn: '5m' },
      );
      return { requiresMfa: true, mfaToken };
    }

    // NIS2-009: MFA-Enrollment-Pflicht für privilegierte Rollen (ADMIN, SUPER_ADMIN).
    // Statt ForbiddenException: kurzlebiger mfa-setup Token für den Bootstrap-Flow:
    //   1. POST /api/auth/mfa/setup-init       (mfaSetupToken) → QR-Code + Secret
    //   2. POST /api/auth/mfa/verify-setup-init (mfaSetupToken + totpCode) → vollständige Auth-Tokens
    if (["ADMIN", "SUPER_ADMIN"].includes(user.role) && !user.mfaEnabled) {
      await this.loggingService.logSecurity(
        'MFA_ENROLLMENT_REQUIRED',
        `Login für ${user.role} ohne MFA — MFA-Setup-Token ausgestellt: ${user.username}`,
        { ...context, userId: user.id },
      );
      const mfaSetupToken = await this.jwtService.signAsync(
        { sub: user.id, tokenType: 'mfa-setup' },
        { expiresIn: '10m' },
      );
      return { requiresMfaSetup: true, mfaSetupToken };
    }

    return this.issueTokens(user, context);
  }

  /** Called from /auth/mfa/verify — verifies TOTP code then issues real tokens. */
  async completeMfaLogin(
    mfaToken: string,
    totpCode: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    let payload: { sub: string; tokenType: string };
    try {
      payload = await this.jwtService.verifyAsync(mfaToken, {
        secret: this.configService.get<string>('auth.jwtSecret'),
      });
    } catch {
      throw new UnauthorizedException('MFA-Token ungültig oder abgelaufen');
    }

    if (payload.tokenType !== 'mfa-challenge') {
      throw new UnauthorizedException('Ungültiger Token-Typ');
    }

    const user = await this.userRepo.findOne({ where: { id: payload.sub }, relations: ['locations'] });
    if (!user || !user.mfaEnabled || !user.mfaTotpSecret) {
      throw new UnauthorizedException('MFA nicht konfiguriert');
    }

    const verifyResult = otpVerifySync({ token: totpCode, secret: user.mfaTotpSecret });
    if (!verifyResult.valid) {
      await this.loggingService.logSecurity('MFA_FAILED', 'Falscher TOTP-Code bei Login', { userId: user.id, ...context });
      throw new UnauthorizedException('Ungültiger Authenticator-Code');
    }

    return this.issueTokens(user, context);
  }

  /** Generates TOTP secret + QR code URI for setup. Does NOT enable MFA yet. */
  async setupMfa(userId: string): Promise<{ secret: string; qrCodeDataUrl: string; otpAuthUrl: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const secret = otpGenerateSecret();
    const appName = 'Lagerverwaltung';
    const otpAuthUrl = otpGenerateURI({ issuer: appName, label: user.username, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Store secret tentatively — MFA is not active until verifyMfaSetup confirms with a valid code
    await this.userRepo.update(userId, { mfaTotpSecret: secret, mfaEnabled: false });

    return { secret, qrCodeDataUrl, otpAuthUrl };
  }

  /** Verifies TOTP code after scanning QR code, then activates MFA. */
  async verifyMfaSetup(userId: string, totpCode: string): Promise<{ enabled: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.mfaTotpSecret) {
      throw new BadRequestException('Kein MFA-Secret gefunden. Bitte zuerst Setup starten.');
    }

    const verifyResult = otpVerifySync({ token: totpCode, secret: user.mfaTotpSecret });
    if (!verifyResult.valid) {
      throw new BadRequestException('Ungültiger Code. Bitte prüfen Sie die Uhrzeit Ihres Geräts und versuchen Sie es erneut.');
    }

    await this.userRepo.update(userId, { mfaEnabled: true });
    await this.loggingService.logSecurity('MFA_ENABLED', 'MFA wurde aktiviert', { userId });
    return { enabled: true };
  }

  /** MFA-Bootstrap: initiates setup using a mfa-setup token (no full JWT needed). */
  async setupMfaViaSetupToken(mfaSetupToken: string) {
    const payload = await this.verifyMfaSetupToken(mfaSetupToken);
    return this.setupMfa(payload.sub as string);
  }

  /** MFA-Bootstrap: confirms TOTP and issues full auth tokens (no full JWT needed). */
  async verifyMfaSetupViaSetupToken(
    mfaSetupToken: string,
    totpCode: string,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const payload = await this.verifyMfaSetupToken(mfaSetupToken);
    const userId = payload.sub as string;
    await this.verifyMfaSetup(userId, totpCode);
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['locations'] });
    if (!user) throw new UnauthorizedException('User nicht gefunden');
    return this.issueTokens(user, context);
  }

  private async verifyMfaSetupToken(token: string): Promise<{ sub: string; tokenType: string }> {
    let payload: { sub: string; tokenType: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('auth.jwtSecret'),
      });
    } catch {
      throw new UnauthorizedException('Ungültiger oder abgelaufener MFA-Setup-Token');
    }
    if (payload.tokenType !== 'mfa-setup') {
      throw new UnauthorizedException('Ungültiger Token-Typ');
    }
    return payload;
  }

  /** Disables MFA for the user. */
  async disableMfa(userId: string, password: string): Promise<{ disabled: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Falsches Passwort');

    await this.userRepo.update(userId, { mfaEnabled: false, mfaTotpSecret: null });
    await this.loggingService.logSecurity('MFA_DISABLED', 'MFA wurde deaktiviert', { userId });
    return { disabled: true };
  }

  private async issueTokens(user: User, context?: { ipAddress?: string; userAgent?: string }) {
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

    await this.loggingService.logUserLogin(user, context);

    const refreshToken = await this.jwtService.signAsync(refreshPayload, { expiresIn: refreshExpiresIn });

    // Refresh-Token in Datenbank persistieren (SEC-002)
    try {
      await this.refreshTokenRepo.save({
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.parseExpiryToDate(refreshExpiresIn),
        revokedAt: null,
        isRevoked: false,
      });
    } catch (err: any) {
      if (err?.code !== "ER_DUP_ENTRY") throw err;
    }

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

      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName,
        branchId: user.branchId ?? null,
        locationIds: user.locations?.map(l => l.id) ?? [],
      };

      // Kein Token-Rotation: gleicher Refresh-Token bleibt gültig bis zu seinem natürlichen Ablauf.
      // Rotation wurde entfernt weil Firefox Set-Cookie-Antworten nicht zuverlässig speichert,
      // was nach jedem Refresh zu einem stale/revoked Cookie und damit Logout-Loops führte.
      // Explizite Revocation beim Logout bleibt erhalten (SEC-002 DB-Validierung aktiv).
      return {
        accessToken: await this.jwtService.signAsync(payload),
        refreshToken,
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
      await this.loggingService.logUserLogout(stored.userId).catch(() => undefined);
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
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token gültig für 1 Stunde

    // Speichere nur den Hash in der DB (SEC-002: kein Klartext-Token persistieren)
    const passwordResetToken = this.passwordResetTokenRepository.create({
      token: tokenHash,
      userId: user.id,
      expiresAt,
      requestedFromIp: this.anonymizeIpAddress(context?.ipAddress),
    });
    await this.passwordResetTokenRepository.save(passwordResetToken);

    // Sende rawToken per E-Mail (nicht den Hash)
    await this.emailService.sendPasswordResetEmail(user.email!, user.displayName, rawToken);

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
    // Finde Token – lookup über Hash (SEC-002: kein Klartext in DB)
    const tokenHash = this.hashToken(token);
    const passwordResetToken = await this.passwordResetTokenRepository.findOne({
      where: { token: tokenHash, used: false },
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
    // SEC-001: Alle aktiven Refresh-Tokens nach Passwortaenderung invalidieren
    await this.refreshTokenRepo.update({ userId: passwordResetToken.user.id, isRevoked: false }, { isRevoked: true, revokedAt: new Date() });

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
    // SEC-001: Alle aktiven Refresh-Tokens nach Passwortaenderung invalidieren
    await this.refreshTokenRepo.update({ userId: user.id, isRevoked: false }, { isRevoked: true, revokedAt: new Date() });

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
      mfaEnabled: user.mfaEnabled ?? false,
    };
  }
}
