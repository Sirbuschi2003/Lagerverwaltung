import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggingService } from './logging.service';
import { LogCategory } from '../entities/system-log.entity';

@Injectable()
export class LoggingCleanupService implements OnModuleInit, OnModuleDestroy {
  private firstTimeout: NodeJS.Timeout | null = null;
  private dailyInterval: NodeJS.Timeout | null = null;

  constructor(private readonly loggingService: LoggingService) {}

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
      const days = await this.loggingService.getLogRetentionDays();
      const deleted = await this.loggingService.cleanupOldLogs(days);
      await this.loggingService.logInfo(
        LogCategory.SYSTEM,
        'AUTO_LOG_CLEANUP_COMPLETED',
        `Automatische Log-Bereinigung abgeschlossen. Gelöscht: ${deleted} (Aufbewahrung: ${days} Tage)`,
      );
    } catch (err: any) {
      await this.loggingService.logError(
        LogCategory.SYSTEM,
        'AUTO_LOG_CLEANUP_FAILED',
        `Automatische Log-Bereinigung fehlgeschlagen: ${err?.message || err}`,
      );
    }
  }
}
