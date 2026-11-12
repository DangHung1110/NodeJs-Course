import { MigrationInterface, QueryRunner } from 'typeorm';

const DROP_ATTACHMENTS_TABLE_SQL = 'DROP TABLE attachments';
const DROP_FOLLOWS_TABLE_SQL = 'DROP TABLE follows';

export class AddFollowsAndAttachments1731300000000 implements MigrationInterface {
  name = 'AddFollowsAndAttachments1731300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE follows (
        id char(36) NOT NULL,
        follower_id char(36) NOT NULL,
        following_id char(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX UQ_follows_follower_following (follower_id, following_id),
        INDEX IDX_follows_following_id (following_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_follows_follower FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_follows_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE attachments (
        id char(36) NOT NULL,
        owner_type enum('user-avatar') NOT NULL,
        owner_id char(36) NOT NULL,
        url text NOT NULL,
        file_name varchar(255) NOT NULL,
        file_type varchar(100) NOT NULL,
        file_size int unsigned NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_attachments_owner (owner_type, owner_id),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_ATTACHMENTS_TABLE_SQL);
    await queryRunner.query(DROP_FOLLOWS_TABLE_SQL);
  }
}
