# Phase 3.1 Wave 2 — End-to-End Test Scenarios

**Phase:** 03.1-foundation (Mobile + Analytics + Export)
**Wave:** 2 (Integration & Validation)
**Date:** 2026-05-05

---

## Overview

This document outlines 5 comprehensive end-to-end (E2E) test scenarios that validate Phase 3.1 features work together. Each scenario simulates real user workflows.

**Test execution method:** Manual (GUI/emulator) or automated (via Cypress/Detox for Phase 3.2).
**Expected duration:** 30 minutes per scenario (150 minutes total for all 5).

---

## Scenario 1: Mobile Auth + Home Navigation (Baseline)

**Objective:** Verify mobile app can authenticate and navigate to home screen.

**Duration:** 5 minutes

**Setup:**
- [ ] iOS simulator running (from Phase 3.1 validation)
- [ ] App loaded on AuthScreen
- [ ] Firebase emulator or test Firebase project accessible

**Steps:**

1. **Verify AuthScreen renders**
   - [ ] Dark background visible
   - [ ] Email input field visible
   - [ ] Password input field visible
   - [ ] Login button visible

2. **Enter valid credentials**
   - [ ] Tap email field
   - [ ] Type: `test-user@hcquality.lab` (test user in Firebase)
   - [ ] Tap password field
   - [ ] Type: `TestPassword123!` (test password)

3. **Tap Login button**
   - [ ] Button shows loading state (spinner or disabled)
   - [ ] Wait 2-3 seconds for Firebase auth

4. **Verify navigation to HomeScreen**
   - [ ] AuthScreen dismissed
   - [ ] HomeScreen appears
   - [ ] Lab selection UI visible (if applicable)
   - [ ] No crash or error messages

5. **Test logout (reverse flow)**
   - [ ] Tap Menu or Logout button
   - [ ] App returns to AuthScreen
   - [ ] AuthScreen renders correctly
   - [ ] No data persisted from previous session

**Expected outcome:** ✓ Auth flow works, navigation is correct

**Failure handling:**
- If auth fails: Check Firebase credentials, verify emulator connectivity
- If navigation fails: Check RootNavigator.tsx, verify useAuthPersistence hook

---

## Scenario 2: Analytics Dashboard — Load & Display Metrics

**Objective:** Verify analytics module loads cached metrics and displays them.

**Duration:** 10 minutes

**Setup:**
- [ ] User logged in on mobile (from Scenario 1)
- [ ] Active lab ID set in Zustand store
- [ ] Analytics cache populated in Firestore (from validation checklist section 2.5)

**Steps:**

1. **Navigate to Analytics Dashboard**
   - [ ] Open app main menu
   - [ ] Select "Analytics" or "Dashboard"
   - [ ] Wait for screen to load

2. **Verify analytics hook subscribes to cache**
   - [ ] Loading spinner appears briefly
   - [ ] Firestore `onSnapshot` activated (verify in Cloud Logging)
   - [ ] Cache document fetched from `/labs/{activeLabId}/analytics/cache/metrics/ciqCompliance`

3. **Verify metrics displayed**
   - [ ] Card shows: **Total Runs:** (e.g., "42")
   - [ ] Card shows: **Compliant Runs:** (e.g., "40")
   - [ ] Card shows: **Compliance %:** (e.g., "95.2%")
   - [ ] Card shows: **Last Updated:** (timestamp, e.g., "2 minutes ago")
   - [ ] Metrics are readable (sufficient contrast, font size)

4. **Verify metric formatting**
   - [ ] Numbers formatted correctly (e.g., "95.2" not "95.238291")
   - [ ] Percentage shown with "%" symbol
   - [ ] Timestamp is human-friendly ("2 minutes ago" not ISO string)

5. **Test staleness detection**
   - [ ] If cache >30 minutes old: Show "Data may be stale" warning
   - [ ] If cache fresh (<30 min): No warning shown
   - [ ] If cache null: Show "No data available" message

6. **Test manual refresh (if implemented)**
   - [ ] Tap "Refresh" button
   - [ ] Loading spinner appears
   - [ ] Call Cloud Function: `aggregateAnalytics` manually
   - [ ] Wait 2-5 seconds
   - [ ] Metrics update
   - [ ] Timestamp updates

**Expected outcome:** ✓ Analytics dashboard loads, metrics displayed correctly, staleness handled

**Failure handling:**
- If metrics don't load: Check Firestore rules, verify cache document exists
- If formatting is wrong: Check formatAnalyticsMetrics helper function
- If staleness not detected: Check `isAnalyticsStale` logic, test with old timestamp

---

## Scenario 3: Export Job — Initiate & Monitor

**Objective:** User initiates an export job, receives job ID, and can monitor status.

**Duration:** 10 minutes

**Setup:**
- [ ] User logged in (from Scenario 1)
- [ ] Active lab ID set
- [ ] Export screen accessible from main menu

**Steps:**

