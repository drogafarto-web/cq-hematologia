---
phase: 13
title: "DICQ Final Audit + RDC 978 Compliance Verification"
status: planning
period_start: 2026-05-20
period_end: 2026-06-10
duration_weeks: 3
target_dicq_compliance: "≥88%"
target_rdc_coverage: "100% (critical articles)"
audit_scope: "DICQ blocks A-J + RDC 978 Arts. 117, 167, 179-191, 204"
---

# Phase 13 — DICQ Final Audit + RDC 978 Compliance Verification

**Objective:** Conduct comprehensive DICQ conformance audit mapping all 40+ requirements to implementation status, verify RDC 978 critical articles (100%), identify gaps (target ≥88% DICQ), and deliver compliance-ready sign-off report.

**Success Criteria:**
- DICQ conformance ≥88% (baseline 78.5% → target +9.5 pts)
- RDC 978 critical articles 100% covered (Arts. 117, 167, 179-191, 204)
- All gap remediation complete + documented
- Compliance report signed + deployment-ready

---

## Executive Summary

HC Quality v1.3 achieved **78.5% DICQ conformance**, exceeding the 75% audit-ready baseline. Phase 13 closes the remaining gap to **88%+** by:

1. **Validating existing implementations** against DICQ 4.3 blocks A-J (cross-reference code + services)
2. **Verifying RDC 978 critical articles** (Arts. 117, 167, 179-191, 204) with evidence matrix
3. **Identifying remediation gaps** (currently 9.5 pts below 88% target)
4. **Executing gap fixes** (documentation, policies, module extensions)
5. **Signing off** compliance report for pre-external-audit readiness

**Key Deliverables:**
- `PHASE_13_DICQ_CONFORMANCE_MATRIX.md` — 40+ blocks A-J mapped to modules + status + evidence
- `PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md` — Arts. 117, 167, 179-191, 204 audit trail
- `PHASE_13_GAP_REMEDIATION_PLAN.md` — specific fixes for identified deficiencies
- `PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md` — final approval (CTO + auditor + deployment authority)

---

## Task 1: Read DICQ Coverage Matrix + RDC 978 Critical Articles

**Owner:** Auditor (Eng A)  
**Duration:** 4 hours  
**Deliverable:** Baseline understanding of current compliance state

### Subtasks

1. **DICQ Blocks A-J Coverage Audit**
   - Read `docs/DICQ_GAP_ANALYSIS_v1.4.md` (current state per block)
   - Read `docs/COMPLIANCE_SUMMARY_v1.3.md` (RDC 978 + DICQ + LGPD)
   - Read `docs/v1.3-COMPLETION-SUMMARY.md` (module status)
   - Document baseline: Which blocks are at what %?

2. **RDC 978 Critical Articles Deep-Dive**
   - Art. 117 (Audit Trail): Rastreabilidade ponta-a-ponta
   - Art. 167 (Laudo): RT signature + approval
   - Art. 179 (CIQ Obrigatório): Internal quality control
   - Art. 180 (Planos): CIQ plans per analyte
   - Art. 181 (Rastreabilidade Amostras): Sample traceability
   - Art. 183 (Críticos): Critical values + blocking
   - Arts. 184–191 (NC + Escalação): Non-conformance management
   - Art. 204 (Soft-delete only): Data integrity
   - Document evidence for each: code locations, Firestore rules, callable patterns

3. **Module-to-Block Mapping**
   - Create matrix: `feature/<module> → DICQ Block(s) → implementation status → gap`
   - Example row:
     ```
     | bioquimica | Block F (Analytical) | 95% | +3 pts to reach 100% (measurement uncertainty calc) |
     ```

---

## Task 2: Run DICQ Conformance Audit

**Owner:** Auditor (Eng A)  
**Duration:** 2 days (16 hours)  
**Deliverable:** `PHASE_13_DICQ_CONFORMANCE_MATRIX.md`

### Subtasks (per block)

#### Block A: Governance & Direction (current 78% → target 92%)

