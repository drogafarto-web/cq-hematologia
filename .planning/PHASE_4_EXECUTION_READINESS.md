---
document: PHASE_4_EXECUTION_READINESS
milestone: v1.4
date_generated: 2026-05-07
phase: 4
kickoff_target: 2026-05-20
deploy_target: 2026-06-02
status: READY FOR EXECUTION
---

# Phase 4 Execution Readiness — Complete Scope Analysis

**Generated:** 2026-05-07  
**Kickoff:** 2026-05-20 (13 days)  
**Deploy:** 2026-06-02 (26 days)  
**Duration:** 2.5 weeks execution, +0.5 week stabilization buffer  
**Overall Risk Level:** 3.5/10 (LOW)

---

## Section 1: Scope Breakdown

### Phase 4 Mission

Deliver **patient portal ecosystem** (email-link auth + laudo access) + **NOTIVISA sandbox integration** (regulatory queue processor) to satisfy RDC 978 Arts. 6, 167, 204 + LGPD Arts. 9, 18 + DICQ 4.3–4.4 audit trail requirements. Foundation for Phase 5 (critical value escalation) + Phase 8 (CAPA closure sign-off by auditor).

### Wave 1: Parallel Streams (May 20–Jun 1, 12 days)

| Stream | Task | Deliverables | Effort | Owner | Dependencies |
|--------|------|--------------|--------|-------|---|
| **A: Backend** | 04-01 Portal Auth | 3 callables (validateToken, downloadPDF, preferences) + Firestore Rules + JWT session | M | Stream A (Functions) | Phase 3 schema |
| **A: Backend** | 04-02 NOTIVISA Client | NotivisaClient class + Portaria 204 types + payload gen + audit service + 20+ tests | L | Stream A (Functions) | Anvisa API docs |
| **B: Frontend** | 04-01 Portal UI | 5 components (Auth, Layout, Laudos, Detail, Navbar) + dark theme + WCAG AA + Storybook | M | Stream B (Frontend) | 04-01 callables |
| **C: Infra** | 04-03 Queue Processor | onLaudoPublished trigger + processNotiVisaQueue cron + retry logic + webhook receiver | L | Stream A (Functions) | 04-01 + 04-02 complete |
| **D: QA** | 04-04 E2E Tests | 6 critical flows (portal auth, PDF download, logout, mobile, a11y, NOTIVISA) + smoke checklist | M | Stream D (QA) | 04-01/02/03 in staging |

### Wave 2: Integration & Validation (Jun 1–2, 2 days)

| Activity | Scope | Owner | Gate |
|----------|-------|-------|------|
| **Smoke Tests** | Execute 6 critical flows on staging, 0 P1 bugs | QA | All flows GREEN |
| **Cloud Logs Review** | 24h monitoring (0 ERROR, <5% warning rate) | DevOps | 0 critical entries |
| **Security Audit** | Code review (auth bypass, CPF spoofing, XSS) + Rules validation | Eng Lead | No P1 findings |
| **Performance Audit** | LCP <2.0s, INP <200ms, CLS <0.05, mobile 3G | DevOps | All metrics GREEN |
| **Production Sign-Off** | CTO approval (completeness, quality, compliance) | CTO | Signature |

### Not in Scope — Phase 4

- ✗ Real NOTIVISA API credentials (production deferred to Phase 5+)
- ✗ SMS escalation (Phase 5 critical value alerts)
- ✗ Patient feedback forms (Phase 7 portal paciente)
- ✗ External Anvisa audit meetings (Phase 11 auditor pre-alignment)
- ✗ Multi-language portal (v1.4 Portuguese-only)
- ✗ Advanced patient consent UI (Phase 5+ LGPD v1.1 patch)

---

## Section 2: Dependency Chain & Critical Path

### Critical Path Analysis

**Base critical path (sequential):**

```
Phase 3 Schema Live (May 7) ✅
    ↓
Portal Auth Callables + Rules (May 20–25) [04-01]
    ↓
Portal UI Components (May 25–Jun 1) [04-01 depends]
    ↓
Smoke Tests + Staging Validation (Jun 1–2)
    ↓
Production Deploy (Jun 2) 🎯
    ↓
Phase 5 Kickoff (Jun 9) [unblocked]
```

**Base duration:** 13 days (May 20 → Jun 2)  
**With stabilization buffer:** +3 days (Jun 2 → Jun 5)  
**Auditor handoff (Phase 11 kickoff):** Jun 1 (pre-announcement)

### Parallel Streams (Non-Blocking Dependencies)

```
NOTIVISA Backend (04-02: 2 FTE-weeks)
├── Can start: May 20 (independent of portal UI)
├── Blocks: 04-03 queue processor (May 25+)
└── Final validation: Jun 1 (integration tests)

Portal UI (04-01: 2 FTE-weeks)
├── Depends on: 04-01 callables (May 25)
├── Can start: May 22 (design system ready from Phase 3)
└── Final polish: May 31 (WCAG AA audit, dark theme)

Queue Processor (04-03: 2.5 FTE-weeks)
├── Depends on: 04-01 + 04-02 (May 27)
├── Can start: May 27 (parallel with UI polish)
└── Final validation: Jun 1 (integration tests)

E2E + QA (04-04: 2 FTE-weeks)
├── Depends on: All 04-01/02/03 in staging (May 30)
├── Can start: May 30 (early E2E framework)
└── Gates: Jun 1–2 (6 flows, Cloud Logs, readiness checklist)
```

