---
title: DICQ Gap Analysis v1.4 — Roadmap to 85%+ Compliance
date: 2026-05-07
version: 1.0
audit_target: 2026-10-15
compliance_baseline: 78.5% (v1.3)
compliance_target: 88%+ (v1.4)
---

# DICQ Gap Analysis — v1.4 Roadmap

## Executive Summary

HC Quality v1.3 achieved **78.5% DICQ conformance** — exceeding the 75% audit-ready baseline. However, to reach **premium standing (85%+) before external audit (Oct 2026)**, v1.4 must close strategic gaps across 10 DICQ blocks.

**Key Finding:** Four blocks drive 70% of the remaining gap:
- **Block B** (Gestão Documental): 65% → 92% (+27 pts) — already high-ROI with SGD foundation
- **Block D** (Qualidade & Compliance): 60% → 85% (+25 pts) — risk management + audit cycle infrastructure  
- **Block G** (Pós-Analítico & Laudos): 70% → 92% (+22 pts) — patient portal + critical values
- **Block C** (Pessoal): 80% → 92% (+12 pts) — unified dossier + supervisor presence

**Priority Recommendation:** Phases 0, 4, 5, and 9 unlock 85%+ if delivered on time. Phase 0 (RDC blockers) is non-negotiable; Phase 4 auditor interaction is critical path.

---

## 1. Conformance Matrix — All Blocks (A–J)

| Block | Title | v1.3 % | v1.4 Target | Gap | Driver Requirements | v1.4 Phases | Effort | Confidence |
|-------|-------|--------|------------|-----|---------------------|------------|--------|------------|
| **A** | Governance & Direction | 78% | 92% | +14 | Governance policy + management review + formal designations | 0, 4, 9, 13 | M | 🟡 Medium |
| **B** | Document Management (SGD) | 65% | 92% | +27 ⭐ | Master List + hierarchy + approval workflow + Riopomba migration | 3, 9 | M | ✅ High |
| **C** | Personnel | 80% | 92% | +12 | Unified dossier (5.1.9) + supervisor presence + competency assessment | 0, 4, 9 | L | 🟡 Medium |
| **D** | Quality & Compliance | 60% | 85% | +25 ⭐ | Risk management + internal audit cycle + indicators dashboard | 0, 1, 4, 7, 9, 12 | L | 🟡 Medium |
| **E** | Pre-Analytical | 64% | 75% | +11 | Collection + transport + sample reception/rejection SOP | 6 | S | 🟡 Medium |
| **F** | Analytical | 92% | 95% | +3 | Method validation + measurement uncertainty + CEQ annual review | 10 | S | ✅ High |
| **G** | Post-Analytical & Reports | 70% | 92% | +22 ⭐ | Patient portal + critical values + NOTIVISA + PGRSS | 5, 6, 8, 9 | M | ✅ High |
| **H** | Resources (Equipment/Reagents/Support) | 75% | 88% | +13 | Calibration + lab support contracts (RDC blocker) + maintenance | 0, 8, 9, 10 | M | 🟡 Medium |
| **I** | Environment & Facilities | 64% | 80% | +16 | Environmental monitoring + biosafety + infection prevention | 9 | M | 🟡 Medium |
| **J** | Continuity & Confidentiality | 70% | 78% | +8 | LGPD formal policy + disaster recovery (already live) | 0, 1 | S | ✅ High |
| **Weighted Average** | — | 78.5% | **~88.5%** | **+10** | — | — | — | — |

**Legend:** S = Small (1–3 days), M = Medium (1–2 weeks), L = Large (2–3 weeks)

---

## 2. Block-by-Block Gap Details

### Block A: Governance & Direction (78% → 92%, +14 pts)

**Current State:** Persona roles exist; policy documents missing.

**DICQ Gaps (v1.3 → v1.4):**
- **4.1.1.2** Legal person (CNES, operational permit, council registration) — 🔴 Missing
- **4.1.1.3** Guiding principles (Mission/Vision/Values) + ethics code + whistleblower hotline — 🔴 Missing
- **4.1.2.3** Quality policy (formal document, lab-wide publication) — 🔴 Missing
- **4.1.2.4** Quality planning with performance measurement — 🔴 Missing
- **4.15** Management review (critical analysis, 15 mandatory inputs: complaints, CAPA, audits, KPIs, training, resources) — 🔴 Missing

