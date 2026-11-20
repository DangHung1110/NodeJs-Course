import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Server } from 'node:net';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { configureApp } from '../../src/app.setup';
import { ArticlesController } from '../../src/articles/articles.controller';
import { JwtStrategy } from '../../src/auth/jwt.strategy';
import { RedisService } from '../../src/auth/redis.service';
import { CommentsController } from '../../src/comments/comments.controller';
import { CommentsService } from '../../src/comments/comments.service';
import {
  CommentResponse,
  CommentsEnvelopeResponse,
} from '../../src/comments/comment-response';
import { CommentEntity } from '../../src/database/entities/comment.entity';
import { AddComments1731500000000 } from '../../src/database/migrations/1731500000000-AddComments';
import { OptionalJwtAuthGuard } from '../../src/profiles/optional-jwt-auth.guard';
import { TagsController } from '../../src/tags/tags.controller';
import { TagsService } from '../../src/tags/tags.service';
import { UsersService } from '../../src/users/users.service';
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

describeMysql('Articles and comments MySQL integration', () => {
  let dataSource: DataSource;
  let articlesService: ArticlesService;
  let articleQueryService: ArticleQueryService;
  let app: INestApplication;
  let server: Server;
  const jwtSecret = randomUUID();
  const jwt = new JwtService({ secret: jwtSecret });
  const revokedTokens = new Set<string>();

  function token(userId: string): string {
    return jwt.sign(
      { sub: userId, jti: randomUUID(), type: 'access', version: 0 },
      { expiresIn: '5m' },
    );
  }

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
        CommentEntity,
      ],
      migrations: [
        CreateUsers1731100000000,
        AddAuthVerificationFields1731200000000,
        AddFollowsAndAttachments1731300000000,
        AddArticlesTagsAndFavorites1731400000000,
        AddComments1731500000000,
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
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [CommentsController, TagsController, ArticlesController],
      providers: [
        CommentsService,
        TagsService,
        OptionalJwtAuthGuard,
        JwtStrategy,
        { provide: ArticlesService, useValue: articlesService },
        {
          provide: getRepositoryToken(CommentEntity),
          useValue: dataSource.getRepository(CommentEntity),
        },
        {
          provide: getRepositoryToken(ArticleEntity),
          useValue: dataSource.getRepository(ArticleEntity),
        },
        {
          provide: getRepositoryToken(TagEntity),
          useValue: dataSource.getRepository(TagEntity),
        },
        {
          provide: UsersService,
          useValue: {
            findById: (id: string) =>
              dataSource.getRepository(UserEntity).findOneBy({ id }),
          },
        },
        {
          provide: RedisService,
          useValue: {
            isRevoked: (jti: string) => Promise.resolve(revokedTokens.has(jti)),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'JWT_SECRET') return jwtSecret;
              throw new Error(`Unexpected configuration key: ${key}`);
            },
            get: (key: string, fallback: unknown) =>
              key === 'NODE_ENV' ? 'production' : fallback,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    revokedTokens.clear();
    for (const table of [
      'comments',
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

  async function createArticle(
    authorId: string,
    title = 'Comments article',
  ): Promise<string> {
    const result = await articlesService.create(authorId, {
      title,
      description: 'Description',
      body: 'Body',
      tagList: ['typescript', 'nestjs'],
    });
    return result.article.slug;
  }

  it('runs the comment HTTP lifecycle with real JWT, ownership, following and isolation', async () => {
    const articleOwner = await createUser('owner');
    const commenter = await createUser('commenter');
    const slug = await createArticle(articleOwner);
    const otherSlug = await createArticle(articleOwner, 'Other article');
    const ownerToken = token(articleOwner);
    const commenterToken = token(commenter);
    const route = `/api/articles/${slug}/comments`;

    await request(server).get(route).expect(200, { comments: [] });
    await request(server)
      .post(route)
      .send({ comment: { body: 'Comment' } })
      .expect(401);
    await request(server)
      .post(route)
      .set('Authorization', `Token ${commenterToken}`)
      .send({ comment: { body: 'Comment', authorId: articleOwner } })
      .expect(422);
    await request(server)
      .post('/api/articles/missing/comments')
      .set('Authorization', `Token ${commenterToken}`)
      .send({ comment: { body: 'Comment' } })
      .expect(404);
    const created = await request(server)
      .post(route)
      .set('Authorization', `Token ${commenterToken}`)
      .send({ comment: { body: '  First comment  ' } })
      .expect(201);
    const comment = (created.body as { comment: CommentResponse }).comment;
    expect(typeof comment.id).toBe('string');
    expect(typeof comment.createdAt).toBe('string');
    expect(typeof comment.updatedAt).toBe('string');
    expect(comment).toMatchObject({
      body: 'First comment',
      author: {
        username: 'commenter',
        bio: null,
        image: null,
        following: false,
      },
    });
    const stored = await dataSource
      .getRepository(CommentEntity)
      .findOneByOrFail({ id: comment.id });
    expect(stored.authorId).toBe(commenter);

    await dataSource
      .getRepository(FollowEntity)
      .insert({ followerId: articleOwner, followingId: commenter });
    await request(server)
      .get(route)
      .expect(200)
      .expect(({ body }: { body: CommentsEnvelopeResponse }) => {
        expect(body.comments).toHaveLength(1);
        expect(body.comments[0]?.author.following).toBe(false);
      });
    await request(server)
      .get(route)
      .set('Authorization', `Token ${ownerToken}`)
      .expect(200)
      .expect(({ body }: { body: CommentsEnvelopeResponse }) => {
        expect(body.comments[0]?.author.following).toBe(true);
      });
    await request(server)
      .get(`/api/articles/${otherSlug}/comments`)
      .expect(200, { comments: [] });
    await request(server).delete(`${route}/${comment.id}`).expect(401);
    await request(server)
      .delete(`${route}/${comment.id}`)
      .set('Authorization', `Token ${ownerToken}`)
      .expect(403);
    await request(server)
      .delete(`/api/articles/${otherSlug}/comments/${comment.id}`)
      .set('Authorization', `Token ${commenterToken}`)
      .expect(404);
    await request(server)
      .delete(`${route}/${comment.id}`)
      .set('Authorization', `Token ${commenterToken}`)
      .expect(204, '');
    await request(server)
      .delete(`${route}/${comment.id}`)
      .set('Authorization', `Token ${commenterToken}`)
      .expect(404);
    await request(server).get(route).expect(200, { comments: [] });
    await request(server).get('/api/articles/missing/comments').expect(404);
    await request(server)
      .delete(`/api/articles/missing/comments/${comment.id}`)
      .set('Authorization', `Token ${commenterToken}`)
      .expect(404);
  });

  it('rejects invalid, expired and revoked tokens through the real JWT strategy', async () => {
    const authorId = await createUser('author');
    const slug = await createArticle(authorId);
    const route = `/api/articles/${slug}/comments`;
    const revokedJti = randomUUID();
    revokedTokens.add(revokedJti);
    const invalidTokens = [
      'invalid',
      jwt.sign(
        { sub: authorId, jti: randomUUID(), type: 'access', version: 0 },
        { expiresIn: -1 },
      ),
      jwt.sign(
        { sub: authorId, jti: revokedJti, type: 'access', version: 0 },
        { expiresIn: '5m' },
      ),
    ];
    for (const invalidToken of invalidTokens) {
      await request(server)
        .get(route)
        .set('Authorization', `Token ${invalidToken}`)
        .expect(401);
      await request(server)
        .post(route)
        .set('Authorization', `Token ${invalidToken}`)
        .send({ comment: { body: 'Comment' } })
        .expect(401);
    }
    await expect(dataSource.getRepository(CommentEntity).count()).resolves.toBe(
      0,
    );
  });

  it('orders comments by newest timestamp and UUID, without duplicates or private fields', async () => {
    const authorId = await createUser('author');
    const slug = await createArticle(authorId);
    const article = await dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ slug });
    const firstId = '00000000-0000-4000-8000-000000000001';
    const secondId = '00000000-0000-4000-8000-000000000002';
    const thirdId = '00000000-0000-4000-8000-000000000003';
    await dataSource.getRepository(CommentEntity).insert([
      {
        id: firstId,
        body: 'Oldest',
        authorId,
        articleId: article.id,
        createdAt: new Date('2026-11-18T00:00:00Z'),
      },
      {
        id: secondId,
        body: 'Newer A',
        authorId,
        articleId: article.id,
        createdAt: new Date('2026-11-19T00:00:00Z'),
      },
      {
        id: thirdId,
        body: 'Newer B',
        authorId,
        articleId: article.id,
        createdAt: new Date('2026-11-19T00:00:00Z'),
      },
    ]);
    await request(server)
      .get(`/api/articles/${slug}/comments`)
      .expect(200)
      .expect(({ body }: { body: CommentsEnvelopeResponse }) => {
        expect(body.comments.map((comment) => comment.id)).toEqual([
          thirdId,
          secondId,
          firstId,
        ]);
        for (const comment of body.comments) {
          expect(Object.keys(comment).sort()).toEqual([
            'author',
            'body',
            'createdAt',
            'id',
            'updatedAt',
          ]);
          expect(Object.keys(comment.author).sort()).toEqual([
            'bio',
            'following',
            'image',
            'username',
          ]);
        }
      });
  });

  it('lists unique sorted tags and preserves them when an article is deleted', async () => {
    await request(server).get('/api/tags').expect(200, { tags: [] });
    const authorId = await createUser('author');
    const slug = await createArticle(authorId);
    await createArticle(authorId, 'Another tagged article');
    await request(server)
      .get('/api/tags')
      .expect(200, { tags: ['nestjs', 'typescript'] });
    await articlesService.delete(slug, authorId);
    await request(server)
      .get('/api/tags')
      .expect(200, { tags: ['nestjs', 'typescript'] });
  });

  it('applies, reverts and reapplies the comments migration while preserving existing data', async () => {
    const authorId = await createUser('author');
    const slug = await createArticle(authorId);
    const runner = dataSource.createQueryRunner();
    try {
      const table = await runner.getTable('comments');
      expect(
        table?.foreignKeys
          .map((key) => [key.referencedTableName, key.onDelete])
          .sort(),
      ).toEqual([
        ['articles', 'CASCADE'],
        ['users', 'CASCADE'],
      ]);
      expect(table?.indices.map((index) => index.name)).toEqual(
        expect.arrayContaining([
          'IDX_comments_article_created',
          'IDX_comments_author',
        ]),
      );
      expect(
        table?.columns.find((column) => column.name === 'id')?.length,
      ).toBe('36');
      await dataSource.undoLastMigration();
      await expect(runner.hasTable('comments')).resolves.toBe(false);
      await expect(
        dataSource.getRepository(ArticleEntity).findOneBy({ slug }),
      ).resolves.toMatchObject({ slug });
      await expect(dataSource.getRepository(UserEntity).count()).resolves.toBe(
        1,
      );
      await dataSource.runMigrations();
      await expect(runner.hasTable('comments')).resolves.toBe(true);
      await expect(
        dataSource.getRepository(ArticleEntity).count(),
      ).resolves.toBe(1);
    } finally {
      await runner.release();
    }
  });

  it('enforces foreign keys and cascades only dependent comments', async () => {
    const ownerId = await createUser('owner');
    const commenterId = await createUser('commenter');
    const firstSlug = await createArticle(ownerId);
    const secondSlug = await createArticle(ownerId, 'Preserved article');
    const first = await dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ slug: firstSlug });
    const second = await dataSource
      .getRepository(ArticleEntity)
      .findOneByOrFail({ slug: secondSlug });
    const comments = dataSource.getRepository(CommentEntity);
    await expect(
      comments.insert({
        body: 'Invalid article',
        authorId: commenterId,
        articleId: randomUUID(),
      }),
    ).rejects.toMatchObject({
      driverError: { code: 'ER_NO_REFERENCED_ROW_2' },
    });
    await expect(
      comments.insert({
        body: 'Invalid author',
        authorId: randomUUID(),
        articleId: first.id,
      }),
    ).rejects.toMatchObject({
      driverError: { code: 'ER_NO_REFERENCED_ROW_2' },
    });
    await comments.insert([
      {
        body: 'Deleted with article',
        authorId: commenterId,
        articleId: first.id,
      },
      { body: 'Preserved comment', authorId: ownerId, articleId: second.id },
      {
        body: 'Deleted with commenter',
        authorId: commenterId,
        articleId: second.id,
      },
    ]);
    await request(server)
      .delete(`/api/articles/${firstSlug}`)
      .set('Authorization', `Token ${token(ownerId)}`)
      .expect(204);
    await expect(comments.count()).resolves.toBe(2);
    await dataSource.getRepository(UserEntity).delete(commenterId);
    await expect(comments.count()).resolves.toBe(1);
    await expect(dataSource.getRepository(ArticleEntity).count()).resolves.toBe(
      1,
    );
    await expect(dataSource.getRepository(TagEntity).count()).resolves.toBe(2);
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
