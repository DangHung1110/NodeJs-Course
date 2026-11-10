import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

const RETRY_STEP_MS = 100;
const RETRY_MAX_DELAY_MS = 2_000;
const STORE_OTP_SCRIPT = `
  if ARGV[4] == '0' and redis.call('EXISTS', KEYS[2]) == 1 then
    return 0
  end
  redis.call('HSET', KEYS[1], 'digest', ARGV[1], 'attempts', '0')
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  redis.call('SET', KEYS[2], '1', 'EX', ARGV[3])
  return 1
`;
const CONSUME_OTP_SCRIPT = `
  if redis.call('EXISTS', KEYS[1]) == 0 then
    return 0
  end
  local storedDigest = redis.call('HGET', KEYS[1], 'digest')
  local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
  if storedDigest == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 1
  end
  attempts = attempts + 1
  if attempts >= tonumber(ARGV[2]) then
    redis.call('DEL', KEYS[1])
  else
    redis.call('HSET', KEYS[1], 'attempts', attempts)
  end
  return -1
`;

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
        Math.min(attempt * RETRY_STEP_MS, RETRY_MAX_DELAY_MS),
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
    const result = await this.client.eval(
      STORE_OTP_SCRIPT,
      2,
      this.otpKey(purpose, email),
      this.otpCooldownKey(purpose, email),
      digest,
      String(ttlSeconds),
      String(cooldownSeconds),
      replaceExisting ? '1' : '0',
    );
    return Number(result) === 1;
  }

  async consumeOtp(
    purpose: string,
    email: string,
    digest: string,
    maxAttempts: number,
  ): Promise<'valid' | 'invalid' | 'expired'> {
    const result = Number(
      await this.client.eval(
        CONSUME_OTP_SCRIPT,
        1,
        this.otpKey(purpose, email),
        digest,
        String(maxAttempts),
      ),
    );
    if (result === 1) return 'valid';
    if (result === 0) return 'expired';
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
