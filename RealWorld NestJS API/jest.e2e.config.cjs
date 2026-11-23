module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/support/load-test-env.cjs'],
  testMatch: ['<rootDir>/tests/full-e2e/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          isolatedModules: false,
          // Lower optional chaining so Istanbul records its actual decisions.
          target: 'ES2019',
          lib: ['ES2023'],
          module: 'CommonJS',
          moduleResolution: 'Node',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
  maxWorkers: 1,
  collectCoverageFrom: ['src/comments/comments.controller.ts'],
  coverageDirectory: 'coverage/e2e',
  coverageReporters: ['text', 'html', 'lcov', 'json-summary'],
  coverageThreshold: {
    './src/comments/comments.controller.ts': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
