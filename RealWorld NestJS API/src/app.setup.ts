import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DEFAULT_API_PREFIX } from './config/env.validation';

const SWAGGER_TITLE = 'RealWorld NestJS API';
const SWAGGER_DESCRIPTION = 'RealWorld backend API built with NestJS.';
const SWAGGER_VERSION = '0.0.1';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('API_PREFIX', DEFAULT_API_PREFIX);
  const nodeEnvironment = configService.get<string>('NODE_ENV', 'development');

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (nodeEnvironment !== 'production') {
    configureSwagger(app);
  }
}

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .addTag('Hello', 'Localized hello endpoint.')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
}
