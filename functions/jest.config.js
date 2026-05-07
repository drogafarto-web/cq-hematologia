/**
 * Jest Configuration for Cloud Functions
 * Phase 4 NOTIVISA test suite
 */

module.exports = {
  displayName: 'functions',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  collectCoverageFrom: [
    'modules/**/*.ts',
    '!modules/**/__tests__/**',
    '!modules/**/__mocks__/**',
    '!**/*.d.ts',
  ],
  coverageDirectory: '../coverage/functions',
  coverageReporters: ['text', 'lcov', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/__mocks__/',
  ],
  testTimeout: 10000,
  verbose: true,
  bail: false,
};
