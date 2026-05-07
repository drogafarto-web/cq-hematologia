---
phase: 4
title: Test Strategy — Unit, E2E, Smoke Tests, Coverage Goals
status: DRAFT
created: 2026-05-07
updated: 2026-05-07
owner: QA Lead
---

# Phase 4 Test Strategy — HC Quality (Portal Auth + NOTIVISA)

**Objective:** Establish comprehensive test coverage for Phase 4 deliverables (Portal Auth Callables, NOTIVISA Queue Processor, Portal UI, E2E Flows) with regression gates and performance baselines.

**Success Criteria:** 
- Unit coverage: 85% functions, 70% branches (callables + helpers)
- E2E critical flows: 5/5 PASS (100%)
- Smoke test: Exit code 0 (all systems ready)
- Regression gates: 0 test regressions from baseline (738/738)
- Performance: LCP <2.5s, INP <200ms, CLS <0.1

**Duration:** 2.5 weeks (May 20 → Jun 2 concurrent with implementation)

---

## Section 1: Unit Test Coverage Goals

### 1.1 Portal Auth Callables (12 tests)

**Target Module:** `functions/src/modules/portals/callables/`

#### Test Group: generatePatientAuthLink

```
├─ Valid email → token generated + TTL set
├─ Invalid email (malformed) → throws ValidationError
├─ Invalid email (not registered in lab) → throws NotFoundError
├─ Token already exists (idempotent) → returns same token
├─ Rate limiting: 5+ requests in 60s → throws RateLimitError
├─ Email dispatch mocked (SendGrid) → delivery confirmed
└─ Link format validation → `{domain}/portal/verify?token={token}&labId={labId}`
```

**Implementation pattern:**
```typescript
// functions/src/modules/portals/__tests__/generatePatientAuthLink.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as admin from 'firebase-admin';
import { generatePatientAuthLink } from '../callables';
import { EmailServiceMock } from '../../../__tests__/mocks/emailService';

describe('generatePatientAuthLink', () => {
  let emailMock: EmailServiceMock;
  
  beforeEach(() => {
    emailMock = new EmailServiceMock();
    jest.spyOn(emailService, 'send').mockImplementation(emailMock.send);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('generates valid auth token for registered patient', async () => {
    const result = await generatePatientAuthLink(
      { data: { patientId: 'pat-001', labId: 'lab-001', email: 'patient@test.com' } },
      mockContext()
    );
    
    expect(result.token).toMatch(/^[a-f0-9]{64}$/); // HMAC token
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.ttlSeconds).toBe(86400); // 24 hours
  });

  it('validates email format before sending', async () => {
    await expect(
      generatePatientAuthLink(
        { data: { patientId: 'pat-001', labId: 'lab-001', email: 'invalid@' } },
        mockContext()
      )
    ).rejects.toThrow('Invalid email format');
  });

  it('enforces rate limit: 5 requests per 60s', async () => {
    const patientId = 'pat-001';
    
    // First 5 should succeed
    for (let i = 0; i < 5; i++) {
      const result = await generatePatientAuthLink(
        { data: { patientId, labId: 'lab-001', email: 'patient@test.com' } },
        mockContext(i)
      );
      expect(result.token).toBeTruthy();
    }
    
    // 6th should fail
    await expect(
      generatePatientAuthLink(
        { data: { patientId, labId: 'lab-001', email: 'patient@test.com' } },
        mockContext(5)
      )
    ).rejects.toThrow('Rate limit exceeded');
  });
});
```

#### Test Group: verifyPatientAuthToken

```
├─ Valid token + valid TTL → custom token issued
├─ Expired token → throws TokenExpiredError
├─ Invalid token (wrong signature) → throws InvalidTokenError
├─ Token used twice → throws TokenAlreadyUsedError
└─ Custom token has correct claims (patientId, labId, role='PATIENT')
```

#### Test Group: Signature Validation (Core)

```
├─ HMAC-SHA256 hash validation → must match server signature
├─ Hash size enforcement → 64 bytes hex only
├─ Timestamp validation → within ±5s of server time
└─ Operator ID validation → matches request.auth.uid
```

**Coverage target:** 12 tests, 95% coverage (callables + helpers)

---

### 1.2 NOTIVISA Callables (16 tests)

**Target Module:** `functions/src/modules/notivisa/callables/`

#### Test Group: submitLaudoToNotivisa (async event handler)

```
├─ Valid laudo → creates queue entry (status=pending)
├─ Invalid laudo (missing CPF) → throws ValidationError
├─ Invalid laudo (no signature) → throws InvalidSignatureError
├─ Duplicate submission (same laudo_id) → idempotent (same eventId)
├─ Queue entry has createdAt + nextRetry timestamp
├─ Payload maps laudo → NOTIVISA schema v1.0
└─ Audit log created in auditLog subcollection
```

