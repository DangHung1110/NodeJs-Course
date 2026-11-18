export const AVATAR_FIELD_NAME = 'avatar';
export const AVATAR_SUBDIRECTORY = 'avatars';
export const AVATAR_PUBLIC_PREFIX = '/uploads/avatars';
export const AVATAR_MAX_FILE_SIZE = 5 * 1024 * 1024;

export const AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AvatarMimeType = (typeof AVATAR_MIME_TYPES)[number];
