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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiConsumes,
  ApiBody,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ChangePasswordEnvelope,
  EmailDto,
  LoginEnvelope,
  RefreshTokenDto,
  RegisterEnvelope,
  ResetPasswordDto,
  VerifyEmailDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import type {
  AuthenticatedRequest,
  EmptyResponse,
  MessageResponse,
  UserEnvelopeResponse,
} from './auth.types';
import { AvatarService } from '../users/avatar.service';
import {
  AVATAR_FIELD_NAME,
  AVATAR_MAX_FILE_SIZE,
  AVATAR_MIME_TYPES,
} from '../users/avatar.constants';
import { UpdateUserEnvelope } from '../users/update-user.dto';

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
  register(@Body() body: RegisterEnvelope): Promise<MessageResponse> {
    return this.authService.register(body.user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiOkResponse({ description: 'Authenticated user and JWT.' })
  login(@Body() body: LoginEnvelope): Promise<UserEnvelopeResponse> {
    return this.authService.login(body.user);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Verify an email address with a one-time code' })
  @ApiOkResponse({ description: 'Email verified and tokens issued.' })
  verifyEmail(@Body() body: VerifyEmailDto): Promise<UserEnvelopeResponse> {
    return this.authService.verifyEmail(body);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Request another email verification code' })
  @ApiOkResponse({ description: 'Generic verification request response.' })
  resendVerification(@Body() body: EmailDto): Promise<MessageResponse> {
    return this.authService.resendVerification(body);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiOkResponse({ description: 'Generic password reset request response.' })
  forgotPassword(@Body() body: EmailDto): Promise<MessageResponse> {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Reset a password with a one-time code' })
  @ApiOkResponse({ description: 'Password reset and sessions revoked.' })
  resetPassword(@Body() body: ResetPasswordDto): Promise<MessageResponse> {
    return this.authService.resetPassword(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Rotate a refresh token' })
  @ApiOkResponse({ description: 'New access and refresh tokens.' })
  refresh(@Body() body: RefreshTokenDto): Promise<UserEnvelopeResponse> {
    return this.authService.refresh(body);
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
  logout(@Req() request: AuthenticatedRequest): Promise<EmptyResponse> {
    return this.authService.logout(request.user);
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
  logoutAll(@Req() request: AuthenticatedRequest): Promise<EmptyResponse> {
    return this.authService.logoutAll(request.user);
  }
}

@ApiTags('Users')
@Controller('user')
export class CurrentUserController {
  constructor(
    private readonly authService: AuthService,
    private readonly avatarService: AvatarService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({ description: 'Current user.' })
  getCurrentUser(
    @Req() request: AuthenticatedRequest,
  ): Promise<UserEnvelopeResponse> {
    return this.authService.getCurrentUser(
      request.user.sub,
      request.headers.authorization,
    );
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Update the authenticated user' })
  @ApiOkResponse({ description: 'Updated user.' })
  updateCurrentUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateUserEnvelope,
  ): Promise<UserEnvelopeResponse> {
    return this.authService.updateCurrentUser(
      request.user.sub,
      request.headers.authorization,
      body.user,
    );
  }

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor(AVATAR_FIELD_NAME, {
      limits: { fileSize: AVATAR_MAX_FILE_SIZE, files: 1 },
      fileFilter: (_request, file, callback) => {
        callback(
          null,
          AVATAR_MIME_TYPES.some((mimeType) => mimeType === file.mimetype),
        );
      },
    }),
  )
  @ApiSecurity('TokenAuth')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [AVATAR_FIELD_NAME],
      properties: {
        [AVATAR_FIELD_NAME]: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a JPEG, PNG, or WebP avatar (max 5 MiB)' })
  @ApiOkResponse({ description: 'User with updated public avatar URL.' })
  async uploadAvatar(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserEnvelopeResponse> {
    await this.avatarService.upload(request.user.sub, file);
    return this.authService.getCurrentUser(
      request.user.sub,
      request.headers.authorization,
    );
  }

  @Put('password')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'), ThrottlerGuard)
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Change the authenticated user password' })
  @ApiOkResponse({ description: 'Password changed and tokens rotated.' })
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: ChangePasswordEnvelope,
  ): Promise<UserEnvelopeResponse> {
    return this.authService.changePassword(request.user.sub, body.user);
  }
}
