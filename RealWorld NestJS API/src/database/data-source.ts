import 'dotenv/config';
import { DataSource } from 'typeorm';
import { CreateUsers1731100000000 } from './migrations/1731100000000-CreateUsers';
import { UserEntity } from './entities/user.entity';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [UserEntity],
  migrations: [CreateUsers1731100000000],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  migrationsRun: false,
});

export default AppDataSource;
