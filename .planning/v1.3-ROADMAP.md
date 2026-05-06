---
milestone: v1.3
version: 2.0
date_created: 2026-05-06
date_updated: 2026-05-06
status: approved-revised
revision_note: "Revised after Obsidian strategic alignment review (HC_Quality_Roadmap, Decisoes_Abertas, Compliance_DICQ)"
---

# HC Quality v1.3 — Roadmap (Revised)

**Milestone:** v1.3 (CAPA Closure + Compliance + Migração Riopomba)  
**Period:** 2026-05-06 → 2026-08-31 (14 weeks)  
**Status:** Approved (Revised v2.0)  

---

## Revision Summary (v1.0 → v2.0)

After cross-checking with strategic Obsidian docs, identified 5 divergences and applied **Option A (Híbrido Realista)** corrections:

1. ✅ Phase 8 expanded to include 4 CAPA-driven micro-modules (calibração, personnel/cargos, personnel/designacoes, management-review)
2. ✅ Phase 8.5 added — Housekeeping (latent bugs + crash + spine cleanup)
3. ✅ Phase 10 combined Liberação + Críticos (tightly coupled per compliance docs)
4. ✅ Phase 11 added Satisfação Cliente to Reclamações (4.14.3 + 4.8 — feedback loop completo)
5. ✅ Phase 12 NEW — SGD module (docs/sgd) + Importer Drive→SGQ Riopomba (Migração track)
6. ⏭️ Order-entry (NC-011) explicitly deferred to v1.4 (too big for 14 weeks)
7. ⏭️ Greenfield starter pack deferred to v1.4+ (Migração-first decision)

---

## Overview

v1.3 executes **two parallel streams** with **5 agents**:

1. **Stream A (Sequential):** Phase 8 + 8.5 — CAPA Closure + Housekeeping (CTO + Ops + Eng)
2. **Stream B (Parallel):** Phases 9–12 — Modules with strategic compliance + Riopomba migration value

**Critical Path:** Phase 8 must close by 2026-08-05 (CAPA deadline + auditor sign-off prerequisite).

---

## Phase Structure (Revised)

| Phase | Name | Type | Duration | Agents | Goal | Deadline |
|-------|------|------|----------|--------|------|----------|
| **8** | CAPA Closure + 4 Micro-Modules | Hybrid (Process + Build) | 13 weeks | A (CTO+Ops+Eng) | 12 CAPAs closed + 4 modules deployed | 2026-08-05 |
| **8.5** | Housekeeping | Build (bug fixes) | 1 week | A (overflow) | 3 latent bugs fixed + spine cleanup | 2026-05-20 |
| **9** | Bioquímica | Build | 12 weeks | B (Eng A+B) | QC quantitativo + Levey-Jennings | 2026-08-20 |
| **10** | Liberação + Críticos | Build (combined) | 13 weeks | C (Eng C+D) | Release workflow + critical escalation (combined) | 2026-08-20 |
| **11** | Reclamações + Satisfação | Build | 11 weeks | D (Eng E+F) | Complaint loop + customer satisfaction (4.8 + 4.14.3) | 2026-08-25 |
| **12** | SGD + Drive Importer | Build (Riopomba migration) | 8 weeks | E (Eng G+H) | docs/sgd module + ~80 Riopomba docs imported | 2026-08-25 |

**Total:** 6 phases · 5 agents · 14 weeks

---

## Phase 8: CAPA Closure + Micro-Modules (Stream A — Sequential)

**Goal:** Close 12 CAPAs + build 4 small modules required by CAPAs (calibração, personnel/cargos, personnel/designacoes, management-review).

**Period:** 2026-05-06 → 2026-08-05 (13 weeks)  
**Team:** CTO (lead) + Operations + Eng A (micro-modules)

### CAPA Inventory + Module Mapping

| ID | Finding | DICQ Ref | Type | Approach |
|----|---------|----------|------|----------|
| **NC-001** | Auditoria Interna POP não documentado | 4.14.5 | Process | Doc + training (operational) |
| **NC-002** | Calibração — Falta em analisadores | 5.3.1.4 | **Build** | New `calibracao` module + vendor contracts |
| **NC-003** | Descrição de Cargos não formalizado | 5.1.3 | **Build** | New `personnel/cargos` module |
| **NC-004** | Gerente Qualidade — Designação não documentada | 4.1.2.7 | **Build** | New `personnel/designacoes` module |
| **NC-005** | (Medium) | TBD | Process | Doc + workflow update |
| **NC-006** | (Extended) | TBD | Process | Procedural improvement |
| **NC-007–010** | (High/Medium) | TBD | Process | Operational closure |
| **NC-011** | Cadastro Paciente — Sistema não captura | 5.4.3.2 | **DEFER** | Order-entry module → v1.4 |
| **NC-012–014** | (TBD) | TBD | Mixed | Mix of process + build |