**DICQ Sections:** 4.1.1.2, 4.1.1.3, 4.1.2.3, 4.1.2.4, 4.15

**Audit Steps:**
1. Verify: Legal person docs (CNES, operational permit) → labSettings module + audit trail
2. Verify: Guiding principles (Mission/Vision/Values) → sgq/norteadores collection
3. Verify: Quality policy → sgq/policies collection + approval workflow
4. Verify: Quality planning → indicators dashboard tracking targets + measurement
5. Verify: Management review → quarterly aggregation of complaints, CAPA, audits, KPIs, training, resources

**Evidence Locations:**
- `src/features/labSettings/services/` (legal docs upload/storage)
- `src/features/sgq/` (norteadores, policies, approval workflow)
- `src/features/management-review/` (aggregation logic)
- `firestore.rules` (labId + approval rules)

**Gap Assessment:**
- [ ] Legal docs UI complete? (Storage + expiry alerts)
- [ ] Norteadores templates live in SGD?
- [ ] Management review callable aggregates 15+ inputs?
- [ ] All modules soft-delete only (no hard delete)?

**Remediation if gaps found:** 
- Create legal-docs module skeleton (UI + storage)
- Add norteadores templates to SGD seed
- Implement mgmt-review aggregation callable

---

#### Block B: Document Management — SGD (current 65% → target 92%)

**DICQ Sections:** 4.2.2.2, 4.3 (full)

**Audit Steps:**
1. Verify: Quality Manual → sgd module + version control + approval chain
2. Verify: Document hierarchy → MQ/PQ/IT/FR/POL classification live
3. Verify: Approval workflow → draft → review → approved → obsolete states
4. Verify: Distribution tracking → read confirmations + audit log
5. Verify: Riopomba migration → 80 docs + metadata integrity

**Evidence Locations:**
- `src/features/sgd/` (Master List + approval UI)
- `src/features/sgq/` (QM template, policies)
- Firestore: `/labs/{labId}/sgq-documentos/` + approval workflow
- Drive importer logs (Riopomba migration audit trail)

**Gap Assessment:**
- [ ] QM template has all 20 DICQ-required sections?
- [ ] Approval workflow UI complete (all 4 states)?
- [ ] Distribution tracking shows read confirmations?
- [ ] Riopomba docs all searchable + version-locked?

**Remediation if gaps found:**
- Populate QM template with 20-section standard
- Add approval UI if missing
- Run distribution audit trail verification

---

#### Block C: Personnel (current 80% → target 92%)

**DICQ Sections:** 5.1.1, 5.1.3–5.1.11

**Audit Steps:**
1. Verify: Personnel management policy → sgd/policies collection
2. Verify: Job descriptions → personnel/cargos + authority matrix
3. Verify: Onboarding checklist → personnel/onboarding collection
4. Verify: Competency assessment → educacao-continuada module + sign-off
5. Verify: Performance critical analysis → personnel/avaliacao-desempenho + annual cycle
6. Verify: Unified dossier (5.1.9) → consolidated record (qualifications + training + competency + performance)

**Evidence Locations:**
- `src/features/personnel/` (cargos, designacoes, competencia, avaliacao-desempenho)
- `src/features/educacao-continuada/` (training + competency tracking)
- Firestore: `/labs/{labId}/personnel/` collection hierarchy

**Gap Assessment:**
- [ ] Personnel policy document in SGD?
- [ ] Job descriptions complete (minimum 10 roles)?
- [ ] Onboarding checklist has ≥8 items (induction, safety, training plan, etc.)?
- [ ] Dossier UI consolidates all 4 data sources into one employee record view?

**Remediation if gaps found:**
- Add personnel management policy to SGD
- Create job description template + populate for all roles
- Implement unified dossier view (data aggregation query)

---

#### Block D: Quality & Compliance Operational (current 60% → target 85%)

**DICQ Sections:** 4.8, 4.10–4.14

