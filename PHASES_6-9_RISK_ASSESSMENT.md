---
artifact: Phases 6–9 Risk & Feasibility Assessment
version: 1.0
created: 2026-05-08
status: READY FOR PHASE 6 KICKOFF
scope: Risk evaluation + feasibility scoring + resource capacity analysis for v1.4 phases 6–9
target_audience: CTO, Tech Lead, Phase Leads, QA
apply_to: Phase 6 kickoff (2026-07-01), Phase 7+ planning
---

# Phases 6–9 Risk & Feasibility Assessment

**Document Purpose:** Provide structured risk analysis + feasibility scoring for Phases 6–9 of v1.4 execution. Intended to support Phase 6 kickoff decision (2026-07-01) and inform resource allocation across parallel workstreams.

**Timeline Context:**

- Phase 4 (Portal + NOTIVISA): May 20 → Jun 2 ✅ (2.5 weeks)
- Phase 5 (Critical Escalation + IA Training): Jun 9 → Jun 30 (3 weeks)
- **Phase 6 (Liberação + Críticos Polish): Jul 1 → Jul 14 (2 weeks)** ← You are here
- **Phase 7 (Reclamações + Portal Paciente): Jul 8 → Jul 28 (3 weeks)**
- **Phase 8 (CAPA Closure): Jun 15 → Aug 5 (4 weeks, parallel with Phase 5–7)**
- **Phase 9 (KPI Analytics): Jul 22 → Aug 4 (2 weeks)**

**Success Criteria (v1.4 Complete, Aug 31):**

- DICQ compliance ≥88%
- RDC 978 critical articles 100% covered
- CAPA closure auditor sign-off (Aug 5)
- Zero production regressions
- Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1

---

## Executive Summary

Phases 6–9 bridge **module completion** (Phases 4–5 foundation) → **external audit readiness** (Phase 13 final). Aggregate complexity: **medium** (well-defined domain). Aggregate risk: **medium-high** (auditor dependency + IA component + mobile complexity). Team capacity: **6–8 FTE across 4 streams**. Timeline: **12 weeks (Jul 1 → Aug 31 with buffers)**.

### Risk Snapshot

| Phase       | Risk Level       | Key Constraint                         | Feasibility | Team Size         |
| ----------- | ---------------- | -------------------------------------- | ----------- | ----------------- |
| **Phase 6** | 2.5/10 (LOW)     | PDF gen + portal external auth         | 8/10        | 2 FTE             |
| **Phase 7** | 3.0/10 (LOW)     | Portal paciente UX polish + trending   | 8/10        | 2.5 FTE           |
| **Phase 8** | 5.0/10 (MEDIUM)  | Auditor RFI cycles + CAPA evidence     | 7/10        | 3 FTE (CTO-heavy) |
| **Phase 9** | 3.5/10 (LOW-MED) | Analytics query optimization + caching | 7.5/10      | 2 FTE             |

**Overall Score:** 3.6/10 (LOW-MEDIUM risk, well-mitigated).

---

## Phase 6: Liberação Completion & Críticos Polish

### Overview

**Scope:** Deferred completion of Phase 10 v1.3 plans (04–07). Primarily UI + reporting + performance.

**Deliverables:**

1. Laudo PDF generation (CloudFunction + puppeteer) with QR validation
2. Portal médico external access (SSO integration via `rtPortalLogin` callable from Phase 4)
3. E2E test suite (8 critical flows: create laudo → review → sign → archive)
4. Lighthouse CI integration + performance budgets (Web Vitals gates)

**Compliance Target:** RDC 978 Arts. 167 (complete laudo release), 179–191 (CIQ quantitative). DICQ Block G (pós-analítico) +10%.

---

### Complexity Analysis

#### Module Scope

- **Modules touched:** `liberacao`, `analyzer`, `bioquimica`, `ceq` (existing); PDF generation new
- **Firestore writes:** 0 (read-only module, all writes via Phase 4–5 callables)
- **Cloud Functions:** 2 new callables
  - `generateLaudoPDF(laudoId, options)` — async CF (puppeteer, ~3s latency)
  - `validateLaudoQR(qrCode)` — validation callable (~100ms)
- **Firestore rules:** Minimal additions (PDF export audit trail append)
- **Schema changes:** 0 breaking changes (additive only: `laudos/{labId}/_archive/{pdfId}`)

#### Technical Risk Factors

**PDF Generation Risk: MEDIUM (mitigatable)**

- Puppeteer in CloudFunction is heavyweight (memory: 1GB, timeout: 9 min default)
- Mitigation: Async job queue pattern (already established in Phase 5 IA pipeline). Queue → polling dashboard → download.
- Precedent: v1.3 `export` module successfully uses CF + async queue (validated in Phase 3.3)
- Fallback: Revert to simple LaTeX or HTML-to-PDF client-side (degrades UX, adds client bundle +50KB)

**Portal SSO Risk: LOW**

- Reuses `rtPortalLogin` callable from Phase 4 (already tested)
- New scope: session persistence + refresh token logic (OAuth 2.0 standard patterns)
- Firestore collection: `laudos-draft` (exists from Phase 3), no new schema

**Performance Risk: LOW-MEDIUM**

- Lighthouse CI not yet integrated into merge gate (risk: regressions slip through)
- Mitigation: `hcq-deploy-gates` skill includes Lighthouse check; pre-merge gate enforces <2.5s LCP
- Success criteria: Phase 6 baseline establishes 362 KB gzip bundle (v1.3 existing), no growth >10%

---

### Feasibility Scoring

| Criterion                | Score | Rationale                                                                                                        |
| ------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------- |
| **Architecture clarity** | 9/10  | Reuses existing patterns (export, portal); no novel design                                                       |
| **Dependency readiness** | 8/10  | Depends on Phase 4 (Portal auth) + Phase 3 (Schema); both complete before Phase 6 start                          |
| **Team expertise**       | 8/10  | PDF gen + E2E testing known territory; portal from Phase 4 team carryover                                        |
| **Scope lock**           | 9/10  | Deferred feature, not new; scope explicit in ROADMAP Phase 10 plans                                              |
| **Regression risk**      | 7/10  | Additive-only schema; rules changes minimal; baseline tests must green (RN-06 soft-delete audits existing tests) |
| **Compliance fit**       | 8/10  | RDC/DICQ articles well-understood; no novel interpretation                                                       |

