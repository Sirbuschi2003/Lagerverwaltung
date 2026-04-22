import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Composite indexes for the most frequent query patterns.
 * Prevents full-table-scans on stock_movements and items under multi-branch load.
 */
export class AddQueryPerformanceIndexes1745400000000 implements MigrationInterface {
  name = "AddQueryPerformanceIndexes1745400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // stock_movements: item history sorted by date (reports, article activity)
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_item_occurred\` ON \`stock_movements\` (\`itemId\`, \`occurredAt\`)`
    );
    // stock_movements: vehicle history sorted by date (vehicle detail view)
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_vehicle_occurred\` ON \`stock_movements\` (\`vehicleId\`, \`occurredAt\`)`
    );
    // stock_movements: type-filter (checkin/checkout/adjustment overview)
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_type\` ON \`stock_movements\` (\`type\`)`
    );
    // stock_movements: voided-filter (GoBD queries exclude voided records)
    await queryRunner.query(
      `CREATE INDEX \`idx_sm_is_voided\` ON \`stock_movements\` (\`isVoided\`)`
    );

    // items: purchase-suggestions query (targetStock > 0 per branch)
    await queryRunner.query(
      `CREATE INDEX \`idx_items_branch_target\` ON \`items\` (\`branchId\`, \`targetStock\`)`
    );

    // stock_levels: vehicle-based lookups (fleet overview, restock sync)
    await queryRunner.query(
      `CREATE INDEX \`idx_sl_vehicle\` ON \`stock_levels\` (\`vehicleId\`)`
    );
    // stock_levels: location-based lookups (warehouse stock aggregation)
    await queryRunner.query(
      `CREATE INDEX \`idx_sl_location\` ON \`stock_levels\` (\`locationId\`)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`idx_sl_location\` ON \`stock_levels\``);
    await queryRunner.query(`DROP INDEX \`idx_sl_vehicle\` ON \`stock_levels\``);
    await queryRunner.query(`DROP INDEX \`idx_items_branch_target\` ON \`items\``);
    await queryRunner.query(`DROP INDEX \`idx_sm_is_voided\` ON \`stock_movements\``);
    await queryRunner.query(`DROP INDEX \`idx_sm_type\` ON \`stock_movements\``);
    await queryRunner.query(`DROP INDEX \`idx_sm_vehicle_occurred\` ON \`stock_movements\``);
    await queryRunner.query(`DROP INDEX \`idx_sm_item_occurred\` ON \`stock_movements\``);
  }
}
