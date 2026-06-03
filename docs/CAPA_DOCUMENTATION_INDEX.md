# CAPA Module Documentation — Master Index

**Status:** COMPLETE (Phase 8 Wave 1)  
**Last Updated:** 2026-05-07  
**Audience:** Engineers, QM, Auditors, Lab Staff

---

## Document Map

### 1. **CAPA_PROCESS.md** (Main Reference)

**File:** `C:\hc quality\docs\CAPA_PROCESS.md` (2,117 lines)

**Content:**

- Executive summary (why CAPAs matter, compliance context)
- 5-state machine workflow (ABERTO → EM-ANDAMENTO → EVIDENCIA-SUBMETIDA → AUDITOR-REVISANDO → FECHADO)
- Detailed process phases (Phase 1–5 with responsibilities, validations, field updates)
- RDC 978 Art. 105 mapping (document retention, searchability, audit trail export)
- Audit trail specifications (event schema, chain verification, export formats)
- Sign-off procedures (5 sign-off gates with cryptographic proofs)
- System implementation (Firestore schema, rules, Cloud Functions callables)
- Roles & permissions (proprietario, RT, auditor, QM, admin)
- Error handling & escalation (what to do when things go wrong)
- Regulatory compliance (RDC 978 Art. 86/147, DICQ 4.1.2.4, ISO 15189)

**Use When:** Understanding the complete CAPA process, implementing features, passing audits.

---

### 2. **CAPA_PROCESS_QUICK_REFERENCE.md** (Print & Laminate)

**File:** `C:\hc quality\docs\CAPA_PROCESS_QUICK_REFERENCE.md`

**Content:**

- 5-state machine (visual flowchart)
- Key dates & deadlines (timeline targets)
- Who does what (role responsibilities matrix)
- Common actions (UI button reference)
- Evidence types (foto, documento, certificado, pop, treinamento)
- RDC 978 checklist (compliance verification)
- Escalation flowchart (what happens when CAPA stalls)
- Error messages & fixes (troubleshooting guide)
- Audit trail verification (external auditor walkthrough)
- 5-year retention rules (your legal obligation)

**Use When:** Lab staff need quick guidance, printing for desk reference, troubleshooting in the field.

---

### 3. **Architectural Decisions (ADRs)**

#### **ADR-0022: CAPA Closure Workflow (5-State Machine)**

**File:** `C:\hc quality\docs\adr\ADR-0022-capa-closure-workflow-5-state-machine.md`

**Covers:**

- Why we chose 5-state machine (vs flat flags, vs event sourcing)
- State definitions + transitions + guards
- RDC 978 Art. 147 compliance mapping
- Chain hash immutability pattern (ADR-0012)
- Phase 4 deliverables (7 Cloud Function callables)
- Legacy CAPA migration strategy

**Status:** PROPOSED (2026-05-07) — ready for Phase 4 kickoff gate review

---

#### **ADR-0015: CAPA vs Risk vs NCQ Integration**

**File:** `C:\hc quality\docs\adr\ADR-0015-capa-risk-ncq-integration.md`

**Covers:**

- Hybrid architecture decision: CAPA as top-level collection (vs nested in NCQ)
- Linkage policy: CAPA must link to ≥1 Risk OR NCQ (never orphan)
- Backward compatibility with v1.3 nested CAPAs
- Migration script (v1.3 → v1.4)
- RDC 978 Art. 86 Risk Management component 3 alignment
- Query helpers (getCAPAsForRisk, getCAPAsForNCQ)

**Status:** PROPOSED (2026-05-07) — finalizing before Phase 8 Week 1

---

#### **ADR-0003: Non-Conformidade Global Spine + CAPA Workflow**

**File:** `C:\hc quality\docs\adr\0003-nao-conformidade-capa.md`

**Covers:**

- v1.3 CAPA workflow (nested in NCQ, 5-state machine)
- Blocking gates (critical NCs block operations)
- CAPA workflow helpers (investigarNC, executarAcaoCorretiva, verificarEficacia)
- HMAC audit trail integration (ADR-0005)
- Firestore schema + rules
- Backfill strategy from temporary collections

**Status:** IMPLEMENTED (v1.3) — v1.4 supersedes with top-level CAPA

---

### 4. **Type Definitions & Services**

#### **CAPA Types**

