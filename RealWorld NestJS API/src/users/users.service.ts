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
import { UpdateUserDto } from './update-user.dto';

const DUPLICATE_KEY_CODE = 'ER_DUP_ENTRY';
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

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'driverError' in error &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    error.driverError.code === DUPLICATE_KEY_CODE
  );
}

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
      passwordHash: await hash(input.password, 12),
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
    user.passwordHash = await hash(password, 12);
    user.tokenVersion += 1;
    return this.usersRepository.save(user);
  }

  async update(
    userId: string,
    input: UpdateUserDto,
  ): Promise<{ user: UserEntity; hasPasswordChanged: boolean }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UnprocessableEntityException({
        errors: { user: ['User no longer exists.'] },
      });
    }

    if (input.username !== undefined) user.username = input.username;
    if (input.email !== undefined) user.email = input.email;
    if (input.bio !== undefined) user.bio = input.bio;

    const hasPasswordChanged = input.password !== undefined;
    if (input.password !== undefined) {
      user.passwordHash = await hash(input.password, 12);
      user.tokenVersion += 1;
    }

    try {
      return {
        user: await this.usersRepository.save(user),
        hasPasswordChanged,
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
