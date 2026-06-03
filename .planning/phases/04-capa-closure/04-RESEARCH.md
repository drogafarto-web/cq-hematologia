---
phase: '4'
name: 'CAPA Closure & Process Execution'
codename: 'v1.4 Phase 4'
duration_weeks: 3.5
status: 'planning-ready'
created: 2026-05-07
milestone: 'v1.4'
wave: '2'
---

# Phase 4: CAPA Closure & Process Execution

**Strategic Goal:** Close 12 critical audit findings (CAPAs) from Phase 7 internal audit with documented evidence, auditor sign-off, and delivery of 3 foundational micro-modules supporting closure.

**Timeline:** Weeks 4–8 of v1.4 (3.5–4 weeks depending on auditor availability)  
**Owner:** Stream A (CTO oversight) + Ops/Quality Manager  
**Critical Path:** Yes (blocks Phase 5–8 if delayed >7 days)  
**Parallel Dependencies:** Independent of Phases 5–7; unblocks Phase 9

---

## Executive Summary

### Current State (v1.3 End)

- **Audit dry-run complete** (Phase 7): 115-item DICQ checklist executed
- **12 critical findings documented** with initial CAPA placeholders
- **DICQ baseline:** 78–82% (71.3% from formal audit)
- **3 micro-module foundations deployed** (calibracao, personnel/cargos, personnel/designacoes, management-review) but CAPA process closure incomplete
- **Auditor pre-alignment:** Scheduled, awaiting Phase 4 start

### Deliverables (Phase 4)

1. **CAPA Closure Report** — all 12 findings with root-cause analysis, corrective actions, evidence, and auditor sign-off
2. **3 Micro-Module Completions** — calibracao, personnel/designacoes, management-review (foundations → production-ready)
3. **CAPA Tracking Dashboard** — state machine (open → in-progress → verification → closed) with UI
4. **Auditor RFI Workflow** — async email + in-app form for auditor Q&A without scheduling overhead
5. **Compliance Artifacts** — DICQ block A/C updated baseline (est. 78–82% → 84–86%)

### Success Criteria

- ✅ All 12 CAPAs transitioned to "closed" status with auditor confirmation email
- ✅ DICQ blocks A, C, D coverage: +6–8 points (measurable via audit checklist)
- ✅ RDC 978 Arts. 117, 181 coverage → 100%
- ✅ <3 audit findings in re-audit spot-check
- ✅ Zero P0 security findings in rules/callables
- ✅ 0 compliance gaps in CAPA evidence chain (every step logged, signed, immutable)

---

## CAPA Inventory & Mapping (12 Findings)

### Overview

Based on Phase 7 audit dry-run (2026-04-30), 12 critical/major non-conformancies identified. Each maps to DICQ block(s) + RDC article(s) + micro-module or process closure.

### CAPA Matrix

| No.        | Finding Title                                                                  | Severity     | Type     | DICQ Block(s)         | RDC Article(s)       | Micro-Module                            | Effort (days) | Dependencies                            | Success Criteria                                                                              |
| ---------- | ------------------------------------------------------------------------------ | ------------ | -------- | --------------------- | -------------------- | --------------------------------------- | ------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| **NC-001** | Management Review (Análise Crítica pela Direção) missing formal structure      | **Critical** | Process  | A (4.15)              | 86 (PGQ component 4) | `management-review`                     | 4             | Personnel designations (NC-003, NC-004) | Formal 15-entry meeting template created + 1 mock meeting executed                            |
| **NC-002** | Equipment calibration records incomplete; no metrological traceability         | **Critical** | Build    | H (5.3.1.4)           | 86 (componente 1)    | `calibracao`                            | 5             | Equipment registry (v1.3 complete)      | All 15 lab instruments with current/future calibration dates + alert system working           |
| **NC-003** | Personnel cargos (roles) not formally documented per DICQ 5.1.3                | **Critical** | Build    | A, C (4.1.2.5, 5.1.3) | 122–127              | `personnel-cargos`                      | 4             | DICQ 5.1 baseline                       | Org chart with 8+ role definitions (analyst, supervisor, RT, QA mgr, etc.) + authority matrix |
| **NC-004** | Designação formal de responsáveis (RT, GQ, Diretor) missing                    | **Critical** | Build    | A, C (4.1.2.7, 5.1)   | 122–127              | `personnel-designacoes`                 | 3             | Role definitions (NC-003)               | Formal designations for RT, QA Manager, Director signed by Lab Director + audit trail         |
| **NC-005** | NOTIVISA compliance — Portaria 204 Art. 6º not implemented                     | **Major**    | Deferred | G (5.7.3)             | 167, 191             | Deferred to Phase 8                     | —             | Phase 6 (Críticos module)               | Draft in Phase 8                                                                              |
| **NC-006** | SGD (Sistema Gestão Documental) — List Master + distribution not versioned     | **Major**    | Deferred | B (4.3)               | 117                  | Deferred to Phase 9 (SGQ)               | —             | SGQ module (partial v1.3)               | Full in Phase 9                                                                               |
| **NC-007** | Pre-analytic procedure (sample collection) not documented                      | **Major**    | Deferred | E (5.4.4, 5.4.5)      | 128–131              | Deferred to Phase 9 (Coleta+Transporte) | —             | controle-temperatura (v1.3 ✓)           | Full in Phase 9                                                                               |
| **NC-008** | Method validation records (linearity, accuracy, precision) incomplete          | **Major**    | Deferred | F (5.5.1.3, 5.5.1.4)  | 86 (componente 2)    | Deferred to Phase 10                    | —             | Analyte registry                        | Full in Phase 10                                                                              |
| **NC-009** | CEQ (External QA) annual evaluation report missing for 2025                    | **Major**    | Build    | F (5.6.3.4)           | 176 (V)              | `ceq-annual-report`                     | 3             | CEQ module (v1.3 ✓)                     | 2025 CEQ report generated + RT signed                                                         |
| **NC-010** | PGRSS (Waste Management) — no collection + disposal tracking                   | **Major**    | Deferred | E (5.7.4)             | RDC 222/2018         | Deferred to Phase 10                    | —             | Operations module baseline              | Full in Phase 10                                                                              |
| **NC-011** | Biossegurança — areas classified (NB1–NB4) but no ISO 14644 inspection records | **Major**    | Deferred | I (5.2.6)             | RDC 222/2018         | Deferred to Phase 10                    | —             | Lab infrastructure baseline             | Full in Phase 10                                                                              |
| **NC-012** | Risk management plan — matrix present but no controls + revalidation scheduled | **Major**    | Build    | A, D (4.14.6)         | 86 (componente 2)    | `risk-management` skeleton              | 3             | Risk governance framework               | FMEA-lite matrix (15+ risks) × P×S×D with controls documented                                 |

