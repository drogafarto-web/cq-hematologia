# NOTIVISA Migration: Legacy → Wave 2 (v1.4 Phase 4+)

**Status:** Phase 4 (Wave 3-6) — Migration Planning
**Date:** 2026-05-08
**Audience:** Lab operators, integration engineers, CTO

---

## Executive Summary

Starting **2026-05-20** (Phase 4 kickoff), labs integrating with NOTIVISA should **use Wave 2 callables** (`notivisaCreateDraft`, `notivisaApproveDraft`, `notivisaSubmitDraft`).

**Option A (Recommended): Gradual Mixed-Mode Migration**
- Existing labs: keep legacy path working for drafted/submitted-before-cutover
- New labs: start with Wave 2 only
- Cron processor handles both (with duplicate-detection)
- Cutover window: 3 months (Phase 4 → Phase 6)

**Option B (Hard Cutover): Forced Upgrade**
- Set `FEATURE_LEGACY_NOTIVISA_ENABLED=false` on date X
- Existing drafts must complete before X or are archived
- No backward compat
- Cleaner, riskier

**Recommendation:** **Option A (gradual).** Safer for live customers, easier rollback.

---

## Part A: Understanding the Differences

### Summary Table

| Aspect | Legacy | Wave 2 |
|--------|--------|--------|
| **Callable Names** | `notivisaDraftCreate` | `notivisaCreateDraft` |
| | `approveNotivisaDraft` | `notivisaApproveDraft` |
| | `submitNotivisaDraft` | `notivisaSubmitDraft` |
| **Status Enum** | `['draft', 'approved', 'submitted', 'rejected']` | `['pending', 'approved', 'submitted']` |
| **Signature Strategy** | HMAC-SHA256 cryptographic | Audit metadata only |
| **Rate Limiting** | 10 req/min per lab | None (TBD Phase 5) |
| **Mode Awareness** | No | Yes (test/sandbox/prod) |
| **Audit Log Action** | `CREATED`, `APPROVED`, `SUBMITTED`, `REJECTED` | `DRAFT_CREATED`, `DRAFT_APPROVED`, `DRAFT_SUBMITTED` |
| **API Maturity** | ADR-0026 Phase 8 (Batch 1) | ADR-0026 Wave 2-10 (test-mode skeleton) |

### Key Changes for Developers

#### 1. Function Names (Client Code)

**Before (Legacy):**
```typescript
const draftFn = httpsCallable(functions, 'notivisaDraftCreate');
const approveFn = httpsCallable(functions, 'approveNotivisaDraft');
const submitFn = httpsCallable(functions, 'submitNotivisaDraft');
```

**After (Wave 2):**
```typescript
const draftFn = httpsCallable(functions, 'notivisaCreateDraft');
const approveFn = httpsCallable(functions, 'notivisaApproveDraft');
const submitFn = httpsCallable(functions, 'notivisaSubmitDraft');
```

#### 2. Draft Status Enum

**Before (Legacy):**
```typescript
draft.status: 'draft' | 'approved' | 'submitted' | 'rejected'
```

**After (Wave 2):**
```typescript
draft.status: 'pending' | 'approved' | 'submitted'
// Note: 'rejected' mapped to soft-delete (deletadoEm != null)
```

**Migration:** Update UI/queries to treat `status === 'pending'` as the initial state (equivalent to legacy `'draft'`).

#### 3. Signature Verification (Gone)

**Before (Legacy):**
```typescript
// Client computes HMAC-SHA256 before calling approve
const hash = await computeNotivisaSignature({
  operatorId: uid,
  ts: Date.now(),
  payload: { draftId, action: 'approve' }
});

const approveFn = httpsCallable(functions, 'approveNotivisaDraft');
const result = await approveFn({
  labId,
  draftId,
  signature: { hash, operatorId: uid, ts: Date.now() }
});
```

**After (Wave 2):**
```typescript
// No signature needed — server-side role check only
const approveFn = httpsCallable(functions, 'notivisaApproveDraft');
const result = await approveFn({
  labId,
  draftId
});
```

**Consequence:** Simpler client code, weaker cryptographic proof (audit metadata instead). Trade-off acceptable for phase 4 test-mode.

#### 4. Audit Log Action Names

