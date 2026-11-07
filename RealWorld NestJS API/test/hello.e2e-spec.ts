import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

interface OpenApiDocument {
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, unknown>;
}

describe('Hello (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns the English message by default', async () => {
    await request(app.getHttpServer())
      .get('/api/hello')
      .expect(200)
      .expect({ message: 'Hello World!' });
  });

  it('returns the English message for en', async () => {
    await request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'en')
      .expect(200)
      .expect({ message: 'Hello World!' });
  });

  it('returns the Vietnamese message for vi', async () => {
    await request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'vi')
      .expect(200)
      .expect({ message: 'Xin chào!' });
  });

  it('returns the Vietnamese message for vi-VN', async () => {
    await request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'vi-VN')
      .expect(200)
      .expect({ message: 'Xin chào!' });
  });

  it('falls back to English for unsupported languages', async () => {
    await request(app.getHttpServer())
      .get('/api/hello')
      .set('Accept-Language', 'fr-FR')
      .expect(200)
      .expect({ message: 'Hello World!' });
  });

  it('serves the OpenAPI document with the hello endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    const document = response.body as OpenApiDocument;

    expect(document).toMatchObject({
      info: {
        title: 'RealWorld NestJS API',
        version: '0.0.1',
      },
    });
    expect(document.paths).toHaveProperty('/api/hello');
  });

  it('serves the Swagger UI', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});
