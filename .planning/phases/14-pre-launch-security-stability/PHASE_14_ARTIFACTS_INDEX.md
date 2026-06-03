---
phase: 14
title: Phase 14 Artifacts Index
status: complete
created: 2026-05-07
---

# Phase 14 Artifacts Index — Complete Execution Plan

## Overview

Phase 14 is the **final pre-launch security and stability gate** for v1.4 GA (scheduled 2026-08-31). This index links all planning, execution, and monitoring artifacts.

**Total artifacts:** 8 core documents + supporting runbooks  
**Execution timeline:** 5–7 calendar days (concurrent work)  
**Critical path:** Security audit (2d) → Smoke tests (1d) → Sign-off (0.5d) = 3.5 days minimum

---

## Core Phase 14 Documents

### 1. **PHASE_14_DETAILED_PLAN.md** (Main Specification)

**Location:** `.planning/phases/14-pre-launch-security-stability/PHASE_14_DETAILED_PLAN.md`

The comprehensive execution plan covering all 7 audit streams:

1. **Security Audit**
   - Firestore Rules v1.4 extensions (invariants, multi-tenant, signatures)
   - Cloud Functions Zod validation (input schemas, secrets handling)
   - Secrets management & rotation (provisioning, access audit, rotation schedule)
   - LGPD data retention & deletion (privacy compliance, consent tracking, DPIA)

2. **Dependency Audit**
   - npm audit (high-severity), Firebase SDK versions, deprecated packages
   - Decision matrix for each package (continue vs. migrate vs. upgrade)

3. **Smoke Test Suite**
   - All 25 modules coverage (CRUD operations, performance targets)
   - 5 critical integration paths (laudo creation, NOTIVISA, CAPA, portal, audit)

4. **Staging Deployment**
   - Full dry-run to parallel Firebase project
   - Rollback procedure validation (<30 min recovery)

5. **Load Testing**
   - 100 concurrent users, <2.5s p99 latency, <1% error rate
   - 5 scenario profiles (CIQ, laudo, portal, NOTIVISA, audit)

6. **Deploy Playbook**
   - Step-by-step deployment sequence
   - SLA definitions per component
   - Incident response tree (8 error types + recovery)

7. **Sign-Off Checklist**
   - Security ✓ Dependency ✓ Smoke tests ✓ Staging ✓ Load test ✓ Playbook ✓
   - CTO + external auditor approval required

**Owner:** Tech lead + Security engineer + QA lead + Ops engineer

---

### 2. **SMOKE_TEST_MATRIX.md** (Testing Specification)

**Location:** `docs/smoke-tests/SMOKE_TEST_MATRIX.md`

Detailed testing matrix with 125 test cases (25 modules × 5 flows):

**Module Coverage:**

- 25/25 modules ready for testing
- Each module: create, read, soft-delete, audit trail, <2s p99 latency

**Critical Paths:**

- CP-1: Laudo creation E2E (7 steps, target <16s)
- CP-2: NOTIVISA submission E2E (6 steps, target <30s)
- CP-3: CAPA closure E2E (6 steps, target <7s)
- CP-4: Portal patient download E2E (6 steps, target <10s)
- CP-5: Audit trail integrity (100% sampling of regulatory entries)

**Execution checklist:**

- Pre-smoke (day before): seed staging, baseline metrics
- Execution: module CRUD (2h) + critical paths (2h) + report (1h)
- Artifact: test-results.xml (JUnit) + SMOKE_TEST_REPORT.md

**Owner:** QA lead

---

### 3. **load-test-phase-14.sh** (Load Test Harness)

**Location:** `scripts/load-test-phase-14.sh`

Executable Bash script for 100-user concurrent load test:

**Features:**

- Artillery.io framework (Node.js, extensible)
- 5-minute ramp-up + 15-minute sustained load
- 5 weighted scenarios (30% CIQ, 20% laudo, 20% portal, 15% NOTIVISA, 15% audit)
- Acceptance criteria: P99 <2.5s, error rate <1%, no cascading failures

**Usage:**

```bash
bash scripts/load-test-phase-14.sh [--staging|--production] [--dry-run]
```

**Output:**

- `test-results/load-test-TIMESTAMP/results.json` (raw metrics)
- `test-results/load-test-TIMESTAMP/LOAD_TEST_REPORT.md` (human-readable)
- `test-results/load-test-TIMESTAMP/cloud-logs.txt` (Cloud Logs excerpt)

**Owner:** Tech lead

---

### 4. **INCIDENT_RESPONSE_DECISION_TREE.md** (Incident Runbook)

**Location:** `docs/incident-response/INCIDENT_RESPONSE_DECISION_TREE.md`

