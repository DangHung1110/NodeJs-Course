import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { DEFAULT_PORT } from './config/env.validation';
import { DEFAULT_UPLOAD_DIRECTORY } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const uploadDirectory = configService.get<string>(
    'UPLOAD_DIRECTORY',
    DEFAULT_UPLOAD_DIRECTORY,
  );
  app.useStaticAssets(join(process.cwd(), uploadDirectory), {
    prefix: '/uploads/',
    fallthrough: false,
  });

  configureApp(app);

  const port = configService.get<number>('PORT', DEFAULT_PORT);

  await app.listen(port);
}

void bootstrap();
