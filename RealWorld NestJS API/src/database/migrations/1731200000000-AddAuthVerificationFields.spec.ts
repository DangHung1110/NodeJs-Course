import { QueryRunner } from 'typeorm';
import { AddAuthVerificationFields1731200000000 } from './1731200000000-AddAuthVerificationFields';

describe('AddAuthVerificationFields1731200000000', () => {
  it('adds auth fields and backfills existing users as verified', async () => {
    const queryRunner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new AddAuthVerificationFields1731200000000();

    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(
        /token_version[\s\S]+is_active[\s\S]+email_verified_at/,
      ),
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SET email_verified_at = created_at'),
    );
  });
});