#### Test Group: processNotivisaQueue (polling handler)

```
├─ Reads queue entries with status='pending'
├─ Processes exponential backoff (1s → 2s → 4s → 8s)
├─ Retry count incremented on failure (max 5)
├─ Status transition: pending → processing → acknowledged
├─ Acknowledged entries soft-deleted (deletedAt timestamp)
├─ Failed entries marked status='failed' after 5 retries
└─ Submission error logged with reason (auth, validation, network)
```

#### Test Group: NOTIVISA API Mocking

```
├─ Mock successful submission (200 + event_id response)
├─ Mock auth failure (401 + invalid credentials)
├─ Mock validation failure (422 + missing field)
├─ Mock timeout (>30s response time)
└─ All mocks return standardized response shape
```

**Coverage target:** 16 tests, 90% coverage (callables + queue handler + mocks)

---

### 1.3 Firestore Rules (8 tests)

**Target Module:** `firestore.rules` (notivisa-drafts, notivisa-queue, notivisa-outbox collections)

#### Test Group: RBAC + Access Control

```
├─ RT user can read notivisa-drafts/{labId}/drafts
├─ RT user can update draft status (approved/submitted)
├─ Auditor can read notivisa-queue/{labId}/events
├─ Auditor can update event status (reviewed)
├─ Patient cannot read notivisa collections
├─ Cross-lab access blocked (user from lab-A cannot read lab-B drafts)
└─ Soft-delete enforced (delete: false on all collections)
```

**Implementation pattern:**
```typescript
// functions/src/__tests__/integration/notivisa-rules.test.ts
import { describe, it, expect } from '@jest/globals';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore Rules: NOTIVISA Collections', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'hmatologia2',
      firebaseJson: require('../../../firestore.json'),
      rulesContent: fs.readFileSync('./firestore.rules', 'utf-8')
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('RT user can read draft forms for their lab', async () => {
    const db = testEnv.authenticatedContext('rt-001', {
      lab_id: 'lab-001',
      role: 'RT'
    }).firestore();

    await expect(
      db.collection('notivisa-drafts/lab-001/drafts').get()
    ).toAllow();
  });

  it('Patient cannot access NOTIVISA collections', async () => {
    const db = testEnv.authenticatedContext('patient-001', {
      lab_id: 'lab-001',
      role: 'PATIENT'
    }).firestore();

    await expect(
      db.collection('notivisa-drafts/lab-001/drafts').get()
    ).toBeDenied();
  });

  it('Cross-lab access is blocked', async () => {
    const db = testEnv.authenticatedContext('rt-002', {
      lab_id: 'lab-002',
      role: 'RT'
    }).firestore();

    await expect(
      db.collection('notivisa-drafts/lab-001/drafts').get() // Different lab
    ).toBeDenied();
  });
});
```

**Coverage target:** 8 tests, 100% coverage (all RBAC paths)

---

### 1.4 Email Link Generation (4 tests)

**Target Module:** `functions/src/shared/portals/authLinkGenerator.ts`

```
├─ Deterministic token generation (same input → same token)
├─ TTL math correct (token_created_at + 86400s = expiry)
├─ HMAC validation matches server (no timing attacks)
└─ Link format: scheme + domain + path + query params
```

**Coverage target:** 4 tests, 100% coverage

---

## Section 2: E2E Test Suite (Cypress / Playwright)

### 2.1 Critical Flows (5 flows, 100% pass required)

**Tool:** Playwright 1.40 (supports Dark-first UI testing)  
**Duration:** ~5 min per flow × 5 = 25 min total  
**Headless:** Yes (CI mode) + headed option for debugging

#### Flow 1: Patient Email Link → Portal Auth → View Own Laudos

**Scenario:**
```
Given: Patient receives email with magic link
When: Patient clicks link in email
Then: Patient auto-authenticates (no password)
And: Portal shows only patient's laudos
And: PDF download includes signature

Test steps:
1. generatePatientAuthLink() → returns {token, expiresAt}
2. Mock email delivery (capture link from email service)
3. Navigate to link in browser
4. verifyPatientAuthToken() → custom token issued
5. Client exchanges custom token for Firebase session
6. Query /portal/api/laudos?patientId={patientId}
7. Verify laudos belong to same patient only
8. PDF download → includes chain hash + operator signature
```