**Phases Closing Gaps:**
- **Phase 0** (RDC Art. 77 blocker): Legal docs upload module + supervisor presence designation (NEW-A1, NEW-A3)
- **Phase 9**: Governance norteadores templates in SGD + ethics code + org chart with substitutes (NEW-A2)
- **Phase 13–14**: Management review automation (REQ-413) — aggregate data from NC, CAPA, audit, indicators

**Required Modules:** `labSettings/legal-docs`, `governance/norteadores`, `personnel/designacoes`, `management-review`

**Blockers:** Phase 13 depends on Phase 4 (CAPA closure) + Phase 9 (audit cycle + indicators).

**Estimated Effort:** M (weekly governance review + 20 template docs)

---

### Block B: Document Management — SGD (65% → 92%, +27 pts) ⭐ Highest ROI

**Current State (v1.3):** SGD module live with Drive importer; 80 Riopomba docs migrated. Hierarchy MQ→PQ→IT→FR→POL implemented.

**DICQ Gaps:**
- **4.2.2.2** Quality Manual (formal ISO 15189 template, approved) — 🟡 Partial
- **4.3 (full)** Document hierarchy, versioning, approval workflow, distribution tracking, obsolete control — 🟡 Partial (workflows exist; approval gate incomplete)
- **4.3 (digital + physical control)** Electronic certificates + distribution records + version seals — 🟡 Partial

**v1.4 Deliverables:**
- **Phase 3** (refactor): Finalize approval workflow in SGD UI (draft → review → approved → obsolete)
- **Phase 9** (hardening): Quality Manual template + completeness audit (20 DICQ-required sections), distribution tracking with read confirmations

**Modules:** `sgq` (extended), `sgd` (approval workflow)

**Why High Confidence:** SGD already exists + 80 docs successfully migrated. Gap is mostly template population + audit verification.

**Estimated Effort:** M (1–2 weeks template + audit)

**Notes on Orphan Resolution:** 
- Orphan 4.1.1.2 (legal docs) assigned to NEW-A1 (Phase 0)
- Orphan 4.1.1.3 (norteadores) assigned to NEW-A2 (Phase 9)

---

### Block C: Personnel (80% → 92%, +12 pts)

**Current State:** Employee records scattered; roles defined; training module live (educacao-continuada).

**DICQ Gaps (critical: 5.1.9 — Unified Dossier):**
- **5.1.1** Personnel management policy (document in SGD) — 🔴 Missing
- **5.1.3** Job descriptions (detailed, authority, substitutes) — 🔴 Missing
- **5.1.4** Onboarding checklist (integration of new employees) — 🔴 Missing
- **5.1.6** Post-training competency assessment — 🔴 Missing
- **5.1.7** Periodic performance critical analysis — 🔴 Missing
- **5.1.8** Annual EC program + efficacy measurement — 🟡 Partial (EC exists; efficacy gap small)
- **5.1.9** Complete record (ONE source of truth: qualifications + training + competency + performance) — 🔴 CRITICAL
- **5.1.10** Biosecurity (vaccination, PPE, NR-32) + integration with biosseguranca module — 🔴 Missing
- **5.1.11** Well-being, stress management, violence prevention (stretch goal) — 🔴 Missing

**Critical Path: REQ-403 (Personnel Dossiè — 5.1.9)**
- **Phase 0** (skeleton): Create unified dossier UI structure; supervisor presence designation (RDC Art. 122 blocker)
- **Phase 9** (full): Backfill historical records; add job descriptions, onboarding checklists, competency forms, performance assessments

**Data Migration Risk:** Records are dispersed (educacao-continuada for training, auth for qualifications, separate HR sheets for performance). Phase 0 must design migration job to consolidate.

**Modules:** `personnel/dossie` (unified), `personnel/cargos`, `personnel/designacoes`, `personnel/competencia`, `personnel/avaliacao-desempenho`, `personnel/saude-seguranca`

**Estimated Effort:** L (2–3 weeks, heavily dependent on data migration design)

---

### Block D: Quality & Compliance Operational (60% → 85%, +25 pts) ⭐ Second-Highest Gap

**Current State (v1.3):** NC + CAPA tracking exists; audit trail live; KPIs module live.

