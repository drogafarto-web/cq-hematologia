---
phase: '08-capa-closure'
title: 'Phase 8 — CAPA Closure + 4 Micro-Modules'
milestone: v1.3
status: planning
total_plans: 7
start_date: 2026-05-06
end_date: 2026-08-05
duration_weeks: 13
priority: P0-mandatory
stream: A
revision: 2.0
---

# Phase 8: CAPA Closure + Micro-Modules (Revised)

**Milestone:** v1.3 (CAPA Closure + Compliance + Migração)  
**Stream:** A (sequential — mandatory prerequisite)  
**Priority:** P0 (blocks external audit)  
**Period:** 2026-05-06 → 2026-08-05 (13 weeks)  
**Revision:** 2.0 (expanded after strategic alignment review)

---

## Goal

Close 12 CAPAs from Phase 7 audit dry-run **AND** build 4 small modules required by CAPAs (Calibração, Personnel/Cargos, Personnel/Designações, Management-Review). Achieve auditor sign-off and 100% evidence completeness.

This phase combines **process work** (CAPA closure) with **light engineering** (micro-modules to address findings that require new system capabilities).

**Output:** Closeout report + 4 modules deployed + 11/12 CAPAs closed (NC-011 deferred with auditor agreement to v1.4).

---

## Strategic Context (Revised)

After cross-checking Phase 7 findings against `HC_Quality_Compliance_DICQ.md`, several CAPAs require **new modules** to be built — they cannot be closed by process work alone:

| CAPA       | DICQ Ref | Required Module            | Why Module Needed                                                                   |
| ---------- | -------- | -------------------------- | ----------------------------------------------------------------------------------- |
| **NC-002** | 5.3.1.4  | `calibracao`               | Auditor wants system to track calibration certificates + due dates per equipment    |
| **NC-003** | 5.1.3    | `personnel/cargos`         | Formal job descriptions stored in system with sign-off                              |
| **NC-004** | 4.1.2.7  | `personnel/designacoes`    | Quality Manager designation document with chain of authority                        |
| **NC-001** | 4.14.5   | `management-review` (4.15) | Annual Direction Critical Analysis with 15 mandatory entries — currently 0% covered |

**Strategic Decision:** Build minimal viable versions of these 4 modules in Phase 8 rather than deferring to v1.4. Builds compliance momentum + closes CAPAs in same window.

---

## CAPA Inventory (Detailed)

### Critical CAPAs (P0)

| ID         | Finding                                 | DICQ Ref | Owner         | Approach                                    | Deadline                      |
| ---------- | --------------------------------------- | -------- | ------------- | ------------------------------------------- | ----------------------------- |
| **NC-001** | Auditoria Interna POP não documentado   | 4.14.5   | CTO + Quality | Build management-review module + create POP | 2026-05-30                    |
| **NC-011** | Cadastro Paciente — Sistema não captura | 5.4.3.2  | CTO           | **DEFER to v1.4** (order-entry too big)     | Discussed with auditor Week 1 |

### High Priority CAPAs (P1)

| ID             | Finding                               | DICQ Ref | Owner       | Approach                                  | Deadline   |
| -------------- | ------------------------------------- | -------- | ----------- | ----------------------------------------- | ---------- |
| **NC-002**     | Calibração — Falta em analisadores    | 5.3.1.4  | Ops + Eng A | Build `calibracao` module + collect certs | 2026-06-30 |
| **NC-003**     | Descrição Cargos não formalizado      | 5.1.3    | HR + Eng A  | Build `personnel/cargos` + populate       | 2026-06-30 |
| **NC-004**     | GQ Designação não documentada         | 4.1.2.7  | CTO + Eng A | Build `personnel/designacoes`             | 2026-06-30 |
| **NC-007–010** | (TBD from audit report — operational) | TBD      | Team        | Process closure                           | 2026-06-30 |

### Medium Priority CAPAs (P2)

| ID                         | Finding                 | DICQ Ref | Owner   | Approach         | Deadline   |
| -------------------------- | ----------------------- | -------- | ------- | ---------------- | ---------- |
| **NC-005, NC-009, NC-014** | Procedural improvements | TBD      | Quality | Document + train | 2026-07-05 |

### Extended Priority CAPAs (P3)

| ID         | Finding                            | DICQ Ref | Owner           | Approach                           | Deadline   |
| ---------- | ---------------------------------- | -------- | --------------- | ---------------------------------- | ---------- |
| **NC-006** | (TBD — likely v1.3 module-related) | TBD      | Eng (any phase) | Address in respective module phase | 2026-08-05 |

