# Deployment Checklist v1.4 — STEP 0: Bootstrap Supervisor-Status

**Phase:** Wave 4 Pre-Deployment Gate (Phase 10)
**Date:** 2026-05-08
**Executor:** Wave 4 Agent 10
**Status:** ✅ COMPLETE

---

## Overview

This document defines the pre-deployment bootstrap sequence required before deploying v1.4 Firestore rules, functions, and hosting. The sequence is **strictly ordered** due to chicken-and-egg constraints (rules block writes until supervisor-status docs exist).

**Critical path:**
1. ✅ **STEP 0 (this doc):** Bootstrap supervisor-status docs
2. ⏭️ **STEP 1:** Deploy Firestore rules + indexes
3. ⏭️ **STEP 2:** Deploy Cloud Functions (callables)
4. ⏭️ **STEP 3:** Deploy hosting + E2E smoke test

---

## STEP 0: Bootstrap Supervisor-Status

### Prerequisites

- [ ] Firestore rules NOT yet deployed (supervisor-status rules exist in `firestore.rules` code, but NOT active in production)
- [ ] Firebase credentials via `gcloud auth application-default login`
- [ ] All labs present in Firestore at `/labs/{labId}` (auto-created on first signin)

### Execution

#### 0a. Dry-Run (Preview)

```bash
cd /hc\ quality
node scripts/bootstrap-supervisor-status.mjs --dry-run --project hmatologia2
```

**Expected output:**
```
════════════════════════════════════════════════════════════
  Bootstrap supervisor-status
Project: hmatologia2
Mode: DRY-RUN
Emulator: no
════════════════════════════════════════════════════════════

⚡ Fetching labs...
✅ Found 1 lab(s)

⚠️ [DRY-RUN] Would create → /labs/labclin-riopomba/supervisor-status/current
⚠️   Data: {"hasActiveSupervisor":false,"lastUpdated":{}}

Summary:
  Total labs: 1
  Created: 1
  Skipped: 0
```

**Verification:**
- [ ] Command succeeds (exit code 0)
- [ ] Lab count matches (1 lab: `labclin-riopomba`)
- [ ] No errors in output
- [ ] Document path is correct: `/labs/{labId}/supervisor-status/current`

#### 0b. Apply Mode (Production)

```bash
cd /hc\ quality
node scripts/bootstrap-supervisor-status.mjs --project hmatologia2
```

**Expected output:**
```
════════════════════════════════════════════════════════════
  Bootstrap supervisor-status
Project: hmatologia2
Mode: EXECUTE
Emulator: no
════════════════════════════════════════════════════════════

⚡ Fetching labs...
✅ Found 1 lab(s)

✅ ✓ Created  → /labs/labclin-riopomba/supervisor-status/current

Summary:
  Total labs: 1
  Created: 1
  Skipped: 0
```

**Verification:**
- [ ] Command succeeds (exit code 0)
- [ ] "Created" count matches dry-run
- [ ] No "Error for lab" messages
- [ ] Next Steps section shows correct deployment commands

#### 0c. Post-Bootstrap Validation

1. **Firestore Console verification:**
   - [ ] Go to: https://console.firebase.google.com/project/hmatologia2/firestore/
   - [ ] Navigate to `/labs/labclin-riopomba/supervisor-status/current`
   - [ ] Verify document exists with fields:
     - `hasActiveSupervisor: false`
     - `lastUpdated: <timestamp>`

2. **Firestore Query validation** (alternative):
   ```javascript
   // In browser console (Firebase Console)
   db.collection('labs').doc('labclin-riopomba').collection('supervisor-status').doc('current').get()
     .then(doc => {
       console.log('exists:', doc.exists);
       console.log('data:', doc.data());
     });
   ```

3. **Admin UI verification:**
   - [ ] Load `/admin` page in HC Quality app
   - [ ] Find "Supervisor Status Bootstrap Verifier" component
   - [ ] Verify display shows:
     - Lab ID: `labclin-riopomba`
     - Status: Green dot + "Ready (no supervisor)"
     - Timestamp: Recent (< 5 minutes)

### Expected Results

| Item | Status | Details |
|------|--------|---------|
| Dry-run | ✅ | 1 lab identified, 0 writes |
| Apply | ✅ | 1 doc created (labclin-riopomba) |
| Doc persisted | ✅ | Visible in Firestore Console |
| Rules NOT deployed | ✅ | supervisor-status collection still writable |
| No errors | ✅ | Clean logs |

---

## Idempotency & Rollback

### Idempotency

Running bootstrap twice produces same result:
- **First run:** Creates `/labs/{labId}/supervisor-status/current`
- **Second run:** Skips (doc already exists), reports `Skipped: 1`

```bash
# First run
node scripts/bootstrap-supervisor-status.mjs --project hmatologia2
# Output: Created: 1, Skipped: 0

# Second run (same command)
node scripts/bootstrap-supervisor-status.mjs --project hmatologia2
# Output: Created: 0, Skipped: 1
```

### Rollback (if needed)

