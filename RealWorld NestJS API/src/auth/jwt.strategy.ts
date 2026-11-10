import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './jwt-payload';
import { RedisService } from './redis.service';

const AUTHORIZATION_SCHEME = 'Token ';

function extractTokenFromAuthorizationHeader(request: {
  headers?: { authorization?: string };
}): string | null {
  const authorization = request.headers?.authorization;
  if (!authorization?.startsWith(AUTHORIZATION_SCHEME)) return null;
  return authorization.slice(AUTHORIZATION_SCHEME.length);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractTokenFromAuthorizationHeader,
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sub || !payload.jti || !payload.exp) {
      throw new UnauthorizedException();
    }

    let isRevoked: boolean;
    try {
      isRevoked = await this.redisService.isRevoked(payload.jti);
    } catch (error) {
      throw new ServiceUnavailableException(
        'Authentication status is temporarily unavailable.',
        { cause: error },
      );
    }
    if (isRevoked) throw new UnauthorizedException('Token has been revoked.');

    return payload;
  }
}
