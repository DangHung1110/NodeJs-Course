import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

describe('Authentication rate limit (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const authService = {
      register: jest.fn().mockResolvedValue({
        username: 'jane',
        email: 'jane@example.com',
        bio: null,
        image: null,
        token: 'access-token',
        refreshToken: 'refresh-token',
      }),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 429 after the configured request limit', async () => {
    const body = {
      user: {
        username: 'jane',
        email: 'jane@example.com',
        password: 'password123',
      },
    };

    for (let requestNumber = 0; requestNumber < 10; requestNumber += 1) {
      await request(app.getHttpServer()).post('/users').send(body).expect(201);
    }
    await request(app.getHttpServer()).post('/users').send(body).expect(429);
  });
});
