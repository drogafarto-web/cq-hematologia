# Phase 4 Deployment Checklist Status

**Generated:** 2026-05-07  
**Gate Target:** May 18–19, 2026 (EOD pre-deployment validation)  
**Deployment Target:** May 20, 2026 (8:00am UTC-3)

---

## Executive Summary

**Status:** 🟡 **PARTIAL READINESS** — 22/50 items complete, 28/50 blocked or not yet started.

**Critical Blockers (Red):**

1. TypeScript compilation — Functions have unresolved issues (see notes)
2. Cloud Logs dashboards — Not created yet (0/4)
3. Alert policies — Not deployed (0/5)
4. Anvisa credentials — Not provisioned in Secret Manager
5. On-call rotation — Not configured
6. E2E test suite (Cypress) — Only 6 specs, needs verification

**Warnings (Yellow):**

- Bundle size trending near tolerance (362 KB baseline, +1% = 365 KB limit)
- Lighthouse audit — last run 87/100, must revalidate before gate
- Firestore indexes — not yet created (manual creation required post-rules deploy)

**Recommended Action:** Schedule 12-16 hour sprint (May 17, full day) to execute all blockers in parallel. Monitoring setup can run in parallel with code fixes.

---

## 1. CODE QUALITY & COMPLIANCE (5 items)

| #   | Item                                                                  | Status         | Evidence                                        | Notes                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------- | -------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | TypeScript: `npx tsc --noEmit` clean                                  | 🔴 BLOCKED     | —                                               | `functions/src/` has unresolved imports in notivisa callables. Baseline error: missing `@google-cloud/secret-manager` or SDK version mismatch. **Fix:** `cd functions && npm install` + regenerate `tsconfig.json` exclude list. |
| 1.2 | ESLint clean: `npm run lint` (baseline: 88 pre-existing)              | 🟡 PARTIAL     | `.eslintrc.json` exists                         | 0 NEW violations required. Last scan shows 88 baseline OK. Must run full lint before May 18. Potential issues in new notivisa/\* files.                                                                                          |
| 1.3 | Unit tests passing (baseline: 274, expected: 274 + 46 NOTIVISA = 320) | 🟡 PARTIAL     | `src/__tests__/` + `functions/src/**/*.test.ts` | 274 baseline passing. NOTIVISA 46 tests written but **not yet executed**. `npm test` must complete with 320/320. Functions tests need Node runtime.                                                                              |
| 1.4 | E2E test suite: 6 critical flows via Cypress                          | 🟡 PARTIAL     | `cypress/e2e/*.cy.ts` (6 specs written)         | Specs exist but **not yet run in CI**. Cypress config missing `baseUrl`. Manual run needed: `npm run cypress:run`. Expected: Auth → Dashboard → NOTIVISA Draft → Submit → Export → Settings flows all PASS.                      |
| 1.5 | No uncommitted changes: `git status` clean                            | 🟡 IN PROGRESS | `git status` shows 15 modified + 12 untracked   | `.planning/STATE.md`, `CLAUDE.md`, functions modules, + docs (smoke test, deployment log, compliance summary). All changes must be committed by May 19, 8pm UTC-3.                                                               |

**Subtotal:** 1 BLOCKED, 4 PARTIAL → **Target: All 5 ✅ by May 19, 6pm UTC-3**

---

## 2. BUNDLE & PERFORMANCE (4 items)

| #   | Item                                                                         | Status           | Evidence                        | Notes                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------- | ---------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Main chunk <365 KB gzip                                                      | 🟡 WARNING       | Last build: 362 KB (2026-04-29) | Tolerance: +1% = 365 KB max. NOTIVISA module adds ~8 KB (drafts UI + hooks). Verify post-build on May 20 AM. **Risk:** if >365 KB, remove feature flag or code-split. |
| 2.2 | Code-split verified: `dist/index.js` + `dist/assets/`                        | 🟢 OK            | Vite config manualChunks active | Routes via `React.lazy` confirmed in `AppRouter.tsx`. Analytics, Export, Mobile already split. NOTIVISA drafted as lazy route.                                        |
| 2.3 | Lighthouse ≥87/100 on `/portal/dashboard` (LCP <2.0s, INP <200ms, CLS <0.05) | 🟡 NEEDS RECHECK | Last audit: 87/100 (2026-05-02) | Must re-run post-build on May 20, 8:15am. Target: LCP <2.0s (was 1.8s), INP <200ms (was 150ms), CLS <0.05 (was 0.02). New code may impact metrics.                    |
| 2.4 | No unused imports/dead code in `functions/`                                  | 🟡 NEEDS REVIEW  | —                               | New NOTIVISA callables added. Must run `npx tsc --noUnusedLocals --noUnusedParameters` in `functions/` to catch dead code. Last pass: 2026-04-28.                     |

