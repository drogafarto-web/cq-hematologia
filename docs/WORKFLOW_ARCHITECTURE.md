# Phase 3 Workflow Architecture

> **Comprehensive technical reference for the CI/CD system**  
> **Last updated**: 2026-05-07

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI/CD                         │
│                  (phase-3-deploy.yml)                           │
└─────────────────────────────────────────────────────────────────┘

Entry Points:
  ├─ Auto: git push to main (firestore.rules | firestore.indexes.json | functions/)
  └─ Manual: Run workflow button (full control over stages + toggles)

┌─ PRE-DEPLOY GATE (mandatory, always runs)
│  ├─ tsc --noEmit (type-check)
│  ├─ eslint (lint)
│  ├─ vitest (unit tests)
│  ├─ vite build (app bundle)
│  ├─ tsc functions/ (functions bundle)
│  ├─ firebase dry-run (rules syntax)
│  └─ preflight-secrets-check.sh (ADR-0018 gate)
│     └─ Blocks if: defineSecret() → PENDING_SET_* or empty
│
├─ STAGED DEPLOYMENTS (conditional on changes + gate pass)
│  ├─ Rules Deployment
│  │  └─ firebase deploy --only firestore:rules
│  │
│  ├─ Indexes Deployment (parallel after Rules)
│  │  └─ firebase deploy --only firestore:indexes
│  │
│  └─ Functions Deployment (depends on Rules)
│     └─ firebase deploy --only functions
│
├─ HOSTING DEPLOYMENT (manual-dispatch only, never auto)
│  └─ firebase deploy --only hosting
│
├─ POST-DEPLOY VERIFICATION
│  ├─ Smoke tests (vitest run test/smoke)
│  └─ Cloud Logs monitoring (bash scripts/monitor-cloud-logs.sh 1 60)
│
└─ MERGE PROTECTION (PR only, blocks merge if fails)
   ├─ Coverage ≥80%
   ├─ Bundle <420 KB gzip
   ├─ Type-check 0 errors
   ├─ Lint baseline
   └─ All unit tests pass
```

---

## Job Dependency Graph

```
                    Code Push / Workflow Dispatch
                              │
                    ┌─────────▼─────────┐
                    │ pre-deploy-gate   │
                    │ (mandatory)       │
                    └────────┬──────────┘
                             │ (success) + rules_changed=true
            ┌────────────────┴────────────────┐
            │                                 │
    ┌───────▼────────┐          ┌────────────▼────────┐
    │ deploy-rules   │          │ deploy-indexes      │
    │ (conditional)  │          │ (conditional)       │
    └───────┬────────┘          └────────────┬────────┘
            │                                 │
            └────────────────┬────────────────┘
                             │ (both complete)
                    ┌────────▼───────────┐
                    │ deploy-functions   │
                    │ (conditional)      │
                    └────────┬───────────┘
                             │ (success) + hosting_changed=true
                    ┌────────▼───────────┐
                    │ deploy-hosting     │
                    │ (manual only)      │
                    └────────┬───────────┘
                             │
                    ┌────────▼──────────────┐
                    │ post-deploy-          │
                    │ verification          │
                    │ (smoke + logs)        │
                    └──────────┬────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ deploy-status       │
                    │ (summary report)    │
                    └─────────────────────┘

Parallel Jobs:
  - Rules and Indexes can run in parallel (both depend on pre-gate)
  - PR checks (merge-protection) run independently
```

---

## Execution Flows

### Flow A: Auto-Deploy (Push to Main)

**Trigger**: `git push origin main` with changes to rules/functions

```
1. GitHub detects push
2. Actions starts: pre-deploy-gate
3. Gate runs: tsc, lint, tests, build, secrets check
4. Gate passes:
   └─ Deploy Rules (if firestore.rules changed)
   └─ Deploy Functions (if functions/ changed)
   └─ (Hosting never auto-deploys)
5. Post-deploy: smoke tests + Cloud Logs (1h)
6. Summary report in #deployments Slack (if configured)

Duration: ~20 min (5m gate + 2m rules + 5m functions + 8m monitoring)
```

### Flow B: Manual Dispatch (Full Control)

**Trigger**: GitHub Actions UI → "Run workflow" button

```
User selects:
  ├─ deploy_stage: all | rules | functions | hosting
  ├─ skip_smoke_tests: true | false
  └─ skip_monitoring: true | false

1. Actions starts: pre-deploy-gate (always)
2. Gate runs same checks as Flow A
3. User's stage selection determines what deploys:
   ├─ all: Rules → Functions → Hosting
   ├─ rules: Rules only
   ├─ functions: Functions only (skips Rules)
   └─ hosting: Hosting only (skips everything else)
