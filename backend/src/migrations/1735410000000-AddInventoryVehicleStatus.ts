import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInventoryVehicleStatus1735410000000 implements MigrationInterface {
  name = "AddInventoryVehicleStatus1735410000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inventory_vehicle_status (
        id char(36) NOT NULL,
        status enum('DRAFT', 'SUBMITTED') NOT NULL DEFAULT 'DRAFT',
        submittedBy varchar(128),
        submittedAt datetime,
        adjustmentsApplied boolean NOT NULL DEFAULT false,
        sessionId char(36) NOT NULL,
        vehicleId char(36) NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY idx_session_vehicle (sessionId, vehicleId),
        CONSTRAINT fk_session FOREIGN KEY (sessionId) REFERENCES inventory_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_vehicle FOREIGN KEY (vehicleId) REFERENCES vehicles(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS inventory_vehicle_status`);
  }
}