---

## Wave Structure & Decomposition

### Wave 1: Foundation & Micro-Module Preparation (Days 1–4)

**Goal:** Establish CAPA tracking infrastructure, kick off micro-module implementations, align with auditor on evidence requirements.

#### Task 1.1: CAPA Tracking Dashboard Schema + Service (1.5 days)

- **What:** Firestore collection `/labs/{labId}/capa-tracking/` with state machine + audit trail
- **Deliverables:**
  - Type `CapaTracking` with fields: capaId, ncId, title, severity, state, timeline, evidence[], signatures[]
  - Service: `createCapa`, `updateCapaState`, `submitEvidence`, `signOffCapa`
  - Firestore rules: soft-delete, immutable evidence, logical signature on state transitions
  - Tests: state transitions (open → closed only via auditor), evidence append-only
- **Dependencies:** None
- **Acceptance:** CRUD operational, rules test passing, 0 type errors

#### Task 1.2: Auditor RFI Workflow (async form + email gate) (1 day)

- **What:** In-app form for auditor Q&A without scheduling calls; email notifications
- **Deliverables:**
  - Form component: `AuditorRFIForm` (question, evidence needed, deadline)
  - Callable: `submitAuditorRFI` → Cloud Function sends email + stores in `capa-tracking/{capaId}/rfi-log/`
  - Email template: auto-generated with lab context + response link
  - Tracking: auditor response timestamp, changes state from "awaiting-auditor-input" → "received-response"
- **Dependencies:** CAPA tracking schema (1.1)
- **Acceptance:** Form submits, email sent, response logged in Firestore

#### Task 1.3: Phase 4 Micro-Modules Kickoff (1.5 days)

- **What:** Scaffold + planning for NC-001, NC-002, NC-003, NC-004, NC-009, NC-012 modules
- **Modules:**
  1. `calibracao` (NC-002) — equipment calibration + due dates + certificate storage
  2. `personnel-cargos` (NC-003) — role definitions + authority matrix
  3. `personnel-designacoes` (NC-004) — formal assignments (RT, QA mgr, Director)
  4. `management-review` (NC-001) — annual 15-entry meeting + atas
  5. `ceq-annual-report` (NC-009) — CEQ result aggregation + RT sign-off
  6. `risk-management` (NC-012) — FMEA-lite + control tracking
- **Deliverables:**
  - CLAUDE.md for each module (rules, effort estimate, DICQ mapping)
  - File structure scaffolding (types/, services/, hooks/, components/)
  - Integration points with existing modules (equipamentos, pessoal, nc, etc.)
- **Dependencies:** None (parallel)
- **Acceptance:** All 6 modules have scaffolded CLAUDE.md + file structure

#### Task 1.4: Auditor Pre-Alignment Call (0.5 day)

- **What:** 1h call with auditor + RT to confirm Phase 4 evidence requirements
- **Agenda:**
  1. 12 CAPA inventory review + timeline confirmation
  2. Evidence format expectations (screenshots, logs, certificates, PDFs)
  3. RFI workflow walkthrough (async form instead of email chains)
  4. Micro-module demonstration (calibracao, personnel) — live UI on tablet
  5. Sign-off ceremony date + auditor availability (target: 2026-06-28)
- **Deliverables:**
  - Meeting notes (Firestore doc)
  - Updated CAPA evidence checklist per auditor feedback
  - Confirmed auditor email + response SLA (target: 24h for RFI)
