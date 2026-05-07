# Load Testing — Implementation Checklist

Use this checklist to ensure load testing está fully integrated no seu workflow.

---

## Phase 1: Local Setup (Day 1)

**Time estimate:** 30 minutes

### Pre-requisites

- [ ] Node.js 22+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git configured (`git config user.name` && `git config user.email`)
- [ ] Firebase project access (`firebase projects:list`)
- [ ] gcloud CLI installed (optional, for monitoring)

### k6 Installation

**macOS:**
```bash
brew install k6
k6 version  # Should return v0.50.0+
```

**Linux (Debian/Ubuntu):**
```bash
curl https://dl.k6.io/release/v0.50.0/k6-v0.50.0-linux-amd64.tar.gz | tar xz
sudo mv k6 /usr/local/bin/
k6 version
```

**Windows (Chocolatey):**
```powershell
choco install k6
k6 version
```

- [ ] k6 version command returns v0.50.0+

### k6-reporter Installation (Optional, for HTML reports)

```bash
npm i -g k6-reporter
k6-reporter --version
```

- [ ] k6-reporter installed (or skip if --skip-report is acceptable)

### Validate Installation

**PowerShell (Windows):**
```powershell
.\scripts\load-test-phase-3.ps1 -SkipReport
```

**Bash (Linux/macOS):**
```bash
./scripts/load-test-phase-3.sh baseline --skip-report
```

- [ ] Baseline test runs without errors
- [ ] LOAD_TEST_RESULTS.md created with metrics

---

## Phase 2: Local Development Workflow (Day 2-5)

**Time estimate:** 2 hours over 4 days (15 min/day)

### Before Each Code Review

- [ ] Run baseline locally: `./scripts/load-test-phase-3.sh baseline` (or .ps1)
- [ ] Review LOAD_TEST_RESULTS.md for any ✗ FAIL
- [ ] If any failure: investigate + fix + re-test
- [ ] Document findings in PR description if metrics changed

### Example PR Checklist

When opening a PR that touches:
- Firestore queries → run baseline
- Cloud Functions → run baseline
- Frontend portal → run baseline + stress test
- Critical path (escalation, laudo publish) → run spike test

For each test:

- [ ] Test passed (all ✓ metrics)
- [ ] SLA targets maintained
- [ ] No regression vs previous baseline
- [ ] Commit baseline results if changed
- [ ] Note in PR: "Load tested baseline: results in LOAD_TEST_RESULTS.md"

### Example Commit Message

```
feat: add new critical escalation endpoint

Implements POST /criticalResults endpoint for high-priority lab results.
Includes Firestore index for fast escalation lookups.

Load test baseline (10 VUs):
  - Critical escalations P95: 187ms ✓ (target: <200ms)
  - Error rate: 0.2% ✓ (target: <5%)
  - Firestore writes: 234 total ✓

Results: LOAD_TEST_RESULTS.md
```

---

## Phase 3: CI/CD Integration (Week 2)

**Time estimate:** 4 hours (one afternoon)

### GitHub Actions Setup

If using GitHub:

- [ ] Copy `.github/workflows/load-test.yml` from `LOAD_TEST_INTEGRATION_GUIDE.md` § GitHub Actions
- [ ] Customize:
  - [ ] Change `project_id: hmatologia2` if different
  - [ ] Add GCP service account key as secret: `GCP_SA_KEY`
- [ ] Test workflow: Push to branch → verify Actions runs load-test job
- [ ] Verify PR comment generated with results

### Pre-Deploy Gate

Add to your deploy script (`scripts/deploy.sh`):

```bash
#!/usr/bin/env bash
set -euo pipefail

# Type-check
npx tsc --noEmit

# Build
npm run build

# PRE-DEPLOY GATES
bash scripts/preflight-secrets-check.sh
bash scripts/preflight-load-test.sh  # ADD THIS

# Deploy
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
firebase deploy --only hosting
```

- [ ] Create `scripts/preflight-load-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "▶ Pre-deploy load test..."
./scripts/load-test-phase-3.sh baseline --skip-report

if grep -q "✗ FAIL" LOAD_TEST_RESULTS.md; then
  echo "✗ Load test failed. Fix before deploying."
  cat LOAD_TEST_RESULTS.md
  exit 1
fi

echo "✓ Load test passed"
```