**Phase 6 Feasibility Score: 8.2/10** ✅ (HIGH CONFIDENCE)

---

### Resource & Timeline

**Team Allocation:**

- **Stream B (Frontend):** 1.5 FTE (Portal external UI + E2E test automation)
- **Stream D (DevOps):** 0.5 FTE (CF deployment + Lighthouse CI setup)
- **Total:** 2 FTE

**Timeline Breakdown:**
| Task | Week 1 | Week 2 | Dependencies |
|------|--------|--------|--------------|
| PDF CF + async queue | 4 days | — | Phase 5 deploy (queue pattern) |
| Portal external UI | 2 days | 2 days | Phase 4 callable + auth context |
| E2E test suite (8 flows) | — | 3 days | Portal UI stable |
| Lighthouse CI + gate | — | 2 days | Week 2 baseline |
| Buffer (rework) | — | 2 days | — |

**Critical Path:** PDF CF → portal UI → E2E testing → Lighthouse gate. Serial with 2-day slack per task.

**Unblock Criteria:**

- ✅ Phase 4 deploy stable (NOTIVISA queue, portal auth callables)
- ✅ Phase 5 IA pipeline + async queue pattern validated
- ✅ Staging environment mirrors production schema (Phase 3 deployment complete)
- ✅ QA test data refreshed (1M+ laudo records)

---

### Risk & Mitigation

**RISK-601: PDF Generation Timeout or Memory Overflow (Probability: LOW, Impact: MEDIUM)**

- **Trigger:** CloudFunction exceeds 9min timeout; puppeteer OOM on large datasets
- **Mitigation:**
  - Async queue pattern (never blocking); PDF generation runs in background
  - Memory cap: 1GB (puppeteer lite config, not full Chromium)
  - Timeout: 9min default sufficient (most PDFs <1s); escalate to manual RT generation if needed
- **Contingency:** Client-side simple PDF (no fancy styling, loses branding); fallback to HTML + print-to-PDF

**RISK-602: Portal Session Drift / Token Expiry (Probability: LOW, Impact: MEDIUM)**

- **Trigger:** RT logged into portal > 1h; refresh token expires; session lost
- **Mitigation:**
  - OAuth 2.0 refresh logic (standard library, tested in Phase 4)
  - Session persist via Zustand + localStorage (already in use for auth state)
  - Test case: Token refresh on route navigation
- **Contingency:** Re-login required; document in Portal UX ("Session expired")

**RISK-603: Lighthouse CI Regression Undetected (Probability: MEDIUM, Impact: LOW)**

- **Trigger:** PR merges with >10% LCP/INP regression; gate not enforced
- **Mitigation:**
  - Pre-merge gate via `hcq-deploy-gates` (mandatory per CLAUDE.md rules)
  - Baseline established Week 1 Phase 6; locked as pass target (362 KB gzip)
  - Weekly bundle analysis report (Stream D, Friday)
- **Contingency:** Manual revert if regression >10%; retrospective gate hardening

---

## Phase 7: Reclamações/Satisfação + Portal Paciente Polish

### Overview

**Scope:** Deferred completion of Phase 11 v1.3 plans (06–08). Patient feedback ecosystem + trending analytics.

**Deliverables:**

1. Portal paciente external (feedback submission + tracking)
2. Trending dashboard (satisfaction metrics, complaints trending, trending charts)
3. Final E2E suite (portal paciente → feedback → RT view → trending)
4. LGPD compliance polish (consent capture, anonymization, PII scrubbing on export)

**Compliance Target:** RDC 978 Arts. 115 (feedback loop), 167 (portal), 204 (audit trail). DICQ Block H (QA/feedback) +8%.

---

### Complexity Analysis

#### Module Scope

- **Modules touched:** `reclamacoes`, `kpis` (trending), `lgpd` (anonymization); new portal layer
- **Firestore writes:** 3–5 callables (feedback submit, RT response, anonymization)
- **Cloud Functions:** 3 new callables
  - `submitPatientFeedback(labId, feedback)` — async, audit trail
  - `updateFeedbackStatus(feedbackId, status)` — RT response
  - `generateTrendingReport(labId, dateRange)` — pre-computed aggregation
- **Firestore rules:** New path `portal-paciente/{labId}/feedback/{feedbackId}` (read-only for patient, RT can update)
- **Schema changes:** Minimal (additive: portal patient feedback + trending cache)

#### Technical Risk Factors

**Patient Portal Auth Risk: MEDIUM (mitigatable)**

- Phase 4 already implemented `rtPortalLogin` (medical portal)
- Patient portal uses different auth: email-link (72h expiry, per ADR-0015, explicitly v1.4 scope only, LIS deferral documented in RISK-412)
- Complication: Email validation + link generation + token management (new code path)
- Mitigation: Standard Flask/Express email-link pattern; tested in `education-continuada` module (user onboarding emails)
- Fallback: Disable patient feedback in v1.4, defer to v1.4.1 (breaks DICQ Block H closure, must escalate)

**Trending Analytics Risk: LOW-MEDIUM**

- Requires pre-computed aggregates (cannot run `.reduce()` on 10K feedback records client-side)
- Solution: CloudFunction cron (nightly) generates `portal-paciente/{labId}/_trending/{period}` (aggregated)
- Firestore cost: 1 write/day per lab (negligible)
- Performance: Dashboard loads cached data (<100ms), not computed on-demand
- Mitigation: Cron tested in `kpis` module already (validation cron runs daily, pattern exists)

**LGPD Anonymization Risk: MEDIUM (compliance-critical)**

- Feedback export must scrub patient PII (name, CPF, email, address)
- Firestore rules must enforce: patient can only see their own feedback; export always anonymized
- Complication: Multi-step anonymization (before export, before retention cutoff per LGPD Art. 17)
- Mitigation: `lgpd` module already handles anonymization cron (POL-LGPD-001, IT-LGPD-DPIA-001 deployed Phase 0)
- Reuse: Same anonymization helper from Phase 0; extend to feedback collection

---

### Feasibility Scoring