- **Dependencies:** Tasks 1.1–1.3 (demo-ready)
- **Acceptance:** Auditor confirms Phase 4 scope + timeline

---

### Wave 2: Micro-Module Implementation (Days 5–18)

**Goal:** Complete 6 micro-modules supporting CAPA closure; evidence generation for deferred CAPAs.

#### Task 2.1: `calibracao` Module (NC-002) (4–5 days)

**Purpose:** Document equipment calibration records with metrological traceability (DICQ 5.3.1.4 + RDC Art. 86).

**Scope:**

- Equipment registry integration: read from `equipamentos` collection
- Per-equipment fields:
  - `calibrationMethod` (in-house / external provider)
  - `lastCalibrationDate`, `nextDueDate`
  - `certificateURL` (PDF link to metrological standard)
  - `calibrationRange`, `expandedUncertainty`
  - `acceptanceCriteria` (numerical bounds)
  - `status` (in-date / warning-30d / warning-7d / overdue → auto-create NC)
- UI:
  - `CalibracaoList` — equipment table with status badges
  - `CalibracaoCertificateUpload` — drag-drop PDF + metadata form
  - `CalibracaoAlerts` — 30d, 7d, overdue email + in-app notifications
  - `CalibracaoAuditReport` — exportable summary (all equipment + status)
- Callables:
  - `uploadCalibracaoCertificate(equipId, pdf, metadata)` → validates date, stores, updates status
  - `flagEquipamentoOutOfService(equipId)` → sets status = "out-of-service", blocks use in CIQ runs
- Rules: manager can approve, auditor can read, immutable once approved
- Tests: state transitions, alert triggers, 0 false positives on status

**Deliverables:**

- `src/features/calibracao/` module (types, service, hooks, UI, callables)
- 15 equipment records (Riopomba) with calibration dates pre-populated (historical)
- Alert system operational (email + in-app)
- E2E: upload cert → UI reflects → alert fires
- DICQ 5.3.1.4 evidence: screenshot of audit report

**Evidence for NC-002:**

- Screenshot of calibracao dashboard with all 15 equipment + next-due dates
- PDF export of calibration summary
- Demo: add new certificate + alert trigger

#### Task 2.2: `personnel-cargos` Module (NC-003) (3–4 days)

**Purpose:** Formally document roles, authorities, and substitutions (DICQ 5.1.3 + RDC Arts. 122–127).

**Scope:**

- Roles (8+): Analyst, CIQ Supervisor, RT (Responsável Técnico), QA Manager, Director, Phlebotomist, Trainee, Support
- Per-role fields:
  - `nome` (title)
  - `descricao` (1–2 paragraphs, authority scope)
  - `requisitosMinimos` (degree, certifications, experience)
  - `substituidor` (who covers when role absent)
  - `secao` (department: análise, coleta, qualidade, etc.)
  - `dataDesignacao` (when formally appointed)
- UI:
  - `CargosOrgChart` — visual org chart (Director → QA Mgr → Supervisors → Analysts)
  - `CargoDefinition` — detail card + edit form (admin only)
  - `CargoAuthorityMatrix` — checkbox matrix (RT can release laudos? Analyst can flag NC?)
  - `CargoDesignationCertificate` — printable PDF (signed by Director) per role + incumbent
- Callables:
  - `createCargo(cargo_def)` → validate, create, log audit event
  - `updateCargoSubstituidor(cargoId, newSubstituidorId)` → validates backup role exists
- Rules: Director/Admin can create; read-only for others
- Tests: role creation, substitution logic, authority matrix consistency

**Deliverables:**

- `src/features/personnel/cargos/` module
- 8 role definitions + org chart diagram
- Authority matrix (RT, QA mgr, Director distinguished)
- PDF certificates for each role (printable, signed)
- E2E: create role → assign person → generate certificate

**Evidence for NC-003:**

- Org chart screenshot
- Role authority matrix
- PDF certificates (signed by Director)

#### Task 2.3: `personnel-designacoes` Module (NC-004) (2–3 days)

**Purpose:** Formal written designations for RT, QA Manager, Director (DICQ 4.1.2.7 + RDC Arts. 122–127).

**Scope:**

- Designações (3 mandatory):
  - `responsavel-tecnico` — Responsible technical manager (assinador de laudos)
  - `gerente-qualidade` — Quality manager (owner of 15 DICQ entry aggregation)
  - `diretor-laboratorio` — Lab director (governance + budgeting)
- Per-designação fields:
  - `personId`, `cargoId`
  - `dataDesignacao` (ISO date)
  - `motivo` (why this person — qualifications + decision)
  - `vigencia` (5 years typical, renewals optional)
  - `assinatura` (digital signature of Director)
  - `auditLog` (who changed, when)
- UI:
  - `DesignacoesList` — table of current + past designations
  - `DesignacaoForm` — combo to pick person → cargo → date + signature
  - `DesignacaoCertificate` — printable PDF (signed, sealed)
- Callables:
  - `createDesignacao(personId, cargoId, dataDesignacao, assinatura)` → atomic (signature must be valid)
  - `revokeDesignacao(designacaoId, motivo)` → soft-delete, logs reason
