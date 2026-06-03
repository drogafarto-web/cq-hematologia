# Phase 4 Deployment Runbook — NOTIVISA + Portal (May 20, 2026)

**Deployment Date:** May 20, 2026  
**Deployment Window:** 08:30–12:30 UTC-3 (4 hours)  
**Region:** `southamerica-east1`  
**Project ID:** `hmatologia2`  
**Status:** Ready for execution

---

## Pre-Deployment (May 19, EOD)

### 1. Code Quality & Compliance

```bash
# 1.1 Type-check
npx tsc --noEmit
# Expected: 0 errors

# 1.2 Lint
npm run lint
# Expected: 88 baseline warnings (no new violations)

# 1.3 Unit tests
npm run test
# Expected: 320+ tests passing (274 Phase 3 baseline + 46 Phase 4 new)

# 1.4 E2E tests
npm run test:e2e -- --spec "src/__tests__/e2e/phase-4-critical-flows.test.ts"
# Expected: 6 critical flows passing

# 1.5 Check for uncommitted changes
git status
# Expected: clean working tree
```

### 2. Firebase Infrastructure

```bash
# 2.1 Validate Firestore rules (dry run)
firebase deploy --only firestore:rules --dry-run --project hmatologia2
# Expected: "... would update firestore:rules"

# 2.2 List indexes (verify pre-existing ones)
gcloud firestore indexes list --project hmatologia2
# Expected: See all indexes with status READY

# 2.3 Build functions
cd functions
npm run build
# Expected: functions/lib/ generated, 0 TS errors, npm test passes

cd ..
```

### 3. Bundle & Performance

```bash
# 3.1 Build web
npm run build
# Expected: dist/ generated, index.js + assets/

# 3.2 Check bundle size
du -h dist/index.js
# Expected: <365 KB gzip (use: ls -lh dist/assets/ to see actual)

# 3.3 Lighthouse audit (local)
npm run lighthouse -- https://hmatologia2.web.app/portal/dashboard
# Expected: Score ≥87, LCP <2.0s, INP <200ms, CLS <0.05
```

### 4. Secrets & Environment

```bash
# 4.1 Verify secrets are provisioned
bash scripts/preflight-secrets-check.sh
# Expected: Exit code 0 (all secrets GREEN)

# If any secret is PENDING, set it:
firebase functions:secrets:set anvisa_api_key --project hmatologia2
# Paste value from Secret Manager

# 4.2 Verify Firestore security rules are correct
cat firestore.rules | grep -A 20 "notivisa-drafts"
# Expected: Contains NOTIVISA blocks (rules for drafts, queue, outbox)
```

### 5. Team Readiness

- [ ] Incident Commander (CTO) available 08:30–12:30 UTC-3
- [ ] On-Call Engineer #1 + #2 confirmed
- [ ] On-call rotation active (SMS pager tested)
- [ ] Slack channels created: `#production-alerts` + `#on-call-paging`
- [ ] Runbooks printed + posted (or link in Slack pinned)
- [ ] Lab Director (auditor) available for post-deployment validation

---

## Deployment Execution (May 20, 08:30 UTC-3)

### GATE: Pre-Deployment Checklist

```
Before proceeding, verify:
  ✓ All code quality checks passing (TSC, Lint, Tests)
  ✓ All Firebase infrastructure ready (rules, indexes, secrets)
  ✓ All performance metrics within target
  ✓ Team available and on-call rotation active

If ANY item is not ✓, STOP and fix before proceeding.
```

### Phase 4.0: Hosting (Web Client) — 2 min

**Deploy to Firebase Hosting:**

```bash
# 1. Build (already done in pre-checks, but rebuild to be safe)
npm run build
# Expected: dist/ generated, no errors

# 2. Deploy
firebase deploy --only hosting --project hmatologia2
# Expected: "Deploy complete!" message with deployment URL

# 3. Verify (critical)
curl -s https://hmatologia2.web.app/portal/auth | grep -o '<title>.*</title>'
# Expected: <title>HC Quality</title> (or similar)

# 4. Browser smoke test (manual)
# Open: https://hmatologia2.web.app/portal/dashboard
# Expected: Page loads <2 seconds (check DevTools), no errors in console
```

**If hosting deploy fails:**

- Check build output for errors
- Run `npm run build` locally to reproduce
- Do NOT retry deploy until error is fixed

---

### Phase 4.1: Firestore Rules + Indexes — 3–5 min

**Deploy Firestore rules and indexes:**

