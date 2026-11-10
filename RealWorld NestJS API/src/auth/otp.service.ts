import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'node:crypto';
import { RedisService } from './redis.service';

export type OtpPurpose = 'email-verification' | 'password-reset';

const OTP_UPPER_BOUND = 1_000_000;

@Injectable()
export class OtpService {
  readonly expiresInSeconds: number;
  private readonly secret: string;
  private readonly maxAttempts: number;
  private readonly resendCooldownSeconds: number;

  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.secret = configService.getOrThrow<string>('OTP_SECRET');
    this.expiresInSeconds = configService.getOrThrow<number>('OTP_EXPIRES_IN');
    this.maxAttempts = configService.getOrThrow<number>('OTP_MAX_ATTEMPTS');
    this.resendCooldownSeconds = configService.getOrThrow<number>(
      'OTP_RESEND_COOLDOWN',
    );
  }

  async issue(
    purpose: OtpPurpose,
    email: string,
    replaceExisting = false,
  ): Promise<string | null> {
    const normalizedEmail = this.normalizeEmail(email);
    const otp = randomInt(0, OTP_UPPER_BOUND).toString().padStart(6, '0');
    try {
      const stored = await this.redisService.storeOtp(
        purpose,
        normalizedEmail,
        this.digest(purpose, normalizedEmail, otp),
        this.expiresInSeconds,
        this.resendCooldownSeconds,
        replaceExisting,
      );
      return stored ? otp : null;
    } catch (error) {
      throw new ServiceUnavailableException(
        'Verification codes are temporarily unavailable.',
        { cause: error },
      );
    }
  }

  async consume(
    purpose: OtpPurpose,
    email: string,
    otp: string,
  ): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    let result: 'valid' | 'invalid' | 'expired';
    try {
      result = await this.redisService.consumeOtp(
        purpose,
        normalizedEmail,
        this.digest(purpose, normalizedEmail, otp),
        this.maxAttempts,
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        'Verification codes are temporarily unavailable.',
        { cause: error },
      );
    }
    if (result !== 'valid') {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }
  }

  async clear(purpose: OtpPurpose, email: string): Promise<void> {
    try {
      await this.redisService.deleteOtp(purpose, this.normalizeEmail(email));
    } catch (error) {
      throw new ServiceUnavailableException(
        'Verification codes are temporarily unavailable.',
        { cause: error },
      );
    }
  }

  private digest(purpose: OtpPurpose, email: string, otp: string): string {
    return createHmac('sha256', this.secret)
      .update(purpose)
      .update(':')
      .update(email)
      .update(':')
      .update(otp)
      .digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
