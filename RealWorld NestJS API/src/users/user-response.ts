import { UserEntity } from '../database/entities/user.entity';

export interface AuthenticatedUser {
  readonly username: string;
  readonly email: string;
  readonly bio: string | null;
  readonly image: string | null;
}

export interface UserResponse extends AuthenticatedUser {
  readonly token: string;
}

export function toAuthenticatedUser(
  user: Pick<UserEntity, 'username' | 'email' | 'bio' | 'image'>,
): AuthenticatedUser {
  return {
    username: user.username,
    email: user.email,
    bio: user.bio,
    image: user.image,
  };
}
