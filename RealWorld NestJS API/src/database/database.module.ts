import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { CreateUsers1731100000000 } from './migrations/1731100000000-CreateUsers';
import { AddAuthVerificationFields1731200000000 } from './migrations/1731200000000-AddAuthVerificationFields';

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
        entities: [UserEntity],
        migrations: [
          CreateUsers1731100000000,
          AddAuthVerificationFields1731200000000,
        ],
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
