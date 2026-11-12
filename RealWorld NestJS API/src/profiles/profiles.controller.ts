import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import type { ProfileEnvelopeResponse } from './profile-response';
import { ProfilesService } from './profiles.service';
import type { OptionalAuthenticatedRequest } from './profiles.types';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':username')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get a public user profile' })
  @ApiOkResponse({ description: 'Public profile with following status.' })
  getProfile(
    @Param('username') username: string,
    @Req() request: OptionalAuthenticatedRequest,
  ): Promise<ProfileEnvelopeResponse> {
    return this.profilesService.getProfile(username, request.user?.sub);
  }

  @Post(':username/follow')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Follow a user' })
  @ApiOkResponse({ description: 'Followed profile.' })
  follow(
    @Param('username') username: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileEnvelopeResponse> {
    return this.profilesService.follow(username, request.user.sub);
  }

  @Delete(':username/follow')
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('TokenAuth')
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiOkResponse({ description: 'Unfollowed profile.' })
  unfollow(
    @Param('username') username: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileEnvelopeResponse> {
    return this.profilesService.unfollow(username, request.user.sub);
  }
}
