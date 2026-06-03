# Compliance Roadmap: Phase 4–9 Delivery Plan (DICQ 82% → 88%+)

**Effective:** 2026-05-07  
**Target:** DICQ pre-audit ready 2026-08-15, external audit ready 2026-10-15  
**Baseline:** 78.5% DICQ (v1.3) → 82% (Phase 0) → 88%+ (Phase 9)

---

## Overview: The 6% Gap (Phase 0–Phase 9)

Phase 0 closes 4 Tier-1 blockers and advances DICQ from 78.5% to ~82%. Phases 1–9 address the remaining 6% through document formalization, workflow integration, and compliance reporting.

**High-level roadmap:**

```
Phase 0 (2026-05-07 ~ 2026-05-14): Tier-1 blockers ............................ +3.5% (82%)
Phase 1 (2026-05-15 ~ 2026-05-22): Governance docs + LGPD consent ........... +2%   (84%)
Phase 4 (2026-06-01 ~ 2026-07-15): CAPA + Auditoria + Riscos .................. +3%   (87%)
Phase 5 (2026-07-16 ~ 2026-08-15): NOTIVISA integration ...................... +1%   (88%)
Phase 9 (2026-09-01 ~ 2026-10-15): Manual Qualidade + Laudo fields 10-12 ... +4%   (92%)

DICQ Pre-Audit Readiness (2026-08-15): 88% ✅ → Schedule auditors
External Audit (2026-10-15+):       92%+ ✅ → Official DICQ accreditation
```

---

## Phase 0 (Complete 2026-05-14) — Tier-1 Blockers

**Objectives:** Deploy 4 critical modules (turnos, lab-apoio, risks, HMAC rotation) to unblock RDC 978 articles and advance DICQ 6–8%.

| Module            | Requirement                      | Scope                                   | Status      | Owner | Due        |
| ----------------- | -------------------------------- | --------------------------------------- | ----------- | ----- | ---------- |
| **turnos**        | Art. 122 (Supervisor presence)   | Shift registry + callable + audit trail | In progress | —     | 2026-05-14 |
| **lab-apoio**     | Art. 36–39 (Lab Apoio contracts) | Contract form + 6-clause template       | In progress | —     | 2026-05-14 |
| **risks**         | Art. 86–87 (Risk management)     | FMEA-Lite per ADR-0016                  | In progress | —     | 2026-05-14 |
| **HMAC rotation** | ADR-0017 (Signature key)         | New key + ~25 function redeploy         | ✅ Complete | —     | 2026-05-07 |

**Deliverables:**

- [ ] Turnos: supervisor field + sign-in callable + attestation report callable
- [ ] Lab-apoio: contract form + contract registry collection + contract-to-laudo linkage
- [ ] Risks: FMEA matrix (5×5) + NPR calculator + annual review template
- [ ] HMAC: pre-deploy gate (`scripts/preflight-secrets-check.sh`) documented in deploy-protocol.md

**DICQ Impact:** 78.5% → 82% (+3.5%)

**Compliance Artifacts:** None new (leverages Phase 3 infrastructure)

---

## Phase 1 (2026-05-15 ~ 2026-05-22) — Governance & LGPD

**Objectives:** Formalize governance documents in SGD; LGPD consent workflow skeleton; indicator SLAs.

### 1.1 Governance Documents (DICQ 4.1.1.3, 4.1.2.3, 4.1.2.5, 4.1.2.7)

| Document                  | Requirement           | Scope                                                   | Owner   | Status  |
| ------------------------- | --------------------- | ------------------------------------------------------- | ------- | ------- |
| **Norteadores**           | Mission/Vision/Values | Form + publication in SGD                               | Phase 1 | Pending |
| **Política da Qualidade** | Quality policy        | Document template (ISO 15189) + lab-specific version    | Phase 1 | Pending |
| **Descrição de Cargos**   | Job descriptions      | Form for each role (RT, QM, supervisor, analyst)        | Phase 1 | Pending |
| **Designação Formal**     | Formal designations   | Director signature on QM/RT/Supervisor appointment docs | Phase 1 | Pending |

