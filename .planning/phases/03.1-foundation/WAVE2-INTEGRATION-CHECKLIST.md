# Phase 3.1 Wave 2 — Integration & Validation Checklist

**Phase:** 03.1-foundation (Mobile + Analytics + Export)
**Wave:** 2 (Integration & Validation)
**Status:** READY FOR EXECUTION
**Date:** 2026-05-05
**Owner:** Engineering Lead + QA Lead

---

## Overview

Wave 2 validates that all three modules (mobile, analytics, export) built in Wave 1 compile, run, and integrate correctly. This is a **go/no-go gate** for Phase 3.2. All tasks in this checklist must pass before proceeding to feature development.

**Critical Path:**

1. Mobile compiles & runs in simulator (1-2 hours)
2. Analytics Cloud Functions deploy & execute (1-2 hours)
3. Export job flow end-to-end (1-2 hours)
4. CI/CD pipeline verification (30 min)
5. Performance gates (30 min)
6. Security audit (1 hour)
7. Documentation & decision (1 hour)

**Total estimated time: 6-8 hours for full Wave 2 validation**

---

## 1. MOBILE PROJECT VALIDATION (Task 1)

### 1.1 TypeScript Compilation

**Objective:** Ensure mobile project has zero type errors.

**Checklist:**

```bash
cd hc-quality-mobile
npx tsc --noEmit
```

- [ ] Exit code: 0
- [ ] No `error TS####` messages in output
- [ ] All `.ts` and `.tsx` files type-check correctly
- [ ] Type errors (if any) documented with resolution plan

**Success Criteria:**

- Clean compile with no warnings

---

### 1.2 Dependency Installation

**Objective:** Verify all npm dependencies resolve without conflicts.

**Checklist:**

```bash
cd hc-quality-mobile
npm ci
```

- [ ] Exit code: 0
- [ ] No `npm WARN` messages (allowed: deprecated warnings, ok to document)
- [ ] `node_modules/` populated
- [ ] `package-lock.json` consistent with latest commits
- [ ] No peer dependency violations

**Success Criteria:**

- Dependencies installed cleanly

---

### 1.3 Unit Test Suite

**Objective:** Verify unit tests pass with >80% test count coverage.

**Checklist:**

```bash
cd hc-quality-mobile
npm run test:unit
```

**Expected output format:**

```
PASS  src/__tests__/store/useAuthStore.test.ts
  useAuthStore
    ✓ initializes with null user (XXms)
    ✓ sets active lab ID (XXms)
    ✓ clears auth on logout (XXms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
Snapshots:   0 total
Time:        X.XXXs
```

**Validation:**

- [ ] All test suites marked `PASS`
- [ ] No tests marked `FAIL` or `SKIP`
- [ ] Total tests ≥ 3 (count from output)
- [ ] No timeout errors (>5s per test)
- [ ] Coverage output (if available): ≥80%

**Failing test handling:**

- If test fails: Document test name, error message, and root cause
- Assign fix: Blocking issue for Phase 3.1 Wave 3 (hotfix)

**Success Criteria:**

- 100% of tests passing, 0 failures

---

### 1.4 Metro / Expo Dev Server

**Objective:** Verify dev server can start and serve bundle.

**Checklist:**

```bash
cd hc-quality-mobile
npm start
```

**Expected output:**

```
expo start
```

Or for React Native CLI:

```
npm start
```

**Validation:**

- [ ] Dev server starts without crashes (wait 10s)
- [ ] Output contains QR code or Metro bundler message
- [ ] No `Error:` messages in console
- [ ] Bundling completes (may take 20-30s first run)

**Success Criteria:**

- Dev server operational, ready for simulator launch

---

### 1.5 iOS Simulator Launch (macOS Only)

**Objective:** Mobile app boots in simulator and renders AuthScreen.

**Prerequisites:**

- [ ] Xcode installed (macOS)
- [ ] iOS Simulator available (`xcode-select --install` if needed)

**Checklist:**

```bash
cd hc-quality-mobile
npm run ios
```

**Expected behavior:**