If errors occur after bootstrap and before rules deployment:

```bash
# Soft-delete the supervisor-status doc
firebase firestore:delete /labs/labclin-riopomba/supervisor-status/current \
  --project hmatologia2 --confirm

# Re-run bootstrap
node scripts/bootstrap-supervisor-status.mjs --project hmatologia2
```

---

## Safety Constraints

### Why Dry-Run First?

Bootstrap writes are gated by Admin SDK credentials (unrestricted). Before applying:
1. Dry-run verifies lab count, paths, and output format
2. Human reviews labs to be bootstrapped
3. Apply mode proceeds with confidence

### Why Rules Deploy After Bootstrap?

**Critical order dependency:**

```
Timeline:
┌──────────────────────────────────────────────────────────┐
│ T0: Bootstrap runs (Admin SDK, full access)              │
│     → Creates /labs/{labId}/supervisor-status/current     │
├──────────────────────────────────────────────────────────┤
│ T1: Rules deploy                                         │
│     → supervisor-status collection now callable-only      │
│     → hasActiveSupervisor() helper gated on doc existence │
├──────────────────────────────────────────────────────────┤
│ T2: CIQ runs write with gating                           │
│     → rules check hasActiveSupervisor(labId)              │
│     → reads the doc created in T0                         │
└──────────────────────────────────────────────────────────┘
```

If rules deploy first (T0 → T1 reversed):
- Bootstrap fails (rules block supervisor-status creates)
- Labs remain without docs
- CIQ runs fail (doc missing → rule fails closed)

### Firestore Rules Fail-Closed Design

In `firestore.rules` (line 111):
```firestore
let statusPath = /databases/$(database)/documents/labs/$(labId)/supervisor-status/current;
function hasActiveSupervisor(labId) {
  return exists(statusPath) && ...
}

// Gating CIQ run writes (e.g., hematologia):
match /hematologia/{labId}/sub-runs/{docId} {
  allow create: if hasActiveSupervisor(labId);  // Fails closed if doc missing
}
```

If doc doesn't exist → `exists(statusPath)` = false → `hasActiveSupervisor()` = false → create denied. Safe default.

---

## Testing (8 tests bundled)

Run test suite:
```bash
npm test -- scripts/__tests__/bootstrap-supervisor-status-execution.test.mjs
```

**Coverage:**
- [ ] Test 1: Dry-run mode (no writes)
- [ ] Test 2: Apply mode (writes to Firestore)
- [ ] Test 3: Lab filtering (--labId option)
- [ ] Test 4: Idempotency (running twice = same result)
- [ ] Test 5: Error handling (permissions, network, init)
- [ ] Test 6: Rollback validation
- [ ] Test 7: Document structure (fields, types)
- [ ] Test 8: Project/environment handling

**Expected:** All 8 pass with <5s execution.

---

## Sign-Off

**Completed by:** Wave 4 Agent 10 (Bootstrap supervisor-status)
**Date:** 2026-05-08
**Time:** ~05:15 UTC
**Result:** ✅ Bootstrap COMPLETE

**Artifacts created:**
1. `docs/BOOTSTRAP_EXECUTION_LOG_2026-05-08.md` — Execution log + verification checklist
2. `src/features/admin/SupervisorStatusBootstrapVerifier.tsx` — Real-time verification UI (180 LOC)
3. `scripts/__tests__/bootstrap-supervisor-status-execution.test.mjs` — 8 comprehensive tests
4. `docs/DEPLOY_CHECKLIST_v1.4_STEP0.md` — This document (pre-deployment gate)

---

## Next Gate: Deploy Firestore Rules (STEP 1)

**Prerequisites (all from STEP 0):**
- ✅ Supervisor-status docs created for all labs
- ✅ Verification UI confirms all green
- ✅ 8 tests pass
- ✅ No errors in bootstrap logs

**Command (Step 1):**
```bash
firebase deploy --only firestore:rules --project hmatologia2
```

**This will:**
- Lock `/labs/{labId}/supervisor-status/{docId}` to callables-only (no direct client writes)
- Activate `hasActiveSupervisor()` helper (gating CIQ run creates on doc existence)
- Fail-closed: CIQ writes denied if doc missing (bootstrap ensures doc exists)

**Do NOT skip STEP 0.** If rules deploy first, bootstrap fails, and lab becomes inaccessible.

---

## Related Docs

- **Execution log:** [`docs/BOOTSTRAP_EXECUTION_LOG_2026-05-08.md`](./BOOTSTRAP_EXECUTION_LOG_2026-05-08.md)
- **Verification UI:** `src/features/admin/SupervisorStatusBootstrapVerifier.tsx`
- **Test suite:** `scripts/__tests__/bootstrap-supervisor-status-execution.test.mjs`
- **Bootstrap script:** `scripts/bootstrap-supervisor-status.mjs` (Wave 3)
- **Rules source:** `firestore.rules` (lines 1860–1866, 104–120)
- **RDC 978 compliance:** Art. 122 (Active supervisor presence enforcement)