Structured decision tree for diagnosing and resolving production incidents:

**Severity Levels:**

- **P1 (Critical):** System down >5 min, data loss risk
- **P2 (High):** Feature unavailable >15 min, 100+ users affected
- **P3 (Medium):** Degraded <50% success, <100 users
- **P4 (Low):** Cosmetic, workaround exists

**Error Type Diagnosis (8 paths):**

1. PermissionDenied (Firestore Rules)
2. UNAUTHENTICATED (Auth token)
3. 503 Service Unavailable (Quota exceeded)
4. TimeoutError (Function timeout)
5. ReferenceError (Missing dependency/secret)
6. Execution error in trigger (Firestore trigger)
7. Network error (Third-party down)
8. Out of memory (Memory leak)

**Recovery workflows:**

- Hotfix workflow (decision → deploy → monitor)
- Rollback workflow (decision → execute → verify)
- Post-mortem template

**Owner:** Ops engineer + Tech lead

---

### 5. **PRODUCTION_DEPLOY_CHECKLIST.md** (Deployment Runbook)

**Location:** `docs/deploy-playbooks/PRODUCTION_DEPLOY_CHECKLIST.md`

Step-by-step deployment procedure for v1.4 GA:

**Pre-Deployment (3 hours before):**

- [ ] Git hygiene (main branch clean, all CI pass)
- [ ] Build validation (tsc 0 errors, bundle <500KB)
- [ ] Test execution (738 unit tests, smoke tests, load test)
- [ ] Production readiness (secrets provisioned, indexes active)
- [ ] Stakeholder notification (email, Slack)

**Deployment Window (60 min):**

- **T+0:** Deploy Firestore Rules & Indexes (1 min)
- **T+1:** Deploy Cloud Functions (5 min)
- **T+6:** Invalidate hosting CDN (1 min)
- **T+7:** Deploy Hosting (3 min)
- **T+10:** Smoke test in production (5 min)
- **T+15–T+45:** Continuous monitoring (30 min)

**Post-Deployment Monitoring:**

- Every 10 min: error rate check, user-facing smoke test
- Thresholds: >10 errors/min → ROLLBACK, >5% 5xx → ROLLBACK
- Final sign-off: zero critical errors, metrics green

**Rollback Procedure:**

- Hosting: previous release (<2 min)
- Functions: checkout v1.3 + deploy (<5 min)
- Rules: checkout v1.3 + deploy (<2 min)

**Owner:** Ops engineer

---

## Supporting Documents

### Security & Compliance

**Location:** `docs/security-audit/`

1. **FIRESTORE_RULES_v1.4_AUDIT.md**
   - Rules syntax validation checklist
   - Module claims provisioning verification
   - Multi-tenant boundary testing
   - Signature validation for regulatory writes
   - Audit trail immutability checks
   - Patient portal access isolation (if live)

2. **CLOUD_FUNCTIONS_ZOD_VALIDATION_AUDIT.md**
   - Input schema coverage (Zod schemas for ~75 callables)
   - LGPD field validation (CPF, email, patient names)
   - Secrets injection verification (6 secrets audit)
   - Console.log sanitization (no PII logging)
   - Error message sanitization (no stack traces to client)

3. **SECRETS_MANAGEMENT_AUDIT.md**
   - Secret provisioning status (firebase functions:secrets:list)
   - Secret access audit (which functions use which secrets)
   - No hardcoded values in git history
   - Staging vs. production secrets separation
   - Rotation schedule (HMAC 30d, API keys 90d, NOTIVISA 60d)

4. **LGPD_DATA_RETENTION_AUDIT.md**
   - LGPD module live and functional
   - Data retention policy enforcement (soft-delete, 30-day window)
   - DPIA audit trail (immutable, append-only)
   - Consent tracking (initial consent, withdrawal, portal access)
   - Data transfer logs (recipient, date, purpose)

### Dependencies

**Location:** `docs/dependency-audit/`

1. **NPM_AUDIT_REPORT.md**
   - Full npm audit output (high-severity filter)
   - Package decision matrix (13 key dependencies)
   - Vulnerability assessment + mitigation

2. **FIREBASE_SDK_VERSION_REPORT.md**
   - Client SDK (firebase ^10.14.1) current version check
   - Admin SDK (firebase-admin ^13.8.0) compatibility
   - Deprecation warnings (papaparse, react-to-print)
   - Upgrade path for v11/v14 if needed

3. **DEPRECATED_PACKAGES_AUDIT.md**
   - EOL package identification
   - Risk assessment (low/medium/high)
   - Migration paths (if needed)

### Testing

**Location:** `test/smoke/` + `docs/smoke-tests/`