1. Simulator boots (shows Apple logo, loads iOS)
2. App installs into simulator
3. App launches and displays **AuthScreen**
4. Dark background visible (#0a0a0a or similar)
5. Two text inputs visible (email, password)
6. Login button visible and tappable

**Validation:**

- [ ] Simulator boots within 60 seconds
- [ ] App bundle loaded (watch for "Building" messages)
- [ ] App launches without red screen (crash)
- [ ] AuthScreen renders with:
  - [ ] Dark background (#0a0a0a)
  - [ ] Email input field
  - [ ] Password input field
  - [ ] Login button
- [ ] No console errors in Xcode or metro output
- [ ] Text is legible (contrast check)

**Failing simulator launch:**

- If simulator won't boot: Check Xcode installation, try `xcrun simctl erase all`, retry
- If app won't install: Check build logs for compilation errors, escalate to Wave 3
- If red screen: Document error message, escalate

**Success Criteria:**

- App boots, AuthScreen renders, no crashes

---

### 1.6 Navigation Flow (Manual Test)

**Objective:** Verify conditional navigation based on auth state.

**Checklist:**

1. App is running in simulator (from 1.5)
2. Type in email field: `test@example.com`
3. Type in password field: `password123`
4. Tap the Login button
5. Observe:
   - [ ] Button shows loading state (spinner or disabled)
   - [ ] Firebase auth attempt made (check if connected to test Firebase project)
   - [ ] If auth succeeds: Navigate to HomeScreen
   - [ ] If auth fails: Display error message (invalid credentials)
   - [ ] No crash or white screen of death

**Expected outcomes:**

- **Case 1 (success):** Firebase test user exists → login succeeds → HomeScreen loads
- **Case 2 (failure):** Invalid credentials → error message displayed (no crash)
- **Case 3 (no Firebase):** Emulator mode → error message or placeholder (acceptable for Phase 3.1)

**Validation:**

- [ ] Login flow completes without crashing
- [ ] Navigation responds to auth state
- [ ] Error handling is user-friendly (message, not exception)

**Success Criteria:**

- Navigation flow works without crashes

---

### 1.7 GitHub Actions CI Pipeline

**Objective:** Mobile CI workflow triggers on commit and passes.

**Prerequisites:**

- [ ] `.github/workflows/mobile-ci.yml` exists in repo
- [ ] Workflow configured to trigger on `push` to `mobile/**` or `**` (depends on config)

**Checklist:**

1. Make a test commit:
   ```bash
   cd hc-quality-mobile
   echo "// test" >> src/App.tsx
   git add src/App.tsx
   git commit -m "test: trigger CI"
   git push origin main  # or feature branch
   ```
2. Navigate to GitHub repo: `Actions` tab
3. Find the workflow run triggered by your commit
4. Observe:
   - [ ] Workflow job appears in list (within 5 minutes)
   - [ ] Status: **In progress** → **Passed** (green checkmark)
   - [ ] All steps completed:
     - [ ] `Checkout code`
     - [ ] `Setup Node`
     - [ ] `npm ci`
     - [ ] `npm run build` or `tsc --noEmit`
     - [ ] `npm run test:unit`

**Expected workflow steps (from `.github/workflows/mobile-ci.yml`):**

```yaml
- name: Checkout code
  uses: actions/checkout@v4

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20

- name: Install dependencies
  run: npm ci --prefix hc-quality-mobile

- name: Type check
  run: npx tsc --noEmit --prefix hc-quality-mobile

- name: Run tests
  run: npm --prefix hc-quality-mobile run test:unit
```

**Validation:**

- [ ] Workflow triggered automatically
- [ ] All steps pass (no red X marks)
- [ ] No timeout errors (job limit: 6 hours)
- [ ] No secrets exposed in logs

**Success Criteria:**

- CI pipeline runs and passes on commit

---

## 2. ANALYTICS MODULE VALIDATION (Task 2)

### 2.1 Cloud Functions Compilation

**Objective:** Ensure Cloud Functions compile without TypeScript errors.

**Checklist:**

```bash
cd functions
npm run build
```

**Expected output:**

```
$ tsc
```

Exit code: 0

**Validation:**

- [ ] Exit code: 0
- [ ] No TypeScript errors
- [ ] Output directory created (typically `lib/` or `dist/`)
- [ ] All `.js` files generated from `.ts` sources

**Success Criteria:**

- Cloud Functions compile cleanly

---

### 2.2 Firestore Indices Verification

**Objective:** Confirm required composite indices exist in Firestore.

**Prerequisites:**

- [ ] Firebase project initialized: `hmatologia2`
- [ ] Firestore emulator available (or live Firebase Console access)

**Checklist:**

**Via Firebase Console:**

1. Navigate to: https://console.firebase.google.com/project/hmatologia2/firestore/indexes
2. Look for composite indices:
   - [ ] Index on `runs/{labId}/entries` with fields: `(status, deletadoEm)` — Status: `Enabled`
   - [ ] Any aggregation query indices from Phase 2 CT-05

**Via gcloud CLI:**

```bash
gcloud firestore indexes list --project=hmatologia2
```

**Expected indices:**

```
NAME                                      COLLECTION    FIELDS
...
runs-labId-status-deletadoEm               runs        (status, deletadoEm)
...
```

**If indices missing:**

1. Create index file: `firestore.indexes.json`
   ```json
   {
     "indexes": [
       {
         "collectionGroup": "entries",
         "queryScope": "Collection",
         "fields": [
           { "fieldPath": "status", "order": "ASCENDING" },
           { "fieldPath": "deletadoEm", "order": "ASCENDING" }
         ]
       }
     ]
   }
   ```
2. Deploy: `gcloud firestore indexes create --config=firestore.indexes.json --project=hmatologia2`

**Validation:**

- [ ] All required indices exist
- [ ] Index status: `Enabled`
- [ ] No error messages in Console

**Success Criteria:**

- Required indices verified or created

---

### 2.3 Analytics Unit Tests

**Objective:** Unit tests for analytics modules pass.

**Checklist:**

```bash
npm --prefix functions run test -- --testPathPattern=analytics
npm run test:unit -- --testPathPattern=analytics
```

**Expected output:**

```
PASS  functions/__tests__/modules/analytics/queryCIQCompliance.test.mjs
  queryCIQCompliance
    ✓ computes valid run count correctly (XXms)
    ✓ returns all required metrics fields (XXms)
    ✓ compliance percent is between 0-100 (XXms)

PASS  src/__tests__/features/analytics/useAnalytics.test.ts
  useAnalytics helpers
    ✓ formats metrics for display (XXms)
    ✓ detects stale data (>30min old) (XXms)
    ✓ detects fresh data (<30min old) (XXms)
    ✓ returns null metadata as stale (XXms)

Test Suites: 2 passed, 2 total
Tests:       7 passed, 7 total
```

**Validation:**

- [ ] Query tests pass (≥3 tests):
  - [ ] `computes valid run count correctly`
  - [ ] `returns all required metrics fields`
  - [ ] `compliance percent is between 0-100`
- [ ] Hook tests pass (≥4 tests):
  - [ ] `formats metrics for display`
  - [ ] `detects stale data`
  - [ ] `detects fresh data`
  - [ ] `returns null metadata as stale`
- [ ] No failing tests
- [ ] No timeout errors

**Success Criteria:**

- 7+ unit tests passing, 0 failures

---

### 2.4 Cloud Emulator Setup & Firestore Initialization

**Objective:** Start Firebase emulators and initialize test data.

**Checklist:**

**Step 1: Update `firebase.json`**

```json
{
  "emulators": {
    "firestore": {
      "port": 8080,
      "host": "localhost"
    },
    "functions": {
      "port": 5001,
      "host": "localhost"
    },
    "pubsub": {
      "port": 8085,
      "host": "localhost"
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  },
  "projects": {
    "default": "hmatologia2"
  }
}
```

- [ ] `firebase.json` updated with emulators section

**Step 2: Create `functions/.env.local`**

```
GCLOUD_PROJECT=hmatologia2
FIREBASE_DATABASE_EMULATOR_HOST=localhost:8080
PUBSUB_EMULATOR_HOST=localhost:8085
```

- [ ] `.env.local` exists with environment variables

**Step 3: Start emulators**

```bash
firebase emulators:start --only firestore,functions,pubsub
```

**Expected output:**

```
✔  firestore emulator started on port 8080
✔  functions emulator started on port 5001
✔  pubsub emulator started on port 8085
✔  emulator UI started on port 4000

Use `firebase emulators:exec "your command"` to run an async command with these emulators.
```

- [ ] All emulators started successfully
- [ ] No error messages (wait 10s)
- [ ] UI accessible at http://localhost:4000

**Validation:**

- [ ] Emulator UI loads (no connection errors)
- [ ] Firestore tab shows empty Firestore state
- [ ] No port conflicts (if ports already in use, find process and kill)

**Success Criteria:**

- Emulators running, UI accessible

---

### 2.5 Scheduled Function Execution (Manual Trigger)

**Objective:** Verify scheduled Cloud Function runs and computes metrics.

**Prerequisites:**

- [ ] Emulators running (from 2.4)
- [ ] Test lab data in Firestore emulator (or function handles empty state)

**Checklist:**

**Step 1: Manually trigger aggregateAnalytics function**

```bash
curl -X POST http://localhost:5001/hmatologia2/southamerica-east1/aggregateAnalytics \
  -H "Content-Type: application/json"
```

**Expected response:**

```json
{
  "success": true,
  "message": "Hourly aggregation completed",
  "labsProcessed": 1,
  "errors": []
}
```

**Validation:**

- [ ] HTTP 200 response
- [ ] Success field: `true`
- [ ] `labsProcessed` ≥ 0 (0 if no labs exist, acceptable)
- [ ] `errors` array empty or contains non-blocking issues

**Step 2: Check function logs**
In emulator console output, observe:

- [ ] Log: `[Analytics] Hourly aggregation started`
- [ ] Log: `[Analytics] ✓ Lab {labId}: cached metrics` (for each lab)
- [ ] Log: `[Analytics] Aggregation completed in XXXms`

**Validation:**

- [ ] Function completes within 30 seconds (no timeout)
- [ ] Logs show metrics computed (no errors)

**Success Criteria:**

- Scheduled function executes, computes metrics, completes in <30s

---

### 2.6 Analytics Cache Verification

**Objective:** Verify aggregated metrics stored in Firestore with correct schema.

**Prerequisites:**

- [ ] `aggregateAnalytics` function executed (from 2.5)
- [ ] Emulator UI accessible at http://localhost:4000

**Checklist:**

**Step 1: Navigate to Emulator UI**

- Open http://localhost:4000 in browser
- Click "Firestore" tab

**Step 2: Locate cache document**

- Collection: `labs`
- Document: `{any-test-labId}`
- Sub-collection: `analytics`
- Sub-collection: `cache`
- Document: `metrics` (or `ciqCompliance`)

**Expected path:** `/labs/{labId}/analytics/cache/metrics/ciqCompliance`

**Step 3: Verify cache document structure**

- [ ] Document exists
- [ ] Fields present:
  - [ ] `totalRuns` (number ≥ 0)
  - [ ] `validRuns` (number ≥ 0)
  - [ ] `invalidRuns` (number ≥ 0)
  - [ ] `compliancePercent` (number 0-100)
  - [ ] `computedAt` (timestamp)
  - [ ] `openNCs` (number ≥ 0, if applicable)
  - [ ] `closedNCs` (number ≥ 0, if applicable)
- [ ] No errors in schema
- [ ] Data types match schema (number, timestamp, etc.)

**Validation:**

- [ ] Cache document structure matches schema
- [ ] All required fields present
- [ ] Data is sensible (compliance percent between 0-100)

**Success Criteria:**

- Cache document created with correct schema

---

### 2.7 React Hook Testing (useAnalytics)

**Objective:** Verify React hook reads cache without blocking.

**Checklist:**

```bash
npm run test:unit -- useAnalytics
```

**Expected output:**

```
PASS  src/__tests__/features/analytics/useAnalytics.test.ts
  useAnalytics helpers
    ✓ formatAnalyticsMetrics formats output (XXms)
    ✓ isAnalyticsStale detects >30min data (XXms)
    ✓ isAnalyticsStale detects null metadata (XXms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

**Validation:**

- [ ] Helper function tests pass (format, staleness)
- [ ] No timeout errors
- [ ] All assertions passing

**Success Criteria:**

- Hook tests pass, hook logic verified

---

## 3. EXPORT MODULE VALIDATION (Task 3)

### 3.1 Pub/Sub Topic & Subscription Setup

**Objective:** Ensure Pub/Sub infrastructure exists for export worker.

**Prerequisites:**

- [ ] gcloud CLI installed and authenticated
- [ ] Project: `hmatologia2` (set as default or via `--project` flag)

**Checklist:**

**Step 1: Create Pub/Sub topic (or verify exists)**

```bash
gcloud pubsub topics create exports \
  --project=hmatologia2 2>/dev/null && echo "✓ Topic created" || echo "✓ Topic already exists"
```

- [ ] Command completes without error
- [ ] Output: "Topic created" or "Topic already exists"

**Step 2: Create subscription (or verify exists)**

```bash
gcloud pubsub subscriptions create exports-worker \
  --topic=exports \
  --push-endpoint=http://localhost:5001/hmatologia2/southamerica-east1/exportWorker \
  --push-auth-service-account=default@hmatologia2.iam.gserviceaccount.com \
  --project=hmatologia2 \
  2>/dev/null && echo "✓ Subscription created" || echo "✓ Subscription already exists"
```

- [ ] Command completes without error
- [ ] Output: "Subscription created" or "Subscription already exists"

**Verification (via Console):**

- Navigate to: https://console.cloud.google.com/cloudpubsub/topic/list?project=hmatologia2
- [ ] Topic: `exports` exists
- [ ] Subscription: `exports-worker` exists and points to correct endpoint

**Success Criteria:**

- Pub/Sub topic and subscription created/verified

---

### 3.2 Export Unit Tests

**Objective:** Export module unit tests pass.

**Checklist:**

```bash
npm --prefix functions run test -- --testPathPattern=export
npm run test:unit -- --testPathPattern=export
```

**Expected output:**

```
PASS  functions/__tests__/modules/export/initiateExport.test.mjs
  initiateExport validation
    ✓ rejects missing format (XXms)
    ✓ rejects invalid format (XXms)
    ✓ rejects startDate >= endDate (XXms)
    ✓ rejects date range > 1 year (XXms)
    ✓ generates jobId (XXms)

PASS  functions/__tests__/modules/export/xlsxGenerator.test.mjs
  xlsxGenerator
    ✓ generates XLSX with correct headers (XXms)
    ✓ flattens nested data (XXms)
    ✓ produces valid magic bytes (XXms)
    ✓ handles empty data gracefully (XXms)

PASS  src/__tests__/features/export/useExportJobs.test.ts
  useExportJobs helpers
    ✓ formatFileSize formats bytes correctly (XXms)
    ✓ formatDuration formats seconds (XXms)
    ✓ isDownloadExpiring detects 7-day expiry (XXms)

Test Suites: 3 passed, 3 total
Tests:       12 passed, 12 total
```

**Validation:**

- [ ] Callable validation tests pass (≥5 tests)
- [ ] XLSX generator tests pass (≥4 tests)
- [ ] Hook helper tests pass (≥3 tests)
- [ ] Total: ≥12 tests passing
- [ ] No failures or timeouts

**Success Criteria:**

- 12+ unit tests passing, 0 failures

---

### 3.3 XLSX Generator Validation

**Objective:** Verify XLSX generator produces valid output.

**Checklist:**

**Step 1: Create test file to invoke generator**
Create `test-xlsx-generation.mjs`:

```javascript
import {
  generateXlsx,
  generateSampleData,
} from './functions/src/modules/export/generators/xlsxGenerator.ts';

const sampleData = generateSampleData(100);
console.log(`Sample data rows: ${sampleData.length}`);

const buffer = await generateXlsx(sampleData);
console.log(`Generated XLSX buffer: ${buffer.length} bytes`);
console.log(`Magic bytes: ${buffer.subarray(0, 4).toString('hex')}`);

if (buffer.subarray(0, 4).toString('hex') === '504b0304') {
  console.log('✓ Valid ZIP header (XLSX)');
} else {
  console.log('✗ Invalid XLSX magic bytes');
  process.exit(1);
}
```

**Step 2: Run test**

```bash
node test-xlsx-generation.mjs
```

**Expected output:**

```
Sample data rows: 100
Generated XLSX buffer: 8192 bytes (or larger)
Magic bytes: 504b0304
✓ Valid ZIP header (XLSX)
```

**Validation:**

- [ ] Sample data generated (100 rows)
- [ ] XLSX buffer created (size > 5KB for 100 rows)
- [ ] Magic bytes: `504b0304` (ZIP header for XLSX)
- [ ] No JavaScript errors
- [ ] Process exits with code 0

**Success Criteria:**

- XLSX generator produces valid file format

---

### 3.4 Export Callable Invocation

**Objective:** Test Cloud Callable accepts request and creates job document.

**Prerequisites:**

- [ ] Emulators running (firestore, functions, pubsub)
- [ ] `firebase emulators:start --only firestore,functions,pubsub` active

**Checklist:**

**Step 1: Call initiateExport via HTTP**

```bash
curl -X POST http://localhost:5001/hmatologia2/southamerica-east1/initiateExport \
  -H "Content-Type: application/json" \
  -d '{
    "labId": "test-lab-001",
    "format": "xlsx",
    "startDate": "2026-01-01",
    "endDate": "2026-05-04"
  }'
```

**Expected response:**

```json
{
  "jobId": "abc123xyz789",
  "status": "queued",
  "estimatedMinutes": 2,
  "createdAt": "2026-05-04T12:00:00Z"
}
```

**Validation:**

- [ ] HTTP 200 response
- [ ] Response contains: `jobId`, `status`, `estimatedMinutes`, `createdAt`
- [ ] `status` = `"queued"`
- [ ] `jobId` is 21-character nanoid (or similar format)
- [ ] No error response

**Success Criteria:**

- Callable accepts valid request, returns jobId

---

### 3.5 Job Document Verification

**Objective:** Verify job document created in Firestore with correct schema.

**Checklist:**

**Step 1: Check Firestore emulator UI**

- Navigate to http://localhost:4000
- Click "Firestore" tab
- Find document path: `/labs/test-lab-001/export-jobs/{jobId}`

**Step 2: Verify document structure**

- [ ] Document exists at correct path
- [ ] Fields:
  - [ ] `jobId` (string, 21+ chars)
  - [ ] `labId` (string, "test-lab-001")
  - [ ] `format` (string, "xlsx")
  - [ ] `status` (string, "queued")
  - [ ] `createdAt` (timestamp)
  - [ ] `operatorId` (string, if auth enabled)
  - [ ] `startDate` (string or timestamp)
  - [ ] `endDate` (string or timestamp)
- [ ] No errors in document structure

**Success Criteria:**

- Job document created with correct schema

---

### 3.6 Export Callable Validation (Invalid Input)

**Objective:** Verify callable rejects invalid inputs.

**Checklist:**

**Test Case 1: Invalid format**

```bash
curl -X POST http://localhost:5001/hmatologia2/southamerica-east1/initiateExport \
  -H "Content-Type: application/json" \
  -d '{
    "labId": "test-lab-001",
    "format": "invalid-format",
    "startDate": "2026-01-01",
    "endDate": "2026-05-04"
  }'
