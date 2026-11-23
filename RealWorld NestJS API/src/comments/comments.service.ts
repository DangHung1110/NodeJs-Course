import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ArticleEntity } from '../database/entities/article.entity';
import { CommentEntity } from '../database/entities/comment.entity';
import { FollowEntity } from '../database/entities/follow.entity';
import { isMissingForeignKeyError } from '../database/mysql-error.util';
import { CreateCommentDto } from './comment.dto';
import {
  CommentEnvelopeResponse,
  CommentsEnvelopeResponse,
  toComment,
} from './comment-response';

interface CommentMetricsRaw {
  readonly following: number | string | boolean;
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly commentsRepository: Repository<CommentEntity>,
    @InjectRepository(ArticleEntity)
    private readonly articlesRepository: Repository<ArticleEntity>,
  ) {}

  async create(
    slug: string,
    authorId: string,
    input: CreateCommentDto,
  ): Promise<CommentEnvelopeResponse> {
    const article = await this.findArticle(slug);
    const comment = this.commentsRepository.create({
      body: input.body,
      articleId: article.id,
      authorId,
    });
    try {
      await this.commentsRepository.save(comment);
    } catch (error) {
      if (isMissingForeignKeyError(error))
        throw new NotFoundException('Article or author not found.');
      throw new InternalServerErrorException('Unable to create comment.', {
        cause: error,
      });
    }
    const saved = await this.commentsRepository.findOneOrFail({
      where: { id: comment.id },
      relations: { author: true },
    });
    return { comment: toComment(saved, false) };
  }

  async list(
    slug: string,
    viewerId?: string,
  ): Promise<CommentsEnvelopeResponse> {
    const article = await this.findArticle(slug);
    const { entities, raw } = await this.commentQuery(viewerId)
      .where('comment.articleId = :articleId', { articleId: article.id })
      .orderBy('comment.createdAt', 'DESC')
      .addOrderBy('comment.id', 'DESC')
      .getRawAndEntities<CommentMetricsRaw>();
    return {
      comments: entities.map((comment, index) =>
        toComment(comment, Number(raw[index]?.following) === 1),
      ),
    };
  }

  async delete(slug: string, id: string, authorId: string): Promise<void> {
    const article = await this.findArticle(slug);
    const comment = await this.commentsRepository.findOneBy({
      id,
      articleId: article.id,
    });
    if (!comment) throw new NotFoundException('Comment not found.');
    if (comment.authorId !== authorId)
      throw new ForbiddenException('Only the comment author may delete it.');
    const result = await this.commentsRepository.delete({
      id,
      articleId: article.id,
      authorId,
    });
    if (!result.affected) throw new NotFoundException('Comment not found.');
  }

  private async findArticle(slug: string): Promise<ArticleEntity> {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      select: { id: true },
    });
    if (!article) throw new NotFoundException('Article not found.');
    return article;
  }

  private commentQuery(viewerId?: string): SelectQueryBuilder<CommentEntity> {
    const query = this.commentsRepository
      .createQueryBuilder('comment')
      .innerJoinAndSelect('comment.author', 'author');
    if (!viewerId) return query.addSelect('0', 'following');
    const followedAuthor = query
      .subQuery()
      .select('1')
      .from(FollowEntity, 'viewer_follow')
      .where('viewer_follow.followerId = :viewerId')
      .andWhere('viewer_follow.followingId = comment.authorId')
      .getQuery();
    return query
      .addSelect(
        `CASE WHEN EXISTS ${followedAuthor} THEN 1 ELSE 0 END`,
        'following',
      )
      .setParameter('viewerId', viewerId);
  }
}
