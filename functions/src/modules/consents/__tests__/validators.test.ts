/**
 * Tests for consents/validators
 *
 * Coverage:
 *   - assertConsentsWriteAccess
 *       · happy path (active member)
 *       · throws unauthenticated when no auth context
 *       · throws invalid-argument on missing labId
 *       · throws permission-denied when member doc absent
 *       · throws permission-denied when member exists but inactive
 *   - RecordConsentInputSchema
 *       · accepts minimal payload (defaults scope to ['ia-strip'])
 *       · rejects missing labId / patientId / consentVersion
 *       · rejects empty scope array
 *       · accepts merged scope (multi-purpose)
 *   - RevokeConsentInputSchema
 *       · accepts minimal payload
 *       · rejects missing labId / patientId
 *       · accepts optional reason up to 500 chars; rejects beyond
 */

import { describe, it, expect, jest } from '@jest/globals';

// Mock firebase-admin BEFORE importing validators (admin.firestore() is touched).
jest.mock('firebase-admin', () => {
  const FieldValue = { serverTimestamp: jest.fn(() => '__SERVER_TS__') };
  return {
    firestore: Object.assign(jest.fn(), { FieldValue }),
  };
});

import {
  assertConsentsWriteAccess,
  RecordConsentInputSchema,
  RevokeConsentInputSchema,
} from '../validators';

interface FakeSnap {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
}

function makeFirestore(snapByPath: Record<string, FakeSnap>): any {
  return {
    doc(path: string) {
      return {
        get: async () =>
          snapByPath[path] ?? { exists: false, data: () => undefined },
      };
    },
  };
}

const labId = 'lab-abc';
const uid = 'op-123';
const memberPath = `labs/${labId}/members/${uid}`;

describe('assertConsentsWriteAccess', () => {
  it('returns uid when member is active', async () => {
    const fs = makeFirestore({
      [memberPath]: { exists: true, data: () => ({ active: true, role: 'tecnico' }) },
    });
    const result = await assertConsentsWriteAccess({ uid }, labId, fs);
    expect(result.uid).toBe(uid);
  });

  it('throws unauthenticated when auth is undefined', async () => {
    const fs = makeFirestore({});
    await expect(
      assertConsentsWriteAccess(undefined, labId, fs),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('throws invalid-argument when labId is missing', async () => {
    const fs = makeFirestore({});
    await expect(
      assertConsentsWriteAccess({ uid }, '' as any, fs),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('throws permission-denied when member doc is absent', async () => {
    const fs = makeFirestore({});
    await expect(
      assertConsentsWriteAccess({ uid }, labId, fs),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('throws permission-denied when member exists but is inactive', async () => {
    const fs = makeFirestore({
      [memberPath]: { exists: true, data: () => ({ active: false }) },
    });
    await expect(
      assertConsentsWriteAccess({ uid }, labId, fs),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('throws permission-denied when caller belongs to a different lab', async () => {
    // Member doc only exists under another labId; lookup against `labId` returns nothing.
    const fs = makeFirestore({
      [`labs/other-lab/members/${uid}`]: {
        exists: true,
        data: () => ({ active: true }),
      },
    });
    await expect(
      assertConsentsWriteAccess({ uid }, labId, fs),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('RecordConsentInputSchema', () => {
  it('accepts minimal payload and defaults scope to ["ia-strip"]', () => {
    const parsed = RecordConsentInputSchema.parse({
      labId,
      patientId: 'pat-1',
      consentVersion: 'lgpd-v1',
    });
    expect(parsed.scope).toEqual(['ia-strip']);
    expect(parsed.capturedBy).toBeUndefined();
  });

  it('accepts explicit scope union', () => {
    const parsed = RecordConsentInputSchema.parse({
      labId,
      patientId: 'pat-1',
      consentVersion: 'lgpd-v1',
      scope: ['ia-strip', 'ia-laudo'],
    });
    expect(parsed.scope).toEqual(['ia-strip', 'ia-laudo']);
  });

  it('rejects missing labId', () => {
    expect(() =>
      RecordConsentInputSchema.parse({
        patientId: 'pat-1',
        consentVersion: 'lgpd-v1',
      }),
    ).toThrow();
  });

  it('rejects missing patientId', () => {
    expect(() =>
      RecordConsentInputSchema.parse({
        labId,
        consentVersion: 'lgpd-v1',
      }),
    ).toThrow();
  });

  it('rejects missing consentVersion', () => {
    expect(() =>
      RecordConsentInputSchema.parse({ labId, patientId: 'pat-1' }),
    ).toThrow();
  });

  it('rejects empty scope array', () => {
    expect(() =>
      RecordConsentInputSchema.parse({
        labId,
        patientId: 'pat-1',
        consentVersion: 'lgpd-v1',
        scope: [],
      }),
    ).toThrow();
  });

  it('rejects unknown scope values', () => {
    expect(() =>
      RecordConsentInputSchema.parse({
        labId,
        patientId: 'pat-1',
        consentVersion: 'lgpd-v1',
        scope: ['marketing'],
      }),
    ).toThrow();
  });

  it('rejects consentVersion with disallowed characters', () => {
    expect(() =>
      RecordConsentInputSchema.parse({
        labId,
        patientId: 'pat-1',
        consentVersion: 'lgpd v1', // space disallowed
      }),
    ).toThrow();
  });
});

describe('RevokeConsentInputSchema', () => {
  it('accepts minimal payload', () => {
    const parsed = RevokeConsentInputSchema.parse({
      labId,
      patientId: 'pat-1',
    });
    expect(parsed.reason).toBeUndefined();
  });

  it('accepts optional reason', () => {
    const parsed = RevokeConsentInputSchema.parse({
      labId,
      patientId: 'pat-1',
      reason: 'paciente solicitou',
    });
    expect(parsed.reason).toBe('paciente solicitou');
  });

  it('rejects missing labId', () => {
    expect(() =>
      RevokeConsentInputSchema.parse({ patientId: 'pat-1' }),
    ).toThrow();
  });

  it('rejects missing patientId', () => {
    expect(() => RevokeConsentInputSchema.parse({ labId })).toThrow();
  });

  it('rejects reason longer than 500 chars', () => {
    expect(() =>
      RevokeConsentInputSchema.parse({
        labId,
        patientId: 'pat-1',
        reason: 'x'.repeat(501),
      }),
    ).toThrow();
  });
});
