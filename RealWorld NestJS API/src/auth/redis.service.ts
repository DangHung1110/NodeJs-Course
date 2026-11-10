import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly testBlacklist = new Set<string>();
  private readonly isTest: boolean;

  constructor(configService: ConfigService) {
    this.isTest = configService.get<string>('NODE_ENV') === 'test';
    this.client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.isTest) await this.client.connect();
  }

  onModuleDestroy(): void {
    if (this.client.status !== 'end') this.client.disconnect();
  }

  async isRevoked(jti: string): Promise<boolean> {
    if (this.isTest) return this.testBlacklist.has(jti);
    return (await this.client.exists(`auth:revoked:${jti}`)) === 1;
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    if (this.isTest) {
      this.testBlacklist.add(jti);
      return;
    }
    await this.client.set(`auth:revoked:${jti}`, '1', 'EX', ttlSeconds);
  }
}