```bash
# 1. Deploy rules
firebase deploy --only firestore:rules --project hmatologia2
# Expected: "Firestore rules have been successfully published"

# 2. Monitor indexes (takes 2–5 min to build)
echo "Waiting for indexes to build..."
for i in {1..30}; do
  INDEX_STATUS=$(gcloud firestore indexes list --project hmatologia2 | grep notivisa | grep -c "READY")
  if [ "$INDEX_STATUS" -eq "6" ]; then
    echo "✓ All NOTIVISA indexes are READY"
    break
  fi
  echo "  Indexes building... ($i/30)"
  sleep 10
done

# 3. Verify all 6 indexes are created
gcloud firestore indexes list --project hmatologia2 | grep notivisa
# Expected output:
#   notivisa-drafts/drafts (labId, status) — READY
#   notivisa-drafts/drafts (labId, criadoEm) — READY
#   notivisa-queue/events (status, nextRetry) — READY
#   notivisa-queue/events (createdAt) — READY
#   notivisa-outbox/archives (labId, exportedBy) — READY
#   ... (additional indexesfor composite queries)
```

**If rule deploy fails:**

- Check syntax: `firebase emulator:start --only firestore` then `npm run test:firestore-rules`
- If syntax error: fix in code, redeploy
- Do NOT proceed to functions until rules are valid

---

### Phase 4.2: Cloud Functions — 3–5 min

**Deploy Cloud Functions:**

```bash
# 1. Rebuild functions
cd functions
npm run build
# Expected: functions/lib/ generated, 0 TS errors

# 2. Run unit tests
npm test
# Expected: 46 tests passing (Phase 4 NOTIVISA tests)
# Example: "notivisa/callables.test.ts (8 passing)"

# 3. Deploy functions
cd .. && firebase deploy --only functions --project hmatologia2
# Expected: Lists all deployed functions, "Deploy complete!" at end
# Watch for: notivisaDraftCreate, submitNotivisa, notivisaQueueProcessor, etc.

# 4. Verify functions deployed
gcloud functions list --project hmatologia2 --region southamerica-east1 | grep notivisa
# Expected: See all notivisa functions with status ACTIVE
```

**If function deploy fails:**

- Check Cloud Logs for errors: `gcloud functions log list --project hmatologia2 --region southamerica-east1`
- If TypeScript error: fix in code, rebuild, redeploy
- If runtime error: check function logs, fix code, redeploy

---

### Phase 4.3: Feature Flag Setup — 2 min

**Create feature flag in Firestore (initial state: 0% rollout):**

```bash
# 1. Create feature flag document
cat > /tmp/notivisa-flag.json << 'EOF'
{
  "id": "notivisa-rollout",
  "name": "NOTIVISA Gradual Rollout",
  "enabled": true,
  "rolloutPercentage": 0,
  "rolloutBuckets": {
    "type": "percentage",
    "labIdWhitelist": ["lab-internal-test-1", "lab-internal-test-2"]
  },
  "createdAt": "2026-05-20T08:30:00Z",
  "updatedAt": "2026-05-20T08:30:00Z",
  "updatedBy": "cto-uid",
  "config": {
    "maxRetries": 5,
    "timeoutMs": 30000,
    "apiEndpoint": "https://anvisa-sandbox.gov.br"
  }
}
EOF

# 2. Create in Firestore (via gcloud or manual)
# Option A: Via gcloud firestore
gcloud firestore documents create featureFlags/notivisa-rollout \
  --data="$(cat /tmp/notivisa-flag.json | jq -c '.')" \
  --project hmatologia2

# Option B: Via GCP Console
# Go to: Firestore Console > Create Document > Collection: featureFlags
# Document ID: notivisa-rollout
# Paste fields from /tmp/notivisa-flag.json

# 3. Verify flag created
gcloud firestore documents get featureFlags/notivisa-rollout --project hmatologia2
# Expected: JSON output with rolloutPercentage = 0
```

---

### Phase 4.4: Smoke Test Suite — 15 min

**Run automated smoke tests:**

```bash
# 1. Run comprehensive smoke test
bash .planning/scripts/phase-4-smoke-test.sh

# Expected output (example):
# ────────────────────────────────────────
# Phase 4 Smoke Test Results
# ────────────────────────────────────────
# [1/10] Hosting reachable ...................... PASS
# [2/10] Firestore rules deployed .............. PASS
# [3/10] Cloud Functions deployed .............. PASS
# [4/10] Anvisa credentials .................... WARN (expected Phase 4)
# [5/10] Alert policies created ................ PASS
# [6/10] Firestore indexes ready ............... PASS
# [7/10] Auth callable works ................... PASS
# [8/10] E2E tests passing ..................... PASS
# [9/10] Bundle size <365 KB ................... PASS
# [10/10] Lighthouse score ≥87 ................ PASS
# ────────────────────────────────────────
# Exit Code: 0 ✓ ALL PASSED
```

**If any smoke test fails:**

1. **STOP all further deployment**
2. Investigate specific failure
3. Fix in code or infrastructure
4. Redeploy only affected component
5. Rerun smoke test
6. Do NOT proceed to monitoring until all 10 pass

