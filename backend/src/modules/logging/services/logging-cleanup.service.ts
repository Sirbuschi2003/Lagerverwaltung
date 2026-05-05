import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { LogArchiveService } from './log-archive.service';
import { LogCategory } from '../entities/system-log.entity';

@Injectable()
export class LoggingCleanupService implements OnModuleInit, OnModuleDestroy {
  private firstTimeout: NodeJS.Timeout | null = null;
  private dailyInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly loggingService: LoggingService,
    private readonly archiveService: LogArchiveService,
  ) {}

  async onModuleInit() {
    try {
      // Plane den ersten Lauf für die nächste 03:00 Uhr Serverzeit
      const next = this.getNextRunTime('03:00');
      const delay = next.getTime() - Date.now();

      // Sicherheitsgrenze: falls Delay negativ/unplausibel, fallback auf 1 Minute
      const safeDelay = delay > 0 ? delay : 60 * 1000;

      // Info-Log
      await this.loggingService.logInfo(
        LogCategory.SYSTEM,
        'AUTO_LOG_CLEANUP_SCHEDULED',
        `Nächste automatische Log-Bereinigung geplant für ${next.toISOString()}`,
      );

      this.firstTimeout = setTimeout(async () => {
        await this.runCleanupOnce();
        // Danach täglich wiederholen (24h)
        this.dailyInterval = setInterval(async () => {
          await this.runCleanupOnce();
        }, 24 * 60 * 60 * 1000);
      }, safeDelay);
    } catch (err: any) {
      await this.loggingService.logError(
        LogCategory.SYSTEM,
        'AUTO_LOG_CLEANUP_INIT_FAILED',
        `Fehler beim Planen der automatischen Log-Bereinigung: ${err?.message || err}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.firstTimeout) {
      clearTimeout(this.firstTimeout);
      this.firstTimeout = null;
    }
    if (this.dailyInterval) {
      clearInterval(this.dailyInterval as any);
      this.dailyInterval = null;
    }
  }

  private getNextRunTime(time: string): Date {
    const [hh, mm] = time.split(':').map((v) => parseInt(v, 10));
    const now = new Date();
    const next = new Date();
    next.setHours(hh, mm, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private async runCleanupOnce(): Promise<void> {
    try {
      const retentionDays = await this.loggingService.getLogRetentionDays();

      // 1. Archive all past days still in DB (move to files, remove from DB)
      const pastDates = await this.archiveService.getPastDatesInDb();
      let totalArchived = 0;
      for (const date of pastDates) {
        const result = await this.archiveService.archiveLogs(date);
        totalArchived += Object.values(result.byCategory).reduce((s, n) => s + n, 0);
      }

      // 2. Remove archive files older than retentionDays
      const removedDirs = this.archiveService.cleanupOldArchives(retentionDays);

      // 3. Safety-net: delete any remaining old logs that slipped through
      const deleted = await this.loggingService.cleanupOldLogs(retentionDays);

      await this.loggingService.logInfo(
        LogCategory.SYSTEM,
        'AUTO_LOG_CLEANUP_COMPLETED',
        `Tägliche Log-Archivierung: ${pastDates.length} Tage archiviert (${totalArchived} Einträge), ${removedDirs} alte Archive entfernt, ${deleted} Reste bereinigt (Aufbewahrung: ${retentionDays} Tage)`,
      );
    } catch (err: any) {
      await this.loggingService.logError(
        LogCategory.SYSTEM,
        'AUTO_LOG_CLEANUP_FAILED',
        `Tägliche Log-Archivierung fehlgeschlagen: ${err?.message || err}`,
      );
    }
  }
}