**DICQ Gaps:**
- **4.8** Complaint handling (trending + closure loop + linkage to CAPA) — 🟡 Partial (v1.3 has intake; trending deferred)
- **4.10** Corrective action (root cause + efficacy verification) — 🟡 Partial (12 v1.3 CAPAs need closure in Phase 4)
- **4.11** Preventive action (proactive, process-based) — 🔴 Missing (deferred to v1.5)
- **4.12** Continuous improvement (formal improvement plan tracking) — 🔴 Missing
- **4.12.1** Formal improvement plans — 🔴 Missing
- **4.13** Records control (retention 5 yrs per RDC Art. 115, integrity, immutability) — 🟡 Partial (audit chain exists; retention rules TBD)
- **4.14.2** Critical analysis of requests + samples (periodic reports) — 🔴 Missing (deferred to v1.5)
- **4.14.3** User feedback (satisfaction) — 🟡 Partial (v1.3 NPS exists; trending deferred)
- **4.14.4** Staff suggestions (trending + upvote) — 🟡 Partial (v1.3 module exists; trending deferred)
- **4.14.5** Internal audit (formal cycle, checklist builder, finding linkage) — 🔴 **ORPHAN resolved** (NEW-D1, Phase 9)
- **4.14.6** Risk management plan (FMEA-lite, P×S×D, NPR, annual review) — 🔴 **ORPHAN resolved** (REQ-412, Phase 0 skeleton + Phase 4 full)
- **4.14.7** Quality indicators (pre/analytic/post with targets, trends, SLA) — 🔴 Missing (REQ-401, Phase 1 + 12)
- **4.14.8** External organization evaluations (records, assessments) — 🔴 **ORPHAN resolved** (NEW-D2, Phase 9)

**v1.4 Delivery Sequence:**
- **Phase 0:** Risk management skeleton (FMEA matrix template, NPR calculator, ADR-0009)
- **Phase 1:** Indicators dashboard (pre/analytic/pós with targets + trends)
- **Phase 4:** CAPA closure (12 findings efficacy verified by auditor); Risk management full spec
- **Phase 7:** Reclamações + Satisfação + Sugestões trending dashboard (REQ-414)
- **Phase 9:** Internal audit module (checklist builder + scheduling + NC linkage); External audits record template
- **Phase 12:** Improvement plans formal tracking (REQ-401 extended)

**Auditor RFI Risk:** Phase 4 depends on auditor interaction (12 CAPA findings need closure verification). Mitigation: weekly async email gates + pre-scheduled call slots.

**Modules:** `risks` (FMEA-lite), `indicators` (dashboard), `auditoria-interna` (NEW-D1), `improvement-plans` (REQ-401 ext.), `audits/external-records` (NEW-D2)

**Estimated Effort:** L (cross-cutting concern; depends on Phase 4 auditor flow)

---

### Block E: Pre-Analytical (64% → 75%, +11 pts)

**Current State (v1.3):** Sample control exists; temperature monitoring live.

**DICQ Gaps:**
- **5.4.2** Patient information (exam catalog, preparation instructions) — 🔴 Deferred to v1.5 (patient portal out of scope)
- **5.4.3** Patient registration + exam request (LIS-light) — ⚪ Out of scope (assumed external LIS)
- **5.4.4** Collection (instructions, collector ID, traceability) — 🔴 Missing (REQ-404, Phase 6)
- **5.4.5** Transport (time limits, temperature, integrity) — 🔴 Missing (integrated to controle-temperatura, Phase 6)
- **5.4.6** Reception (acceptance/rejection criteria, NC linkage) — 🔴 Missing (REQ-404, Phase 6; SOP in SGD Phase 9)
- **5.4.7** Pre-analytical handling, preparation, storage — 🔴 Missing (Phase 6)

**Phases Closing Gaps (Phase 6 — Coleta + Transporte):**
- `coleta` module: collection instructions + barcode + mobile UI
- `transporte-amostras`: transport SLA + temperature integration + delivery confirmation
- Rejection SOP in SGD + auto-NC creation
- Acceptance criteria UI with barcode scanning

**Module:** `coleta`, `transporte-amostras` (integrated to `controle-temperatura`)

**Why Lower Priority:** Coleta + Transporte are operational; patient catalog (5.4.2) deferred to v1.5. v1.4 covers process-critical only (collection + transport + rejection).

**Estimated Effort:** S (1 week; integrates existing temperature module)

---

### Block F: Analytical (92% → 95%, +3 pts)

**Current State:** Strongest block. All CIQ modules live (Hema, Coag, Uro, Imuno, Bioquímica). Westgard rules + Levey-Jennings charts deployed.