---

## Plan Structure (Revised)

Phase 8 has **7 plans** combining build + operations:

### Plan 08-01: CAPA Tracking Dashboard

**Duration:** 1 week (2026-05-06 → 2026-05-13)  
**Type:** Build (UI infrastructure)  
**Status:** ✅ PLAN.md drafted (already created)  
**Goal:** Real-time dashboard for tracking 12 CAPAs.

### Plan 08-02: Calibração Module (NC-002)

**Duration:** 2 weeks (2026-05-13 → 2026-05-27)  
**Type:** Build (new module)  
**Goal:** Equipment calibration tracking with certificate uploads, due dates, and audit trail.

**Deliverables:**

- `calibracao` Firestore schema (calibration records linked to equipamentos)
- Certificate upload (PDF/JPG) with chain-hash
- Due date alerts (30/15/7 days before due)
- DICQ 5.3.1.4 compliance (rastreabilidade metrológica)
- UI: dashboard + list + detail with timeline

### Plan 08-03: Personnel — Cargos + Designações (NC-003 + NC-004)

**Duration:** 2 weeks (2026-05-27 → 2026-06-10)  
**Type:** Build (new module)  
**Goal:** Formal job descriptions and Quality Manager designations stored in system.

**Deliverables:**

- `personnel/cargos` schema (job description per role)
- `personnel/designacoes` schema (RT, GQ, Diretor designations with signature)
- DICQ 5.1.3 + 4.1.2.7 compliance
- UI: org chart visualization + signed designation cards

### Plan 08-04: Management-Review Module (DICQ 4.15)

**Duration:** 2 weeks (2026-06-10 → 2026-06-24)  
**Type:** Build (new module)  
**Goal:** Annual Direction Critical Analysis with all 15 mandatory entries.

**Deliverables:**

- `management-review` schema (annual review with 15 entries)
- Auto-pull from NC/CAPA/indicators/audits
- Meeting agenda + minutes (atas)
- DICQ 4.15 compliance (Análise Crítica pela Direção)
- UI: review form + history + reports

### Plan 08-05: CAPA Process — Critical + High Closure

**Duration:** 6 weeks (2026-05-13 → 2026-06-30, parallel with 08-02 to 08-04)  
**Type:** Operational (process + evidence)  
**Goal:** Close 8 CAPAs (2 Critical + 6 High) with full evidence chain.

**Deliverables:**

- 8 CAPAs marked "Closed" with auditor sign-off
- Evidence uploaded (photos, certificates, training records)
- RFI responses documented
- Process improvements logged

### Plan 08-06: CAPA Process — Medium + Extended Closure

**Duration:** 5 weeks (2026-07-01 → 2026-08-05)  
**Type:** Operational + Documentation  
**Goal:** Close remaining 4 CAPAs (3 Medium + 1 Extended).

### Plan 08-07: Auditor Sign-Off + Closeout Report

**Duration:** 4 weeks (2026-07-08 → 2026-08-05, overlaps Plan 08-06)  
**Type:** Documentation + ceremony  
**Goal:** Auditor approval + final closeout report.

**Deliverables:**

- Auditor sign-off (email + LogicalSignature)
- `docs/CAPA_CLOSEOUT_2026-08.md` (10+ pages)
- DICQ baseline projection (71.3% → ~85%)
- v1.4 deferred items documented (NC-011 + others)

---

## Success Criteria (Revised)

| Criterion                     | Measurement                                              | Target             |
| ----------------------------- | -------------------------------------------------------- | ------------------ |
| **CAPA Closure Rate**         | 11/12 CAPAs in "Closed" status (NC-011 deferred to v1.4) | 92%                |
| **Modules Deployed**          | 4 micro-modules + CAPA dashboard live                    | 5/5                |
| **Evidence Completeness**     | Required artifacts uploaded per NC                       | 0 missing items    |
| **Auditor Sign-Off**          | Email + LogicalSignature on closeout                     | All signed off     |
| **Timeline Adherence**        | Zero CAPAs overdue past deadline                         | 0 overdue          |
| **DICQ Block B (SGD)**        | (Phase 12 separate — track here is auxiliary)            | tracked separately |
| **DICQ Block C (Pessoal)**    | 67% → 80% (cargos+designações)                           | 80%                |
| **DICQ Block D (Equip)**      | 69% → 85% (calibração)                                   | 85%                |
| **DICQ Block A (Governança)** | 73% → 78% (mgmt-review)                                  | 78%                |
| **Closeout Report**           | PDF archived with chain-hash                             | ≥10 pages          |