| Criterion                | Score | Rationale                                                                                    |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------- |
| **Architecture clarity** | 7/10  | Email-link auth is standard but new code path; trending cron reuses kpis pattern             |
| **Dependency readiness** | 8/10  | Depends on Phase 4 (callables infrastructure) + Phase 0 (LGPD anonymization); ready          |
| **Team expertise**       | 8/10  | Portal work from Phase 4 + Phase 6; trending from kpis module (reference); LGPD from Phase 0 |
| **Scope lock**           | 8/10  | Deferred feature (Phase 11 v1.3); scope explicit; email-link auth locked (LIS deferred)      |
| **Regression risk**      | 7/10  | Additive schema; anonymization already tested; new email-link code is isolated to auth flow  |
| **Compliance fit**       | 8/10  | RDC 978 + LGPD articles covered by Phase 0 + Phase 4; feedback loop already in scope         |

**Phase 7 Feasibility Score: 7.7/10** ✅ (HIGH CONFIDENCE with email-link scope lock)

---

### Resource & Timeline

**Team Allocation:**

- **Stream B (Frontend):** 1.5 FTE (Portal paciente UI + E2E testing)
- **Stream A (Callables):** 1 FTE (Feedback submission callable + anonymization integration)
- **Total:** 2.5 FTE

**Timeline Breakdown:**
| Task | Week 1 | Week 2 | Week 3 | Dependencies |
|------|--------|--------|--------|--------------|
| Patient email-link auth | 4 days | — | — | Phase 4 auth context |
| Portal paciente UI | 2 days | 3 days | — | Auth stable + design tokens |
| Feedback submission CF | — | 2 days | — | Auth callable |
| Trending cron + dashboard | — | 2 days | 2 days | Feedback CF + kpis pattern |
| LGPD anonymization | — | — | 2 days | Phase 0 helper reuse |
| E2E testing | — | — | 3 days | All features stable |
| Buffer (rework) | — | 1 day | 1 day | — |

**Critical Path:** Auth → Portal UI → Feedback CF → Trending → E2E. 3-week serial with 1–2 day slack per task.

**Unblock Criteria:**

- ✅ Phase 6 complete (Portal infrastructure established)
- ✅ Phase 4 callable patterns validated
- ✅ Email service (SendGrid or Firebase Email) configured + tested
- ✅ Design system finalized (dark-first portal tokens applied to patient portal)

---

### Risk & Mitigation

**RISK-701: Email-Link Auth Token Generation / Validation Failure (Probability: MEDIUM, Impact: MEDIUM)**

- **Trigger:** Email link expires before patient clicks; token validation fails; 404 on link click
- **Mitigation:**
  - Token structure: HMAC-SHA256(patient_id + timestamp + salt) (same pattern as CAPA-closure evidence links, proven)
  - TTL: 72h (generous for patient use case; documented in ADR-0015)
  - Fallback: RT can resend email (UI button); max 3 resends per hour
  - Test: Unit test + E2E test (valid + expired tokens)
- **Contingency:** Manual patient ID verification via phone (RT path); limit to handful per month

**RISK-702: Feedback Export PII Scrubbing Incomplete (Probability: LOW, Impact: HIGH)**

- **Trigger:** Export contains patient name/CPF; auditor flags LGPD violation during audit
- **Mitigation:**
  - Firestore rule: patient cannot export raw feedback (only aggregated trending)
  - CloudFunction anonymization cron (daily, appends to `_anonymized` field, original deleted after 30 days)
  - Test: Unit test validates all PII fields scrubbed; manual spot-check 10 exports
  - Audit trail: `logicalSignature` on anonymization event (who, when, which records)
- **Contingency:** Immediate remediation (re-export anonymized); incident report; LGPD officer notification

**RISK-703: Trending Aggregation Staleness or Query Timeout (Probability: LOW, Impact: MEDIUM)**

- **Trigger:** Trending dashboard shows data >24h stale; or query hangs >5s on large feedback sets
- **Mitigation:**
  - Cron runs nightly (01:00 BRT) off-peak; generates `_trending/{period}` doc (pre-computed)
  - Dashboard reads \_trending doc directly (no query, <100ms)
  - Fallback: If cron fails, dashboard shows "data unavailable, check back later"
  - Monitoring: Cron error logged; alert if failed >2 consecutive runs
- **Contingency:** Manual run via CF invocation (CTO triggers); backfill trending for missed day

**RISK-704: Portal Paciente Scope Creep / LIS Demand (Probability: MEDIUM, Impact: HIGH)**

- **Trigger:** Customer/RT requests real-time lab result sync (LIS integration) during Phase 7
- **Mitigation:**
  - Stakeholder memo Week 1 (CTO, per RISK-412 remediation): "v1.4 = email-link auth + feedback only; LIS = v1.4.1"
  - Scope lock documented in ADR-0015 + ROADMAP Section "Key Decisions Locked"
  - Sales playbook updated (v1.4.1 ETA messaging)
- **Contingency:** Phase 7 pauses; CTO emergency review; no scope inclusion without full re-planning (slides Phase 8+ timeline)

---

## Phase 8: CAPA Closure (Mandatory Sequential)

### Overview

**Status:** CRITICAL PATH (not optional). Parallel with Phase 5–7 execution (starts Jun 15, ends Aug 5).

**Scope:** Close 12 internal audit findings via corrective/preventive actions. Auditor sign-off required for v1.4 launch.

**Deliverables:**

1. Evidence gathering + CAPA-CLOSURE-REPORT.md (12 findings × 5 artifacts = 60 documents)
2. Management review meeting (auditor present; DICQ 4.4 compliance)
3. Auditor sign-off ceremony (Aug 5)

**Compliance Target:** RDC 978 Art. 5.3 (management review + CAPA closure). DICQ Block 4.4 (nonconformance tracking).

---

### Complexity Analysis

#### Module Scope

- **Modules touched:** Cross-cutting (schema, rules, functions, UI from Phases 4–7)
- **Firestore writes:** 0 (evidence gathered, submitted to auditor offline)
- **Cloud Functions:** 0 new
- **Firestore rules:** 0 new
- **Schema changes:** 0 (audit trail collection already exists from Phase 0)

#### Technical Risk Factors

**Low Technical Risk, HIGH Auditor Dependency**

This phase is **primarily administrative + compliance documentation**, not engineering-heavy. Technical execution happens in Phases 4–7; Phase 8 validates + documents.

However, three technical blockers exist:

