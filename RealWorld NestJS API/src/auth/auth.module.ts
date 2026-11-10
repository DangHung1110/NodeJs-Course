import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { AuthController, CurrentUserController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { OtpService } from './otp.service';

const LOGIN_THROTTLE_TTL_MS = 60_000;
const LOGIN_THROTTLE_LIMIT = 10;

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    ThrottlerModule.forRoot([
      { ttl: LOGIN_THROTTLE_TTL_MS, limit: LOGIN_THROTTLE_LIMIT },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: configService.getOrThrow<number>('JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [AuthController, CurrentUserController],
  providers: [AuthService, JwtStrategy, OtpService],
})
export class AuthModule {}
