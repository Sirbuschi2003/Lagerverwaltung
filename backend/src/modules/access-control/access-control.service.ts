import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";

import { USER_ROLES } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { Permission } from "./entities/permission.entity";
import { Role } from "./entities/role.entity";
import { RolePermission } from "./entities/role-permission.entity";
import { UserPermission } from "./entities/user-permission.entity";

const DEFAULT_PERMISSIONS: Array<{ key: string; description: string }> = [
  // Ansichten
  { key: "dashboard.view", description: "Dashboard sehen" },
  { key: "fleet.view", description: "Fahrzeugbestände sehen" },
  { key: "items.view", description: "Artikelübersicht sehen" },
  { key: "myvehicle.view", description: "Eigenes Fahrzeug sehen" },
  { key: "scanner.use", description: "Scanner nutzen" },
  { key: "sync.use", description: "Offline-Sync nutzen" },
  { key: "quick-booking.use", description: "Schnellbuchung nutzen" },
  
  // Artikel (Items) - Granular
  { key: "items.create", description: "Artikel anlegen" },
  { key: "items.edit", description: "Artikel bearbeiten" },
  { key: "items.delete", description: "Artikel löschen" },
  
  // Fahrzeuge - Granular
  { key: "vehicles.view", description: "Fahrzeuge ansehen" },
  { key: "vehicles.create", description: "Fahrzeuge anlegen" },
  { key: "vehicles.edit", description: "Fahrzeuge bearbeiten" },
  { key: "vehicles.delete", description: "Fahrzeuge löschen" },

  // Lagerorte
  { key: "locations.view", description: "Lagerorte ansehen" },
  { key: "locations.create", description: "Lagerorte anlegen" },
  { key: "locations.edit", description: "Lagerorte bearbeiten" },
  { key: "locations.delete", description: "Lagerorte loeschen" },
  
  // Benutzer - Granular
  { key: "users.view", description: "Benutzer ansehen" },
  { key: "users.create", description: "Benutzer anlegen" },
  { key: "users.edit", description: "Benutzer bearbeiten" },
  { key: "users.delete", description: "Benutzer löschen" },
  
  // Bestand
  { key: "stock.read", description: "Bestaende und Bewegungen lesen" },
  { key: "stock.write", description: "Bestaende buchen (Ein/Aus)" },
  { key: "stock.manage", description: "Bestand verwalten/klonen" },
  { key: "movements.view", description: "Bewegungsverlauf anzeigen" },
  { key: "movements.cleanup", description: "Bewegungsverlauf bereinigen" },
  
  // Restock
  { key: "restock.view", description: "Restock-Anfragen ansehen" },
  { key: "restock.create", description: "Restock-Anfragen erstellen" },
  { key: "restock.edit", description: "Restock-Anfragen bearbeiten" },
  { key: "restock.manage", description: "Restock-Anfragen verwalten" },
  { key: "restock.delete", description: "Restock-Anfragen löschen" },

  // Lieferanten
  { key: "suppliers.view", description: "Lieferanten ansehen" },
  { key: "suppliers.create", description: "Lieferanten anlegen" },
  { key: "suppliers.edit", description: "Lieferanten bearbeiten" },
  { key: "suppliers.delete", description: "Lieferanten loeschen" },

  // Bestellungen
  { key: "orders.view", description: "Bestellungen ansehen" },
  { key: "orders.create", description: "Bestellungen anlegen" },
  { key: "orders.edit", description: "Bestellungen bearbeiten" },
  { key: "orders.receive", description: "Wareneingang buchen" },
  { key: "orders.send", description: "Bestellungen versenden" },
  { key: "orders.delete", description: "Bestellungen loeschen" },
  
  // Inventur
  { key: "inventory.view", description: "Inventuren ansehen" },
  { key: "inventory.create", description: "Inventuren erstellen" },
  { key: "inventory.execute", description: "Inventuren durchführen" },
  { key: "inventory.manage", description: "Inventuren verwalten" },
  { key: "inventory.finalize", description: "Inventuren abschließen" },
  { key: "inventory.template", description: "Inventur-Vorlagen verwalten" },
  
  // Reports
  { key: "reports.view", description: "Reports ansehen" },
  { key: "reports.export", description: "Reports exportieren" },
  
  // Einstellungen
  { key: "settings.company", description: "Firmendaten aendern" },
  { key: "settings.email", description: "E-Mail-Konfiguration aendern" },
  { key: "backup.access", description: "Backups erstellen/verwenden" },
  { key: "logs.view", description: "Systemprotokolle ansehen" },
  { key: "access.manage", description: "Rollen- und Rechteverwaltung" },
];

