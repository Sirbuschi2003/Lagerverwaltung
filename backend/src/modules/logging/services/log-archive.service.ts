import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as crypto from 'crypto';
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
      const envelope = JSON.parse(raw);
      if (!envelope.enc) return null;
      const iv = Buffer.from(envelope.iv, 'hex');
      const tag = Buffer.from(envelope.tag, 'hex');
      const data = Buffer.from(envelope.data, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(tag);
      return decipher.update(data) + decipher.final('utf-8');
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
      const parsed = JSON.parse(json);
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

  async setArchiveRetention(days: number): Promise<void> {
    await this.loggingService.setArchiveRetentionDays(days);
  }
}
