---
phase: 14
title: Pre-Launch Security & Stability — v1.4 Wave 4 Final Gate
date_created: 2026-05-07
target_complete: 2026-08-30
status: planned
risk_level: 4.5/10 (MEDIUM)
critical_path: Security audit → Dependency audit → Smoke tests → Staging dry-run → Playbook finalization
dependencies:
  - Phases 4-13 complete (all modules on staging)
  - Staging Firebase project fully provisioned
  - Cloud Logs monitoring infrastructure ready
  - All 25+ modules in stable state on staging
---

# Phase 14: Pre-Launch Security & Stability

## Executive Summary

Phase 14 is the **final gate before v1.4 production launch (scheduled 2026-08-31)**. It consists of 7 parallel/sequential audit streams:

1. **Security audit** — Firestore Rules v1.4 extensions, Cloud Functions Zod validation, secrets rotation, LGPD data retention
2. **Dependency audit** — npm audit (high-severity), Firebase SDK latest, deprecated packages
3. **Smoke test suite** — All 25 modules on staging, critical paths verified
4. **Staging deployment** — Full dry-run to parallel Firebase project, rollback tested
5. **Load test** — 100 concurrent users, <5% error rate, latency <2.5s p99
6. **Deploy playbook** — Step-by-step, SLA definitions, incident response tree
7. **Rollback procedure** — Tested + documented, recovery time <30min

**Success Criteria:**

- ✅ Zero critical security vulnerabilities
- ✅ Zero high-severity dependency issues (or mitigated with risk register)
- ✅ 100% of smoke tests PASS on staging
- ✅ Staging ↔ production deployment rehearsed, rollback verified
- ✅ Load test: p99 latency <2.5s, error rate <1%
- ✅ Deploy playbook signed off by ops team
- ✅ Incident response tree validated with 3x scenarios

**Duration:** 5–7 calendar days (concurrent work)  
**Owner:** Tech lead + security engineer + QA lead + ops engineer  
**Sign-Off:** CTO + external auditor (pre-alignment)

---

## 1. Security Audit

### 1.1 Firestore Rules v1.4 Extensions Audit

**Goal:** Verify all rules changes in v1.4 are secure, no bypass vectors introduced, module claims properly provisioned.

**Checklist:**

- [ ] **Rules syntax validation**
  - `firebase emulators:exec --only firestore "npm test"` passes 100%
  - No `allow write: if true` anywhere in rules
  - All write paths have `isActiveMemberOfLab(labId)` guard or admin check
  - All regulatory collections have `allow delete: if false`
  - See `.claude/rules/firestore-security.md` for invariants

- [ ] **Module claims provisioning audit**
  - Run query: `SELECT uid, modules FROM users WHERE labId='all-labs' AND createdAt > '2026-05-01'`
  - Verify: `modules` map has all active modules (25 modules minimum per active user)
  - Zero users with `modules` == null or undefined
  - Phase 2 bypass (hasModuleAccess fallback) removed from rules post-2026-05-20
  - Check: New Phase 4–13 modules (portal, criticos, imuno-ias, etc.) have claims in all active users

- [ ] **Multi-tenant boundary validation**
  - Grep rules for `request.auth.uid` comparisons — verify all use `labId` parameter
  - Cross-lab read/write impossible (spot-check 3 random collections)
  - Test: Create doc in `labs/lab-A/...`, try read/write from `lab-B` member → DENIED
  - Test: Soft-delete in lab A doesn't affect lab B's view

- [ ] **Signature validation for regulatory writes**
  - All Phase 0b+ collections validate `validSignature(d)` before create
  - Hash validation: `d.assinatura.hash.size() == 64`
  - Operator ID: `d.assinatura.operatorId == request.auth.uid` (server callables skip this, Admin SDK signs)
  - Timestamp check: `d.assinatura.ts is timestamp` and `ts >= request.time - 5 minutes`
  - Verify collections: `pops`, `auditoria`, `sgq`, `treinamentos`, `biosseguranca`, `pgrss`, `turnos`, `risks`, `lab-apoio`, `educacao-continuada`

- [ ] **Audit trail immutability**
  - Collections with `auditTrail` subcollection (e.g., `sgq/{docId}/auditTrail/{entryId}`)
  - Rules enforce: allow create only, `allow update: if false`, `allow delete: if false`
  - Test: Create audit entry, try update → DENIED, try delete → DENIED

- [ ] **Patient portal access isolation (if live in v1.4)**
  - Patient members (role == 'patient') can only read `laudos`, `portal-configuracao`, personal test results
  - Cannot access `pops`, `educacao-continuada`, `auditoria`, `turnos`
  - Test 3 paths: patient read laudo (ALLOW), read POP (DENY), read audit trail (DENY)

**Output:** `docs/security-audit/FIRESTORE_RULES_v1.4_AUDIT.md` (checklist + findings)

---

### 1.2 Cloud Functions Zod Validation Audit

**Goal:** Verify all callable functions have strict input validation via Zod, no unsafe payload handling, secrets properly injected.

**Checklist:**

