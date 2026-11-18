export const DEFAULT_PORT = 3000;
export const DEFAULT_API_PREFIX = 'api';
export const DEFAULT_UPLOAD_DIRECTORY = 'uploads';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface DatabaseEnvironmentVariables {
  readonly DB_HOST: string;
  readonly DB_PORT: number;
  readonly DB_USERNAME: string;
  readonly DB_PASSWORD: string;
  readonly DB_DATABASE: string;
}

export interface EnvironmentVariables extends DatabaseEnvironmentVariables {
  readonly NODE_ENV: NodeEnvironment;
  readonly PORT: number;
  readonly API_PREFIX: string;
  readonly JWT_SECRET: string;
  readonly JWT_EXPIRES_IN: number;
  readonly JWT_REFRESH_SECRET: string;
  readonly JWT_REFRESH_EXPIRES_IN: number;
  readonly REDIS_URL: string;
  readonly MAIL_HOST: string;
  readonly MAIL_PORT: number;
  readonly MAIL_SECURE: boolean;
  readonly MAIL_USER: string;
  readonly MAIL_PASSWORD: string;
  readonly MAIL_FROM: string;
  readonly OTP_SECRET: string;
  readonly OTP_EXPIRES_IN: number;
  readonly OTP_MAX_ATTEMPTS: number;
  readonly OTP_RESEND_COOLDOWN: number;
  readonly UPLOAD_DIRECTORY: string;
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

  const databaseEnvironment = validateDatabaseEnvironment(config);
  const jwtSecret = readString(config, 'JWT_SECRET', '');
  const jwtRefreshSecret = readString(config, 'JWT_REFRESH_SECRET', '');
  const redisUrl = readString(config, 'REDIS_URL', '');
  const mailHost = readString(config, 'MAIL_HOST', '');
  const mailUser = readString(config, 'MAIL_USER', '');
  const mailPassword = readString(config, 'MAIL_PASSWORD', '');
  const mailFrom = readString(config, 'MAIL_FROM', '');
  const otpSecret = readString(config, 'OTP_SECRET', '');
  const uploadDirectory = readString(
    config,
    'UPLOAD_DIRECTORY',
    DEFAULT_UPLOAD_DIRECTORY,
  );

  if (jwtSecret.length < 32) {
    throw new EnvironmentValidationError(
      'JWT_SECRET must be at least 32 characters.',
    );
  }

  if (jwtRefreshSecret.length < 32 || jwtRefreshSecret === jwtSecret) {
    throw new EnvironmentValidationError(
      'JWT_REFRESH_SECRET must be at least 32 characters and differ from JWT_SECRET.',
    );
  }

  if (!mailHost || !mailUser || !mailPassword || !mailFrom) {
    throw new EnvironmentValidationError(
      'MAIL_HOST, MAIL_USER, MAIL_PASSWORD, and MAIL_FROM are required.',
    );
  }

  if (otpSecret.length < 32) {
    throw new EnvironmentValidationError(
      'OTP_SECRET must be at least 32 characters.',
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

  const jwtExpiresIn = Number(readString(config, 'JWT_EXPIRES_IN', ''));
  if (!Number.isInteger(jwtExpiresIn) || jwtExpiresIn < 1) {
    throw new EnvironmentValidationError(
      'JWT_EXPIRES_IN must be a positive integer in seconds.',
    );
  }

  const jwtRefreshExpiresIn = Number(
    readString(config, 'JWT_REFRESH_EXPIRES_IN', ''),
  );
  if (!Number.isInteger(jwtRefreshExpiresIn) || jwtRefreshExpiresIn < 1) {
    throw new EnvironmentValidationError(
      'JWT_REFRESH_EXPIRES_IN must be a positive integer in seconds.',
    );
  }

  const mailPort = readPositiveInteger(config, 'MAIL_PORT');
  if (mailPort > 65_535) {
    throw new EnvironmentValidationError(
      'MAIL_PORT must be an integer between 1 and 65535.',
    );
  }

  const mailSecureValue = readString(config, 'MAIL_SECURE', '');
  if (mailSecureValue !== 'true' && mailSecureValue !== 'false') {
    throw new EnvironmentValidationError(
      'MAIL_SECURE must be either true or false.',
    );
  }

  const otpExpiresIn = readPositiveInteger(config, 'OTP_EXPIRES_IN');
  const otpMaxAttempts = readPositiveInteger(config, 'OTP_MAX_ATTEMPTS', '5');
  const otpResendCooldown = readPositiveInteger(
    config,
    'OTP_RESEND_COOLDOWN',
    '60',
  );

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    API_PREFIX: apiPrefix,
    ...databaseEnvironment,
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: jwtExpiresIn,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    JWT_REFRESH_EXPIRES_IN: jwtRefreshExpiresIn,
    REDIS_URL: redisUrl,
    MAIL_HOST: mailHost,
    MAIL_PORT: mailPort,
    MAIL_SECURE: mailSecureValue === 'true',
    MAIL_USER: mailUser,
    MAIL_PASSWORD: mailPassword,
    MAIL_FROM: mailFrom,
    OTP_SECRET: otpSecret,
    OTP_EXPIRES_IN: otpExpiresIn,
    OTP_MAX_ATTEMPTS: otpMaxAttempts,
    OTP_RESEND_COOLDOWN: otpResendCooldown,
    UPLOAD_DIRECTORY: uploadDirectory,
  };
}

export function validateDatabaseEnvironment(
  config: Record<string, unknown>,
): DatabaseEnvironmentVariables {
  const databaseHost = readString(config, 'DB_HOST', '');
  const databaseUsername = readString(config, 'DB_USERNAME', '');
  const databasePassword = readString(config, 'DB_PASSWORD', '');
  const databaseName = readString(config, 'DB_DATABASE', '');

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

  const databasePort = Number(readString(config, 'DB_PORT', ''));
  if (
    !Number.isInteger(databasePort) ||
    databasePort < 1 ||
    databasePort > 65_535
  ) {
    throw new EnvironmentValidationError(
      'DB_PORT must be an integer between 1 and 65535.',
    );
  }

  return {
    DB_HOST: databaseHost,
    DB_PORT: databasePort,
    DB_USERNAME: databaseUsername,
    DB_PASSWORD: databasePassword,
    DB_DATABASE: databaseName,
  };
}

function readPositiveInteger(
  config: Record<string, unknown>,
  key: string,
  fallback = '',
): number {
  const value = Number(readString(config, key, fallback));
  if (!Number.isInteger(value) || value < 1) {
    throw new EnvironmentValidationError(`${key} must be a positive integer.`);
  }
  return value;
}
