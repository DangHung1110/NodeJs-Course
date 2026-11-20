import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { ArticleQueryService } from '../../src/articles/article-query.service';
import { ArticlesService } from '../../src/articles/articles.service';
import { ArticleTagEntity } from '../../src/database/entities/article-tag.entity';
import { ArticleEntity } from '../../src/database/entities/article.entity';
import { AttachmentEntity } from '../../src/database/entities/attachment.entity';
import { FavoriteEntity } from '../../src/database/entities/favorite.entity';
import { FollowEntity } from '../../src/database/entities/follow.entity';
import { TagEntity } from '../../src/database/entities/tag.entity';
import { UserEntity } from '../../src/database/entities/user.entity';
import { AddArticlesTagsAndFavorites1731400000000 } from '../../src/database/migrations/1731400000000-AddArticlesTagsAndFavorites';
import { CreateUsers1731100000000 } from '../../src/database/migrations/1731100000000-CreateUsers';
import { AddAuthVerificationFields1731200000000 } from '../../src/database/migrations/1731200000000-AddAuthVerificationFields';
import { AddFollowsAndAttachments1731300000000 } from '../../src/database/migrations/1731300000000-AddFollowsAndAttachments';

const hasMysqlTestDatabase = Boolean(process.env.MYSQL_TEST_HOST);
const describeMysql = hasMysqlTestDatabase ? describe : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for MySQL integration tests.`);
  return value;
}

describeMysql('Articles MySQL integration', () => {
  let dataSource: DataSource;
  let articlesService: ArticlesService;
  let articleQueryService: ArticleQueryService;

  beforeAll(async () => {
    const database = requiredEnvironment('MYSQL_TEST_DATABASE');
    if (!database.endsWith('_test')) {
      throw new Error('MYSQL_TEST_DATABASE must end with _test.');
    }

    dataSource = new DataSource({
      type: 'mysql',
      host: requiredEnvironment('MYSQL_TEST_HOST'),
      port: Number(requiredEnvironment('MYSQL_TEST_PORT')),
      username: requiredEnvironment('MYSQL_TEST_USER'),
      password: requiredEnvironment('MYSQL_TEST_PASSWORD'),
      database,
      entities: [
        UserEntity,
        FollowEntity,
        AttachmentEntity,
        ArticleEntity,
        TagEntity,
        ArticleTagEntity,
        FavoriteEntity,
      ],
      migrations: [
        CreateUsers1731100000000,
        AddAuthVerificationFields1731200000000,
        AddFollowsAndAttachments1731300000000,
        AddArticlesTagsAndFavorites1731400000000,
      ],
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.dropDatabase();
    await dataSource.runMigrations();

    articleQueryService = new ArticleQueryService(
      dataSource.getRepository(ArticleEntity),
      dataSource.getRepository(TagEntity),
    );
    articlesService = new ArticlesService(dataSource, articleQueryService);
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    for (const table of [
      'favorites',
      'article_tags',
      'articles',
      'tags',
      'follows',
      'attachments',
      'users',
    ]) {
      await dataSource.query(`DELETE FROM ${table}`);
    }
  });

  async function createUser(username: string): Promise<string> {
    const id = randomUUID();
    await dataSource.getRepository(UserEntity).insert({
      id,
      username,
      email: `${username}@example.com`,
      passwordHash: 'integration-test-hash',
      bio: null,
      image: null,
      tokenVersion: 0,
      isActive: true,
      emailVerifiedAt: new Date(),
    });
    return id;
  }

  it('creates concurrent articles with shared tags without deadlocks', async () => {
    const authorId = await createUser('author');

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        articlesService.create(authorId, {
          title: `Concurrent article ${index}`,
          description: 'Description',
          body: 'Body',
          tagList: ['typescript', 'nestjs'],
        }),
      ),
    );

    expect(results).toHaveLength(5);
    await expect(dataSource.getRepository(TagEntity).count()).resolves.toBe(2);
    await expect(
      dataSource.getRepository(ArticleTagEntity).count(),
    ).resolves.toBe(10);
  });

  it('executes filters and pagination against MySQL with the total count', async () => {
    const authorId = await createUser('alice');
    const viewerId = await createUser('viewer');
    const first = await articlesService.create(authorId, {
      title: 'NestJS guide one',
      description: 'Query guide',
      body: 'Body one',
      tagList: ['nestjs'],
    });
    const second = await articlesService.create(authorId, {
      title: 'NestJS guide two',
      description: 'Query guide',
      body: 'Body two',
      tagList: ['nestjs'],
    });
    await articlesService.favorite(first.article.slug, viewerId);
    await articlesService.favorite(second.article.slug, viewerId);
    await dataSource
      .getRepository(ArticleEntity)
      .update(
        { slug: first.article.slug },
        { createdAt: new Date('2026-11-18T00:00:00.000Z') },
      );
    await dataSource
      .getRepository(ArticleEntity)
      .update(
        { slug: second.article.slug },
        { createdAt: new Date('2026-11-19T00:00:00.000Z') },
      );

    const result = await articleQueryService.list(
      {
        tag: 'nestjs',
        author: 'alice',
        favorited: 'viewer',
        search: 'guide',
        limit: 1,
        offset: 1,
      },
      viewerId,
    );

    expect(result.articlesCount).toBe(2);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]).toMatchObject({
      title: 'NestJS guide one',
      tagList: ['nestjs'],
      favorited: true,
      favoritesCount: 1,
      author: { username: 'alice' },
    });
  });
});