1. **CAPA-01: Supervisor Shift Audit Trail (RDC 978 Art. 122, DICQ 4.1.2.7)**
   - Requirement: All supervisor-approved shifts must be logged immutably
   - Implementation: Phase 0 deployed `turnos` module (supervisor registry)
   - Evidence type: Audit log export showing all shifts + timestamps + approver identity
   - Risk: If audit trail format doesn't match auditor expectations, finding cannot close
   - Mitigation: Pre-alignment call Week 2 (auditor reviews sample audit log export format; confirms acceptance criteria)

2. **CAPA-02: LGPD Policy Formal Deployment (RDC 978 Art. 77, DICQ 4.4.1)**
   - Requirement: LGPD policy live in SGD (formally versioned document)
   - Implementation: Phase 0 deployed POL-LGPD-001 v1.0 (document + audit trail)
   - Evidence type: SGD document + access log showing staff received policy
   - Risk: If policy language doesn't match auditor interpretation of "formal LGPD policy", rework needed
   - Mitigation: Compliance consultant review Week 1 (external expert validates policy language vs RDC + DICQ expectations)

3. **CAPA-03 through CAPA-12: Cross-Cutting Evidence (Labs Apoio, Risk FMEA, etc.)**
   - Requirement: Contracts, spreadsheets, meeting notes, training records
   - Implementation: Phase 0 deployed modules; evidence generated during Phases 4–7
   - Evidence type: Screenshots, PDF exports, audit logs, signed agreements
   - Risk: Evidence incomplete; auditor RFI (Request for Information) delays closure by 5–10 days per item
   - Mitigation: Weekly evidence checklist tracking (owner reports % complete); template per CAPA (5 mandatory artifacts); auditor review Week 4 (early feedback loop)

---

### Feasibility Scoring

| Criterion                | Score | Rationale                                                                                                     |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------------- |
| **Architecture clarity** | 9/10  | CAPA is documented process (RDC 978 Art. 5); not architectural                                                |
| **Dependency readiness** | 6/10  | Depends on Phase 4–7 technical delivery; all modules must be stable + tested before evidence gathering        |
| **Team expertise**       | 7/10  | CTO leads + QA manages process; CAPA closure is new (no internal precedent, external auditor guides)          |
| **Scope lock**           | 10/10 | 12 findings fixed in Phase 0; scope immutable (RDC-mandated)                                                  |
| **Regression risk**      | 10/10 | No code changes; evidence-only; zero regression risk                                                          |
| **Compliance fit**       | 8/10  | RDC 978 Art. 5.3 + DICQ 4.4 well-understood; auditor interpretation risk = LOW (pre-alignment call mitigates) |

**Phase 8 Feasibility Score: 8.3/10** ✅ (HIGH CONFIDENCE, auditor-dependent)

---

### Resource & Timeline

**Team Allocation:**

- **CTO:** 2–3 FTE (daily CAPA management + auditor communication + remediation decisions)
- **QA Lead:** 1 FTE (evidence tracking + documentation)
- **Stream A (Callables owner):** 0.5 FTE (on-call for any technical evidence rework)
- **Total:** 3.5 FTE (heavy CTO load)

**Timeline Breakdown (4 weeks, Jun 15 → Aug 5):**

| Week                       | Task                                                  | Owner         | Dependencies                |
| -------------------------- | ----------------------------------------------------- | ------------- | --------------------------- |
| **Week 1 (Jun 15–21)**     | Pre-alignment call + evidence checklist               | CTO + QA      | Phase 5 not yet deployed    |
| **Week 2 (Jun 22–28)**     | Phase 4 deploy stable; CAPA-01–04 evidence gathering  | QA            | Phase 4 complete (Jun 2)    |
| **Week 3 (Jun 29–Jul 5)**  | CAPA-05–08 evidence + auditor RFI cycles (if any)     | QA + Stream A | Phase 5 deploy (Jun 30)     |
| **Week 4 (Jul 6–12)**      | CAPA-09–12 closure + management review prep           | QA + CTO      | Phase 6 stable (Jul 14)     |
| **Week 5+ (Jul 13–Aug 5)** | Management review meeting + auditor sign-off ceremony | CTO + Auditor | All CAPAs evidence-complete |

**Buffer:** 3-week buffer (Aug 5 deadline → Aug 31 audit) for any RFI rework.

**Unblock Criteria:**

- ✅ Phase 4 deploy stable (portal auth + NOTIVISA queue proven in production)
- ✅ Phase 5 deploy stable (critical escalation + IA pipeline proven)
- ✅ Auditor availability confirmed (weekly call scheduled; RFI SLA written)
- ✅ Compliance consultant booked (external expert validates policy + interpretation)

---

### Risk & Mitigation

**RISK-801: Auditor RFI Cycle Delays Closure (Probability: MEDIUM, Impact: HIGH) — RISK-402 mapped**

- **Trigger:** Auditor requests additional evidence; response cycle >5 business days
- **Mitigation:**
  - Pre-alignment call Week 1 (confirm expected evidence format + auditor review cycle SLA)
  - Weekly checklist review (QA + auditor; identifies gaps early)
  - Evidence drafts circulated Week 4 (early feedback, not final submission)
  - Contingency: Parallelization (gather evidence offline, no auditor blocker; allow async review cycles)
- **SLA:** 7 business days max per RFI cycle before escalation to CTO

**RISK-802: LGPD Policy Language Mismatch (Probability: LOW, Impact: HIGH)**

- **Trigger:** Auditor interprets "formal LGPD policy" differently; rewrite needed
- **Mitigation:**
  - Compliance consultant review Week 1 (external expert validates policy language)
  - Written confirmation from auditor (email, Week 2)
  - Conservative interpretation (choose stricter reading when ambiguous)
- **Contingency:** Policy rework sprint (1 week buffer); escalate to compliance officer + auditor if conflict

**RISK-803: CAPA Evidence Gathering Incomplete (Probability: MEDIUM, Impact: MEDIUM) — RISK-407 mapped**

- **Trigger:** ≥2 CAPAs missing evidence by Week 7 deadline
- **Mitigation:**
  - Weekly checklist tracking (5 mandatory artifacts per CAPA)
  - Template + checklist per CAPA type (pre-filled, owner completes)
  - 1-week evidence buffer (Week 8) for gap closure
  - Escalation: If ≥2 incomplete by Week 7, reassign owners + daily standup
- **Contingency:** 1-week extension (delay signature to Aug 12); acceptable if gaps closure SLA met

