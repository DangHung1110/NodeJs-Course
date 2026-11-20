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
import { CommentsController } from '../../src/comments/comments.controller';
import { CommentsService } from '../../src/comments/comments.service';
import { OptionalJwtAuthGuard } from '../../src/profiles/optional-jwt-auth.guard';
import { TagsController } from '../../src/tags/tags.controller';
import { TagsService } from '../../src/tags/tags.service';

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: { sub: string };
    }>();
    if (req.headers.authorization !== 'Token test')
      throw new UnauthorizedException();
    req.user = { sub: 'viewer-id' };
    return true;
  }
}

class TestOptionalGuard extends TestJwtGuard {
  override canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string } }>();
    return req.headers.authorization ? super.canActivate(context) : true;
  }
}

describe('PR-05 HTTP validation and documentation', () => {
  let app: INestApplication;
  let server: Server;
  const id = '3acb544c-7b01-4b53-8c2b-e9ba78f0266f';
  const service = { create: jest.fn(), list: jest.fn(), delete: jest.fn() };
  const tags = { list: jest.fn().mockResolvedValue({ tags: [] }) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CommentsController, TagsController],
      providers: [
        { provide: CommentsService, useValue: service },
        { provide: TagsService, useValue: tags },
        OptionalJwtAuthGuard,
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback: unknown) => fallback },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useClass(TestJwtGuard)
      .overrideGuard(OptionalJwtAuthGuard)
      .useClass(TestOptionalGuard)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    service.create.mockResolvedValue({ comment: { id, body: 'Comment' } });
    service.list.mockResolvedValue({ comments: [] });
    service.delete.mockResolvedValue(undefined);
  });

  it('trims the body and passes only the authenticated user to create', async () => {
    await request(server)
      .post('/api/articles/article-123/comments')
      .set('Authorization', 'Token test')
      .send({ comment: { body: '  Comment  ' } })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith('article-123', 'viewer-id', {
      body: 'Comment',
    });
  });

  it.each([
    {},
    { comment: null },
    { comment: [] },
    { comment: {} },
    { comment: { body: '' } },
    { comment: { body: '  \n ' } },
    { comment: { body: 123 } },
    { comment: { body: true } },
    { comment: { body: 'x'.repeat(10001) } },
    { comment: { body: 'Comment', authorId: 'forged' } },
  ])('rejects invalid payload %# before service execution', async (payload) => {
    await request(server)
      .post('/api/articles/article-123/comments')
      .set('Authorization', 'Token test')
      .send(payload)
      .expect(422);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('requires authentication for create and delete', async () => {
    await request(server)
      .post('/api/articles/article-123/comments')
      .send({ comment: { body: 'Comment' } })
      .expect(401);
    await request(server)
      .delete(`/api/articles/article-123/comments/${id}`)
      .expect(401);
    expect(service.create).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('accepts public reads and forwards optional viewer context', async () => {
    await request(server)
      .get('/api/articles/article-123/comments')
      .expect(200, { comments: [] });
    expect(service.list).toHaveBeenLastCalledWith('article-123', undefined);
    await request(server)
      .get('/api/articles/article-123/comments')
      .set('Authorization', 'Token test')
      .expect(200);
    expect(service.list).toHaveBeenLastCalledWith('article-123', 'viewer-id');
    await request(server)
      .get('/api/articles/article-123/comments')
      .set('Authorization', 'Token invalid')
      .expect(401);
  });

  it('validates UUID and slug, and returns an empty 204 response on deletion', async () => {
    await request(server)
      .delete('/api/articles/article-123/comments/not-a-uuid')
      .set('Authorization', 'Token test')
      .expect(422);
    await request(server).get('/api/articles/INVALID/comments').expect(422);
    expect(service.delete).not.toHaveBeenCalled();
    await request(server)
      .delete(`/api/articles/article-123/comments/${id}`)
      .set('Authorization', 'Token test')
      .expect(204, '');
    expect(service.delete).toHaveBeenCalledWith('article-123', id, 'viewer-id');
  });

  it('lists tags publicly', async () => {
    await request(server).get('/api/tags').expect(200, { tags: [] });
    expect(tags.list).toHaveBeenCalledTimes(1);
  });

  it('documents all four endpoints and response status codes', async () => {
    const response = await request(server).get('/api/docs-json').expect(200);
    const document = response.body as {
      paths: Record<
        string,
        Record<
          string,
          { responses: Record<string, unknown>; security?: unknown[] }
        >
      >;
    };
    const comments = document.paths['/api/articles/{slug}/comments'];
    expect(comments?.post?.responses).toHaveProperty('201');
    expect(comments?.get?.responses).toHaveProperty('200');
    expect(comments?.get?.security).toEqual([{ TokenAuth: [] }, {}]);
    expect(
      document.paths['/api/articles/{slug}/comments/{id}']?.delete?.responses,
    ).toHaveProperty('204');
    expect(document.paths['/api/tags']?.get?.responses).toHaveProperty('200');
  });
});
