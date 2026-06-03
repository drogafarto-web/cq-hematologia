# Phase 3 Deployment Workflow — Production Gates & Rollback

> **Generated**: 2026-05-07 · **Status**: Production-ready  
> **Workflow file**: `.github/workflows/phase-3-deploy.yml`  
> **Applies to**: Phase 3+ · Hosting v1.4+

---

## Overview

This workflow implements **enterprise-grade deployment gates** for Phase 3, enforcing:

1. **Pre-Deploy Verification** (10 checks across typecheck, lint, tests, build, secrets)
2. **Staged Deployments** (Rules → Indexes → Functions → Hosting, with dependency ordering)
3. **Post-Deploy Validation** (Smoke tests + 1h Cloud Logs monitoring)
4. **Merge Protection** (Coverage ≥80%, Bundle <420 KB gzip)
5. **Auto-Rollback** on failure with manual intervention guide

---

## Deployment Modes

### Mode 1: Automatic on Merge to Main (Rules + Functions)

When code is merged to `main` and affects `firestore.rules`, `firestore.indexes.json`, or `functions/`:

```bash
# Trigger: Auto (push to main)
# Deploy: Rules → Indexes → Functions
# Hosting: Manual dispatch only (never automatic)
```

**Duration**: ~15 min (pre-gate + rules + functions + verification)

### Mode 2: Manual Dispatch (Full Control)

Triggered via GitHub Actions UI:

```bash
# https://github.com/<owner>/hc-quality/actions/workflows/phase-3-deploy.yml
# → "Run workflow" button
```

**Parameters**:

- **Deploy Stage**: `all` | `rules` | `indexes` | `functions` | `hosting`
- **Skip Smoke Tests**: Force-skip post-deploy tests (⚠️ not recommended)
- **Skip Monitoring**: Force-skip 1h Cloud Logs check (⚠️ not recommended)

**Duration**: ~20 min (full cycle with monitoring)

---

## Pre-Deploy Gate Details

**Must pass all 6 checks before any code is deployed.**

| #   | Check           | Command                                   | Failure = Block               |
| --- | --------------- | ----------------------------------------- | ----------------------------- |
| 1   | Type-check      | `npm run typecheck`                       | ✅ Yes                        |
| 2   | Lint            | `npm run lint`                            | ✅ Yes                        |
| 3   | Unit tests      | `npm run test:unit`                       | ✅ Yes                        |
| 4   | Build app       | `npm run build`                           | ✅ Yes                        |
| 5   | Build functions | `cd functions && npm run build`           | ✅ Yes                        |
| 6   | Rules syntax    | Firebase dry-run                          | ✅ Yes                        |
| 7   | Secrets status  | `bash scripts/preflight-secrets-check.sh` | ✅ Yes (if functions changed) |

**Exit on first failure** — no deployment proceeds until all gates pass.

### Secrets Gate (ADR-0018)

Before Functions deployment, verify all `defineSecret()` declarations resolve to real values (not `PENDING_SET_*` placeholders):

```bash
bash scripts/preflight-secrets-check.sh
```

**Passes**: All secrets have real values  
**Fails**: At least one secret is unprovisioned or empty

If secrets fail:

```bash
# Fix each missing secret
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2

# Re-trigger the workflow
```

---

## Deployment Order (Dependency Chain)

```
Pre-Deploy Gate (mandatory)
├─ Firestore Rules
└─ Firestore Indexes
   └─ Cloud Functions
      └─ Hosting
         └─ Post-Deploy Verification
```

**Key constraints**:

- Rules must deploy before functions (functions depend on rule logic)
- Functions must deploy before hosting (hosting depends on callable availability)
- Hosting is **manual-dispatch only** — never automatic

---

## Post-Deploy Verification

After hosting (or last deployed component), runs:

### 1. Smoke Tests (Optional)

```bash
npm run test:smoke
```

Validates critical paths (auth, CIQ, exports) against production bundle.  
**Skippable** via `skip_smoke_tests` toggle (not recommended).

### 2. Cloud Logs Monitoring (1 hour)

```bash
bash scripts/monitor-cloud-logs.sh 1 60
```

Polls Cloud Logging every 60s for 1 hour, checking for:

- `ERROR` patterns in functions
- `CRITICAL` events
- Uncaught exceptions

**Output**: Artifacts in `.planning/CLOUD_LOGS_*.md`  
**Skippable** via `skip_monitoring` toggle (not recommended).

---

## Merge Protection (PR Requirements)

**Enabled for**: All pull requests to `main`

