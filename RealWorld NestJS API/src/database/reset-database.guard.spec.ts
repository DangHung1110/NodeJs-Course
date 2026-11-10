import {
  assertDatabaseResetAllowed,
  DatabaseResetGuardError,
} from './reset-database.guard';

describe('assertDatabaseResetAllowed', () => {
  it('allows only a confirmed local test database', () => {
    expect(() =>
      assertDatabaseResetAllowed(
        'test',
        '127.0.0.1',
        'realworld_test',
        'realworld_test',
      ),
    ).not.toThrow();
  });

  it.each([
    ['production', '127.0.0.1', 'realworld_test', 'realworld_test'],
    ['test', 'database.example.com', 'realworld_test', 'realworld_test'],
    ['test', '127.0.0.1', 'realworld_test', 'wrong-database'],
  ])('rejects an unsafe reset configuration', (...configuration) => {
    expect(() => assertDatabaseResetAllowed(...configuration)).toThrow(
      DatabaseResetGuardError,
    );
  });
});
