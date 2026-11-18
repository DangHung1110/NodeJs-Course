import {
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { RegisterUserDto } from '../auth/auth.dto';
import { UserEntity } from '../database/entities/user.entity';
import { isDuplicateKeyError } from '../database/mysql-error.util';
import { UpdateUserDto } from './update-user.dto';
import { PASSWORD_HASH_ROUNDS } from './users.constants';

const USER_WITH_PASSWORD = [
  'id',
  'username',
  'email',
  'passwordHash',
  'bio',
  'image',
  'tokenVersion',
  'isActive',
  'emailVerifiedAt',
] as (keyof UserEntity)[];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(input: RegisterUserDto): Promise<UserEntity> {
    const user = this.usersRepository.create({
      username: input.username.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash: await hash(input.password, PASSWORD_HASH_ROUNDS),
      bio: null,
      image: null,
    });

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new UnprocessableEntityException({
          errors: { body: ['Username or email is already taken.'] },
        });
      }
      throw new InternalServerErrorException('Unable to create account.', {
        cause: error,
      });
    }
  }

  findByEmail(email: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({
      where: { email: email.trim().toLowerCase() },
      select: USER_WITH_PASSWORD,
    });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByIdWithPassword(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({
      where: { id },
      select: USER_WITH_PASSWORD,
    });
  }

  async updatePassword(
    user: UserEntity,
    password: string,
  ): Promise<UserEntity> {
    user.passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);
    user.tokenVersion += 1;
    return this.usersRepository.save(user);
  }

  async update(
    userId: string,
    input: UpdateUserDto,
  ): Promise<{ user: UserEntity; hasEmailChanged: boolean }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UnprocessableEntityException({
        errors: { user: ['User no longer exists.'] },
      });
    }

    if (input.username !== undefined) user.username = input.username;
    const hasEmailChanged =
      input.email !== undefined && input.email !== user.email;
    if (input.email !== undefined && input.email !== user.email) {
      user.email = input.email;
      user.emailVerifiedAt = null;
    }
    if (input.bio !== undefined) user.bio = input.bio;

    try {
      return {
        user: await this.usersRepository.save(user),
        hasEmailChanged,
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new UnprocessableEntityException({
          errors: { body: ['Username or email is already taken.'] },
        });
      }
      throw new InternalServerErrorException('Unable to update account.', {
        cause: error,
      });
    }
  }

  async incrementTokenVersion(user: UserEntity): Promise<UserEntity> {
    user.tokenVersion += 1;
    return this.usersRepository.save(user);
  }

  async markEmailVerified(user: UserEntity): Promise<UserEntity> {
    user.emailVerifiedAt = new Date();
    return this.usersRepository.save(user);
  }
}