---

## Risks & Mitigations (Revised)

| Risk                                        | Impact                    | Likelihood | Mitigation                                            |
| ------------------------------------------- | ------------------------- | ---------- | ----------------------------------------------------- |
| **Auditor rejects NC-011 deferral**         | Re-scope Phase 8 +4 weeks | Medium     | Pre-discuss Week 1; have order-entry skeleton design  |
| **Eng A overloaded (4 modules in 8 weeks)** | 2-week slip               | High       | Pair programming weeks 4-8; freelance Eng I as backup |
| **Vendor calibration delay (NC-002)**       | CAPA close +4 weeks       | Medium     | Escalate vendor Week 2; backup vendor identified      |
| **Management-review module spec ambiguity** | 1-week extra design       | Low        | Use DICQ 4.15 15 entries as exact spec                |
| **Auditor evidence rejection**              | Re-work +2 weeks          | Low        | Internal pre-review every 2 weeks                     |

---

## Dependencies

### Inputs

- ✅ Phase 7 complete (`07-01-SUMMARY.md` with 12 CAPAs)
- ✅ Auditoria Interna module live (Phase 5)
- ✅ NC + CAPA Firestore schema (Phase 5)
- ✅ Audit evidence storage (5-year retention)
- ✅ Equipamentos module live (for Calibração linkage)
- ✅ Treinamentos module live (for Personnel/Cargos linkage)

### External

- 🔵 Auditor availability (Week 1 contact required)
- 🔵 Vendor calibration certificates (NC-002, weeks 2-4)
- 🔵 HR documentation (NC-003, NC-004)

### Outputs (consumed downstream)

- External audit (2026-08-31): closeout report + 4 modules as proof
- Phase 12 (SGD): management-review needs SGD for atas storage
- v1.4 backlog: order-entry, risk-management, indicators

---

## Compliance Mapping (Detailed)

| DICQ Section                 | Pre-v1.3     | After Phase 8                    | Module                                |
| ---------------------------- | ------------ | -------------------------------- | ------------------------------------- |
| 4.1.2.7 Designação GQ        | 🔴 (0%)      | ✅ (100%)                        | personnel/designacoes                 |
| 4.14.5 Auditoria Interna     | 🟡 (Phase 5) | ✅ (formalizada)                 | management-review + auditoria-interna |
| 4.15 Análise Crítica Direção | 🔴 (0%)      | ✅ (60% — primeira ata pendente) | management-review                     |
| 5.1.3 Descrição Cargos       | 🔴 (0%)      | ✅ (100% — após popular)         | personnel/cargos                      |
| 5.3.1.4 Calibração           | 🔴 (0%)      | ✅ (100% — sistema + certs)      | calibracao                            |
| 4.14 NC + CAPA               | 🟡 (Phase 5) | ✅ (closeout)                    | naoConformidades + capa-tracking      |

**Estimated DICQ Improvement Phase 8:** 71.3% → 80% (8.7 pts) — pending Phase 9-12 contributions

---

## Communication Cadence

| Frequency                  | Format        | Participants     | Purpose                          |
| -------------------------- | ------------- | ---------------- | -------------------------------- |
| **Daily standup**          | 5 min/agent   | All agents       | Status + blockers                |
| **Weekly checkpoint**      | 1h Friday     | All agents + CTO | Progress + integration           |
| **Bi-weekly auditor sync** | 1h video call | CTO + Auditor    | RFI review, evidence walkthrough |
| **End of phase**           | 2h closeout   | All + Auditor    | Sign-off ceremony                |

---

## Next Step

`/gsd-execute-phase 8` to begin CAPA closure + micro-modules execution.

**Plan progression:**

1. ✅ 08-01: CAPA Tracking Dashboard (PLAN.md drafted)
2. ⏳ 08-02: Calibração Module (auto-spawned next)
3. 📋 08-03: Personnel/Cargos + Designações
4. 📋 08-04: Management-Review Module
5. 📋 08-05: CAPA Process Critical+High
6. 📋 08-06: CAPA Process Medium+Extended
7. 📋 08-07: Auditor Sign-Off

**Auditor Engagement:** Schedule Week 1 video call to discuss NC-011 deferral and 4-module approach.

---

**Created:** 2026-05-06 (v1.0)  
**Revised:** 2026-05-06 (v2.0 — strategic alignment)  
**Approved:** 2026-05-06 (CTO via Option A revised plan)
