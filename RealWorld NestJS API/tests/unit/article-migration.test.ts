import { QueryRunner } from 'typeorm';
import { AddArticlesTagsAndFavorites1731400000000 } from '../../src/database/migrations/1731400000000-AddArticlesTagsAndFavorites';

describe('AddArticlesTagsAndFavorites migration', () => {
  it('creates articles, tags, joins and favorites with required constraints', async () => {
    const queries: string[] = [];
    const runner = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
        return Promise.resolve();
      }),
    } as unknown as QueryRunner;

    await new AddArticlesTagsAndFavorites1731400000000().up(runner);

    expect(queries).toHaveLength(4);
    expect(queries[0]).toEqual(expect.stringContaining('UQ_articles_slug'));
    expect(queries[0]).toEqual(expect.stringContaining('FK_articles_author'));
    expect(queries[1]).toEqual(expect.stringContaining('UQ_tags_name'));
    expect(queries[2]).toEqual(
      expect.stringContaining('PRIMARY KEY (article_id, tag_id)'),
    );
    expect(queries[3]).toEqual(
      expect.stringContaining('UQ_favorites_user_article'),
    );
    expect(queries[2]).toEqual(expect.stringContaining('ON DELETE CASCADE'));
    expect(queries[3]).toEqual(expect.stringContaining('ON DELETE CASCADE'));
  });

  it('drops dependent tables before their parents', async () => {
    const queries: string[] = [];
    const runner = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
        return Promise.resolve();
      }),
    } as unknown as QueryRunner;

    await new AddArticlesTagsAndFavorites1731400000000().down(runner);

    expect(queries).toEqual([
      'DROP TABLE favorites',
      'DROP TABLE article_tags',
      'DROP TABLE tags',
      'DROP TABLE articles',
    ]);
  });
});
