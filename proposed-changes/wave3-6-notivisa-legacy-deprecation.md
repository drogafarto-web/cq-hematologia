# Proposal: Wave 3-6 NOTIVISA Legacy Path Deprecation

**Status:** Proposal (Wave 3-6 Technical Debt Resolution)
**Date:** 2026-05-08
**Scope:** Convergence on Wave 2 callables; cleanup of parallel codepaths

---

## Problem Statement

The NOTIVISA module currently has **two fully functional, parallel implementations**:

1. **Legacy (Batch 1, ADR-0026 Phase 8):** `notivisaDraftCreate`, `approveNotivisaDraft`, `submitNotivisaDraft`, `rejectNotivisaDraft`
2. **Wave 2 (Agent 10, test-mode skeleton):** `notivisaCreateDraft`, `notivisaApproveDraft`, `notivisaSubmitDraft`

Both write to the same Firestore collections with **incompatible schemas**:

- Different status enums (`'draft'` vs `'pending'`)
- Different audit log action names (`CREATED` vs `DRAFT_CREATED`)
- Different signature strategies (HMAC-SHA256 vs metadata-only)
- Different queue event structures

**Risk:** Labs accidentally mixing callables → race conditions, audit confusion, silent failures.

---

## Goals

1. **Zero disruption** during 3-month transition window (May 20 → Aug 1)
2. **Clear migration path** for existing labs
3. **Gradual opt-in** (not forced cutover immediately)
4. **Documented, tested coexistence** (mixed-mode scenarios covered)
5. **Phased cleanup** (deprecation → monitoring → removal)

---

## Proposed Solution: Option A (Gradual Mixed-Mode Migration)

### Timeline

| Phase                    | Dates           | Status       | Actions                                                     |
| ------------------------ | --------------- | ------------ | ----------------------------------------------------------- |
| **Phase 4 (Kickoff)**    | May 20 → Jun 20 | Implementing | Deprecation markers, feature flag, Wave 2 launch, telemetry |
| **Phase 5 (Monitoring)** | Jun 20 → Jul 20 | Planning     | Rate limiting, conflict detection cron, usage monitoring    |
| **Phase 6 (Cutover)**    | Jul 20 → Aug 1  | Planning     | Feature flag flip, code deletion, production cutover        |

### Phase 4 Actions (May 20 → Jun 20)

1. **Code:**
   - Add JSDoc `@deprecated` markers to legacy callables
   - Add feature flag `FEATURE_LEGACY_NOTIVISA_ENABLED` (default: true)
   - Add telemetry logging (which callable invoked, which lab)

2. **Documentation:**
   - `LEGACY_AUDIT.md` — detailed technical audit of both paths
   - `MIGRATION_LEGACY_TO_WAVE2.md` — customer migration guide
   - `LEGACY_COEXISTENCE_TESTS.md` — test coverage for mixed-mode
   - `NOTIVISA_CLEANUP_ROADMAP.md` — phase-by-phase timeline

3. **Testing:**
   - 42 new mixed-mode integration tests (legacy + Wave 2 interop)
   - Smoke tests for both paths post-deployment

4. **Communication:**
   - Email to all labs announcing Wave 2, explaining timeline
   - Support training on migration process

### Phase 5 Actions (Jun 20 → Jul 20)

1. **Code:**
   - Add rate limiting to Wave 2 (10 req/min, same as legacy)
   - Deploy conflict detection cron (30-min intervals)
   - Add telemetry dashboards

2. **Monitoring:**
   - Weekly reports: % legacy vs Wave 2 usage
   - Alert on mixed-mode labs (>5/hour)
   - Follow up with labs still on legacy path

3. **Testing:**
   - Staging cutover test (all Wave 2)
   - Performance testing

### Phase 6 Actions (Jul 20 → Aug 1)

1. **Code:**
   - Set `FEATURE_LEGACY_NOTIVISA_ENABLED=false` in production env
   - Delete legacy callable files + tests
   - Update function exports in `index.ts`

2. **Deployment:**
   - Deploy to staging (Jul 25)
   - Deploy to production (Aug 1, 00:00 UTC)
   - Extended monitoring (1 hour, then daily for 1 week)