- Rules: Director + Admin only; read-only for ops
- Tests: signature validation, vigencia expiry, backup RT succession

**Deliverables:**

- `src/features/personnel/designacoes/` module
- 3 designações (RT, QA mgr, Director) with historical trail
- Printable certificates (signed by Director)
- E2E: create designação → generate certificate → audit trail shows change

**Evidence for NC-004:**

- Designação certificates (PDF, signed)
- Audit log of designations + changes

#### Task 2.4: `management-review` Module (NC-001) (3–4 days)

**Purpose:** Annual management review meeting (DICQ 4.15) with 15 mandatory entry aggregation.

**Scope:**

- Annual meeting structure:
  - `dataReuniaoAnual` (ISO date)
  - `15 mandatory entries` (auto-aggregated from other modules):
    1. NC trends (count, severity, open/closed)
    2. CAPA status (open, in-progress, closed)
    3. Training hours (total, per person, overdue revalidation)
    4. CEQ results (z-scores, failure %, corrective actions)
    5. Audit findings (internal, external history)
    6. Budget variance (actual vs planned spend)
    7. KPI trends (turnaround, retrabalho%, conformidade, SLA)
    8. Customer complaints (count, root causes, resolutions)
    9. Supplier performance (quality, on-time delivery)
    10. Regulatory changes (ANVISA, DICQ, RDC, LGPD)
    11. Improvement ideas (from staff, implementation rate)
    12. Personnel changes (new hires, departures, vacancies)
    13. Audit plan status (schedule, readiness)
    14. Incident log (safety, data, quality)
    15. Compliance gaps (vs DICQ checklist, RDC articles)
- UI:
  - `ManagementReviewMeeting` — form to create annual meeting
  - `ManagementReviewDataAggregator` — pulls 15 entries from Firestore (real-time queries)
  - `ManagementReviewMinutes` — signature form (name, date, attendees, decisions + action items)
  - `ManagementReviewExportPDF` — full meeting package (15 entries + minutes, audit-ready)
- Callables:
  - `aggregateManagementReviewData(labId, dateRange)` → queries all 15 sources, returns object
  - `createManagementReviewMeeting(data_aggregated, minutes, signatures)` → atomic batch (all 15 sources + meeting log)
  - `exportManagementReviewPDF(meetingId)` → puppeteer rendering
- Rules: Director + QA Manager can create; read-only for staff
- Tests: aggregation logic (all 15 entries), PDF rendering, signature immutability

**Deliverables:**

- `src/features/management-review/` module
- Data aggregator helper (15-entry query builder)
- PDF template (professional, DICQ-compliant)
- 1 mock meeting (2025-05 annual review) with historical data
- E2E: create meeting → aggregate data → sign → export PDF

**Evidence for NC-001:**

- Mock 2025-05 annual review PDF (all 15 entries filled)
- Minutes + signature page
- Audit trail of creation + signings

#### Task 2.5: `ceq-annual-report` Module (NC-009) (2–3 days)

**Purpose:** Annual CEQ evaluation report (DICQ 5.6.3.4 + RDC Art. 176).

**Scope:**

- CEQ data (from v1.3 ceq module):
  - Read all CEQ results for calendar year
  - Group by equipment × analyte
  - Calculate metrics: z-score distribution, % acceptable, % unsatisfactory
- Report structure:
  - CEQ scheme provider(s)
  - Results summary (table: analyte, equipment, n_results, z_avg, %accept)
  - Unsatisfactory results → auto-create NC + CAPA link
  - Corrective action status (any open from prior years?)
  - Recommendations (staff, equipment, method changes)
- UI:
  - `CEQAnnualReportForm` — read-only data (pre-filled from ceq), approval section
  - `CEQAnnualReportExport` — PDF (RDC 178 compliant format)
- Callables:
  - `generateCEQAnnualReport(labId, year)` → aggregates, identifies unsatisfactory, creates NCs
  - `approveCEQAnnualReport(reportId, approverSignature)` → RT sign-off + immutable
- Rules: QA + RT can approve; read-only for auditor
- Tests: z-score calculation, NC auto-creation for z>2, PDF formatting

**Deliverables:**

- `src/features/ceq/annual-report/` module
- 2025 CEQ annual report (mock data: 20+ analytes, 2–3 unsatisfactory z-scores)
- PDF export
- E2E: generate report → show unsatisfactory findings → approve → export

**Evidence for NC-009:**

- 2025 CEQ annual report PDF
- Evidence of unsatisfactory results + NC creation

#### Task 2.6: `risk-management` Module (NC-012) (2–3 days)

**Purpose:** Risk management plan with FMEA-lite matrix (DICQ 4.14.6 + RDC Art. 86).

**Scope:**

- Risk matrix:
  - **15+ risks** identified (pre-analytic, analytic, post-analytic, equipment, personnel, environment — per DICQ categories)
  - Per risk: hazard description, likelihood (1–5), severity (1–5), detectability (1–5), NPR = P×S×D
  - **Controls:** preventive (prevent occurrence) + detective (catch if occurs)
  - **Revalidation:** annual + when NC occurs in that category