**Audit Steps:**
1. Verify: Complaint handling → reclamacoes module + trending + closure loop to CAPA
2. Verify: CAPA tracking → capa-tracking module + root cause + efficacy verification
3. Verify: Records control → 5-year retention rules enforced in Firestore
4. Verify: Internal audit cycle → auditoria-interna module + formal checklist + NC linkage
5. Verify: Risk management → risks module (FMEA-lite, NPR, annual review)
6. Verify: Quality indicators → kpis module (pre/analytic/pós + targets + trends)

**Evidence Locations:**
- `src/features/reclamacoes/` (intake + trending)
- `src/features/capa-tracking/` (root cause template, efficacy form)
- `src/features/auditoria-interna/` (checklist builder, finding linkage)
- `src/features/risks/` (FMEA matrix template, NPR calculator)
- `src/features/kpis/` (dashboard + targets)
- Firestore rules: retention validation per collection

**Gap Assessment:**
- [ ] Complaint trending dashboard live (auto-aggregation of like-complaints)?
- [ ] CAPA closure form includes efficacy verification (re-test or evidence)?
- [ ] Internal audit checklist has ≥40 items (DICQ-aligned)?
- [ ] Risk register shows NPR (Probability × Severity × Detectability)?
- [ ] KPI dashboard has targets + trend lines?

**Remediation if gaps found:**
- Create complaint trending query + dashboard
- Add efficacy verification form to CAPA
- Implement internal audit checklist builder
- Add NPR calculator to risks module
- Ensure KPI targets are editable per lab

---

#### Block E: Pre-Analytical (current 64% → target 75%)

**DICQ Sections:** 5.4.2–5.4.7

**Audit Steps:**
1. Verify: Collection instructions → exam catalog + preparation SOP
2. Verify: Sample reception/rejection → acceptance criteria + NC linkage
3. Verify: Transport conditions → temperature monitoring + integrity checking
4. Verify: Pre-analytical handling → storage + preservation SOP

**Evidence Locations:**
- `src/features/educacao-continuada/` (exam prep instructions)
- `src/features/lots/` (sample reception + rejection state)
- `src/features/controle-temperatura/` (transport monitoring)
- Firestore: `/labs/{labId}/samples/` + status transitions

**Gap Assessment:**
- [ ] Exam catalog has collection instructions + prep procedures?
- [ ] Rejection criteria UI complete (visual checklist)?
- [ ] Temperature module integrated to transport workflow?
- [ ] NC auto-created on rejection?

**Remediation if gaps found:**
- Populate exam catalog with prep instructions for top 20 analytes
- Implement rejection checklist UI (visual flow)
- Ensure temperature sensor linked to transport module

---

#### Block F: Analytical (current 92% → target 95%)

**DICQ Sections:** 5.5–5.6

**Audit Steps:**
1. Verify: Method validation → bioquimica module + CLSI reference documentation
2. Verify: Measurement uncertainty → calculator + documentation
3. Verify: Pre-use verification → formal checklist per module
4. Verify: Biological reference intervals → per-analyte + continuous review
5. Verify: CEQ evaluation → annual report + corrective action

**Evidence Locations:**
- `src/features/bioquimica/` (Westgard rules, method seed)
- `src/features/ceq/` (annual report callable)
- Firestore: `/labs/{labId}/bioquimica/metodos/` + validation docs

**Gap Assessment:**
- [ ] Method validation certificates documented per module?
- [ ] Measurement uncertainty calculator present + tested?
- [ ] Pre-use verification form live for all CIQ modules?
- [ ] CEQ annual report auto-generated (callable)?

**Remediation if gaps found:**
- Create method validation template + populate for 20+ analytes
- Implement measurement uncertainty calculator (CLSI formula)
- Create pre-use verification form template
- Implement CEQ annual report callable

---

#### Block G: Post-Analytical & Reports (current 70% → target 92%)

**DICQ Sections:** 5.7–5.9

