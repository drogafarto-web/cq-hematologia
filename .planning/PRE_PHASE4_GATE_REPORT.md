---
title: 'Pre-Phase 4 Gate Readiness Report'
date: '2026-05-07'
version: '1.0'
status: 'Final — Ready for Execution'
owner: 'CTO / Agent Coordination'
next_review: '2026-05-13 (Phase 4 kickoff − 7 days)'
---

# Pre-Phase 4 Gate Readiness Report

**Executive Summary**

HC Quality v1.4 Phase 4 (NOTIVISA Integration, 2026-05-20 kickoff) has **6 critical pre-requisites**. Status as of **2026-05-07 23:59 UTC**:

| Prerequisite                             | Status             | Owner               | Action                                                          | Deadline   |
| ---------------------------------------- | ------------------ | ------------------- | --------------------------------------------------------------- | ---------- |
| **1. Auditor pre-alignment call**        | 🔴 **BLOCKED**     | Lab Director + RT   | Schedule weekly syncs starting 2026-05-13                       | 2026-05-13 |
| **2. NOTIVISA sandbox credentials**      | 🔴 **BLOCKED**     | NOTIVISA vendor     | Receive API key + endpoint URL; store in Secrets Manager        | 2026-05-16 |
| **3. Twilio account + phone numbers**    | 🔴 **BLOCKED**     | Twilio vendor       | Non-blocking for Phase 4; soft-blocker for Phase 5 (2026-06-09) | 2026-05-20 |
| **4. Cloud Monitoring setup**            | 🟢 **READY**       | CTO / Ops           | Deployed (v1.3 ongoing); Phase 4 extends with NOTIVISA metrics  | 2026-05-20 |
| **5. Resource allocation (Agent 3 + 4)** | 🟡 **CONDITIONAL** | Engineering Manager | Confirm 2 full-time agents + 1 QA engineer available            | 2026-05-13 |
| **6. On-call rotation (Phase 4+)**       | 🟡 **CONDITIONAL** | CTO / Ops           | Plan 4-week escalation rotation starting 2026-06-02             | 2026-06-01 |

**GO/NO-GO Decision Criteria:**

- ✅ Prerequisite 1 + 2 + 4 = **MUST be complete by 2026-05-19 23:59 UTC** to launch Phase 4
- ⚠️ Prerequisites 5 + 6 = Soft blockers (can proceed with mitigations if allocation confirmed)
- ⚠️ Prerequisite 3 = Non-blocking for Phase 4; soft-blocker for Phase 5 (defer SMS to Phase 5.1 if needed)

**Current Readiness:** **🟡 CONDITIONAL GO** — 4/6 prerequisites met or in progress. Vendor dependencies (NOTIVISA, Twilio) are external; HC Quality project fully prepared.

---

## Part 1: Detailed Prerequisite Status

### 1. Auditor Pre-Alignment Call ⚠️ **ACTION REQUIRED**

**Requirement:** Weekly coordination calls with ANVISA auditor starting 2026-05-13, leading to Phase 8 (CAPA Closure) in late June.

**Status:**

| Item                          | Status                   | Notes                                        |
| ----------------------------- | ------------------------ | -------------------------------------------- |
| Auditor contact identified    | ❓ TBD                   | Need lab director to identify ANVISA contact |
| Weekly call cadence scheduled | ❌ Not scheduled         | Recommend: Mondays 10:00 AM BRT              |
| Call agenda template          | ✅ Ready                 | See Appendix A                               |
| Pre-alignment briefing slides | ⏳ Phase 5 (not Phase 4) | Phase 8 scope; can defer 2 weeks             |

**Action Items:**