**Plan Structure:**

| Plan | Focus | Duration | Owner | Deadline |
|------|-------|----------|-------|----------|
| **08-01** | CAPA Tracking Dashboard (UI infrastructure) | 1 week | Eng A | 2026-05-13 |
| **08-02** | Calibração module (NC-002) — schema + UI + CF | 2 weeks | Eng A | 2026-05-27 |
| **08-03** | Personnel/cargos + designacoes (NC-003 + NC-004) | 2 weeks | Eng A | 2026-06-10 |
| **08-04** | Management-review module (DICQ 4.15 — Análise Crítica Direção) | 2 weeks | Eng A | 2026-06-24 |
| **08-05** | CAPA process execution (Critical + High closure) | 6 weeks (parallel) | CTO + Ops | 2026-06-30 |
| **08-06** | CAPA process execution (Medium + Extended closure) | 5 weeks | CTO + Ops | 2026-07-05 |
| **08-07** | Auditor sign-off + Closeout report | 4 weeks | CTO | 2026-08-05 |

**Note:** NC-011 (order-entry) is the largest CAPA. Documenting it as deferred with auditor's understanding is more honest than rushing a half-baked LIS-light into v1.3.

---

## Phase 8.5: Housekeeping (Stream A — Sequential)

**Goal:** Fix 3 latent bugs post-Ondas + crash diasEstab + spine audit cleanup.

**Period:** 2026-05-13 → 2026-05-20 (1 week)  
**Team:** Eng A (overflow from Phase 8)

### Plan Structure

| Plan | Focus | Duration |
|------|-------|----------|
| **08.5-01** | Crash diasEstab no NovoLoteModal (UX bug) | 1 day |
| **08.5-02** | 3 latent bugs post-Ondas (investigated + fixed) | 3 days |
| **08.5-03** | Spine audit cleanup — 6 yellows → green | 2 days |
| **08.5-04** | Smoke tests + deploy + verification | 1 day |

---

## Phase 9: Bioquímica (Stream B — Parallel)

**Goal:** Production-ready QC module for biochemistry analytes with Levey-Jennings charting.  
**Period:** 2026-05-06 → 2026-08-20 (16 weeks, overlaps Phase 8)  
**Team:** Eng A (after Phase 8.5) + Eng B (frontend)

**Note:** Bioquímica is NOT in DICQ Compliance-1/2/3 priorities, but adds CIQ value for analyte breadth. Justifiable as continued investment in HC Quality's analytical strength (compliance-spine F).

### Plan Structure (Unchanged from v1.0)

| Plan | Focus | Duration | Deadline |
|------|-------|----------|----------|
| **09-01** | Schema + service layer + types | 1 week | 2026-05-13 |
| **09-02** | Material control + QC entry form | 1.5 weeks | 2026-05-27 |
| **09-03** | Acceptance logic + Levey-Jennings chart | 1 week | 2026-06-03 |
| **09-04** | Cloud Function + E2E tests | 1.5 weeks | 2026-06-17 |
| **09-05** | Polish + regression + deploy | 1 week | 2026-08-20 |

---

## Phase 10: Liberação + Críticos (Combined Phase)

**Goal:** Production-ready release workflow with RT digital signature + critical value escalation. Combined because Críticos blocks Liberação (per compliance docs G + H).  
**Period:** 2026-05-20 → 2026-08-20 (13 weeks, parallel with Phase 9)  
**Team:** Eng C (backend) + Eng D (frontend)

### Plan Structure

| Plan | Focus | Duration | Deadline |
|------|-------|----------|----------|
| **10-01** | Release state machine + audit log | 1 week | 2026-05-27 |
| **10-02** | RT signature + UI form | 1.5 weeks | 2026-06-10 |
| **10-03** | Críticos config + threshold logic | 1.5 weeks | 2026-06-24 |
| **10-04** | SMS escalation (Twilio) + email fallback | 1 week | 2026-07-01 |
| **10-05** | Release/Críticos integration (block on critical results) | 1.5 weeks | 2026-07-15 |
| **10-06** | E2E tests + UI polish | 1.5 weeks | 2026-07-29 |
| **10-07** | Performance + regression + deploy | 1 week | 2026-08-20 |

