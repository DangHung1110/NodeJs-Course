import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
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

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Authentication')
@Controller('users')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @Header('Expires', '0')
  @ApiOperation({ summary: 'Register a user' })
  @ApiCreatedResponse({ description: 'User created and authenticated.' })
  async register(
    @Body() body: RegisterEnvelope,
  ): Promise<{ user: UserResponse }> {
    return { user: await this.authService.register(body.user) };
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
}
