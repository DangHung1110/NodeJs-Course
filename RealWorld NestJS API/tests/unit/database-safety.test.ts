import { DataSource } from 'typeorm';
import { E2eApp } from '../support/e2e-app';
import {
  assertTestDatabase,
  resetTestDatabase,
  testDatabaseConfig,
} from '../support/database-safety';

const safe = {
  NODE_ENV: 'test',
  MYSQL_TEST_HOST: '127.0.0.1',
  MYSQL_TEST_PORT: '13306',
  MYSQL_TEST_USER: 'realworld_test',
  MYSQL_TEST_PASSWORD: 'test-only',
  MYSQL_TEST_DATABASE: 'realworld_test',
  MYSQL_TEST_APPROVED_DATABASE: 'realworld_test',
};

describe('Destructive test database guard', () => {
  it.each([
    { MYSQL_TEST_USER: 'root', REDIS_TEST_URL: 'redis://127.0.0.1:16379/15' },
    {
      MYSQL_TEST_USER: 'realworld_test',
      REDIS_TEST_URL: 'redis://127.0.0.1:16379/0',
    },
  ])(
    'preserves the environment after startup validation fails and close repeats',
    async (invalid) => {
      const previous = process.env;
      process.env = {
        ...previous,
        ...safe,
        ...invalid,
        PR06_ENV_SENTINEL: 'preserve-me',
      };
      const context = new E2eApp();
      try {
        await expect(context.start()).rejects.toThrow();
        await context.close();
        await context.close();
        expect(process.env.PR06_ENV_SENTINEL).toBe('preserve-me');
        expect(process.env.NODE_ENV).toBe('test');
        expect(context.ds).toBeUndefined();
        expect(context.redis).toBeUndefined();
      } finally {
        process.env = previous;
      }
    },
  );
  it.each([
    ['NODE_ENV', 'development'],
    ['MYSQL_TEST_DATABASE', 'realworld'],
    ['MYSQL_TEST_DATABASE', 'production_test'],
    ['MYSQL_TEST_APPROVED_DATABASE', 'other_test'],
    ['MYSQL_TEST_USER', 'root'],
    ['MYSQL_TEST_HOST', 'db.example.com'],
    ['MYSQL_TEST_PORT', 'NaN'],
    ['MYSQL_TEST_PASSWORD', ''],
  ])('rejects unsafe %s without connecting or deleting', (key, value) => {
    expect(() => testDatabaseConfig({ ...safe, [key]: value })).toThrow();
  });

  it('accepts explicit isolated configuration', () => {
    expect(testDatabaseConfig(safe)).toMatchObject({
      database: 'realworld_test',
      username: 'realworld_test',
    });
  });

  it.each([
    { databaseName: 'development', username: 'realworld_test' },
    { databaseName: 'realworld_test', username: 'root' },
  ])(
    'rejects actual connection identity mismatch before DELETE',
    async (identity) => {
      const previous = process.env;
      process.env = { ...previous, ...safe };
      const query = jest
        .fn<Promise<(typeof identity)[]>, [string]>()
        .mockResolvedValue([identity]);
      const transaction = jest.fn();
      const ds = {
        options: { type: 'mysql', ...testDatabaseConfig() },
        query,
        transaction,
      } as unknown as DataSource;
      try {
        await expect(resetTestDatabase(ds)).rejects.toThrow('Actual connected');
        expect(transaction).not.toHaveBeenCalled();
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0]?.[0]).toMatch(/^SELECT/);
      } finally {
        process.env = previous;
      }
    },
  );

  it('rejects a different DataSource before querying it', async () => {
    const previous = process.env;
    process.env = { ...previous, ...safe };
    const query = jest.fn();
    try {
      await expect(
        assertTestDatabase({
          options: { type: 'mysql', database: 'dev' },
          query,
        } as unknown as DataSource),
      ).rejects.toThrow('DataSource');
      expect(query).not.toHaveBeenCalled();
    } finally {
      process.env = previous;
    }
  });
});