- [ ] Make it executable: `chmod +x scripts/preflight-load-test.sh`
- [ ] Update deploy script to call it
- [ ] Test: `bash scripts/deploy.sh` (should run load test before deploy)

---

## Phase 4: Post-Deploy Monitoring (Day of Deploy + 24h)

**Time estimate:** 1 hour setup, 30 min/day monitoring

### Cloud Logging Alerts

Create alert for Function errors during load:

```bash
# Check for errors in last hour
gcloud logging read \
  'resource.type="cloud_function" AND severity="ERROR"' \
  --limit=100 --format=json | \
  jq 'length'  # Count should be 0 or <5
```

- [ ] Set up automated alert (Slack/email) for errors
- [ ] Define threshold: >5 errors in 1 hour = page on-call

### Latency Monitoring

```bash
# Real execution latency (last 1h)
gcloud logging read \
  'resource.type="cloud_function" AND jsonPayload.duration_ms > 0' \
  --format='table(jsonPayload.function_name,jsonPayload.duration_ms)' \
  --limit=100

# Compare with k6 predictions
cat LOAD_TEST_RESULTS.md | grep "duration_ms"
```

- [ ] Real latency within ±20% of k6 predictions
- [ ] If deviation: investigate reason (cache, network, etc)

### Firestore Quota Monitoring

```
Firebase Console → Firestore → Usage
```

- [ ] Monitor Reads/Writes per minute
- [ ] Monitor Quota exceeded count (should be 0)
- [ ] If quota hit: increase limit in Project Settings → Quotas

- [ ] Check quota exceeded count: `grep "Quota Exceeded" LOAD_TEST_RESULTS.md`

---

## Phase 5: Weekly Baseline Tracking (Ongoing)

**Time estimate:** 30 min/week

### Establish Baseline Trend

Every Monday:

```bash
# Run current baseline
./scripts/load-test-phase-3.sh baseline

# Commit to history
git add LOAD_TEST_RESULTS.md
git commit -m "baseline: weekly trend check — $(date +%Y-%m-%d)"
git push
```

- [ ] Run baseline weekly (same time if possible)
- [ ] Compare with previous week's baseline
- [ ] Document any significant changes (>10% variance)

### Example Trend Tracking

Create `docs/LOAD_TEST_BASELINE_HISTORY.md`:

```markdown
# Load Test Baseline History

| Date | Portal P95 | Error Rate | Quota Exceeded | Status |
|------|-----------|-----------|----------------|--------|
| 2026-05-07 | 181ms | 0.2% | 0 | ✓ |
| 2026-05-14 | 175ms | 0.1% | 0 | ✓ IMPROVED |
| 2026-05-21 | 189ms | 0.3% | 0 | ⚠ DEGRADED (investigate) |
```

- [ ] Create `LOAD_TEST_BASELINE_HISTORY.md` if doing weekly tracking
- [ ] Update weekly with new results
- [ ] Alert if degradation >15%

---

## Phase 6: Optimization & Iteration (Month 1+)

**Time estimate:** 2-4 hours per optimization cycle

### Performance Issues Found

When load test reveals performance issue:

1. [ ] Document issue in JIRA/GitHub issue:
   ```
   Title: Portal reads P95 latency degraded to 287ms (target: 150ms)
   Load Test: LOAD_TEST_RESULTS.md
   Cause: Unindexed 'portalEnabled + modifiedTime' query
   Fix: Add Firestore composite index
   Acceptance: Portal P95 <150ms in next baseline
   ```

2. [ ] Implement fix (add index, optimize query, cache, etc)

3. [ ] Re-test locally:
   ```bash
   ./scripts/load-test-phase-3.sh baseline
   ```

4. [ ] Verify improvement:
   ```bash
   grep "Portal Config Reads" LOAD_TEST_RESULTS.md
   # Before: 287ms
   # After: 145ms ✓
   ```

5. [ ] Commit with before/after metrics:
   ```
   git commit -m "perf: add firestore index for portal config reads
   
   Before: Portal reads P95 287ms (exceeded target 150ms)
   After:  Portal reads P95 145ms ✓ (48% improvement)
   
   Changes:
     - Added composite index: portalEnabled (Asc) + modifiedTime (Desc)
     - No code changes required
   
   Verification: ./scripts/load-test-phase-3.sh baseline
   "
   ```

