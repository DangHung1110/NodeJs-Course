import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateDatabaseEnvironment } from '../config/env.validation';
import { CreateUsers1731100000000 } from './migrations/1731100000000-CreateUsers';
import { AddAuthVerificationFields1731200000000 } from './migrations/1731200000000-AddAuthVerificationFields';
import { UserEntity } from './entities/user.entity';

const environment = validateDatabaseEnvironment(process.env);

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  username: environment.DB_USERNAME,
  password: environment.DB_PASSWORD,
  database: environment.DB_DATABASE,
  entities: [UserEntity],
  migrations: [
    CreateUsers1731100000000,
    AddAuthVerificationFields1731200000000,
  ],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