**Assertions:**
```typescript
expect(page.url()).toContain('/portal/laudos');
expect(laudoList.length).toBeGreaterThan(0);
expect(laudoList[0].patientId).toBe(patientId);
expect(laudoList[0].assinatura).toBeDefined(); // Has signature
expect(pdfBytes).toContain('%PDF-1.4'); // Valid PDF
```

**File:** `e2e/phase4/flow-01-patient-auth-link.spec.ts`

---

#### Flow 2: RT Creates Portal Auth Token → Sends Email → Tracks Delivery

**Scenario:**
```
Given: RT user logged in to medical portal
When: RT clicks "Generate patient access link"
And: RT enters patient email
Then: Token generated + stored in Firestore
And: Email sent via SendGrid
And: RT sees "Link sent" confirmation
And: Delivery status visible in audit trail

Test steps:
1. Login as RT (rtPortalLogin)
2. Navigate to patient management
3. Click "Share Results" → patient email input
4. Call generatePatientAuthLink() endpoint
5. Mock SendGrid delivery webhook
6. Verify email queued (notivisa-queue entry)
7. Check delivery status in audit log
```

**Assertions:**
```typescript
expect(queueEntry.status).toBe('sent');
expect(queueEntry.deliveryStatus).toBe('accepted');
expect(auditLog.entries).toContainEqual(
  expect.objectContaining({ action: 'LINK_GENERATED' })
);
```

**File:** `e2e/phase4/flow-02-rt-portal-auth.spec.ts`

---

#### Flow 3: Auditor Logs In → Reviews NOTIVISA Queue → Marks Entry

**Scenario:**
```
Given: Auditor user has active session
When: Auditor navigates to NOTIVISA queue dashboard
Then: Queue shows pending submissions (status='pending')
And: Auditor can mark entry as 'reviewed'
And: Reviewed entries soft-deleted (deletedAt timestamp)
And: Audit trail updated with auditor ID + timestamp

Test steps:
1. Login as Auditor (auditPortalLogin)
2. Navigate to /notivisa-queue
3. Fetch queue entries (polling, 30s interval)
4. Click "Mark reviewed" on first entry
5. Call updateNotivisaQueueEntry({ eventId, status: 'reviewed' })
6. Verify entry.deletedAt is set
7. Verify auditLog has new entry
```

**Assertions:**
```typescript
expect(queueEntries[0].status).toBe('pending');
await page.click('button:has-text("Mark reviewed")');
expect(updatedEntry.deletedAt).toBeTruthy();
expect(updatedEntry.reviewedBy).toBe(auditorId);
```

**File:** `e2e/phase4/flow-03-auditor-notivisa-queue.spec.ts`

---

#### Flow 4: NOTIVISA Queue Processor Runs → Submission Succeeds → Audit Log Updated

**Scenario:**
```
Given: Queue has pending entries (created by submitLaudoToNotivisa)
When: processNotivisaQueue() cron runs (every 5 min in staging)
Then: Entries processed with exponential backoff
And: Status updated to 'acknowledged' on success
And: Audit trail has 10+ new entries (one per processing step)

Test steps:
1. Create pending queue entry via submitLaudoToNotivisa()
2. Manually trigger processNotivisaQueue() (or wait for cron)
3. Poll queue entry for status change
4. Assert status='acknowledged'
5. Check auditLog entries (submission, validation, success)
6. Verify no failures (status != 'failed')
```

**Assertions:**
```typescript
expect(queueEntry.status).toBe('acknowledged');
expect(queueEntry.retryCount).toBeLessThanOrEqual(3);
expect(auditLogs.filter(a => a.action.includes('SUBMIT'))).toHaveLength(1);
expect(auditLogs.filter(a => a.action.includes('SUCCESS'))).toHaveLength(1);
```

**File:** `e2e/phase4/flow-04-notivisa-processor.spec.ts`

---

#### Flow 5: Portal Auth Session Expires → Patient Logged Out → Re-auth Required

**Scenario:**
```
Given: Patient has valid session (token TTL 24h)
When: Token expires
Then: Firestore rules deny read access
And: Client detects auth error (401)
And: Portal redirects to login
And: Patient must click email link again

Test steps:
1. Login patient with generatePatientAuthLink()
2. Verify patient can read laudos
3. Fast-forward time by 25 hours (token expires)
4. Try to read laudos again
5. Expect 401 + redirect to /portal/login
6. Click email link again → re-auth
7. Verify session restored
```

**Assertions:**
```typescript
expect(page.url()).toContain('/portal/laudos');
await advanceTimeInTests(25 * 3600 * 1000); // 25 hours
await expect(page.getByText('Session expired')).toBeVisible();
expect(page.url()).toContain('/portal/login');
```

**File:** `e2e/phase4/flow-05-session-expiry.spec.ts`

---

