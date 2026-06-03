---
analysis_date: 2026-05-08
phase_scope: Phase 5 (Critical Escalation + IA Training Dataset)
rdc_version: RDC 978/2025 + RDC 986/2025
compliance_baseline: v1.3 (78.5% DICQ, ~85% RDC 978 critical articles)
audit_target_date: 2026-08-31 (external audit)
rdc_compliance_target: 100% critical articles
status: draft-for-planning
---

# Phase 5 — RDC 978/2025 Critical Violations Deep Analysis

**Prepared by:** CTO Research  
**Analysis Scope:** RDC 978/2025 Articles 6, 22, 36–39, 86, 99, 122, 128, 167, 204 vs. current implementation state  
**Output Purpose:** Feed Phase 5 planning (Waves 1–3) + guide Phases 6–9  
**Risk Stratification:** Severity 1 (immediate/blocking), 2 (30-day), 3 (90-day)

---

## Executive Summary

HC Quality v1.3 achieves ~85% coverage of **critical RDC 978 articles** (those with direct operational/licensing impact). However, **Phase 5 roadmap addresses 0 of these 10 critical articles**—instead focusing on non-blocking RDC items (Arts. 115, 117, critical escalation) plus DICQ-exclusive features (IA training dataset).

**Finding:** Phase 5 risk profile is **MISALIGNED with RDC criticality.** Phase 5 can execute without impacting legal compliance; however, **Phases 6–8 MUST prioritize critical article closures** or auditor pre-alignment meetings (Phase 11 weekly cadence) will surface violations late.

**Recommendation for CTO:**

1. **Immediate (Phase 5 concurrent):** Audit Art. 6, 22, 36–39, 86, 99, 122, 128 gaps NOW — don't wait for Phase 6
2. **Lock Phase 5 tasks first:** Portal (Phase 4), Critical escalation (Phase 5) are non-critical and can proceed
3. **Reserve Phase 6 capacity:** 40% to Art. 167 (Laudos complete) + Art. 204 (Audit trail) + supporting articles
4. **Plan Phase 8 + 9 sequentially:** CAPA closure (Phase 8) depends on audit trail completeness (Phase 6 blocker)

---

## RDC 978 Critical Article Inventory

**Definition:** "Critical article" = impacts lab licensing, patient safety, or auditor pre-alignment. Compliance gaps block production use without auditor waiver.

| Article        | Title                                                                             | Severity          | Current State (v1.3)                                                                                                           | Blocker?             | Phase Target | Status              |
| -------------- | --------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------ | ------------------- |
| **Art. 6**     | Definition of analytic examination (EAC); classification                          | **1 — IMMEDIATE** | ⚠️ Partial (system assumes STIII, no classification enforcement)                                                               | NO (architectural)   | Phase 6      | Research needed     |
| **Art. 22**    | STI/STII/STIII scope definitions + permitted materials                            | **1 — IMMEDIATE** | ⚠️ Partial (no system validation of material type vs. service type)                                                            | NO (validation rule) | Phase 6      | Research needed     |
| **Art. 36–39** | Lab contracts (Laboratório de Apoio) + vendor agreements                          | **1 — IMMEDIATE** | 🔴 NOT COVERED (v1.3 `fornecedores` module lacks contract enforcement)                                                         | YES                  | Phase 6–7    | Critical gap        |
| **Art. 86**    | PGQ (Programa de Garantia da Qualidade) — 6 mandatory components                  | **1 — IMMEDIATE** | 🟡 Partial (CIQ/EC/Personnel/Doc exist; Risk mgt + Management review incomplete)                                               | PARTIAL              | Phase 4–8    | Depends on Phase 8  |
| **Art. 99**    | CEQ (Controle Externo da Qualidade) — mandatory participation + frequency         | **1 — IMMEDIATE** | 🟡 Partial (CEQ module live v1.3; but no enforcement of ≥2 cycles/yr, PNCQ integration pending)                                | NO (monitoring only) | Phase 9      | Enhancement         |
| **Art. 122**   | Supervisor presencial during all operating hours                                  | **1 — IMMEDIATE** | 🟡 Partial (turnos module v1.3 tracks shifts but NOT supervisor designation per shift)                                         | YES                  | Phase 4–5    | Must enhance turnos |
| **Art. 128**   | Rastreabilidade (traceability) — all phases, sample ID required                   | **1 — IMMEDIATE** | ✅ Covered (TraceabilityEvent append-only logs + multi-phase audit chain)                                                      | NO                   | Maintained   | ✅                  |
| **Art. 167**   | Laudo (clinical report) — 14 mandatory fields + RT signature                      | **1 — IMMEDIATE** | 🟡 Partial (liberacao Phase 10 v1.3 covered state machine + RT sig; missing fields 10–12, PDF/portal deferred to v1.4 Phase 6) | YES                  | Phase 6      | Deferred completion |
| **Art. 204**   | Audit trail (registro de auditoria) — immutable, time-stamped, linkage to actions | **1 — IMMEDIATE** | ✅ Covered (auditoria module Phase 0 + chainHash HMAC v1.3, immutable Firestore rules)                                         | NO                   | Maintained   | ✅                  |

---

## Article-by-Article Deep Analysis

