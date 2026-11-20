import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleEntity } from '../database/entities/article.entity';
import { ArticleTagEntity } from '../database/entities/article-tag.entity';
import { FavoriteEntity } from '../database/entities/favorite.entity';
import { TagEntity } from '../database/entities/tag.entity';
import { OptionalJwtAuthGuard } from '../profiles/optional-jwt-auth.guard';
import { ArticleQueryService } from './article-query.service';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ArticleEntity,
      TagEntity,
      ArticleTagEntity,
      FavoriteEntity,
    ]),
  ],
  controllers: [ArticlesController],
  providers: [ArticlesService, ArticleQueryService, OptionalJwtAuthGuard],
})
export class ArticlesModule {}
