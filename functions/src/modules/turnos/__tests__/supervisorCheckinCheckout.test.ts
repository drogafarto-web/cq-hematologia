/**
 * supervisorCheckinCheckout.test.ts — Unit tests for turnos presence callables.
 *
 * RDC 978/2025 Art. 122 — supervisor presence enforcement primitive.
 * Covers happy path + unauthorized supervisor for both check-in and check-out.
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
import { turnos_supervisorCheckin } from '../supervisorCheckin';
import { turnos_supervisorCheckout } from '../supervisorCheckout';

const LAB_ID = 'lab-abc';
const TURNO_ID = 'turno-001';
const SUPERVISOR_UID = 'sup-1';
const OTHER_UID = 'sup-2';

function seedActiveMember(uid: string) {
  docStore.set(`labs/${LAB_ID}/members/${uid}`, {
    exists: true,
    data: () => ({ active: true }),
  });
}

// Use today's date so the supervisorCheckin window check (which calls
// real Date.now()) lands inside the plantao 00-24 window.
function todayIso(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function seedTurno(supervisorId: string) {
  docStore.set(`labs/${LAB_ID}/turnos/${TURNO_ID}`, {
    exists: true,
    data: () => ({
      labId: LAB_ID,
      data: todayIso(),
      periodo: 'plantao',
      supervisorId,
      deletadoEm: null,
    }),
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

function authedRequest(uid: string, data: unknown): CallableRequest<unknown> {
  return {
    auth: { uid, token: { modules: { turnos: true } } as any },
    data,
    rawRequest: {} as any,
    acceptsStreaming: false,
  } as unknown as CallableRequest<unknown>;
}

describe('turnos_supervisorCheckin', () => {
  beforeEach(() => {
    docStore.clear();
    eventsStore.clear();
    jest.clearAllMocks();
  });

  it('happy path — designated supervisor checks in, presença becomes active', async () => {
    seedActiveMember(SUPERVISOR_UID);
    seedTurno(SUPERVISOR_UID);
    seedColaborador(SUPERVISOR_UID, true);

    const result = await turnos_supervisorCheckin.run(
      authedRequest(SUPERVISOR_UID, {
        labId: LAB_ID,
        turnoId: TURNO_ID,
        supervisorUid: SUPERVISOR_UID,
      }),
    );

    expect(result).toEqual({
      ok: true,
      presencaStatus: 'active',
      isSubstitute: false,
    });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(mockBatch.set).toHaveBeenCalled();
  });

  it('unauthorized — non-designated supervisor without substitute designation is denied', async () => {
    seedActiveMember(OTHER_UID);
    seedTurno(SUPERVISOR_UID); // turno is for SUPERVISOR_UID
    seedColaborador(OTHER_UID, true);
    // No presença doc with substitute designation -> should reject

    await expect(
      turnos_supervisorCheckin.run(
        authedRequest(OTHER_UID, {
          labId: LAB_ID,
          turnoId: TURNO_ID,
          supervisorUid: OTHER_UID,
        }),
      ),
    ).rejects.toThrow(/Substituto não designado/);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});

describe('turnos_supervisorCheckout', () => {
  beforeEach(() => {
    docStore.clear();
    eventsStore.clear();
    jest.clearAllMocks();
  });

  function seedActivePresenca(supervisorUid: string) {
    docStore.set(`labs/${LAB_ID}/turnos/${TURNO_ID}/presenca/current`, {
      exists: true,
      data: () => ({
        status: 'active',
        supervisorAtivo: {
          uid: supervisorUid,
          nome: 'Sup Ativo',
          crbm: 'CRBM-1',
          isSubstitute: false,
        },
      }),
    });
  }

  it('happy path — supervisor who is checked-in closes the turno', async () => {
    seedActiveMember(SUPERVISOR_UID);
    seedActivePresenca(SUPERVISOR_UID);

    const result = await turnos_supervisorCheckout.run(
      authedRequest(SUPERVISOR_UID, {
        labId: LAB_ID,
        turnoId: TURNO_ID,
      }),
    );

    expect(result).toEqual({ ok: true, presencaStatus: 'closed' });
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
  });

  it('unauthorized — different user than the checked-in supervisor is denied', async () => {
    seedActiveMember(OTHER_UID);
    seedActivePresenca(SUPERVISOR_UID); // different uid is in

    await expect(
      turnos_supervisorCheckout.run(
        authedRequest(OTHER_UID, {
          labId: LAB_ID,
          turnoId: TURNO_ID,
        }),
      ),
    ).rejects.toThrow(/Apenas o supervisor que fez checkin/);
    expect(mockBatch.commit).not.toHaveBeenCalled();
  });
});