- UI:
  - `RiskMatrixHeatmap` — NPR visualization (color-coded urgency)
  - `RiskDetail` — edit form (hazard, P/S/D sliders, controls, action plan)
  - `RiskRevalidationAlert` — anniversary + NC-triggered reviews
  - `RiskManagementExportPDF` — heatmap + detail grid (auditor-ready)
- Callables:
  - `createRisk(hazard, P, S, D, controls)` → calculate NPR, store
  - `updateRiskControl(riskId, control_update)` → logs change
  - `triggerRiskRevalidation(riskId, reason)` → marks for review, notifies owner
- Rules: QA + CTO can create; read-only for audit
- Tests: NPR calculation, NPR > 50 (high risk) logic, revalidation triggers

**Deliverables:**

- `src/features/risk-management/` module
- 15 risk definitions (lab-specific: e.g., "Hemolysis during collection", "Power outage during CIQ", "RT absent during critical result")
- Heatmap visualization
- PDF export
- E2E: create risk → assign controls → trigger revalidation

**Evidence for NC-012:**

- Risk matrix heatmap (screenshot)
- PDF report with 15 risks + controls
- Demo: create new risk + control update

---

### Wave 3: CAPA Closure & Auditor Sign-Off (Days 19–25)

**Goal:** Close all 12 CAPAs with documented evidence + auditor sign-off; deliver final compliance report.

#### Task 3.1: Build NC-005–NC-012 Evidence (for Deferred CAPAs) (3 days)

- **What:** Create documentation/plans for 8 deferred CAPAs; evidence that closure plan exists + timeline committed
- **CAPAs:**
  - NC-005 (NOTIVISA) — Phase 8 plan document + mock NOTIVISA form
  - NC-006 (SGD) — Phase 9 plan + List Master draft (from Riopomba Drive data)
  - NC-007 (Pre-analytic) — Phase 9 plan + coleta procedure template
  - NC-008 (Method validation) — Phase 10 plan + analyte registry seed
  - NC-010 (PGRSS) — Phase 10 plan + waste classification matrix
  - NC-011 (Biossegurança) — Phase 10 plan + ISO 14644 checklist
- **Deliverables:**
  - Per CAPA: phase plan document (why deferred, scope, timeline, dependencies, success criteria)
  - Mock evidence (for phase plans): template screenshots, checklist images
  - Auditor message: "Phase 4 demonstrates root cause + closure plan for Phase X; deferred closure on-track"
- **Evidence:** PDF folder with 8 phase plans + auditor confirmation email

#### Task 3.2: CAPA Evidence Compilation & Chain-of-Custody (4 days)

- **What:** Collect all evidence for 12 CAPAs, organize into audit-ready structure, verify chain integrity
- **For each CAPA:**
  1. Root cause analysis (1-page narrative)
  2. Screenshots (module UI, database record, alert, PDF)
  3. PDF artifacts (certificates, reports, dashboards)
  4. Audit logs (Firestore events, timestamps, signatures)
  5. Corrective action narrative (what was done, by whom, when)
  6. Effectiveness verification (re-test, re-audit, or forward-looking assurance)
  7. Auditor Q&A (RFI responses, if any)
- **Deliverables:**
  - `/capa-evidence/` folder structure:
    ```
    capa-evidence/
    ├── NC-001-management-review/
    │   ├── root-cause.md
    │   ├── mockmeeting-2025-05.pdf
    │   ├── atas.pdf
    │   ├── screenshots/
    │   └── audit-log.json
    ├── NC-002-calibracao/
    │   ├── root-cause.md
    │   ├── equipment-audit-report.pdf
    │   ├── 15-calibration-certs.zip
    │   ├── screenshots/
    │   └── alert-trigger-log.json
    │ ... (12 total)
    ```
  - Each CAPA: integrity hash (SHA-256) + operator signature (HMAC)
  - Index file: `CAPA-CLOSURE-INDEX.json` (all 12 entries, hashes, signatures, timestamps)
- **Tests:** hash verification (no tampering), all evidence files accessible (no broken links)

#### Task 3.3: CAPA Closure Auditor Sign-Off Ceremony (1 day)

- **What:** Async + optional sync with auditor to review evidence + formally close CAPAs
- **Process:**
  1. Send auditor evidence package (PDF + supporting files)
  2. Auditor reviews (async, target 3–5 business days)
  3. If RFI, use in-app form (Task 1.2) to respond
  4. Once auditor satisfied: email confirmation "All 12 CAPAs closed"
  5. Log sign-off in CAPA tracking system (immutable audit trail)
- **Deliverables:**
  - Email from auditor: "12 CAPAs accepted as closed"
  - Signed CAPA closure memo (auditor signature, timestamp)
  - Updated `/capa-tracking/` collection with state = "closed" for all 12
  - PDF: "CAPA-CLOSURE-SIGN-OFF.pdf" (auditor confirmation + evidence summary)
- **Success:** <0 open audit questions; auditor email timestamp in Firestore

#### Task 3.4: Final Compliance Report & DICQ Update (1 day)