// Permissions, die nur für bestimmte Rollen gelten sollen (werden beim Bootstrap gesäubert)
const RESTRICTED_PERMISSIONS: Record<string, string[]> = {
  "backup.access": ["MANAGER"],
};

const ROLE_DEFAULTS: Record<string, string[]> = {
  MANAGER: DEFAULT_PERMISSIONS.map((p) => p.key),
  WAREHOUSE: [
    "dashboard.view",
    "fleet.view",
    "users.view",
    "items.view",
    "items.create",
    "items.edit",
    "scanner.use",
    "quick-booking.use",
    "vehicles.view",
    "locations.view",
    "locations.create",
    "locations.edit",
    "locations.delete",
    "suppliers.view",
    "suppliers.create",
    "suppliers.edit",
    "suppliers.delete",
    "orders.view",
    "orders.create",
    "orders.edit",
    "orders.receive",
    "orders.send",
    "orders.delete",
    "stock.read",
    "stock.write",
    "stock.manage",
    "restock.view",
    "restock.create",
    "restock.edit",
    "restock.manage",
    "movements.view",
    "inventory.view",
    "inventory.create",
    "inventory.execute",
  ],
  TECHNICIAN: [
    "dashboard.view",
    "myvehicle.view",
    "stock.read",
    "items.create",
    "items.view",
    "items.edit",
    "stock.write",
    "vehicles.view",
    "inventory.view",
    "inventory.execute",
    "inventory.manage",
    "sync.use",
    "scanner.use",
  ],
};

