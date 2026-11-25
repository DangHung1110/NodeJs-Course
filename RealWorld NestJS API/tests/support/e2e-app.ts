import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Server } from 'node:net';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { MailService } from '../../src/mail/mail.service';
import type { OtpPurpose } from '../../src/auth/otp.service';
import { configureApp } from '../../src/app.setup';
import {
  assertTestDatabase,
  resetTestDatabase,
  testDatabaseConfig,
} from './database-safety';

export class E2eApp {
  app?: NestExpressApplication;
  ds?: DataSource;
  redis?: Redis;
  uploadRoot = '';
  readonly prefix = `e2e:${randomUUID()}:`;
  readonly outbox = new Map<string, string>();
  ready = false;
  private originalEnv?: NodeJS.ProcessEnv;

  get server(): Server {
    if (!this.app) throw new Error('E2E app not initialized');
    return this.app.getHttpServer();
  }

  async start(): Promise<void> {
    this.originalEnv = { ...process.env };
    const database = testDatabaseConfig();
    const redisUrl = process.env.REDIS_TEST_URL;
    if (!redisUrl) throw new Error('REDIS_TEST_URL is required');
    const url = new URL(redisUrl);
    if (
      url.protocol !== 'redis:' ||
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/15'
    ) {
      throw new Error('E2E Redis must be explicit loopback DB 15');
    }
    this.uploadRoot = await mkdtemp(join(tmpdir(), 'realworld-e2e-'));
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PORT: '3000',
      API_PREFIX: 'api',
      DB_HOST: database.host,
      DB_PORT: String(database.port),
      DB_USERNAME: database.username,
      DB_PASSWORD: database.password,
      DB_DATABASE: database.database,
      REDIS_URL: redisUrl,
      REDIS_KEY_PREFIX: this.prefix,
      JWT_SECRET: randomUUID(),
      JWT_REFRESH_SECRET: randomUUID(),
      OTP_SECRET: randomUUID(),
      JWT_EXPIRES_IN: '300',
      JWT_REFRESH_EXPIRES_IN: '600',
      OTP_EXPIRES_IN: '300',
      OTP_MAX_ATTEMPTS: '5',
      OTP_RESEND_COOLDOWN: '60',
      MAIL_HOST: 'smtp.invalid',
      MAIL_PORT: '587',
      MAIL_SECURE: 'false',
      MAIL_USER: 'e2e@example.test',
      MAIL_PASSWORD: 'unused-test-only',
      MAIL_FROM: 'e2e@example.test',
      UPLOAD_DIRECTORY: this.uploadRoot,
    });
    try {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
      });
      await this.redis.connect();
      await this.redis.ping();
      // Import only after explicit test environment setup; no .env dev fallback.
      // CommonJS defers ConfigModule evaluation until all test values are set.
      /* eslint-disable @typescript-eslint/no-require-imports -- load ConfigModule after test environment */
      const { AppModule } =
        require('../../src/app.module') as typeof import('../../src/app.module');
      /* eslint-enable @typescript-eslint/no-require-imports */
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(MailService)
        .useValue({
          sendOtp: (email: string, purpose: OtpPurpose, otp: string) => {
            this.outbox.set(`${purpose}:${email}`, otp);
            return Promise.resolve();
          },
        })
        .compile();
      this.app = module.createNestApplication<NestExpressApplication>();
      this.ds = this.app.get(DataSource);
      await this.ds.initialize();
      await assertTestDatabase(this.ds);
      await this.ds.runMigrations();
      this.app.useStaticAssets(this.uploadRoot, {
        prefix: '/uploads/',
        fallthrough: false,
      });
      configureApp(this.app);
      await this.app.init();
      await this.reset();
      this.ready = true;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  private assertUploadRoot(): void {
    if (
      resolve(this.uploadRoot) !== this.uploadRoot ||
      !this.uploadRoot.startsWith(join(tmpdir(), 'realworld-e2e-'))
    ) {
      throw new Error('Unsafe upload cleanup path');
    }
  }

  async reset(): Promise<void> {
    if (this.ds?.isInitialized) await resetTestDatabase(this.ds);
    if (this.redis?.status === 'ready') {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.prefix}*`,
          'COUNT',
          100,
        );
        if (keys.length) await this.redis.del(...keys);
        cursor = next;
      } while (cursor !== '0');
    }
    if (this.uploadRoot) {
      this.assertUploadRoot();
      for (const entry of await readdir(this.uploadRoot)) {
        await rm(join(this.uploadRoot, entry), {
          recursive: true,
          force: true,
        });
      }
    }
    this.outbox.clear();
  }

  async close(): Promise<void> {
    try {
      await this.reset();
    } finally {
      try {
        await this.app?.close();
      } finally {
        try {
          if (this.ds?.isInitialized) await this.ds.destroy();
        } finally {
          this.redis?.disconnect();
          try {
            if (this.uploadRoot) {
              this.assertUploadRoot();
              await rm(this.uploadRoot, { recursive: true, force: true });
              this.uploadRoot = '';
            }
          } finally {
            this.ready = false;
            if (this.originalEnv) {
              process.env = this.originalEnv;
              this.originalEnv = undefined;
            }
          }
        }
      }
    }
  }
}