### External Dependencies (Gov/Vendor)

| Dependency | Status | Impact | Mitigation |
|------------|--------|--------|-----------|
| **Anvisa NOTIVISA Sandbox API** | 🟡 Requested (May 7) | Mock API + sandbox credentials needed for integration testing | Contact Anvisa (3–5 day turnaround expected) before May 20; fallback: mock HTTP responses in tests |
| **Cloud Secret Manager** | ✅ Ready | NOTIVISA API key storage (ADR-0018) | Already deployed Phase 0; test secret rotation before Jun 1 |
| **Firebase Secrets Manager** | ✅ Ready | Environment variable provisioning | Use `functions:secrets:set` command; document in deployment checklist |
| **Cloud Scheduler** | ✅ Ready | Hourly NOTIVISA queue processor trigger | Create schedule via Firebase Console; test cron in emulator |
| **Cloud Logging** | ✅ Ready | 24h monitoring + alert policies | Already deployed Phase 3; create alert thresholds before Jun 1 |

---

## Section 3: Blockers & Mitigations

### Hard Blockers (Stop-Work if Not Resolved)

| Blocker | Severity | Trigger | Owner | Mitigation | Deadline |
|---------|----------|---------|-------|-----------|----------|
| **B-01: Anvisa credentials not provisioned** | 🔴 CRITICAL | No sandbox API access by May 27 | External (Anvisa) | Mock API responses in test suite; proceed with code-complete + "sandbox pending" status; allow 3-day delay to Jun 5 if gov API arrives late | May 27 |
| **B-02: Phase 3 schema not live** | 🔴 CRITICAL | Firestore collections (portal-configuracao, notivisa-outbox, laudos) missing | Eng Lead | Verify Phase 3 deployment (May 7) before May 15; if delayed, escalate to CTO immediately | May 15 |
| **B-03: TypeScript strict mode fails** | 🔴 CRITICAL | `npx tsc --noEmit` returns errors after Phase 4 code addition | Eng Lead | Weekly TSC check (every Mon/Wed/Fri); block merges if errors present; fix within 24h | Daily (CI gate) |

### Soft Blockers (Delay Acceptable, Mitigations Documented)

| Blocker | Severity | Impact | Mitigation | Deadline |
|---------|----------|--------|-----------|----------|
| **B-04: Firestore Rules indexes not created** | 🟡 MEDIUM | Query latency >2s (portal laudos list) | Create indexes manually on May 28; validate live by May 31; emulator tests in interim | May 31 |
| **B-05: Cloud Scheduler config missing** | 🟡 MEDIUM | NOTIVISA queue processor doesn't trigger hourly | Create schedule via Firebase Console (5 min task); deploy script + checklist | May 29 |
| **B-06: Email delivery (SendGrid) not verified** | 🟡 MEDIUM | Patient portal auth tokens don't arrive in inbox | Test email delivery in staging (May 20+); fallback: use Gmail SMTP for Phase 4 staging | May 25 |
| **B-07: Portal UI dark theme not approved** | 🟡 MEDIUM | Design rework required (2–3 days) if CTO rejects | Weekly design review (Tue 3pm BRT); get sign-off by May 29 EOD | May 29 |

### Unknown Risks (Requires Early Spiking)

| Risk | Probability | Impact | Discovery Method | Owner |
|------|-------------|--------|-----------------|-------|
| **R-01: Portal auth UI performance <2s LCP not met** | MEDIUM (4/10) | Lazy-load required, design delay | Load test (May 22): Lighthouse CI on staging, measure LCP on mobile 3G | Frontend |
| **R-02: NOTIVISA queue lag >5min** | LOW (2/10) | Queue backlog grows, notifications delayed | Simulate 100 events/hour (May 27); measure processing time; scale functions if needed | Backend |
| **R-03: Firestore Rules complexity causes bugs** | MEDIUM (3/10) | Patient cross-access leak or false-positive denials | Rules emulator tests (May 20+) + security code review; whiteboard threat model | Backend |
| **R-04: Email token TTL too short (24h)** | LOW (2/10) | Patients report "link expired" → support tickets | Monitor email analytics (May 25+); collect feedback from test users; adjust TTL to 7d if needed | Product |
| **R-05: PDF generation hangs on large laudo** | LOW (2/10) | Function timeout, PDF download fails | Test with 50+ results (May 25); set timeout to 30s; implement streaming if needed | Backend |

---

## Section 4: Pre-Kickoff Checklist (Due May 19, 5pm BRT)

**Gate:** All items ✅ before May 20 kickoff. CTO approval required.

### Code & Infrastructure

