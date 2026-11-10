import {
  DEFAULT_API_PREFIX,
  DEFAULT_PORT,
  validateDatabaseEnvironment,
  validateEnvironment,
} from './env.validation';

const REQUIRED_ENVIRONMENT = {
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USERNAME: 'realworld_test',
  DB_PASSWORD: 'test-password',
  DB_DATABASE: 'realworld_test',
  JWT_SECRET: 'test-secret-with-at-least-32-characters',
  JWT_EXPIRES_IN: '3600',
  JWT_REFRESH_SECRET: 'different-refresh-secret-with-32-characters',
  JWT_REFRESH_EXPIRES_IN: '604800',
  REDIS_URL: 'redis://127.0.0.1:6379',
  MAIL_HOST: 'smtp.example.com',
  MAIL_PORT: '465',
  MAIL_SECURE: 'true',
  MAIL_USER: 'mailer@example.com',
  MAIL_PASSWORD: 'test-mail-password',
  MAIL_FROM: 'mailer@example.com',
  OTP_SECRET: 'test-otp-secret-with-at-least-32-characters',
  OTP_EXPIRES_IN: '600',
};

describe('validateEnvironment', () => {
  it('validates migration database settings without application secrets', () => {
    expect(
      validateDatabaseEnvironment({
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_USERNAME: 'realworld',
        DB_PASSWORD: 'local-password',
        DB_DATABASE: 'realworld',
      }),
    ).toEqual({
      DB_HOST: '127.0.0.1',
      DB_PORT: 3306,
      DB_USERNAME: 'realworld',
      DB_PASSWORD: 'local-password',
      DB_DATABASE: 'realworld',
    });
  });

  it('parses valid values and optional defaults', () => {
    expect(validateEnvironment(REQUIRED_ENVIRONMENT)).toEqual({
      NODE_ENV: 'development',
      PORT: DEFAULT_PORT,
      API_PREFIX: DEFAULT_API_PREFIX,
      DB_HOST: '127.0.0.1',
      DB_PORT: 3306,
      DB_USERNAME: 'realworld_test',
      DB_PASSWORD: 'test-password',
      DB_DATABASE: 'realworld_test',
      JWT_SECRET: 'test-secret-with-at-least-32-characters',
      JWT_EXPIRES_IN: 3600,
      JWT_REFRESH_SECRET: 'different-refresh-secret-with-32-characters',
      JWT_REFRESH_EXPIRES_IN: 604800,
      REDIS_URL: 'redis://127.0.0.1:6379',
      MAIL_HOST: 'smtp.example.com',
      MAIL_PORT: 465,
      MAIL_SECURE: true,
      MAIL_USER: 'mailer@example.com',
      MAIL_PASSWORD: 'test-mail-password',
      MAIL_FROM: 'mailer@example.com',
      OTP_SECRET: 'test-otp-secret-with-at-least-32-characters',
      OTP_EXPIRES_IN: 600,
      OTP_MAX_ATTEMPTS: 5,
      OTP_RESEND_COOLDOWN: 60,
    });
  });

  it('rejects missing database configuration in test mode', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'test' })).toThrow(
      'DB_HOST, DB_USERNAME, DB_PASSWORD, and DB_DATABASE are required.',
    );
  });

  it('rejects a missing JWT secret', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED_ENVIRONMENT, JWT_SECRET: '' }),
    ).toThrow('JWT_SECRET must be at least 32 characters.');
  });

  it('rejects a reused refresh token secret', () => {
    expect(() =>
      validateEnvironment({
        ...REQUIRED_ENVIRONMENT,
        JWT_REFRESH_SECRET: REQUIRED_ENVIRONMENT.JWT_SECRET,
      }),
    ).toThrow(
      'JWT_REFRESH_SECRET must be at least 32 characters and differ from JWT_SECRET.',
    );
  });

  it('rejects an invalid Redis URL without exposing it', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED_ENVIRONMENT, REDIS_URL: 'secret' }),
    ).toThrow('REDIS_URL must be a valid redis:// or rediss:// URL.');
  });

  it('rejects missing mail configuration', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED_ENVIRONMENT, MAIL_PASSWORD: '' }),
    ).toThrow(
      'MAIL_HOST, MAIL_USER, MAIL_PASSWORD, and MAIL_FROM are required.',
    );
  });

  it('rejects an invalid mail security flag', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED_ENVIRONMENT, MAIL_SECURE: 'yes' }),
    ).toThrow('MAIL_SECURE must be either true or false.');
  });

  it('rejects an unsupported NODE_ENV value', () => {
    expect(() =>
      validateEnvironment({
        ...REQUIRED_ENVIRONMENT,
        NODE_ENV: 'staging',
      }),
    ).toThrow('NODE_ENV must be one of: development, test, production.');
  });

  it('rejects a non-string value', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED_ENVIRONMENT, PORT: 3000 }),
    ).toThrow('PORT must be a string.');
  });

  it('rejects an out-of-range PORT value', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED_ENVIRONMENT, PORT: '70000' }),
    ).toThrow('PORT must be an integer between 1 and 65535.');
  });

  it('rejects an invalid API_PREFIX value', () => {
    expect(() =>
      validateEnvironment({ ...REQUIRED_ENVIRONMENT, API_PREFIX: '/v1' }),
    ).toThrow(
      'API_PREFIX must start with a letter or number and contain only letters, numbers, underscores, or hyphens.',
    );
  });
});
