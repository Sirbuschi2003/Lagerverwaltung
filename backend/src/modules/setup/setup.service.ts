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
import { BranchConfig } from "../logging/entities/branch-config.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { PurchaseOrder } from "../purchasing/entities/purchase-order.entity";
import { PurchaseOrderLine } from "../purchasing/entities/purchase-order-line.entity";
import { Branch } from "../branches/entities/branch.entity";
import { Role } from "../access-control/entities/role.entity";
import { Permission } from "../access-control/entities/permission.entity";
import { RolePermission } from "../access-control/entities/role-permission.entity";
import { UserPermission } from "../access-control/entities/user-permission.entity";
import { ItemCode } from "../items/entities/item-code.entity";
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
  ) {
    // Starte automatisches Backup beim Initialisieren (mit Verzögerung, damit DB ready ist)
    setTimeout(() => this.initAutoBackup(), 5000);
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
          supplierId: (item as any).supplier?.id ?? (item as any).supplierId ?? null,
          supplier: undefined,
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
          deliveryNoteNumber: (order as any).deliveryNoteNumber ?? null,
          branchId: (order as any).branchId ?? null,
          locationId: (order as any).locationId ?? null,
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
          branchId: (location as any).branchId ?? null,
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
        stockMovements: stockMovements
          .filter(sm => sm.item != null)
          .map(sm => ({
            id: sm.id,
            type: sm.type,
            itemId: sm.item!.id,
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
        itemCodes: itemCodes.map(ic => ({
          id: ic.id,
          branchId: ic.branchId,
          code: ic.code,
          kind: ic.kind,
          itemId: (ic as any).item?.id ?? null,
        })),
        // Hinweis: Artikel-Bilder und Bestellungs-PDFs werden NICHT im JSON-Backup gesichert.
        // Diese liegen in Docker-Volumes und werden über die Volume-Backup-Infrastruktur (rsync/NAS) gesichert.
      },
    };
  }

  async restoreBackup(backup: any): Promise<void> {
    const { data } = backup;
    // branchId fallback: Lagerorte im Backup haben ggf. null (Altdaten vor Branch-Isolation)
    const fallbackBranchId = data.branches?.[0]?.id
      ?? data.locations?.find((l: any) => l.branchId)?.branchId
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

      if (data.branches?.length > 0) await mgr.getRepository(Branch).save(data.branches);
      if (data.permissions?.length > 0) await mgr.getRepository(Permission).save(data.permissions);
      if (data.roles?.length > 0) await mgr.getRepository(Role).save(data.roles);
      if (data.systemConfigs?.length > 0) await mgr.getRepository(SystemConfig).save(data.systemConfigs);
      if (data.branchConfigs?.length > 0) await mgr.getRepository(BranchConfig).save(data.branchConfigs);

      if (data.users?.length > 0) {
        await mgr.getRepository(User).save(data.users.map((u: any) => ({
          id: u.id, username: u.username, displayName: u.displayName,
          email: u.email ?? null, passwordHash: u.passwordHash, role: u.role,
          vehicleId: u.vehicleId ?? null, branchId: u.branchId ?? null,
          refreshInterval: u.refreshInterval, locations: [],
        })));
      }

      if (data.vehicles?.length > 0) await mgr.getRepository(Vehicle).save(data.vehicles);

      if (data.locations?.length > 0) {
        await mgr.getRepository(Location).save(data.locations.map((loc: any) => ({
          id: loc.id, type: loc.type, code: loc.code, name: loc.name ?? null,
          parent: null, vehicle: loc.vehicleId ? { id: loc.vehicleId } : null,
          branchId: loc.branchId ?? fallbackBranchId,
          createdAt: loc.createdAt, updatedAt: loc.updatedAt,
        })));
        const withParent = data.locations.filter((l: any) => l.parentId)
          .map((l: any) => ({ id: l.id, parent: { id: l.parentId } }));
        if (withParent.length > 0) await mgr.getRepository(Location).save(withParent);
      }

      if (data.users?.length > 0) {
        for (const u of data.users) {
          if (Array.isArray(u.locationIds) && u.locationIds.length > 0) {
            await mgr.getRepository(User).save({ id: u.id, locations: u.locationIds.map((lid: string) => ({ id: lid })) });
          }
        }
      }

      if (data.suppliers?.length > 0) await mgr.getRepository(Supplier).save(data.suppliers);

      if (data.items?.length > 0) {
        await mgr.getRepository(Item).save(data.items.map((item: any) => {
          const { storageLocationId, supplierId, ...rest } = item;
          return { ...rest, storageLocation: storageLocationId ? { id: storageLocationId } : null, supplier: supplierId ? { id: supplierId } : null };
        }));
      }

      if (data.itemCodes?.length > 0) {
        await mgr.getRepository(ItemCode).save(data.itemCodes.map((ic: any) => ({
          id: ic.id, branchId: ic.branchId, code: ic.code, kind: ic.kind,
          item: ic.itemId ? { id: ic.itemId } : null,
        })));
      }

      if (data.rolePermissions?.length > 0) await mgr.getRepository(RolePermission).save(data.rolePermissions);
      if (data.userPermissions?.length > 0) await mgr.getRepository(UserPermission).save(data.userPermissions);

      if (data.purchaseOrders?.length > 0) {
        await mgr.getRepository(PurchaseOrder).save(data.purchaseOrders.map((o: any) => ({
          id: o.id, supplier: o.supplierId ? { id: o.supplierId } : null,
          status: o.status, orderNumber: o.orderNumber, orderedAt: o.orderedAt,
          receivedAt: o.receivedAt, note: o.note ?? null,
          deliveryNoteNumber: o.deliveryNoteNumber ?? null,
          branchId: o.branchId ?? null,
          locationId: o.locationId ?? null,
          createdAt: o.createdAt, updatedAt: o.updatedAt,
        })));
      }

      if (data.purchaseOrderLines?.length > 0) {
        await mgr.getRepository(PurchaseOrderLine).save(data.purchaseOrderLines.map((l: any) => ({
          id: l.id, order: { id: l.orderId }, item: { id: l.itemId },
          quantity: l.quantity, receivedQuantity: l.receivedQuantity, packSize: l.packSize,
        })));
      }

      if (data.stockLevels?.length > 0) {
        await mgr.getRepository(StockLevel).save(data.stockLevels.map((sl: any) => ({
          id: sl.id, item: { id: sl.itemId },
          vehicle: sl.vehicleId ? { id: sl.vehicleId } : null,
          location: sl.locationId ? { id: sl.locationId } : null,
          quantity: sl.quantity, targetQuantity: sl.targetQuantity,
        })));
      }

      const validMovements = (data.stockMovements ?? []).filter((sm: any) => sm.itemId);
      if (validMovements.length > 0) {
        await mgr.getRepository(StockMovement).save(validMovements.map((sm: any) => ({
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

      if (data.inventorySessions?.length > 0) await mgr.getRepository(InventorySession).save(data.inventorySessions);

      if (data.inventoryLines?.length > 0) {
        await mgr.getRepository(InventoryLine).save(data.inventoryLines.map((il: any) => ({
          id: il.id, session: { id: il.sessionId }, item: { id: il.itemId },
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

    if (data.purchaseOrderPdfs?.length > 0) {
      await this.restorePurchaseOrderPdfs(data.purchaseOrderPdfs);
    }
    if (data.itemImages?.length > 0) {
      await this.restoreItemImages(data.itemImages);
    }
  }

  /**
   * Selektive Wiederherstellung einzelner Datenbereiche aus einem Backup.
   * Nur die gewählten Sektionen werden gelöscht und neu befüllt.
   * Abhängigkeiten (z.B. items für stockLevels) müssen bereits in der DB existieren.
   */
  async restoreSelective(
    backup: any,
    sections: string[],
    filters?: { targetBranchId?: string | null; vehicleIds?: string[] | null; locationIds?: string[] | null },
  ): Promise<void> {
    const rawData = backup.data;
    const fallbackBranchId = filters?.targetBranchId
      ?? rawData.branches?.[0]?.id
      ?? rawData.locations?.find((l: any) => l.branchId)?.branchId
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
        if (data.systemConfigs?.length > 0) await mgr.getRepository(SystemConfig).save(data.systemConfigs);
        if (data.branchConfigs?.length > 0) await mgr.getRepository(BranchConfig).save(data.branchConfigs);
      }

      if (sections.includes('users') && data.users?.length > 0) {
        await mgr.getRepository(User).save(data.users.map((u: any) => ({
          id: u.id, username: u.username, displayName: u.displayName,
          email: u.email ?? null, passwordHash: u.passwordHash, role: u.role,
          vehicleId: u.vehicleId ?? null, branchId: u.branchId ?? null,
          refreshInterval: u.refreshInterval, locations: [],
        })));
        if (data.rolePermissions?.length > 0) await mgr.getRepository(RolePermission).save(data.rolePermissions);
        if (data.userPermissions?.length > 0) await mgr.getRepository(UserPermission).save(data.userPermissions);
        for (const u of data.users) {
          if (Array.isArray(u.locationIds) && u.locationIds.length > 0) {
            await mgr.getRepository(User).save({ id: u.id, locations: u.locationIds.map((lid: string) => ({ id: lid })) });
          }
        }
      }

      if (sections.includes('vehicles') && data.vehicles?.length > 0) {
        await mgr.getRepository(Vehicle).save(data.vehicles);
      }

      if (sections.includes('locations') && data.locations?.length > 0) {
        await mgr.getRepository(Location).save(data.locations.map((loc: any) => ({
          id: loc.id, type: loc.type, code: loc.code, name: loc.name ?? null,
          parent: null, vehicle: loc.vehicleId ? { id: loc.vehicleId } : null,
          branchId: loc.branchId ?? fallbackBranchId,
          createdAt: loc.createdAt, updatedAt: loc.updatedAt,
        })));
        const withParent = data.locations.filter((l: any) => l.parentId)
          .map((l: any) => ({ id: l.id, parent: { id: l.parentId } }));
        if (withParent.length > 0) await mgr.getRepository(Location).save(withParent);
      }

      if (sections.includes('suppliers') && data.suppliers?.length > 0) {
        await mgr.getRepository(Supplier).save(data.suppliers);
      }

      if (sections.includes('items')) {
        if (data.items?.length > 0) {
          await mgr.getRepository(Item).save(data.items.map((item: any) => {
            const { storageLocationId, supplierId, ...rest } = item;
            return { ...rest, storageLocation: storageLocationId ? { id: storageLocationId } : null, supplier: supplierId ? { id: supplierId } : null };
          }));
        }
        if (data.itemCodes?.length > 0) {
          await mgr.getRepository(ItemCode).save(data.itemCodes.map((ic: any) => ({
            id: ic.id, branchId: ic.branchId, code: ic.code, kind: ic.kind,
            item: ic.itemId ? { id: ic.itemId } : null,
          })));
        }
      }

      if (sections.includes('purchaseOrders')) {
        if (data.purchaseOrders?.length > 0) {
          await mgr.getRepository(PurchaseOrder).save(data.purchaseOrders.map((o: any) => ({
            id: o.id, supplier: o.supplierId ? { id: o.supplierId } : null,
            status: o.status, orderNumber: o.orderNumber, orderedAt: o.orderedAt,
            receivedAt: o.receivedAt, note: o.note ?? null,
            deliveryNoteNumber: o.deliveryNoteNumber ?? null,
            branchId: o.branchId ?? fallbackBranchId,
            locationId: o.locationId ?? null,
            createdAt: o.createdAt, updatedAt: o.updatedAt,
          })));
        }
        if (data.purchaseOrderLines?.length > 0) {
          await mgr.getRepository(PurchaseOrderLine).save(data.purchaseOrderLines.map((l: any) => ({
            id: l.id, order: { id: l.orderId }, item: { id: l.itemId },
            quantity: l.quantity, receivedQuantity: l.receivedQuantity, packSize: l.packSize,
          })));
        }
      }

      if (sections.includes('stockLevels') && data.stockLevels?.length > 0) {
        // Backup-ItemIDs können von aktuellen DB-IDs abweichen (z.B. nach Hyreka-Import).
        // Mapping über Artikelcode: backup itemId → aktuelle DB itemId
        const backupItemIdToCode = new Map<string, string>(
          (data.items ?? []).map((i: any) => [i.id, i.code]),
        );
        const currentItems = await mgr.getRepository(Item).find({ select: ['id', 'code'] });
        const codeToCurrentId = new Map<string, string>(currentItems.map((i) => [i.code, i.id]));

        const resolveItemId = (backupItemId: string): string | null => {
          const currentId = codeToCurrentId.get(backupItemIdToCode.get(backupItemId) ?? '');
          return currentId ?? backupItemId; // Fallback: gleiche ID (Items aus Backup)
        };

        const resolvedLevels = data.stockLevels
          .map((sl: any) => ({
            id: sl.id,
            item: { id: resolveItemId(sl.itemId) },
            vehicle: sl.vehicleId ? { id: sl.vehicleId } : null,
            location: sl.locationId ? { id: sl.locationId } : null,
            quantity: sl.quantity, targetQuantity: sl.targetQuantity,
          }))
          .filter((sl: any) => sl.item.id != null);
        if (resolvedLevels.length > 0) await mgr.getRepository(StockLevel).save(resolvedLevels);
      }

      if (sections.includes('stockMovements') && data.stockMovements?.length > 0) {
        const backupItemIdToCode = new Map<string, string>(
          (data.items ?? []).map((i: any) => [i.id, i.code]),
        );
        const currentItems = await mgr.getRepository(Item).find({ select: ['id', 'code'] });
        const codeToCurrentId = new Map<string, string>(currentItems.map((i) => [i.code, i.id]));
        const resolveItemId = (backupItemId: string): string =>
          codeToCurrentId.get(backupItemIdToCode.get(backupItemId) ?? '') ?? backupItemId;

        await mgr.getRepository(StockMovement).save(
          data.stockMovements
            .filter((sm: any) => sm.itemId)
            .map((sm: any) => ({
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
        if (data.inventorySessions?.length > 0) await mgr.getRepository(InventorySession).save(data.inventorySessions);
        if (data.inventoryLines?.length > 0) {
          await mgr.getRepository(InventoryLine).save(data.inventoryLines.map((il: any) => ({
            id: il.id, session: { id: il.sessionId }, item: { id: il.itemId },
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

    if (sections.includes('purchaseOrders') && data.purchaseOrderPdfs?.length > 0) {
      await this.restorePurchaseOrderPdfs(data.purchaseOrderPdfs);
    }
    if (sections.includes('items') && data.itemImages?.length > 0) {
      await this.restoreItemImages(data.itemImages);
    }
  }

  private applyRestoreFilters(
    data: any,
    filters?: { targetBranchId?: string | null; vehicleIds?: string[] | null; locationIds?: string[] | null },
  ): any {
    if (!filters) return data;
    let result = { ...data };

    // Branch filter: nur Daten der gewählten Niederlassung (plus branchId=null Daten)
    if (filters.targetBranchId) {
      const bId = filters.targetBranchId;
      if (result.locations) result.locations = result.locations.filter((l: any) => !l.branchId || l.branchId === bId);
      if (result.items)     result.items     = result.items.filter((i: any) => !i.branchId || i.branchId === bId);
      if (result.itemCodes) result.itemCodes = result.itemCodes.filter((ic: any) => !ic.branchId || ic.branchId === bId);
      if (result.users)     result.users     = result.users.filter((u: any) => !u.branchId || u.branchId === bId);
    }

    // Fahrzeugfilter: Fahrzeuge + fahrzeugbasierte Bestände + Buchungshistorie
    if (filters.vehicleIds?.length) {
      const vIds = new Set(filters.vehicleIds);
      if (result.vehicles)       result.vehicles       = result.vehicles.filter((v: any) => vIds.has(v.id));
      if (result.stockLevels)    result.stockLevels    = result.stockLevels.filter((sl: any) => sl.vehicleId && vIds.has(sl.vehicleId));
      if (result.stockMovements) result.stockMovements = result.stockMovements.filter((sm: any) => sm.vehicleId && vIds.has(sm.vehicleId));
    }

    // Lagerortfilter: lagerbasierte Bestände + Artikel nach Lagerort
    if (filters.locationIds?.length) {
      const lIds = new Set(filters.locationIds);
      if (result.stockLevels) result.stockLevels = result.stockLevels.filter((sl: any) => sl.locationId && lIds.has(sl.locationId));
      if (result.items) {
        result.items = result.items.filter((i: any) => i.storageLocationId && lIds.has(i.storageLocationId));
        const filteredItemIds = new Set(result.items.map((i: any) => i.id));
        if (result.itemCodes) result.itemCodes = result.itemCodes.filter((ic: any) => filteredItemIds.has(ic.itemId));
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
        frequency: (frequencyConfig?.value as any) || 'daily',
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
          'SYSTEM' as any,
          'AUTO_BACKUP_CLEANUP',
          `${deletedCount} alte Backup-Dateien gelöscht (${reason})`
        );
        this.logger.log(`Backup-Bereinigung: ${deletedCount} alte Dateien geloescht`);
      }
    } catch (error: any) {
      this.logger.error('Fehler bei der Backup-Bereinigung:', error);
    }
  }

  async streamFullArchive(res: import('express').Response): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const archiverLib = require('archiver');
    const archiverFn: (format: string, opts?: object) => import('archiver').Archiver = archiverLib.default ?? archiverLib;
    const archive = archiverFn('zip', { zlib: { level: 6 } });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `lagerverwaltung-vollbackup-${timestamp}.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    archive.pipe(res);

    // Datenbankdaten als JSON
    const backup = await this.createBackup();
    archive.append(JSON.stringify(backup, null, 2), { name: 'data.json' });

    // Artikel-Bilder
    const imageDir = this.getItemImageStoragePath();
    if (fs.existsSync(imageDir)) {
      archive.directory(imageDir, 'item-images');
    }

    // Bestellungs-PDFs
    const pdfDir = this.getPurchaseOrderStoragePath();
    if (fs.existsSync(pdfDir)) {
      archive.directory(pdfDir, 'purchase-orders');
    }

    await archive.finalize();
  }

  async restoreFromArchive(buffer: Buffer): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AdmZip = require('adm-zip') as new (buffer: Buffer) => any;
    const zip = new AdmZip(buffer);

    const dataEntry = zip.getEntry('data.json');
    if (!dataEntry) throw new Error('data.json nicht im Archiv gefunden');
    const backup = JSON.parse(dataEntry.getData().toString('utf8'));
    await this.restoreBackup(backup);

    const imageDir = this.getItemImageStoragePath();
    const pdfDir = this.getPurchaseOrderStoragePath();

    for (const entry of zip.getEntries() as any[]) {
      if (entry.isDirectory) continue;
      const name = entry.entryName as string;

      if (name.startsWith('item-images/')) {
        const filename = path.basename(name);
        if (!filename) continue;
        fs.mkdirSync(imageDir, { recursive: true });
        fs.writeFileSync(path.join(imageDir, filename), entry.getData());
      } else if (name.startsWith('purchase-orders/')) {
        const filename = path.basename(name);
        if (!filename) continue;
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

  async createSqlDump(): Promise<string> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    try {
      const lines: string[] = [];
      const ts = new Date().toISOString();

      lines.push(`-- Lagerverwaltung MySQL Dump`);
      lines.push(`-- Erstellt: ${ts}`);
      lines.push(`-- Server: ${this.dataSource.options.database}`);
      lines.push(``);
      lines.push(`SET FOREIGN_KEY_CHECKS=0;`);
      lines.push(`SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';`);
      lines.push(`SET NAMES utf8mb4;`);
      lines.push(``);

      const tableRows: Array<{ Tables_in_db: string }> = await qr.query(`SHOW TABLES`);
      const dbName = this.dataSource.options.database as string;
      const tableNames = tableRows.map(r => Object.values(r)[0] as string);

      for (const table of tableNames) {
        lines.push(`-- ----------------------------`);
        lines.push(`-- Tabelle: ${table}`);
        lines.push(`-- ----------------------------`);
        lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);

        const [createResult]: Array<Record<string, string>> = await qr.query(`SHOW CREATE TABLE \`${table}\``);
        const createSql = createResult['Create Table'];
        lines.push(`${createSql};`);
        lines.push(``);

        const rows: Record<string, unknown>[] = await qr.query(`SELECT * FROM \`${table}\``);
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