- **What:** Measure DICQ conformance post-Phase-4; document blocks A, C, D improvement
- **Deliverables:**
  - DICQ checklist (115 items) re-scored:
    - Block A (Governance): est. 78% → 86% (+8 pts from NC-001, NC-003, NC-004)
    - Block C (Personnel): est. 80% → 88% (+8 pts from NC-003, NC-004 + training evidence)
    - Block D (Quality): est. 60% → 70% (+10 pts from NC-001, NC-009, NC-012)
    - **Overall:** 78–82% → 84–86% (estimated +4–6 pts)
  - Report: "v1.4 Phase 4 Compliance Closure Report" (1 page summary + detailed block breakdown)
  - RDC mapping: Arts. 117, 181 evidence completeness verified
- **Tests:** Manual audit spot-check (10 items from each block); <3 gaps found acceptable

---

## Micro-Module Integration Map

### How Micro-Modules Support CAPA Closure

```
NC-001 (Management Review)
├── Depends: Personnel designacoes (NC-004) ✓
└── Implements: DICQ 4.15 (15 mandatory inputs)
   ├── Input 1: NC trends ← nc module (v1.3)
   ├── Input 2: CAPA status ← capa-tracking (Phase 4.1)
   ├── Input 3: Training hours ← educacao-continuada (v1.3)
   ├── Input 4: CEQ results ← ceq-annual-report (Phase 4.5)
   ├── Input 5: Audit findings ← auditoria-interna (Phase 5)
   ├── Input 6: Budget variance ← [manual/finance system]
   ├── Input 7: KPI trends ← analytics (v1.3)
   ├── Input 8: Complaints ← reclamacoes (v1.3)
   ├── Input 9: Supplier perf ← [manual/fornecedores]
   ├── Input 10: Regulatory changes ← [manual/admin]
   ├── Input 11: Improvement ideas ← sugestoes (v1.3)
   ├── Input 12: Personnel changes ← personnel-cargos (NC-003)
   ├── Input 13: Audit plan ← [manual/auditoria]
   ├── Input 14: Incident log ← [manual/nc]
   └── Input 15: Compliance gaps ← [DICQ checklist re-score]

NC-002 (Calibracao)
├── Depends: equipamentos (v1.3 ✓)
└── Delivers: Equipment fitness-for-use verification
   ├── Prevents: Measurement traceability gaps
   ├── Alerts: Overdue calibration → NC auto-create
   └── Evidence: Certificate chain + audit trail

NC-003 (Personnel Cargos)
├── No hard dependencies (foundational)
└── Feeds: NC-001 (org chart), NC-004 (role definitions)

NC-004 (Personnel Designacoes)
├── Depends: Personnel cargos (NC-003)
└── Delivers: Formal role accountability
   ├── RT designates laudo signatories
   ├── QA Manager: DICQ entry aggregation owner
   └── Director: governance meetings chair

NC-009 (CEQ Annual Report)
├── Depends: ceq module (v1.3 ✓)
└── Feeds: NC-001 input 4 (management review)

NC-012 (Risk Management)
├── No hard dependencies (foundational)
└── Feeds: All quality modules (risk-driven QC decisions)
```

---

## Dependencies & Sequencing

### Hard Blockers (Critical Path)

1. **NC-003 → NC-004 → NC-001**: Personnel roles → designations → management review
2. **Phase 4 complete → Phase 5–7 unblocked** (Wave 2 runs parallel)
3. **NC-009 complete → Management review input ready** (June 1 target)

### Soft Dependencies (Preferred, not blocking)

- NC-002 (calibracao) prefers `equipamentos` ready (v1.3 ✓)
- NC-012 (risk) prefers risk framework conceptualized (exists in Obsidian)

### External Dependencies

- **Auditor availability** (RFI response SLA: target 24h)
- **Riopomba document access** (Drive folder for CAPA-006 evidence prep)
- **Personnel data** (RT + QA Mgr designations pre-agreed with lab)

---

## Effort Estimation & Timeline

### By Micro-Module

| Module                        | Wave | Duration | Effort Points | Complexity | Owner  |
| ----------------------------- | ---- | -------- | ------------- | ---------- | ------ |
| CAPA Tracking (1.1)           | W1   | 1.5d     | 5             | Low        | Eng    |
| Auditor RFI (1.2)             | W1   | 1d       | 4             | Low        | Eng    |
| Scaffolding (1.3)             | W1   | 1.5d     | 3             | Low        | Eng    |
| Auditor Call (1.4)            | W1   | 0.5d     | 1             | Low        | CTO    |
| **Wave 1 Total**              | —    | 4d       | 13            | —          | —      |
| `calibracao` (2.1)            | W2   | 4–5d     | 14            | Medium     | Eng    |
| `personnel-cargos` (2.2)      | W2   | 3–4d     | 12            | Medium     | Eng    |
| `personnel-designacoes` (2.3) | W2   | 2–3d     | 8             | Low        | Eng    |
| `management-review` (2.4)     | W2   | 3–4d     | 11            | Medium     | Eng    |
| `ceq-annual-report` (2.5)     | W2   | 2–3d     | 8             | Low        | Eng    |
| `risk-management` (2.6)       | W2   | 2–3d     | 8             | Low        | Eng    |
| **Wave 2 Total**              | —    | 16–22d   | 61            | —          | —      |
| Deferred CAPA evidence (3.1)  | W3   | 3d       | 9             | Low        | QA Mgr |
| Evidence compilation (3.2)    | W3   | 4d       | 12            | Medium     | QA Mgr |
| Auditor sign-off (3.3)        | W3   | 1d       | 2             | Low        | CTO    |
| Compliance report (3.4)       | W3   | 1d       | 3             | Low        | CTO    |
| **Wave 3 Total**              | —    | 9d       | 26            | —          | —      |
| **Phase 4 Grand Total**       | —    | 29–27d   | **100 pts**   | —          | —      |

