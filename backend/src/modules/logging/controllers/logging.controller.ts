import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { LogLevel, LogCategory } from '../entities/system-log.entity';
import { LoggingService, LogFilters } from '../services/logging.service';

@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoggingController {
  constructor(private readonly loggingService: LoggingService) {}

  /** Wirft 403 wenn der eingeloggte Benutzer kein Super-Admin ist (branchId = null) */
  private requireSuperAdmin(req: Request): void {
    const user = (req as any).user;
    if (user?.branchId !== null && user?.branchId !== undefined) {
      throw new ForbiddenException('Systemprotokolle sind nur für Super-Admins zugänglich');
    }
  }

  /**
   * Frontend-Logs empfangen (von allen authentifizierten Usern)
   */
  @Post('frontend')
  async receiveFrontendLogs(
    @Body() logs: Array<{
      timestamp: string;
      level: string;
      category: string;
      message: string;
      url?: string;
      details?: any;
    }>,
    @Req() req: Request,
  ) {
    try {
      // Validierung
      if (!Array.isArray(logs) || logs.length === 0) {
        throw new BadRequestException('Logs-Array erforderlich');
      }

      if (logs.length > 100) {
        throw new BadRequestException('Maximal 100 Logs pro Request');
      }

      // User aus Request extrahieren
      const user = (req as any).user;
      const userId = user?.id;

      // Logs in Datenbank schreiben
      for (const log of logs) {
        // Level mapping: frontend 'debug/info/warn/error' -> backend 'DEBUG/INFO/WARNING/ERROR'
        let level: LogLevel;
        switch (log.level?.toLowerCase()) {
          case 'debug': level = LogLevel.DEBUG; break;
          case 'info': level = LogLevel.INFO; break;
          case 'warn': level = LogLevel.WARNING; break;
          case 'error': level = LogLevel.ERROR; break;
          default: level = LogLevel.INFO;
        }

        // Category mapping
        let category: LogCategory;
        switch (log.category?.toLowerCase()) {
          case 'auth': category = LogCategory.AUTH; break;
          case 'stock': category = LogCategory.STOCK; break;
          case 'vehicle': category = LogCategory.VEHICLE; break;
          case 'restock': category = LogCategory.RESTOCK; break;
          case 'user': category = LogCategory.USER; break;
          default: category = LogCategory.SYSTEM;
        }

        await this.loggingService.log(
          level,
          category,
          log.message || 'Frontend-Log',
          log.url || undefined,
          {
            userId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
              ...(log.details || {}),
              source: 'FRONTEND',
              url: log.url || undefined,
            },
          }
        );
      }

      return { success: true, count: logs.length };
    } catch (error: any) {
      console.error('[LoggingController] Fehler beim Empfangen von Frontend-Logs:', error);
      throw error;
    }
  }

  /**
   * Logs abrufen (nur für Admins)
   */
  @Get()
  @Roles('MANAGER')
  async getLogs(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('category') category?: LogCategory,
    @Query('level') level?: LogLevel,
    @Query('action') action?: string,
    @Query('limit') limit = '1000',
    @Query('offset') offset = '0',
  ) {
    this.requireSuperAdmin(req);
    const filters: LogFilters = {};

    // Datum-Filter
    if (startDate) {
      filters.startDate = new Date(startDate);
      if (isNaN(filters.startDate.getTime())) {
        throw new BadRequestException('Ungültiges Startdatum');
      }
    }
    if (endDate) {
      filters.endDate = new Date(endDate);
      if (isNaN(filters.endDate.getTime())) {
        throw new BadRequestException('Ungültiges Enddatum');
      }
    }

    // Weitere Filter
    if (userId) filters.userId = userId;
    if (category) filters.category = category;
    if (level) filters.level = level;
    if (action) filters.action = action;

    // Niederlassungs-Filter: Branch-Manager sieht nur eigene Logs
    const reqUser = (req as any).user;
    if (reqUser?.branchId) filters.branchId = reqUser.branchId;

    const limitNum = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 10000) {
      throw new BadRequestException('Limit muss zwischen 1 und 10000 liegen');
    }
    if (isNaN(offsetNum) || offsetNum < 0) {
      throw new BadRequestException('Offset muss >= 0 sein');
    }

  const result = await this.loggingService.getLogs(filters, limitNum, offsetNum);

    if (reqUser) {
      await this.loggingService.logSecurity(
        'ADMIN_LOGS_ACCESS',
        `Admin ${reqUser.username} hat Logs abgerufen`,
        {
          userId: reqUser.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { filters, limit: limitNum, offset: offsetNum }
        }
      );
    }

    // Mappe auf API-DTO mit timestamp, username und source
    const mapped = result.logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt ? log.createdAt.toISOString() : null,
      level: log.level,
      category: log.category,
      action: log.action,
      details: log.details,
      userId: (log as any).userId || log.user?.id || undefined,
      username: log.user?.username || undefined,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata,
      source: (log.metadata && (log.metadata as any).source) ? (log.metadata as any).source : 'BACKEND',
    }));

    return { logs: mapped, total: result.total };
  }

  /**
   * Logs als CSV herunterladen (nur für Admins)
   */
  @Get('download/csv')
  @Roles('MANAGER')
  async downloadLogsCSV(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('category') category?: LogCategory,
    @Query('level') level?: LogLevel,
    @Query('action') action?: string,
    @Req() req?: any,
    @Res() res?: Response,
  ) {
    this.requireSuperAdmin(req);
    const filters: LogFilters = {};

    if (startDate) {
      filters.startDate = new Date(startDate);
      if (isNaN(filters.startDate.getTime())) {
        throw new BadRequestException('Ungültiges Startdatum');
      }
    }
    if (endDate) {
      filters.endDate = new Date(endDate);
      if (isNaN(filters.endDate.getTime())) {
        throw new BadRequestException('Ungültiges Enddatum');
      }
    }

    if (userId) filters.userId = userId;
    if (category) filters.category = category;
    if (level) filters.level = level;
    if (action) filters.action = action;
    if (req?.user?.branchId) filters.branchId = req.user.branchId;

    // Alle Logs ohne Limit für Export
    const { logs } = await this.loggingService.getLogs(filters, 50000, 0);

    // CSV-Header
    const csvHeaders = [
      'Zeitstempel',
      'Level',
      'Kategorie',
      'Aktion',
      'Details',
      'Benutzer-ID',
      'Benutzername',
      'IP-Adresse',
      'User-Agent',
      'Metadaten'
    ];

    // CSV-Daten erstellen
    const csvRows = logs.map(log => {
      const row = [
        log.createdAt.toISOString(),
        log.level,
        log.category,
        `"${(log.action || '').replace(/"/g, '""')}"`,
        `"${(log.details || '').replace(/"/g, '""')}"`,
        log.userId || '',
        log.user?.username || '',
        log.ipAddress || '',
        `"${(log.userAgent || '').replace(/"/g, '""')}"`,
        `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`,
      ];
      return row.join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Log den Download
    if (req?.user) {
      await this.loggingService.logSecurity(
        'ADMIN_LOGS_DOWNLOAD',
        `Admin ${req.user.username} hat ${logs.length} Logs als CSV heruntergeladen`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { filters, recordCount: logs.length }
        }
      );
    }

    // CSV-Response senden
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `system-logs-${timestamp}.csv`;

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf-8'));
      res.status(HttpStatus.OK);
      res.end(csvContent, 'utf-8');
    }

    return csvContent;
  }

  /**
   * Logs als JSON herunterladen (nur für Admins)
   */
  @Get('download/json')
  @Roles('MANAGER')
  async downloadLogsJSON(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('userId') userId?: string,
    @Query('category') category?: LogCategory,
    @Query('level') level?: LogLevel,
    @Query('action') action?: string,
    @Req() req?: any,
    @Res() res?: Response,
  ) {
    this.requireSuperAdmin(req);
    const filters: LogFilters = {};

    if (startDate) {
      filters.startDate = new Date(startDate);
      if (isNaN(filters.startDate.getTime())) {
        throw new BadRequestException('Ungültiges Startdatum');
      }
    }
    if (endDate) {
      filters.endDate = new Date(endDate);
      if (isNaN(filters.endDate.getTime())) {
        throw new BadRequestException('Ungültiges Enddatum');
      }
    }

    if (userId) filters.userId = userId;
    if (category) filters.category = category;
    if (level) filters.level = level;
    if (action) filters.action = action;
    if (req?.user?.branchId) filters.branchId = req.user.branchId;

    const { logs } = await this.loggingService.getLogs(filters, 50000, 0);

    // Log den Download
    if (req?.user) {
      await this.loggingService.logSecurity(
        'ADMIN_LOGS_DOWNLOAD',
        `Admin ${req.user.username} hat ${logs.length} Logs als JSON heruntergeladen`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { filters, recordCount: logs.length }
        }
      );
    }

    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      filters,
      totalRecords: logs.length,
      logs: logs.map(log => ({
        id: log.id,
        timestamp: log.createdAt.toISOString(),
        level: log.level,
        category: log.category,
        action: log.action,
        details: log.details,
        userId: log.userId,
        username: log.user?.username,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata,
      }))
    }, null, 2);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `system-logs-${timestamp}.json`;

    if (res) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(jsonContent, 'utf-8'));
      res.status(HttpStatus.OK);
      res.end(jsonContent, 'utf-8');
    }

    return JSON.parse(jsonContent);
  }

  /**
   * Log-Statistiken abrufen (nur für Admins)
   */
  @Get('stats')
  @Roles('MANAGER')
  async getLogStats(@Req() req?: any) {
    this.requireSuperAdmin(req);
    // Grundlegende Statistiken für die letzten 30 Tage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const filters: LogFilters = {
      startDate: thirtyDaysAgo,
      endDate: new Date()
    };

    const { logs, total } = await this.loggingService.getLogs(filters, 10000, 0);

    // Statistiken berechnen
    const stats = {
      totalLogs: total,
      period: '30 days',
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      recentErrors: logs.filter(log => log.level === LogLevel.ERROR).slice(0, 10),
      recentSecurity: logs.filter(log => log.level === LogLevel.SECURITY).slice(0, 10),
    };

    // Zählungen
    logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      if (log.user?.username) {
        stats.byUser[log.user.username] = (stats.byUser[log.user.username] || 0) + 1;
      }
    });

    // Log den Statistik-Zugriff
    if (req?.user) {
      await this.loggingService.logSecurity(
        'ADMIN_STATS_ACCESS',
        `Admin ${req.user.username} hat Log-Statistiken abgerufen`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        }
      );
    }

    return stats;
  }

  /**
   * Log-Level Konfiguration abrufen (nur für Manager)
   */
  @Get('config/level')
  @Roles('MANAGER')
  async getLogLevel() {
    const level = await this.loggingService.getLogLevel();
    return { logLevel: level };
  }

  /**
   * Log-Level Konfiguration setzen (nur für Manager)
   */
  @Put('config/level')
  @Roles('MANAGER')
  async setLogLevel(@Body() body: { logLevel: LogLevel }, @Req() req?: any) {
    this.requireSuperAdmin(req);
    if (!Object.values(LogLevel).includes(body.logLevel)) {
      throw new BadRequestException('Ungültiger Log-Level');
    }

    await this.loggingService.setLogLevel(body.logLevel);

    // Log die Konfigurationsänderung
    if (req?.user) {
      await this.loggingService.logSecurity(
        'LOG_LEVEL_CHANGED',
        `Log-Level geändert zu: ${body.logLevel}`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { newLogLevel: body.logLevel }
        }
      );
    }

    return { success: true, logLevel: body.logLevel };
  }

  /**
   * Alte Logs bereinigen (nur für Manager)
   */
  @Post('cleanup/old')
  @Roles('MANAGER')
  async cleanupOldLogs(@Body() body: { daysToKeep?: number }, @Req() req?: any) {
    this.requireSuperAdmin(req);
    const daysToKeep = body.daysToKeep || 90;
    
    if (daysToKeep < 1 || daysToKeep > 365) {
      throw new BadRequestException('daysToKeep muss zwischen 1 und 365 liegen');
    }

    const deleted = await this.loggingService.cleanupOldLogs(daysToKeep);

    // Log die Bereinigung
    if (req?.user) {
      await this.loggingService.logSecurity(
        'LOGS_CLEANUP',
        `Admin ${req.user.username} hat ${deleted} alte Logs gelöscht (>${daysToKeep} Tage)`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { daysToKeep, deletedCount: deleted }
        }
      );
    }

    return { success: true, deletedCount: deleted, daysToKeep };
  }

  /**
   * Ungültige Logs bereinigen (nur für Manager)
   */
  @Post('cleanup/invalid')
  @Roles('MANAGER')
  async cleanupInvalidLogs(@Req() req?: any) {
    this.requireSuperAdmin(req);
    const deleted = await this.loggingService.cleanupInvalidLogs();

    // Log die Bereinigung
    if (req?.user) {
      await this.loggingService.logSecurity(
        'LOGS_CLEANUP_INVALID',
        `Admin ${req.user.username} hat ${deleted} ungültige Logs gelöscht`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { deletedCount: deleted }
        }
      );
    }

    return { success: true, deletedCount: deleted, message: 'Ungültige Logs gelöscht' };
  }

  /**
   * ALLE Logs löschen (nur für Manager - mit Warnung!)
   */
  @Post('cleanup/all')
  @Roles('MANAGER')
  async deleteAllLogs(@Req() req?: any) {
    this.requireSuperAdmin(req);
    const deleted = await this.loggingService.deleteAllLogs();

    // Log die vollständige Löschung (nach der Löschung wird dieser Eintrag auch gelöscht)
    if (req?.user) {
      await this.loggingService.logSecurity(
        'LOGS_DELETED_ALL',
        `Admin ${req.user.username} hat ALLE ${deleted} Logs gelöscht`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { deletedCount: deleted }
        }
      );
    }

    return { success: true, deletedCount: deleted, message: 'Alle Logs wurden gelöscht' };
  }

  /**
   * Log-Aufbewahrungsdauer abrufen (nur für Manager)
   */
  @Get('config/retention')
  @Roles('MANAGER')
  async getLogRetention() {
    const days = await this.loggingService.getLogRetentionDays();
    return { retentionDays: days };
  }

  /**
   * Log-Aufbewahrungsdauer setzen (nur für Manager)
   */
  @Put('config/retention')
  @Roles('MANAGER')
  async setLogRetention(@Body() body: { retentionDays: number }, @Req() req?: any) {
    this.requireSuperAdmin(req);
    const days = body.retentionDays;
    
    if (!days || isNaN(days) || days < 1 || days > 3650) {
      throw new BadRequestException('Aufbewahrungsdauer muss zwischen 1 und 3650 Tagen liegen');
    }

    await this.loggingService.setLogRetentionDays(days);

    // Log die Konfigurationsänderung
    if (req?.user) {
      await this.loggingService.logSecurity(
        'LOG_RETENTION_CHANGED',
        `Log-Aufbewahrungsdauer geändert auf ${days} Tage`,
        {
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: { retentionDays: days }
        }
      );
    }

    return { success: true, retentionDays: days };
  }
}