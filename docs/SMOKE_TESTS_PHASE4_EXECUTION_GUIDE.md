# Phase 4 E2E Smoke Test Execution Guide

**Version:** 1.0  
**Date:** 2026-05-07  
**Target Phase:** Phase 4 (2026-05-20 deployment)  
**Status:** Ready for execution

---

## Overview

This guide provides step-by-step instructions for executing the Phase 4 E2E smoke test suite. The smoke tests validate 8 critical areas before the May 20 deployment:

1. **Prerequisites** — Node.js, npm, Firebase CLI, Java
2. **TypeScript + Build** — Web app + Cloud Functions
3. **Bundle Size** — <365 KB main shell
4. **Firebase Emulator + Data Seed** — Firestore setup + test data
5. **Dev Server + E2E Tests** — 22 integration tests
6. **Lighthouse Audits** — 5 critical routes
7. **Security & Rules Validation** — Firestore security rules
8. **Summary & Sign-Off** — Pass/Fail decision

**Execution Time:** ~45 minutes (end-to-end)

**Pass Criteria:** All 8 sections PASS + 0 blockers

---

## Quick Start (TL;DR)

### macOS / Linux

```bash
cd /path/to/hc-quality
bash scripts/phase4-e2e-smoke.sh
```

**Output:**

- Console: Real-time colorized results
- Text report: `.planning/SMOKE_TEST_RESULTS_May_*.txt`
- JSON export: `.planning/SMOKE_TEST_RESULTS_May_*.json`
- Exit code: `0` (pass) or `1` (fail)

### Windows (PowerShell)

```powershell
cd C:\hc quality
.\scripts\phase4-e2e-smoke.ps1
```

Same output as above.

---

## Detailed Execution Steps

### Step 0: Pre-Flight Checklist

Before running the smoke test, verify:

- [ ] You're on the `main` branch (or Phase 4 merge-ready branch)
- [ ] All uncommitted changes are stashed: `git status`
- [ ] Internet connection is stable (Lighthouse needs to access remote sites)
- [ ] Firewall allows `localhost:8080` (emulator) and `localhost:5173` (dev server)
- [ ] You have ~500 MB free disk space
- [ ] Terminal is NOT inside a tmux/screen session (job control can interfere)

### Step 1: Prerequisites Check

**What it does:**

- Verifies Node.js 18+ / npm 9+ installed
- Checks Firebase CLI available
- Verifies Java 11+ installed (required for emulator)
- Checks npm dependencies in place

**Expected output:**

```
(1/8) PREREQUISITES CHECK
✅ PASS Node.js installed: v22.x.x
✅ PASS npm installed: 10.x.x
✅ PASS npm dependencies installed
✅ PASS Cloud Functions dependencies installed
✅ PASS Java installed
✅ PASS Firebase CLI available
```

**If it fails:**

- **Node.js not found** → Install from https://nodejs.org (LTS recommended)
- **npm not found** → npm ships with Node.js; reinstall Node.js
- **Firebase CLI not found** → `npm install -g firebase-tools`
- **Java not found** → Install JDK 11+ (e.g., `brew install openjdk@11` on macOS)

### Step 2: TypeScript + Build

**What it does:**

1. Runs `npm run typecheck` on web app
2. Runs `npm run build` to generate production bundle
3. Runs `npm run typecheck` on Cloud Functions
4. Builds Cloud Functions (`functions/npm run build`)

**Expected output:**

```
(2/8) TYPECHECK & BUILD
ℹ️  INFO Running TypeScript type check (web)...
✅ PASS TypeScript web (0 errors)
ℹ️  INFO Building production bundle (React 19 + Vite 6)...
✅ PASS Production build successful
ℹ️  INFO Running TypeScript type check (Cloud Functions)...
✅ PASS TypeScript functions (0 errors)
ℹ️  INFO Building Cloud Functions...
✅ PASS Cloud Functions build successful
```

**If it fails:**

- **TypeScript errors** → Run `npm run typecheck` locally to review errors; fix before proceeding
- **Build failed** → Check `.planning/SMOKE_TEST_RESULTS_*.txt` for build logs; likely a missing dependency
- **Functions build failed** → Verify `functions/package.json` has all required dependencies

### Step 3: Bundle Size Validation

**What it does:**

- Measures main shell (index.js) gzip size
- Verifies <365 KB (v1.3 baseline: 362 KB, 3 KB headroom)
- Measures total JS chunks, verifies <2.0 MB

**Expected output:**

```
(3/8) BUNDLE SIZE VALIDATION
✅ PASS Main shell: 362 KB (target: ≤365 KB, headroom: 3 KB)
✅ PASS Total JS chunks: 1200 KB (target: ≤2.0 MB)
```

**If it fails:**

- **Main shell exceeds 365 KB** → Investigate new dependencies; possible causes:
  - Large library imported at top-level (should be lazy-loaded)
  - Unused code not tree-shaken
  - Transitive dependency increase
  - Solution: Run `ANALYZE=true npm run build && open dist/stats.html` to identify culprit

### Step 4: Firebase Emulator + Test Data Seed

**What it does:**

