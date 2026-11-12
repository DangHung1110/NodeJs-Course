import { QueryRunner } from 'typeorm';
import { AddFollowsAndAttachments1731300000000 } from '../../src/database/migrations/1731300000000-AddFollowsAndAttachments';

describe('AddFollowsAndAttachments migration', () => {
  it('creates constrained follow and polymorphic attachment tables', async () => {
    const queries: string[] = [];
    const query = jest.fn((sql: string) => {
      queries.push(sql);
      return Promise.resolve();
    });
    const runner = { query } as unknown as QueryRunner;
    const migration = new AddFollowsAndAttachments1731300000000();

    await migration.up(runner);

    expect(query).toHaveBeenCalledTimes(2);
    expect(queries[0]).toEqual(
      expect.stringContaining('UNIQUE INDEX UQ_follows_follower_following'),
    );
    expect(queries[0]).toEqual(expect.stringContaining('ON DELETE CASCADE'));
    expect(queries[1]).toEqual(
      expect.stringContaining('INDEX IDX_attachments_owner'),
    );
    expect(queries[1]).toEqual(expect.stringContaining('owner_type enum'));
    expect(queries[1]).toEqual(expect.stringContaining('updated_at datetime'));
  });

  it('drops child tables in a reversible down migration', async () => {
    const queries: string[] = [];
    const query = jest.fn((sql: string) => {
      queries.push(sql);
      return Promise.resolve();
    });
    const runner = { query } as unknown as QueryRunner;
    await new AddFollowsAndAttachments1731300000000().down(runner);
    expect(queries).toEqual(['DROP TABLE attachments', 'DROP TABLE follows']);
  });
});