**RISK-804: CTO Context Switching / Burnout (Probability: MEDIUM, Impact: HIGH)**

- **Trigger:** CTO handling 3–4 parallel workstreams (Phase 8 + auditor calls + Phase 4–7 oversight)
- **Mitigation:**
  - QA Lead shoulders evidence gathering (CTO does policy + auditor comms only)
  - Dedicated CAPA process lead (QA, 1 FTE)
  - Fixed auditor call schedule (Friday mornings, 30 min max)
  - CTO calendar blocks: Phase 8 comms only, no ad-hoc requests Jun 15 → Aug 5
- **Contingency:** Hire interim compliance consultant (external) to co-lead if CTO overload detected (monitor weekly)

---

## Phase 9: Extended Analytics & KPI Dashboard Optimization

### Overview

**Scope:** Advanced KPI queries + performance optimization + Riopomba historical data integration.

**Deliverables:**

1. Multi-period KPI comparisons (e.g., "turnaround this month vs last month")
2. Trend projection (linear forecasting for TAT + rework rate)
3. Benchmark vs Riopomba historical data (lab-level comparison)
4. PDF export optimization (batching, compression, caching)
5. Analytics caching strategy (Redis or Firestore aggregate collections)

**Compliance Target:** DICQ Block J (continuidade/SLA adherence). DICQ 4.3 +3–5%.

**Timeline:** Parallel with Phase 8 (non-blocking). Jul 22 → Aug 4 (2 weeks, overlaps Phase 8 Week 3–4).

---

### Complexity Analysis

#### Module Scope

- **Modules touched:** `analytics`, `export`, `kpis` (existing, enhancement only)
- **Firestore writes:** Pre-computed aggregates only (nightly cron, per-lab)
- **Cloud Functions:** 2 new callables + 1 cron
  - `generateMultiPeriodReport(labId, dateRange, metrics)` — async, 30s timeout
  - `projectTrendline(labId, metric, periods)` — statistical (linear regression)
  - `refreshAnalyticsCaches` (cron, nightly) — aggregate generation
- **Firestore rules:** 0 new (reads already exist; cron is system process)
- **Schema changes:** Additive only (`analytics/{labId}/_cache/{period}` for pre-computed aggregates)

#### Technical Risk Factors

**Analytics Query Performance Risk: LOW-MEDIUM (well-mitigated pattern)**

- Problem: Querying 10K+ records per lab on-demand = slow Firestore read (100ms–1s)
- Solution: Pre-compute aggregates nightly (cron writes 10–20 aggregate docs per lab)
- Firestore cost: 1 write/day per lab per metric (~$0.06/month per lab, negligible)
- Performance: Dashboard loads cached aggregate (<50ms), not computed on-demand
- Mitigation: Cron pattern already proven in Phase 3.3 (`kpis` module, nightly update)
- Fallback: Revert to per-month caching (degrades real-time to 24h stale)

**Trend Projection (Linear Regression) Risk: LOW**

- Scope: Simple linear regression (numpy-like, no ML complexity)
- Implementation: Pure JavaScript (ml.js library, ~20 KB gzip) or Cloud Function logic
- Risk: Projection inaccurate for non-linear data (e.g., seasonal rework peaks)
- Mitigation: Simple linear model only; UI caveat "indicative projection, not forecast"; disabled if R² <0.8
- Fallback: Remove projection feature; dashboard shows raw trend only

**Riopomba Historical Integration Risk: MEDIUM (data quality)**

- Riopomba: Legacy lab management system; 80 documents already migrated (Phase 0 SGD)
- New scope: Import historical KPI data (TAT, rework %, conformance) for benchmarking
- Problem: Data format unknown; historical timestamps may be inconsistent
- Mitigation: Phase 9 Week 1 spike (data analysis): validate 1-week historical sample, check gaps, confirm format
- Fallback: Skip Riopomba integration; benchmark against industry averages only (published CLIA/CAP data)

**PDF Export Batching Risk: LOW**

- Scope: Batch PDFs (e.g., "export last 30 laudos") → single ZIP
- Implementation: CloudFunction generates PDFs async (queue), batches into ZIP
- Risk: ZIP generation memory overflow; timeout if >100 PDFs
- Mitigation: Stream-to-Cloud Storage (never hold full ZIP in memory); max 50 PDFs per batch
- Fallback: Single PDF only (existing behavior); batch feature deferred

---

### Feasibility Scoring

| Criterion                | Score | Rationale                                                                          |
| ------------------------ | ----- | ---------------------------------------------------------------------------------- |
| **Architecture clarity** | 8/10  | Caching + aggregation patterns proven in Phase 3; trend projection is simple math  |
| **Dependency readiness** | 9/10  | `analytics` + `kpis` + `export` modules exist; only enhancements, no new modules   |
| **Team expertise**       | 8/10  | Data engineering + cron patterns from Phase 3.3; trend projection = low complexity |
| **Scope lock**           | 8/10  | Enhancement phase; scope focused on performance + historical comparison            |
| **Regression risk**      | 8/10  | Additive aggregates; no breaking schema changes; existing analytics unaffected     |
| **Compliance fit**       | 7/10  | DICQ Block J is SLA/performance target; optimization directly maps                 |

**Phase 9 Feasibility Score: 8.0/10** ✅ (HIGH CONFIDENCE)

---

### Resource & Timeline

**Team Allocation:**

- **Stream D (Data/DevOps):** 1.5 FTE (caching strategy + cron + analytics queries)
- **Stream A (Backend):** 0.5 FTE (Riopomba data import + validation)
- **Total:** 2 FTE

**Timeline Breakdown (2 weeks, Jul 22 → Aug 4):**

| Task                                  | Week 1 | Week 2 | Dependencies                              |
| ------------------------------------- | ------ | ------ | ----------------------------------------- |
| Riopomba data analysis + import       | 2 days | —      | Riopomba access + export                  |
| Multi-period KPI query implementation | 2 days | 2 days | Existing `kpis` module + schema review    |
| Trend projection (linear regression)  | 1 day  | 1 day  | Statistical library (ml.js) integration   |
| Analytics caching strategy            | —      | 2 days | Cron pattern + Firestore aggregate schema |
| PDF batch export                      | —      | 2 days | Phase 6 PDF CF + CloudStorage setup       |
| Testing + performance validation      | —      | 2 days | Lighthouse CI + Web Vitals gate           |
| Buffer (rework)                       | —      | 1 day  | —                                         |