- [ ] **Zod schema coverage**
  - List all callables in `functions/src/`: `grep -r "onCall(" . | wc -l`
  - Expected ~75–85 callables by Phase 13
  - Sample 20 random functions (10 from Phase 0–3, 10 from Phase 4–13)
  - Verify each has input schema: `.data` field validates against Zod `z.object({...})`
  - Verify error handling: `z.ZodError` caught, returns `{ error: 'validation error', details: [...] }`

- [ ] **LGPD field validation**
  - Functions handling PII (CPF, patient names, test results) have schema constraints:
    - CPF: `z.string().regex(/^\d{11}$/)`
    - Email: `z.string().email()`
    - Patient names: no unvalidated text → `z.string().max(255)`
  - Audit trail functions log: user, action, timestamp, old/new values (diff)

- [ ] **Secrets injection verification**
  - List all secrets in `functions/src/`: `grep -r "defineSecret(" .`
  - Expected: `GEMINI_API_KEY`, `RESEND_API_KEY`, `NOTIVISA_SECRET`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `HMAC_KEY`
  - Verify each secret:
    - Defined in `.env.local.staging` (not committed)
    - Provisioned in Cloud Functions (run `firebase functions:secrets:list`)
    - Referenced via `definesecret('NAME').value()` in function
    - Never hardcoded in source
  - Check ADR-0017 remediation: `scripts/preflight-secrets-check.sh` passes

- [ ] **No console.log of sensitive data**
  - Grep functions for console.log near: CPF, API keys, tokens, patient data, signatures
  - Replace with structured logging: `logger.info({ event: 'action', labId, userId })`

- [ ] **Error message sanitization**
  - Functions don't leak stack traces to client: `catch (err) { return { error: 'internal error' } }`
  - Admin-only functions can log details: `{ error: err.message, context: { ... } }`
  - Public endpoints never expose: file paths, DB structure, schema names

**Output:** `docs/security-audit/CLOUD_FUNCTIONS_ZOD_VALIDATION_AUDIT.md`

---

### 1.3 Secrets Management & Rotation Audit

**Goal:** Verify all production secrets are provisioned, rotated on schedule, and never leaked in logs or versioning.

**Checklist:**

- [ ] **Secret provisioning status**
  - Run: `firebase functions:secrets:list --project hmatologia2`
  - Verify: All 6 secrets (GEMINI, RESEND, NOTIVISA, TWILIO ×2, HMAC) are `ACTIVE`
  - Verify: No `PENDING_SET` or expired secrets
  - Check: Last rotation date (should be ≤90 days for HMAC, ≤180 days for API keys)

- [ ] **Secret access audit**
  - Log all functions that read each secret
  - Verify: Only functions that need it have access (principle of least privilege)
  - Example: `GEMINI_API_KEY` used in `analyzeCIQImage`, `generateLaudo`, etc. (not in auth flow)

- [ ] **No hardcoded values in git history**
  - Run: `git log -p | grep -i "api.key\|secret\|token" | head -50`
  - If found: `git filter-branch` to remove, rotate secrets immediately
  - Verify: No `.env` files committed (check `.gitignore`)

- [ ] **Staging secrets separate from production**
  - Staging project `hcquality-staging` has own secret set
  - Test: Deploy functions to staging, secrets auto-inject from staging project
  - Verify: Staging GEMINI calls go to sandbox, not production Gemini quota

- [ ] **Rotation schedule**
  - Document rotation cadence:
    - **HMAC_KEY**: every 30 days (cryptographic security)
    - **API_KEYS** (GEMINI, RESEND, TWILIO): every 90 days
    - **NOTIVISA_SECRET**: every 60 days (regulatory)
  - Implement: Cron job to remind ops team 1 week before expiry
  - Add to deployment checklist: "Verify secrets rotated in last 90 days"

**Output:** `docs/security-audit/SECRETS_MANAGEMENT_AUDIT.md`

---

### 1.4 LGPD Data Retention & Deletion Audit

**Goal:** Verify LGPD compliance (RDC 978 Art. 77 + DICQ 4.10), data deletion workflows, consent tracking.

**Checklist:**

- [ ] **LGPD module live and functional**
  - Module exists at `src/features/lgpd/`
  - Features: privacy policy display, user rights (access/portability/deletion), DPIA audit trail
  - Verify: Deletion request → soft-delete in `lgpd/deletionRequests/{labId}`, not hard-delete

- [ ] **Data retention policy enforcement**
  - Query: Select users with `role == 'patient'` + `deletionRequestedAt` set + date > `30 days ago`
  - These users' PII should be soft-deleted (flag `deletadoEm` set)
  - Verify: Soft-deleted records excluded from queries (where `deletadoEm == null`)
  - Test: Create deletion request, verify data inaccessible after 30-day window

- [ ] **DPIA audit trail**
  - Collection `lgpd/{labId}/dpia` exists with entries for:
    - Data processing assessment
    - Risk mitigation
    - Reviews (annual minimum per DICQ 4.10)
  - Verify: Immutable (append-only, no updates)
  - Verify: Signed (assinatura field) by responsible person

