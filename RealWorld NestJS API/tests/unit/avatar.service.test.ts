import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AttachmentEntity } from '../../src/database/entities/attachment.entity';
import { UserEntity } from '../../src/database/entities/user.entity';
import { AvatarService } from '../../src/users/avatar.service';

describe('AvatarService', () => {
  let uploadRoot: string;
  let attachments: Pick<
    Repository<AttachmentEntity>,
    'findOne' | 'create' | 'save' | 'remove'
  >;
  let users: Pick<Repository<UserEntity>, 'findOne' | 'save'>;
  let service: AvatarService;

  beforeEach(() => {
    uploadRoot = join(tmpdir(), `realworld-avatar-${randomUUID()}`);
    attachments = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value: AttachmentEntity) => value),
      save: jest
        .fn()
        .mockImplementation((value: AttachmentEntity) =>
          Promise.resolve(value),
        ),
      remove: jest
        .fn()
        .mockImplementation((value: AttachmentEntity) =>
          Promise.resolve(value),
        ),
    };
    users = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-id', image: null }),
      save: jest
        .fn()
        .mockImplementation((value: UserEntity) => Promise.resolve(value)),
    };

    const manager = {
      getRepository: jest.fn(
        (entity: typeof UserEntity | typeof AttachmentEntity) =>
          entity === UserEntity ? users : attachments,
      ),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: jest.fn(
        (work: (value: EntityManager) => Promise<UserEntity>) => work(manager),
      ),
    } as unknown as DataSource;
    const config = {
      get: jest.fn().mockReturnValue(uploadRoot),
    } as unknown as ConfigService;
    service = new AvatarService(dataSource, config);
  });

  afterEach(async () => {
    await rm(uploadRoot, { recursive: true, force: true });
  });

  it('rejects a spoofed image mime type before writing metadata', async () => {
    await expect(
      service.upload('user-id', {
        buffer: Buffer.from('not an image'),
        mimetype: 'image/png',
        originalname: 'avatar.png',
        size: 12,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(attachments.save).not.toHaveBeenCalled();
  });

  it('stores a validated PNG with a generated public URL', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = await service.upload('user-id', {
      buffer: png,
      mimetype: 'image/png',
      originalname: '../unsafe.png',
      size: png.length,
    });

    expect(result.image).toMatch(/^\/uploads\/avatars\/[0-9a-f-]+\.png$/);
    const storageKey = result.image?.split('/').at(-1);
    expect(storageKey).toBeDefined();
    await expect(
      access(join(uploadRoot, 'avatars', storageKey!)),
    ).resolves.toBeUndefined();
    expect(attachments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'unsafe.png',
        fileType: 'image/png',
      }),
    );
  });
});
