/**
 * Wave 2 — Smoke test: acknowledgeEscalacao must work WITHOUT Twilio creds.
 *
 * Guards the contract that:
 *   1. The criticos module loads with TWILIO_* env vars unset / placeholder.
 *   2. `acknowledgeEscalacao` is exported and is a function-shaped callable.
 *   3. `twilio` is NOT pulled into the dependency graph at module-load time
 *      (it is now imported lazily inside SMS-emitting handlers only).
 *
 * Without this guard, deploying acknowledgeEscalacao to a tenant that has
 * not yet provisioned Twilio secrets would cascade-fail the whole bundle.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Make sure firebase-admin doesn't try to reach a real project during import.
jest.mock('firebase-admin', () => {
  const fakeFirestore = () => ({
    collection: () => ({
      doc: () => ({ get: async () => ({ exists: false }) }),
    }),
  });
  return {
    firestore: Object.assign(fakeFirestore, {
      Timestamp: {
        now: () => ({ toMillis: () => Date.now() }),
      },
    }),
    initializeApp: () => undefined,
    apps: [],
  };
});

describe('Wave 2 — acknowledgeEscalacao Twilio decoupling', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      TWILIO_ACCOUNT_SID: 'PENDING_SET_TWILIO_ACCOUNT_SID',
      TWILIO_AUTH_TOKEN: 'PENDING_SET_TWILIO_AUTH_TOKEN',
      TWILIO_PHONE_NUMBER: 'PENDING_SET_TWILIO_PHONE_NUMBER',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads the criticos module with placeholder Twilio secrets', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../index');
    }).not.toThrow();
  });

  it('exports acknowledgeEscalacao as a callable handle', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../index');
    expect(mod.acknowledgeEscalacao).toBeDefined();
    // v2 onCall returns a CallableFunction object; surface check is enough.
    expect(typeof mod.acknowledgeEscalacao).toBe('function');
  });

  it('does NOT pull `twilio` SDK into the static dependency graph', () => {
    // After requiring the criticos module with placeholder secrets, the
    // twilio package should not be in require.cache — it must only enter
    // when an SMS-emitting handler runs and lazy-imports twilioClient.
    jest.resetModules();
    process.env.TWILIO_ACCOUNT_SID = 'PENDING_SET_TWILIO_ACCOUNT_SID';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../index');
    const cachedTwilio = Object.keys(require.cache).filter((k) =>
      k.replace(/\\/g, '/').includes('/node_modules/twilio/'),
    );
    expect(cachedTwilio).toEqual([]);
  });
});
