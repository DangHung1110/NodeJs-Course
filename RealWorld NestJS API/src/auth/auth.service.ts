import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { compare } from 'bcryptjs';
import { JwtPayload, RefreshTokenPayload } from './jwt-payload';
import { RedisService } from './redis.service';
import { OtpPurpose, OtpService } from './otp.service';
import { UserEntity } from '../database/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import {
  EmailDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '../users/dto/email-verification.dto';
import { UsersService } from '../users/users.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { RefreshTokenDto } from '../users/dto/refresh-token.dto';
import { RegisterUserDto } from '../users/dto/register-user.dto';
import { UserResponse, toAuthenticatedUser } from '../users/user-response';

const DUMMY_PASSWORD_HASH =
  '$2b$12$ev5QisFPq.GTr8lBXyrRn.AYekKD3dnwwJ124UMocd1YQFtkF49eC';

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

  async register(input: RegisterUserDto): Promise<void> {
    const user = await this.usersService.create(input);
    await this.sendVerificationCode(user.email, true);
  }

  async login(input: LoginUserDto): Promise<UserResponse> {
    const user = await this.usersService.findByEmail(input.email);
    const passwordMatches = await compare(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !user.isActive || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Email verification is required.');
    }
    return this.issueTokens(user);
  }

  async verifyEmail(input: VerifyEmailDto): Promise<UserResponse> {
    await this.otpService.consume('email-verification', input.email, input.otp);
    const user = await this.usersService.findByEmail(input.email);
    if (!user?.isActive || user.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }
    return this.issueTokens(await this.usersService.markEmailVerified(user));
  }

  async resendVerification(input: EmailDto): Promise<void> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user?.isActive || user.emailVerifiedAt) return;
    await this.sendVerificationCode(user.email, false);
  }

  async forgotPassword(input: EmailDto): Promise<void> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user?.isActive || !user.emailVerifiedAt) return;
    await this.sendPasswordResetCode(user.email);
  }

  async resetPassword(input: ResetPasswordDto): Promise<void> {
    await this.otpService.consume('password-reset', input.email, input.otp);
    const user = await this.usersService.findByEmail(input.email);
    if (!user?.isActive || !user.emailVerifiedAt) {
      throw new UnauthorizedException('Invalid or expired verification code.');
    }
    await this.usersService.updatePassword(user, input.newPassword);
  }

  async refresh(input: RefreshTokenDto): Promise<UserResponse> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        input.refreshToken,
        {
          secret: this.refreshTokenSecret,
          algorithms: ['HS256'],
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (
      payload.type !== 'refresh' ||
      !payload.sub ||
      !payload.jti ||
      !payload.exp ||
      !Number.isInteger(payload.version)
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.usersService.findById(payload.sub);
    if (
      !user ||
      !user.isActive ||
      !user.emailVerifiedAt ||
      user.tokenVersion !== payload.version
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const remainingSeconds = Math.max(
      0,
      payload.exp - Math.floor(Date.now() / 1000),
    );
    let revoked: boolean;
    try {
      revoked = await this.redisService.revokeOnce(
        payload.jti,
        remainingSeconds,
      );
    } catch (error) {
      throw new ServiceUnavailableException(
        'Token revocation is temporarily unavailable.',
        { cause: error },
      );
    }
    if (!revoked) throw new UnauthorizedException('Invalid refresh token.');

    return this.issueTokens(user);
  }

  async getCurrentUser(userId: string, token: string): Promise<UserResponse> {
    const user = await this.usersService.findById(userId);
    if (!user?.isActive || !user.emailVerifiedAt) {
      throw new UnauthorizedException();
    }
    return { ...toAuthenticatedUser(user), token };
  }

  async changePassword(
    userId: string,
    input: ChangePasswordDto,
  ): Promise<UserResponse> {
    const user = await this.usersService.findByIdWithPassword(userId);
    const passwordMatches = await compare(
      input.currentPassword,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !user.isActive || !user.emailVerifiedAt || !passwordMatches) {
      throw new UnauthorizedException('Current password is invalid.');
    }

    return this.issueTokens(
      await this.usersService.updatePassword(user, input.newPassword),
    );
  }

  async logoutAll(payload: JwtPayload): Promise<void> {
    const user = await this.usersService.findById(payload.sub);
    if (!user?.isActive) throw new UnauthorizedException();
    await this.usersService.incrementTokenVersion(user);
    await this.logout(payload);
  }

  async logout(payload: JwtPayload): Promise<void> {
    const remainingSeconds = Math.max(
      0,
      payload.exp - Math.floor(Date.now() / 1000),
    );
    try {
      await this.redisService.revoke(payload.jti, remainingSeconds);
    } catch (error) {
      throw new ServiceUnavailableException(
        'Token revocation is temporarily unavailable.',
        { cause: error },
      );
    }
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

  private async sendVerificationCode(
    email: string,
    replaceExisting: boolean,
  ): Promise<void> {
    await this.sendOtp('email-verification', email, replaceExisting, (otp) =>
      this.mailService.sendVerificationOtp(
        email,
        otp,
        this.otpService.expiresInSeconds,
      ),
    );
  }

  private async sendPasswordResetCode(email: string): Promise<void> {
    await this.sendOtp('password-reset', email, false, (otp) =>
      this.mailService.sendPasswordResetOtp(
        email,
        otp,
        this.otpService.expiresInSeconds,
      ),
    );
  }

  private async sendOtp(
    purpose: OtpPurpose,
    email: string,
    replaceExisting: boolean,
    send: (otp: string) => Promise<void>,
  ): Promise<void> {
    const otp = await this.otpService.issue(purpose, email, replaceExisting);
    if (!otp) return;
    try {
      await send(otp);
    } catch (error) {
      await this.otpService.clear(purpose, email);
      throw new ServiceUnavailableException(
        'Email delivery is temporarily unavailable.',
        { cause: error },
      );
    }
  }
}
