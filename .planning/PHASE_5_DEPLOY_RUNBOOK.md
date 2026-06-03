# Phase 5 Deployment Runbook — UAT + Go-Live (June 5, 2026)

**Deployment Date:** June 5, 2026  
**Deployment Window:** 08:30–12:30 UTC-3 (4 hours)  
**Region:** `southamerica-east1`  
**Project ID:** `hmatologia2`  
**Status:** Ready for execution

---

## Pre-Flight Checklist (May 30, EOD)

### 1. Code Quality & Compliance

```bash
# 1.1 Type-check
npx tsc --noEmit
# Expected: 0 errors

# 1.2 Lint baseline
npm run lint
# Expected: 88 baseline warnings (no new violations)

# 1.3 Unit tests (Phase 5 modules: criticos, ciq-imuno enhancements)
npm run test
# Expected: 250+ tests passing (Phase 4 baseline 150 + Phase 5 new ~100)

# 1.4 E2E tests (Phase 5 critical flows)
npm run test:e2e -- --spec "src/__tests__/e2e/phase-5-critical-flows.test.ts"
# Expected: 10+ critical flows passing
#   - Detect critico workflow
#   - Strip upload + Gemini classification
#   - RT acknowledge escalation
#   - Analytics consent integration

# 1.5 Firestore rules validation
npm run rules:test
# Expected: All rules tests passing (multi-tenant isolation, soft-delete, signatures)

# 1.6 Check for uncommitted changes
git status
# Expected: clean working tree (stash or commit any WIP)
```

### 2. Firebase Infrastructure

```bash
# 2.1 Validate Firestore rules (dry run)
firebase deploy --only firestore:rules --dry-run --project hmatologia2
# Expected: "... would update firestore:rules"

# 2.2 List all indexes (verify new Phase 5 composite indexes)
gcloud firestore indexes list --project hmatologia2
# Expected: All indexes with status READY (including criticos detection indexes)

# 2.3 Build functions
cd functions
npm run build
# Expected: functions/lib/ generated, 0 TS errors

# 2.4 Run functions unit tests
npm test
# Expected: 150+ tests passing (Phase 4 + Phase 5 criticos + ciq-imuno)

cd ..
```

### 3. Bundle & Performance

```bash
# 3.1 Build web (React + Vite)
npm run build
# Expected: dist/ generated, index.js + assets/

# 3.2 Check bundle size
du -h dist/index.js
# Expected: <365 KB gzip (target maintained from Phase 4)

# 3.3 Lighthouse audit (local)
npm run lighthouse -- https://hmatologia2.web.app/portal/dashboard
# Expected: Score ≥87, LCP <2.0s, INP <200ms, CLS <0.05
```

### 4. Secrets & Environment

```bash
# 4.1 Verify Phase 5 secrets are provisioned
bash scripts/preflight-secrets-check.sh
# Expected: Exit code 0 (all secrets GREEN)
#
# Phase 5 secrets to verify:
#  - HCQ_SIGNATURE_HMAC_KEY (existing, Phase 4)
#  - GEMINI_API_KEY (Laudo OCR + Strip classification)
#  - NOTIVISA_API_KEY (production ready, Phase 6 GA)
#  - RESEND_API_KEY (email export + analytics consent)
#  - SMS_TWILIO_API_KEY (criticos escalation)

# If any secret is PENDING, set it:
firebase functions:secrets:set SMS_TWILIO_API_KEY --project hmatologia2
# Paste value from Secret Manager

# 4.2 Verify Firestore security rules contain Phase 5 blocks
cat firestore.rules | grep -A 10 "criticos-"
# Expected: Contains criticos collections (detection, escalation, ack)
```

### 5. Team Readiness

- [ ] Incident Commander (CTO) available 08:30–12:30 UTC-3
- [ ] On-Call Engineer #1 + #2 confirmed
- [ ] On-call rotation active (SMS pager tested)
- [ ] Slack channels created: `#production-alerts` + `#p5-deployment`
- [ ] Runbook printed + posted (or link pinned in Slack)
- [ ] Lab Director + RT (real-time staff) available for UAT sign-off
- [ ] Customer (Riopomba) IT contact on standby

---

## Deployment Execution (June 5, 08:30 UTC-3)

### GATE: Pre-Deployment Checklist

