# NOTIVISA Cleanup Roadmap — Legacy Deprecation (Phase 4–6)

**Status:** Planning Document
**Date:** 2026-05-08
**Timeline:** 2026-05-20 → 2026-08-01 (15 weeks)

---

## Executive Summary

**Goal:** Converge on Wave 2 callables; deprecate legacy by 2026-08-01.

**Strategy:** Gradual opt-in migration with feature flag kill-switch.

**Phases:**
| Phase | Dates | Key Actions | Status |
|-------|-------|-------------|--------|
| **Phase 4 (Kickoff)** | May 20 → Jun 20 | Launch Wave 2 publicly; mark legacy deprecated; monitor usage | Current |
| **Phase 5 (Monitoring)** | Jun 20 → Jul 20 | Measure legacy adoption; add rate limiting to Wave 2; conflict detection | Planning |
| **Phase 6 (Cutover)** | Jul 20 → Aug 1 | Flip feature flag; delete legacy code; final hardening | Future |

---

## Phase 4: Kickoff & Deprecation Notice (May 20 → Jun 20)

### 4.1 Code Changes

#### 4.1.1 Add Deprecation Markers (Week 1: May 20–27)

**File:** `functions/src/modules/notivisa/notivisaDraftCreate.ts` (and others)

```typescript
/**
 * @deprecated Use notivisaCreateDraft instead (Wave 2-10).
 * 
 * This callable is part of the legacy NOTIVISA Batch 1 implementation.
 * It will be disabled on 2026-08-01. See:
 * - Migration guide: docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md
 * - Deprecation plan: docs/notivisa/NOTIVISA_CLEANUP_ROADMAP.md
 * 
 * For existing deployments, continue using this callable until the
 * migration window closes. New integrations should use notivisaCreateDraft.
 */
export const notivisaDraftCreate = onCall(...)
```

**Files to update:**
- `notivisaDraftCreate.ts`
- `approveNotivisaDraft.ts`
- `submitNotivisaDraft.ts`
- `rejectNotivisaDraft.ts`

#### 4.1.2 Add Feature Flag (Week 1: May 20–27)

**File:** `functions/src/modules/notivisa/index.ts`

```typescript
/**
 * Legacy NOTIVISA callables (Batch 1, ADR-0026 Phase 8).
 * Scheduled for deprecation 2026-08-01. Feature flag allows safe cutover.
 * 
 * Timeline:
 * - Phase 4 (May 20 → Jun 20): legacy enabled, Wave 2 preferred
 * - Phase 5 (Jun 20 → Jul 20): monitoring, conflict detection active
 * - Phase 6 (Jul 20 → Aug 1): feature flag disabled (hard cutover)
 */

const LEGACY_FEATURE_FLAG = process.env.FEATURE_LEGACY_NOTIVISA_ENABLED !== 'false';
const LEGACY_CUTOVER_DATE = new Date('2026-08-01T00:00:00Z');

// Export legacy callables only if flag is true AND before cutover date
if (LEGACY_FEATURE_FLAG && Date.now() < LEGACY_CUTOVER_DATE.getTime()) {
  export { notivisaDraftCreate } from './notivisaDraftCreate';
  export { approveNotivisaDraft } from './approveNotivisaDraft';
  export { submitNotivisaDraft } from './submitNotivisaDraft';
  export { rejectNotivisaDraft } from './rejectNotivisaDraft';
} else if (Date.now() >= LEGACY_CUTOVER_DATE.getTime()) {
  // Graceful error: cutover date passed
  console.warn(
    '[NOTIVISA] Legacy callables disabled (cutover date 2026-08-01 passed). ' +
    'Use Wave 2 callables (notivisaCreateDraft, etc).'
  );
}
```

#### 4.1.3 Add Telemetry Logging (Week 2: May 27–Jun 3)

**File:** `functions/src/modules/notivisa/notivisaDraftCreate.ts` (and others)

```typescript
export const notivisaDraftCreate = onCall<unknown, Promise<NotivisaDraftCreateResult>>(
  {},
  async (request) => {
    // Log usage (telemetry for Phase 5 monitoring)
    await writeAuditLog({
      action: 'NOTIVISA_LEGACY_CALLABLE_INVOKED',
      callerUid: request.auth?.uid || 'anonymous',
      labId: input.labId,
      severity: 'info',
      payload: {
        callable: 'notivisaDraftCreate',
        deprecationWarning: 'Use notivisaCreateDraft (Wave 2) instead',
        cutoverDate: '2026-08-01',
      },
    });

    // ... rest of function
  },
);
```

