/**
 * Tests for shared/audit/writeChainedAudit
 *
 * Covers:
 *   - happy path → returns { ok: true, id }
 *   - transient failure → retries and eventually succeeds
 *   - permanent failure → emits console.error + writes sibling marker doc
 *     into `<chain>-auditFailures` (NOT into the chain itself) +
 *     returns { ok: false }
 *   - permanent failure where sibling marker write ALSO fails → still
 *     returns { ok: false } (no throw)
 *   - failureMarkerCollectionPath: derives correct sibling path
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock firebase-admin BEFORE requiring the helper (it captures admin.firestore()
// at module-eval time inside cryptoAudit.ts).
jest.mock('firebase-admin', () => {
  const FieldValue = {
    serverTimestamp: jest.fn(() => '__SERVER_TS__'),
  };
  const fakeDb = {
    collection: jest.fn(() => ({
      add: jest.fn(),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(async () => ({ empty: true, docs: [] })),
        })),
      })),
    })),
  };
  return {
    firestore: Object.assign(jest.fn(() => fakeDb), { FieldValue }),
  };
});

// Mock signAuditEntry so we can drive its outcome per-test without exercising
// the real HMAC + chain lookup logic (covered by cryptoAudit.test.ts).
jest.mock('../../../modules/audit/cryptoAudit', () => ({
  signAuditEntry: jest.fn(),
}));

import { signAuditEntry as _signAuditEntry } from '../../../modules/audit/cryptoAudit';
import {
  writeChainedAudit,
  failureMarkerCollectionPath,
} from '../writeChainedAudit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signAuditEntry = _signAuditEntry as unknown as jest.MockedFunction<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (...args: any[]) => any
>;

interface FakeDocRef {
  id: string;
}

function makeFirestore(opts: { failMarker?: boolean }) {
  const markerCalls: Array<{ path: string; data: Record<string, unknown> }> = [];
  let counter = 0;

  const fakeDb = {
    collection: jest.fn((path: string) => ({
      add: jest.fn(async (data: Record<string, unknown>) => {
        if (opts.failMarker) {
          throw new Error('marker collection unavailable');
        }
        counter++;
        markerCalls.push({ path, data });
        return { id: `marker-${counter}` } as FakeDocRef;
      }),
    })),
  };

  return { fakeDb, markerCalls };
}

describe('failureMarkerCollectionPath', () => {
  it('derives sibling for multi-segment chain path', () => {
    expect(failureMarkerCollectionPath('/labs/abc/notas-fiscais')).toBe(
      'labs/abc/notas-fiscais-auditFailures',
    );
  });

  it('handles unrooted paths', () => {
    expect(failureMarkerCollectionPath('labs/abc/notas-fiscais')).toBe(
      'labs/abc/notas-fiscais-auditFailures',
    );
  });

  it('handles deeply nested chain paths', () => {
    expect(failureMarkerCollectionPath('/labs/x/y/audit')).toBe(
      'labs/x/y/audit-auditFailures',
    );
  });

  it('handles single-segment chain paths', () => {
    expect(failureMarkerCollectionPath('/foo')).toBe('foo-auditFailures');
  });

  it('throws on empty path', () => {
    expect(() => failureMarkerCollectionPath('/')).toThrow(/invalid chain path/);
  });
});

describe('writeChainedAudit', () => {
  const realSetTimeout = global.setTimeout;

  beforeEach(() => {
    jest
      .spyOn(global, 'setTimeout')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(((cb: () => void) => {
        cb();
        return 0;
      }) as any);
    signAuditEntry.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.setTimeout = realSetTimeout;
  });

  it('returns { ok: true, id } on first-attempt success', async () => {
    signAuditEntry.mockResolvedValueOnce({
      id: 'chain-1',
      collectionPath: '/labs/lab-1/notas-fiscais',
      timestamp: '__SERVER_TS__',
      operadorId: 'user-1',
      operation: 'notaFiscal.criada',
      payload: { numero: 'NF-1' },
      hmac: 'hmac-x',
      hash: 'hash-x',
      previousHash: null,
    });

    const { fakeDb } = makeFirestore({});
    const result = await writeChainedAudit(
      {
        collectionPath: '/labs/lab-1/notas-fiscais',
        operadorId: 'user-1',
        operation: 'notaFiscal.criada',
        payload: { numero: 'NF-1' },
        secret: 's3cr3t',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result).toEqual({ ok: true, id: 'chain-1' });
    expect(signAuditEntry).toHaveBeenCalledTimes(1);
    expect(fakeDb.collection).not.toHaveBeenCalled(); // no marker on success
  });

  it('retries on transient failure and succeeds on a later attempt', async () => {
    signAuditEntry
      .mockRejectedValueOnce(new Error('transient firestore unavailable'))
      .mockRejectedValueOnce(new Error('transient firestore unavailable'))
      .mockResolvedValueOnce({
        id: 'chain-2',
        collectionPath: '/labs/lab-1/notas-fiscais',
        timestamp: '__SERVER_TS__',
        operadorId: 'user-1',
        operation: 'notaFiscal.criada',
        payload: {},
        hmac: 'h',
        hash: 'hh',
        previousHash: null,
      });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { fakeDb } = makeFirestore({});

    const result = await writeChainedAudit(
      {
        collectionPath: '/labs/lab-1/notas-fiscais',
        operadorId: 'user-1',
        operation: 'notaFiscal.criada',
        payload: {},
        secret: 's',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toBe('chain-2');
    expect(signAuditEntry).toHaveBeenCalledTimes(3);
    expect(fakeDb.collection).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('writes sibling marker + emits console.error after exhausting retries', async () => {
    signAuditEntry.mockRejectedValue(new Error('chain write rejected'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { fakeDb, markerCalls } = makeFirestore({});

    const result = await writeChainedAudit(
      {
        collectionPath: '/labs/lab-42/notas-fiscais',
        operadorId: 'user-9',
        operation: 'notaFiscal.criada',
        payload: { numero: 'NF-42' },
        secret: 's',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/chain write rejected/);
    }
    expect(signAuditEntry).toHaveBeenCalledTimes(3);

    // Marker landed in the SIBLING collection — never in the chain target.
    expect(fakeDb.collection).toHaveBeenCalledWith(
      'labs/lab-42/notas-fiscais-auditFailures',
    );
    expect(fakeDb.collection).not.toHaveBeenCalledWith(
      '/labs/lab-42/notas-fiscais',
    );
    expect(markerCalls).toHaveLength(1);
    expect(markerCalls[0].path).toBe('labs/lab-42/notas-fiscais-auditFailures');
    expect(markerCalls[0].data).toMatchObject({
      chainCollectionPath: '/labs/lab-42/notas-fiscais',
      operation: 'notaFiscal.criada',
      operadorId: 'user-9',
      intendedPayload: { numero: 'NF-42' },
      attempts: 3,
    });
    expect(markerCalls[0].data.error).toContain('chain write rejected');

    expect(errorSpy).toHaveBeenCalledWith(
      '[writeChainedAudit] FAILED after retries',
      expect.objectContaining({
        collectionPath: '/labs/lab-42/notas-fiscais',
        operation: 'notaFiscal.criada',
        attempts: 3,
      }),
    );
  });

  it('does not throw when sibling marker write itself fails', async () => {
    signAuditEntry.mockRejectedValue(new Error('chain down'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { fakeDb } = makeFirestore({ failMarker: true });

    const result = await writeChainedAudit(
      {
        collectionPath: '/labs/lab-1/notas-fiscais',
        operadorId: 'user-1',
        operation: 'notaFiscal.criada',
        payload: {},
        secret: 's',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb as any,
    );

    expect(result.ok).toBe(false);
    expect(signAuditEntry).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledWith(
      '[writeChainedAudit] FAILED after retries',
      expect.any(Object),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[writeChainedAudit] CRITICAL: sibling marker write also failed',
      expect.any(Object),
    );
  });
});