**Critical Path:** Riopomba import → caching strategy → KPI queries → testing. 2-week serial with 1-day slack.

**Unblock Criteria:**

- ✅ Phase 3 caching patterns fully documented (`kpis` module reference)
- ✅ Riopomba access granted (export historical data)
- ✅ ml.js library approved (lightweight, no heavy ML framework)
- ✅ Phase 6 PDF generation CF deployed + stable
- ✅ Phase 8 analytics audits complete (compliance baseline established)

---

### Risk & Mitigation

**RISK-901: Riopomba Data Quality / Format Mismatch (Probability: MEDIUM, Impact: MEDIUM)**

- **Trigger:** Historical data has missing fields, inconsistent timestamps, or incompatible format
- **Mitigation:**
  - Week 1 spike (data analysis): validate 1-week sample (1K records); check gaps; document format assumptions
  - Transformation pipeline: map Riopomba fields → KPI schema (test on sample before bulk import)
  - Fallback: Skip integration if validation fails; use industry benchmarks instead
- **Contingency:** Manual data cleanup (1–2 days) if <10% records invalid; skip larger gaps

**RISK-902: Analytics Query Timeout on Large Datasets (Probability: LOW, Impact: MEDIUM)**

- **Trigger:** Multi-period query exceeds 10s timeout; dashboard hangs
- **Mitigation:**
  - Pre-computed aggregates (cron runs nightly, writes to \_cache collection)
  - Dashboard reads cache, not raw data (response <100ms)
  - Fallback: Single-period view only (user must select month individually)
- **Contingency:** Increase cron frequency to 6h if stale data complaints; or switch to Redis caching

**RISK-903: Trend Projection Accuracy / User Misinterpretation (Probability: MEDIUM, Impact: LOW)**

- **Trigger:** Linear regression gives nonsensical forecast; user acts on bad data
- **Mitigation:**
  - Projection disabled if R² <0.8 (not enough linearity)
  - UI caveat: "Indicative projection based on [N] weeks of data; not a forecast"
  - Conservative model (simple linear; no extrapolation >4 weeks into future)
- **Contingency:** Remove projection feature entirely; keep only historical trend (no forward-looking)

**RISK-904: PDF Batch Export Memory Overflow (Probability: LOW, Impact: MEDIUM)**

- **Trigger:** BatchExport CloudFunction exceeds 1GB memory; timeout on 50+ PDFs
- **Mitigation:**
  - Stream-to-Cloud Storage (never hold full ZIP in memory)
  - Max 50 PDFs per batch
  - Async queue (user gets notification when ZIP ready, not blocking)
- **Contingency:** Single PDF only (revert to Phase 6 behavior); batch feature deferred to v1.4.1

---

## Cross-Phase Risk Summary (Phases 6–9)

### Aggregate Risk Heatmap

| Phase | Score  | Risk Level | Key Constraint              | Mitigation Owner    |
| ----- | ------ | ---------- | --------------------------- | ------------------- |
| **6** | 2.5/10 | LOW        | PDF gen timeout             | Stream D (DevOps)   |
| **7** | 3.0/10 | LOW        | Email auth token validation | Stream B (Frontend) |
| **8** | 5.0/10 | MEDIUM     | Auditor RFI cycles          | CTO                 |
| **9** | 3.5/10 | LOW-MEDIUM | Riopomba data quality       | Stream A (Backend)  |

**Aggregate Feasibility Score: 3.5/10 Risk (well-mitigated), 8.0/10 Feasibility (high confidence)**

---

### Team Capacity & Resource Allocation

#### FTE by Stream (Phases 6–9)

| Stream        | Phase 6 | Phase 7 | Phase 8 | Phase 9 | Total | Role                                   |
| ------------- | ------- | ------- | ------- | ------- | ----- | -------------------------------------- |
| A (Callables) | —       | 1.0     | 0.5     | 0.5     | 2.0   | Callables owner + CAPA support         |
| B (Frontend)  | 1.5     | 1.5     | —       | —       | 3.0   | Portal UI + E2E testing                |
| C (IA/Data)   | —       | —       | —       | —       | 0.0   | Phase 5 carryover (IA pipeline stable) |
| D (DevOps)    | 0.5     | —       | —       | 1.5     | 2.0   | Infra + analytics + caching            |
| CTO           | —       | —       | 3.0     | —       | 3.0   | CAPA closure + auditor comms           |

**Total Phase 6–9 Effort: 10 FTE-months (14 weeks)**

- **Peak:** Phase 8 (Week 2–4): 3.5 concurrent FTE (CTO + QA + streams)
- **Valley:** Phase 9 Week 1 (parallel with Phase 8 Week 3, reduced load): 2.0 FTE

#### 2026 Timeline Summary

```
May 7      Phase 0 complete (RDC blockers)
           ↓
May 20     Phase 4 kickoff (Portal + NOTIVISA, 2.5 weeks)
           ↓
Jun 2      Phase 4 deploy ✅
Jun 9      Phase 5 kickoff (Critical + IA, 3 weeks)
           ├→ Jun 15 Phase 8 kickoff (CAPA closure, parallel, 4 weeks)
           ↓
Jun 30     Phase 5 deploy ✅
Jul 1      Phase 6 kickoff (Liberación, 2 weeks)
           ├→ Jul 8 Phase 7 kickoff (Reclamações, 3 weeks, overlaps Phase 6)
           ├→ Jul 22 Phase 9 kickoff (Analytics, 2 weeks, overlaps Phase 8)
           ↓
Jul 14     Phase 6 deploy ✅
Jul 28     Phase 7 deploy ✅
Aug 4      Phase 9 deploy ✅
Aug 5      Phase 8 CAPA closure ceremony + auditor sign-off ✅
           ↓
Aug 31     v1.4 production launch + external audit ✅
```

---

## Feasibility Grades (Individual Phases)

### Overall Assessment

| Phase | Feasibility | Risk   | Team    | Timeline | Confidence                  |
| ----- | ----------- | ------ | ------- | -------- | --------------------------- |
| **6** | 8.2/10      | 2.5/10 | 2 FTE   | 2 weeks  | ✅ HIGH                     |
| **7** | 7.7/10      | 3.0/10 | 2.5 FTE | 3 weeks  | ✅ HIGH                     |
| **8** | 8.3/10      | 5.0/10 | 3.5 FTE | 4 weeks  | ✅ HIGH (auditor-dependent) |
| **9** | 8.0/10      | 3.5/10 | 2 FTE   | 2 weeks  | ✅ HIGH                     |