**If 8/10 pass (non-critical failures):**

- If failures are in non-critical items (e.g., "Anvisa credentials WARN"), you may proceed
- Document which items are expected to WARN in Phase 4
- Re-check those items in Phase 12 (real gov API)

---

## Post-Deployment Monitoring (08:45–12:30 UTC-3)

### Hour 1: Immediate Health Check (08:45–09:45 UTC-3)

**Dashboard 1: Portal Auth Health**

- [ ] Auth success rate >99% (check: token generation rate, email delivery)
- [ ] Login latency <500ms p95
- [ ] No spike in failed login attempts (baseline: <1% errors)
- [ ] Session duration stable (no unexpected timeouts)

**Dashboard 2: NOTIVISA Queue Health**

- [ ] Queue entries: 0 pending >15 minutes (expected 0 in Phase 4 since rollout=0%)
- [ ] Processor function healthy (no errors in Cloud Logs)
- [ ] Draft submission form loads <2s

**Dashboard 3: Firestore Access**

- [ ] Patient read latency <500ms p95
- [ ] Laudo query latency <1s p95
- [ ] Index usage: confirm new indexes hit (no collection scans)

**Dashboard 4: System Health**

- [ ] Error rate <0.1% (baseline)
- [ ] Function execution time p90 <2s
- [ ] No unhandled exceptions in Cloud Logs

**Expected Alert Silence:** 0 alerts should fire in Hour 1

---

### Hour 2–3: Detailed Scenario Validation (09:45–11:45 UTC-3)

**Scenario 1: Portal Auth Flow**

```
1. Navigate to https://hmatologia2.web.app/portal/auth
2. Enter test patient email
3. Click "Enviar Link de Acesso"
4. Check email (should arrive <1 min)
5. Click link, verify dashboard loads <2s LCP
6. Check console: NO JavaScript errors
7. Result: ✓ PASS or ✗ FAIL
```

**Scenario 2: Create NOTIVISA Draft (0% rollout)**

```
1. Login as Auditor
2. Navigate to /portal/notivisa
3. Expected: UI shows "NOTIVISA Coming Soon" (rollout=0%)
4. Click "Nova Solicitação" (should be disabled or show message)
5. Result: ✓ PASS or ✗ FAIL
```

**Scenario 3: NOTIVISA Queue Processor Healthcheck**

```
1. Check Cloud Logs: gcloud logging read "functionName=notivisaQueueProcessor" \
     --project hmatologia2 --limit 10
2. Expected: No ERROR entries (INFO logs OK)
3. Verify processor ran in last 5 minutes
4. Result: ✓ PASS or ✗ FAIL
```

**Scenario 4: Laudo Read Access Performance**

```
1. Login as Auditor
2. Navigate to /portal/dashboard
3. Click "Laudos" module
4. Load a patient laudo (should hit index, <1s)
5. Check DevTools Network: verify index-backed query <500ms
6. Result: ✓ PASS or ✗ FAIL
```

**Scenario 5: Portal UI Responsiveness**

```
1. Test on desktop: 1920×1080
2. Test on tablet: 768×1024
3. Test on mobile: 375×667
4. Expected: Buttons clickable, text readable, dark theme consistent
5. Result: ✓ PASS or ✗ FAIL
```

**Scenario 6: Error Handling**

```
1. Stop internet connection (or DevTools throttle)
2. Try to load /portal/dashboard
3. Expected: Shows offline message, not blank page
4. Resume connection, page recovers
5. Result: ✓ PASS or ✗ FAIL
```

---

### Hour 4: Cloud Logs Analysis & Sign-Off (11:45–12:30 UTC-3)

**Cloud Logs Review:**

```bash
# 1. Check for ERROR logs
gcloud logging read "severity=ERROR" \
  --project hmatologia2 \
  --limit 20 \
  --format json | jq '.[] | "\(.timestamp) | \(.jsonPayload.message)"'
# Expected: 0 new errors (pre-existing ones OK)

# 2. Check function execution times
gcloud logging read "executionTime > 3000" \
  --project hmatologia2 \
  --limit 10
# Expected: <10% of invocations exceed 3s

# 3. Check Firestore quota
gcloud logging read "resource.type=firestore" \
  --project hmatologia2 \
  --limit 20 | grep -i quota
# Expected: No quota warnings or exceeded messages

# 4. Check rule violations
gcloud logging read "resource.type=firestore AND textPayload=~'.*Permission.*denied.*'" \
  --project hmatologia2 \
  --limit 20
# Expected: <5 rejections (transient retries)
```

---

### Exit Criteria Verification

**Sign off on deployment SUCCESS only if ALL criteria met:**