1. Starts Firebase emulator (Firestore + Functions)
2. Waits for emulator to be ready
3. Seeds test data (if `scripts/seed-test-data.sh` exists)

**Expected output:**

```
(4/8) FIREBASE EMULATOR & TEST DATA SEED
ℹ️  INFO Starting Firebase emulator (Firestore + Functions)...
✅ PASS Firebase emulator started (PID: 12345)
ℹ️  INFO Seeding test data...
✅ PASS Test data seeded successfully
```

**If it fails:**

- **Emulator fails to start** → Likely Java issue; check Java is in PATH: `java -version`
- **Emulator hangs** → Port 8080 may be in use; free it: `lsof -i :8080 | grep LISTEN | awk '{print $2}' | xargs kill -9`
- **Test data seed fails** → Check if `scripts/seed-test-data.sh` exists; if not, create or mark as skipped

### Step 5: Dev Server + E2E Tests

**What it does:**

1. Starts dev server (Vite on localhost:5173)
2. Waits for dev server to be ready
3. Runs 22 E2E tests using Vitest with `--run` flag
4. Cleans up dev server and emulator

**Expected output:**

```
(5/8) DEV SERVER & E2E TEST SUITE (22 tests)
ℹ️  INFO Starting dev server (Vite)...
✅ PASS Dev server started on localhost:5173 (PID: 12346)
ℹ️  INFO Running 22 E2E tests (Vitest)...
✅ PASS E2E test suite passed (22 tests)
```

**If it fails:**

- **Dev server fails to start** → Check if port 5173 is in use; or emulator didn't start in Step 4
- **E2E tests fail** → Run locally for debugging:
  ```bash
  firebase emulators:start --only firestore,functions &
  npm run dev &
  npm run test:e2e -- --run
  ```
  Review failing test names and stack traces in output

### Step 6: Lighthouse Audits

**What it does:**

- Starts production preview server (localhost:4173)
- Audits 5 critical routes using Lighthouse
- Calculates average performance score
- Verifies ≥87/100 (v1.3 baseline: 91/100)

**Routes audited:**

1. `/` (root)
2. `/hub` (dashboard)
3. `/auth/login` (login)
4. `/features/bioquimica/runs` (CIQ module)
5. `/features/analytics` (analytics)

**Expected output:**

```
(6/8) LIGHTHOUSE AUDIT (5 critical routes)
ℹ️  INFO Starting production preview server...
ℹ️  INFO Auditing root...
✅ PASS Lighthouse root: 95/100
✅ PASS Lighthouse hub: 92/100
✅ PASS Lighthouse login: 95/100
✅ PASS Lighthouse features/bioquimica/runs: 87/100
✅ PASS Lighthouse features/analytics: 88/100
✅ PASS Average Lighthouse score: 91/100 (target: ≥87)
```

**If it fails:**

- **Lighthouse not installed** → Install: `npm install -g @lhci/cli`
- **Score <87** → Investigate using local DevTools:
  ```bash
  npm run preview
  # Open Chrome DevTools → Lighthouse tab → run audit
  # Look for bottlenecks: large bundle, slow network, render-blocking resources
  ```
- **Some routes can't audit** → May indicate page doesn't load; check `/` (root) loads first

### Step 7: Security & Rules Validation

**What it does:**

1. Starts Firestore emulator
2. Tests unauthenticated read (should be denied with HTTP 401/403)
3. Verifies security rules are enforced

**Expected output:**

```
(7/8) SECURITY & RULES VALIDATION
ℹ️  INFO Testing Firestore security rules...
✅ PASS Security rules: Unauthenticated access denied (HTTP 403)
```

**If it fails:**

- **Security rules allow unauthenticated access** → BLOCKER; check `firestore.rules` for overly permissive rules

### Step 8: Summary & Sign-Off

**What it does:**

- Prints final summary (total tests, passed, failed, warnings)
- Determines PASS/FAIL status
- Exports results to text and JSON files

**Expected output:**

```
(8/8) SMOKE TEST SUMMARY
╔════════════════════════════════════════════════════════════╗
║             PHASE 4 E2E SMOKE TEST RESULTS                 ║
╠════════════════════════════════════════════════════════════╣
║ Total Tests:      8
║ Passed:           8 ✅
║ Failed:           0 ❌
║ Warnings:         0 ⚠️
║ Execution Time:   2026-05-07 15:30:00 UTC
╠════════════════════════════════════════════════════════════╣
║ STATUS: ✅ PASS — Ready for May 20 deployment              ║
╚════════════════════════════════════════════════════════════╝

Generating result reports...
📄 Results saved:
   Text:  .planning/SMOKE_TEST_RESULTS_May_*.txt
   JSON:  .planning/SMOKE_TEST_RESULTS_May_*.json
```

---

## Pass Criteria

**Go / No-Go Decision:**

- ✅ **PASS (Go):** All 8 sections PASS, 0 blockers
- ❌ **FAIL (No-Go):** Any section FAIL or critical warning → escalate to CTO before deploying

**Critical Blockers:**

1. TypeScript errors (any)
2. Build failure (any)
3. Bundle size exceeds 365 KB
4. E2E tests failure (>0 failures)
5. Lighthouse average <87/100
6. Security rules allow unauthenticated access

