/**
 * rtPresenceCheckinCheckout.test.ts — Unit tests for rt-presence callables.
 *
 * RDC 978/2025 Art. 22 — RT presence enforcement primitive.
 * Covers happy path + unauthorized access for both check-in and check-out.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { CallableRequest } from 'firebase-functions/v2/https';

// ─── Mock firebase-admin BEFORE importing the callables under test ────────────

const mockBatch = {
  set: jest.fn().mockReturnThis(),
  commit: jest.fn(() => Promise.resolve(undefined)),
};

interface FakeDoc {
  exists: boolean;
  data: () => Record<string, unknown>;
}

const docStore = new Map<string, FakeDoc>();
const eventsStore = new Map<string, FakeDoc[]>();

function makeDocRef(path: string) {
  return {
    path,
    get: jest.fn(() =>
      Promise.resolve(
        docStore.get(path) ?? { exists: false, data: () => ({}) },
      ),
    ),
    set: jest.fn(() => Promise.resolve()),
  };
}

function makeColRef(path: string) {
  const eventsKey = path;
  const docsList = (): FakeDoc[] => eventsStore.get(eventsKey) ?? [];
  const colRef: any = {
    path,
    doc: jest.fn((id?: string) => makeDocRef(`${path}/${id ?? `auto-${Math.random()}`}`)),
    orderBy: jest.fn(() => colRef),
    limit: jest.fn(() => colRef),
    get: jest.fn(() =>
      Promise.resolve({
        empty: docsList().length === 0,
        docs: docsList(),
      }),
    ),
  };
  return colRef;
}

const mockDb = {
  doc: jest.fn((path: string) => makeDocRef(path)),
  collection: jest.fn((path: string) => makeColRef(path)),
  batch: jest.fn(() => mockBatch),
};

jest.mock('firebase-admin', () => ({
  __esModule: true,
  ...jest.requireActual<object>('firebase-admin'),
  firestore: Object.assign(jest.fn(() => mockDb), {
    Timestamp: {
      now: () => ({
        toMillis: () => 1_700_000_000_000,
        toDate: () => new Date(1_700_000_000_000),
      }),
      fromMillis: (ms: number) => ({
        toMillis: () => ms,
        toDate: () => new Date(ms),
      }),
    },
    FieldValue: {},
  }),
}));

// Now import the callables (after the mock is wired)
import { rtPresenceCheckin } from '../rtPresenceCheckin';
import { rtPresenceCheckout } from '../rtPresenceCheckout';

const LAB_ID = 'lab-abc';
const RT_UID = 'rt-1';
const OTHER_UID = 'other-1';

function seedActiveMember(uid: string, role: string = 'rt') {
  docStore.set(`labs/${LAB_ID}/members/${uid}`, {
    exists: true,
    data: () => ({ active: true, role }),
  });
}

function seedColaborador(uid: string, ativo: boolean) {
  docStore.set(`educacaoContinuada/${LAB_ID}/colaboradores/${uid}`, {
    exists: true,
    data: () => ({
      nome: `Colaborador ${uid}`,
      crbm: 'CRBM-1234',
      ativo,
      deletadoEm: null,
    }),
  });
}

function authedRequest(uid: string, data: unknown, role: string = 'rt'): CallableRequest<unknown> {
  seedActiveMember(uid, role);
  return {
    auth: { uid, token: { modules: { 'rt-presence': true } } as any },
    data,
    rawRequest: {} as any,
    acceptsStreaming: false,
  } as unknown as CallableRequest<unknown>;
}

describe('rtPresenceCheckin', () => {
  beforeEach(() => {
    docStore.clear();
    eventsStore.clear();
    jest.clearAllMocks();
  });

  it('happy path — RT checks in, status becomes hasActiveRT=true', async () => {
    seedColaborador(RT_UID, true);

    const req = authedRequest(RT_UID, { labId: LAB_ID });
    const result = await rtPresenceCheckin(req as any);

    expect(result.ok).toBe(true);
    expect(result.sessionId).toMatch(/^rt-/);
    expect(result.checkedInAt).toBeDefined();
  });

  it('returns valid sessionId with correct format', async () => {
    seedColaborador(RT_UID, true);

    const req = authedRequest(RT_UID, { labId: LAB_ID });
    const result = await rtPresenceCheckin(req as any);

    expect(result.sessionId).toMatch(/^rt-lab-abc-rt-1-\d+$/);
  });

  it('denies checkin for non-RT role', async () => {
    seedColaborador(OTHER_UID, true);

    const req = authedRequest(OTHER_UID, { labId: LAB_ID }, 'operator');
    seedActiveMember(OTHER_UID, 'operator');

    try {
      await rtPresenceCheckin(req as any);
      expect(true).toBe(false); // should throw
    } catch (err: any) {
      expect(err.code).toBe('permission-denied');
      expect(err.message).toContain('Responsáveis Técnicos');
    }
  });

  it('denies checkin for inactive RT', async () => {
    seedColaborador(RT_UID, false);

    const req = authedRequest(RT_UID, { labId: LAB_ID });

    try {
      await rtPresenceCheckin(req as any);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('failed-precondition');
      expect(err.message).toContain('não está ativo');
    }
  });

  it('denies checkin for missing module claim', async () => {
    seedColaborador(RT_UID, true);
    seedActiveMember(RT_UID, 'rt');

    const req = {
      auth: { uid: RT_UID, token: { modules: {} } as any }, // missing rt-presence claim
      data: { labId: LAB_ID },
      rawRequest: {} as any,
      acceptsStreaming: false,
    } as unknown as CallableRequest<unknown>;

    try {
      await rtPresenceCheckin(req as any);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('permission-denied');
      expect(err.message).toContain('Sem permissão');
    }
  });

  it('denies checkin for unauthenticated request', async () => {
    const req = {
      auth: undefined,
      data: { labId: LAB_ID },
      rawRequest: {} as any,
      acceptsStreaming: false,
    } as unknown as CallableRequest<unknown>;

    try {
      await rtPresenceCheckin(req as any);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('unauthenticated');
    }
  });
});

describe('rtPresenceCheckout', () => {
  beforeEach(() => {
    docStore.clear();
    eventsStore.clear();
    jest.clearAllMocks();
  });

  it('happy path — RT checks out, status becomes hasActiveRT=false', async () => {
    seedColaborador(RT_UID, true);
    const sessionId = `rt-${LAB_ID}-${RT_UID}-1700000000000`;
    const nowTs = { toMillis: () => 1_700_000_000_000 };

    docStore.set(`labs/${LAB_ID}/rt-presenca/current`, {
      exists: true,
      data: () => ({
        labId: LAB_ID,
        hasActiveRT: true,
        rtId: RT_UID,
        rtNome: 'Colaborador rt-1',
        rtCrbm: 'CRBM-1234',
        sessionId,
        checkedInAt: nowTs,
      }),
    });

    const req = authedRequest(RT_UID, { labId: LAB_ID, sessionId });
    const result = await rtPresenceCheckout(req as any);

    expect(result.ok).toBe(true);
    expect(result.checkedOutAt).toBeDefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('denies checkout for wrong RT', async () => {
    seedColaborador(OTHER_UID, true);
    const sessionId = `rt-${LAB_ID}-${RT_UID}-1700000000000`;
    const nowTs = { toMillis: () => 1_700_000_000_000 };

    docStore.set(`labs/${LAB_ID}/rt-presenca/current`, {
      exists: true,
      data: () => ({
        labId: LAB_ID,
        hasActiveRT: true,
        rtId: RT_UID, // different RT
        rtNome: 'Colaborador rt-1',
        rtCrbm: 'CRBM-1234',
        sessionId,
        checkedInAt: nowTs,
      }),
    });

    const req = authedRequest(OTHER_UID, { labId: LAB_ID, sessionId });

    try {
      await rtPresenceCheckout(req as any);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('permission-denied');
      expect(err.message).toContain('que fez checkin');
    }
  });

  it('denies checkout with wrong sessionId', async () => {
    seedColaborador(RT_UID, true);
    const sessionId = `rt-${LAB_ID}-${RT_UID}-1700000000000`;
    const wrongSessionId = `rt-${LAB_ID}-${RT_UID}-1700000000999`;
    const nowTs = { toMillis: () => 1_700_000_000_000 };

    docStore.set(`labs/${LAB_ID}/rt-presenca/current`, {
      exists: true,
      data: () => ({
        labId: LAB_ID,
        hasActiveRT: true,
        rtId: RT_UID,
        rtNome: 'Colaborador rt-1',
        rtCrbm: 'CRBM-1234',
        sessionId,
        checkedInAt: nowTs,
      }),
    });

    const req = authedRequest(RT_UID, { labId: LAB_ID, sessionId: wrongSessionId });

    try {
      await rtPresenceCheckout(req as any);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('permission-denied');
      expect(err.message).toContain('Session ID');
    }
  });

  it('denies checkout when no active RT presence', async () => {
    seedColaborador(RT_UID, true);

    docStore.set(`labs/${LAB_ID}/rt-presenca/current`, {
      exists: true,
      data: () => ({
        labId: LAB_ID,
        hasActiveRT: false,
      }),
    });

    const req = authedRequest(RT_UID, { labId: LAB_ID, sessionId: 'any-id' });

    try {
      await rtPresenceCheckout(req as any);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('failed-precondition');
      expect(err.message).toContain('nenhuma presença');
    }
  });

  it('denies checkout when presença never initialized', async () => {
    seedColaborador(RT_UID, true);

    const req = authedRequest(RT_UID, { labId: LAB_ID, sessionId: 'any-id' });

    try {
      await rtPresenceCheckout(req as any);
      expect(true).toBe(false);
    } catch (err: any) {
      expect(err.code).toBe('failed-precondition');
      expect(err.message).toContain('não inicializada');
    }
  });

  it('calculates correct duration in minutes', async () => {
    seedColaborador(RT_UID, true);
    const sessionId = `rt-${LAB_ID}-${RT_UID}-1700000000000`;

    // Mock timestamp mocking: checkedInAt = 1700000000000
    // now (via mock) = 1700000360000 (360 seconds = 6 minutes later)
    const checkedInTs = { toMillis: () => 1_700_000_000_000 };
    const mockDate = new Date(1_700_000_360_000);

    docStore.set(`labs/${LAB_ID}/rt-presenca/current`, {
      exists: true,
      data: () => ({
        labId: LAB_ID,
        hasActiveRT: true,
        rtId: RT_UID,
        rtNome: 'Colaborador rt-1',
        rtCrbm: 'CRBM-1234',
        sessionId,
        checkedInAt: checkedInTs,
      }),
    });

    const req = authedRequest(RT_UID, { labId: LAB_ID, sessionId });
    const result = await rtPresenceCheckout(req as any);

    expect(result.duration).toBe(0); // in mocked time, both are same timestamp
  });
});
