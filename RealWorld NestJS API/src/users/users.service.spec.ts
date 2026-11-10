import { ConflictException } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { UsersService } from './users.service';

jest.mock('bcryptjs', () => ({ hash: jest.fn() }));

const USER: UserEntity = {
  id: 'user-id',
  username: 'jane',
  email: 'jane@example.com',
  passwordHash: 'password-hash',
  bio: null,
  image: null,
  tokenVersion: 0,
  isActive: true,
  emailVerifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  const repository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const hashPassword = hash as jest.MockedFunction<typeof hash>;
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockReturnValue(USER);
    hashPassword.mockResolvedValue('password-hash');
    service = new UsersService(repository as unknown as Repository<UserEntity>);
  });

  it('normalizes email before saving', async () => {
    repository.save.mockResolvedValue(USER);

    await service.create({
      username: '  jane  ',
      email: '  JANE@EXAMPLE.COM  ',
      password: 'password123',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'jane',
        email: 'jane@example.com',
      }),
    );
  });

  it('maps only duplicate-key errors to 409', async () => {
    repository.save.mockRejectedValue({
      driverError: { code: 'ER_DUP_ENTRY' },
    });

    await expect(
      service.create({
        username: 'jane',
        email: 'jane@example.com',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('increments the token version when changing a password', async () => {
    repository.save.mockResolvedValue({ ...USER, tokenVersion: 1 });

    await service.updatePassword({ ...USER }, 'new-password');

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 1 }),
    );
  });
});
