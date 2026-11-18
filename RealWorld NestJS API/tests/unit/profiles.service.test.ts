import {
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { FollowEntity } from '../../src/database/entities/follow.entity';
import { UserEntity } from '../../src/database/entities/user.entity';
import { ProfilesService } from '../../src/profiles/profiles.service';

describe('ProfilesService', () => {
  const target = {
    id: 'target-id',
    username: 'target',
    bio: 'hello',
    image: null,
  } as UserEntity;
  let usersRepository: Pick<Repository<UserEntity>, 'findOne'>;
  let followsRepository: Pick<
    Repository<FollowEntity>,
    'existsBy' | 'insert' | 'delete'
  >;
  let service: ProfilesService;

  beforeEach(() => {
    usersRepository = { findOne: jest.fn().mockResolvedValue(target) };
    followsRepository = {
      existsBy: jest.fn().mockResolvedValue(false),
      insert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
      delete: jest.fn().mockResolvedValue({ raw: [], affected: 1 }),
    };
    service = new ProfilesService(
      usersRepository as Repository<UserEntity>,
      followsRepository as Repository<FollowEntity>,
    );
  });

  it('returns following false for an anonymous viewer', async () => {
    await expect(service.getProfile('target')).resolves.toEqual({
      profile: {
        username: 'target',
        bio: 'hello',
        image: null,
        following: false,
      },
    });
    expect(followsRepository.existsBy).not.toHaveBeenCalled();
  });

  it('reads the follow relation for an authenticated viewer', async () => {
    jest.mocked(followsRepository.existsBy).mockResolvedValue(true);
    await expect(
      service.getProfile('target', 'viewer-id'),
    ).resolves.toMatchObject({
      profile: { following: true },
    });
    expect(followsRepository.existsBy).toHaveBeenCalledWith({
      followerId: 'viewer-id',
      followingId: 'target-id',
    });
  });

  it('prevents following yourself', async () => {
    await expect(service.follow('target', 'target-id')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(followsRepository.insert).not.toHaveBeenCalled();
  });

  it('treats a duplicate follow as an idempotent success', async () => {
    jest.mocked(followsRepository.insert).mockRejectedValue({
      driverError: { code: 'ER_DUP_ENTRY' },
    });
    await expect(service.follow('target', 'viewer-id')).resolves.toMatchObject({
      profile: { following: true },
    });
  });

  it('does not hide unexpected follow errors', async () => {
    jest
      .mocked(followsRepository.insert)
      .mockRejectedValue(new Error('db down'));
    await expect(service.follow('target', 'viewer-id')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('treats repeated unfollow as an idempotent success', async () => {
    jest
      .mocked(followsRepository.delete)
      .mockResolvedValue({ raw: [], affected: 0 });
    await expect(
      service.unfollow('target', 'viewer-id'),
    ).resolves.toMatchObject({
      profile: { following: false },
    });
  });
});
