---
phase: '4'
milestone: 'v1.4 Phase 4'
title: 'CAPA Closure & Process Execution — Detailed Execution Plan'
status: 'planning-ready'
created: 2026-05-07
target_kickoff: 2026-05-20
target_completion: 2026-06-15
duration: '3.5–4 weeks'
wave: '2'
---

# Phase 4 Detailed Execution Plan — CAPA Closure & Process Execution

**Version:** 1.0  
**Status:** Ready for Execution  
**Created:** 2026-05-07  
**Owner:** Stream A (CTO) + Quality Manager  
**Wave:** 2 (parallel with Phases 5–7)

---

## Table of Contents

1. [Strategic Context](#strategic-context)
2. [CAPA Inventory & Root-Cause Breakdown](#capa-inventory--root-cause-breakdown)
3. [Firestore Schema Sketch](#firestore-schema-sketch)
4. [Execution Plan by Wave](#execution-plan-by-wave)
5. [Auditor RFI Async Email Workflow](#auditor-rfi-async-email-workflow)
6. [Weekly Standing Call Template](#weekly-standing-call-template)
7. [Risk Register](#risk-register)
8. [Success Criteria & Compliance Impact](#success-criteria--compliance-impact)
9. [Rollback Boundaries](#rollback-boundaries)
10. [Dependency DAG](#dependency-dag)
11. [Milestones & Go/No-Go Gates](#milestones--gono-go-gates)

---

## Strategic Context

### Why Phase 4 Matters

Phase 4 is the **compliance anchor** of v1.4. It:

- Closes **12 critical audit findings** from v1.3 Phase 7 audit dry-run
- Establishes **personnel + governance foundation** required for all downstream modules
- Demonstrates **CAPA process discipline** (evidence gathering, auditor sign-off, remediation proof)
- Advances **DICQ compliance** from 78–82% → 84–86% (+4–6 points)
- Unlocks **Phase 5–7** (portal expansion, critical values, feedback)

If Phase 4 succeeds on schedule, final external audit (Oct 2026) observes a system with closure rigor.  
If Phase 4 slips >1 week, auditor RFI delays cascade; overall v1.4 timeline at risk.

### Current Baseline (as of 2026-05-07)

| Item                            | Status                                                   |
| ------------------------------- | -------------------------------------------------------- |
| **12 CAPA findings documented** | ✅ Phase 7 audit complete                                |
| **DICQ baseline**               | 78–82% (71.3% from formal audit)                         |
| **Micro-module foundations**    | ✅ Scaffolded (calibracao, personnel, management-review) |
| **Auditor pre-alignment**       | 🟡 Scheduled, pending Phase 4 kickoff                    |
| **RFI workflow**                | ❌ Not yet implemented                                   |

---

## CAPA Inventory & Root-Cause Breakdown

### All 12 Findings: Severity, Root Cause, Corrective Action, Verification

#### **NC-001: Management Review (Análise Crítica pela Direção) Missing Formal Structure**

| Field                 | Value                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**          | 🔴 Critical                                                                                                                                                                     |
| **Type**              | Process                                                                                                                                                                         |
| **DICQ Block(s)**     | A (4.15)                                                                                                                                                                        |
| **RDC Article(s)**    | 86 (PGQ component 4)                                                                                                                                                            |
| **Micro-Module**      | `management-review`                                                                                                                                                             |
| **Root Cause**        | Annual governance meeting not formalized; no 15-entry aggregation template; decisions not documented                                                                            |
| **Corrective Action** | 1. Create formal 15-entry meeting template (NC trends, CAPA status, training, CEQ, compliance gaps, etc.) 2. Execute mock 2025-05 meeting 3. Generate signed atas + audit trail |
| **Evidence**          | Mock meeting PDF (all 15 entries), minutes signed, Firestore audit log                                                                                                          |
| **Verification**      | Auditor reviews template + mock meeting; confirms 15 entries present + aggregation logic correct                                                                                |
| **Phase 4 Task**      | 2.4 (Management Review module)                                                                                                                                                  |
| **Effort**            | 3–4 days                                                                                                                                                                        |
| **Success Criteria**  | Formal template created, 1 mock meeting executed, auditor accepts closure                                                                                                       |

---

#### **NC-002: Equipment Calibration Records Incomplete; No Metrological Traceability**

| Field                 | Value                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**          | 🔴 Critical                                                                                                                                                                                                                                                                                   |
| **Type**              | Build                                                                                                                                                                                                                                                                                         |
| **DICQ Block(s)**     | H (5.3.1.4)                                                                                                                                                                                                                                                                                   |
| **RDC Article(s)**    | 86 (componente 1)                                                                                                                                                                                                                                                                             |
| **Micro-Module**      | `calibracao`                                                                                                                                                                                                                                                                                  |
| **Root Cause**        | 15 lab instruments lack documented calibration dates, next-due dates, metrological certificates; no alert system for overdue calibrations                                                                                                                                                     |
| **Corrective Action** | 1. Gather calibration certificates (historical + current) for all 15 instruments 2. Implement calibracao module UI (equipment list, certificate upload, status badge) 3. Upload all certificates + set next-due dates 4. Implement alert system (30d, 7d, overdue) → email + NC auto-creation |
| **Evidence**          | Dashboard screenshot (all 15 equipment + status), PDF export of audit report, 15 calibration certificates in Cloud Storage                                                                                                                                                                    |
| **Verification**      | Auditor spot-checks 5 random equipment: certificate present, traceability confirmed, status current, alerts functional                                                                                                                                                                        |
| **Phase 4 Task**      | 2.1 (Calibracao module)                                                                                                                                                                                                                                                                       |
| **Effort**            | 4–5 days                                                                                                                                                                                                                                                                                      |
| **Success Criteria**  | All 15 equipment with current calibration dates, alert system working, auditor confirms traceability                                                                                                                                                                                          |

---

#### **NC-003: Personnel Cargos (Roles) Not Formally Documented per DICQ 5.1.3**

| Field                 | Value                                                                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**          | 🔴 Critical                                                                                                                                                                                                                                                    |
| **Type**              | Build                                                                                                                                                                                                                                                          |
| **DICQ Block(s)**     | A, C (4.1.2.5, 5.1.3)                                                                                                                                                                                                                                          |
| **RDC Article(s)**    | 122–127                                                                                                                                                                                                                                                        |
| **Micro-Module**      | `personnel-cargos`                                                                                                                                                                                                                                             |
| **Root Cause**        | 8+ roles (Analyst, Supervisor, RT, QA Manager, Director, Phlebotomist, Trainee, Support) not formally defined; no authority matrix; no role descriptions                                                                                                       |
| **Corrective Action** | 1. Create 8 role definitions (title, description, minimum requirements, substitution policy) 2. Build UI: org chart, role cards, authority matrix (RT can release? QA mgr can approve training?) 3. Generate role certificates (printable, signed by Director) |
| **Evidence**          | Org chart screenshot, PDF authority matrix, 8 role definition certificates                                                                                                                                                                                     |
| **Verification**      | Auditor reviews org chart + authority matrix; confirms roles distinguish RT (high accountability) vs. Analyst (supervisory required); all substitution paths documented                                                                                        |
| **Phase 4 Task**      | 2.2 (Personnel Cargos module)                                                                                                                                                                                                                                  |
| **Effort**            | 3–4 days                                                                                                                                                                                                                                                       |
| **Success Criteria**  | 8 roles formally defined, org chart visible in UI, authority matrix auditor-approved                                                                                                                                                                           |

---

#### **NC-004: Formal Designação (RT, QA Manager, Director) Missing**

| Field                 | Value                                                                                                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**          | 🔴 Critical                                                                                                                                                                                                                                         |
| **Type**              | Build                                                                                                                                                                                                                                               |
| **DICQ Block(s)**     | A, C (4.1.2.7, 5.1)                                                                                                                                                                                                                                 |
| **RDC Article(s)**    | 122–127                                                                                                                                                                                                                                             |
| **Micro-Module**      | `personnel-designacoes`                                                                                                                                                                                                                             |
| **Root Cause**        | No formal written designations for RT, QA Manager, Lab Director; no audit trail of appointments; no signature authority                                                                                                                             |
| **Corrective Action** | 1. Formally appoint RT, QA Manager, Director (pre-agreed with lab) 2. Create designação form (person, role, date, justification, signature by Director) 3. Generate signed PDF certificates 4. Implement audit trail (who changed, when, signature) |
| **Evidence**          | 3 formal designação certificates (PDF, signed by Director), audit log in Firestore                                                                                                                                                                  |
| **Verification**      | Auditor verifies 3 designações present, signed by authorized signer (Director), with effective dates + vigencia periods; audit trail immutable                                                                                                      |
| **Phase 4 Task**      | 2.3 (Personnel Designacoes module)                                                                                                                                                                                                                  |
| **Effort**            | 2–3 days                                                                                                                                                                                                                                            |
| **Success Criteria**  | RT, QA Manager, Director formally designated, certificates signed, audit trail complete                                                                                                                                                             |

---

#### **NC-005: NOTIVISA Compliance — Portaria 204 Art. 6º Not Implemented**

| Field                          | Value                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                   | 🟠 Major                                                                                                                                                                                                                                                                                                                           |
| **Type**                       | Deferred                                                                                                                                                                                                                                                                                                                           |
| **DICQ Block(s)**              | G (5.7.3)                                                                                                                                                                                                                                                                                                                          |
| **RDC Article(s)**             | 167, 191                                                                                                                                                                                                                                                                                                                           |
| **Phase for Full Closure**     | Phase 8 (critical value escalation → NOTIVISA draft)                                                                                                                                                                                                                                                                               |
| **Root Cause**                 | No automated escalation of critical results to NOTIVISA (national emergency notification system); manual process error-prone                                                                                                                                                                                                       |
| **Corrective Action**          | **Phase 4 (proof of plan):** 1. Phase 8 plan document (scope, timeline, dependencies on críticos module) 2. Mock NOTIVISA form (structure, required fields) 3. Escalation SOP template (when to escalate, to whom, format) **Phase 8 (full closure):** Implement críticos module → NOTIVISA API integration + email/SMS escalation |
| **Evidence (Phase 4)**         | PDF: Phase 8 plan + mock NOTIVISA form + escalation SOP                                                                                                                                                                                                                                                                            |
| **Phase 4 Deliverable**        | Phase plans (Task 3.1) + auditor message: "Phase 4 shows Phase 8 closure plan; on-track for June 2026 delivery"                                                                                                                                                                                                                    |
| **Success Criteria (Phase 4)** | Phase 8 plan auditor-approved, mock form complete, no blocking dependencies on Phase 5–7                                                                                                                                                                                                                                           |

---

#### **NC-006: SGD (Sistema Gestão Documental) — List Master + Distribution Not Versioned**

| Field                          | Value                                                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Severity**                   | 🟠 Major                                                                                                                                                                                                                                                                 |
| **Type**                       | Deferred                                                                                                                                                                                                                                                                 |
| **DICQ Block(s)**              | B (4.3)                                                                                                                                                                                                                                                                  |
| **RDC Article(s)**             | 117                                                                                                                                                                                                                                                                      |
| **Phase for Full Closure**     | Phase 9 (SGQ module complete: List Master + hierarchy + distribution)                                                                                                                                                                                                    |
| **Root Cause**                 | Document master list exists but lacks version control, distribution tracking, approval workflow; not auditable                                                                                                                                                           |
| **Corrective Action**          | **Phase 4:** 1. Phase 9 plan (LM structure, hierarchy MQ→PQ→IT→FR→POL, distribution audit trail) 2. Mock List Master (10 sample docs with version history) 3. Distribution tracking workflow SOP **Phase 9:** Full SGD with versionioning + approval + 80+ Riopomba docs |
| **Evidence (Phase 4)**         | PDF: Phase 9 plan + mock LM screenshot + distribution SOP                                                                                                                                                                                                                |
| **Phase 4 Deliverable**        | Phase plans (Task 3.1) + Riopomba data readiness check                                                                                                                                                                                                                   |
| **Success Criteria (Phase 4)** | Phase 9 plan auditor-approved, mock LM demonstrates hierarchy, distribution workflow drafted                                                                                                                                                                             |

---

#### **NC-007: Pre-Analytic Procedure (Sample Collection) Not Documented**

| Field                          | Value                                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                   | 🟠 Major                                                                                                                                                                                                                                                                                                                          |
| **Type**                       | Deferred                                                                                                                                                                                                                                                                                                                          |
| **DICQ Block(s)**              | E (5.4.4, 5.4.5)                                                                                                                                                                                                                                                                                                                  |
| **RDC Article(s)**             | 128–131                                                                                                                                                                                                                                                                                                                           |
| **Phase for Full Closure**     | Phase 9 (Coleta + Transporte modules)                                                                                                                                                                                                                                                                                             |
| **Root Cause**                 | Sample collection procedures exist informally; not formalized; transport/traceability conditions not documented                                                                                                                                                                                                                   |
| **Corrective Action**          | **Phase 4:** 1. Phase 9 plan (coleta + transporte procedures, traceability requirements) 2. Procedure template (collection steps, sample ID format, transport conditions, temperature monitoring) 3. SOP linking to controle-temperatura module (v1.3 ✓) **Phase 9:** Implement full coleta + transporte modules with audit trail |
| **Evidence (Phase 4)**         | PDF: Phase 9 plan + procedure templates                                                                                                                                                                                                                                                                                           |
| **Phase 4 Deliverable**        | Phase plans (Task 3.1)                                                                                                                                                                                                                                                                                                            |
| **Success Criteria (Phase 4)** | Phase 9 plan auditor-approved, procedure templates complete, temperature monitoring dependency on v1.3 confirmed                                                                                                                                                                                                                  |

---

#### **NC-008: Method Validation Records (Linearity, Accuracy, Precision) Incomplete**

| Field                          | Value                                                                                                                                                                                                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                   | 🟠 Major                                                                                                                                                                                                                                                                                                                   |
| **Type**                       | Deferred                                                                                                                                                                                                                                                                                                                   |
| **DICQ Block(s)**              | F (5.5.1.3, 5.5.1.4)                                                                                                                                                                                                                                                                                                       |
| **RDC Article(s)**             | 86 (componente 2)                                                                                                                                                                                                                                                                                                          |
| **Phase for Full Closure**     | Phase 10 (method validation + analyte registry)                                                                                                                                                                                                                                                                            |
| **Root Cause**                 | Analyte validation (linearity, accuracy, precision) data exists informally; not formalized in auditable system; Westgard rules not fully implemented                                                                                                                                                                       |
| **Corrective Action**          | **Phase 4:** 1. Phase 10 plan (analyte registry schema, validation data structure, Westgard CLSI CV targets) 2. Analyte registry seed (17 analytes from bioquimica module v1.3) 3. Validation data template (linearity, accuracy, precision fields) **Phase 10:** Implement full analyte registry + validation audit trail |
| **Evidence (Phase 4)**         | PDF: Phase 10 plan + analyte registry template + Westgard reference                                                                                                                                                                                                                                                        |
| **Phase 4 Deliverable**        | Phase plans (Task 3.1)                                                                                                                                                                                                                                                                                                     |
| **Success Criteria (Phase 4)** | Phase 10 plan auditor-approved, analyte registry seed shows 17 analytes from Bioquímica, CLSI CV targets clear                                                                                                                                                                                                             |

---

#### **NC-009: CEQ (External QA) Annual Evaluation Report Missing for 2025**

| Field                 | Value                                                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**          | 🟠 Major                                                                                                                                                                                                                                                |
| **Type**              | Build                                                                                                                                                                                                                                                   |
| **DICQ Block(s)**     | F (5.6.3.4)                                                                                                                                                                                                                                             |
| **RDC Article(s)**    | 176 (V)                                                                                                                                                                                                                                                 |
| **Micro-Module**      | `ceq-annual-report`                                                                                                                                                                                                                                     |
| **Root Cause**        | CEQ module exists (v1.3) but no annual aggregation report; 2025 results not formalized; z-score analysis not documented                                                                                                                                 |
| **Corrective Action** | 1. Implement ceq-annual-report module (aggregate 2025 CEQ results by equipment × analyte) 2. Calculate z-scores, % acceptable/unsatisfactory 3. Flag unsatisfactory results → auto-create NC + CAPA 4. Generate RT-signed report (auditor-ready format) |
| **Evidence**          | 2025 CEQ annual report PDF (z-scores, unsatisfactory findings marked, NC auto-created), RT signature, Firestore audit trail                                                                                                                             |
| **Verification**      | Auditor reviews report; spot-checks 3 analytes (z-scores correct, unsatisfactory marked, NC created); confirms RT signed                                                                                                                                |
| **Phase 4 Task**      | 2.5 (CEQ Annual Report module)                                                                                                                                                                                                                          |
| **Effort**            | 2–3 days                                                                                                                                                                                                                                                |
| **Success Criteria**  | 2025 CEQ report generated, RT-signed, unsatisfactory findings marked + NC auto-created, auditor confirms compliance                                                                                                                                     |

---

#### **NC-010: PGRSS (Waste Management) — No Collection + Disposal Tracking**

| Field                          | Value                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                   | 🟠 Major                                                                                                                                                                                                                                                                                    |
| **Type**                       | Deferred                                                                                                                                                                                                                                                                                    |
| **DICQ Block(s)**              | E (5.7.4)                                                                                                                                                                                                                                                                                   |
| **RDC Article(s)**             | RDC 222/2018                                                                                                                                                                                                                                                                                |
| **Phase for Full Closure**     | Phase 10 (PGRSS module)                                                                                                                                                                                                                                                                     |
| **Root Cause**                 | Biological waste exists informally; no segregation, collection, or disposal tracking; contractor agreements not documented                                                                                                                                                                  |
| **Corrective Action**          | **Phase 4:** 1. Phase 10 plan (waste classification NB1–NB5, segregation rules, collection schedule, contractor tracking) 2. Waste classification matrix (sample types → classification) 3. PGRSS SOP template **Phase 10:** Implement full PGRSS module with audit trail + contractor eval |
| **Evidence (Phase 4)**         | PDF: Phase 10 plan + waste classification matrix                                                                                                                                                                                                                                            |
| **Phase 4 Deliverable**        | Phase plans (Task 3.1)                                                                                                                                                                                                                                                                      |
| **Success Criteria (Phase 4)** | Phase 10 plan auditor-approved, waste classification matrix clear, contractor tracking SOP drafted                                                                                                                                                                                          |

---

#### **NC-011: Biossegurança — Areas Classified (NB1–NB4) But No ISO 14644 Inspection Records**

| Field                          | Value                                                                                                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                   | 🟠 Major                                                                                                                                                                                                                                                                              |
| **Type**                       | Deferred                                                                                                                                                                                                                                                                              |
| **DICQ Block(s)**              | I (5.2.6)                                                                                                                                                                                                                                                                             |
| **RDC Article(s)**             | RDC 222/2018                                                                                                                                                                                                                                                                          |
| **Phase for Full Closure**     | Phase 10 (Biossegurança module)                                                                                                                                                                                                                                                       |
| **Root Cause**                 | Lab areas informally classified (NB1–NB4) but no ISO 14644 cleanroom classification records; no periodic re-certifications                                                                                                                                                            |
| **Corrective Action**          | **Phase 4:** 1. Phase 10 plan (area classification SOP, ISO 14644 inspection requirements, inspection schedule) 2. Area classification draft (mark areas on floor plan) 3. Inspection checklist template **Phase 10:** Implement full biossegurança module with ISO 14644 audit trail |
| **Evidence (Phase 4)**         | PDF: Phase 10 plan + area classification map + inspection checklist                                                                                                                                                                                                                   |
| **Phase 4 Deliverable**        | Phase plans (Task 3.1)                                                                                                                                                                                                                                                                |
| **Success Criteria (Phase 4)** | Phase 10 plan auditor-approved, area classifications identified, inspection schedule clear                                                                                                                                                                                            |

---

#### **NC-012: Risk Management Plan — Matrix Present But No Controls + Revalidation Scheduled**

| Field                 | Value                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Severity**          | 🟠 Major                                                                                                                                                                                                                                                           |
| **Type**              | Build                                                                                                                                                                                                                                                              |
| **DICQ Block(s)**     | A, D (4.14.6)                                                                                                                                                                                                                                                      |
| **RDC Article(s)**    | 86 (componente 2)                                                                                                                                                                                                                                                  |
| **Micro-Module**      | `risk-management`                                                                                                                                                                                                                                                  |
| **Root Cause**        | Risk matrix exists but lacks: controls documentation, NPR calculation, revalidation triggers (anniversary + NC-driven), control effectiveness evidence                                                                                                             |
| **Corrective Action** | 1. Implement risk-management module (FMEA-lite: 15+ risks, P/S/D scoring, NPR = P×S×D) 2. Document controls per risk (preventive + detective) 3. Implement revalidation workflow (annual anniversary + when related NC created) 4. Generate heatmap + audit report |
| **Evidence**          | Risk matrix heatmap (screenshot), PDF report (15 risks + controls), NPR calculations verified                                                                                                                                                                      |
| **Verification**      | Auditor spot-checks 5 random risks: P/S/D scoring reasonable, controls documented, NPR >50 marked as high-priority                                                                                                                                                 |
| **Phase 4 Task**      | 2.6 (Risk Management module)                                                                                                                                                                                                                                       |
| **Effort**            | 2–3 days                                                                                                                                                                                                                                                           |
| **Success Criteria**  | 15 risks documented, controls assigned, revalidation workflow operational, auditor confirms NPR logic correct                                                                                                                                                      |

---

## Firestore Schema Sketch

### Collections Added in Phase 4

#### **1. `/labs/{labId}/capa-tracking/{capaId}`**

Purpose: Track CAPA state machine (open → in-progress → verification → closed) with immutable audit trail.

```typescript
// Type Definition
interface CapaTracking {
  id: string;
  labId: string;
  ncId: string; // reference to original non-conformity

  // Descriptive
  title: string; // "Equipment calibration records incomplete"
  severity: 'critica' | 'alta' | 'media' | 'baixa';
  type: 'process' | 'build' | 'deferred';

  // State Machine
  state:
    | 'aberto'
    | 'em-andamento'
    | 'evidencia-submetida'
    | 'auditor-revisando'
    | 'fechado'
    | 'cancelada';
  transitions: CapaTransition[]; // immutable array (append-only)

  // Timeline & Accountability
  dataAbertura: Timestamp;
  dataVencimento: Timestamp;
  daysRemaining?: number; // computed client-side
  deadlineStatus?: 'on-track' | 'at-risk' | 'overdue'; // computed

  // Evidence
  evidence: CapaEvidenceRef[];
  evidenceChainHash?: string; // SHA-256 of all evidence hashes

  // Signatures
  openedBy: string; // operatorId
  closedBy?: string; // RT signature
  closureSignature?: LogicalSignature;

  // Audit Trail
  auditLog: CapaAuditEvent[];

  // Soft Delete
  deletedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CapaTransition {
  from: string;
  to: string;
  operatorId: string;
  signature: LogicalSignature; // immutable proof
  notes?: string;
  timestamp: Timestamp;
}

interface CapaEvidenceRef {
  id: string;
  filename: string;
  storagePath: string; // gs://bucket/labs/{labId}/capa-evidence/{capaId}/{filename}
  hash: string; // SHA-256 for integrity check
  uploadedBy: string;
  uploadedAt: Timestamp;
  description?: string;
}

interface LogicalSignature {
  hash: string; // SHA-256(operatorId || timestamp || capaId)
  operatorId: string;
  ts: Timestamp;
}

interface CapaAuditEvent {
  timestamp: Timestamp;
  event: string; // 'state-transition' | 'evidence-added' | 'rfi-submitted' | 'auditor-response'
  operator: string;
  details: Record<string, unknown>;
}
```

**Firestore Rules (sketch):**

```typescript
match /labs/{labId}/capa-tracking/{capaId} {
  // Read: lab member can read
  allow read: if isActiveMemberOfLab(labId);

  // Create: via callable only
  allow create: if false;

  // Update: via callable only (state transitions)
  allow update: if false;

  // Delete: soft-delete via callable (deletedAt timestamp)
  allow delete: if false;

  // Evidence sub-collection (append-only)
  match /evidence/{evidenceId} {
    allow create: if isActiveMemberOfLab(labId); // via callable
    allow read: if isActiveMemberOfLab(labId);
    allow update, delete: if false; // immutable
  }

  // Audit log (append-only)
  match /audit/{auditId} {
    allow create: if isActiveMemberOfLab(labId);
    allow read: if isActiveMemberOfLab(labId);
    allow update, delete: if false;
  }
}
```

---

#### **2. `/labs/{labId}/calibracao/{equipId}`**

Purpose: Equipment calibration tracking with metrological traceability.

```typescript
interface Calibracao {
  id: string;
  equipId: string; // reference to equipamentos collection
  labId: string;

  // Calibration History
  calibrationMethod: 'in-house' | 'external-provider';
  lastCalibrationDate: Timestamp;
  nextDueDate: Timestamp;

  // Metrological Traceability
  certificateURL: string; // Cloud Storage path
  calibrationRange: { min: number; max: number; unit: string };
  expandedUncertainty: number;
  acceptanceCriteria: { min: number; max: number; unit: string };

  // Status Computed
  status: 'in-date' | 'warning-30d' | 'warning-7d' | 'overdue';
  daysUntilDue?: number;

  // Provider Info (if external)
  externalProvider?: {
    name: string;
    CNPJ: string;
    contactEmail: string;
    calibrationCertificate?: string; // filename
  };

  // Audit Trail
  lastUpdatedBy: string;
  lastUpdatedAt: Timestamp;
  auditLog: CalibracaoAuditEvent[];

  // Soft Delete
  deletedAt?: Timestamp;
}

interface CalibracaoAuditEvent {
  timestamp: Timestamp;
  event: string; // 'certificate-uploaded' | 'status-changed' | 'alert-triggered'
  operator: string;
  details: Record<string, unknown>;
}
```

**Firestore Rules (sketch):**

```typescript
match /labs/{labId}/calibracao/{equipId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create, update: if isActiveMemberOfLab(labId) && request.auth.token.role in ['manager', 'admin'];
  allow delete: if false; // soft-delete only
}
```

---

#### **3. `/labs/{labId}/personnel-cargos/{cargoId}`**

Purpose: Role definitions with authority matrix.

```typescript
interface PersonnelCargo {
  id: string;
  labId: string;

  // Role Identity
  nome: string; // "Responsável Técnico"
  descricao: string; // 2 paragraphs on scope, authority, responsibilities
  secao: string; // "qualidade" | "analise" | "coleta"

  // Requirements
  requisitosMinimos: {
    educacao: string; // "Curso superior em Análises Clínicas ou Farmácia"
    certificacoes?: string[]; // ["PROFAE", "ISO 15189 internal auditor"]
    experienciaMinima: number; // years
  };

  // Authority Matrix
  authorityMatrix: {
    canReleaseLaudos: boolean;
    canApproveTraining: boolean;
    canSignNonConformities: boolean;
    canApproveCalibration: boolean;
    canAccessAdminPanel: boolean;
  };

  // Substitution
  substituidor?: string; // cargoId of backup role

  // Audit Trail
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  auditLog: CargosAuditEvent[];

  // Soft Delete
  deletedAt?: Timestamp;
}

interface CargosAuditEvent {
  timestamp: Timestamp;
  event: string; // 'created' | 'authority-changed' | 'substitution-updated'
  operator: string;
  details: Record<string, unknown>;
}
```

---

#### **4. `/labs/{labId}/personnel-designacoes/{designacaoId}`**

Purpose: Formal role assignments (RT, QA Manager, Director) with digital signatures.

```typescript
interface PersonnelDesignacao {
  id: string;
  labId: string;

  // Assignment
  personId: string; // reference to staff person
  cargoId: string; // reference to role (personnel-cargos)

  // Temporal
  dataDesignacao: Timestamp;
  vigencia: number; // years (typically 5)
  dataVencimento?: Timestamp; // computed: dataDesignacao + vigencia

  // Justification
  motivo: string; // "Qualificações: Farmacêutico com 15 anos em análises clínicas, certificado ISO 15189..."

  // Digital Signature
  assinatura: LogicalSignature;
  assinadoPor: string; // operatorId (Lab Director)

  // Audit Trail
  createdAt: Timestamp;
  updatedAt: Timestamp;
  auditLog: DesignacaoAuditEvent[];

  // Revocation (soft)
  revokedAt?: Timestamp;
  motivoRevogacao?: string;
  revokedBy?: string;
}

interface DesignacaoAuditEvent {
  timestamp: Timestamp;
  event: string; // 'created' | 'revoked' | 'signature-verified'
  operator: string;
  details: Record<string, unknown>;
}
```

---

#### **5. `/labs/{labId}/management-review/{meetingId}`**

Purpose: Annual governance meeting with 15-entry aggregation and audit trail.

```typescript
interface ManagementReviewMeeting {
  id: string;
  labId: string;

  // Meeting Meta
  dataReuniaoAnual: Timestamp;
  periodo: string; // "2025-05" (May 2025)

  // 15 Mandatory Entries (aggregated)
  entries: ManagementReviewEntry[];

  // Minutes
  atas: {
    conteudo: string; // meeting notes
    decisoes: string[]; // action items
    attendees: string[]; // personIds
  };

  // Signatures
  signatures: {
    diretor: LogicalSignature;
    gerenteQualidade: LogicalSignature;
    responsavelTecnico?: LogicalSignature;
  };

  // Audit Trail
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  auditLog: ReviewAuditEvent[];

  // Soft Delete
  deletedAt?: Timestamp;
}

interface ManagementReviewEntry {
  id: number; // 1–15
  title: string; // "NC Trends"
  description: string;
  dataSource: string; // module that provided this entry (e.g., "nao-conformidades", "bioquimica")
  metrics: Record<string, unknown>; // e.g., { totalNCs: 12, openCount: 3, closedCount: 9 }
  status: 'compliant' | 'at-risk' | 'non-compliant';
}

interface ReviewAuditEvent {
  timestamp: Timestamp;
  event: string; // 'created' | 'entry-added' | 'minutes-signed' | 'approved'
  operator: string;
  details: Record<string, unknown>;
}
```

---

#### **6. `/labs/{labId}/ceq-annual-report/{reportId}`**

Purpose: Annual CEQ evaluation with z-score analysis and auto-generated non-conformities.

```typescript
interface CEQAnnualReport {
  id: string;
  labId: string;

  // Report Meta
  year: number; // 2025
  scheme: string; // "PNCQ" or external provider

  // Results Summary
  resultsSummary: CEQResultSummary[];

  // Statistics
  stats: {
    totalResults: number;
    acceptableCount: number;
    acceptablePercent: number;
    unsatisfactoryCount: number;
    unsatisfactoryPercent: number;
  };

  // Unsatisfactory Findings
  unsatisfactoryFindings: CEQUnsatisfactoryFinding[];

  // Corrective Actions from Prior Years (if any)
  priorCAPAs?: string[]; // capaIds

  // Recommendations
  recommendations: string[]; // staff retraining, equipment replacement, method changes

  // Approval
  approvedBy: string; // RT operatorId
  approvalSignature: LogicalSignature;
  approvedAt: Timestamp;

  // Audit Trail
  createdAt: Timestamp;
  auditLog: CEQAuditEvent[];

  // Soft Delete
  deletedAt?: Timestamp;
}

interface CEQResultSummary {
  analyte: string;
  equipment: string;
  nResults: number;
  zScoreAverage: number;
  zScoreStdDev: number;
  percentAcceptable: number;
  status: 'acceptable' | 'unsatisfactory';
}

interface CEQUnsatisfactoryFinding {
  id: string;
  analyte: string;
  equipment: string;
  zScore: number;
  date: Timestamp;
  ncIdCreated?: string; // auto-created non-conformity
  capaIdLinked?: string; // linked CAPA
}

interface CEQAuditEvent {
  timestamp: Timestamp;
  event: string; // 'report-generated' | 'unsatisfactory-marked' | 'nc-created' | 'approved'
  operator: string;
  details: Record<string, unknown>;
}
```

---

#### **7. `/labs/{labId}/risk-management/{riskId}`**

Purpose: FMEA-lite risk matrix with controls and revalidation tracking.

```typescript
interface RiskManagement {
  id: string;
  labId: string;

  // Risk Identity
  hazardDescription: string; // "Hemolysis during blood collection"
  category: string; // 'pre-analytic' | 'analytic' | 'post-analytic' | 'equipment' | 'personnel' | 'environment'

  // FMEA Scoring
  probability: number; // 1–5 (likelihood)
  severity: number; // 1–5 (impact)
  detectability: number; // 1–5 (ease of detection)
  NPR: number; // P × S × D (1–125)
  riskLevel: 'low' | 'medium' | 'high'; // NPR: 1–20 = low, 21–50 = medium, >50 = high

  // Controls
  preventiveControls: RiskControl[];
  detectiveControls: RiskControl[];

  // Revalidation
  revalidationDueDate: Timestamp;
  revalidationTriggeredBy?: string[]; // ['ncId-005', 'anniversary-2025-05']
  lastRevalidationDate?: Timestamp;

  // Audit Trail
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  auditLog: RiskAuditEvent[];

  // Soft Delete
  deletedAt?: Timestamp;
}

interface RiskControl {
  id: string;
  description: string; // "Daily visual inspection of centrifuge"
  owner: string; // cargoId responsible
  effectiveness: 'high' | 'medium' | 'low';
  frequency: string; // "daily" | "weekly" | "quarterly"
}

interface RiskAuditEvent {
  timestamp: Timestamp;
  event: string; // 'created' | 'control-added' | 'revalidation-triggered' | 'npr-recalculated'
  operator: string;
  details: Record<string, unknown>;
}
```

---

### Cloud Functions (Callables)

#### **Phase 4 Cloud Function Stubs (to be implemented)**

```typescript
// functions/src/modules/capa-tracking/
export const updateCAPAStatus = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Transition CAPA from one state to another
    // Input: { labId, capaId, toStatus, notes }
    // Output: { success, newStatus, signature }
  });

export const submitCapaEvidence = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Upload evidence file + metadata
    // Input: { labId, capaId, filename, hash, description }
    // Output: { success, storagePath }
  });

export const submitAuditorRFI = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Submit question to auditor
    // Input: { labId, capaId, question, evidenceNeeded, deadline }
    // Output: { success, rfiId, emailSent }
  });

// functions/src/modules/calibracao/
export const uploadCalibracaoCertificate = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Upload calibration cert + update next-due-date
    // Input: { labId, equipId, certificateFile, lastDate, nextDate }
    // Output: { success, storePath, status }
  });

// functions/src/modules/personnel/
export const createCargo = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Create role definition
    // Input: { labId, nome, descricao, requisitos, authorityMatrix, substituidor }
    // Output: { success, cargoId }
  });

export const createDesignacao = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Create formal assignment (RT, QA Mgr, Director)
    // Input: { labId, personId, cargoId, dataDesignacao, motivo, assinaturaDiretor }
    // Output: { success, designacaoId, assinatura }
  });

// functions/src/modules/management-review/
export const aggregateManagementReviewData = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Query all 15 sources, return aggregated object
    // Input: { labId, periodo (e.g., "2025-05") }
    // Output: { 15 entries with metrics }
  });

export const createManagementReviewMeeting = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Create meeting + sign
    // Input: { labId, periodo, entries, atas, signatures }
    // Output: { success, meetingId }
  });

// functions/src/modules/ceq/
export const generateCEQAnnualReport = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Aggregate CEQ results, flag unsatisfactory, create NCs
    // Input: { labId, year }
    // Output: { success, reportId, unsatisfactoryCount }
  });

// functions/src/modules/risk-management/
export const createRisk = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // Create risk + calculate NPR
    // Input: { labId, hazard, P, S, D, controls }
    // Output: { success, riskId, NPR }
  });
```

---

## Execution Plan by Wave

### Wave 1: Foundation & Micro-Module Preparation (Days 1–4 of Phase 4)

**Goal:** Establish CAPA infrastructure, kick off implementations, align with auditor.

#### **Task 1.1: CAPA Tracking Dashboard Schema + Service (1.5 days)**

**What:**

- Define `CapaTracking` Firestore collection with state machine (open → in-progress → verification → closed)
- Implement service layer: CRUD operations + state transition validation
- Deploy Firestore rules (soft-delete, callable-only writes, signature validation)
- Write unit tests (state transitions, evidence append-only)

**Deliverables:**

- `src/features/capa-tracking/types/index.ts` — TypeScript interfaces for CAPA, transitions, evidence, signatures
- `src/features/capa-tracking/services/capaService.ts` — CRUD + mapping
- `.firebase/firestore.rules` — rule blocks for capa-tracking collection
- `src/features/capa-tracking/__tests__/capaService.test.ts` — unit tests for state machine

**Acceptance:**

- TypeScript: 0 errors
- Tests: state transitions pass (open → in-progress → verification → closed)
- Evidence append-only test passes
- Rules test in emulator: deny client-direct write, allow callable only

---

#### **Task 1.2: Auditor RFI Workflow — Async Email Gate (1 day)**

**What:**

- Implement in-app form for auditor Q&A (no scheduling required)
- Cloud Function callable that sends email to auditor + logs in Firestore
- Async response tracking (auditor email → parsed response → state update)

**Deliverables:**

- `src/features/capa-tracking/components/AuditorRFIForm.tsx` — form component (question, evidence link, deadline)
- `functions/src/modules/capa-tracking/submitAuditorRFI.ts` — callable that sends email + logs
- Email template (auto-generated with lab name, CAPA title, response link)
- RFI log stored in `/labs/{labId}/capa-tracking/{capaId}/rfi-log/`

**Acceptance:**

- Form submits successfully (Zod validation)
- Email sent to auditor email address (confirm via test mailbox)
- RFI logged in Firestore with timestamp
- Response SLA tracked (target: 24h)

---

#### **Task 1.3: Phase 4 Micro-Modules Kickoff (1.5 days)**

**What:**

- Scaffold 6 micro-modules:
  1. `calibracao`
  2. `personnel/cargos`
  3. `personnel/designacoes`
  4. `management-review`
  5. `ceq/annual-report`
  6. `risk-management`
- Create CLAUDE.md for each (rules, DICQ mapping, effort estimate, status)
- Define file structure (types/, services/, hooks/, components/)
- Identify integration points with existing modules

**Deliverables:**

- Directory structure created: `src/features/{calibracao,personnel,management-review,ceq,risk}/`
- Each module: `CLAUDE.md` with rules, DICQ block mapping, effort breakdown
- Integration map: which modules feed into which (calibracao → equipment registry, personnel → management review, etc.)

**Acceptance:**

- All 6 modules have scaffolded CLAUDE.md
- File structure in place (types/, services/, hooks/, components/)
- Integration points identified and documented

---

#### **Task 1.4: Auditor Pre-Alignment Call (0.5 day)**

**What:**

- 1-hour video call with external auditor + RT (Lab Technical Manager) + CTO
- Confirm Phase 4 scope, evidence format, RFI workflow
- Live demo of CAPA dashboard + micro-modules
- Agree on auditor availability + response SLA (target: 24h)

**Agenda:**

1. 12 CAPA inventory review (expected closure dates)
2. Evidence format expectations (screenshots, PDFs, audit logs, certificates)
3. RFI workflow walkthrough (async form vs. email chains)
4. Micro-module demonstration (calibracao, personnel UIs on tablet/laptop)
5. Auditor availability confirmation + standing call schedule (weekly, Fridays 10:00 BRT)
6. Sign-off ceremony date (target: 2026-06-28, assuming Phase 4 ends 2026-06-15)

**Deliverables:**

- Meeting notes (Firestore doc: `/labs/{labId}/capa-tracking/auditor-alignment-call-2026-05-xx/`)
- Agreed-upon evidence checklist (per CAPA, what's needed)
- Auditor email + response SLA confirmed
- Standing call scheduled (Fridays, recurring)
- Phase 4 kickoff date finalized (target: 2026-05-20)

**Acceptance:**

- Auditor confirms Phase 4 scope + timeline
- RFI workflow accepted (no requirement for synchronous calls per CAPA)
- Evidence expectations documented
- CTO + auditor aligned on risk register (NC-005–012 deferred to Phases 8–10)

---

### Wave 2: Micro-Module Implementation (Days 5–18 of Phase 4)

**Goal:** Complete 6 micro-modules (calibracao, personnel×2, management-review, ceq, risk) with production-ready code + E2E tests.

#### **Task 2.1: `calibracao` Module (4–5 days)**

**Purpose:** Equipment calibration with metrological traceability (closes NC-002).

**Scope:**

- Read equipment registry from `equipamentos` collection (v1.3)
- Per-equipment: calibration date, next-due-date, certificate storage, metrological range
- Status badges: in-date, warning-30d, warning-7d, overdue (auto-creates NC)
- Alert system: email + in-app notification when due
- Callable: upload certificate + update dates

**Implementation:**

1. **Types** (`src/features/calibracao/types/index.ts`):
   - `Calibracao`, `CalibracaoStatus`, `CalibracaoAuditEvent`

2. **Service** (`src/features/calibracao/services/calibracaoService.ts`):
   - `getAllEquipmentCalibracoes(labId)` — query with status computation
   - `submitCalibracaoCertificate(equipId, cert, metadata)` — uploads to Cloud Storage

3. **Hooks** (`src/features/calibracao/hooks/useCalibracoes.ts`):
   - Real-time subscription to calibracao records
   - Compute status badge (on-track, at-risk, overdue) in hook

4. **UI Components**:
   - `CalibracaoList.tsx` — equipment table (15 rows), status badges, next-due date
   - `CalibracaoCertificateUpload.tsx` — drag-drop PDF + metadata form
   - `CalibracaoAlerts.tsx` — 30d/7d/overdue alert display + disable equipment option
   - `CalibracaoAuditReport.tsx` — PDF export (all equipment + status + cert links)

5. **Cloud Function** (`functions/src/modules/calibracao/uploadCalibracaoCertificate.ts`):
   - Validate PDF, compute SHA-256 hash
   - Store in Cloud Storage: `gs://bucket/labs/{labId}/calibracoes/{equipId}/{cert-filename}`
   - Update Firestore: `lastCalibrationDate`, `nextDueDate`, `status`
   - Trigger alert if overdue

6. **Tests**:
   - Unit: status computation (date comparison, badge color logic)
   - Integration: upload cert → status updates → alert fires
   - E2E (Detox): navigate to calibracao, upload cert, verify UI reflects

7. **Firestore Rules**:
   - Allow manager/admin to upload
   - Immutable once approved
   - Soft-delete only

**Evidence for NC-002 Closure:**

- Screenshot of calibracao dashboard (all 15 equipment + next-due dates)
- PDF export of audit report
- Demo video: upload new cert → alert triggers
- Audit log export (Firestore events)

**Acceptance Criteria:**

- [ ] All 15 equipment records exist with current calibration dates
- [ ] Status badge displays correctly (green/yellow/red)
- [ ] Alert system triggers email + in-app (7d before due)
- [ ] Certificate upload works (drag-drop, PDF validation)
- [ ] E2E test: upload cert → status changes → alert fires
- [ ] Firestore rules: deny client-direct write, allow callable only
- [ ] 0 TypeScript errors

---

#### **Task 2.2: `personnel-cargos` Module (3–4 days)**

**Purpose:** Formally document 8+ roles with authority matrix (closes NC-003).

**Scope:**

- 8 roles: Analyst, CIQ Supervisor, RT, QA Manager, Director, Phlebotomist, Trainee, Support
- Per-role: title, description, requirements (degree, certs, experience), substitution, authority matrix
- UI: org chart (visual hierarchy), role cards, authority matrix (interactive checkboxes)
- PDF: role definitions + authority matrix (printable, signed)

**Implementation:**

1. **Types** (`src/features/personnel/cargos/types/index.ts`):
   - `PersonnelCargo`, `CargosAuthorityMatrix`, `CargosAuditEvent`

2. **Service** (`src/features/personnel/cargos/services/cargosService.ts`):
   - `createCargo(cargo_def)` — validate, create, log
   - `getAllCargos(labId)` — query for org chart
   - `getCargo(labId, cargoId)` — single role detail

3. **Hooks** (`src/features/personnel/cargos/hooks/useCargos.ts`):
   - Real-time subscription to cargos
   - Compute org chart structure (Director at top, Supervisors below, Analysts at bottom)

4. **UI Components**:
   - `CargosOrgChart.tsx` — visual org chart (D3 or SVG) with role boxes + photos
   - `CargoDefinition.tsx` — detail card (role name, description, requirements, substitution)
   - `CargoAuthorityMatrix.tsx` — interactive checkboxes (RT can release? QA mgr can approve?)
   - `CargoDefinitionCertificate.tsx` — printable PDF (role definition + signed by Director)

5. **Cloud Function** (`functions/src/modules/personnel/createCargo.ts`):
   - Validate role name (unique per lab)
   - Create + log in Firestore

6. **Tests**:
   - Unit: org chart structure generation (parent-child relationships)
   - E2E: create role → appears in org chart → authority matrix updates
   - Authority matrix logic: RT distinguished from Analyst

7. **Firestore Rules**:
   - Admin/Director only can create
   - Read-only for others

**Evidence for NC-003 Closure:**

- Org chart screenshot (visual hierarchy)
- PDF: authority matrix (checkboxes)
- PDF: 8 role definition certificates (printable, signed by Director)
- Firestore audit log (creation timestamps + operators)

**Acceptance Criteria:**

- [ ] 8 role definitions created + stored in Firestore
- [ ] Org chart displays correctly (hierarchy, role names, photos if available)
- [ ] Authority matrix populated (RT distinguished from Analyst)
- [ ] Role certificates printable (PDF, signed)
- [ ] E2E test: create role → org chart updates → certificate generates
- [ ] 0 TypeScript errors

---

#### **Task 2.3: `personnel-designacoes` Module (2–3 days)**

**Purpose:** Formal written designations for RT, QA Manager, Director (closes NC-004).

**Scope:**

- 3 mandatory designations: RT, QA Manager, Director
- Per-designacao: person, role, date, justification (qualifications), vigencia (5 years), signature
- Immutable once signed
- Audit trail of designations + revocations

**Implementation:**

1. **Types** (`src/features/personnel/designacoes/types/index.ts`):
   - `PersonnelDesignacao`, `DesignacaoAuditEvent`

2. **Service** (`src/features/personnel/designacoes/services/designacoesService.ts`):
   - `createDesignacao(person, cargo, date, motivo, signature)` — atomic write
   - `getAllDesignacoes(labId)` — current + historical
   - `revokeDesignacao(designacaoId, motivo)` — soft revoke

3. **Hooks** (`src/features/personnel/designacoes/hooks/useDesignacoes.ts`):
   - Real-time subscription
   - Compute vigencia expiry (data + 5 years)

4. **UI Components**:
   - `DesignacoesList.tsx` — table (current + historical, with revocation status)
   - `DesignacaoForm.tsx` — combo (pick person → cargo → date + sign)
   - `DesignacaoCertificate.tsx` — printable PDF (signed, sealed)

5. **Cloud Function** (`functions/src/modules/personnel/createDesignacao.ts`):
   - Validate person exists, role exists
   - Generate LogicalSignature (HMAC-SHA256)
   - Atomic transaction: update + log

6. **Tests**:
   - Unit: signature generation + verification
   - Unit: vigencia expiry calculation
   - E2E: create designacao → certificate generates → audit trail shows

7. **Firestore Rules**:
   - Director + Admin only can create/revoke
   - Immutable once signed

**Evidence for NC-004 Closure:**

- 3 formal designação certificates (PDF, signed by Director)
- Audit log export (Firestore designacao/audit/)
- Demo: show RT, QA Manager, Director designations + signatures

**Acceptance Criteria:**

- [ ] 3 designações created (RT, QA Manager, Director)
- [ ] Certificates signed + printable
- [ ] Audit trail immutable (soft-revoke only, no hard delete)
- [ ] Vigencia dates calculated correctly (5 years)
- [ ] E2E test: create designacao → certificate → audit trail
- [ ] 0 TypeScript errors

---

#### **Task 2.4: `management-review` Module (3–4 days)**

**Purpose:** Annual governance meeting with 15-entry aggregation (closes NC-001).

**Scope:**

- 15 mandatory entries (auto-aggregated from other modules):
  1. NC trends (count, open/closed)
  2. CAPA status
  3. Training hours
  4. CEQ results
  5. Audit findings
  6. Budget variance
  7. KPI trends
  8. Complaints
  9. Supplier performance
  10. Regulatory changes
  11. Improvement ideas
  12. Personnel changes
  13. Audit plan
  14. Incident log
  15. Compliance gaps
- Minutes + attendees + decisions
- Signed atas (Director + QA Manager)
- PDF export (auditor-ready)

**Implementation:**

1. **Types** (`src/features/management-review/types/index.ts`):
   - `ManagementReviewMeeting`, `ManagementReviewEntry`, `ReviewAuditEvent`

2. **Data Aggregator** (`src/features/management-review/services/aggregator.ts`):
   - Query each of 15 sources:
     - NC module: count critical/high/medium/low
     - CAPA tracking: count open/in-progress/closed
     - Training: total hours, people overdue revalidation
     - CEQ: z-score avg, % unsatisfactory
     - Audit logs: count findings
     - KPI module: turnaround, retrabalho%, conformance
     - Complaints: count, RCA status
     - Personnel: hires, departures, vacancies
     - Risk: NPR >50, revalidations due
     - Compliance: DICQ re-score

3. **Service** (`src/features/management-review/services/reviewService.ts`):
   - `aggregateManagementReviewData(labId, periodo)` — callable that queries all 15
   - `createManagementReviewMeeting(data, atas, signatures)` — atomic write

4. **Hooks** (`src/features/management-review/hooks/useManagementReview.ts`):
   - Load aggregated data (real-time)
   - Load current + historical meetings

5. **UI Components**:
   - `ManagementReviewMeeting.tsx` — form to create meeting
   - `ManagementReviewDataViewer.tsx` — display 15 entries (read-only, auto-populated)
   - `ManagementReviewMinutes.tsx` — form for atas (decisions, action items, attendees)
   - `ManagementReviewSignatures.tsx` — signature capture (Director, QA Manager)
   - `ManagementReviewExportPDF.tsx` — puppeteer render (professional, audit-ready)

6. **Cloud Function** (`functions/src/modules/management-review/aggregateManagementReviewData.ts`):
   - Query Firestore collections (naoConformidades, capa-tracking, educacao-continuada, ceq, etc.)
   - Compute aggregates
   - Return 15-entry object

7. **Tests**:
   - Unit: aggregation logic (NC count, CAPA status, training hours)
   - Integration: aggregate call returns all 15 entries
   - E2E: create meeting → aggregate data → sign → export PDF

8. **Firestore Rules**:
   - Director + QA Manager can create
   - Read-only for staff
   - Immutable once signed

**Evidence for NC-001 Closure:**

- Mock 2025-05 annual review PDF (all 15 entries filled with realistic data)
- Minutes + signature page
- Audit trail (creation + signature timestamps)

**Acceptance Criteria:**

- [ ] 15-entry aggregator functional (all sources respond in <2s)
- [ ] Mock 2025-05 meeting created with all 15 entries
- [ ] Minutes form captures decisions + attendees
- [ ] Signatures immutable (once signed, can't be changed)
- [ ] PDF export audit-ready format
- [ ] E2E test: create meeting → aggregate → sign → export
- [ ] 0 TypeScript errors

---

#### **Task 2.5: `ceq-annual-report` Module (2–3 days)**

**Purpose:** Annual CEQ evaluation report with z-score analysis (closes NC-009).

**Scope:**

- Read CEQ results from v1.3 ceq module
- Group by equipment × analyte
- Calculate z-scores, % acceptable, % unsatisfactory
- Flag z-score >2 as unsatisfactory → auto-create NC + CAPA link
- RT sign-off (immutable signature)

**Implementation:**

1. **Types** (`src/features/ceq/annual-report/types/index.ts`):
   - `CEQAnnualReport`, `CEQResultSummary`, `CEQUnsatisfactoryFinding`

2. **Service** (`src/features/ceq/annual-report/services/reportService.ts`):
   - `generateCEQAnnualReport(labId, year)` — aggregate + calc metrics
   - `getCEQAnnualReport(labId, reportId)` — retrieve

3. **Hooks** (`src/features/ceq/annual-report/hooks/useCEQAnnualReport.ts`):
   - Load report data

4. **UI Components**:
   - `CEQAnnualReportForm.tsx` — read-only data display (pre-filled from ceq module)
   - `CEQAnnualReportSummary.tsx` — table of analytes, equipment, z-scores, status
   - `CEQUnsatisfactoryList.tsx` — highlight z-score >2 findings
   - `CEQAnnualReportExport.tsx` — PDF export (RDC 178 format)

5. **Cloud Function** (`functions/src/modules/ceq/generateCEQAnnualReport.ts`):
   - Query CEQ results for year
   - Calculate z-scores, aggregate metrics
   - For each unsatisfactory: auto-create NC in naoConformidades collection
   - Log to capa-tracking (if linked to prior CAPA)

6. **Tests**:
   - Unit: z-score calculation (μ ± σ logic)
   - Unit: unsatisfactory detection (z > 2 or < -2)
   - Integration: generate report → NCs auto-created
   - E2E: load report → show unsatisfactory → verify NCs created

7. **Firestore Rules**:
   - QA + RT can approve
   - Read-only for auditor

**Evidence for NC-009 Closure:**

- 2025 CEQ annual report PDF (all analytes, z-scores, unsatisfactory marked)
- Evidence of unsatisfactory results → NCs auto-created
- RT signature on report

**Acceptance Criteria:**

- [ ] 2025 CEQ data aggregated from ceq module
- [ ] Z-scores calculated correctly (sample: spot-check 3 analytes)
- [ ] Unsatisfactory findings marked (z > ±2)
- [ ] NCs auto-created for unsatisfactory results
- [ ] RT signature captured + immutable
- [ ] PDF export audit-ready format
- [ ] E2E test: generate report → unsatisfactory → NC created
- [ ] 0 TypeScript errors

---

#### **Task 2.6: `risk-management` Module (2–3 days)**

**Purpose:** FMEA-lite risk matrix with controls and revalidation (closes NC-012).

**Scope:**

- 15+ risks identified (pre-analytic, analytic, post-analytic, equipment, personnel, environment)
- Per risk: hazard description, P/S/D scoring (1–5), NPR = P×S×D (1–125)
- Controls: preventive + detective (who, how often, effectiveness)
- Revalidation: annual anniversary + when related NC created
- Heatmap visualization (NPR color-coded)

**Implementation:**

1. **Types** (`src/features/risk-management/types/index.ts`):
   - `RiskManagement`, `RiskControl`, `RiskAuditEvent`

2. **Service** (`src/features/risk-management/services/riskService.ts`):
   - `createRisk(hazard, P, S, D, controls)` — calc NPR, store
   - `getAllRisks(labId)` — query all
   - `updateRiskControl(riskId, control)` — update control
   - `triggerRiskRevalidation(riskId, reason)` — mark for review

3. **Hooks** (`src/features/risk-management/hooks/useRisks.ts`):
   - Load all risks
   - Compute heatmap data (NPR, risk level)

4. **UI Components**:
   - `RiskMatrixHeatmap.tsx` — 5×5 grid (P vs S), NPR color-coded
   - `RiskDetail.tsx` — detail card + edit form (P/S/D sliders, controls)
   - `RiskRevalidationAlert.tsx` — show risks due for revalidation
   - `RiskManagementExportPDF.tsx` — heatmap + detail table (auditor-ready)

5. **Cloud Function** (`functions/src/modules/risk-management/createRisk.ts`):
   - Calculate NPR = P × S × D
   - Determine risk level (1–20 = low, 21–50 = medium, >50 = high)
   - Store + log

6. **Tests**:
   - Unit: NPR calculation (sample: 2×2×2 = 8, 5×5×5 = 125)
   - Unit: risk level determination (NPR > 50 = high)
   - Unit: revalidation trigger logic (annual + NC-driven)
   - E2E: create risk → heatmap updates → trigger revalidation
   - E2E: export PDF heatmap

7. **Firestore Rules**:
   - QA + CTO can create
   - Read-only for audit

**Evidence for NC-012 Closure:**

- Risk matrix heatmap (screenshot)
- PDF report (15 risks + controls + NPR calculations)
- Demo: create new risk + assign control + trigger revalidation
- Audit log (Firestore risk/audit/)

**Acceptance Criteria:**

- [ ] 15+ risks documented (pre/analytic/post-analytic, equipment, personnel, environment)
- [ ] P/S/D scoring reasonable (auditor spot-checks 5 random)
- [ ] NPR calculated correctly (sample verification)
- [ ] Controls assigned (preventive + detective)
- [ ] Revalidation workflow operational (anniversary + NC-triggered)
- [ ] Heatmap visualization renders correctly
- [ ] PDF export audit-ready format
- [ ] E2E test: create risk → heatmap → control assignment
- [ ] 0 TypeScript errors

---

### Wave 3: CAPA Closure & Auditor Sign-Off (Days 19–25 of Phase 4)

**Goal:** Close all 12 CAPAs with auditor sign-off; deliver final compliance report.

#### **Task 3.1: Build NC-005–NC-012 Evidence (for Deferred CAPAs) (3 days)**

**What:** Create documentation/phase plans for 8 deferred CAPAs; evidence that closure plan exists + timeline committed.

**For each CAPA (NC-005 → NC-012):**

1. **Phase plan document** (PDF):
   - Why deferred to Phase X
   - Scope, timeline, dependencies, success criteria
   - Integration with other modules
2. **Mock evidence** (screenshots, templates):
   - NC-005 (NOTIVISA): mock form, escalation SOP
   - NC-006 (SGD): mock List Master, distribution template
   - NC-007 (Pre-analytic): procedure templates (collection, transport)
   - NC-008 (Method validation): analyte registry template, Westgard reference
   - NC-010 (PGRSS): waste classification matrix, contractor SOP
   - NC-011 (Biossegurança): area classification map, ISO 14644 checklist
3. **Auditor message**: "Phase 4 documents root cause + Phase X closure plan; closure on-track"

**Deliverables:**

- `/capa-evidence/` folder:
  ```
  capa-evidence/
  ├── NC-005-NOTIVISA-DEFERRED/
  │   ├── phase-8-plan.pdf
  │   ├── mock-notivisa-form.png
  │   └── escalation-sop.md
  ├── NC-006-SGD-DEFERRED/
  │   ├── phase-9-plan.pdf
  │   ├── mock-list-master.png
  │   └── distribution-workflow.md
  │ ... (6 total)
  ```
- Summary document: "CAPA-DEFERRED-EVIDENCE-PACKAGE.pdf" (8 page plans + auditor message)

**Acceptance:**

- [ ] 8 phase plans documented (scope, timeline, dependencies clear)
- [ ] Mock evidence complete per CAPA
- [ ] Auditor message drafted (explaining deferral rationale)
- [ ] PDF package ready for auditor review

---

#### **Task 3.2: CAPA Evidence Compilation & Chain-of-Custody (4 days)**

**What:** Collect all evidence for 12 CAPAs, organize into audit-ready structure, verify chain integrity.

**For each CAPA (NC-001 → NC-012):**

1. **Root cause analysis** (1-page MD)
2. **Screenshots** (module UI, dashboard, database records)
3. **PDF artifacts** (certificates, reports, dashboards)
4. **Audit logs** (Firestore events, timestamps, signatures)
5. **Corrective action narrative** (what was done, by whom, when)
6. **Effectiveness verification** (re-test, re-audit, or forward-looking assurance)
7. **Auditor Q&A** (RFI responses, if any)

**Folder Structure:**

```
capa-evidence/
├── NC-001-MANAGEMENT-REVIEW/
│   ├── root-cause.md
│   ├── mock-meeting-2025-05.pdf
│   ├── atas-signed.pdf
│   ├── screenshots/
│   │   ├── management-review-form.png
│   │   └── 15-entries-filled.png
│   ├── audit-log.json
│   ├── CAPA-CLOSURE-EVIDENCE.json
│   │   ├── rootCauseAnalysis: "..."
│   │   ├── correctiveAction: "..."
│   │   ├── effectivenessVerification: "..."
│   │   ├── fileHashes: { "mock-meeting-2025-05.pdf": "sha256-hash" }
│   │   └── signature: { hash, operatorId, ts }
│   └── EVIDENCE-CHAIN-OF-CUSTODY.json
│       ├── createdAt
│       ├── compiledBy
│       ├── allFilesVerified: true
│       └── integrityHash: "sha256-hash-of-all-hashes"
│
├── NC-002-CALIBRACAO/
│   ├── root-cause.md
│   ├── equipment-audit-report.pdf
│   ├── 15-calibration-certificates/ (zipped)
│   ├── screenshots/
│   ├── audit-log.json
│   ├── CAPA-CLOSURE-EVIDENCE.json
│   └── EVIDENCE-CHAIN-OF-CUSTODY.json
│
│ ... (12 total, structured identically)
│
├── CAPA-CLOSURE-INDEX.json
│   ├── 12 CAPA entries
│   ├── Per CAPA: { id, title, state, closureDate, evidenceHash, integrityVerified }
│   └── masterIntegrityHash: "sha256-hash-of-all-12-evidence-packages"
│
└── CAPA-CLOSURE-MASTER-INTEGRITY-REPORT.md
    ├── Total CAPAs: 12
    ├── Total evidence files: ~150
    ├── Integrity check: ALL PASS
    ├── ChainOfCustody: VERIFIED
    └── GeneratedAt: 2026-06-15T00:00:00Z
```

**Verification Process (Task 3.2 sub-steps):**

1. **Hash all evidence files** (SHA-256 per file)
2. **Create integrity manifest** (index of all files + hashes)
3. **Master integrity hash** (SHA-256 of entire evidence package)
4. **Timestamp + sign** (LogicalSignature: operatorId, ts)
5. **Firestore log** (immutable audit trail of compilation)

**Tests:**

- [ ] All 12 CAPA folders exist with complete evidence
- [ ] No broken file links (all referenced PDFs, screenshots, logs present)
- [ ] Hash verification: no tampering detected
- [ ] Audit logs complete (all transitions recorded)
- [ ] Signatures valid (HMAC verification passes)

**Deliverables:**

- `/capa-evidence/` folder (complete, organized, auditor-ready)
- `CAPA-CLOSURE-INDEX.json` (machine-readable index)
- `CAPA-CLOSURE-MASTER-INTEGRITY-REPORT.md` (human-readable summary)

**Acceptance:**

- [ ] All 12 evidence packages complete
- [ ] Hash verification: 0 tampering detected
- [ ] All audit logs immutable
- [ ] No broken links
- [ ] Ready for auditor download (single .zip file)

---

#### **Task 3.3: CAPA Closure Auditor Sign-Off Ceremony (1 day)**

**What:** Async + optional sync with auditor to review evidence + formally close CAPAs.

**Process:**

1. **Send auditor evidence package** (email + Firestore link):
   - Evidence folder (.zip, ~50–100 MB)
   - Summary document (1-page CAPA-CLOSURE-PACKAGE-SUMMARY.pdf)
   - Response instructions (RFI form link if questions arise)
   - Deadline for review (target: 3–5 business days)

2. **Auditor reviews** (async):
   - Downloads evidence folder
   - Reviews per-CAPA evidence (root cause, corrective action, effectiveness)
   - If satisfied: email "All 12 CAPAs accepted as closed"
   - If questions: use RFI form (Task 1.2) to ask

3. **Response handling** (if RFI):
   - Lab team responds via RFI form (24h target SLA)
   - Auditor sees response in-app + email notification
   - Iterate until satisfied (target: <3 RFI cycles)

4. **Closure**:
   - Auditor final email: "12 CAPAs closed. Congratulations."
   - CTO logs confirmation in CAPA tracking (immutable)
   - Update all 12 CAPA states to "fechado" (closed)

**Deliverables:**

- Evidence package (.zip file, uploaded to Cloud Storage)
- Email from auditor: "12 CAPAs accepted as closed" (timestamp logged in Firestore)
- Signed CAPA closure memo (PDF, auditor signature + date)
- Firestore update: all 12 CAPAs state = "fechado", closedBy = auditorId, closureSignature = LogicalSignature
- PDF: "CAPA-CLOSURE-SIGN-OFF.pdf" (auditor confirmation + evidence summary)

**Acceptance Criteria:**

- [ ] Evidence package sent to auditor (email + timestamp logged)
- [ ] Auditor acknowledges receipt
- [ ] <0 unresolved RFI cycles after auditor final email
- [ ] All 12 CAPAs transitioned to state = "fechado" in Firestore
- [ ] Auditor sign-off memo signed + dated
- [ ] Immutable audit trail in CAPA tracking (signature + timestamp)

---

#### **Task 3.4: Final Compliance Report & DICQ Update (1 day)**

**What:** Measure DICQ conformance post-Phase 4; document blocks A, C, D improvement.

**Measurement Process:**

1. **Re-score DICQ 115-item checklist** (blocks A, C, D focused):
   - Block A (Governance): baseline 78% → target 86% (+8 pts from NC-001, NC-003, NC-004)
   - Block C (Personnel): baseline 80% → target 88% (+8 pts from NC-003, NC-004 + training evidence)
   - Block D (Quality): baseline 60% → target 70% (+10 pts from NC-001, NC-009, NC-012)
   - Overall: 78–82% → 84–86% (estimated +4–6 pts)

2. **Spot-check verification** (10 random DICQ items per block):
   - Auditor or CTO manually audits 30 items (10 per block)
   - <3 gaps = acceptable

3. **RDC 978 mapping**:
   - Verify Arts. 117, 181 coverage (100% expected)

**Deliverables:**

- `PHASE-4-DICQ-REASSESSMENT.md`:
  - Block-by-block re-score (old % → new % → delta)
  - Evidence references (which CAPAs + modules drove improvement)
  - Spot-check results (10 items per block + gap analysis)
  - RDC 978 coverage confirmation
- `DICQ-BLOCK-A-IMPROVEMENT.md` (governance):
  - Management review formalized (NC-001 ✓)
  - Roles documented (NC-003 ✓)
  - Designations formal (NC-004 ✓)
  - Risk matrix documented (NC-012 ✓)
  - Delta: +8 points (78% → 86%)

- `DICQ-BLOCK-C-IMPROVEMENT.md` (personnel):
  - Role definitions (NC-003 ✓)
  - Formal designations (NC-004 ✓)
  - Training evidence integrated into review (NC-001 ✓)
  - Delta: +8 points (80% → 88%)

- `DICQ-BLOCK-D-IMPROVEMENT.md` (quality):
  - Management review (NC-001 ✓)
  - CEQ annual evaluation (NC-009 ✓)
  - Risk management (NC-012 ✓)
  - Equipment calibration (NC-002 ✓)
  - Delta: +10 points (60% → 70%)

- `PHASE-4-COMPLIANCE-SUMMARY.md` (1-page executive):
  - 12 CAPAs closed
  - DICQ +4–6 pts (84–86% target)
  - RDC 978 Arts. 117, 181 → 100%
  - 6 micro-modules in production
  - Evidence package delivered + auditor-signed
  - Auditor sign-off date

**Tests:**

- [ ] DICQ re-score internally consistent (blocks add up to overall %)
- [ ] 10-item spot-check passes (<3 gaps)
- [ ] RDC articles 117, 181 verified present
- [ ] All evidence references valid (links work)

**Acceptance Criteria:**

- [ ] DICQ re-scored (all 3 blocks A, C, D)
- [ ] 10-item spot-check completed + <3 gaps
- [ ] RDC coverage verified
- [ ] Compliance summary signed (CTO)
- [ ] Ready for auditor final report

---

## Auditor RFI Async Email Workflow

### Email Gate Process (High-Level)

**Goal:** Reduce synchronous calls; enable auditor to ask questions asynchronously via email.

### Message Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Lab Team                                                            │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Submits RFI via in-app form (Task 1.2)                          │
│    - CAPA ID, question, evidence links, deadline                   │
│ 2. Cloud Function callable captures + sends email                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                    (automated email)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Auditor                                                             │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Receives email with:                                            │
│    - Lab name, CAPA title, question                                │
│    - Evidence links (Firestore docs, PDF attachments)              │
│    - Response deadline                                              │
│    - Reply button: "Click here to respond" (opens RFI response form)│
│ 2. Opens RFI response form in app (or via email link)              │
│ 3. Types response + submits                                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                 (Cloud Function saves response)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Lab Team                                                            │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Receives email: "Auditor response received"                     │
│ 2. Opens CAPA dashboard → RFI log shows response                   │
│ 3. Reads response + takes action (upload new evidence, etc.)       │
│ 4. Submits follow-up (if needed) OR declares RFI resolved          │
└─────────────────────────────────────────────────────────────────────┘
```

### Template: RFI Email to Auditor

```
Subject: [HC Quality] RFI — CAPA NC-002 Calibração (Response needed by 2026-06-12)

Dear [Auditor Name],

We have a follow-up question regarding CAPA NC-002 (Equipment Calibration Records):

**Question:**
[User-entered question from RFI form]

**Evidence Provided:**
- Dashboard screenshot: [link to Firestore doc]
- Calibration audit report: [PDF download link]
- Audit log: [JSON export link]

**Deadline for Response:** 2026-06-12 (3 business days)

**Respond Here:** [Link to RFI response form in app]
Or reply to this email with your response.

Thank you,
[Lab Director Name]
HC Quality — Riopomba Lab
```

### Template: RFI Response Email to Lab

```
Subject: RE: [HC Quality] RFI — CAPA NC-002 Calibração (RESPONSE RECEIVED)

Dear [Lab Team],

Your RFI response to CAPA NC-002 has been received:

**Auditor Response:**
[Auditor text from form]

**Status:** [ACCEPTED | NEEDS CLARIFICATION]

If "NEEDS CLARIFICATION," please provide additional evidence by [date].

View full RFI log: [Link to CAPA dashboard]

Best regards,
[Auditor Name]
Auditoria Externa
```

### SLA & Escalation

| Metric                            | Target         | Escalation                                                        |
| --------------------------------- | -------------- | ----------------------------------------------------------------- |
| **RFI response time**             | 24h from email | If >24h, CTO sends reminder; if >48h, escalate to auditor manager |
| **RFI cycles**                    | <3 per CAPA    | If >3 cycles, schedule sync call (30 min) to resolve              |
| **Total RFI time (all 12 CAPAs)** | <7 days        | If >7 days, Phase 4 timeline slips; adjust Wave 3 schedule        |

---

## Weekly Standing Call Template

### Recurring Schedule

- **When:** Fridays, 10:00–10:30 BRT (confirmed in Task 1.4)
- **Attendees:** Lab RT + Lab Director + CTO + External Auditor (optional)
- **Duration:** 30 min max
- **Format:** Zoom / Google Meet (recorded for Firestore audit log)

### Agenda Template

```markdown
# HC Quality Phase 4 — Weekly Auditor Sync (Week X)

**Date:** 2026-05-31 (Friday)
**Duration:** 30 min

## 1. CAPA Status (10 min)

- [ ] NC-001 (Management Review): state? Evidence ready?
- [ ] NC-002 (Calibracao): equipment list complete? Certificates?
- [ ] NC-003 (Personnel Cargos): org chart? Authority matrix?
- [ ] NC-004 (Personnel Designacoes): 3 designations ready?
- [ ] NC-005–012 (Deferred): phase plans on track?

**Action Items from Last Week:**

- [Item 1: Done/In Progress/Blocked]
- [Item 2: Done/In Progress/Blocked]

## 2. Outstanding RFI (5 min)

- [ ] Any open questions from auditor?
- [ ] Evidence gaps?

**RFI Cycle Count (target: <3 total):**

- Current: 2 cycles (NC-001, NC-009)

## 3. Timeline & Risk (5 min)

- **Phase 4 Target End:** 2026-06-15
- **Days Remaining:** [X]
- **At Risk?** Yes/No — explain
- **Auditor Sign-Off Date:** 2026-06-28 (confirm?)

## 4. Next Steps (10 min)

- [ ] Lab: [task] by [date]
- [ ] Auditor: [task] by [date]
- [ ] CTO: [task] by [date]

**Next Meeting:** 2026-06-07 (Friday 10:00 BRT)
```

### Meeting Notes Template (Firestore Doc)

```typescript
interface WeeklyAuditorSyncNotes {
  id: string; // e.g., "sync-2026-05-31"
  labId: string;
  week: number; // 1, 2, 3, 4

  // Meta
  dateOfMeeting: Timestamp;
  attendees: string[]; // names + roles
  recordingURL?: string; // Zoom recording link

  // Content
  capaStatusUpdates: Record<string, string>; // NC-001 → "state: em-andamento, 80% evidence ready"
  rfiCycleCount: number; // running total
  outstandingIssues: string[]; // blockers
  actionItems: ActionItem[];

  // Timeline
  phase4TargetEnd: Timestamp;
  daysRemaining: number;
  atRisk: boolean;
  riskExplanation?: string;

  // Decisions
  auditorSignOffDate: Timestamp; // confirmed or re-negotiated

  // Audit Trail
  createdAt: Timestamp;
  createdBy: string;
  signature: LogicalSignature;
}

interface ActionItem {
  owner: string; // "Lab", "Auditor", "CTO"
  task: string;
  dueDate: Timestamp;
  status: 'pending' | 'in-progress' | 'complete';
}
```

---

## Risk Register

### 12 Key Risks (Severity, Probability, Mitigation)

| Risk ID   | Risk Description                                                | Severity | Probability   | Impact                             | Mitigation                                                                                        | Owner   | Monitor |
| --------- | --------------------------------------------------------------- | -------- | ------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- | ------- | ------- |
| **RK-01** | Auditor RFI delays (>7d response)                               | 🔴 P0    | Medium (40%)  | Blocks Wave 3 by 1+ week           | Async email gate (1.2) + weekly standing call + CTO escalation if >7d                             | Auditor | CTO     |
| **RK-02** | Micro-module scope creep (org chart → full HRMS)                | 🟠 P1    | Medium (35%)  | Effort +20–30 pts                  | Lock scope in Wave 1 kickoff (1.3); document extension pattern for v1.5                           | Eng     | CTO     |
| **RK-03** | Personnel data incomplete (RT/QA Mgr not designated)            | 🟠 P1    | Low (20%)     | Blocks NC-003/004                  | Pre-align with lab in auditor call (1.4); use mock data if needed                                 | Lab ops | CTO     |
| **RK-04** | Evidence chain integrity broken (missing docs, corrupt PDFs)    | 🔴 P0    | Low (15%)     | Audit rejection                    | Task 3.2 hash verification + immutable audit trail; test links before sending                     | Eng     | CTO     |
| **RK-05** | Certificate upload failure (large PDFs, network timeouts)       | 🟡 P2    | Low (15%)     | Blocks calibracao                  | Chunked upload via Cloud Storage (pause-resume); max 10 MB per cert; test with large files        | Eng     | Eng     |
| **RK-06** | DICQ re-score underestimation (only +2 pts, not +6)             | 🟡 P2    | Medium (30%)  | Phase 4 perceived low-value        | Conservative re-score early (Week 3); adjust evidence strategy if needed                          | CTO     | CTO     |
| **RK-07** | Cloud Storage quota exhausted (evidence package > quota)        | 🟡 P2    | Very Low (5%) | Evidence backup fails              | Check quota weekly; request increase if needed (Firebase Console)                                 | DevOps  | Eng     |
| **RK-08** | Firestore rules deployment failure (syntax error)               | 🟠 P1    | Low (10%)     | Blocks go-live                     | Rules tested in emulator before deploy; dry-run on staging (pre-prod)                             | Eng     | Eng     |
| **RK-09** | Micro-module E2E tests fail at last minute (flaky tests)        | 🟡 P2    | Medium (35%)  | Phase gate blocked                 | Run E2E suite daily (CI/CD); fix flakiness early; retry 3x before fail                            | Eng     | Eng     |
| **RK-10** | Auditor unavailable at sign-off ceremony date (illness, travel) | 🟡 P2    | Low (10%)     | Sign-off delayed                   | Confirm availability 2 weeks prior (in writing); have backup auditor contact (if available)       | CTO     | CTO     |
| **RK-11** | Personnel changes mid-Phase (RT leaves, new director hired)     | 🟡 P2    | Low (8%)      | Designacoes invalid, replay needed | Pre-agree designations in Week 1 call; document interim coverage plan                             | Lab ops | Lab ops |
| **RK-12** | Parallel Phases 5–7 conflict with Phase 4 resources             | 🟠 P1    | Medium (30%)  | Team stretched thin                | Wave 2 parallelization intentional; assign dedicated Eng to each stream; CTO arbitrates conflicts | CTO     | CTO     |

---

## Success Criteria & Compliance Impact

### Phase 4 Completion Gates

**All must be ✅ before Phase 5 can proceed:**

| Criterion                      | Definition                                                                        | Verification                                        | Owner          |
| ------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------- | -------------- | --- |
| **CAPA Closure (12/12)**       | All 12 CAPAs state = "fechado" in Firestore                                       | Query: count(state='fechado') == 12                 | CTO            |
| **Auditor Sign-Off Email**     | Email received + logged with timestamp                                            | Firestore doc: auditor_signoff_email with signature | CTO            |
| **Micro-Module Code Merge**    | All 6 modules (calibracao, cargos, designacoes, review, ceq, risk) merged to main | git log --oneline                                   | grep "Phase 4" | Eng |
| **Micro-Module Tests Pass**    | 85%+ line coverage per module, 0 failing tests                                    | npm test -- src/features/{modules}                  | Eng            |
| **Firestore Rules Deployed**   | Rules v1.4 deployed to production                                                 | firebase functions:describe + inspect logs          | Eng            |
| **DICQ Re-Score Complete**     | Blocks A/C/D re-scored, delta measured                                            | DICQ-REASSESSMENT.md signed by CTO                  | CTO            |
| **Evidence Package Delivered** | `/capa-evidence/` folder uploaded + integrity verified                            | Hash verification: master_integrity_hash matches    | Eng            |
| **Zero P0 Security Findings**  | Rules + callables audit clean                                                     | firestore-security-rules-auditor skill report       | Eng            |
| **<3 RFI Cycles**              | Total RFI back-and-forth < 3 per CAPA                                             | Count entries in capa-tracking/{capaId}/rfi-log/    | CTO            |

### DICQ Compliance Impact

| Block              | Baseline (v1.3) | Target (Post-Phase 4) | Delta    | Evidence                                                                                       |
| ------------------ | --------------- | --------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| **A** (Governance) | 78%             | 86%                   | +8 pts   | Management Review (NC-001), Roles (NC-003), Designations (NC-004), Risk Matrix (NC-012)        |
| **C** (Personnel)  | 80%             | 88%                   | +8 pts   | Cargos (NC-003), Designacoes (NC-004), Training evidence integrated (NC-001)                   |
| **D** (Quality)    | 60%             | 70%                   | +10 pts  | Management Review (NC-001), CEQ Report (NC-009), Risk Management (NC-012), Calibracao (NC-002) |
| **Overall**        | 78–82%          | 84–86%                | +4–6 pts | Combined improvement across modules                                                            |

### RDC 978 Coverage Confirmation

| Article          | Requirement                                         | Phase 4 Status                                        | Evidence                                         |
| ---------------- | --------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| **Art. 117**     | Document Management System                          | ✅ SGD framework (v1.3), List Master seed + hierarchy | Phase 9 plan (NC-006)                            |
| **Art. 181**     | Traceability                                        | ✅ Calibracao + chain-of-custody in all modules       | Equipment calibration links + audit trail        |
| **Art. 122–127** | Personnel roles + RT authority                      | ✅ Formal cargos + designacoes                        | Org chart, authority matrix, certificates signed |
| **Art. 86**      | PGQ components (equipment, method validation, risk) | 🟡 PARTIAL (equipment ✓, method ⏳ Phase 10, risk ✓)  | Calibracao module + risk matrix                  |

---

## Rollback Boundaries

### Phase 4 Rollback Scenarios (When to Abort & How)

#### **Scenario 1: Critical Auditor Misalignment (RK-01 severe)**

**Condition:** After Task 1.4 call, auditor rejects Phase 4 scope or demands additional CAPAs not in inventory.

**Action:**

1. CTO + auditor sync call (same day)
2. Document new scope in writing (email confirmation)
3. **Decision:** If new scope fits Phase 4 timeline (still finish by 2026-06-15), integrate; otherwise defer to Phase 5
4. **Rollback:** Do not merge Phase 4 code until auditor scope finalized
5. **Impact:** Phase 4 delay ~3–5 days

---

#### **Scenario 2: Micro-Module Architecture Blocker (RK-08 severe)**

**Condition:** Firestore rules deployment fails in prod; rollback blocks all 6 modules.

**Action:**

1. Deploy previous rules version (1-click rollback in Firebase Console)
2. Investigate error in staging emulator (fix + re-test)
3. **Decision:** If fix <4h, re-deploy; if >4h, defer rules-heavy modules to Phase 5 and ship calibracao + personnel only
4. **Impact:** Phase 4 ships ~50% (3/6 modules), remaining modules (review, ceq, risk) to Phase 5

---

#### **Scenario 3: Personnel Data Not Ready (RK-03 moderate)**

**Condition:** RT or QA Manager not formally designated by lab by end of Week 2 (May 31).

**Action:**

1. Use **mock designations** (e.g., "João Silva" as RT, "Maria Santos" as QA Manager)
2. Deliver code-complete module (personnel-designacoes) with mock data
3. Post-Phase-4, lab designates real people via form (data migration)
4. **Impact:** Phase 4 ships with mock data; real data enters system in Week 2 of prod use

---

#### **Scenario 4: Auditor Unavailable (RK-10 low)**

**Condition:** Auditor sick/traveling at scheduled sign-off ceremony (2026-06-28).

**Action:**

1. Interim: Ship evidence package to auditor; await async response (email)
2. Reschedule sync meeting (+1 week)
3. **Decision:** If async response arrives <2 weeks, declare Phase 4 "essentially complete" (auditor sign-off pending final ceremony)
4. **Impact:** Phase 5 can start (not blocked on ceremony); Phase 4 sign-off occurs in first week of Phase 5

---

#### **General Rollback Gate**

**Do NOT roll back Phase 4 unless:**

1. **P0 security finding** (rules leak PII, callable doesn't validate input)
2. **Auditor explicit rejection** (in writing, with reason)
3. **Evidence package tampered** (hash mismatch, chain-of-custody broken)
4. **Micro-module code fails <48h before merge** (unfixable regression)

**Otherwise:** Fix forward (patch + re-test) within Phase 4 timeline.

---

## Dependency DAG

### Critical Path (Blocking Dependencies)

```
Phase 4 Start (May 20)
│
├─ Task 1.1 (CAPA Schema) [1.5d] ─────────┐
├─ Task 1.2 (RFI Workflow) [1d] ──────────┤
├─ Task 1.3 (Module Scaffold) [1.5d] ─────┼─→ Task 1.4 (Auditor Call) [0.5d]
└─ Wave 1 Gate: All 3 ready ──────────────┘
                                           ↓
                              Wave 2 Begins (May 25)
                              │
                              ├─ Task 2.2 (Personnel Cargos) [3d] ──────┐
                              │                                         ├─→ Task 2.4 (Mgmt Review) [4d]
                              ├─ Task 2.3 (Designacoes) [3d] ───────────┤   (depends on 2.2 + 2.3)
                              ├─ Task 2.1 (Calibracao) [5d] ────────────┤
                              ├─ Task 2.5 (CEQ Report) [3d] ────────────┤
                              └─ Task 2.6 (Risk Mgmt) [3d] ─────────────┤
                                                                        │
                              Wave 2 Gate: All 6 modules code-complete  │
                              (June 15 target, but can slip to June 18) │
                                                                        ↓
                              Wave 3 Begins (June 18)
                              │
                              ├─ Task 3.1 (Deferred CAPA Evidence) [3d]
                              ├─ Task 3.2 (Evidence Compilation) [4d] ──┐
                              ├─ Task 3.3 (Auditor Sign-Off) [1d] ──────┼─→ Phase 4 Complete
                              └─ Task 3.4 (DICQ Report) [1d] ───────────┘
                                                                        ↓
                              Phase 4 Gate: All 12 CAPAs closed
                              (June 28 target, auditor sign-off ceremony)

Legend:
─────→ serial dependency
├─ item (parallel)
```

### Soft Dependencies (Preferred, Not Blocking)

- Task 2.4 (Management Review) prefers Task 2.5 (CEQ Report) complete (input 4 of 15 entries)
- Task 2.4 prefers CAPA tracking data available (input 2 of 15 entries) — Task 1.1 sufficient
- Task 2.1 (Calibracao) prefers equipamentos collection live (v1.3 ✓)
- Task 2.6 (Risk Mgmt) prefers risk framework concept finalized (Obsidian sources ✓)

### External Dependencies

- **Auditor availability** (Task 1.4, Task 3.3)
- **Personnel data** (Task 2.2, Task 2.3)
- **Riopomba documents** (Task 3.1, NC-006 evidence)
- **CEQ 2025 results** (Task 2.5)
- **Equipment calibration certificates** (Task 2.1)

---

## Milestones & Go/No-Go Gates

### Phase 4 Milestones

| Milestone                                        | Date                     | Criteria                                                                  | Owner         | Go/No-Go                   |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------- | ------------- | -------------------------- |
| **Wave 1 Complete**                              | 2026-05-24               | CAPA schema + RFI workflow + modules scaffolded + auditor pre-aligned     | CTO           | 🟢 GO / 🔴 NO-GO           |
| **Wave 2 Kickoff**                               | 2026-05-25               | Module development begins (6 parallel streams)                            | Eng leads     | 🟢 GO                      |
| **Module Milestone 1** (Calibracao draft)        | 2026-05-28               | Component structure complete, 0 TS errors, unit tests drafted             | Eng A         | 🟢 GO / 🔴 SLIP            |
| **Module Milestone 2** (Personnel draft)         | 2026-05-29               | Cargos + Designacoes structure complete, types solid                      | Eng B         | 🟢 GO / 🔴 SLIP            |
| **Module Milestone 3** (Management Review draft) | 2026-05-30               | Aggregator logic + PDF template drafted, 15-entry structure clear         | Eng C         | 🟢 GO / 🔴 SLIP            |
| **Weekly Auditor Sync #1**                       | 2026-05-31               | Module progress reviewed, RFI count = 0, timeline on-track                | CTO + Auditor | 🟢 GO                      |
| **Module Code-Complete**                         | 2026-06-12               | All 6 modules merged, tests passing, Firestore rules deployed             | Eng + CTO     | 🟢 GO / 🔴 SLIP            |
| **Wave 2 Gate (Phase 4 QA)**                     | 2026-06-15               | All modules code-complete, 85%+ test coverage, 0 TS errors, 0 P0 findings | Eng + CTO     | 🟢 GO / 🔴 NO-GO           |
| **Wave 3 Kickoff**                               | 2026-06-16               | Evidence compilation begins (Tasks 3.1–3.4)                               | QA + Eng      | 🟢 GO                      |
| **Evidence Package Delivered**                   | 2026-06-22               | All 12 CAPA evidence folders complete, hashes verified, ready for auditor | QA            | 🟢 GO / 🔴 INCOMPLETE      |
| **Auditor Review Period**                        | 2026-06-22 to 2026-06-28 | Auditor reviews evidence asynchronously (5 business days)                 | Auditor       | 🟢 APPROVED / 🔴 NEEDS RFI |
| **Phase 4 Sign-Off Ceremony**                    | 2026-06-28               | Auditor formal sign-off (email + meeting, optional sync)                  | Auditor + CTO | ✅ CLOSED / ⏳ DEFERRED    |
| **Phase 4 Complete**                             | 2026-06-30               | All 12 CAPAs state = "fechado", DICQ re-scored, documentation complete    | CTO           | ✅ COMPLETE                |

### Go/No-Go Decision Points

#### **Wave 1 Go/No-Go (May 24)**

**Go if:**

- [ ] CAPA tracking schema + service implemented (0 TS errors)
- [ ] RFI workflow callable working (email sends)
- [ ] 6 modules scaffolded (CLAUDE.md + file structure)
- [ ] Auditor pre-aligned (call completed, scope agreed)

**No-Go if:**

- [ ] Schema has design flaws (discovered in auditor call)
- [ ] Auditor rejects RFI workflow (demands sync calls instead)
- [ ] Module scope ambiguity (unclear effort per module)

**Decision:** CTO + Stream Lead (24h review)

---

#### **Wave 2 Gate / Phase 4 QA (June 15)**

**Go if:**

- [ ] All 6 modules code-complete (merged to main)
- [ ] 85%+ unit test coverage per module
- [ ] 0 TypeScript errors (web + functions)
- [ ] Firestore rules deployed + tested in emulator
- [ ] 0 P0 security findings (rules audit passes)
- [ ] Performance: LCP <2.5s on all screens (tablet + desktop)
- [ ] E2E tests pass (1+ per module)

**No-Go if:**

- [ ] Any module >30% incomplete (code, tests, or E2E)
- [ ] P0 security finding (rules leak data, callable doesn't validate)
- [ ] LCP >2.5s on critical path (management review, evidence upload)
- [ ] Firestore rules fail to deploy (syntax error)

**Decision:** Eng lead + CTO (sign-off in Phase 4 completion summary)

---

#### **Auditor Sign-Off Ceremony (June 28)**

**Go if:**

- [ ] Evidence package delivered + auditor reviewed
- [ ] <3 RFI cycles needed
- [ ] Auditor email: "12 CAPAs accepted as closed"
- [ ] All 12 CAPA states transitioned to "fechado" in Firestore

**Deferred if:**

- [ ] Auditor requests additional evidence (RFI 3+)
- [ ] Auditor unavailable (rescheduled to July 1+)

**Decision:** Auditor (formal email)

---

## Appendix

### Phase 4 Module Effort Summary (Story Points)

| Module                               | Tasks    | Effort (days)  | Story Points | Complexity |
| ------------------------------------ | -------- | -------------- | ------------ | ---------- |
| CAPA Tracking (infrastructure)       | 1.1, 1.2 | 2.5d           | 9 pts        | Low–Medium |
| Calibracao                           | 2.1      | 4–5d           | 14 pts       | Medium     |
| Personnel (Cargos)                   | 2.2      | 3–4d           | 12 pts       | Medium     |
| Personnel (Designacoes)              | 2.3      | 2–3d           | 8 pts        | Low        |
| Management Review                    | 2.4      | 3–4d           | 11 pts       | Medium     |
| CEQ Annual Report                    | 2.5      | 2–3d           | 8 pts        | Low        |
| Risk Management                      | 2.6      | 2–3d           | 8 pts        | Low        |
| Deferred CAPA Evidence               | 3.1      | 3d             | 9 pts        | Low        |
| Evidence Compilation + Hashing       | 3.2      | 4d             | 12 pts       | Medium     |
| Auditor Sign-Off + Compliance Report | 3.3, 3.4 | 2d             | 5 pts        | Low        |
| **Total**                            | —        | **29–27 days** | **~96 pts**  | —          |

### Resource Allocation (Recommended)

| Role                                   | Allocation              | Tasks                                                 |
| -------------------------------------- | ----------------------- | ----------------------------------------------------- |
| **CTO**                                | 30% (2 weeks full-time) | Tasks 1.1, 1.4, 3.3, 3.4, QA gate, risk mitigation    |
| **Eng A** (calibracao expert)          | 100% (2 weeks)          | Task 2.1 (equipment domain) + E2E                     |
| **Eng B** (personnel expert)           | 100% (2 weeks)          | Tasks 2.2, 2.3 (org structure domain) + E2E           |
| **Eng C** (analytics/reporting expert) | 100% (2 weeks)          | Tasks 2.4, 2.5, 2.6 (data aggregation) + E2E          |
| **QA Lead**                            | 50% (1 week)            | Tasks 3.1, 3.2 (evidence curation, hash verification) |
| **DevOps**                             | 20% (on-demand)         | Rules deployment, Cloud Storage quota check           |

### Key Contacts & Escalation

| Role                             | Name      | Contact | Availability                            | Escalation Path |
| -------------------------------- | --------- | ------- | --------------------------------------- | --------------- |
| **CTO**                          | [Founder] | [Email] | Always reachable (day-to-day decisions) | N/A             |
| **External Auditor**             | [Name]    | [Email] | Fridays 10:00 BRT (standing call)       | CTO if RFI >7d  |
| **Lab RT** (Responsável Técnico) | [Name]    | [Phone] | 08:00–17:00 BRT                         | CTO             |
| **Lab Director**                 | [Name]    | [Email] | 08:00–17:00 BRT (decisions, signatures) | CTO             |
| **Stream A Lead**                | [Name]    | [Email] | Daily sync                              | CTO escalation  |
| **DevOps Lead**                  | [Name]    | [Slack] | On-demand                               | CTO             |

---

**Document Status:** Ready for Execution  
**Created:** 2026-05-07  
**Last Updated:** 2026-05-07  
**Next Review:** After Task 1.4 (Auditor pre-alignment call)  
**Archive Location:** `.planning/phases/04-capa-closure/PHASE_4_DETAILED_PLAN.md`