**File:** `C:\hc quality\src\features\capa-tracking\types\index.ts`

**Defines:**

- `CAPA` interface (all fields: RCA, action, evidence, transitions)
- `CAPAStatus` union type (5 states)
- `CAPAPriority` (critica, alta, media, estendida)
- `CAPATransition` (audit trail entry schema)
- `CAPAEvidenceRef` (evidence file reference)
- `LogicalSignature` (immutable proof: hash, operatorId, ts)
- `DeadlineStatus` (computed: daysRemaining, at-risk/overdue)

---

#### **CAPA Service Layer**

**File:** `C:\hc quality\src\features\capa-tracking\services\capaService.ts`

**Provides:**

- `getCAPA(labId, capaId)` — fetch single CAPA
- `watchCAPAs(labId, callback)` — real-time subscription (Firestore listener)
- `updateCAPAStatus(labId, capaId, patch)` — update CAPA fields (service only, no validation)
- `softDeleteCAPA(labId, capaId)` — mark deleted (RN-06)
- `restoreCAPA(labId, capaId)` — undelete

**Note:** Service is thin; validation + state machine logic lives in Cloud Functions callables.

---

### 5. **UI Components**

**File:** `C:\hc quality\src\features\capa-tracking\components/`

**Components:**

- `CAPADashboard.tsx` — main UI (grid, sort by deadline/status, summary counts)
- `CAPAStatusBadge.tsx` — 5-state color-coded status display
- `CAPADeadlineIndicator.tsx` — deadline countdown (with tabular-nums)
- `CAPAEvidenceList.tsx` — evidence modal (show files, hashes, download links)
- `CAPAStatusTransitionModal.tsx` — form for state transitions (RCA, action plan, evidence upload)

---

### 6. **Hooks**

**File:** `C:\hc quality\src\features\capa-tracking\hooks/`

**Hooks:**

- `useCAPAs(labId)` — subscribe to all active CAPAs, compute deadline status
- `useCAPADeadlineMonitor(labId)` — polling hook (60s interval, meta-diff guard)

---

### 7. **Compliance & Regulatory**

#### **RDC 978 Compliance Matrix**

**File:** `C:\hc quality\docs\RDC_978_COMPLIANCE_MATRIX_v1.4_ROADMAP.md`

**Maps:**

- RDC 978 Art. 86 (Risk Management) → Phase 0
- RDC 978 Art. 147 (CAPA) → Phase 4 (this task)
- RDC 978 Art. 105 (5-year retention) → implementation detail

---

#### **DICQ Gap Analysis**

**File:** `C:\hc quality\docs\DICQ_GAP_ANALYSIS_v1.4.md`

**Maps:**

- DICQ 4.1.2.4 (Ações de Correção) → CAPA module
- DICQ 4.14 (Gestão de Risco) → Risk module + CAPA linkage

---

### 8. **Implementation Notes**

#### **CAPA Module CLAUDE.md**

**File:** `C:\hc quality\src\features\capa-tracking\CLAUDE.md`

**Covers:**

- Module scope (only this folder, dependencies allowed)
- Multi-tenant path structure (`/labs/{labId}/capaWorkflow/{capaId}`)
- Inviolable rules (RN-06, LogicalSignature, state machine, soft-delete)
- Phase 8 status (Wave 1 complete, Cloud Functions pending)
- Types/services/hooks inventory

---

## How to Use This Documentation

### For Engineers

1. **Start:** Read `CAPA_PROCESS.md` section "System Implementation" (Firestore Schema → Cloud Functions)
2. **Understand:** Review `ADR-0022` for state machine decisions
3. **Implement:** Code Cloud Functions using the callable signatures in CAPA_PROCESS.md
4. **Test:** Use Firestore emulator (rules + schema validation)
5. **Deploy:** Follow `deploy-protocol.md` (Phases: rules → functions → hosting)

### For QM / Audit Staff

1. **Quick Start:** Print `CAPA_PROCESS_QUICK_REFERENCE.md`
2. **Workflow:** Follow sections "Who Does What" + "Common Actions"
3. **Verification:** Use "Audit Trail Verification" checklist
4. **Retention:** Follow "5-Year Retention" rules for every closed CAPA

### For External Auditors

