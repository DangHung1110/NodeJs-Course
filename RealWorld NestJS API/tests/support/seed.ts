import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../src/database/entities/user.entity';
import { FollowEntity } from '../../src/database/entities/follow.entity';
import { FavoriteEntity } from '../../src/database/entities/favorite.entity';
import { ArticleEntity } from '../../src/database/entities/article.entity';
import { TagEntity } from '../../src/database/entities/tag.entity';
import { ArticleTagEntity } from '../../src/database/entities/article-tag.entity';
import { CommentEntity } from '../../src/database/entities/comment.entity';
import { assertTestDatabase } from './database-safety';

export const FIXTURE_PASSWORD = 'E2e-password-123!';

export async function seedBaseline(ds: DataSource) {
  await assertTestDatabase(ds);
  const users = ds.getRepository(UserEntity);
  const passwordHash = await hash(FIXTURE_PASSWORD, 4);
  const createUser = (username: string) =>
    users.save(
      users.create({
        username,
        email: `${username}@example.test`,
        passwordHash,
        bio: null,
        image: null,
        tokenVersion: 0,
        isActive: true,
        emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );
  const author = await createUser('e2e_author');
  const reader = await createUser('e2e_reader');
  const outsider = await createUser('e2e_outsider');
  const article = await ds.getRepository(ArticleEntity).save({
    slug: 'seeded-article',
    title: 'Seeded article',
    description: 'Fixture',
    body: 'Fixture body',
    authorId: author.id,
  });
  const tag = await ds.getRepository(TagEntity).save({ name: 'nestjs' });
  await ds
    .getRepository(ArticleTagEntity)
    .insert({ articleId: article.id, tagId: tag.id });
  await ds
    .getRepository(FollowEntity)
    .insert({ followerId: reader.id, followingId: author.id });
  await ds
    .getRepository(FavoriteEntity)
    .insert({ userId: reader.id, articleId: article.id });
  const comment = await ds.getRepository(CommentEntity).save({
    articleId: article.id,
    authorId: reader.id,
    body: 'Seeded comment',
  });
  return { author, reader, outsider, article, comment };
}
