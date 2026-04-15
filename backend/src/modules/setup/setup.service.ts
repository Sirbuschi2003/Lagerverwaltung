import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import * as fs from 'fs';
import * as path from 'path';

import { UsersService } from "../users/users.service";
import { User } from "../users/entities/user.entity";
import { Item } from "../items/entities/item.entity";
import { Vehicle } from "../vehicles/entities/vehicle.entity";
import { Location } from "../locations/entities/location.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { InventoryLine } from "../inventory/entities/inventory-line.entity";
import { SystemConfig } from "../logging/entities/system-config.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { PurchaseOrder } from "../purchasing/entities/purchase-order.entity";
import { PurchaseOrderLine } from "../purchasing/entities/purchase-order-line.entity";
import { LoggingService } from "../logging/services/logging.service";

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private backupInterval: NodeJS.Timeout | null = null;
  private firstTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @InjectRepository(InventorySession)
    private readonly inventorySessionRepository: Repository<InventorySession>,
    @InjectRepository(InventoryLine)
    private readonly inventoryLineRepository: Repository<InventoryLine>,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderLine)
    private readonly purchaseOrderLineRepository: Repository<PurchaseOrderLine>,
    private readonly loggingService: LoggingService,
  ) {
    // Starte automatisches Backup beim Initialisieren (mit Verzögerung, damit DB ready ist)
    setTimeout(() => this.initAutoBackup(), 5000);
  }

  async needsSetup(): Promise<boolean> {
    const users = await this.usersService.findAll();
    return users.length === 0;
  }

  async createBackup(): Promise<any> {
    const [
      users,
      items,
      vehicles,
      locations,
      suppliers,
      purchaseOrders,
      purchaseOrderLines,
      stockLevels,
      stockMovements,
      inventorySessions,
      inventoryLines,
    ] = await Promise.all([
      this.userRepository.find(),
      this.itemRepository.find({ relations: ["storageLocation", "supplier"] }),
      this.vehicleRepository.find(),
      this.locationRepository.createQueryBuilder('loc')
        .leftJoinAndSelect('loc.parent', 'parent')
        .leftJoinAndSelect('loc.vehicle', 'vehicle')
        .getMany(),
      this.supplierRepository.find(),
      this.purchaseOrderRepository.find(),
      this.purchaseOrderLineRepository.find({ relations: ["order", "item"] }),
      this.stockLevelRepository.createQueryBuilder('sl')
        .leftJoinAndSelect('sl.item', 'item')
        .leftJoinAndSelect('sl.vehicle', 'vehicle')
        .leftJoinAndSelect('sl.location', 'location')
        .getMany(),
      this.stockMovementRepository.createQueryBuilder('sm')
        .leftJoinAndSelect('sm.item', 'item')
        .leftJoinAndSelect('sm.vehicle', 'vehicle')
        .leftJoinAndSelect('sm.location', 'location')
        .leftJoinAndSelect('sm.user', 'user')
        .getMany(),
      this.inventorySessionRepository.find(),
      this.inventoryLineRepository.createQueryBuilder('il')
        .leftJoinAndSelect('il.session', 'session')
        .leftJoinAndSelect('il.item', 'item')
        .leftJoinAndSelect('il.vehicle', 'vehicle')
        .leftJoinAndSelect('il.location', 'location')
        .getMany(),
    ]);

    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          email: u.email ?? null,
          passwordHash: u.passwordHash,
          role: u.role,
          vehicleId: u.vehicleId ?? null,
          branchId: u.branchId ?? null,
          refreshInterval: u.refreshInterval,
          locationIds: (u as any).locations?.map((l: any) => l.id) ?? [],
        })),
        items: items.map((item) => ({
          ...item,
          storageLocationId: item.storageLocation?.id ?? null,
          storageLocation: undefined,
        })),
        vehicles,
        suppliers,
        purchaseOrders: purchaseOrders.map((order) => ({
          id: order.id,
          supplierId: order.supplier?.id ?? null,
          status: order.status,
          orderNumber: order.orderNumber,
          orderedAt: order.orderedAt,
          receivedAt: order.receivedAt,
          note: order.note,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })),
        purchaseOrderLines: purchaseOrderLines.map((line) => ({
          id: line.id,
          orderId: line.order?.id ?? (line as any).orderId ?? null,
          itemId: line.item?.id ?? (line as any).itemId ?? null,
          quantity: line.quantity,
          receivedQuantity: line.receivedQuantity,
          packSize: line.packSize,
        })),
        locations: locations.map((location) => ({
          id: location.id,
          type: location.type,
          code: location.code,
          name: location.name,
          parentId: location.parent?.id ?? null,
          vehicleId: location.vehicle?.id ?? null,
          createdAt: location.createdAt,
          updatedAt: location.updatedAt,
        })),
        stockLevels: stockLevels.map(sl => ({
          id: sl.id,
          itemId: sl.item?.id,
          vehicleId: sl.vehicle?.id,
          locationId: sl.location?.id ?? null,
          quantity: sl.quantity,
          targetQuantity: sl.targetQuantity,
        })),
        stockMovements: stockMovements.map(sm => ({
          id: sm.id,
          type: sm.type,
          itemId: sm.item?.id,
          vehicleId: sm.vehicle?.id,
          locationId: sm.location?.id ?? null,
          quantity: sm.quantity,
          userId: sm.user?.id,
          occurredAt: sm.occurredAt,
          note: sm.note,
          source: sm.source,
        })),
        inventorySessions,
        inventoryLines: inventoryLines.map(il => ({
          id: il.id,
          sessionId: il.session?.id,
          itemId: il.item?.id,
          vehicleId: il.vehicle?.id,
          locationId: il.location?.id ?? null,
          expectedQuantity: il.expectedQuantity,
          countedQuantity: il.countedQuantity,
          note: il.note,
        })),
      },
    };
  }

  async restoreBackup(backup: any): Promise<void> {
    const { data } = backup;

    // Deaktiviere Foreign Key Checks für MySQL
    await this.dataSource.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      // Lösche alle bestehenden Daten in der richtigen Reihenfolge (wegen Foreign Keys)
      await this.inventoryLineRepository.clear();
      await this.inventorySessionRepository.clear();
      await this.stockMovementRepository.clear();
      await this.stockLevelRepository.clear();
      await this.purchaseOrderLineRepository.clear();
      await this.purchaseOrderRepository.clear();
      await this.itemRepository.clear();
      await this.supplierRepository.clear();
      await this.dataSource.query('DELETE FROM user_locations');
      await this.locationRepository.clear();
      await this.vehicleRepository.clear();
      await this.userRepository.clear();

      // Stelle Daten wieder her
      if (data.users?.length > 0) {
        await this.userRepository.save(data.users.map((u: any) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          email: u.email ?? null,
          passwordHash: u.passwordHash,
          role: u.role,
          vehicleId: u.vehicleId ?? null,
          branchId: u.branchId ?? null,
          refreshInterval: u.refreshInterval,
          locations: [],
        })));
      }

      if (data.vehicles?.length > 0) {
        await this.vehicleRepository.save(data.vehicles);
      }

      if (data.locations?.length > 0) {
        const baseLocations = data.locations.map((loc: any) => ({
          id: loc.id,
          type: loc.type,
          code: loc.code,
          name: loc.name ?? null,
          parent: null,
          vehicle: loc.vehicleId ? { id: loc.vehicleId } : null,
          createdAt: loc.createdAt,
          updatedAt: loc.updatedAt,
        }));

        await this.locationRepository.save(baseLocations);

        const locationsWithParent = data.locations
          .filter((loc: any) => loc.parentId)
          .map((loc: any) => ({
            id: loc.id,
            parent: { id: loc.parentId },
          }));

        if (locationsWithParent.length > 0) {
          await this.locationRepository.save(locationsWithParent);
        }
      }

      // Stelle Benutzer-Lager-Zuordnungen wieder her (user_locations)
      if (data.users?.length > 0) {
        for (const userData of data.users) {
          if (Array.isArray(userData.locationIds) && userData.locationIds.length > 0) {
            await this.userRepository.save({
              id: userData.id,
              locations: userData.locationIds.map((lid: string) => ({ id: lid })),
            });
          }
        }
      }

      if (data.suppliers?.length > 0) {
        await this.supplierRepository.save(data.suppliers);
      }

      if (data.items?.length > 0) {
        const itemsToSave = data.items.map((item: any) => {
          const { storageLocationId, supplierId, ...rest } = item;
          return {
            ...rest,
            storageLocation: storageLocationId ? { id: storageLocationId } : null,
            supplier: supplierId ? { id: supplierId } : null,
          };
        });
        await this.itemRepository.save(itemsToSave);
      }

      if (data.purchaseOrders?.length > 0) {
        const ordersToSave = data.purchaseOrders.map((order: any) => ({
          id: order.id,
          supplier: order.supplierId ? { id: order.supplierId } : null,
          status: order.status,
          orderNumber: order.orderNumber,
          orderedAt: order.orderedAt,
          receivedAt: order.receivedAt,
          note: order.note,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        }));
        await this.purchaseOrderRepository.save(ordersToSave);
      }

      if (data.purchaseOrderLines?.length > 0) {
        const linesToSave = data.purchaseOrderLines.map((line: any) => ({
          id: line.id,
          order: { id: line.orderId },
          item: { id: line.itemId },
          quantity: line.quantity,
          receivedQuantity: line.receivedQuantity,
          packSize: line.packSize,
        }));
        await this.purchaseOrderLineRepository.save(linesToSave);
      }

      if (data.stockLevels?.length > 0) {
        // Konvertiere itemId/vehicleId zurueck zu Objekten
        const stockLevelsToSave = data.stockLevels.map((sl: any) => ({
          id: sl.id,
          item: { id: sl.itemId },
          vehicle: sl.vehicleId ? { id: sl.vehicleId } : null,
          location: sl.locationId ? { id: sl.locationId } : null,
          quantity: sl.quantity,
          targetQuantity: sl.targetQuantity,
        }));
        await this.stockLevelRepository.save(stockLevelsToSave);
      }

      if (data.stockMovements?.length > 0) {
        const stockMovementsToSave = data.stockMovements.map((sm: any) => ({
          id: sm.id,
          type: sm.type,
          item: { id: sm.itemId },
          vehicle: sm.vehicleId ? { id: sm.vehicleId } : null,
          location: sm.locationId ? { id: sm.locationId } : null,
          user: sm.userId ? { id: sm.userId } : null,
          quantity: sm.quantity,
          occurredAt: sm.occurredAt,
          note: sm.note,
          source: sm.source,
        }));
        await this.stockMovementRepository.save(stockMovementsToSave);
      }

      if (data.inventorySessions?.length > 0) {
        await this.inventorySessionRepository.save(data.inventorySessions);
      }

      if (data.inventoryLines?.length > 0) {
        const inventoryLinesToSave = data.inventoryLines.map((il: any) => ({
          id: il.id,
          session: { id: il.sessionId },
          item: { id: il.itemId },
          vehicle: il.vehicleId ? { id: il.vehicleId } : null,
          location: il.locationId ? { id: il.locationId } : null,
          expectedQuantity: il.expectedQuantity,
          countedQuantity: il.countedQuantity,
          note: il.note,
        }));
        await this.inventoryLineRepository.save(inventoryLinesToSave);
      }
    } finally {
      // Aktiviere Foreign Key Checks wieder
      await this.dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  /**
   * Automatisches Backup-System
   */

  /**
   * Liefert den Backup-Pfad und stellt sicher, dass das Verzeichnis existiert.
   * Fällt auf sinnvolle Standardpfade zurück, wenn keine Umgebungsvariable gesetzt ist.
   */
  private ensureBackupDir(): string {
    const candidates = [
      process.env.BACKUP_DIR,
      '/app/backups', // Docker-Standard (per Bind-Mount)
      path.resolve(process.cwd(), '../backups'), // lokale Entwicklung aus backend/
      path.resolve(process.cwd(), 'backups'), // Fallback falls Prozess aus Projektwurzel startet
    ].filter(Boolean) as string[];

    for (const dir of candidates) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
      } catch (error) {
        this.logger.error(`Backup-Verzeichnis konnte nicht erstellt werden (${dir}):`, error);
      }
    }

    throw new Error('Kein Backup-Verzeichnis verfügbar');
  }

  /**
   * Speichert ein Backup als Datei und gibt den Dateinamen zurueck.
   */
  private saveBackupToFile(backup: any, type: 'auto' | 'manual'): string {
    const backupDir = this.ensureBackupDir();
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
    const filename = `${type}-backup-${timestamp}.json`;
    const filepath = path.join(backupDir, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    } catch (error) {
      this.logger.error(`Backup-Datei konnte nicht geschrieben werden (${filepath}):`, error);
      throw error;
    }
    return filename;
  }

  async initAutoBackup(): Promise<void> {
    try {
      const config = await this.getAutoBackupConfig();
      if (config.enabled) {
        this.scheduleNextBackup(config);
      }
    } catch (error) {
      this.logger.error('Fehler beim Initialisieren des automatischen Backups:', error);
    }
  }

  async getAutoBackupConfig(): Promise<{
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // Format: HH:MM
    lastBackup?: string;
    retentionDays?: number; // Wie lange Backups aufbewahrt werden
  }> {
    try {
      const enabledConfig = await this.configRepository.findOne({ 
        where: { key: 'backup.auto.enabled' } 
      });
      const frequencyConfig = await this.configRepository.findOne({ 
        where: { key: 'backup.auto.frequency' } 
      });
      const timeConfig = await this.configRepository.findOne({ 
        where: { key: 'backup.auto.time' } 
      });
      const lastBackupConfig = await this.configRepository.findOne({ 
        where: { key: 'backup.auto.lastBackup' } 
      });
      const retentionConfig = await this.configRepository.findOne({ 
        where: { key: 'backup.auto.retentionDays' } 
      });

      return {
        enabled: enabledConfig?.value === 'true',
        frequency: (frequencyConfig?.value as any) || 'daily',
        time: timeConfig?.value || '02:00',
        lastBackup: lastBackupConfig?.value,
        retentionDays: retentionConfig?.value ? parseInt(retentionConfig.value, 10) : 30,
      };
    } catch (error) {
      this.logger.error('Fehler beim Laden der Auto-Backup-Konfiguration:', error);
      return { enabled: false, frequency: 'daily', time: '02:00', retentionDays: 30 };
    }
  }

  async setAutoBackupConfig(config: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
    retentionDays?: number;
  }): Promise<void> {
    await this.loggingService.setConfig('backup.auto.enabled', config.enabled.toString(), 'Automatisches Backup aktiviert');
    await this.loggingService.setConfig('backup.auto.frequency', config.frequency, 'Backup-Häufigkeit (daily, weekly, monthly)');
    await this.loggingService.setConfig('backup.auto.time', config.time, 'Backup-Uhrzeit (HH:MM)');
    
    if (config.retentionDays !== undefined) {
      await this.loggingService.setConfig('backup.auto.retentionDays', config.retentionDays.toString(), 'Backup-Aufbewahrungsdauer in Tagen');
    }

    // Stoppe aktuelles Scheduling und starte neu
    if (this.firstTimeout) {
      clearTimeout(this.firstTimeout);
      this.firstTimeout = null;
    }
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    if (config.enabled) {
      this.scheduleNextBackup(config);
    }

    await this.loggingService.logInfo(
      'SYSTEM' as any,
      'AUTO_BACKUP_CONFIG_CHANGED',
      `Automatisches Backup ${config.enabled ? 'aktiviert' : 'deaktiviert'}: ${config.frequency} um ${config.time}`,
    );
  }

  private scheduleNextBackup(config: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string;
  }): void {
    // Bereinige vorherige Timer
    if (this.firstTimeout) {
      clearTimeout(this.firstTimeout);
      this.firstTimeout = null;
    }
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }

    const [hours, minutes] = config.time.split(':').map(Number);
    
    const now = new Date();
    const nextBackup = new Date();
    nextBackup.setHours(hours, minutes, 0, 0);

    // Wenn die Zeit heute schon vorbei ist, plane für morgen
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
    }

    // Berechne die Verzögerung bis zum nächsten Backup
    const delay = nextBackup.getTime() - now.getTime();

    // Logging mit lokaler Zeit (Europe/Berlin) für bessere Lesbarkeit
    const localTime = nextBackup.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short', timeStyle: 'short' });
    this.logger.log(`Naechstes automatisches Backup: ${nextBackup.toISOString()} (${localTime}, in ${Math.round(delay / 1000 / 60)} Minuten)`);

    // Setze Timeout für das erste Backup
    this.firstTimeout = setTimeout(async () => {
      await this.performAutoBackup();
      
      // Nach dem ersten Backup, setze Intervall basierend auf Frequenz
      const intervalMs = this.getIntervalMs(config.frequency);
      this.backupInterval = setInterval(async () => {
        await this.performAutoBackup();
      }, intervalMs) as any;
    }, delay);
  }

  private getIntervalMs(frequency: 'daily' | 'weekly' | 'monthly'): number {
    switch (frequency) {
      case 'daily':
        return 24 * 60 * 60 * 1000; // 1 Tag
      case 'weekly':
        return 7 * 24 * 60 * 60 * 1000; // 7 Tage
      case 'monthly':
        return 30 * 24 * 60 * 60 * 1000; // 30 Tage
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private async performAutoBackup(): Promise<void> {
    try {
      this.logger.log('Fuehre automatisches Backup durch...');
      
      const backup = await this.createBackup();
      const filename = this.saveBackupToFile(backup, 'auto');
      const backupDir = this.ensureBackupDir();
      const filepath = path.join(backupDir, filename);

      // Speichere Zeitstempel des letzten Backups
      await this.loggingService.setConfig(
        'backup.auto.lastBackup',
        new Date().toISOString(),
        'Zeitstempel des letzten automatischen Backups'
      );

      // Bereinige alte Backups basierend auf Retention
      await this.cleanupOldBackups(backupDir);

      await this.loggingService.logInfo(
        'SYSTEM' as any,
        'AUTO_BACKUP_COMPLETED',
        `Automatisches Backup erfolgreich erstellt: ${filename}`
      );

      this.logger.log(`Automatisches Backup erfolgreich gespeichert: ${filepath}`);
    } catch (error: any) {
      this.logger.error('Fehler beim automatischen Backup:', error);
      
      await this.loggingService.logError(
        'SYSTEM' as any,
        'AUTO_BACKUP_FAILED',
        `Automatisches Backup fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`
      );
    }
  }

  async saveManualBackup(backup: any): Promise<string> {
    const filename = this.saveBackupToFile(backup, 'manual');
    await this.loggingService.logInfo(
      'SYSTEM' as any,
      'MANUAL_BACKUP_CREATED',
      `Manuelles Backup gespeichert: ${filename}`
    );
    return filename;
  }

  private async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      const config = await this.getAutoBackupConfig();
      const retentionDays = config.retentionDays || 30;

      if (!fs.existsSync(backupDir)) {
        return;
      }

      const files = fs.readdirSync(backupDir);
      const now = Date.now();
      const maxAge = retentionDays * 24 * 60 * 60 * 1000; // Tage in ms

      let deletedCount = 0;
      for (const file of files) {
        if (!file.startsWith('auto-backup-') || !file.endsWith('.json')) {
          continue; // Nur Auto-Backups bereinigen
        }

        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          try {
            fs.unlinkSync(filepath);
            deletedCount++;
          } catch (unlinkError) {
            this.logger.warn(`Backup-Datei konnte nicht geloescht werden (${filepath}):`, unlinkError);
          }
        }
      }

      if (deletedCount > 0) {
        await this.loggingService.logInfo(
          'SYSTEM' as any,
          'AUTO_BACKUP_CLEANUP',
          `${deletedCount} alte Backup-Dateien gelöscht (älter als ${retentionDays} Tage)`
        );
        this.logger.log(`Backup-Bereinigung: ${deletedCount} alte Dateien geloescht`);
      }
    } catch (error: any) {
      this.logger.error('Fehler bei der Backup-Bereinigung:', error);
    }
  }

  async getLastAutoBackupTime(): Promise<string | null> {
    try {
      const config = await this.configRepository.findOne({ 
        where: { key: 'backup.auto.lastBackup' } 
      });
      return config?.value || null;
    } catch (error) {
      this.logger.error('Fehler beim Abrufen des letzten Backup-Zeitpunkts:', error);
      return null;
    }
  }

  async listAutoBackups(): Promise<Array<{ filename: string; size: number; created: string; type: 'auto' | 'manual' }>> {
    try {
      const backupDir = this.ensureBackupDir();
      
      if (!fs.existsSync(backupDir)) {
        return [];
      }

      const files = fs.readdirSync(backupDir);
      const backups: Array<{ filename: string; size: number; created: string; type: 'auto' | 'manual' }> = [];

      for (const file of files) {
        let type: 'auto' | 'manual' | null = null;
        if (file.startsWith('auto-backup-') && file.endsWith('.json')) {
          type = 'auto';
        } else if (file.startsWith('manual-backup-') && file.endsWith('.json')) {
          type = 'manual';
        } else {
          continue;
        }

        const filepath = path.join(backupDir, file);
        const stats = fs.statSync(filepath);
        
        backups.push({
          filename: file,
          size: stats.size,
          created: stats.mtime.toISOString(),
          type,
        });
      }

      // Sortiere nach Datum (neueste zuerst)
      backups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

      return backups;
    } catch (error) {
      this.logger.error('Fehler beim Auflisten der Backups:', error);
      return [];
    }
  }

  private isValidBackupFilename(filename: string): boolean {
    const allowedPrefixes = ['auto-backup-', 'manual-backup-'];
    const hasAllowedPrefix = allowedPrefixes.some(prefix => filename.startsWith(prefix));
    return hasAllowedPrefix && filename.endsWith('.json') && !filename.includes('..') && !filename.includes('/') && !filename.includes('\\');
  }

  async getAutoBackupPath(filename: string): Promise<string> {
    if (!this.isValidBackupFilename(filename)) {
      throw new Error('Ungültiger Dateiname');
    }

    const backupDir = this.ensureBackupDir();
    const filepath = path.join(backupDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error('Backup-Datei nicht gefunden');
    }

    return filepath;
  }

  async deleteAutoBackup(filename: string): Promise<void> {
    const filepath = await this.getAutoBackupPath(filename);
    fs.unlinkSync(filepath);
    
    await this.loggingService.logInfo(
      'SYSTEM' as any,
      'AUTO_BACKUP_DELETED',
      `Backup-Datei manuell gelöscht: ${filename}`
    );
  }
}