**DICQ Gaps (refinements):**
- **5.5.1.2** Pre-use verification (formal records per module) — 🟡 Partial
- **5.5.1.3** Validation of non-standard methods (CLSI template + status) — 🔴 Missing (REQ-405, Phase 10)
- **5.5.1.4** Measurement uncertainty (calculation + reporting) — 🔴 Missing (REQ-405, Phase 10)
- **5.5.2** Biological reference intervals (per analyte, continuous review) — 🟡 Partial (REQ-405 + REQ-409, Phase 10)
- **5.5.3** Complete procedure documentation (20 DICQ items in SOP template) — 🔴 Missing (SGD template Phase 9 + Phase 10 population)
- **5.6.3.4** Annual CEQ evaluation + corrective action report — 🔴 Missing (auto-generated report callable, Phase 10)
- **5.6.4** Equipment/method comparability (multi-instrument) — 🔴 Stretch (Phase 10 if capacity)

**Phase 10 Deliverables:**
- Method validation templates (CLSI EP15 reference)
- Measurement uncertainty calculator + dashboard
- Biological reference intervals review UI
- Annual CEQ report auto-generation (Art. 176, V RDC)
- SOP documentation template (20-section DICQ standard)

**Module:** `bioquimica` (extended), `ceq` (reporting)

**Why High Confidence:** Foundation is strong. Phase 10 is refinement + documentation.

**Estimated Effort:** S (1 week; mostly template + calculator logic)

---

### Block G: Post-Analytical & Reports (70% → 92%, +22 pts) ⭐ Third-Highest Gap

**Current State (v1.3):** Liberação state machine live; RT signature functional.

**DICQ Gaps:**
- **5.7.1** Critical review before release (analysis workflow) — 🔴 Missing (REQ-415, Phase 5)
- **5.7.2** Critical values (alert + physician communication + registration) — 🔴 Missing (SMS/email/Twilio, Phase 6)
- **5.7.3** Compulsory notification (Portaria 204 MS + NOTIVISA API) — 🔴 Missing (REQ-410, Phase 8)
- **5.7.4** Sample storage, retention, disposal + PGRSS (RDC 222/2018) — 🔴 Missing (REQ-407, Phase 9)
- **5.8** Report issuance (16 DICQ items: patient ID, method name, reference range, limitations, analyst/RT/release date) — 🟡 Partial (validate items 10–12)
- **5.9.1** Release authorization + secure transmission + verbal communication record — 🔴 Missing (patient portal Phase 5)
- **5.9.2** Automated release with validated criteria — 🔴 Deferred to v1.5 (complexity risk)
- **5.9.3** Report review history (immutable, RT-signed) — 🟡 Partial (audit chain exists; add portal physician view Phase 5)

**v1.4 Sequence:**
- **Phase 5** (Liberação + Críticos partial): Patient portal MVP + physician read-only portal + audit log download
- **Phase 6** (Valores críticos): Critical value rules + SMS/email escalation + acknowledge workflow + SLA tracking
- **Phase 8** (NOTIVISA): Integration with gov API + Portaria 204 (notifiable diseases) + RT approval gate + audit trail
- **Phase 9** (PGRSS): Sample lifecycle (storage → retention schedule → disposal) + contractor receipt verification

**Modules:** `liberacao-laudos` (extended), `patient-portal`, `valores-criticos`, `notivisa-outbox`, `pgrss`

**Why High Confidence:** Phase 5 foundation exists. Phase 6–9 build incrementally.

**Estimated Effort:** M (2 weeks; portal MVP + integrations)

---

### Block H: Resources (Equipment/Reagents/Support) (75% → 88%, +13 pts)

**Current State:** Equipment + supplies modules live; fornecedores module live. Temperature monitoring via controle-temperatura.

**DICQ Gaps:**
- **4.5** Laboratory support contracts (minimum 6 contractual clauses per RDC Art. 36–39) — 🔴 **RDC BLOCKER** (NEW-H1, Phase 0)
- **4.5.2** Support lab report (faithful transcription, traceability) — 🔴 Missing (Phase 0, Phase 9 formalization)
- **5.3.1.4** Calibration + metrological traceability (certificate upload + alerts) — 🔴 Missing (REQ-408, Phase 9)
- **5.3.1.5** Maintenance (preventive, corrective, out-of-service) — 🟡 Partial (TD-403, Phase 10 consolidation)
- **5.3.1.6** Equipment adverse events → NOTIVISA (tecnovigilância) — 🔴 Missing (integrated to Phase 8 NOTIVISA)
- **5.3.1.7** Complete equipment record (12 mandatory fields) — 🟡 Partial (audit fields, Phase 9)
- **5.3.2.3** Acceptance test for batch/formulation changes — 🟡 Partial (Phase 10 lot expiry validator extension)

