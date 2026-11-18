import {
  INestApplication,
  UnprocessableEntityException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DEFAULT_API_PREFIX } from './config/env.validation';

const SWAGGER_TITLE = 'RealWorld NestJS API';
const SWAGGER_DESCRIPTION = 'RealWorld backend API built with NestJS.';
const SWAGGER_VERSION = '0.0.1';

function collectValidationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectValidationMessages(error.children ?? []),
  ]);
}

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
      exceptionFactory: (errors) =>
        new UnprocessableEntityException({
          errors: { body: collectValidationMessages(errors) },
        }),
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
    .addTag('Authentication', 'Register, login, and logout.')
    .addTag('Users', 'Authenticated user endpoints.')
    .addTag('Profiles', 'Public profiles and follow relationships.')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'Authorization' },
      'TokenAuth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
}