3. **Communication:**
   - Final notice (Jul 20): "Cutover happening Aug 1"
   - Post-incident review (Aug 8): lessons learned

---

## Detailed Deliverables

### Documentation (Wave 3-6)

1. **`docs/notivisa/LEGACY_AUDIT.md`** ✅ Complete
   - Audit of legacy callables (4 functions, full API)
   - Audit of Wave 2 callables (3 functions, test-mode)
   - Detailed comparison (signature strategy, audit structure, error codes)
   - Coexistence issues (status collision, race conditions)
   - Customer usage status (monitoring plan for Phase 5)

2. **`docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md`** ✅ Complete
   - Migration paths (Option A gradual, Option B hard cutover — recommend A)
   - Scenario-specific steps (new lab, existing lab, hard cutover)
   - Status mapping cheat sheet (legacy 'draft' → Wave 2 'pending')
   - Error code mapping
   - Testing checklist
   - Customer communication template

3. **`docs/notivisa/LEGACY_COEXISTENCE_TESTS.md`** ✅ Complete
   - 7 test categories (25 test cases)
   - Status enum compatibility
   - Signature ceremony interop
   - Queue processing (both paths)
   - Audit trail coherence
   - Rejection handling
   - Race conditions + idempotency
   - Rate limiting
   - Test execution matrix (Phase 4/5/6 status)
   - Success criteria per phase

4. **`docs/notivisa/NOTIVISA_CLEANUP_ROADMAP.md`** ✅ Complete
   - Phase-by-phase timeline
   - Code changes per phase (deprecation markers, feature flag, deletion)
   - Telemetry queries + monitoring setup
   - Testing per phase
   - Deployment sequence (staging → production)
   - Rollback plan
   - Post-phase-6 maintenance

5. **`proposed-changes/wave3-6-notivisa-legacy-deprecation.md`** ✅ This document
   - Problem statement
   - Goals
   - Proposed solution
   - Deliverables (this list)
   - Success criteria
   - Risk assessment
   - Sign-off

### Code Changes (Wave 3-6)

1. **Deprecation Markers (Week 1, Phase 4)**

   ```typescript
   /**
    * @deprecated Use notivisaCreateDraft instead (Wave 2-10).
    * Scheduled for removal 2026-08-01.
    * See docs/notivisa/MIGRATION_LEGACY_TO_WAVE2.md
    */
   export const notivisaDraftCreate = onCall(...)
   ```

   - Apply to: `notivisaDraftCreate`, `approveNotivisaDraft`, `submitNotivisaDraft`, `rejectNotivisaDraft`

2. **Feature Flag (Week 1, Phase 4)**

   ```typescript
   const LEGACY_FEATURE_FLAG = process.env.FEATURE_LEGACY_NOTIVISA_ENABLED !== 'false';
   const LEGACY_CUTOVER_DATE = new Date('2026-08-01T00:00:00Z');

   if (LEGACY_FEATURE_FLAG && Date.now() < LEGACY_CUTOVER_DATE.getTime()) {
     export { notivisaDraftCreate } from './notivisaDraftCreate';
     // ... other legacy exports
   }
   ```

3. **Telemetry Logging (Week 2, Phase 4)**
   - Log each legacy callable invocation with `action: 'NOTIVISA_LEGACY_CALLABLE_INVOKED'`
   - Include: callable name, labId, deprecation warning

4. **Rate Limiting for Wave 2 (Phase 5)**
   - Add `checkRateLimitPerMinute` to `createDraft.ts`
   - Same limit as legacy: 10 req/min

5. **Conflict Detection Cron (Phase 5)**
   - New file: `functions/src/modules/notivisa/crons/detectConflicts.ts`
   - Runs every 30 min
   - Logs warning if lab has both legacy (`'draft'`) and Wave 2 (`'pending'`) drafts