### 4.2 Documentation

#### 4.2.1 Customer Communication (Week 1: May 20–27)

**Template Email to All Labs:**

```
Subject: Important — NOTIVISA Workflow Update (May 20, 2026)

Dear [Lab Name] Team,

We're upgrading the NOTIVISA integration with a new, simpler API starting May 20, 2026.

WHAT'S CHANGING:
✅ New function names (old ones still work for 11 weeks)
✅ Simpler approval workflow (no signature ceremony)
✅ Better audit trail
✅ Mode awareness (test/sandbox/prod for sandbox testing)

TIMELINE:
- **May 20 → Aug 1**: Both old and new APIs work. Use new ones for new drafts.
- **Aug 1 onwards**: Old API disabled. All submissions use new API.

WHAT YOU NEED TO DO:
1. Review migration guide: [link to MIGRATION_LEGACY_TO_WAVE2.md]
2. Update your integration code by July 20
3. Test in our sandbox (mode='test' is default)
4. Contact support@hc-quality.com with questions

FUNCTION NAME CHANGES:
notivisaDraftCreate     → notivisaCreateDraft
approveNotivisaDraft    → notivisaApproveDraft
submitNotivisaDraft     → notivisaSubmitDraft

Old drafts still work. You don't need to re-submit existing approved drafts.

Questions? Email support or call [number].

Best regards,
HC Quality Engineering Team
```

#### 4.2.2 Update Docs Landing Page (Week 1)

**File:** `docs/notivisa/README.md` (create if missing)

```markdown
# NOTIVISA Integration Guide

**Latest Version:** Wave 2-10 (as of May 20, 2026)

## Quick Links

- **[Migration Guide](MIGRATION_LEGACY_TO_WAVE2.md)** — If you're using the old API
- **[API Reference](API_REFERENCE.md)** — New Wave 2 callables
- **[Test Strategy](LEGACY_COEXISTENCE_TESTS.md)** — QA coverage for mixed-mode
- **[Technical Audit](LEGACY_AUDIT.md)** — Deep dive on both implementations
- **[Cleanup Roadmap](NOTIVISA_CLEANUP_ROADMAP.md)** — This document

## Current Status

**As of 2026-05-20:**
- Phase 4 (Kickoff) begins
- Legacy callables deprecated but functional
- Wave 2 is the recommended path for new integrations
- Cutover deadline: **2026-08-01**
```

### 4.3 Infrastructure Setup

#### 4.3.1 Monitoring Dashboard (Week 2: May 27–Jun 3)

**Cloud Logs Query:** Monitor legacy callable invocations

```bash
gcloud functions logs read notivisaDraftCreate \
  --project hmatologia2 \
  --filter='
    resource.type="cloud_function" AND
    resource.labels.function_name="notivisaDraftCreate"
  ' \
  --limit=100
```

**Grafana/Cloud Monitoring Dashboard:**
- Metric: `count(notivisaDraftCreate invocations per day)`
- Metric: `count(notivisaCreateDraft invocations per day)`
- Alert: If legacy > 30% of total, notify engineering

#### 4.3.2 Conflict Detection Alerts (Week 3: Jun 3–10)

**Log Message Pattern to Watch:**

```
NOTIVISA_CONFLICT_DETECTED: Lab {labId} using both legacy and Wave 2 
in same session (legacy: N, wave2: M)
```

**Alert Rule:** If count > 5/hour, page on-call engineer.

### 4.4 Testing

#### 4.4.1 Smoke Tests (Week 1: May 20–27)

```bash
# Test legacy path still works
npm run test -- notivisa.test.ts

# Test Wave 2 path
npm run test -- wave2-10-lifecycle.test.ts

# Test mixed-mode
npm run test -- mixed-mode-integration.test.ts
```

**Success Criteria:**
- All 347 existing NOTIVISA tests pass
- New 42 mixed-mode tests pass
- Zero regressions vs v1.3

#### 4.4.2 Production Smoke (Week 1: Post-Deploy)

**Manual checklist:**
- [ ] Deploy to hmatologia2 production
- [ ] Call `notivisaDraftCreate` → succeeds, logs deprecation warning
- [ ] Call `notivisaCreateDraft` → succeeds, no warning
- [ ] Both drafts visible in admin dashboard
- [ ] Audit logs show both action names

### 4.5 Rollback Plan

**If Wave 2 breaks (unlikely, but prepared):**

