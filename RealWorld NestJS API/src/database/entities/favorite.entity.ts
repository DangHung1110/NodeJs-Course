import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'favorites' })
@Index('UQ_favorites_user_article', ['userId', 'articleId'], { unique: true })
@Index('IDX_favorites_article', ['articleId'])
export class FavoriteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'char', length: 36 })
  userId!: string;

  @Column({ name: 'article_id', type: 'char', length: 36 })
  articleId!: string;

  @CreateDateColumn({ name: 'created_at', precision: 6 })
  createdAt!: Date;
}