### 2.2 Non-Critical Flows (3 flows, pass preferred)

#### Flow 6: Concurrent Auth Attempts → Rate Limit Kicks In

**Implementation:** 5 simultaneous `generatePatientAuthLink()` calls, 6th fails  
**File:** `e2e/phase4/flow-06-rate-limiting.spec.ts`

#### Flow 7: Patient Requests New Link (Previous Link Still Valid)

**Implementation:** Generate link, use it, request new link while first unused, both work  
**File:** `e2e/phase4/flow-07-link-resend.spec.ts`

#### Flow 8: Error States (Network Down, Firestore Down, Email Service Down)

**Implementation:** Mock failures + verify error handling in UI  
**File:** `e2e/phase4/flow-08-error-states.spec.ts`

---

### 2.3 E2E Test Configuration

**File:** `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  testMatch: /phase4\/flow-.*\.spec\.ts/,
  fullyParallel: false, // Sequential to avoid test pollution
  forbidOnly: process.env.CI ? true : false,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for auth isolation
  timeout: 60000,
  expect: { timeout: 5000 },

  use: {
    baseURL: 'http://localhost:5173',
    headless: process.env.HEADLESS !== 'false',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
  ],

  globalSetup: require.resolve('./global-setup.ts'),
  globalTeardown: require.resolve('./global-teardown.ts'),
});
```

**Global Setup:** `e2e/global-setup.ts`
```typescript
import { chromium, expect } from '@playwright/test';

export default async () => {
  // 1. Emulator seed (test data)
  // 2. Firebase auth setup
  // 3. Mock email service
  // 4. Health check (server running)
};
```

**Run command:**
```bash
npm run e2e:phase4  # Runs all 5 critical flows
```

---

## Section 3: Smoke Test Script

### 3.1 Purpose

Automated validation of end-to-end system readiness before go-live. Exit code 0 = all checks pass, ready for production deployment.

### 3.2 Script Location & Invocation

**File:** `scripts/phase4-smoke-test.sh` (macOS/Linux) or `scripts/phase4-smoke-test.ps1` (Windows)

**Invocation:**
```bash
# macOS/Linux
bash scripts/phase4-smoke-test.sh

# Windows PowerShell
.\scripts\phase4-smoke-test.ps1

# Output: Report in .planning/smoke-test-results-phase4.json
```

---

### 3.3 Smoke Test Checklist (10 steps)

#### Step 1: Verify Deployment to Staging

```bash
# Check: Functions deployed to staging (southamerica-east1)
firebase functions:list --project hmatologia2
# Expected: 78+ functions listed, 0 errors
```

#### Step 2: Verify Anvisa Credentials Accessible

```bash
# Check: NOTIVISA credentials provisioned
bash scripts/preflight-secrets-check.sh
# Expected: All secrets OK (0 PENDING_SET)
```

#### Step 3: generatePatientAuthLink() Callable

```
Call: generatePatientAuthLink({ patientId, labId, email })
Input: { patientId: 'pat-smoke-001', labId: 'lab-smoke-001', email: 'test@smoke.test' }
Expected output:
  {
    token: '64-char hex string',
    expiresAt: 1714996200000,
    link: 'https://hmatologia2.web.app/portal/verify?token={token}&labId=lab-smoke-001'
  }
Assertion: token matches /^[a-f0-9]{64}$/
```

#### Step 4: Verify Email Delivery (Mock SMTP)

```
Check: Email queued in mock SMTP inbox
Expected: Email subject contains "Acesso ao Portal"
Expected: Email body contains verification link
Assertion: 1 email in inbox with correct template
```

#### Step 5: verifyPatientAuthToken() Callable

```
Call: verifyPatientAuthToken({ token, labId })
Input: { token: '<from step 3>', labId: 'lab-smoke-001' }
Expected output:
  {
    customToken: '...',
    uid: 'pat-smoke-001',
    role: 'PATIENT'
  }
Assertion: customToken is valid JWT (has 3 parts separated by .)
```

#### Step 6: Firebase Session Exchange

```
Client-side: firebase.auth().signInWithCustomToken(customToken)
Expected: User authenticated in client SDK
Assertion: firebase.auth().currentUser.uid === 'pat-smoke-001'
```

#### Step 7: Query Patient Laudos (Scoped)

```
Call: GET /api/laudos?patientId=pat-smoke-001
Headers: { Authorization: 'Bearer {idToken}' }
Expected output: Array of laudos
Assertion: 
  - Array length > 0
  - All laudos have patientId === 'pat-smoke-001'
  - Each laudo has assinatura (signature)
```

#### Step 8: NOTIVISA Mock Submit

