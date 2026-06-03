# Firestore Rules Testing — Example Patterns

**Real examples for testing multi-tenant isolation, RBAC, soft delete, and pessimistic locks.**

---

## Test File Structure

Create `__tests__/firestore.rules.test.ts`:

```typescript
import { initializeFirestore, connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import {
  initializeAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

describe('Firestore Rules — Phase 3', () => {
  // Setup
  let db: Firestore;
  let auth: Auth;
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: 'hmatologia2',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  // ────────────────────────────────────────────────────────────────
  // Suite 1: Multi-tenant Isolation
  // ────────────────────────────────────────────────────────────────

  describe('Multi-tenant Isolation — /labs/{labId}', () => {
    beforeEach(async () => {
      // Create two labs
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();

        // Lab A
        await db.collection('labs').doc('TENANT-A').set({
          id: 'TENANT-A',
          nome: 'Lab A',
          criadoEm: new Date(),
          deletadoEm: null,
        });

        // Lab A members
        await db.collection('labs').doc('TENANT-A').collection('members').doc('user-a').set({
          id: 'user-a',
          active: true,
          role: 'admin',
        });

        // Lab B
        await db.collection('labs').doc('TENANT-B').set({
          id: 'TENANT-B',
          nome: 'Lab B',
          criadoEm: new Date(),
          deletadoEm: null,
        });

        // Lab B members
        await db.collection('labs').doc('TENANT-B').collection('members').doc('user-b').set({
          id: 'user-b',
          active: true,
          role: 'admin',
        });
      });
    });

    it('should allow read of own lab data', async () => {
      const db = env
        .authenticatedContext('user-a', {
          labIds: ['TENANT-A'],
          modules: { hub: true },
        })
        .firestore();

      const docRef = db.collection('labs').doc('TENANT-A');
      await assertSucceeds(docRef.get());
    });

    it('should DENY read of other lab data', async () => {
      const db = env
        .authenticatedContext('user-a', {
          labIds: ['TENANT-A'],
          modules: { hub: true },
        })
        .firestore();

      const docRef = db.collection('labs').doc('TENANT-B');
      await assertFails(docRef.get());
    });

    it('should DENY write to other lab subcollection', async () => {
      const db = env
        .authenticatedContext('user-a', {
          labIds: ['TENANT-A'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('TENANT-B').collection('runs').doc('run-1');
      await assertFails(
        runRef.set({
          labId: 'TENANT-B',
          testType: 'coagulacao',
          criadoEm: new Date(),
        }),
      );
    });

    it('should enforce labId match in payload', async () => {
      const db = env
        .authenticatedContext('user-a', {
          labIds: ['TENANT-A'],
          modules: { runs: true },
        })
        .firestore();

      // Try to write with mismatched labId
      const runRef = db.collection('labs').doc('TENANT-A').collection('runs').doc('run-1');
      await assertFails(
        runRef.set({
          labId: 'TENANT-B', // ← Mismatch! Should fail
          testType: 'coagulacao',
          criadoEm: new Date(),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Suite 2: RBAC — Role-Based Access Control
  // ────────────────────────────────────────────────────────────────

  describe('RBAC — Role-Based Access Control', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();

        // Create lab
        await db.collection('labs').doc('LAB-RBAC').set({
          id: 'LAB-RBAC',
          nome: 'RBAC Test Lab',
          criadoEm: new Date(),
          deletadoEm: null,
        });

        // Admin user
        await db.collection('labs').doc('LAB-RBAC').collection('members').doc('admin-user').set({
          id: 'admin-user',
          active: true,
          role: 'admin',
        });

        // Operator user
        await db.collection('labs').doc('LAB-RBAC').collection('members').doc('operator-user').set({
          id: 'operator-user',
          active: true,
          role: 'operador',
        });

        // Patient user
        await db.collection('labs').doc('LAB-RBAC').collection('members').doc('patient-user').set({
          id: 'patient-user',
          active: true,
          role: 'patient',
        });
      });
    });

    it('should allow admin to update lab settings', async () => {
      const db = env
        .authenticatedContext('admin-user', {
          labIds: ['LAB-RBAC'],
          modules: { labSettings: true },
        })
        .firestore();

      const configRef = db.collection('labs').doc('LAB-RBAC').collection('config').doc('main');
      await assertSucceeds(configRef.set({ labId: 'LAB-RBAC', setting: 'value' }, { merge: true }));
    });

    it('should DENY operator from updating lab settings', async () => {
      const db = env
        .authenticatedContext('operator-user', {
          labIds: ['LAB-RBAC'],
          modules: { labSettings: true },
        })
        .firestore();

      const configRef = db.collection('labs').doc('LAB-RBAC').collection('config').doc('main');
      await assertFails(configRef.set({ labId: 'LAB-RBAC', setting: 'value' }, { merge: true }));
    });

    it('should DENY patient from creating runs', async () => {
      const db = env
        .authenticatedContext('patient-user', {
          labIds: ['LAB-RBAC'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-RBAC').collection('runs').doc('run-1');
      await assertFails(
        runRef.set({
          labId: 'LAB-RBAC',
          testType: 'coagulacao',
          criadoEm: new Date(),
        }),
      );
    });

    it('should allow patient to read results', async () => {
      // Setup: create result with rules disabled
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await db.collection('labs').doc('LAB-RBAC').collection('runs').doc('run-1').set({
          labId: 'LAB-RBAC',
          testType: 'coagulacao',
          resultado: 12.5,
          criadoEm: new Date(),
        });
      });

      // Patient reads
      const db = env
        .authenticatedContext('patient-user', {
          labIds: ['LAB-RBAC'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-RBAC').collection('runs').doc('run-1');
      await assertSucceeds(runRef.get());
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Suite 3: Soft Delete
  // ────────────────────────────────────────────────────────────────

  describe('Soft Delete — deletadoEm Filtering', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();

        // Active run
        await db.collection('labs').doc('LAB-DEL').collection('runs').doc('run-active').set({
          labId: 'LAB-DEL',
          testType: 'coagulacao',
          criadoEm: new Date(),
          deletadoEm: null,
        });

        // Soft-deleted run
        await db
          .collection('labs')
          .doc('LAB-DEL')
          .collection('runs')
          .doc('run-deleted')
          .set({
            labId: 'LAB-DEL',
            testType: 'coagulacao',
            criadoEm: new Date(Date.now() - 86400000),
            deletadoEm: new Date(),
          });
      });
    });

    it('should allow read of active runs (deletadoEm == null)', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-DEL'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-DEL').collection('runs').doc('run-active');
      await assertSucceeds(runRef.get());
    });

    it('should NOT filter soft-deleted runs at rules level (client responsibility)', async () => {
      // Rules don't hide soft-deleted docs — client filters them
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-DEL'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-DEL').collection('runs').doc('run-deleted');
      // This succeeds at rules level; client filters in app logic
      await assertSucceeds(runRef.get());
    });

    it('should allow admin to update deletadoEm for soft delete', async () => {
      const db = env
        .authenticatedContext('admin-user', {
          labIds: ['LAB-DEL'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-DEL').collection('runs').doc('run-active');
      await assertSucceeds(runRef.update({ deletadoEm: new Date() }));
    });

    it('should DENY hard delete', async () => {
      const db = env
        .authenticatedContext('admin-user', {
          labIds: ['LAB-DEL'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-DEL').collection('runs').doc('run-active');
      await assertFails(runRef.delete());
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Suite 4: Pessimistic Locks (Draft Editing)
  // ────────────────────────────────────────────────────────────────

  describe('Pessimistic Locks — Draft Document Editing', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();

        // Unlocked draft
        await db.collection('labs').doc('LAB-LOCK').collection('drafts').doc('draft-1').set({
          labId: 'LAB-LOCK',
          titulo: 'Draft 1',
          conteudo: 'Initial content',
          locked_by: null,
          locked_until_ts: null,
          criadoEm: new Date(),
        });

        // Locked draft (locked by user-a until far future)
        const futureTimestamp = new Date(Date.now() + 3600000); // 1 hour from now
        await db.collection('labs').doc('LAB-LOCK').collection('drafts').doc('draft-2').set({
          labId: 'LAB-LOCK',
          titulo: 'Draft 2 (Locked)',
          conteudo: 'Locked content',
          locked_by: 'user-a',
          locked_until_ts: futureTimestamp,
          criadoEm: new Date(),
        });
      });
    });

    it('should allow edit of unlocked draft', async () => {
      const db = env
        .authenticatedContext('user-b', {
          labIds: ['LAB-LOCK'],
          modules: { laudos: true },
        })
        .firestore();

      const draftRef = db.collection('labs').doc('LAB-LOCK').collection('drafts').doc('draft-1');
      await assertSucceeds(draftRef.update({ conteudo: 'Updated by user-b' }));
    });

    it('should DENY edit of draft locked by another user', async () => {
      const db = env
        .authenticatedContext('user-b', {
          labIds: ['LAB-LOCK'],
          modules: { laudos: true },
        })
        .firestore();

      const draftRef = db.collection('labs').doc('LAB-LOCK').collection('drafts').doc('draft-2');
      await assertFails(draftRef.update({ conteudo: 'User-b tries to edit locked draft' }));
    });

    it('should allow edit of draft locked by SAME user', async () => {
      const db = env
        .authenticatedContext('user-a', {
          labIds: ['LAB-LOCK'],
          modules: { laudos: true },
        })
        .firestore();

      const draftRef = db.collection('labs').doc('LAB-LOCK').collection('drafts').doc('draft-2');
      await assertSucceeds(draftRef.update({ conteudo: 'User-a updates their own lock' }));
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Suite 5: Signature Validation (Regulatory)
  // ────────────────────────────────────────────────────────────────

  describe('Signature Validation — assinatura Block', () => {
    it('should DENY create run without signature', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-SIG'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-SIG').collection('runs').doc('run-1');
      await assertFails(
        runRef.set({
          labId: 'LAB-SIG',
          testType: 'coagulacao',
          // Missing assinatura block
          criadoEm: new Date(),
        }),
      );
    });

    it('should DENY signature with invalid hash length', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-SIG'],
          modules: { runs: true },
        })
        .firestore();

      const runRef = db.collection('labs').doc('LAB-SIG').collection('runs').doc('run-1');
      await assertFails(
        runRef.set({
          labId: 'LAB-SIG',
          testType: 'coagulacao',
          assinatura: {
            hash: 'too-short', // ← Not 64 chars!
            operatorId: 'user-1',
            ts: new Date(),
          },
          criadoEm: new Date(),
        }),
      );
    });

    it('should DENY signature with mismatched operatorId', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-SIG'],
          modules: { runs: true },
        })
        .firestore();

      const validHash = 'a'.repeat(64); // Valid 64-char hash
      const runRef = db.collection('labs').doc('LAB-SIG').collection('runs').doc('run-1');
      await assertFails(
        runRef.set({
          labId: 'LAB-SIG',
          testType: 'coagulacao',
          assinatura: {
            hash: validHash,
            operatorId: 'user-2', // ← Mismatch! Signed by different user
            ts: new Date(),
          },
          criadoEm: new Date(),
        }),
      );
    });

    it('should allow valid signature', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-SIG'],
          modules: { runs: true },
        })
        .firestore();

      const validHash = 'a'.repeat(64);
      const runRef = db.collection('labs').doc('LAB-SIG').collection('runs').doc('run-1');
      await assertSucceeds(
        runRef.set({
          labId: 'LAB-SIG',
          testType: 'coagulacao',
          assinatura: {
            hash: validHash,
            operatorId: 'user-1', // ← Matches auth.uid
            ts: new Date(),
          },
          criadoEm: new Date(),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Suite 6: Event Immutability
  // ────────────────────────────────────────────────────────────────

  describe('Event Immutability — /events Subcollection', () => {
    beforeEach(async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();

        // Create run with event
        await db.collection('labs').doc('LAB-EVT').collection('runs').doc('run-1').set({
          labId: 'LAB-EVT',
          testType: 'coagulacao',
          criadoEm: new Date(),
        });

        // Add immutable event
        await db
          .collection('labs')
          .doc('LAB-EVT')
          .collection('runs')
          .doc('run-1')
          .collection('events')
          .doc('event-1')
          .set({
            labId: 'LAB-EVT',
            runId: 'run-1',
            tipo: 'resultado-obtido',
            resultado: 12.5,
            criadoEm: new Date(),
          });
      });
    });

    it('should allow create event', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-EVT'],
          modules: { runs: true },
        })
        .firestore();

      const eventRef = db
        .collection('labs')
        .doc('LAB-EVT')
        .collection('runs')
        .doc('run-1')
        .collection('events')
        .doc('event-2');

      await assertSucceeds(
        eventRef.set({
          labId: 'LAB-EVT',
          runId: 'run-1',
          tipo: 'revisao-tecnica',
          criadoEm: new Date(),
        }),
      );
    });

    it('should DENY update of event', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-EVT'],
          modules: { runs: true },
        })
        .firestore();

      const eventRef = db
        .collection('labs')
        .doc('LAB-EVT')
        .collection('runs')
        .doc('run-1')
        .collection('events')
        .doc('event-1');

      await assertFails(eventRef.update({ resultado: 13.5 }));
    });

    it('should DENY delete of event', async () => {
      const db = env
        .authenticatedContext('user-1', {
          labIds: ['LAB-EVT'],
          modules: { runs: true },
        })
        .firestore();

      const eventRef = db
        .collection('labs')
        .doc('LAB-EVT')
        .collection('runs')
        .doc('run-1')
        .collection('events')
        .doc('event-1');

      await assertFails(eventRef.delete());
    });
  });
});
```