**Deliverables:**

- [ ] `src/features/governance/forms/norteadores.ts` — Mission/Vision/Values form + callable
- [ ] SGD template for "Política da Qualidade" document type + workflow
- [ ] `src/features/personnel/forms/cargosDescricao.ts` — job description template + callable
- [ ] `src/features/personnel/forms/designacoes.ts` — formal designation form + RT signatory

**Tests:** 8+ unit tests (form validation, audit trail, soft-delete)

**DICQ Impact:** Block A 78% → 85% (+7%)

---

### 1.2 LGPD Consent Framework (LGPD Art. 12)

| Item                    | Requirement       | Scope                                                         | Owner   | Status   |
| ----------------------- | ----------------- | ------------------------------------------------------------- | ------- | -------- |
| **Consent form**        | Patient consent   | Callable to register patient consent to data processing       | Phase 1 | Pending  |
| **Consent audit trail** | Immutable log     | Document consent timestamp + signature in `lgpd-solicitacoes` | Phase 1 | Pending  |
| **Consent withdrawal**  | Right to withdraw | Callable + UI (Phase 4)                                       | Phase 1 | Skeleton |

**Deliverables:**

- [ ] `src/features/lgpd/forms/consentimento.ts` — patient consent form callable
- [ ] `/labs/{labId}/lgpd-solicitacoes/{consentId}` collection + Firestore rules
- [ ] Consent audit trail schema (timestamp, signature, withdrawal capability)

**Tests:** 6+ unit tests

**LGPD Impact:** 70% → 73%

---

### 1.3 KPI SLA Definition (DICQ 4.1.2.4, 4.12)

| KPI                 | Requirement               | Baseline | Target              | Owner   |
| ------------------- | ------------------------- | -------- | ------------------- | ------- |
| **Turnaround time** | Specimen → Report         | TBD      | <24h (90% of tests) | Phase 1 |
| **Retrabalho %**    | Failed runs / total       | TBD      | <5%                 | Phase 1 |
| **Conformidade**    | Non-conformance incidents | TBD      | >95%                | Phase 1 |

**Deliverables:**

- [ ] KPI master document in SGD
- [ ] SLA targets per test type
- [ ] Dashboard updates (Phase 3.3 analytics module) to show SLA status

**Tests:** 4+ unit tests (SLA calculation, trending)

**DICQ Impact:** Block A 4.1.2.4 coverage

---

## Phase 4 (2026-06-01 ~ 2026-07-15) — CAPA + Auditoria + Indicadores

**Objectives:** Full CAPA closure workflow, internal audit scheduling + checklist integration, preventive action automation.

### 4.1 CAPA Effectiveness Verification (DICQ 4.10, 4.11)

| Item                     | Requirement                         | Scope                                                                  | Owner   | Status         |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------- | ------- | -------------- |
| **CAPA closure**         | Root cause → action → effectiveness | Full workflow from NC → action assignment → verification               | Phase 4 | Partial (v1.3) |
| **Effectiveness report** | Trending + closure statistics       | Dashboard showing CAPA closure rates, effectiveness %, pending actions | Phase 4 | Pending        |
| **Preventive actions**   | Proactive improvement               | AI-assisted preventive action proposal (Phase 4 stretch)               | Phase 4 | Pending        |

**Deliverables:**

- [ ] CAPA effectiveness verification callable: `registrarEfetividadeCAPA()`
- [ ] CAPA trending report: closure rate % by month, effectiveness metric
- [ ] Preventive action proposal form (Gemini-assisted root-cause analysis)
- [ ] Integration with auditoria-interna (link CAPA to internal audit findings)

**Tests:** 16+ unit tests (CAPA workflow, effectiveness logic, trending)