1. **Navigate to Export Screen**
   - [ ] Open app main menu
   - [ ] Select "Export" or "Reports"
   - [ ] Wait for ExportWizard or export form

2. **Select export format**
   - [ ] Tap format dropdown: "XLSX"
   - [ ] Other formats greyed out (PDF, CSV for Phase 3.2)
   - [ ] XLSX selected and confirmed

3. **Select date range**
   - [ ] Tap "Start Date" field
   - [ ] Pick date (e.g., "2026-04-01")
   - [ ] Tap "End Date" field
   - [ ] Pick date (e.g., "2026-05-04")
   - [ ] Date range validations pass:
     - [ ] Start < End (enforced)
     - [ ] Range <= 1 year (enforced)

4. **Initiate export job**
   - [ ] Tap "Export" or "Generate" button
   - [ ] Button shows loading state
   - [ ] Wait 1-2 seconds for Cloud Callable to execute
   - [ ] Response received: `{ jobId, status, estimatedMinutes }`

5. **Verify job document created**
   - [ ] Display shows: **Job ID:** (e.g., "abc123xyz789")
   - [ ] Display shows: **Status:** "Queued"
   - [ ] Display shows: **Estimated time:** "~2 minutes"
   - [ ] No error message

6. **Monitor job status (polling)**
   - [ ] useExportJobs hook subscribes to job document
   - [ ] Poll interval set (e.g., every 2 seconds)
   - [ ] Status updates displayed in real-time:
     - [ ] Queued → Processing (after 5-10 sec)
     - [ ] Processing → Completed (after 20-30 sec, depends on data size)

7. **Verify download link appears when complete**
   - [ ] When status = "Completed"
   - [ ] "Download XLSX" button appears
   - [ ] Button is tappable
   - [ ] File size shown (e.g., "2.3 MB")

8. **Download file (optional for Phase 3.1)**
   - [ ] Tap "Download" button
   - [ ] File downloaded to device (or shows download link)
   - [ ] File is readable XLSX (can open in Excel/Numbers)

**Expected outcome:** ✓ Export job created, status tracked, download available

**Failure handling:**
- If job doesn't create: Check Cloud Callable auth, verify lab ID sent
- If status doesn't update: Check Firestore rules, verify worker function triggered
- If download fails: Check Cloud Storage upload in worker, verify signed URL generation

---

## Scenario 4: Cross-Module Integration — Auth → Analytics → Export

**Objective:** Full integration flow: login, view metrics, initiate export.

**Duration:** 15 minutes

**Setup:**
- [ ] All previous scenarios passed
- [ ] Fresh app restart (test AsyncStorage persistence)

**Steps:**

1. **App restart (test session persistence)**
   - [ ] Force close app
   - [ ] Reopen app
   - [ ] Verify: App loads directly to HomeScreen (no re-auth needed)
   - [ ] Lab ID persisted in Zustand store
   - [ ] AsyncStorage working correctly

2. **Navigate Analytics → Export**
   - [ ] Open Analytics dashboard (Scenario 2)
   - [ ] Metrics display correctly
   - [ ] Tap "Export these metrics"
   - [ ] Navigate to Export screen

3. **Pre-fill export form with analytics context**
   - [ ] Export form might auto-fill date range (optional feature)
   - [ ] Lab ID already selected (from store)
   - [ ] User confirms and initiates export

4. **Job creation + status monitoring**
   - [ ] Export job created (Scenario 3)
   - [ ] Status updates in real-time
   - [ ] Verify job queried from correct path: `/labs/{activeLabId}/export-jobs/{jobId}`

5. **Verify multi-tenant isolation**
   - [ ] User can only see their lab's export jobs
   - [ ] Switching labs should show different jobs
   - [ ] No access to other labs' export data

**Expected outcome:** ✓ Full workflow works, multi-tenant isolation verified

**Failure handling:**
- If session doesn't persist: Check AsyncStorage, verify useAuthPersistence hook
- If lab ID not passed correctly: Check Zustand store, verify prop drilling
- If multi-tenant isolation fails: Check Firestore rules, verify labId filtering

---

## Scenario 5: Error Handling & Edge Cases

**Objective:** Verify error handling and edge cases don't crash app.

**Duration:** 10 minutes

**Setup:**
- [ ] All previous scenarios passed
- [ ] App ready for error testing

### 5.1 Invalid Export Input

**Steps:**

1. **Navigate to Export screen**
   - [ ] Open Export form

2. **Try invalid date range**
   - [ ] Start Date: "2026-05-04"
   - [ ] End Date: "2026-04-01" (reversed)
   - [ ] Tap "Export"
   - [ ] Verify: Form shows error message (not crash)
   - [ ] Error is user-friendly (e.g., "Start date must be before end date")

3. **Try date range >1 year**
   - [ ] Start Date: "2025-01-01"
   - [ ] End Date: "2026-05-04" (>1 year)
   - [ ] Tap "Export"
   - [ ] Verify: Form shows error message
   - [ ] Error explains limit (e.g., "Date range cannot exceed 1 year")