4. Optional: skip smoke tests / skip monitoring
5. Summary report

Duration: ~15 min (gate + selected stage + optional monitoring)
```

### Flow C: PR Validation (Pre-Merge)

**Trigger**: Open PR to main

```
1. GitHub Actions starts:
   ├─ pre-deploy-gate (full checks)
   ├─ merge-protection (coverage, bundle, etc.)
   └─ (no deploy happens)

2. Status check shows on PR:
   ├─ pre-deploy-gate: ✅ or ❌
   ├─ web (Node 22): ✅ or ❌
   ├─ functions: ✅ or ❌

3. Merge blocked if any checks fail

4. User fixes + pushes again (status auto-updates)

5. When all pass + 1 approval + conversations resolved:
   └─ Merge button enabled

Duration: ~2 min per check run
```

---

## Gate Details

### Pre-Deploy Gate (7 Checks)

| # | Check | Tool | Command | Fail = Block |
|---|-------|------|---------|--------------|
| 1 | Type-check | TypeScript | `npm run typecheck` | ✅ Yes |
| 2 | Lint | ESLint | `npm run lint` | ✅ Yes |
| 3 | Unit tests | Vitest | `npm run test:unit` | ✅ Yes |
| 4 | App build | Vite | `npm run build` | ✅ Yes |
| 5 | Functions build | TypeScript | `cd functions && npm run build` | ✅ Yes |
| 6 | Rules syntax | Firebase CLI | `firebase deploy --dry-run` | ✅ Yes |
| 7 | Secrets status | Bash + Firebase CLI | `bash scripts/preflight-secrets-check.sh` | ✅ Yes (if functions changed) |

**Exit behavior**: First failure stops gate, no deploy proceeds

**Baseline tolerances** (may be adjusted):
- Lint: 88 warnings pre-existing (reported but non-blocking)
- Coverage: 274 test baseline (improvements tracked)
- Bundle: Main chunk 362 KB (per performance.md)

### Merge Protection Gate (PR Only)

| # | Check | Tool | Command | Fail = Block PR |
|---|-------|------|---------|-----------------|
| 1 | Type-check | TypeScript | `npm run typecheck` | ✅ Yes |
| 2 | Lint | ESLint | `npm run lint` | ✅ Yes |
| 3 | Unit tests | Vitest | `npm run test:unit` | ✅ Yes |
| 4 | Coverage | Vitest + lcov-reporter | `npm run test:coverage` | ✅ Yes (≥80%) |
| 5 | Bundle size | du + gzip | `npm run build` | ✅ Yes (<420 KB) |

**Additional PR checks** (not in workflow):
- 1 approval from reviewer (GitHub setting)
- Conversations resolved (GitHub setting)
- Branches up-to-date (GitHub setting)

---

## Deployment Ordering Rationale

### Rules Before Functions

**Why**: Functions read from Firestore using rule-gated paths

```
Scenario: Rules change to tighten access control
├─ Deploy Rules first ✅
│  └─ New rules active immediately
├─ Then deploy Functions
│  └─ Functions code sees new rules
│  └─ No permission errors mid-deploy
└─ Reverse order (Functions first) = permission errors
```

### Functions Before Hosting

**Why**: Hosting calls Cloud Functions via callables

```
Scenario: Functions callable signature changes
├─ Deploy Functions first ✅
│  └─ Callable URL + endpoint stable
├─ Then deploy Hosting
│  └─ Hosting code calls stable endpoint
│  └─ No "callable not found" errors
└─ Reverse order (Hosting first) = callable errors until Functions deploy
```

### Hosting Never Auto-Deploy

**Why**: Hosting changes affect production immediately; humans should review

```
Scenario: Auto-deploy merged to main
├─ Rules + Functions auto-deploy (reasonable, no user-visible change usually)
├─ But NOT Hosting ✅
│  └─ Hosting = UI/business logic changes
│  └─ Manual deploy lets us choose timing:
│      ├─ After hours? Off-peak?
│      ├─ With L3 on-call? Escalation ready?
│      └─ Rollback plan? (Hard to rollback UI quickly)
```

---

## Post-Deploy Verification

### Smoke Tests

```
Runs: npm run test:smoke

Purpose: Integration tests on built bundle
├─ Auth flow (login/logout)
├─ CIQ core flows (each module: coagulation, imuno, uroanálise, etc.)
├─ Data persistence
└─ Export functionality

Duration: ~2 min
Failure: Warns in summary but doesn't block (can be reviewed)
Skippable: Yes, via toggle (not recommended)
```

### Cloud Logs Monitoring (1 Hour)

```
Runs: bash scripts/monitor-cloud-logs.sh 1 60

