export const DEFAULT_PORT = 3000;
export const DEFAULT_API_PREFIX = 'api';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  readonly NODE_ENV: NodeEnvironment;
  readonly PORT: number;
  readonly API_PREFIX: string;
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_USERNAME: string;
  readonly DB_PASSWORD: string;
  readonly DB_DATABASE: string;
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRES_IN: number;
  readonly REDIS_URL: string;
}

const NODE_ENVIRONMENTS: readonly NodeEnvironment[] = [
  'development',
  'test',
  'production',
];

const API_PREFIX_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

function readString(
  config: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = config[key];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new EnvironmentValidationError(`${key} must be a string.`);
  }

  const trimmedValue = value.trim();

  return trimmedValue.length === 0 ? fallback : trimmedValue;
}

function isNodeEnvironment(value: string): value is NodeEnvironment {
  return NODE_ENVIRONMENTS.some((environment) => environment === value);
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const nodeEnv = readString(config, 'NODE_ENV', 'development');

  if (!isNodeEnvironment(nodeEnv)) {
    throw new EnvironmentValidationError(
      `NODE_ENV must be one of: ${NODE_ENVIRONMENTS.join(', ')}.`,
    );
  }

  const port = Number(readString(config, 'PORT', String(DEFAULT_PORT)));

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EnvironmentValidationError(
      'PORT must be an integer between 1 and 65535.',
    );
  }

  const apiPrefix = readString(config, 'API_PREFIX', DEFAULT_API_PREFIX);

  if (!API_PREFIX_PATTERN.test(apiPrefix)) {
    throw new EnvironmentValidationError(
      'API_PREFIX must start with a letter or number and contain only letters, numbers, underscores, or hyphens.',
    );
  }

  const isTest = nodeEnv === 'test';
  const databaseHost = readString(config, 'DB_HOST', isTest ? '127.0.0.1' : '');
  const databaseUsername = readString(
    config,
    'DB_USERNAME',
    isTest ? 'test' : '',
  );
  const databasePassword = readString(
    config,
    'DB_PASSWORD',
    isTest ? 'test' : '',
  );
  const databaseName = readString(
    config,
    'DB_DATABASE',
    isTest ? 'realworld_test' : '',
  );
  const jwtSecret = readString(
    config,
    'JWT_SECRET',
    isTest ? 'test-only-secret-with-at-least-32-characters' : '',
  );
  const redisUrl = readString(
    config,
    'REDIS_URL',
    isTest ? 'redis://127.0.0.1:6379' : '',
  );

  if (
    !databaseHost ||
    !databaseUsername ||
    !databasePassword ||
    !databaseName
  ) {
    throw new EnvironmentValidationError(
      'DB_HOST, DB_USERNAME, DB_PASSWORD, and DB_DATABASE are required.',
    );
  }

  if (jwtSecret.length < 32) {
    throw new EnvironmentValidationError(
      'JWT_SECRET must be at least 32 characters.',
    );
  }

  let parsedRedisUrl: URL;

  try {
    parsedRedisUrl = new URL(redisUrl);
  } catch {
    throw new EnvironmentValidationError(
      'REDIS_URL must be a valid redis:// or rediss:// URL.',
    );
  }

  if (
    (parsedRedisUrl.protocol !== 'redis:' &&
      parsedRedisUrl.protocol !== 'rediss:') ||
    !parsedRedisUrl.hostname
  ) {
    throw new EnvironmentValidationError(
      'REDIS_URL must be a valid redis:// or rediss:// URL.',
    );
  }

  const databasePort = Number(
    readString(config, 'DB_PORT', isTest ? '3306' : ''),
  );
  if (
    !Number.isInteger(databasePort) ||
    databasePort < 1 ||
    databasePort > 65535
  ) {
    throw new EnvironmentValidationError(
      'DB_PORT must be an integer between 1 and 65535.',
    );
  }

  const jwtExpiresIn = Number(readString(config, 'JWT_EXPIRES_IN', '3600'));
  if (!Number.isInteger(jwtExpiresIn) || jwtExpiresIn < 1) {
    throw new EnvironmentValidationError(
      'JWT_EXPIRES_IN must be a positive integer in seconds.',
    );
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    API_PREFIX: apiPrefix,
    DB_HOST: databaseHost,
    DB_PORT: databasePort,
    DB_USERNAME: databaseUsername,
    DB_PASSWORD: databasePassword,
    DB_DATABASE: databaseName,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    REDIS_URL: redisUrl,
  };
}
