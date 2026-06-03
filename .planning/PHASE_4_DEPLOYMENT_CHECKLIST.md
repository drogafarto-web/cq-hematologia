# Phase 4 Deployment Checklist

**Target Date:** May 20, 2026 (8:00am UTC-3)  
**Duration:** 4 hours (8am—12pm)  
**Status:** Ready for execution

---

## Pre-Deployment Validation (May 19, EOD)

**Code Quality & Compliance**

- [ ] All TypeScript files pass `npx tsc --noEmit`
- [ ] ESLint clean: `npm run lint` with 0 new violations (baseline: 88 pre-existing)
- [ ] Unit tests passing: `npm run test` (baseline: 274 passing, NOTIVISA: +46 new = 320 total expected)
- [ ] E2E test suite: 6 critical flows passing via Cypress
- [ ] No uncommitted changes: `git status` clean

**Bundle & Performance**

- [ ] Main chunk size <365 KB (baseline: 362 KB, tolerance: +1%)
- [ ] Code-split correctly: `dist/index.js` + `dist/assets/` verified
- [ ] Lighthouse audit ≥87/100 on `/portal/dashboard` route
  - LCP <2.0s
  - INP <200ms
  - CLS <0.05
- [ ] No unused imports or dead code in functions/

**Firebase Infrastructure**

- [ ] Firestore rules syntax valid: `firebase deploy --only firestore:rules --dry-run`
- [ ] Required indexes created:
  - [ ] `notivisa-drafts`: labId + status (ascending), labId + criadoEm (descending)
  - [ ] `notivisa-queue`: status (ascending), nextRetry (ascending)
  - [ ] `notivisa-outbox`: labId (ascending), exportedBy (ascending)
- [ ] Cloud Functions code built: `cd functions && npm run build` (0 TS errors)
- [ ] Functions unit tests pass: `npm test` in functions/ directory

**Security & Secrets**

- [ ] Anvisa credentials provisioned in Secret Manager: `gcloud secrets versions access latest --secret "anvisa-credentials"`
- [ ] Environment variables set for region `southamerica-east1`
- [ ] Secrets Scanner clean: no exposed API keys in diff
  - [ ] `firebaseConfig` protected
  - [ ] `anvisaApiKey` in Secret Manager (not in code)
  - [ ] `resendApiKey` pending (Phase 4.4)
- [ ] Security rules audit complete (see `.claude/rules/notivisa-firestore-rules.md`)

**On-Call & Incident Response**

- [ ] On-call rotation configured (4-week cycle)
- [ ] Slack channels created: `#production-alerts`, `#on-call-paging`
- [ ] Runbooks printed and posted (if co-located):
  - [ ] `PHASE_4_ROLLBACK_PROCEDURES.md`
  - [ ] Cloud Logs troubleshooting guide
  - [ ] Quick reference incident response card
- [ ] CTO + tech lead confirmed available 8am—12pm UTC-3
- [ ] Escalation contacts verified in `v1.4-INCIDENT_RESPONSE_CONTACTS.md`

**Monitoring & Observability**

- [ ] Cloud Logs configured with critical alert policies (5 alerts armed):
  - [ ] P0: Unhandled exceptions (threshold: ≥3 in 5min)
  - [ ] P0: Auth failures (threshold: ≥5 failures in 5min)
  - [ ] P1: Function latency >3s (threshold: ≥10% of invocations)
  - [ ] P1: Firestore quota exceeded (any occurrence)
  - [ ] P2: Deployment failure log
- [ ] Dashboard 1 (Portal Auth Health): created and verified
- [ ] Dashboard 2 (NOTIVISA Queue Health): created and verified
- [ ] Dashboard 3 (Firestore Access): created and verified
- [ ] Dashboard 4 (System Health): created and verified
- [ ] `gcloud logging read` filters documented and tested locally

---

## Deployment Execution (May 20, 8:30am UTC-3)

**Before Starting:**

```
Gate: Have you completed ALL items in Pre-Deployment Validation?
  NO  → Stop. Fix blockers.
  YES → Proceed.
```

### Phase 4.0: Hosting (Web Client) — 2 min

```bash
# 1. Build optimized bundle
npm run build

# Expected: dist/ generated, index.html + assets/
# Check: du -k dist/index.js (should be <365 KB)

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting --project hmatologia2

# Expected: "Hosting deploy complete" message
```

**Verification:**

```bash
curl -I https://hmatologia2.web.app/portal/auth
# Expected: HTTP/1.1 200 OK
# Check: HTML contains <title>HC Quality</title>
```

**Rollback (if needed):**

```bash
git revert <commit-hash>
npm run build
firebase deploy --only hosting --project hmatologia2
```

### Phase 4.1: Firestore Rules + Indexes — 3-5 min

```bash
# 1. Deploy Firestore rules (contains NOTIVISA blocks)
firebase deploy --only firestore:rules --project hmatologia2

# Expected: "Firestore rules have been successfully published"

# 2. Monitor index creation
# Firebase auto-triggers index creation for missing indexes
# Expected: "Index creation in progress..." → "Index creation completed" (2-5 min)
# Check via GCP Console: Firestore > Indexes tab
```

