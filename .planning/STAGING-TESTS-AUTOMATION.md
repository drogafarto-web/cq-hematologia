# Staging Tests Automation

**Last Updated:** 2026-05-05  
**Status:** Setup Complete

---

## Overview

Automatic smoke testing for staging environment (`hmatologia2-staging`). When staging setup completes, tests run automatically without manual intervention.

### Components

1. **Seed Data Script** (`scripts/seed-staging-data.mjs`)
   - Populates staging Firestore with minimal test data
   - Creates test lab, test user, sample equipments/lots/suppliers
   - Runs before smoke tests

2. **Test Runner** (`scripts/run-staging-tests.sh`)
   - Executes smoke tests against staging environment
   - Verifies Firebase project is ready
   - Loads seed data
   - Runs unit tests as smoke proxy
   - Generates results summary

3. **Setup Watcher** (`scripts/watch-staging-setup.mjs`)
   - Polls for `.planning/.staging-ready` marker file
   - When detected, triggers smoke tests automatically
   - Logs all progress to `.planning/STAGING-TESTS-LOG.md`
   - Writes success/failure markers to `.planning/`

4. **GitHub Actions Workflow** (`.github/workflows/staging-tests-auto.yml`)
   - Automatic: After "Staging Deploy" workflow succeeds
   - Manual: Can be triggered via `gh workflow run`
   - Scheduled: Daily at 2 AM UTC (9 PM BRT)

---

## How It Works

### Automatic Trigger (Staging Setup → Tests)

```
Staging Setup Script
    ↓
    (creates Firestore, deploys Functions, etc.)
    ↓
    Creates `.planning/.staging-ready` marker
    ↓
watch-staging-setup.mjs detects marker
    ↓
    Runs seed-staging-data.mjs
    ↓
    Runs run-staging-tests.sh
    ↓
    Results written to:
      - .planning/STAGING-TEST-RESULTS.md
      - .planning/STAGING-TESTS-LOG.md
    ↓
Success/Failure marker created
```

### Manual Trigger (GitHub Actions)

```bash
# Option 1: Using GitHub CLI
gh workflow run staging-tests-auto.yml

# Option 2: With custom lab ID
gh workflow run staging-tests-auto.yml -f lab_id=custom-lab-002

# Option 3: Via GitHub UI
# 1. Go to Actions tab
# 2. Select "Staging Tests Auto" workflow
# 3. Click "Run workflow"
# 4. Fill in Lab ID if desired
# 5. Click "Run"
```

---

## Usage Guide

### Prerequisites

1. Firebase Admin SDK installed in project
2. `firebase-tools` CLI available
3. Node 22.x environment

### Running Seed Data Alone

```bash
export FIREBASE_PROJECT_ID=hmatologia2-staging
export TEST_LAB_ID=test-lab-001
node scripts/seed-staging-data.mjs
```

**Output:**
- Test lab created in Firestore
- Test user created with module access claims
- Sample equipments, suppliers, lots created
- Credentials written to `./.staging-test-creds.json`

### Running Tests Alone

```bash
bash scripts/run-staging-tests.sh --lab-id=test-lab-001 --project=hmatologia2-staging
```

**Output:**
- `.planning/STAGING-TEST-RESULTS.md` — Test results summary
- `.planning/STAGING-TESTS-LOG.md` — Detailed execution log

### Running Full Watch Loop

```bash
# Terminal 1: Start watcher (runs for up to 1 hour)
node scripts/watch-staging-setup.mjs

# Terminal 2: When ready, create the marker
mkdir -p .planning
touch .planning/.staging-ready

# Watcher will detect marker and trigger tests automatically
```

**Customization:**

```bash
# Watch with custom timeout (in seconds)
STAGING_WATCH_TIMEOUT=7200 node scripts/watch-staging-setup.mjs

# Watch with custom lab ID
TEST_LAB_ID=my-lab-123 node scripts/watch-staging-setup.mjs
```

---

## Results & Logs

### Test Results File
**Location:** `.planning/STAGING-TEST-RESULTS.md`

