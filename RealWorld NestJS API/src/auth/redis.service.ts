import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  REDIS_RETRY_MAX_DELAY_MS,
  REDIS_RETRY_STEP_MS,
} from './auth.constants';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly isTest: boolean;

  constructor(configService: ConfigService) {
    this.isTest = configService.get<string>('NODE_ENV') === 'test';
    this.client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) =>
        Math.min(attempt * REDIS_RETRY_STEP_MS, REDIS_RETRY_MAX_DELAY_MS),
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.isTest) await this.client.connect();
  }

  onModuleDestroy(): void {
    if (this.client.status !== 'end') this.client.disconnect();
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.client.exists(`auth:revoked:${jti}`)) === 1;
  }

  async revoke(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.client.set(`auth:revoked:${jti}`, '1', 'EX', ttlSeconds);
  }

  async revokeOnce(jti: string, ttlSeconds: number): Promise<boolean> {
    if (ttlSeconds <= 0) return false;
    const result = await this.client.set(
      `auth:revoked:${jti}`,
      '1',
      'EX',
      ttlSeconds,
      'NX',
    );
    return result === 'OK';
  }

  async storeOtp(
    purpose: string,
    email: string,
    digest: string,
    ttlSeconds: number,
    cooldownSeconds: number,
    replaceExisting: boolean,
  ): Promise<boolean> {
    const cooldownKey = this.otpCooldownKey(purpose, email);
    if (replaceExisting) {
      await this.client.set(cooldownKey, '1', 'EX', cooldownSeconds);
    } else {
      const stored = await this.client.set(
        cooldownKey,
        '1',
        'EX',
        cooldownSeconds,
        'NX',
      );
      if (stored !== 'OK') return false;
    }

    const otpKey = this.otpKey(purpose, email);
    await this.client
      .multi()
      .hset(otpKey, { digest, attempts: '0' })
      .expire(otpKey, ttlSeconds)
      .exec();
    return true;
  }

  async consumeOtp(
    purpose: string,
    email: string,
    digest: string,
    maxAttempts: number,
  ): Promise<'valid' | 'invalid' | 'expired'> {
    const otpKey = this.otpKey(purpose, email);
    const storedDigest = await this.client.hget(otpKey, 'digest');
    if (!storedDigest) return 'expired';
    if (storedDigest === digest) {
      await this.client.del(otpKey);
      return 'valid';
    }

    const attempts = await this.client.hincrby(otpKey, 'attempts', 1);
    if (attempts >= maxAttempts) await this.client.del(otpKey);
    return 'invalid';
  }

  async deleteOtp(purpose: string, email: string): Promise<void> {
    await this.client.del(
      this.otpKey(purpose, email),
      this.otpCooldownKey(purpose, email),
    );
  }

  private otpKey(purpose: string, email: string): string {
    return `auth:${purpose}:${email}`;
  }

  private otpCooldownKey(purpose: string, email: string): string {
    return `auth:otp-cooldown:${purpose}:${email}`;
  }
}
