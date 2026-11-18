import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { AcceptLanguageResolver, I18nModule } from 'nestjs-i18n';
import { validateEnvironment } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './auth/redis.module';
import { DatabaseModule } from './database/database.module';
import { HelloModule } from './hello/hello.module';
import { ProfilesModule } from './profiles/profiles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnvironment,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: join(__dirname, 'i18n'),
        watch: false,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    ProfilesModule,
    HelloModule,
  ],
})
export class AppModule {}