**Non-Blocking Warnings:**

- Lighthouse individual route <87/100 (if average ≥87)
- Total bundle 1.5–2.0 MB (acceptable as long as lazy loading is working)
- Test data seed skipped (can be seeded manually)

---

## Troubleshooting

### "Bundle size increased by 15 KB, should I investigate?"

**Decision Tree:**

1. Is the new code essential (not speculative)? → Yes: may be acceptable
2. Is the code lazy-loaded (dynamic import)? → Yes: acceptable
3. Total still <380 KB? → Yes: document in PR, proceed with caution
4. If no to any → Block merge, request refactor

**Quick Investigation:**

```bash
ANALYZE=true npm run build
open dist/stats.html  # (macOS)
# Windows: start dist/stats.html
# Linux: xdg-open dist/stats.html
```

### "Lighthouse score dropped to 85/100, is that a fail?"

**Diagnosis:**

1. Run locally: `npm run preview && npx lighthouse http://localhost:4173/hub`
2. If local is ≥87: likely network/cache issue, re-run
3. If local is <87: investigate with DevTools Performance profiler
4. Check for new dependencies: `npm list | grep -i [new-lib]`

**Remediation:**

- Move library to lazy loading (dynamic import)
- Code-split route if it's >100KB
- Profile with Chrome DevTools: Performance tab → record navigation

### "Dev server won't start, says 'Port 5173 in use'"

```bash
# Kill existing process
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9

# (Windows PowerShell)
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### "E2E tests timeout, emulator seems slow"

**Causes:**

1. Machine under load (check CPU/RAM)
2. Emulator still loading (increase wait timeout to 30s in script)
3. Test data seed incomplete

**Fix:**

```bash
# Clear emulator cache
rm -rf ~/.cache/firebase/emulators

# Restart
firebase emulators:start --only firestore,functions
```

### "Lighthouse times out or returns empty results"

**Causes:**

1. Preview server not actually running
2. Chrome/Chromium not available on system
3. Firewall blocking requests

**Fix:**

```bash
# Verify preview is running
curl http://localhost:4173

# Install Chrome (macOS)
brew install --cask google-chrome

# Install Chrome (Linux)
sudo apt-get install chromium-browser

# Install Chrome (Windows)
# Download from https://www.google.com/chrome/
```

---

## Running Smoke Tests in CI/CD

To integrate into GitHub Actions or other CI:

```yaml
# .github/workflows/phase4-smoke-tests.yml

name: Phase 4 Smoke Tests
on: [pull_request, push]

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci && cd functions && npm ci && cd ..

      - name: Run smoke tests
        run: bash scripts/phase4-e2e-smoke.sh

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: smoke-test-results
          path: .planning/SMOKE_TEST_RESULTS_*.{txt,json}
```

---

## Post-Execution

### 1. Review Results

```bash
# Text report (human-readable)
cat .planning/SMOKE_TEST_RESULTS_May_*.txt

# JSON export (machine-readable, for CI integration)
cat .planning/SMOKE_TEST_RESULTS_May_*.json | jq .
```

### 2. If PASS:

1. ✅ Commit results to `.planning/`
2. ✅ Add comment to PR: "✅ Smoke tests PASSED (May X, 15:30 UTC)"
3. ✅ Proceed with deploy approval

### 3. If FAIL:

1. ❌ Identify blocker(s) from output
2. ❌ Fix root cause (see Troubleshooting above)
3. ❌ Re-run smoke tests: `bash scripts/phase4-e2e-smoke.sh`
4. ❌ Do NOT merge/deploy until PASS

---

## Smoke Test Timeline for May 20 Deployment

| Time (UTC) | Task                          | Owner       | Duration |
| ---------- | ----------------------------- | ----------- | -------- |
| 08:00      | Final code review + approval  | Engineering | 30 min   |
| 08:30      | Run smoke tests               | QA/DevOps   | 45 min   |
| 09:15      | Review results + CTO sign-off | CTO         | 15 min   |
| 09:30      | Deploy Step 1 (Rules)         | DevOps      | 5 min    |
| 09:35      | Deploy Step 2 (Functions)     | DevOps      | 10 min   |
| 09:45      | Deploy Step 3 (Hosting)       | DevOps      | 5 min    |
| 09:50      | Post-deploy health check      | DevOps      | 10 min   |
| 10:00      | Go-live confirmation          | CTO         | —        |

---

## Contact & Escalation

**For blockers during smoke tests:**

1. **Quick questions:** Check Troubleshooting section above
2. **Script issues:** Review logs in `.planning/` and `/tmp/`
3. **Build/TypeScript errors:** Contact engineering lead
4. **Blocker preventing deployment:** Escalate to CTO immediately

---

## Document History

| Version | Date       | Author | Changes                                    |
| ------- | ---------- | ------ | ------------------------------------------ |
| 1.0     | 2026-05-07 | CTO    | Initial guide for Phase 4 smoke test suite |

---

**Last Updated:** 2026-05-07  
**Target Phase:** Phase 4 (2026-05-20)  
**Status:** Ready for execution
