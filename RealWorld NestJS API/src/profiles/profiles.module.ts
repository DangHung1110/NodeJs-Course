import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowEntity } from '../database/entities/follow.entity';
import { UserEntity } from '../database/entities/user.entity';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, FollowEntity])],
  controllers: [ProfilesController],
  providers: [ProfilesService, OptionalJwtAuthGuard],
})
export class ProfilesModule {}