**Critical: Phase 0 Must Deliver NEW-H1 (Lab Apoio Contracts)**
- Contract template (6 clauses: capacity, turnaround, quality, contingency, audit right, liability)
- Legal review + RT approval workflow
- Monitoring dashboard (services active, SLA compliance, audit trail)

RDC Arts. 36–39 (support labs) are inspector requirements. Cannot ship without this.

**v1.4 Phases:**
- **Phase 0:** Lab support contract module (NEW-H1) — RDC blocker
- **Phase 8:** Tecnovigilância integration to NOTIVISA
- **Phase 9:** Calibration certificate management (upload + alert + metrological chain)
- **Phase 10:** Maintenance consolidation (preventive plan + work orders + close-out audit)

**Modules:** `lab-apoio` (NEW-H1), `calibracao`, `equipamentos` (extended), `insumos` (extended)

**Estimated Effort:** M (1–2 weeks; contract template + legal review + monitoring)

---

### Block I: Environment & Facilities (64% → 80%, +16 pts)

**Current State (v1.3):** Controle-temperatura module live (ISO 14644 particle counting mentioned but not fully implemented).

**DICQ Gaps:**
- **5.2.6** Environmental monitoring (temperature + humidity + air quality) — 🟡 Partial (temperature live; humidity + particle counting incomplete)
- **5.2.7** Accessibility, equity, food safety — ⚪ Out of software (document + policy)
- **5.2.8** Infection prevention program (protocols + training + indicators) — 🔴 Missing (POPs + biosseguranca integration, Phase 9)

**Phase 9 Deliverables:**
- Expand controle-temperatura to include humidity + particle counting (ISO 14644, NB1–NB4 classification)
- Infection prevention POPs in SGD (handwashing, PPE, sterilization, surface cleaning)
- Biosseguranca module + risk area mapping + inspector checklist integration
- Indicators (compliance %, incident count, training completion %)

**Module:** `controle-temperatura` (extended), `biosseguranca` (expanded), `pops` (biosseguranca subset)

**Estimated Effort:** M (1–2 weeks; mostly configuration + template docs)

---

### Block J: Continuity & Confidentiality (70% → 78%, +8 pts)

**Current State (v1.3):** Disaster recovery (v1.2) live; audit chain (v1.3) immutable + HMAC-signed.

**DICQ Gaps:**
- **5.10.1** Patient confidentiality (access control + audit log + LGPD policy) — 🟡 Partial (rules strong; policy document TBD)
- **5.10.3** Disaster recovery plan (periodic testing) — ✅ Covered (v1.2, no change needed)

**Phase 0 + Phase 1:**
- LGPD formal policy document in SGD (Art. 8 data processing terms, Art. 38 data breach notification, Art. 18 right to access, Art. 17 right to deletion)
- Disclosure of RDC Art. 77 compliance (information security plan)
- Pre-deploy secret status check (ADR-0018 gate)

**Why Low Effort:** Policy template exists; deploy gate already live (2026-05-07 incident remediation).

**Modules:** `lgpd-policy` (SGD), deploy gates (scripts/preflight-secrets-check.sh)

**Estimated Effort:** S (3 days; mostly documentation)

---

## 3. Phase-to-Compliance Mapping

**Phases delivering the largest compliance jumps:**

