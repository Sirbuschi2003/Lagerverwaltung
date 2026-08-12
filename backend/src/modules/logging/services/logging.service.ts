import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { BranchConfig } from '../entities/branch-config.entity';
import { SystemConfig } from '../entities/system-config.entity';
import { SystemLog, LogLevel, LogCategory } from '../entities/system-log.entity';

export interface LogContext {
  userId?: string;
  user?: User;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export interface LogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  category?: LogCategory;
  level?: LogLevel;
  action?: string;
  branchId?: string | null;
}

@Injectable()
export class LoggingService {
  private cachedLogLevel: string | null = null;
  private logLevelCacheExpiry: number = 0;

  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepository: Repository<SystemLog>,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    @InjectRepository(BranchConfig)
    private readonly branchConfigRepository: Repository<BranchConfig>,
  ) {}

  /**
   * Protokolliert ein Ereignis (mit Log-Level Filterung)
   */
  async log(
    level: LogLevel,
    category: LogCategory,
    action: string,
    details?: string,
    context?: LogContext,
  ): Promise<void> {
    try {
      // Log-Level Filterung
      const minimumLevel = await this.getMinimumLogLevel();
      if (!this.shouldLog(level, minimumLevel)) {
        return;
      }

      const logEntry = this.logRepository.create({
        level,
        category,
        action,
        details,
        userId: context?.userId,
        ipAddress: context?.ipAddress,
        // DSGVO-Datensparsamkeit: Nur Browser-Familie speichern, nicht den vollständigen UserAgent-String
        userAgent: context?.userAgent ? this.extractBrowserFamily(context.userAgent) : undefined,
        // Sensible Metadaten-Schlüssel vor Speicherung entfernen
        metadata: context?.metadata ? this.sanitizeMetadata(context.metadata) : undefined,
      });

      await this.logRepository.save(logEntry);
    } catch (error) {
      // Logging-Fehler nicht weiterwerfen, um Hauptfunktionalität nicht zu beeinträchtigen
    }
  }

  /**
   * Debug-Level Logging (nur in Entwicklung)
   */
  async logDebug(
    category: LogCategory,
    action: string,
    details?: string,
    context?: LogContext,
  ): Promise<void> {
    return this.log(LogLevel.DEBUG, category, action, details, context);
  }

  /**
   * Info-Level Logging
   */
  async logInfo(
    category: LogCategory,
    action: string,
    details?: string,
    context?: LogContext,
  ): Promise<void> {
    return this.log(LogLevel.INFO, category, action, details, context);
  }

  /**
   * Warning-Level Logging
   */
  async logWarning(
    category: LogCategory,
    action: string,
    details?: string,
    context?: LogContext,
  ): Promise<void> {
    return this.log(LogLevel.WARNING, category, action, details, context);
  }

  /**
   * Error-Level Logging
   */
  async logError(
    category: LogCategory,
    action: string,
    details?: string,
    context?: LogContext,
  ): Promise<void> {
    return this.log(LogLevel.ERROR, category, action, details, context);
  }

  /**
   * Security-Level Logging
   */
  async logSecurity(
    action: string,
    details?: string,
    context?: LogContext,
  ): Promise<void> {
    return this.log(LogLevel.SECURITY, LogCategory.AUTH, action, details, context);
  }

  /**
   * Ruft Logs basierend auf Filtern ab
   */
  async getLogs(filters: LogFilters = {}, limit = 1000, offset = 0): Promise<{
    logs: SystemLog[];
    total: number;
  }> {
    const queryBuilder = this.logRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    // Filter anwenden
    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters.userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId: filters.userId });
    }

    if (filters.category) {
      queryBuilder.andWhere('log.category = :category', { category: filters.category });
    }

    if (filters.level) {
      queryBuilder.andWhere('log.level = :level', { level: filters.level });
    }

    if (filters.action) {
      queryBuilder.andWhere('log.action LIKE :action', { action: `%${filters.action}%` });
    }

    // Niederlassungs-Filter: nur Logs von Usern dieser Niederlassung (branchId null = Super-Admin, sieht alles)
    if (filters.branchId) {
      queryBuilder.andWhere('(user.branchId = :branchId OR log.userId IS NULL)', { branchId: filters.branchId });
    }

    const [logs, total] = await queryBuilder.getManyAndCount();
    return { logs, total };
  }

  /**
   * Bereinigt alte Logs (älter als angegebene Tage)
   */
  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.logRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  /**
   * Löscht ALLE Logs (für Admin-Funktion)
   */
  async deleteAllLogs(): Promise<number> {
    await this.logSecurity("LOGS_DELETED", "Alle System-Logs wurden geloescht", { metadata: { deletedAt: new Date().toISOString() } });

    const result = await this.logRepository
      .createQueryBuilder()
      .delete()
      .execute();

    return result.affected || 0;
  }

  /**
   * Holt die Log-Aufbewahrungsdauer aus der Konfiguration
   */
  async getLogRetentionDays(): Promise<number> {
    try {
      const config = await this.configRepository.findOne({ 
        where: { key: 'log.retentionDays' } 
      });
      if (config && config.value) {
        const days = parseInt(config.value, 10);
        return isNaN(days) ? 90 : days;
      }
    } catch (error) {
    }
    return 90; // Standard: 90 Tage
  }

  /**
   * Setzt die Log-Aufbewahrungsdauer in der Konfiguration
   */
  async setLogRetentionDays(days: number): Promise<void> {
    if (days < 1 || days > 3650) { // Max 10 Jahre
      throw new Error('Aufbewahrungsdauer muss zwischen 1 und 3650 Tagen liegen');
    }
    await this.setConfig('log.retentionDays', days.toString(), 'Anzahl der Tage, die Logs aufbewahrt werden sollen');
  }

  /**
   * Löscht Logs mit ungültigen Timestamps (NULL oder Invalid Date)
   */
  async cleanupInvalidLogs(): Promise<number> {
    const result = await this.logRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt IS NULL')
      .orWhere('createdAt < :minDate', { minDate: new Date('2000-01-01') })
      .execute();

    return result.affected || 0;
  }

  /**
   * Hilfsmethoden für spezifische Log-Typen
   */
  
  async logUserLogin(user: User, context?: LogContext): Promise<void> {
    return this.logInfo(
      LogCategory.AUTH,
      'USER_LOGIN',
      `Benutzer ${user.username} hat sich angemeldet`,
      { ...context, userId: user.id, metadata: { username: user.username, role: user.role } }
    );
  }

  async logUserLogout(user: User, context?: LogContext): Promise<void> {
    return this.logInfo(
      LogCategory.AUTH,
      'USER_LOGOUT',
      `Benutzer ${user.username} hat sich abgemeldet`,
      { ...context, userId: user.id, metadata: { username: user.username } }
    );
  }

  async logStockMovement(
    user: User,
    action: string,
    itemId: string,
    quantity: number,
    context?: LogContext
  ): Promise<void> {
    // Nutze itemCode und itemDescription aus metadata falls vorhanden
    const itemCode = context?.metadata?.itemCode || itemId;
    const itemDescription = context?.metadata?.itemDescription;
    const itemDisplay = itemDescription 
      ? `${itemCode} (${itemDescription})` 
      : itemCode;
    
    return this.logInfo(
      LogCategory.STOCK,
      'STOCK_MOVEMENT',
      `${action}: ${quantity} Einheiten von Artikel ${itemDisplay}`,
      { 
        ...context, 
        userId: user.id, 
        metadata: { 
          itemId, 
          quantity, 
          action,
          username: user.username,
          ...(context?.metadata || {})
        } 
      }
    );
  }

  async logVehicleChange(user: User, vehicleId: string, context?: LogContext): Promise<void> {
    return this.logInfo(
      LogCategory.VEHICLE,
      'VEHICLE_CHANGE',
      `Benutzer ${user.username} hat zu Fahrzeug ${vehicleId} gewechselt`,
      { 
        ...context, 
        userId: user.id, 
        metadata: { 
          vehicleId, 
          username: user.username 
        } 
      }
    );
  }

  async logRestockRequest(
    user: User,
    action: string,
    requestId: string, // UUID statt number
    context?: LogContext
  ): Promise<void> {
    // Verwende die ersten 8 Zeichen der UUID für die Anzeige
    const displayId = requestId ? requestId.substring(0, 8) : 'unknown';
    return this.logInfo(
      LogCategory.RESTOCK,
      'RESTOCK_REQUEST',
      `${action}: Nachschub-Anfrage ${displayId}`,
      { 
        ...context, 
        userId: user.id, 
        metadata: { 
          requestId, 
          action,
          username: user.username 
        } 
      }
    );
  }

  async logPasswordChange(user: User, context?: LogContext): Promise<void> {
    return this.logSecurity(
      'PASSWORD_CHANGE',
      `Benutzer ${user.username} hat sein Passwort geändert`,
      { 
        ...context, 
        userId: user.id, 
        metadata: { 
          username: user.username 
        } 
      }
    );
  }

  async logSecurityEvent(
    action: string,
    details: string,
    context?: LogContext
  ): Promise<void> {
    return this.logSecurity(action, details, context);
  }

  /**
   * Log-Level Konfiguration
   */
  private async getMinimumLogLevel(): Promise<LogLevel> {
    if (this.cachedLogLevel !== null && Date.now() < this.logLevelCacheExpiry) {
      return this.cachedLogLevel as LogLevel;
    }
    try {
      const config = await this.configRepository.findOne({ where: { key: 'log.minimumLevel' } });
      if (config && config.value) {
        const result = config.value as LogLevel;
        this.cachedLogLevel = result;
        this.logLevelCacheExpiry = Date.now() + 60000;
        return result;
      }
    } catch (error) {
      // Fehler stillschweigend ignorieren, Standard-Level zurückgeben
    }
    const defaultLevel = LogLevel.INFO;
    this.cachedLogLevel = defaultLevel;
    this.logLevelCacheExpiry = Date.now() + 60000;
    return defaultLevel;
  }

  private shouldLog(level: LogLevel, minimumLevel: LogLevel): boolean {
    const levelHierarchy = {
      DEBUG: 0,
      INFO: 1,
      WARNING: 2,
      ERROR: 3,
      SECURITY: 4,
    };

    return levelHierarchy[level] >= levelHierarchy[minimumLevel];
  }

  /**
   * Konfiguration setzen
   */
  async setLogLevel(level: LogLevel): Promise<void> {
    this.cachedLogLevel = null;
    await this.setConfig('log.minimumLevel', level as unknown as string, 'Minimum Log-Level für System-Logs');
  }

  async getLogLevel(): Promise<LogLevel> {
    return this.getMinimumLogLevel();
  }

  /**
   * System-Konfiguration allgemein
   */
  async getConfig(key: string, branchId?: string | null): Promise<string | null> {
    try {
      if (branchId) {
        const branchRec = await this.branchConfigRepository.findOne({ where: { branchId, key } });
        if (branchRec) return branchRec.value ?? null;
      }
      const config = await this.configRepository.findOne({ where: { key } });
      return config?.value || null;
    } catch (error) {
      return null;
    }
  }

  async setConfig(key: string, value: string, description?: string, isSecret = false, branchId?: string | null): Promise<void> {
    if (branchId) {
      const existing = await this.branchConfigRepository.findOne({ where: { branchId, key } });
      if (existing) {
        existing.value = value;
        if (description !== undefined) existing.description = description;
        if (isSecret !== undefined) existing.isSecret = isSecret;
        await this.branchConfigRepository.save(existing);
      } else {
        await this.branchConfigRepository.insert({ branchId, key, value, description, isSecret });
      }
      return;
    }
    // Global (system_config)
    const existing = await this.configRepository.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      if (description !== undefined) existing.description = description;
      if (isSecret !== undefined) existing.isSecret = isSecret;
      await this.configRepository.save(existing);
    } else {
      await this.configRepository.save({ key, value, description, isSecret });
    }
  }

  /**
   * DSGVO-Datensparsamkeit: Extrahiert nur die Browser-Familie aus dem UserAgent.
   * Statt "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ..."
   * wird nur "Chrome/Windows" gespeichert.
   */
  private extractBrowserFamily(userAgent: string): string {
    if (!userAgent) return 'Unbekannt';
    const ua = userAgent.toLowerCase();
    let browser = 'Unbekannt';
    let os = 'Unbekannt';

    if (ua.includes('edg/')) browser = 'Edge';
    else if (ua.includes('chrome/')) browser = 'Chrome';
    else if (ua.includes('firefox/')) browser = 'Firefox';
    else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';

    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
    else if (ua.includes('mac')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';

    return `${browser}/${os}`;
  }

  /**
   * Entfernt potentiell sensible Schlüssel aus Metadaten vor der Speicherung.
   */
  private sanitizeMetadata(metadata: any): any {
    if (typeof metadata !== 'object' || metadata === null) return metadata;
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'hash', 'credential', 'email', 'to'];
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(metadata)) {
      if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
        sanitized[k] = '[ENTFERNT]';
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }
}