**DICQ Impact:** Block D 4.10–4.11 coverage (+4%)

---

### 4.2 Auditoria Interna Integration (DICQ 4.14.5)

| Item           | Requirement     | Scope                                          | Owner   | Status             |
| -------------- | --------------- | ---------------------------------------------- | ------- | ------------------ |
| **Checklist**  | Audit checklist | Integration with DICQ 4.3–4.14 checklist items | Phase 4 | Skeleton (Phase 0) |
| **Scheduling** | Audit calendar  | Annual audit schedule (minimum 4 audits/year)  | Phase 4 | Pending            |
| **Findings**   | NC linkage      | Findings logged as NC + CAPA assignment        | Phase 4 | Pending            |
| **Trending**   | Audit metrics   | Findings trend, closure rate, recurrence rate  | Phase 4 | Pending            |

**Deliverables:**

- [ ] Checklist template linked to SGD DICQ docs
- [ ] `src/features/auditoria-interna/forms/agendarAuditoria.ts` — audit scheduling callable
- [ ] Audit report generation (PDF export via Cloud Function)
- [ ] Audit findings → NC conversion callable
- [ ] Audit trending dashboard

**Tests:** 12+ unit tests

**DICQ Impact:** Block D 4.14.5 coverage (+3%)

---

### 4.3 Indicadores (KPI Dashboard) (DICQ 4.12, 4.14.7)

| Indicator             | Owner                 | Calculation                                        | Dashboard          |
| --------------------- | --------------------- | -------------------------------------------------- | ------------------ |
| **Turnaround time**   | Phase 3.3 (analytics) | Time(laudo released) - Time(specimen arrived)      | SLA vs actual      |
| **Retrabalho %**      | Phase 3.3             | (Failed runs / total runs) × 100                   | Trend by equipment |
| **Conformidade**      | Phase 3.3             | (NC incidents / total tests) × 100                 | Trend by test type |
| **NC origem**         | Phase 3.3             | Breakdown: pré-analítico, analítico, pós-analítico | Distribution       |
| **CAPA closure rate** | Phase 4               | (CAPA closed / CAPA open) × 100                    | Trend by origin    |

**Deliverables:**

- [ ] Indicator master doc in SGD
- [ ] Analytics dashboard enhancements (Phase 3.3 + Phase 4 expansion)
- [ ] Monthly indicator report generation (scheduled Cloud Function)
- [ ] SLA alert: turnaround >24h triggers NC creation

**Tests:** 8+ unit tests

**DICQ Impact:** Block D 4.12 + 4.14.7 coverage

---

## Phase 5 (2026-07-16 ~ 2026-08-15) — NOTIVISA Integration

**Objectives:** RDC Art. 195 compliance — disease reporting to ANVISA.

### 5.1 NOTIVISA Schema + Callable

| Item                     | Requirement      | Scope                                                       | Owner   | Status  |
| ------------------------ | ---------------- | ----------------------------------------------------------- | ------- | ------- |
| **Disease code mapping** | TUSS ↔ Analyte   | Mapping table (ICD-10 / TUSS codes) for reportable diseases | Phase 5 | Pending |
| **Outbox sync**          | Queued reporting | `/labs/{labId}/notivisa-outbox` → NOTIVISA API              | Phase 5 | Pending |
| **Report generation**    | RDC compliance   | Data export in NOTIVISA format (XML/JSON)                   | Phase 5 | Pending |

**Deliverables:**

- [ ] TUSS code master document in SGD
- [ ] Callable: `submitNotivisaReport(labId, eventId)` — sends report to NOTIVISA sandbox API
- [ ] Scheduled function: `notivisaSync()` — retry failed reports every 1h
- [ ] Report log: `/labs/{labId}/notivisa-outbox/{eventId}` tracks status + API response
- [ ] Reporting rules: Firestore rules enforce RT-only write + immutable records

**Tests:** 10+ unit tests (API integration, format validation, retry logic)

