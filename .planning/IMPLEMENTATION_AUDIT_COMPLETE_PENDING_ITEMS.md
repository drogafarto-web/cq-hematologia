---
document_type: implementation-audit
audit_date: 2026-05-08
status: COMPREHENSIVE
scope: All v1.4 phases + critical findings + RDC violations
baseline: v1.3 (2026-05-07, 78.5% DICQ, 35 modules in production)
target: v1.4 (2026-08-31, 88% DICQ, 100% RDC 978 critical articles)
---

# HC Quality v1.4 — COMPLETE IMPLEMENTATION AUDIT

## ALL Pending Items Across All Phases

**Report Date:** 2026-05-08  
**Auditor:** gsd-eval-auditor + CTO Research  
**Confidence Level:** 95% (based on 4 planning documents + 3 critical findings docs + source code review)

---

## EXECUTIVE SUMMARY

| Metric                            | Count | Status                  |
| --------------------------------- | ----- | ----------------------- |
| **Total Pending Implementations** | 87    | ⚠️ HIGH                 |
| **Critical Blockers**             | 6     | 🔴 MUST FIX IMMEDIATELY |
| **RDC 978 Violations**            | 12    | 🔴 BLOCKING AUDIT       |
| **DICQ Coverage Gaps**            | 25    | 🟡 PARTIAL              |
| **Phase Deliverables Incomplete** | 32    | 📅 PLANNED              |
| **Infrastructure Gaps**           | 7     | 🟡 TECH DEBT            |

**Overall Status:** v1.3 is production-ready; **v1.4 phases 4–12 ARE NOT YET EXECUTED**. All tasks below represent work to be done between now (2026-05-08) and external audit (2026-08-31).

---

## SCOPE ERRATA (2026-05-08)

**WARNING — DOCUMENTATION CORRECTIONS APPLIED. Read before consuming any Phase 5 compliance claim.**

1. **BLOCKER 2 correction — "OCR for Art. 167" does NOT exist in Phase 5.**
   - `functions/src/modules/ia-strip/callables/classifyStripGemini.ts` performs **RDT serology classification** (HIV / dengue / sífilis / COVID / hCG → Reagente/Não-Reagente), not laudo OCR.
   - Phase 5 Tasks **05-03 and 05-04 are RDT IA Strip Classifier scope ONLY**. They do **NOT** close RDC 978 Art. 167.
   - Art. 167 fields 10–12 (reference values, technical limitations, interpretation data) plus PDF generation and portal médico are **deferred to Phase 6** (Tasks 06-01 / 06-02 / 06-03), per `.planning/PHASE_5_RDC_CRITICAL_VIOLATIONS.md` line 405.
   - All Phase 5 DICQ delta calculations that include an Art. 167 contribution are invalid and must be recomputed before any tracker update.

2. **BLOCKER 6 correction — DICQ 78.5% → 82%+ swing is PROJECTED, not earned.**
   - DICQ tracker increments tied to Phase 5 deliverables are **PAUSED** until BLOCKERS 1, 3, 4, 5 close and a re-audit confirms code-level evidence. See banner at top of `docs/DICQ_CLOSURE_TRACKER_v1.4.md`.

3. **No code changes triggered by this errata.** Documentation-only corrections to align audit narrative with shipped code.

---

## PART 1: CRITICAL BLOCKERS (Must Fix Before Phase 4 Execution)

### BLOCKER 1: Empty HMAC Signatures in Criticos Module

**File:** `functions/src/modules/criticos/index.ts` lines 200, 364, 488  
**Severity:** 🔴 CRITICAL — Production Security Regression  
**Issue:** `hash: ''` literal in 4 signature emission sites violates:

- ADR-0017 (Logical Signature contract)
- RDC 978 Art. 128 (Rastreabilidade)
- Firestore rule validation (`hash.size() == 64`)

**Impact:**

- Either (a) Firestore rules accept empty hash = security hole, or (b) writes silently fail = data loss
- Chain-hash verification breaks for all criticos records

**Fix Required:**

- [ ] Restore `generateChainHash()` calls in all 4 sites
- [ ] Add unit test: `signature.hash.length === 64` (all branches)
- [ ] Regression test: verify chain-hash chain unbroken across Phase 5 records
- [ ] Deploy with mandatory pre-flight check (`preflight-secrets-check.sh`)

**Estimated Effort:** 4 hours (code fix + tests)  
**Blocker For:** Phase 4 deploy (cannot mark stable if chain-hash broken)

---

### BLOCKER 2: "OCR for Art. 167" Does Not Exist (Scope Mismatch)

**Files:**

- `functions/src/modules/ia-strip/callables/classifyStripGemini.ts` (actual implementation)
- `.planning/PHASE_5_RDC_CRITICAL_VIOLATIONS.md` line 405 (documentation)

**Severity:** 🔴 CRITICAL — Compliance Misrepresentation  
**Issue:**

- Documentation claims **Phase 5 Task 05-03/04 covers "OCR for Art. 167"**
- Reality: `classifyStripGemini` does **RDT serology classification** (HIV/dengue/syphilis/COVID/HCG → R/NR), NOT laudo OCR
- Art. 167 laudo OCR (fields 10–12: reference ranges, technical limitations, interpretation data) is **Phase 6 Task 06-01**, not Phase 5

**Impact:**

- DICQ tracker incorrectly awards Phase 5 credit for Art. 167
- Auditor discovers misrepresentation during compliance review
- Phase 5 completion claim becomes invalid

**Fix Required:**

- [ ] Stop crediting Task 05-03/04 to Art. 167
- [ ] Update Phase 5 DICQ impact calculation (remove Art. 167 delta)
- [ ] Lock Phase 6 Task 06-01 as mandatory (Laudo Fields 10–12 implementation)
- [ ] Document distinction: "Phase 5 = IA Strip RDT Classification; Phase 6 = Laudo OCR"
- [ ] Update DICQ_CLOSURE_TRACKER.md with corrected Phase 5 contribution

**Estimated Effort:** 2 hours (documentation fix + tracker correction)  
**Blocker For:** DICQ tracker updates (cannot claim progress until scope clear)

---

### BLOCKER 3: LGPD Art. 9 Not Addressed for AI Processing

**Scope:** Patient strip images sent base64 to `generativelanguage.googleapis.com` (Gemini Vision)  
**Severity:** 🔴 CRITICAL — Regulatory Violation  
**Issues:**

- No DPIA (Data Impact Assessment) addendum specific to Gemini Vision
- No Art. 33 international transfer legal basis documented
- No Art. 7/11 legal basis update (consent for AI processing)
- No consent capture (patient must know image goes to Google Gemini)
- No purpose limitation (image used only for classification, not model training)
- No retention rule (when is strip image deleted from Gemini logs?)

**RDC Mapping:**

- RDC 978 Art. 77 (LGPD privacy officer accountability)
- LGPD Arts. 7, 9, 18 (international transfer + consent + minimization)

**Impact:**

- Auditor flags as **blocking finding** if Phase 5 IA strip feature ships without DPIA
- Potential regulatory penalty (ANPD fine)
- Cannot proceed with Phase 5 strip rollout until resolved

**Fix Required:**

- [ ] Build LGPD Art. 9 DPIA addendum (1–2 page legal document)
  - Scope: Gemini Vision API (Google LLC, California, USA)
  - Data: Patient strip images (de-identified by patient ID, but could contain patient specimen info)
  - Processing: Classification (RDT result interpretation)
  - Retention: X days (define based on Gemini T&C audit)
  - Safeguards: TLS encryption in transit, Google SOC 2 compliance