1. **Immediate:** Set `FEATURE_LEGACY_NOTIVISA_ENABLED=true` in env
2. **Notify:** Email labs that legacy is re-enabled temporarily
3. **Root cause:** Fix Wave 2, run full test suite
4. **Redeploy:** Deploy Wave 2 fix, flip flag back after validation
5. **Post-incident:** Add safeguards to Phase 5

---

## Phase 5: Monitoring & Rate Limiting (Jun 20 → Jul 20)

### 5.1 Code Changes

#### 5.1.1 Rate Limiting for Wave 2 (Week 1: Jun 20–27)

**File:** `functions/src/modules/notivisa/createDraft.ts`

```typescript
async function checkRateLimitPerMinute(
  db: admin.firestore.Firestore,
  labId: string,
): Promise<void> {
  const now = new Date();
  const minuteKey = /* ... */;

  const counterRef = db.doc(`notivisa-drafts/${labId}/rate-limits/wave2-minute-${minuteKey}`);
  
  // Same logic as legacy: 10 req/min (may increase to 20 in future)
  const count = (counterSnap.data()?.['count'] ?? 0) + 1;
  if (count > 10) {
    throw new HttpsError('resource-exhausted', 'Taxa de submissão excedida — máx 10/min');
  }
}

export const createDraft = onCall(..., async (request) => {
  // ... existing code
  await checkRateLimitPerMinute(db, input.labId);
  // ... rest
});
```

#### 5.1.2 Conflict Detection Cron (Week 1–2: Jun 20–Jul 3)

**File:** `functions/src/modules/notivisa/crons/detectConflicts.ts` (new)

```typescript
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

/**
 * Phase 5 → Phase 6 Cron: Detect labs using both legacy and Wave 2
 * callables in the same session. Logs warning for operator review.
 * 
 * Frequency: Every 30 minutes
 * Output: Audit log with count + recommendation
 */
export const detectNotivisaConflicts = onSchedule(
  'every 30 minutes',
  async (context) => {
    const db = admin.firestore();

    // Get all active labs
    const labsSnap = await db
      .collectionGroup('notivisa-config')
      .where('enabled', '==', true)
      .get();

    for (const configDoc of labsSnap.docs) {
      const labId = configDoc.ref.parent.parent?.id;
      if (!labId) continue;

      // Check drafts created in last 30 min
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const recent = await db
        .collection('notivisa-drafts')
        .doc(labId)
        .collection('drafts')
        .where('criadoEm', '>=', admin.firestore.Timestamp.fromDate(thirtyMinutesAgo))
        .get();

      if (recent.empty) continue;

      // Count by status (legacy uses 'draft', Wave 2 uses 'pending')
      const legacy = recent.docs.filter(d => d.data().status === 'draft').length;
      const wave2 = recent.docs.filter(d => d.data().status === 'pending').length;

      // Flag if both present
      if (legacy > 0 && wave2 > 0) {
        await writeAuditLog({
          action: 'NOTIVISA_MIXED_MODE_DETECTED',
          callerUid: 'system/conflict-detector',
          labId,
          severity: 'warning',
          payload: {
            legacyDrafts: legacy,
            wave2Drafts: wave2,
            recommendation:
              'Lab is using both legacy and Wave 2 callables. ' +
              'Standardize on Wave 2 (notivisaCreateDraft, notivisaApproveDraft, notivisaSubmitDraft) ' +
              'by 2026-08-01. See docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md',
            window: '30 minutes',
          },
        });
      }
    }
  }
);
```

### 5.2 Telemetry & Analysis

#### 5.2.1 Weekly Report (Jun 20, 27, Jul 4, 11, 18)

**Metric to track:**

```sql
SELECT
  DATE(TIMESTAMP_MICROS(timestamp * 1000)) as date,
  COUNT(CASE WHEN jsonPayload.callable = 'notivisaDraftCreate' THEN 1 END) as legacy_calls,
  COUNT(CASE WHEN jsonPayload.callable = 'notivisaCreateDraft' THEN 1 END) as wave2_calls,
  COUNT(DISTINCT jsonPayload.labId) as active_labs
FROM `hmatologia2.cloud_functions_log`
WHERE DATE(TIMESTAMP_MICROS(timestamp * 1000)) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY date
ORDER BY date DESC
```

**Success Criteria:**
- Legacy calls stay <20% of total (rest are Wave 2)
- Wave 2 calls growing week-over-week
- <5 labs with mixed-mode conflicts per week

#### 5.2.2 Mixed-Mode Lab Communication (Week 3: Jul 3–10)