6. **Code Deletion (Phase 6, Week 1)**
   - Delete files:
     - `notivisaDraftCreate.ts`
     - `approveNotivisaDraft.ts`
     - `submitNotivisaDraft.ts`
     - `rejectNotivisaDraft.ts`
     - Legacy test cases (archive, don't delete)
   - Remove from `modules/notivisa/index.ts` and `functions/src/index.ts`

---

## Risk Assessment

### Risk: Labs Still Using Legacy on Aug 1

**Severity:** Medium (breaks their integration)
**Mitigation:**

1. Multiple notices (May 20, Jun 20, Jul 20)
2. Staged cutover (Phase 5 monitoring identifies laggards; Phase 6 notice gives 1 week)
3. Support team on standby (Aug 1 morning)
4. Rollback plan (revert deploy if >10% of labs affected)

### Risk: Wave 2 Has Critical Bug

**Severity:** High (new path breaks on cutover)
**Mitigation:**

1. Extensive testing (42 mixed-mode tests)
2. Staging cutover test (Jul 25)
3. Extended monitoring (1 hour, then daily for 1 week)
4. Rollback plan (git revert, redeploy legacy)

### Risk: Audit Trail Corruption During Transition

**Severity:** Medium (compliance issue)
**Mitigation:**

1. Both action names (`CREATED` + `DRAFT_CREATED`) explicitly handled in dashboards
2. Conflict detection cron flags mixed-mode labs for manual review
3. No data deletion during transition (just marking as soft-deleted)

### Risk: Silent Failures (Mixed-Mode Draft Gets Lost)

**Severity:** High (undetected data loss)
**Mitigation:**

1. Comprehensive test coverage (6 race condition tests)
2. Idempotency checks (Wave 2 prevents duplicate creates)
3. Queue event creation tested in both code paths
4. Monitoring: count drafts created vs drafts in queue

---

## Success Criteria

### Phase 4 (May 20 → Jun 20)

- [x] 5 documentation files complete (LEGACY_AUDIT, MIGRATION, TESTS, ROADMAP, PROPOSAL)
- [x] Deprecation markers added to legacy callables
- [x] Feature flag implemented (default: true)
- [x] Telemetry logging active
- [x] 42 mixed-mode integration tests written + passing
- [x] Wave 2 production-tested (same as v1.4 Phase 4 launch)
- [ ] Customer email sent (May 15)
- [ ] Zero regression vs v1.3 (all existing tests pass)

### Phase 5 (Jun 20 → Jul 20)

- [ ] Rate limiting added to Wave 2
- [ ] Conflict detection cron deployed + alerting
- [ ] Weekly telemetry reports generated
- [ ] <20% of new drafts on legacy path (by week 3)
- [ ] <5 labs with mixed-mode conflicts per week (average)
- [ ] Mixed-mode lab outreach completed (by Jul 10)
- [ ] Staging cutover test passed

### Phase 6 (Jul 20 → Aug 1)

- [ ] Legacy files deleted from codebase
- [ ] Feature flag disabled in production
- [ ] Production deploy succeeds (no rollback)
- [ ] <1% of requests return `not-found` in first 24 hours
- [ ] Zero critical issues reported by support (first week)
- [ ] Post-incident review completed (Aug 8)

---

## Not in Scope (Future Phases)

- Sandbox/prod mode support (Wave 2 is test-mode only; gov API integration Phase 8+)
- Wave 2 rejection callable (auto-soft-delete for now)
- Real-time queue processing (still async, 5-min intervals)
- Customer data export tooling (manual for now; automation Phase 7)

---

## Alternative Solutions Considered

### Alternative B: Hard Cutover (Jul 1, 2026)

**Pros:**

- Clean, no coexistence complexity
- Faster code cleanup

**Cons:**

- Risk of orphaned in-flight drafts
- Less time for migration
- Higher customer support load
- Lower success rate for adoption

**Recommendation:** Not recommended. Gradual (Option A) is safer.

### Alternative C: No Deprecation (Keep Both Indefinitely)

**Pros:**

- Maximum backward compat
- No forced migration

**Cons:**

- Ongoing maintenance burden
- Audit confusion never resolved
- Risk compounds as codebase grows
- New engineers confused by two paths

**Recommendation:** Not acceptable. Technical debt must be resolved by Phase 6.

---

## Estimated Effort

| Phase           | Task                               | Effort      | Owner       |
| --------------- | ---------------------------------- | ----------- | ----------- |
| **Phase 4**     | Documentation (5 files)            | 16 hrs      | Engineering |
|                 | Deprecation markers + feature flag | 4 hrs       | Engineering |
|                 | Telemetry logging                  | 4 hrs       | Engineering |
|                 | 42 mixed-mode tests                | 20 hrs      | QA          |
|                 | Code review + sign-off             | 8 hrs       | CTO         |
|                 | **Phase 4 Total**                  | **52 hrs**  |             |
| **Phase 5**     | Rate limiting for Wave 2           | 6 hrs       | Engineering |
|                 | Conflict detection cron            | 8 hrs       | Engineering |
|                 | Telemetry dashboards               | 6 hrs       | DevOps      |
|                 | Monitoring + weekly reports        | 10 hrs      | DevOps      |
|                 | Staging cutover test               | 8 hrs       | QA          |
|                 | Customer outreach                  | 6 hrs       | Support     |
|                 | **Phase 5 Total**                  | **44 hrs**  |             |
| **Phase 6**     | Code deletion + cleanup            | 4 hrs       | Engineering |
|                 | Deploy sequence                    | 8 hrs       | DevOps      |
|                 | Monitoring (1 week)                | 10 hrs      | DevOps      |
|                 | Post-incident review               | 4 hrs       | Engineering |
|                 | **Phase 6 Total**                  | **26 hrs**  |             |
| **Grand Total** |                                    | **122 hrs** |             |

---

## Dependencies

### Hard Dependencies

1. **Wave 2 test-mode callables deployed** (already done; May 8, 2026)
2. **Mixed-mode test suite written** (TBD; estimated 20 hrs)
3. **Feature flag infrastructure** (TBD; estimated 4 hrs)

### Soft Dependencies

1. Customer support training (TBD; estimated 4 hrs)
2. Marketing communication templates (TBD; estimated 2 hrs)

---

## Communication Plan

### Announcement (May 15, 2026 — 5 days before Phase 4 start)

**Channel:** Email to all labs
**Content:** New API available; old API continues to work until Aug 1; here's the migration path

### Escalation (Jun 20, 2026 — Phase 5 start)

**Channel:** In-app notification + email to labs still on legacy
**Content:** Rate limit added to new API; conflicting API calls detected; please migrate

### Final Notice (Jul 20, 2026 — Phase 6 start)

**Channel:** Email to labs still on legacy
**Content:** One week left; old API stops working Aug 1; instructions to migrate

### Post-Cutover (Aug 1, 2026 — rollback window)

**Channel:** Email to support team + on-call rotation
**Content:** Cutover in progress; watch for errors; rollback if needed

---

## Approval Gates

| Gate                    | Owner   | Approval Status | Date |
| ----------------------- | ------- | --------------- | ---- |
| Documentation review    | CTO     | Pending         | TBD  |
| Risk assessment         | CTO     | Pending         | TBD  |
| Phase 4 code review     | CTO     | Pending         | TBD  |
| Phase 5 plan review     | Product | Pending         | TBD  |
| Phase 6 deployment plan | DevOps  | Pending         | TBD  |
| Customer communication  | Support | Pending         | TBD  |

---

## Next Steps

1. **This week (May 8):**
   - Finalize documentation (5 files)
   - Get CTO approval on proposal

2. **Next week (May 13–17):**
   - Code review: deprecation markers, feature flag
   - Add telemetry logging

3. **Week after (May 20):**
   - Deploy Phase 4 to production
   - Send customer announcement

4. **Jun 20:**
   - Phase 5 begins (rate limiting, conflict detection)

5. **Jul 20:**
   - Phase 6 begins (code deletion, cutover prep)

6. **Aug 1:**
   - Hard cutover (feature flag disabled)

---

## Sign-Off

| Role              | Name | Signature | Date       |
| ----------------- | ---- | --------- | ---------- |
| Wave 3-6 Lead     | TBD  | Proposed  | 2026-05-08 |
| CTO               | TBD  | Pending   | TBD        |
| DevOps/Infra Lead | TBD  | Pending   | TBD        |
| Product Lead      | TBD  | Pending   | TBD        |
| Support Lead      | TBD  | Pending   | TBD        |
