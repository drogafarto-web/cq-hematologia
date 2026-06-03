/**
 * Firestore rules emulator test — Supervisor presence gating on CIQ runs.
 *
 * Covers Wave 2 / Agent 7 proposal:
 *   .planning/proposed-changes/wave2-7-supervisor-gating.md
 *
 * Validates `hasActiveSupervisor(labId)` rule helper (consumed by hematologia,
 * imunologia, uroanálise, and insumos sub-runs paths) per RDC 978 Art. 122.
 *
 * STATUS: STUB — runs only after the proposed rules diff is applied to
 * `firestore.rules`. Until then, every assertion that depends on the new
 * helper is `it.todo(...)`. Once CTO approves and the diff lands:
 *   1. Flip `it.todo` → `it`.
 *   2. Run via:
 *        firebase emulators:exec --only firestore \
 *          "npm test -- functions/src/__tests__/rules/supervisor-gating"
 *   3. Wire into CI (functions package script, not just web).
 *
 * Test pattern follows @firebase/rules-unit-testing 4.x. If this is the first
 * rules-emulator test in `functions/`, install the dep:
 *   cd functions && npm install --save-dev @firebase/rules-unit-testing
 *
 * Existing rules tests in the repo (web side) live at
 * `test/integration/batch2-rules.test.ts` — reuse setup patterns from there.
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it, expect } from '@jest/globals';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const LAB_ID = 'lab-supgate-test';
const OPERATOR_UID = 'operator-001';
const ADMIN_UID = 'admin-001';
const SUPERADMIN_UID = 'superadmin-001';
const NONMEMBER_UID = 'nonmember-001';

const RULES_PATH = resolve(__dirname, '../../../../firestore.rules');

let testEnv: RulesTestEnvironment;

async function seedLabAndMembers() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'labs', LAB_ID), { id: LAB_ID, nome: 'Test Lab' });
    await setDoc(doc(db, 'labs', LAB_ID, 'members', OPERATOR_UID), {
      uid: OPERATOR_UID,
      role: 'operator',
      active: true,
    });
    await setDoc(doc(db, 'labs', LAB_ID, 'members', ADMIN_UID), {
      uid: ADMIN_UID,
      role: 'admin',
      active: true,
    });
  });
}

async function setSupervisorStatus(hasActiveSupervisor: boolean) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'labs', LAB_ID, 'supervisor-status', 'current'), {
      labId: LAB_ID,
      hasActiveSupervisor,
      turnoAtivoId: hasActiveSupervisor ? 'turno-test-1' : null,
      supervisorAtivoUid: hasActiveSupervisor ? 'sup-uid-1' : null,
      supervisorAtivoNome: hasActiveSupervisor ? 'Dra. Test' : null,
      supervisorAtivoIsSubstitute: false,
      atualizadoEm: Timestamp.now(),
    });
  });
}

async function clearSupervisorStatus() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Wipe by overwriting with non-existence-equivalent: delete the doc.
    // rules-unit-testing supports deleteDoc via admin context.
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'labs', LAB_ID, 'supervisor-status', 'current'));
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'hmatologia2-rules-test',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedLabAndMembers();
});

describe('Rules — supervisor presence gating (RDC 978 Art. 122)', () => {
  // ───────────────────────────────────────────────────────────────────────
  // Hematologia: /labs/{labId}/lots/{lotId}/runs/{runId}
  // ───────────────────────────────────────────────────────────────────────

  describe('hematologia runs (/lots/{lotId}/runs)', () => {
    it.todo('BLOCKS run create when no supervisor is checked in (cache.hasActiveSupervisor=false)');
    it.todo('ALLOWS run create when supervisor is active (cache.hasActiveSupervisor=true)');
    it.todo('BLOCKS run create when supervisor-status doc does not exist (fail-closed)');
    it.todo('ALLOWS run create for superAdmin even with hasActiveSupervisor=false (escape hatch)');
    it.todo('ALLOWS run READ regardless of supervisor presence (auditor access not gated)');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Imunologia: /labs/{labId}/ciq-imuno/{lotId}/runs/{runId}
  // ───────────────────────────────────────────────────────────────────────

  describe('imunologia runs (/ciq-imuno/{lotId}/runs)', () => {
    it.todo('BLOCKS run create when hasActiveSupervisor=false');
    it.todo('ALLOWS run create when hasActiveSupervisor=true and user has imunologia module');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Uroanálise: /labs/{labId}/ciq-uroanalise/{lotId}/runs/{runId}
  // ───────────────────────────────────────────────────────────────────────

  describe('uroanalise runs (/ciq-uroanalise/{lotId}/runs)', () => {
    it.todo('BLOCKS run create when hasActiveSupervisor=false');
    it.todo('ALLOWS run create when hasActiveSupervisor=true and user has uroanalise module');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Insumos sub-runs: /labs/{labId}/insumos/{insumoId}/runs/{runId}
  // ───────────────────────────────────────────────────────────────────────

  describe('insumos sub-runs (/insumos/{id}/runs)', () => {
    it.todo('BLOCKS run create when hasActiveSupervisor=false');
    it.todo('ALLOWS run create when hasActiveSupervisor=true');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Negative space — paths that must NOT be gated
  // ───────────────────────────────────────────────────────────────────────

  describe('non-gated paths (must remain accessible)', () => {
    it.todo('ALLOWS laudos-draft writes regardless of supervisor presence (drafts excluded)');
    it.todo('ALLOWS turnos writes pathway is callable-only (DL-1) — no rule change here');
    it.todo('ALLOWS ciq-coagulacao runs (open-access MVP — out of scope)');
    it.todo('ALLOWS run delete by admin regardless of presence (admin bypass on cleanup)');
  });

  // ───────────────────────────────────────────────────────────────────────
  // Smoke: the cache itself
  // ───────────────────────────────────────────────────────────────────────

  describe('supervisor-status/current cache integrity', () => {
    it('non-superadmin members can READ the cache (rules unchanged)', async () => {
      await setSupervisorStatus(true);
      const ctx = testEnv.authenticatedContext(OPERATOR_UID);
      const ref = doc(ctx.firestore(), 'labs', LAB_ID, 'supervisor-status', 'current');
      const snap = await assertSucceeds(getDoc(ref));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.hasActiveSupervisor).toBe(true);
    });

    it('non-members cannot READ the cache', async () => {
      await setSupervisorStatus(true);
      const ctx = testEnv.authenticatedContext(NONMEMBER_UID);
      const ref = doc(ctx.firestore(), 'labs', LAB_ID, 'supervisor-status', 'current');
      await assertFails(getDoc(ref));
    });

    it('client cannot WRITE the cache (callables only — DL-1)', async () => {
      const ctx = testEnv.authenticatedContext(ADMIN_UID);
      const ref = doc(ctx.firestore(), 'labs', LAB_ID, 'supervisor-status', 'current');
      await assertFails(
        setDoc(ref, {
          labId: LAB_ID,
          hasActiveSupervisor: true,
          atualizadoEm: serverTimestamp(),
        }),
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Implementation hints for the engineer who unfreezes the it.todo cases:
//
// Example happy-path (hematologia):
//
//   await setSupervisorStatus(true);
//   const ctx = testEnv.authenticatedContext(OPERATOR_UID, {
//     modules: { hematologia: true },
//   });
//   const runRef = doc(
//     ctx.firestore(),
//     'labs', LAB_ID, 'lots', 'lot-1', 'runs', 'run-1',
//   );
//   await assertSucceeds(setDoc(runRef, {
//     labId: LAB_ID,
//     lotId: 'lot-1',
//     value: 1.23,
//     ts: serverTimestamp(),
//   }));
//
// Example block (no supervisor):
//
//   await setSupervisorStatus(false);
//   const ctx = testEnv.authenticatedContext(OPERATOR_UID, {
//     modules: { hematologia: true },
//   });
//   const runRef = doc(ctx.firestore(),
//     'labs', LAB_ID, 'lots', 'lot-1', 'runs', 'run-1');
//   await assertFails(setDoc(runRef, { labId: LAB_ID, value: 1.23 }));
//
// Example fail-closed (no cache doc):
//
//   await clearSupervisorStatus(); // doc absent
//   const ctx = testEnv.authenticatedContext(OPERATOR_UID, {
//     modules: { hematologia: true },
//   });
//   await assertFails(setDoc(runRef, { labId: LAB_ID, value: 1.23 }));
//
// Example superAdmin escape:
//
//   await setSupervisorStatus(false);
//   const ctx = testEnv.authenticatedContext(SUPERADMIN_UID, {
//     isSuperAdmin: true,
//   });
//   await assertSucceeds(setDoc(runRef, { labId: LAB_ID, value: 1.23 }));
// ─────────────────────────────────────────────────────────────────────────────