- [ ] Amend POL-LGPD-001 v1.0 → v1.1 (add Art. 9 section)
- [ ] Add consent capture: Patient must tick "I consent to AI analysis via Google Gemini" before uploading
- [ ] RT/DPO sign-off (formal approval documented)
- [ ] Before strip feature ships (Phase 5 Week 2+)

**Estimated Effort:** 8 hours (legal document + consent UI + sign-off)  
**Blocker For:** Phase 5 IA task deployment (cannot ship without DPIA)

---

### BLOCKER 4: Critical Values UI is Placeholder

**File:** `src/features/criticos/CriticosPlaceholder.tsx`  
**Severity:** 🔴 CRITICAL — Feature Incomplete  
**Issue:**

- Backend works: `setCriticalThreshold`, `escalateCriticalValue` callables deployed
- Frontend doesn't exist: Placeholder shows "Phase 10-03: Em desenvolvimento"
- Missing components:
  - `CriticosThresholdsAdmin` (CRUD for thresholds)
  - `ComunicacaoModal` (SMS/email template editor)
  - `CriticosAlertHistory` (alert trending dashboard)
  - `SLAIndicator` (2-min delivery SLA status)

**RDC Mapping:**

- RDC 978 Art. 115–117 (Critical values + escalation)

**Impact:**

- Phase 5 cannot deploy if critical values feature is placeholder
- RT cannot manage thresholds (all hardcoded in code)
- No UI evidence for auditor (critical article compliance gap)

**Fix Required:**

- [ ] Build `CriticosThresholdsAdmin` component (4 hours)
  - List existing thresholds per analyte
  - Add/edit: lower bound, upper bound, escalation emails
  - Rules: RT-only access, soft-delete only
- [ ] Build `ComunicacaoModal` (3 hours)
  - Email/SMS template per analyte + severity
  - Placeholder tags: {{analiteName}}, {{value}}, {{patientName}}
- [ ] Build `CriticosAlertHistory` (4 hours)
  - Dashboard: alerts in last 24h/7d/30d, SLA compliance %, trending chart
  - Pagination (50 alerts per page)
- [ ] E2E tests: threshold CRUD → alert creation → email sent (3 hours)

**Estimated Effort:** 14 hours (UI implementation + tests)  
**Blocker For:** Phase 5 deploy (cannot launch critical escalation with placeholder UI)

---

### BLOCKER 5: Wave 0 Modules Status Conflict (lab-apoio, turnos)

**Status Conflict:**

- Root `CLAUDE.md` claims: `lab-apoio` + `turnos` "Em prod 2026-05-07"
- Module `CLAUDE.md` files claim: T5–T10 pending (deploy + claim provisioning)

**Severity:** 🟡 HIGH — Audit Blocker  
**Impact:**

- Auditor cannot determine truth state (contradictory documentation)
- v1.4 planning credits Phase 0 with these modules, but if not actually deployed, DICQ calculations invalid

**Fix Required:**

- [ ] Run `firebase functions:list` for current deployment
- [ ] Verify which Phase 0 modules actually deployed (T0–T10 check each)
- [ ] If deployed: Update module CLAUDE.md to match root CLAUDE.md
- [ ] If NOT deployed: Demote root CLAUDE.md rows to "In development" + add Phase X target
- [ ] Reconcile `.planning/phases/` trees (archive duplicates if exist)

**Estimated Effort:** 2 hours (audit + reconciliation)  
**Blocker For:** Phase 1 completion claim (cannot verify baseline if Wave 0 state unknown)

---

### BLOCKER 6: DICQ 78.5% → 82%+ Projection Unsupported

**Files:**

- `.planning/DICQ_CLOSURE_TRACKER_v1.4.md`
- `.planning/v1.4-PROJECT-SCOPE.md` (line 59, Table 1)

**Severity:** 🟡 HIGH — Planning Document Integrity  
**Issue:**

- Phase 5 DICQ contribution depends on:
  - Portal-RT (no implementation evidence)
  - Portal-paciente (no implementation evidence)
  - NOTIVISA integration (notivisa-portal placeholder only)
- Projected swing (78.5% → 82% in Phase 4, → 88% Phase 7) is **doc-driven, not code-driven**

**Impact:**

- DICQ tracker cannot be updated until implementation evidence exists
- Phase 4 deploy gate checks DICQ ≥82%, but if foundation is missing, gate fails
- Auditor questions optimistic projection during pre-alignment

**Fix Required:**

- [ ] Pause DICQ tracker updates until evidence aligns
- [ ] After Phase 4 deploy (2026-06-02): Re-audit actual DICQ score via external consultant
- [ ] Lock DICQ tracker updates to code commits only (not projections)
- [ ] Document measurement date + methodology in tracker (e.g., "2026-06-03 via SafeOps DICQ auditor")

**Estimated Effort:** 1 hour (process documentation)  
**Blocker For:** Go-live criteria validation (Phase 6+ must prove DICQ gains, not project them)

---

## PART 2: RDC 978 CRITICAL VIOLATIONS (12 Articles at Risk)

### A. ARTICLES WITH ZERO COVERAGE (3)

#### Art. 36–39: Laboratory Support Contracts (Laboratório de Apoio)

**Requirement:** Written contracts with support labs, annual evaluations, specified clauses (responsibility, methods, compliance, NC communication, traceability).

**Current Coverage:** 0% (NO implementation)  
**v1.3 Status:** `fornecedores` module tracks vendor metadata only (no contracts)  
**Impact:** IMMEDIATE audit violation

**Missing Implementation:**

- [ ] Collection: `fornecedores/{labId}/contratos/{contratoId}` (document storage, approval workflow)
- [ ] Fields: vendor CNPJ, contract date, Art. 37 clauses checklist (6 mandatory clauses)
- [ ] Firestore rules: RT-only approval, soft-delete only, audit trail on changes
- [ ] Annual evaluation workflow: schedule, approval, linked to vendor audit trail
- [ ] Integration tests: 5 critical flows (create contract, edit, approve, archive, evaluate)

**Phase Assignment:** 05-Special-A (Wave 0, Phase 5) → 06-05 (Phase 6 leverage)  
**Estimated Effort:** 8 hours (Phase 5) + 4 hours (Phase 6)  
**Predecessor:** None (can start immediately)  
**Target Completion:** 2026-06-01

**Fix Checklist:**

- [ ] Draft contract template (Art. 37 clauses)
- [ ] Firestore schema + rules
- [ ] RT approval callable
- [ ] Annual evaluation callable + dashboard
- [ ] Integration tests (100% coverage)
- [ ] Auditor approval (pre-alignment call Week 2 Phase 5)

---

#### Art. 122: Supervisor Presencial (On-Site Supervisor Requirement)

**Requirement:** Supervisor formally designated & **physically present** during all lab operating hours (RDC 986/2025: profissional habilitado or capacitado).

**Current Coverage:** 75% (Designation tracked; enforcement missing)  
**v1.3 Status:** `turnos` module tracks supervisor field but NO validation of actual presence  
**Impact:** Auditor can ask "Show me evidence supervisor was present on Shift X" → No answer = violation

**Missing Implementation:**

- [ ] Supervisor check-in/check-out within shift (timestamp validation, compare to shift hours)
- [ ] Block laudo finalization if supervisor NOT checked in during shift
- [ ] `supervisorHabitado` vs `supervisorCapacitado` role distinction (system knows difference)
- [ ] Daily supervisor presence report (for audit trail, RT reviews daily)
- [ ] Integration tests: shift creation → supervisor check-in → laudo signing (enforce presence)

**Phase Assignment:** 05-Special-B (Wave 0, Phase 5)  
**Estimated Effort:** 6 hours (Phase 5)  
**Predecessor:** Phase 0 (`turnos` module exists)  
**Target Completion:** 2026-06-08

**Fix Checklist:**

