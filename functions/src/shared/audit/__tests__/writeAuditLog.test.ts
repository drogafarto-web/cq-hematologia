/**
 * Tests for shared/audit/writeAuditLog
 *
 * Covers:
 *   - happy path → returns { ok: true, id }
 *   - transient failure → retries and eventually succeeds
 *   - permanent failure → emits console.error + writes fallback doc + returns { ok: false }
 *   - permanent failure where fallback ALSO fails → still returns { ok: false } (no throw)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { writeAuditLog } from '../writeAuditLog';

// firebase-admin must be mocked because the helper calls
// `admin.firestore.FieldValue.serverTimestamp()` and the tsconfig types include node only.
jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => '__SERVER_TS__'),
  };
  return {
    firestore: Object.assign(jest.fn(), { FieldValue }),
  };
});

interface FakeDocRef {
  id: string;
}

interface CollectionCall {
  name: string;
  added: Array<Record<string, unknown>>;
  failuresLeft: number;
}

function makeFirestore(opts: {
  failuresOnAuditLogs?: number; // how many add() calls reject before succeeding
  failFallback?: boolean;
}) {
  const calls: CollectionCall[] = [];
  let auditLogsFailuresLeft = opts.failuresOnAuditLogs ?? 0;
  let counter = 0;

  const auditLogsAdd = jest.fn(async (data: Record<string, unknown>) => {
    if (auditLogsFailuresLeft > 0) {
      auditLogsFailuresLeft--;
      throw new Error('transient firestore unavailable');
    }
    counter++;
    const id = `audit-${counter}`;
    calls.push({ name: 'auditLogs', added: [data], failuresLeft: auditLogsFailuresLeft });
    return { id } as FakeDocRef;
  });

  const fallbackAdd = jest.fn(async (data: Record<string, unknown>) => {
    if (opts.failFallback) {
      throw new Error('fallback also down');
    }
    counter++;
    const id = `fallback-${counter}`;
    calls.push({ name: 'fallback', added: [data], failuresLeft: 0 });
    return { id } as FakeDocRef;
  });

  const fakeDb = {
    collection: jest.fn((name: string) => {
      if (name === 'auditLogs') {
        return { add: auditLogsAdd };
      }
      if (name === 'auditLogFailures') {
        return {
          doc: jest.fn(() => ({
            collection: jest.fn(() => ({ add: fallbackAdd })),
          })),
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    }),
  };

  return { fakeDb, auditLogsAdd, fallbackAdd, calls };
}

describe('writeAuditLog', () => {
  const realSetTimeout = global.setTimeout;

  beforeEach(() => {
    // Stub setTimeout so retry backoff does not slow tests down.
    jest
      .spyOn(global, 'setTimeout')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((cb: () => void) => {
        cb();
        return 0;
      }) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.setTimeout = realSetTimeout;
  });

  it('returns { ok: true, id } on first-attempt success', async () => {
    const { fakeDb, auditLogsAdd, fallbackAdd } = makeFirestore({});

    const result = await writeAuditLog(
      { action: 'TEST_OK', labId: 'lab-1', callerUid: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result).toEqual({ ok: true, id: 'audit-1' });
    expect(auditLogsAdd).toHaveBeenCalledTimes(1);
    expect(fallbackAdd).not.toHaveBeenCalled();
    // Payload preserves caller fields and injects serverTimestamp.
    const writtenPayload = auditLogsAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(writtenPayload.action).toBe('TEST_OK');
    expect(writtenPayload.labId).toBe('lab-1');
    expect(writtenPayload.timestamp).toBe('__SERVER_TS__');
  });

  it('retries on transient failure and succeeds on a later attempt', async () => {
    const { fakeDb, auditLogsAdd, fallbackAdd } = makeFirestore({
      failuresOnAuditLogs: 2, // first 2 reject, 3rd succeeds
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await writeAuditLog(
      { action: 'TEST_RETRY', labId: 'lab-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.id).toBe('audit-1');
    }
    expect(auditLogsAdd).toHaveBeenCalledTimes(3);
    expect(fallbackAdd).not.toHaveBeenCalled();
    // No final error logged because the eventual write succeeded.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('writes fallback doc + emits console.error after exhausting retries', async () => {
    const { fakeDb, auditLogsAdd, fallbackAdd } = makeFirestore({
      failuresOnAuditLogs: 99, // every attempt fails
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await writeAuditLog(
      { action: 'TEST_FAIL', labId: 'lab-42', callerUid: 'user-9' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/transient firestore unavailable/);
    }
    expect(auditLogsAdd).toHaveBeenCalledTimes(3); // exactly MAX_ATTEMPTS
    expect(fallbackAdd).toHaveBeenCalledTimes(1);

    // Fallback payload must include intent + error
    const fallbackPayload = fallbackAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(fallbackPayload.intendedPayload).toMatchObject({
      action: 'TEST_FAIL',
      labId: 'lab-42',
    });
    expect(fallbackPayload.error).toContain('transient firestore unavailable');
    expect(fallbackPayload.attempts).toBe(3);

    // Cloud Logs alert
    expect(errorSpy).toHaveBeenCalledWith(
      '[writeAuditLog] FAILED after retries',
      expect.objectContaining({ action: 'TEST_FAIL', labId: 'lab-42', attempts: 3 }),
    );
  });

  it('does not throw when fallback write itself fails', async () => {
    const { fakeDb, auditLogsAdd, fallbackAdd } = makeFirestore({
      failuresOnAuditLogs: 99,
      failFallback: true,
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await writeAuditLog(
      { action: 'TEST_DOUBLE_FAIL', labId: 'lab-1' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result.ok).toBe(false);
    expect(auditLogsAdd).toHaveBeenCalledTimes(3);
    expect(fallbackAdd).toHaveBeenCalledTimes(1);
    // Both errors should be surfaced via console.error
    expect(errorSpy).toHaveBeenCalledWith(
      '[writeAuditLog] FAILED after retries',
      expect.any(Object),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[writeAuditLog] CRITICAL: fallback write also failed',
      expect.any(Object),
    );
  });

  it('uses _unknown lab bucket when labId is missing', async () => {
    const { fakeDb, fallbackAdd } = makeFirestore({
      failuresOnAuditLogs: 99,
    });

    const docSpy = jest.fn(() => ({
      collection: jest.fn(() => ({ add: fallbackAdd })),
    }));
    // Re-wire collection('auditLogFailures') to capture the doc-key arg.
    fakeDb.collection = jest.fn((name: string) => {
      if (name === 'auditLogs') {
        return {
          add: jest.fn(() => Promise.reject(new Error('boom'))),
        };
      }
      if (name === 'auditLogFailures') {
        return { doc: docSpy };
      }
      throw new Error(`unexpected collection: ${name}`);
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await writeAuditLog(
      { action: 'NO_LAB' /* labId omitted */ },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result.ok).toBe(false);
    expect(docSpy).toHaveBeenCalledWith('_unknown');
  });
});
