import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { OtpService } from './otp.service';
import { RedisService } from './redis.service';

jest.mock('node:crypto', () => ({
  ...jest.requireActual<typeof import('node:crypto')>('node:crypto'),
  randomInt: jest.fn(),
}));

describe('OtpService', () => {
  const storeOtp =
    jest.fn<
      (
        purpose: string,
        email: string,
        digest: string,
        ttlSeconds: number,
        cooldownSeconds: number,
        replaceExisting: boolean,
      ) => Promise<boolean>
    >();
  const redisService = {
    storeOtp,
    consumeOtp: jest.fn(),
    deleteOtp: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        OTP_SECRET: 'test-otp-secret-with-at-least-32-characters',
        OTP_EXPIRES_IN: 600,
        OTP_MAX_ATTEMPTS: 5,
        OTP_RESEND_COOLDOWN: 60,
      };
      return values[key];
    }),
  };
  const randomInteger = randomInt as jest.MockedFunction<typeof randomInt>;
  let service: OtpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OtpService(
      configService as unknown as ConfigService,
      redisService as unknown as RedisService,
    );
  });

  it('uses a CSPRNG to issue a six-digit OTP and stores only its HMAC', async () => {
    randomInteger.mockReturnValue(42);
    redisService.storeOtp.mockResolvedValue(true);

    await expect(
      service.issue('email-verification', ' JANE@EXAMPLE.COM '),
    ).resolves.toBe('000042');

    expect(randomInteger).toHaveBeenCalledWith(0, 1_000_000);
    expect(redisService.storeOtp).toHaveBeenCalledWith(
      'email-verification',
      'jane@example.com',
      expect.stringMatching(/^[a-f0-9]{64}$/),
      600,
      60,
      false,
    );
  });

  it('returns no OTP during the resend cooldown', async () => {
    randomInteger.mockReturnValue(123456);
    redisService.storeOtp.mockResolvedValue(false);

    await expect(
      service.issue('email-verification', 'jane@example.com'),
    ).resolves.toBeNull();
  });

  it.each(['invalid', 'expired'] as const)(
    'rejects an %s OTP without accepting reuse',
    async (result) => {
      redisService.consumeOtp.mockResolvedValue(result);

      await expect(
        service.consume('password-reset', 'jane@example.com', '123456'),
      ).rejects.toMatchObject({ status: 401 });
    },
  );

  it('returns 503 when Redis cannot store an OTP', async () => {
    randomInteger.mockReturnValue(123456);
    redisService.storeOtp.mockRejectedValue(new Error('unavailable'));

    await expect(
      service.issue('email-verification', 'jane@example.com'),
    ).rejects.toMatchObject({ status: 503 });
  });
});
