import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthService } from './auth.service';
import { JwtPayload } from './jwt-payload';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import {
  EmailDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from '../users/dto/email-verification.dto';
import { RefreshTokenDto } from '../users/dto/refresh-token.dto';
import { RegisterUserDto } from '../users/dto/register-user.dto';
import { UserResponse } from '../users/user-response';

class RegisterEnvelope {
  @ApiProperty({ type: RegisterUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RegisterUserDto)
  user!: RegisterUserDto;
}

class LoginEnvelope {
  @ApiProperty({ type: LoginUserDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LoginUserDto)
  user!: LoginUserDto;
}

class ChangePasswordEnvelope {
  @ApiProperty({ type: ChangePasswordDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => ChangePasswordDto)
  user!: ChangePasswordDto;
}

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

interface MessageResponse {
  readonly message: string;
}

@ApiTags('Authentication')
@Controller('users')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Register a user' })
  @ApiCreatedResponse({ description: 'User created; verification required.' })
  async register(@Body() body: RegisterEnvelope): Promise<MessageResponse> {
    await this.authService.register(body.user);
    return { message: 'Check your email for the verification code.' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ description: 'Authenticated user and JWT.' })
  async login(@Body() body: LoginEnvelope): Promise<{ user: UserResponse }> {
    return { user: await this.authService.login(body.user) };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Verify an email address with a one-time code' })
  @ApiOkResponse({ description: 'Email verified and tokens issued.' })
  async verifyEmail(
    @Body() body: VerifyEmailDto,
  ): Promise<{ user: UserResponse }> {
    return { user: await this.authService.verifyEmail(body) };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Request another email verification code' })
  @ApiOkResponse({ description: 'Generic verification request response.' })
  async resendVerification(@Body() body: EmailDto): Promise<MessageResponse> {
    await this.authService.resendVerification(body);
    return {
      message: 'If the account can be verified, a code has been sent.',
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiOkResponse({ description: 'Generic password reset request response.' })
  async forgotPassword(@Body() body: EmailDto): Promise<MessageResponse> {
    await this.authService.forgotPassword(body);
    return {
      message: 'If the account exists, a password reset code has been sent.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Reset a password with a one-time code' })
  @ApiOkResponse({ description: 'Password reset and sessions revoked.' })
  async resetPassword(
    @Body() body: ResetPasswordDto,
  ): Promise<MessageResponse> {
    await this.authService.resetPassword(body);
    return { message: 'Password reset successfully.' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiOkResponse({ description: 'New access and refresh tokens.' })
  async refresh(
    @Body() body: RefreshTokenDto,
  ): Promise<{ user: UserResponse }> {
    return { user: await this.authService.refresh(body) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Revoke the current JWT' })
  @ApiOkResponse({ description: 'Token revoked.', schema: { example: {} } })
  async logout(
    @Req() request: AuthenticatedRequest,
  ): Promise<Record<string, never>> {
    await this.authService.logout(request.user);
    return {};
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Revoke all user sessions' })
  @ApiOkResponse({
    description: 'All sessions revoked.',
    schema: { example: {} },
  })
  async logoutAll(
    @Req() request: AuthenticatedRequest,
  ): Promise<Record<string, never>> {
    await this.authService.logoutAll(request.user);
    return {};
  }
}

@ApiTags('Users')
@Controller('user')
export class CurrentUserController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({ description: 'Current user.' })
  async getCurrentUser(
    @Req() request: AuthenticatedRequest,
  ): Promise<{ user: UserResponse }> {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Token ')
      ? authorization.slice('Token '.length)
      : '';
    return {
      user: await this.authService.getCurrentUser(request.user.sub, token),
    };
  }

  @Put('password')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'), ThrottlerGuard)
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Change the authenticated user password' })
  @ApiOkResponse({ description: 'Password changed and tokens rotated.' })
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: ChangePasswordEnvelope,
  ): Promise<{ user: UserResponse }> {
    return {
      user: await this.authService.changePassword(request.user.sub, body.user),
    };
  }
}