**Email to labs with conflict alerts:**

```
Subject: ACTION REQUIRED — Your NOTIVISA Integration

Dear [Lab Name] Team,

Our monitoring detected that your lab is using both old and new NOTIVISA APIs 
in the same submission batch. This can cause confusion in audit trails.

ACTION REQUIRED by July 20:
- Update your integration to use ONLY the new API
- Contact support@hc-quality.com if you need migration help
- Test your changes in sandbox mode

New API functions:
- notivisaCreateDraft (was: notivisaDraftCreate)
- notivisaApproveDraft (was: approveNotivisaDraft)
- notivisaSubmitDraft (was: submitNotivisaDraft)

DEADLINE: July 20, 2026

After July 20, we'll begin the cutover process. Labs not using the new API
may see service interruptions on August 1.

Regards,
HC Quality Support
```

### 5.3 Testing & QA

#### 5.3.1 Phase 5 Test Matrix (Weeks 1–4)

| Test | Status |
|------|--------|
| Rate limiting for Wave 2 works (10 req/min) | Run / Pass |
| Conflict detection cron identifies labs correctly | Run / Pass |
| Telemetry metrics correctly classified | Run / Pass |
| No false positives (e.g., same call twice) | Run / Pass |

#### 5.3.2 Staging Cutover Test (Week 3: Jul 3–10)

1. Deploy to staging with legacy disabled
2. Create drafts via Wave 2 only
3. Verify full workflow works (create → approve → submit → queue → processing)
4. Measure performance (latency, throughput)
5. Document any issues; plan fixes

---

## Phase 6: Cutover & Cleanup (Jul 20 → Aug 1)

### 6.1 Code Changes

#### 6.1.1 Disable Legacy Feature Flag (Week 1: Jul 20–27)

**File:** `functions/src/index.ts`

```typescript
// Around line 2189-2193 (where legacy re-exports would be)
// Remove these lines entirely:
// export { notivisaDraftCreate } from './modules/notivisa/notivisaDraftCreate';
// ... etc

// Wave 2 exports remain active
export { createDraft as notivisaCreateDraft } from './modules/notivisa/createDraft';
export { approveDraft as notivisaApproveDraft } from './modules/notivisa/approveDraft';
export { submitDraft as notivisaSubmitDraft } from './modules/notivisa/submitDraft';
// ... others
```

**File:** `functions/src/modules/notivisa/index.ts`

```typescript
// Delete these lines entirely:
export { notivisaDraftCreate } from './notivisaDraftCreate';
export { approveNotivisaDraft } from './approveNotivisaDraft';
export { submitNotivisaDraft } from './submitNotivisaDraft';
export { rejectNotivisaDraft } from './rejectNotivisaDraft';

// Remaining exports:
// (Wave 2 callables, crons, helpers — no deletions)
```

#### 6.1.2 Delete Legacy Callable Files (Week 2: Jul 27–Aug 1)

**Files to delete:**
- `functions/src/modules/notivisa/notivisaDraftCreate.ts`
- `functions/src/modules/notivisa/approveNotivisaDraft.ts`
- `functions/src/modules/notivisa/submitNotivisaDraft.ts`
- `functions/src/modules/notivisa/rejectNotivisaDraft.ts`
- `functions/src/modules/notivisa/signatureCanonical.ts` (if only legacy used it)

**Files to keep:**
- `functions/src/modules/notivisa/createDraft.ts` (Wave 2)
- `functions/src/modules/notivisa/approveDraft.ts` (Wave 2)
- `functions/src/modules/notivisa/submitDraft.ts` (Wave 2)
- `functions/src/modules/notivisa/exportOutbox.ts` (Wave 2)
- `functions/src/modules/notivisa/processQueue.ts` (cron)
- `functions/src/modules/notivisa/crons/detectConflicts.ts` (new, Phase 5)
- `functions/src/modules/notivisa/validators.ts` (shared)
- `functions/src/modules/notivisa/testMode.ts` (Wave 2 feature)
- Tests: rename legacy tests to archive (`*.legacy.test.ts`)

#### 6.1.3 Archive Legacy Tests (Week 2: Jul 27–Aug 1)

**Action:**
```bash
# Move legacy tests to archive
mv functions/src/modules/notivisa/__tests__/batch1.test.ts \
   functions/src/modules/notivisa/__tests__/ARCHIVED.batch1.test.ts

# Keep only Wave 2 + mixed-mode tests active
# Test files to keep:
#   - wave2-10-lifecycle.test.ts
#   - mixed-mode-integration.test.ts
#   - notivisa.test.ts (update to remove legacy cases)
```

