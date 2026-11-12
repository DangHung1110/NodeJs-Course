import { UserEntity } from '../database/entities/user.entity';

export interface ProfileResponse {
  readonly username: string;
  readonly bio: string | null;
  readonly image: string | null;
  readonly following: boolean;
}

export interface ProfileEnvelopeResponse {
  readonly profile: ProfileResponse;
}

export function toProfile(
  user: Pick<UserEntity, 'username' | 'bio' | 'image'>,
  following: boolean,
): ProfileResponse {
  return {
    username: user.username,
    bio: user.bio,
    image: user.image,
    following,
  };
}
