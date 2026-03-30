import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixInventoryLinesColumns1731005400000 implements MigrationInterface {
  name = 'FixInventoryLinesColumns1731005400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if actualQuantity column exists and countedQuantity doesn't
    const hasActualQuantity = await queryRunner.hasColumn('inventory_lines', 'actualQuantity');
    const hasCountedQuantity = await queryRunner.hasColumn('inventory_lines', 'countedQuantity');

    if (hasActualQuantity && !hasCountedQuantity) {
      // Rename actualQuantity to countedQuantity
      await queryRunner.query(`ALTER TABLE \`inventory_lines\` CHANGE \`actualQuantity\` \`countedQuantity\` int NOT NULL`);
    }

    // Ensure expectedQuantity exists
    const hasExpectedQuantity = await queryRunner.hasColumn('inventory_lines', 'expectedQuantity');
    if (!hasExpectedQuantity) {
      await queryRunner.query(`ALTER TABLE \`inventory_lines\` ADD \`expectedQuantity\` int NOT NULL`);
    }

    // Ensure note column exists and is nullable
    const hasNote = await queryRunner.hasColumn('inventory_lines', 'note');
    if (!hasNote) {
      await queryRunner.query(`ALTER TABLE \`inventory_lines\` ADD \`note\` varchar(255) NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse the changes - rename countedQuantity back to actualQuantity
    const hasCountedQuantity = await queryRunner.hasColumn('inventory_lines', 'countedQuantity');
    const hasActualQuantity = await queryRunner.hasColumn('inventory_lines', 'actualQuantity');

    if (hasCountedQuantity && !hasActualQuantity) {
      await queryRunner.query(`ALTER TABLE \`inventory_lines\` CHANGE \`countedQuantity\` \`actualQuantity\` int NOT NULL`);
    }
  }
}