```
Call: submitLaudoToNotivisa({ laudoId, patientId, labId })
Input: { laudoId: 'laudo-smoke-001', patientId: 'pat-smoke-001', labId: 'lab-smoke-001' }
Expected output:
  {
    eventId: '...',
    status: 'pending',
    createdAt: timestamp
  }
Assertion: Queue entry created in Firestore
```

#### Step 9: Run NOTIVISA Queue Processor

```
Trigger: Call processNotivisaQueue() (can be manual in smoke test)
OR: Wait 30s for next cron execution
Expected output: Queue entry status transitions
  - pending → processing (immediately)
  - processing → acknowledged (after API call succeeds)
Assertion: status === 'acknowledged' within 10s
```

#### Step 10: Verify Audit Trail (10 New Entries)

```
Query: /labs/lab-smoke-001/auditLogs?since=smokeTestStart
Expected: Array with ≥10 entries
Expected entries include:
  - LINK_GENERATED
  - PATIENT_AUTH_VERIFIED
  - LAUDO_QUERIED
  - NOTIVISA_SUBMITTED
  - QUEUE_PROCESSED
  - QUEUE_ACKNOWLEDGED
Assertion: Audit trail has expected 10 entries
```

---

### 3.4 Smoke Test Script Implementation (Pseudo-code)

**File:** `scripts/phase4-smoke-test.sh`

```bash
#!/bin/bash
set -e

SMOKE_START=$(date +%s000)
LAB_ID="lab-smoke-001"
PATIENT_ID="pat-smoke-001"
LAUDO_ID="laudo-smoke-001"
EMAIL="smoke-test+$(date +%s)@hmatologia2.test"

results_file=".planning/smoke-test-results-phase4.json"
log_file=".planning/smoke-test-phase4.log"

echo "=== Phase 4 Smoke Test Starting ===" | tee "$log_file"
echo "Timestamp: $(date)" >> "$log_file"

# Step 1: Check functions
echo "Step 1: Verify functions deployed..."
firebase functions:list --project hmatologia2 >> "$log_file" 2>&1 || exit_with_error "Functions not deployed"
echo "✓ Step 1 passed" | tee -a "$log_file"

# Step 2: Check secrets
echo "Step 2: Verify Anvisa credentials..."
bash scripts/preflight-secrets-check.sh >> "$log_file" 2>&1 || exit_with_error "Secrets not provisioned"
echo "✓ Step 2 passed" | tee -a "$log_file"

# Step 3: generatePatientAuthLink
echo "Step 3: Call generatePatientAuthLink()..."
AUTH_LINK_RESPONSE=$(curl -X POST \
  https://southamerica-east1-hmatologia2.cloudfunctions.net/generatePatientAuthLink \
  -H "Content-Type: application/json" \
  -d "{\"data\": {\"patientId\": \"$PATIENT_ID\", \"labId\": \"$LAB_ID\", \"email\": \"$EMAIL\"}}" \
  2>/dev/null)

TOKEN=$(echo "$AUTH_LINK_RESPONSE" | jq -r '.result.token')
if [[ ! "$TOKEN" =~ ^[a-f0-9]{64}$ ]]; then
  echo "✗ Step 3 failed: Invalid token format: $TOKEN" | tee -a "$log_file"
  exit 1
fi
echo "✓ Step 3 passed: token=$TOKEN" | tee -a "$log_file"

# Step 4: Check email
echo "Step 4: Verify email delivery..."
# Mock SMTP check (assumes local SMTP server on port 1025)
EMAILS_IN_INBOX=$(curl -s http://localhost:1080/api/emails | jq '.length')
if [[ "$EMAILS_IN_INBOX" -lt 1 ]]; then
  echo "✗ Step 4 failed: No emails in inbox" | tee -a "$log_file"
  exit 1
fi
echo "✓ Step 4 passed: $EMAILS_IN_INBOX email(s) in inbox" | tee -a "$log_file"

# Step 5: verifyPatientAuthToken
echo "Step 5: Call verifyPatientAuthToken()..."
VERIFY_RESPONSE=$(curl -X POST \
  https://southamerica-east1-hmatologia2.cloudfunctions.net/verifyPatientAuthToken \
  -H "Content-Type: application/json" \
  -d "{\"data\": {\"token\": \"$TOKEN\", \"labId\": \"$LAB_ID\"}}" \
  2>/dev/null)

CUSTOM_TOKEN=$(echo "$VERIFY_RESPONSE" | jq -r '.result.customToken')
if [[ ! "$CUSTOM_TOKEN" =~ ^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$ ]]; then
  echo "✗ Step 5 failed: Invalid custom token: $CUSTOM_TOKEN" | tee -a "$log_file"
  exit 1
fi
echo "✓ Step 5 passed: customToken=$CUSTOM_TOKEN" | tee -a "$log_file"

# Step 6–10: Continue with remaining steps...

echo ""
echo "=== All Smoke Tests PASSED ===" | tee -a "$log_file"
echo "{\"status\": \"PASS\", \"duration_ms\": $(($(date +%s000) - SMOKE_START))}" > "$results_file"
exit 0
```

