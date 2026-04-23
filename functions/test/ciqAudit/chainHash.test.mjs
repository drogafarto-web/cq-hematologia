/**
 * Testes unitários do hash chain do ciq-audit writer (Onda 4).
 *
 * Como o writer depende de admin.firestore, uso um stub mínimo que emula
 * transação + doc.get/set para exercitar a lógica de chain pura sem subir
 * emulador.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = path.resolve(__dirname, '..', '..');

const { writeCIQAuditEvent } = await import(
  pathToFileURL(
    path.join(FUNCTIONS_DIR, 'lib/modules/ciqAudit/writer.js'),
  ).href
);

const { genesisHash } = await import(
  pathToFileURL(
    path.join(FUNCTIONS_DIR, 'lib/modules/ciqAudit/genesis.js'),
  ).href
);

// ─── Firestore stub ──────────────────────────────────────────────────────────

function makeStubDb() {
  const store = new Map(); // path → data

  const makeDocRef = (p) => ({
    path: p,
    get: async () => ({
      exists: store.has(p),
      data: () => store.get(p),
      id: p.split('/').pop(),
      ref: { path: p },
    }),
  });

  const db = {
    doc: (p) => makeDocRef(p),
    runTransaction: async (fn) => {
      // Transaction stub — implementa get/set/update síncronos em cima do Map
      const tx = {
        get: async (ref) => ({
          exists: store.has(ref.path),
          data: () => store.get(ref.path),
          id: ref.path.split('/').pop(),
          ref,
        }),
        set: (ref, data, opts) => {
          if (opts?.merge) {
            const existing = store.get(ref.path) ?? {};
            store.set(ref.path, { ...existing, ...data });
          } else {
            store.set(ref.path, data);
          }
        },
        update: (ref, data) => {
          const existing = store.get(ref.path) ?? {};
          store.set(ref.path, { ...existing, ...data });
        },
      };
      return fn(tx);
    },
    _store: store,
  };
  return db;
}

function baseInput(overrides = {}) {
  return {
    labId: 'lab-test',
    moduleId: 'hematologia',
    action: 'CREATE_RUN',
    entityType: 'run',
    entityId: 'run-1',
    actorUid: 'uid-1',
    actorName: 'Ana',
    actorRole: 'operador',
    severity: 'info',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('primeiro evento usa genesisHash(labId) como previousHash', async () => {
  const db = makeStubDb();
  const event = await writeCIQAuditEvent(db, baseInput({ eventId: 'e1' }));
  assert.strictEqual(event.previousHash, genesisHash('lab-test'));
  // chainHash = sha256(genesis + contentHash)
  const expected = createHash('sha256')
    .update(event.previousHash + event.contentHash)
    .digest('hex');
  assert.strictEqual(event.chainHash, expected);
});

test('segundo evento usa chainHash do primeiro como previousHash', async () => {
  const db = makeStubDb();
  const e1 = await writeCIQAuditEvent(db, baseInput({ eventId: 'e1' }));
  const e2 = await writeCIQAuditEvent(
    db,
    baseInput({ eventId: 'e2', action: 'APPROVE_RUN' }),
  );
  assert.strictEqual(e2.previousHash, e1.chainHash);
});

test('cadeia de 20 eventos tem chain válida ponta-a-ponta', async () => {
  const db = makeStubDb();
  let prev = genesisHash('lab-test');
  for (let i = 0; i < 20; i++) {
    const e = await writeCIQAuditEvent(
      db,
      baseInput({
        eventId: `e${i}`,
        action: i === 0 ? 'CREATE_RUN' : 'APPROVE_RUN',
        entityId: `run-${i}`,
      }),
    );
    assert.strictEqual(e.previousHash, prev, `evento ${i} previousHash errado`);
    const expectedChain = createHash('sha256')
      .update(prev + e.contentHash)
      .digest('hex');
    assert.strictEqual(e.chainHash, expectedChain, `evento ${i} chainHash errado`);
    prev = e.chainHash;
  }
});

test('idempotência: reescrever mesmo eventId retorna evento sem mutar cadeia', async () => {
  const db = makeStubDb();
  const e1 = await writeCIQAuditEvent(db, baseInput({ eventId: 'dup' }));
  const e2 = await writeCIQAuditEvent(db, baseInput({ eventId: 'dup' }));
  assert.strictEqual(e1.chainHash, e2.chainHash);
  // Apenas UM doc criado
  const paths = Array.from(db._store.keys()).filter((p) =>
    p.includes('/ciq-audit/'),
  );
  assert.strictEqual(paths.length, 1);
});

test('ação crítica sem reason lança erro', async () => {
  const db = makeStubDb();
  await assert.rejects(
    writeCIQAuditEvent(
      db,
      baseInput({
        eventId: 'e-crit',
        action: 'REOPEN_RUN',
        severity: 'critical',
        // reason ausente
      }),
    ),
    /é crítica e exige reason/u,
  );
});

test('ação crítica com reason aceita', async () => {
  const db = makeStubDb();
  const e = await writeCIQAuditEvent(
    db,
    baseInput({
      eventId: 'e-crit-ok',
      action: 'REOPEN_RUN',
      severity: 'critical',
      reason: 'Erro de digitação no HGB detectado após aprovação',
    }),
  );
  assert.strictEqual(e.action, 'REOPEN_RUN');
  assert.strictEqual(e.reason, 'Erro de digitação no HGB detectado após aprovação');
});

test('labs diferentes têm chains independentes', async () => {
  const db = makeStubDb();
  const labA = await writeCIQAuditEvent(db, baseInput({ eventId: 'a1', labId: 'lab-A' }));
  const labB = await writeCIQAuditEvent(db, baseInput({ eventId: 'b1', labId: 'lab-B' }));
  assert.strictEqual(labA.previousHash, genesisHash('lab-A'));
  assert.strictEqual(labB.previousHash, genesisHash('lab-B'));
  assert.notStrictEqual(labA.chainHash, labB.chainHash);
});