| Phase | Focus | Blocks Improved | Compliance Δ | Critical |
|-------|-------|-----------------|--------------|----------|
| **Phase 0** | RDC blockers (turnos, LGPD, lab-apoio, risks skeleton) | A, C, D, H, J | +3–4 pts | 🔴 YES (RDC Art. 36–39, 77, 122) |
| **Phase 1** | LGPD full + indicators skeleton | A, D, J | +1–2 pts | 🟡 Medium |
| **Phase 4** | CAPA closure + risk mgmt full | A, D | +2–3 pts | 🔴 YES (auditor interaction) |
| **Phase 5** | Patient portal + critical review | G | +3–4 pts | 🟡 Medium |
| **Phase 6** | Collection + transport + critical values | E, G | +2–3 pts | 🟡 Medium |
| **Phase 7** | Reclamações trending + satisfaction | D | +1–2 pts | 🟡 Low |
| **Phase 8** | NOTIVISA + tecnovigilância | G, H | +2–3 pts | 🟡 Medium |
| **Phase 9** | Documentation hardening (Personnel full, SGD MQ, audit cycle, PGRSS, calibração, biossegurança) | A, B, C, D, G, H, I | +6–8 pts | 🔴 YES (Phase 9 is the documentation blockbuster) |
| **Phase 10** | Method validation + CEQ + maintenance | F, H | +2–3 pts | 🟡 Low |
| **Phase 12** | Indicators full + improvement plans | D | +1–2 pts | 🟡 Low |
| **Phase 13** | Pre-audit + management review planning | A, D | +1–2 pts | 🟡 Low |

**Lower Bound Scenario (Phase 4 delayed 2 weeks):**
- Skip Phase 4 auditor interaction; proceed with available CAPAs.
- Result: ~86% (miss management review feedback loop + some risk controls).
- Still audit-ready but weaker governance story.

**Upper Bound Scenario (all phases on-time + Phase 10 multi-instrument):**
- All gaps closed + stretch goals (Phase 9 well-being, Phase 10 equipment comparability).
- Result: ~92%.
- Premium standing, defensible to external auditors.

---

## 4. Recommended Prioritization for v1.4

### Tier 1: RDC Blockers (Must-Have — Phase 0)

1. **`lab-apoio` (NEW-H1)** — Support lab contracts (Arts. 36–39)
2. **`turnos` supervisor presence** — Shift supervision (Art. 122)
3. **`lgpd-policy` skeleton** — Privacy policy (Art. 77)
4. **`risks` skeleton** — Risk management framework (ADR-0009)

**Timeline:** Days 1–7 of v1.4 execution. Cannot defer; inspector will ask.

**Compliance Impact:** +3–4 pts immediately.

### Tier 2: Critical Path Dependencies (Phase 1–4)

5. **CAPA Closure (Phase 4)** — 12 findings verification with auditor RFI
6. **Personnel Dossiè skeleton (Phase 0) + full (Phase 9)** — Unified employee records (5.1.9)
7. **LGPD policy finalization (Phase 1)** + deploy gate active (ADR-0018)
8. **Indicators dashboard MVP (Phase 1)** — Quality KPIs tracking

**Timeline:** Weeks 1–8.

**Compliance Impact:** +3–4 pts (Phase 4 auditor success critical).

### Tier 3: High-Impact Delivery (Phase 5–9)

9. **Patient Portal MVP (Phase 5)** — Report release authorization + download
10. **Critical Values escalation (Phase 6)** — SMS/email alert + SLA
11. **Internal Audit Cycle (Phase 9, NEW-D1)** — Formal inspection checklist
12. **Documentation Blitz (Phase 9)** — Quality Manual, Personnel full, SGD compliance audit, calibration SOP, biossegurança
13. **NOTIVISA integration (Phase 8)** — Regulatory reporting (Portaria 204)
14. **PGRSS (Phase 9)** — Waste disposal tracking (RDC 222/2018)

**Timeline:** Weeks 4–11.

**Compliance Impact:** +6–8 pts (Phase 9 alone = +4–5 pts due to documentation volume).

### Tier 4: Refinement (Phase 10–13)

15. **Method Validation templates (Phase 10)** — CLSI compliance
16. **Measurement Uncertainty calculator (Phase 10)** — Analytical precision
17. **Management Review automation (Phase 13)** — Data aggregation + board sign-off
18. **Pre-audit internal (Phase 13)** — DICQ checklist + remediation runs

**Timeline:** Weeks 12–19.

**Compliance Impact:** +2–3 pts.

---

## 5. Effort & Timeline Summary

| Effort Tier | Phases | Est. Duration | Compliance Δ | Blockers |
|-------------|--------|----------------|--------------|----------|
| **Small (1–3 days each)** | 0 (partial), 1, 10, 12, 13 | 3–4 weeks | +5–6 pts | Phase 0 must start immediately |
| **Medium (1–2 weeks each)** | 0 (full), 4, 5, 6, 7, 8, 9 (partial), 13 | 8–10 weeks | +8–10 pts | Phase 4 auditor RFI timing unpredictable |
| **Large (2–3 weeks)** | 9 (full), 3 (if refactor needed) | 6–8 weeks | +4–5 pts | Phase 9 documentation scope must be tightly scoped |

