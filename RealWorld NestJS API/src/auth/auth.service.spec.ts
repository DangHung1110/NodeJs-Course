import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { UserEntity } from '../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RedisService } from './redis.service';
import { OtpService } from './otp.service';
import { MailService } from '../mail/mail.service';

jest.mock('bcryptjs', () => ({ compare: jest.fn() }));

const USER: UserEntity = {
  id: 'user-id',
  username: 'jane',
  email: 'jane@example.com',
  passwordHash: 'stored-password-hash',
  bio: null,
  image: null,
  tokenVersion: 0,
  isActive: true,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  const usersService = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByIdWithPassword: jest.fn(),
    updatePassword: jest.fn(),
    incrementTokenVersion: jest.fn(),
    markEmailVerified: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const redisService = { revoke: jest.fn(), revokeOnce: jest.fn() };
  const otpService = {
    expiresInSeconds: 600,
    issue: jest.fn(),
    consume: jest.fn(),
    clear: jest.fn(),
  };
  const mailService = {
    sendVerificationOtp: jest.fn(),
    sendPasswordResetOtp: jest.fn(),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        JWT_EXPIRES_IN: 3600,
        JWT_REFRESH_EXPIRES_IN: 604800,
        JWT_REFRESH_SECRET: 'different-refresh-secret-with-32-characters',
      };
      return values[key];
    }),
  };
  const comparePassword = compare as jest.MockedFunction<typeof compare>;
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      redisService as unknown as RedisService,
      otpService as unknown as OtpService,
      mailService as unknown as MailService,
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs bcrypt compare when the email does not exist', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    comparePassword.mockResolvedValue(false);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(comparePassword).toHaveBeenCalledTimes(1);
    expect(comparePassword.mock.calls[0][1]).toMatch(/^\$2b\$12\$/);
  });

  it('returns the same public error for a missing email and wrong password', async () => {
    comparePassword.mockResolvedValue(false);
    usersService.findByEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValue(USER);

    const readErrorResponse = async (promise: Promise<unknown>) =>
      promise.catch((error: unknown) =>
        error instanceof UnauthorizedException ? error.getResponse() : error,
      );

    const missingEmailResponse = await readErrorResponse(
      service.login({ email: 'missing@example.com', password: 'password123' }),
    );
    const wrongPasswordResponse = await readErrorResponse(
      service.login({ email: USER.email, password: 'wrong-password' }),
    );

    expect(missingEmailResponse).toEqual(wrongPasswordResponse);
    expect(missingEmailResponse).toMatchObject(
      expect.objectContaining({ statusCode: 401 }),
    );
  });

  it('returns the generic login error for a disabled user', async () => {
    usersService.findByEmail.mockResolvedValue({ ...USER, isActive: false });
    comparePassword.mockResolvedValue(true);

    await expect(
      service.login({ email: USER.email, password: 'password123' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('sends a verification OTP after registration without issuing tokens', async () => {
    usersService.create.mockResolvedValue({ ...USER, emailVerifiedAt: null });
    otpService.issue.mockResolvedValue('123456');
    mailService.sendVerificationOtp.mockResolvedValue(undefined);

    await service.register({
      username: USER.username,
      email: USER.email,
      password: 'password123',
    });

    expect(otpService.issue).toHaveBeenCalledWith(
      'email-verification',
      USER.email,
      true,
    );
    expect(mailService.sendVerificationOtp).toHaveBeenCalledWith(
      USER.email,
      '123456',
      600,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects login before email verification', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...USER,
      emailVerifiedAt: null,
    });
    comparePassword.mockResolvedValue(true);

    await expect(
      service.login({ email: USER.email, password: 'password123' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('verifies an email and issues tokens', async () => {
    const unverifiedUser = { ...USER, emailVerifiedAt: null };
    otpService.consume.mockResolvedValue(undefined);
    usersService.findByEmail.mockResolvedValue(unverifiedUser);
    usersService.markEmailVerified.mockResolvedValue(USER);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    await expect(
      service.verifyEmail({ email: USER.email, otp: '123456' }),
    ).resolves.toMatchObject({
      token: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(usersService.markEmailVerified).toHaveBeenCalledWith(unverifiedUser);
  });

  it('does not reveal whether a forgot-password email exists', async () => {
    otpService.issue.mockResolvedValue('123456');
    mailService.sendPasswordResetOtp.mockResolvedValue(undefined);
    usersService.findByEmail
      .mockResolvedValueOnce(USER)
      .mockResolvedValueOnce(null);

    await expect(
      service.forgotPassword({ email: USER.email }),
    ).resolves.toBeUndefined();
    await expect(
      service.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toBeUndefined();
    expect(mailService.sendPasswordResetOtp).toHaveBeenCalledTimes(1);
  });

  it('returns 503 and removes the OTP when email delivery fails', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...USER,
      emailVerifiedAt: null,
    });
    otpService.issue.mockResolvedValue('123456');
    otpService.clear.mockResolvedValue(undefined);
    mailService.sendVerificationOtp.mockRejectedValue(
      new Error('SMTP unavailable'),
    );

    await expect(
      service.resendVerification({ email: USER.email }),
    ).rejects.toMatchObject({ status: 503 });
    expect(otpService.clear).toHaveBeenCalledWith(
      'email-verification',
      USER.email,
    );
  });

  it('consumes a reset OTP and increments the token version', async () => {
    otpService.consume.mockResolvedValue(undefined);
    usersService.findByEmail.mockResolvedValue(USER);
    usersService.updatePassword.mockResolvedValue({
      ...USER,
      tokenVersion: 1,
    });

    await service.resetPassword({
      email: USER.email,
      otp: '123456',
      newPassword: 'new-password123',
    });

    expect(otpService.consume).toHaveBeenCalledWith(
      'password-reset',
      USER.email,
      '123456',
    );
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      USER,
      'new-password123',
    );
  });

  it('rejects a refresh token issued before an OTP password reset', async () => {
    otpService.consume.mockResolvedValue(undefined);
    usersService.findByEmail.mockResolvedValue(USER);
    usersService.updatePassword.mockResolvedValue({
      ...USER,
      tokenVersion: 1,
    });

    await service.resetPassword({
      email: USER.email,
      otp: '123456',
      newPassword: 'new-password123',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: USER.id,
      jti: 'old-refresh-id',
      exp: 2_000_000_000,
      type: 'refresh',
      version: 0,
    });
    usersService.findById.mockResolvedValue({ ...USER, tokenVersion: 1 });

    await expect(
      service.refresh({ refreshToken: 'old-refresh-token' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(redisService.revokeOnce).not.toHaveBeenCalled();
  });

  it('revokes the jti for the remaining token lifetime', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    redisService.revoke.mockResolvedValue(undefined);

    await service.logout({
      sub: USER.id,
      jti: 'token-id',
      exp: 1_700_000_060,
      type: 'access',
      version: 0,
    });

    expect(redisService.revoke).toHaveBeenCalledWith('token-id', 60);
  });

  it('returns 503 when Redis cannot revoke the token', async () => {
    redisService.revoke.mockRejectedValue(new Error('unavailable'));

    await expect(
      service.logout({
        sub: USER.id,
        jti: 'token-id',
        exp: 2_000_000_000,
        type: 'access',
        version: 0,
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('rejects a refresh token issued before a password change', async () => {
    usersService.findByIdWithPassword.mockResolvedValue({ ...USER });
    usersService.updatePassword.mockResolvedValue({
      ...USER,
      tokenVersion: 1,
    });
    comparePassword.mockResolvedValue(true);
    jwtService.signAsync
      .mockResolvedValueOnce('access-after-password-change')
      .mockResolvedValueOnce('refresh-after-password-change');

    await service.changePassword(USER.id, {
      currentPassword: 'password123',
      newPassword: 'new-password123',
    });

    jwtService.verifyAsync.mockResolvedValue({
      sub: USER.id,
      jti: 'refresh-id',
      exp: 2_000_000_000,
      type: 'refresh',
      version: 0,
    });
    usersService.findById.mockResolvedValue({ ...USER, tokenVersion: 1 });

    await expect(
      service.refresh({ refreshToken: 'old-refresh-token' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(redisService.revokeOnce).not.toHaveBeenCalled();
    expect(usersService.updatePassword).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER.id }),
      'new-password123',
    );
  });

  it('rotates a valid refresh token once', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: USER.id,
      jti: 'refresh-id',
      exp: 1_700_000_060,
      type: 'refresh',
      version: 0,
    });
    usersService.findById.mockResolvedValue(USER);
    redisService.revokeOnce.mockResolvedValue(true);
    jwtService.signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce('new-refresh-token');
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);

    await expect(
      service.refresh({ refreshToken: 'refresh-token' }),
    ).resolves.toMatchObject({
      token: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(redisService.revokeOnce).toHaveBeenCalledWith('refresh-id', 60);
  });

  it('returns 503 when Redis cannot rotate a refresh token', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: USER.id,
      jti: 'refresh-id',
      exp: 2_000_000_000,
      type: 'refresh',
      version: 0,
    });
    usersService.findById.mockResolvedValue(USER);
    redisService.revokeOnce.mockRejectedValue(new Error('unavailable'));

    await expect(
      service.refresh({ refreshToken: 'refresh-token' }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('returns 401 when the token user no longer exists', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      service.getCurrentUser('missing-user', 'token'),
    ).rejects.toMatchObject({ status: 401 });
  });
});
