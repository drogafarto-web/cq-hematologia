/**
 * Vitest config for Cloud Functions unit tests.
 *
 * Run with:
 *   npx vitest run --config vitest.functions.config.ts functions/src/__tests__/export/
 *
 * Uses Node environment (not jsdom) since functions run in Node.
 * Firebase Admin SDK is mocked via vi.mock() in each test file.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['functions/src/__tests__/**/*.test.ts'],
  },
});