```
Before proceeding, verify:
  ✓ All code quality checks passing (TSC, Lint, Tests, E2E)
  ✓ All Firestore rules + indexes ready
  ✓ All Phase 5 secrets provisioned
  ✓ Performance metrics within target (bundle <365 KB, LCP <2.0s)
  ✓ Team available and on-call rotation active
  ✓ Customer UAT pre-sign-off completed

If ANY item is not ✓, STOP and fix before proceeding.
```

### Phase 5.0: Firestore Rules + Indexes — 5–10 min

**Deploy Firestore security rules:**

```bash
# 1. Dry-run (no changes applied)
firebase deploy --only firestore:rules --dry-run --project hmatologia2
# Expected: "✔ firestore:rules: Would update rules for database (default)"

# 2. Deploy rules
firebase deploy --only firestore:rules --project hmatologia2
# Expected: "✔ firestore:rules: Deployed rules for database (default)"

# 3. Monitor index creation (Phase 5 adds ~4 new composite indexes)
echo "Waiting for criticos detection indexes to build..."
for i in {1..30}; do
  INDEX_STATUS=$(gcloud firestore indexes list --project hmatologia2 | grep "criticos" | grep -c "READY")
  if [ "$INDEX_STATUS" -eq "4" ]; then
    echo "✓ All criticos detection indexes are READY"
    break
  fi
  echo "  Indexes building... ($i/30, $INDEX_STATUS/4 ready)"
  sleep 10
done

# 4. Verify all indexes created
gcloud firestore indexes list --project hmatologia2 | grep criticos
# Expected output:
#   criticos-deteccao/{labId}/detection (status, ts) — READY
#   criticos-deteccao/{labId}/detection (labId, operatorId, ts) — READY
#   criticos-escalacao/{labId}/escalations (status, slaDeadline) — READY
#   (additional indexes for analytics consent tracking)
```

**If rule deploy fails:**

- Check syntax: `firebase emulator:start --only firestore` then `npm run test:firestore-rules`
- Review `.rules` files in `src/features/criticos/` for multi-tenant validation
- Do NOT proceed to functions until rules are valid

---

### Phase 5.1: Cloud Functions — 5–7 min

**Deploy Cloud Functions with Phase 5 modules:**

```bash
# 1. Rebuild functions (Phase 5: criticos + ciq-imuno + ocr enhancements)
cd functions
npm run build
# Expected: functions/lib/ generated, 0 TS errors

# 2. Run Phase 5 unit tests
npm test
# Expected: 150+ tests passing, including:
#   - criticos/detectCriticalValue.test.ts (10+ tests)
#   - criticos/escalacaoCriticos.test.ts (8+ tests)
#   - ciqImuno/stripClassify.test.ts (12+ tests)
#   - lgpd/consentBackfill.test.ts (5+ tests)

# 3. Deploy all functions
cd .. && firebase deploy --only functions --project hmatologia2 --force
# Expected: Lists all deployed functions including:
#   ✓ functions[detectCriticalValue]: Successful update
#   ✓ functions[escalacaoCriticos]: Successful update
#   ✓ functions[escalarCriticoViaSmS]: Successful update
#   ✓ functions[classifyStripGemini]: Successful update
#   ✓ functions[consentBackfill]: Successful update
#   ... [30+ total functions] ...
# Expected time: 3–5 minutes

# 4. Verify functions deployed
gcloud functions list --project hmatologia2 --region southamerica-east1 | grep -E "(criticos|classifyStrip|consent)"
# Expected: All Phase 5 functions with status ACTIVE (green)
```

**If function deploy fails:**

- Check Cloud Logs: `gcloud functions log list --project hmatologia2 --region southamerica-east1 | tail -50`
- If TypeScript error: fix in code, rebuild, redeploy
- If runtime error: check function logs for specific failure
- Do NOT proceed to hosting until all functions are ACTIVE

---

### Phase 5.2: Hosting (Web Client) — 3–5 min

**Deploy updated React web bundle with Phase 5 UX:**

```bash
# 1. Build web (React + Vite)
npm run build
# Expected: dist/ generated, no errors, LCP baseline <2.0s

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting --project hmatologia2
# Expected: "Deploy complete!" with URL https://hmatologia2.web.app

# 3. Verify hosting is live
curl -s https://hmatologia2.web.app/hub | grep -o '<title>.*</title>'
# Expected: <title>HC Quality</title>

# 4. Browser smoke test (manual)
# Open: https://hmatologia2.web.app/hub
# Expected: Hub loads <2s, all module tiles visible (including Críticos module)
```

