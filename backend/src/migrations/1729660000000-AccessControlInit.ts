import { MigrationInterface, QueryRunner } from "typeorm";

export class AccessControlInit1729660000000 implements MigrationInterface {
  name = "AccessControlInit1729660000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        perm_key VARCHAR(150) NOT NULL UNIQUE,
        description VARCHAR(255) NULL
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255) NULL
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        roleId INT NOT NULL,
        permissionId INT NOT NULL,
        UNIQUE KEY role_perm_unique (roleId, permissionId),
        CONSTRAINT fk_role_permissions_role FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_perm FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId CHAR(36) NOT NULL,
        permissionId INT NOT NULL,
        UNIQUE KEY user_perm_unique (userId, permissionId),
        CONSTRAINT fk_user_permissions_perm FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    const perms: Array<[string, string]> = [
      ["stock.read", "Bestaende und Bewegungen lesen"],
      ["stock.write", "Bestaende buchen (Ein/Aus)"],
      ["movements.view", "Bewegungsverlauf anzeigen"],
      ["restock.manage", "Restock-Anfragen verwalten"],
      ["vehicles.manage", "Fahrzeuge verwalten"],
      ["users.manage", "Benutzer verwalten"],
      ["inventory.manage", "Inventuren durchfuehren/verwalten"],
      ["settings.company", "Firmendaten aendern"],
      ["settings.email", "E-Mail-Konfiguration aendern"],
      ["backup.access", "Backups erstellen/verwenden"],
      ["logs.view", "Systemprotokolle ansehen"],
      ["movements.cleanup", "Bewegungsverlauf bereinigen"],
    ];

    for (const [key, desc] of perms) {
      await queryRunner.query(
        `INSERT IGNORE INTO permissions (perm_key, description) VALUES (?, ?)`,
        [key, desc]
      );
    }

    const roles: Array<[string, string]> = [
      ["MANAGER", "Manager default role"],
      ["WAREHOUSE", "Warehouse default role"],
      ["TECHNICIAN", "Technician default role"],
    ];

    for (const [name, desc] of roles) {
      await queryRunner.query(`INSERT IGNORE INTO roles (name, description) VALUES (?, ?)`, [name, desc]);
    }

    const rolePerms: Record<string, string[]> = {
      MANAGER: perms.map((p) => p[0]),
      WAREHOUSE: ["stock.read", "stock.write", "restock.manage", "movements.view", "movements.cleanup"],
      TECHNICIAN: ["stock.read", "stock.write", "movements.view"],
    };

    const extractRows = (raw: any): any[] => {
      if (Array.isArray(raw)) {
        if (raw.length > 0 && Array.isArray(raw[0])) return raw[0];
        return raw;
      }
      return [];
    };

    const permRows = extractRows(await queryRunner.query(`SELECT id, perm_key as permKey FROM permissions`));
    const permIdByKey = new Map<string, number>(permRows.map((p: any) => [p.permKey, p.id]));

    const roleRows = extractRows(await queryRunner.query(`SELECT id, name FROM roles`));
    const roleIdByName = new Map<string, number>(roleRows.map((r: any) => [r.name, r.id]));

    for (const roleName of Object.keys(rolePerms)) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) continue;
      for (const permKey of rolePerms[roleName]) {
        const permId = permIdByKey.get(permKey);
        if (!permId) continue;
        await queryRunner.query(
          `INSERT IGNORE INTO role_permissions (roleId, permissionId) VALUES (?, ?)`,
          [roleId, permId]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS role_permissions`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS permissions`);
  }
}