- [ ] **Phase 3 schema live** — Verify `portal-configuracao`, `notivisa-outbox`, `laudos`, `patientSessions` collections exist (check Firestore console)
- [ ] **TypeScript clean** — `npx tsc --noEmit` returns 0 errors (both web + functions)
- [ ] **Firestore Rules baseline** — Existing Rules from Phase 3 deployed, no syntax errors
- [ ] **Functions baseline** — Existing callables from Phase 3 compiling, 78/78 stubs in place
- [ ] **Firebase emulator ready** — `npm run test:firebase` runs locally without errors
- [ ] **Cloud Secrets configured** — `NOTIVISA_SANDBOX_URL`, `NOTIVISA_SANDBOX_TOKEN` (placeholder if Anvisa pending) stored in Secrets Manager
- [ ] **Cloud Scheduler ready** — Test scheduling API in Firebase Console (dry-run)

### Testing & Monitoring

- [ ] **Jest + Firestore Rules testing** — `npm test` + `npm run test:rules` run locally <60s
- [ ] **E2E framework scaffolded** — Cypress/Playwright configured, can run against emulator
- [ ] **Cloud Logs monitoring armed** — Log sink created, can query `resource.type=cloud_function` in Cloud Console
- [ ] **Alert policies drafted** — Thresholds for ERROR (threshold 1+), WARNING (threshold 5%), SLA miss (LCP >2.5s)
- [ ] **Smoke test template created** — Checklist outline in `/docs/PHASE4_SMOKE_TEST_CHECKLIST.md` (will be filled during execution)

### Documentation & Planning

- [ ] **Phase 4 plans finalized** — All 4 task plans (04-01, 04-02, 04-03, 04-04) reviewed + approved by CTO
- [ ] **Design system locked** — Portal colors, typography, spacing tokens confirmed (dark-first, world-class)
- [ ] **Deployment checklist drafted** — Sequence (Rules → Functions → Hosting) + rollback plan documented
- [ ] **On-call rotation set** — 4-week cycle assigned; escalation path to CTO confirmed
- [ ] **Auditor pre-alignment scheduled** — First weekly call booked for May 27 (post-Phase 4-01 complete)

### Security & Compliance

- [ ] **Secrets scan baseline** — `scripts/preflight-secrets-check.sh` runs green (Phase 0 from HMAC incident remediation)
- [ ] **Threat model reviewed** — STRIDE threats documented in 04-RESEARCH.md; mitigations assigned
- [ ] **LGPD privacy checklist** — CPF hashing, audit trail, data retention (7d tokens, 30d sessions, 5y audit logs) confirmed
- [ ] **RDC 978 mapping** — Articles 6, 167, 204 mapped to code modules (portal, notivisa, audit trail)
- [ ] **Pen-test scope confirmed** — Phase 10 consultant briefing (Jun 1+); scope limited to portals + LGPD

### Team Readiness

- [ ] **Teams assigned** — 4 streams (A:Backend, B:Frontend, C:Infra, D:QA) staffed, RACI clear
- [ ] **Communication cadence set** — Daily standups 10am BRT (async Slack if async-friendly), weekly reviews Mon 2pm, CTO office hours Thu 4pm
- [ ] **Runbook drafted** — "Queue stuck" scenario, "auth token not working" scenario, escalation flow documented
- [ ] **Training recorded** — Video walkthrough of Phase 3 schema + Phase 4 architecture (5 min, for onboarding)

**Checklist Owner:** Eng Lead  
**Sign-Off Required:** CTO + QA Lead + DevOps Lead  
**Sign-Off Deadline:** May 19, 5pm BRT  
**Escalation:** If any item 🔴, notify CTO immediately (do not proceed without approval)

---

## Section 5: Execution Allocation

### Stream A: Backend / Cloud Functions Engineer

**Duration:** 2.5 weeks (May 20 → Jun 2)  
**Effort:** 3.5 FTE-weeks  
**Tasks:** 04-01 (Portal auth callables) + 04-02 (NOTIVISA client) + 04-03 (Queue processor)

**Week 1 (May 20–26):**
- May 20–23: Implement 04-01 callables (validatePatientToken, downloadLaudoPDF, preferences) + Firestore Rules
- May 23–26: Unit tests (15+), verify Functions build + emulator tests, call Cloud Logs team for monitoring setup

**Week 2 (May 27–Jun 2):**
- May 27–30: Implement 04-02 (NotivisaClient, payload gen, audit service) + 04-03 (triggers, queue processor)
- May 31–Jun 2: Integration tests, fix issues from QA, support E2E execution, stabilization

**Deliverables:**
- 3 callables (auth, PDF, preferences)
- NotivisaClient class + Portaria 204 types
- 2 Cloud Function triggers (onLaudoPublished, processNotiVisaQueue)
- Firestore Rules (portal-configuracao, laudos, patientSessions, notivisa-outbox)
- 35+ unit tests (all passing)
- 0 TypeScript errors

**Communication:** Daily standup 10am BRT, weekly review Mon 2pm, CTO office hours Thu 4pm

### Stream B: Frontend / UI Engineer

**Duration:** 2.5 weeks (May 20 → Jun 2)  
**Effort:** 2.5 FTE-weeks  
**Tasks:** 04-01 (Portal UI components) + accessibility + dark theme