```markdown
# Staging Test Results

**Date:** 2026-05-05T12:34:56Z
**Project:** hmatologia2-staging
**Lab ID:** test-lab-001

## Status

- ✓ Staging project verified
- ✓ Seed data loaded successfully
- ✓ Smoke tests PASSED

## Outcome

Staging environment is **READY FOR MANUAL QA**
```

### Detailed Log File
**Location:** `.planning/STAGING-TESTS-LOG.md`

Contains timestamped entries for each step:
- Project readiness verification
- Seed data script execution
- Test framework checks
- Actual test run output
- Any errors or warnings

### Success Markers
- `.planning/.staging-tests-passed` — Created when all tests pass
- `.planning/.staging-tests-failed` — Created when tests fail
- `.planning/.staging-setup-timeout` — Created when watcher times out

---

## Troubleshooting

### Seed Data Script Fails

**Error: "Firebase project not found"**
```bash
# Verify project exists
firebase projects:list

# Set project explicitly
export FIREBASE_PROJECT_ID=hmatologia2-staging
```

**Error: "User creation failed"**
```bash
# Check Auth is enabled in staging project
firebase auth:emulate (if using emulator)

# Or verify production Auth settings
```

### Tests Don't Run After Marker Created

**Check watcher is running:**
```bash
ps aux | grep watch-staging-setup
```

**Check marker file exists:**
```bash
ls -la .planning/.staging-ready
```

**Check log file for errors:**
```bash
cat .planning/STAGING-TESTS-LOG.md
```

### GitHub Actions Workflow Not Triggering

**Check workflow is enabled:**
```bash
gh workflow list --all | grep staging-tests-auto
```

**Manual trigger instead:**
```bash
gh workflow run staging-tests-auto.yml -f lab_id=test-lab-001
```

**Check workflow logs:**
```bash
gh run list --workflow=staging-tests-auto.yml
gh run view <run-id> --log
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FIREBASE_PROJECT_ID` | `hmatologia2-staging` | Staging Firebase project ID |
| `TEST_LAB_ID` | `test-lab-001` | Lab ID to seed and test with |
| `STAGING_WATCH_TIMEOUT` | `3600` | Watcher timeout in seconds (1 hour) |
| `FIREBASE_EMULATOR_HOST` | (unset) | If set, use local emulator instead of production |
| `TEST_TIMEOUT` | `300` | Test execution timeout in seconds (5 minutes) |

---

## Integration Points

### Staging Setup Script
When your staging setup script completes, it should create:
```bash
mkdir -p .planning
touch .planning/.staging-ready
```

The watcher will detect this and run tests automatically.

### CI/CD Pipeline
The GitHub Actions workflow is triggered by:
1. Manual dispatch (`gh workflow run`)
2. Success of "Staging Deploy" workflow
3. Daily schedule (2 AM UTC)

### Slack/Email Notifications
To add notifications, extend the workflow with:
```yaml
- name: Notify Slack
  if: always()
  uses: slackapi/slack-github-action@v1.24.0
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Staging tests: ${{ job.status }}"
      }
```

---

## Performance & Limits

- **Seed Time:** ~5-10 seconds (depends on Firestore write latency)
- **Test Time:** ~30-60 seconds (unit tests as smoke proxy)
- **Total Time:** ~1-2 minutes per run
- **Timeout:** 5 minutes total (configurable)
- **Retries:** None built-in (add in CI if needed)

---

## Future Enhancements

- [ ] E2E tests via Playwright (currently unit tests as proxy)
- [ ] Screenshot captures on failure
- [ ] Slack notifications on completion
- [ ] Email digest of test results
- [ ] Performance benchmarking
- [ ] Load testing (staging-specific)
- [ ] Multi-lab parallel seeding

---

## References

- Staging Firebase Project: `hmatologia2-staging`
- Staging URL: `https://hmatologia2-staging.web.app`
- Test Data: Created fresh before each run, not persisted
- Credentials: Automatically generated, stored in `.staging-test-creds.json`

