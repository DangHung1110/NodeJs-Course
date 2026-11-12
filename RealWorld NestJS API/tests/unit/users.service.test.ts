import { UnprocessableEntityException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserEntity } from '../../src/database/entities/user.entity';
import { UsersService } from '../../src/users/users.service';

describe('UsersService update', () => {
  const user = {
    id: 'user-id',
    username: 'before',
    email: 'before@example.com',
    bio: null,
    tokenVersion: 0,
  } as UserEntity;
  let repository: Pick<Repository<UserEntity>, 'findOne' | 'save'>;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue({ ...user }),
      save: jest
        .fn()
        .mockImplementation((value: UserEntity) => Promise.resolve(value)),
    };
    service = new UsersService(repository as Repository<UserEntity>);
  });

  it('updates only provided profile fields', async () => {
    const result = await service.update('user-id', { bio: 'new bio' });
    expect(result).toMatchObject({
      hasPasswordChanged: false,
      user: { bio: 'new bio' },
    });
    expect(result.user.username).toBe('before');
  });

  it('maps duplicate username or email to validation error', async () => {
    jest.mocked(repository.save).mockRejectedValue({
      driverError: { code: 'ER_DUP_ENTRY' },
    });
    await expect(
      service.update('user-id', { email: 'taken@example.com' }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