**Week 1 (May 20–26):**
- May 20–22: Design system finalization (colors, typography from phase 3)
- May 23–26: Implement 5 components (Auth, Layout, Laudos, Detail, Navbar/Footer) + styling

**Week 2 (May 27–Jun 2):**
- May 27–30: WCAG AA accessibility audit (Axe DevTools, contrast, keyboard nav)
- May 31–Jun 2: Dark theme polish, mobile responsive (375px–1024px), Storybook updates, E2E support

**Deliverables:**
- 5 portal components (0 TS errors)
- Dark-first design (world-class, no template feel)
- WCAG AA compliance (Axe: 0 violations)
- Mobile responsive (3 breakpoints tested)
- 8 component unit tests
- Storybook integration

**Communication:** Daily standup, design review Tue 3pm, CTO office hours Thu 4pm

### Stream C: DevOps / Infrastructure

**Duration:** 1.5 weeks (May 27 → Jun 2)  
**Effort:** 1.5 FTE-weeks  
**Tasks:** Cloud Scheduler, Cloud Logs monitoring, deployment infrastructure

**Week 1 (May 27–30):**
- May 27–28: Create Cloud Scheduler job (hourly processNotiVisaQueue), test in emulator
- May 29–30: Set up Cloud Logs sink, create alert policies (ERROR threshold, warning %, SLA)

**Week 2 (May 31–Jun 2):**
- May 31–Jun 1: Validate 24h log window (0 errors, <5% warnings)
- Jun 1–2: Deploy checklist execution, rollback plan verification, runbook testing

**Deliverables:**
- Cloud Scheduler job configured + tested
- Cloud Logs monitoring (sink + alerts)
- Deployment sequence script (Rules → Functions → Hosting)
- Rollback runbook documented
- 24h production monitoring window GREEN

**Communication:** Daily standup, weekly review Mon 2pm, CTO office hours

### Stream D: QA / Test Automation

**Duration:** 2 weeks (May 23 → Jun 2)  
**Effort:** 2 FTE-weeks  
**Tasks:** 04-04 (E2E tests) + smoke test execution + readiness checklist

**Week 1 (May 23–30):**
- May 23–26: E2E framework setup (Playwright/Cypress), test data seeding scripts
- May 27–30: Write E2E specs (6 critical flows: auth, PDF, logout, mobile, a11y, NOTIVISA queue)

**Week 2 (May 31–Jun 2):**
- May 31–Jun 1: Execute smoke tests on staging, document issues (P0/P1/P2)
- Jun 1–2: Retest fixes, sign-off checklist, collect metrics (LCP, INP, CLS, error rate)

**Deliverables:**
- E2E test suite (6 flows, 400+ LOC)
- Test data seeding scripts
- Smoke test checklist (executable, 15-point gate)
- Deployment readiness report (metrics + sign-off)
- 0 P0/P1 bugs at gate time

**Communication:** Daily standup, weekly review, readiness sync Jun 1 morning

---

## Section 6: Risk Register

### Risk Matrix (Probability × Impact)

| Risk | P (%) | I (1–10) | P×I | Mitigation | Owner | Monitor |
|------|-------|----------|-----|-----------|-------|---------|
| **R-401: Anvisa sandbox credentials delayed to May 27+** | MEDIUM (40%) | HIGH (8) | **3.2** | Mock API responses in tests; proceed code-complete; allow 3-day delay grace period (Jun 5 hard deadline) | Ext (Anvisa) | May 23 checkpoint |
| **R-402: Portal auth UI performance <2s LCP not met** | MEDIUM (35%) | MEDIUM (5) | **1.75** | Load test on May 22 (Lighthouse CI); lazy-load patient data; implement pagination (500 results per page max); fallback: extend LCP budget to 2.5s if unavoidable | Frontend | Daily during week 2 |
| **R-403: NOTIVISA queue lag exceeds 5min SLA** | LOW (20%) | MEDIUM (6) | **1.2** | Load test 100 events/hour on May 27; monitor function execution time (target <2s); scale concurrency if needed; alert at 3min threshold | Backend | Jun 1 staging gate |
| **R-404: Firestore Rules complexity causes cross-tenant leak** | VERY LOW (10%) | CRITICAL (9) | **0.9** | Threat model whiteboard (May 20); code review rules before May 25; Rules emulator tests (5+ scenarios); security audit sign-off | Backend | May 24 code review |
| **R-405: Cloud Logs alert policy misconfigured (false alarms)** | LOW (25%) | LOW (3) | **0.75** | Draft alerts by May 26; test against mock error scenarios; iterate baseline thresholds (May 29–30); tune before Jun 1 | DevOps | May 29–30 tuning |
| **R-406: Email delivery (SendGrid) unreliable (high bounce rate)** | LOW (15%) | MEDIUM (4) | **0.6** | Test email in staging (May 20+); monitor bounce/open rates; fallback: Gmail SMTP for Phase 4 staging only; investigate before Phase 5 | Infra | May 25 test |
| **R-407: PDF generation timeout on large laudo (50+ results)** | LOW (20%) | MEDIUM (5) | **1.0** | Test payload size limits (May 25): max 100 results, expect <2s generation; set function timeout 30s; implement streaming if >5 timeouts | Backend | May 26 test |
| **R-408: Patient session JWT token validation bug (infinite loop)** | VERY LOW (5%) | CRITICAL (8) | **0.4** | Unit tests for token decode (May 21); signature validation test; mock token rotation scenario | Backend | May 22 unit test |
| **R-409: Mobile a11y issues (touch targets <44px)** | LOW (25%) | LOW (3) | **0.75** | Audit on May 28 (iOS DevTools, Chrome DevTools); measure button sizes; adjust padding if needed; test on real devices (iPhone, Pixel) | Frontend | May 28–29 audit |
| **R-410: Auditor feedback on Phase 4 design requires rework** | MEDIUM (30%) | MEDIUM (5) | **1.5** | Weekly auditor pre-alignment (May 27+); get early feedback on portal auth approach; iterate design before Jun 1 gate | CTO | Weekly Mon 10am |

