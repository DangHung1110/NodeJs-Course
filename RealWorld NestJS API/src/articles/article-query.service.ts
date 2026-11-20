import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ArticleEntity } from '../database/entities/article.entity';
import { ArticleTagEntity } from '../database/entities/article-tag.entity';
import { FavoriteEntity } from '../database/entities/favorite.entity';
import { FollowEntity } from '../database/entities/follow.entity';
import { TagEntity } from '../database/entities/tag.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ListArticlesQueryDto } from './article.dto';
import {
  ArticleEnvelopeResponse,
  ArticleResponse,
  ArticlesEnvelopeResponse,
} from './article-response';

interface ArticleMetricsRaw {
  readonly favoritesCount?: string | number;
  readonly favorited?: string | number | boolean;
  readonly following?: string | number | boolean;
}

interface ArticleTagRaw {
  readonly articleId: string;
  readonly tagName: string;
}

@Injectable()
export class ArticleQueryService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articlesRepository: Repository<ArticleEntity>,
    @InjectRepository(TagEntity)
    private readonly tagsRepository: Repository<TagEntity>,
  ) {}

  async findBySlug(
    slug: string,
    viewerId?: string,
  ): Promise<ArticleEnvelopeResponse> {
    const query = this.createArticleQuery(viewerId).where(
      'article.slug = :slug',
      { slug },
    );
    const { entities, raw } =
      await query.getRawAndEntities<ArticleMetricsRaw>();
    const article = entities[0];
    if (!article) throw new NotFoundException('Article not found.');
    const tags = await this.loadTags([article.id]);
    return {
      article: this.serializeArticle(
        article,
        raw[0],
        tags.get(article.id) ?? [],
      ),
    };
  }

  async list(
    filters: ListArticlesQueryDto,
    viewerId?: string,
  ): Promise<ArticlesEnvelopeResponse> {
    const query = this.applyFilters(this.createArticleQuery(viewerId), filters);
    return this.executeList(query, filters);
  }

  async feed(
    filters: Pick<ListArticlesQueryDto, 'limit' | 'offset'>,
    viewerId: string,
  ): Promise<ArticlesEnvelopeResponse> {
    const query = this.createArticleQuery(viewerId).andWhere(
      (builder) => {
        const followedAuthors = builder
          .subQuery()
          .select('1')
          .from(FollowEntity, 'feed_follow')
          .where('feed_follow.followerId = :viewerId')
          .andWhere('feed_follow.followingId = article.authorId')
          .getQuery();
        return `EXISTS ${followedAuthors}`;
      },
      { viewerId },
    );
    return this.executeList(query, filters);
  }

  private createArticleQuery(
    viewerId?: string,
  ): SelectQueryBuilder<ArticleEntity> {
    const query = this.articlesRepository
      .createQueryBuilder('article')
      .innerJoinAndSelect('article.author', 'author')
      .addSelect(
        (builder) =>
          builder
            .select('COUNT(*)')
            .from(FavoriteEntity, 'favorite_count')
            .where('favorite_count.articleId = article.id'),
        'favoritesCount',
      );

    if (!viewerId) {
      return query.addSelect('0', 'favorited').addSelect('0', 'following');
    }

    const viewerFavorite = query
      .subQuery()
      .select('1')
      .from(FavoriteEntity, 'viewer_favorite')
      .where('viewer_favorite.articleId = article.id')
      .andWhere('viewer_favorite.userId = :viewerId')
      .getQuery();
    const viewerFollow = query
      .subQuery()
      .select('1')
      .from(FollowEntity, 'viewer_follow')
      .where('viewer_follow.followingId = article.authorId')
      .andWhere('viewer_follow.followerId = :viewerId')
      .getQuery();

    return query
      .addSelect(
        `CASE WHEN EXISTS ${viewerFavorite} THEN 1 ELSE 0 END`,
        'favorited',
      )
      .addSelect(
        `CASE WHEN EXISTS ${viewerFollow} THEN 1 ELSE 0 END`,
        'following',
      )
      .setParameter('viewerId', viewerId);
  }

  private applyFilters(
    query: SelectQueryBuilder<ArticleEntity>,
    filters: ListArticlesQueryDto,
  ): SelectQueryBuilder<ArticleEntity> {
    if (filters.author) {
      query.andWhere('author.username = :author', { author: filters.author });
    }
    if (filters.search) {
      query.andWhere(
        '(LOWER(article.title) LIKE :search OR LOWER(article.description) LIKE :search)',
        { search: `%${filters.search.toLowerCase()}%` },
      );
    }
    if (filters.tag) {
      query.andWhere((builder) => {
        const taggedArticle = builder
          .subQuery()
          .select('1')
          .from(ArticleTagEntity, 'filter_article_tag')
          .innerJoin(
            TagEntity,
            'filter_tag',
            'filter_tag.id = filter_article_tag.tagId',
          )
          .where('filter_article_tag.articleId = article.id')
          .andWhere('filter_tag.name = :tag')
          .getQuery();
        return `EXISTS ${taggedArticle}`;
      });
      query.setParameter('tag', filters.tag.toLowerCase());
    }
    if (filters.favorited) {
      query.andWhere((builder) => {
        const favoritedArticle = builder
          .subQuery()
          .select('1')
          .from(FavoriteEntity, 'filter_favorite')
          .innerJoin(
            UserEntity,
            'favorite_user',
            'favorite_user.id = filter_favorite.userId',
          )
          .where('filter_favorite.articleId = article.id')
          .andWhere('favorite_user.username = :favorited')
          .getQuery();
        return `EXISTS ${favoritedArticle}`;
      });
      query.setParameter('favorited', filters.favorited);
    }
    return query;
  }

  private async executeList(
    query: SelectQueryBuilder<ArticleEntity>,
    pagination: Pick<ListArticlesQueryDto, 'limit' | 'offset'>,
  ): Promise<ArticlesEnvelopeResponse> {
    const articlesCount = await query.clone().getCount();
    const { entities, raw } = await query
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'DESC')
      .skip(pagination.offset)
      .take(pagination.limit)
      .getRawAndEntities<ArticleMetricsRaw>();
    const tags = await this.loadTags(entities.map((article) => article.id));
    return {
      articles: entities.map((article, index) =>
        this.serializeArticle(article, raw[index], tags.get(article.id) ?? []),
      ),
      articlesCount,
    };
  }

  private async loadTags(articleIds: string[]): Promise<Map<string, string[]>> {
    const tagsByArticle = new Map<string, string[]>();
    if (articleIds.length === 0) return tagsByArticle;

    const rows = await this.tagsRepository
      .createQueryBuilder('tag')
      .innerJoin(ArticleTagEntity, 'article_tag', 'article_tag.tagId = tag.id')
      .select('article_tag.articleId', 'articleId')
      .addSelect('tag.name', 'tagName')
      .where('article_tag.articleId IN (:...articleIds)', { articleIds })
      .orderBy('tag.name', 'ASC')
      .getRawMany<ArticleTagRaw>();

    for (const row of rows) {
      const articleTags = tagsByArticle.get(row.articleId) ?? [];
      articleTags.push(row.tagName);
      tagsByArticle.set(row.articleId, articleTags);
    }
    return tagsByArticle;
  }

  private serializeArticle(
    article: ArticleEntity,
    metrics: ArticleMetricsRaw | undefined,
    tagList: string[],
  ): ArticleResponse {
    return {
      slug: article.slug,
      title: article.title,
      description: article.description,
      body: article.body,
      tagList,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
      favorited: Boolean(Number(metrics?.favorited ?? 0)),
      favoritesCount: Number(metrics?.favoritesCount ?? 0),
      author: {
        username: article.author.username,
        bio: article.author.bio,
        image: article.author.image,
        following: Boolean(Number(metrics?.following ?? 0)),
      },
    };
  }
}
