import { CommentEntity } from '../database/entities/comment.entity';
import { ProfileResponse, toProfile } from '../profiles/profile-response';

export interface CommentResponse {
  readonly id: string;
  readonly body: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: ProfileResponse;
}

export interface CommentEnvelopeResponse {
  readonly comment: CommentResponse;
}

export interface CommentsEnvelopeResponse {
  readonly comments: CommentResponse[];
}

export function toComment(
  comment: CommentEntity,
  following: boolean,
): CommentResponse {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: toProfile(comment.author, following),
  };
}