**Overall Risk Score:** (3.2 + 1.75 + 1.2 + 0.9 + 0.75 + 0.6 + 1.0 + 0.4 + 0.75 + 1.5) / 10 = **1.08/5.0** = **4.3/10 (LOW-MEDIUM)**

### Risk Response Plan

| Risk | Trigger | Escalation | Response |
|------|---------|-----------|----------|
| **R-401** | No sandbox API by May 27 | Eng Lead → CTO | Use mock API; extend deploy by 3 days; contact Anvisa + legal |
| **R-402** | LCP >2.5s on May 23 load test | Frontend → Eng Lead | Implement pagination, lazy-load, code-split; retest May 29 |
| **R-403** | Queue latency >5min on May 27 | Backend → CTO | Scale Cloud Function memory/CPU; increase concurrency; investigate API bottleneck |
| **R-404** | Rules emulator test fails on May 23 | Backend → CTO | Security audit immediately; whiteboard STRIDE; fix + retest within 24h; block deploy if unfixed |
| **R-405** | Alert spam (>10 false positives/day) | DevOps → CTO | Adjust thresholds; disable false alarms; re-baseline May 30 |
| **R-406** | Bounce rate >10% on May 25 | Infra → CTO | Switch to Gmail SMTP fallback; investigate SendGrid config; test delivery path May 26 |
| **R-407** | Timeout >2s for 50+ results | Backend → CTO | Implement streaming PDF; chunked rendering; retest May 30 |
| **R-408** | JWT decode fails in unit test | Backend (fix immediately) | Revert change; implement constant-time comparison; retest + merge |
| **R-409** | Touch target <44px on audit | Frontend (fix immediately) | Increase padding/margin; retest all breakpoints; validate before Jun 1 |
| **R-410** | Auditor requests design change | CTO → Product | Evaluate scope; if in-scope, implement in Phase 4 or defer to Phase 5; communicate decision by May 28 |

---

## Section 7: Deployment Sequence & Rollback

### Deployment Order (Sequential, No Parallelization)

**Step 1: Firestore Rules (0-2 min downtime)**
```bash
firebase deploy --only firestore:rules --project hmatologia2
# Validate: firebase rules:test --project hmatologia2 (5+ test cases pass)
```
- Includes: portal-configuracao read rules, laudos patient filtering, patientSessions, notivisa-outbox immutability
- Rollback: Previous version stored in Git; `git revert` + redeploy if syntax error

**Step 2: Cloud Functions (2–5 min uptime, staged rollout)**
```bash
# Step 2a: Deploy callables only (validatePatientToken, downloadLaudoPDF, updatePreferences)
firebase deploy --only functions:validatePatientToken,functions:downloadLaudoPDF,functions:updatePatientPreferences --project hmatologia2

# Step 2b: Deploy triggers (onLaudoPublished)
firebase deploy --only functions:onLaudoPublished --project hmatologia2

# Step 2c: Deploy queue processor (processNotiVisaQueue cron)
firebase deploy --only functions:processNotiVisaQueue --project hmatologia2
firebase pubsub:topics:create notivisa-queue-processor --project hmatologia2 (if not exists)
firebase pubsub:subscriptions:create notivisa-queue-processor --topic=notivisa-queue-processor --project hmatologia2 (if not exists)

# Validate: 
gcloud functions list --filter="name:portal OR name:notivisa" --project hmatologia2 (all show status OK)
```
- Rollback: `gcloud functions delete validatePatientToken --project hmatologia2 --quiet` + previous version staged as backup

**Step 3: Cloud Scheduler (create/update job)**
```bash
gcloud scheduler jobs create pubsub notivisa-queue-processor-hourly \
  --location southamerica-east1 \
  --schedule "0 * * * *" \
  --topic notivisa-queue-processor-trigger \
  --message-body '{}' \
  --project hmatologia2

# Or update if exists:
gcloud scheduler jobs update pubsub notivisa-queue-processor-hourly \
  --schedule "0 * * * *" \
  --location southamerica-east1 \
  --project hmatologia2
```
- Rollback: `gcloud scheduler jobs delete notivisa-queue-processor-hourly --location southamerica-east1 --project hmatologia2`

