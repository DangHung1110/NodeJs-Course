import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Server } from 'node:net';
import request from 'supertest';
import { configureApp } from '../../src/app.setup';
import { CurrentUserController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { JwtPayload } from '../../src/auth/jwt-payload';
import { AvatarService } from '../../src/users/avatar.service';
import { OptionalJwtAuthGuard } from '../../src/profiles/optional-jwt-auth.guard';
import { ProfilesController } from '../../src/profiles/profiles.controller';
import { ProfilesService } from '../../src/profiles/profiles.service';

class TestJwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    request.user = {
      sub: 'viewer-id',
      jti: 'test-jti',
      exp: Math.floor(Date.now() / 1000) + 60,
      type: 'access',
      version: 0,
    };
    return true;
  }
}

describe('PR-03 HTTP contract', () => {
  let app: INestApplication;
  let server: Server;
  const authService = {
    updateCurrentUser: jest.fn(),
    getCurrentUser: jest.fn(),
    changePassword: jest.fn(),
  };
  const avatarService = { upload: jest.fn() };
  const profilesService = {
    getProfile: jest.fn(),
    follow: jest.fn(),
    unfollow: jest.fn(),
  };

  beforeAll(async () => {
    const jwtGuard = AuthGuard('jwt');
    const module = await Test.createTestingModule({
      controllers: [CurrentUserController, ProfilesController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AvatarService, useValue: avatarService },
        { provide: ProfilesService, useValue: profilesService },
        OptionalJwtAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback: unknown) =>
              key === 'NODE_ENV' ? 'production' : fallback,
          },
        },
      ],
    })
      .overrideGuard(jwtGuard)
      .useClass(TestJwtGuard)
      .overrideGuard(ThrottlerGuard)
      .useClass(TestJwtGuard)
      .compile();

    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    const httpServer = app.getHttpServer() as unknown;
    if (!(httpServer instanceof Server))
      throw new Error('HTTP server unavailable.');
    server = httpServer;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authService.updateCurrentUser.mockResolvedValue({
      user: {
        username: 'updated',
        email: 'updated@example.com',
        bio: null,
        image: null,
        token: 'token',
      },
    });
    profilesService.getProfile.mockResolvedValue({
      profile: {
        username: 'target',
        bio: null,
        image: null,
        following: false,
      },
    });
    profilesService.follow.mockResolvedValue({
      profile: {
        username: 'target',
        bio: null,
        image: null,
        following: true,
      },
    });
  });

  it('validates and updates the current user envelope', async () => {
    await request(server)
      .put('/api/user')
      .set('Authorization', 'Token test')
      .send({ user: { email: 'updated@example.com' } })
      .expect(200, {
        user: {
          username: 'updated',
          email: 'updated@example.com',
          bio: null,
          image: null,
          token: 'token',
        },
      });

    expect(authService.updateCurrentUser).toHaveBeenCalledWith(
      'viewer-id',
      'Token test',
      { email: 'updated@example.com' },
    );
  });

  it('rejects invalid update fields with 422', async () => {
    await request(server)
      .put('/api/user')
      .set('Authorization', 'Token test')
      .send({ user: { email: 'invalid' } })
      .expect(422);
  });

  it('returns a public profile without authentication', async () => {
    await request(server)
      .get('/api/profiles/target')
      .expect(200, {
        profile: {
          username: 'target',
          bio: null,
          image: null,
          following: false,
        },
      });
  });

  it('follows a profile through the authenticated endpoint', async () => {
    await request(server)
      .post('/api/profiles/target/follow')
      .set('Authorization', 'Token test')
      .expect(200, {
        profile: {
          username: 'target',
          bio: null,
          image: null,
          following: true,
        },
      });
    expect(profilesService.follow).toHaveBeenCalledWith('target', 'viewer-id');
  });

  it('rejects a missing avatar file', async () => {
    avatarService.upload.mockRejectedValue(
      new UnprocessableEntityException({
        errors: { avatar: ['An avatar file is required.'] },
      }),
    );
    await request(server)
      .post('/api/user/avatar')
      .set('Authorization', 'Token test')
      .expect(422);
  });

  it('rejects an avatar larger than 5 MiB before the service runs', async () => {
    await request(server)
      .post('/api/user/avatar')
      .set('Authorization', 'Token test')
      .attach('avatar', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')
      .expect(413);
    expect(avatarService.upload).not.toHaveBeenCalled();
  });
});
