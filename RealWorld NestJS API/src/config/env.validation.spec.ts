import {
  DEFAULT_API_PREFIX,
  DEFAULT_PORT,
  validateEnvironment,
} from './env.validation';

describe('validateEnvironment', () => {
  it('returns defaults when optional values are absent', () => {
    expect(validateEnvironment({})).toEqual({
      NODE_ENV: 'development',
      PORT: DEFAULT_PORT,
      API_PREFIX: DEFAULT_API_PREFIX,
    });
  });

  it('returns defaults for empty values', () => {
    expect(
      validateEnvironment({
        NODE_ENV: ' ',
        PORT: '',
        API_PREFIX: '',
      }),
    ).toEqual({
      NODE_ENV: 'development',
      PORT: DEFAULT_PORT,
      API_PREFIX: DEFAULT_API_PREFIX,
    });
  });

  it('parses a valid configuration', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        PORT: '8080',
        API_PREFIX: 'v1-api',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      API_PREFIX: 'v1-api',
    });
  });

  it('rejects an unsupported NODE_ENV value', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow(
      'NODE_ENV must be one of: development, test, production.',
    );
  });

  it('rejects a non-string value', () => {
    expect(() => validateEnvironment({ PORT: 3000 })).toThrow(
      'PORT must be a string.',
    );
  });

  it('rejects a non-integer PORT value', () => {
    expect(() => validateEnvironment({ PORT: '3000.5' })).toThrow(
      'PORT must be an integer between 1 and 65535.',
    );
  });

  it('rejects an out-of-range PORT value', () => {
    expect(() => validateEnvironment({ PORT: '70000' })).toThrow(
      'PORT must be an integer between 1 and 65535.',
    );
  });

  it('rejects an invalid API_PREFIX value', () => {
    expect(() => validateEnvironment({ API_PREFIX: '/v1' })).toThrow(
      'API_PREFIX must start with a letter or number and contain only letters, numbers, underscores, or hyphens.',
    );
  });
});