**Step 4: Hosting (web frontend)**
```bash
npm run build
firebase deploy --only hosting --project hmatologia2
# Validate: https://hmatologia2.web.app/portal/test-lab/auth loads in <2s (Lighthouse)
```
- Rollback: `firebase hosting:disable --project hmatologia2` (reverts to previous version immediately); restore via Git if needed

### Deployment Checklist (Production)

**Pre-Deploy (Jun 2, 8am BRT):**
- [ ] All tests passing (npm test)
- [ ] TypeScript: 0 errors (`npx tsc --noEmit`)
- [ ] Cloud Logs baseline: 0 errors in staging past 24h
- [ ] Mobile responsive verified (375px/768px/1024px)
- [ ] WCAG AA audit signed off
- [ ] Dark theme approved by CTO
- [ ] Security code review passed
- [ ] Secrets configured (NOTIVISA_SANDBOX_TOKEN, HCQ_SESSION_SECRET)
- [ ] Smoke test checklist signed by QA
- [ ] Rollback plan reviewed + tested in staging
- [ ] On-call rotation active (4-week cycle)
- [ ] Auditor pre-alignment call scheduled (May 27)
- [ ] Communication: Team notified, customers (if applicable) briefed

**Deploy Steps (Jun 2, 9am–10am BRT):**
1. Rules deploy (9:00am) + validate (9:02am)
2. Callables deploy (9:05am) + health check (9:10am)
3. Triggers + scheduler deploy (9:15am) + validate jobs active (9:20am)
4. Hosting deploy (9:25am) + Lighthouse check (9:30am)
5. Post-deploy validation (9:30am–10am):
   - Cloud Logs: 0 errors
   - Functions: all green in Console
   - Portal: https://hmatologia2.web.app/portal/test-lab/auth loads, auth flow testable
   - E2E: 1-2 manual smoke tests (email token gen, laudo view, PDF download)

**Post-Deploy (Jun 2, 10am–6pm BRT):**
- [ ] Monitor Cloud Logs every 30min (first 4 hours)
- [ ] Alert on first ERROR → immediate investigation
- [ ] Customer support briefing (if applicable)
- [ ] Weekly auditor sync (May 27 call confirms Phase 4 approach)

### Rollback Plan

**If Critical Issue Found (Post-Deploy, During First 24h):**

1. **Identify issue** (alert fires, customer report, internal test)
2. **Assess severity:**
   - 🔴 P0: Authentication broken, CPF data leak, data loss → **IMMEDIATE ROLLBACK**
   - 🟠 P1: LCP >5s, queue processing hung, partial auth failures → **QUICK FIX or rollback within 1h**
   - 🟡 P2: Minor UI issue, non-critical error in logs → **Fix in follow-up release**

3. **Rollback procedure (if P0/P1 and fix unavailable):**
   ```bash
   # Hosting (fastest rollback)
   firebase hosting:disable --project hmatologia2
   # Brings previous version live within 30s
   
   # Functions (if callable broken)
   gcloud functions delete validatePatientToken --project hmatologia2 --quiet
   # Previous version (from Git) redeploy:
   git checkout main~1
   firebase deploy --only functions:validatePatientToken --project hmatologia2
   
   # Rules (if access control broken)
   git checkout main~1 firestore.rules
   firebase deploy --only firestore:rules --project hmatologia2
   
   # Scheduler (if cron broken)
   gcloud scheduler jobs delete notivisa-queue-processor-hourly --project hmatologia2 --location southamerica-east1
   ```

4. **Communicate:**
   - Slack: #incidents channel (post issue + timeline)
   - Auditor: notify if data/security related
   - Customers: status page update if user-facing
   - CTO: escalation + post-mortem scheduling

---

## Section 8: Testing & Quality Gates

### Test Coverage by Stream

| Stream | Unit Tests | Integration | E2E | Coverage | Gate |
|--------|-----------|-------------|-----|----------|------|
| **A: Backend (04-01/02/03)** | 35+ (callables, client, utils) | 8+ (rules, integration) | — | ≥90% | All green, 0 TS errors |
| **B: Frontend (04-01 UI)** | 8+ (components, hooks) | 4+ (integration with callables) | 6 flows | ≥80% | Axe 0 violations, mobile verified |
| **C: Infra (04-03)** | — | Cloud Scheduler + Cloud Logs | — | N/A | Cron triggers, alerts fire correctly |
| **D: QA (04-04)** | — | — | 6 flows (auth, PDF, logout, mobile, a11y, queue) | N/A | All flows GREEN, 0 P0/P1 bugs |

### Quality Gates (Pre-Deploy, All Must Be GREEN)

**Gate 1: Code Quality (May 31)**
- TypeScript: `npx tsc --noEmit` → 0 errors ✓
- Linting: `npm run lint` → baseline 88 pre-existing warnings (no new) ✓
- Build: `npm run build` (web) + `cd functions && npm run build` → no errors ✓

