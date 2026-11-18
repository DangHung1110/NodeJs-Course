import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'follows' })
@Index('UQ_follows_follower_following', ['followerId', 'followingId'], {
  unique: true,
})
export class FollowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'follower_id', type: 'char', length: 36 })
  followerId!: string;

  @Column({ name: 'following_id', type: 'char', length: 36 })
  followingId!: string;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt!: Date;
}