- [ ] **Consent tracking**
  - `lgpd/{labId}/consents/{patientId}` records:
    - Initial consent date
    - Purpose of processing (CIQ, portal, result notification)
    - Withdrawal date (if applicable)
  - Verify: Portal cannot access patient results if consent withdrawn
  - Test scenario: Withdraw consent → 5min later portal access denied

- [ ] **Data transfer logs**
  - If system exports PII (e.g., batch export for auditor): `lgpd/{labId}/transferLogs/{id}`
  - Verify: Each transfer logged with: recipient, date, data set, purpose, permissions
  - Verify: Immutable

**Output:** `docs/security-audit/LGPD_DATA_RETENTION_AUDIT.md`

---

## 2. Dependency Audit

### 2.1 npm Audit (High-Severity)

**Goal:** Identify all high/critical vulnerabilities in dependencies, determine which to patch vs. accept as risk.

**Steps:**

```bash
cd /path/to/hc-quality
npm audit --audit-level=high
```

**Expected output format:**

```
found X vulnerabilities (Y critical, Z high)
```

**Acceptance criteria:**

- Zero critical vulnerabilities
- High-severity vulnerabilities either:
  - Fixed by `npm update` (preferred)
  - Accepted as calculated risk with documented mitigation
  - Alternate package selected (if maintainer abandoned)

**Key dependencies to check explicitly:**

| Package          | Current  | Check For                         | Action If Vulnerable                       |
| ---------------- | -------- | --------------------------------- | ------------------------------------------ |
| `firebase`       | ^10.14.1 | Auth/DB exploits                  | Update to latest ^10.x or ^11.x            |
| `@sentry/react`  | 10.50.0  | Data leakage in error capture     | Update to latest 10.x                      |
| `zod`            | ^3.25.76 | Regex DoS in validation           | Update to ^3.latest                        |
| `vite`           | ^6.4.2   | Build-time exploits               | Update to ^6.latest or ^7.x                |
| `react`          | ^19.2.5  | XSS in DOM render                 | Update to ^19.latest                       |
| `puppeteer`      | 24.43.0  | Browser automation sandbox escape | Update to latest 24.x; assess 25.x upgrade |
| `firebase-admin` | ^13.8.0  | Auth bypass, RCE                  | Update to ^13.latest or ^14.x              |
| `typescript`     | ^5.9.3   | Type-based security holes         | Update to ^5.latest or ^6.x if available   |

**Output:** `docs/dependency-audit/NPM_AUDIT_REPORT.md`

---

### 2.2 Firebase SDK Version Check

**Goal:** Ensure Firebase client + admin SDKs are latest or near-latest, no EOL versions.

**Checklist:**

- [ ] **Client SDK (`firebase`)**
  - Current: ^10.14.1
  - Latest: `npm view firebase version`
  - If latest > v10, check release notes for breaking changes
  - Preferred: Stay on v10.x (stable) unless v11+ has security fix

- [ ] **Admin SDK (`firebase-admin`)**
  - Current: ^13.8.0
  - Latest: `npm view firebase-admin version`
  - Verify: No EOL warning in npm registry
  - Check: Firestore, Auth, Messaging (3 modules used) are compatible with Functions Node 22

- [ ] **Deprecation warnings**
  - Run `npm ls` and grep for DEPRECATED in output
  - Likely: `react-to-print` (PDF printing), `papaparse` (CSV parsing)
  - Decision: These are low-risk legacy libs; accept unless replacement is drop-in better

**Output:** `docs/dependency-audit/FIREBASE_SDK_VERSION_REPORT.md`

---

### 2.3 Deprecated/End-of-Life Package Audit

**Goal:** Identify packages that are no longer maintained and plan off-ramps if critical.

**Steps:**

```bash
npm audit | grep -i "deprecated\|eol"
```

**High-risk EOL packages (historical):**

| Package          | Status              | Risk                          | Migration Path                             |
| ---------------- | ------------------- | ----------------------------- | ------------------------------------------ |
| `papaparse`      | Unmaintained (2021) | Low — CSV parsing, no network | Migrate to `csv-parse` (streaming) or keep |
| `react-to-print` | Last update 2024    | Low — iframe-based printing   | Keep; simple utility                       |
| `qrcode.react`   | Active              | None                          | Continue                                   |
| `pdfjs-dist`     | Active              | None                          | Continue                                   |

**Decision matrix:**

- **Continue** (low risk, stable): papaparse, react-to-print
- **Monitor** (one major version back): Firebase SDKs, TypeScript, Vite
- **Upgrade now** (if available and breaking changes assessed): React, Zod, Zustand

**Output:** `docs/dependency-audit/DEPRECATED_PACKAGES_AUDIT.md`

---

## 3. Smoke Test Suite

### 3.1 All 25 Modules Coverage

**Goal:** Verify each of the 25 production modules functions correctly on staging with representative data.

**Test structure:**

