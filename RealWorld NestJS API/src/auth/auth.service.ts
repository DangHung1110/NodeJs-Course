import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { compare } from 'bcryptjs';
import {
  AUTHORIZATION_SCHEME,
  DUMMY_PASSWORD_HASH,
  FORGOT_PASSWORD_MESSAGE,
  REGISTER_SUCCESS_MESSAGE,
  RESEND_VERIFICATION_MESSAGE,
  RESET_PASSWORD_SUCCESS_MESSAGE,
} from './auth.constants';
import { JwtPayload, RefreshTokenPayload } from './jwt-payload';
import { RedisService } from './redis.service';
import { OtpPurpose, OtpService } from './otp.service';
import { UserEntity } from '../database/entities/user.entity';
import { MailService } from '../mail/mail.service';
import {
  ChangePasswordDto,
  EmailDto,
  LoginUserDto,
  RefreshTokenDto,
  RegisterUserDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import { UsersService } from '../users/users.service';
import { UserResponse, toAuthenticatedUser } from '../users/user-response';
import { UpdateUserDto } from '../users/update-user.dto';
import type {
  EmptyResponse,
  MessageResponse,
  UserEnvelopeResponse,
} from './auth.types';

@Injectable()
export class AuthService {
  private readonly accessTokenLifetimeSeconds: number;
  private readonly refreshTokenLifetimeSeconds: number;
  private readonly refreshTokenSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly otpService: OtpService,
    private readonly mailService: MailService,
    configService: ConfigService,
  ) {
    this.accessTokenLifetimeSeconds =
      configService.getOrThrow<number>('JWT_EXPIRES_IN');
    this.refreshTokenLifetimeSeconds = configService.getOrThrow<number>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    this.refreshTokenSecret =
      configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  async register(input: RegisterUserDto): Promise<MessageResponse> {
    const user = await this.usersService.create(input);
    await this.sendOtp('email-verification', user.email, true);
    return { message: REGISTER_SUCCESS_MESSAGE };
  }

  async login(input: LoginUserDto): Promise<UserEnvelopeResponse> {
    const user = await this.usersService.findByEmail(input.email);
    if (
      !user?.isActive ||
      !(await this.passwordMatches(user, input.password))
    ) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email verification is required.');
    }
    return { user: await this.issueTokens(user) };
  }

  async verifyEmail(input: VerifyEmailDto): Promise<UserEnvelopeResponse> {
    await this.otpService.consume('email-verification', input.email, input.otp);
    const user = await this.usersService.findByEmail(input.email);
    if (!user?.isActive || user.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }
    return {
      user: await this.issueTokens(
        await this.usersService.markEmailVerified(user),
      ),
    };
  }

  async resendVerification(input: EmailDto): Promise<MessageResponse> {
    const user = await this.usersService.findByEmail(input.email);
    if (user?.isActive && !user.emailVerifiedAt) {
      await this.sendOtp('email-verification', user.email);
    }
    return { message: RESEND_VERIFICATION_MESSAGE };
  }

  async forgotPassword(input: EmailDto): Promise<MessageResponse> {
    const user = await this.usersService.findByEmail(input.email);
    if (user?.isActive && user.emailVerifiedAt) {
      await this.sendOtp('password-reset', user.email);
    }
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(input: ResetPasswordDto): Promise<MessageResponse> {
    await this.otpService.consume('password-reset', input.email, input.otp);
    const user = await this.usersService.findByEmail(input.email);
    if (!user?.isActive || !user.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }
    await this.usersService.updatePassword(user, input.newPassword);
    return { message: RESET_PASSWORD_SUCCESS_MESSAGE };
  }

  async refresh(input: RefreshTokenDto): Promise<UserEnvelopeResponse> {
    const payload = await this.verifyRefreshToken(input.refreshToken);
    const user = await this.usersService.findById(payload.sub);
    if (
      !user ||
      !user.isActive ||
      !user.emailVerifiedAt ||
      user.tokenVersion !== payload.version
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const revoked = await this.revokeToken(payload, true);
    if (!revoked) this.invalidRefreshToken();

    return { user: await this.issueTokens(user) };
  }

  async getCurrentUser(
    userId: string,
    authorization?: string,
  ): Promise<UserEnvelopeResponse> {
    const user = await this.usersService.findById(userId);
    if (!user?.isActive || !user.emailVerifiedAt) {
      throw new UnauthorizedException();
    }
    const token = authorization?.startsWith(AUTHORIZATION_SCHEME)
      ? authorization.slice(AUTHORIZATION_SCHEME.length)
      : '';
    return { user: { ...toAuthenticatedUser(user), token } };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordDto,
  ): Promise<UserEnvelopeResponse> {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (
      !user?.isActive ||
      !user.emailVerifiedAt ||
      !(await this.passwordMatches(user, input.currentPassword))
    ) {
      throw new UnauthorizedException('Current password is invalid.');
    }

    return {
      user: await this.issueTokens(
        await this.usersService.updatePassword(user, input.newPassword),
      ),
    };
  }

  async updateCurrentUser(
    userId: string,
    authorization: string | undefined,
    input: UpdateUserDto,
  ): Promise<UserEnvelopeResponse> {
    const { user, hasPasswordChanged } = await this.usersService.update(
      userId,
      input,
    );
    if (hasPasswordChanged) return { user: await this.issueTokens(user) };

    const token = authorization?.startsWith(AUTHORIZATION_SCHEME)
      ? authorization.slice(AUTHORIZATION_SCHEME.length)
      : '';
    return { user: { ...toAuthenticatedUser(user), token } };
  }

  async logoutAll(payload: JwtPayload): Promise<EmptyResponse> {
    const user = await this.usersService.findById(payload.sub);
    if (!user?.isActive) throw new UnauthorizedException();
    await this.usersService.incrementTokenVersion(user);
    await this.logout(payload);
    return {};
  }

  async logout(payload: JwtPayload): Promise<EmptyResponse> {
    await this.revokeToken(payload);
    return {};
  }

  private async issueTokens(user: UserEntity): Promise<UserResponse> {
    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          jti: randomUUID(),
          type: 'access',
          version: user.tokenVersion,
        },
        {
          subject: user.id,
          expiresIn: this.accessTokenLifetimeSeconds,
          algorithm: 'HS256',
        },
      ),
      this.jwtService.signAsync(
        {
          jti: randomUUID(),
          type: 'refresh',
          version: user.tokenVersion,
        },
        {
          subject: user.id,
          expiresIn: this.refreshTokenLifetimeSeconds,
          secret: this.refreshTokenSecret,
          algorithm: 'HS256',
        },
      ),
    ]);
    return { ...toAuthenticatedUser(user), token, refreshToken };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        {
          secret: this.refreshTokenSecret,
          algorithms: ['HS256'],
        },
      );
      if (
        payload.type !== 'refresh' ||
        !payload.sub ||
        !payload.jti ||
        !payload.exp ||
        !Number.isInteger(payload.version)
      ) {
        this.invalidRefreshToken();
      }
      return payload;
    } catch {
      return this.invalidRefreshToken();
    }
  }

  private invalidRefreshToken(): never {
    throw new UnauthorizedException('Invalid refresh token.');
  }

  private passwordMatches(
    user: UserEntity | null,
    password: string,
  ): Promise<boolean> {
    return compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  }

  private async revokeToken(
    payload: Pick<JwtPayload, 'jti' | 'exp'>,
    once = false,
  ): Promise<boolean> {
    const ttl = Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
    try {
      if (once) return this.redisService.revokeOnce(payload.jti, ttl);
      await this.redisService.revoke(payload.jti, ttl);
      return true;
    } catch (error) {
      throw new ServiceUnavailableException(
        'Token revocation is temporarily unavailable.',
        { cause: error },
      );
    }
  }

  private async sendOtp(
    purpose: OtpPurpose,
    email: string,
    replaceExisting = false,
  ): Promise<void> {
    const otp = await this.otpService.issue(purpose, email, replaceExisting);
    if (!otp) return;
    try {
      await this.mailService.sendOtp(
        email,
        purpose,
        otp,
        this.otpService.expiresInSeconds,
      );
    } catch (error) {
      await this.otpService.clear(purpose, email);
      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable.',
        { cause: error },
      );
    }
  }
}
