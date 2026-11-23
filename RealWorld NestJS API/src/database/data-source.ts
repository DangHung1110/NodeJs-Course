import { DATABASE_ENTITIES, DATABASE_MIGRATIONS } from './database.registry';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateDatabaseEnvironment } from '../config/env.validation';

if (process.env.NODE_ENV !== 'test') {
  config({ path: ['.env.local', '.env'], quiet: true });
}

const environment = validateDatabaseEnvironment(process.env);

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  username: environment.DB_USERNAME,
  password: environment.DB_PASSWORD,
  database: environment.DB_DATABASE,
  entities: DATABASE_ENTITIES,
  migrations: DATABASE_MIGRATIONS,
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  migrationsRun: false,
});