---

## Section 4: Regression Test Gates

### 4.1 Bundle Size Gate

**Baseline (v1.3):** 362 KB gzip (main chunk)  
**Tolerance:** +5% = 380 KB gzip max  
**Failure action:** PR comment + block merge

**Check:**
```bash
npm run build
ls -la dist/assets/index-*.js | awk '{print $5}' | xargs -I {} sh -c 'echo "Main chunk: {} bytes"; \
  if [ {} -gt $((362 * 1024 * 105 / 100)) ]; then echo "FAIL: Bundle size exceeded"; exit 1; fi'
```

---

### 4.2 Web Vitals Gate

**Baseline:**
- LCP: 2.2s (tolerance: ±10% = 1.98–2.42s)
- INP: 150ms (tolerance: ±15% = 127–172ms)
- CLS: 0.05 (tolerance: ±100% = 0–0.1)

**Check:** Lighthouse CI (automated on deploy)
```bash
npm run lighthouse:ci -- --upload-artifacts
```

**Failure action:** Report in PR + require justification for regression

---

### 4.3 Unit Test Regression Gate

**Baseline:** 738 tests passing (Phase 0–3)  
**Tolerance:** 0 regressions (must maintain 738+ pass count)

**Check:**
```bash
npm run test -- --coverage
# Expected: ≥738 tests passing, 0 failed
```

**Failure action:** Block CI, require fix before merge

---

### 4.4 E2E Critical Flows Gate

**Baseline:** N/A (Phase 4 baseline = 0)  
**Target Phase 4:** 5/5 critical flows PASS

**Check:**
```bash
npm run e2e:phase4
# Expected: 5 passed, 0 failed
```

**Failure action:** Block deploy, require fix

---

### 4.5 Auth Latency Gate

**Baseline:** <500ms p95 (generatePatientAuthLink + verifyPatientAuthToken)  
**Measurement:** Cloud Logs analysis (automated post-deploy)

**Check:**
```bash
firebase functions:logs read generatePatientAuthLink --limit 1000 \
  | grep -o '"executionTime":"[0-9]*' | awk -F: '{print $2}' | sort -n | tail -50 | head -1
# Expected: < 500ms (p95)
```

---

### 4.6 NOTIVISA Queue Latency Gate

**Baseline:** <100ms submit (Firestore write)  
**Measurement:** Firestore metrics (automated via Cloud Monitoring)

---

## Section 5: Test Data Strategy (Phase 4)

### 5.1 Seed Data Generation

**Location:** `functions/src/__tests__/fixtures/`  
**Generator script:** `scripts/generate-phase4-testdata.sh`

#### 5.1.1 Test Labs & Members

```typescript
// fixtures/test-labs-phase4.ts
export const testLabs = [
  {
    labId: 'lab-smoke-001',
    name: 'Lab Smoke Test',
    members: [
      { uid: 'rt-smoke-001', role: 'RT', status: 'active' },
      { uid: 'auditor-smoke-001', role: 'AUDITOR', status: 'active' },
      { uid: 'patient-smoke-001', role: 'PATIENT', status: 'active' },
    ]
  },
  // ... 9 additional test labs (total 10)
];
```

#### 5.1.2 Test Patients

```typescript
// fixtures/test-patients-phase4.ts
export const testPatients = [
  {
    patientId: 'pat-e2e-001',
    name: 'João Silva Test',
    cpf: '12345678901',
    email: 'joao@e2etest.com',
    labId: 'lab-e2e-001',
  },
  // ... 49 additional test patients (total 50)
];
```

#### 5.1.3 Test Laudos

```typescript
// fixtures/test-laudos-phase4.ts
export const testLaudos = [
  {
    laudoId: 'laudo-e2e-001',
    patientId: 'pat-e2e-001',
    labId: 'lab-e2e-001',
    resultadoEm: 1714982400000,
    resultados: [/* 5–10 analytes per laudo */],
    assinatura: {
      operatorId: 'rt-e2e-001',
      hash: 'a1b2c3...', // 64-char HMAC
      ts: 1714982400000
    }
  },
  // ... 99 additional laudos (total 100)
];
```

#### 5.1.4 NOTIVISA Payloads (Mocked)