| Criterion              | Target     | Status | Evidence           |
| ---------------------- | ---------- | ------ | ------------------ |
| P0 alerts fired        | 0          | [ ]    | Cloud Logs review  |
| Unhandled exceptions   | 0          | [ ]    | Error logs search  |
| Auth success rate      | >99%       | [ ]    | Dashboard 1        |
| Portal laudo load      | <2s LCP    | [ ]    | Browser DevTools   |
| NOTIVISA queue healthy | No errors  | [ ]    | Cloud Logs check   |
| Firestore latency p95  | <500ms     | [ ]    | Dashboard 3        |
| System error rate      | <0.1%      | [ ]    | Dashboard 4        |
| Bundle size            | <365 KB    | [ ]    | Build artifact     |
| Smoke test             | 10/10 pass | [ ]    | Automated test log |

---

## Sign-Off Template

**Copy to Slack channel `#production-alerts` at deployment end:**

```
🚀 Phase 4 Deployment — May 20, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deploy Window: 08:30–12:30 UTC-3 (4 hours)
Incident Commander: [Name]
On-Call Engineer: [Name]
Tech Lead: [Name]

📋 Deployment Summary
─────────────────────
✓ Hosting Deploy: [time, commit hash]
✓ Rules + Indexes Deploy: [time, # indexes]
✓ Functions Deploy: [time, # functions]
✓ Feature Flag Created: rolloutPercentage = 0%
✓ Smoke Test: 10/10 pass ✓
✓ Post-Deploy Monitoring: 4 hours complete

📊 Exit Criteria
────────────────
☑ P0 alerts: 0 fired
☑ Unhandled exceptions: 0
☑ Auth success rate: >99%
☑ Portal load: <2s LCP
☑ Queue health: ✓ healthy
☑ Error rate: <0.1%

✅ GO-LIVE APPROVED
───────────────────
Status: Phase 4 deployment complete. System stable.
Next: Monitor feature flag, advance to 25% rollout on May 22.

Signed: [Name] | [Date/Time UTC-3]
```

---

## Emergency Contacts

| Role                | Name   | Phone             | Slack      |
| ------------------- | ------ | ----------------- | ---------- |
| Incident Commander  | CTO    | +55 11 99999-9999 | @cto       |
| On-Call Engineer #1 | [Name] | +55 11 99999-9999 | @oncall-1  |
| On-Call Engineer #2 | [Name] | +55 11 99999-9999 | @oncall-2  |
| Tech Lead           | [Name] | +55 11 99999-9999 | @tech-lead |

---

## Troubleshooting During Deployment

### Hosting Deploy Fails

**Symptom:** `firebase deploy --only hosting` returns error

**Steps:**

1. Check build: `npm run build` (should complete without errors)
2. Check bundle size: `du -h dist/index.js` (should be <365 KB)
3. Try again: `firebase deploy --only hosting --project hmatologia2`

### Functions Deploy Fails

**Symptom:** `firebase deploy --only functions` times out or errors

**Steps:**

1. Check functions build: `cd functions && npm run build`
2. Verify secrets: `bash scripts/preflight-secrets-check.sh`
3. Try deploying one function at a time:
   ```bash
   firebase deploy --only functions:notivisaDraftCreate --project hmatologia2
   firebase deploy --only functions:submitNotivisa --project hmatologia2
   # etc.
   ```
4. If still fails, check Cloud Logs:
   ```bash
   gcloud functions log list --project hmatologia2 --region southamerica-east1
   ```

### Index Creation Takes >10 min

**Symptom:** Indexes still "Building" after 10 minutes

**Steps:**

1. This is normal — index creation can take 5–15 minutes
2. Monitor: `gcloud firestore indexes list --project hmatologia2`
3. Do NOT rollback — wait for indexes to finish
4. Deployment window allows up to 5 extra minutes for index creation

### Smoke Test Fails

**Symptom:** Smoke test script returns failures

**Steps:**

1. Run each test manually to identify the failure
2. Check specific error: `bash .planning/scripts/phase-4-smoke-test.sh 2>&1 | grep FAIL`
3. Fix the underlying issue (code, config, or infrastructure)
4. Redeploy only the affected component
5. Rerun smoke test

---

## Reference Documents

- **Rollback procedures:** `.planning/PHASE_4_ROLLBACK_PROCEDURES.md`
- **Feature flag strategy:** `.planning/PHASE_4_FEATURE_FLAG_STRATEGY.md`
- **Monitoring setup:** `.planning/PHASE_4_CLOUD_LOGS_SETUP.md`
- **Incident response:** `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`
- **Smoke test script:** `.planning/scripts/phase-4-smoke-test.sh`

---

**Ready to deploy May 20?** Run: `bash .planning/scripts/phase-4-smoke-test.sh`  
**Need to rollback?** See: `PHASE_4_ROLLBACK_PROCEDURES.md`  
**Questions?** Escalate to CTO via `#production-alerts` Slack channel