**Gate 2: Unit Tests (May 31)**
- `npm test` → 738+ baseline tests + 35+ new tests passing ✓
- Coverage: 90%+ on new code (callables, NotivisaClient, utils) ✓
- Cloud Logs during test run: 0 errors ✓

**Gate 3: Integration Tests (Jun 1, AM)**
- Firestore Rules emulator: 45+ test cases passing ✓
- Portal callables + Firestore interaction: all scenarios tested (happy path, errors, edge cases) ✓
- NOTIVISA client + payload generation: 12+ tests passing ✓
- Audit trail: sample 10 actions logged correctly (CPF never plaintext) ✓

**Gate 4: E2E Tests (Jun 1, PM)**
- Portal auth flow (email link → JWT → laudo list): PASS ✓
- Laudo detail + PDF download: PASS ✓
- Session logout + revocation: PASS ✓
- Mobile responsive (iPhone 12, Pixel 6, iPad): PASS ✓
- Keyboard navigation + screen reader: PASS ✓
- NOTIVISA queue integration (enqueue → process → deliver): PASS ✓

**Gate 5: Performance (Jun 1, PM)**
- LCP: <2.0s (desktop Lighthouse CI) ✓
- LCP: <2.5s (mobile Lighthouse CI) ✓
- INP: <200ms (form interactions) ✓
- CLS: <0.05 (no layout shift) ✓
- Mobile 3G throttle: Portal loads in <5s ✓

**Gate 6: Security (Jun 1, AM)**
- Code review: auth bypass, CPF spoofing, XSS checked ✓
- Firestore Rules: patient isolation verified (cross-CPF deny) ✓
- Secrets: API keys not in logs or code ✓
- Audit trail: CPF hashing verified, plaintext never written ✓

**Gate 7: Compliance (Jun 1, AM)**
- WCAG AA: Axe scan 0 violations ✓
- Dark theme: no template feel, approved by design ✓
- RDC 978: Arts. 6, 167, 204 mapped to code ✓
- LGPD: CPF hashing, audit trail, 5y retention documented ✓

**Gate 8: Deployment Readiness (Jun 1, PM–Jun 2, AM)**
- Deployment script tested in staging (Rules → Functions → Hosting) ✓
- Rollback plan reviewed + tested ✓
- Cloud Logs monitoring: sink + alerts active, baseline established ✓
- Runbook: team trained on "queue stuck" + "auth broken" scenarios ✓
- On-call: rotation assigned, escalation clear ✓
- Checklist: 15-point sign-off (CTO + QA + DevOps) ✓

**Gate Owners:**
- Code Quality: Eng Lead
- Unit Tests: Backend/Frontend engineers
- Integration Tests: QA lead
- E2E: QA lead
- Performance: DevOps
- Security: Eng Lead (+ external if budget allows)
- Compliance: CTO
- Deployment Readiness: DevOps

---

## Section 9: Post-Deploy Monitoring (24h Window)

### Cloud Logs Baseline Thresholds

| Metric | Threshold | Alert | Owner | Response |
|--------|-----------|-------|-------|----------|
| **ERROR entries** | 0 (first 24h) | Immediate (1+) | DevOps | Investigate + gather logs + escalate if P0 |
| **WARNING entries** | <5% of total | >5% triggers alert | DevOps | Review + determine if expected (false positive) + tune threshold |
| **Function timeout** | <1% of executions | >1% triggers check | Backend | Investigate slow functions; scale if needed |
| **NOTIVISA queue lag** | <3min (median) | >5min triggers alert | Backend | Check API latency; assess retry effectiveness |
| **Portal auth latency** | <500ms (p95) | >1s triggers alert | Frontend | Profile; identify bottleneck (Rules? Firestore? Function cold start?) |
| **PDF generation time** | <2s (median) | >5s triggers check | Backend | Check laudo size; cache analysis |

### 24h Monitoring Checklist

**Hour 0–4 (Deploy + First Traffic):**
- Monitor Cloud Logs every 30min
- Test portal auth flow manually (token gen, email delivery, auth page load)
- Verify NOTIVISA queue processor triggered (check Cloud Scheduler last execution)
- Check for any P0 alerts (immediate escalation)

**Hour 4–12 (Overnight, Automated):**
- Cloud Logs alert policy watching (0 errors threshold)
- Automated health checks: ping `/portal/health` endpoint every 5min
- Log aggregation: capture error patterns for post-mortem

**Hour 12–24 (Day 2):**
- Final review of 24h logs (0 errors? <5% warnings?)
- Performance audit: LCP/INP/CLS from real user monitoring (if available)
- E2E smoke test #2 (manual validation of critical flows)
- Sign-off: DevOps confirms "clean window" + approves Phase 5 kickoff

### Post-Deploy Incident Response