```typescript
// fixtures/notivisa-payloads-phase4.ts
export const notiVisaPayloads = [
  {
    versao: '1.0',
    laudo_id: 'laudo-e2e-001',
    paciente_cpf: '12345678901',
    data_resultado: 1714982400000,
    resultados: [/* malformed, valid, edge cases */],
  },
  // ... 29 additional payloads (total 30)
  // Includes: valid, missing CPF, invalid signature, timeout scenarios
];
```

---

### 5.2 Test Data Seeding

**Automation:** `scripts/seed-phase4-testdata.sh`

```bash
#!/bin/bash
# Seed test data into Firestore emulator

firebase emulators:exec --only firestore "
  npm run seed:phase4
" --project hmatologia2
```

---

## Section 6: Coverage Dashboard

### 6.1 Dashboard File

**Location:** `.planning/PHASE_4_COVERAGE_DASHBOARD.md`  
**Format:** Auto-generated post-test-run

**Content:**
```markdown
# Phase 4 Coverage Dashboard
Generated: 2026-06-02T18:30:00Z

## Unit Tests
- Portal Auth Callables: 12/12 PASS (100%)
- NOTIVISA Callables: 16/16 PASS (100%)
- Firestore Rules: 8/8 PASS (100%)
- Email Link Gen: 4/4 PASS (100%)
- **Total Unit Tests:** 40/40 PASS (100%)
- **Code Coverage:** 87% functions, 72% branches

## E2E Tests (Critical Flows)
1. Patient Email Link → Portal Auth → View Laudos: ✓ PASS
2. RT Creates Token → Sends Email → Tracks Delivery: ✓ PASS
3. Auditor Reviews NOTIVISA Queue: ✓ PASS
4. NOTIVISA Queue Processor Runs: ✓ PASS
5. Portal Auth Session Expires: ✓ PASS
**Critical Flows:** 5/5 PASS (100%)

## E2E Tests (Non-Critical Flows)
6. Concurrent Auth Attempts → Rate Limit: ✓ PASS
7. Link Resend: ✓ PASS
8. Error States: ✓ PASS
**Non-Critical Flows:** 3/3 PASS (100%)

## Smoke Test
**Status:** ✓ PASS (Exit Code 0)
**Duration:** 5m 23s
**Checks Passed:** 10/10

## Regression Gates
- Bundle Size: 371 KB (baseline 362 KB, +2.5% — PASS)
- LCP: 2.1s (baseline 2.2s, -4.5% — PASS)
- INP: 148ms (baseline 150ms, -1.3% — PASS)
- CLS: 0.048 (baseline 0.05, -4% — PASS)
- Unit Tests: 738/738 PASS (baseline maintained — PASS)
- Auth Latency p95: 312ms (<500ms — PASS)

## Overall Readiness: ✓ READY FOR PRODUCTION DEPLOY
```

---

## Section 7: Test Execution Timeline

### Week 1 (May 20–26): Callable Implementation + Unit Tests

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| Mon 20 | Portal auth callables (3 stubs) | Eng A | `generatePatientAuthLink`, `verifyPatientAuthToken`, `listLaudosForPatient` |
| Tue 21 | Unit tests for callables (12 tests) | Eng A | 12/12 tests passing, 95% coverage |
| Wed 22 | NOTIVISA callables (3 stubs) | Eng B | `submitLaudoToNotivisa`, `processNotivisaQueue`, `updateQueueEntry` |
| Thu 23 | Unit tests for NOTIVISA (16 tests) | Eng B | 16/16 tests passing, 90% coverage |
| Fri 24 | Rules tests (8 tests) + email tests (4) | Eng C | 12/12 tests passing, 100% coverage |

**Gate:** 40/40 unit tests PASS before Week 2

---

### Week 2 (May 27–Jun 2): E2E Tests + Smoke Test

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| Mon 27 | E2E framework setup (Playwright config) | Eng D | `e2e/playwright.config.ts`, global setup/teardown |
| Tue 28 | E2E Flow 1–2 (Patient link, RT portal) | Eng D | 2 flows PASS |
| Wed 29 | E2E Flow 3–4 (Auditor queue, processor) | Eng D | 4 flows PASS |
| Thu 30 | E2E Flow 5 + non-critical flows 6–8 | Eng D | 8 flows total, 5 critical PASS |
| Fri 31 | Smoke test script + regression gates | QA Lead | Smoke test exit code 0, gates all PASS |

**Gate:** 5/5 critical E2E flows PASS before deploy

---

### Deployment Week (Jun 2): Pre-Deploy Validation

