# Phase 4 Rollback Procedures

**Decision Framework + Technical Steps**

---

## Rollback Decision Tree

### Trigger: P0 Alert Fires (Unhandled Exception / Auth Failures)

**Detection:** Cloud Logs alert policy fires with severity ERROR or auth failure count ≥5 in 5-minute window.

```
Decision: Is this new code (Phase 4 only)?
├─ YES → likely caused by Phase 4 changes
│   └─ Run: Cloud Logs search for error pattern
│       └─ If pattern matches new function: ROLLBACK
│       └─ If pattern is in existing code: INVESTIGATE (may be pre-existing)
│
└─ NO → likely pre-existing issue or environmental
    └─ INVESTIGATE without rollback
    └─ Escalate to CTO for decision
```

**Decision Window:** 5 minutes from alert firing. If root cause not identified in 5 min → ROLLBACK.

---

### Trigger: Portal Laudo Load Regression (>2s LCP)

**Detection:** Lighthouse audit or manual load test shows LCP >2.5s (regression from <2s baseline).

```
Decision: Root cause analysis
├─ Firestore query slow?
│   ├─ Check: gcloud firestore indexes list → index status READY?
│   └─ If missing: CREATE INDEX (2-5 min) → retest
│   └─ If exists but slow: profile CPU (Cloud Profiler) → fix code or ROLLBACK
│
├─ Bundle size inflated?
│   ├─ Check: du -k dist/index.js
│   └─ If >365 KB: investigate new imports → tree-shake or ROLLBACK
│
├─ Function latency?
│   ├─ Check: Cloud Logs, filter executionTime > 1000ms
│   └─ If new function slow: optimize code or ROLLBACK
│
└─ Network latency (unlikely, but check):
    ├─ Verify CDN: curl -I https://hmatologia2.web.app (check cache headers)
    └─ If CDN not caching: manual CDN purge or ROLLBACK
```

**Decision Window:** 30 minutes. If issue not fixed by root cause mitigation → ROLLBACK.

---

### Trigger: NOTIVISA Queue Stuck (>10 pending, >15 min without progress)

**Detection:** Dashboard 2 shows events with status "pending" for >15 minutes. Processor function not consuming queue.

```
Decision: Queue health check
├─ Processor function crashing?
│   ├─ Check: gcloud functions describe notivisaQueueProcessor
│   └─ Check: Cloud Logs for ERROR severity
│   └─ If crashing: ROLLBACK FUNCTIONS
│
├─ Processor function hung?
│   ├─ Check: executionTime in Cloud Logs > 30s?
│   └─ If yes: manually invoke processor (test button in GCP Console)
│   └─ Monitor: does queue start draining?
│   └─ If still stuck 30 min: ROLLBACK FUNCTIONS
│
├─ Firestore access permission issue?
│   ├─ Check: Cloud Logs for "Permission denied" or rule violation
│   └─ If yes: check rules were deployed, test rule via emulator
│   └─ If rules correct: ROLLBACK RULES
│
└─ NOTIVISA API endpoint unreachable?
    ├─ Check: Secret Manager has valid credentials
    ├─ Check: endpoint URL correct (sandbox vs production)
    └─ If connectivity issue: escalate (may need manual fix without rollback)
```

**Decision Window:** 15 minutes (plus 30 min investigation). If not resolved → ROLLBACK.

---

### Trigger: Firestore Rule Violation (Client Blocked by Rules)

**Detection:** Portal shows errors like `[permission-denied] Missing or insufficient permissions.` when user tries to read/write.

```
Decision: Rule audit
├─ Did rules deploy successfully?
│   ├─ Check: firebase deploy --only firestore:rules --dry-run
│   └─ If deploy fails: fix syntax, retry (no rollback needed, deployment incomplete)
│
├─ Are indexes live?
│   ├─ Check: gcloud firestore indexes list | grep notivisa
│   └─ If building: wait 5 min and retest
│   └─ If stuck: create index manually via GCP Console
│
├─ Does user have correct role/membership?
│   ├─ Check: /labs/{labId}/members/{userId} has status="active" and role="RT"|"AUDITOR"|"admin"
│   └─ If missing: add membership (no rollback needed)
│
├─ Is the collection path correct in rules?
│   ├─ Check: rules match actual collection structure (/notivisa-drafts/{labId}/drafts/{draftId})
│   └─ If mismatch: ROLLBACK RULES and fix
│
└─ Is a rule condition breaking?
    ├─ Emulate rule locally: firebase emulator start
    ├─ Run test rule: npm run test:firestore-rules
    └─ If test fails: fix rule logic or ROLLBACK RULES
```

**Decision Window:** 10 minutes. If rule issue not identified → ROLLBACK.

---

### Trigger: Bundle Size Regression (>365 KB)

**Detection:** `npm run build` reports dist/index.js >365 KB.

```
Decision: Bundle analysis
├─ Analyze imports: webpack-bundle-analyzer or source-map-explorer
│   ├─ If new large library (e.g. xlsx, puppeteer): remove or make lazy
│   ├─ If dead code: tree-shake (check for unused exports)
│   └─ If transitive dep bloat: update package.json constraints
│
└─ If cannot trim <365 KB in 20 min:
    └─ ROLLBACK (revert Phase 4 commits)
```

