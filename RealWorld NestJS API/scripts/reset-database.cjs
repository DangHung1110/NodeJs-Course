const { AppDataSource } = require('../dist/database/data-source');
const { assertDatabaseResetAllowed } = require('../dist/database/reset-database.guard');

async function resetDatabase() {
  assertDatabaseResetAllowed(
    process.env.NODE_ENV,
    process.env.DB_HOST,
    process.env.DB_DATABASE,
    process.env.DATABASE_RESET_CONFIRM,
  );

  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    await queryRunner.connect();
    if (!(await queryRunner.hasTable('typeorm_migrations'))) return;
    while (true) {
      const migrations = await queryRunner.query(
        'SELECT COUNT(*) AS count FROM typeorm_migrations',
      );
      if (Number(migrations[0]?.count ?? 0) === 0) break;
      await AppDataSource.undoLastMigration();
    }
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

resetDatabase().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
