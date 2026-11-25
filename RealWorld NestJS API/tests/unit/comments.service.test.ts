import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CommentsService } from '../../src/comments/comments.service';
import { CommentEntity } from '../../src/database/entities/comment.entity';
import { ArticleEntity } from '../../src/database/entities/article.entity';
import { UserEntity } from '../../src/database/entities/user.entity';

describe('CommentsService', () => {
  const comment: CommentEntity = {
    id: 'comment-id',
    body: 'A comment',
    articleId: 'article-id',
    authorId: 'author-id',
    createdAt: new Date('2026-11-20T00:00:00.000Z'),
    updatedAt: new Date('2026-11-20T00:00:00.000Z'),
    article: { id: 'article-id' } as ArticleEntity,
    author: {
      id: 'author-id',
      username: 'author',
      bio: null,
      image: null,
      email: 'private@example.com',
      passwordHash: 'private-hash',
    } as UserEntity,
  };
  let articles: Pick<Repository<ArticleEntity>, 'findOne'>;
  let comments: Pick<
    Repository<CommentEntity>,
    | 'create'
    | 'save'
    | 'findOneOrFail'
    | 'findOneBy'
    | 'delete'
    | 'createQueryBuilder'
  >;
  let builder: Record<string, jest.Mock>;
  let service: CommentsService;

  beforeEach(() => {
    builder = {};
    for (const method of [
      'innerJoinAndSelect',
      'addSelect',
      'where',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'setParameter',
      'subQuery',
      'select',
      'from',
    ]) {
      builder[method] = jest.fn().mockReturnValue(builder);
    }
    builder.getQuery = jest.fn().mockReturnValue('(SELECT 1)');
    builder.getRawAndEntities = jest
      .fn()
      .mockResolvedValue({ entities: [comment], raw: [{ following: '1' }] });
    articles = { findOne: jest.fn().mockResolvedValue({ id: 'article-id' }) };
    comments = {
      create: jest.fn().mockReturnValue(comment),
      save: jest.fn().mockResolvedValue(comment),
      findOneOrFail: jest.fn().mockResolvedValue(comment),
      findOneBy: jest.fn().mockResolvedValue(comment),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn().mockReturnValue(builder),
    };
    service = new CommentsService(
      comments as Repository<CommentEntity>,
      articles as Repository<ArticleEntity>,
    );
  });

  it('assigns the authenticated author and serializes only public fields', async () => {
    const result = await service.create('article-slug', 'author-id', {
      body: 'A comment',
    });
    expect(comments.create).toHaveBeenCalledWith({
      body: 'A comment',
      articleId: 'article-id',
      authorId: 'author-id',
    });
    expect(result.comment).toEqual({
      id: 'comment-id',
      body: 'A comment',
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      author: { username: 'author', bio: null, image: null, following: false },
    });
    expect(comments.findOneOrFail).toHaveBeenCalledWith({
      where: { id: comment.id },
      relations: { author: true },
    });
    expect(comments.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('does not insert when the article is missing', async () => {
    jest.mocked(articles.findOne).mockResolvedValue(null);
    await expect(
      service.create('missing', 'author-id', { body: 'Comment' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(comments.save).not.toHaveBeenCalled();
  });

  it('returns 404 when the article is deleted during insertion', async () => {
    jest
      .mocked(comments.save)
      .mockRejectedValue({ driverError: { code: 'ER_NO_REFERENCED_ROW_2' } });
    await expect(
      service.create('article-slug', 'author-id', { body: 'Comment' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('preserves unexpected database failures', async () => {
    const failure = new Error('Database unavailable');
    jest.mocked(comments.save).mockRejectedValue(failure);
    await expect(
      service.create('article-slug', 'author-id', { body: 'Comment' }),
    ).rejects.toMatchObject({ cause: failure });
  });

  it('scopes the list to the article with stable newest-first ordering', async () => {
    const result = await service.list('article-slug', 'viewer-id');
    expect(result.comments[0]?.author.following).toBe(true);
    expect(builder.where).toHaveBeenCalledWith(
      'comment.articleId = :articleId',
      { articleId: 'article-id' },
    );
    expect(builder.orderBy).toHaveBeenCalledWith('comment.createdAt', 'DESC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('comment.id', 'DESC');
    expect(comments.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('sets anonymous following to false in the query', async () => {
    builder.getRawAndEntities!.mockResolvedValue({
      entities: [comment],
      raw: [{ following: 0 }],
    });
    const result = await service.list('article-slug');
    expect(result.comments[0]?.author.following).toBe(false);
    expect(builder.addSelect).toHaveBeenCalledWith('0', 'following');
    expect(builder.setParameter).not.toHaveBeenCalled();
  });

  it('returns an empty list for an article without comments', async () => {
    builder.getRawAndEntities!.mockResolvedValue({ entities: [], raw: [] });
    await expect(service.list('article-slug')).resolves.toEqual({
      comments: [],
    });
  });

  it('returns 404 instead of an empty list for a missing article', async () => {
    jest.mocked(articles.findOne).mockResolvedValue(null);
    await expect(service.list('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(comments.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('deletes only a scoped, owned comment', async () => {
    await service.delete('article-slug', 'comment-id', 'author-id');
    expect(comments.findOneBy).toHaveBeenCalledWith({
      id: 'comment-id',
      articleId: 'article-id',
    });
    expect(comments.delete).toHaveBeenCalledWith({
      id: 'comment-id',
      articleId: 'article-id',
      authorId: 'author-id',
    });
  });

  it('denies another user, including the article owner', async () => {
    await expect(
      service.delete('article-slug', 'comment-id', 'article-owner'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(comments.delete).not.toHaveBeenCalled();
  });

  it('rejects missing or cross-article comment IDs', async () => {
    jest.mocked(comments.findOneBy).mockResolvedValue(null);
    await expect(
      service.delete('another-article', 'comment-id', 'author-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(comments.delete).not.toHaveBeenCalled();
  });

  it('rejects deletion through a missing article', async () => {
    jest.mocked(articles.findOne).mockResolvedValue(null);
    await expect(
      service.delete('missing', 'comment-id', 'author-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(comments.findOneBy).not.toHaveBeenCalled();
  });

  it('returns 404 when another request has already deleted the comment', async () => {
    jest.mocked(comments.delete).mockResolvedValue({ affected: 0, raw: [] });
    await expect(
      service.delete('article-slug', 'comment-id', 'author-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