**If P0 Alert (Authentication broken, data leak, timeout loop):**
1. Page on-call engineer (immediate)
2. Open incident channel (#incidents Slack)
3. Assess: rollback vs. quick fix (decision within 15min)
4. Execute rollback (30sec–5min) OR implement hotfix + retest (15–30min)
5. Post-mortem: schedule within 24h

**If P1 Alert (High latency, partial failures, non-critical errors):**
1. Investigate in parallel with deployment verification
2. Assess: rollback or mitigate (decision within 1h)
3. Communicate timeline to team + stakeholders
4. Resolution: fix in follow-up hotfix or Phase 4.1 sprint

**If No Alerts (Green window):**
1. Celebrate ✅
2. Document: "Phase 4 deploy clean, ready for Phase 5 kickoff"
3. Auditor notification: "Portal auth + NOTIVISA queue live in production sandbox"

---

## Section 10: Phase 4 → Phase 5 Handoff

### Phase 5 Unblock Conditions

Phase 5 (Critical Escalation + IA Training Dataset) can kick off **only if:**

1. ✅ Phase 4 deploy complete (Jun 2, EOD)
2. ✅ 24h clean window: 0 errors in Cloud Logs, <5% warnings
3. ✅ All 6 E2E flows passing in production
4. ✅ Auditor pre-alignment meeting #1 complete (May 27) — feedback incorporated
5. ✅ Zero P0/P1 bugs in production
6. ✅ Smoke test checklist signed by QA + DevOps
7. ✅ Portal auth + NOTIVISA queue architecture approved by CTO + auditor

**Handoff Package (Jun 2 → Phase 5 Kickoff, Jun 9):**
- Portal auth callables + UI (production-ready)
- NOTIVISA sandbox queue processor (production-ready)
- 24h production monitoring baseline (0 errors, <5% warnings)
- Auditor feedback summary (incorporated into Phase 4, outstanding issues tracked for Phase 8 CAPA)
- Deployment runbook + incident response guide
- On-call rotation + escalation tree
- Phase 5 task plans: 05-01 (Critical thresholds), 05-02 (SMS/email escalation), 05-03 (IA strip upload), 05-04 (Feedback loop)

---

## Summary: Phase 4 Readiness

**Status:** ✅ **READY FOR EXECUTION** (May 20 kickoff)

**Scope:** Portal auth (email link → JWT) + NOTIVISA queue (sandbox integration) + 6 critical E2E flows

**Duration:** 2.5 weeks execution + 0.5 week stabilization buffer (May 20–Jun 5)

**Critical Path:** Rules → Functions → Hosting deploy (Jun 2), 24h clean window (Jun 2–3), Phase 5 kickoff (Jun 9)

**Risk Level:** 4.3/10 (LOW-MEDIUM) — all blockers identified + mitigations documented; hard blockers monitored daily (May 20–27)

**Key Deliverables:**
- 3 Portal callables (validateToken, downloadPDF, preferences)
- NotivisaClient class + Portaria 204 types
- 5 Portal UI components (dark-first, WCAG AA)
- 2 Cloud Function triggers (onLaudoPublished, processNotiVisaQueue)
- 35+ unit tests + 6 E2E flows
- Cloud Logs monitoring + alert policies
- Deployment checklist + rollback runbook

**Unblocked Dependencies:**
- Phase 5 (Jun 9) — Critical escalation + IA training
- Phase 8 (Jun 15) — CAPA closure (auditor sign-off leverages Phase 4 audit trail)
- Phase 11 (May 27+) — Auditor pre-alignment weekly calls

**Next Steps:**
1. Get sign-off on pre-kickoff checklist (May 19, 5pm BRT) — CTO approval required
2. Announce Phase 4 kickoff (May 20, 10am BRT) — all-hands standup
3. Execute Phase 4 tasks in parallel streams (May 20–Jun 2)
4. Deploy to production (Jun 2, 9am–10am BRT)
5. Monitor 24h clean window (Jun 2–3)
6. Kickoff Phase 5 (Jun 9) after stabilization

**Sponsor:** CTO (final approval, escalation, auditor interface)  
**Execution Lead:** Eng Lead (daily standups, gate management, risk tracking)  
**QA Lead:** Test strategy, smoke tests, deployment sign-off  
**DevOps Lead:** Monitoring, deployment sequence, rollback readiness

---

## Appendix: Key Artifacts & References

- `.planning/phases/04-portal-notivisa/04-01-PLAN.md` — Portal Auth Callables + UI
- `.planning/phases/04-portal-notivisa/04-02-PLAN.md` — NOTIVISA Backend Client
- `.planning/phases/04-portal-notivisa/04-03-PLAN.md` — Queue Processor + Scheduler
- `.planning/phases/04-portal-notivisa/04-04-PLAN.md` — E2E Tests + Smoke Tests
- `.planning/milestones/v1.4-KICKOFF-SUMMARY.md` — v1.4 roadmap (Phases 4–15)
- `C:\hc quality\CLAUDE.md` — Project conventions (multi-tenant, soft delete, signatures)
- `.claude/rules/firestore-security.md` — RLS patterns (admin, member, patient isolation)
- `.claude/rules/deploy-protocol.md` — Deployment sequence + PWA updates
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — Monitoring setup + alert policy creation
- `docs/CLOUD_LOGS_QUICK_REFERENCE.md` — Commands + troubleshooting

---

**Phase 4 Execution Readiness Report — APPROVED FOR KICKOFF (May 20, 2026)**
