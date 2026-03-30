import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddRoleIsSystemColumn1735603200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "roles",
      new TableColumn({
        name: "is_system",
        type: "boolean",
        default: false,
      }),
    );

    // Mark existing system roles
    await queryRunner.query(`UPDATE roles SET is_system = true WHERE name IN ('MANAGER', 'WAREHOUSE', 'TECHNICIAN')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("roles", "is_system");
  }
}