**All four phases are feasible with high confidence**, contingent on:

1. Phase 4–5 deployments remain stable (no major regressions)
2. Auditor availability + RFI SLA met (Phase 8 critical path)
3. No scope creep on Phase 6–7 (email-link auth scope lock, LIS deferred)
4. Team capacity maintained at 10 FTE-months through Aug 31

---

## Tech Debt Impact

### Phases 6–9 Introduce

1. **Puppeteer in CloudFunction (Phase 6):** Heavy memory footprint; deferred async queue management required
2. **Email-link auth (Phase 7):** New auth vector; token management adds security test surface
3. **Analytics caching (Phase 9):** Introduces cache invalidation complexity; nightly cron failure = stale data
4. **Riopomba integration (Phase 9):** Legacy system API mapping; maintenance burden if format changes

### Phases 6–9 Retire

- ~~`export` module client-side PDF (Phase 6 moves to CF async)~~ — reduces bundle size
- ~~Synchronous analytics queries~~ (Phase 9 moves to pre-computed cache) — improves dashboard latency

**Net Tech Debt:** +0.5 (minimal new complexity introduced; mitigated by established patterns)

---

## Compliance Mapping

### RDC 978 Articles Closed

| Phase | Articles                      | Status                                     |
| ----- | ----------------------------- | ------------------------------------------ |
| **6** | Arts. 167, 179–191            | Laudo release + CIQ quantitative reporting |
| **7** | Arts. 115, 167, 204           | Feedback loop + portal + audit trail       |
| **8** | Arts. 5.3 (management review) | CAPA closure ceremony                      |
| **9** | Art. 20 (SLA/performance)     | KPI dashboard + monitoring                 |

### DICQ Blocks Closed

| Phase | Blocks                     | Target %                   |
| ----- | -------------------------- | -------------------------- |
| **6** | Block G (pós-analítico)    | +10% (78.5% → 88.5%)       |
| **7** | Block H (QA/feedback)      | +8% (88.5% → 96%+)         |
| **8** | Block 4.4 (nonconformance) | Consolidates prior work    |
| **9** | Block J (continuidade)     | SLA/performance monitoring |

**v1.4 Compliance Target: 88%+ DICQ achieved after Phase 7. Phase 8–9 consolidate + optimize.**

---

## Decision Gates

### Phase 6 Kickoff Gate (Jul 1, 2026)

**Approve Phase 6 if ALL true:**

- [ ] Phase 4 deploy stable (NOTIVISA queue, portal auth proven in production 5+ days)
- [ ] Phase 5 deploy stable (critical escalation, IA pipeline proven)
- [ ] Staging environment mirrors production (schema, rules, indexes)
- [ ] QA test data refreshed (1M+ laudo records for PDF generation testing)
- [ ] Lighthouse CI configured + baseline established (362 KB gzip, <2.5s LCP)
- [ ] PDF generation CF spike complete + puppeteer tested locally
- [ ] Compliance consultant confirms LGPD policy language acceptable (Phase 7 prep)

**Risk:** If any gate fails, delay Phase 6 by 1 week (extend Phase 7 start to Jul 15).

---

### Phase 7 Kickoff Gate (Jul 8, 2026)

**Approve Phase 7 if ALL true:**

- [ ] Phase 6 Portal external auth stable
- [ ] Email service (SendGrid / Firebase Email) configured + tested
- [ ] Email-link auth token generation spike complete (72h TTL, HMAC validation)
- [ ] LGPD anonymization cron validated (reuses Phase 0 helper)
- [ ] Design tokens applied to patient portal UI (dark-first)
- [ ] Stakeholder memo published (LIS deferral documented, sales playbook updated)

**Risk:** If any gate fails, delay Phase 7 by 1 week; escalate to CTO for scope review.

---

### Phase 8 Kickoff Gate (Jun 15, 2026)

**Approve Phase 8 if ALL true:**

- [ ] Auditor pre-alignment call scheduled + RFI SLA written (5 business days max)
- [ ] Compliance consultant booked (external expert for policy + interpretation review)
- [ ] CAPA-CLOSURE-REPORT template created (12 findings, 5 mandatory artifacts per CAPA)
- [ ] Evidence checklist established (weekly tracking format, owners assigned)
- [ ] Phase 4 deployed (if critical for any CAPA evidence)

**Risk:** If auditor unavailable >1 week, shift Phase 8 start to Jul 1 (compress to 3 weeks, higher burnout risk).

---

### Phase 9 Kickoff Gate (Jul 22, 2026)

**Approve Phase 9 if ALL true:**

- [ ] Riopomba data access granted (export 1-year historical KPI data)
- [ ] Data format spike complete (validation on 1-week sample, gaps documented)
- [ ] Phase 6 PDF generation CF deployed + stable (Phase 9 depends on it for batch export)
- [ ] ml.js library approved (lightweight, no heavy ML framework)
- [ ] Phase 8 Week 1–2 complete (CAPA evidence gathering not blocking analytics work)

**Risk:** If Riopomba data inaccessible, defer integration; use industry benchmarks instead. Phase 9 continues with caching + trend projection only.

---

## Contingency Plans

### If Phase 6 Slips (>3 days)

**Action:** Extend Phase 6 end to Jul 18 (4 days slip). Compress Phase 7 to 2 weeks (Jul 19 → Aug 1).

- Impact: Phase 9 start shifts to Jul 29 (6-day delay)
- Risk: Tighter Phase 7 → increased burnout, reduced E2E test coverage
- Escalation: CTO reviews scope for Phase 7 cutdown (remove optional E2E flows)

### If Phase 7 Slips (>3 days)

**Action:** Extend Phase 7 end to Aug 3 (3-day slip). Maintain Phase 9 schedule (no change).

- Impact: Phase 7 + Phase 9 overlap (3 days); OK since non-blocking
- Risk: Frontend team stretched across both (request resource augmentation)
- Escalation: Defer non-critical Phase 7 features (patient trending secondary, feedback submission critical)

### If Phase 8 CAPA Evidence Incomplete (>2 CAPAs missing by Week 7)

