import { MigrationInterface, QueryRunner } from 'typeorm';

const DROP_COMMENTS_TABLE_SQL = 'DROP TABLE comments';

export class AddComments1731500000000 implements MigrationInterface {
  name = 'AddComments1731500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE comments (
        id char(36) NOT NULL,
        body text NOT NULL,
        article_id char(36) NOT NULL,
        author_id char(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX IDX_comments_article_created (article_id, created_at, id),
        INDEX IDX_comments_author (author_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_comments_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        CONSTRAINT FK_comments_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_COMMENTS_TABLE_SQL);
  }
}