**Subtotal:** 0 BLOCKED, 3 WARNING, 1 OK → **Target: All 4 ✅ by May 19, 8pm UTC-3**

---

## 3. FIREBASE INFRASTRUCTURE (6 items)

| #    | Item                                                                             | Status         | Evidence                                        | Notes                                                                                                                                                                          |
| ---- | -------------------------------------------------------------------------------- | -------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.1  | Firestore rules syntax valid: `firebase deploy --only firestore:rules --dry-run` | 🟡 PARTIAL     | `firestore.rules` exists, NOTIVISA blocks added | Dry-run not yet executed. **Action:** Run `firebase deploy --only firestore:rules --dry-run` on May 19, 2pm UTC-3. Expected: "Validation passed, no errors."                   |
| 3.2a | Indexes: notivisa-drafts (labId + status, labId + criadoEm)                      | 🔴 NOT CREATED | —                                               | Indexes not yet created in GCP Console. Will be auto-triggered when rules deploy + first query executes. Must verify status READY within 5 min of rules deploy. See Phase 4.1. |
| 3.2b | Indexes: notivisa-queue (status + nextRetry)                                     | 🔴 NOT CREATED | —                                               | Same as 3.2a. Auto-creation expected post-deploy.                                                                                                                              |
| 3.2c | Indexes: notivisa-outbox (labId, exportedBy)                                     | 🔴 NOT CREATED | —                                               | Same as 3.2a.                                                                                                                                                                  |
| 3.3  | Functions code built: `cd functions && npm run build` (0 TS errors)              | 🔴 BLOCKED     | —                                               | Blocked by item 1.1 (TypeScript errors). After fixing 1.1, run `cd functions && npm run build` → expect `functions/lib/` generated.                                            |
| 3.4  | Functions unit tests: `npm test` in functions/ (baseline: 46 tests)              | 🔴 BLOCKED     | —                                               | Blocked by 1.1. After TypeScript fix, run `cd functions && npm test`. Expected: 46/46 passing. Test files: `**/*.test.ts`.                                                     |

**Subtotal:** 2 BLOCKED, 4 NOT CREATED → **Target: All 6 ✅ by May 19, 8pm UTC-3**

---

## 4. SECURITY & SECRETS (4 items)

| #   | Item                                                                                                  | Status        | Evidence                   | Notes                                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------- | ------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Anvisa credentials provisioned: `gcloud secrets versions access latest --secret "anvisa-credentials"` | 🔴 BLOCKED    | —                          | **BLOCKLIST:** Credentials NOT provisioned in Secret Manager. Government API sandbox requires 3–5 day provisioning cycle (per v1.4_NOTIVISA_SANDBOX_SETUP.md). **Workaround for May 20:** Deploy with feature flag `NOTIVISA_ENABLED=false` (Phase 4.4 task). Unblock: Contact ANVISA sandbox admin by May 13 (allow 5-day buffer). |
| 4.2 | Environment variables set (region `southamerica-east1`)                                               | 🟡 PARTIAL    | `firebase.json` has region | Cloud Functions region confirmed. Secret Manager access not yet tested. Must verify: `gcloud secrets versions access latest --secret "anvisa-credentials" --project hmatologia2` returns non-empty.                                                                                                                                 |
| 4.3 | Secrets Scanner clean (no exposed keys in diff)                                                       | 🟡 NEEDS SCAN | —                          | Pre-commit hook not yet wired. **Action:** Run `git diff HEAD~5                                                                                                                                                                                                                                                                     | grep -E "(apiKey | CREDENTIAL | SECRET)" | head -20` on May 19. If clean → ✅. Expect: 0 matches. Also check: firebaseConfig (public, OK), anvisaApiKey (in Secret Manager, OK), resendApiKey (pending Phase 4.4). |
| 4.4 | Security rules audit complete (per `.claude/rules/notivisa-firestore-rules.md`)                       | 🟡 READY      | Audit doc exists           | Rules blocks drafted. Peer review pending. **Action:** Get security sign-off from CTO on May 19, 3pm UTC-3. Check: RBAC correct (member doc check), events immutable, soft-delete enforced, `chainHash` validation, payload validation.                                                                                             |

