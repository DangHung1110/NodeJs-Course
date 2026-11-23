import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleEntity } from '../database/entities/article.entity';
import { CommentEntity } from '../database/entities/comment.entity';
import { OptionalJwtAuthGuard } from '../profiles/optional-jwt-auth.guard';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommentEntity, ArticleEntity])],
  controllers: [CommentsController],
  providers: [CommentsService, OptionalJwtAuthGuard],
})
export class CommentsModule {}