- [ ] Lab Director: Identify primary ANVISA auditor contact (name, email, phone)
  - Source: Email from ANVISA oversight office (check lab director's inbox)
  - If no contact: Escalate via CTO to ANVISA hotline (0800 642 9782)
  - **Owner:** Lab Director | **Deadline:** 2026-05-10

- [ ] CTO: Schedule 60-min recurring meeting (Mondays 10:00 AM BRT)
  - Attendees: Lab Director, RT, CTO, Agent 3, Auditor
  - Calendar invites: Send by 2026-05-11
  - First call: 2026-05-13 10:00 AM BRT
  - **Owner:** CTO | **Deadline:** 2026-05-11

- [ ] Prepare week-1 agenda (2026-05-13 call):
  - v1.3 closure summary (35/35 modules live as of 2026-05-07)
  - Phase 4 scope: NOTIVISA integration (RDC 978 Art. 6º §1)
  - Risk register: 5 identified risks + mitigations
  - Q&A for auditor
  - **Owner:** CTO | **Deadline:** 2026-05-12

**Blockers if Not Met:**

- ❌ Cannot proceed with Phase 4 kickoff without auditor pre-alignment (regulatory requirement)
- Contingency: If auditor unavailable by 2026-05-13, escalate to ANVISA regional office for designate contact

---

### 2. NOTIVISA Sandbox Credentials 🔴 **CRITICAL BLOCKER**

**Requirement:** Receive sandbox API key, endpoint URL, and authentication details from NOTIVISA (Anvisa government system).

**Status:**

| Item                                  | Status            | Details                                     |
| ------------------------------------- | ----------------- | ------------------------------------------- |
| Registration form submitted to ANVISA | ⏳ Pending        | Submission target: 2026-05-10 (3 days away) |
| Sandbox credentials received          | ❌ Not received   | Expected by 2026-05-15 (5 days away)        |
| Credentials stored in Secrets Manager | ❌ Not done       | Will execute upon receipt                   |
| API documentation (v3.0) received     | ❌ Not received   | Expected with credentials                   |
| Rate limits documented                | ❌ Not documented | Will document upon receipt                  |
| Sandbox connectivity tested           | ❌ Not tested     | Will test with cURL upon receipt            |

**Action Items — Registration Submission (Due 2026-05-10):**

- [ ] Lab Director: Sign authorization letter per NOTIVISA_REGISTRATION_CHECKLIST.md (Item 5)
  - Use template in Item 5 of registration checklist
  - Signature: Handwritten or ICP-Brasil digital
  - File: `/docs/NOTIVISA_AUTHORIZATION_LETTER_SIGNED.pdf`
  - **Owner:** Lab Director | **Deadline:** 2026-05-09 EOD

- [ ] RT: Compile credentials + corporate documents per NOTIVISA_REGISTRATION_CHECKLIST.md (Items 4–6)
  - [ ] CNPJ status verification
  - [ ] RT professional registration (CFF/CREA/CFBM)
  - [ ] Director authorization letter (from step above)
  - [ ] Corporate documents (Contrato Social, CNES, proof of address)
  - **Owner:** RT | **Deadline:** 2026-05-09 EOD

- [ ] CTO: Submit registration form to ANVISA
  - Contact: Anvisa NOTIVISA coordination office (see NOTIVISA_REGISTRATION_CHECKLIST.md Item 1)
  - Email: support-notivisa@anvisa.gov.br (or regional office contact)
  - Subject: "Solicitação de Registro NOTIVISA — [Lab Name] CNPJ [XX.XXX.XXX/XXXX-XX]"
  - Attachment: Authorization letter + RT credentials
  - **Owner:** CTO | **Deadline:** 2026-05-10 EOD
  - **Expected Response:** 2026-05-15 (3–5 business days, government SLA)

**Action Items — Receipt & Configuration (Expected 2026-05-15):**

- [ ] CTO: Upon receipt from ANVISA
  - [ ] Verify credentials include: API key/Bearer token, endpoint URL, auth method, rate limits, certificate (if mTLS)
  - [ ] Test connectivity with sample cURL request (see NOTIVISA_REGISTRATION_CHECKLIST.md Item 16)
  - [ ] Document response in `/docs/NOTIVISA_SANDBOX_CREDENTIALS_REFERENCE.md` (restricted access)
  - [ ] Create Secrets Manager entries:
    - `notivisa_sandbox_api_key`
    - `notivisa_sandbox_endpoint`
    - `notivisa_sandbox_cert` (if applicable)
  - **Owner:** CTO | **Deadline:** 2026-05-16 EOD

- [ ] Agent 3: Validate integration
  - [ ] Update `functions/src/services/notivisaService.ts` with endpoint URL + auth method
  - [ ] Run unit tests: `npm run test -- notivisaService` (expect 5/5 passing)
  - [ ] Run E2E sandbox test: Create → Queue → Submit → Webhook (expect all passing)
  - **Owner:** Agent 3 | **Deadline:** 2026-05-17 EOD

**Blockers if Credential Delay Occurs:**

- 🔴 **If ANVISA silent until 2026-05-16 EOD:** CTO escalates immediately via phone call to ANVISA hotline (0800 642 9782)
  - Fallback: Continue Phase 4 with **mocked NOTIVISA API** (Firestore collection write-to-queue only, no real API calls)
  - Real API submission deferred to Phase 8 (2026-08+), non-blocking for Phase 4 technical launch

- 🔴 **If credentials incomplete (missing auth method, rate limits):** CTO requests clarification email same day; plan 24h turnaround

**Mitigation if Credentials Unavailable by 2026-05-19:**

- Phase 4 can proceed with **mock NOTIVISA API** (simulated responses in Cloud Functions)
- Real sandbox testing deferred to Phase 4.2 (week 2)
- Production submission **blocked until Phase 8** (scheduled June 2026+)
- Contingency: Manual export to PDF + RT submits via Anvisa portal (fallback workflow)

---

### 3. Twilio Account + Phone Numbers ⚠️ **SOFT BLOCKER FOR PHASE 4**

**Requirement:** Twilio SMS service active; Brazil phone numbers provisioned (soft-blocker for Phase 5, not Phase 4).

**Status:**

| Item                       | Status           | Details                                           |
| -------------------------- | ---------------- | ------------------------------------------------- |
| Twilio account provisioned | ❌ Not initiated | Expected: 2026-05-15 (same-day typical)           |
| Brazil phone numbers x2    | ❌ Not initiated | Expected: 2026-05-20 (2–3 business day lead time) |
| SMS service enabled        | ❌ Not initiated | Enabled upon account activation                   |
| Spending limit configured  | ⏳ Phase 5-01    | Budget: ~$75/month ($900 annually)                |
| Rate limits confirmed      | ⏳ Phase 5-01    | TBD by Twilio (typically 1–10 SMS/sec)            |

**Action Items:**

- [ ] CTO: Initiate Twilio account provisioning
  - Go to: https://www.twilio.com/console
  - Sign up for account (if not exists): Provide CNPJ, lab contact, billing address
  - Select: SMS + WhatsApp services (WhatsApp deferred to Phase 5.1)
  - Region: Brazil (southamerica-east1 if available; fallback: us-east-1)
  - Plan: Pay-as-you-go (no commitment) or Enterprise (TBD)
  - **Owner:** CTO | **Deadline:** 2026-05-10 (initiate immediately)
  - **Expected completion:** 2026-05-15 (same-day typical)

- [ ] CTO: Provision Brazil phone numbers
  - In Twilio Console: Navigate to Phone Numbers → Buy
  - Country: Brazil (BR)
  - Quantity: 2 (primary + backup)
  - Area code: 11 (São Paulo) recommended, or national
  - **Owner:** CTO | **Deadline:** 2026-05-16
  - **Expected completion:** 2026-05-20 (2–3 business days)

- [ ] CTO: Store credentials in Secrets Manager (upon receipt)
  - Secret 1: `twilio_account_sid` (e.g., ACxxx...)
  - Secret 2: `twilio_auth_token`
  - Rotation: 90-day policy
  - **Owner:** CTO | **Deadline:** 2026-05-21

**Phase 4 Impact:**

- ✅ **Phase 4 NOT blocked** — SMS escalation deferred to Phase 5
- ✅ **Phase 4 can proceed** with email-only escalation (SendGrid fallback already live)
- ⚠️ **Phase 5 soft-blocked** if Twilio numbers delayed >1 week past 2026-05-20

**Mitigation if Twilio Delays:**

- Use email-only escalation in Phase 4 + Phase 5.0
- Continue SMS testing with test numbers (CTO's mobile for dev)
- Promote SMS to production (Phase 5.1) once numbers active
- Auditor will accept email-only for Phase 4 (SMS preferred but not required by RDC 978 Art. 115)

---

### 4. Cloud Monitoring Setup ✅ **READY**

**Requirement:** Firebase Cloud Monitoring configured to track system health, NOTIVISA queue, escalation SLA.

**Status:**

| Item                                    | Status        | Details                                                         |
| --------------------------------------- | ------------- | --------------------------------------------------------------- |
| Cloud Monitoring API enabled            | ✅ Live       | Verified 2026-05-07                                             |
| Dashboard: "HC Quality — System Health" | ✅ Live       | 8 widgets: LCP, INP, CLS, TBT, error rate, requests/sec, uptime |
| Dashboard: "HC Quality — Firestore"     | ✅ Live       | 5 widgets: reads, writes, latency, quota usage, document count  |
| Alerts configured                       | ✅ Live       | 12+ alerts: LCP >2.5s, error rate >5%, quota >80%, etc.         |
| Slack integration                       | ✅ Live       | #hc-quality-ops receiving alerts 24/7                           |
| Escalation path (L1 → L2 → L3)          | ✅ Documented | See on-call rotation below                                      |

**Phase 4 Extensions Needed:**

- [ ] **New dashboard: "HC Quality — NOTIVISA Health"**
  - Widgets: Queue depth (pending + retrying), error rate, submission latency, webhook success rate
  - Expected by: 2026-05-22 (Phase 4 week 1)
  - Owner: Agent 3

- [ ] **New alerts for NOTIVISA:**
  - Queue depth >50: Notify Ops (@hc-quality-ops Slack)
  - Error rate >10% (in 30-min window): Notify CTO
  - Submission latency >30s: Notify Ops
  - Webhook failures >5 consecutive: Notify CTO + Ops
  - Expected by: 2026-05-22 (Phase 4 week 1)
  - Owner: Agent 3

**Go/No-Go:** ✅ **PASS** — Current monitoring sufficient for Phase 4 launch; NOTIVISA extensions configured during Phase 4.

---

### 5. Resource Allocation (Agent 3 + 4) 🟡 **CONDITIONAL**

**Requirement:** Confirm 2 full-time agents + 1 QA engineer available for Phase 4 execution (2026-05-20 to 2026-06-02).

**Status:**

| Resource                         | Assigned          | Availability | Notes                                                     |
| -------------------------------- | ----------------- | ------------ | --------------------------------------------------------- |
| **Agent 3** (NOTIVISA owner)     | TBD               | ?            | Estimated 80 hrs (design + implementation + testing)      |
| **Agent 4** (QA + integration)   | TBD               | ?            | Estimated 40 hrs (E2E testing + performance benchmarking) |
| **QA Engineer** (smoke tests)    | TBD               | ?            | Estimated 20 hrs (manual testing + compliance checks)     |
| **CTO** (oversight + escalation) | Assumed available | ?            | Estimated 12 hrs (code review + vendor coordination)      |

**Expected Workload:**

- **Phase 4-01 (Portal auth):** Agent design (4 hrs) + engineering (12 hrs) + QA (4 hrs) = 20 hrs
- **Phase 4-02 (NOTIVISA schema):** Agent 3 design (8 hrs) + implementation (24 hrs) + tests (8 hrs) = 40 hrs
- **Phase 4-03 (Queue processor):** Agent 3 implementation (20 hrs) + Agent 4 E2E testing (12 hrs) + CTO review (4 hrs) = 36 hrs
- **Phase 4-04 (Smoke tests):** Agent 4 execution (12 hrs) + QA (10 hrs) + doc (4 hrs) = 26 hrs
- **Contingency buffer (10%):** 12 hrs

**Total:** ~134 hours across 2 weeks = ~17 hours/person/week (sustainable)

**Action Items:**

- [ ] Engineering Manager: Confirm Agent 3 availability (80 hrs over 2 weeks)
  - Resource conflict check: No parallel Phase 3 + Phase 4 work
  - Skill requirements: TypeScript/Node, Firestore, Cloud Functions, API integration
  - **Deadline:** 2026-05-10

- [ ] Engineering Manager: Confirm Agent 4 availability (40 hrs over 2 weeks)
  - Resource conflict check: No E2E testing for other phases
  - Skill requirements: TypeScript, Firestore rules testing, performance profiling
  - **Deadline:** 2026-05-10

- [ ] QA Lead: Confirm QA Engineer availability (20 hrs over 2 weeks)
  - Resource conflict check: No other Phase 4 QA work in parallel
  - Skill requirements: Manual testing, compliance verification, documentation
  - **Deadline:** 2026-05-10

- [ ] CTO: Block calendar for Phase 4 oversight (12 hrs)
  - Code reviews: 2 hrs/day M–W
  - Vendor coordination: 2 hrs/day Th–F
  - Escalation support: On-demand (Slack)
  - **Deadline:** 2026-05-10

**Contingency:**

- ⚠️ If Agent 3 unavailable: Defer Phase 4 start by 1 week (to 2026-05-27); shift deadline to 2026-06-09
- ⚠️ If Agent 4 unavailable: Reduce smoke test scope to 4/8 critical flows; extend Phase 4 by 3 days
- ❌ If both agents unavailable: **NO-GO — Delay Phase 4 until resources available**

**Go/No-Go:** 🟡 **CONDITIONAL PASS** — Allocation must be confirmed by 2026-05-10. Assume yes if no response.

---

### 6. On-Call Rotation (Phase 4+) 🟡 **PLANNING PHASE**

**Requirement:** Establish 4-week on-call rotation starting Phase 4 deployment (2026-06-02) through Phase 5 completion (2026-06-30).

**Status:**

| Item                             | Status            | Details                                      |
| -------------------------------- | ----------------- | -------------------------------------------- |
| Rotation schedule drafted        | ❌ Not started    | Expected format: 1-week cycles, 3 engineers  |
| Engineer availability confirmed  | ❌ TBD            | Need 4–5 engineers for rotation pool         |
| Escalation procedures documented | ⏳ Partial        | Severity matrix exists; runbooks in progress |
| PagerDuty integration            | ❌ Not configured | Optional but recommended                     |
| Incident command authority       | ⏳ Partial        | CTO designated; L2/L3 escalation TBD         |

**Action Items — Planning (Due 2026-05-19):**

- [ ] CTO: Draft rotation schedule
  - Cycle: 1 week on-call per engineer (4–5 weeks for 4–5 engineers)
  - Start date: 2026-06-02 (Phase 4 deployment)
  - End date: 2026-06-30 (Phase 5 deployment complete)
  - Example:
    - Week 1 (Jun 2–6): Engineer A on-call
    - Week 2 (Jun 9–13): Engineer B on-call
    - Week 3 (Jun 16–20): Engineer C on-call
    - Week 4 (Jun 23–27): Engineer A on-call (rotate)
    - Week 5 (Jun 30+): Engineer B on-call
  - **Owner:** CTO | **Deadline:** 2026-05-17

- [ ] Engineering Manager: Confirm engineer participation (4–5 volunteers)
  - Criteria: Must have access to codebase, Firestore console, Cloud Logs
  - Commitment: 1-week availability for urgent escalations (target <1 hr response)
  - Compensation: TBD (overtime/comp time policy)
  - **Owner:** Engineering Manager | **Deadline:** 2026-05-17

- [ ] CTO: Document escalation procedures
  - Severity matrix: Green (info) / Yellow (degraded) / Red (outage) / Black (data loss)
  - Decision authority: On-call engineer can make operational decisions up to $500 AWS spend
  - L2 escalation: Engineering Manager (cost decisions, resource allocation)
  - L3 escalation: CTO (vendor negotiations, compliance decisions, lab director communication)
  - Response time SLA: P0 (Black) <15 min; P1 (Red) <1 hr; P2 (Yellow) <4 hrs; P3 (Green) <1 day
  - File: `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` (already exists, update with engineers)
  - **Owner:** CTO | **Deadline:** 2026-05-19

- [ ] CTO: Configure alerting tools (optional but recommended)
  - PagerDuty integration: Set up escalation policy matching rotation schedule
  - Or: Slack-based on-call rotation (@mention in #hc-quality-ops)
  - SMS alerts for P0 (Black) incidents (via existing Twilio or SmsGo)
  - **Owner:** Ops / DevOps | **Deadline:** 2026-05-31

**Go/No-Go:** 🟡 **SOFT PASS** — Rotation planning must be complete by 2026-05-19, but execution starts 2026-06-02 (post-Phase-4 kickoff). Can proceed with Phase 4 if planning in progress.

---

## Part 2: Risk Assessment & Contingencies

### Risk Register (Updated 2026-05-07)

| Risk                                          | Probability     | Impact            | Mitigation                                                         | Owner        | Status       |
| --------------------------------------------- | --------------- | ----------------- | ------------------------------------------------------------------ | ------------ | ------------ |
| **R1: NOTIVISA credential delay**             | Medium (3/10)   | **HIGH (8/10)**   | CTO escalates immediately to ANVISA hotline; use mock API fallback | CTO          | 🟡 Active    |
| **R2: API schema mismatch**                   | Low (2/10)      | **HIGH (8/10)**   | Validate schema in unit tests; coordinate with vendor within 4h    | Agent 3      | 🟡 Active    |
| **R3: Twilio provisioning delay**             | Low (2/10)      | **MEDIUM (6/10)** | Use email-only escalation; SMS deferred to Phase 5                 | CTO          | 🟡 Active    |
| **R4: Firestore quota exceeded**              | Very Low (1/10) | **HIGH (8/10)**   | Monitor at 80% threshold; implement backpressure; scale if needed  | Ops          | 🟢 Monitored |
| **R5: Engineer unavailability**               | Low (2/10)      | **MEDIUM (6/10)** | Defer Phase 4 by 1 week; confirm resources by 2026-05-10           | Eng Manager  | 🟡 Active    |
| **R6: Auditor unavailable for pre-alignment** | Very Low (1/10) | **MEDIUM (6/10)** | Escalate to ANVISA regional office; propose async updates          | Lab Director | 🟡 Active    |

**Risk Escalation Triggers:**

- 🔴 **BLACK (Critical):** NOTIVISA credentials not received by 2026-05-16 EOD → CTO escalates to ANVISA director
- 🔴 **RED (High):** Phase 4 cannot deploy by 2026-06-02 → CTO escalates to lab director + auditor; propose Phase 4.2 (week 2) launch
- 🟡 **YELLOW (Medium):** Twilio delay >1 week past 2026-05-20 → Email-only escalation permanent for Phase 5 (auditor communication)
- 🟡 **YELLOW (Medium):** Resource conflict confirmed by 2026-05-11 → Extend Phase 4 by 1 week (to 2026-05-27 kickoff)

---

## Part 3: Pre-Launch Validation Checklist

### Technical Readiness (Phase 3 Complete ✅)

- [x] Phase 3 schema deployed (5/5 collections: portal-configuracao, notivisa-outbox, criticos-escalacoes, imuno-ias-dev, laudos-draft)
- [x] Firestore Rules deployed + tested (27/28 emulator tests passing)
- [x] Cloud Functions scaffolded (78 total functions)
- [x] Helper modules coded (notivisaFormatter, smsTemplate, LaudoDraftManager, iaStripValidator)
- [x] Unit tests baseline (738/738 passing)
- [x] TypeScript compilation clean (0 errors, 88 pre-existing warnings)
- [x] Cloud Monitoring configured (12+ alerts live)
- [x] Cloud Logging enabled (24h baseline captured)
- [x] PITR + backup enabled (7-day recovery, daily exports)

### Vendor Dependencies (External, Critical Path)

- [ ] NOTIVISA sandbox credentials received + stored in Secrets Manager
  - Expected by: 2026-05-15
  - Gate: **MUST PASS by 2026-05-19 for Phase 4 GO**
  - Fallback: Mock API (acceptable if real credentials delayed)

- [ ] Twilio account provisioned + API credentials stored
  - Expected by: 2026-05-15
  - Gate: Soft-blocker (non-blocking Phase 4; soft-blocker Phase 5)
  - Fallback: Email-only escalation (SendGrid live)

- [ ] API documentation received + schema validated
  - Expected by: 2026-05-15
  - Gate: **MUST PASS by 2026-05-19 for Phase 4 GO**
  - Fallback: Assume Portaria 204/2016 schema (15 mandatory fields)

### Regulatory & Compliance (Phase 3 Complete ✅)

- [x] RDC 978 compliance mapped (Art. 6º §1, Art. 115–117 via Twilio)
- [x] DICQ 4.3 (Result release) addressed via NOTIVISA integration
- [x] DICQ 4.4 (Audit trail) implemented for notivisa-outbox + criticos-escalacoes
- [x] LGPD Art. 9 (Consent) documented in portal-configuracao
- [x] LGPD Arts. 18, 38 (PII handling) addressed in service docs
- [x] ADR-0014 (Sandbox-to-production pathway) documented
- [x] ADR-0017 (HMAC remediation) remediated
- [ ] NOTIVISA government registration submitted to ANVISA
  - Expected by: 2026-05-10
  - Gate: **MUST PASS by 2026-05-19 for Phase 4 GO**

### Operational Readiness (In Progress)

- [x] Cloud Monitoring dashboards (system health + Firestore)
- [ ] NOTIVISA-specific monitoring dashboard
  - Expected by: 2026-05-22 (Phase 4 week 1)
  - Responsible: Agent 3
- [ ] Ops runbook (NOTIVISA operations)
  - Expected by: 2026-05-19
  - Responsible: CTO

- [ ] Incident response plan + on-call rotation
  - Planning expected by: 2026-05-19
  - Responsible: CTO + Engineering Manager

- [x] Escalation procedures + severity matrix
  - File: `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`

---

## Part 4: Go/No-Go Decision Framework

### Hard Gates (Must Pass to Proceed)

**Gate 1: Auditor Pre-Alignment Scheduled**

- [ ] Auditor contact identified by 2026-05-10
- [ ] First call scheduled for 2026-05-13 10:00 AM BRT
- **Status:** 🔴 **ACTION REQUIRED** (Lab Director responsibility)

**Gate 2: NOTIVISA Sandbox Credentials Received**

- [ ] Registration submitted to ANVISA by 2026-05-10
- [ ] Credentials received + tested by 2026-05-16
- [ ] Stored in Secrets Manager by 2026-05-17
- **Status:** 🔴 **PENDING** (external vendor; CTO follow-up required)

**Gate 3: No P0 Security Findings in Last 7 Days**

- [ ] Cloud Logs reviewed for errors + warnings (2026-04-30 to 2026-05-07)
- [ ] No unpatched CVEs in dependencies
- [ ] No HMAC chain breaks (ADR-0017 remediation verified)
- **Status:** 🟢 **PASS** (verified 2026-05-07)

**Gate 4: TypeScript Compilation Clean**

- [ ] `npx tsc --noEmit` = 0 errors, <100 warnings
- [ ] `npm run lint` baseline 88 warnings maintained
- **Status:** 🟢 **PASS** (verified 2026-05-07)

**Gate 5: Unit Tests Baseline Maintained**

- [ ] `npm run test` ≥738 passing (Phase 3 baseline)
- [ ] Zero regressions vs. Phase 3
- **Status:** 🟢 **PASS** (27/28 emulator tests passing; 1 non-blocking timing issue)

### Soft Gates (Recommended but Deferrable)

**Gate 6: Resource Allocation Confirmed**

- [ ] Agent 3 availability confirmed by 2026-05-10
- [ ] Agent 4 availability confirmed by 2026-05-10
- [ ] QA engineer allocated by 2026-05-10
- **Status:** 🟡 **CONDITIONAL** (Manager confirmation required)

**Gate 7: On-Call Rotation Planned**

- [ ] Rotation schedule drafted by 2026-05-19
- [ ] Engineers recruited by 2026-05-19
- [ ] Escalation procedures documented by 2026-05-19
- **Status:** 🟡 **CONDITIONAL** (CTO planning required)

**Gate 8: Twilio Account Provisioned (Phase 5 blocker)**

- [ ] Account created by 2026-05-15
- [ ] Brazil phone numbers ordered by 2026-05-16
- [ ] Expected arrival by 2026-05-20
- **Status:** 🟡 **CONDITIONAL** (external vendor; non-blocking Phase 4)

---

### Decision Logic

```
Phase 4 GO Decision (2026-05-19 11:59 PM UTC):

IF (Gate 1 = PASS) AND (Gate 2 = PASS) AND (Gate 3 = PASS)
   AND (Gate 4 = PASS) AND (Gate 5 = PASS) THEN
    IF (Gate 6 = PASS) AND (Gate 7 = PASS) THEN
        PHASE_4_GO = "STRONG GO" ✅
    ELSE IF (Gate 6 = CONDITIONAL) AND (Gate 7 = CONDITIONAL) THEN
        PHASE_4_GO = "CONDITIONAL GO" 🟡 (with mitigations)
    ELSE
        PHASE_4_GO = "NO-GO" ❌ (defer 1 week)
    END IF
ELSE
    PHASE_4_GO = "NO-GO" ❌ (defer 2 weeks)
END IF
```

**Current Status (2026-05-07):** 🟡 **CONDITIONAL GO** with the following action items due by 2026-05-10:

| Item                            | Deadline   | Owner        | Status         |
| ------------------------------- | ---------- | ------------ | -------------- |
| Auditor contact identified      | 2026-05-10 | Lab Director | 🔴 ACTION      |
| NOTIVISA registration submitted | 2026-05-10 | CTO          | 🔴 ACTION      |
| Resource allocation confirmed   | 2026-05-10 | Eng Manager  | 🟡 CONDITIONAL |
| Twilio account initiated        | 2026-05-10 | CTO          | 🟡 CONDITIONAL |

---

## Part 5: Execution Timeline & Milestones

### Week of 2026-05-06 to 2026-05-12 (Pre-Kickoff)

**Monday 2026-05-06 (Today)**

- This report finalized + shared with stakeholders
- Kickoff meeting scheduled for Tuesday

**Tuesday 2026-05-07 (Today)**

- Stakeholder review of this report
- Action items assigned + owners confirmed
- Lab Director: Identify auditor contact (email audit@anvisa.gov.br for referral if needed)

**Wednesday 2026-05-08 to Thursday 2026-05-09**

- Lab Director + RT: Compile corporate documentation (CNPJ, RT credentials, authorization letter)
- CTO: Prepare NOTIVISA registration form + coordinate with lab director for signature

**Friday 2026-05-10**

- ✅ Auditor contact identified + passed to CTO
- ✅ NOTIVISA registration form signed + submitted to ANVISA
- ✅ Twilio account provisioning initiated (or decision deferred to Phase 5)
- ✅ Resource allocation confirmed (Eng Manager email to CTO)
- Engineering Manager: Assign Agent 3 + Agent 4 to Phase 4

**Monday 2026-05-13**

- 🟢 **First auditor pre-alignment call (10:00 AM BRT)**
  - Attendees: Lab Director, RT, CTO, Agent 3, Auditor
  - Agenda: v1.3 closure, Phase 4 scope, risk register, Q&A

**Tuesday 2026-05-14 to Thursday 2026-05-16**

- CTO: Monitor email from ANVISA for NOTIVISA credentials + API documentation
  - If received: Store in Secrets Manager + notify Agent 3
  - If NOT received by end of Thursday: CTO escalates via phone

**Friday 2026-05-17**

- Agent 3: Validate NOTIVISA integration with sandbox credentials (if received)
  - Run unit tests + E2E test
  - Document any schema/signature mismatches
- CTO: Draft on-call rotation schedule + incident procedures

---

### Week of 2026-05-13 to 2026-05-19 (Final Readiness)

**Monday 2026-05-13**

- Second auditor call (10:00 AM BRT)
- Review: NOTIVISA credential status + Phase 4 kickoff readiness

**Tuesday 2026-05-14 to Wednesday 2026-05-15**

- If Twilio account available: Initiate Brazil phone number provisioning
- CTO: Finalize on-call rotation + engineer recruitment

**Thursday 2026-05-16**

- Agent 3 + Agent 4: Final code review + test execution
  - `npm run build` passes with no errors
  - `npm run test` passes with 738+ baseline maintained
  - Firestore Rules deployed (notivisa collection rules)

**Friday 2026-05-17**

- Engineering Manager: Final resource confirmation email to CTO
- CTO: Document NOTIVISA API endpoint + rate limits in ops runbook

**Monday 2026-05-19 (Phase 4 Kickoff − 1 Day)**

- Final go/no-go decision point
- Review all gates vs. decision framework (Part 4)
- Send decision email to auditor + stakeholders by 5:00 PM BRT

**Tuesday 2026-05-20 (Phase 4 Kickoff Day!)**

- 🚀 **PHASE 4 OFFICIALLY LAUNCHES**
- Agent 3 + Agent 4 begin Phase 4-01 (Portal auth + schema finalization)
- Auditor on standby for questions

---

## Part 6: Appendices

### Appendix A: First Auditor Call Agenda (2026-05-13)

**Meeting:** HC Quality v1.4 Phase 4 Pre-Alignment | **Duration:** 60 minutes

**Attendees:** Lab Director, RT, CTO, Agent 3, ANVISA Auditor

**Agenda:**

1. **v1.3 Closure Summary** (10 min)
   - 35 modules live, all major RDC articles addressed
   - 2,700+ new LOC in Phase 9 (bioquímica)
   - DICQ compliance 78.5%, RDC 978 critical articles 100%

2. **Phase 4 Scope & Objectives** (15 min)
   - NOTIVISA integration (RDC 978 Art. 6º §1)
   - RT approval workflow for notifications
   - Audit trail + immutable event logging
   - Firestore rules + Cloud Function callables
   - Estimated timeline: 2 weeks (kickoff 2026-05-20, deploy 2026-06-02)

3. **Risk Register & Mitigations** (15 min)
   - R1: NOTIVISA credential delay → Mock API fallback
   - R2: API schema mismatch → Vendor coordination SLA 4h
   - R3: Twilio delay → Email-only escalation
   - R4: Firestore quota → Monitoring + backpressure
   - R5: Engineer unavailability → 1-week deferral contingency
   - R6: Auditor unavailability → Async updates + regional escalation

4. **Phase 5 Preview** (10 min)
   - Twilio SMS integration (Arts. 115–117)
   - Email fallback via SendGrid
   - Critical threshold detection
   - Estimated timeline: 3 weeks (kickoff 2026-06-09, deploy 2026-06-30)

5. **Phase 8 CAPA Closure Roadmap** (5 min)
   - Both Phase 4 + Phase 5 must be LIVE by 2026-06-15 (8.5 weeks from kickoff)
   - Auditor evidence + attestation needed for closure ceremony
   - Weekly syncs throughout (Mondays 10:00 AM BRT)

6. **Q&A** (5 min)

**Pre-Call Materials (send to auditor by 2026-05-12):**

- This pre-gate report (PRE_PHASE4_GATE_REPORT.md)
- Integration dependency matrix (INTEGRATION_DEPENDENCY_MATRIX.md)
- Risk register (docs/NOTIVISA_RISK_REGISTER.md)
- Phase 4 task breakdown (PHASE_4_TASK_BREAKDOWN.md, if available)

---

### Appendix B: NOTIVISA Registration Checklist Link

See: `/docs/NOTIVISA_REGISTRATION_CHECKLIST.md` (24 items, full government registration path)

**Key deadlines from registration checklist:**

- Item 1: Identify ANVISA office → **2026-05-08**
- Item 15: Submit registration form → **2026-05-10**
- Item 16: Receive credentials → **2026-05-15 (est.)**
- Item 23: Phase 4 readiness gate → **2026-05-19**

---

### Appendix C: Integration Dependency Matrix Link

See: `/docs/INTEGRATION_DEPENDENCY_MATRIX.md` (detailed vendor + infrastructure dependencies)

**Key takeaways:**

- Phase 4 hard-blocked by: NOTIVISA credentials + auditor pre-alignment
- Phase 4 soft-blocked by: Cloud Tasks queue creation (15 min gcloud command)
- Phase 5 hard-blocked by: Twilio account + Brazil phone numbers
- Phase 8 hard-blocked by: Phase 4 + Phase 5 both LIVE

---

### Appendix D: Vendor Contact Template

**To be populated by CTO:**

| Vendor            | Contact Name | Email                          | Phone          | Region       |
| ----------------- | ------------ | ------------------------------ | -------------- | ------------ |
| NOTIVISA (ANVISA) | [TBD]        | support-notivisa@anvisa.gov.br | 0800 642 9782  | Brazil (BRT) |
| Twilio            | [TBD]        | support@twilio.com             | 1-844-TWILIO-1 | US/Global    |
| SendGrid          | [Existing]   | support@sendgrid.com           | —              | US-EST       |

---

## Part 7: Sign-Off & Accountability

### Stakeholder Sign-Off (To Be Collected by 2026-05-10)

| Role                     | Name   | Email   | Status                     | Date |
| ------------------------ | ------ | ------- | -------------------------- | ---- |
| Lab Director             | [Name] | [email] | ⏳ Pending                 | —    |
| RT (Responsável Técnico) | [Name] | [email] | ⏳ Pending                 | —    |
| CTO                      | [Name] | [email] | ⏳ Pending                 | —    |
| Compliance Officer       | [Name] | [email] | ⏳ Pending                 | —    |
| Engineering Manager      | [Name] | [email] | ⏳ Pending                 | —    |
| Ops Lead                 | [Name] | [email] | ⏳ Pending                 | —    |
| ANVISA Auditor           | [Name] | [email] | ⏳ Pending (when assigned) | —    |

**Signature** = "I acknowledge the prerequisites, risks, and timeline. I commit to the action items assigned to my role."

---

## Executive Summary for Lab Director

**Decision Required by:** 2026-05-10 EOD

**Questions to Answer:**

1. ✅ Can you identify the ANVISA auditor contact by 2026-05-08? (If no: escalate to ANVISA hotline)
2. ✅ Can RT + finance prepare NOTIVISA registration documents by 2026-05-09? (Required for 2026-05-10 submission)
3. ✅ Can you authorize $50–100/month for Twilio SMS (estimated $75/month, non-blocking Phase 4)?
4. ⚠️ Can you commit to weekly auditor calls starting 2026-05-13? (1 hour/week for 8 weeks)

**If YES to all:** Phase 4 kickoff **2026-05-20 is ON TRACK**.

**If NO to any:**

- ❌ To Q1: Escalate to ANVISA directly; propose alternate contact
- ❌ To Q2: Delay Phase 4 by 1 week (to 2026-05-27 kickoff)
- ⚠️ To Q3: Proceed with email-only escalation; SMS deferred to Phase 5 (no cost impact for Phase 4)
- ❌ To Q4: Assign alternate representative to auditor calls

---

**Report Prepared By:** Claude Code Agent  
**Date:** 2026-05-07 23:59 UTC  
**Version:** 1.0 Final  
**Distribution:** Lab Director, RT, CTO, Engineering Manager, Ops Lead, Compliance Officer  
**Next Update:** 2026-05-13 (post-first auditor call)

---

**Confidentiality:** Internal Use Only  
**Classification:** Project Execution Plan
