import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { ArticleEntity } from '../database/entities/article.entity';
import { ArticleTagEntity } from '../database/entities/article-tag.entity';
import { FavoriteEntity } from '../database/entities/favorite.entity';
import { TagEntity } from '../database/entities/tag.entity';
import { isDuplicateKeyError } from '../database/mysql-error.util';
import { ArticleQueryService } from './article-query.service';
import { SLUG_CREATE_ATTEMPTS } from './article.constants';
import {
  CreateArticleDto,
  ListArticlesQueryDto,
  UpdateArticleDto,
} from './article.dto';
import {
  ArticleEnvelopeResponse,
  ArticlesEnvelopeResponse,
} from './article-response';
import { createArticleSlug } from './slug.util';

class SlugCollisionError extends Error {
  constructor() {
    super('Generated article slug already exists.');
    this.name = 'SlugCollisionError';
  }
}

@Injectable()
export class ArticlesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly articleQueryService: ArticleQueryService,
  ) {}

  async create(
    authorId: string,
    input: CreateArticleDto,
  ): Promise<ArticleEnvelopeResponse> {
    for (let attempt = 0; attempt < SLUG_CREATE_ATTEMPTS; attempt += 1) {
      try {
        const slug = await this.dataSource.transaction(async (manager) => {
          const articles = manager.getRepository(ArticleEntity);
          const article = articles.create({
            slug: createArticleSlug(input.title),
            title: input.title,
            description: input.description,
            body: input.body,
            authorId,
          });
          try {
            await articles.save(article);
          } catch (error) {
            if (isDuplicateKeyError(error)) throw new SlugCollisionError();
            throw error;
          }
          await this.replaceTags(manager, article.id, input.tagList ?? []);
          return article.slug;
        });
        return this.articleQueryService.findBySlug(slug, authorId);
      } catch (error) {
        if (!(error instanceof SlugCollisionError)) throw error;
      }
    }
    throw new InternalServerErrorException(
      'Unable to generate a unique article slug.',
    );
  }

  list(
    filters: ListArticlesQueryDto,
    viewerId?: string,
  ): Promise<ArticlesEnvelopeResponse> {
    return this.articleQueryService.list(filters, viewerId);
  }

  feed(
    filters: Pick<ListArticlesQueryDto, 'limit' | 'offset'>,
    viewerId: string,
  ): Promise<ArticlesEnvelopeResponse> {
    return this.articleQueryService.feed(filters, viewerId);
  }

  getBySlug(slug: string, viewerId?: string): Promise<ArticleEnvelopeResponse> {
    return this.articleQueryService.findBySlug(slug, viewerId);
  }

  async update(
    slug: string,
    authorId: string,
    input: UpdateArticleDto,
  ): Promise<ArticleEnvelopeResponse> {
    for (let attempt = 0; attempt < SLUG_CREATE_ATTEMPTS; attempt += 1) {
      try {
        const updatedSlug = await this.dataSource.transaction(
          async (manager) => {
            const articles = manager.getRepository(ArticleEntity);
            const article = await articles.findOne({
              where: { slug },
              lock: { mode: 'pessimistic_write' },
            });
            if (!article) throw new NotFoundException('Article not found.');
            this.assertAuthor(article, authorId);

            if (input.title !== undefined && input.title !== article.title) {
              article.title = input.title;
              article.slug = createArticleSlug(input.title);
            }
            if (input.description !== undefined) {
              article.description = input.description;
            }
            if (input.body !== undefined) article.body = input.body;

            try {
              await articles.save(article);
            } catch (error) {
              if (isDuplicateKeyError(error)) throw new SlugCollisionError();
              throw error;
            }
            if (input.tagList !== undefined) {
              await this.replaceTags(manager, article.id, input.tagList);
            }
            return article.slug;
          },
        );
        return this.articleQueryService.findBySlug(updatedSlug, authorId);
      } catch (error) {
        if (!(error instanceof SlugCollisionError)) throw error;
      }
    }
    throw new InternalServerErrorException(
      'Unable to generate a unique article slug.',
    );
  }

  async delete(slug: string, authorId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const articles = manager.getRepository(ArticleEntity);
      const article = await articles.findOne({
        where: { slug },
        lock: { mode: 'pessimistic_write' },
      });
      if (!article) throw new NotFoundException('Article not found.');
      this.assertAuthor(article, authorId);
      await articles.remove(article);
    });
  }

  async favorite(
    slug: string,
    userId: string,
  ): Promise<ArticleEnvelopeResponse> {
    const article = await this.findArticle(slug);
    try {
      await this.dataSource.getRepository(FavoriteEntity).insert({
        userId,
        articleId: article.id,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw new InternalServerErrorException('Unable to favorite article.', {
          cause: error,
        });
      }
    }
    return this.articleQueryService.findBySlug(slug, userId);
  }

  async unfavorite(
    slug: string,
    userId: string,
  ): Promise<ArticleEnvelopeResponse> {
    const article = await this.findArticle(slug);
    await this.dataSource.getRepository(FavoriteEntity).delete({
      userId,
      articleId: article.id,
    });
    return this.articleQueryService.findBySlug(slug, userId);
  }

  private async replaceTags(
    manager: EntityManager,
    articleId: string,
    names: string[],
  ): Promise<void> {
    const articleTags = manager.getRepository(ArticleTagEntity);
    await articleTags.delete({ articleId });
    if (names.length === 0) return;

    const tags = manager.getRepository(TagEntity);
    await tags
      .createQueryBuilder()
      .insert()
      .into(TagEntity)
      .values(names.map((name) => ({ id: randomUUID(), name })))
      .orIgnore()
      .execute();
    const savedTags = await tags.findBy({ name: In(names) });
    await articleTags.insert(
      savedTags.map((tag) => ({ articleId, tagId: tag.id })),
    );
  }

  private assertAuthor(article: ArticleEntity, userId: string): void {
    if (article.authorId !== userId) {
      throw new ForbiddenException('Only the article author may modify it.');
    }
  }

  private async findArticle(slug: string): Promise<ArticleEntity> {
    const article = await this.dataSource
      .getRepository(ArticleEntity)
      .findOneBy({ slug });
    if (!article) throw new NotFoundException('Article not found.');
    return article;
  }
}