**Decision Window:** 20 minutes. If not fixed → ROLLBACK.

---

## Rollback Execution Steps

### Prerequisites

Before running any rollback:

1. **Notify Incident Commander** (CTO)
2. **Post to #production-alerts Slack:** "Rolling back Phase 4 [reason]"
3. **Record timestamp** of rollback initiation
4. **Confirm no other deploys in flight** (check firebase CLI process)

---

### Rollback Hosting Only (1 min)

**Use this if:** Web bundle has bug, not infrastructure.

```bash
# 1. Identify bad commit
COMMIT=$(git log --oneline | head -1 | awk '{print $1}')
# Expected: most recent Phase 4 commit

# 2. Revert locally
git revert --no-edit $COMMIT

# 3. Rebuild
npm run build
# Check: dist/index.js <365 KB
# Check: npm run lint passes

# 4. Deploy
firebase deploy --only hosting --project hmatologia2
# Expected: "Hosting deploy complete"

# 5. Verify
curl -I https://hmatologia2.web.app/portal/auth
# Expected: HTTP 200, title = "HC Quality"

echo "✓ Hosting rollback complete. Monitor auth success rate."
```

**Validation:**

- [ ] Auth success rate stable within 2 min
- [ ] Portal laudo loads <2s
- [ ] No new errors in Cloud Logs

---

### Rollback Firestore Rules Only (2 min)

**Use this if:** Rule logic bug (permission denied, index issue).

```bash
# 1. Identify last good rules commit
git log --oneline -- firestore.rules | head -3
# Example output:
# abc1234 deploy(rules): Phase 3 baseline
# def5678 deploy(rules): Phase 4 indexes + NOTIVISA blocks

# 2. Revert to previous version
GOOD_COMMIT=$(git log --oneline -- firestore.rules | head -2 | tail -1 | awk '{print $1}')
git show $GOOD_COMMIT:firestore.rules > firestore.rules

# 3. Deploy
firebase deploy --only firestore:rules --project hmatologia2
# Expected: "Firestore rules have been successfully published"
# Note: No downtime, immediate effect

# 4. Verify via emulator
firebase emulator:start --only firestore

# In another terminal:
npm run test:firestore-rules
# Expected: all tests pass

echo "✓ Firestore rules rollback complete. Immediate effect."
```

**Validation:**

- [ ] Client permission errors resolve within 1 min
- [ ] User can read/write again
- [ ] No rule violation logs in Cloud Logs

---

### Rollback Cloud Functions Only (5 min, higher risk)

**Use this if:** Specific function crashes (e.g. notivisaDraftCreate).

```bash
# Option A: Full function code rollback (safest)
# ─────────────────────────────────────────

# 1. Identify bad commit
COMMIT=$(git log --oneline -- functions/src | head -1 | awk '{print $1}')

# 2. Revert
git revert --no-edit $COMMIT

# 3. Rebuild
cd functions
npm run build
# Expected: 0 TS errors
# Expected: npm test passes (46 tests)

# 4. Deploy
firebase deploy --only functions --project hmatologia2
# Expected: lists all functions, final status OK

# 5. Verify
firebase functions:log --region southamerica-east1 --limit 10
# Expected: no ERROR entries

echo "✓ Functions rollback complete."

# Option B: Disable problematic function only (faster, partial)
# ─────────────────────────────────────────────────────────

# 1. Edit the failing function to reject all calls
# Example: functions/src/modules/notivisa/callables.ts
cat > functions/src/modules/notivisa/callables.ts.tmp << 'EOF'
export const notivisaDraftCreate = https.onCall(async (data, context) => {
  throw new HttpsError('unavailable', 'Function temporarily disabled for rollback. Try again in 5 minutes.');
});
EOF

# 2. Rebuild and deploy just this function
cd functions
npm run build
firebase deploy --only functions:notivisaDraftCreate --project hmatologia2

# 3. Revert code change (still deploying previous version)
git restore functions/src/modules/notivisa/callables.ts

echo "✓ Function disabled. Fix issue and re-deploy."

# Option C: Manual disable via GCP Console (emergency)
# ─────────────────────────────────────────────────────
# 1. Go to GCP Console > Cloud Functions
# 2. Find notivisaDraftCreate
# 3. Click "More" (⋯) > "Edit"
# 4. Append to function body:
#    if (1) throw new Error('Disabled');
# 5. Click Deploy
# Note: Takes 2-3 min, use only if CLI is broken
```

**Validation:**

