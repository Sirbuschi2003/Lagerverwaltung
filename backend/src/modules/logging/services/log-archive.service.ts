import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

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
  private readonly encryptionKey: Buffer | null;
  private readonly logger = new Logger(LogArchiveService.name);

  constructor(
    @InjectRepository(SystemLog)
    private readonly logRepo: Repository<SystemLog>,
    private readonly loggingService: LoggingService,
  ) {
    this.archiveDir = process.env.LOG_ARCHIVE_PATH || path.join(process.cwd(), 'log-archives');
    fs.mkdirSync(this.archiveDir, { recursive: true });

    const rawKey = process.env.LOG_ARCHIVE_ENCRYPTION_KEY;
    if (rawKey) {
      // Derive a fixed 32-byte AES-256 key from the passphrase
      this.encryptionKey = crypto.createHash('sha256').update(rawKey).digest();
      this.logger.log('Log-Archiv-Verschlüsselung aktiv (AES-256-GCM)');
    } else {
      this.encryptionKey = null;
    }
  }

  /** AES-256-GCM encrypt; stored as JSON envelope {enc,iv,tag,data} */
  private encrypt(plaintext: string): string {
    const key = this.encryptionKey!;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({ enc: true, iv: iv.toString('hex'), tag: tag.toString('hex'), data: encrypted.toString('hex') });
  }

  /** Decrypt an envelope produced by encrypt(); returns null when key is missing or content is plaintext */
  private tryDecrypt(raw: string): string | null {
    if (!this.encryptionKey) return null;
    try {
      const envelope = JSON.parse(raw) as { enc?: boolean; iv: string; tag: string; data: string };
      if (!envelope.enc) return null;
      const iv = Buffer.from(envelope.iv, 'hex');
      const tag = Buffer.from(envelope.tag, 'hex');
      const data = Buffer.from(envelope.data, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      return decipher.update(data).toString('utf-8') + decipher.final('utf-8');
    } catch {
      return null;
    }
  }

  /** Write an archive file, encrypting when a key is configured */
  private writeArchiveFile(filePath: string, content: string): void {
    const payload = this.encryptionKey ? this.encrypt(content) : content;
    fs.writeFileSync(filePath, payload, 'utf-8');
  }

  /** Read an archive file and decrypt if necessary; returns parsed JSON */
  private readAndParse(filePath: string): unknown[] {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const decrypted = this.tryDecrypt(raw);
    const json = decrypted ?? raw;
    try {
      const parsed: unknown = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
      this.writeArchiveFile(filePath, JSON.stringify(serialized, null, 2));
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
          entryCount = this.readAndParse(filePath).length;
        } catch { /* corrupted file – still list it */ }

        result.push({ date: dateDir, category: file.replace('.json', ''), entryCount, size });
      }
    }

    return result;
  }

  async getStats() {
    const archives = this.listArchives();
    const [logRetentionDays, archiveRetentionDays] = await Promise.all([
      this.loggingService.getLogRetentionDays(),
      this.loggingService.getArchiveRetentionDays(),
    ]);

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
      totalArchives:      dates.length,
      oldestDate:         dates[0]                ?? null,
      newestDate:         dates[dates.length - 1] ?? null,
      totalSize,
      byCategory,
      retentionDays:      logRetentionDays,
      archiveRetentionDays,
    };
  }

  readArchiveFile(date: string, category: string): Buffer {
    this.safe(date,     /^\d{4}-\d{2}-\d{2}$/);
    this.safe(category, /^[A-Z_]+$/);

    const filePath = path.join(this.archiveDir, date, `${category}.json`);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Archiv-Datei nicht gefunden');
    // Return plaintext (decrypted if necessary) so callers get readable JSON
    const entries = this.readAndParse(filePath);
    return Buffer.from(JSON.stringify(entries, null, 2), 'utf-8');
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
          all[key] = this.readAndParse(path.join(datePath, file));
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
        all.push(...this.readAndParse(path.join(datePath, file)));
      } catch { /* skip corrupted file */ }
    }

    // Sort descending by timestamp
    (all as Array<{ timestamp?: string | number }>).sort((a, b) =>
      new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime(),
    );
    return all;
  }

  /**
   * Durchsucht archivierte Tage innerhalb eines Datumsbereichs nach den
   * gleichen Kriterien wie die Live-Log-Suche (LoggingService.getLogs).
   * Liest/entschluesselt gezielt nur die passenden Kategorie-Dateien statt
   * ganzer Tage, damit eine eingegrenzte Suche (z.B. nur STOCK) nicht
   * unnoetig andere Kategorien mitliest.
   *
   * Begrenzt auf max. 400 Tage pro Aufruf (~13 Monate), um eine einzelne
   * Anfrage nicht über Jahre hinweg alle Archivdateien einlesen zu lassen -
   * bei Bedarf muss der Zeitraum eingegrenzt werden.
   */
  searchArchive(filters: {
    startDate: Date;
    endDate?: Date;
    category?: string;
    level?: string;
    action?: string;
    userId?: string;
  }): { entries: Array<Record<string, unknown>>; scannedDays: number; truncated: boolean } {
    const MAX_DAYS = 400;
    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    const end = filters.endDate ? new Date(filters.endDate) : new Date();
    end.setHours(0, 0, 0, 0);

    if (!fs.existsSync(this.archiveDir)) return { entries: [], scannedDays: 0, truncated: false };

    const allDateDirs = fs
      .readdirSync(this.archiveDir)
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .filter((d) => {
        const t = new Date(`${d}T00:00:00.000Z`).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .sort();

    const truncated = allDateDirs.length > MAX_DAYS;
    const dateDirs = truncated ? allDateDirs.slice(-MAX_DAYS) : allDateDirs;

    const results: Array<Record<string, unknown>> = [];
    for (const dateDir of dateDirs) {
      const datePath = path.join(this.archiveDir, dateDir);
      const files = fs.readdirSync(datePath).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const category = file.replace('.json', '');
        if (filters.category && category !== filters.category) continue;

        let entries: Array<Record<string, unknown>>;
        try {
          entries = this.readAndParse(path.join(datePath, file)) as Array<Record<string, unknown>>;
        } catch {
          continue;
        }

        for (const entry of entries) {
          if (filters.level && entry.level !== filters.level) continue;
          if (filters.userId && entry.userId !== filters.userId) continue;
          if (filters.action && !String(entry.action ?? '').toLowerCase().includes(filters.action.toLowerCase())) continue;
          results.push(entry);
        }
      }
    }

    results.sort((a, b) => new Date(String(b.timestamp ?? 0)).getTime() - new Date(String(a.timestamp ?? 0)).getTime());
    return { entries: results, scannedDays: dateDirs.length, truncated };
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
    // DATE_FORMAT statt DATE(): mysql2 liefert fuer DATE-Spalten/Ausdruecke
    // JS-Date-Objekte zurueck (nicht Strings), wodurch archiveLogs()'s
    // Regex-Validierung (erwartet "YYYY-MM-DD") fuer jedes Datum fehlschlug.
    const rows: { date: string }[] = await this.logRepo.query(
      `SELECT DISTINCT DATE_FORMAT(createdAt, '%Y-%m-%d') AS \`date\` FROM system_logs WHERE DATE(createdAt) < CURDATE() ORDER BY \`date\``,
    );
    return rows.map(r => r.date);
  }

  /**
   * Verschiebt taeglich automatisch Logs, die aelter als die konfigurierte
   * Aufbewahrungsfrist (log.retentionDays) sind, ins Archiv und raeumt
   * abgelaufene Archive auf. Ohne diesen Job blieb archiveLogs() ein rein
   * manueller Admin-Button, der in der Praxis nie geklickt wurde -
   * system_logs wuchs dadurch ungebremst (Vorfall 16.09.2026: 130k Zeilen,
   * ~75MB bei einer produktiv genutzten Installation).
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async archiveOldLogs(): Promise<void> {
    const retentionDays = await this.loggingService.getLogRetentionDays();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const pastDates = (await this.getPastDatesInDb()).filter((date) => date < cutoffStr);
    if (pastDates.length === 0) return;

    let totalArchived = 0;
    for (const date of pastDates) {
      const result = await this.archiveLogs(date);
      totalArchived += Object.values(result.byCategory).reduce((sum, n) => sum + n, 0);
    }

    const archiveRetentionDays = await this.loggingService.getArchiveRetentionDays();
    const removedOldArchiveDirs = this.cleanupOldArchives(archiveRetentionDays);

    this.logger.log(
      `Automatische Log-Archivierung: ${totalArchived} Logs aus ${pastDates.length} Tagen archiviert, ${removedOldArchiveDirs} alte Archive entfernt`,
    );
  }

  /** Delete archive directories older than retentionDays. Returns count of removed dirs. */
  cleanupOldArchives(retentionDays: number): number {
    // GoBD §147 AO: Mindest-Aufbewahrungsfrist 10 Jahre (3650 Tage)
    const MIN_RETENTION_DAYS = 3650;
    if (retentionDays < MIN_RETENTION_DAYS) {
      this.logger.warn(
        `Retention (${retentionDays} Tage) unterschreitet GoBD-Minimum (${MIN_RETENTION_DAYS} Tage). Verwende Minimum.`,
      );
      retentionDays = MIN_RETENTION_DAYS;
    }

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

  async setArchiveRetention(days: number): Promise<void> {
    await this.loggingService.setArchiveRetentionDays(days);
  }
}