**Total v1.4 Runway:** 19 weeks (mid-May → end of September)

**External Audit Window:** October 15–31, 2026

**Buffer:** 2 weeks post-Phase 13 for remediation if audit finds gaps

---

## 6. Top 5 Quick-Win Opportunities (Under 1 week, +8 pts)

| Opportunity | Block | Phase | Effort | ROI | Deliverable |
|-------------|-------|-------|--------|-----|-------------|
| **LGPD Policy Document** | J | 0–1 | 1 day | High | Template in SGD + RDC Art. 77 compliance statement |
| **Lab Apoio Contract Template** | H | 0 | 2 days | High | 6-clause contract + legal checklist |
| **Risks FMEA Skeleton** | D | 0 | 2 days | High | Matrix template (P×S×D, NPR calc) + instructions |
| **Legal Docs Capture Module** | A | 0 | 1 day | Medium | Upload form + expiry alerts (CNES, permits, licenses) |
| **Supervisor Presence Registry** | C | 0 | 2 days | High | Shift log (date, supervisor, sign-off) — RDC Art. 122 |

**Cumulative Effort:** ~8 days (1 week sprint)

**Projected Compliance Gain:** +3–4 pts (78.5% → 82%)

**When:** Phase 0 (immediate)

---

## 7. Key Risks to 85%+ Target

| Risk | Phase(s) | Probability | Impact | Mitigation |
|------|----------|-------------|--------|-----------|
| **Phase 4 Auditor RFI delays** (CAPA closure feedback loop) | 4 | 🟡 Medium (40%) | 🔴 High (−2 pts) | Weekly async gate + pre-scheduled calls. Parallelize with Phase 5. |
| **Phase 9 scope creep** (50+ governance docs) | 9 | 🟡 Medium (50%) | 🟠 Medium (−3 pts) | Lock scope to DICQ-essential items only. Pre-review templates. |
| **Personnel Dossiè data migration** (records scattered) | 0, 9 | 🟠 Medium–High (60%) | 🔴 High (−4 pts) | Phase 0: Design backfill job. Phase 9: Execute with data quality audit. |
| **Phase 0 RDC blocker slippage** (4 items in 7 days) | 0 | 🟡 Medium (30%) | 🔴 High (audit-ready threshold missed) | Double-assign Phase 0. Pre-draft templates week before Phase 0 start. |
| **NOTIVISA gov API rate-limits** (Phase 8 integration) | 8 | 🟢 Low (20%) | 🟠 Medium (−1 pt) | Contact gov API team early. Implement queue + retry logic. |

**Overall Confidence:** 🟡 **Medium (75% prob of 85%+)**
- High confidence blocks: B, F, G, J (all >90% likely)
- Medium confidence blocks: A, D, H (all 60–80% likely)
- Risk blocks: C (data migration), D (auditor timing)

---

## 8. Recommended Go/No-Go Gate for v1.4

**Before Phase 1 starts (Week 2):**

- [ ] Phase 0 complete: RDC blockers (lab-apoio, turnos, lgpd-skeleton, risks-skeleton) shipped to staging
- [ ] Compliance score verified: ~82% (78.5% + Phase 0 +3.5%)
- [ ] CAPA closure plan agreed with auditor (Phase 4 timeline locked)
- [ ] Personnel Dossiè data migration plan designed (Phase 0/9 owners assigned)
- [ ] Phase 9 scope locked (governance docs + certifications + audit cycle — no stretch beyond DICQ 4.3)

**If any gate fails:** Defer Phase 1 start 1 week. Compress Phase 9 scope.

---

## Conclusion

HC Quality is **75% likely to reach 85%+ DICQ compliance by October 2026**. Success depends on:

1. **Phase 0 (RDC blockers)** — Non-negotiable; week 1
2. **Phase 4 (CAPA auditor interaction)** — Critical path; weeks 5–8
3. **Phase 9 (documentation blitz)** — Highest volume; must stay scoped; weeks 8–11

The compliance roadmap is clear. Execution discipline is the bottleneck.

**For external audit readiness:** Target **88%** (stretch) but floor at **85%** (comfortable margin above 75% baseline). This positions HC Quality in the top quartile for lab accredia systems.

---

**Prepared by:** Compliance Research (R3)  
**Date:** 2026-05-07  
**Status:** Ready for Phase 0 kickoff
