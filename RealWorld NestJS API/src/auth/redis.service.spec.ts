import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));

describe('RedisService', () => {
  const client = {
    status: 'wait',
    connect: jest.fn(),
    disconnect: jest.fn(),
    exists: jest.fn(),
    set: jest.fn(),
    eval: jest.fn(),
    del: jest.fn(),
  };
  const RedisConstructor = Redis as unknown as jest.Mock;
  const configService = {
    get: jest.fn().mockReturnValue('test'),
    getOrThrow: jest.fn().mockReturnValue('redis://127.0.0.1:6379'),
  };
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    RedisConstructor.mockReturnValue(client);
    service = new RedisService(configService as unknown as ConfigService);
  });

  it('configures bounded reconnect backoff', () => {
    const constructorCalls = RedisConstructor.mock.calls as unknown as [
      [string, { retryStrategy: (attempt: number) => number }],
    ];
    const options = constructorCalls[0][1];

    expect(options.retryStrategy(1)).toBe(100);
    expect(options.retryStrategy(100)).toBe(2000);
  });

  it('uses jti keys and the supplied TTL', async () => {
    client.set.mockResolvedValue('OK');

    await service.revoke('token-id', 60);

    expect(client.set).toHaveBeenCalledWith(
      'auth:revoked:token-id',
      '1',
      'EX',
      60,
    );
  });

  it('atomically rejects reuse of a rotated refresh token', async () => {
    client.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await expect(service.revokeOnce('refresh-id', 60)).resolves.toBe(true);
    await expect(service.revokeOnce('refresh-id', 60)).resolves.toBe(false);
    expect(client.set).toHaveBeenCalledWith(
      'auth:revoked:refresh-id',
      '1',
      'EX',
      60,
      'NX',
    );
  });

  it('propagates Redis failures instead of using an in-memory fallback', async () => {
    client.exists.mockRejectedValue(new Error('unavailable'));

    await expect(service.isRevoked('token-id')).rejects.toThrow('unavailable');
  });

  it('stores only an OTP digest with expiry and cooldown keys', async () => {
    client.eval.mockResolvedValue(1);

    await expect(
      service.storeOtp(
        'email-verification',
        'jane@example.com',
        'otp-digest',
        600,
        60,
        false,
      ),
    ).resolves.toBe(true);

    expect(client.eval).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'auth:email-verification:jane@example.com',
      'auth:otp-cooldown:email-verification:jane@example.com',
      'otp-digest',
      '600',
      '60',
      '0',
    );
  });

  it('maps atomic OTP consumption results', async () => {
    client.eval
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(-1)
      .mockResolvedValueOnce(0);

    await expect(
      service.consumeOtp('password-reset', 'jane@example.com', 'digest', 5),
    ).resolves.toBe('valid');
    await expect(
      service.consumeOtp('password-reset', 'jane@example.com', 'digest', 5),
    ).resolves.toBe('invalid');
    await expect(
      service.consumeOtp('password-reset', 'jane@example.com', 'digest', 5),
    ).resolves.toBe('expired');
  });
});
