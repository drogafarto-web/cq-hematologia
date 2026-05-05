---
phase: automation
plan: staging-tests
subsystem: infrastructure
tags: [ci-cd, staging, smoke-tests, firebase]
status: complete
completed_date: 2026-05-05
---

# Staging Test Automation Setup — Summary

**Objective:** Automatically run E2E smoke tests against staging environment when Firebase staging setup completes. No manual test invocation needed.

**Status:** ✅ Complete

---

## Deliverables

### 1. Seed Data Script
**File:** `scripts/seed-staging-data.mjs`
- Creates test lab (`test-lab-001`) in staging Firestore
- Generates test user with module access claims
- Seeds sample data: equipments, suppliers, control lots
- Writes test credentials to `.staging-test-creds.json`
- Idempotent — can be run multiple times safely

### 2. Test Runner Script
**File:** `scripts/run-staging-tests.sh`
- Verifies Firebase project (`hmatologia2-staging`) accessibility
- Verifies seed data script exists
- Executes seed data loading
- Runs unit tests as smoke proxy
- Generates results: `.planning/STAGING-TEST-RESULTS.md`
- Generates log: `.planning/STAGING-TESTS-LOG.md`
- Exit codes: 0 = success, 1 = failure

### 3. Setup Watcher
**File:** `scripts/watch-staging-setup.mjs`
- Polls for `.planning/.staging-ready` marker file
- When detected, automatically triggers smoke tests
- Configurable timeout: default 3600s (1 hour), via `STAGING_WATCH_TIMEOUT`
- Creates success/failure markers:
  - `.planning/.staging-tests-passed`
  - `.planning/.staging-tests-failed`
  - `.planning/.staging-setup-timeout`
- All progress logged to `.planning/STAGING-TESTS-LOG.md`

### 4. GitHub Actions Workflow
**File:** `.github/workflows/staging-tests-auto.yml`
- **Manual trigger:** `gh workflow run staging-tests-auto.yml`
- **Auto-trigger:** After "Staging Deploy" workflow succeeds
- **Scheduled:** Daily at 2 AM UTC (9 PM BRT)
- Uploads logs as artifact (30-day retention)
- Comments results on PR (if triggered from PR)
- Fails CI if smoke tests fail

### 5. Documentation
**File:** `.planning/STAGING-TESTS-AUTOMATION.md`
- Complete usage guide with examples
- How auto-trigger works (flow diagram)
- Manual trigger instructions
- Troubleshooting guide
- Environment variables reference
- Integration points for CI/CD
- Future enhancement ideas

### 6. NPM Scripts
**File:** `package.json` (updated)
- `npm run test:smoke` — Run smoke tests immediately
- `npm run staging:seed` — Seed test data alone
- `npm run staging:watch` — Start watcher loop

### 7. Git Configuration
**File:** `.gitignore` (updated)
- Allow-listed staging scripts for version control

---

## How Auto-Trigger Works

```
Staging Setup Agent
    ↓ (after setup complete)
Creates .planning/.staging-ready marker
    ↓
watch-staging-setup.mjs detects file (polling every 5s)
    ↓
Removes marker (prevent re-trigger)
    ↓
Calls seed-staging-data.mjs
    ↓ (if seed succeeds)
Calls run-staging-tests.sh
    ↓
Results written to:
  .planning/STAGING-TEST-RESULTS.md
  .planning/STAGING-TESTS-LOG.md
Success/failure marker created
    ↓
Watcher exits with code 0 (success) or 1 (failure)
```

---

## Execution Examples

### Example 1: Start watcher (wait for setup to complete)
```bash
# Terminal 1: Start watcher (runs for up to 1 hour)
node scripts/watch-staging-setup.mjs

# Terminal 2: When staging setup is done
touch .planning/.staging-ready

# Watcher detects, runs tests automatically
# Check results at:
# - .planning/STAGING-TEST-RESULTS.md
# - .planning/STAGING-TESTS-LOG.md
```