**Timeline:** 4 calendar weeks (May 20 – June 15, assuming 1 week of auditor delay buffer)

---

## Acceptance Criteria & Quality Gates

### Phase 4 Completion (All must be ✅)

**Micro-Module Quality:**

- [ ] All 6 modules (calibracao, cargos, designacoes, management-review, ceq, risk) compile without TS errors
- [ ] Firestore rules deployed + tested in emulator (0 rule violations)
- [ ] E2E tests pass for all 6 modules (1+ test per module)
- [ ] Performance: LCP <2.5s, INP <200ms on all UI screens (light throttle)

**CAPA Closure:**

- [ ] All 12 CAPAs transitioned to state = "closed" in Firestore
- [ ] Evidence integrity: all 12 evidence packages hash-verified, 0 tampering detected
- [ ] Auditor sign-off email received + logged (immutable timestamp)
- [ ] Root-cause analysis documented for all 12 (1-page narrative each)
- [ ] <3 audit RFI cycles needed (evidence comprehensive on first submission)

**Compliance Impact:**

- [ ] DICQ blocks A, C, D rescored: +6 points minimum
- [ ] RDC Arts. 117, 181 coverage: 100% (verified by CTO spot-check, 10 items min)
- [ ] <3 findings in re-audit spot-check (20 random DICQ items)
- [ ] Zero P0 security findings in rules + callables (audited via `firestore-security-rules-auditor` skill)

**Documentation:**

- [ ] CAPA-CLOSURE-REPORT.md published (1-page summary + evidence index)
- [ ] CAPA-CLOSURE-SIGN-OFF.pdf signed by auditor
- [ ] Phase 4 completion summary (effort, timeline, lessons learned)

---

## Risk Register & Mitigation

| Risk                                                             | Severity | Probability  | Impact                         | Mitigation                                                                 |
| ---------------------------------------------------------------- | -------- | ------------ | ------------------------------ | -------------------------------------------------------------------------- |
| **Auditor RFI delays** (>7d response)                            | 🔴 P0    | Medium (40%) | Blocks Wave 3 by 1+ week       | Async email gate (1.2) + weekly standing call + CTO escalation if >7d      |
| **Micro-module scope creep** (e.g., org chart wants full HRMS)   | 🟠 P1    | Medium (35%) | Effort +20–30 pts              | Lock scope in Wave 1 kickoff (1.3); extension pattern for v1.5 features    |
| **Personnel data incomplete** (RT/QA Mgr not designated in time) | 🟠 P1    | Low (20%)    | Blocks NC-003/004              | Pre-align with lab in Week 1 call (1.4); use mock designations if needed   |
| **Evidence chain integrity** (broken links, missing docs)        | 🔴 P0    | Low (15%)    | Audit rejection                | Task 3.2 hash verification + immutable audit trail (Firestore soft-delete) |
| **Certificate upload failure** (large PDFs, network)             | 🟡 P2    | Low (15%)    | Blocks calibracao              | Chunked upload via Cloud Storage + resume logic; max 10MB per cert         |
| **DICQ re-score underestimation** (only +2 pts, not +6)          | 🟡 P2    | Medium (30%) | Phase 4 perceived as low-value | Conservative re-score early (Week 3) + adjust evidence strategy            |

---

## Success Metrics (Quantitative)

| Metric                   | Target                        | Measurement                            |
| ------------------------ | ----------------------------- | -------------------------------------- |
| CAPA closure rate        | 100% (12/12)                  | Firestore state = "closed" count       |
| Auditor sign-off         | 1 email confirmation          | Timestamp logged in capa-tracking      |
| Evidence completeness    | ≥95% (all 12 with root cause) | Audit spot-check (10 random CAPAs)     |
| RFI cycles needed        | <3                            | Email thread count to auditor          |
| DICQ improvement         | +4–6 pts (84–86% target)      | Block A/C/D re-score                   |
| Time-to-auditor-response | <24h (SLA)                    | Email timestamp delta                  |
| Module test coverage     | ≥85%                          | Jest line coverage per module          |
| Performance regression   | 0                             | Lighthouse CI <2.5s LCP, <0.1 CLS      |
| Security findings        | 0 P0, <2 P1                   | firestore-security-rules-auditor skill |

---

## Deliverables Checklist

### Code Artifacts