**Verification:**

```bash
# List indexes (wait up to 5 min for completion)
gcloud firestore indexes list --project hmatologia2

# Expected: See all 6 notivisa-* indexes with status "READY"
```

**Rollback (if needed):**

```bash
# Revert to previous rules version
git revert <rules-commit>
firebase deploy --only firestore:rules --project hmatologia2
```

### Phase 4.2: Cloud Functions — 3-5 min

```bash
# 1. Build TypeScript functions
cd functions
npm run build

# Expected: functions/lib/ generated, 0 TS errors

# 2. Run unit tests (baseline: 46 tests)
npm test

# Expected: 46 passing
# Example: "notivisa/callables.test.ts (8 passing)"

# 3. Deploy functions
firebase deploy --only functions --project hmatologia2

# Expected: Lists all deployed functions, "Deploy complete"
# Watch for: notivisaDraftCreate, notivisaDraftSubmit, notivisaQueueProcessor, etc.
```

**Verification:**

```bash
# List deployed functions
gcloud functions list --project hmatologia2

# Expected: see notivisa* functions in southamerica-east1 region
# Check status: ACTIVE
```

**Rollback (if needed):**

```bash
# Option A: Full rollback
git revert <functions-commit>
cd functions && npm run build
firebase deploy --only functions --project hmatologia2

# Option B: Disable problematic function (faster)
# Edit functions/src/modules/notivisa/callables.ts → return error
# Redeploy just that function
firebase deploy --only functions:notivisaDraftCreate --project hmatologia2
```

### Phase 4.3: Smoke Test Suite — 15 min (Automated)

```bash
# Run comprehensive smoke test (see phase-4-smoke-test.sh)
bash .planning/scripts/phase-4-smoke-test.sh

# Expected output:
# [1/10] Hosting reachable... PASS
# [2/10] Firestore rules deployed... PASS
# [3/10] Cloud Functions deployed... PASS
# [4/10] Anvisa credentials... WARN (expected if not yet provisioned)
# [5/10] Alert policies created... PASS
# [6/10] Firestore indexes ready... PASS (or WARN if still building)
# [7/10] Auth callable works... PASS
# [8/10] E2E tests passing... PASS
# [9/10] Bundle size... PASS (<365 KB)
# [10/10] Lighthouse score... PASS (≥87)
#
# Exit Code: 0 (all checks passed)
```

**If any check fails:**

1. **STOP deployment**
2. Investigate specific failure
3. Fix in code or infrastructure
4. Redeploy only the affected component
5. Rerun smoke test
6. Do NOT proceed to monitoring phase until all checks pass

---

## Post-Deployment Monitoring (8:45am—12:30pm UTC-3, 4 hours)

**Role Assignment:**

- **Incident Commander:** CTO
- **On-Call Engineer:** Primary responder
- **Tech Lead:** Secondary, backup

### Hour 1: Immediate Health Check (8:45—9:45am)

**Dashboard 1: Portal Auth Health**

- [ ] Auth success rate >99% (check: `request.auth.token` valid)
- [ ] Login latency <500ms p95
- [ ] No spike in failed login attempts
- [ ] Email verification rate >95%

**Dashboard 2: NOTIVISA Queue Health**

- [ ] Queue processing latency <100ms p95
- [ ] No stuck events (expected completion time: <30s per event)
- [ ] Draft submission success rate >95%
- [ ] Retry count <5 per event (indicates healthy processing)

**Dashboard 3: Firestore Access**

- [ ] Patient read latency <500ms p95
- [ ] Laudo query latency <1s p95
- [ ] Index usage: all new indexes hit (not falling back to collection scan)

**Dashboard 4: System Health**

- [ ] Error rate <0.1%
- [ ] Function execution time: 90th percentile <2s
- [ ] No unhandled exceptions in Cloud Logs

**Expected Alert Silence:** 0 alerts fired

### Hour 2—3: Detailed Performance Validation (9:45—11:45am)

**Smoke Test Scenarios (Manual)**

Scenario 1: Auth Flow

```
1. User logs in at https://hmatologia2.web.app/portal/auth
2. Verify: Portal dashboard loads <2s LCP
3. Check console: no JavaScript errors
```

Scenario 2: Create NOTIVISA Draft

```
1. Auditor navigates to /portal/notivisa
2. Click "Nova Solicitação"
3. Fill form, click "Salvar Rascunho"
4. Expected: draft saved in <1s, success notification appears
5. Check Firestore: /notivisa-drafts/{labId}/drafts/{draftId} exists
```

Scenario 3: Submit NOTIVISA Draft

```
1. Open saved draft
2. Click "Enviar para ANVISA"
3. Expected: draft status → "submitted" in <2s
4. Check Firestore: /notivisa-queue/{labId}/events/{eventId} created
5. Verify: processor function runs, queue processes
```

Scenario 4: Laudo Read Access

```
1. Navigate to /portal/dashboard
2. Click "Laudos" module
3. Load patient laudo (should hit index, <1s)
4. Expected: laudo loads <2s LCP
```

