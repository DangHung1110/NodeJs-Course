import { DataSource } from 'typeorm';

export const TEST_TABLES = [
  'comments',
  'favorites',
  'article_tags',
  'articles',
  'tags',
  'follows',
  'attachments',
  'users',
] as const;

export function testDatabaseConfig(env = process.env) {
  const required = (key: string): string => {
    const value = env[key];
    if (!value) throw new Error(`Missing test configuration: ${key}`);
    return value;
  };
  const database = required('MYSQL_TEST_DATABASE');
  const username = required('MYSQL_TEST_USER');
  const host = required('MYSQL_TEST_HOST');
  const port = Number(required('MYSQL_TEST_PORT'));
  if (
    env.NODE_ENV !== 'test' ||
    !/^realworld(?:_[a-z0-9]+)?_test$/.test(database) ||
    required('MYSQL_TEST_APPROVED_DATABASE') !== database ||
    username !== database ||
    !['localhost', '127.0.0.1'].includes(host) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      'Unsafe test database configuration. Use an approved loopback database and its dedicated user.',
    );
  }
  return {
    host,
    port,
    username,
    password: required('MYSQL_TEST_PASSWORD'),
    database,
  };
}

export async function assertTestDatabase(
  dataSource: DataSource,
): Promise<void> {
  const expected = testDatabaseConfig();
  const options = dataSource.options;
  if (
    options.type !== 'mysql' ||
    options.database !== expected.database ||
    options.username !== expected.username ||
    options.host !== expected.host ||
    options.port !== expected.port ||
    options.synchronize
  ) {
    throw new Error(
      'Connected DataSource does not match the approved test configuration.',
    );
  }
  const rows: { databaseName: string; username: string }[] =
    await dataSource.query(
      "SELECT DATABASE() AS databaseName, SUBSTRING_INDEX(CURRENT_USER(), '@', 1) AS username",
    );
  if (
    rows[0]?.databaseName !== expected.database ||
    rows[0]?.username !== expected.username
  ) {
    throw new Error(
      'Actual connected database/user is not approved for tests.',
    );
  }
}

export async function resetTestDatabase(dataSource: DataSource): Promise<void> {
  await assertTestDatabase(dataSource);
  // Keep FK checks enabled. UUID keys need no auto-increment reset.
  await dataSource.transaction(async (manager) => {
    for (const table of TEST_TABLES)
      await manager.query(`DELETE FROM ${table}`);
  });
}