Purpose: Real-time production monitoring post-deploy
├─ Polls Cloud Logs every 60 seconds for 1 hour
├─ Searches for ERROR, CRITICAL, FAILED patterns
├─ Flags unusual spike in error frequency
└─ Generates report artifact

Duration: 60 min (auto-detectable errors flagged earlier if severe)
Failure: Warns in summary; may indicate rollback needed
Skippable: Yes, via toggle (not recommended)

Output: 
  ├─ .planning/CLOUD_LOGS_REPORT.md
  ├─ .planning/CLOUD_LOGS_ERRORS.json
  └─ Artifact: post-deploy-logs-<sha>
```

---

## Secret Status Gate (ADR-0018)

### What It Does

**Blocks deployment if any `defineSecret('NAME')` in functions/src/ has unprovisioned value**

```bash
# Script: scripts/preflight-secrets-check.sh
# Discovers: grep -rho "defineSecret('[A-Z_]+')"
# Checks: firebase functions:secrets:access NAME
# Fails if: Value is PENDING_SET_* or empty
```

### Why (Incident History)

**ADR-0017**: HMAC signing key was `PENDING_SET_PLACEHOLDER` for 15 days

```
Timeline:
├─ Secret declared in code: HCQ_SIGNATURE_HMAC_KEY
├─ Never provisioned in Firebase
├─ Firebase deployed the function anyway ✅ (technically allowed)
├─ Function code: defineSecret().value() → returned placeholder string
├─ All signatures computed with placeholder → wrong hash 🔴
├─ 15 days of invalid signatures in audit trail
├─ Incident severity: CRITICAL (audit trail tampered)

Solution (ADR-0018):
└─ Block deployment if any secret unprovisioned (this gate)
```

### How to Fix

```bash
# Step 1: See what's missing
bash scripts/preflight-secrets-check.sh
# Output:
#   ❌ HCQ_SIGNATURE_HMAC_KEY (placeholder: PENDING_SET_...)

# Step 2: Set the secret
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2
# Prompts for value → paste from KMS or password manager

# Step 3: Retry gate
bash scripts/preflight-secrets-check.sh
# Output: ✅ OK — all declared secrets have real values
```

---

## Error Handling & Rollback

### Automatic Error Detection

```
Where                        | How                    | Action
-----------------------------|------------------------|------------------
Pre-deploy gate              | Any check fails         | Block deploy (exit 1)
Deploy rules                 | Firebase API error      | Log + block functions
Deploy functions             | Build fails or API err  | Log + block hosting
Deploy hosting               | API error or timeout    | Log + notify
Post-deploy smoke tests      | Tests fail              | Warn (non-blocking)
Post-deploy Cloud Logs       | Error spike detected    | Warn + flag artifacts
```

### Rollback Decision Tree

```
Deploy failed?
  ├─ Pre-gate failed (tsc, lint, tests)
  │   └─ Fix code locally + push → auto-retry
  │
  ├─ Rules deploy failed
  │   └─ Check Firebase API logs → fix + retry
  │
  ├─ Functions deploy failed
  │   └─ Check Cloud Functions logs → fix + retry
  │
  ├─ Hosting deploy failed
  │   └─ Check Firebase Hosting logs → fix + retry
  │
  └─ Deploy succeeded but Cloud Logs shows errors
      ├─ Is error new (not in previous deploys)?
      │   ├─ Yes → ROLLBACK immediately
      │   │   └─ git revert HEAD~1 && git push
      │   │   └─ Watch as auto-triggers deploy of reverted code
      │   │
      │   └─ No → Safe to ignore or investigate
      │       └─ Create issue for next day
      │       └─ Monitor logs for error frequency increase
```

### Manual Rollback Execution

```bash
# Option 1: Simple (revert commit + redeploy)
git revert HEAD~1
git push
# Wait for auto-deploy (Rules + Functions only auto-rollback)

# Option 2: Hosting-only rollback
git checkout HEAD~1 -- src/ 
npm run build
firebase deploy --only hosting --project hmatologia2 --token $FIREBASE_TOKEN

# Option 3: Functions-only rollback
git checkout HEAD~1 -- functions/ firestore.rules
cd functions && npm run build && cd ..
firebase deploy --only firestore:rules --project hmatologia2 --token $FIREBASE_TOKEN
firebase deploy --only functions --project hmatologia2 --token $FIREBASE_TOKEN
```

---

## Monitoring & Observability

### GitHub Actions UI

**Live during deploy**:
```
Actions tab → phase-3-deploy workflow → Latest run
  ├─ Pre-Deploy Gate (running)
  │   ├─ Type-check: ✅
  │   ├─ Lint: ✅
  │   ├─ Unit tests: ✅ (3/3)
  │   └─ Build: ⏳ (in progress)
  │
  └─ (Next jobs start after gate passes)