| Gate        | Threshold                            | Failure = Block PR |
| ----------- | ------------------------------------ | ------------------ |
| Type-check  | `0 errors`                           | ✅ Yes             |
| Lint        | ESLint default + 88-warning baseline | ✅ Yes             |
| Unit tests  | All passing                          | ✅ Yes             |
| Coverage    | ≥80% statements                      | ✅ Yes             |
| Bundle size | <420 KB gzip                         | ✅ Yes             |

**Check**: GitHub PR status checks (required before merge)

---

## Rollback Procedure

### Automatic Rollback (Attempted)

If any deployment step fails, workflow:

1. ✅ Captures logs + artifacts
2. ✅ Generates rollback guide in step summary
3. ❌ **Does NOT auto-execute rollback** (manual control required)

### Manual Rollback

If deployment fails and you need to revert:

#### Firestore Rules Rollback

```bash
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules --project hmatologia2
```

#### Functions Rollback

```bash
git checkout HEAD~1 functions/
cd functions && npm run build && cd ..
firebase deploy --only functions --project hmatologia2
```

#### Hosting Rollback

```bash
# Full previous commit
git checkout HEAD~1 -- src/ functions/ firestore.rules
npm run build
firebase deploy --only hosting --project hmatologia2
```

---

## Environment & Secrets

### Required GitHub Secrets

| Secret                           | Value                    | Used By         |
| -------------------------------- | ------------------------ | --------------- |
| `FIREBASE_TOKEN`                 | Firebase CLI token       | All deploy jobs |
| `GOOGLE_APPLICATION_CREDENTIALS` | GCP service account JSON | Auth (implicit) |

**Setup**:

```bash
# Generate token (one-time)
firebase login:ci --project hmatologia2

# Store in GitHub repo settings
# Settings → Secrets and variables → Actions → New repository secret
# Name: FIREBASE_TOKEN
# Value: [token from above]
```

### Environment Variables (Built-in)

```env
PROJECT_ID=hmatologia2
NODE_VERSION=22
NPM_VERSION=10
```

---

## Monitoring & Logs

### During Deployment

**GitHub Actions UI**:

- https://github.com/`<owner>`/hc-quality/actions/workflows/phase-3-deploy.yml
- Click running workflow to watch step-by-step progress

### Post-Deployment

**Cloud Logs**:

- https://console.cloud.google.com/logs?project=hmatologia2
- Filter by:
  - `resource.type=cloud_function`
  - `severity=ERROR` or `severity=CRITICAL`

**Firebase Console**:

- https://console.firebase.google.com/project/hmatologia2/overview
- Functions, Rules, Hosting tabs

**Artifacts** (GitHub Actions):

- `post-deploy-logs-<sha>` — Cloud Logs monitoring output
- `web-dist-<sha>` — Built hosting artifacts (7-day retention)
- `coverage-report` — Unit test coverage (30-day retention)

---

## Common Scenarios

### Scenario 1: PR Blocked by Coverage

**Error**: Coverage 75% < 80% threshold

**Fix**:

```bash
# Add tests for uncovered paths
npm run test:coverage --watch
# Check coverage/index.html for gaps

# Commit and push
git add tests/
git commit -m "test: improve coverage to >80%"
git push
```

### Scenario 2: PR Blocked by Bundle Size

**Error**: Bundle 450 KB > 420 KB limit

**Fix**:

```bash
# Check what inflated the bundle
npm run analyze

# Options:
# 1. Lazy-load new large dependency
# 2. Remove dead code
# 3. Split into separate route chunk

# Rebuild and check
npm run build
# dist/index-*.js should be <420 KB
```

### Scenario 3: Secrets Check Fails

**Error**: `HCQ_SIGNATURE_HMAC_KEY` is `PENDING_SET_*`

**Fix**:

```bash
# Provision the secret
firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2
# (Paste the value when prompted)

# Re-run workflow (or git push to main)
```

### Scenario 4: Functions Deploy Fails

**Error**: TypeScript error in `functions/src/` during build

**Fix**:

```bash
# Debug locally
cd functions
npm run build
# Fix the error

# Rebuild + test
npm run build
npm run test

# Commit and re-trigger
git commit -am "fix: functions type error"
git push
```

### Scenario 5: Hosting Deploy Fails

**Error**: Service Worker registration issue

**Fix**:

```bash
# Check PWA config in vite.config.ts
# Verify dist/sw.js exists after build

npm run build
# Should see "✓ Generated X files"

# If missing, check for build errors
npm run build 2>&1 | grep -i error

# Fix and retry
git commit -am "fix: hosting build"
git push
```