**If hosting deploy fails:**

- Check build output: `npm run build` (should show 0 errors)
- Verify bundle size: `ls -lh dist/assets/*.js`
- Do NOT retry until build issue is fixed

---

### Phase 5.3: Smoke Test Suite — 20 min

**Run comprehensive smoke test for Phase 5 critical paths:**

```bash
# Run automated smoke test
bash .planning/scripts/phase-5-smoke-test.sh

# Expected output (example):
# ────────────────────────────────────────
# Phase 5 Smoke Test Results
# ────────────────────────────────────────
# [1/12] Hosting reachable ...................... PASS
# [2/12] Firestore rules deployed .............. PASS
# [3/12] Cloud Functions deployed .............. PASS
# [4/12] Criticos detection engine ............. PASS
# [5/12] SMS escalation callable ............... PASS
# [6/12] Strip upload + Gemini Vision .......... PASS
# [7/12] Analytics consent integration ......... PASS
# [8/12] E2E critical flows (3 scenarios) ...... PASS
# [9/12] Bundle size <365 KB ................... PASS
# [10/12] LCP <2.0s (Lighthouse) ............... PASS
# [11/12] All secrets provisioned .............. PASS
# [12/12] Cloud Logs: Error rate <0.1% ........ PASS
# ────────────────────────────────────────
# Exit Code: 0 ✓ ALL PASSED
```

**Manual Smoke Tests (if automation incomplete):**

#### Scenario 1: Detect Crítico Workflow

```
1. Login as RT user
2. Navigate to Críticos module (/hub/criticos)
3. Select a CIQ test (e.g., Coagulação)
4. Enter a result value ABOVE configured threshold
5. System should:
   ✓ Highlight as CRÍTICO (red)
   ✓ Show SLA countdown (if escalation enabled)
   ✓ Display "Reconhecer" button
6. Result: ✓ PASS or ✗ FAIL
```

#### Scenario 2: Upload Strip + Gemini Classification

```
1. Login as Imuno analyst
2. Navigate to CIQ Imunologia module
3. Click "Enviar Strip para IA"
4. Upload test image (PNG/JPG)
5. System should:
   ✓ Show upload progress
   ✓ Call Gemini Vision API
   ✓ Display classification result (positive/negative)
   ✓ Show confidence score >0.90
6. Result: ✓ PASS or ✗ FAIL
```

#### Scenario 3: RT Acknowledge Escalation

```
1. Trigger a crítico escalation (Scenario 1)
2. Check SMS inbox (Twilio test) or email inbox
3. Receive notification with SLA deadline
4. Click "Reconhecer" in portal
5. System should:
   ✓ Mark escalation as acknowledged
   ✓ Update audit trail
   ✓ Clear critical indicator
6. Result: ✓ PASS or ✗ FAIL
```

**If any smoke test fails:**

1. **STOP all further deployment**
2. Investigate specific failure in detail
3. Check Cloud Logs for error stack traces
4. Fix in code or infrastructure
5. Redeploy only affected component
6. Rerun smoke test
7. Do NOT proceed to monitoring until all pass

---

## Post-Deployment Validation (08:50–12:30 UTC-3)

### Hour 1: Immediate Health Check (08:50–09:50 UTC-3)

**Dashboard 1: Portal Health**

- [ ] Hub loads <2s (LCP)
- [ ] All module tiles render (no 404s)
- [ ] No unhandled exceptions in console
- [ ] Auth success rate >99%

**Dashboard 2: Críticos Detection**

- [ ] Detection engine ingesting values from all modules
- [ ] SMS escalation delivering <30s latency
- [ ] SLA countdown accurate (deadline calculation correct)
- [ ] No missed critical values (query detection results)

**Dashboard 3: Gemini Vision API**

- [ ] Strip classification working (test upload)
- [ ] Vision API quota not exceeded
- [ ] Confidence filtering working (threshold 0.90)
- [ ] Fallback to manual classification if Vision fails

**Dashboard 4: System Health**

- [ ] Error rate <0.1% (baseline)
- [ ] Function execution time p90 <3s
- [ ] Firestore query latency p95 <500ms
- [ ] No unhandled exceptions in Cloud Logs

**Expected Alert Silence:** 0 critical alerts should fire in Hour 1

---

### Hour 2–3: Detailed Scenario Validation (09:50–11:50 UTC-3)