---

## Phase 11: Reclamações + Satisfação Cliente

**Goal:** Production-ready complaint intake + RCA + satisfaction survey + trending. Combined because per DICQ they form a single "feedback loop" (4.8 + 4.14.3 + 4.14.4).  
**Period:** 2026-06-03 → 2026-08-25 (12 weeks, parallel)  
**Team:** Eng E (backend) + Eng F (frontend)

### Plan Structure

| Plan | Focus | Duration | Deadline |
|------|-------|----------|----------|
| **11-01** | Schema + RCA workflow + service | 1.5 weeks | 2026-06-17 |
| **11-02** | Reclamações intake form + NC linkage | 1.5 weeks | 2026-07-01 |
| **11-03** | Satisfação Cliente module (NPS, surveys) | 1.5 weeks | 2026-07-15 |
| **11-04** | Sugestões + trending dashboard | 1 week | 2026-07-22 |
| **11-05** | E2E tests + monthly reports | 1 week | 2026-08-05 |
| **11-06** | Performance + deploy | 1 week | 2026-08-25 |

---

## Phase 12: SGD + Drive Importer (Riopomba Migração)

**Goal:** Sistema de Gestão Documental (docs/sgd) + Importer para os ~80 documentos do Drive Riopomba. Migração-first decision: ataca Compliance-1 priority + Riopomba immediate value.  
**Period:** 2026-06-17 → 2026-08-25 (10 weeks, parallel)  
**Team:** Eng G (backend) + Eng H (frontend)

### Strategic Justification

- **DICQ Block B (Gestão Documental)** — All 🔴 (4.2.2.2, 4.3 hierarquia, 4.3 controle versão, 4.3 distribuição)
- **Riopomba lab** has ~80 documents in Drive (LM-01 + PQs/FRs/MQ) — already operating SGQ in Drive
- **Impact:** +5-8 DICQ points for Riopomba (from 71.3% → 76-79%)
- **Path to multi-tenant:** establishes SGD as canonical reference for future labs

### Plan Structure

| Plan | Focus | Duration | Deadline |
|------|-------|----------|----------|
| **12-01** | docs/sgd schema (MQ + IT + FR + Lista Mestra hierarchy) | 1.5 weeks | 2026-07-01 |
| **12-02** | SGD UI + version control + workflow | 2 weeks | 2026-07-15 |
| **12-03** | Drive importer — parser para 15 tipos LM-01 + listaDistribuicao (17 setores) | 2 weeks | 2026-07-29 |
| **12-04** | Riopomba data migration (test in staging) | 1.5 weeks | 2026-08-12 |
| **12-05** | Production import + verification + deploy | 1 week | 2026-08-25 |

---

## Out of Scope (v1.3) — Deferred Items

| Item | Reason | Target |
|------|--------|--------|
| **Order-entry (NC-011)** | Module is too large for v1.3 (LIS-light). Document gap with auditor. | v1.4 (Q4 2026) |
| **Greenfield starter pack** | Migração-first decision. Lock-in product story for Compliance-1 in v1.4. | v1.4 |
| **Multi-tenant real (Opção A vs B)** | Architectural decision still open. | v1.4 strategic spike |
| **OCR strip Imuno IA** | Strategic IA roadmap — separate milestone. | v1.5+ |
| **PNCQ Importer (CEQ Bloco 4)** | +4 DICQ pts but lower priority than Drive→SGQ. | v1.4 |
| **Patient portal / Coleta / Triagem** | Compliance-3 priorities (120-180d). | v1.4 |
| **Risk Management module (4.14.6)** | Compliance-2 priority. | v1.4 |
| **Indicators dashboard (4.14.7)** | Already partial in `kpis` module. Formalize in v1.4. | v1.4 |

---

## Agent Allocation (Revised)

5 parallel agents across 14 weeks:

| Agent | Stream | Phase(s) | Personnel | Workload |
|-------|--------|----------|-----------|----------|
| **A** | Stream A | 8 + 8.5 | CTO + Ops + Eng A (micro-modules) | Heavy (sequential) |
| **B** | Stream B | 9 (Bioquímica) | Eng A (after Phase 8.5) + Eng B | Medium |
| **C** | Stream B | 10 (Liberação+Críticos) | Eng C + Eng D | Medium-Heavy |
| **D** | Stream B | 11 (Reclamações+Satisfação) | Eng E + Eng F | Medium |
| **E** | Stream B | 12 (SGD+Drive Importer) | Eng G + Eng H | Medium |

