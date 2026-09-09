import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import AdmZip from "adm-zip";
import { Repository, DataSource, DeepPartial } from "typeorm";

import { Permission } from "../access-control/entities/permission.entity";
import { RolePermission } from "../access-control/entities/role-permission.entity";
import { Role } from "../access-control/entities/role.entity";
import { UserPermission } from "../access-control/entities/user-permission.entity";
import { Branch } from "../branches/entities/branch.entity";
import { InventoryLine } from "../inventory/entities/inventory-line.entity";
import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { ItemCode } from "../items/entities/item-code.entity";
import { Item } from "../items/entities/item.entity";
import { Location } from "../locations/entities/location.entity";
import { BranchConfig } from "../logging/entities/branch-config.entity";
import { SystemConfig } from "../logging/entities/system-config.entity";
import { LogCategory } from "../logging/entities/system-log.entity";
import { LoggingService } from "../logging/services/logging.service";
import { PurchaseOrderLine } from "../purchasing/entities/purchase-order-line.entity";
import { PurchaseOrder } from "../purchasing/entities/purchase-order.entity";
import { StockLevel } from "../stock/entities/stock-level.entity";
import { StockMovement } from "../stock/entities/stock-movement.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { Vehicle } from "../vehicles/entities/vehicle.entity";

import {
  BackupData,
  BackupInventoryLine,
  BackupItem,
  BackupItemCode,
  BackupLocation,
  BackupPayload,
  BackupPurchaseOrder,
  BackupPurchaseOrderLine,
  BackupStockLevel,
  BackupStockMovement,
  BackupUser,
  RestoreFilters,
} from "./backup-payload.types";

