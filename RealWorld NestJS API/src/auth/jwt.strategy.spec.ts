import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { RedisService } from './redis.service';
import { UsersService } from '../users/users.service';

describe('JwtStrategy', () => {
  const redisService = { isRevoked: jest.fn() };
  const usersService = { findById: jest.fn() };
  const configService = {
    getOrThrow: jest
      .fn()
      .mockReturnValue('test-secret-with-32-characters-minimum'),
  };
  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new JwtStrategy(
      configService as unknown as ConfigService,
      redisService as unknown as RedisService,
      usersService as unknown as UsersService,
    );
  });

  it('returns 503 when Redis cannot check revocation', async () => {
    redisService.isRevoked.mockRejectedValue(new Error('unavailable'));

    await expect(
      strategy.validate({
        sub: 'user-id',
        jti: 'token-id',
        exp: 2_000_000_000,
        type: 'access',
        version: 0,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('returns 401 for a revoked token', async () => {
    redisService.isRevoked.mockResolvedValue(true);

    await expect(
      strategy.validate({
        sub: 'user-id',
        jti: 'token-id',
        exp: 2_000_000_000,
        type: 'access',
        version: 0,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns 401 for a disabled user', async () => {
    redisService.isRevoked.mockResolvedValue(false);
    usersService.findById.mockResolvedValue({
      id: 'user-id',
      isActive: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        jti: 'token-id',
        exp: 2_000_000_000,
        type: 'access',
        version: 0,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('returns 401 after logout-all changes the token version', async () => {
    redisService.isRevoked.mockResolvedValue(false);
    usersService.findById.mockResolvedValue({
      id: 'user-id',
      isActive: true,
      tokenVersion: 1,
      emailVerifiedAt: new Date(),
    });

    await expect(
      strategy.validate({
        sub: 'user-id',
        jti: 'token-id',
        exp: 2_000_000_000,
        type: 'access',
        version: 0,
      }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
