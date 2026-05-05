/**
 * Jest config for Detox E2E tests
 *
 * Key settings:
 * - rootDir: project root (e2e/ is a sibling of src/)
 * - testTimeout: 120s — network + native init is slow on CI
 * - maxWorkers: 1 — Detox tests are serial (one device session at a time)
 * - testRunner: jest-circus (required by Detox 20+)
 * - transform: ts-jest for TypeScript E2E files
 */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/flows/**/*.e2e.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  testRunner: 'jest-circus/runner',
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  verbose: true,
  transform: {
    '\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
};