1. **SMOKE_TEST_REPORT.md** (generated post-test)
   - 125 test case results
   - Pass/fail summary
   - Latency percentiles (p50, p95, p99)
   - Error rate by module

2. **Test fixtures** (`test/smoke/fixtures/`)
   - `sampleData.ts` — pre-seeded test labs/users
   - `stageHelper.ts` — Cloud Logs fetching, error checking

### Staging & Load Testing

**Location:** `docs/staging-deployment/` + `test/load/`

1. **STAGING_DEPLOYMENT_REPORT.md** (generated post-deployment)
   - Rules + indexes deployment time
   - Functions deployment time + status
   - Hosting deployment time + bundle size
   - Smoke test results on staging
   - Cloud Logs analysis (0 errors expected)

2. **LOAD_TEST_REPORT.md** (generated by load-test script)
   - Concurrent users: 100
   - Ramp-up: 5 min, sustained: 15 min
   - Latency: P50/P95/P99
   - Error rate
   - Scenario breakdown (5 workflows)

### Playbooks

**Location:** `docs/deploy-playbooks/` + `docs/rollback-procedures/`

1. **PRODUCTION_DEPLOY_CHECKLIST.md** (primary deployment runbook)

2. **FIRESTORE_RULES_DEPLOYMENT_HOTFIX.md**
   - Rules-only hotfix procedure
   - Validation before + after
   - Rollback if needed

3. **FUNCTIONS_HOTFIX_PROCEDURE.md**
   - Single function hotfix
   - Testing + deployment
   - Monitoring thresholds

4. **SECRETS_ROTATION_PROCEDURE.md**
   - How to rotate HMAC key
   - How to rotate API keys
   - Timing (before deploy, after rotation)

5. **ROLLBACK_CHECKLIST.md** (detailed rollback steps)
   - Hosting rollback
   - Functions rollback
   - Rules rollback
   - Verification post-rollback
   - Communication template

### Incident Response

**Location:** `docs/incident-response/`

1. **INCIDENT_RESPONSE_DECISION_TREE.md** (primary incident runbook)
   - Quick triage (P1/P2/P3/P4 classification)
   - 8 error type decision trees
   - Hotfix vs. rollback decision
   - Escalation path

2. **INCIDENT_SEVERITY_LEVELS.md**
   - Definition of each severity
   - Response time SLA per level
   - Examples of incidents in each level

3. **Post-Incident Template**
   - Root cause analysis format
   - Action items + owners
   - Lessons learned section

---

## Execution Roadmap

### Day 1 (T-0): Pre-Flight & Planning

- [ ] Verify all artifacts created (8 core docs + support docs)
- [ ] Review Phase 14 detailed plan with team
- [ ] Assign owners: security, dependency, QA, ops, CTO
- [ ] Schedule sign-off meeting (T+3 days)

### Days 2–3 (T+1–T+2): Security & Dependency Audits

- [ ] **Parallel streams (can run simultaneously):**
  - Security engineer: Run firestore rules audit, functions validation, secrets check, LGPD verification
  - Tech lead: Run npm audit, Firebase SDK check, deprecated packages audit
  - Generate 4 security reports + 3 dependency reports

### Day 4 (T+3): Smoke Testing & Staging Dry-Run

- [ ] **Parallel streams:**
  - QA lead: Execute smoke test matrix (125 test cases) on staging
  - Ops engineer: Full staging deployment (rules → functions → hosting)
  - Rollback procedure validation (practice rollback on staging)
  - Generate smoke test report + staging deployment report

### Day 5 (T+4): Load Testing & Playbook Finalization

- [ ] Tech lead: Run load test (100 users, 15 min sustained)
  - Parse results, verify p99 <2.5s, error <1%
  - Generate load test report
- [ ] Ops engineer: Finalize deploy playbook
  - Update production checklist with actual project IDs, URLs, times
  - Create incident response team briefing slides
  - Verify all runbooks are accessible to ops team

### Day 6 (T+5): Review & Adjustment

- [ ] Team review all audit findings (4 security + 3 dependency reports)
- [ ] Risk assessment for any findings
- [ ] Adjust acceptance criteria if needed
- [ ] Final staging validation (repeat smoke + load if any changes)

### Day 7 (T+6): Sign-Off Meeting

- [ ] CTO + tech lead + QA + ops + external auditor (pre-alignment)
- [ ] Review all 8 core artifacts
- [ ] Verify: zero critical vulnerabilities, all tests pass, rollback validated
- [ ] APPROVE v1.4 for production deployment
- [ ] Schedule deployment window (typically within 24h of sign-off)

---

## Phase 14 Success Criteria

Upon **completion** of all 7 audit streams:

