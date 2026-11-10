import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { compare } from 'bcryptjs';
import { JwtPayload } from './jwt-payload';
import { RedisService } from './redis.service';
import { UsersService } from '../users/users.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { RegisterUserDto } from '../users/dto/register-user.dto';
import { UserResponse, toAuthenticatedUser } from '../users/user-response';

@Injectable()
export class AuthService {
  private readonly tokenLifetimeSeconds: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    configService: ConfigService,
  ) {
    this.tokenLifetimeSeconds =
      configService.getOrThrow<number>('JWT_EXPIRES_IN');
  }

  async register(input: RegisterUserDto): Promise<UserResponse> {
    return this.issueToken(await this.usersService.create(input));
  }

  async login(input: LoginUserDto): Promise<UserResponse> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.issueToken(user);
  }

  async getCurrentUser(userId: string, token: string): Promise<UserResponse> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found.');
    return { ...toAuthenticatedUser(user), token };
  }

  async logout(payload: JwtPayload): Promise<void> {
    const remainingSeconds = payload.exp - Math.floor(Date.now() / 1000);
    await this.redisService.revoke(payload.jti, remainingSeconds);
  }

  private async issueToken(user: {
    id: string;
    username: string;
    email: string;
    bio: string | null;
    image: string | null;
  }): Promise<UserResponse> {
    const token = await this.jwtService.signAsync(
      { jti: randomUUID() },
      { subject: user.id, expiresIn: this.tokenLifetimeSeconds },
    );
    return { ...toAuthenticatedUser(user), token };
  }
}
