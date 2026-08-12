import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

import { SystemLog } from '../entities/system-log.entity';
import { LoggingService } from './logging.service';

export interface ArchiveEntry {
  date: string;
  category: string;
  entryCount: number;
  size: number;
}

@Injectable()
export class LogArchiveService {
  private readonly archiveDir: string;

  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
    private readonly loggingService: LoggingService,
  ) {
    this.archiveDir = process.env.LOG_ARCHIVE_PATH || path.join(process.cwd(), 'log-archives');
    fs.mkdirSync(this.archiveDir, { recursive: true });
  }

  /** Sanitize to prevent path traversal */
  private safe(value: string, pattern: RegExp): string {
    if (!pattern.test(value)) throw new NotFoundException('Ungültiger Parameter');
    return value;
  }

  async archiveLogs(date: string): Promise<{ byCategory: Record<string, number> }> {
    this.safe(date, /^\d{4}-\d{2}-\d{2}$/);

    // Interpret date as local midnight to match stored timestamps
    const start = new Date(`${date}T00:00:00.000Z`);
    const end   = new Date(`${date}T23:59:59.999Z`);

    const logs = await this.logRepo.find({
      where: { createdAt: Between(start, end) },
      relations: ['user'],
    });

    if (logs.length === 0) return { byCategory: {} };

    const byCat: Record<string, SystemLog[]> = {};
    for (const log of logs) {
      (byCat[log.category] ??= []).push(log);
    }

    const dateDir = path.join(this.archiveDir, date);
    fs.mkdirSync(dateDir, { recursive: true });

    const result: Record<string, number> = {};
    for (const [category, entries] of Object.entries(byCat)) {
      const filePath = path.join(dateDir, `${category}.json`);
      const serialized = entries.map(log => ({
        id: log.id,
        timestamp: log.createdAt?.toISOString(),
        level: log.level,
        category: log.category,
        action: log.action,
        details: log.details,
        metadata: log.metadata,
        userId: log.userId,
        // username, ipAddress und userAgent werden nicht archiviert (DSGVO: Datensparsamkeit)
      }));
      fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
      result[category] = entries.length;
    }

    await this.logRepo
      .createQueryBuilder()
      .delete()
      .whereInIds(logs.map(l => l.id))
      .execute();

    return { byCategory: result };
  }

  listArchives(): ArchiveEntry[] {
    if (!fs.existsSync(this.archiveDir)) return [];

    const result: ArchiveEntry[] = [];
    const dateDirs = fs.readdirSync(this.archiveDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));

    for (const dateDir of dateDirs) {
      const datePath = path.join(this.archiveDir, dateDir);
      if (!fs.statSync(datePath).isDirectory()) continue;

      for (const file of fs.readdirSync(datePath).filter(f => f.endsWith('.json'))) {
        const filePath = path.join(datePath, file);
        const size = fs.statSync(filePath).size;
        let entryCount = 0;
        try {
          const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          entryCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch { /* corrupted file – still list it */ }

        result.push({ date: dateDir, category: file.replace('.json', ''), entryCount, size });
      }
    }

    return result;
  }

  async getStats() {
    const archives = this.listArchives();
    const retentionDays = await this.loggingService.getLogRetentionDays();

    const byCategory: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;
    const dates = [...new Set(archives.map(a => a.date))].sort();

    for (const a of archives) {
      const cat = (byCategory[a.category] ??= { count: 0, size: 0 });
      cat.count += a.entryCount;
      cat.size  += a.size;
      totalSize += a.size;
    }

    return {
      totalArchives: dates.length,
      oldestDate:    dates[0]                    ?? null,
      newestDate:    dates[dates.length - 1]     ?? null,
      totalSize,
      byCategory,
      retentionDays,
    };
  }

  readArchiveFile(date: string, category: string): Buffer {
    this.safe(date,     /^\d{4}-\d{2}-\d{2}$/);
    this.safe(category, /^[A-Z_]+$/);

    const filePath = path.join(this.archiveDir, date, `${category}.json`);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Archiv-Datei nicht gefunden');
    return fs.readFileSync(filePath);
  }

  buildBundle(dates: string[]): Buffer {
    const all: Record<string, unknown[]> = {};

    for (const date of dates) {
      this.safe(date, /^\d{4}-\d{2}-\d{2}$/);
      const datePath = path.join(this.archiveDir, date);
      if (!fs.existsSync(datePath)) continue;

      for (const file of fs.readdirSync(datePath).filter(f => f.endsWith('.json'))) {
        const key = `${date}/${file.replace('.json', '')}`;
        try {
          all[key] = JSON.parse(fs.readFileSync(path.join(datePath, file), 'utf-8'));
        } catch { all[key] = []; }
      }
    }

    return Buffer.from(JSON.stringify(all, null, 2), 'utf-8');
  }

  /** Read and merge all category files for a single date */
  readArchiveDay(date: string): unknown[] {
    this.safe(date, /^\d{4}-\d{2}-\d{2}$/);

    const datePath = path.join(this.archiveDir, date);
    if (!fs.existsSync(datePath)) throw new NotFoundException('Kein Archiv für dieses Datum');

    const all: unknown[] = [];
    for (const file of fs.readdirSync(datePath).filter(f => f.endsWith('.json'))) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(datePath, file), 'utf-8'));
        if (Array.isArray(parsed)) all.push(...parsed);
      } catch { /* skip corrupted file */ }
    }

    // Sort descending by timestamp
    (all as any[]).sort((a, b) =>
      new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
    );
    return all;
  }

  /** Delete the archive directory for a given date */
  deleteArchiveDay(date: string): void {
    this.safe(date, /^\d{4}-\d{2}-\d{2}$/);
    const datePath = path.join(this.archiveDir, date);
    if (!fs.existsSync(datePath)) throw new NotFoundException('Kein Archiv für dieses Datum');
    fs.rmSync(datePath, { recursive: true, force: true });
  }

  /** Returns all distinct past dates (before today) that still have logs in the DB */
  async getPastDatesInDb(): Promise<string[]> {
    const rows: { date: string }[] = await this.logRepo.query(
      `SELECT DISTINCT DATE(createdAt) AS \`date\` FROM system_logs WHERE DATE(createdAt) < CURDATE() ORDER BY \`date\``,
    );
    return rows.map(r => r.date);
  }

  /** Delete archive directories older than retentionDays. Returns count of removed dirs. */
  cleanupOldArchives(retentionDays: number): number {
    if (!fs.existsSync(this.archiveDir)) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    let removed = 0;
    const dateDirs = fs.readdirSync(this.archiveDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    for (const dir of dateDirs) {
      if (dir < cutoffStr) {
        fs.rmSync(path.join(this.archiveDir, dir), { recursive: true, force: true });
        removed++;
      }
    }
    return removed;
  }

  async setRetention(days: number): Promise<void> {
    await this.loggingService.setLogRetentionDays(days);
  }
}