---

## Test Configuration (`jest.firestore.config.js`)

```javascript
module.exports = {
  displayName: 'firestore-rules',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/firestore.rules.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
      },
    },
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: ['firestore.rules'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
```

---

## Running Tests

```bash
# Start emulator first
bash scripts/firestore-emulator-setup.sh start &

# In another terminal
npm run test:rules

# With coverage
npm run test:rules -- --coverage

# Watch mode
npm run test:rules -- --watch
```

---

## Key Testing Patterns

| Pattern                               | Usage                         | Example                           |
| ------------------------------------- | ----------------------------- | --------------------------------- |
| **`assertSucceeds()`**                | Expect operation to pass      | Admin can update settings         |
| **`assertFails()`**                   | Expect operation to be denied | Patient cannot create runs        |
| **`env.authenticatedContext()`**      | Simulate signed-in user       | Mock `user-1` with `labIds` claim |
| **`env.withSecurityRulesDisabled()`** | Setup without rules           | Create test data                  |
| **`doc.get()`**                       | Read single document          | Verify RBAC on read               |
| **`collection.add()`**                | Create with auto ID           | Test write validation             |
| **`doc.update()`**                    | Partial update                | Test field-level rules            |
| **`doc.delete()`**                    | Delete document               | Test immutability rules           |

---

## Checklist for New Test Suites

- [ ] Setup/teardown with real data
- [ ] Test both success and failure paths
- [ ] Cover all roles (admin, operator, patient, etc.)
- [ ] Verify labId isolation
- [ ] Test signature validation
- [ ] Test soft delete (deletadoEm)
- [ ] Test immutable subcollections
- [ ] Test pessimistic locks (if applicable)
- [ ] Run with emulator: `npm run test:rules`
- [ ] 100% rule coverage target

---

## Related Docs

- [FIRESTORE_EMULATOR_GUIDE.md](./FIRESTORE_EMULATOR_GUIDE.md) — Setup and usage
- [`firestore.rules`](../firestore.rules) — Rules source
- [Firebase Rules Testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

---

**Last updated:** 2026-05-07