- ✅ **Security:** Zero critical vulnerabilities, all audit reports signed
- ✅ **Quality:** 100% smoke test pass (125/125), load test SLA met (p99 <2.5s)
- ✅ **Compliance:** DICQ ≥88%, RDC 978 critical articles 100%, auditor aligned
- ✅ **Reliability:** Rollback procedure tested & <30 min recovery time
- ✅ **Operations:** Deploy playbook finalized, incident response tree validated, SLAs defined
- ✅ **Sign-Off:** CTO + external auditor approved, ready for 2026-08-31 external audit

**Outcome:** v1.4 is **production-ready** and cleared for launch.

---

## Phase 14 Artifacts Checklist

**Core Documents (8):**

- [ ] `PHASE_14_DETAILED_PLAN.md` — Main specification (7 audit streams)
- [ ] `SMOKE_TEST_MATRIX.md` — Testing matrix (125 test cases)
- [ ] `load-test-phase-14.sh` — Load test harness (Artillery script)
- [ ] `INCIDENT_RESPONSE_DECISION_TREE.md` — Incident runbook (8 error types)
- [ ] `PRODUCTION_DEPLOY_CHECKLIST.md` — Deployment procedure (60 min window)
- [ ] `FIRESTORE_RULES_v1.4_AUDIT.md` — Rules validation checklist
- [ ] `CLOUD_FUNCTIONS_ZOD_VALIDATION_AUDIT.md` — Functions validation
- [ ] `SECRETS_MANAGEMENT_AUDIT.md` — Secrets audit checklist

**Support Documents (10+):**

- [ ] `NPM_AUDIT_REPORT.md` — Dependency audit
- [ ] `FIREBASE_SDK_VERSION_REPORT.md` — SDK versions
- [ ] `DEPRECATED_PACKAGES_AUDIT.md` — EOL packages
- [ ] `LGPD_DATA_RETENTION_AUDIT.md` — Privacy compliance
- [ ] `SMOKE_TEST_REPORT.md` (generated) — Test results
- [ ] `STAGING_DEPLOYMENT_REPORT.md` (generated) — Dry-run results
- [ ] `LOAD_TEST_REPORT.md` (generated) — Load test results
- [ ] `FIRESTORE_RULES_DEPLOYMENT_HOTFIX.md` — Hotfix runbook
- [ ] `FUNCTIONS_HOTFIX_PROCEDURE.md` — Hotfix runbook
- [ ] `SECRETS_ROTATION_PROCEDURE.md` — Rotation runbook
- [ ] `ROLLBACK_CHECKLIST.md` — Rollback procedure
- [ ] Plus 5+ additional incident response + playbook docs

**Test Fixtures & Scripts:**

- [ ] `test/smoke/modules/*.smoke.ts` (25 module tests)
- [ ] `test/smoke/critical-paths/*.smoke.ts` (5 integration tests)
- [ ] `test/smoke/fixtures/sampleData.ts`
- [ ] `scripts/load-test-phase-14.sh` (main + analysis scripts)
- [ ] `scripts/monitor-cloud-logs.sh` (monitoring)
- [ ] `scripts/preflight-secrets-check.sh` (secrets validation)

---

## Quick Links

**Documentation Hub:**

- All Phase 14 docs: `.planning/phases/14-pre-launch-security-stability/`
- Security audits: `docs/security-audit/`
- Dependency audits: `docs/dependency-audit/`
- Smoke tests: `docs/smoke-tests/` + `test/smoke/`
- Load testing: `test/load/` + output in `test-results/`
- Deployment: `docs/deploy-playbooks/`
- Incident response: `docs/incident-response/`
- Rollback: `docs/rollback-procedures/`

**Related Compliance:**

- v1.3 Archive: `.planning/milestones/v1.3-ARCHIVE.md`
- v1.4 Kickoff: `.planning/milestones/v1.4-KICKOFF-SUMMARY.md`
- DICQ coverage: `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md`
- RDC 978 mapping: `.planning/milestones/v1.4-RDC-978-COMPLIANCE-MATRIX.md`
- ADR-0017 (HMAC): `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md`
- ADR-0018 (Deploy gate): `docs/adr/ADR-0018-deploy-gate-secret-status-check.md`

---

## Sign-Off

**Phase 14 Plan Created:** 2026-05-07

**Prepared by:** Claude Code (Agent)  
**For:** CTO / Tech Lead / QA / Ops Team

**Next step:** Review Phase 14 detailed plan + schedule kickoff meeting for execution start.

---

**Document version:** 1.0  
**Last updated:** 2026-05-07  
**Status:** COMPLETE — Ready for Phase 14 execution