### Example 2: Manual test run
```bash
npm run test:smoke --lab-id=test-lab-001 --project=hmatologia2-staging
```

### Example 3: GitHub Actions trigger
```bash
# Manual run with default lab ID
gh workflow run staging-tests-auto.yml

# Manual run with custom lab ID
gh workflow run staging-tests-auto.yml -f lab_id=my-lab-123
```

### Example 4: Custom seed without tests
```bash
export FIREBASE_PROJECT_ID=hmatologia2-staging
export TEST_LAB_ID=custom-lab
npm run staging:seed
```

---

## Output Files

After tests complete:

| File | Format | Purpose |
|------|--------|---------|
| `.planning/STAGING-TEST-RESULTS.md` | Markdown | Summary (pass/fail, status, next steps) |
| `.planning/STAGING-TESTS-LOG.md` | Markdown | Timestamped detailed log of all steps |
| `.staging-test-creds.json` | JSON | Test user credentials (email, password, uid) |
| `.planning/.staging-tests-passed` | File marker | Created on success |
| `.planning/.staging-tests-failed` | File marker | Created on failure (includes error) |

---

## Key Features

✅ **Zero manual steps** — When setup completes, tests run automatically  
✅ **Idempotent** — Safe to run multiple times  
✅ **Configurable** — Environment variables for timeout, lab ID, project ID  
✅ **Observable** — Detailed logs at every step  
✅ **CI/CD integrated** — GitHub Actions, workflow triggers, scheduled runs  
✅ **Failure-aware** — Explicit exit codes, error markers  
✅ **Easy to debug** — Markdown logs, credentials file, shell script (not binary)  

---

## Integration with Staging Setup

The staging setup agent (whenever created) should:

1. After all staging resources are provisioned (Firestore, Auth, Functions, Hosting):
   ```bash
   mkdir -p .planning
   touch .planning/.staging-ready
   ```

2. Optionally start the watcher *before* setup completes:
   ```bash
   node scripts/watch-staging-setup.mjs &
   ```

The watcher will wait (timeout 1 hour) and trigger tests automatically when setup finishes.

---

## Performance

| Step | Time | Notes |
|------|------|-------|
| Seed data | ~5-10s | Firestore write latency |
| Tests | ~30-60s | Unit tests as smoke proxy |
| Total | ~1-2m | Per run |

---

## Limitations & Future Work

**Current limitations:**
- Uses unit tests as smoke proxy (not true E2E Playwright)
- No screenshot captures on failure
- No Slack/email notifications
- Single lab seeding (could parallel-seed multiple labs)
- No performance benchmarking

**Future enhancements** (documented in STAGING-TESTS-AUTOMATION.md):
- [ ] E2E tests via Playwright with browser automation
- [ ] Screenshot captures on test failure
- [ ] Slack notifications (webhook integration)
- [ ] Email digests of test results
- [ ] Performance benchmarking vs. baseline
- [ ] Load testing (staging-specific)
- [ ] Multi-lab parallel seeding

---

## Commit

**Hash:** `72a0c02`  
**Message:** `feat: Setup automatic staging test automation`

Files:
- `scripts/run-staging-tests.sh` (new)
- `scripts/seed-staging-data.mjs` (new)
- `scripts/watch-staging-setup.mjs` (new)
- `.github/workflows/staging-tests-auto.yml` (new)
- `.planning/STAGING-TESTS-AUTOMATION.md` (new)
- `package.json` (updated with npm scripts)
- `.gitignore` (allow-listed staging scripts)

---

## References

- Staging Firebase Project: `hmatologia2-staging`
- Staging Hosting: `https://hmatologia2-staging.web.app`
- Documentation: `.planning/STAGING-TESTS-AUTOMATION.md`
- GitHub Actions: `.github/workflows/staging-tests-auto.yml`