**DICQ Impact:** Block G (Pós-analítico) — Art. 195 coverage (+1%)

**Note:** NOTIVISA API sandbox available via ANVISA; production API credentials provisioned upon request.

---

## Phase 9 (2026-09-01 ~ 2026-10-15) — Documentation + Laudo Final

**Objectives:** Finalize Manual da Qualidade, complete laudo 14 fields, expand environmental monitoring.

### 9.1 Manual da Qualidade (DICQ 4.2.2.2)

**Requirement:** Comprehensive quality manual documenting lab structure, processes, responsibilities, documentation hierarchy.

**Content outline (50–80 pages):**

1. Introdução & Escopo (5 pages)
   - Lab description, STIII classification
   - Aplicabilidade DICQ/RDC 978

2. Estrutura Organizacional (10 pages)
   - Organograma
   - Descrição de cargos (RT, QM, supervisors, operators)
   - Responsabilidades & autoridades

3. Política da Qualidade (5 pages)
   - Norteadores (Mission/Vision/Values)
   - Quality objectives
   - Compromitment to continuous improvement

4. Sistema de Gestão da Qualidade (15 pages)
   - Process map (pré/analítico/pós)
   - Document control (hierarchy MQ/PQ/IT/FR)
   - Record control (retention, soft-delete)
   - Audit trail & chain-of-custody

5. Controle da Qualidade (15 pages)
   - CIQ program (all equipment, all analytes)
   - CEQ participation (external QC)
   - Critical values & blocking
   - Westgard rules & Levey-Jennings

6. Pessoal & Treinamento (10 pages)
   - Qualifications & competency assessment
   - Educação Continuada program
   - Supervisor presence requirements

7. Gerenciamento de Riscos (8 pages)
   - Risk register (FMEA matrix)
   - Annual review process

8. Conformidade Legal (5 pages)
   - RDC 978 compliance summary
   - LGPD compliance
   - NOTIVISA reporting

**Deliverables:**

- [ ] Manual da Qualidade v1.0 document (ISO 15189 template)
- [ ] Upload to SGD with status "aprovado" + Director + QM signatures
- [ ] Referenced in all compliance dossiers

**Ownership:** CTO + QM (requires 2-week writing sprint)

**DICQ Impact:** Block B 4.2.2.2 + Block A 4.1 coverage (+3%)

---

### 9.2 Laudo Fields 10–12 Finalization (RDC 978 Art. 167)

| Field        | Requirement                    | Scope                                      | Owner   | Status  |
| ------------ | ------------------------------ | ------------------------------------------ | ------- | ------- |
| **Field 10** | Reference values + limitations | Auto-populated from CIQ plan + methodology | Phase 9 | Pending |
| **Field 11** | In-house methodology spec      | Link to metodologia própria docs in SGD    | Phase 9 | Pending |
| **Field 12** | Restricted material note       | Display if material flagged as restricted  | Phase 9 | Pending |

**Deliverables:**

- [ ] Laudo entity extension: `referenceValues`, `limitacoes`, `metodologiaPropria`, `materialRestrito`
- [ ] Bula parser finalization: extract reference ranges + limitations text from method datasheets
- [ ] Metodologia própria form in SGD (link from laudo if applicable)
- [ ] PDF laudo report: include all 14 fields in formatted output
- [ ] Validation rules: forbid release until all 14 fields populated

**Tests:** 12+ unit tests (field validation, PDF generation)

**DICQ/RDC Impact:** Block G (Pós-analítico) + Art. 167 coverage (+2%)

---

### 9.3 Environmental Monitoring Expansion (DICQ 4.1.2.8)

**Requirement:** Monitor physical lab environment (temperature, humidity, air quality) per ISO 15189.

**Current:** Temperature monitoring (controle-temperatura module, Phase 3) for equipment stability.

**Phase 9 expansion:**