@Injectable()
export class AccessControlService implements OnModuleInit {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermRepo: Repository<RolePermission>,
    @InjectRepository(UserPermission)
    private readonly userPermRepo: Repository<UserPermission>,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    try {
      await this.bootstrapPermissions();
      await this.bootstrapRoles();
      this.logger.log("AccessControl bootstrap completed");
    } catch (error) {
      this.logger.error("AccessControl bootstrap failed", error as any);
    }
  }

  private async bootstrapPermissions(): Promise<void> {
    const existing = await this.permissionRepo.find();
    const existingKeys = new Set(existing.map((p) => p.key));

    const toInsert = DEFAULT_PERMISSIONS.filter((p) => !existingKeys.has(p.key));
    if (toInsert.length > 0) {
      await this.permissionRepo.save(toInsert);
      this.logger.log(`Added ${toInsert.length} permissions`);
    }
  }

  private async bootstrapRoles(): Promise<void> {
    // Ensure system roles exist
    const existingRoles = await this.roleRepo.find();
    const existingMap = new Map(existingRoles.map((r) => [r.name, r]));

    for (const r of USER_ROLES) {
      if (!existingMap.has(r)) {
        await this.roleRepo.save({ name: r, description: `${r} default role`, isSystem: true });
      } else {
        // Mark existing system roles
        const role = existingMap.get(r);
        if (role && !role.isSystem) {
          await this.roleRepo.update(role.id, { isSystem: true });
        }
      }
    }

    // Assign default permissions
    const perms = await this.permissionRepo.find();
    const permMap = new Map(perms.map((p) => [p.key, p]));

    for (const roleName of USER_ROLES) {
      const role = await this.roleRepo.findOne({ where: { name: roleName } });
      if (!role) continue;

      const desiredPerms = new Set(ROLE_DEFAULTS[roleName] || []);
      const desiredIds = Array.from(desiredPerms).map((key) => permMap.get(key)?.id).filter(Boolean) as number[];

      const existingRolePerms = await this.rolePermRepo.find({ where: { roleId: role.id } });
      const existingIds = new Set(existingRolePerms.map((rp) => rp.permissionId));

      const toAdd = desiredIds.filter((id) => !existingIds.has(id));
      const toRemove = existingRolePerms.filter((rp) => !desiredIds.includes(rp.permissionId)).map((rp) => rp.id);

      if (toRemove.length > 0) {
        await this.rolePermRepo.delete(toRemove);
      }
      if (toAdd.length > 0) {
        const newRolePerms = toAdd.map((pid) => ({ roleId: role.id, permissionId: pid }));
        await this.rolePermRepo.save(newRolePerms);
      }
    }

    await this.cleanupRestrictedPermissions();

    // Optional sanity check for users with unknown roles
    const users = await this.usersService.findAll();
    for (const user of users) {
      if (!ROLE_DEFAULTS[user.role]) {
        this.logger.warn(`Unknown role on user ${user.username}: ${user.role}`);
      }
    }
  }

  async listPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { key: "ASC" } });
  }

  /**
   * Entfernt Rechte, die nicht zu einer Rolle gehören dürfen (z. B. backup.access nur für MANAGER).
   */
  private async cleanupRestrictedPermissions(): Promise<void> {
    const allRoles = await this.roleRepo.find();
    const permMap = new Map((await this.permissionRepo.find()).map((p) => [p.key, p.id]));

    for (const [permKey, allowedRoles] of Object.entries(RESTRICTED_PERMISSIONS)) {
      const permId = permMap.get(permKey);
      if (!permId) continue;

      const allowedIds = allRoles.filter((r) => allowedRoles.includes(r.name)).map((r) => r.id);

      // Role-Permissions löschen, falls Rolle nicht erlaubt
      const toDeleteRolePerms = await this.rolePermRepo.find({
        where: { permissionId: permId },
      });
      const forbiddenRolePermIds = toDeleteRolePerms
        .filter((rp) => !allowedIds.includes(rp.roleId))
        .map((rp) => rp.id);
      if (forbiddenRolePermIds.length > 0) {
        await this.rolePermRepo.delete(forbiddenRolePermIds);
      }

      // User-Overrides löschen, falls Rolle nicht erlaubt
      const forbiddenUserOverrides = await this.userPermRepo
        .createQueryBuilder("up")
        .leftJoinAndSelect("up.permission", "perm")
        .leftJoin("users", "u", "u.id = up.userId")
        .where("up.permissionId = :permId", { permId })
        .andWhere("u.role NOT IN (:...allowed)", { allowed: allowedRoles })
        .getMany();

      const forbiddenOverrideIds = forbiddenUserOverrides.map((up) => up.id);
      if (forbiddenOverrideIds.length > 0) {
        await this.userPermRepo.delete(forbiddenOverrideIds);
      }
    }
  }

  async listRolesWithPermissions(): Promise<Array<{ id: number; name: string; description?: string | null; permissions: string[]; isSystem: boolean }>> {
    const roles = await this.roleRepo.find();
    const rolePerms = await this.rolePermRepo.find({ relations: ["permission"] });
    const permsByRole = new Map<number, string[]>();
    rolePerms.forEach((rp) => {
      const list = permsByRole.get(rp.roleId) || [];
      list.push(rp.permission.key);
      permsByRole.set(rp.roleId, list);
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: permsByRole.get(role.id) ?? [],
      isSystem: role.isSystem,
    }));
  }

  async createRole(name: string, description?: string): Promise<Role> {
    const existing = await this.roleRepo.findOne({ where: { name } });
    if (existing) {
      throw new BadRequestException(`Role ${name} already exists`);
    }
    const role = await this.roleRepo.save({ name, description: description ?? null, isSystem: false });
    return role;
  }

  async updateRole(roleId: number, name?: string, description?: string): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    if (role.isSystem && name && name !== role.name) {
      throw new BadRequestException(`Cannot rename system role ${role.name}`);
    }
    if (name) role.name = name;
    if (description !== undefined) role.description = description;
    return this.roleRepo.save(role);
  }

  async deleteRole(roleId: number): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }
    if (role.isSystem) {
      throw new BadRequestException(`Cannot delete system role ${role.name}`);
    }
    // Check if any users have this role
    const usersWithRole = await this.usersService.findAll();
    const hasUsers = usersWithRole.some((u) => u.role === role.name);
    if (hasUsers) {
      throw new BadRequestException(`Cannot delete role ${role.name}: users are still assigned to it`);
    }
    // Delete role permissions
    await this.rolePermRepo.delete({ roleId: role.id });
    // Delete role
    await this.roleRepo.delete(role.id);
  }

  async setRolePermissions(roleName: string, permissionKeys: string[]): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }
    const { allowed, rejected } = this.filterAndValidateRestricted(role.name, permissionKeys);
    if (rejected.length > 0) {
      throw new BadRequestException(
        `Die Rolle ${role.name} darf diese Berechtigungen nicht besitzen: ${rejected.join(", ")}`,
      );
    }
    const uniqueKeys = Array.from(new Set(allowed));
    const permissions = await this.permissionRepo.find({ where: { key: In(uniqueKeys) } });
    const validIds = permissions.map((p) => p.id);

    const existing = await this.rolePermRepo.find({ where: { roleId: role.id } });
    const existingIds = new Set(existing.map((rp) => rp.permissionId));

    const toRemove = existing.filter((rp) => !validIds.includes(rp.permissionId)).map((rp) => rp.id);
    if (toRemove.length > 0) {
      await this.rolePermRepo.delete(toRemove);
    }

    const toAdd = validIds.filter((id) => !existingIds.has(id)).map((id) => ({ roleId: role.id, permissionId: id }));
    if (toAdd.length > 0) {
      await this.rolePermRepo.save(toAdd);
    }

    return permissions.map((p) => p.key);
  }

  async getUserOverrides(userId: string): Promise<{ grants: string[]; denials: string[] }> {
    const overrides = await this.userPermRepo.find({ where: { userId }, relations: ["permission"] });
    return {
      grants: overrides.filter((up) => up.grant).map((up) => up.permission.key),
      denials: overrides.filter((up) => !up.grant).map((up) => up.permission.key),
    };
  }

  async setUserOverrides(
    userId: string,
    grantKeys: string[],
    denyKeys: string[] = [],
  ): Promise<{ grants: string[]; denials: string[] }> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const { allowed: allowedGrants, rejected: rejectedGrants } = this.filterAndValidateRestricted(user.role, grantKeys);
    if (rejectedGrants.length > 0) {
      throw new BadRequestException(
        `Die Rolle ${user.role} darf diese Berechtigungen nicht besitzen: ${rejectedGrants.join(", ")}`,
      );
    }

    const uniqueGrants = Array.from(new Set(allowedGrants));
    const uniqueDenials = Array.from(new Set(denyKeys));

    const allKeys = [...uniqueGrants, ...uniqueDenials];
    const allPerms = allKeys.length > 0
      ? await this.permissionRepo.find({ where: { key: In(allKeys) } })
      : [];
    const permMap = new Map(allPerms.map((p) => [p.key, p.id]));

    await this.userPermRepo.delete({ userId });

    const toInsert = [
      ...uniqueGrants.filter((k) => permMap.has(k)).map((k) => ({ userId, permissionId: permMap.get(k)!, grant: true })),
      ...uniqueDenials.filter((k) => permMap.has(k)).map((k) => ({ userId, permissionId: permMap.get(k)!, grant: false })),
    ];

    if (toInsert.length > 0) {
      await this.userPermRepo.save(toInsert);
    }

    const saved = await this.userPermRepo.find({ where: { userId }, relations: ["permission"] });
    return {
      grants: saved.filter((up) => up.grant).map((up) => up.permission.key),
      denials: saved.filter((up) => !up.grant).map((up) => up.permission.key),
    };
  }

  async getPermissionsForRole(roleName: string): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { name: roleName } });
    if (!role) return [];
    const rolePerms = await this.rolePermRepo.find({ where: { roleId: role.id }, relations: ["permission"] });
    return this.filterRestricted(role.name, rolePerms.map((rp) => rp.permission.key));
  }

  async getEffectivePermissionsForUser(userId: string, roleName: string): Promise<string[]> {
    const rolePerms = await this.getPermissionsForRole(roleName);
    const userOverrides = await this.userPermRepo.find({ where: { userId }, relations: ["permission"] });
    const set = new Set(rolePerms);
    // Apply GRANTs first, then remove DENYs
    userOverrides.filter((up) => up.grant).forEach((up) => set.add(up.permission.key));
    userOverrides.filter((up) => !up.grant).forEach((up) => set.delete(up.permission.key));
    return this.filterRestricted(roleName, Array.from(set));
  }

  async getEffectivePermissionsForUserId(userId: string): Promise<{
    role: string;
    permissions: string[];
    overrides: string[];
    denials: string[];
  }> {
    const user = await this.usersService.findOneById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const [{ grants, denials }, permissions] = await Promise.all([
      this.getUserOverrides(userId),
      this.getEffectivePermissionsForUser(userId, user.role),
    ]);
    const filteredGrants = this.filterRestricted(user.role, grants);
    const filtered = this.filterRestricted(user.role, permissions);
    return { role: user.role, permissions: filtered, overrides: filteredGrants, denials };
  }

  private filterRestricted(role: string, permissions: string[]): string[] {
    return permissions.filter((perm) => {
      const allowed = RESTRICTED_PERMISSIONS[perm];
      return !allowed || allowed.includes(role);
    });
  }

  /**
   * Verhindert, dass verbotene Berechtigungen gespeichert werden (Datenhygiene).
   */
  private filterAndValidateRestricted(
    role: string,
    permissions: string[],
  ): { allowed: string[]; rejected: string[] } {
    const allowed: string[] = [];
    const rejected: string[] = [];

    for (const perm of permissions) {
      const allowedRoles = RESTRICTED_PERMISSIONS[perm];
      if (allowedRoles && !allowedRoles.includes(role)) {
        rejected.push(perm);
      } else {
        allowed.push(perm);
      }
    }

    return { allowed, rejected };
  }
}