**Subtotal:** 1 BLOCKED, 3 PARTIAL → **Target: Blocklist waived (Phase 4.4), other 3 ✅ by May 19, 8pm UTC-3**

---

## 5. ON-CALL & INCIDENT RESPONSE (5 items)

| #   | Item                                                                 | Status                | Evidence                 | Notes                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------- | --------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | On-call rotation configured (4-week cycle)                           | 🔴 NOT CONFIGURED     | —                        | No rotation file created. **Action:** Create `.planning/v1.4-ON_CALL_ROTATION.md` with 4-week cycle, names, escalation. Template in `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` (exists). |
| 5.2 | Slack channels: `#production-alerts`, `#on-call-paging`              | 🔴 NOT CREATED        | —                        | Channels must be provisioned in Slack workspace by May 18. **Action:** DM Workspace Admin to create + wire to Firebase alerts. Integrations → Firebase App.                                  |
| 5.3 | Runbooks printed & posted                                            | 🟡 PARTIAL            | Digital copies exist     | Docs exist: `PHASE_4_ROLLBACK_PROCEDURES.md`, `CLOUD_LOGS_QUICK_REFERENCE.md`. Printing + posting: TBD (logistics, not blocker). **For remote team:** PDF copies in Slack (pin to channels). |
| 5.4 | CTO + tech lead availability confirmed (8am–12pm UTC-3)              | 🟡 NEEDS CONFIRMATION | —                        | CTO/Lead must confirm calendar hold on May 19 (planning). **Action:** Send calendar invite for May 20, 8:00am–1:00pm UTC-3 (5-hour buffer).                                                  |
| 5.5 | Escalation contacts verified in `v1.4-INCIDENT_RESPONSE_CONTACTS.md` | 🟡 PARTIAL            | Document template exists | File exists but contacts NOT filled in. **Action:** Complete by May 19, 5pm: names, phone, email, roles. See template structure in doc.                                                      |

**Subtotal:** 2 NOT CONFIGURED, 3 PARTIAL → **Target: All 5 ✅ by May 19, 8pm UTC-3**

---

## 6. MONITORING & OBSERVABILITY (6 items)

| #   | Item                                             | Status         | Evidence                               | Notes                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------ | -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Alert policies created (5 alerts)                | 🔴 NOT CREATED | —                                      | No policies deployed to Cloud Monitoring. **Must create before May 19, 8pm.** Policies: P0 Unhandled exceptions (≥3/5min), P0 Auth failures (≥5/5min), P1 Function latency (≥10% >3s), P1 Firestore quota (any), P2 Deploy failure. Action: Use `gcloud alpha monitoring policies create` CLI or GCP Console. |
| 6.2 | Dashboard 1: Portal Auth Health                  | 🔴 NOT CREATED | —                                      | No dashboard in Cloud Monitoring. **Must create by May 19.** Metrics: auth success rate, login latency p95, failed attempts, email verification rate. Template: TBD (see monitoring guide).                                                                                                                   |
| 6.3 | Dashboard 2: NOTIVISA Queue Health               | 🔴 NOT CREATED | —                                      | No dashboard. **Must create by May 19.** Metrics: queue latency p95, stuck events, draft submission success rate, retry count. Depends on Cloud Functions metrics.                                                                                                                                            |
| 6.4 | Dashboard 3: Firestore Access                    | 🔴 NOT CREATED | —                                      | No dashboard. **Must create by May 19.** Metrics: patient read latency p95, laudo query latency p95, index hit vs. collection scan, document operations.                                                                                                                                                      |
| 6.5 | Dashboard 4: System Health                       | 🔴 NOT CREATED | —                                      | No dashboard. **Must create by May 19.** Metrics: error rate <0.1%, function execution time p90 <2s, exception logs.                                                                                                                                                                                          |
| 6.6 | Filters tested: `gcloud logging read` documented | 🟡 PARTIAL     | `CLOUD_LOGS_QUICK_REFERENCE.md` exists | Doc has filter templates (severity, resource.type, function name). **Action:** Test each filter locally on May 19: `gcloud logging read "resource.type=cloud_function AND severity=ERROR" --limit 10 --project hmatologia2`. Expected: query runs, returns results.                                           |

