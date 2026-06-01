import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Repository } from "typeorm";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DeliveryNote } from "./entities/delivery-note.entity";
import { Branch } from "../branches/entities/branch.entity";

@Injectable()
export class DeliveryNotesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DeliveryNotesService.name);

  constructor(
    @InjectRepository(DeliveryNote)
    private readonly repo: Repository<DeliveryNote>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
  ) {}

  onApplicationBootstrap() {
    // Initial scan on startup (non-blocking)
    this.scanWatchFolder().catch((err) => this.logger.error("Initial scan failed", err));
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduledScan() {
    await this.scanWatchFolder();
  }

  private getStoragePath(): string {
    return (process.env.DELIVERY_NOTES_STORAGE_PATH || "/app/delivery-notes").trim();
  }

  /**
   * Scannt den Storage-Ordner nach neuen PDFs.
   * Erwartet Struktur: {branchFolder}/{YYYY}/{MM}/{vorgangsnummer}.pdf
   */
  private async scanWatchFolder(): Promise<void> {
    const root = this.getStoragePath();

    try {
      await fs.access(root);
    } catch {
      return; // Ordner existiert noch nicht
    }

    const branchFolders = await this.listDirs(root);

    for (const branchFolder of branchFolders) {
      const branchId = await this.resolveBranchId(branchFolder);
      const branchPath = path.join(root, branchFolder);
      const yearDirs = await this.listDirs(branchPath);

      for (const year of yearDirs) {
        const yearPath = path.join(branchPath, year);
        const monthDirs = await this.listDirs(yearPath);

        for (const month of monthDirs) {
          const monthPath = path.join(yearPath, month);
          const files = await this.listFiles(monthPath, ".pdf");

          for (const file of files) {
            const relPath = path.join(branchFolder, year, month, file).replace(/\\/g, "/");
            const vorgangsnummer = path.basename(file, ".pdf");

            const exists = await this.repo.findOne({ where: { filePath: relPath } });
            if (exists) continue;

            await this.repo.save(
              this.repo.create({ id: randomUUID(), vorgangsnummer, filePath: relPath, branchId, detectedAt: new Date() }),
            );
            this.logger.log(`Neuer Lieferschein erkannt: ${relPath}`);
          }
        }
      }
    }
  }

  async findByVorgangsnummer(vorgangsnummer: string, branchId: string | null): Promise<DeliveryNote | null> {
    const qb = this.repo.createQueryBuilder("dn").where("dn.vorgangsnummer = :v", { v: vorgangsnummer });
    if (branchId) {
      qb.andWhere("(dn.branchId = :b OR dn.branchId IS NULL)", { b: branchId });
    }
    return qb.getOne();
  }

  async existsForVorgangsnummern(vorgangsnummern: string[], branchId: string | null): Promise<Set<string>> {
    if (!vorgangsnummern.length) return new Set();
    const qb = this.repo
      .createQueryBuilder("dn")
      .select("dn.vorgangsnummer")
      .where("dn.vorgangsnummer IN (:...vnrs)", { vnrs: vorgangsnummern });
    if (branchId) {
      qb.andWhere("(dn.branchId = :b OR dn.branchId IS NULL)", { b: branchId });
    }
    const rows = await qb.getMany();
    return new Set(rows.map((r) => r.vorgangsnummer));
  }

  getAbsolutePath(relPath: string): string {
    return path.join(this.getStoragePath(), relPath);
  }

  async debugInfo() {
    const root = this.getStoragePath();
    let rootExists = false;
    let folders: string[] = [];
    let allFiles: string[] = [];

    try {
      await fs.access(root);
      rootExists = true;
      folders = await this.listDirs(root);
      for (const f of folders) {
        const years = await this.listDirs(path.join(root, f));
        for (const y of years) {
          const months = await this.listDirs(path.join(root, f, y));
          for (const m of months) {
            const files = await this.listFiles(path.join(root, f, y, m), ".pdf");
            allFiles.push(...files.map((file) => `${f}/${y}/${m}/${file}`));
          }
        }
      }
    } catch {
      // ignore
    }

    const dbEntries = await this.repo.find({ take: 50 });

    return {
      storagePath: root,
      rootExists,
      branchFolders: folders,
      filesFound: allFiles,
      dbEntries: dbEntries.map((e) => ({ vorgangsnummer: e.vorgangsnummer, branchId: e.branchId, filePath: e.filePath })),
    };
  }

  private async resolveBranchId(folderName: string): Promise<string | null> {
    // Ordnername-Format: {CODE}_{Name} oder nur {Name}
    const codePart = folderName.split("_")[0]?.toUpperCase();
    if (!codePart) return null;

    const branch = await this.branchRepo.findOne({ where: { externalCode: codePart } });
    return branch?.id ?? null;
  }

  private async listDirs(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  private async listFiles(dirPath: string, ext: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(ext))
        .map((e) => e.name);
    } catch {
      return [];
    }
  }
}