**Expected outcome:** ✓ Validation errors shown, app doesn't crash

### 5.2 Network Disconnection

**Steps:**

1. **Test with Slow Network**
   - [ ] Enable "Simulate slow network" in iOS Simulator
   - [ ] Initiate export job (Scenario 3)
   - [ ] Wait longer for response (5-10 seconds)
   - [ ] Verify: App shows loading state, not frozen
   - [ ] Button disabled to prevent duplicate requests

2. **Test with Network Timeout**
   - [ ] Disconnect network (airplane mode)
   - [ ] Try to load Analytics dashboard
   - [ ] Verify: App shows "No connection" message (not crash)
   - [ ] Shows retry button
   - [ ] Reconnect network and retry works

**Expected outcome:** ✓ Network errors handled gracefully

### 5.3 Empty State Handling

**Steps:**

1. **Test Analytics with no data**
   - [ ] For a lab with no runs
   - [ ] Navigate to Analytics dashboard
   - [ ] Verify: Shows "No CIQ data available" message (not blank)
   - [ ] Message is helpful (e.g., "Start by creating a run")

2. **Test Export with no runs in date range**
   - [ ] Select date range with no data
   - [ ] Initiate export
   - [ ] Verify: Job still created (acceptable)
   - [ ] XLSX has headers but no rows (acceptable)

**Expected outcome:** ✓ Empty states handled, user not confused

### 5.4 Long-Running Operations

**Steps:**

1. **Test analytics with large dataset**
   - [ ] If available, test with lab having 10k+ runs
   - [ ] Navigate to Analytics dashboard
   - [ ] Verify: Loading spinner shows
   - [ ] Query completes in <3 seconds (from cache)
   - [ ] Metrics display without blocking UI

2. **Test export with large date range**
   - [ ] Select large date range (e.g., 1 month of data, 1000 runs)
   - [ ] Initiate export
   - [ ] Verify: Job queued immediately (doesn't block UI)
   - [ ] Worker processes in background
   - [ ] Status updates as it progresses
   - [ ] Estimated time displayed (updated if needed)

**Expected outcome:** ✓ Long operations don't block UI, progress shown

**Failure handling:**
- If validation error not shown: Check form validation logic
- If network error crashes app: Add try-catch, show error message
- If empty state shows blank: Add empty state UI component
- If long operation blocks UI: Check for blocking code, use async/await correctly

---

## Test Execution Tracker

### Pre-Execution Checklist

- [ ] All emulators running (firestore, functions, pubsub)
- [ ] iOS simulator available and booted
- [ ] Test Firebase project accessible
- [ ] Test user created in Firebase Auth
- [ ] Test lab created in Firestore
- [ ] All Wave 1 code deployed locally or to emulator

### Execution Log

| Scenario | Status | Notes | Time | Tester |
|----------|--------|-------|------|--------|
| 1: Mobile Auth | ⏳ | | | |
| 2: Analytics Dashboard | ⏳ | | | |
| 3: Export Job | ⏳ | | | |
| 4: Cross-Module | ⏳ | | | |
| 5: Error Handling | ⏳ | | | |

### Results Summary

- [ ] Scenario 1: PASS / FAIL
- [ ] Scenario 2: PASS / FAIL
- [ ] Scenario 3: PASS / FAIL
- [ ] Scenario 4: PASS / FAIL
- [ ] Scenario 5: PASS / FAIL

**Overall:** PASS / FAIL / PARTIAL

---

## Defect Log (If Failures Found)

| ID | Scenario | Description | Severity | Status |
|----|----------|-------------|----------|--------|
| | | | | |

---

## Sign-Off

- **QA Tester:** [Name] — [Date] — [Signature]
- **Engineering Lead:** [Name] — [Date] — [Signature]

**Test execution completed:** [Date/Time]
**Approved for Phase 3.2:** GO / NO-GO

---

## Automation Notes (For Phase 3.2)

These E2E scenarios should be automated in Phase 3.2 using:
- **Mobile E2E:** Detox or Expo Testing Library
- **Web E2E:** Cypress or Playwright
- **CI/CD:** GitHub Actions E2E job

Example Detox test file structure:
```javascript
describe('Scenario 1: Mobile Auth', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should authenticate and navigate to home', async () => {
    await element(by.id('emailInput')).typeText('test@hcquality.lab');
    await element(by.id('passwordInput')).typeText('TestPassword123!');
    await element(by.label('Login')).tap();
    await waitFor(element(by.id('homeScreen'))).toBeVisible().withTimeout(5000);
  });
});
```

Automation in Phase 3.2 will:
- Run on every commit to mobile/**
- Validate all 5 scenarios in <10 minutes
- Block merge if any scenario fails
- Provide detailed failure screenshots

---

**Created:** 2026-05-05
**Owner:** QA / Engineering Lead
**Status:** Ready for Wave 2 execution
