import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ArticleQueryService } from '../../src/articles/article-query.service';
import { ArticlesService } from '../../src/articles/articles.service';
import { ArticleTagEntity } from '../../src/database/entities/article-tag.entity';
import { ArticleEntity } from '../../src/database/entities/article.entity';
import { FavoriteEntity } from '../../src/database/entities/favorite.entity';
import { TagEntity } from '../../src/database/entities/tag.entity';

describe('ArticlesService', () => {
  const response = {
    article: {
      slug: 'article-123',
      title: 'Article',
      description: 'Description',
      body: 'Body',
      tagList: [],
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
      favorited: false,
      favoritesCount: 0,
      author: {
        username: 'author',
        bio: null,
        image: null,
        following: false,
      },
    },
  };
  let article: ArticleEntity;
  let articleRepository: Pick<
    Repository<ArticleEntity>,
    'create' | 'save' | 'findOne' | 'findOneBy' | 'remove'
  >;
  let articleTagRepository: Pick<
    Repository<ArticleTagEntity>,
    'delete' | 'insert'
  >;
  let tagRepository: Pick<
    Repository<TagEntity>,
    'createQueryBuilder' | 'findBy'
  >;
  let tagInsertBuilder: {
    insert: jest.Mock;
    into: jest.Mock;
    values: jest.Mock;
    orIgnore: jest.Mock;
    execute: jest.Mock;
  };
  let insertedTagNames: string[];
  let favoriteRepository: Pick<Repository<FavoriteEntity>, 'insert' | 'delete'>;
  let manager: Pick<EntityManager, 'getRepository'>;
  let dataSource: Pick<DataSource, 'transaction' | 'getRepository'>;
  let queryService: Pick<ArticleQueryService, 'findBySlug' | 'list' | 'feed'>;
  let service: ArticlesService;

  beforeEach(() => {
    article = {
      id: 'article-id',
      slug: 'article-123',
      title: 'Article',
      description: 'Description',
      body: 'Body',
      authorId: 'author-id',
      createdAt: new Date('2026-11-18T00:00:00.000Z'),
      updatedAt: new Date('2026-11-18T00:00:00.000Z'),
    } as ArticleEntity;
    articleRepository = {
      create: jest.fn((input: Partial<ArticleEntity>) =>
        Object.assign(article, input),
      ) as unknown as Repository<ArticleEntity>['create'],
      save: jest.fn().mockResolvedValue(article),
      findOne: jest.fn().mockResolvedValue(article),
      findOneBy: jest.fn().mockResolvedValue(article),
      remove: jest.fn().mockResolvedValue(article),
    };
    articleTagRepository = {
      delete: jest.fn().mockResolvedValue({ raw: [], affected: 1 }),
      insert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
    };
    insertedTagNames = [];
    tagInsertBuilder = {
      insert: jest.fn().mockReturnThis(),
      into: jest.fn().mockReturnThis(),
      values: jest.fn((values: Array<{ id: string; name: string }>) => {
        insertedTagNames = values.map(({ name }) => name);
        return tagInsertBuilder;
      }),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [] }),
    };
    tagRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(tagInsertBuilder),
      findBy: jest.fn().mockResolvedValue([
        { id: 'tag-id-1', name: 'nestjs' },
        { id: 'tag-id-2', name: 'typescript' },
      ]),
    };
    favoriteRepository = {
      insert: jest
        .fn()
        .mockResolvedValue({ identifiers: [], generatedMaps: [], raw: [] }),
      delete: jest.fn().mockResolvedValue({ raw: [], affected: 1 }),
    };
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ArticleEntity) return articleRepository;
        if (entity === ArticleTagEntity) return articleTagRepository;
        if (entity === TagEntity) return tagRepository;
        throw new Error('Unexpected repository.');
      }) as unknown as EntityManager['getRepository'],
    };
    dataSource = {
      transaction: jest.fn(
        (
          isolationOrRun: string | ((value: EntityManager) => unknown),
          maybeRun?: (value: EntityManager) => unknown,
        ) => {
          const run =
            typeof isolationOrRun === 'function' ? isolationOrRun : maybeRun;
          if (!run) throw new Error('Transaction callback is required.');
          return run(manager as EntityManager);
        },
      ) as DataSource['transaction'],
      getRepository: jest.fn((entity: unknown) => {
        if (entity === ArticleEntity) return articleRepository;
        if (entity === FavoriteEntity) return favoriteRepository;
        throw new Error('Unexpected repository.');
      }) as unknown as DataSource['getRepository'],
    };
    queryService = {
      findBySlug: jest.fn().mockResolvedValue(response),
      list: jest.fn(),
      feed: jest.fn(),
    };
    service = new ArticlesService(
      dataSource as DataSource,
      queryService as ArticleQueryService,
    );
  });

  it('creates an article and persists normalized tags atomically', async () => {
    await expect(
      service.create('author-id', {
        title: 'Article',
        description: 'Description',
        body: 'Body',
        tagList: ['nestjs', 'typescript'],
      }),
    ).resolves.toEqual(response);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(articleRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'author-id', title: 'Article' }),
    );
    expect(articleTagRepository.delete).toHaveBeenCalledWith({
      articleId: 'article-id',
    });
    expect(articleTagRepository.insert).toHaveBeenCalledWith([
      { articleId: 'article-id', tagId: 'tag-id-1' },
      { articleId: 'article-id', tagId: 'tag-id-2' },
    ]);
  });

  it('retries a generated slug after a duplicate-key collision', async () => {
    jest
      .mocked(articleRepository.save)
      .mockRejectedValueOnce({ driverError: { code: 'ER_DUP_ENTRY' } })
      .mockResolvedValue(article);

    await expect(
      service.create('author-id', {
        title: 'Article',
        description: 'Description',
        body: 'Body',
      }),
    ).resolves.toEqual(response);

    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
  });

  it('queries missing tags in sorted order and retries a deadlock', async () => {
    jest
      .mocked(tagRepository.findBy)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'tag-id-1', name: 'nestjs' },
        { id: 'tag-id-2', name: 'typescript' },
      ]);
    tagInsertBuilder.execute
      .mockRejectedValueOnce({ driverError: { code: 'ER_LOCK_DEADLOCK' } })
      .mockResolvedValueOnce({ identifiers: [] });

    await expect(
      service.create('author-id', {
        title: 'Article',
        description: 'Description',
        body: 'Body',
        tagList: ['typescript', 'nestjs'],
      }),
    ).resolves.toEqual(response);

    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    expect(insertedTagNames).toEqual(['nestjs', 'typescript']);
  });

  it('rejects a non-author update without changing relations', async () => {
    await expect(
      service.update('article-123', 'other-user', { title: 'Changed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(articleRepository.save).not.toHaveBeenCalled();
    expect(articleTagRepository.delete).not.toHaveBeenCalled();
  });

  it('preserves tags when tagList is omitted and clears them when empty', async () => {
    await service.update('article-123', 'author-id', { body: 'Changed body' });
    expect(articleTagRepository.delete).not.toHaveBeenCalled();

    await service.update('article-123', 'author-id', { tagList: [] });
    expect(articleTagRepository.delete).toHaveBeenCalledWith({
      articleId: 'article-id',
    });
    expect(articleTagRepository.insert).not.toHaveBeenCalled();
  });

  it('enforces ownership and not-found behavior on delete', async () => {
    await expect(
      service.delete('article-123', 'other-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    jest.mocked(articleRepository.findOne).mockResolvedValueOnce(null);
    await expect(service.delete('missing', 'author-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('treats duplicate favorite and repeated unfavorite as idempotent', async () => {
    jest
      .mocked(favoriteRepository.insert)
      .mockRejectedValueOnce({ driverError: { code: 'ER_DUP_ENTRY' } });

    await expect(service.favorite('article-123', 'viewer-id')).resolves.toEqual(
      response,
    );
    jest
      .mocked(favoriteRepository.delete)
      .mockResolvedValueOnce({ raw: [], affected: 0 });
    await expect(
      service.unfavorite('article-123', 'viewer-id'),
    ).resolves.toEqual(response);
  });

  it('keeps concurrent favorite requests idempotent through the unique key', async () => {
    jest
      .mocked(favoriteRepository.insert)
      .mockResolvedValueOnce({ identifiers: [], generatedMaps: [], raw: [] })
      .mockRejectedValueOnce({ driverError: { code: 'ER_DUP_ENTRY' } });

    await expect(
      Promise.all([
        service.favorite('article-123', 'viewer-id'),
        service.favorite('article-123', 'viewer-id'),
      ]),
    ).resolves.toEqual([response, response]);
    expect(favoriteRepository.insert).toHaveBeenCalledTimes(2);
  });

  it('does not hide unexpected favorite errors', async () => {
    jest
      .mocked(favoriteRepository.insert)
      .mockRejectedValueOnce(new Error('database unavailable'));

    await expect(
      service.favorite('article-123', 'viewer-id'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('returns not found when an article is deleted during favorite', async () => {
    jest.mocked(favoriteRepository.insert).mockRejectedValueOnce({
      driverError: { code: 'ER_NO_REFERENCED_ROW_2' },
    });

    await expect(
      service.favorite('article-123', 'viewer-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