**Customer UAT Sign-Off (Lab Director):**

- [ ] Criticos module loaded + functionally correct
- [ ] All thresholds match lab configuration (not defaults)
- [ ] SMS notifications arriving as expected
- [ ] RT staff can acknowledge escalations
- [ ] Audit trail captures all critical events
- [ ] Performance acceptable (no lag during peak testing)

**Compliance Verification:**

```bash
# 1. Verify audit trail for all criticos operations
gcloud logging read "logName=~'criticos-escalacao' AND severity='INFO'" \
  --project hmatologia2 --limit 10
# Expected: timestamp, operatorId, action (acknowledge/escalate), result

# 2. Verify soft-delete (no hard deletes)
gcloud logging read "method='delete'" \
  --project hmatologia2 --limit 5 | grep -i criticos
# Expected: Empty (no hard deletes in criticos collections)

# 3. Verify signature validation
gcloud logging read "textPayload=~'.*signature.*invalid'" \
  --project hmatologia2 --limit 5
# Expected: <5 (normal transient retries)
```

---

### Hour 4: Cloud Logs Analysis & Sign-Off (11:50–12:30 UTC-3)

**Cloud Logs Review:**

```bash
# 1. Check for ERROR logs (Phase 5 specific)
gcloud logging read "severity=ERROR AND (resource.type=cloud_function OR resource.type=firestore)" \
  --project hmatologia2 \
  --since="2026-06-05T08:30:00-03:00" \
  --format json | jq '.[] | "\(.timestamp) | \(.jsonPayload.message // .textPayload)"' | head -20
# Expected: 0 new errors (pre-existing ones documented)

# 2. Check criticos function execution times
gcloud logging read "functionName=~'(detectCritical|escalacaoCriticos)' AND executionTime > 3000" \
  --project hmatologia2 \
  --since="2026-06-05T08:30:00-03:00" \
  --limit 10
# Expected: <5 invocations (outliers are OK)

# 3. Check SMS delivery logs
gcloud logging read "textPayload=~'.*SMS.*' AND severity=INFO" \
  --project hmatologia2 \
  --since="2026-06-05T08:30:00-03:00" \
  --limit 20
# Expected: All SMS queued successfully, <1% failures

# 4. Check Gemini Vision API quota
gcloud logging read "textPayload=~'.*Gemini.*quota' OR textPayload=~'.*quota.*exceeded'" \
  --project hmatologia2 \
  --since="2026-06-05T08:30:00-03:00" \
  --limit 10
# Expected: 0 quota exceeded errors (quota set high for Phase 5)

# 5. Check Firestore rule violations
gcloud logging read "textPayload=~'.*Permission.*denied' AND resource.type=firestore" \
  --project hmatologia2 \
  --since="2026-06-05T08:30:00-03:00" \
  --limit 20
# Expected: <10 rejections (expected for permission tests)
```

---

### Exit Criteria Verification

**Sign off on deployment SUCCESS only if ALL criteria met:**

| Criterion                  | Target     | Status | Evidence               |
| -------------------------- | ---------- | ------ | ---------------------- |
| P0 alerts fired            | 0          | [ ]    | Cloud Logs review      |
| Unhandled exceptions       | 0          | [ ]    | Error logs search      |
| Auth success rate          | >99%       | [ ]    | Portal health check    |
| Hosting latency (LCP)      | <2.0s      | [ ]    | Lighthouse audit       |
| Críticos detection working | Yes        | [ ]    | Scenario 1 test pass   |
| SMS delivery latency       | <30s       | [ ]    | Cloud Logs SMS review  |
| Gemini Vision quota OK     | Yes        | [ ]    | Quota logs check       |
| Firestore latency p95      | <500ms     | [ ]    | Query performance logs |
| System error rate          | <0.1%      | [ ]    | Error rate dashboard   |
| Bundle size                | <365 KB    | [ ]    | Build artifact         |
| Smoke test                 | 12/12 pass | [ ]    | Automated test log     |
| Customer UAT sign-off      | Approved   | [ ]    | Lab Director sign-off  |

---

## Rollback Procedures

### Full Rollback (All Phases)

**Scenario:** Critical bug found post-deploy (e.g., SMS escalation not delivering, Gemini Vision failing).

**Steps:**

