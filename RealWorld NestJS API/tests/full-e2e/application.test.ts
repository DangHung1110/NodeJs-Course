import request from 'supertest';
import { readdir } from 'node:fs/promises';
import { AttachmentEntity } from '../../src/database/entities/attachment.entity';
import { CommentEntity } from '../../src/database/entities/comment.entity';
import { UserEntity } from '../../src/database/entities/user.entity';
import type { UserEnvelopeResponse } from '../../src/auth/auth.types';
import type { ArticleEnvelopeResponse } from '../../src/articles/article-response';
import type { CommentEnvelopeResponse } from '../../src/comments/comment-response';
import { E2eApp } from '../support/e2e-app';
import { FIXTURE_PASSWORD, seedBaseline } from '../support/seed';
import { assertTestDatabase, TEST_TABLES } from '../support/database-safety';

describe('Full application E2E (isolated MySQL and Redis)', () => {
  const context = new E2eApp();
  let fixtures: Awaited<ReturnType<typeof seedBaseline>>;
  beforeAll(() => context.start(), 60000);
  beforeEach(async () => {
    await context.reset();
    fixtures = await seedBaseline(context.ds!);
  });
  afterEach(async () => {
    if (!context.ready) return;
    await context.reset();
    for (const table of TEST_TABLES) {
      const rows: { count: string }[] = await context.ds!.query(
        `SELECT COUNT(*) AS count FROM ${table}`,
      );
      expect(Number(rows[0]?.count)).toBe(0);
    }
    expect(await context.redis!.keys(`${context.prefix}*`)).toEqual([]);
    expect(await readdir(context.uploadRoot)).toEqual([]);
  });
  afterAll(() => context.close());

  async function login(
    username = 'e2e_reader',
  ): Promise<UserEnvelopeResponse['user']> {
    const result = await request(context.server)
      .post('/api/users/login')
      .send({
        user: { email: `${username}@example.test`, password: FIXTURE_PASSWORD },
      })
      .expect(200);
    return (result.body as UserEnvelopeResponse).user;
  }

  it('registers, captures SMTP OTP, verifies, logs in, rotates refresh and revokes access', async () => {
    const email = 'registered@example.test';
    await request(context.server)
      .post('/api/users')
      .send({
        user: { username: 'registered', email, password: FIXTURE_PASSWORD },
      })
      .expect(201);
    const stored = await context
      .ds!.getRepository(UserEntity)
      .findOneByOrFail({ email });
    expect(stored.emailVerifiedAt).toBeNull();
    await request(context.server)
      .post('/api/users/login')
      .send({ user: { email, password: FIXTURE_PASSWORD } })
      .expect(401);
    const otp = context.outbox.get(`email-verification:${email}`);
    expect(otp).toMatch(/^\d{6}$/);
    await request(context.server)
      .post('/api/users/verify-email')
      .send({ email, otp: '0000000' })
      .expect(422);
    await request(context.server)
      .post('/api/users/verify-email')
      .send({ email, otp })
      .expect(200);
    await request(context.server)
      .post('/api/users/verify-email')
      .send({ email, otp })
      .expect(401);
    await request(context.server)
      .post('/api/users/login')
      .send({ user: { email, password: 'incorrect-password' } })
      .expect(401);
    const user = await login('registered');
    await request(context.server)
      .get('/api/user')
      .set('Authorization', `Token ${user.token}`)
      .expect(200);
    const rotated = await request(context.server)
      .post('/api/users/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    await request(context.server)
      .post('/api/users/refresh')
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    const token = (rotated.body as UserEnvelopeResponse).user.token;
    await request(context.server)
      .post('/api/users/logout')
      .set('Authorization', `Token ${token}`)
      .expect(200);
    await request(context.server)
      .get('/api/user')
      .set('Authorization', `Token ${token}`)
      .expect(401);
    expect(
      (await context.redis!.keys(`${context.prefix}auth:revoked:*`)).length,
    ).toBeGreaterThan(0);
  });

  it('updates profile and follows/unfollows using actual guards and persistence', async () => {
    const user = await login('e2e_outsider');
    const auth = `Token ${user.token}`;
    const profile = '/api/profiles/e2e_author';
    await request(context.server)
      .get(profile)
      .expect(200)
      .expect(({ body }: { body: { profile: { following: boolean } } }) => {
        expect(body.profile.following).toBe(false);
      });
    await request(context.server).post(`${profile}/follow`).expect(401);
    await request(context.server).put('/api/user').expect(401);
    await request(context.server)
      .put('/api/user')
      .set('Authorization', auth)
      .send({ user: { bio: 'Updated through HTTP' } })
      .expect(200);
    expect(
      (
        await context
          .ds!.getRepository(UserEntity)
          .findOneByOrFail({ id: fixtures.outsider.id })
      ).bio,
    ).toBe('Updated through HTTP');
    await request(context.server)
      .post(`${profile}/follow`)
      .set('Authorization', auth)
      .expect(200)
      .expect(({ body }: { body: { profile: { following: boolean } } }) =>
        expect(body.profile.following).toBe(true),
      );
    await request(context.server)
      .delete(`${profile}/follow`)
      .set('Authorization', auth)
      .expect(200)
      .expect(({ body }: { body: { profile: { following: boolean } } }) =>
        expect(body.profile.following).toBe(false),
      );
    await request(context.server)
      .get('/api/user')
      .set('Authorization', 'Token invalid')
      .expect(401);
  });

  it('creates, filters, feeds, favorites, updates and deletes articles', async () => {
    const author = `Token ${(await login('e2e_author')).token}`;
    const reader = `Token ${(await login()).token}`;
    await request(context.server)
      .post('/api/articles')
      .send({ article: {} })
      .expect(401);
    await request(context.server).get('/api/articles/feed').expect(401);
    const created = await request(context.server)
      .post('/api/articles')
      .set('Authorization', author)
      .send({
        article: {
          title: 'HTTP article',
          description: 'Description',
          body: 'Body',
          tagList: ['typescript'],
        },
      })
      .expect(201);
    const slug = (created.body as ArticleEnvelopeResponse).article.slug;
    const route = `/api/articles/${slug}`;
    await request(context.server).get(route).expect(200);
    await request(context.server)
      .get('/api/articles?tag=typescript&author=e2e_author&limit=1&offset=0')
      .expect(200)
      .expect(
        ({
          body,
        }: {
          body: { articles: unknown[]; articlesCount: number };
        }) => {
          expect(body.articles).toHaveLength(1);
          expect(body.articlesCount).toBe(1);
        },
      );
    await request(context.server)
      .get('/api/articles?limit=1&offset=1')
      .expect(200)
      .expect(
        ({
          body,
        }: {
          body: { articles: unknown[]; articlesCount: number };
        }) => {
          expect(body.articles).toHaveLength(1);
          expect(body.articlesCount).toBe(2);
        },
      );
    await request(context.server)
      .get('/api/articles/feed')
      .set('Authorization', reader)
      .expect(200)
      .expect(({ body }: { body: { articlesCount: number } }) =>
        expect(body.articlesCount).toBe(2),
      );
    await request(context.server)
      .post(`${route}/favorite`)
      .set('Authorization', reader)
      .expect(200);
    await request(context.server)
      .get('/api/articles?favorited=e2e_reader')
      .expect(200)
      .expect(({ body }: { body: { articlesCount: number } }) =>
        expect(body.articlesCount).toBe(2),
      );
    await request(context.server)
      .delete(`${route}/favorite`)
      .set('Authorization', reader)
      .expect(200);
    await request(context.server)
      .put(route)
      .set('Authorization', reader)
      .send({ article: { body: 'Wrong owner' } })
      .expect(403);
    await request(context.server)
      .delete(route)
      .set('Authorization', reader)
      .expect(403);
    await request(context.server)
      .put(route)
      .set('Authorization', author)
      .send({ article: { body: 'Updated' } })
      .expect(200);
    await request(context.server)
      .delete(route)
      .set('Authorization', author)
      .expect(204);
    await request(context.server).get(route).expect(404);
    await request(context.server).get('/api/tags').expect(200);
  });

  it('covers CommentsController C2 with anonymous/authenticated reads and authorization failures', async () => {
    const reader = `Token ${(await login()).token}`;
    const author = `Token ${(await login('e2e_author')).token}`;
    const route = `/api/articles/${fixtures.article.slug}/comments`;
    await request(context.server)
      .get(route)
      .expect(200)
      .expect(
        ({
          body,
        }: {
          body: { comments: { author: { following: boolean } }[] };
        }) => expect(body.comments[0]?.author.following).toBe(false),
      );
    await request(context.server)
      .get(route)
      .set('Authorization', author)
      .expect(200);
    await request(context.server)
      .get(route)
      .set('Authorization', 'Token invalid')
      .expect(401);
    await request(context.server)
      .post(route)
      .send({ comment: { body: 'Unauthorized' } })
      .expect(401);
    await request(context.server)
      .post(route)
      .set('Authorization', reader)
      .send({ comment: { body: ' ' } })
      .expect(422);
    await request(context.server)
      .post('/api/articles/missing/comments')
      .set('Authorization', reader)
      .send({ comment: { body: 'Body' } })
      .expect(404);
    const created = await request(context.server)
      .post(route)
      .set('Authorization', reader)
      .send({ comment: { body: '  Through HTTP  ' } })
      .expect(201);
    const comment = (created.body as CommentEnvelopeResponse).comment;
    expect(comment.body).toBe('Through HTTP');
    expect(
      await context
        .ds!.getRepository(CommentEntity)
        .findOneBy({ id: comment.id }),
    ).not.toBeNull();
    await request(context.server).delete(`${route}/${comment.id}`).expect(401);
    await request(context.server)
      .delete(`${route}/bad-id`)
      .set('Authorization', reader)
      .expect(422);
    await request(context.server)
      .delete(`${route}/${comment.id}`)
      .set('Authorization', author)
      .expect(403);
    const otherArticle = await request(context.server)
      .post('/api/articles')
      .set('Authorization', author)
      .send({
        article: { title: 'Another', description: 'Other', body: 'Body' },
      })
      .expect(201);
    const otherSlug = (otherArticle.body as ArticleEnvelopeResponse).article
      .slug;
    await request(context.server)
      .delete(`/api/articles/${otherSlug}/comments/${comment.id}`)
      .set('Authorization', reader)
      .expect(404);
    await request(context.server)
      .delete(`${route}/${comment.id}`)
      .set('Authorization', reader)
      .expect(204);
    await request(context.server)
      .delete(`${route}/${comment.id}`)
      .set('Authorization', reader)
      .expect(404);
  });

  it('uploads an avatar, stores metadata, serves the file and rejects invalid bytes', async () => {
    const user = await login();
    const auth = `Token ${user.token}`;
    const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
    await request(context.server)
      .post('/api/user/avatar')
      .set('Authorization', auth)
      .attach('avatar', Buffer.from('invalid'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(422);
    const result = await request(context.server)
      .post('/api/user/avatar')
      .set('Authorization', auth)
      .attach('avatar', png, {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(200);
    const image = (result.body as UserEnvelopeResponse).user.image!;
    await request(context.server).get(image).expect(200);
    const metadata = await context
      .ds!.getRepository(AttachmentEntity)
      .findOneByOrFail({ ownerId: fixtures.reader.id });
    expect(metadata.fileSize).toBe(png.length);
    expect(metadata.url).toBe(image);
  });

  it('uses the production i18n bootstrap', async () => {
    await request(context.server)
      .get('/api/hello')
      .set('Accept-Language', 'en')
      .expect(200, { message: 'Hello World!' });
    await request(context.server)
      .get('/api/hello')
      .set('Accept-Language', 'vi')
      .expect(200, { message: 'Xin chào!' });
  });

  it('reverts and reapplies the latest migration only inside the approved database', async () => {
    await context.reset();
    await assertTestDatabase(context.ds!);
    await context.ds!.undoLastMigration();
    const runner = context.ds!.createQueryRunner();
    try {
      expect(await runner.hasTable('comments')).toBe(false);
      await assertTestDatabase(context.ds!);
      await context.ds!.runMigrations();
      expect(await runner.hasTable('comments')).toBe(true);
    } finally {
      await runner.release();
    }
  });
});
