import { Permission } from "../access-control/entities/permission.entity";
import { RolePermission } from "../access-control/entities/role-permission.entity";
import { Role } from "../access-control/entities/role.entity";
import { UserPermission } from "../access-control/entities/user-permission.entity";
import { Branch } from "../branches/entities/branch.entity";
import { InventorySession } from "../inventory/entities/inventory-session.entity";
import { ItemCodeKind } from "../items/entities/item-code.entity";
import { LocationType } from "../locations/entities/location.entity";
import { BranchConfig } from "../logging/entities/branch-config.entity";
import { SystemConfig } from "../logging/entities/system-config.entity";
import { PurchaseOrderStatus } from "../purchasing/entities/purchase-order.entity";
import { StockMovementType } from "../stock/entities/stock-movement.entity";
import { Supplier } from "../suppliers/entities/supplier.entity";
import { Vehicle } from "../vehicles/entities/vehicle.entity";

/**
 * Typed shape of the JSON backup payload produced by SetupService#createBackup
 * and consumed by SetupService#restoreBackup / #restoreSelective.
 *
 * These types intentionally mirror the flattened, relation-free shape that is
 * written to the backup file (foreign keys as plain `xxxId` strings instead of
 * loaded relations) — NOT the TypeORM entity shapes.
 */

export interface BackupUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  /**
   * SEC-013: passwordHash is intentionally omitted from download backups
   * (sanitizedBackup in streamFullArchive). Server-side auto/manual JSON
   * backups written via createBackup() never include it either — restore
   * always falls back to a locked sentinel value when absent.
   */
  passwordHash?: string;
  role: string;
  vehicleId: string | null;
  branchId: string | null;
  refreshInterval: number | null;
  locationIds?: string[];
}

export interface BackupItem {
  id: string;
  code: string;
  branchId: string | null;
  description: string;
  descriptionSecondary: string | null;
  manufacturer: string;
  productGroup: string;
  qrCodeValue: string | null;
  targetStock: number;
  minimumStock: number | null;
  reorderPoint: number | null;
  price: string | null;
  packSize: number | null;
  orderQuantity: number | null;
  imagePath: string | null;
  createdAt: Date;
  updatedAt: Date;
  storageLocationId: string | null;
  supplierId: string | null;
  // Relations are stripped out of the backup shape and replaced by the *Id fields above.
  storageLocation?: undefined;
  supplier?: undefined;
}

export interface BackupPurchaseOrder {
  id: string;
  supplierId: string | null;
  status: PurchaseOrderStatus;
  orderNumber: string | null;
  orderedAt: Date | null;
  receivedAt: Date | null;
  note: string | null;
  deliveryNoteNumber: string | null;
  branchId: string | null;
  locationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupPurchaseOrderLine {
  id: string;
  orderId: string | null;
  itemId: string | null;
  quantity: number;
  receivedQuantity: number;
  packSize: number | null;
}

export interface BackupLocation {
  id: string;
  type: LocationType;
  code: string;
  name: string | null;
  parentId: string | null;
  vehicleId: string | null;
  branchId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupStockLevel {
  id: string;
  itemId: string | null;
  vehicleId: string | null;
  locationId: string | null;
  quantity: number;
  targetQuantity: number;
}

export interface BackupStockMovement {
  id: string;
  type: StockMovementType;
  itemId: string;
  vehicleId: string | null;
  locationId: string | null;
  quantity: number;
  userId: string | null;
  occurredAt: Date;
  createdAt: Date;
  note: string | null;
  source: string;
  isVoided: boolean;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
}

export interface BackupInventoryLine {
  id: string;
  sessionId: string | null;
  itemId: string | null;
  vehicleId: string | null;
  locationId: string | null;
  expectedQuantity: number;
  countedQuantity: number;
  note: string | null;
}

export interface BackupItemCode {
  id: string;
  branchId: string;
  code: string;
  kind: ItemCodeKind;
  itemId: string | null;
}

export interface BackupPurchaseOrderPdf {
  relativePath: string;
  data: string;
}

export interface BackupItemImage {
  filename: string;
  data: string;
}

export interface BackupData {
  branches?: Branch[];
  branchConfigs?: BranchConfig[];
  systemConfigs?: SystemConfig[];
  roles?: Role[];
  permissions?: Permission[];
  rolePermissions?: RolePermission[];
  userPermissions?: UserPermission[];
  users?: BackupUser[];
  items?: BackupItem[];
  vehicles?: Vehicle[];
  suppliers?: Supplier[];
  purchaseOrders?: BackupPurchaseOrder[];
  purchaseOrderLines?: BackupPurchaseOrderLine[];
  locations?: BackupLocation[];
  stockLevels?: BackupStockLevel[];
  stockMovements?: BackupStockMovement[];
  inventorySessions?: InventorySession[];
  inventoryLines?: BackupInventoryLine[];
  itemCodes?: BackupItemCode[];
  purchaseOrderPdfs?: BackupPurchaseOrderPdf[];
  itemImages?: BackupItemImage[];
}

export interface BackupPayload {
  version: string;
  timestamp: string;
  data: BackupData;
}

export interface RestoreFilters {
  targetBranchId?: string | null;
  vehicleIds?: string[] | null;
  locationIds?: string[] | null;
}
