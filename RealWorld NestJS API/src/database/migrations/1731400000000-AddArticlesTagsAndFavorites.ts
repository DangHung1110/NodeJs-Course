import { MigrationInterface, QueryRunner } from 'typeorm';

const DROP_FAVORITES_TABLE_SQL = 'DROP TABLE favorites';
const DROP_ARTICLE_TAGS_TABLE_SQL = 'DROP TABLE article_tags';
const DROP_TAGS_TABLE_SQL = 'DROP TABLE tags';
const DROP_ARTICLES_TABLE_SQL = 'DROP TABLE articles';

export class AddArticlesTagsAndFavorites1731400000000 implements MigrationInterface {
  name = 'AddArticlesTagsAndFavorites1731400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE articles (
        id char(36) NOT NULL,
        slug varchar(255) NOT NULL,
        title varchar(255) NOT NULL,
        description text NOT NULL,
        body longtext NOT NULL,
        author_id char(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX UQ_articles_slug (slug),
        INDEX IDX_articles_author_created (author_id, created_at),
        INDEX IDX_articles_created (created_at, id),
        PRIMARY KEY (id),
        CONSTRAINT FK_articles_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE tags (
        id char(36) NOT NULL,
        name varchar(50) NOT NULL,
        UNIQUE INDEX UQ_tags_name (name),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE article_tags (
        article_id char(36) NOT NULL,
        tag_id char(36) NOT NULL,
        INDEX IDX_article_tags_tag_article (tag_id, article_id),
        PRIMARY KEY (article_id, tag_id),
        CONSTRAINT FK_article_tags_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        CONSTRAINT FK_article_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await queryRunner.query(`
      CREATE TABLE favorites (
        id char(36) NOT NULL,
        user_id char(36) NOT NULL,
        article_id char(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX UQ_favorites_user_article (user_id, article_id),
        INDEX IDX_favorites_article (article_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_favorites_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_FAVORITES_TABLE_SQL);
    await queryRunner.query(DROP_ARTICLE_TAGS_TABLE_SQL);
    await queryRunner.query(DROP_TAGS_TABLE_SQL);
    await queryRunner.query(DROP_ARTICLES_TABLE_SQL);
  }
}
