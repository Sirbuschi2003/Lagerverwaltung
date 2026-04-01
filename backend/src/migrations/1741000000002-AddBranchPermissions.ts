import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranchPermissions1741000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const perms: Array<[string, string]> = [
      ["branches.view", "Niederlassungen ansehen"],
      ["branches.manage", "Niederlassungen verwalten (anlegen, bearbeiten, löschen)"],
    ];

    for (const [key, description] of perms) {
      await queryRunner.query(
        "INSERT IGNORE INTO `permissions` (`perm_key`, `description`) VALUES (?, ?)",
        [key, description],
      );
    }

    // MANAGER-Rolle bekommt beide Rechte (wenn die Rolle existiert)
    const managerRole = await queryRunner.query(
      "SELECT `id` FROM `roles` WHERE `name` = 'MANAGER' LIMIT 1",
    );
    if (managerRole.length > 0) {
      const roleId = managerRole[0].id;
      for (const [key] of perms) {
        const perm = await queryRunner.query(
          "SELECT `id` FROM `permissions` WHERE `perm_key` = ? LIMIT 1",
          [key],
        );
        if (perm.length > 0) {
          await queryRunner.query(
            "INSERT IGNORE INTO `role_permissions` (`roleId`, `permissionId`) VALUES (?, ?)",
            [roleId, perm[0].id],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const keys = ["branches.view", "branches.manage"];
    for (const key of keys) {
      await queryRunner.query("DELETE FROM `permissions` WHERE `perm_key` = ?", [key]);
    }
  }
}