| Day | Task | Owner | Gate |
|-----|------|-------|------|
| Sun Jun 1 (evening) | Final smoke test run (manual) | QA Lead | Smoke test exit code 0 |
| Mon Jun 2 (morning) | Code freeze + final type-check | Eng A | `npm run tsc --noEmit` green |
| Mon Jun 2 (10am) | Deploy rules + functions + hosting | DevOps | All 3 deploy steps succeed |
| Mon Jun 2 (11am) | Cloud Logs verification (24h) | QA Lead | Monitor script running, <5% warning rate |
| Mon Jun 2 (3pm) | Smoke test in production | QA Lead | Smoke test exit code 0 on live |

---

## Section 8: Success Criteria & Sign-Off

### Phase 4 Test Strategy Success = ALL of:

✓ **Unit Coverage:**
- 40/40 unit tests PASS (12 + 16 + 8 + 4)
- Coverage: 85%+ functions, 70%+ branches

✓ **E2E Coverage:**
- 5/5 critical flows PASS (100%)
- 3/3 non-critical flows PASS (preferred)

✓ **Smoke Test:**
- Exit code 0 (all 10 checks PASS)

✓ **Regression Gates:**
- Bundle size: ≤380 KB (baseline + 5%)
- LCP: <2.5s (±10% baseline)
- INP: <200ms (±15% baseline)
- Unit tests: 738+/738 PASS
- Auth latency: <500ms p95

✓ **Test Data:**
- 10 test labs seeded
- 50 test patients seeded
- 100 test laudos seeded
- 30 NOTIVISA payloads (edge cases)

### Sign-Off

| Role | Name | Sign-Off |
|------|------|----------|
| QA Lead | — | Validates coverage report |
| Test Owner | — | Approves test strategy |
| CTO | — | Approves compliance + risk assessment |

---

## Appendix: Test Utilities & Helpers

### A.1 Mock Service Factory

**File:** `functions/src/__tests__/mocks/emailService.ts`

```typescript
export class EmailServiceMock {
  private sent: EmailPayload[] = [];

  async send(payload: EmailPayload): Promise<{ MessageId: string }> {
    this.sent.push(payload);
    return { MessageId: `mock-msg-${this.sent.length}` };
  }

  getSent(): EmailPayload[] {
    return this.sent;
  }

  clear(): void {
    this.sent = [];
  }
}
```

---

### A.2 Firestore Emulator Helpers

**File:** `functions/src/__tests__/helpers/firestoreTestSetup.ts`

```typescript
export async function setupEmulator(projectId: string) {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
  const db = getFirestore();
  await clearFirestore(db);
  return db;
}

export async function clearFirestore(db: Firestore) {
  const docs = await getDocs(collection(db, '__all__'));
  for (const doc of docs.docs) {
    await deleteDoc(doc.ref);
  }
}
```

---

### A.3 Test Context Helpers

**File:** `e2e/helpers/testContext.ts`

```typescript
export async function setupTestLab(page: Page, labId: string) {
  const db = initializeApp(firebaseConfig).firestore();
  await db.collection('labs').doc(labId).set({
    name: `Test Lab ${labId}`,
    criadoEm: Timestamp.now(),
  });
  return { db, labId };
}

export async function loginTestUser(page: Page, email: string, password: string) {
  await page.goto('http://localhost:5173/auth/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Entrar")');
  await page.waitForURL('**/hub');
}
```

---

## Appendix: Metrics & Observability

### B.1 Test Metrics Collection

**Automated via GitHub Actions:**

```yaml
name: Test Metrics
on: [pull_request]
jobs:
  test-metrics:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests with metrics
        run: |
          npm run test -- --json --outputFile=test-results.json
          npm run e2e -- --reporter=json --output=e2e-results.json
      - name: Parse metrics
        run: node scripts/parse-test-metrics.js
      - name: Upload to dashboard
        run: curl -X POST https://metrics.hmatologia2.com/phase4 \
          -d @test-metrics.json
```

---

### B.2 Performance Metrics

**Cloud Monitoring dashboards:**
- Auth callables duration (p50, p95)
- Queue processor throughput (events/min)
- Firestore read/write latency
- Cloud Functions error rate

---

## Conclusion

Phase 4 test strategy ensures:
1. **40/40 unit tests** validate callables, rules, helpers
2. **5/5 critical E2E flows** prove end-to-end functionality
3. **Smoke test (exit code 0)** confirms production readiness
4. **Regression gates** prevent performance/bundle regressions
5. **Test data & fixtures** enable CI automation

**Go-live decision point:** All gates PASS + QA + CTO sign-off → deploy Phase 4

---

**Version:** 1.0  
**Date:** 2026-05-07  
**Next Review:** 2026-05-20 (Phase 4 kickoff)
