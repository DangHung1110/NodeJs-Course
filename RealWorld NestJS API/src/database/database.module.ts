import { DATABASE_ENTITIES, DATABASE_MIGRATIONS } from './database.registry';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.getOrThrow<string>('DB_HOST'),
        port: configService.getOrThrow<number>('DB_PORT'),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_DATABASE'),
        entities: DATABASE_ENTITIES,
        migrations: DATABASE_MIGRATIONS,
        migrationsTableName: 'typeorm_migrations',
        synchronize: false,
        migrationsRun: false,
        manualInitialization: configService.get<string>('NODE_ENV') === 'test',
      }),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