| Parameter   | Equipment  | Monitoring | Alerts               | Records  |
| ----------- | ---------- | ---------- | -------------------- | -------- |
| Temperature | Hygrometer | ±0.5°C     | If >25°C or <18°C    | Archival |
| Humidity    | Hygrometer | ±5% RH     | If >60% or <40%      | Archival |
| Air quality | CO₂ sensor | <1000 ppm  | If >1500 ppm         | Archival |
| Pressure    | Barometer  | ±5 hPa     | If <950 or >1050 hPa | Archival |

**Deliverables:**

- [ ] Environmental monitoring schema: `/labs/{labId}/monitoramento-ambiental/{parametroId}/{dataId}`
- [ ] IoT integration: ESP32 sensors (temperature/humidity) + optional CO₂/pressure probes
- [ ] Alert callable: trigger NC if parameter out of range
- [ ] Reporting: monthly environmental compliance report (PDF via Cloud Function)

**Tests:** 6+ unit tests (alert logic, data aggregation)

**DICQ Impact:** Block I (Ambiente & Acomodações) coverage (+5%)

---

## Compliance Roadmap Summary Table

| Phase | Dates         | DICQ % | RDC Art.          | LGPD Art. | Key Deliverable                      | Auditor Impact         |
| ----- | ------------- | ------ | ----------------- | --------- | ------------------------------------ | ---------------------- |
| **0** | 05-07 ~ 05-14 | 82%    | 122, 36–39, 86–87 | —         | Turnos, Lab-apoio, Risks, HMAC       | Tier-1 blockers closed |
| **1** | 05-15 ~ 05-22 | 84%    | —                 | 12        | Governance docs, LGPD consent        | Pre-audit ready        |
| **4** | 06-01 ~ 07-15 | 87%    | 184–191           | —         | CAPA closure, Auditoria-interna      | Full QMS integration   |
| **5** | 07-16 ~ 08-15 | 88%    | 195               | —         | NOTIVISA integration                 | RDC compliance closure |
| **9** | 09-01 ~ 10-15 | 92%+   | 167               | —         | Manual Qualidade, Laudo fields 10–12 | External audit ready   |

---

## Critical Path & Dependency Graph

```
Phase 0 (Tier-1 blockers)
  ├─ Turnos (supervisor) ──┐
  ├─ Lab-apoio contracts ──┤
  ├─ Risks FMEA ───────────┼──→ Phase 4 (CAPA + Auditoria + KPI)
  └─ HMAC rotation ────────┤      └──→ Phase 5 (NOTIVISA)
                           └────→ Phase 1 (Governance)
                                  └──→ Phase 9 (Manual + Laudo)
                                       └──→ External Audit (Oct 2026)

No blocking dependencies within Phases 1–5.
Phase 9 can begin in parallel (documentation writing).
DICQ pre-audit gate: Phase 0–5 completion (by 2026-08-15).
```

---

## Risk Mitigation

| Risk                                         | Impact                        | Mitigation                                                    | Owner     |
| -------------------------------------------- | ----------------------------- | ------------------------------------------------------------- | --------- |
| Phase 4–5 delays (CAPA/NOTIVISA scope creep) | DICQ pre-audit pushed to Sept | Prioritize NOTIVISA (Art. 195 blocker) over CAPA enhancements | PM        |
| Bula parser incomplete (Field 10 dependency) | Laudo fields 10–12 deferred   | Bula parser Phase 9 Sprint 1; laudo Phase 9 Sprint 2          | Tech lead |
| NOTIVISA API changes mid-Phase-5             | Integration rework needed     | Monitor ANVISA RFC updates; version-lock API                  | DevOps    |
| DICQ auditor disputes HMAC remediation       | Audit finding on ADR-0017     | Proactive disclosure + ADR documentation in briefing          | CTO       |

---

## Success Criteria (per phase)

### Phase 0 (2026-05-14)

