import { CreateUsers1731100000000 } from './migrations/1731100000000-CreateUsers';
import { AddAuthVerificationFields1731200000000 } from './migrations/1731200000000-AddAuthVerificationFields';
import { AddFollowsAndAttachments1731300000000 } from './migrations/1731300000000-AddFollowsAndAttachments';
import { AttachmentEntity } from './entities/attachment.entity';
import { FollowEntity } from './entities/follow.entity';
import { UserEntity } from './entities/user.entity';
import { ArticleEntity } from './entities/article.entity';
import { ArticleTagEntity } from './entities/article-tag.entity';
import { FavoriteEntity } from './entities/favorite.entity';
import { TagEntity } from './entities/tag.entity';
import { CommentEntity } from './entities/comment.entity';
import { AddComments1731500000000 } from './migrations/1731500000000-AddComments';
import { AddArticlesTagsAndFavorites1731400000000 } from './migrations/1731400000000-AddArticlesTagsAndFavorites';

export const DATABASE_ENTITIES = [
  UserEntity,
  FollowEntity,
  AttachmentEntity,
  ArticleEntity,
  TagEntity,
  ArticleTagEntity,
  FavoriteEntity,
  CommentEntity,
];
export const DATABASE_MIGRATIONS = [
  CreateUsers1731100000000,
  AddAuthVerificationFields1731200000000,
  AddFollowsAndAttachments1731300000000,
  AddArticlesTagsAndFavorites1731400000000,
  AddComments1731500000000,
];
