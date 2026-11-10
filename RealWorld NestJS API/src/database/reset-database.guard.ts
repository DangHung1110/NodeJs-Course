const RESETTABLE_ENVIRONMENTS = ['development', 'test'];
const LOCAL_DATABASE_HOSTS = ['localhost', '127.0.0.1', '::1'];

export class DatabaseResetGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseResetGuardError';
  }
}

export function assertDatabaseResetAllowed(
  nodeEnvironment: string | undefined,
  databaseHost: string | undefined,
  databaseName: string | undefined,
  confirmation: string | undefined,
): void {
  if (!RESETTABLE_ENVIRONMENTS.includes(nodeEnvironment ?? '')) {
    throw new DatabaseResetGuardError(
      'Database reset is restricted to NODE_ENV=development or NODE_ENV=test.',
    );
  }
  if (!LOCAL_DATABASE_HOSTS.includes(databaseHost ?? '')) {
    throw new DatabaseResetGuardError(
      'Database reset is restricted to a MySQL server on this machine.',
    );
  }
  if (!databaseName || confirmation !== databaseName) {
    throw new DatabaseResetGuardError(
      'Set DATABASE_RESET_CONFIRM to the exact DB_DATABASE value to confirm the reset.',
    );
  }
}
