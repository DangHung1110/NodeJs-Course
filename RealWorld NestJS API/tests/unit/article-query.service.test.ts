import { Repository } from 'typeorm';
import { ArticleQueryService } from '../../src/articles/article-query.service';
import { ArticleEntity } from '../../src/database/entities/article.entity';
import { TagEntity } from '../../src/database/entities/tag.entity';
import { UserEntity } from '../../src/database/entities/user.entity';

describe('ArticleQueryService', () => {
  const article: ArticleEntity = {
    id: 'article-id',
    slug: 'article-123',
    title: 'Article',
    description: 'Description',
    body: 'Body',
    authorId: 'author-id',
    createdAt: new Date('2026-11-18T01:00:00.000Z'),
    updatedAt: new Date('2026-11-18T02:00:00.000Z'),
    author: {
      id: 'author-id',
      username: 'author',
      bio: null,
      image: null,
    } as UserEntity,
  };
  let articleBuilder: Record<string, jest.Mock>;
  let tagBuilder: Record<string, jest.Mock>;
  let articlesRepository: Pick<Repository<ArticleEntity>, 'createQueryBuilder'>;
  let tagsRepository: Pick<Repository<TagEntity>, 'createQueryBuilder'>;
  let service: ArticleQueryService;

  function chainedBuilder(): Record<string, jest.Mock> {
    const builder: Record<string, jest.Mock> = {};
    for (const method of [
      'select',
      'from',
      'where',
      'andWhere',
      'innerJoin',
      'innerJoinAndSelect',
      'addSelect',
      'setParameter',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ]) {
      builder[method] = jest.fn().mockReturnValue(builder);
    }
    builder.getQuery = jest.fn().mockReturnValue('(SELECT 1)');
    return builder;
  }

  beforeEach(() => {
    const subquery = chainedBuilder();
    articleBuilder = chainedBuilder();
    articleBuilder.subQuery = jest.fn().mockReturnValue(subquery);
    articleBuilder.andWhere.mockImplementation(
      (condition: string | ((builder: unknown) => string)) => {
        if (typeof condition === 'function') condition(articleBuilder);
        return articleBuilder;
      },
    );
    articleBuilder.clone = jest.fn().mockReturnValue({
      getCount: jest.fn().mockResolvedValue(7),
    });
    articleBuilder.getRawAndEntities = jest.fn().mockResolvedValue({
      entities: [article],
      raw: [{ favoritesCount: '2', favorited: '1', following: '1' }],
    });
    tagBuilder = chainedBuilder();
    tagBuilder.getRawMany = jest.fn().mockResolvedValue([
      { articleId: 'article-id', tagName: 'nestjs' },
      { articleId: 'article-id', tagName: 'typescript' },
    ]);
    articlesRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(articleBuilder),
    };
    tagsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(tagBuilder),
    };
    service = new ArticleQueryService(
      articlesRepository as Repository<ArticleEntity>,
      tagsRepository as Repository<TagEntity>,
    );
  });

  it('applies parameterized filters, counts before pagination and batches tags', async () => {
    const result = await service.list(
      {
        tag: 'NestJS',
        author: 'author',
        favorited: 'viewer',
        search: 'QUERY',
        limit: 5,
        offset: 10,
      },
      'viewer-id',
    );

    expect(result.articlesCount).toBe(7);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]).toMatchObject({
      slug: 'article-123',
      tagList: ['nestjs', 'typescript'],
      favorited: true,
      favoritesCount: 2,
      author: { following: true },
    });

    expect(articleBuilder.andWhere).toHaveBeenCalledWith(
      'author.username = :author',
      { author: 'author' },
    );
    expect(articleBuilder.andWhere).toHaveBeenCalledWith(
      '(LOWER(article.title) LIKE :search OR LOWER(article.description) LIKE :search)',
      { search: '%query%' },
    );
    expect(articleBuilder.setParameter).toHaveBeenCalledWith('tag', 'nestjs');
    expect(articleBuilder.setParameter).toHaveBeenCalledWith(
      'favorited',
      'viewer',
    );
    expect(articleBuilder.orderBy).toHaveBeenCalledWith(
      'article.createdAt',
      'DESC',
    );
    expect(articleBuilder.addOrderBy).toHaveBeenCalledWith(
      'article.id',
      'DESC',
    );
    expect(articleBuilder.skip).toHaveBeenCalledWith(10);
    expect(articleBuilder.take).toHaveBeenCalledWith(5);
    expect(tagsRepository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(tagBuilder.where).toHaveBeenCalledWith(
      'article_tag.articleId IN (:...articleIds)',
      { articleIds: ['article-id'] },
    );
  });

  it('builds an authenticated feed from existing follow relationships', async () => {
    await service.feed({ limit: 20, offset: 0 }, 'viewer-id');

    expect(articleBuilder.setParameter).toHaveBeenCalledWith(
      'viewerId',
      'viewer-id',
    );
    expect(articleBuilder.andWhere).toHaveBeenCalledWith(expect.any(Function), {
      viewerId: 'viewer-id',
    });
  });

  it('returns an empty list without querying tags when no articles match', async () => {
    articleBuilder.getRawAndEntities.mockResolvedValueOnce({
      entities: [],
      raw: [],
    });

    await expect(service.list({ limit: 20, offset: 0 })).resolves.toEqual({
      articles: [],
      articlesCount: 7,
    });
    expect(tagsRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('throws for a missing slug', async () => {
    articleBuilder.getRawAndEntities.mockResolvedValueOnce({
      entities: [],
      raw: [],
    });

    await expect(service.findBySlug('missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});