```
test/smoke/
├── fixtures/
│   ├── sampleData.ts               # Pre-seeded test labs + users
│   └── stageHelper.ts              # Cloud Logs fetch, error checking
├── modules/
│   ├── analyzer.smoke.ts           # OCR Yumizen H550
│   ├── coagulacao.smoke.ts         # CIQ coagulação
│   ├── ciq-imuno.smoke.ts          # CIQ imunologia
│   ├── ...
│   └── risks.smoke.ts              # FMEA-lite
├── critical-paths/
│   ├── 01-laudo-creation-e2e.ts    # End-to-end: analyzer → CIQ → laudo → portal
│   ├── 02-notivisa-e2e.ts          # NOTIVISA submission + audit trail
│   ├── 03-capa-closure-e2e.ts      # CAPA: finding → action → sign-off
│   ├── 04-portal-download-e2e.ts   # Patient downloads result
│   └── 05-audit-trail-integrity.ts # All writes signed + auditable
└── README.md
```

**Per-module smoke test checklist:**

For each of 25 modules, test passes:

```
✓ Module loads without errors
✓ CRUD operations work (create, read, update, soft-delete)
✓ Rules validation enforced (cross-tenant denied, soft-delete only)
✓ Audit trail recorded (if regulatory)
✓ Response time <2s p99
✓ Error handling returns proper HTTP status codes
```

**Critical paths (5 integration flows):**

1. **Laudo Creation E2E** (analyzer → bioquimica → coagulacao → laudo creation)
   - Setup: Seed patient, sample, equipment, reagent lot
   - Create: CIQ run for each module (analyzer detects values, CIQ validates)
   - Generate: Laudo PDF with QR code
   - Verify: Portal patient can download, audit trail records all steps

2. **NOTIVISA Submission E2E**
   - Precondition: Laudo marked ready
   - Action: `submitToNotivisa(laudoId)`
   - Verify: Message queued in `notivisa-outbox`
   - Verify: Cron processor dequeues + submits
   - Verify: Response logged in `notivisa-responses/{id}`
   - Timeout: <30s from submit to response logged

3. **CAPA Closure E2E**
   - Setup: Audit finding logged (NC origem module, risk evaluation)
   - Action: Create CAPA (corrective/preventive action)
   - Action: Assign responsible person + deadline
   - Action: Log completion evidence + signature
   - Verify: Finding marked closed, audit trail complete
   - Verify: RT (responsible tech) can review, approve

4. **Portal Download E2E** (if live in v1.4)
   - Setup: Patient with laudo + notification consent
   - Action: Patient logs in → views laudo → downloads PDF
   - Verify: PDF contains patient name, results, QR code, physician signature
   - Verify: Access logged in LGPD audit trail

5. **Audit Trail Integrity**
   - For each action (laudo create, CIQ run, NOTIVISA send, CAPA close):
     - Verify `auditTrail` entry exists
     - Verify `operatorId` == authenticated user
     - Verify `assinatura.hash` is valid (SHA-256 of payload)
     - Verify `createdAt` is timestamp (not user input)
     - Verify entry is immutable (no soft-delete, no update)

**Test execution:**

```bash
# Unit tests (all modules)
npm test

# Smoke tests on staging
npm run test:smoke:staging

# Generate JUnit XML for CI
npm run test:smoke:ci

# Expected: 100% pass rate (no skipped tests)
```

**Output:**

- `test-results.xml` (JUnit format for CI)
- `docs/smoke-tests/SMOKE_TEST_REPORT.md` (human-readable summary + timings)
- `docs/smoke-tests/SMOKE_TEST_MATRIX.md` (25 modules × 5 critical paths = 125 cells, all ✓)

---

## 4. Staging Deployment (Full Dry-Run)

### 4.1 Parallel Firebase Project Setup

**Goal:** Create a staging Firebase project (`hcquality-staging`) that mirrors production, deploy v1.4 code, validate everything works, test rollback.

**Staging project credentials:**

- Project ID: `hcquality-staging`
- Region: `southamerica-east1` (same as production)
- Firestore: `staging-db` (separate from production `(default)`)
- Hosting: `hcquality-staging.web.app`
- Functions: Same config as production (Node 22, secrets, etc.)

**Deployment steps:**

1. **Pre-flight checks**

   ```bash
   bash scripts/preflight-secrets-check.sh
   npm run typecheck
   npm run build
   npm run lint
   npm run test:unit
   ```

   Expected: All pass, zero warnings.

2. **Deploy Rules + Indexes**

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes \
     --project hcquality-staging
   ```

   Expected: Rules active in 30–60s.

3. **Deploy Functions**

   ```bash
   cd functions && npm run build
   cd ..
   firebase deploy --only functions --project hcquality-staging
   ```

   Expected: All 75–85 callables deployed, no errors in Cloud Logs.

4. **Deploy Hosting**

   ```bash
   firebase deploy --only hosting --project hcquality-staging
   ```

   Expected: Bundle <500KB gzip, live at `https://hcquality-staging.web.app` in <2s.

