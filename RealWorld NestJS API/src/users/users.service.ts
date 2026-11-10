import {
  Injectable,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { RegisterUserDto } from './dto/register-user.dto';

const DUPLICATE_KEY_CODE = 'ER_DUP_ENTRY';

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
      select: ['id', 'username', 'email', 'passwordHash', 'bio', 'image'],
    });
  }

  findById(id: string): Promise<UserEntity | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