```bash
# 1. Identify last known-good commit (Phase 4 baseline)
git log --oneline | grep "Phase 4" | head -1
# Example: b2e415b feat(wave4-8): Performance validation + baselines

# 2. Revert all Phase 5 commits
git revert HEAD~0..b2e415b
git push

# 3. Re-deploy previous version
firebase deploy --project hmatologia2 --force

# 4. Monitor for 30 min
bash scripts/monitor-cloud-logs.sh 30 5
```

**Validation:**

- [ ] Críticos module unavailable (tile grayed out)
- [ ] Strip classification unavailable
- [ ] Cloud Functions: Phase 4 version running (check timestamps)
- [ ] No new errors in Cloud Logs

### Partial Rollback (Functions Only)

**Scenario:** Bug in SMS escalation (escalacaoCriticos function), everything else working.

```bash
# 1. Fix the function
# src/features/criticos/functions/escalacaoCriticos.ts

# 2. Rebuild + test
cd functions && npm run build && npm test -- criticos
cd ..

# 3. Redeploy only the affected function
firebase deploy --only functions:escalacaoCriticos --project hmatologia2

# 4. Verify: SMS escalation works with fix
```

### Rules Rollback Only

**Scenario:** Rule syntax error, functions/hosting fine.

```bash
# 1. Revert firestore.rules to prior version
git checkout HEAD~1 -- firestore.rules

# 2. Validate dry-run
firebase deploy --only firestore:rules --dry-run --project hmatologia2

# 3. Deploy
firebase deploy --only firestore:rules --project hmatologia2

# 4. Verify: Críticos reads/writes work again
```

---

## 24-Hour Post-Deployment Monitoring

### Automated Monitoring Script

```bash
# Start 24h monitoring immediately after deployment
bash scripts/monitor-cloud-logs.sh 24 30
# Watches Cloud Logs every 30 minutes, generates report
```

### Manual Monitoring Checkpoints

**Every 4 hours (on the hour):**

```bash
# 1. Error rate check
ERROR_COUNT=$(gcloud logging read 'severity=ERROR' \
  --project hmatologia2 --limit 1000 | wc -l)
TOTAL_LOGS=$(gcloud logging read 'severity=INFO OR severity=ERROR' \
  --project hmatologia2 --limit 10000 | wc -l)
ERROR_RATE=$(echo "scale=4; $ERROR_COUNT / $TOTAL_LOGS * 100" | bc)

echo "Error Rate: ${ERROR_RATE}% (target <0.1%)"
[ $(echo "$ERROR_RATE < 0.1" | bc) -eq 1 ] && echo "✓ PASS" || echo "✗ ALERT"

# 2. Críticos escalation success rate
SMS_SENT=$(gcloud logging read "textPayload=~'.*SMS sent.*'" \
  --project hmatologia2 --limit 1000 | wc -l)
SMS_FAILED=$(gcloud logging read "severity=ERROR AND textPayload=~'.*SMS.*'" \
  --project hmatologia2 --limit 1000 | wc -l)
[ $SMS_SENT -gt 0 ] && echo "SMS Success Rate: $((SMS_SENT * 100 / (SMS_SENT + SMS_FAILED)))%"

# 3. Function latency check
SLOW_FUNCTIONS=$(gcloud logging read "executionTime > 5000" \
  --project hmatologia2 --limit 500 | wc -l)
echo "Slow Functions (>5s): $SLOW_FUNCTIONS (target <10/4h)"

# 4. Firestore quota status
gcloud logging read 'resource.type=firestore AND textPayload=~"quota"' \
  --project hmatologia2 --limit 10 || echo "✓ No quota issues"
```

### Red Flags & Escalation

| Red Flag                                       | Action                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Error rate >0.5%                               | Page on-call engineer immediately                                            |
| SMS escalation failing (>10% failure rate)     | Fallback to email escalation, investigate Twilio quota                       |
| Gemini Vision API quota exceeded               | Scale back strip classification confidence threshold, request quota increase |
| Firestore rule rejection >100/hour             | Check rule syntax, review recent rule changes                                |
| Function latency p95 >10s                      | Check Firestore index usage, review query patterns                           |
| No criticos escalations (but should be >5/day) | Check detection logic, verify thresholds loaded correctly                    |

---

## Sign-Off Template

**Copy to Slack channel `#production-alerts` at deployment end:**