5. **Seed staging data**

   ```bash
   FIREBASE_PROJECT=hcquality-staging npm run staging:seed
   ```

   Expected: 5 test labs created, 50 users provisioned, 20 CIQ runs seeded.

6. **Smoke test on staging**
   ```bash
   FIREBASE_EMULATOR_HOST=localhost:9999 npm run test:smoke:staging
   ```
   Expected: 100% pass (all 25 modules + 5 critical paths).

**Validation output:** `docs/staging-deployment/STAGING_DEPLOYMENT_REPORT.md`

---

### 4.2 Rollback Procedure Validation

**Goal:** Test that production can be rolled back to v1.3 in <30 minutes if critical issues surface.

**Rollback strategy:**

1. **Immediate (1–2 min):** Revert hosting to v1.3 bundle

   ```bash
   firebase deploy --only hosting --project hmatologia2 \
     --etag <v1.3-etag-from-deploy-history>
   ```

2. **Short-term (5 min):** Revert Cloud Functions if breaking changes

   ```bash
   firebase deploy --only functions --project hmatologia2
   # Functions auto-rollback if `functions/` git tree matches v1.3 tag
   ```

3. **Data rollback (10–15 min):** Restore Firestore from backup
   - Pre-production: Enable daily backup to Cloud Storage
   - Test: Restore from 24h backup to staging, verify data integrity
   - Runbook: `docs/rollback-procedures/FIRESTORE_RESTORE.md`

4. **Rules rollback (2 min):** Revert to v1.3 Firestore rules
   ```bash
   git checkout v1.3 -- firestore.rules
   firebase deploy --only firestore:rules --project hmatologia2
   ```

**Test scenario:**

- Deploy v1.4 to staging
- Intentionally break a critical callable (e.g., `submitToNotivisa`)
- Execute rollback steps 1–4 above in sequence
- Verify: Staging back to v1.3 state, all tests pass again
- Measure: Total time from "rollback triggered" to "system healthy" = <30min
- Document: Actual times, blockers, improvements

**Output:** `docs/rollback-procedures/ROLLBACK_VALIDATION_REPORT.md`

---

## 5. Load Test (100 Concurrent Users)

### 5.1 Load Test Harness

**Goal:** Verify system can handle production load (100 concurrent users simulated) with acceptable latency and error rates.

**Test tool:** Artillery.io (Node.js based, easy to extend).

**Load profile:**

| Metric                    | Target               | Hard Limit      |
| ------------------------- | -------------------- | --------------- |
| Concurrent users          | 100                  | 200 (fail-safe) |
| Ramp-up time              | 5 minutes            | —               |
| Test duration             | 15 minutes sustained | —               |
| P50 latency               | <500ms               | —               |
| P95 latency               | <1.5s                | —               |
| P99 latency               | <2.5s                | 3.0s (error)    |
| Error rate                | <1%                  | 5% (error)      |
| HTTP 503 (quota exceeded) | 0                    | <1%             |

**Test scenarios (weighted):**

1. **CIQ run creation** (30% of traffic)
   - Create CIQ run for random module (analyzer, coagulacao, etc.)
   - Assert: HTTP 200, response <2s

2. **Laudo generation** (20% of traffic)
   - Create laudo from seeded CIQ runs
   - Assert: HTTP 200, PDF generated <5s

3. **Portal patient access** (20% of traffic)
   - Patient login → list laudos → fetch one → download PDF
   - Assert: All steps complete <3s total

4. **NOTIVISA batch submission** (15% of traffic)
   - Submit 5 laudos to NOTIVISA in parallel
   - Assert: All queued <2s, queue processes within 30s

5. **Audit trail reads** (15% of traffic)
   - Fetch audit trail for random laudo + CIQ run
   - Assert: Immutable reads <500ms

**Load test script** (`scripts/load-test-phase-14.sh`):

```bash
#!/bin/bash
# Load test for Phase 14 gate

PROJECT="hcquality-staging"
URL="https://hcquality-staging.web.app"
DURATION_MINUTES=15
CONCURRENT_USERS=100

artillery run \
  --target "$URL" \
  --ramp 100 \
  --duration "$DURATION_MINUTES" \
  test/load/phase-14-profile.yml \
  | tee "test-results/load-test-$(date +%s).json"

# Post-test analysis
node scripts/analyze-load-test.mjs
```

**Pass criteria:**

