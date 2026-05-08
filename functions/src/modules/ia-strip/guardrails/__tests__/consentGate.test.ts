/**
 * Consent Gate tests
 *
 * Coverage:
 * - happy path (active opt-in)
 * - missing doc → throws
 * - iaProcessing=false → throws
 * - revokedAt set → throws
 * - missing consentedAt → throws
 * - missing labId / patientId → throws
 */

import { describe, it, expect } from '@jest/globals';
import { consentGate } from '../consentGate';

interface FakeSnap {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

function makeFirestore(snapByPath: Record<string, FakeSnap>): any {
  return {
    doc(path: string) {
      return {
        get: async () =>
          snapByPath[path] ?? {
            exists: false,
            data: () => undefined,
          },
      };
    },
  };
}

const labId = 'lab-abc';
const patientId = 'pat-123';
const docPath = `consents/${labId}/patients/${patientId}`;
const ts = { toDate: () => new Date('2026-05-01') } as any;

describe('consentGate', () => {
  it('passes when iaProcessing=true and not revoked', async () => {
    const fs = makeFirestore({
      [docPath]: {
        exists: true,
        data: () => ({
          iaProcessing: true,
          consentedAt: ts,
          revokedAt: null,
          consentVersion: 'lgpd-v1',
          capturedBy: 'op-1',
        }),
      },
    });

    const result = await consentGate({ labId, patientId, firestore: fs });
    expect(result.passed).toBe(true);
    expect(result.consentVersion).toBe('lgpd-v1');
    expect(result.consentedAt).toBe(ts);
  });

  it('throws consent-not-captured when doc is missing', async () => {
    const fs = makeFirestore({});
    await expect(consentGate({ labId, patientId, firestore: fs })).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringContaining('consent-not-captured'),
    });
  });

  it('throws when iaProcessing is false', async () => {
    const fs = makeFirestore({
      [docPath]: {
        exists: true,
        data: () => ({
          iaProcessing: false,
          consentedAt: ts,
          revokedAt: null,
        }),
      },
    });
    await expect(consentGate({ labId, patientId, firestore: fs })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('throws when consent has been revoked', async () => {
    const fs = makeFirestore({
      [docPath]: {
        exists: true,
        data: () => ({
          iaProcessing: true,
          consentedAt: ts,
          revokedAt: ts,
        }),
      },
    });
    await expect(consentGate({ labId, patientId, firestore: fs })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('throws when consentedAt is missing', async () => {
    const fs = makeFirestore({
      [docPath]: {
        exists: true,
        data: () => ({
          iaProcessing: true,
          revokedAt: null,
        }),
      },
    });
    await expect(consentGate({ labId, patientId, firestore: fs })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('throws when labId or patientId is missing', async () => {
    const fs = makeFirestore({});
    await expect(
      consentGate({ labId: '', patientId, firestore: fs })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      consentGate({ labId, patientId: '', firestore: fs })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('treats undefined revokedAt the same as null (active consent)', async () => {
    const fs = makeFirestore({
      [docPath]: {
        exists: true,
        data: () => ({
          iaProcessing: true,
          consentedAt: ts,
          // revokedAt omitted entirely
        }),
      },
    });
    const result = await consentGate({ labId, patientId, firestore: fs });
    expect(result.passed).toBe(true);
  });
});