- [ ] Issue filed + documented
- [ ] Fix implemented
- [ ] Re-test baseline
- [ ] Results documented in commit

---

## Phase 7: Compliance Documentation (End of Sprint)

**Time estimate:** 30 min

### RDC 978 Compliance Record

Create `docs/LOAD_TEST_COMPLIANCE_RECORD.md`:

```markdown
# Load Test Compliance Record

**Sprint:** Phase 3 Week 2
**Date:** 2026-05-14
**Operator:** [Your Name]

## Test Execution

- Scenario: Baseline (10 concurrent users, 5 min sustain)
- Lab ID: lab_test_phase3_w2
- Duration: 420 seconds
- Timestamp: 2026-05-14 14:32:15

## Results

| Requirement | Target | Actual | Status |
|-------------|--------|--------|--------|
| Portal response time (P95) | <150ms | 145ms | ✓ PASS |
| NOTIVISA event latency | <300ms | 289ms | ✓ PASS |
| Critical escalation latency | <200ms | 187ms | ✓ PASS |
| Error rate | <1% | 0.2% | ✓ PASS |

## Compliance

- ✓ RDC 978 Art. 75 (performance requirements met)
- ✓ RDC 978 Art. 122 (supervision system responsive)
- ✓ DICQ 4.1.2 (operational procedures documented)

## Artifacts

- JSON results: load-test-results-20260514_143215.json
- HTML report: load-test-results-20260514_143215.html
- This record: LOAD_TEST_COMPLIANCE_RECORD.md

**Signed:** [Name]
**Date:** [Date]
```

- [ ] Create compliance record per sprint (or per major milestone)
- [ ] Include screenshots of results
- [ ] File for audit trail (RDC 978 Art. 122)

---

## Troubleshooting During Implementation

### "k6 not found after installation"

**Windows:** Restart PowerShell after `choco install k6`
**Linux/macOS:** Add `/usr/local/bin` to `$PATH` — check `echo $PATH`

- [ ] Run `k6 version` — returns v0.50.0+

### "Permission denied: scripts/load-test-phase-3.sh"

**Linux/macOS:**
```bash
chmod +x scripts/load-test-phase-3.sh
```

**Windows:** Use PowerShell (not cmd.exe)

- [ ] Script executes without permission error

### "Connection refused — can't reach hmatologia2.web.app"

1. [ ] Verify Hosting is deployed: `firebase hosting:sites`
2. [ ] Verify URL: `curl -I https://hmatologia2.web.app` returns 200
3. [ ] If staging: override `BASE_URL=https://staging.example.com ./scripts/load-test-phase-3.sh`

### "HTML report shows N/A values"

- [ ] k6-reporter installed? `npm i -g k6-reporter`
- [ ] jq installed? `which jq` (Linux/macOS)
- [ ] Check raw JSON: `jq '.metrics' load-test-results-*.json`

---

## Definition of Done

Load testing integration is **complete** when:

- [ ] k6 installed locally
- [ ] Baseline test runs without errors
- [ ] SLA targets understood (all 8 thresholds)
- [ ] Pre-deploy gate integrated (`preflight-load-test.sh`)
- [ ] CI/CD runs load test on PRs
- [ ] Post-deploy monitoring set up (Cloud Logs)
- [ ] Team trained on interpretation (PASS vs FAIL)
- [ ] Compliance record created (RDC 978 Art. 122)
- [ ] Weekly baseline trending established

**Estimated total time:** 8-10 hours over 2-3 weeks

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| `LOAD_TEST_QUICK_REFERENCE.md` | Quick start, commands, examples |
| `LOAD_TEST_INTEGRATION_GUIDE.md` | Full architecture, CI/CD, pre/post deploy |
| `LOAD_TEST_DELIVERY_SUMMARY.md` | Deliverables recap, metrics, next steps |
| `LOAD_TEST_EXAMPLE_OUTPUTS.md` | Real-world output examples, troubleshooting |
| This file | Implementation checklist |

---

**Need help?** Refer to relevant section above or check `LOAD_TEST_QUICK_REFERENCE.md` § Troubleshooting.

Good luck! 🚀