- [ ] `src/features/calibracao/` (types, service, hooks, UI, callables) — ready for code review
- [ ] `src/features/personnel/cargos/` — ready for code review
- [ ] `src/features/personnel/designacoes/` — ready for code review
- [ ] `src/features/management-review/` — ready for code review
- [ ] `src/features/ceq/annual-report/` — ready for code review
- [ ] `src/features/risk-management/` — ready for code review
- [ ] `src/features/capa-tracking/` (dashboard, RFI form) — ready for code review
- [ ] `functions/src/modules/calibracao/`, `personnel/`, `management-review/`, `ceq/`, `risk/` — CF callables
- [ ] `.firebase/firestore.rules` — v1.4 extensions (calibracao, personnel, management-review, ceq, risk) deployed + tested

### Documentation Artifacts

- [ ] `CAPA-CLOSURE-REPORT.md` — 12 findings + root causes + evidence summary
- [ ] `CAPA-CLOSURE-SIGN-OFF.pdf` — auditor signature + date
- [ ] `Phase-4-COMPLETION-SUMMARY.md` — timeline, effort, lessons learned
- [ ] `Phase-4-DICQ-IMPACT.md` — blocks A/C/D re-score + evidence mapping
- [ ] `/capa-evidence/` folder structure (12 subdirectories + index)
- [ ] Each module: CLAUDE.md (rules, DICQ mapping, status)

### Evidence Artifacts

- [ ] 15 equipment calibration certificates (calibracao module)
- [ ] 8 role definitions + org chart (personnel-cargos)
- [ ] 3 formal designations (RT, QA mgr, Director) — PDF certificates signed
- [ ] 1 mock 2025-05 management review meeting (full 15-entry aggregate + atas)
- [ ] 2025 CEQ annual report (all analytes, z-scores, unsatisfactory findings marked)
- [ ] Risk matrix (15 risks, P/S/D scored, controls documented)
- [ ] Phase plans for NC-005–012 (8 deferred CAPAs)

### Test Artifacts

- [ ] E2E tests for all 6 modules (6+ scenarios per module, ~40 total tests)
- [ ] Firestore rules emulator tests (membership, soft-delete, signatures)
- [ ] Performance benchmarks (LCP, INP, CLS per module)

---

## Hand-Off Criteria to Phase 5

Phase 4 is **fully complete** when:

1. **All 12 CAPAs closed** — auditor sign-off email + logged in Firestore ✅
2. **DICQ baseline updated** — blocks A, C, D re-scored, +4–6 pts confirmed ✅
3. **6 micro-modules in production** — code merged, tests passing, deployed to staging ✅
4. **Evidence package delivered** — `/capa-evidence/` folder + auditor sign-off memo ✅
5. **RFI workflow operational** — async email gate tested, <3 RFI cycles to closure ✅
6. **Zero P0 compliance gaps** — security rules audit clean, soft-delete immutability verified ✅

**Phase 5 can start immediately** (independent, no hard blocker on Phase 4).

**Phases 5–7 can run in parallel** with Phase 4 (Wave 2 parallelization).

---

## Known Risks & Deferred Scope

### Out of Phase 4 Scope (Deferred to v1.4 Phases 5+)

- **Full NOTIVISA integration** (NC-005) → Phase 8
- **Complete SGD with List Master** (NC-006) → Phase 9
- **Full pre-analytic procedures** (NC-007) → Phase 9
- **Comprehensive method validation** (NC-008) → Phase 10
- **PGRSS waste management** (NC-010) → Phase 10
- **Biossegurança ISO 14644** (NC-011) → Phase 10

Phase 4 delivers:

- **Proof of concept** for deferred modules (phase plans + mock evidence)
- **Committed timelines** (auditor-agreed Phase 5–10 schedule)
- **Dependency mapping** (deferred modules block each other; clear sequence)

### Phase 4 Non-Negotiables

- **Micro-modules must be production-ready** (code review, tests, deployment)
- **CAPA closure must be auditor-signed** (evidence comprehensive, no RFI turnarounds)
- **Compliance measurement must be accurate** (DICQ re-score by external auditor, if possible, or CTO spot-check)

---

## Success Story (Example)

**NC-002 Calibracao Closure:**

_Week 1:_ RT gathers 15 equipment calibration certificates (some in Drive, some physical, some external provider PDFs).  
_Week 2:_ Eng implements calibracao module UI; RT uploads all certs via drag-drop.  
_Week 3:_ System calculates next-due dates; 3 equipment flagged "overdue" (alert triggers).  
_Week 4:_ RT receives email alerts; orders new calibrations from vendor.  
_Week 4 (end):_ All calibration dates updated; equipment status = "in-date".  
_Sign-off:_ Auditor reviews dashboard + certificate folder; confirms traceability established. "NC-002 closed."

---

## Contact & Questions

**Phase Owner:** CTO (Stream A) + Quality Manager (Ops)  
**Escalation:** If RFI delay >7d or micro-module blocker → CTO + Stream Lead sync (24h)  
**Auditor Point of Contact:** RT (Responsável Técnico) + CTO

---

**Document Status:** Ready for Execution  
**Created:** 2026-05-07  
**Target Kickoff:** 2026-05-20 (Week 1 of v1.4)  
**Target Completion:** 2026-06-15 (3.5 weeks)  
**Next Phase Unblock:** Phase 5–7 (Wave 2)