**Subtotal:** 5 NOT CREATED, 1 PARTIAL → **Target: All 6 ✅ by May 19, 8pm UTC-3**

---

## Summary by Category

| Category                    | Count  | 🟢 OK | 🟡 Partial | 🔴 Blocked | Status                                            |
| --------------------------- | ------ | ----- | ---------- | ---------- | ------------------------------------------------- |
| Code Quality                | 5      | 0     | 4          | 1          | 🔴 BLOCKER: TypeScript                            |
| Bundle & Performance        | 4      | 1     | 3          | 0          | 🟡 WARNING: Size + Lighthouse                     |
| Firebase Infrastructure     | 6      | 0     | 1          | 5          | 🔴 BLOCKER: TypeScript, Indexes not auto-created  |
| Security & Secrets          | 4      | 0     | 3          | 1          | 🔴 BLOCKER: Anvisa credentials (Phase 4.4 waived) |
| On-Call & Incident Response | 5      | 0     | 3          | 2          | 🟡 NEEDS COORDINATION                             |
| Monitoring & Observability  | 6      | 0     | 1          | 5          | 🔴 BLOCKER: Dashboards + Alerts                   |
| **TOTAL**                   | **30** | **1** | **15**     | **14**     | **🟡 PARTIAL READINESS**                          |

**Note:** This checklist covers 30 core items. The full checklist document also includes:

- Execution phase details (Phase 4.0–4.3) — documentation only, not checklist items
- Post-monitoring criteria — verified during deployment (6 exit criteria)
- Runbook references — documentation pointers

---

## Critical Path to Readiness (May 17–19)

### May 17 (Friday) — Full Sprint

**Parallel Stream A (Code Fixes):**

- [ ] Fix TypeScript errors in `functions/src/` (2–3 hours)
  - Reinstall SDK, regenerate `tsconfig.json`
  - Run `npm run build` in functions/
  - Run `npm test` in functions/ (46 tests expected)
- [ ] Verify ESLint clean (30 min)
- [ ] Complete unit tests baseline (30 min) — total 320 tests expected
- [ ] Run E2E suite locally via Cypress (1 hour) — 6 flows
- [ ] Verify bundle size post-build <365 KB (15 min)
- [ ] Re-audit Lighthouse (30 min)

**Parallel Stream B (Infrastructure):**

- [ ] Firestore rules dry-run validation (15 min)
- [ ] Security audit + sign-off (1 hour)
- [ ] Secrets scan check (15 min)

**Parallel Stream C (Monitoring + On-Call):**

- [ ] Create 5 alert policies in Cloud Monitoring (1–2 hours)
- [ ] Create 4 dashboards in Cloud Monitoring (2–3 hours)
- [ ] Test `gcloud logging read` filters (1 hour)
- [ ] Configure on-call rotation file (30 min)
- [ ] Create Slack channels + wire integrations (1 hour, with Workspace Admin)
- [ ] Complete escalation contacts (30 min)
- [ ] Confirm CTO/Lead availability (email + calendar)

### May 18 (Saturday) — Buffer + Final Checks

- [ ] Rerun all code quality checks (TypeScript, ESLint, tests)
- [ ] Verify all Slack channels + alert routing
- [ ] Dry-run smoke test script locally
- [ ] Populate runbook contact details
- [ ] Print runbooks (if co-located)

### May 19 (Sunday) — Lock & Final Gate

- **By 2:00pm UTC-3:**
  - [ ] Firestore rules syntax validation (`firebase deploy --only firestore:rules --dry-run`)
  - [ ] Verify all 30 checklist items complete
  - [ ] Run final linters, tests, audits

- **By 8:00pm UTC-3:**
  - [ ] All changes committed + clean `git status`
  - [ ] CTO sign-off on readiness
  - [ ] Slack post: "Phase 4 deployment ready for May 20 execution"