**Before (Legacy):**
```
Firestore event: auditLog/XYZ { action: 'CREATED', ... }
Firestore event: auditLog/XYZ { action: 'APPROVED', ... }
Firestore event: auditLog/XYZ { action: 'SUBMITTED', ... }
```

**After (Wave 2):**
```
Firestore event: auditLog/ABC { action: 'DRAFT_CREATED', ... }
Firestore event: auditLog/ABC { action: 'DRAFT_APPROVED', ... }
Firestore event: auditLog/ABC { action: 'DRAFT_SUBMITTED', ... }
```

**Migration:** Update audit log dashboards to filter on both action names during transition period.

---

## Part B: Migration Paths

### Scenario 1: New Lab Onboarding (Phase 4 Kickoff)

**Timeline:**
- **2026-05-20** (Phase 4 start): Lab signs up
- **2026-05-20 → 2026-08-01**: Lab uses Wave 2 callables only
- **2026-08-01** (Phase 6): Legacy support disabled; Wave 2 is only option

**Steps:**
1. ✅ In admin setup, set `NOTIVISA_MODE=test` (default; sandbox/prod come later)
2. ✅ Call `notivisaCreateDraft(labId, laudoId, payload)`
   - Waits for `status === 'pending'` response
3. ✅ RT calls `notivisaApproveDraft(labId, draftId)` → status→ `'approved'`
4. ✅ Operator calls `notivisaSubmitDraft(labId, draftId)` → enqueued in queue

**No special handling needed.** Recommended path.

---

### Scenario 2: Existing Lab Migration (Option A — Gradual)

**Timeline:**
- **Now (2026-05-08)**: Lab has drafts in flight (legacy status=`'draft'`, `'approved'`, `'submitted'`)
- **2026-05-20 (Phase 4 start)**: Wave 2 becomes available; old drafts keep working
- **2026-06-20 (Phase 5 mid)**: Lab encouraged to migrate to Wave 2 for new submissions
- **2026-07-20 (Phase 6 early)**: Feature flag warnings; legacy callables logged as deprecated
- **2026-08-01 (Phase 6)**: Legacy support disabled; only Wave 2 works

**Steps for Lab:**
1. **Weeks 1-4 (May 20 → Jun 20):**
   - New submissions use Wave 2 callables
   - Old drafts (legacy) complete via existing RT/operator workflow
   - No code changes required; both paths work

2. **Week 5-8 (Jun 20 → Jul 20):**
   - All new submissions on Wave 2
   - Legacy drafts should be mostly complete
   - Any stragglers: RT can re-approve + re-submit on Wave 2 path

3. **Week 9 (Jul 20 → Aug 1):**
   - Ensure no legacy drafts in flight
   - Legacy support disabled (feature flag)
   - Verify Wave 2 path stable

**Implementation in Codebase:**

```typescript
// functions/src/modules/notivisa/index.ts (after Phase 4)
const LEGACY_CUTOVER_DATE = new Date('2026-08-01T00:00:00Z');
const FEATURE_LEGACY_NOTIVISA_ENABLED = 
  Date.now() < LEGACY_CUTOVER_DATE.getTime() &&
  process.env.FEATURE_LEGACY_NOTIVISA_ENABLED !== 'false';

if (FEATURE_LEGACY_NOTIVISA_ENABLED) {
  export { notivisaDraftCreate } from './notivisaDraftCreate';
  export { approveNotivisaDraft } from './approveNotivisaDraft';
  export { submitNotivisaDraft } from './submitNotivisaDraft';
  export { rejectNotivisaDraft } from './rejectNotivisaDraft';
}
```

---

### Scenario 3: Existing Lab Migration (Option B — Hard Cutover)

**Timeline (Aggressive):**
- **2026-06-01**: Cutover date announced to all labs
- **2026-05-20 → 2026-06-01**: Labs export legacy drafts, migrate
- **2026-06-01**: Legacy callables disabled; Wave 2 only

**Steps for Lab:**
1. **Before 2026-06-01:**
   - Export all drafts via `notivisaExportArchive` (creates audit record)
   - Complete submissions for legacy drafts or archive
   - Test Wave 2 workflow
   - Notify operators of URL/function name changes

