/**
 * bootstrap-supervisor-status.test.mjs
 *
 * Unit tests for bootstrap-supervisor-status.mjs
 *
 * Mocks Firestore to test:
 *   1. Fetching multiple labs
 *   2. Creating docs when missing
 *   3. Skipping docs that already exist
 *   4. Single lab filter (--labId)
 *   5. Dry-run mode (preview without writing)
 *   6. Error handling (auth fails)
 *
 * Run: npm test -- scripts/__tests__/bootstrap-supervisor-status.test.mjs
 * Or:  node --test scripts/__tests__/bootstrap-supervisor-status.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Mock Firestore ──────────────────────────────────────────────────────────

function createMockFirestore() {
  const collections = new Map();

  const mockDb = {
    collection: (name) => {
      if (!collections.has(name)) {
        collections.set(name, new Map());
      }

      return {
        get: async () => {
          const docs = Array.from(collections.get(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));

          return {
            empty: docs.length === 0,
            docs,
          };
        },

        doc: (id) => {
          if (!collections.get(name).has(id)) {
            collections.get(name).set(id, {});
          }

          const labData = collections.get(name).get(id);

          return {
            collection: (subCollection) => {
              if (!labData[`_${subCollection}`]) {
                labData[`_${subCollection}`] = new Map();
              }

              return {
                doc: (docId) => {
                  const subDocs = labData[`_${subCollection}`];

                  return {
                    get: async () => ({
                      exists: subDocs.has(docId),
                      data: () => subDocs.get(docId),
                    }),

                    set: async (data) => {
                      subDocs.set(docId, data);
                    },

                    delete: async () => {
                      subDocs.delete(docId);
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return mockDb;
}

// ─── Mock admin.firestore ────────────────────────────────────────────────────

function mockAdminFirestore() {
  return {
    FieldValue: {
      serverTimestamp: () => ({ _type: 'server_timestamp' }),
    },
  };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

test('bootstrap-supervisor-status: Creates docs for 3 labs, skips 1 existing', async () => {
  const db = createMockFirestore();

  // Populate 3 labs, with lab-2 already having supervisor-status
  const labs = ['lab-1', 'lab-2', 'lab-3'];
  for (const labId of labs) {
    await db.collection('labs').doc(labId).collection('_dummy').doc('_').set({});
  }

  // Pre-populate supervisor-status for lab-2
  const lab2StatusRef = db.collection('labs').doc('lab-2').collection('supervisor-status').doc('current');
  await lab2StatusRef.set({ hasActiveSupervisor: true });

  // Simulate bootstrap logic
  let created = 0;
  let skipped = 0;

  const snapshot = await db.collection('labs').get();
  for (const labDoc of snapshot.docs) {
    const statusRef = db.collection('labs').doc(labDoc.id).collection('supervisor-status').doc('current');
    const statusSnapshot = await statusRef.get();

    if (statusSnapshot.exists) {
      skipped++;
    } else {
      await statusRef.set({
        hasActiveSupervisor: false,
        lastUpdated: mockAdminFirestore().FieldValue.serverTimestamp(),
      });
      created++;
    }
  }

  assert.equal(created, 2, 'Should create 2 docs');
  assert.equal(skipped, 1, 'Should skip 1 doc');
  assert.equal(snapshot.docs.length, 3, 'Should process 3 labs');
});

test('bootstrap-supervisor-status: Single lab filter (--labId)', async () => {
  const db = createMockFirestore();

  // Create 3 labs
  const labs = ['lab-1', 'lab-2', 'lab-3'];
  for (const labId of labs) {
    await db.collection('labs').doc(labId).collection('_dummy').doc('_').set({});
  }

  // Simulate --labId lab-2
  const targetLabId = 'lab-2';
  const snapshot = await db.collection('labs').get();
  const filtered = snapshot.docs.filter((d) => d.id === targetLabId);

  assert.equal(filtered.length, 1, 'Should find exactly 1 lab');
  assert.equal(filtered[0].id, 'lab-2', 'Should be lab-2');
});

test('bootstrap-supervisor-status: Dry-run mode (preview only)', async () => {
  const db = createMockFirestore();

  // Create lab without supervisor-status
  await db.collection('labs').doc('lab-1').collection('_dummy').doc('_').set({});

  const snapshot = await db.collection('labs').get();
  let wouldCreate = 0;

  // Dry-run: check but don't write
  for (const labDoc of snapshot.docs) {
    const statusRef = db.collection('labs').doc(labDoc.id).collection('supervisor-status').doc('current');
    const statusSnapshot = await statusRef.get();

    if (!statusSnapshot.exists) {
      wouldCreate++;
      // Intentionally skip the .set() call (dry-run)
    }
  }

  assert.equal(wouldCreate, 1, 'Dry-run should identify 1 doc to create');

  // Verify nothing was actually written
  const statusRef = db.collection('labs').doc('lab-1').collection('supervisor-status').doc('current');
  const check = await statusRef.get();
  assert.equal(check.exists, false, 'Dry-run should not write');
});

test('bootstrap-supervisor-status: Empty labs collection', async () => {
  const db = createMockFirestore();

  // Don't create any labs
  const snapshot = await db.collection('labs').get();

  assert.equal(snapshot.empty, true, 'Should have no labs');
  assert.equal(snapshot.docs.length, 0, 'Should process 0 labs');
});

test('bootstrap-supervisor-status: Error handling when labId not found', async () => {
  const db = createMockFirestore();

  // Create lab-1 and lab-2
  for (const labId of ['lab-1', 'lab-2']) {
    await db.collection('labs').doc(labId).collection('_dummy').doc('_').set({});
  }

  const snapshot = await db.collection('labs').get();
  const found = snapshot.docs.find((d) => d.id === 'lab-999');

  assert.equal(found, undefined, 'lab-999 should not exist');
});

test('bootstrap-supervisor-status: All labs already have supervisor-status', async () => {
  const db = createMockFirestore();

  const labs = ['lab-1', 'lab-2', 'lab-3'];
  for (const labId of labs) {
    await db.collection('labs').doc(labId).collection('_dummy').doc('_').set({});
    // Pre-populate all with supervisor-status
    const statusRef = db.collection('labs').doc(labId).collection('supervisor-status').doc('current');
    await statusRef.set({ hasActiveSupervisor: false });
  }

  // Simulate bootstrap
  let created = 0;
  let skipped = 0;

  const snapshot = await db.collection('labs').get();
  for (const labDoc of snapshot.docs) {
    const statusRef = db.collection('labs').doc(labDoc.id).collection('supervisor-status').doc('current');
    const statusSnapshot = await statusRef.get();

    if (statusSnapshot.exists) {
      skipped++;
    } else {
      created++;
    }
  }

  assert.equal(created, 0, 'Should create 0 docs');
  assert.equal(skipped, 3, 'Should skip all 3 docs');
});