### RDC 978, Art. 6 — Definition & Classification of EAC

**Requirement:**

```
Art. 6 — Examens de Análises Clínicas (EAC) são procedimentos realizados por Serviços que
executam atividades de coleta, armazenamento, transporte, análise, interpretação,
disponibilização e arquivamento de material biológico.

Classificação por tipo de serviço:
- STI (Serviço Tipo I) — Farmácia, Consultório isolado
- STII (Serviço Tipo II) — Posto de coleta
- STIII (Serviço Tipo III) — Laboratório clínico, Anat. Patológica
- Serviço Itinerante (linked to STIII)
```

**Current Implementation State (v1.3):**

✅ **What works:**

- System architecture assumes STIII model (Riopomba lab with full analysis capability)
- `labSettings` stores `serviceTipo` enum but validation NOT enforced
- Multi-tenant `labId` structure aligns with STIII scope (lab-specific rules + collections)

🔴 **Gap:**

- No **validation rules** that prevent:
  - STII lab from accessing analysis-only collections (should be blocked)
  - STI lab from accessing blood draw records (only capillary/oral allowed)
  - Itinerante service from storing results outside collection context
- Laudo schema accepts any material type without validating against `serviceTipo`
- Frontend presents all features to all service types (UI doesn't filter by type)

**Severity Assessment:**

- **Likelihood:** High — auditor will ask "how do you prevent a STII from analyzing blood?"
- **Impact:** Medium — Riopomba is STIII, so current operations OK; but if multi-tenant expansion happens (Phase 13), this is a blocker
- **Compliance threat:** YES — Art. 6 violation if system permits out-of-scope activities

**RDC 978 Requirement Chain:**

- Art. 6 (definition) → Art. 10–53 (scope per service type) → Arts. 72–85 (operational requirements per type)
- Example: STI can only do capillary/oral (Art. 10), so blood analysis UI must be hidden for STI

**Phase 5 Action Required:** NO (Riopomba-specific exemption)  
**Phase 6 Action Required:** Research + specification (not implementation)  
**Phase 13 Action Required:** YES (when multi-tenant expansion adds new service types)

**Recommendation for Phase 5 Planning:**

- Document as **Design Debt — Art. 6 Enforcement Rules**
- Add to Phase 13 roadmap (when expanding to Mercês/Tabuleiro with potentially different service types)
- Create ADR-0027: Service Type Validation Architecture (for v1.5 planning)

---

### RDC 978, Art. 22 — STI/STII Scope Validation

**Requirement:**

```
Art. 22 — Serviço Tipo II — coleta de material biológico: sangue capilar, sangue venoso/arterial,
material oral, naso/orofaringe; análise limitada a testes rápidos no ato da coleta.
```

**Current Implementation State (v1.3):**

✅ **What works:**

- `insumo` collection tracks material type (sangue_capilar, sangue_venoso, oral, etc.)
- Firestore rules enforce `labId` isolation (so a STII can't write to another lab's collection)

🔴 **Gap:**

- No **rule enforcement** that:
  - Prevents STII from writing `análise` results (only STI allows collection-only, STII allows testes rápidos in ato da coleta)
  - Validates `materialType` against permitted set per service type
  - Blocks `laudoId` creation for STII results (STII doesn't issue laudos; results go to STIII)
- `analyzer` module (OCR Yumizen) is STIII-only but no rules block access by STII

**Severity Assessment:**

- **Likelihood:** Medium — auditor unlikely to test STII rules for Riopomba (STIII lab)
- **Impact:** High — if violated, STII lab operates outside legal scope
- **Compliance threat:** YES (potential license suspension if discovered)

**Phase 5 Action Required:** NO (research + spec only)  
**Phase 6 Action Required:** Specification (low priority for Riopomba; high for multi-tenant v1.5)

---

### RDC 978, Arts. 36–39 — Laboratory Contracts (Laboratório de Apoio)

**Requirement:**

```
Art. 36 — Laboratório deve manter contrato escrito com Laboratório de Apoio.
Art. 37 — Contrato deve especificar: responsabilidade, métodos, prazos, conformidade,
         comunicação de NC, rastreabilidade, confidencialidade, direito inspeção.
Art. 38 — Avaliação anual de qualidade obrigatória.
Art. 39 — Apoio internacional requer regularidade no país origem + tradução juramentada.
```

**Current Implementation State (v1.3):**

✅ **What works:**

- `fornecedores` module (Phase 2, v1.3) tracks vendor metadata (CNPJ, name, status)
- Riopomba migration assumed no active Lab Apoio contracts (all work is in-house)

🔴 **Critical Gap:**

- **NO contract document storage** (Art. 36 requires escrito — written)
- **NO contract template** with Art. 37 mandatory clauses
- **NO annual evaluation workflow** (Art. 38)
- **NO audit trail linkage** between vendor activities + vendor evaluation
- **NO field distinction**: `fornecedores` doesn't differentiate "insumo supplier" (no contract, just NF required) vs. "Laboratório de Apoio" (contract mandatory)

**Severity Assessment:**

- **Likelihood:** VERY HIGH — first thing auditor checks is vendor contracts
- **Impact:** CRITICAL — missing contracts = immediate compliance violation
- **Compliance threat:** YES — Art. 36–39 violations block external audit sign-off

**Current Evidence in v1.3:**

- No collection `fornecedores/{labId}/contratos/` exists
- v1.3 COMPLETION-SUMMARY notes (line 48): "Phase 10 Plans 04–07 deferred… NC-011 (order-entry / cadastro paciente) — too large for 14-week window"
- DICQ Compliance Summary (lines 166–169): "Contrato com Lab Apoio, Art. 36-39, 🔴 NOT COVERED, requires Fornecedores P2"

**Phase 5 Action Required:** IMMEDIATE (concurrent with Phase 5 kickoff)

- **Task 05-Special-A:** Create `fornecedores` contract data model + Firestore rules + audit linkage
  - Collections: `fornecedores/{labId}/contratos/{contratoId}` (document storage, approval workflow)
  - Fields: vendor CNPJ, contract date, clauses checklist (per Art. 37), evaluation schedule
  - Rules: RT-only approval, soft-delete only, audit trail on changes
  - Estimated effort: 8 hours (data model + rules + integration tests)
  - Blocker for Phase 6 (cannot close Art. 36–39 without this)

**Recommendation for Phase 5 Planning:**

- **DO NOT defer to Phase 6.** Art. 36–39 are RDC-critical and blocking auditor sign-off.
- Insert **05-Special-A (Fornecedores Contratos)** as **Wave 0 task** before 05-01 (Critical thresholds)
- Target completion: **Week 1 of Phase 5 (before phase kickoff + 3 days)**
- Dependencies: Phase 0 auth/rules framework (already deployed)

---

### RDC 978, Art. 86 — PGQ (Programa de Garantia da Qualidade) — 6 Mandatory Components

**Requirement:**

```
Art. 86 — PGQ obrigatório com 6 componentes mínimos:
1. Gerenciamento das tecnologias
2. Gerenciamento dos riscos
3. Gestão de documentos
4. Gestão de pessoal e educação permanente
5. Gerenciamento dos processos operacionais
6. Gestão do controle da qualidade (CIQ/CEQ)
```

**Current Implementation State (v1.3):**

| Component                                   | Module                              | Status     | Coverage | Notes                                                                               |
| ------------------------------------------- | ----------------------------------- | ---------- | -------- | ----------------------------------------------------------------------------------- |
| **1. Gerenciamento tecnologias**            | `equipamentos`                      | 🟡 Partial | 70%      | Calibração schedule + maintenance log live; in-service inspection TBD Phase 9       |
| **2. Gerenciamento riscos**                 | `risks` (FMEA-lite)                 | 🟡 Partial | 50%      | ADR-0016 phase 0; skeleton deployed; formal review cycle TBD Phase 8                |
| **3. Gestão documentos**                    | `sgq` (SGD)                         | ✅ Covered | 95%      | Phase 12 Drive importer + 80 Riopomba docs live; hierarchy + approval workflow live |
| **4. Gestão pessoal + EC**                  | `personnel` + `educacao-continuada` | 🟡 Partial | 75%      | EC module live (Phase 2); personnel roster partial; dossiè unified TBD Phase 9      |
| **5. Gerenciamento processos operacionais** | `pops` + `turnos`                   | 🟡 Partial | 60%      | POPs versionado v1.3; turnos (shifts) partial — supervisor presencial TBD           |
| **6. Gestão CIQ/CEQ**                       | `coagulacao`, `bioquimica`, `ceq`   | ✅ Covered | 90%      | Westgard engine + CEQ framework live; thresholds config TBD Phase 5                 |

**Severity Assessment:**

- **Likelihood:** VERY HIGH — "PGQ" is the umbrella legal requirement; auditor will verify all 6 components exist + interconnected
- **Impact:** CRITICAL — if ANY component missing, it's an Art. 86 violation (not partial credit)
- **Compliance threat:** YES — Art. 86 is mentioned in audit findings, CAPA closure depends on it

**Phase 5 Action Required:** PARTIAL

- **05-01 (Critical thresholds)** indirectly covers **Component 6** (critical value detection is part of CIQ management)
- Does NOT cover Components 1–5

**Phase 6–8 Action Required:** YES

- Phase 6: Equipment validation (Comp. 1) — calibration certs, in-service inspection protocols
- Phase 8: Management review (Comp. 2, Comp. 5 integration) — formal PGQ review meeting + CAPA closure
- Phase 9: Unified dossiè (Comp. 4) — full personnel + EC + training records integrated

**Current Audit Risk (from v1.3 COMPLETION-SUMMARY):**

- "Phase 8 Plans 05–07 — CAPA process execution + Medium/Extended closure + auditor sign-off ceremony" (deferred)
- Management-review module "pending 4.15 integration" (Phase 13–14)

**Recommendation for Phase 5 Planning:**

- Document **Art. 86 Coverage Map** in Phase 5 RESEARCH.md showing which component maps to which phase task
- Reserve 20% of Phase 8 capacity for **PGQ integration verification** (ensure all 6 components link together in one documented system)
- Create **ADR-0028: PGQ Integration Pattern** (how components interlock in audit trail)

---

### RDC 978, Art. 99 — CEQ (Controle Externo da Qualidade)

**Requirement:**

```
Art. 99 — CEQ obrigatório individual, mínimo 2 ciclos/ano (ou per art. 100 para alguns analitos).
Art. 101 — Provedor CEQ deve ter certificado NBR ISO/IEC 17025 OR NBR ISO 15189.
Art. 103 — Participação obrigatória na avaliação comparativa.
```

**Current Implementation State (v1.3):**

✅ **What works:**

- `ceq` module (Phase 3.3) live with:
  - Cycle management (create cycle, enroll, submit results)
  - Provider selection (dropdown of approved providers)
  - Z-score calculation + report generation
  - Audit trail per submission

🟡 **Partial:**

- **NO enforcement** of ≥2 cycles/year minimum
- **NO validation** that provider has 17025 or 15189 certificate (manual trust model)
- **NO integration with PNCQ** (Brasil's national external quality program) — acceptance of PNCQ results currently manual
- **NO alert/reminder system** when cycle deadline approaching

🔴 **Gap:**

- Auditor will ask: "How do you ensure 2 cycles/year per analito?" Answer: manual reminder (not systematic)
- Manual verification of provider credentials = compliance risk if provider loses certification

**Severity Assessment:**

- **Likelihood:** Medium — CEQ exists, but enforcement is informal
- **Impact:** Medium — CEQ non-participation = immediate citation
- **Compliance threat:** YELLOW (Art. 99 technically met, but not systematically enforced)

**Phase 5 Action Required:** NO (Phase 5 focuses on critical escalation, not CEQ)  
**Phase 9 Action Required:** YES

- **Task 09-03 (CEQ enforcement):** Add automated cycle-per-analito validation + provider credential verification + PNCQ importer
- Estimated effort: 12 hours (rules + callable + UI reminder)

---

### RDC 978, Art. 122 — Supervisor Presencial (On-Site Supervisor)

**Requirement:**

```
Art. 122 — "Durante o funcionamento do laboratório, deverá estar presente supervisor
do pessoal técnico, formalmente designado, responsável pela execução das atividades."

RDC 986/2025 redefines: "Supervisor" = profissional legalmente habilitado (superior education)
ou profissional capacitado (trained, under supervision).
```

**Current Implementation State (v1.3):**

✅ **What works:**

- `turnos` module (Phase 0, v1.3 Phase 9) live with:
  - Shift scheduling (date, time range, personnel assigned)
  - Supervisor designation per shift (exists as field)
  - Audit trail of who worked when

🟡 **Partial:**

- Field `supervisorId` exists in `turnos/{labId}/shifts/{shiftId}` but:
  - **NO validation** that supervisor is actually present (only designated)
  - **NO rule enforcement** that prohibits analysis without designated supervisor present
  - **NO daily report** of supervisor presence (RT might designate but not show up)
  - **NO distinction** between profissional habilitado vs. capacitado

🔴 **Gap:**

- Auditor asks: "Do you have daily evidence of supervisor presence?" Answer: No, only designation.
- "Can an operator analyze during a shift without supervisor present?" Answer: Yes (not blocked).

**Severity Assessment:**

- **Likelihood:** MEDIUM-HIGH — auditor will sample 5–10 shifts and ask for supervisor presence logs
- **Impact:** HIGH — lack of supervisor = potential patient safety violation
- **Compliance threat:** YES — Art. 122 violations are cited in internal audits

**Phase 5 Action Required:** NO (enhancement, not blocking Phase 5)  
**Phase 4–5 Action Required:** CONCURRENT

- **Task 04-Special-B (or 05-Special-B):** Enhance `turnos` module:
  - Add supervisor check-in/check-out within shift (timestamp validation)
  - Block laudo finalization if supervisor not checked in during shift window
  - Add `supervisorHabitado` vs `supervisorCapacitado` role distinction
  - Generate daily supervisor presence report (for audit trail)
  - Estimated effort: 6 hours (callable + rules + UI enhancement)

**Recommendation for Phase 5 Planning:**

- Assign **05-Special-B (Turnos Supervisor Presence)** as **Wave 0 task**
- Target completion: **Week 2 of Phase 5**
- Blocker for Phase 6 (cannot close Art. 122 without this)

---

### RDC 978, Art. 128–131 — Rastreabilidade (Traceability)

**Requirement:**

```
Art. 128–131 — Rastreabilidade obrigatória desde coleta até descarte de amostra.
Art. 138 — Identificação mínima: nome paciente, DOB/idade, material type, registro identificação.
```

**Current Implementation State (v1.3):**

✅ **Fully Covered:**

- `TraceabilityEvent` append-only collection (Phase 2)
- Multi-phase tracking: coleta → transporte → recebimento → análise → descarte
- Audit trail with HMAC-signed chainHash (ADR-0012, v1.3 Phase 0)
- All phases linked to `insumo` + `laudo` + equipment identifiers
- Rules enforce immutability (soft-delete only, no hard-delete)
- Evidence: COMPLIANCE_SUMMARY_v1.3.md (lines 127–130): "Art. 181 (Rastreabilidade) — ✅ COVERED"

**No action required.** Art. 128–131 compliance maintained through Phase 5 and beyond.

---

### RDC 978, Art. 167 — Laudo (Clinical Report) — 14 Mandatory Fields

**Requirement:**

```
Art. 167 — Laudo must contain 14 fields minimum:
1. Serviço name + CNES
2. Endereço + telefone
3. RT name + registro
4. Professional who signed name + registro
5. Patient name + ID
6. Patient age or DOB
7. Collection date
8. Exam name + material type + method
9. Result + unit
10. Reference values + technical limitations + interpretation data
11. In-house methodology (if applicable)
12. Restricted material (if accepted)
13. Issue date
14. Legal signature
```

**Current Implementation State (v1.3):**

✅ **What works:**

- `liberacao` module (Phase 10 deferred in v1.3, but partial implementation):
  - Fields 1–9 implemented (service + RT + patient + result)
  - Field 14 (LogicalSignature with HMAC hash) live
  - State machine: rascunho → crítico_aguardando_rt → revisado_rt → assinado → enviado
  - RT-only signing via callable

🟡 **Partial:**

- Fields 10–12 NOT IMPLEMENTED in v1.3:
  - Field 10: Reference range logic exists per analito (bula parser), but NOT rendered in laudo template
  - Field 10b: "Technical limitations" (e.g., "válido para concentração >5 ng/mL") — no field
  - Field 10c: "Interpretation data" (CLSI/Westgard rules context) — missing
  - Field 11: "In-house methodology" (metodologia própria) — no UI or validation
  - Field 12: "Restricted material" (material com restrição) — not tracked

🔴 **Missing in v1.3:**

- **NO PDF generation** (Phase 10 Plan 04 deferred to v1.4 Phase 6)
- **NO portal médico** (for external RT review) (Phase 10 Plan 07 deferred)
- **NO QR code** linking laudo to NOTIVISA queue

**Severity Assessment:**

- **Likelihood:** VERY HIGH — auditor will sample 20–50 laudos and verify all 14 fields present
- **Impact:** CRITICAL — missing fields = invalid laudo (potential patient safety issue, re-testing required)
- **Compliance threat:** YES — Art. 167 compliance is show-stopper for external audit

**Current Deferred Items (from v1.3 COMPLETION-SUMMARY, lines 206–209):**

```
Phase 10 Plans 04–07 deferred to v1.4 (Phase 6):
- PDF generation + QR validation
- Portal médico external access (SSO integration)
- E2E test suite
- Lighthouse CI integration
```

**Phase 5 Action Required:** NO (Phase 5 focuses on critical escalation + IA, not laudo fields)  
**Phase 6 Action Required:** CRITICAL (Liberación completion)

- **Task 06-01 (Laudo Fields 10–12):** Implement missing fields in laudo entity + template
  - Add `referenceRange`, `technicalLimitations`, `interpretationData` fields
  - Add `inHouseMethodology` enum with validation
  - Add `restrictedMaterial` flag + documentation link
  - Estimated effort: 8 hours (schema + template + tests)
- **Task 06-02 (PDF Generation):** CloudFunction callable for laudo → PDF with all 14 fields
  - Use puppeteer (server-side) to render HTML template → PDF
  - Include QR code (links to NOTIVISA queue if transmitted)
  - Estimated effort: 12 hours (CF + template + NOTIVISA linkage)
- **Task 06-03 (Portal Médico):** External RT access (SSO or email link auth per ADR-0024)
  - Estimated effort: 16 hours (auth + UI + rules)

**Recommendation for Phase 5 Planning:**

- Lock Phase 6 tasks 06-01 through 06-03 as MANDATORY (before phase kickoff)
- Reserve 40% of Phase 6 capacity for laudo completion
- Document **Art. 167 Completion Checklist** in Phase 6 RESEARCH.md

---

### RDC 978, Art. 204 — Audit Trail (Registro de Auditoria)

**Requirement:**

```
Art. 204 — "Qualquer alteração ou acesso aos dados de paciente deve gerar registro
de auditoria com identificação de quem fez, quando, por quê, o quê foi alterado."

Imutable, time-stamped, linked to the action.
```

**Current Implementation State (v1.3):**

✅ **Fully Covered:**

- `auditoria` module (Phase 0, v1.3) live with:
  - Immutable append-only `auditLog` subcollections (Firestore rules block delete/update)
  - HMAC-signed chainHash per entry (ADR-0012: Logical Signature)
  - Timestamp validation (server-side, not client-controlled)
  - Linked to action: read intent (who accessed what), write intent (who changed what)
  - Evidence: COMPLIANCE_SUMMARY_v1.3.md (lines 197–202): "Art. 204 (Audit trail) — ✅ COVERED (Phase 0)"

**No action required.** Art. 204 compliance maintained. Phase 5 doesn't impact audit trail.

---

## Summary Risk Matrix: Phase 5 + Roadmap Impact

| Article        | Requirement               | v1.3 Coverage | Severity        | Phase 5 Impact        | Phase 6–8 Impact           | Blocker? |
| -------------- | ------------------------- | ------------- | --------------- | --------------------- | -------------------------- | -------- |
| Art. 6         | EAC classification        | 50%           | 1-IMMEDIATE     | 0 (no action)         | Design debt (Phase 13)     | NO       |
| Art. 22        | STI/STII scope            | 50%           | 1-IMMEDIATE     | 0 (no action)         | Specification (Phase 13)   | NO       |
| **Art. 36–39** | **Lab contracts**         | **0%**        | **1-IMMEDIATE** | **CONCURRENT**        | **Phase 6 implementation** | **YES**  |
| Art. 86        | PGQ (6 components)        | 70%           | 1-IMMEDIATE     | Partial (Component 6) | Phase 8 integration        | YES      |
| Art. 99        | CEQ ≥2 cycles/yr          | 80%           | 2-30DAY         | 0 (no action)         | Phase 9 enforcement        | NO       |
| **Art. 122**   | **Supervisor presencial** | **75%**       | **1-IMMEDIATE** | **CONCURRENT**        | **Phase 4–5 enhancement**  | **YES**  |
| Art. 128–131   | Rastreabilidade           | 95%           | 1-IMMEDIATE     | 0 (maintain)          | 0 (maintain)               | NO       |
| **Art. 167**   | **Laudo 14 fields**       | **65%**       | **1-IMMEDIATE** | **0 (no action)**     | **Phase 6 critical**       | **YES**  |
| Art. 204       | Audit trail               | 100%          | 1-IMMEDIATE     | 0 (maintain)          | 0 (maintain)               | NO       |

---

## Phase 5 Wave Planning — RDC 978 Alignment

**Phase 5 Planned Scope (from v1.4-KICKOFF-SUMMARY.md, lines 152–191):**

| Task                                   | RDC Impact                            | Compliance Tier                                           |
| -------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| 05-01: Critical thresholds + SMS/email | Art. 115, 117 (non-critical articles) | **Tier 2** — supports critical value management           |
| 05-02: Critical detection engine       | Art. 115, 117, 183                    | **Tier 2** — critical value escalation (RDC, not blocker) |
| 05-03: IA strip upload + Gemini        | DICQ-exclusive (4.7)                  | **Tier 3** — DICQ-only feature                            |
| 05-04: IA feedback loop + versioning   | DICQ-exclusive                        | **Tier 3** — DICQ-only feature                            |

**Finding:** Phase 5 as planned does **NOT address any Severity 1 RDC articles.** It extends Arts. 115, 117 (non-blocking escalation) and DICQ features (IA training).

**Recommendation:** Inject two **concurrent Special Tasks**:

### Phase 5 Wave 0 — RDC Blockers (Concurrent)

**These must complete BEFORE Phase 5 main tasks kickoff (2026-06-09):**

| Task             | Scope                                                                    | RDC Article | Effort | Target     | Blocker       |
| ---------------- | ------------------------------------------------------------------------ | ----------- | ------ | ---------- | ------------- |
| **05-Special-A** | Fornecedores contratos: create contract data model + rules               | Art. 36–39  | 8h     | 2026-06-01 | YES (Phase 6) |
| **05-Special-B** | Turnos supervisor: add check-in/out + role distinction + presence report | Art. 122    | 6h     | 2026-06-08 | YES (Phase 6) |

**Total Wave 0 effort:** 14 hours (fits within Phase 5 Week 0 buffer)  
**Wave 0 owner:** Agent 1 (phase lead)  
**Wave 0 testing:** Unit + integration (2h), smoke test against baseline (1h)

### Phase 5 Main Waves (Unmodified)

- **Wave 1 (Jun 9–16):** 05-01 (Critical thresholds)
- **Wave 2 (Jun 16–23):** 05-02 (Critical detection engine)
- **Wave 3 (Jun 23–30):** 05-03 + 05-04 (IA strips + versioning)

---

## Phase 6 Dependency Chain — RDC 978 Completion

**Phase 6 MUST include:**

| Task      | RDC Article                                       | Effort            | Dependency | Predecessor                      |
| --------- | ------------------------------------------------- | ----------------- | ---------- | -------------------------------- |
| **06-01** | Laudo fields 10–12 + in-house methodology         | Art. 167          | 8h         | —                                |
| **06-02** | PDF generation + QR code                          | Art. 167          | 12h        | 06-01                            |
| **06-03** | Portal médico (external RT) + NOTIVISA linkage    | Art. 204, 6       | 16h        | Phase 4 (portal auth foundation) |
| **06-04** | Equipment validation certs (calibration)          | Art. 86 (Comp. 1) | 6h         | —                                |
| **06-05** | Lab contract verification (leverage 05-Special-A) | Art. 36–39        | 4h         | 05-Special-A                     |

**Phase 6 Estimated Effort:** 46 hours (full phase, ~10 working days at 6h/day)

---

## Phase 7–9 RDC 978 Roadmap

### Phase 7 (Reclamações/Satisfação Polish + Portal Paciente)

| RDC Article | Requirement                                  | Implementation                      | Effort |
| ----------- | -------------------------------------------- | ----------------------------------- | ------ |
| Art. 115    | Feedback tracking (reclamações + satisfação) | Trending + closure SLA verification | 4h     |
| Art. 204    | Audit trail linkage to feedback              | Immutable feedback audit trail      | 2h     |

### Phase 8 (CAPA Closure + Management Review)

| RDC Article                          | Requirement                                  | Implementation                                            | Effort |
| ------------------------------------ | -------------------------------------------- | --------------------------------------------------------- | ------ |
| **Art. 86 (Component 2: Riscos)**    | Management review + risk integration         | Formal management-review meeting + FMEA cycle closure     | 12h    |
| **Art. 86 (Component 5: Processos)** | Operational processes + improvement planning | Link POPs + turnos + training + equipment in unified view | 8h     |
| **Art. 204**                         | CAPA closure audit trail + auditor sign-off  | Immutable CAPA status change + auditor acknowledgment     | 4h     |

### Phase 9 (Extended Analytics + KPI)

| RDC Article                        | Requirement                                  | Implementation                                        | Effort |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------- | ------ |
| **Art. 86 (Component 4: Pessoal)** | Unified personnel dossiè + training records  | Consolidate personnel + EC + competency assessment    | 16h    |
| **Art. 99**                        | CEQ enforcement (≥2 cycles/year per analito) | Automated cycle validation + PNCQ importer            | 12h    |
| **Art. 86**                        | PGQ integration verification                 | Cross-component audit showing all 6 components linked | 6h     |

---

## Audit-Ready Criteria (2026-08-05 Auditor Sign-Off)

**Pre-audit (by 2026-08-04, end of Phase 9):**

| Criterion                          | Article(s)   | v1.4 Target                       | Evidence Method                             |
| ---------------------------------- | ------------ | --------------------------------- | ------------------------------------------- |
| ✅ Service type validation rules   | Art. 6, 22   | Design spec (Phase 13 roadmap)    | ADR-0027 documented                         |
| ✅ Lab contracts + evaluation      | Art. 36–39   | 100% coverage, templates in place | Fornecedores contract audit                 |
| ✅ PGQ 6 components interconnected | Art. 86      | All 6 linked in audit trail       | Management review meeting                   |
| ✅ CEQ enforcement                 | Art. 99      | ≥2 cycles/year enforcement active | Automated validation rule                   |
| ✅ Supervisor presence logged      | Art. 122     | Daily report available            | Turnos check-in/out audit                   |
| ✅ Rastreabilidade maintained      | Art. 128–131 | 100% phase tracking               | Spot-check 20 samples                       |
| ✅ Laudo 14 fields complete        | Art. 167     | 100% of newly issued laudos       | Sample 50 laudos, verify fields 10–12 + PDF |
| ✅ Audit trail immutable + signed  | Art. 204     | 100% of changes logged            | Spot-check chainHash on 10 records          |

**Auditor interview points:**

- Art. 6: "Walk me through how you'd prevent a STII lab from accessing analysis-only features." → Answer: "See ADR-0027 Phase 13 plan; Riopomba exempt as STIII."
- Art. 36–39: "Show me Lab Apoio contract + last annual evaluation." → Answer: "In fornecedores/{labId}/contratos; we use Riopomba = no apoio currently."
- Art. 86: "Walk me through PGQ — all 6 components." → Answer: "Management review meeting minutes show all 6 linked in Phase 8 closure."
- Art. 122: "Can you show evidence supervisor was present during this shift?" → Answer: "Turnos check-in/out report: [supervisor name] checked in [time], out [time]."
- Art. 167: "Show me all 14 fields in a laudo." → Answer: "Sample laudo PDF includes fields 1–14, downloadable from portal; fields 10–12 rendered from laudo entity Phase 6."

---

## Risk Escalation & Mitigation

### Risk R-501: Art. 36–39 (Lab Contracts) Not Completed by 2026-06-01

**Probability:** Medium (5/10) — depends on Wave 0 completion  
**Impact:** High (8/10) — missing contracts = audit show-stopper  
**Mitigation:**

1. **Assign dedicated agent** to 05-Special-A (not parallel with other tasks)
2. **Pre-prepare contract template** (CTO to draft Art. 37 clauses) before Phase 5 kickoff
3. **Daily standup** on Wave 0 progress (Jun 1–8)
4. **Fallback:** If 05-Special-A slips, delay Phase 6 kickoff by 5 days (push to 2026-07-14) — still audit-ready

### Risk R-502: Art. 167 (Laudo 14 Fields) Not Completed by 2026-07-01

**Probability:** Low (2/10) — Phase 6 is dedicated to liberacion completion  
**Impact:** CRITICAL (9/10) — missing laudo fields block audit  
**Mitigation:**

1. **Lock Phase 6 tasks** 06-01 through 06-03 in planning document ASAP
2. **Prototype laudo PDF** before Phase 6 kickoff (Week 3 of Phase 5)
3. **Daily integration testing** on Phase 6 (cannot have regressions in laudo rendering)
4. **Fallback:** If Phase 6 slips, delay external audit to 2026-09-30 (but Phase 0–9 must all be complete)

### Risk R-503: Auditor Pre-Alignment Meetings (Phase 11) Surface Art. 36–39, 122, 167 Gaps Late

**Probability:** Medium (5/10) — depends on Phase 5–6 communication with auditor  
**Impact:** Medium (6/10) — late discovery requires accelerated remediation  
**Mitigation:**

1. **Submit 05-Special-A + 06-01 artifacts** to auditor in Week 1 of Phase 11 (2026-06-01)
2. **Monthly (not weekly) pre-audit meetings** starting 2026-05-15 (before Phase 5 kickoff) to review RDC 978 critical articles
3. **Auditor walkthrough** of Phase 6 laudo schema + PDF template in Month 2 (before Phase 6 implementation)

---

## Deliverable: Phase 5 RESEARCH.md Structure

Phase 5 RESEARCH.md (to be generated by research agent) MUST include:

### Section: RDC 978 Critical Article Gaps

**Table showing:**

- Article + requirement
- v1.3 coverage (%)
- Phase 5 impact (none, partial, full)
- Phase 6–9 closure plan
- Severity (1/2/3)

### Section: Architecture Responsibility Map

**Clarify which tier owns each critical article:**

- Art. 6, 22 (validation rules) → Database/Rules tier
- Art. 36–39 (contracts) → API/Backend tier (fornecedores callables)
- Art. 86 (PGQ) → Full-stack (management review UI + audit trail integration)
- Art. 122 (supervisor presence) → API/Backend tier (turnos check-in validation)
- Art. 167 (laudo fields) → Full-stack (schema + Portal tier)
- Art. 204 (audit trail) → Database tier (immutable Firestore rules)

### Section: Phase 5 Wave 0 Tasks (NEW)

**Inject:**

- 05-Special-A: Fornecedores contratos
- 05-Special-B: Turnos supervisor presence

With effort, dependencies, completion dates.

### Section: Phase 6–9 RDC 978 Roadmap

**Explicit task list for Phases 6–9** to close all Art. 36–39, 86, 122, 167 gaps.

---

## Recommendation Summary for CTO

**Action 1 (Immediate — before Phase 5 kickoff):**

- [ ] Approve 05-Special-A + 05-Special-B as Wave 0 (concurrent with Phase 5 main kickoff 2026-06-09)
- [ ] Assign dedicated agent to Wave 0 (not load-balanced with other Phase 5 tasks)
- [ ] Draft contract template (Art. 37 mandatory clauses) for CTO review by 2026-05-15

**Action 2 (Before Phase 6 planning):**

- [ ] Lock 06-01, 06-02, 06-03 as mandatory (not deferred)
- [ ] Reserve 40% of Phase 6 capacity for laudo completion
- [ ] Assign Phase 6 lead agent for UI/portal integration (high complexity)

**Action 3 (Before Phase 8 planning):**

- [ ] Define Phase 8 management-review meeting format + PGQ integration checklist
- [ ] Brief auditor on Phase 8 CAPA closure ceremony (2026-08-05 deadline)

**Action 4 (Concurrent with Phase 5 execution):**

- [ ] Establish **monthly auditor pre-alignment calls** (starting 2026-05-15, not weekly until Phase 11)
- [ ] Submit 05-Special-A design + contract template to auditor for feedback (Week 1 of Phase 5)
- [ ] Prototype Phase 6 laudo PDF template for auditor review (Week 3 of Phase 5)

---

## Appendix: RDC 978 Article Full Texts (Relevant Excerpts)

### Art. 6 — Definition & Classification

> Examens de Análises Clínicas (EAC) são procedimentos realizados por Serviços que executam atividades de coleta, armazenamento, transporte, análise, interpretação, disponibilização e arquivamento de material biológico humano.
>
> Classificação por tipo: STI, STII, STIII, Itinerante.

### Art. 36–39 — Lab Contracts

> **Art. 36** — O Laboratório Clínico deve manter contrato escrito com Laboratório de Apoio.
> **Art. 37** — O contrato deve especificar: responsabilidade, métodos, prazos, conformidade, comunicação de NC, rastreabilidade.
> **Art. 38** — Avaliação anual de qualidade obrigatória.
> **Art. 39** — Apoio internacional requer regularidade no país origem + tradução juramentada.

### Art. 86 — PGQ

> Obrigatório programa de Garantia da Qualidade com 6 componentes mínimos: (1) Gerenciamento tecnologias, (2) Gerenciamento riscos, (3) Gestão documentos, (4) Gestão pessoal + EC, (5) Gerenciamento processos operacionais, (6) Gestão CIQ/CEQ.

### Art. 122 — Supervisor Presencial

> Durante o funcionamento do laboratório, deverá estar presente supervisor do pessoal técnico, formalmente designado, responsável pela execução das atividades.

### Art. 167 — Laudo (14 Fields)

> Laudo deve conter: (1) Serviço + CNES, (2) Endereço + telefone, (3) RT name + registro, (4) Professional who signed + registro, (5) Patient name + ID, (6) DOB/age, (7) Collection date, (8) Exam + material + method, (9) Result + unit, (10) Reference values + limitations + interpretation, (11) In-house methodology (if applicable), (12) Restricted material (if accepted), (13) Issue date, (14) Legal signature.

---

**Prepared by:** CTO Research Phase 5 Analysis  
**Date:** 2026-05-08  
**Classification:** Phase 5 Planning Input (Draft for Discussion)  
**Status:** Ready for CTO Review + Auditor Alignment

---

## Document Control

| Version | Date       | Author | Status | Notes                                      |
| ------- | ---------- | ------ | ------ | ------------------------------------------ |
| 1.0     | 2026-05-08 | CTO    | Draft  | Initial deep analysis for Phase 5 planning |

**Next Review:** 2026-05-20 (Phase 4 kickoff + Phase 5 planning kickoff alignment call)
