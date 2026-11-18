import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowEntity } from '../database/entities/follow.entity';
import { isDuplicateKeyError } from '../database/mysql-error.util';
import { UserEntity } from '../database/entities/user.entity';
import { ProfileEnvelopeResponse, toProfile } from './profile-response';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(FollowEntity)
    private readonly followsRepository: Repository<FollowEntity>,
  ) {}

  async getProfile(
    username: string,
    viewerId?: string,
  ): Promise<ProfileEnvelopeResponse> {
    const user = await this.findUser(username);
    const following = viewerId
      ? await this.followsRepository.existsBy({
          followerId: viewerId,
          followingId: user.id,
        })
      : false;
    return { profile: toProfile(user, following) };
  }

  async follow(
    username: string,
    followerId: string,
  ): Promise<ProfileEnvelopeResponse> {
    const user = await this.findUser(username);
    if (user.id === followerId) {
      throw new UnprocessableEntityException({
        errors: { follow: ['You cannot follow yourself.'] },
      });
    }

    try {
      await this.followsRepository.insert({
        followerId,
        followingId: user.id,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw new InternalServerErrorException('Unable to follow user.', {
          cause: error,
        });
      }
    }

    return { profile: toProfile(user, true) };
  }

  async unfollow(
    username: string,
    followerId: string,
  ): Promise<ProfileEnvelopeResponse> {
    const user = await this.findUser(username);
    await this.followsRepository.delete({
      followerId,
      followingId: user.id,
    });
    return { profile: toProfile(user, false) };
  }

  private async findUser(username: string): Promise<UserEntity> {
    const user = await this.usersRepository.findOne({
      where: { username, isActive: true },
    });
    if (!user) throw new NotFoundException('Profile not found.');
    return user;
  }
}