**Synchronization:**
- Daily standup: 9 AM (5 min/agent)
- Weekly checkpoint: Friday 4 PM (1h, all agents + CTO)
- Phase boundary: Friday EOW (handoff doc + smoke test)
- Integration gate: Phase 9 (Bioquímica) + Phase 10 (Liberação) merge mid-July

---

## Risk Dashboard (Updated)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **NC-011 deferral pushed back by auditor** | Medium | 4-week delay | Pre-discuss with auditor Week 1; have skeleton design ready |
| **Eng A overloaded (Phase 8 + 8.5 + 9)** | High | 2-week slip | Hire freelance Eng I if needed; reassign Phase 8.5 to Eng B |
| **Drive importer parser fails on edge cases** | Medium | 1-2 week slip | Allocate buffer; manual import as fallback |
| **Liberação + Críticos integration complex** | Medium | 2-week slip | Pair programming Week 5-6; integration tests first |
| **Vendor calibração delay (NC-002)** | Medium | CAPA close delay | Escalate vendor Week 2; backup vendor identified |
| **Auditor unavailable for sign-off** | Medium | Extend timeline 2-3 weeks | Lock auditor calendar Week 4; async RFI |

---

## Success Criteria (Revised)

| Criterion | Target | Measurement | Date |
|-----------|--------|-------------|------|
| **CAPA Closure** | 11/12 CAPAs closed (NC-011 deferred with auditor agreement) | Auditor sign-off | 2026-08-05 |
| **Modules Live** | 7 modules deployed (Bio + Lib + Cri + Rec + SGD + 3 micro: cal, cargos, des) | Firebase deploy | 2026-08-25 |
| **DICQ Baseline** | ≥87% (from 71.3%, +16 pts) | Audit re-run on 30 items | 2026-08-31 |
| **Riopomba Documents** | ~80 docs migrated to SGD | Firestore count + Drive cross-check | 2026-08-25 |
| **Test Coverage** | ≥95% on new code | nyc report | 2026-08-25 |
| **External Audit Ready** | Auditor scheduled + evidence 100% | Email + calendar lock | 2026-08-31 |
| **Tech Debt** | 3 bugs fixed + spine cleanup | All 6 spines green | 2026-05-20 |

---

## Compliance Coverage (DICQ Block-by-Block, Post v1.3)

| Block | Pre-v1.3 | Post-v1.3 | Delta |
|-------|----------|-----------|-------|
| A — Governança | 73% | 73% | (4.15 mgmt-review NEW = +5%, total 78%) |
| B — Gestão Documental | 0% | **65%** (SGD live) | **+65%** ⭐ |
| C — Pessoal | 67% | **80%** (cargos+designacoes+ec) | +13% |
| D — Ambiente | 58% | 58% | (no change) |
| E — Pré-analítico | 64% | 64% | (NC-011 deferred) |
| F — Analítico | ~85% | **92%** (Bioquímica live) | +7% |
| G — Pós-analítico | 70% | **88%** (Lib+Cri+Calibracao) | +18% ⭐ |
| H — Garantia Qualidade | 75% | **85%** (Reclamações+Satisfação+CAPA closed) | +10% |
| I — Laudos/Liberação | 75% | **88%** (formalized) | +13% |
| J — Continuidade | ~70% | 70% | (DR done v1.2) |

**Estimated Total Conformance:** 71.3% → **~85%** (revised from 90% target — more honest given NC-011 deferral)

---

## Timeline Visualization (Revised)

```
May              Jun              Jul              Aug
│────────────────────────────────────────────────│
Phase 8: CAPA + 4 Micro-Modules
  ├──────────────────────────────────────────│ Aug 5
Phase 8.5: Housekeeping
  ├────│ May 20
Phase 9: Bioquímica (parallel)
   ├────────────────────────────────────────│ Aug 20
Phase 10: Liberação+Críticos (parallel)
       ├──────────────────────────────────│ Aug 20
Phase 11: Reclamações+Satisfação (parallel)
            ├─────────────────────────────│ Aug 25
Phase 12: SGD+Drive Importer (parallel)
              ├────────────────────────│ Aug 25
                                              │
                                External Audit: Aug 31 ✓
```

---

**Created:** 2026-05-06 (v1.0)  
**Revised:** 2026-05-06 (v2.0 — strategic alignment)  
**Approved:** 2026-05-06 (CTO via Option A + Migração First + Phase 8.5)  
**Next Step:** `/gsd-execute-phase 8` to begin CAPA closure + micro-modules
