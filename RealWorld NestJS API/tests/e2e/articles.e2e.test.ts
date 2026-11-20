import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Server } from 'node:net';
import request from 'supertest';
import { configureApp } from '../../src/app.setup';
import { ArticlesController } from '../../src/articles/articles.controller';
import { ArticlesService } from '../../src/articles/articles.service';
import { JwtPayload } from '../../src/auth/jwt-payload';
import { OptionalJwtAuthGuard } from '../../src/profiles/optional-jwt-auth.guard';

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: JwtPayload;
    }>();
    if (!request.headers.authorization) throw new UnauthorizedException();
    request.user = testPayload;
    return true;
  }
}

class TestOptionalJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: JwtPayload;
    }>();
    if (request.headers.authorization) request.user = testPayload;
    return true;
  }
}

const testPayload: JwtPayload = {
  sub: 'viewer-id',
  jti: 'test-jti',
  exp: Math.floor(Date.now() / 1000) + 60,
  type: 'access',
  version: 0,
};

describe('PR-04 article HTTP contract', () => {
  let app: INestApplication;
  let server: Server;
  const article = {
    slug: 'hello-nestjs-123',
    title: 'Hello NestJS',
    description: 'Description',
    body: 'Body',
    tagList: ['nestjs'],
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
    favorited: false,
    favoritesCount: 0,
    author: {
      username: 'author',
      bio: null,
      image: null,
      following: false,
    },
  };
  const service = {
    create: jest.fn(),
    list: jest.fn(),
    feed: jest.fn(),
    getBySlug: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    favorite: jest.fn(),
    unfavorite: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        { provide: ArticlesService, useValue: service },
        OptionalJwtAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: unknown) =>
              key === 'NODE_ENV' ? 'production' : fallback,
          },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(TestJwtGuard)
      .overrideGuard(OptionalJwtAuthGuard)
      .useClass(TestOptionalJwtGuard)
      .compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    const httpServer = app.getHttpServer() as unknown;
    if (!(httpServer instanceof Server))
      throw new Error('HTTP server unavailable.');
    server = httpServer;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service.create.mockResolvedValue({ article });
    service.list.mockResolvedValue({ articles: [article], articlesCount: 1 });
    service.feed.mockResolvedValue({ articles: [article], articlesCount: 1 });
    service.getBySlug.mockResolvedValue({ article });
    service.update.mockResolvedValue({ article });
    service.delete.mockResolvedValue(undefined);
    service.favorite.mockResolvedValue({
      article: { ...article, favorited: true, favoritesCount: 1 },
    });
    service.unfavorite.mockResolvedValue({ article });
  });

  it('creates an article from the authenticated user', async () => {
    await request(server)
      .post('/api/articles')
      .set('Authorization', 'Token test')
      .send({
        article: {
          title: 'Hello NestJS',
          description: 'Description',
          body: 'Body',
          tagList: ['NestJS'],
        },
      })
      .expect(201, { article });

    expect(service.create).toHaveBeenCalledWith('viewer-id', {
      title: 'Hello NestJS',
      description: 'Description',
      body: 'Body',
      tagList: ['nestjs'],
    });
  });

  it('rejects anonymous creation and invalid article bodies', async () => {
    await request(server)
      .post('/api/articles')
      .send({ article: {} })
      .expect(401);
    await request(server)
      .post('/api/articles')
      .set('Authorization', 'Token test')
      .send({ article: { title: 'Missing fields' } })
      .expect(422);
  });

  it('lists public articles with validated filters and pagination defaults', async () => {
    await request(server)
      .get(
        '/api/articles?tag=NestJS&author=author&favorited=viewer&search=query',
      )
      .expect(200, { articles: [article], articlesCount: 1 });

    expect(service.list).toHaveBeenCalledWith(
      {
        tag: 'NestJS',
        author: 'author',
        favorited: 'viewer',
        search: 'query',
        limit: 20,
        offset: 0,
      },
      undefined,
    );
    await request(server).get('/api/articles?limit=0').expect(422);
    await request(server).get('/api/articles?offset=-1').expect(422);
  });

  it('serves feed before the dynamic slug route and requires auth', async () => {
    await request(server).get('/api/articles/feed').expect(401);
    await request(server)
      .get('/api/articles/feed?limit=5&offset=10')
      .set('Authorization', 'Token test')
      .expect(200, { articles: [article], articlesCount: 1 });
    expect(service.feed).toHaveBeenCalledWith(
      { limit: 5, offset: 10 },
      'viewer-id',
    );
    expect(service.getBySlug).not.toHaveBeenCalledWith(
      'feed',
      expect.anything(),
    );
  });

  it('gets article details publicly and passes authenticated viewer context', async () => {
    await request(server)
      .get('/api/articles/hello-nestjs-123')
      .expect(200, { article });
    expect(service.getBySlug).toHaveBeenLastCalledWith(
      'hello-nestjs-123',
      undefined,
    );

    await request(server)
      .get('/api/articles/hello-nestjs-123')
      .set('Authorization', 'Token test')
      .expect(200);
    expect(service.getBySlug).toHaveBeenLastCalledWith(
      'hello-nestjs-123',
      'viewer-id',
    );
  });

  it('updates and deletes an owned article', async () => {
    await request(server)
      .put('/api/articles/hello-nestjs-123')
      .set('Authorization', 'Token test')
      .send({ article: { title: 'Changed', tagList: [] } })
      .expect(200, { article });
    expect(service.update).toHaveBeenCalledWith(
      'hello-nestjs-123',
      'viewer-id',
      { title: 'Changed', tagList: [] },
    );

    await request(server)
      .delete('/api/articles/hello-nestjs-123')
      .set('Authorization', 'Token test')
      .expect(204);
    expect(service.delete).toHaveBeenCalledWith(
      'hello-nestjs-123',
      'viewer-id',
    );
  });

  it('favorites and unfavorites through authenticated endpoints', async () => {
    await request(server)
      .post('/api/articles/hello-nestjs-123/favorite')
      .set('Authorization', 'Token test')
      .expect(200)
      .expect(({ body }: { body: { article: unknown } }) => {
        expect(body.article).toMatchObject({
          favorited: true,
          favoritesCount: 1,
        });
      });
    await request(server)
      .delete('/api/articles/hello-nestjs-123/favorite')
      .set('Authorization', 'Token test')
      .expect(200, { article });
  });
});