- [ ] Function invocation returns error (expected during rollback)
- [ ] Processor function (if that wasn't rolled back) still works
- [ ] Cloud Logs show controlled error (not crash)

---

### Rollback Rules + Functions (5 min)

**Use this if:** Both rules and functions have issues (likely phase-level bug).

```bash
# 1. Revert both rules and functions commits
RULES_COMMIT=$(git log --oneline -- firestore.rules | head -1 | awk '{print $1}')
FUNC_COMMIT=$(git log --oneline -- functions/src | head -1 | awk '{print $1}')

git revert --no-edit $RULES_COMMIT $FUNC_COMMIT

# 2. Rebuild
npm run build
cd functions && npm run build && npm test
# Expected: 46 tests pass

# 3. Deploy both
firebase deploy --only firestore:rules,functions --project hmatologia2
# Expected: rules published, functions deployed

# 4. Verify
npm run test:firestore-rules
firebase functions:log --region southamerica-east1 --limit 5

echo "✓ Rules + Functions rollback complete."
```

---

### Full Rollback (All Phase 4 Components, 10 min)

**Use this if:** Multiple component failures or root cause is architectural.

```bash
# 1. List all Phase 4 commits
git log --oneline v1.3..HEAD | head -20
# Example:
# abc1234 feat(notivisa): Cloud Functions Phase 4
# def5678 feat(notivisa): Firestore rules + indexes
# ghi9012 feat(notivisa): Portal UI
# jkl3456 chore: Phase 4 dependencies

# 2. Revert all Phase 4 work (you may revert one commit if all Phase 4 is in one, or multiple)
# If separate commits:
git revert --no-edit abc1234 def5678 ghi9012

# Or: revert to known good state
git log --oneline | grep "Phase 3\|v1.3\|COMPLETE"
# Find last Phase 3 commit
PHASE3_COMMIT="b0f9e2d"
git reset --hard $PHASE3_COMMIT

# 3. Rebuild everything
npm run build
cd functions && npm run build && npm test
# Expected: no new errors, 274 unit tests pass (Phase 3 baseline)

# 4. Deploy all
firebase deploy --only hosting,firestore:rules,functions --project hmatologia2
# Expected: all three components deployed successfully

# 5. Verify
bash .planning/scripts/phase-4-smoke-test.sh
# Expected: 10/10 pass (Phase 3 baseline)

echo "✓ Full rollback to Phase 3 complete. System stable."
```

**Post-Full-Rollback Actions:**

1. Notify team: "Full rollback to Phase 3 baseline. Phase 4 on hold."
2. Create incident ticket: "Phase 4 rollback incident"
3. Root cause analysis: Schedule 24h post-mortem
4. Do NOT re-attempt Phase 4 deployment same day

---

## Post-Rollback Monitoring

**Duration:** 1 hour

**Metrics to watch:**

| Metric            | Target     | Monitor           |
| ----------------- | ---------- | ----------------- |
| Auth success rate | >99%       | Dashboard 1       |
| Portal load time  | <2s LCP    | Browser dev tools |
| Error rate        | <0.1%      | Cloud Logs        |
| Firestore latency | <500ms p95 | Dashboard 3       |

**Expected outcome:** Within 1 min, all metrics return to Phase 3 baseline.

**If metrics still degraded after rollback:**

- Investigate pre-existing issues (may have been masked during Phase 3)
- Escalate to CTO
- May require additional infrastructure rollback (e.g., database snapshot restore)

---

## Rollback Checklist

**Before Rolling Back**

- [ ] Incident Commander (CTO) approves
- [ ] Root cause identified (or suspected)
- [ ] Decision made: which component(s) to rollback
- [ ] Slack notification posted to #production-alerts
- [ ] No concurrent deployments in progress

**During Rollback**

- [ ] Run rollback command (Hosting / Rules / Functions / All)
- [ ] Monitor: deployment logs in Firebase Console
- [ ] Verify: test the rolled-back component
- [ ] Check: Cloud Logs for errors
- [ ] Confirm: user-facing system stable (smoke test)

**After Rollback (1 hour post)**

- [ ] All 4 dashboards show healthy metrics
- [ ] 0 new error logs in Cloud Logs
- [ ] Auth success rate >99%
- [ ] Portal load <2s LCP
- [ ] NOTIVISA queue cleared (if applicable)

**Sign-Off**

```
Rollback Completed
──────────────────
Date/Time: [UTC-3]
Component(s) Rolled Back: [Hosting / Rules / Functions / All]
Reason: [specific trigger]
Reverted to Commit: [hash]
Status: [System Stable / Degraded / Escalated]
Incident Ticket: [URL]
Post-Mortem Scheduled: [Date/Time]
Signed by: [Name, Role]
```

---

## Prevention Checklist for Next Attempt

**Before re-deploying Phase 4:**

- [ ] Root cause of rollback fixed in code
- [ ] Additional unit tests added (cover the regression)
- [ ] Staging environment tested end-to-end (full smoke test)
- [ ] Code review by CTO + tech lead
- [ ] All pre-deployment validation items passing
- [ ] > 24 hours elapsed since rollback (cool-down period)

---

**Runbook References:**

- **Deployment Checklist:** `PHASE_4_DEPLOYMENT_CHECKLIST.md`
- **Smoke Test Script:** `scripts/phase-4-smoke-test.sh`
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_QUICK_REFERENCE.md`
- **Incident Response:** `v1.4-INCIDENT_RESPONSE_CONTACTS.md`

**Contact:** On-call engineer (check `v1.4-INCIDENT_RESPONSE_CONTACTS.md` for rotation).