- [ ] Add `checkInTime`, `checkOutTime` fields to shift schema
- [ ] Firestore rules: enforce shift time bounds
- [ ] Check-in/check-out UI (simple timestamp capture)
- [ ] Callable: `finalizeLatido` blocks if supervisor not checked in
- [ ] Daily presence report callable (export for auditor)
- [ ] Integration tests (5 flows)

---

### B. ARTICLES WITH PARTIAL COVERAGE (4)

#### Art. 6: EAC Classification (Service Type Enforcement)

**Requirement:** System must validate that lab operations match declared service type (STI, STII, STIII, Itinerante).

**Current Coverage:** 50% (System assumes STIII; no validation rules)  
**v1.3 Status:** `labSettings.serviceTipo` exists but rules don't block out-of-scope access  
**Impact:** STII lab could theoretically access analysis-only features (blocker if multi-tenant expansion happens)

**Missing Implementation:**

- [ ] Firestore rules: Validate `serviceTipo` on laudo creation + analyzer access
- [ ] UI filters: Hide analysis-only modules for STII/STI labs
- [ ] Schema validation: Material type must match service type (e.g., STI can't have blood analysis)

**Phase Assignment:** Design spec (Phase 6 research) → Implementation (Phase 13 multi-tenant)  
**Estimated Effort:** 4 hours (research + spec) + 12 hours (Phase 13 implementation)  
**Target Completion:** Phase 6 research (2026-07-14 spec draft); Phase 13 impl (post-Aug 31)

**Fix Checklist:**

- [ ] Service type validation matrix (Art. 6 reference)
- [ ] Firestore rule examples for each service type
- [ ] ADR-0027 (Service Type Validation Architecture)
- [ ] Not blocking v1.4 (Riopomba = STIII only)

---

#### Art. 22: STI/STII Scope Validation (Material Type per Service Type)

**Requirement:** STII can only collect capillary, venous, oral; analysis limited to rapid tests at collection time (no laudo issuance).

**Current Coverage:** 50% (Material type tracked; scope rules missing)  
**v1.3 Status:** `insumo.materialType` exists but no rule prevents STII from creating laudos  
**Impact:** Potential license violation if STII incorrectly issues report

**Missing Implementation:**

- [ ] Firestore rules: Block `laudo` creation if `serviceTipo == 'STII'` (STII cannot issue laudos)
- [ ] Validation: Material type must be in allowed set per service type
- [ ] UI: Analysis UI hidden for STII/STI labs

**Phase Assignment:** Design spec (Phase 6) → Implementation (Phase 13)  
**Estimated Effort:** 2 hours (research) + 8 hours (Phase 13 impl)  
**Target Completion:** Phase 6 research (2026-07-14)

---

#### Art. 86: PGQ (Programa de Garantia da Qualidade) — 6 Mandatory Components

**Requirement:** PGQ must have all 6 components interconnected: (1) Gerenciamento tecnologias, (2) Riscos, (3) Documentos, (4) Pessoal+EC, (5) Processos operacionais, (6) CIQ/CEQ.

**Current Coverage:** 70% (Components 1, 3, 6 mostly live; 2, 4, 5 partial)

| Component                | Module                              | Status | Gap                               |
| ------------------------ | ----------------------------------- | ------ | --------------------------------- |
| 1. Tech Management       | `equipamentos`                      | 70%    | In-service inspection TBD         |
| 2. Risk Management       | `risks` (FMEA-lite)                 | 50%    | Formal review cycle TBD (Phase 8) |
| 3. Document Management   | `sgq` (SGD)                         | 95%    | Complete (Drive importer live)    |
| 4. Personnel + EC        | `personnel` + `educacao-continuada` | 75%    | Unified dossiè TBD (Phase 9)      |
| 5. Operational Processes | `pops` + `turnos`                   | 60%    | Supervisor presence TBD (Phase 5) |
| 6. CIQ/CEQ Management    | `coagulacao`, `bioquimica`, `ceq`   | 90%    | Thresholds config TBD (Phase 5)   |

**Missing Implementation:**

- [ ] Phase 5: Critical thresholds UI + supervisor presence rules
- [ ] Phase 8: Formal management review meeting (all 6 components reviewed together)
- [ ] Phase 9: Unified personnel dossiè (Component 4 consolidation)
- [ ] Phase 8: PGQ integration verification (Component cross-linking in audit trail)

**Phase Assignment:** Distributed (05, 06, 08, 09)  
**Estimated Effort:** 26 hours across phases  
**Target Completion:** Phase 9 complete (2026-08-04)

**ADR Required:** ADR-0028 (PGQ Integration Pattern)

---

#### Art. 167: Laudo (Clinical Report) — 14 Mandatory Fields

**Requirement:** Laudo must contain all 14 fields including reference values, technical limitations, interpretation data (fields 10–12).

**Current Coverage:** 65% (Fields 1–9 implemented; fields 10–12 missing; PDF not generated)

| Fields                     | Status     | Implementation                               |
| -------------------------- | ---------- | -------------------------------------------- |
| 1–9 (Core info)            | ✅ Live    | Service, RT, patient, result                 |
| 10 (Reference values)      | 🟡 Partial | Exists in bula parser, NOT rendered in laudo |
| 11 (Technical limitations) | ❌ Missing | E.g., "valid for conc >5 ng/mL"              |
| 12 (Restricted material)   | ❌ Missing | Not tracked                                  |
| 13 (Issue date)            | ✅ Live    | Automatic                                    |
| 14 (Legal signature)       | ✅ Live    | LogicalSignature HMAC                        |

**Missing Implementation:**

- [ ] Phase 6 Task 06-01: Add fields 10–12 to laudo schema + template
- [ ] Phase 6 Task 06-02: PDF generation (CloudFunction + puppeteer)
- [ ] Phase 6 Task 06-03: Portal médico external access (RT downloads/shares PDF)

**Phase Assignment:** Phase 6 (Liberación completion)  
**Estimated Effort:** 8 hours (06-01) + 12 hours (06-02) + 4 hours (06-03) = 24 hours  
**Target Completion:** 2026-07-14

**Fix Checklist:**

- [ ] Laudo schema: add `referenceRange`, `technicalLimitations`, `interpretationData`
- [ ] Add `inHouseMethodology` enum + validation
- [ ] Add `restrictedMaterial` flag + documentation link
- [ ] PDF template: render all 14 fields with proper formatting
- [ ] PDF CF: Firestore audit trail (who generated when)
- [ ] Portal: RT can list PDFs, download, share via QR + email

---

### C. ARTICLES WITH GOOD COVERAGE (4)

These are on track; no major gaps:

- **Art. 128–131 (Rastreabilidade):** ✅ 95% live (TraceabilityEvent, HMAC chain-hash)
- **Art. 204 (Audit Trail):** ✅ 100% live (auditoria module, immutable rules)
- **Art. 99 (CEQ):** ✅ 80% live (module exists; enforcement TBD Phase 9)
- **Art. 6 (Notification):** ✅ Phase 4 NOTIVISA queue (Art. 6º §1)

---

## PART 3: DICQ COVERAGE GAPS BY BLOCK (25 Gaps)

| Block                      | Target | Gap  | Implementation Phase           |
| -------------------------- | ------ | ---- | ------------------------------ |
| **A — Governança**         | 88%    | +10% | Phase 8 (mgmt review)          |
| **B — Gestão Documental**  | 80%    | +15% | Phase 6 (contract docs)        |
| **C — Pessoal**            | 85%    | +5%  | Phase 9 (unified dossiè)       |
| **D — Ambiente**           | 65%    | +7%  | Phase 9 (equipment validation) |
| **E — Pré-analítico**      | 70%    | +6%  | Phase 6–7 (collection SOP)     |
| **F — Analítico**          | 96%    | +4%  | Phase 5–6 (critical values UI) |
| **G — Pós-analítico**      | 92%    | +14% | Phase 6 (PDF + portal)         |
| **H — Garantia Qualidade** | 92%    | +10% | Phase 7 (feedback trending)    |
| **I — Laudos/Liberação**   | 90%    | +40% | Phase 6 (laudo fields + PDF)   |
| **J — Continuidade**       | 78%    | +0%  | Phase 9 (SLA monitoring)       |

**Total DICQ Gains Required:** +111 points (78.5% + 111 points ÷ total = 88%+ target)

---

## PART 4: PENDING PHASE DELIVERABLES (32 Tasks)

### Phase 4: Portal Auth + NOTIVISA Integration (2.5 weeks, May 20 → Jun 2)

**Status:** 📋 PLANNED (not started)

#### Task 04-01: Portal Auth Callable + Laudo Access

**Deliverables:**

- [ ] `rtPortalLogin(email, password)` callable (unit + integration tests)
- [ ] `listLaudosDraft(labId, rtId)` callable (pagination tested)
- [ ] `fetchLaudoForReview(laudoId)` callable (signature context included)
- [ ] Auth service module (token refresh logic, session persistence)
- [ ] Test mocks for auth flows

**Estimated Effort:** 16 hours  
**Dependencies:** Phase 3 schema (laudos-draft collection)  
**Acceptance Criteria:**

- [ ] 3 callables deployed
- [ ] Unit tests: 100% coverage (happy path + error cases)
- [ ] Integration tests: Session persistence across refresh token
- [ ] E2E: Login → list drafts → fetch specific laudo → sign → audit trail

---

#### Task 04-02: Portal UI Components (Dark-First, WCAG AA)

**Deliverables:**

- [ ] `PortalShell` (navigation, header, footer)
- [ ] `DraftEditor` (laudo form, read-only mode)
- [ ] `LaudoPanel` (laudo details, signature button)
- [ ] `AccessLog` (audit trail display)
- [ ] `NotificationCenter` (NOTIVISA status, errors)
- [ ] Responsive design (desktop + tablet)
- [ ] WCAG AA compliance (contrast, keyboard nav, labels)

**Estimated Effort:** 20 hours  
**Dependencies:** Design system (dark-first tokens), Phase 4-01 callables  
**Acceptance Criteria:**

- [ ] All 5 components render correctly
- [ ] Accessibility audit: 0 errors (axe, WAVE)
- [ ] Responsiveness tested (1920px, 1024px, 768px viewports)
- [ ] Lighthouse CI: performance score ≥90, accessibility ≥95

---

#### Task 04-03: NOTIVISA Queue Processor

**Deliverables:**

- [ ] Async job scheduler (Phase 3 schema: notivisa-queue)
- [ ] Polling logic (30s intervals, exponential backoff on failure)
- [ ] Event transformation (laudo → NOTIVISA payload)
- [ ] Retry mechanism (max 3 retries, 5 min between retries)
- [ ] Dashboard component (queue status, stuck jobs, retry history)

**Estimated Effort:** 16 hours  
**Dependencies:** Phase 3 schema (notivisa-queue), government NOTIVISA sandbox access  
**Acceptance Criteria:**

- [ ] Queue processor polls every 30s
- [ ] 100% of events processed in 24h (0 failures in staging)
- [ ] Exponential backoff tested (delays: 30s, 60s, 120s)
- [ ] Dashboard shows queue depth, error rate, last sync time

---

#### Task 04-04: E2E Testing + Cloud Logs Monitoring

**Deliverables:**

- [ ] 8 critical E2E flows (Cypress or Playwright)
  1. RT login → portal loads
  2. List drafts → pagination works
  3. Fetch laudo → signature widget loads
  4. Sign laudo → HMAC generated
  5. Mark submitted → NOTIVISA queue updated
  6. Polling works → status updates
  7. Error handling → retry UI shown
  8. Audit trail → events immutable
- [ ] 24h Cloud Logs baseline capture (check for errors, warnings, performance)
- [ ] Smoke test suite (19 baseline flows still passing)

**Estimated Effort:** 12 hours  
**Dependencies:** All Phase 4 tasks (01–03 complete)  
**Acceptance Criteria:**

- [ ] 8 E2E flows: 100% PASS
- [ ] 738 baseline unit tests: 100% PASS (no regressions)
- [ ] Cloud Logs: 0 errors, <5% warning rate over 24h
- [ ] Build succeeds: `npm run build` <35s

---

### Phase 5: Critical Escalation + IA Training Dataset (3 weeks, Jun 9 → Jun 30)

**Status:** 📋 PLANNING (Critical blockers identified above)

#### Task 05-Special-A (Wave 0): Fornecedores Contratos (Lab Support Contracts)

**Deliverables:**

- [ ] Firestore schema: `fornecedores/{labId}/contratos/{contratoId}`
- [ ] Firestore rules: RT-only CRUD, soft-delete only, audit trail
- [ ] Contract template with Art. 37 clauses (6 mandatory fields checklist)
- [ ] Callable: `createContract(labId, vendorCNPJ, contractData)`
- [ ] Callable: `approveContract(contractId, approverId)` (RT-only)
- [ ] Callable: `scheduleAnnualEvaluation(contractId, evaluationDate)`
- [ ] Integration tests (5 flows: create, edit, approve, archive, evaluate)

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-06-01  
**Predecessor:** Phase 0 (auth framework exists)  
**Blocker For:** Phase 6 (cannot close Art. 36–39 without this)

---

#### Task 05-Special-B (Wave 0): Turnos Supervisor Presence

**Deliverables:**

- [ ] Schema: Add `checkInTime`, `checkOutTime`, `supervisorHabitado` fields
- [ ] Callable: `supervisorCheckIn(shiftId, timestamp)` (with shift time validation)
- [ ] Callable: `supervisorCheckOut(shiftId, timestamp)`
- [ ] Firestore rules: Enforce shift time bounds (cannot check in before shift start)
- [ ] UI: Check-in/check-out buttons (timestamp capture)
- [ ] Callable: `finalizeLatido` block if supervisor not checked in
- [ ] Daily report: `generateSupervisorPresenceReport(labId, date)` (auditor export)
- [ ] Integration tests (5 flows: shift creation → check-in → laudo signing)

**Estimated Effort:** 6 hours  
**Target Completion:** 2026-06-08  
**Predecessor:** Phase 0 (`turnos` module exists)  
**Blocker For:** Phase 6 (cannot verify Art. 122 without presence logs)

---

#### Task 05-01: Critical Thresholds + SMS/Email Integration

**Deliverables:**

- [ ] Callable: `setCriticalThreshold(labId, analyte, lowerBound, upperBound, escalationEmails)`
- [ ] Callable: `escalateCriticalValue(resultId, analyteName, value, operatorId)`
- [ ] SMS integration (Twilio API, credential in Secret Manager)
- [ ] Email integration (SendGrid API, template per analyte)
- [ ] SLA tracking: Store escalation timestamp + delivery timestamp
- [ ] Unit tests: 100% coverage (threshold validation, email template rendering)
- [ ] Integration tests: Critical value → SMS sent <2 min

**Estimated Effort:** 12 hours  
**Target Completion:** 2026-06-16  
**Predecessor:** Phase 3 schema (criticos-escalacoes), Phase 0 HMAC (fix Blocker 1)

---

#### Task 05-02: Critical Detection Engine + Dashboard

**Deliverables:**

- [ ] Real-time critical value detection rule engine (Firestore trigger)
- [ ] SLA tracking dashboard (escalation history, trending, status indicators)
- [ ] Components:
  - `CriticosThresholdsAdmin` (CRUD thresholds)
  - `ComunicacaoModal` (SMS/email template editor)
  - `CriticosAlertHistory` (24h/7d/30d view)
  - `SLAIndicator` (2-min delivery status, color-coded)
- [ ] E2E tests: Threshold creation → value result → escalation → SMS/email → dashboard update

**Estimated Effort:** 14 hours (fixes Blocker 4)  
**Target Completion:** 2026-06-23  
**Predecessor:** Task 05-01

---

#### Task 05-03: IA Strip Upload + Gemini Vision Integration

**Deliverables:**

- [ ] UI: Strip image uploader (batch, drag-and-drop, preview)
- [ ] `classifyStripGemini` callable (already exists, use as-is)
- [ ] Dataset versioning schema: `imuno-ias-dev/{labId}/datasets/{version}/{recordId}`
- [ ] Callable: `batchClassifyStrips(labId, imageBase64Array)` (async, queued)
- [ ] Integration: Gemini Vision API with latency <5s per image
- [ ] Confidence threshold: 0.85 (low confidence images flagged for review)
- [ ] Audit trail: Log image source, classification result, operator ID
- [ ] Integration tests: Upload 100+ images, verify all classified, confidence distribution

**Estimated Effort:** 16 hours  
**Target Completion:** 2026-06-30  
**Predecessor:** Task 05-01 (infrastructure), Phase 3 schema  
**LGPD Requirement:** Must fix Blocker 3 (DPIA) before deployment

---

#### Task 05-04: IA Model Versioning + A/B Testing Framework

**Deliverables:**

- [ ] Collection: `imuno-ias-dev/{labId}/models/{modelId}/versions/{versionId}`
- [ ] v1.0 baseline (fixed, no retraining)
- [ ] v1.1+ experiment tracking (model accuracy, false positive rate)
- [ ] Callable: `createModelVersion(labId, baselineVersion, experimentName)` (clone v1.0)
- [ ] Callable: `evalModelVersion(versionId, testSetImages)` (classification on test set)
- [ ] Dashboard: Compare v1.0 vs v1.1 (accuracy, precision, recall, F1)
- [ ] Rules: Read access for RT only, audit trail on evaluations
- [ ] Integration tests: Create v1.0 → clone v1.1 → evaluate both → compare metrics

**Estimated Effort:** 12 hours  
**Target Completion:** 2026-06-30  
**Predecessor:** Task 05-03

---

### Phase 6: Liberación Completion & Críticos Polish (2 weeks, Jul 1 → Jul 14)

**Status:** 📅 PLANNED

#### Task 06-01: Laudo Fields 10–12 + In-House Methodology

**Deliverables:**

- [ ] Schema: Add `referenceRange`, `technicalLimitations`, `interpretationData`, `inHouseMethodology`, `restrictedMaterial`
- [ ] Validation:
  - `referenceRange`: Range string (e.g., "0.1–0.5 ng/mL")
  - `technicalLimitations`: Free text (e.g., "Valid for concentrations >5 ng/mL")
  - `interpretationData`: JSON (CLSI/Westgard rules context)
  - `inHouseMethodology`: Enum (CLIA-approved or standard method)
  - `restrictedMaterial`: Boolean + documentation link
- [ ] Laudo template: Render all 14 fields in human-readable format
- [ ] Unit tests: Field validation, template rendering
- [ ] Integration tests: Laudo creation → all fields saved → query retrieval

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-07-07  
**Predecessor:** Phase 3 (laudos schema)

---

#### Task 06-02: PDF Generation CloudFunction + QR Code

**Deliverables:**

- [ ] CloudFunction callable: `generateLaudoPDF(laudoId, options)`
  - Input: laudoId, format (A4, letter), branding (logo, footer)
  - Output: PDF URL (stored in Cloud Storage)
  - Processing: Async queue, webhook notification on completion
- [ ] Template: HTML → PDF via puppeteer (server-side)
  - Render all 14 fields with proper formatting
  - Include QR code (links to NOTIVISA queue if submitted)
  - Footer: Issue date, signature hash (truncated, first 16 chars)
- [ ] Firestore audit trail: `laudos/{laudoId}/pdfGenerations/{timestamp}`
  - Log: who requested, when, PDF URL, file size
- [ ] Error handling: If PDF generation fails, retry up to 3x (exponential backoff)
- [ ] Performance: <3s latency for typical laudo (target SLA)
- [ ] Integration tests: Create laudo → generate PDF → verify QR works

**Estimated Effort:** 12 hours  
**Target Completion:** 2026-07-10  
**Predecessor:** Task 06-01

---

#### Task 06-03: Portal Médico External Access + NOTIVISA Linkage

**Deliverables:**

- [ ] Portal UI: RT external access (email-link auth, 72h TTL)
- [ ] Callable: `generateRTAccessLink(laudoId, rtEmail)` (generate link, send email)
- [ ] Email template: Link + laudo summary + download button
- [ ] Portal view: Read-only laudo display + PDF download button
- [ ] NOTIVISA linkage: QR code points to portal (verification link)
- [ ] Access control: RT can only view laudos from their assigned lab
- [ ] Firestore rules: `laudos/{labId}/portal-access/{accessId}` (immutable log)
- [ ] E2E tests: Generate link → click email link → portal loads → PDF downloads

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-07-12  
**Predecessor:** Tasks 06-01, 06-02, Phase 4 (portal auth foundation)

---

#### Task 06-04: Equipment Validation Certs (Calibration Schedule)

**Deliverables:**

- [ ] Schema: Add `calibrationSchedule`, `lastCalibrationDate`, `nextCalibrationDate`, `certificateLink`
- [ ] Callable: `scheduleEquipmentCalibration(equipmentId, scheduledDate)` (RT-only)
- [ ] Callable: `uploadCalibrationCertificate(equipmentId, pdfBase64, issuer)` (RT-only)
- [ ] Dashboard: Equipment status (in-service, scheduled, overdue, archived)
- [ ] Alert: Red flag if calibration overdue (RT notified daily)
- [ ] Firestore rules: Calibration history append-only (immutable)
- [ ] Integration tests: Schedule → upload cert → dashboard shows status

**Estimated Effort:** 6 hours  
**Target Completion:** 2026-07-14  
**Predecessor:** Phase 0 (`equipamentos` module)

---

#### Task 06-05: Lab Apoio Contract Verification

**Deliverables:**

- [ ] Leverages 05-Special-A (contratos schema)
- [ ] Callable: `verifyContractCompliance(contratoId)` (check all Art. 37 clauses present)
- [ ] Dashboard: Contract audit trail (creation, approval, evaluation, archive)
- [ ] Report: Generate contract compliance report (all clauses present, annual eval due date)
- [ ] Integration: Link vendor activities to contract (for auditor traceability)

**Estimated Effort:** 4 hours  
**Target Completion:** 2026-07-14  
**Predecessor:** Phase 5 Task 05-Special-A

---

### Phase 7: Reclamações/Satisfação + Portal Paciente (3 weeks, Jul 8 → Jul 28)

**Status:** 📅 PLANNED

#### Task 07-01: Patient Email-Link Auth

**Deliverables:**

- [ ] Callable: `generatePatientAccessLink(feedbackId, patientEmail)` (72h TTL)
- [ ] Token structure: HMAC-SHA256(patientId + timestamp + salt)
- [ ] Email template: Link + feedback summary + no login required message
- [ ] Firestore rules: `portal-paciente/{labId}/access-links/{linkId}` (immutable)
- [ ] Validation: Check TTL, HMAC signature, patient identity
- [ ] Resend logic: Max 3 resends per hour (rate-limited)
- [ ] Integration tests: Generate link → click → portal loads → access valid

**Estimated Effort:** 6 hours  
**Target Completion:** 2026-07-15  
**Predecessor:** Phase 4 portal auth foundation

---

#### Task 07-02: Portal Paciente UI (Dark-First, WCAG AA)

**Deliverables:**

- [ ] Components:
  - `PatientFeedbackForm` (text input, rating scale, attachments optional)
  - `FeedbackTracker` (status: received, reviewing, resolved; timeline)
  - `PortalLayout` (minimal header, centered form, footer)
- [ ] Responsive: Mobile-first (360px+), tablet, desktop
- [ ] WCAG AA: Color contrast, keyboard nav, screen reader tested
- [ ] Styling: Dark-first tokens (bg-[#141417], white/80 text)
- [ ] E2E test: Load form → submit → confirmation message

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-07-20  
**Predecessor:** Task 07-01

---

#### Task 07-03: Feedback Submission Callable + Audit Trail

**Deliverables:**

- [ ] Callable: `submitPatientFeedback(labId, patientName, feedback, rating)` (anonymous option)
- [ ] Validation: <5000 chars, non-empty, rating 1–5
- [ ] Storage: `portal-paciente/{labId}/feedback/{feedbackId}`
- [ ] Audit trail: LogicalSignature (hash + timestamp + operator)
- [ ] RT notification: Email/push when feedback received
- [ ] Acknowledgment: Auto-reply email to patient (feedback received)
- [ ] Integration tests: Submit feedback → stored → RT notified → patient receives ack

**Estimated Effort:** 6 hours  
**Target Completion:** 2026-07-22  
**Predecessor:** Task 07-01

---

#### Task 07-04: Trending Dashboard + Cron Aggregation

**Deliverables:**

- [ ] CloudFunction cron: `refreshFeedbackAggregates` (nightly 01:00 BRT)
  - Aggregate: feedback count, average rating, trending topics (keyword extraction)
  - Store: `portal-paciente/{labId}/_trending/{period}` (daily, weekly, monthly)
- [ ] Dashboard components:
  - `TrendingChart` (feedback count over time)
  - `RatingDistribution` (1–5 star histogram)
  - `TopicsCloud` (word frequency, trending keywords)
  - `ResponseTimeMetric` (avg time from feedback to RT response)
- [ ] Filters: Date range, feedback status, rating
- [ ] Export: PDF report (compliance evidence)
- [ ] Integration tests: Submit 50+ feedbacks → cron runs → dashboard shows aggregates

**Estimated Effort:** 10 hours  
**Target Completion:** 2026-07-26  
**Predecessor:** Task 07-03

---

#### Task 07-05: LGPD Compliance + Anonymization

**Deliverables:**

- [ ] Reuse Phase 0 anonymization helper (extend to feedback collection)
- [ ] Callable: `anonymizeFeedbackExport(labId, dateRange)` (scrub patient PII)
  - Remove: name, email, phone, address, CPF
  - Keep: rating, feedback text (may contain indirect PII — manual review)
  - Log: who exported when, how many records
- [ ] Rules: Patient cannot view other patients' feedback (only their own)
- [ ] Firestore rules: Enforce anonymous export (rule blocks non-anonymized reads)
- [ ] Retention: Feedback deleted 90 days after resolution (LGPD Art. 17)
- [ ] Consent: Patient must tick "I consent to feedback processing" before submitting
- [ ] Integration tests: Submit → export (anonymized) → verify PII scrubbed

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-07-28  
**Predecessor:** Task 07-04

---

### Phase 8: CAPA Closure (4 weeks, Jun 15 → Aug 5)

**Status:** 📅 CRITICAL PATH (not optional)

#### Task 08-01 through 08-07: Evidence Gathering for 12 Findings

**Deliverables per finding (5 mandatory artifacts):**

- [ ] F-01: Supervisor audit trail + daily presence reports + sample evidence
- [ ] F-02: LGPD policy document (SGD) + staff access log + consent forms
- [ ] F-03: Lab-apoio contracts + annual evaluation history + compliance report
- [ ] F-04: Risk FMEA spreadsheet + management sign-off + follow-up actions
- [ ] F-05: Management review meeting minutes + attendance + decisions
- [ ] F-06: Document distribution approval + record of staff acknowledgment
- [ ] F-07: Rastreability audit chain + sample 20 specimens (full trace) + HMAC verification
- [ ] F-08 through F-12: Similar detailed evidence per finding (specifications in CAPA plan)

**Estimated Effort:** 30 hours (distributed Week 1–4)  
**Target Completion:** 2026-08-05  
**Predecessor:** Phase 4–7 modules deployed

---

#### Task 08-99: Management Review Meeting + Auditor Sign-Off

**Deliverables:**

- [ ] Meeting agenda: Review all 6 PGQ components + audit findings closure
- [ ] Attendees: CTO, RT, Auditor (required)
- [ ] Documentation: Meeting minutes, attendance, decisions
- [ ] Auditor sign-off: "All 7 findings resolved, lab ready for external audit"
- [ ] Ceremony: Formal closing (photo, certificate if applicable)

**Estimated Effort:** 4 hours  
**Target Completion:** 2026-08-05  
**Predecessor:** All F-01 through F-07 evidence complete

---

### Phase 9: Extended Analytics & KPI Optimization (2 weeks, Jul 22 → Aug 4)

**Status:** 📅 PLANNED

#### Task 09-01: Multi-Period KPI Queries

**Deliverables:**

- [ ] Callable: `generateMultiPeriodReport(labId, dateRange, metrics)` (async)
  - Metrics: turnaround time, rework %, conformance %, NC origin
  - Compare current month vs. prior 3 months
  - Return: JSON with trend data + aggregates
- [ ] Dashboard: Line chart showing trends + baseline comparison
- [ ] Export: PDF report with charts
- [ ] Integration tests: Generate report → verify trends correct

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-07-29  
**Predecessor:** Phase 3 (kpis module exists)

---

#### Task 09-02: Trend Projection (Linear Regression)

**Deliverables:**

- [ ] Library: ml.js (simple linear regression, ~20 KB gzip)
- [ ] Callable: `projectTrendline(labId, metric, periods)` (4-week forecast)
  - Input: metric, number of historical periods (weeks/months)
  - Output: projected value, R² (goodness of fit)
  - Caveat: Disabled if R² <0.8 (low linearity)
- [ ] Dashboard: Line chart with historical + projected (dashed line)
- [ ] UI warning: "Indicative projection, not a forecast"
- [ ] Integration tests: Project 4 weeks ahead for TAT metric

**Estimated Effort:** 6 hours  
**Target Completion:** 2026-07-31  
**Predecessor:** Task 09-01

---

#### Task 09-03: Riopomba Historical Integration

**Deliverables:**

- [ ] Data spike: Validate 1-week historical sample from Riopomba (data quality check)
- [ ] Transformation pipeline: Map Riopomba schema → KPI schema
- [ ] Bulk import: Load 1-year historical data
- [ ] Benchmark dashboard: Current lab KPIs vs. Riopomba historical baseline
- [ ] Integration tests: Verify data accuracy on sample set

**Estimated Effort:** 10 hours  
**Target Completion:** 2026-08-02  
**Predecessor:** Riopomba data access granted

---

#### Task 09-04: Analytics Caching Strategy

**Deliverables:**

- [ ] CloudFunction cron: `refreshAnalyticsCaches` (nightly 02:00 BRT)
  - Compute: Multi-period KPI aggregates per lab
  - Store: `analytics/{labId}/_cache/{period}` (daily, weekly, monthly)
  - Metrics: TAT, rework %, conformance, NC origin distribution
- [ ] Firestore: Aggregates as pre-computed docs (reads <100ms, not computed on-demand)
- [ ] Dashboard: Loads cache (not raw data query)
- [ ] Fallback: If cron fails, dashboard shows "data unavailable"
- [ ] Monitoring: Alert if cron fails >2 consecutive runs

**Estimated Effort:** 6 hours  
**Target Completion:** 2026-08-03  
**Predecessor:** Tasks 09-01, 09-02

---

#### Task 09-05: PDF Batch Export + Optimization

**Deliverables:**

- [ ] Callable: `batchExportPDFs(labId, laudoIds, format)` (async queue)
  - Input: Array of laudo IDs
  - Output: ZIP file (Cloud Storage URL)
  - Max: 50 PDFs per batch (memory constraint)
- [ ] Stream-to-Cloud-Storage: Never hold full ZIP in memory
- [ ] Compression: gzip (target <50% original size)
- [ ] User notification: Email when ZIP ready (async)
- [ ] Integration tests: Export 50 PDFs → verify ZIP valid → decompress + count files

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-08-04  
**Predecessor:** Phase 6 Task 06-02 (PDF CF)

---

### Phase 10: Penetration Testing (3 weeks, Jun 1 → Jun 21)

**Status:** 📅 EXTERNAL CONSULTANT

#### Task 10-XX: Security Pen-Test (External Consultant)

**Scope:**

- Portal médico authentication + session management
- Portal paciente external access + cross-tenant isolation
- LGPD data handling (consent, anonymization, deletion)
- API rate limiting + DDoS protection
- Firestore rules analysis (privilege escalation, data leakage)

**Deliverables:**

- [ ] Pen-test report (findings, severity, remediation)
- [ ] <3 medium findings target
- [ ] Zero critical findings acceptable

**Estimated Effort:** 80 hours (external 3-week engagement)  
**Cost:** $15K (pre-approved)  
**Target Completion:** 2026-06-21  
**Remediation:** 2026-07-04 (parallel to Phase 6)

---

### Phase 11: Auditor Pre-Alignment (8 weeks, Jun 1 → Aug 5)

**Status:** 📅 ONGOING (Weekly calls)

#### Task 11-XX: Weekly Auditor Sync

**Schedule:** Every Monday 10:00 BRT (30–60 min)  
**Agenda:**

- Week 1 (Jun 1): Portal architecture review + NOTIVISA integration
- Week 2 (Jun 8): Critical escalation + IA training dataset demo
- Week 3 (Jun 15): CAPA closure progress (F-01 → F-04)
- Week 4 (Jun 22): Extended modules polish (Liberación, Reclamações)
- Weeks 5–8: Continue weekly through CAPA ceremony (Aug 5)

**Deliverables:**

- [ ] Meeting notes archived (Google Drive)
- [ ] Auditor approvals / concerns logged
- [ ] Action items tracked (both sides)

**Estimated Effort:** 30 hours (CTO + RT lead)  
**Target Completion:** Ongoing (weekly through Aug 5)

---

### Phase 12: Test Data Refresh + Riopomba Validation (4 days, Jul 29 → Aug 2)

**Status:** 📅 PLANNED

#### Task 12-01: Test Data Regeneration

**Deliverables:**

- [ ] Regenerate test suite (50+ labs, 1M+ records)
- [ ] Smoke test all new Phase 4–7 surfaces
- [ ] Verify all 19 baseline flows still pass

**Estimated Effort:** 8 hours  
**Target Completion:** 2026-08-01

---

#### Task 12-02: Riopomba Validation + DICQ Audit

**Deliverables:**

- [ ] Spot-check 100 Riopomba documents (DICQ Block B compliance)
- [ ] Verify 80 docs migrated correctly (no data loss)
- [ ] Validate against DICQ 4.3 requirements

**Estimated Effort:** 4 hours  
**Target Completion:** 2026-08-02

---

#### Task 12-03: PDF Export Validation

**Deliverables:**

- [ ] Sample 100 laudos
- [ ] Generate PDFs for each
- [ ] Verify all 14 fields present
- [ ] QR codes valid
- [ ] Signatures present

**Estimated Effort:** 4 hours  
**Target Completion:** 2026-08-02

---

## PART 5: INFRASTRUCTURE GAPS (7)

| Gap                                | Component                                  | Status                         | Phase      | Effort      | Priority |
| ---------------------------------- | ------------------------------------------ | ------------------------------ | ---------- | ----------- | -------- |
| **1. Puppeteer in CloudFunction**  | PDF generation                             | Memory/timeout planning needed | Phase 6    | 4h research | HIGH     |
| **2. Email service setup**         | SendGrid or Firebase Email                 | Not configured                 | Phase 7    | 2h setup    | HIGH     |
| **3. Twilio SMS integration**      | Critical escalation                        | Not configured                 | Phase 5    | 2h setup    | HIGH     |
| **4. Secret management**           | Gemini API key, Twilio token, SendGrid key | PENDING_SET tokens             | Phases 5–7 | 1h audit    | CRITICAL |
| **5. Analytics caching layer**     | Redis vs. Firestore aggregates             | Design pending                 | Phase 9    | 4h research | MEDIUM   |
| **6. Email link token management** | Patient portal auth                        | New pattern                    | Phase 7    | 2h design   | HIGH     |
| **7. Lighthouse CI integration**   | Pre-merge performance gate                 | Not active                     | Phase 6    | 3h setup    | MEDIUM   |

---

## PART 6: SUMMARY BY TIMELINE

### Immediate Actions (by 2026-05-20)

**MUST COMPLETE before Phase 4 kickoff:**

1. **Fix Blocker 1 (HMAC signatures)** — 4h
2. **Fix Blocker 4 (Critical Values UI scope)** — 2h clarification (actual UI: Phase 5)
3. **Reconcile Wave 0 module status (Blocker 5)** — 2h
4. **Pause DICQ tracker (Blocker 6)** — 1h process doc
5. **Brief LGPD Art. 9 DPIA requirement (Blocker 3)** — 1h
6. **Contract template draft (05-Special-A)** — 4h CTO review

**Subtotal:** 14 hours (sequential, mostly CTO-driven)

---

### Phase 4 Execution (May 20 → Jun 2)

**32 hours of implementation:**

- 04-01: Portal auth callable (16h)
- 04-02: Portal UI components (20h)
- 04-03: NOTIVISA queue processor (16h)
- 04-04: E2E testing + Cloud Logs (12h)
- **Total per phase plan:** 64 hours (compressed across 4 agents = 2.5 weeks)

---

### Phase 5 Execution (Jun 9 → Jun 30)

**82 hours of implementation:**

- 05-Special-A: Lab contracts (8h, already planned)
- 05-Special-B: Supervisor presence (6h, already planned)
- 05-01: Critical thresholds (12h)
- 05-02: Critical engine + dashboard (14h, fixes Blocker 4)
- 05-03: IA strip upload (16h, + Blocker 3 LGPD DPIA 8h = 24h total)
- 05-04: Model versioning (12h)
- **Total per phase plan:** 88 hours (4 agents, 3 weeks)

---

### Phase 6 Execution (Jul 1 → Jul 14)

**38 hours of implementation:**

- 06-01: Laudo fields 10–12 (8h)
- 06-02: PDF generation CF (12h)
- 06-03: Portal médico external (8h)
- 06-04: Equipment validation (6h)
- 06-05: Lab contract verification (4h)
- **Total:** 38 hours (2–3 agents, 2 weeks)

---

### Phase 7 Execution (Jul 8 → Jul 28)

**46 hours of implementation:**

- 07-01: Patient email-link auth (6h)
- 07-02: Portal paciente UI (8h)
- 07-03: Feedback submission callable (6h)
- 07-04: Trending dashboard + cron (10h)
- 07-05: LGPD anonymization (8h)
- 07-99: E2E testing (8h)
- **Total:** 46 hours (2–3 agents, 3 weeks)

---

### Phase 8 Execution (Jun 15 → Aug 5)

**34 hours of implementation:**

- 08-01 through 08-07: Evidence gathering (30h)
- 08-99: Management review meeting (4h)
- **Total:** 34 hours (CTO-heavy, sequential)

---

### Phase 9 Execution (Jul 22 → Aug 4)

**38 hours of implementation:**

- 09-01: Multi-period KPI queries (8h)
- 09-02: Trend projection (6h)
- 09-03: Riopomba integration (10h)
- 09-04: Analytics caching (6h)
- 09-05: PDF batch export (8h)
- **Total:** 38 hours (2 agents, 2 weeks)

---

### Phase 10 (Jun 1 → Jun 21)

**80 hours external pen-test** (not implemented by team)  
**Cost:** $15K

---

### Phase 11 (Jun 1 → Aug 5)

**30 hours auditor sync** (meeting + context, not implementation)

---

### Phase 12 (Jul 29 → Aug 2)

**16 hours test data refresh + validation**

---

## GRAND TOTAL

| Category       | Hours         | FTE-Weeks           | Status                 |
| -------------- | ------------- | ------------------- | ---------------------- |
| **Phases 4–5** | 150           | 8–10                | 📅 PLANNED             |
| **Phases 6–7** | 84            | 5–6                 | 📅 PLANNED             |
| **Phase 8**    | 34            | 2–3                 | 📅 PLANNED (CTO-heavy) |
| **Phase 9**    | 38            | 2–3                 | 📅 PLANNED             |
| **Phase 10**   | 80            | 3                   | 🟡 EXTERNAL            |
| **Phase 11**   | 30            | 2                   | 📅 ONGOING             |
| **Phase 12**   | 16            | 1                   | 📅 PLANNED             |
| **TOTAL**      | **432 hours** | **23–28 FTE-weeks** | ⚠️ LARGE               |

**Effort baseline:** ~30 agent-weeks (v1.4-PROJECT-SCOPE.md, line 189) ✓ **matches audit**

---

## CRITICAL PATH & BLOCKERS

### Must-Fix-First (Sequence)

1. **Blocker 1** (HMAC) → Phase 0 hot-fix, must be in Phase 4 deploy
2. **Blocker 3** (LGPD DPIA) → Must complete before 05-03 IA strip ships
3. **Blocker 4** (Critical UI) → Phase 5 execution depends on it
4. **Blocker 5** (Wave 0 reconciliation) → Phase 1 sign-off depends on it

### Phase Dependencies

```
Phase 0–3 (COMPLETE) ✅
    ↓
Phase 4 (Portal auth + NOTIVISA) 📋
    ├→ Phase 6 (Liberación completion) 📅
    ├→ Phase 11 (Auditor pre-alignment) 📅
    │
    Phase 5 (Critical + IA) 📅
    │   (Must start after Phase 4, BUT Wave 0 tasks concurrent)
    ├→ Phase 7 (Reclamações + portal paciente) 📅
    │
    Phase 8 (CAPA closure) [CRITICAL PATH] 📅
    │   (Parallel with Phase 5–7, target Aug 5 sign-off)
    │
    Phase 9 (Analytics optimization) 📅
    │   (Parallel with Phase 8 Week 3–4)
    │
    Phase 10 (Pen-test) 🟡
    │   (External, 3 weeks, Jun 1–21)
    │
    Phase 12 (Test refresh) 📅
    │
    External Audit 🎯 Aug 31
```

---

## RECOMMENDATIONS

### Immediate (Next 48 Hours)

1. **Fix all 6 Blockers** (priority list above)
2. **Brief CTO on DICQ tracker pause** (cannot claim 82% until Phase 4 evidence)
3. **Draft contract template** (CTO 4h, needed for 05-Special-A Phase 5 Week 1)
4. **Confirm auditor pre-alignment schedule** (weekly calls starting Jun 1)

### Pre-Phase 4 (by May 20)

1. **Run full Lighthouse audit** (Web Vitals baseline)
2. **Deploy `preflight-secrets-check.sh`** (mandatory pre-flight for Phase 4)
3. **Enable Cloud Logs monitoring** (24h baseline)
4. **Confirm agent team mobilization** (Phase 4: 4 agents ready)
5. **NOTIVISA gov sandbox provisioning completed** (credential receipt expected by May 20)

### Phase 4–5 Parallel

1. **Weekly blockers review** (Fridays 15:00 BRT)
2. **Auditor pre-alignment calls** (Mondays 10:00 BRT, starting Jun 1)
3. **Performance monitoring** (Web Vitals, bundle size, Cloud Logs)
4. **Risk register updates** (top 5 risks, mitigation status)

### Go-No-Go Gates

**Phase 4 Deploy (Jun 2):**

- [ ] DICQ ≥82% verified (external consultant audit)
- [ ] 738/738 baseline tests PASS
- [ ] 0 errors in Cloud Logs (24h baseline)
- [ ] NOTIVISA queue 100% processing (0 failures, 48h test)
- [ ] Portal auth <2s cold-start
- [ ] E2E: All 8 flows PASS

**Phase 5 Deploy (Jun 30):**

- [ ] DICQ ≥84% verified
- [ ] Critical thresholds UI functional + tested
- [ ] IA strip classification 1,000+ images processed
- [ ] LGPD DPIA signed off by DPO
- [ ] SMS/email delivery <2 min SLA proven

---

## FILES TO CREATE / UPDATE

| File                                           | Action                    | Responsible | ETA        |
| ---------------------------------------------- | ------------------------- | ----------- | ---------- |
| `functions/src/modules/criticos/index.ts`      | Fix HMAC (Blocker 1)      | Eng         | 2026-05-10 |
| `docs/DICQ_CLOSURE_TRACKER_v1.4.md`            | Pause updates (Blocker 6) | CTO         | 2026-05-10 |
| `.planning/PHASE_5_RDC_CRITICAL_VIOLATIONS.md` | Update (Blocker 2 scope)  | CTO         | 2026-05-12 |
| `.planning/v1.4-PROJECT-SCOPE.md`              | Wave 0 status (Blocker 5) | Eng         | 2026-05-12 |
| `docs/contracts-template.md`                   | Draft (05-Special-A)      | CTO         | 2026-05-15 |
| `docs/LGPD_Art9_DPIA_Addendum_Gemini.md`       | Create (Blocker 3)        | Legal       | 2026-05-20 |
| `.claude/rules/phase-5-critical-findings.md`   | Document findings         | CTO         | 2026-05-12 |

---

## CONCLUSION

**HC Quality v1.4 scope is ACHIEVABLE but requires:**

1. ✅ **Immediate blocker fixes** (6 items, 14 hours, this week)
2. ✅ **Parallel execution** (Phases 4–5 concurrent, Phase 8 concurrent with 5–7)
3. ✅ **Adequate resourcing** (~30 FTE-weeks, pre-approved)
4. ✅ **Auditor partnership** (weekly pre-alignment + artifact reviews)
5. ✅ **Scope discipline** (no feature creep, email-link auth locked, LIS deferred)

**Risk Score:** 4.2/10 (Medium-Low, well-mitigated)  
**DICQ Confidence:** 88% achievable by Aug 4  
**RDC 978 100% articles:** Achievable by Aug 5  
**Go-Live Readiness:** On schedule for Aug 31 external audit

---

**Document Version:** 1.0  
**Created:** 2026-05-08  
**Last Updated:** 2026-05-08  
**Status:** READY FOR CTO REVIEW  
**Next Review:** 2026-05-20 (Phase 4 kickoff alignment)