### Scenario 6: Cloud Logs Shows Errors (Post-Deploy)

**Error**: 15+ ERROR lines in Cloud Logs after deploy

**Decision tree**:

```
Is it a new error (not in previous deploys)?
  ├─ Yes → Likely introduced by this deploy
  │   └─ ROLLBACK immediately (use manual procedure)
  │   └─ Investigate root cause
  │   └─ Fix + redeploy
  │
  └─ No → Likely pre-existing
      └─ Check if frequency increased
      │   ├─ Yes → Investigate + potentially rollback
      │   └─ No → Safe to ignore for now
      └─ Create GitHub issue to track
```

---

## GitHub Branch Protection Rules

**Recommended settings for `main` branch**:

| Setting                         | Value             | Rationale                   |
| ------------------------------- | ----------------- | --------------------------- |
| Require PR reviews              | 1 approval        | Human gate before merge     |
| Dismiss stale reviews           | ✅ Enabled        | Re-review after push        |
| Require status checks           | ✅ Enabled        | Pre-deploy gate must pass   |
| Required checks                 | `pre-deploy-gate` | Enforce gates before merge  |
| Require branches up-to-date     | ✅ Enabled        | No stale merges             |
| Require conversation resolution | ✅ Enabled        | Comments must be addressed  |
| Allow auto-merge                | ❌ Disabled       | Manual control over timing  |
| Dismiss PR stale reviews        | ✅ Yes            | Re-review after new commits |

**Setup** (GitHub UI):

```
Settings → Branches → Add rule
  Name pattern: main
  ✅ Require a pull request before merging
  ✅ Require status checks to pass before merging
    - Select "pre-deploy-gate"
    - Select "web (Node 22)"
    - Select "functions"
  ✅ Require branches to be up to date before merging
```

---

## FAQ

**Q: Can I deploy just hosting without rules?**  
A: Yes. Use manual dispatch mode → choose `deploy_stage: hosting`

**Q: How long does a full deployment take?**  
A: ~20 min total (pre-gate 5m + rules 2m + functions 5m + hosting 2m + verification 6m)

**Q: What if secrets gate fails in production?**  
A: Deployment is blocked. Call `firebase functions:secrets:set` for each missing secret, then re-trigger.

**Q: Can I skip smoke tests?**  
A: Yes, via `skip_smoke_tests` toggle. **Not recommended** — smoke tests catch integration bugs.

**Q: What if Cloud Logs monitoring detects errors?**  
A: Decision depends on whether error is new. See **Scenario 6** above.

**Q: How do I rollback after a bad deploy?**  
A: Manual procedure (see **Rollback Procedure** section). Auto-rollback is intentionally not implemented to prevent unintended state changes.

**Q: Can I deploy to a different Firebase project?**  
A: Modify `PROJECT_ID` env var in workflow. Requires separate `FIREBASE_TOKEN` secret for that project.

**Q: How often should I run Lighthouse CI?**  
A: Scheduled weekly (Mondays 08:00 UTC). Also runs on push to main. See `lighthouse-ci.yml`.

---

## Audit Trail

**Deployment records** (for RDC 978 compliance):

- GitHub Actions logs → `Actions` tab (retention: 90 days)
- Firebase Hosting logs → `Hosting` tab (retention: varies)
- Cloud Functions logs → `Cloud Logs` (retention: 30 days by default)
- Firestore Rules audit → `Firestore` → `Rules` tab (shows current + deploy history)

**Export logs for audit**:

```bash
# Cloud Functions (all errors in past 24h)
gcloud logging read \
  "resource.type=cloud_function AND severity=ERROR" \
  --limit 1000 \
  --format json \
  --project hmatologia2

# Hosting (deploy events)
firebase hosting:channel:list --project hmatologia2
```

---

## References

- **ADR-0018**: Deploy gate for secret status (prevents PENDING_SET placeholders)
- **ADR-0017**: HMAC baseline reset (incident that motivated secrets gate)
- **deploy-protocol.md**: Manual deploy steps (fallback if automation fails)
- **CLOUD_LOGS_MONITORING_GUIDE.md**: How to interpret Cloud Logs
- **PERFORMANCE_PATTERNS.md**: Web Vitals targets (LCP <2s, INP <200ms, CLS <0.05)

---

## Version History

| Date       | Version | Changes                                   |
| ---------- | ------- | ----------------------------------------- |
| 2026-05-07 | 1.0     | Initial workflow + guide (Phase 3 launch) |