Scenario 5: Export Function

```
1. Initiate PDF export from /portal/export
2. Expected: function completes <5s
3. Check Cloud Logs: export function log entry with status OK
```

Scenario 6: Admin Settings

```
1. Navigate to /portal/admin/lab-settings
2. Update NOTIVISA config (if applicable)
3. Expected: update persists <1s, no rule violations
```

**Performance Regression Check:**

- [ ] No increase in Firestore read costs (monitor: Operations/Day)
- [ ] No new rate-limiting errors
- [ ] CPU usage stable (no unexpected spikes)

### Hour 4: Incident Prevention & Sign-Off (11:45am—12:30pm)

**Cloud Logs Analysis**

1. Check for patterns in INFO/WARNING logs:

   ```bash
   gcloud logging read "resource.type=cloud_function AND severity=WARNING" \
     --limit 50 --project hmatologia2
   ```

   Expected: <5 unique warnings (transient retries are OK)

2. Check for P0/P1 errors:

   ```bash
   gcloud logging read "resource.type=cloud_function AND severity=ERROR" \
     --limit 50 --project hmatologia2
   ```

   Expected: 0 unhandled exceptions

3. Check function cold-start latency:
   ```bash
   gcloud logging read "executionId AND coldStartDuration" \
     --project hmatologia2 | grep coldStartDuration | head -10
   ```
   Expected: <1s for all cold starts

**Exit Criteria Verification**

Sign off on deployment SUCCESS only if ALL criteria met:

| Criterion              | Target     | Status   | Evidence          |
| ---------------------- | ---------- | -------- | ----------------- |
| P0 alerts fired        | 0          | [ ] Pass | Cloud Logs review |
| Unhandled exceptions   | 0          | [ ] Pass | Error logs search |
| Auth success rate      | >99%       | [ ] Pass | Dashboard 1       |
| Portal laudo load      | <2s LCP    | [ ] Pass | Lighthouse audit  |
| NOTIVISA queue latency | <100ms p95 | [ ] Pass | Dashboard 2       |
| Firestore patient read | <500ms p95 | [ ] Pass | Dashboard 3       |
| System error rate      | <0.1%      | [ ] Pass | Dashboard 4       |
| Bundle size regression | <365 KB    | [ ] Pass | Build artifact    |

**If ALL criteria met:**

```
✓ GO-LIVE APPROVED
  Announcement: "Phase 4 deployment complete. System stable."
  Action: Log sign-off in incident tracker
  Next: Begin Phase 4.1 work (email notifications, NOTIVISA integration polish)
```

**If ANY criterion NOT met:**

```
✗ INITIATE ROLLBACK
  Action: Run Phase_4_ROLLBACK_PROCEDURES.md (full rollback)
  Duration: ~10 min
  Post-mortem: Schedule incident review within 24h
  Next: Fix issue in dev, re-deploy staging, test thoroughly before retry
```

---

## Deployment Artifacts & Documentation

**Checklist Sign-Off Template** (copy to Slack post at deployment end):

```
Phase 4 Deployment — May 20, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deploy Window: 8:30am—12:30pm UTC-3
Incident Commander: [Name]
On-Call Engineer: [Name]
Tech Lead: [Name]

✓ Pre-Deployment: [# passed/# total]
✓ Hosting Deploy: [time, commit hash]
✓ Rules Deploy: [time, # indexes]
✓ Functions Deploy: [time, # functions]
✓ Smoke Test: [# passed/10]
✓ Post-Deploy Monitoring: [# hours completed]

Exit Criteria:
☐ P0 alerts: 0
☐ Unhandled exceptions: 0
☐ Auth success: >99%
☐ Portal load: <2s LCP
☐ Queue latency: <100ms p95
☐ Error rate: <0.1%

Status: [GO-LIVE APPROVED] or [ROLLBACK INITIATED]
Signed: [Name, Date/Time UTC-3]
```

---

## Runbook References

For detailed troubleshooting during deployment:

- **Rollback Decision Tree:** `PHASE_4_ROLLBACK_PROCEDURES.md` (when to rollback)
- **Smoke Test Script:** `scripts/phase-4-smoke-test.sh` (automated verification)
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_QUICK_REFERENCE.md` (alert setup, filters)
- **Incident Response:** `v1.4-INCIDENT_RESPONSE_CONTACTS.md` (escalation tree, on-call rotation)

---

## Critical Success Factors

1. **Do NOT skip any pre-deployment item.** Each item blocks a category of failures.
2. **Smoke test MUST pass 10/10 before monitoring phase starts.** Partial deployment is higher risk.
3. **Monitor 4 full hours, not 30 minutes.** Phase 4 is high-impact; latent issues surface over time.
4. **Rollback decision made at 12:30pm sharp.** Do NOT extend window beyond 4 hours without explicit CTO approval.
5. **All alert channels live before 8am.** Manual monitoring is a fallback, not primary.

---

**Ready to deploy on May 20?** Run: `bash .planning/scripts/phase-4-smoke-test.sh`