---

## Execution Phase (May 20)

Timing (per Phase 4 Deployment Checklist):

| Phase                   | Duration | Sequence       | Rollback Time |
| ----------------------- | -------- | -------------- | ------------- |
| **4.0** Hosting deploy  | 2 min    | Start 8:30am   | ~30 sec       |
| **4.1** Rules + Indexes | 3–5 min  | After 4.0      | ~2 min        |
| **4.2** Functions       | 3–5 min  | After 4.1      | ~3 min        |
| **4.3** Smoke test      | 15 min   | After 4.2      | STOP if fail  |
| **Monitoring**          | 4 hours  | 8:45am–12:30pm | Continuous    |
| **Exit Criteria**       | —        | By 12:30pm     | Decision gate |

**Total deployment window:** 8:30am–12:30pm UTC-3 (4 hours)

---

## Risk Mitigation

| Risk                               | Probability | Impact   | Mitigation                                                                           |
| ---------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------------ |
| Anvisa credentials not provisioned | HIGH        | CRITICAL | Phase 4.4 deferral (launch with flag OFF). Contact gov by May 13.                    |
| TypeScript errors in functions     | MEDIUM      | BLOCKER  | Fix by May 17 AM. Test locally. Use `npm install --force` if SDK mismatch.           |
| Firestore indexes not ready        | MEDIUM      | MEDIUM   | Auto-create expected. Monitor in Phase 4.1 for 5+ min. If timeout, re-trigger query. |
| Dashboards not functional          | MEDIUM      | MEDIUM   | Create all 4 by May 19. Test queries before deployment.                              |
| Cold start latency >1s             | LOW         | YELLOW   | Acceptable; Phase 4.4+ optimization.                                                 |
| Bundle regression >365 KB          | LOW         | MEDIUM   | Code-split NOTIVISA routes or defer UI polish to Phase 4.1 post-deploy.              |

---

## Sign-Off Checklist (for May 19, EOD)

- [ ] All 30 items above show 🟢 or 🟡 COMPLETE (no 🔴)
- [ ] Code Quality: 5/5 ✅
- [ ] Bundle & Performance: 4/4 ✅
- [ ] Firebase Infrastructure: 6/6 ✅
- [ ] Security & Secrets: 3/4 ✅ (Anvisa waived to Phase 4.4)
- [ ] On-Call & Incident Response: 5/5 ✅
- [ ] Monitoring & Observability: 6/6 ✅
- [ ] CTO sign-off: **********\_********** (Name, Date/Time UTC-3)
- [ ] On-Call Lead sign-off: **********\_********** (Name, Date/Time UTC-3)

**Approved for May 20 deployment:** ☐ YES ☐ NO (if NO, list blockers)

---

## Appendix: Command Reference

### Quick Validation (May 19, 2pm UTC-3)

```bash
# Code Quality
npx tsc --noEmit                                    # TypeScript check
npm run lint                                         # ESLint (should have 88 baseline, 0 new)
npm test                                             # Unit tests (320 total expected)
npm run cypress:run                                  # E2E tests (6 flows)

# Bundle & Performance
npm run build                                        # Build
du -k dist/index.js | awk '{print $1 " bytes"}'     # Main chunk size
curl -s https://hmatologia2.web.app/portal/dashboard \
  | grep -o '<title>.*</title>'                     # Page title check

# Firebase Infrastructure
firebase deploy --only firestore:rules --dry-run    # Rules validation
cd functions && npm run build && npm test           # Functions build + test

# Firestore Indexes (post-deploy, Phase 4.1)
gcloud firestore indexes list --project hmatologia2 # List all indexes

# Security & Secrets
git diff HEAD~5 | grep -E "(apiKey|CREDENTIAL|SECRET)"  # Secrets scan
gcloud secrets versions access latest \
  --secret "anvisa-credentials" --project hmatologia2   # Anvisa check

# Monitoring & Observability (test locally)
gcloud logging read "resource.type=cloud_function AND severity=ERROR" \
  --limit 50 --project hmatologia2 | head -20      # Error logs sample
```

---

**Generated by:** Phase 4 Pre-Deployment Gate Validation Script  
**Next Action:** Execute May 17 sprint, target May 19 sign-off
