import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Fulltext-Index auf items für performante Freitextsuche.
 * Ersetzt den langsamen LIKE %...% Full-Table-Scan bei Suchen >= 3 Zeichen.
 */
export class AddFulltextIndexItems1740000000003 implements MigrationInterface {
  name = "AddFulltextIndexItems1740000000003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`items\` ADD FULLTEXT INDEX \`idx_items_fulltext\` (\`description\`, \`manufacturer\`, \`productGroup\`)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`items\` DROP INDEX \`idx_items_fulltext\``
    );
  }
}
