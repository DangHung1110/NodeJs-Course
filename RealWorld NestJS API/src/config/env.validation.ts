export const DEFAULT_PORT = 3000;
export const DEFAULT_API_PREFIX = 'api';

export type NodeEnvironment = 'development' | 'test' | 'production';

export interface EnvironmentVariables {
  readonly NODE_ENV: NodeEnvironment;
  readonly PORT: number;
  readonly API_PREFIX: string;
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

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    API_PREFIX: apiPrefix,
  };
}