```

**Expected:** HTTP 400 or 422 with error message

- [ ] Response includes error (HttpsError or similar)
- [ ] Error message mentions format validation

**Test Case 2: startDate >= endDate**

```bash
curl -X POST http://localhost:5001/hmatologia2/southamerica-east1/initiateExport \
  -H "Content-Type: application/json" \
  -d '{
    "labId": "test-lab-001",
    "format": "xlsx",
    "startDate": "2026-05-04",
    "endDate": "2026-01-01"
  }'
```

**Expected:** HTTP 400 with error message

- [ ] Response includes error
- [ ] Error message mentions date range

**Test Case 3: Date range > 1 year**

```bash
curl -X POST http://localhost:5001/hmatologia2/southamerica-east1/initiateExport \
  -H "Content-Type: application/json" \
  -d '{
    "labId": "test-lab-001",
    "format": "xlsx",
    "startDate": "2024-01-01",
    "endDate": "2026-05-04"
  }'
```

**Expected:** HTTP 400 with error message

- [ ] Response includes error
- [ ] Error message mentions date range limit

**Validation:**

- [ ] All three test cases correctly rejected
- [ ] Error messages are user-friendly

**Success Criteria:**

- Callable validation working correctly

---

### 3.7 Export Worker Simulation

**Objective:** Simulate export worker processing a job.

**Prerequisites:**

- [ ] Job created (from 3.4)
- [ ] Emulators running

**Checklist:**

**Step 1: Publish message to Pub/Sub (simulated)**
The worker is triggered by Pub/Sub message. In local testing, manually invoke:

```bash
curl -X POST http://localhost:5001/hmatologia2/southamerica-east1/exportWorker \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "data": "'$(echo -n '{"jobId":"abc123xyz789","labId":"test-lab-001","format":"xlsx"}' | base64)'"
    }
  }'