- ✅ 0 hard failures (system didn't crash)
- ✅ P99 latency <2.5s
- ✅ Error rate <1%
- ✅ No cascading failures (errors didn't spike over time)

**Output:** `docs/load-tests/LOAD_TEST_REPORT.md` + raw JSON metrics

---

## 6. Deploy Playbook Finalization

### 6.1 Step-by-Step Deployment Checklist

**Goal:** Write exhaustive deployment runbook that ops team can follow without ambiguity.

**File:** `docs/deploy-playbooks/PHASE_14_PRODUCTION_DEPLOY_CHECKLIST.md`

**Format:**

````markdown
# Production Deployment Checklist — v1.4 GA

## Pre-Deployment (3 hours before window)

- [ ] **Git hygiene**
  - Verify all commits on `main` branch
  - Verify all commits have passing CI
  - Verify no uncommitted changes (`git status`)

- [ ] **Secrets verification**
  - Run: `bash scripts/preflight-secrets-check.sh`
  - Confirm: All 6 secrets active (GEMINI, RESEND, NOTIVISA, TWILIO×2, HMAC)
  - Confirm: No `PENDING_SET` values

- [ ] **Test suite execution**
  - Run: `npm run test:unit`
  - Expected: 738/738 tests pass
  - If <738 pass: ABORT, investigate

- [ ] **Type check**
  - Run: `npm run typecheck`
  - Expected: 0 errors, 0 warnings
  - If warnings: document and approve with CTO

- [ ] **Build validation**
  - Run: `npm run build`
  - Expected: Hosting bundle <500KB gzip, no warnings
  - Check bundle size vs. baseline (run `npm run analyze`)

- [ ] **Smoke tests on staging**
  - Run: `npm run test:smoke:staging`
  - Expected: 100% pass
  - If failures: ABORT, fix bugs, re-run

- [ ] **Load test on staging**
  - Run: `bash scripts/load-test-phase-14.sh`
  - Expected: P99 <2.5s, error rate <1%
  - If failed: ABORT, investigate bottleneck

- [ ] **Cloud Logs baseline**
  - Fetch last 24h logs from staging
  - Verify: No errors, <5% warnings
  - Save baseline for comparison post-deploy

- [ ] **Stakeholder notification**
  - Email: CTO, RT lead, lab directors
  - Subject: "v1.4 Production Deploy — [Date] [Time UTC]"
  - Content: Highlights (portal launch, NOTIVISA, CAPA), expected downtime (0min)

## Deployment Window (60 minutes)

**Start time:** [SPECIFY UTC]  
**Expected duration:** 10–15 minutes active; 45 minutes monitoring  
**Rollback time on failure:** <5 minutes

### Step 1: Deploy Firestore Rules (2 min)

```bash
firebase deploy --only firestore:rules,firestore:indexes \
  --project hmatologia2
```
````

- Expected output: ✓ rules deployed, ✓ indexes active
- Monitoring: Watch Cloud Logs for `PermissionDenied` errors (should be 0)
- Go/No-Go: Are permissions working? Can users access their labs?
  - YES → Continue
  - NO → Rollback: `git checkout v1.3 -- firestore.rules && firebase deploy --only firestore:rules`

### Step 2: Deploy Cloud Functions (5 min)

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions --project hmatologia2
```

- Expected output: ✓ 75+ functions deployed, ✓ no timeouts, ✓ <3min total
- Monitoring: Cloud Logs for `Error`, `500`, `503`
- Go/No-Go decision points:
  - Any function has `Error: X is not defined` → Rollback
  - Any function timeout → Rollback
  - Otherwise → Continue

### Step 3: Invalidate Hosting CDN Cache (1 min)

```bash
gcloud compute url-maps invalidate-cdn-cache web-app-cache \
  --path "/*" --project hmatologia2
```

- Expected: Cache invalidation queued

### Step 4: Deploy Hosting (3 min)

```bash
firebase deploy --only hosting --project hmatologia2
```

- Expected output: ✓ build deployed, ✓ live at `https://hmatologia2.web.app`
- Wait: 2 min for CDN propagation to 95% of regions

### Step 5: Smoke Test in Production (5 min)

- [ ] Open `https://hmatologia2.web.app` in browser
- [ ] Hard reload (Ctrl+Shift+R)
- [ ] Login as test user
- [ ] Create CIQ run (analyzer module)
- [ ] Verify: No errors in browser console
- [ ] Fetch: `GET /api/health` → should return `{ status: 'ok', version: '1.4.0' }`

## Post-Deployment Monitoring (45 minutes)

- [ ] **Cloud Logs streaming**
  - Run: `bash scripts/monitor-cloud-logs.sh 1 45`
  - Watch: Errors, warnings, latency spikes
  - Alert threshold: >5 errors/min → Page on-call

- [ ] **User-facing checks** (every 10 min)
  - Can users login? (1 test account per region)
  - Can laudo be created? (1 E2E flow)
  - Can results be downloaded? (1 patient portal flow)

- [ ] **Alerting system check**
  - Verify: Sentry is receiving errors (if any)
  - Verify: Error rate <1%
  - Verify: Latency distribution normal

- [ ] **Go/No-Go final decision** (at T+45min)
  - All checks passed? → Production GA, notch on belt ✓
  - Any failures? → Initiate rollback immediately

## Rollback Procedure (if needed)

See `docs/rollback-procedures/ROLLBACK_CHECKLIST.md`

Time to rollback: <5 minutes
Impact window: Users will see v1.3 UI, may have stale PWA cache (hard reload required)

## Post-Mortem (if rollback occurred)

- [ ] Declare incident to stakeholders
- [ ] Collect logs + error traces
- [ ] Root cause analysis (24h)
- [ ] Fix + re-test on staging
- [ ] Schedule retry within 48h

```

**Additional playbooks:**

- `docs/deploy-playbooks/FIRESTORE_RULES_DEPLOYMENT_HOTFIX.md` — rules-only hotfix procedure
- `docs/deploy-playbooks/FUNCTIONS_HOTFIX_PROCEDURE.md` — functions-only hotfix (without full deploy)
- `docs/deploy-playbooks/SECRETS_ROTATION_PROCEDURE.md` — how to rotate secrets mid-production

---

### 6.2 SLA Definitions per Component

**File:** `docs/deploy-playbooks/PRODUCTION_SLA_DEFINITIONS.md`

| Component | Availability | Response Time | Degradation Threshold |
|-----------|--------------|----------------|----------------------|
| **Web Frontend** | 99.9% | <2.5s p99 LCP | >5s p99 → alert |
| **Firestore Reads** | 99.95% | <500ms p99 | >1s p99 → alert |
| **Firestore Writes** | 99.95% | <1s p99 | >2s p99 → alert |
| **Cloud Functions** | 99.9% | <3s p99 response | >5s p99 → alert |
| **NOTIVISA Submission** | 99% | <30s queue time | >60s → escalate |
| **PDF Generation** | 99.5% | <5s per laudo | >10s → retry queue |
| **Portal Patient Access** | 99.5% | <2s login | >3s → session timeout |
| **Audit Trail Write** | 99.95% | <2s immutable record | Never drop → deadletter |

---

## 7. Incident Response Plan

### 7.1 Incident Classification

**File:** `docs/incident-response/INCIDENT_SEVERITY_LEVELS.md`

| Level | Definition | Response Time | Example |
|-------|-----------|----------------|---------|
| **P1 (Critical)** | System unavailable for >5 min OR data loss risk | <5 min | Firestore down, functions 5xx spree |
| **P2 (High)** | Feature unavailable, 100+ users affected | <15 min | Portal login failing, laudo generation 50% error rate |
| **P3 (Medium)** | Degraded feature, <100 users OR performance drop >50% | <1h | Slow PDF generation, audit trail delays |
| **P4 (Low)** | Non-critical UI bug, workaround exists | <24h | Typo in label, color mismatch |

---

### 7.2 Incident Response Tree

**File:** `docs/incident-response/INCIDENT_RESPONSE_TREE.md`

```

INCIDENT DETECTED
↓
[Who?] → On-call engineer
[What?] → Type of error (rules, functions, hosting, third-party)
[Where?] → Component affected (analyzer, laudo, portal, etc.)

─── IF Firestore Rules Error ───
├─ PermissionDenied? → User not in lab members
│ └─ Verify: `isActiveMemberOfLab(labId)` check passes in rules
│ └─ Action: Re-provision claims via `provisionModulesClaims`
├─ ValidationFailed? → Payload invalid
│ └─ Check: Rules schema vs. client payload
│ └─ Action: Ask client team to verify input
└─ Other? → Rollback rules to v1.3
└─ Command: `git checkout v1.3 -- firestore.rules && firebase deploy --only firestore:rules`

─── IF Cloud Functions Error (5xx) ───
├─ Timeout? → Function exceeds 540s limit
│ └─ Check Cloud Logs for long-running operation
│ └─ Action: Optimize query or offload to background job
├─ Out of Memory? → Function exceeds 4GB RAM
│ └─ Check: `puppeteer` image processing or large data load
│ └─ Action: Reduce batch size or upgrade memory allocation (limited)
├─ Secret Not Found? → Callable tries to read undefined secret
│ └─ Run: `firebase functions:secrets:list`
│ └─ Action: Provision missing secret, redeploy
└─ Other? → Rollback functions to v1.3
└─ Check git: `git log --oneline | head -5`
└─ Deploy v1.3 functions: `git checkout v1.3 -- functions/ && npm run build && firebase deploy --only functions`

─── IF Hosting Bundle Issue ───
├─ 404 on route? → Route not in vite.config.ts
│ └─ Check: App routing config
│ └─ Action: Hard reload browser (Ctrl+Shift+R)
├─ Stale PWA? → Service worker serving old code
│ └─ Action: Ask user to hard reload (Ctrl+Shift+R)
│ └─ Tech: Run `gcloud compute url-maps invalidate-cdn-cache`
└─ Large bundle? → LCP >2.5s
└─ Check: `npm run analyze` output
└─ Action: Remove unused dependencies or lazy-load routes

─── IF Third-Party Service Error ───
├─ Gemini Vision API error → `analyzeCIQImage` fails
│ └─ Check: Quota remaining, API key valid
│ └─ Action: Verify secret provisioned, test with stub response
├─ NOTIVISA Submission fails → Queue processing hangs
│ └─ Check: NOTIVISA_SECRET valid, network reachable
│ └─ Action: Pause queue, manually retry after fix
├─ Twilio SMS fails → Critical value alert not sent
│ └─ Check: Account balance, phone number valid
│ └─ Action: Use fallback email, alert RT manually
└─ Resend email fails → Laudo notification doesn't arrive
└─ Check: API key, email templates valid
└─ Action: Retry queue, fallback to in-app notification

─── Recovery & Escalation ───
├─ Can fix in <15 min? → Implement hotfix, test on staging, deploy
├─ Takes >15 min? → Rollback to v1.3, schedule fix for next window
├─ Data loss risk? → PAUSE all writes, restore from backup
└─ Unknown issue? → Page CTO, declare major incident

````

**Step-by-step example: "Laudo generation failing 50% of the time"**

1. **Classify:** P2 (high, feature unavailable)
2. **Alert:** Page on-call engineer, notify lab directors
3. **Diagnose:** Check Cloud Logs for errors in `generateLaudo` function
4. **Possible causes:**
   - Gemini API quota exceeded → increase quota or implement rate limit
   - Puppeteer memory spike → reduce PDF complexity
   - Firestore write timeout → optimize query or add indexes
5. **Decision:** If fixable in 5 min → hotfix; if >15 min → rollback
6. **Hotfix example:**
   ```bash
   # Reduce PDF quality to lower memory usage
   # Edit functions/src/laudo.ts, change image quality from 95 to 70
   git commit -am "hotfix: reduce PDF quality to fix memory leak"
   cd functions && npm run build
   firebase deploy --only functions:generateLaudo
   # Monitor: error rate should drop to <1% within 5 min
````

7. **If still failing after 15 min:**
   ```bash
   # Rollback to v1.3
   git checkout v1.3 -- functions/
   npm run build
   firebase deploy --only functions
   # Notify stakeholders: laudo generation temporarily disabled pending fix
   # Schedule fix + retry for tomorrow
   ```

---

## 8. Sign-Off Checklist

**Go/no-go meeting: 24 hours before production deployment**

Attendees: CTO, tech lead, QA lead, ops engineer, external auditor (pre-alignment)

- [ ] **Security audit complete**
  - Firestore Rules v1.4 validated ✓
  - Cloud Functions Zod validation ✓
  - Secrets provisioned + rotated ✓
  - LGPD compliance verified ✓

- [ ] **Dependency audit complete**
  - npm audit: 0 critical, 0 high-severity ✓
  - Firebase SDKs latest or near-latest ✓
  - Deprecated packages identified + decision made ✓

- [ ] **Smoke tests 100% pass on staging**
  - All 25 modules tested ✓
  - All 5 critical paths tested ✓
  - Response times <2.5s p99 ✓

- [ ] **Staging deployment successful**
  - Full dry-run completed ✓
  - All services up and responding ✓
  - Rollback procedure tested ✓

- [ ] **Load test successful**
  - 100 concurrent users sustained ✓
  - P99 latency <2.5s ✓
  - Error rate <1% ✓

- [ ] **Deploy playbook finalized**
  - Step-by-step checklist approved ✓
  - SLA definitions signed off ✓
  - Incident response tree validated ✓

- [ ] **Compliance pre-alignment**
  - External auditor reviewed compliance matrix ✓
  - DICQ 4.x coverage confirmed (target 88%) ✓
  - RDC 978 critical articles covered 100% ✓

**Sign-off:** CTO approves → proceed to production deployment

---

## Timeline & Resource Allocation

| Phase                     | Duration | Owner             | Start      | End        |
| ------------------------- | -------- | ----------------- | ---------- | ---------- |
| 1. Security audit         | 2 days   | Security engineer | 2026-08-15 | 2026-08-17 |
| 2. Dependency audit       | 1 day    | Tech lead         | 2026-08-15 | 2026-08-16 |
| 3. Smoke tests            | 1 day    | QA lead           | 2026-08-18 | 2026-08-19 |
| 4. Staging deployment     | 1 day    | Ops engineer      | 2026-08-18 | 2026-08-19 |
| 5. Load test              | 1 day    | Tech lead         | 2026-08-20 | 2026-08-20 |
| 6. Playbook finalization  | 1 day    | Ops engineer      | 2026-08-21 | 2026-08-21 |
| 7. Sign-off meeting       | 2 hours  | CTO               | 2026-08-22 | 2026-08-22 |
| **Production deployment** | 1 hour   | Ops engineer      | 2026-08-23 | 2026-08-23 |

**Critical path:** Security audit (2d) → Smoke tests (1d) → Sign-off (0.5d) = 3.5 days minimum

**Contingency:** If any audit fails, add 1 day for fixes + re-test.

---

## Success Metrics

Upon completion of Phase 14:

- ✅ **Security:** Zero critical vulnerabilities, all rules validated, secrets rotated
- ✅ **Quality:** 100% smoke test pass rate, 738/738 unit tests passing, load test SLA met
- ✅ **Compliance:** DICQ ≥88%, RDC 978 critical articles 100% covered, auditor aligned
- ✅ **Reliability:** Rollback procedure tested & <30min recovery time
- ✅ **Operations:** Deploy playbook finalized, incident response tree validated, SLAs defined
- ✅ **Sign-off:** CTO + external auditor approved, ready for 2026-08-31 external audit

**v1.4 is production-ready.**
