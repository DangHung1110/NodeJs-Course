import { MigrationInterface, QueryRunner } from 'typeorm';

const DROP_USERS_TABLE_SQL = 'DROP TABLE users';

export class CreateUsers1731100000000 implements MigrationInterface {
  name = 'CreateUsers1731100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id char(36) NOT NULL,
        username varchar(50) NOT NULL,
        email varchar(254) NOT NULL,
        password_hash varchar(255) NOT NULL,
        bio text NULL,
        image text NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX UQ_users_username (username),
        UNIQUE INDEX UQ_users_email (email),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_USERS_TABLE_SQL);
  }
}