1. **DICQ/RDC Alignment:** Read "Regulatory Compliance" section in CAPA_PROCESS.md
2. **Verification:** Use "Audit Trail Verification" checklist (hash recalculation, chain integrity)
3. **Export:** Request `exportCAPAAuditTrail()` function output (JSON or PDF dossier)
4. **Sign-Off:** Add external auditor certification to dossier (optional in ADR-0022)

### For Lab Staff (Proprietario)

1. **Quick Start:** Print `CAPA_PROCESS_QUICK_REFERENCE.md`
2. **My CAPA:** Navigate to assigned CAPA in dashboard
3. **Investigation:** Write RCA (>100 chars), action plan, effectiveness criteria
4. **Evidence:** Upload proof (photos, training logs, certs)
5. **Submit:** Click "Upload Evidence" button
6. **Wait:** Auditor reviews (3–7 days target)

---

## Document Dependencies

```
CAPA_PROCESS.md (main reference)
  ├─ Uses: ADR-0022 (state machine)
  ├─ Uses: ADR-0015 (Risk/NCQ linkage)
  ├─ Uses: ADR-0003 (NC workflow, nested CAPA)
  ├─ References: RDC 978 Art. 86, 105, 147
  ├─ References: DICQ 4.1.2.4, 4.14
  ├─ References: ISO 15189:2022 §8.5
  └─ Implements: types/index.ts, capaService.ts

CAPA_PROCESS_QUICK_REFERENCE.md (print for lab)
  └─ Summarizes: CAPA_PROCESS.md (lab-friendly version)

ADR-0022 (architectural decision)
  ├─ Defines: 5-state machine (aberto → fechado)
  ├─ Uses: LogicalSignature (ADR-0012)
  ├─ Implements: Cloud Function callables (7 total)
  └─ Aligns with: RDC 978 Art. 147, DICQ 4.1.2.4

ADR-0015 (CAPA architecture)
  ├─ Decides: CAPA top-level collection (vs nested in NCQ)
  ├─ Defines: Linkage policy (Risk OR NCQ required)
  ├─ Implements: Backward compatibility migration
  └─ Aligns with: RDC 978 Art. 86 (Risk Management)

src/features/capa-tracking/ (implementation)
  ├─ types/index.ts (CAPA, LogicalSignature, CAPATransition)
  ├─ services/capaService.ts (CRUD, soft-delete)
  ├─ hooks/ (useCAPAs, useCAPADeadlineMonitor)
  └─ components/ (UI for dashboard, evidence, transitions)
```

---

## Phase 8 Deliverables (This Task)

✅ **Complete CAPA_PROCESS.md** (2,117 lines)

- Entry → Analysis → Action → Verification → Sign-Off
- RDC 978 Art. 105 mapping
- Audit trail specs (chainHash, immutability)
- Sign-off procedures (5 gates)
- Firestore schema + rules + callables
- Error handling + escalation

✅ **Complete CAPA_PROCESS_QUICK_REFERENCE.md** (print-friendly)

- 5-state flowchart
- Role matrix
- RDC 978 checklist
- Escalation paths

✅ **Integration with existing docs**

- ADR-0022 (state machine) — complete
- ADR-0015 (CAPA architecture) — complete
- Types/services (src/features/capa-tracking/) — Wave 1 complete
- Cloud Function callables — Phase 4 (after Phase 8 Week 1)

---

## What's Next (Phase 4 Week 1–2)

1. **Cloud Function Implementation** (7 callables)
   - capaOpenNewCAPAWorkflow
   - capaStartInvestigation
   - capaSubmitEvidence
   - capaAuditorReviewStart
   - capaAuditorApprove
   - capaAuditorReject
   - capaSoftDelete

2. **Firestore Rules Deployment**
   - Protect CAPA collection (Cloud Function only)
   - Protect evidence storage (5-year retention)

3. **Testing**
   - Unit tests (callables + validation)
   - Integration tests (state machine transitions)
   - E2E tests (full CAPA lifecycle)

4. **Deployment Sequence**
   - Rules (blocks direct writes)
   - Functions (enable callables)
   - Hosting (UI components)

---

**For questions or updates, contact:** CTO / Quality Management  
**Last Reviewed:** 2026-05-07  
**Next Review:** 2026-05-21 (Phase 4 kickoff gate)

---

_All documents in this collection are ACTIVE and ready for Phase 4 implementation. Print CAPA_PROCESS_QUICK_REFERENCE.md for lab desk reference._