2. **On 2026-06-01:**
   - Deploy with `FEATURE_LEGACY_NOTIVISA_ENABLED=false`
   - Legacy calls return `not-found` (callable doesn't exist)
   - Wave 2 only; no fallback

**Risks:**
- In-flight drafts orphaned
- Customer surprise if not communicated
- Not recommended

---

## Part C: Handling Mixed-Mode Labs

### Scenario: Lab Uses Both Callables During Transition

**Problem:**
```
Timeline:
12:00 — RT calls notivisaDraftCreate (legacy) → draft ABC, status='draft'
12:15 — Different operator calls notivisaCreateDraft (Wave 2) → separate draft DEF, status='pending'
12:30 — Cron processor runs: sees both ABC (legacy) and DEF (Wave 2)
        → Processes both; confusion in audit trail
```

### Solution: Conflict Detection Cron (Phase 6 Future)

**File:** `functions/src/modules/notivisa/crons/detectConflicts.ts` (proposed)

```typescript
/**
 * Phase 6 Cron: Detect mixed-mode drafts created in same lab within 5min window.
 * Logs warning, prefers Wave 2 over legacy.
 */
export const detectNotivisaConflicts = onSchedule(
  'every 30 minutes',
  async (context) => {
    const db = admin.firestore();
    
    // Foreach lab with NOTIVISA enabled
    const labs = await db.collectionGroup('notivisa-config')
      .where('enabled', '==', true)
      .get();

    for (const labDoc of labs.docs) {
      const labId = labDoc.ref.parent.parent?.id;
      if (!labId) continue;

      // Look for drafts created in last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recent = await db
        .collection('notivisa-drafts')
        .doc(labId)
        .collection('drafts')
        .where('criadoEm', '>=', admin.firestore.Timestamp.fromDate(fiveMinutesAgo))
        .get();

      // Check if both legacy ('draft') and Wave 2 ('pending') statuses present
      const hasLegacy = recent.docs.some(d => d.data().status === 'draft');
      const hasWave2 = recent.docs.some(d => d.data().status === 'pending');

      if (hasLegacy && hasWave2) {
        await writeAuditLog({
          action: 'NOTIVISA_CONFLICT_DETECTED',
          callerUid: 'system',
          labId,
          severity: 'warning',
          payload: {
            legacyDrafts: recent.docs.filter(d => d.data().status === 'draft').length,
            wave2Drafts: recent.docs.filter(d => d.data().status === 'pending').length,
            message: 'Lab using both legacy and Wave 2 callables in same session',
          },
        });
        
        // Prefer Wave 2 in queue processor
        // Legacy drafts held for manual RT review
      }
    }
  }
);
```

**Output:** Warning in `auditLogs/{labId}/` with counts + recommendation to standardize on Wave 2.

---

## Part D: Status Mapping Cheat Sheet

| Legacy Status | Wave 2 Equivalent | Action |
|---------------|-------------------|--------|
| `'draft'` | `'pending'` | Client code treats as initial state |
| `'approved'` | `'approved'` | Direct 1:1 match |
| `'submitted'` | `'submitted'` | Direct 1:1 match |
| `'rejected'` | Soft-delete (`deletadoEm != null`) | UI hides rejected drafts |

**Query Migration:**

**Before (Legacy):**
```typescript
const drafts = await db
  .collection('notivisa-drafts')
  .doc(labId)
  .collection('drafts')
  .where('status', '==', 'draft')
  .get();
```

**After (Wave 2):**
```typescript
const drafts = await db
  .collection('notivisa-drafts')
  .doc(labId)
  .collection('drafts')
  .where('status', '==', 'pending')
  .where('deletadoEm', '==', null)
  .get();
```

**During Transition (Both):**
```typescript
const drafts = await db
  .collection('notivisa-drafts')
  .doc(labId)
  .collection('drafts')
  .where('status', 'in', ['draft', 'pending'])
  .where('deletadoEm', '==', null)
  .get();
```

---

## Part E: Error Code Mapping

| Error | Legacy Code | Wave 2 Code | Action |
|-------|-------------|------------|--------|
| Invalid payload | `invalid-argument` | `invalid-argument` | Same |
| User not authorized | `permission-denied` | `permission-denied` | Same |
| Bad signature (legacy only) | `invalid-argument` | N/A | Remove client-side signature code |
| Rate limit exceeded (legacy only) | `resource-exhausted` | N/A (TBD Phase 5) | Remove rate-limit handling |
| Draft not found | `not-found` | `not-found` | Same |
| Invalid draft state | `failed-precondition` | `failed-precondition` | Same |

---

## Part F: Testing Checklist

### Unit Tests (Per Callable)

- [ ] `notivisaCreateDraft` handles new draft creation
- [ ] `notivisaCreateDraft` returns `idempotent: true` for existing laudoId
- [ ] `notivisaApproveDraft` transitions `pending` → `approved`
- [ ] `notivisaSubmitDraft` requires `approved` state
- [ ] Queue event created on submit with correct `mode` field

### Integration Tests (Lifecycle)

- [ ] Wave 2 draft creation → approval → submission → queue
- [ ] Legacy draft creation → approval → submission → queue (still works)
- [ ] Mixed-mode: Legacy draft created, Wave 2 system processes it via cron
- [ ] Mixed-mode: Wave 2 draft created, legacy query ignores it (no crash)

### E2E Tests (Live Scenarios)

- [ ] New lab (May 20 onwards): Create via Wave 2 only → Approve → Submit
- [ ] Existing lab (mixed-mode): 
  - Legacy draft in flight at May 20
  - New submissions use Wave 2
  - Cron processes both without conflicts
  - Audit trail coherent (both action names visible)

---

## Part G: Customer Communication Template

### Email to Lab Operators (Target: May 15)

```
Subject: NOTIVISA Update — New Submission API (Wave 2)

Dear [Lab Name] Team,

Starting May 20, 2026, we're releasing an improved NOTIVISA submission API with:

✅ Simpler workflow (no signature ceremony)
✅ Better audit trail (mode awareness: test/sandbox/prod)
✅ Cleaner status naming

WHAT YOU NEED TO DO:
1. For NEW submissions after May 20: use the new function names:
   - notivisaCreateDraft (was: notivisaDraftCreate)
   - notivisaApproveDraft (was: approveNotivisaDraft)
   - notivisaSubmitDraft (was: submitNotivisaDraft)

2. Draft status changed from 'draft' → 'pending'
   No action needed; UI will auto-update.

3. In-flight drafts (before May 20): use old functions, they still work.

4. Full migration guide: [docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md](...)

QUESTIONS? Contact support@hc-quality.com

Best regards,
HC Quality Engineering
```

---

## Part H: Rollback Plan

### If Wave 2 Has Critical Bug (Phase 5+)

1. **Immediate:** Set `FEATURE_LEGACY_NOTIVISA_ENABLED=true` in env
2. **During test:** New submissions route to legacy callables
3. **Root cause:** Fix Wave 2, run full test suite
4. **Re-enable:** Deploy fix, flip feature flag back
5. **Post-incident:** Audit trail shows which drafts went through which path

---

## Part I: Success Criteria

### Phase 4 (Now → 2026-06-20)

- [ ] Wave 2 callables deployed and tested in production
- [ ] >50% of new drafts use Wave 2 (monitored via Cloud Logs)
- [ ] Zero reports of mixed-mode conflicts
- [ ] Audit trails from both paths coherent

### Phase 5 (2026-06-20 → 2026-07-20)

- [ ] >80% of new drafts use Wave 2
- [ ] Legacy drafts mostly completed
- [ ] Feature flag warnings in place (logs show deprecation notices)
- [ ] Conflict detection cron running without issues

### Phase 6 (2026-07-20 → 2026-08-01)

- [ ] <5% of drafts in legacy state
- [ ] Labs notified of hard cutover (Aug 1)
- [ ] Legacy support disabled
- [ ] All submissions on Wave 2

---

## Related Documents

- `LEGACY_AUDIT.md` — detailed technical audit of both paths
- `NOTIVISA_CLEANUP_ROADMAP.md` — full Phase-by-phase timeline
- `LEGACY_COEXISTENCE_TESTS.md` — test coverage for mixed-mode

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Wave 3-6 Engineer | TBD | 2026-05-08 |
| CTO Review | TBD | TBD |
| Customer Success Lead | TBD | TBD |
