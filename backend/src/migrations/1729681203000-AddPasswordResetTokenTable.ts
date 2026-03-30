import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddPasswordResetTokenTable1729681203000 implements MigrationInterface {
  name = 'AddPasswordResetTokenTable1729681203000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'token',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'expiresAt',
            type: 'datetime',
          },
          {
            name: 'used',
            type: 'boolean',
            default: false,
          },
          {
            name: 'requestedFromIp',
            type: 'varchar',
            length: '45',
            isNullable: true,
          },
          {
            name: 'usedAt',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [
          {
            name: 'IDX_password_reset_token',
            columnNames: ['token'],
          },
          {
            name: 'IDX_password_reset_user_expires',
            columnNames: ['userId', 'expiresAt'],
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_reset_tokens');
  }
}