### 6.2 Deployment Sequence

#### 6.2.1 Step 1: Announce Cutover (Jul 20, Week 1)

**Email to all labs:**

```
Subject: NOTIVISA Cutover — August 1, 2026 at 00:00 UTC

Dear Labs,

The NOTIVISA integration upgrade is finalizing. As of August 1, 2026 at 00:00 UTC,
the old API will no longer be available.

ACTION REQUIRED:
✅ Ensure all your integrations use the new API (notivisaCreateDraft, etc)
✅ Test in production by July 31
✅ Contact support if you see errors on Aug 1

NEW FUNCTIONS (use these):
- notivisaCreateDraft (draft creation)
- notivisaApproveDraft (RT approval)
- notivisaSubmitDraft (submit to queue)

OLD FUNCTIONS (will stop working Aug 1):
- notivisaDraftCreate ❌
- approveNotivisaDraft ❌
- submitNotivisaDraft ❌
- rejectNotivisaDraft ❌

Questions? Email support@hc-quality.com or call [number] by July 31.

Regards,
HC Quality Engineering
```

#### 6.2.2 Step 2: Deploy to Staging (Jul 25, Thursday)

```bash
# 1. Delete legacy callable files + tests
rm functions/src/modules/notivisa/{notivisaDraftCreate,approveNotivisaDraft,submitNotivisaDraft,rejectNotivisaDraft}.ts

# 2. Update functions/src/index.ts (remove legacy re-exports)

# 3. Build + test
npm run build
npm run test -- notivisa

# 4. Deploy to staging
firebase deploy --only functions --project hmatologia2-staging

# 5. Verify staging (manually test Wave 2 path)
# 5.1: Create draft
# 5.2: Approve draft
# 5.3: Submit draft
# 5.4: Check queue event created
# 5.5: Verify audit logs

# 6. If green, approve for production
```

#### 6.2.3 Step 3: Deploy to Production (Aug 1, Tuesday)

**Pre-deployment checklist:**
- [ ] Staging tests pass (100%)
- [ ] No critical issues reported by labs (Jul 31 cutoff)
- [ ] Type-check passes: `npx tsc --noEmit`
- [ ] Lint baseline clean: `npm run lint`
- [ ] Preflight secrets check: `bash scripts/preflight-secrets-check.sh`
- [ ] Build succeeds: `npm run build`

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Secrets check
bash scripts/preflight-secrets-check.sh
# Expected: exit code 0 (all secrets provisioned)

# 4. Deploy functions
firebase deploy --only functions:notivisaCreateDraft,notivisaApproveDraft,notivisaSubmitDraft,notivisaExportOutbox,notivisaProcessQueue,detectNotivisaConflicts --project hmatologia2

# 5. Verify deploy succeeded
# Check: Functions page in Cloud Console
# Check: notivisaDraftCreate no longer listed (removed)
# Check: notivisaCreateDraft listed (present)

# 6. Monitor Cloud Logs
# Command: gcloud functions logs read --project hmatologia2 --limit 50
# Look for: errors, rate limit exceeded, signature failures
# Duration: 30 min post-deploy

# 7. User-facing tests (manual)
# - Login to https://hmatologia2.web.app
# - Create a draft
# - Approve it
# - Submit it
# - Verify it appears in queue
# - Check audit logs show new action names
```

### 6.3 Rollback Plan (If Needed)

**If production deploy has critical issues:**

1. **Immediate (within 1 hour):**
   - Revert functions deploy: `firebase deploy --only functions --project hmatologia2 && git log --oneline`
   - Lookup previous stable commit
   - `git checkout <commit>` and redeploy

2. **Notify labs (email + in-app alert):**
   - "We've temporarily reverted to legacy API while investigating. Please continue using old functions."
   - ETA for fix: [time]

3. **Root cause analysis:**
   - What broke?
   - Why didn't staging catch it?
   - How to prevent in future?

4. **Fix in staging:**
   - Fix code
   - Run full test suite
   - E2E test mixed-mode scenarios
   - Get CTO sign-off

5. **Redeploy to production:**
   - Full deployment checklist again
   - Extended monitoring (1 hour instead of 30 min)

### 6.4 Documentation Updates

#### 6.4.1 Update API Reference (Week 2: Jul 27–Aug 1)

**File:** `docs/notivisa/API_REFERENCE.md` (create/update)

```markdown
# NOTIVISA Wave 2 API Reference