- [ ] Turnos: 20+ unit tests passing, supervisor field + callable operational
- [ ] Lab-apoio: contract form callable tested, schema deployed
- [ ] Risks: FMEA matrix generator tested, 12+ unit tests
- [ ] HMAC: pre-deploy gate `preflight-secrets-check.sh` documented, all 8 secrets provisioned

### Phase 1 (2026-05-22)

- [ ] Governance docs: 4 forms deployed (norteadores, Política, cargos, designações), callable + tests
- [ ] LGPD consent: form callable tested, audit trail schema + rules
- [ ] KPI SLAs: defined in SGD doc, dashboard updated to show SLA vs actual

### Phase 4 (2026-07-15)

- [ ] CAPA: effectiveness verification callable tested, trending report generated
- [ ] Auditoria-interna: checklist integrated, audit scheduling + reporting
- [ ] KPI dashboard: all 5 indicators showing SLA tracking + trending

### Phase 5 (2026-08-15)

- [ ] NOTIVISA: callable tested against sandbox API, retry logic verified
- [ ] Disease mapping: 15+ TUSS codes configured, sample report generated
- [ ] RDC Art. 195 compliance: documented + sign-off from QM

### Phase 9 (2026-10-15)

- [ ] Manual Qualidade: v1.0 signed by Director + QM, published in SGD
- [ ] Laudo fields 10–12: all 14 fields present in sample laudo, PDF report generated
- [ ] Environmental monitoring: 24h baseline data collected, alert logic tested
- [ ] DICQ pre-audit: 88%+ coverage verified, auditor brief finalized

---

## Compliance Artifacts by Phase

| Phase | Document                   | Location                                     | Status      |
| ----- | -------------------------- | -------------------------------------------- | ----------- |
| **0** | ADR-0017 HMAC reset        | `docs/adr/ADR-0017-...md`                    | ✅ Deployed |
| **0** | ADR-0018 deploy gate       | `docs/adr/ADR-0018-...md`                    | ✅ Deployed |
| **1** | Governance docs master     | SGD `/docs/manual-qualidade` (Phase 1 draft) | Pending     |
| **4** | CAPA effectiveness report  | `docs/reports/CAPA-trending-{month}.md`      | Pending     |
| **5** | NOTIVISA integration guide | `docs/NOTIVISA_INTEGRATION.md`               | Pending     |
| **9** | Manual da Qualidade v1.0   | SGD `/docs/manual-qualidade` (Phase 9 final) | Pending     |

---

## Timeline Visualization

```
2026-05  ┌─ Phase 0 ─┐         ✓ DICQ 82%
         │ 05-07   05-14        ✓ RDC Art. 122, 36–39, 86–87, HMAC

2026-05  ┌─ Phase 1 ─┐         ✓ DICQ 84%
         │ 05-15   05-22        ✓ Governance, LGPD consent, KPI SLAs

2026-06–07 ┌─ Phase 4 ────────┐ ✓ DICQ 87%
           │ 06-01      07-15   ✓ CAPA, Auditoria, KPI dashboard

2026-07–08 ┌─ Phase 5 ───────┐ ✓ DICQ 88% 🎯 PRE-AUDIT READY
           │ 07-16     08-15   ✓ NOTIVISA, RDC Art. 195

2026-09–10 ┌─ Phase 9 ──────────┐ ✓ DICQ 92%+ 🎯 EXTERNAL AUDIT READY
           │ 09-01      10-15    ✓ Manual Qualidade, Laudo fields, Env monitoring

Oct 2026:   External DICQ Audit
Dec 2026:   Official DICQ Accreditation
```

---

## Sign-Off

**Roadmap approved by:** CTO (drogafarto)  
**Date:** 2026-05-07  
**Effective through:** 2026-10-31 (post-audit closure)

**Next review:** 2026-06-01 (Phase 1 completion checkpoint)

---

**Document version:** 1.0  
**Last updated:** 2026-05-07  
**Distribution:** Internal + DICQ auditors + ANVISA (upon request)