```
🚀 Phase 5 Deployment — June 5, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deploy Window: 08:30–12:30 UTC-3 (4 hours)
Incident Commander: [Name]
On-Call Engineer: [Name]
Tech Lead: [Name]
Lab Director (Customer): [Name]

📋 Deployment Summary
─────────────────────
✓ Rules + Indexes Deploy: [time, # indexes deployed]
✓ Functions Deploy: [time, # functions: 35+]
✓ Hosting Deploy: [time, bundle size: 362 KB]
✓ Smoke Test: 12/12 pass ✓
✓ Post-Deploy Monitoring: 4 hours complete
✓ Customer UAT: Approved ✓

📊 Phase 5 Exit Criteria
────────────────────────
☑ Error rate: <0.1% ✓
☑ SMS escalation: 100% delivery rate ✓
☑ Críticos detection: Working end-to-end ✓
☑ Strip classification: Gemini Vision API responsive ✓
☑ Portal latency: <2.0s LCP ✓
☑ No rule violations: <10/hour ✓
☑ All secrets provisioned: ✓
☑ Customer sign-off: Approved ✓

✅ GO-LIVE APPROVED
───────────────────
Status: Phase 5 deployment complete. System stable.
Next: 7-day burn-in period, advance to Phase 6 on June 12 if no incidents.

Signed: [Name] | [Date/Time UTC-3]
```

---

## Emergency Contacts

| Role                     | Name   | Phone             | Slack         |
| ------------------------ | ------ | ----------------- | ------------- |
| Incident Commander (CTO) | [Name] | +55 11 99999-9999 | @cto          |
| On-Call Engineer #1      | [Name] | +55 11 99999-9999 | @oncall-1     |
| On-Call Engineer #2      | [Name] | +55 11 99999-9999 | @oncall-2     |
| Infrastructure Lead      | [Name] | +55 11 99999-9999 | @infra-lead   |
| Lab Director (UAT Lead)  | [Name] | +55 11 99999-9999 | @lab-director |

---

## Troubleshooting During Deployment

### Criticos Detection Engine Fails

**Symptom:** Error in `detectCriticalValue` function

**Steps:**

1. Check threshold configuration: verify lab-specific thresholds loaded
2. Check Cloud Logs: `gcloud functions log list --project hmatologia2 --region southamerica-east1 | grep detectCritical`
3. Verify Firestore rules allow criticos collection read/write
4. Redeploy only criticos functions: `firebase deploy --only functions:detectCriticalValue --project hmatologia2`

### SMS Escalation Not Delivering

**Symptom:** Crítico detected but SMS not received

**Steps:**

1. Check SMS credentials: `bash scripts/preflight-secrets-check.sh | grep SMS`
2. Check Twilio quota: https://www.twilio.com/console/sms/logs
3. Review Cloud Logs: `gcloud logging read "functionName=escalarCriticoViaSmS AND severity=ERROR"`
4. Verify phone numbers in lab config (Check `labs/{labId}/config/sms-recipients`)
5. Fallback: Send email escalation instead (email always works as fallback)

### Gemini Vision API Quota Exceeded

**Symptom:** Strip classification fails with "quota exceeded" error

**Steps:**

1. Check Vertex AI Vision API quota: https://console.cloud.google.com/iam-admin/quotas?project=hmatologia2
2. Request quota increase (Google Cloud support): ~2–4 hour SLA
3. Temporary mitigation: Increase classification confidence threshold to 0.95 (stricter filtering)
4. Disable strip classification temporarily (manual classification only) if quota still exceeded

### Hosting Deploy Fails

**Symptom:** `firebase deploy --only hosting` returns error

**Steps:**

1. Check build: `npm run build` (should complete without errors)
2. Check bundle size: `du -h dist/index.js` (should be <365 KB)
3. Try again: `firebase deploy --only hosting --project hmatologia2`

---

## Reference Documents

- **Phase 5 Completion Summary:** `docs/PHASE_5_COMPLETION_SUMMARY.md`
- **Monitoring Guide:** `.planning/PHASE_5_MONITORING_GUIDE.md`
- **Compliance Checklist:** `docs/COMPLIANCE_CHECKLIST_v1.4.md`
- **Risk Assessment:** `docs/RISK_ASSESSMENT_v1.4.md`
- **Cloud Logs Setup:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
- **Incident Response Contacts:** `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`

---

**Ready to deploy June 5?** Run: `bash .planning/scripts/phase-5-smoke-test.sh`  
**Need to rollback?** See: Rollback Procedures section above  
**Questions?** Escalate to CTO via `#production-alerts` Slack channel