**Version:** 2.0 (as of 2026-08-01)
**Status:** Production (legacy callables removed)

## Callables

### notivisaCreateDraft
Create a new NOTIVISA draft.
- Input: { labId, laudoId, payload }
- Output: { ok, draftId, status: 'pending', idempotent, mode, criadoEm }

### notivisaApproveDraft
Approve a draft for submission.
- Input: { labId, draftId }
- Output: { ok, draftId, status: 'approved', approvedBy, approvedAt }

### notivisaSubmitDraft
Submit an approved draft to the queue.
- Input: { labId, draftId }
- Output: { ok, draftId, eventId, status: 'pending', mode, enqueuedAt }

## Crons

### notivisaProcessQueue
Process pending queue events (async transmission to government).
- Frequency: Every 5 minutes
- Handles: retries, rate limiting, mode switching

### detectNotivisaConflicts
Monitor for mixed-mode conflicts (Phase 5+ only).
- Frequency: Every 30 minutes
- Output: warning logs to auditLogs

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `invalid-argument` | Payload validation failed | Fix payload and retry |
| `permission-denied` | User not authorized for lab | Check lab membership + role |
| `resource-exhausted` | Rate limit exceeded (10 req/min) | Wait 60 seconds, retry |
| `not-found` | Draft/lab not found | Verify draftId + labId |
| `failed-precondition` | Invalid draft state | Check status (e.g., approve needs 'pending') |
| `internal` | Server error | Contact support + include error details |
```

#### 6.4.2 Archive Migration Guide (Week 1: Jul 20–27)

**Action:**
- Rename `docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md` → `docs/notivisa/ARCHIVED.MIGRATION_LEGACY_TO_WAVE2.md`
- Add note at top: "**ARCHIVED (2026-08-01):** Legacy callables removed. This guide is historical only."
- Create new `docs/notivisa/API_REFERENCE.md` with Wave 2 only

### 6.5 Success Criteria

- [ ] Legacy callables deleted from codebase
- [ ] All Wave 2 tests pass (100%)
- [ ] Zero errors in Cloud Logs (first 24 hours post-deploy)
- [ ] <1% of requests return `not-found` (legacy callable removed)
- [ ] Audit logs show only Wave 2 action names
- [ ] Customer support reports zero migration issues

---

## Post-Phase 6: Maintenance & Optimization (Aug 1+)

### 7.1 Code Cleanup

- [ ] Delete `functions/src/modules/notivisa/__tests__/ARCHIVED.*` test files
- [ ] Remove `signatureCanonical.ts` if it's legacy-only
- [ ] Update `modules/notivisa/index.ts` to remove deprecated warning comments
- [ ] Consolidate `validators.ts` (remove legacy-specific checks)

### 7.2 Performance Optimization

**Now that Wave 2 is the only path, consider:**
- Increase rate limit from 10 to 20 req/min (if load testing shows headroom)
- Add caching for frequently accessed lab configs
- Batch queue processing (current: 5-min intervals; future: real-time with debounce)

### 7.3 Feature Additions (Phase 7+)

- [ ] Wave 2 rejection callable (rejectDraft)
- [ ] Sandbox/production mode support (currently test-mode only)
- [ ] Live transmission to NOTIVISA government API
- [ ] SLA tracking (submission time, government response time)

---

## Timeline Summary

| Phase | Dates | Key Deliverable | Owner |
|-------|-------|-----------------|-------|
| **Phase 4** | May 20 → Jun 20 | Deprecation markers, feature flag, Wave 2 launch | Engineering |
| **Phase 5** | Jun 20 → Jul 20 | Rate limiting, conflict detection, telemetry | Engineering |
| **Phase 6** | Jul 20 → Aug 1 | Code deletion, production cutover, monitoring | Engineering |
| **Post-Phase 6** | Aug 1+ | Maintenance, optimization, new features | Engineering |

---

## Sign-Off

| Role | Name | Approval | Date |
|------|------|----------|------|
| Wave 3-6 Lead | TBD | Proposed | 2026-05-08 |
| CTO | TBD | Pending | TBD |
| DevOps/Infra | TBD | Pending | TBD |
| Product/Support | TBD | Pending | TBD |

---

## Related Documents

- `LEGACY_AUDIT.md` — technical details of both implementations
- `MIGRATION_LEGACY_TO_WAVE2.md` — customer migration guide
- `LEGACY_COEXISTENCE_TESTS.md` — QA test coverage