@Injectable()
export class SetupService implements OnModuleInit {
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
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(BranchConfig)
    private readonly branchConfigRepository: Repository<BranchConfig>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    @InjectRepository(UserPermission)
    private readonly userPermissionRepository: Repository<UserPermission>,
    @InjectRepository(ItemCode)
    private readonly itemCodeRepository: Repository<ItemCode>,
    private readonly loggingService: LoggingService,
  ) {}

  onModuleInit(): void {
    // Delay so the DB connection pool is fully ready before scheduling backups
    setTimeout(() => { void this.initAutoBackup(); }, 5000);
  }

  async needsSetup(): Promise<boolean> {
    const users = await this.usersService.findAll();
    return users.length === 0;
  }

  /**
   * Erstellt ein vollständiges Backup und speichert es als pre-migration Datei.
   * Gibt den Dateipfad zurück, null bei Fehler.
   */
  async createPreMigrationBackup(): Promise<string | null> {
    try {
      this.logger.log('Erstelle Pre-Migration-Backup...');
      const backup = await this.createBackup();
      const backupDir = this.ensureBackupDir();
      const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
      const filename = `pre-migration-${timestamp}.json`;
      const filepath = path.join(backupDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
      this.logger.log(`Pre-Migration-Backup gespeichert: ${filepath}`);
      return filepath;
    } catch (error) {
      this.logger.error('Pre-Migration-Backup fehlgeschlagen:', error);
      return null;
    }
  }

  async createBackup(): Promise<BackupPayload> {
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
      branches,
      branchConfigs,
      systemConfigs,
      roles,
      permissions,
      rolePermissions,
      userPermissions,
      itemCodes,
    ] = await Promise.all([
      this.userRepository.find({ relations: ['locations'] }),
      this.itemRepository.find({ relations: ["storageLocation", "supplier"] }),
      this.vehicleRepository.find(),
      this.locationRepository.createQueryBuilder('loc')
        .leftJoinAndSelect('loc.parent', 'parent')
        .leftJoinAndSelect('loc.vehicle', 'vehicle')
        .getMany(),
      this.supplierRepository.find(),
      this.purchaseOrderRepository.find({ relations: ["supplier", "location"] }),
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
      this.branchRepository.find(),
      this.branchConfigRepository.find(),
      this.configRepository.find(),
      this.roleRepository.find(),
      this.permissionRepository.find(),
      this.rolePermissionRepository.find(),
      this.userPermissionRepository.find(),
      this.itemCodeRepository.find({ relations: ["item"] }),
    ]);

    return {
      version: '2.0',
      timestamp: new Date().toISOString(),
      data: {
        branches,
        branchConfigs,
        systemConfigs,
        roles,
        permissions,
        rolePermissions,
        userPermissions,
        users: users.map((u): BackupUser => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          email: u.email ?? null,
          // passwordHash intentionally omitted — restore uses locked sentinel; admin must reset passwords after restore (SEC-013)
          role: u.role,
          vehicleId: u.vehicleId ?? null,
          branchId: u.branchId ?? null,
          refreshInterval: u.refreshInterval,
          locationIds: u.locations?.map((l) => l.id) ?? [],
        })),
        items: items.map((item): BackupItem => ({
          ...item,
          storageLocationId: item.storageLocation?.id ?? null,
          storageLocation: undefined,
          supplierId: item.supplier?.id ?? (item as unknown as { supplierId?: string }).supplierId ?? null,
          supplier: undefined,
        })),
        vehicles,
        suppliers,
        purchaseOrders: purchaseOrders.map((order): BackupPurchaseOrder => ({
          id: order.id,
          supplierId: order.supplier?.id ?? null,
          status: order.status,
          orderNumber: order.orderNumber,
          orderedAt: order.orderedAt,
          receivedAt: order.receivedAt,
          note: order.note,
          deliveryNoteNumber: order.deliveryNoteNumber ?? null,
          branchId: order.branchId ?? null,
          locationId: order.locationId ?? null,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
        })),
        purchaseOrderLines: purchaseOrderLines.map((line): BackupPurchaseOrderLine => ({
          id: line.id,
          orderId: line.order?.id ?? (line as unknown as { orderId?: string }).orderId ?? null,
          itemId: line.item?.id ?? (line as unknown as { itemId?: string }).itemId ?? null,
          quantity: line.quantity,
          receivedQuantity: line.receivedQuantity,
          packSize: line.packSize,
        })),
        locations: locations.map((location): BackupLocation => ({
          id: location.id,
          type: location.type,
          code: location.code,
          name: location.name,
          parentId: location.parent?.id ?? null,
          vehicleId: location.vehicle?.id ?? null,
          branchId: location.branchId ?? null,
          createdAt: location.createdAt,
          updatedAt: location.updatedAt,
        })),
        stockLevels: stockLevels.map((sl): BackupStockLevel => ({
          id: sl.id,
          itemId: sl.item?.id ?? null,
          vehicleId: sl.vehicle?.id ?? null,
          locationId: sl.location?.id ?? null,
          quantity: sl.quantity,
          targetQuantity: sl.targetQuantity,
        })),
        stockMovements: stockMovements
          .filter(sm => sm.item != null)
          .map((sm): BackupStockMovement => ({
            id: sm.id,
            type: sm.type,
            itemId: sm.item.id,
            vehicleId: sm.vehicle?.id ?? null,
            locationId: sm.location?.id ?? null,
            quantity: sm.quantity,
            userId: sm.user?.id ?? null,
            occurredAt: sm.occurredAt,
            createdAt: sm.createdAt,
            note: sm.note,
            source: sm.source,
            isVoided: sm.isVoided,
            voidedAt: sm.voidedAt,
            voidedBy: sm.voidedBy,
            voidReason: sm.voidReason,
          })),
        inventorySessions,
        inventoryLines: inventoryLines.map((il): BackupInventoryLine => ({
          id: il.id,
          sessionId: il.session?.id ?? null,
          itemId: il.item?.id ?? null,
          vehicleId: il.vehicle?.id ?? null,
          locationId: il.location?.id ?? null,
          expectedQuantity: il.expectedQuantity,
          countedQuantity: il.countedQuantity,
          note: il.note,
        })),
        itemCodes: itemCodes.map((ic): BackupItemCode => ({
          id: ic.id,
          branchId: ic.branchId,
          code: ic.code,
          kind: ic.kind,
          itemId: ic.item?.id ?? null,
        })),
        // Hinweis: Artikel-Bilder und Bestellungs-PDFs werden NICHT im JSON-Backup gesichert.
        // Diese liegen in Docker-Volumes und werden über die Volume-Backup-Infrastruktur (rsync/NAS) gesichert.
      },
    };
  }

  async restoreBackup(backup: BackupPayload): Promise<void> {
    const { data } = backup;
    // branchId fallback: Lagerorte im Backup haben ggf. null (Altdaten vor Branch-Isolation)
    const fallbackBranchId = data.branches?.[0]?.id
      ?? data.locations?.find((l) => l.branchId)?.branchId
      ?? null;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      const mgr = queryRunner.manager;

      await mgr.getRepository(InventoryLine).clear();
      await mgr.getRepository(InventorySession).clear();
      await mgr.getRepository(StockMovement).clear();
      await mgr.getRepository(StockLevel).clear();
      await mgr.getRepository(PurchaseOrderLine).clear();
      await mgr.getRepository(PurchaseOrder).clear();
      await mgr.getRepository(ItemCode).clear();
      await mgr.getRepository(Item).clear();
      await mgr.getRepository(Supplier).clear();
      await mgr.getRepository(UserPermission).clear();
      await mgr.getRepository(RolePermission).clear();
      await mgr.query('DELETE FROM user_locations');
      await mgr.getRepository(Location).clear();
      await mgr.getRepository(Vehicle).clear();
      await mgr.getRepository(User).clear();
      await mgr.getRepository(BranchConfig).clear();
      await mgr.getRepository(SystemConfig).clear();
      await mgr.getRepository(Role).clear();
      await mgr.getRepository(Permission).clear();
      await mgr.getRepository(Branch).clear();

      if (data.branches && data.branches.length > 0) await mgr.getRepository(Branch).save(data.branches);
      if (data.permissions && data.permissions.length > 0) await mgr.getRepository(Permission).save(data.permissions);
      if (data.roles && data.roles.length > 0) await mgr.getRepository(Role).save(data.roles);
      if (data.systemConfigs && data.systemConfigs.length > 0) await mgr.getRepository(SystemConfig).save(data.systemConfigs);
      if (data.branchConfigs && data.branchConfigs.length > 0) await mgr.getRepository(BranchConfig).save(data.branchConfigs);

      if (data.users && data.users.length > 0) {
        await mgr.getRepository(User).save(data.users.map((u) => ({
          id: u.id, username: u.username, displayName: u.displayName,
          email: u.email ?? null,
          // passwordHash fehlt in Download-Backups (SEC-013); Konto wird gesperrt → Admin muss PW zurücksetzen
          passwordHash: u.passwordHash ?? '$LOCKED$NO_PW_SET_RESET_REQUIRED$',
          role: u.role,
          vehicleId: u.vehicleId ?? null, branchId: u.branchId ?? null,
          refreshInterval: u.refreshInterval, locations: [],
        })));
      }

      if (data.vehicles && data.vehicles.length > 0) await mgr.getRepository(Vehicle).save(data.vehicles);

      if (data.locations && data.locations.length > 0) {
        await mgr.getRepository(Location).save(data.locations.map((loc) => ({
          id: loc.id, type: loc.type, code: loc.code, name: loc.name ?? null,
          parent: null, vehicle: loc.vehicleId ? { id: loc.vehicleId } : null,
          branchId: loc.branchId ?? fallbackBranchId,
          createdAt: loc.createdAt, updatedAt: loc.updatedAt,
        })));
        const withParent = data.locations.filter((l) => l.parentId)
          .map((l) => ({ id: l.id, parent: { id: l.parentId as string } }));
        if (withParent.length > 0) await mgr.getRepository(Location).save(withParent);
      }

      if (data.users && data.users.length > 0) {
        for (const u of data.users) {
          if (Array.isArray(u.locationIds) && u.locationIds.length > 0) {
            await mgr.getRepository(User).save({ id: u.id, locations: u.locationIds.map((lid) => ({ id: lid })) });
          }
        }
      }

      if (data.suppliers && data.suppliers.length > 0) await mgr.getRepository(Supplier).save(data.suppliers);

      if (data.items && data.items.length > 0) {
        await mgr.getRepository(Item).save(data.items.map((item) => {
          const { storageLocationId, supplierId, ...rest } = item;
          return { ...rest, storageLocation: storageLocationId ? { id: storageLocationId } : null, supplier: supplierId ? { id: supplierId } : null };
        }));
      }

      if (data.itemCodes && data.itemCodes.length > 0) {
        // item ist bei ItemCode eine Pflicht-Relation; `null` bei fehlender itemId ist bewusst
        // beibehaltenes Bestandsverhalten (siehe Bericht) — DeepPartial erlaubt hier keinen expliziten Null-Wert.
        await mgr.getRepository(ItemCode).save(data.itemCodes.map((ic) => ({
          id: ic.id, branchId: ic.branchId, code: ic.code, kind: ic.kind,
          item: ic.itemId ? { id: ic.itemId } : null,
        })) as DeepPartial<ItemCode>[]);
      }

      if (data.rolePermissions && data.rolePermissions.length > 0) await mgr.getRepository(RolePermission).save(data.rolePermissions);
      if (data.userPermissions && data.userPermissions.length > 0) await mgr.getRepository(UserPermission).save(data.userPermissions);

      if (data.purchaseOrders && data.purchaseOrders.length > 0) {
        // supplier ist bei PurchaseOrder eine Pflicht-Relation; `null` bei fehlender supplierId ist
        // bewusst beibehaltenes Bestandsverhalten (siehe Bericht) — DeepPartial erlaubt hier keinen expliziten Null-Wert.
        await mgr.getRepository(PurchaseOrder).save(data.purchaseOrders.map((o) => ({
          id: o.id, supplier: o.supplierId ? { id: o.supplierId } : null,
          status: o.status, orderNumber: o.orderNumber, orderedAt: o.orderedAt,
          receivedAt: o.receivedAt, note: o.note ?? null,
          deliveryNoteNumber: o.deliveryNoteNumber ?? null,
          branchId: o.branchId ?? null,
          locationId: o.locationId ?? null,
          createdAt: o.createdAt, updatedAt: o.updatedAt,
        })) as DeepPartial<PurchaseOrder>[]);
      }

      if (data.purchaseOrderLines && data.purchaseOrderLines.length > 0) {
        await mgr.getRepository(PurchaseOrderLine).save(data.purchaseOrderLines.map((l) => ({
          id: l.id, order: { id: l.orderId as string }, item: { id: l.itemId as string },
          quantity: l.quantity, receivedQuantity: l.receivedQuantity, packSize: l.packSize,
        })));
      }

      if (data.stockLevels && data.stockLevels.length > 0) {
        await mgr.getRepository(StockLevel).save(data.stockLevels.map((sl) => ({
          id: sl.id, item: { id: sl.itemId as string },
          vehicle: sl.vehicleId ? { id: sl.vehicleId } : null,
          location: sl.locationId ? { id: sl.locationId } : null,
          quantity: sl.quantity, targetQuantity: sl.targetQuantity,
        })));
      }

      const validMovements = (data.stockMovements ?? []).filter((sm) => sm.itemId);
      if (validMovements.length > 0) {
        await mgr.getRepository(StockMovement).save(validMovements.map((sm) => ({
          id: sm.id, type: sm.type, item: { id: sm.itemId },
          vehicle: sm.vehicleId ? { id: sm.vehicleId } : null,
          location: sm.locationId ? { id: sm.locationId } : null,
          user: sm.userId ? { id: sm.userId } : null,
          quantity: sm.quantity, occurredAt: sm.occurredAt,
          createdAt: sm.createdAt ?? undefined,
          note: sm.note, source: sm.source,
          isVoided: sm.isVoided ?? false,
          voidedAt: sm.voidedAt ?? null,
          voidedBy: sm.voidedBy ?? null,
          voidReason: sm.voidReason ?? null,
        })));
      }

      if (data.inventorySessions && data.inventorySessions.length > 0) await mgr.getRepository(InventorySession).save(data.inventorySessions);

      if (data.inventoryLines && data.inventoryLines.length > 0) {
        await mgr.getRepository(InventoryLine).save(data.inventoryLines.map((il) => ({
          id: il.id, session: { id: il.sessionId as string }, item: { id: il.itemId as string },
          vehicle: il.vehicleId ? { id: il.vehicleId } : null,
          location: il.locationId ? { id: il.locationId } : null,
          expectedQuantity: il.expectedQuantity, countedQuantity: il.countedQuantity, note: il.note,
        })));
      }

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    if (data.purchaseOrderPdfs && data.purchaseOrderPdfs.length > 0) {
      await this.restorePurchaseOrderPdfs(data.purchaseOrderPdfs);
    }
    if (data.itemImages && data.itemImages.length > 0) {
      await this.restoreItemImages(data.itemImages);
    }
  }

  /**
   * Selektive Wiederherstellung einzelner Datenbereiche aus einem Backup.
   * Nur die gewählten Sektionen werden gelöscht und neu befüllt.
   * Abhängigkeiten (z.B. items für stockLevels) müssen bereits in der DB existieren.
   */
  async restoreSelective(
    backup: BackupPayload,
    sections: string[],
    filters?: RestoreFilters,
  ): Promise<void> {
    const rawData = backup.data;
    const fallbackBranchId = filters?.targetBranchId
      ?? rawData.branches?.[0]?.id
      ?? rawData.locations?.find((l) => l.branchId)?.branchId
      ?? null;

    const data = this.applyRestoreFilters(rawData, filters);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      const mgr = queryRunner.manager;

      // --- 1. Gewählte Sektionen leeren ---
      if (sections.includes('inventorySessions')) {
        await mgr.getRepository(InventoryLine).clear();
        await mgr.getRepository(InventorySession).clear();
      }
      if (sections.includes('stockMovements')) await mgr.getRepository(StockMovement).clear();
      if (sections.includes('stockLevels')) await mgr.getRepository(StockLevel).clear();
      if (sections.includes('purchaseOrders')) {
        await mgr.getRepository(PurchaseOrderLine).clear();
        await mgr.getRepository(PurchaseOrder).clear();
      }
      if (sections.includes('items')) {
        await mgr.getRepository(ItemCode).clear();
        await mgr.getRepository(Item).clear();
      }
      if (sections.includes('suppliers')) await mgr.getRepository(Supplier).clear();
      if (sections.includes('locations')) {
        await mgr.query('DELETE FROM user_locations');
        await mgr.getRepository(Location).clear();
      }
      if (sections.includes('vehicles')) await mgr.getRepository(Vehicle).clear();
      if (sections.includes('users')) {
        await mgr.getRepository(UserPermission).clear();
        await mgr.getRepository(RolePermission).clear();
        await mgr.query('DELETE FROM user_locations');
        await mgr.getRepository(User).clear();
      }
      if (sections.includes('systemConfig')) {
        await mgr.getRepository(BranchConfig).clear();
        await mgr.getRepository(SystemConfig).clear();
      }

      // --- 2. Daten wiederherstellen ---
      if (sections.includes('systemConfig')) {
        if (data.systemConfigs && data.systemConfigs.length > 0) await mgr.getRepository(SystemConfig).save(data.systemConfigs);
        if (data.branchConfigs && data.branchConfigs.length > 0) await mgr.getRepository(BranchConfig).save(data.branchConfigs);
      }

      if (sections.includes('users') && data.users && data.users.length > 0) {
        await mgr.getRepository(User).save(data.users.map((u) => ({
          id: u.id, username: u.username, displayName: u.displayName,
          email: u.email ?? null,
          passwordHash: u.passwordHash ?? '$LOCKED$NO_PW_SET_RESET_REQUIRED$',
          role: u.role,
          vehicleId: u.vehicleId ?? null, branchId: u.branchId ?? null,
          refreshInterval: u.refreshInterval, locations: [],
        })));
        if (data.rolePermissions && data.rolePermissions.length > 0) await mgr.getRepository(RolePermission).save(data.rolePermissions);
        if (data.userPermissions && data.userPermissions.length > 0) await mgr.getRepository(UserPermission).save(data.userPermissions);
        for (const u of data.users) {
          if (Array.isArray(u.locationIds) && u.locationIds.length > 0) {
            await mgr.getRepository(User).save({ id: u.id, locations: u.locationIds.map((lid) => ({ id: lid })) });
          }
        }
      }

      if (sections.includes('vehicles') && data.vehicles && data.vehicles.length > 0) {
        await mgr.getRepository(Vehicle).save(data.vehicles);
      }

      if (sections.includes('locations') && data.locations && data.locations.length > 0) {
        await mgr.getRepository(Location).save(data.locations.map((loc) => ({
          id: loc.id, type: loc.type, code: loc.code, name: loc.name ?? null,
          parent: null, vehicle: loc.vehicleId ? { id: loc.vehicleId } : null,
          branchId: loc.branchId ?? fallbackBranchId,
          createdAt: loc.createdAt, updatedAt: loc.updatedAt,
        })));
        const withParent = data.locations.filter((l) => l.parentId)
          .map((l) => ({ id: l.id, parent: { id: l.parentId as string } }));
        if (withParent.length > 0) await mgr.getRepository(Location).save(withParent);
      }

      if (sections.includes('suppliers') && data.suppliers && data.suppliers.length > 0) {
        await mgr.getRepository(Supplier).save(data.suppliers);
      }

      if (sections.includes('items')) {
        if (data.items && data.items.length > 0) {
          await mgr.getRepository(Item).save(data.items.map((item) => {
            const { storageLocationId, supplierId, ...rest } = item;
            return { ...rest, storageLocation: storageLocationId ? { id: storageLocationId } : null, supplier: supplierId ? { id: supplierId } : null };
          }));
        }
        if (data.itemCodes && data.itemCodes.length > 0) {
          await mgr.getRepository(ItemCode).save(data.itemCodes.map((ic) => ({
            id: ic.id, branchId: ic.branchId, code: ic.code, kind: ic.kind,
            item: ic.itemId ? { id: ic.itemId } : null,
          })) as DeepPartial<ItemCode>[]);
        }
      }

      if (sections.includes('purchaseOrders')) {
        if (data.purchaseOrders && data.purchaseOrders.length > 0) {
          await mgr.getRepository(PurchaseOrder).save(data.purchaseOrders.map((o) => ({
            id: o.id, supplier: o.supplierId ? { id: o.supplierId } : null,
            status: o.status, orderNumber: o.orderNumber, orderedAt: o.orderedAt,
            receivedAt: o.receivedAt, note: o.note ?? null,
            deliveryNoteNumber: o.deliveryNoteNumber ?? null,
            branchId: o.branchId ?? fallbackBranchId,
            locationId: o.locationId ?? null,
            createdAt: o.createdAt, updatedAt: o.updatedAt,
          })) as DeepPartial<PurchaseOrder>[]);
        }
        if (data.purchaseOrderLines && data.purchaseOrderLines.length > 0) {
          await mgr.getRepository(PurchaseOrderLine).save(data.purchaseOrderLines.map((l) => ({
            id: l.id, order: { id: l.orderId as string }, item: { id: l.itemId as string },
            quantity: l.quantity, receivedQuantity: l.receivedQuantity, packSize: l.packSize,
          })));
        }
      }

      if (sections.includes('stockLevels') && data.stockLevels && data.stockLevels.length > 0) {
        // Backup-ItemIDs können von aktuellen DB-IDs abweichen (z.B. nach Hyreka-Import).
        // Mapping über Artikelcode: backup itemId → aktuelle DB itemId
        const backupItemIdToCode = new Map<string, string>(
          (data.items ?? []).map((i) => [i.id, i.code]),
        );
        const currentItems = await mgr.getRepository(Item).find({ select: ['id', 'code'] });
        const codeToCurrentId = new Map<string, string>(currentItems.map((i) => [i.code, i.id]));

        const resolveItemId = (backupItemId: string | null): string | null => {
          const currentId = codeToCurrentId.get(backupItemIdToCode.get(backupItemId ?? '') ?? '');
          return currentId ?? backupItemId; // Fallback: gleiche ID (Items aus Backup)
        };

        const resolvedLevels = data.stockLevels
          .map((sl) => {
            const itemId = resolveItemId(sl.itemId);
            return {
              id: sl.id,
              item: itemId != null ? { id: itemId } : null,
              vehicle: sl.vehicleId ? { id: sl.vehicleId } : null,
              location: sl.locationId ? { id: sl.locationId } : null,
              quantity: sl.quantity, targetQuantity: sl.targetQuantity,
            };
          })
          .filter((sl): sl is typeof sl & { item: { id: string } } => sl.item != null);
        if (resolvedLevels.length > 0) await mgr.getRepository(StockLevel).save(resolvedLevels);
      }

      if (sections.includes('stockMovements') && data.stockMovements && data.stockMovements.length > 0) {
        const backupItemIdToCode = new Map<string, string>(
          (data.items ?? []).map((i) => [i.id, i.code]),
        );
        const currentItems = await mgr.getRepository(Item).find({ select: ['id', 'code'] });
        const codeToCurrentId = new Map<string, string>(currentItems.map((i) => [i.code, i.id]));
        const resolveItemId = (backupItemId: string): string =>
          codeToCurrentId.get(backupItemIdToCode.get(backupItemId) ?? '') ?? backupItemId;

        await mgr.getRepository(StockMovement).save(
          data.stockMovements
            .filter((sm) => sm.itemId)
            .map((sm) => ({
              id: sm.id, type: sm.type, item: { id: resolveItemId(sm.itemId) },
              vehicle: sm.vehicleId ? { id: sm.vehicleId } : null,
              location: sm.locationId ? { id: sm.locationId } : null,
              user: sm.userId ? { id: sm.userId } : null,
              quantity: sm.quantity, occurredAt: sm.occurredAt,
              createdAt: sm.createdAt ?? undefined,
              note: sm.note, source: sm.source,
              isVoided: sm.isVoided ?? false,
              voidedAt: sm.voidedAt ?? null,
              voidedBy: sm.voidedBy ?? null,
              voidReason: sm.voidReason ?? null,
            }))
        );
      }

      if (sections.includes('inventorySessions')) {
        if (data.inventorySessions && data.inventorySessions.length > 0) await mgr.getRepository(InventorySession).save(data.inventorySessions);
        if (data.inventoryLines && data.inventoryLines.length > 0) {
          await mgr.getRepository(InventoryLine).save(data.inventoryLines.map((il) => ({
            id: il.id, session: { id: il.sessionId as string }, item: { id: il.itemId as string },
            vehicle: il.vehicleId ? { id: il.vehicleId } : null,
            location: il.locationId ? { id: il.locationId } : null,
            expectedQuantity: il.expectedQuantity, countedQuantity: il.countedQuantity, note: il.note,
          })));
        }
      }

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    if (sections.includes('purchaseOrders') && data.purchaseOrderPdfs && data.purchaseOrderPdfs.length > 0) {
      await this.restorePurchaseOrderPdfs(data.purchaseOrderPdfs);
    }
    if (sections.includes('items') && data.itemImages && data.itemImages.length > 0) {
      await this.restoreItemImages(data.itemImages);
    }
  }

  private applyRestoreFilters(
    data: BackupData,
    filters?: RestoreFilters,
  ): BackupData {
    if (!filters) return data;
    const result: BackupData = { ...data };

    // Branch filter: nur Daten der gewählten Niederlassung (plus branchId=null Daten)
    if (filters.targetBranchId) {
      const bId = filters.targetBranchId;
      if (result.locations) result.locations = result.locations.filter((l) => !l.branchId || l.branchId === bId);
      if (result.items)     result.items     = result.items.filter((i) => !i.branchId || i.branchId === bId);
      if (result.itemCodes) result.itemCodes = result.itemCodes.filter((ic) => !ic.branchId || ic.branchId === bId);
      if (result.users)     result.users     = result.users.filter((u) => !u.branchId || u.branchId === bId);
    }

    // Fahrzeugfilter: Fahrzeuge + fahrzeugbasierte Bestände + Buchungshistorie
    if (filters.vehicleIds?.length) {
      const vIds = new Set(filters.vehicleIds);
      if (result.vehicles)       result.vehicles       = result.vehicles.filter((v) => vIds.has(v.id));
      if (result.stockLevels)    result.stockLevels    = result.stockLevels.filter((sl) => !!sl.vehicleId && vIds.has(sl.vehicleId));
      if (result.stockMovements) result.stockMovements = result.stockMovements.filter((sm) => !!sm.vehicleId && vIds.has(sm.vehicleId));
    }

    // Lagerortfilter: lagerbasierte Bestände + Artikel nach Lagerort
    if (filters.locationIds?.length) {
      const lIds = new Set(filters.locationIds);
      if (result.stockLevels) result.stockLevels = result.stockLevels.filter((sl) => !!sl.locationId && lIds.has(sl.locationId));
      if (result.items) {
        result.items = result.items.filter((i) => !!i.storageLocationId && lIds.has(i.storageLocationId));
        const filteredItemIds = new Set(result.items.map((i) => i.id));
        if (result.itemCodes) result.itemCodes = result.itemCodes.filter((ic) => ic.itemId != null && filteredItemIds.has(ic.itemId));
      }
    }

    return result;
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
  private saveBackupToFile(backup: BackupPayload, type: 'auto' | 'manual'): string {
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
    time: string;
    lastBackup?: string;
    retentionDays?: number;
    maxAutoBackups?: number;
  }> {
    try {
      const [enabledConfig, frequencyConfig, timeConfig, lastBackupConfig, retentionConfig, maxCountConfig] =
        await Promise.all([
          this.configRepository.findOne({ where: { key: 'backup.auto.enabled' } }),
          this.configRepository.findOne({ where: { key: 'backup.auto.frequency' } }),
          this.configRepository.findOne({ where: { key: 'backup.auto.time' } }),
          this.configRepository.findOne({ where: { key: 'backup.auto.lastBackup' } }),
          this.configRepository.findOne({ where: { key: 'backup.auto.retentionDays' } }),
          this.configRepository.findOne({ where: { key: 'backup.auto.maxAutoBackups' } }),
        ]);

      return {
        enabled: enabledConfig?.value === 'true',
        frequency: (frequencyConfig?.value as 'daily' | 'weekly' | 'monthly' | undefined) || 'daily',
        time: timeConfig?.value || '02:00',
        lastBackup: lastBackupConfig?.value,
        retentionDays: retentionConfig?.value ? parseInt(retentionConfig.value, 10) : 30,
        maxAutoBackups: maxCountConfig?.value ? parseInt(maxCountConfig.value, 10) : undefined,
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
    maxAutoBackups?: number;
  }): Promise<void> {
    await this.loggingService.setConfig('backup.auto.enabled', config.enabled.toString(), 'Automatisches Backup aktiviert');
    await this.loggingService.setConfig('backup.auto.frequency', config.frequency, 'Backup-Häufigkeit (daily, weekly, monthly)');
    await this.loggingService.setConfig('backup.auto.time', config.time, 'Backup-Uhrzeit (HH:MM)');

    if (config.retentionDays !== undefined) {
      await this.loggingService.setConfig('backup.auto.retentionDays', config.retentionDays.toString(), 'Backup-Aufbewahrungsdauer in Tagen');
    }
    if (config.maxAutoBackups !== undefined) {
      await this.loggingService.setConfig('backup.auto.maxAutoBackups', config.maxAutoBackups.toString(), 'Maximale Anzahl Auto-Backups');
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
      LogCategory.SYSTEM,
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
    this.firstTimeout = setTimeout(() => {
      void (async () => {
        await this.performAutoBackup();

        // Nach dem ersten Backup, setze Intervall basierend auf Frequenz
        const intervalMs = this.getIntervalMs(config.frequency);
        this.backupInterval = setInterval(() => {
          void this.performAutoBackup();
        }, intervalMs);
      })();
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
        LogCategory.SYSTEM,
        'AUTO_BACKUP_COMPLETED',
        `Automatisches Backup erfolgreich erstellt: ${filename}`
      );

      this.logger.log(`Automatisches Backup erfolgreich gespeichert: ${filepath}`);
    } catch (error) {
      this.logger.error('Fehler beim automatischen Backup:', error);

      await this.loggingService.logError(
        LogCategory.SYSTEM,
        'AUTO_BACKUP_FAILED',
        `Automatisches Backup fehlgeschlagen: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`
      );
    }
  }

  async saveManualBackup(backup: BackupPayload): Promise<string> {
    const filename = this.saveBackupToFile(backup, 'manual');
    await this.loggingService.logInfo(
      LogCategory.SYSTEM,
      'MANUAL_BACKUP_CREATED',
      `Manuelles Backup gespeichert: ${filename}`
    );
    return filename;
  }

  private async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      const config = await this.getAutoBackupConfig();
      const retentionDays = config.retentionDays || 30;
      const maxAutoBackups = config.maxAutoBackups;

      if (!fs.existsSync(backupDir)) return;

      const autoBackupFiles = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('auto-backup-') && f.endsWith('.json'))
        .map(f => ({ name: f, filepath: path.join(backupDir, f), mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.mtime - a.mtime); // neueste zuerst

      const now = Date.now();
      const maxAge = retentionDays * 24 * 60 * 60 * 1000;
      const toDelete = new Set<string>();

      // Altersbasiert: älter als retentionDays löschen
      autoBackupFiles.forEach((f, idx) => {
        if (now - f.mtime > maxAge) toDelete.add(f.filepath);
        // Anzahlbasiert: alles jenseits maxAutoBackups löschen (nach Alter sortiert, neueste behalten)
        if (maxAutoBackups !== undefined && idx >= maxAutoBackups) toDelete.add(f.filepath);
      });

      let deletedCount = 0;
      for (const filepath of toDelete) {
        try {
          fs.unlinkSync(filepath);
          deletedCount++;
        } catch (unlinkError) {
          this.logger.warn(`Backup-Datei konnte nicht geloescht werden (${filepath}):`, unlinkError);
        }
      }

      if (deletedCount > 0) {
        const reason = maxAutoBackups !== undefined
          ? `Limit: ${maxAutoBackups} Backups / ${retentionDays} Tage`
          : `älter als ${retentionDays} Tage`;
        await this.loggingService.logInfo(
          LogCategory.SYSTEM,
          'AUTO_BACKUP_CLEANUP',
          `${deletedCount} alte Backup-Dateien gelöscht (${reason})`
        );
        this.logger.log(`Backup-Bereinigung: ${deletedCount} alte Dateien geloescht`);
      }
    } catch (error) {
      this.logger.error('Fehler bei der Backup-Bereinigung:', error);
    }
  }

  async streamFullArchive(res: import('express').Response): Promise<void> {
    const zip = new AdmZip();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `lagerverwaltung-vollbackup-${timestamp}.zip`;

    const backup = await this.createBackup();
    // Passwort-Hashes werden aus dem Download-Backup entfernt (SEC-013, DSGVO).
    // createBackup() liefert users bereits ohne passwordHash — diese Bereinigung
    // ist ein zusaetzliches Sicherheitsnetz (defense-in-depth) falls sich das
    // je aendert. FIX: die Nutzerliste liegt unter backup.data.users, nicht
    // backup.users — der vorherige Pfad griff ins Leere und die Bereinigung
    // lief faktisch nie (kein aktives Datenleck, da createBackup() das Feld
    // ohnehin nie befuellt, aber das Sicherheitsnetz war damit wirkungslos).
    const sanitizedBackup: BackupPayload = {
      ...backup,
      data: {
        ...backup.data,
        users: (backup.data.users ?? []).map((u) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { passwordHash, ...rest } = u;
          return rest;
        }),
      },
    };
    zip.addFile('data.json', Buffer.from(JSON.stringify(sanitizedBackup, null, 2), 'utf8'));

    const imageDir = this.getItemImageStoragePath();
    if (fs.existsSync(imageDir)) {
      zip.addLocalFolder(imageDir, 'item-images');
    }

    const pdfDir = this.getPurchaseOrderStoragePath();
    if (fs.existsSync(pdfDir)) {
      zip.addLocalFolder(pdfDir, 'purchase-orders');
    }

    const buffer: Buffer = zip.toBuffer();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  async restoreFromArchive(buffer: Buffer): Promise<void> {
    const zip = new AdmZip(buffer);

    const dataEntry = zip.getEntry('data.json');
    if (!dataEntry) throw new Error('data.json nicht im Archiv gefunden');
    const backup = JSON.parse(dataEntry.getData().toString('utf8')) as BackupPayload;
    await this.restoreBackup(backup);

    const imageDir = this.getItemImageStoragePath();
    const pdfDir = this.getPurchaseOrderStoragePath();

    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = entry.entryName;

      if (name.startsWith('item-images/')) {
        const filename = path.basename(name);
        if (!filename) continue;
        const VALID_IMAGE = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/i;
        if (!VALID_IMAGE.test(filename)) continue;
        fs.mkdirSync(imageDir, { recursive: true });
        fs.writeFileSync(path.join(imageDir, filename), entry.getData());
      } else if (name.startsWith('purchase-orders/')) {
        const filename = path.basename(name);
        if (!filename) continue;
        const VALID_PDF = /^[0-9a-f-]{36}\.pdf$/i;
        if (!VALID_PDF.test(filename)) continue;
        fs.mkdirSync(pdfDir, { recursive: true });
        fs.writeFileSync(path.join(pdfDir, filename), entry.getData());
      }
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
    // Kein DB-/IO-Await nötig (nur synchrone fs-Zugriffe); await hält die Methode als Promise-API konsistent zu anderen Backup-Methoden.
    await Promise.resolve();
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
    // Kein DB-/IO-Await nötig (nur synchrone fs-Zugriffe); await hält die Methode als Promise-API konsistent zu anderen Backup-Methoden.
    await Promise.resolve();
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
      LogCategory.SYSTEM,
      'AUTO_BACKUP_DELETED',
      `Backup-Datei manuell gelöscht: ${filename}`
    );
  }

  async createSqlDump(): Promise<string> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      const lines: string[] = [];
      const ts = new Date().toISOString();

      lines.push(`-- Lagerverwaltung MySQL Dump`);
      lines.push(`-- Erstellt: ${ts}`);
      lines.push(`-- Server: ${String(this.dataSource.options.database)}`);
      lines.push(``);
      lines.push(`SET FOREIGN_KEY_CHECKS=0;`);
      lines.push(`SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';`);
      lines.push(`SET NAMES utf8mb4;`);
      lines.push(``);

      const tableRows = (await qr.query(`SHOW TABLES`)) as Array<{ Tables_in_db: string }>;
      const tableNames = tableRows.map(r => Object.values(r)[0]);

      for (const table of tableNames) {
        lines.push(`-- ----------------------------`);
        lines.push(`-- Tabelle: ${table}`);
        lines.push(`-- ----------------------------`);
        lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);

        const [createResult] = (await qr.query(`SHOW CREATE TABLE \`${table}\``)) as Array<Record<string, string>>;
        const createSql = createResult['Create Table'];
        lines.push(`${createSql};`);
        lines.push(``);

        const rows = (await qr.query(`SELECT * FROM \`${table}\``)) as Record<string, unknown>[];
        if (rows.length === 0) {
          lines.push(`-- (keine Datensätze)`);
          lines.push(``);
          continue;
        }

        const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
        const BATCH = 200;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          const values = batch.map(row =>
            `(${Object.values(row).map(v => this.escapeSqlValue(v)).join(', ')})`
          ).join(',\n  ');
          lines.push(`INSERT INTO \`${table}\` (${cols}) VALUES`);
          lines.push(`  ${values};`);
        }
        lines.push(``);
      }

      lines.push(`SET FOREIGN_KEY_CHECKS=1;`);
      lines.push(`-- Dump Ende: ${new Date().toISOString()}`);

      return lines.join('\n');
    } finally {
      await qr.release();
    }
  }

  private escapeSqlValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value instanceof Date) return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
    if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;
    const str = String(value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\0/g, '\\0');
    return `'${str}'`;
  }

  private getPurchaseOrderStoragePath(): string {
    return (process.env.PURCHASE_ORDER_STORAGE_PATH || '/app/purchase-orders').trim();
  }

  private async collectPurchaseOrderPdfs(): Promise<Array<{ relativePath: string; data: string }>> {
    const storageDir = this.getPurchaseOrderStoragePath();
    const result: Array<{ relativePath: string; data: string }> = [];

    const scan = async (dir: string): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.pdf')) {
          try {
            const data = await fs.promises.readFile(fullPath);
            result.push({
              relativePath: path.relative(storageDir, fullPath).replace(/\\/g, '/'),
              data: data.toString('base64'),
            });
          } catch { /* skip unreadable files */ }
        }
      }
    };

    await scan(storageDir);
    return result;
  }

  private async restorePurchaseOrderPdfs(pdfs: Array<{ relativePath: string; data: string }>): Promise<void> {
    const storageDir = this.getPurchaseOrderStoragePath();
    for (const pdf of pdfs) {
      try {
        const normalized = path.normalize(pdf.relativePath);
        if (normalized.startsWith('..') || path.isAbsolute(normalized)) continue;
        const fullPath = path.join(storageDir, normalized);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, Buffer.from(pdf.data, 'base64'));
      } catch { /* skip individual failures */ }
    }
  }

  private getItemImageStoragePath(): string {
    return (process.env.ITEM_IMAGE_PATH || '/app/item-images').trim();
  }

  private async collectItemImages(): Promise<Array<{ filename: string; data: string }>> {
    const imageDir = this.getItemImageStoragePath();
    const result: Array<{ filename: string; data: string }> = [];
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(imageDir, { withFileTypes: true });
    } catch {
      return result;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.(jpg|jpeg|png|webp|gif)$/i.test(entry.name)) continue;
      try {
        const data = await fs.promises.readFile(path.join(imageDir, entry.name));
        result.push({ filename: entry.name, data: data.toString('base64') });
      } catch { /* skip unreadable */ }
    }
    return result;
  }

  private async restoreItemImages(images: Array<{ filename: string; data: string }>): Promise<void> {
    const imageDir = this.getItemImageStoragePath();
    await fs.promises.mkdir(imageDir, { recursive: true }).catch(() => {});
    for (const img of images) {
      try {
        if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/i.test(img.filename)) continue;
        await fs.promises.writeFile(path.join(imageDir, img.filename), Buffer.from(img.data, 'base64'));
      } catch { /* skip individual failures */ }
    }
  }
}