```

### Artifacts (Retained 7-30 days)

```
post-deploy-logs-<sha>
  ├─ Cloud Logs monitoring output (JSON)
  ├─ Error summary report
  └─ Retention: 30 days

web-dist-<sha>
  ├─ Built bundle (dist/)
  ├─ For debugging dist issues
  └─ Retention: 7 days (PR artifacts)

coverage-report
  ├─ Unit test coverage HTML
  ├─ For reviewing coverage dips
  └─ Retention: 30 days (PR artifacts)

staging-test-logs
  ├─ Staging smoke test output
  └─ Retention: 30 days
```

### Firebase Console

**Real-time monitoring**:
- https://console.firebase.google.com/project/hmatologia2/functions
- https://console.firebase.google.com/project/hmatologia2/hosting
- https://console.firebase.google.com/project/hmatologia2/firestore/rules

### Google Cloud Logs

**Historical analysis** (30-day retention):
```bash
gcloud logging read \
  'severity>=ERROR AND timestamp>"2026-05-07T12:00:00Z"' \
  --project hmatologia2 \
  --limit 100
```

---

## Compliance & Audit

### RDC 978 / DICQ Compliance

**Deployment audit trail** (required for accreditation):

| Requirement | Stored Where | Retention |
|-------------|--------------|-----------|
| Who deployed | GitHub Actions log (git.commit.author) | 90 days |
| When deployed | GitHub Actions timestamp | 90 days |
| What changed | Git commit diff | Indefinite (in repo) |
| Pre-checks | GitHub status check results | 90 days |
| Post-validation | Cloud Logs + artifacts | 30 days |
| Approval | GitHub PR review + approval | Indefinite |

### Export Audit Trail

```bash
# Get all Phase 3 deploys in past month
gh run list \
  --workflow phase-3-deploy.yml \
  --status completed \
  --json name,databaseId,createdAt,conclusion \
  --limit 30 \
  > deployments_audit_export.json

# Get specific deploy details
gh run view <run-id> --json jobs,conclusion
```

---

## Performance Targets

### Deployment Duration (SLO)

| Stage | Target | Hard Limit |
|-------|--------|-----------|
| Pre-deploy gate | <5 min | 10 min |
| Rules deploy | <2 min | 5 min |
| Functions deploy | <5 min | 15 min |
| Hosting deploy | <2 min | 5 min |
| Smoke tests | <3 min | 5 min |
| Cloud Logs (1h) | 60 min | 65 min |
| **Total** | **~20 min** | **40 min** |

### Error Rate (SLO)

| Metric | Target |
|--------|--------|
| Deploy success rate | >98% |
| Pre-gate false negatives | <1% (catches >99% of issues) |
| Rollback success rate | 100% (manual control) |

---

## Extensibility

### Adding New Pre-Deploy Checks

```yaml
# In phase-3-deploy.yml, pre-deploy-gate job

- name: My Custom Check
  run: npm run my:check
  continue-on-error: false  # Set to true if non-blocking
```

### Adding New Deployment Stage

```yaml
deploy-my-resource:
  name: Deploy My Resource
  needs: [pre-deploy-gate, deploy-functions]
  if: needs.pre-deploy-gate.outputs.deploy_allowed == 'true'
  runs-on: ubuntu-latest
  steps:
    # Same pattern as deploy-rules, deploy-functions, etc.
```

### Adding New Post-Deploy Check

```yaml
post-deploy-verification:
  steps:
    - name: My Custom Validation
      run: bash scripts/my-post-deploy-check.sh
      continue-on-error: true  # Non-blocking
```

---

## FAQ

**Q: Why does hosting never auto-deploy?**  
A: Hosting = immediate user-facing change. Needs human review + timing control.

**Q: Can I deploy just one component?**  
A: Yes, use manual dispatch → `deploy_stage` selector.

**Q: What if Cloud Logs shows errors but they're old?**  
A: Monitoring script compares to baseline. If error frequency unchanged, safe.

**Q: How do I know if a secret is missing?**  
A: `bash scripts/preflight-secrets-check.sh` will fail with list of missing secrets.

**Q: Can I skip pre-deploy gates?**  
A: No, gates are mandatory. Only smoke tests + monitoring can be skipped (via toggle).

---

**Generated**: 2026-05-07  
**For**: HC Quality Phase 3+  
**Architecture version**: 1.0