**Audit Steps:**
1. Verify: Critical review → liberacao module state machine (RT review before release)
2. Verify: Critical values → auto-detection + physician notification (SMS/email)
3. Verify: Compulsory notification → NOTIVISA integration (Portaria 204)
4. Verify: Sample disposal → PGRSS tracking + contractor verification
5. Verify: Report release → authorization + secure transmission + verbal communication log

**Evidence Locations:**
- `src/features/liberacao/` (state machine, RT signature)
- `src/features/criticos/` (escalation logic, email callable)
- `src/features/notivisa-outbox/` (submission queue, RT approval)
- `src/features/pgrss/` (disposal tracking)
- `src/features/patient-portal/` (secure release, download auth)

**Gap Assessment:**
- [ ] Liberacao state machine enforces RT review before release?
- [ ] Critical values auto-alert via email (configurable threshold per analyte)?
- [ ] NOTIVISA submission includes Portaria 204 compliance?
- [ ] PGRSS tracks disposal with contractor receipt?
- [ ] Patient portal release form complete + downloadable?

**Remediation if gaps found:**
- Implement critical value email escalation (sendGrid/Twilio)
- Verify NOTIVISA payload structure matches gov spec
- Create PGRSS tracking UI (storage → disposal → receipt)
- Implement patient portal report release form

---

#### Block H: Resources (Equipment/Reagents/Support) (current 75% → target 88%)

**DICQ Sections:** 4.5, 5.3

**Audit Steps:**
1. Verify: Lab support contracts → lab-apoio module (6 clauses per RDC Arts. 36–39)
2. Verify: Calibration → equipment certification + metrological chain
3. Verify: Maintenance → preventive plan + work orders + closure audit
4. Verify: Adverse events → tecnovigilância (NOTIVISA integration)

**Evidence Locations:**
- `src/features/lab-apoio/` (contract template, SLA monitoring)
- `src/features/calibracao/` (certificate upload, alert system)
- `src/features/equipamentos/` (maintenance schedule, work order)
- `src/features/notivisa-outbox/` (tecnovigilância submission)

**Gap Assessment:**
- [ ] Lab support contract template has 6 mandatory clauses?
- [ ] Calibration certificate upload + expiry alert working?
- [ ] Equipment maintenance schedule + work order tracking live?
- [ ] Adverse event reporting integrated to NOTIVISA?

**Remediation if gaps found:**
- Create/review lab-apoio contract template (6 clauses: capacity, QA, audit right, etc.)
- Implement calibration expiry alert (push notification)
- Create equipment maintenance work order UI
- Link equipment adverse events to NOTIVISA submission

---

#### Block I: Environment & Facilities (current 64% → target 80%)

**DICQ Sections:** 5.2.6–5.2.8

**Audit Steps:**
1. Verify: Environmental monitoring → temperature + humidity + air quality (ISO 14644)
2. Verify: Infection prevention → POPs + training + incident tracking
3. Verify: Biosafety → area classification (NB1–NB4) + equipment + protocols

**Evidence Locations:**
- `src/features/controle-temperatura/` (temperature + humidity logging)
- `src/features/biosseguranca/` (area classification, NB mapping)
- `src/features/pops/` (infection prevention SOP)

**Gap Assessment:**
- [ ] Temperature + humidity dual logging live?
- [ ] Biosafety areas mapped with NB classification?
- [ ] Infection prevention POPs in SGD?
- [ ] Training records linked to biosseguranca module?

**Remediation if gaps found:**
- Extend controle-temperatura to log humidity (sensor + dashboard)
- Create biosafety area mapping UI (floor plan + NB1–NB4 zones)
- Add infection prevention POPs to SGD
- Link training completion to area access control

---

#### Block J: Continuity & Confidentiality (current 70% → target 78%)

**DICQ Sections:** 5.10

**Audit Steps:**
1. Verify: Patient confidentiality → Firestore Rules + LGPD policy
2. Verify: Access control → auth module + member-based RBAC
3. Verify: Disaster recovery → backup + restore procedure + testing
4. Verify: Data breach notification → incident response plan + SOP

