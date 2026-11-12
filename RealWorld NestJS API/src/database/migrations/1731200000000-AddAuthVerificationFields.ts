import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthVerificationFields1731200000000 implements MigrationInterface {
  name = 'AddAuthVerificationFields1731200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD token_version int unsigned NOT NULL DEFAULT 0 AFTER image,
      ADD is_active tinyint(1) NOT NULL DEFAULT 1 AFTER token_version,
      ADD email_verified_at datetime(6) NULL AFTER is_active
    `);
    await queryRunner.query(`
      UPDATE users
      SET email_verified_at = created_at
      WHERE email_verified_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN email_verified_at,
      DROP COLUMN is_active,
      DROP COLUMN token_version
    `);
  }
}