**Action:** Activate Week 8 buffer (Jul 13 → Jul 19). Daily standup, evidence owner reassignment if needed.

- Impact: Phase 8 sign-off shifts to Aug 12 (7-day slip)
- Risk: 3-week buffer reduced to 2 weeks; external audit timeline unchanged
- Escalation: CTO emergency call with auditor (confirm renegotiated deadline acceptable)

### If Phase 9 Riopomba Integration Fails (data inaccessible or corrupted)

**Action:** Defer Riopomba integration. Proceed with caching + KPI queries + trend projection (80% of Phase 9 scope).

- Impact: Historical benchmarking unavailable; use published industry data instead (CLIA/CAP)
- Risk: DICQ Block J score slightly lower (~1–2 points)
- Escalation: No escalation needed; contingency is self-contained

---

## Success Criteria & Verification

### Phase 6 Success Criteria

- [ ] PDF generation CF tested + deployed (5+ successful PDFs generated, <1s latency typical)
- [ ] Portal médico external auth functional (RT can log in, stay logged in >1h)
- [ ] E2E test suite covers 8 critical flows (laudo create → review → sign → archive)
- [ ] Lighthouse CI integrated into pre-merge gate (no regressions >10% on any metric)
- [ ] Zero regressions in baseline tests (738/738 tests passing)
- [ ] Cloud Logs: 0 errors, <5% warning rate over 24h

### Phase 7 Success Criteria

- [ ] Email-link auth tested (token generation, expiry validation, resend logic)
- [ ] Portal paciente UI responsive (desktop + tablet, WCAG AA)
- [ ] Feedback submission CF tested + deployed (audit trail logging)
- [ ] LGPD anonymization cron tested (feedback export scrubbed of PII)
- [ ] Trending dashboard loads <100ms (pre-computed cache hit)
- [ ] E2E test suite covers 8 flows (feedback submit → RT view → trending update)
- [ ] Zero regressions in baseline tests (738/738 tests passing)

### Phase 8 Success Criteria

- [ ] 12 CAPAs evidence-complete (all 60 artifacts submitted to auditor)
- [ ] Management review meeting held (auditor present, documented minutes)
- [ ] Auditor sign-off certification received (email, signed date)
- [ ] CAPA-CLOSURE-REPORT finalized (12 findings, evidence audit trail, lessons learned)
- [ ] Zero RFI rework cycles (all evidence accepted on first submission)

### Phase 9 Success Criteria

- [ ] Multi-period KPI queries functional (compare current month vs prior month)
- [ ] Trend projection (linear regression) implemented (with R² threshold gate)
- [ ] Analytics caching cron tested + deployed (nightly aggregates for 5+ labs)
- [ ] Riopomba historical data integrated (OR deferred with contingency note)
- [ ] PDF batch export tested (50+ PDFs → single ZIP)
- [ ] Dashboard Web Vitals maintained (LCP <2.5s, INP <200ms, CLS <0.1)
- [ ] Zero regressions in baseline tests (738/738 tests passing)

---

## Recommendations for Phase 6 Kickoff (Jul 1, 2026)

### Immediate Actions (Week of Jun 24)

1. **Phase 4–5 Stability Assessment (CTO, 4h)**
   - Review Phase 4–5 Cloud Logs (zero errors, <3% warnings)
   - Run smoke test suite (all 19 flows passing)
   - Confirm NOTIVISA queue processing 100% of events (0 failures in 48h)

2. **Phase 6 Spike: PDF Generation Setup (Stream D, 8h)**
   - Puppeteer local test (small PDF generation, latency measurement)
   - CloudFunction memory + timeout settings finalized (1GB, 9min)
   - Async queue pattern spike (reuse Phase 5 IA pipeline code)

3. **Portal External Auth Finalization (Stream B, 4h)**
   - Session persistence + refresh token logic reviewed
   - Staging test: RT login → stay logged >1h → auto-refresh
   - Error scenarios tested (invalid credentials, session expired)

4. **Lighthouse CI Gate Setup (Stream D, 4h)**
   - Baseline measurement (362 KB gzip, <2.5s LCP)
   - Pre-merge gate configuration + pass/fail threshold (>10% regression = fail)
   - Weekly bundle analysis report template

### Weekly Standups (Phases 6–9, Starting Jul 1)

**Friday 15:00 BRT, 45 min (all streams + CTO):**

1. (10 min) Risk register update (top 5 risks, new risks identified)
2. (15 min) Phase progress (deliverables, blockers, % complete)
3. (15 min) Cross-phase dependencies (impact on Phase 8, Phase 9)
4. (5 min) Next week priorities

**CTO office hours (Tue 10:00 BRT, 30 min):** Ad-hoc escalations, decision requests

---

## Conclusion

**Phases 6–9 are feasible with 8.0/10 average confidence**, supported by:

1. **Established patterns:** Caching, email-link auth, PDF generation, trending analytics — all reuse proven v1.3/v1.4 Phase 4–5 code paths
2. **Auditor partnership:** Phase 8 CAPA closure managed via weekly pre-alignment calls + evidence checklist (de-risks RFI delays)
3. **Adequate resources:** 10 FTE-months distributed across 4 streams, with CTO-heavy Phase 8 front-loading
4. **Tight timeline:** 14 weeks from Phase 4 start (May 20) to v1.4 launch (Aug 31), with 3-week launch buffer (DICQ 88% by Aug 4, audit Aug 31)

**Critical success factors:**

- Phase 4–5 deploys stable (no major regressions)
- Auditor RFI SLA respected (5 business days max per cycle)
- Scope locks honored (email-link auth v1.4, LIS deferred v1.4.1)
- Team capacity sustained (no critical personnel loss Jun–Aug)

**With these conditions met, v1.4 launch on schedule (Aug 31) with DICQ ≥88% + RDC 978 100% coverage is highly achievable.**

---

**Document Control**

- **Version:** 1.0 (2026-05-08)
- **Status:** READY FOR PHASE 6 KICKOFF
- **Last Updated:** 2026-05-08
- **Owner:** CTO
- **Audience:** Phase Leads, Tech Lead, QA, Stream Leads A–D
- **Next Review:** Weekly standup (Friday 15:00 BRT, starting Jul 1)

---

**End of PHASES_6-9_RISK_ASSESSMENT.md**