```

**Expected response:**

```
Success
```

**Validation:**

- [ ] HTTP 200 response
- [ ] Function completes without timeout
- [ ] Check Firestore: job status updated to `processing`

**Step 2: Verify job status update**
Check Firestore emulator UI:

- Path: `/labs/test-lab-001/export-jobs/{jobId}`
- [ ] `status` field updated to `"processing"` or `"completed"` or `"failed"`
- [ ] `completedAt` field set (if completed)
- [ ] No errors

**Note:** In emulator, Cloud Storage upload may fail (emulator limitation). This is acceptable for Phase 3.1. Real upload tested in Phase 3.2 on GCP.

**Success Criteria:**

- Worker processes job, updates status in Firestore

---

### 3.8 Export Hook Testing

**Objective:** Verify React hook for job polling works.

**Checklist:**

```bash
npm run test:unit -- useExportJobs
```

**Expected output:**

```
PASS  src/__tests__/features/export/useExportJobs.test.ts
  useExportJobs helpers
    ✓ formatFileSize converts bytes (XXms)
    ✓ formatDuration converts seconds (XXms)
    ✓ isDownloadExpiring detects expiry (XXms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

**Validation:**

- [ ] File size formatting tests pass
- [ ] Duration formatting tests pass
- [ ] Expiry detection tests pass
- [ ] All 3+ tests passing
- [ ] No timeouts

**Success Criteria:**

- Export hook tests pass, polling logic verified

---

## 4. CI/CD PIPELINE VALIDATION (Task 4)

### 4.1 GitHub Actions Workflow Configuration

**Objective:** Verify mobile CI workflow file exists and is syntactically correct.

**Checklist:**

**Step 1: Verify file exists**

```bash
ls -la .github/workflows/mobile-ci.yml
```

- [ ] File exists at `.github/workflows/mobile-ci.yml`

**Step 2: Validate YAML syntax**

```bash
npx @octokit/app-validate-action .github/workflows/mobile-ci.yml
```

Or check manually in GitHub:

- Navigate to: https://github.com/{owner}/hc-quality/blob/main/.github/workflows/mobile-ci.yml
- [ ] No syntax errors highlighted in editor

**Step 3: Verify workflow triggers**
Check workflow file content:

```yaml
on:
  push:
    paths:
      - 'hc-quality-mobile/**'
      - 'functions/**'
      - '.github/workflows/mobile-ci.yml'
```

- [ ] Triggers on push to mobile paths
- [ ] Triggers on push to functions (shared dependency)
- [ ] Triggers on workflow file changes (self-trigger for CI updates)

**Success Criteria:**

- Workflow file valid, triggers configured correctly

---

### 4.2 Full CI/CD Run

**Objective:** Trigger full CI/CD pipeline and verify all checks pass.

**Checklist:**

**Step 1: Make a test commit**

```bash
git checkout -b test/ci-validation
echo "// CI test" >> hc-quality-mobile/src/App.tsx
git add hc-quality-mobile/src/App.tsx
git commit -m "test: trigger CI pipeline"
git push origin test/ci-validation
```

**Step 2: Monitor GitHub Actions**

- Navigate to: https://github.com/{owner}/hc-quality/actions
- [ ] Workflow run appears (within 1-2 minutes)
- [ ] Run status: **In progress**

**Step 3: Watch workflow steps**
Each step should appear and complete:

- [ ] Step 1: `Checkout code` — PASSED
- [ ] Step 2: `Setup Node.js 20` — PASSED
- [ ] Step 3: `Install dependencies` (npm ci)
  - [ ] Exit code: 0
  - [ ] No "npm ERR" messages
- [ ] Step 4: `Type check` (tsc --noEmit)
  - [ ] Exit code: 0
  - [ ] No "error TS####" messages
- [ ] Step 5: `Run unit tests` (npm run test:unit)
  - [ ] All tests pass
  - [ ] Exit code: 0

**Step 4: Final workflow status**

- [ ] All jobs completed
- [ ] Final status: **Passed** (green checkmark)
- [ ] Workflow run time: <5 minutes (acceptable)

**Expected workflow time breakdown:**

- Setup: 1-2 min
- Dependencies: 1-2 min
- Type check: 10-30 sec
- Tests: 1-2 min
- **Total: 4-6 minutes**

**Validation:**

- [ ] Workflow runs automatically on push
- [ ] All checks pass (no red X marks)
- [ ] No secrets exposed in logs
- [ ] Timing is reasonable (not timing out)

**Step 5: Cleanup test branch**

```bash
git push origin --delete test/ci-validation
git checkout main
git branch -D test/ci-validation
```

**Success Criteria:**

- CI/CD pipeline runs end-to-end and passes

---

## 5. PERFORMANCE GATES (Task 4, subtask)

### 5.1 Lighthouse Performance Audit (Web)

**Objective:** Verify web app meets performance targets.

**Prerequisites:**

- [ ] Web app deployed to staging or running locally
- [ ] Lighthouse CLI installed: `npm install -g @lhci/cli@latest`

**Checklist:**

**Step 1: Run Lighthouse CI**

```bash
lhci autorun --config=.lightningrc.json
```

Or manually in Chrome DevTools:

1. Open web app in Chrome
2. Press F12 → DevTools
3. Click "Lighthouse" tab
4. Select "Mobile" mode
5. Click "Analyze page load"

**Expected scores:**

- [ ] **Performance:** >85 (target: no regression vs Stream C baseline)
- [ ] **Accessibility:** >90
- [ ] **Best Practices:** >90
- [ ] **SEO:** >90

**Detailed performance checks:**

- [ ] **LCP (Largest Contentful Paint):** <2.5s
- [ ] **INP (Interaction to Next Paint):** <200ms
- [ ] **CLS (Cumulative Layout Shift):** <0.1
- [ ] **Bundle size:** <850KB gzip

**Validation:**

- [ ] All scores ≥85 (or within 5 points of baseline)
- [ ] No regressions vs previous audit
- [ ] Web Vitals in green

**Step 2: Check bundle size**

```bash
npm run build
du -sh dist/
# or
gzip -c dist/assets/*.js | wc -c
```

**Expected output:**

- [ ] Total build size: <850KB gzip
- [ ] Largest JS bundle: <500KB gzip

**Success Criteria:**

- Performance scores meet targets, no regressions

---

### 5.2 Mobile Performance (iOS Simulator)

**Objective:** Verify mobile app runs smoothly in simulator.

**Checklist:**

**Step 1: Monitor frame rate in iOS Simulator**

1. App running in simulator (from section 1.5)
2. Simulate slow network (optional):
   - In Xcode: Debug → Simulate slow network
3. Tap buttons, scroll, navigate
4. Monitor performance:
   - [ ] Frame rate stays >50 FPS (smooth)
   - [ ] No janky animations
   - [ ] Transitions are smooth (150-200ms)
   - [ ] No memory warnings

**Step 2: Check memory usage (Xcode)**

1. Xcode: Debug Navigator → Memory
2. Tap buttons, navigate, list scrolling
3. Observe:
   - [ ] Memory usage stable (<100MB base, <150MB under load)
   - [ ] No memory leaks (constant growth)
   - [ ] No red warnings

**Success Criteria:**

- App runs smoothly, frame rates acceptable, memory stable

---

## 6. SECURITY AUDIT (Task 4, subtask)

### 6.1 Multi-Tenant Isolation

**Objective:** Verify no cross-lab data access possible.

**Checklist:**

**Step 1: Verify Firestore rules enforce labId filtering**

Check `.planning/FIRESTORE_RULES.md` or `firestore.rules`:

```javascript
match /labs/{labId} {
  // All subcollections protected by labId
  match /{document=**} {
    allow read: if request.auth.uid != null && request.auth.token.labIds.includes(labId);
    allow write: if request.auth.uid != null && request.auth.token.labIds.includes(labId);
  }
}
```

- [ ] Rules enforce `labId` in all paths
- [ ] Read/write require auth token
- [ ] Auth token must include `labId` in scope

**Step 2: Code review — verify all queries filter by labId**

```bash
grep -r "labId" src/features/analytics/ src/features/export/
grep -r "labId" functions/src/modules/analytics/ functions/src/modules/export/
```

Verify patterns:

```typescript
// CORRECT:
const ref = doc(db, 'labs', labId, 'analytics', 'cache', 'metrics', 'ciqCompliance');
const query = collection(db, `labs/${labId}/export-jobs`);

// INCORRECT (would be a violation):
const ref = collection(db, 'analytics', 'global', 'ciqCompliance'); // No labId
```

**Validation:**

- [ ] All Firestore reads have `.where('labId', '==', labId)`
- [ ] All paths include `{labId}` segment
- [ ] No global collections without labId filter

**Step 3: Simulate cross-lab access**

Test: User logged into Lab A tries to access Lab B's export jobs.

```bash
# Pseudo-code (CLI simulation)
curl -X GET \
  -H "Authorization: Bearer {lab-A-user-token}" \
  http://localhost:5001/hmatologia2/southamerica-east1/queryExportJobs?labId=lab-B

# Expected: 403 Forbidden (auth token doesn't include lab-B scope)
```

**Validation:**

- [ ] Request blocked (403 Forbidden)
- [ ] No data leaked
- [ ] Error message generic (no hints about what exists)

**Success Criteria:**

- Multi-tenant isolation verified, cross-lab access blocked

---

### 6.2 Input Validation

**Objective:** Verify all user inputs validated and sanitized.

**Checklist:**

**Export format validation:**

- [ ] Callable validates format against whitelist: `['xlsx', 'pdf', 'csv']`
- [ ] Invalid format rejected with HttpsError

**Date range validation:**

- [ ] `startDate` < `endDate` enforced
- [ ] Date range <= 1 year enforced
- [ ] Invalid dates parsed and rejected

**Auth validation:**

- [ ] All callables check `request.auth.uid`
- [ ] Missing auth returns HttpsError 401

**Code review:**

```bash
grep -n "format\|startDate\|endDate\|request.auth" functions/src/modules/export/*.ts
```

**Validation:**

- [ ] Input validation functions called in every callable
- [ ] No direct use of user input in queries

**Success Criteria:**

- All inputs validated, no injection attacks possible

---

### 6.3 Secrets Management

**Objective:** Verify sensitive data not exposed in code or logs.

**Checklist:**

**Step 1: Verify no hardcoded secrets**

```bash
git log -p -S "FIREBASE_KEY\|API_KEY\|SECRET" -- . | head -20
grep -r "secret\|password\|key" functions/src/ | grep -v "pubsub" | grep -v "apiKey" | grep -v "serviceAccountKey" | head -10
```

- [ ] No secrets in git history
- [ ] No secrets in code comments
- [ ] No `.env` file committed (check `.gitignore`)

**Step 2: Verify environment variables used**

```bash
cat functions/.env.local
```

- [ ] `GCLOUD_PROJECT` set
- [ ] No hardcoded API keys
- [ ] All secrets from `firebase functions:secrets:*` commands

**Step 3: Verify logs don't leak data**
Check Cloud Function code:

```typescript
// CORRECT:
console.log('[Export] Job started', { jobId, labId }); // Safe: metadata only

// INCORRECT:
console.log('[Export] Full payload:', JSON.stringify(request)); // Might leak secrets
```

**Validation:**

- [ ] Logs contain no auth tokens, keys, or PII
- [ ] Sensitive data logged with masks (e.g., first 4 chars only)

**Success Criteria:**

- No secrets exposed in code, logs, or git history

---

## 7. DOCUMENTATION & REPORTING (Task 5 & 6)

### 7.1 VALIDATION.md Gate Report

**Objective:** Create formal gate criteria checklist.

**File:** `.planning/phases/03.1-foundation/VALIDATION.md`

**Checklist:**

- [ ] File created with complete gate criteria
- [ ] All sections filled:
  - [ ] Mobile checklist (8+ items)
  - [ ] Analytics checklist (9+ items)
  - [ ] Export checklist (11+ items)
  - [ ] Cross-module integration (3+ checks)
  - [ ] Security audit (3 checks)
  - [ ] Deployment checklist (5 checks)
- [ ] Sign-off section ready for signatures
- [ ] GO/NO-GO decision template present
- [ ] Issue tracker template present

**Success Criteria:**

- VALIDATION.md complete and ready for sign-off

---

### 7.2 COMPLETION.md Summary

**Objective:** Create deliverables summary.

**File:** `.planning/phases/03.1-foundation/03.1-COMPLETION.md`

**Checklist:**

- [ ] File created with:
  - [ ] Deliverables summary (mobile, analytics, export, tests, infra)
  - [ ] Code quality metrics (unit tests, coverage, errors)
  - [ ] Known limitations (with Phase 3.2 migration plan)
  - [ ] Risk register (5+ risks with mitigation)
  - [ ] Phase 3.2 readiness checklist
  - [ ] Lessons learned (3-5 items)
  - [ ] File manifest (complete list of files created)
  - [ ] Sign-off section

**Success Criteria:**

- COMPLETION.md complete, comprehensive, ready for CTO review

---

### 7.3 Wave 2 Summary Commit

**Objective:** Commit all validation documents to git.

**Checklist:**

```bash
git add .planning/phases/03.1-foundation/VALIDATION.md
git add .planning/phases/03.1-foundation/03.1-COMPLETION.md
git add .planning/phases/03.1-foundation/WAVE2-INTEGRATION-CHECKLIST.md
git add .planning/phases/03.1-foundation/WAVE2-TEST-SCENARIOS.md

git commit -m "docs(03.1): Phase 3.1 Wave 2 validation complete — ready for gate review"
git push origin main
```

- [ ] All validation files staged
- [ ] Commit message descriptive
- [ ] Files pushed to main branch

**Success Criteria:**

- All Wave 2 documentation committed

---

## 8. DECISION GATE (Phase Lead)

### 8.1 Go/No-Go Decision

**Objective:** Engineering lead + CTO review VALIDATION.md and decide GO or NO-GO.

**Criteria for GO:**

- [ ] All checklists sections completed with ✓ marks
- [ ] 0 critical blockers
- [ ] Unit test pass rate: 100%
- [ ] Mobile app runs in simulator without crashes
- [ ] Analytics queries complete in <2s
- [ ] Export jobs complete end-to-end
- [ ] CI/CD pipeline passes
- [ ] Security audit: no cross-lab leakage
- [ ] Performance gates met
- [ ] Firestore indices created

**Criteria for NO-GO:**

- [ ] Any critical blocker (crash, data leakage, deployment issue)
- [ ] Unit test failures (>1 failing test)
- [ ] Performance fails gates (LCP >2.5s, INP >200ms)
- [ ] Security violation (cross-lab access possible)

**Decision record:**

- [ ] VALIDATION.md signed by Engineering Lead
- [ ] VALIDATION.md signed by CTO
- [ ] Decision: **GO** or **NO-GO** documented
- [ ] If NO-GO: Blockers listed with resolution plan

**Success Criteria:**

- GO: Proceed to Phase 3.2 planning
- NO-GO: Route blockers to Phase 3.1 Wave 3 (hotfix)

---

## 9. ROLLBACK STRATEGY

### 9.1 If Any Critical Issue Found

**Procedure:**

1. **Document issue in VALIDATION.md**
   - Issue ID, component, severity, description, reproduction steps

2. **Create hotfix branch**

   ```bash
   git checkout -b hotfix/03.1-{issue-name}
   ```

3. **Fix issue** (repeat execute-plan steps for affected task)

4. **Test fix locally**
   - Repeat relevant section from this checklist
   - Verify issue resolved

5. **Commit and push**

   ```bash
   git commit -m "fix(03.1): {issue description}"
   git push origin hotfix/03.1-{issue-name}
   ```

6. **Re-run validation**
   - Repeat specific checklist section
   - Verify no regressions

7. **Update VALIDATION.md**
   - Mark issue as resolved
   - Record fix date and engineer name

**Timeline for hotfixes:**

- Critical (crash, data loss): Fix within 2 hours
- High (auth failure, performance): Fix within 4 hours
- Medium (UI glitch, slow query): Schedule for Phase 3.2

---

## 10. SIGN-OFF & NEXT STEPS

### 10.1 Validation Complete Checklist

- [ ] All 6 main sections validated (mobile, analytics, export, CI/CD, performance, security)
- [ ] 50+ individual checklist items completed
- [ ] Zero critical blockers
- [ ] VALIDATION.md signed
- [ ] COMPLETION.md completed
- [ ] All files committed to git
- [ ] CTO reviewed and approved (GO decision)

### 10.2 Phase 3.2 Readiness

Upon GO decision:

- [ ] Route to `/gsd-plan-phase 3.2` (Core Features)
- [ ] Phase 3.2 scope:
  - [ ] Mobile: CIQ flow screens (list, view, edit, submit)
  - [ ] Mobile: NC flow screens (list, view, add action, resolve)
  - [ ] Analytics: Dashboard UI (metrics display)
  - [ ] Export: Export wizard UI (format selection, review, download)
  - [ ] Offline: Queue + sync (mobile offline support)

---

## Summary

**Wave 2 Validation Execution Timeline:**

| Section                                 | Estimated Time  |
| --------------------------------------- | --------------- |
| 1. Mobile Validation (7 tasks)          | 2-3 hours       |
| 2. Analytics Validation (7 tasks)       | 2-3 hours       |
| 3. Export Validation (8 tasks)          | 2-3 hours       |
| 4. CI/CD Validation (2 tasks)           | 30 min - 1 hour |
| 5-6. Performance & Security (6 tasks)   | 1-2 hours       |
| 7-8. Documentation & Decision (3 tasks) | 1-2 hours       |
| **TOTAL**                               | **8-11 hours**  |

**Recommended execution:**

- Day 1: Sections 1-3 (mobile, analytics, export)
- Day 1 Afternoon: Sections 4-6 (CI/CD, performance, security)
- Day 2 Morning: Sections 7-8 (documentation, decision)

**Success criteria:** All checklist items complete, GO decision recorded, Phase 3.2 planning can start.

---

**Created:** 2026-05-05  
**Owner:** QA / Engineering Lead  
**Status:** Ready for Wave 2 execution