**Evidence Locations:**
- `firestore.rules` (multi-tenant + member access rules)
- `src/features/lgpd/` (privacy policy, consent tracking)
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` (disaster recovery testing)

**Gap Assessment:**
- [ ] Firestore rules enforce multi-tenant isolation (labId checks)?
- [ ] LGPD policy document complete (Art. 8 data processing, Art. 17 deletion, etc.)?
- [ ] Disaster recovery tested in last 90 days?
- [ ] Data breach notification SOP documented in sgd/policies?

**Remediation if gaps found:**
- Add LGPD policy document to SGD
- Run disaster recovery drill (backup → restore → verify on staging)
- Create data breach response checklist

---

### DICQ Blocks Summary Audit Table

After completing each block, populate this table:

| Block | Title | v1.3 % | Post-Audit % | Gap? | Evidence | Remediation |
|-------|-------|--------|--------------|------|----------|-------------|
| A | Governance | 78% | ? | — | labSettings, sgq | — |
| B | Document Management | 65% | ? | — | sgd, sgq | — |
| C | Personnel | 80% | ? | — | personnel, educacao | — |
| D | Quality & Compliance | 60% | ? | — | reclamacoes, capa-tracking | — |
| E | Pre-Analytical | 64% | ? | — | educacao-continuada, lots | — |
| F | Analytical | 92% | ? | — | bioquimica, ceq | — |
| G | Post-Analytical | 70% | ? | — | liberacao, criticos, pgrss | — |
| H | Resources | 75% | ? | — | lab-apoio, calibracao, equipamentos | — |
| I | Environment | 64% | ? | — | controle-temperatura, biosseguranca | — |
| J | Continuity | 70% | ? | — | lgpd, auth, disaster-recovery | — |
| **TOTAL** | — | **78.5%** | **?** | **+9.5** | — | — |

---

## Task 3: Verify RDC 978 Critical Articles (100% Coverage)

**Owner:** Auditor (Eng A)  
**Duration:** 1 day (8 hours)  
**Deliverable:** `PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md`

### RDC 978 Critical Articles Audit

#### Art. 117 — Rastreabilidade (Audit Trail)

**Requirement:** Laboratório deve manter registros de dados que justifiquem resultados comunicados, com rastreabilidade ponta-a-ponta.

**Evidence Checklist:**
- [ ] ADR-0012 (LogicalSignature) implemented
- [ ] HMAC chain-hash present on: insumo-movimentacoes, capa events, notivisa submissions, personnel quals, equipment calibrations, laudo releases
- [ ] Firestore rules enforce immutability (sealed docs cannot be updated)
- [ ] `verifyChainIntegrity()` callable implemented + tested
- [ ] Audit export (PDF with hash visualization) callable present
- [ ] Monthly secret rotation procedure documented

**Code Locations:**
```
- src/shared/logicalSignature.ts
- firestore.rules (sealing rules per collection)
- functions/src/v1.4-base/seal*.ts (CF triggers)
- functions/src/callables/verifyChainIntegrity.ts
- functions/src/callables/generateAuditReport.ts
```

**Status:** ✅ VERIFIED (ADR-0012 signed) or 🔴 BLOCKED (if code not found)

---

#### Art. 167 — Laudos & Responsabilidade Técnica

**Requirement:** Laudo clínico assinado por RT habilitado com referências e interpretação.

**Evidence Checklist:**
- [ ] Laudo entity includes: `rtNome`, `rtRegistro`, `cnes`, `labName`, exam codes, patient data
- [ ] RT signature via LogicalSignature (hash + timestamp + operatorId)
- [ ] Firestore rules enforce RT-only finalization (assertRTAccess)
- [ ] Audit trail captures who signed and when
- [ ] Laudo state machine: draft → RT-reviewed → released
- [ ] Soft-delete only (no hard delete of laudos)

**Code Locations:**
```
- src/features/liberacao/types/laudo.ts
- src/features/liberacao/services/laudoService.ts
- firestore.rules (RT signature validation)
- functions/src/callables/releaseLabResult.ts
```

**Status:** ✅ VERIFIED or 🔴 BLOCKED

---

#### Art. 179 — CIQ Obrigatório

**Requirement:** Laboratório deve executar Controle Interno da Qualidade de acordo com RDC 306.

**Evidence Checklist:**
- [ ] Bioquimica module live (17+ analitos, Westgard CLSI rules)
- [ ] CIQ modules for: coagulacao, ciq-imuno, uroanalise
- [ ] ControlMaterial tracking via lotes collection
- [ ] Westgard rules engine: 1-2s, 1-3s, 2-2s, R-4s rules
- [ ] Multi-instrument support from day 1
- [ ] Firestore rules prevent non-CIQ access without control material

**Code Locations:**
```
- src/features/bioquimica/
- src/features/coagulacao/
- src/features/ciq-imuno/
- src/features/uroanalise/
- src/features/lots/ (control material)
- firestore.rules (CIQ enforcement)
```

**Status:** ✅ VERIFIED or 🔴 BLOCKED

---

#### Art. 180 — Planos de Controle

**Requirement:** Laboratório deve ter planos de CIQ por analito/equipamento.

**Evidence Checklist:**
- [ ] Bula parser extracts método, CV alvo, biological range
- [ ] CIQ Plan template in SGD (document code `fr-010-plano-ciq`)
- [ ] Per-lab customization UI ready
- [ ] Westgard rules map to analyte CV target
- [ ] Multi-instrument traceability via TraceabilityEvent logs

**Code Locations:**
```
- src/features/bioquimica/services/analyteService.ts (seed + CV targets)
- src/features/bulaparser/ (extraction logic)
- src/features/sgq/ (template docs)
- src/features/traceability/ (event logging)
```

**Status:** ✅ VERIFIED or 🔴 BLOCKED

---

#### Art. 181 — Rastreabilidade de Amostras Controle

**Requirement:** Rastreabilidade completa desde recebimento até descarte.

**Evidence Checklist:**
- [ ] TraceabilityEvent collection (append-only, immutable)
- [ ] Fields: `labId`, `equipmentId`, `type`, `examCodeAtChange`, `timestamp`, `registeredBy`
- [ ] Event types documented: `reagent_change`, `control_run`, `calibration`, `maintenance`, `disposal`
- [ ] Server-side timestamp (no client-provided times)
- [ ] HMAC signature validation on sealing

**Code Locations:**
```
- src/features/traceability/types/traceabilityEvent.ts
- src/features/traceability/services/traceabilityService.ts
- firestore.rules (append-only enforcement)
```

**Status:** ✅ VERIFIED or 🔴 BLOCKED

---

#### Art. 183 — Críticos & Bloqueios

**Requirement:** Laboratório deve estabelecer valores críticos e impedir liberação sem revisão RT.

**Evidence Checklist:**
- [ ] `detectarCriticos()` function identifies results exceeding thresholds
- [ ] `Laudo.criticoFlag` blocks auto-release
- [ ] `complianceOverride` records reason for override
- [ ] Audit trail logs all override decisions
- [ ] Critical values configurable per lab + analyte
- [ ] Physician notification (email/SMS) on critical value detection

**Code Locations:**
```
- src/features/criticos/services/criticoService.ts
- src/features/criticos/hooks/useDetectCriticos.ts
- src/features/liberacao/ (blocking logic)
- functions/src/callables/escalateCriticalValue.ts
```

**Status:** ✅ VERIFIED or 🔴 BLOCKED

---

#### Arts. 184–191 — Non-Conformance Management & Escalation

**Requirement:** NC com severidade crítica → email alert + log + escalação.

**Evidence Checklist:**
- [ ] `naoConformidades` collection with severity levels (low, medium, high, critical)
- [ ] `criarNaoConformidade()` callable detects severity and auto-escalates
- [ ] Email notification via Cloud Task (CF-triggered)
- [ ] Immutable audit trail with chainHash
- [ ] Soft-delete only (no hard-delete)
- [ ] NC linkage to CAPA (corrective action)
- [ ] NC trending dashboard + root cause tracking

**Code Locations:**
```
- src/features/qualidade/types/naoConformidade.ts
- src/features/qualidade/services/qualidadeService.ts
- functions/src/callables/criarNaoConformidade.ts
- functions/src/tasks/escalateNonConformance.ts
- firestore.rules (NC immutability)
```

**Status:** ✅ VERIFIED or 🔴 BLOCKED

---

#### Art. 204 — Data Integrity & Soft-Delete Only

**Requirement:** Laboratório deve garantir integridade de dados; exclusão de registros proibida.

**Evidence Checklist:**
- [ ] All collections use soft-delete pattern (status field: `vigente`, `deletado`)
- [ ] Firestore rules block `deleteDoc()` calls (callable-enforced only)
- [ ] Soft-delete timestamps recorded (who, when)
- [ ] Audit trail preserved (deleted docs still auditable)
- [ ] 5-year retention enforced per collection

**Code Locations:**
```
- firestore.rules (delete() protection)
- src/shared/softDelete.ts (helper functions)
- functions/src/callables/*Service.ts (soft-delete only)
```

**Status:** ✅ VERIFIED or 🔴 BLOCKED

---

### RDC 978 Summary Verification Table

| Article | Title | Status | Evidence | Blocker? |
|---------|-------|--------|----------|----------|
| 117 | Audit Trail | ✅ or 🔴 | ADR-0012 + code | — |
| 167 | Laudos | ✅ or 🔴 | liberacao module | — |
| 179 | CIQ | ✅ or 🔴 | bioquimica + others | — |
| 180 | Planos | ✅ or 🔴 | bulaparser + sgq | — |
| 181 | Rastreabilidade | ✅ or 🔴 | traceability module | — |
| 183 | Críticos | ✅ or 🔴 | criticos module | — |
| 184–191 | NC + Escalação | ✅ or 🔴 | qualidade module | — |
| 204 | Soft-Delete | ✅ or 🔴 | firestore.rules | — |
| **TOTAL** | — | **?/8** | — | — |

---

## Task 4: Gap Remediation

**Owner:** Eng A + Eng B  
**Duration:** 3 days (24 hours)  
**Deliverable:** `PHASE_13_GAP_REMEDIATION_PLAN.md` + implemented fixes

### Process

1. **Identify Gaps** (from Task 2 + Task 3):
   - List each gap with severity (P0/P1/P2)
   - Estimate effort (hours)
   - Assign owner

2. **Create Fix Plans** (per gap):
   - Code change (if needed)
   - Documentation update (if needed)
   - Test plan
   - Verification step

3. **Execute Fixes** (in parallel):
   - Implement code changes
   - Update docs
   - Run tests
   - Deploy to staging

4. **Verify** (per fix):
   - Run audit step again
   - Confirm gap closed
   - Document resolution evidence

### Example Gap Fix Template

```markdown
### GAP-001: Personnel Dossier Missing Unified View

**Severity:** P1 (blocks Block C certification)  
**Current State:** Employee records scattered (educacao-continuada, auth, personnel module)  
**Target State:** Single consolidated dossier view (qualifications + training + competency + performance)

**Fix Plan:**
1. Create `src/features/personnel/components/DossierView.tsx` (aggregates 4 data sources)
2. Add composite Firestore query: `getPersonnelDossier(labId, employeeId)`
3. Test: E2E verify dossier loads all 4 sections + timestamps match
4. Deploy to staging; auditor reviews

**Effort:** 8 hours  
**Owner:** Eng A
```

---

## Task 5: Create Compliance Report & Sign-Off

**Owner:** CTO + Auditor  
**Duration:** 1 day (8 hours)  
**Deliverable:** `PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md`

### Report Structure

1. **Executive Summary**
   - Final DICQ score: X%
   - RDC 978 critical articles: Y/8 verified
   - Overall readiness: APPROVED / CONDITIONAL / BLOCKED

2. **DICQ Conformance Matrix** (final)
   - All 10 blocks with post-remediation %
   - Weighted average = final score

3. **RDC 978 Verification Matrix** (final)
   - All critical articles with status + evidence link
   - Any open items flagged

4. **Gap Remediation Summary**
   - All gaps listed + closure evidence
   - Any deferred items + timeline

5. **Blockers & Dependencies**
   - Any external dependencies (auditor sign-off, legal review, etc.)
   - Timeline to resolution

6. **Deployment Readiness**
   - Recommendation: APPROVED FOR PRODUCTION / CONDITIONAL / HOLD

7. **Sign-Off**
   - CTO signature + date
   - Auditor signature (if applicable)
   - Deployment authority sign-off

### Sign-Off Checklist

- [ ] DICQ ≥88%
- [ ] RDC 978 critical articles 100% verified
- [ ] All gaps remediated + tested
- [ ] Documentation updated
- [ ] Firestore rules verified (no hard-delete)
- [ ] Audit trail working (LogicalSignature sealing)
- [ ] Multi-tenant isolation verified
- [ ] No secrets in code/config
- [ ] Functions TSC clean (0 errors)
- [ ] Web TSC clean (0 errors)
- [ ] Staging deployment verified
- [ ] Performance metrics within SLA (LCP <2.5s, INP <200ms, CLS <0.1)
- [ ] Load test passed (1k concurrent users on analytics)
- [ ] E2E smoke tests passed
- [ ] Cloud Logging tail verified (no ERROR or CRITICAL for 24h)
- [ ] Post-deployment monitoring plan ready

---

## Success Criteria

**Phase 13 complete when:**

✅ DICQ conformance ≥88% (current 78.5% + remediation)  
✅ RDC 978 critical articles 100% verified (8/8 articles)  
✅ All identified gaps remediated + tested  
✅ Compliance sign-off report approved by CTO + deployment authority  
✅ Staging deployment verified + smoke tests passed  
✅ Ready for external audit (October 2026)

---

## Timeline & Milestones

| Date | Milestone | Owner | Status |
|------|-----------|-------|--------|
| 2026-05-20 | Phase 13 kickoff + Task 1 (read docs) | Auditor | Planned |
| 2026-05-22 | Task 2 (DICQ audit) complete | Auditor | Planned |
| 2026-05-24 | Task 3 (RDC 978 verification) complete | Auditor | Planned |
| 2026-05-27 | Task 4 (gap remediation) complete | Eng A/B | Planned |
| 2026-06-03 | Task 5 (compliance report + sign-off) | CTO | Planned |
| 2026-06-10 | Phase 13 complete + staging verified | Auditor | Planned |

---

## Inputs & Dependencies

- `docs/DICQ_GAP_ANALYSIS_v1.4.md` (baseline gaps per block)
- `docs/COMPLIANCE_SUMMARY_v1.3.md` (current RDC + DICQ coverage)
- `docs/ADR-0012-rdc-978-audit-trail.md` (LogicalSignature implementation)
- `firestore.rules` (security rules verification)
- `functions/src/` (Cloud Functions audit)
- `src/features/*/` (module source code audit)
- Staging environment (deployment + testing)

---

## Outputs & Deliverables

- ✅ `PHASE_13_DICQ_CONFORMANCE_MATRIX.md` (40+ blocks A-J mapped, scores per block)
- ✅ `PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md` (8 articles audit trail)
- ✅ `PHASE_13_GAP_REMEDIATION_PLAN.md` (specific fixes + evidence)
- ✅ `PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md` (final approval + deployment readiness)
- ✅ All gap fixes deployed to staging
- ✅ Updated documentation in SGD (policies, procedures, training materials)
- ✅ Audit report (PDF export for external auditor)

---

**Prepared by:** Auditor + CTO  
**Date:** 2026-05-07  
**Status:** Planning → Execution (2026-05-20)
