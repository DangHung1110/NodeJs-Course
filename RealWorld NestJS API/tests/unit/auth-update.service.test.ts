import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../src/auth/auth.service';
import { MailService } from '../../src/mail/mail.service';
import { OtpService } from '../../src/auth/otp.service';
import { RedisService } from '../../src/auth/redis.service';
import { UsersService } from '../../src/users/users.service';
import { UserEntity } from '../../src/database/entities/user.entity';

describe('AuthService user update', () => {
  const updatedUser = {
    id: 'user-id',
    username: 'jane',
    email: 'new@example.com',
    bio: null,
    image: null,
    tokenVersion: 0,
  } as UserEntity;
  const usersService = {
    update: jest.fn(),
  };
  const otpService = {
    issue: jest.fn(),
    clear: jest.fn(),
    expiresInSeconds: 600,
  };
  const mailService = {
    sendOtp: jest.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    otpService.issue.mockResolvedValue('123456');
    otpService.clear.mockResolvedValue(undefined);
    mailService.sendOtp.mockResolvedValue(undefined);

    const configService = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          JWT_EXPIRES_IN: 900,
          JWT_REFRESH_EXPIRES_IN: 604800,
          JWT_REFRESH_SECRET: 'refresh-secret-at-least-thirty-two-characters',
        };
        return values[key];
      }),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      {} as JwtService,
      {} as RedisService,
      otpService as unknown as OtpService,
      mailService as unknown as MailService,
      configService as unknown as ConfigService,
    );
  });

  it('sends a replacement verification OTP when the email changes', async () => {
    usersService.update.mockResolvedValue({
      user: updatedUser,
      hasEmailChanged: true,
    });

    await expect(
      service.updateCurrentUser('user-id', 'Token current-token', {
        email: 'new@example.com',
      }),
    ).resolves.toMatchObject({
      user: { email: 'new@example.com', token: 'current-token' },
    });
    expect(otpService.issue).toHaveBeenCalledWith(
      'email-verification',
      'new@example.com',
      true,
    );
    expect(mailService.sendOtp).toHaveBeenCalledWith(
      'new@example.com',
      'email-verification',
      '123456',
      600,
    );
  });

  it('does not send an OTP when the email stays unchanged', async () => {
    usersService.update.mockResolvedValue({
      user: updatedUser,
      hasEmailChanged: false,
    });

    await service.updateCurrentUser('user-id', 'Token current-token', {
      bio: 'updated bio',
    });

    expect(otpService.issue).not.toHaveBeenCalled();
    expect(mailService.sendOtp).not.toHaveBeenCalled();
  });
});
