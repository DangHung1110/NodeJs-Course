import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';
import { DataSource } from 'typeorm';
import {
  AttachmentOwnerType,
  AttachmentEntity,
} from '../database/entities/attachment.entity';
import { UserEntity } from '../database/entities/user.entity';
import {
  AVATAR_SUBDIRECTORY,
  AVATAR_PUBLIC_PREFIX,
  AvatarMimeType,
} from './avatar.constants';

interface AvatarFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
}

interface DetectedImage {
  readonly mimeType: AvatarMimeType;
  readonly extension: 'jpg' | 'png' | 'webp';
}

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly avatarRoot: string;

  constructor(
    private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    this.avatarRoot = resolve(
      process.cwd(),
      configService.get<string>('UPLOAD_DIRECTORY', 'uploads'),
      AVATAR_SUBDIRECTORY,
    );
  }

  async upload(userId: string, file?: AvatarFile): Promise<UserEntity> {
    if (!file) {
      throw new UnprocessableEntityException({
        errors: { avatar: ['An avatar file is required.'] },
      });
    }

    const image = this.validateImage(file);
    const storageKey = `${randomUUID()}.${image.extension}`;
    const publicUrl = `${AVATAR_PUBLIC_PREFIX}/${storageKey}`;
    const filePath = this.safeAvatarPath(storageKey);
    let oldStorageKey: string | null = null;

    await mkdir(this.avatarRoot, { recursive: true });
    await writeFile(filePath, file.buffer, { flag: 'wx' });

    try {
      const user = await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(UserEntity);
        const attachments = manager.getRepository(AttachmentEntity);
        const currentUser = await users.findOne({
          where: { id: userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!currentUser) throw new NotFoundException('User not found.');

        const oldAttachment = await attachments.findOne({
          where: {
            ownerType: AttachmentOwnerType.UserAvatar,
            ownerId: userId,
          },
        });
        oldStorageKey = oldAttachment ? basename(oldAttachment.url) : null;

        if (oldAttachment) await attachments.remove(oldAttachment);
        await attachments.save(
          attachments.create({
            ownerType: AttachmentOwnerType.UserAvatar,
            ownerId: userId,
            url: publicUrl,
            fileName: this.safeOriginalName(file.originalname),
            fileType: image.mimeType,
            fileSize: file.size,
          }),
        );

        currentUser.image = publicUrl;
        await users.save(currentUser);
        return currentUser;
      });

      if (oldStorageKey) await this.removeStoredFile(oldStorageKey);
      return user;
    } catch (error) {
      await this.removeStoredFile(storageKey);
      if (
        error instanceof NotFoundException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to store avatar.', {
        cause: error,
      });
    }
  }

  private validateImage(file: AvatarFile): DetectedImage {
    const detected = detectImage(file.buffer);
    if (!detected || detected.mimeType !== file.mimetype) {
      throw new UnprocessableEntityException({
        errors: {
          avatar: ['Avatar must be a valid JPEG, PNG, or WebP image.'],
        },
      });
    }
    return detected;
  }

  private safeOriginalName(name: string): string {
    const sanitized = [...basename(name)]
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code > 31 && code !== 127;
      })
      .join('')
      .trim();
    return (sanitized || 'avatar').slice(0, 255);
  }

  private safeAvatarPath(storageKey: string): string {
    const filePath = resolve(this.avatarRoot, storageKey);
    if (!filePath.startsWith(`${this.avatarRoot}${sep}`)) {
      throw new UnprocessableEntityException('Invalid avatar path.');
    }
    return filePath;
  }

  private async removeStoredFile(storageKey: string): Promise<void> {
    try {
      if (storageKey !== basename(storageKey)) return;
      await unlink(this.safeAvatarPath(storageKey));
    } catch (error) {
      // Missing or already removed files do not invalidate the committed update.
      this.logger.warn(
        'Could not remove an obsolete avatar file.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function detectImage(buffer: Buffer): DetectedImage | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return null;
}
