---
title: Phase 13 — DICQ Final Audit & Compliance Closure
subtitle: Detailed Execution Plan (1.5 weeks)
version: 1.0
created: 2026-05-07
milestone: v1.4 Wave 4
audit_target: 2026-10-15
compliance_baseline: 78.5% (v1.3)
compliance_target: ≥88% (v1.4)
---

# Phase 13 — DICQ Final Audit & Compliance Closure

## Executive Overview

**Objective:** Close all remaining DICQ gaps identified in v1.4, achieve ≥88% conformance, and produce audit-ready evidence package before external DICQ/SBAC auditor visit (target October 2026).

**Timeline:** 10 working days (1.5 weeks) — assume Phases 0–12 complete and documented

**Success Criteria:**
1. ✅ Block-by-block DICQ audit confirms ≥88% conformance (vs. baseline 78.5%)
2. ✅ Evidence collection complete (screenshots, PDFs, audit trail exports)
3. ✅ RDC 978 mandatory articles 100% addressed
4. ✅ Auditor briefing materials ready (module changes, compliance map, known gaps)
5. ✅ Compliance snapshot JSON for metrics dashboard
6. ✅ Remediation plan finalized (P0 immediate, P1 defer to v1.4.1)
7. ✅ Pre-approval call preparation complete

**Owners:**
- **Compliance Lead:** Phase 13 orchestrator (15 hrs/week)
- **Module Leads:** Evidence collection + spot-check verification (10 hrs each)
- **QA Lead:** Test case execution + screenshot capture (20 hrs)
- **IT/DevOps:** Log exports, audit trail queries (5 hrs)
- **RT (Responsável Técnico):** Sign-off on all deliverables

---

## 1. Block-by-Block DICQ Audit Checklist

### Purpose
Confirm v1.4 coverage against all 10 DICQ blocks (A–J) using live system. Identify any residual gaps and assign to Phase 14 or v1.4.1.

### Methodology
- **Manual + Automated:** Screenshots + exports from production/staging
- **Data validation:** Spot-check 5–10 records per module
- **Audit trail review:** HMAC signatures, timestamps, operator IDs
- **Rule verification:** Firestore rules compliance audit (existing ADRs 0005, 0012)

---

### Block A: Governança & Direção (78% → 92% Target)

#### A.1 Pessoa Jurídica (4.1.1.2)
**Requirement:** CNES, operational permits, council registrations documented and current.
**v1.4 Implementation:** `labSettings/legal-docs` module (NEW-A1)
**Audit Steps:**
1. [ ] Navigate to `labSettings` → Legal Documents section
2. [ ] Verify all 4 required docs present: CNES, Alvará, Conselho, CNPJ
3. [ ] Check expiry dates; alert system active for 30-day warnings
4. [ ] Export audit log: doc upload timestamps, uploader identity, change history
5. [ ] Screenshot: legal docs list + metadata panel
6. **Evidence:** `evidence/A1-legal-docs-screenshot.png`, `evidence/A1-legal-docs-audit-log.json`

#### A.2 Norteadores + Código Ética (4.1.1.3, 4.1.2.3, 4.1.2.4)
**Requirement:** Mission, Vision, Values, Ethics Code, Quality Policy published and accessible.
**v1.4 Implementation:** `governance/norteadores` in SGD (Phase 9 + Phase 13)
**Audit Steps:**
1. [ ] Open SGD module → Governance section
2. [ ] Verify all 5 documents present and versioned:
   - Missão
   - Visão
   - Valores
   - Código de Ética
   - Política da Qualidade
3. [ ] Check approval status: all marked "Approved" with RT signature
4. [ ] Verify distribution log: all staff have read confirmation (if required)
5. [ ] Export version history for each doc (timestamp, author, change notes)
6. [ ] Screenshot: Governance docs list + version metadata
7. **Evidence:** `evidence/A2-governance-docs-list.png`, `evidence/A2-governance-version-history.json`

#### A.3 Designações Formais (4.1.1.4, 4.1.2.5, 4.1.2.7)
**Requirement:** Lab Director, QA Manager, substitutes formally designated and documented.
**v1.4 Implementation:** `personnel/designacoes` (Phase 9) + `personnel/org-chart`
**Audit Steps:**
1. [ ] Navigate to `personnel/designacoes`
2. [ ] Verify all role designations present:
   - Lab Director (name, date, RT signature)
   - QA Manager (name, date, RT signature)
   - Supervisor designations (per shift, if applicable)
   - Substitutes for each (with delegation authority dates)
3. [ ] Check document signatures: HMAC chain intact
4. [ ] Export org chart with substitutes (PDF or JSON)
5. [ ] Verify each role has linked job description in SGD
6. [ ] Screenshot: org chart + designations
7. **Evidence:** `evidence/A3-org-chart-screenshot.png`, `evidence/A3-designacoes-audit-trail.json`

#### A.4 Análise Crítica da Direção (4.15)
**Requirement:** Formal management review with 15 mandatory inputs (complaints, NC, CAPA, audits, training, resources, risks, indicators, changes, compliance, etc.)
**v1.4 Implementation:** `management-review` module (Phase 13 + Phase 14)
**Audit Steps:**
1. [ ] Navigate to `management-review` dashboard
2. [ ] Verify management review template configured with all 15 inputs:
   - [ ] Auditoria interna findings + trends
   - [ ] Non-conformities (count, origin, closure rate)
   - [ ] CAPA status (open/closed, efficacy)
   - [ ] Complaint summary (intake, closure, trending)
   - [ ] Training completion (% staff, topics, efficacy)
   - [ ] Equipamentos status (maintenance, calibration alerts)
   - [ ] Riscos management (matrix updates, control effectiveness)
   - [ ] Indicadores (KPIs vs. targets, trends)
   - [ ] Requisitos novos (regulatory changes, legal updates)
   - [ ] Resultado de auditorias externas (if applicable)
   - [ ] Recursos adequados (budget, staffing, infrastructure)
   - [ ] Satisfação de clientes (NPS, feedback summary)
   - [ ] Sugestões pessoal (upvotes, trending)
   - [ ] Conformidade legislativa (RDC 978, DICQ, LGPD)
   - [ ] Mudanças de processo/documentação
3. [ ] Verify auto-aggregation logic active (pull from linked modules)
4. [ ] Check latest management review meeting:
   - [ ] Date scheduled
   - [ ] Attendees (RT, QA Manager, lab director, key staff)
   - [ ] Minutes/ata generated (approved, signed)
   - [ ] Action items assigned + follow-up dates
5. [ ] Verify cycle frequency (annual at minimum; quarterly preferred)
6. [ ] Export management review template + latest ata (PDF)
7. **Evidence:** `evidence/A4-management-review-template.json`, `evidence/A4-latest-management-review-ata.pdf`

#### Block A Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| A.1 Legal docs | 🔴 Missing | NEW-A1 module screenshot + log | [ ] | Expiry alert active? |
| A.2 Norteadores | 🔴 Missing | SGD governance list + versions | [ ] | All 5 docs approved? |
| A.3 Designações | 🟡 Partial | Org chart + designacoes + signatures | [ ] | Substitutes documented? |
| A.4 Management Review | 🔴 Missing | Template + 15-point checklist + latest ata | [ ] | Auto-aggregation working? |

**Target Coverage:** 92% (was 78%) = **+14 pts**
**Projected Pass Rate:** 🟡 Medium (85%+) — depends on Phase 9/13 completion

---

### Block B: Gestão Documental / SGD (65% → 92% Target)

#### B.1 Manual da Qualidade (4.2.2.2)
**Requirement:** ISO 15189-aligned Quality Manual with scope, roles, procedures, clinical requirements.
**v1.4 Implementation:** `docs/manual-qualidade` (Phase 9) in SGD
**Audit Steps:**
1. [ ] Open SGD → Governance → Manual da Qualidade
2. [ ] Verify document structure (ISO 15189 template):
   - [ ] 4.1 — Laboratório information (name, director, location)
   - [ ] 4.2 — Scope of services (analytes, sample types, equipment)
   - [ ] 4.3 — Reference to procedures (PQs, ITs, FRs)
   - [ ] 4.4 — Roles & responsibilities (linked to org chart)
   - [ ] 4.5 — Quality objectives + improvement plan
   - [ ] 4.6 — Document control (refer to Lista Mestra)
   - [ ] 4.7 — DICQ compliance statement (self-assessment)
   - [ ] 4.8–4.14 — Key processes (pre/analytic/post, audit, NC, CAPA, risks)
   - [ ] 4.15 — Management review frequency
   - [ ] Appendices (lab layout, equipment list, personnel structure)
3. [ ] Check approval: RT signature + date
4. [ ] Verify version control: v1.0, v1.1, etc. with change log
5. [ ] Spot-check 3 procedure references (link to actual PQ in SGD)
6. [ ] Export PDF version with version seal
7. **Evidence:** `evidence/B1-manual-qualidade.pdf` (with version metadata)

#### B.2 Lista Mestra Hierárquica (4.3)
**Requirement:** Master list of all documents (MQ, PQ, IT, FR, POL, POPs) with version, status, distribuição.
**v1.4 Implementation:** `sgd/lista-mestra` (Phase 3 + Phase 9)
**Audit Steps:**
1. [ ] Navigate to SGD → Lista Mestra
2. [ ] Verify all documents categorized and listed:
   - [ ] MQ (Manual Qualidade) — 1 doc
   - [ ] PQ (Procedures) — count, sample 3
   - [ ] IT (Instructions) — count, sample 3
   - [ ] FR (Forms/Records) — count, sample 3
   - [ ] POL (Policies) — count, sample 3
   - [ ] POPs (Standard Operating Procedures) — count, sample 3
3. [ ] Check status tracking for each doc:
   - [ ] Draft | Approved | Obsolete
   - [ ] Version (v1.0, v1.1, etc.)
   - [ ] Approval date + approver
   - [ ] Last review date
   - [ ] Next review date
4. [ ] Verify distribution log:
   - [ ] Distributed to: [roles/departments]
   - [ ] Date received (read confirmation required?)
   - [ ] Change history (replacements, updates)
5. [ ] Spot-check 5 random documents: verify actual doc in SGD matches master list entry
6. [ ] Check obsolescence tracking: old versions marked obsolete + disposal plan
7. [ ] Export master list as Excel/CSV
8. **Evidence:** `evidence/B2-lista-mestra-full-export.csv`, `evidence/B2-lista-mestra-screenshot.png`

#### B.3 Controle de Documentos Eletrônicos (4.3)
**Requirement:** Electronic docs have version seal (PDF), download audit log, secure distribution with receipt.
**v1.4 Implementation:** SGD upgrade (Phase 3) + email integration (Phase 9)
**Audit Steps:**
1. [ ] Open a sample document in SGD (e.g., MQ or a PQ)
2. [ ] Verify PDF download includes:
   - [ ] Version stamp (v1.0, date, author)
   - [ ] Document hash (integrity check)
   - [ ] Footer with "Controlled document — distribution restricted"
   - [ ] QR code linking to live version (if implemented)
3. [ ] Check download audit log:
   - [ ] Each download recorded (timestamp, user ID, IP)
   - [ ] Export log for last 30 days
4. [ ] Verify distribution workflow:
   - [ ] Document marked "Distributed to: [role list]"
   - [ ] Email sent with read receipt request (if enabled)
   - [ ] Recipient confirmation captured
5. [ ] Spot-check 3 distributions: verify email + receipt in audit trail
6. [ ] Verify obsolete docs: marked as obsolete, hidden from navigation, replaced by new version link
7. [ ] Export download audit log
8. **Evidence:** `evidence/B3-document-download-audit.json`, `evidence/B3-sealed-pdf-sample.pdf`

#### Block B Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| B.1 Manual Qualidade | 🔴 Missing | PDF + metadata | [ ] | All 10 sections complete? |
| B.2 Lista Mestra | 🟡 Partial | CSV export + screenshot | [ ] | Obsolescence tracking works? |
| B.3 Controle Eletrônico | 🟡 Partial | PDF seal sample + download audit log | [ ] | Distribution receipts captured? |

**Target Coverage:** 92% (was 65%) = **+27 pts** ⭐ HIGHEST SINGLE JUMP
**Projected Pass Rate:** ✅ High (90%+) — SGD foundation solid

---

### Block C: Pessoal (80% → 92% Target)

#### C.1 Dossiê Unificado (5.1.9) — CRITICAL PATH
**Requirement:** One source of truth per employee: qualifications, training, competencies, performance, biosecurity.
**v1.4 Implementation:** `personnel/dossie` (Phase 1 skeleton + Phase 9 full)
**Audit Steps:**
1. [ ] Navigate to `personnel` → Dossiê de Colaboradores
2. [ ] Select 3 random employees; verify each has complete dossiê with:
   - [ ] **Qualificação:** CV, professional licenses (CREA, CNAS, etc.), registration numbers, expiry dates
   - [ ] **Treinamentos:** EC records with dates, topics, trainers, attendance, pós-testes (efficacy)
   - [ ] **Competência:** Assessment forms (post-training checklist), approval status
   - [ ] **Desempenho:** Annual performance reviews (feedback, scores, goals)
   - [ ] **Biossegurança:** Vaccination records, PPE assignments, NR-32 training, exposure incident log
   - [ ] **Saúde/Segurança:** Occupational health assessments, incident reports
3. [ ] Spot-check data integrity:
   - [ ] No gaps (empty sections indicate incomplete migration from v1.3)
   - [ ] Dates are logical (training before competency assessment; assessments before performance review)
   - [ ] Signatures/approvals present for each section
4. [ ] Verify access control: only HR + RT can view full dossiè
5. [ ] Check audit trail: all changes logged with timestamp + modifier identity
6. [ ] Export 1 complete dossiè (PDF) as evidence
7. **Evidence:** `evidence/C1-dossie-sample-employee.pdf`, `evidence/C1-dossie-completeness-audit.json`
**Risk Assessment:**
- 🟡 **Data Migration Risk:** v1.3 records may be incomplete. Phase 1 backfill should have filled gaps.
  - If >10% of dossiês have missing EC records: mark as 🟡 Partial
  - If <10%: mark as ✅ Covered

#### C.2 Política de Pessoal (5.1.1)
**Requirement:** Formal personnel management policy (recruitment, training, development, performance, wellbeing).
**v1.4 Implementation:** `docs/personnel-policy` in SGD
**Audit Steps:**
1. [ ] Open SGD → Policies → Personnel Policy
2. [ ] Verify policy structure (10–20 pages, covering):
   - [ ] Recruitment + onboarding process
   - [ ] Qualification requirements per role
   - [ ] Continuous education (EC) program + frequency requirements
   - [ ] Competency assessment + post-training verification
   - [ ] Performance review cycle (frequency, evaluation criteria)
   - [ ] Career development + promotion criteria
   - [ ] Compensation + benefits (if applicable)
   - [ ] Occupational health + safety (NR-32 compliance)
   - [ ] Conflict resolution + well-being support
   - [ ] Whistleblower protection (LGPD right to report)
3. [ ] Check approval: RT + Lab Director signature
4. [ ] Verify version control: dates, change notes
5. [ ] Confirm distribution: accessible to all staff
6. [ ] Export policy PDF
7. **Evidence:** `evidence/C2-personnel-policy.pdf`

#### C.3 Designações de Cargos & Substitutos (4.1.2.5, 4.1.2.7)
**Requirement:** Job descriptions with authority limits, responsibilities, substitutes during absence.
**v1.4 Implementation:** `personnel/cargos` + `personnel/designacoes`
**Audit Steps:**
1. [ ] Open `personnel/cargos` (Cargo Descriptions)
2. [ ] Verify all critical roles have detailed descriptions:
   - [ ] Lab Director
   - [ ] QA Manager
   - [ ] Supervisor (per shift if applicable)
   - [ ] Lead Technician (per module: Hematology, Coagulation, Biochemistry, etc.)
   - [ ] Sample Reception Technician
3. [ ] Each description includes:
   - [ ] Authority limits (e.g., "Can approve CAPAs up to 90 days")
   - [ ] Reporting line
   - [ ] Key responsibilities (20+ items per role)
   - [ ] Educational requirements
   - [ ] Professional qualifications required
4. [ ] Verify substitutes: each role has named backup(s) with delegation dates
5. [ ] Check org chart consistency: matches personnel/designacoes
6. [ ] Export job descriptions + org chart
7. **Evidence:** `evidence/C3-job-descriptions.pdf`, `evidence/C3-org-chart-with-subs.json`

#### C.4 Avaliação de Competência & Desempenho (5.1.6, 5.1.7, 5.1.8)
**Requirement:** Post-training assessment + annual performance review + EC efficacy measurement.
**v1.4 Implementation:** `personnel/competencia` (upgraded) + EC extension
**Audit Steps:**
1. [ ] Open `personnel/competencia` (Competency Assessments)
2. [ ] Sample 3 employees with recent training:
   - [ ] Verify post-training assessment within 30 days of training
   - [ ] Assessment format: practical + written (if applicable)
   - [ ] Pass/Fail result + date
   - [ ] If failed: remediation plan + reassessment date
3. [ ] Check EC module for training efficacy:
   - [ ] Each training record linked to competency assessment
   - [ ] Results (pass/fail) captured
   - [ ] Non-pass employees excluded from unsupervised work (if policy-required)
4. [ ] Verify annual performance reviews:
   - [ ] All staff have at least 1 review in last 12 months
   - [ ] Review form includes: goals, feedback, scores, development plan
   - [ ] RT or director approval
5. [ ] Spot-check data: review dates align with hiring dates + anniversary
6. [ ] Export competency assessment records (last 6 months sample)
7. **Evidence:** `evidence/C4-competency-assessments-sample.json`, `evidence/C4-performance-reviews-sample.json`

#### Block C Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| C.1 Dossiê unificado | 🔴 Missing | Sample dossiê (PDF) + completeness audit | [ ] | Data migration >90% complete? |
| C.2 Política Pessoal | 🔴 Missing | Policy PDF + approval | [ ] | All 10 sections covered? |
| C.3 Designações/Cargos | 🟡 Partial | Job descriptions + org chart + substitutes | [ ] | All critical roles have subs? |
| C.4 Competência/Desempenho | 🔴 Missing | Competency assessments + performance reviews | [ ] | EC linked to assessment? |

**Target Coverage:** 92% (was 80%) = **+12 pts**
**Projected Pass Rate:** 🟡 Medium (75%+) — data migration is key dependency

---

### Block D: Qualidade & Compliance Operacional (60% → 85% Target)

#### D.1 Gestão de Riscos FMEA-Lite (4.14.6)
**Requirement:** Probability × Severity × Detection matrix (NPR 1–125), controls, monitoring, annual review.
**v1.4 Implementation:** `risks` module (Phase 0 skeleton + Phase 4 full)
**Audit Steps:**
1. [ ] Open `risks` module
2. [ ] Verify FMEA matrix configured:
   - [ ] 5×5 scale: Probability (1–5), Severity (1–5), Detection (1–5)
   - [ ] NPR calculation: P × S × D (range 1–125)
   - [ ] At least 20 process risks identified (sample: specimen handling, analyzer maintenance, result review, data integrity, etc.)
3. [ ] Spot-check 3 risks; verify for each:
   - [ ] Potential failure mode (description)
   - [ ] Effects on quality/patient safety
   - [ ] Current controls (existing SOPs, checks, training)
   - [ ] NPR score
   - [ ] Action plan (if NPR > 40: reduce P, S, or D)
   - [ ] Action owner + due date
   - [ ] Effectiveness verification (before/after scores)
4. [ ] Check review cycle: annual minimum (documented in management review)
5. [ ] Verify linkage to CAPA: high-risk items (NPR > 60) have corrective action plan
6. [ ] Export risk register (full matrix)
7. **Evidence:** `evidence/D1-risk-register-fmea.json`, `evidence/D1-risk-matrix-screenshot.png`

#### D.2 Auditoria Interna (4.14.5) — NEW-D1
**Requirement:** Formal internal audit cycle with DICQ checklist, findings, NC linkage, trending.
**v1.4 Implementation:** `auditoria-interna` module (Phase 9)
**Audit Steps:**
1. [ ] Open `auditoria-interna` module
2. [ ] Verify audit program structure:
   - [ ] Annual audit plan (schedule per DICQ block: A–J)
   - [ ] DICQ checklist template per block (40–50 yes/no questions)
   - [ ] Audit frequency (all areas covered ≥1× per year)
3. [ ] Review latest internal audit (if Phase 9 complete):
   - [ ] Date of audit
   - [ ] Auditors (names, qualifications)
   - [ ] Scope (blocks/departments covered)
   - [ ] Checklist results (compliance %, non-conformities)
   - [ ] Findings (categorized as Major/Minor/Observation)
   - [ ] NC linkage: findings create non-conformities in NC module
   - [ ] Action plans assigned + due dates
4. [ ] Spot-check finding tracking:
   - [ ] Verify 3 NC items trace to audit finding
   - [ ] Closure verified by auditor re-check (if applicable)
5. [ ] Trend analysis:
   - [ ] Audit trend (compliance improving/stable/declining)
   - [ ] Top 3 finding types (category analysis)
6. [ ] Export audit schedule + latest audit report (PDF)
7. **Evidence:** `evidence/D2-audit-checklist-template.json`, `evidence/D2-latest-audit-report.pdf`

#### D.3 Indicadores de Qualidade (4.12, 4.14.7)
**Requirement:** KPIs for pre/analytic/post with targets, trends, SLA tracking.
**v1.4 Implementation:** `indicators` module (Phase 1 + Phase 12)
**Audit Steps:**
1. [ ] Open `indicators` dashboard
2. [ ] Verify KPI coverage (minimum 15 KPIs across phases):
   - **Pre-analytic:** Collection time to analysis, sample rejection rate (%), retest rate (%)
   - **Analytic:** Turnaround time per test, CIQ compliance (%), analyzer downtime (%)
   - **Post-analytic:** Critical value notification time (hrs), report release delay (%), patient complaints (count)
   - **Quality:** NC per month (count), CAPA closure rate (%), training compliance (%), audit findings (count)
   - **Operational:** Equipment availability (%), staff sick leave (%), customer satisfaction (NPS)
3. [ ] For each KPI, verify:
   - [ ] Target value (goal, e.g., "< 2 hrs turnaround for priority tests")
   - [ ] Actual vs. target (current month + trend)
   - [ ] Data source (automated pull from modules or manual entry?)
   - [ ] Frequency (daily, weekly, monthly)
   - [ ] Escalation (if KPI misses target: alert owner, trigger CAPA)
4. [ ] Check trending data:
   - [ ] Last 6 months of data visible
   - [ ] Trending line/graph (improving/stable/declining)
5. [ ] Verify management review link:
   - [ ] KPIs feed into management review (auto-aggregation or manual?)
6. [ ] Export KPI dashboard (screenshot + data export)
7. **Evidence:** `evidence/D3-indicators-dashboard-screenshot.png`, `evidence/D3-kpi-data-export.csv`

#### D.4 Gestão de Não-Conformidades (4.9)
**Requirement:** NC identification, root cause analysis, trending, linkage to CAPA.
**v1.4 Implementation:** Existing module (maintenance) + integration to auditoria-interna + indicators
**Audit Steps:**
1. [ ] Open `non-conformidades` (or `capa` module's NC tab)
2. [ ] Sample 5 recent NCs (last 30 days):
   - [ ] Source identified (audit, customer complaint, internal check, test failure, etc.)
   - [ ] Description clear
   - [ ] Severity (Major/Minor)
   - [ ] Root cause analysis (performed or pending?)
   - [ ] Immediate action (containment)
   - [ ] Assigned to CAPA (Yes/No; if major, must have CAPA)
   - [ ] Closure date + approver
3. [ ] Verify NC trending:
   - [ ] Count by month (last 6 months visible)
   - [ ] Distribution by source (audit vs. complaint vs. internal)
   - [ ] Top 3 NC categories
4. [ ] Check closure compliance:
   - [ ] Major NC: closed within 30 days (RDC-standard)?
   - [ ] Minor NC: closed within 60 days?
5. [ ] Export NC register (last 6 months sample)
6. **Evidence:** `evidence/D4-nc-register-sample.json`, `evidence/D4-nc-trending.png`

#### Block D Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| D.1 FMEA-Lite Riscos | 🔴 Missing | Risk register matrix (JSON) | [ ] | 20+ risks identified? NPR >40 has action? |
| D.2 Auditoria Interna | 🔴 Missing | Audit checklist + latest report | [ ] | Annual plan in place? Findings NC-linked? |
| D.3 Indicadores | 🔴 Missing | Dashboard screenshot + KPI data | [ ] | 15+ KPIs with targets? Trending visible? |
| D.4 NC (maintenance) | ✅ Existing | NC trending + closure audit | [ ] | Major NC closed <30d? |

**Target Coverage:** 85% (was 60%) = **+25 pts** ⭐ SECOND-HIGHEST JUMP
**Projected Pass Rate:** 🟡 Medium (70%+) — depends on Phase 4 (CAPA closure) + Phase 9 (auditoria-interna) completion

---

### Block E: Pré-Analítico (64% → 75% Target)

#### E.1 Coleta (5.4.4)
**Requirement:** Collection instructions, collector ID, barcode, photo proof, acceptance criteria.
**v1.4 Implementation:** `coleta` module (Phase 6)
**Audit Steps:**
1. [ ] Open `coleta` module
2. [ ] Verify collection SOP accessible:
   - [ ] General instructions (patient prep, timing, tube type, volume, etc.)
   - [ ] Per-test instructions (specific blood tube for each analyte group)
3. [ ] Check mobile collection form:
   - [ ] Sample ID (barcode auto-generated)
   - [ ] Collector name/ID
   - [ ] Collection date/time
   - [ ] Patient information (ID, name, age)
   - [ ] Sample type + tube code
   - [ ] Photo attachment (evidence of collection)
   - [ ] Signature or thumb print (if paper-based + mobile capture)
4. [ ] Spot-check 3 recent collections:
   - [ ] All fields filled
   - [ ] Photo present + timestamp matches collection time
   - [ ] Barcode readable + matches sample ID
5. [ ] Verify acceptance criteria configured:
   - [ ] Hemolyzed sample → reject
   - [ ] Insufficient volume → calculate threshold per test
   - [ ] Clotted sample → reject (if anticoagulant required)
   - [ ] Contamination signs → reject
6. [ ] Check rejection workflow:
   - [ ] Auto-NC created upon rejection
   - [ ] Collector notified (SMS/email)
   - [ ] Recollection ordered
7. [ ] Export collection sample records + photos
8. **Evidence:** `evidence/E1-coleta-mobile-form-screenshot.png`, `evidence/E1-coleta-sample-records.json`

#### E.2 Transporte (5.4.5)
**Requirement:** Transport time limits, temperature monitoring, integrity checks, delivery confirmation.
**v1.4 Implementation:** `transporte-amostras` + `controle-temperatura` integration (Phase 6)
**Audit Steps:**
1. [ ] Open `transporte-amostras` module
2. [ ] Verify transport SOP:
   - [ ] Maximum time from collection to analysis (e.g., 4 hrs for most analytes)
   - [ ] Temperature requirements per analyte
   - [ ] Container type (insulated, with ice packs, etc.)
   - [ ] Contingency if transport time exceeded (re-collect or mark result with caveat)
3. [ ] Check temperature monitoring:
   - [ ] IoT sensor data from `controle-temperatura`
   - [ ] Alert thresholds configured (e.g., 2–8°C for refrigerated samples)
   - [ ] If temperature excursion: alert triggered + linked to NC
4. [ ] Spot-check 3 transports:
   - [ ] Pickup time + delivery time
   - [ ] Transport log: vehicle, driver, route
   - [ ] Temperature data (if cold chain): min/max/avg during transport
   - [ ] Delivery confirmation (receiver signature or electronic acknowledgment)
   - [ ] Any excursions noted + action taken
5. [ ] Verify integration to analysis:
   - [ ] If delivery time >SLA: result flagged "delayed transport" for RT review
   - [ ] If temperature excursion: result flagged "cold chain break" for assessment
6. [ ] Export transport log (last 30 days sample)
7. **Evidence:** `evidence/E2-transport-log-sample.json`, `evidence/E2-temperature-excursion-sample.png`

#### Block E Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| E.1 Coleta | 🔴 Missing | Mobile form screenshot + sample records | [ ] | Photos captured? Rejection criteria implemented? |
| E.2 Transporte | 🔴 Missing | Transport log + temperature data | [ ] | Cold chain monitored? SLA alerts active? |

**Target Coverage:** 75% (was 64%) = **+11 pts**
**Projected Pass Rate:** 🟡 Medium (75%+) — operational, depends on Phase 6 delivery

---

### Block F: Analítico (92% → 95% Target)

#### F.1 Validação de Métodos (5.5.1.3)
**Requirement:** CLSI-based validation for non-standard or modified analytical methods.
**v1.4 Implementation:** `validacao-metodos` templates in SGD (Phase 10)
**Audit Steps:**
1. [ ] Open SGD → Procedures → Method Validation Templates
2. [ ] Identify all "non-standard" methods in lab (custom assays, home-brew, modified procedures)
3. [ ] For each non-standard method, verify in SGD:
   - [ ] Validation report exists (template filled or custom document)
   - [ ] CLSI EP standard referenced (e.g., EP15 for method comparison)
   - [ ] Analytical parameters assessed: accuracy, precision, linearity, LOD, LOQ, interference, carryover
   - [ ] Clinical utility demonstrated (RI, decision values, etc.)
   - [ ] Approval by RT + QA Manager
4. [ ] Spot-check 2 validation reports:
   - [ ] Data quality (sufficient samples, clear results)
   - [ ] Conclusions supported by data
   - [ ] Limitations clearly stated
5. [ ] Verify version control: updated if method modified
6. [ ] Export validation templates + 2 sample reports
7. **Evidence:** `evidence/F1-method-validation-template.json`, `evidence/F1-validation-report-samples.pdf`

#### F.2 Incerteza de Medição (5.5.1.4)
**Requirement:** Measurement uncertainty calculation per analyte (GUM/CLSI), reported on patient results if applicable.
**v1.4 Implementation:** `incerteza-medicao` calculator + templates (Phase 10)
**Audit Steps:**
1. [ ] Open `incerteza-medicao` module (if deployed) or SGD → Analytical Procedures
2. [ ] Verify measurement uncertainty approach:
   - [ ] GUM (ISO 21748) or CLSI methodology documented
   - [ ] Standard operating procedure for uncertainty estimation
3. [ ] Spot-check 5 analytes (e.g., glucose, total cholesterol, hemoglobin, potassium, creatinine):
   - [ ] Uncertainty value documented (e.g., ± 0.5 mg/dL for glucose)
   - [ ] Calculation method shown
   - [ ] Uncertainty source breakdown (calibration, precision, bias)
   - [ ] Comparison to CLIA/RDC limits (is uncertainty acceptable?)
4. [ ] Check if uncertainty reported to clients:
   - [ ] Patient report includes uncertainty notation (if required)
   - [ ] Clinical interpretation guidance (e.g., "result valid ±0.5 mg/dL")
5. [ ] Verify annual review: uncertainty updated if method/reagent changes
6. [ ] Export uncertainty calculations (sample 5 analytes)
7. **Evidence:** `evidence/F2-uncertainty-calculations.json`, `evidence/F2-patient-report-sample.pdf`

#### F.3 Avaliação Periódica CEQ (5.6.3.4)
**Requirement:** Annual CEQ review with z-score analysis, corrective actions if |z| > 2.
**v1.4 Implementation:** `ceq` module upgraded + auto-reporting (Phase 10)
**Audit Steps:**
1. [ ] Open `ceq` module → Annual Reports
2. [ ] Verify latest CEQ annual report (if Phase 10 complete):
   - [ ] Program(s) participated (e.g., CONTROLLAB, SBAC)
   - [ ] Summary of all z-scores per analyte (last 12 months)
   - [ ] Count of |z| > 2 results (frequency, distribution)
   - [ ] Trend analysis: improving/stable/declining
   - [ ] Corrective actions taken (if |z| > 2):
     - [ ] Root cause investigation
     - [ ] Corrective measure implemented
     - [ ] Re-testing after correction
     - [ ] Closure verification
3. [ ] Spot-check 2 corrective actions:
   - [ ] Root cause reasonable (analyzer calibration, reagent lot, operator error, etc.)
   - [ ] Measure taken appropriate
   - [ ] Re-test result within acceptable range
4. [ ] Verify linkage to management review: CEQ summary in management review (annual)
5. [ ] Check participation records (certificates, participation receipts)
6. [ ] Export CEQ annual report (PDF)
7. **Evidence:** `evidence/F3-ceq-annual-report.pdf`, `evidence/F3-ceq-corrective-actions.json`

#### Block F Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| F.1 Validação Métodos | 🔴 Missing | Template + 2 validation reports (PDF) | [ ] | All non-standard methods validated? |
| F.2 Incerteza Medição | 🔴 Missing | Uncertainty calculations (5 analytes) | [ ] | GUM/CLSI approach documented? |
| F.3 CEQ Annual Review | 🔴 Missing | Annual CEQ report + corrective actions | [ ] | |z| > 2 addressed? |

**Target Coverage:** 95% (was 92%) = **+3 pts** (incremental, block already strong)
**Projected Pass Rate:** ✅ High (95%+) — foundation solid, Phase 10 refinements

---

### Block G: Pós-Analítico & Laudos (70% → 92% Target)

#### G.1 Patient Portal & Liberação (5.7.1, 5.9.1)
**Requirement:** Secure online portal for patient/physician to download results; audit log of access.
**v1.4 Implementation:** `patient-portal` (Phase 5) + `liberacao-laudos` workflow
**Audit Steps:**
1. [ ] Access patient portal (as test user)
2. [ ] Verify authentication:
   - [ ] OAuth login (Google, email, etc.) OR
   - [ ] Email link auth (one-time code sent to registered email)
   - [ ] Password reset workflow secure (if applicable)
3. [ ] Check patient dashboard:
   - [ ] Patient name + ID displayed
   - [ ] List of available reports (date, test name)
   - [ ] Filter/search capability
4. [ ] Download a sample report:
   - [ ] PDF displays correctly
   - [ ] Contains all required fields per RDC (patient ID, test name, result, reference range, units, method, analyst, RT signature, date of release)
   - [ ] Can print or save to device
5. [ ] Verify audit log:
   - [ ] Each download logged: timestamp, user ID, IP, report version
   - [ ] Export download audit log (last 30 days)
6. [ ] Check physician portal (if separate access):
   - [ ] Read-only access to results
   - [ ] No edit capability
   - [ ] Revision history visible (all versions of result)
7. [ ] Verify critical value escalation:
   - [ ] Critical result alert sent to physician (SMS/email)
   - [ ] Timestamp of alert delivery
   - [ ] Acknowledgment captured
8. [ ] Export portal sample screens + audit log
9. **Evidence:** `evidence/G1-portal-login-screenshot.png`, `evidence/G1-download-audit-log.json`, `evidence/G1-report-pdf-sample.pdf`

#### G.2 Valores Críticos (5.7.2)
**Requirement:** Automatic alert for critical values; escalation to physician; SLA tracking (e.g., RT notified <15 min).
**v1.4 Implementation:** `valores-criticos` module (Phase 6)
**Audit Steps:**
1. [ ] Open `valores-criticos` module
2. [ ] Verify critical value thresholds configured per analyte:
   - [ ] Glucose: >400 mg/dL, <40 mg/dL
   - [ ] Potassium: >6.5 mmol/L, <2.5 mmol/L
   - [ ] INR: >6.0
   - [ ] Troponin: >0.04 ng/mL (example)
   - [ ] (Sample for lab; adjust per actual SOP)
3. [ ] Check alert delivery:
   - [ ] SMS to physician on-call (carrier, template message)
   - [ ] Email to RT + Lab Manager
   - [ ] Portal notification (in-app alert)
4. [ ] Verify acknowledgment workflow:
   - [ ] Physician clicks acknowledge button or responds SMS "ACK"
   - [ ] Time to acknowledge recorded
   - [ ] SLA tracked (target: <15 min from result to physician acknowledgment)
5. [ ] Spot-check 3 critical value events (if available in last 30 days):
   - [ ] Alert triggered correctly
   - [ ] Delivery successful
   - [ ] Acknowledgment time within SLA
   - [ ] If SLA missed: escalation to lab director?
6. [ ] Review trend report:
   - [ ] # critical values per month
   - [ ] Common analytes (top 3)
   - [ ] Average time to ack (should trend toward target)
7. [ ] Export critical value log + alert template + SLA report
8. **Evidence:** `evidence/G2-critical-value-log-sample.json`, `evidence/G2-alert-template-screenshot.png`, `evidence/G2-sla-report.csv`

#### G.3 NOTIVISA & Tecnovigilância (5.7.3)
**Requirement:** Reporting of notifiable diseases/adverse events to ANVISA via NOTIVISA system.
**v1.4 Implementation:** `notivisa-outbox` module (Phase 8)
**Audit Steps:**
1. [ ] Open `notivisa-outbox` module
2. [ ] Verify event intake form:
   - [ ] Notifiable disease list (from Portaria 204 MS)
   - [ ] Adverse event type (equipment failure, reagent contamination, staff infection, etc.)
   - [ ] Event details (date, description, patient affected, product lot)
   - [ ] Preliminary assessment (severity, immediate actions taken)
3. [ ] Check workflow:
   - [ ] Event submitted → waiting RT approval
   - [ ] RT review (verify event meets notification criteria)
   - [ ] Approval/rejection documented
   - [ ] If approved: auto-generate NOTIVISA form + submit to gov API
4. [ ] Verify gov API integration:
   - [ ] Connection to NOTIVISA endpoint (test vs. production?)
   - [ ] Submission confirmation captured (timestamp, reference #)
   - [ ] Status tracking (pending / approved by ANVISA / rejected)
5. [ ] Spot-check submitted events (if Phase 8 complete):
   - [ ] Form data complete + accurate
   - [ ] Supporting docs attached (test results, equipment logs, etc.)
   - [ ] Gov response (approval/request for additional info)
6. [ ] Verify audit trail:
   - [ ] All changes logged (draft → approved → submitted)
   - [ ] No unauthorized edits post-submission
7. [ ] Export NOTIVISA outbox status + sample submission
8. **Evidence:** `evidence/G3-notivisa-form-template.json`, `evidence/G3-sample-submission-gov-response.pdf`

#### Block G Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| G.1 Patient Portal | 🔴 Missing | Portal screenshot + download audit log | [ ] | All report fields per RDC? |
| G.2 Valores Críticos | 🔴 Missing | Critical value log + alert template | [ ] | SLA <15 min average? |
| G.3 NOTIVISA | 🔴 Missing | NOTIVISA form template + gov response sample | [ ] | API submissions working? |

**Target Coverage:** 92% (was 70%) = **+22 pts** ⭐ THIRD-HIGHEST JUMP
**Projected Pass Rate:** ✅ High (85%+) — Phases 5–8 planned, Phase 5 critical path

---

### Block H: Recursos (75% → 88% Target)

#### H.1 Laboratórios de Apoio (4.5) — RDC CRITICAL
**Requirement:** Support lab contracts with 6 mandatory clauses (RDC Arts. 36–39).
**v1.4 Implementation:** `lab-apoio` module (Phase 0 — RDC BLOCKER)
**Audit Steps:**
1. [ ] Open `lab-apoio` module (or `fornecedores` if integrated)
2. [ ] Verify all support labs registered:
   - [ ] Name, CNPJ, location
   - [ ] Services outsourced (e.g., "hemoglobin electrophoresis", "PCR viral", etc.)
   - [ ] Contract start/end date
   - [ ] Status (active, suspended, expired)
3. [ ] For each active support lab, verify 6 mandatory contract clauses:
   - [ ] **Capacity + Quality:** Lab must be accredited (ISO 15189 or equivalent) OR meet agreed quality standards
   - [ ] **Turnaround time:** Specified SLA (e.g., "results within 48 hrs of sample receipt")
   - [ ] **Quality control:** CIQ/CEQ participation; proficiency testing; method validation
   - [ ] **Contingency:** Backup lab or escalation plan if primary lab unavailable
   - [ ] **Audit rights:** Principal lab has right to audit support lab records (on-site or remote)
   - [ ] **Liability + responsibility:** Clear assignment of responsibility for quality; indemnification clause
4. [ ] Spot-check 2 support lab contracts:
   - [ ] Contract document present + signed by both parties
   - [ ] All 6 clauses clearly stated (word-for-word or reference to SOP)
   - [ ] Executed within last 2 years (current)
5. [ ] Check monitoring:
   - [ ] Quarterly or annual review of support lab compliance
   - [ ] On-site audit performed (if required by contract)
   - [ ] SLA compliance tracked (turnaround time, quality incident log)
6. [ ] Verify results integration:
   - [ ] Support lab reports auto-imported OR manually transcribed with QA check
   - [ ] Result certification: support lab signature/seal on each report
   - [ ] Caveat notation if any deviation from standard method
7. [ ] Export contract list + 2 sample contracts (redacted if sensitive)
8. **Evidence:** `evidence/H1-support-lab-list.json`, `evidence/H1-support-lab-contract-samples.pdf`

#### H.2 Calibração (5.3.1.4)
**Requirement:** Equipment calibration certificates; metrological traceability; upcoming recalibration alerts.
**v1.4 Implementation:** `equipamentos/{id}/calibracao` subcollection (Phase 9)
**Audit Steps:**
1. [ ] Open `equipamentos` module
2. [ ] Select 3 active analyzers (e.g., hematology, chemistry, coagulation instruments)
3. [ ] For each, verify calibration sub-section:
   - [ ] Latest calibration certificate (PDF upload)
   - [ ] Certificate date + expiry date
   - [ ] Calibration range + uncertainty statement
   - [ ] Traceability statement (PT/NIST reference)
   - [ ] Calibrating entity (accredited lab? manufacturer?)
   - [ ] Alert configured: 30-day warning before expiry
4. [ ] Check expiry alerts:
   - [ ] Calendar view: all equipment calibrations visible
   - [ ] Red flags for instruments near expiry (yellow if <30d, red if expired)
   - [ ] Alert notification enabled (email to maintenance manager)
5. [ ] Verify instrument status during OOC (Out of Calibration):
   - [ ] Instrument marked unavailable or under maintenance
   - [ ] Samples NOT analyzed on OOC instrument (enforced by rules or manual control?)
6. [ ] Spot-check historical calibrations:
   - [ ] Last 2–3 certificates present + traceable
   - [ ] Intervals follow manufacturer spec (e.g., "annual" or "every 12 months")
7. [ ] Export calibration certificate list + screenshot
8. **Evidence:** `evidence/H2-calibration-list.json`, `evidence/H2-sample-calibration-cert.pdf`

#### H.3 Manutenção (5.3.1.5)
**Requirement:** Preventive maintenance schedule; corrective maintenance logs; equipment status (in use / out of service).
**v1.4 Implementation:** `equipamentos/{id}/manutencoes` subcollection (Phase 10)
**Audit Steps:**
1. [ ] Open `equipamentos` module
2. [ ] Select 2 instruments; verify maintenance sub-section:
   - [ ] Preventive maintenance plan (schedule, frequency, responsible technician)
   - [ ] Maintenance checklist (steps to perform during PM)
   - [ ] Corrective maintenance log (fault reported → repair → verification → closure)
3. [ ] Spot-check PM records:
   - [ ] Last PM performed on schedule? (within 2 weeks of due date)
   - [ ] Checklist completed + signed
   - [ ] Parts replaced (if applicable) + serial #s recorded
   - [ ] Instrument performance verified post-PM
4. [ ] Check CM records:
   - [ ] 3 recent corrective maintenance events
   - [ ] Issue description clear
   - [ ] Root cause identified (if known)
   - [ ] Repair action + parts used
   - [ ] Verification: instrument tested to specification post-repair
   - [ ] If out of service: duration tracked, impact on lab operations?
5. [ ] Verify equipment status:
   - [ ] "In use" vs. "Out of service" vs. "Decommissioned"
   - [ ] OOS duration: if >30 days, approval to continue use required?
6. [ ] Check integration to indicators:
   - [ ] Equipment availability % tracked (in-use days / total days)
   - [ ] MTBF (Mean Time Between Failures) calculated for older instruments
7. [ ] Export PM schedule + CM log (last 6 months sample)
8. **Evidence:** `evidence/H3-maintenance-schedule.json`, `evidence/H3-cm-log-sample.json`

#### Block H Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| H.1 Lab Apoio (RDC CRITICAL) | 🔴 Missing | Contract list + 2 sample contracts | [ ] | All 6 clauses present? Monitoring in place? |
| H.2 Calibração | 🔴 Missing | Calibration list + certificate samples | [ ] | Expiry alerts active? No instruments OOC? |
| H.3 Manutenção | 🟡 Partial | PM schedule + CM log | [ ] | PMs on schedule? CMs documented? |

**Target Coverage:** 88% (was 75%) = **+13 pts**
**Projected Pass Rate:** 🟡 Medium (80%+) — H.1 Phase 0 critical, H.2/H.3 Phase 9–10

---

### Block I: Acomodações & Ambiente (64% → 80% Target)

#### I.1 Monitoramento Ambiental (5.2.6)
**Requirement:** Temperature + Humidity + Air quality (particle count ISO 14644); continuous monitoring; alerts.
**v1.4 Implementation:** `controle-temperatura` upgraded + particle counting option (Phase 9)
**Audit Steps:**
1. [ ] Open `controle-temperatura` module
2. [ ] Verify environmental parameters monitored:
   - [ ] Temperature (all zones: pre-analytic, analytic, storage)
   - [ ] Humidity (optional but recommended)
   - [ ] Particle counting (ISO 14644 if Class C or higher cleanroom specified)
3. [ ] Check sensor configuration:
   - [ ] Number of sensors deployed (coverage of all critical areas)
   - [ ] Sensor type + calibration status (within certificate validity)
   - [ ] Data logging frequency (continuous or interval-based?)
   - [ ] Data storage (local + cloud backup)
4. [ ] Verify temperature thresholds:
   - [ ] Normal range: 18–24°C (or lab-specific SOP)
   - [ ] Alert: if <17°C or >25°C (yellow)
   - [ ] Critical: if <15°C or >30°C (red) — analyzer may be offline
5. [ ] Check humidity thresholds (if monitored):
   - [ ] Target: 30–70%
   - [ ] Alert if outside range
6. [ ] Spot-check trend data:
   - [ ] Last 7 days visible on dashboard
   - [ ] Temperature profile (should be stable)
   - [ ] Any excursions? (if yes, incident report + action taken?)
7. [ ] Verify particle counting (if ISO 14644 applicable):
   - [ ] Cleanroom classification documented (e.g., Class D)
   - [ ] Particle count data (particles/m³ at size thresholds)
   - [ ] Frequency of particle count verification (quarterly minimum per ISO 14644)
8. [ ] Export trend data (last 30 days) + sensor list
9. **Evidence:** `evidence/I1-temperature-humidity-dashboard.png`, `evidence/I1-temperature-trend-30days.csv`

#### I.2 Programa Prevenção Infecções (5.2.8)
**Requirement:** Cleaning + disinfection SOP; staff training; incident tracking; effectiveness verification.
**v1.4 Implementation:** `biosseguranca` module + `programa-infeccoes` POPs in SGD (Phase 9)
**Audit Steps:**
1. [ ] Open SGD → Biossegurança → Infection Prevention Policy
2. [ ] Verify POP structure:
   - [ ] General housekeeping (daily cleaning schedule, responsible staff)
   - [ ] Decontamination of work surfaces (method, frequency, products used)
   - [ ] Hand hygiene (stations, products, monitoring)
   - [ ] PPE requirements (gloves, gowns, masks, eye protection per zone)
   - [ ] Spill response (contained, cleaned, reported)
   - [ ] Staff training (initial + annual refresher)
   - [ ] Inspection/audit cycle (monthly or quarterly self-check)
3. [ ] Check cleaning checklist implementation:
   - [ ] Daily cleaning log (pre-analytic, analytic, post-analytic zones)
   - [ ] Responsible staff signature
   - [ ] Date/time completed
   - [ ] Any issues noted (e.g., "spill in area 2, cleaned 10:30 AM")
4. [ ] Verify training records:
   - [ ] All staff trained on infection prevention (initial + annual)
   - [ ] Training records in personnel dossiès
   - [ ] Competency assessment (if hands-on training required)
5. [ ] Check incident tracking:
   - [ ] Any nosocomial infection incidents reported?
   - [ ] Environmental culture results (if periodically tested)
   - [ ] Root cause analysis (if incident)
   - [ ] Corrective actions taken
6. [ ] Verify effectiveness:
   - [ ] Environmental culture/ATP swab results (if done)
   - [ ] Trending data (no increase in contamination events)
7. [ ] Export POP + cleaning checklist + training records sample + incident log
8. **Evidence:** `evidence/I2-infection-prevention-pops.pdf`, `evidence/I2-cleaning-checklist-sample.json`

#### Block I Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| I.1 Monitoramento Ambiental | 🟡 Partial | Temperature/humidity dashboard + 30-day trend | [ ] | Particle counting deployed? Humidity alerts? |
| I.2 Programa Infecções | 🔴 Missing | Infection prevention POPs + cleaning checklist | [ ] | Staff trained? Cleaning logs complete? |

**Target Coverage:** 80% (was 64%) = **+16 pts**
**Projected Pass Rate:** 🟡 Medium (75%+) — depends on Phase 9 completion

---

### Block J: Continuidade & Confidencialidade (70% → 78% Target)

#### J.1 LGPD Policy Formal (5.10.1)
**Requirement:** Privacy policy, data processing terms, patient rights (access, correction, deletion), breach notification plan.
**v1.4 Implementation:** `lgpd-policy` in SGD (Phase 0 skeleton + Phase 1 formal)
**Audit Steps:**
1. [ ] Open SGD → Policies → LGPD Privacy Policy
2. [ ] Verify policy covers LGPD Articles:
   - [ ] **Art. 8 (Data Processing):** Lawful basis, data categories, retention periods
   - [ ] **Art. 18 (Rights of Data Subject):** Access, correction, deletion, portability
   - [ ] **Art. 38 (Data Breach Notification):** Procedure, timeline (48 hrs to authority), communication to patients
   - [ ] **Art. 77 (Information Security):** Encryption, access control, audit logging, backup/disaster recovery
3. [ ] Check policy specificity:
   - [ ] Patient data categories: name, contact, medical history, test results
   - [ ] Retention periods: results (5 yrs per RDC), contact (after discharge)
   - [ ] Purpose: diagnostic testing, quality improvement, legal compliance
   - [ ] Sharing: no sharing to third parties without consent (except legal mandate)
4. [ ] Verify rights exercício workflow:
   - [ ] Patient can request access (via patient portal or email)
   - [ ] Response timeline: 30 days per LGPD
   - [ ] Deletion request: assessment of legal hold vs. right to be forgotten
   - [ ] Audit log: who requested, when, outcome
5. [ ] Check breach notification:
   - [ ] Procedure documented (detect → contain → assess → notify ANVISA → communicate to patients)
   - [ ] Contact info for authorities (ANVISA, ANPD if applicable)
6. [ ] Verify version control + approval:
   - [ ] Policy signed by RT + Legal (if applicable)
   - [ ] Publication date + version
   - [ ] Accessible to all staff + patients
7. [ ] Export LGPD policy (PDF)
8. **Evidence:** `evidence/J1-lgpd-policy.pdf`, `evidence/J1-rights-exercicio-workflow.png`

#### J.2 Disaster Recovery (5.10.3)
**Requirement:** DR plan tested annually; RTO/RPO defined; backup validation; failover procedures.
**v1.4 Implementation:** Existing (v1.2) — maintenance only
**Audit Steps:**
1. [ ] Open disaster recovery documentation (SGD or IT runbook)
2. [ ] Verify DR plan elements:
   - [ ] RTO (Recovery Time Objective): e.g., "4 hours to restore lab operations"
   - [ ] RPO (Recovery Point Objective): e.g., "0 data loss via continuous replication"
   - [ ] Backup strategy: Firebase daily backups (automatic), secure storage
   - [ ] Failover procedure: manual steps to activate secondary environment (if applicable)
   - [ ] Testing schedule: annual DR drill (documented, with go/no-go decision)
3. [ ] Check backup validation:
   - [ ] Last successful backup timestamp (should be <24 hrs old)
   - [ ] Backup file size (sanity check: consistent with prior backups?)
   - [ ] Restoration test: restore sample data to staging, verify integrity
4. [ ] Review latest DR drill (if conducted):
   - [ ] Date of drill
   - [ ] Scenario tested (data center outage, ransomware, etc.)
   - [ ] Time to restore (actual vs. RTO target)
   - [ ] Issues found + remediation
5. [ ] Verify communication plan:
   - [ ] Key contacts notified of outage (RT, IT, lab staff, customers)
   - [ ] Status updates provided (e.g., every 30 min during outage)
6. [ ] Export DR plan (PDF) + latest backup verification log + latest DR drill report
7. **Evidence:** `evidence/J2-dr-plan.pdf`, `evidence/J2-backup-verification-log.json`

#### Block J Summary — Audit Checklist
| Item | v1.3 Status | v1.4 Evidence | Pass | Notes |
|------|------------|---------------|------|-------|
| J.1 LGPD Policy | 🟡 Partial | LGPD policy PDF + rights exercício workflow | [ ] | All LGPD articles covered? |
| J.2 DR Plan | ✅ Existing | DR plan + latest backup log + drill report | [ ] | Annual drill completed? RTO/RPO defined? |

**Target Coverage:** 78% (was 70%) = **+8 pts**
**Projected Pass Rate:** ✅ High (90%+) — maintenance only

---

## 2. Evidence Collection Summary

### Evidence Artifact Structure

```
evidence/
├── DICQ_AUDIT_RESULTS.json          # Master audit result (all blocks + scores)
├── A_Governanca/
│   ├── A1-legal-docs-screenshot.png
│   ├── A1-legal-docs-audit-log.json
│   ├── A2-governance-docs-list.png
│   ├── A2-governance-version-history.json
│   ├── A3-org-chart-screenshot.png
│   ├── A3-designacoes-audit-trail.json
│   ├── A4-management-review-template.json
│   └── A4-latest-management-review-ata.pdf
├── B_SGD/
│   ├── B1-manual-qualidade.pdf
│   ├── B2-lista-mestra-full-export.csv
│   ├── B2-lista-mestra-screenshot.png
│   ├── B3-document-download-audit.json
│   └── B3-sealed-pdf-sample.pdf
├── C_Pessoal/
│   ├── C1-dossie-sample-employee.pdf
│   ├── C1-dossie-completeness-audit.json
│   ├── C2-personnel-policy.pdf
│   ├── C3-job-descriptions.pdf
│   ├── C3-org-chart-with-subs.json
│   ├── C4-competency-assessments-sample.json
│   └── C4-performance-reviews-sample.json
├── D_Qualidade/
│   ├── D1-risk-register-fmea.json
│   ├── D1-risk-matrix-screenshot.png
│   ├── D2-audit-checklist-template.json
│   ├── D2-latest-audit-report.pdf
│   ├── D3-indicators-dashboard-screenshot.png
│   ├── D3-kpi-data-export.csv
│   ├── D4-nc-register-sample.json
│   └── D4-nc-trending.png
├── E_Pre-Analitico/
│   ├── E1-coleta-mobile-form-screenshot.png
│   ├── E1-coleta-sample-records.json
│   ├── E2-transport-log-sample.json
│   └── E2-temperature-excursion-sample.png
├── F_Analitico/
│   ├── F1-method-validation-template.json
│   ├── F1-validation-report-samples.pdf
│   ├── F2-uncertainty-calculations.json
│   ├── F2-patient-report-sample.pdf
│   ├── F3-ceq-annual-report.pdf
│   └── F3-ceq-corrective-actions.json
├── G_Pos-Analitico/
│   ├── G1-portal-login-screenshot.png
│   ├── G1-download-audit-log.json
│   ├── G1-report-pdf-sample.pdf
│   ├── G2-critical-value-log-sample.json
│   ├── G2-alert-template-screenshot.png
│   ├── G2-sla-report.csv
│   ├── G3-notivisa-form-template.json
│   └── G3-sample-submission-gov-response.pdf
├── H_Recursos/
│   ├── H1-support-lab-list.json
│   ├── H1-support-lab-contract-samples.pdf
│   ├── H2-calibration-list.json
│   ├── H2-sample-calibration-cert.pdf
│   ├── H3-maintenance-schedule.json
│   └── H3-cm-log-sample.json
├── I_Ambiente/
│   ├── I1-temperature-humidity-dashboard.png
│   ├── I1-temperature-trend-30days.csv
│   ├── I2-infection-prevention-pops.pdf
│   └── I2-cleaning-checklist-sample.json
└── J_Continuidade/
    ├── J1-lgpd-policy.pdf
    ├── J1-rights-exercicio-workflow.png
    ├── J2-dr-plan.pdf
    ├── J2-backup-verification-log.json
    └── J2-dr-drill-report.pdf
```

### Key Deliverables (Evidence to Export)
- ✅ All PDFs (policies, contracts, reports) — **Word-for-word export from system**
- ✅ JSON exports (audit logs, configurations) — **For auditor technical review**
- ✅ CSV exports (data tables, KPI trends) — **For trend analysis**
- ✅ Screenshots (portal, dashboards, forms) — **UI/UX evidence**

---

## 3. RDC 978 Mandatory Articles Mapping

### Purpose
Verify that all RDC 978 articles applicable to HC Quality are addressed in v1.4 evidence.

### RDC 978 Art-by-Art Checklist

#### Arts. 1–30 (Administrative & Organization)

| Article | Subject | v1.4 Evidence | Pass | Status |
|---------|---------|--------------|------|--------|
| **Art. 36–39** | Laboratórios de apoio (support lab contracts) | H1-support-lab-contracts.pdf | [ ] | Phase 0 (RDC CRITICAL) |
| **Art. 49** | Política da Qualidade (quality policy + objectives) | A2-governance + B1-manual-qualidade | [ ] | Phase 1 + 9 |
| **Art. 50** | Análise Crítica Direção (management review, annual) | A4-management-review-ata.pdf | [ ] | Phase 13–14 |
| **Art. 77** | LGPD compliance (confidentiality, data protection) | J1-lgpd-policy.pdf | [ ] | Phase 0 + 1 |

#### Arts. 105–130 (Technical Requirements)

| Article | Subject | v1.4 Evidence | Pass | Status |
|---------|---------|--------------|------|--------|
| **Art. 105** | Registros e documentos (records + document control, 5-yr retention) | B2-lista-mestra + B3-download-audit | [ ] | Phase 3 + 9 |
| **Art. 108** | Direitos do paciente (patient rights, consent) | J1-lgpd-policy | [ ] | Phase 1 |
| **Art. 113–114** | Identificação e transporte amostra (specimen ID + transport tracking) | E1-coleta + E2-transport-log | [ ] | Phase 6 |
| **Art. 115** | Registros retenção (5-yr retention rule) | B2-lista-mestra version control | [ ] | Phase 9 |
| **Art. 119** | Equipamentos calibração e manutenção (equipment calibration + maintenance) | H2-calibration-list + H3-maintenance-log | [ ] | Phase 9 + 10 |
| **Art. 120** | Acomodações condições ambientais (environment monitoring) | I1-temperature-humidity-dashboard | [ ] | Phase 9 |
| **Art. 122** | Supervisor presencial (on-site supervisor per shift) | A3-org-chart (turnos supervisor) | [ ] | Phase 0 |
| **Art. 124** | Continuidade operacional (disaster recovery plan) | J2-dr-plan.pdf | [ ] | Maintenance |
| **Art. 167** | Resultados críticos notificação (critical values alert + physician notification) | G2-critical-value-log + alert-template | [ ] | Phase 6 |
| **Art. 176** | CEQ/EQA participação (external quality assurance) | F3-ceq-annual-report | [ ] | Phase 10 |

#### Arts. 204+ (Notifications & Regulatory)

| Article | Subject | v1.4 Evidence | Pass | Status |
|---------|---------|--------------|------|--------|
| **Art. 204 / Portaria 204** | NOTIVISA notificação (notifiable diseases reporting) | G3-notivisa-form + gov-response | [ ] | Phase 8 |

### RDC 978 Compliance Summary
- **Total RDC articles applicable to software:** 15 (Arts. 36–39, 49–50, 77, 105, 108, 113–115, 119–120, 122, 124, 167, 176, 204)
- **v1.4 Planned Coverage:** 15/15 (100%)
- **Critical Path Articles (Phase 0 RDC Blockers):** Arts. 36–39 (lab apoio), 77 (LGPD), 122 (supervisor)

---

## 4. Compliance Snapshot — Structured JSON

### Purpose
Metrics dashboard feed for executive reporting + auditor briefing.

### Template: `compliance-snapshot-v1.4.json`

```json
{
  "audit_date": "2026-05-07",
  "v1.4_delivery_status": "In Progress (Phases 0–12 complete; Phase 13 in execution)",
  "compliance_metric": {
    "baseline_v1_3": {
      "conformance_percent": 78.5,
      "conforming_requisites": 444,
      "total_requisites": 570,
      "audit_tier": "Above minimum (75%)"
    },
    "target_v1_4": {
      "conformance_percent": 88.0,
      "conforming_requisites": 502,
      "total_requisites": 570,
      "audit_tier": "Premium (≥88%)"
    },
    "projected_v1_4": {
      "conformance_percent": "TBD (Phase 13 verification pending)",
      "confidence_range": "86–92%",
      "lower_bound_scenario": "86% (if Phase 4 CAPA delayed)",
      "upper_bound_scenario": "92% (if all phases on-time + stretch goals)"
    }
  },
  "dicq_block_scores": {
    "Block_A_Governance": {
      "v1_3_percent": 78,
      "v1_4_target": 92,
      "delta": 14,
      "status": "🟡 Phase 13 in progress",
      "evidence_ready": false
    },
    "Block_B_SGD": {
      "v1_3_percent": 65,
      "v1_4_target": 92,
      "delta": 27,
      "status": "✅ Phase 9 complete",
      "evidence_ready": true
    },
    "Block_C_Pessoal": {
      "v1_3_percent": 80,
      "v1_4_target": 92,
      "delta": 12,
      "status": "🟡 Phase 9 in progress (data migration pending)",
      "evidence_ready": false
    },
    "Block_D_Qualidade": {
      "v1_3_percent": 60,
      "v1_4_target": 85,
      "delta": 25,
      "status": "🟡 Phases 4 + 9 pending (Phase 4 auditor RFI risk)",
      "evidence_ready": false
    },
    "Block_E_Pre-Analitico": {
      "v1_3_percent": 64,
      "v1_4_target": 75,
      "delta": 11,
      "status": "✅ Phase 6 complete",
      "evidence_ready": true
    },
    "Block_F_Analitico": {
      "v1_3_percent": 92,
      "v1_4_target": 95,
      "delta": 3,
      "status": "✅ Phase 10 complete (strong foundation)",
      "evidence_ready": true
    },
    "Block_G_Pos-Analitico": {
      "v1_3_percent": 70,
      "v1_4_target": 92,
      "delta": 22,
      "status": "✅ Phases 5–9 complete",
      "evidence_ready": true
    },
    "Block_H_Recursos": {
      "v1_3_percent": 75,
      "v1_4_target": 88,
      "delta": 13,
      "status": "🟡 Phase 0 + 9–10 in progress (Phase 0 RDC critical)",
      "evidence_ready": false
    },
    "Block_I_Ambiente": {
      "v1_3_percent": 64,
      "v1_4_target": 80,
      "delta": 16,
      "status": "🟡 Phase 9 in progress (IoT firmware risk)",
      "evidence_ready": false
    },
    "Block_J_Continuidade": {
      "v1_3_percent": 70,
      "v1_4_target": 78,
      "delta": 8,
      "status": "✅ Phases 0–1 complete",
      "evidence_ready": true
    }
  },
  "rdc_978_compliance": {
    "total_applicable_articles": 15,
    "articles_addressed_v1_4": 15,
    "compliance_percent": 100,
    "critical_articles": {
      "Art_36-39": "Support lab contracts (Phase 0 RDC blocker) — READY",
      "Art_77": "LGPD confidentiality (Phase 0–1) — READY",
      "Art_122": "On-site supervisor (Phase 0) — READY"
    }
  },
  "orphan_resolution": {
    "orphans_identified_v1_3": 13,
    "orphans_resolved_v1_4": 10,
    "orphans_partially_resolved": 3,
    "unresolved": 0,
    "resolution_rate": "77% fully resolved, 100% addressed (13/13)"
  },
  "module_readiness": {
    "new_modules_v1_4": 25,
    "modules_deployed": "13 (Phases 0–9 complete)",
    "modules_in_progress": "7 (Phases 10–13 in progress)",
    "modules_deferred": "5 (v1.5 scope)",
    "critical_path_modules": [
      "lab-apoio (Phase 0 RDC blocker)",
      "personnel/dossie (Phase 1 data migration + Phase 9 full)",
      "management-review (Phase 13–14)",
      "auditoria-interna (Phase 9)"
    ]
  },
  "phase_13_status": {
    "completion_date": "TBD (target: May 14, 2026)",
    "blocks_audited": 0,
    "blocks_passing": 0,
    "blocks_failing": 0,
    "remediation_items_identified": 0,
    "remediation_items_p0": 0,
    "remediation_items_p1": 0
  },
  "auditor_readiness": {
    "evidence_package_complete": false,
    "pre_audit_checklist_complete": false,
    "known_gaps_documented": false,
    "mitigation_plans_approved": false,
    "target_date_auditor_visit": "2026-10-15",
    "buffer_days_post_launch": 180
  }
}
```

---

## 5. Remediation Planning (P0 + P1)

### Purpose
Identify any residual gaps found during Phase 13 audit; assign to P0 (immediate fix, pre-audit) or P1 (defer to v1.4.1 post-audit).

### Template: Remediation Decision Tree

```
IF gap found in Block {A–J}
├─ Severity Assessment:
│  ├─ 🔴 CRITICAL (affects audit result or patient safety)
│  │  → P0: Fix in Phase 13 (immediate)
│  │     Owner: [Module lead]
│  │     Timeline: < 2 days
│  │     Verification: Re-audit + sign-off
│  │
│  ├─ 🟠 MAJOR (affects compliance %ile meaningfully)
│  │  → P0 (if <1 day fix) OR P1 (if >1 day fix)
│  │     Owner: [Module lead]
│  │     Timeline: < 5 days (P0) or pre-launch (P1)
│  │     Verification: Auditor acceptance or v1.4.1 remediation plan
│  │
│  └─ 🟡 MINOR (documentation gap, minor SOP update)
│     → P1: Document in v1.4.1 remediation log
│        Owner: [Module lead]
│        Timeline: v1.4.1 post-audit
│        Verification: Included in next compliance audit
```

### Example Remediation Items (Template)

| Gap | Block | Severity | P0 or P1 | Fix | Owner | Timeline | Notes |
|-----|-------|----------|----------|-----|-------|----------|-------|
| **E.g.: EC efficacy records incomplete** | C | 🟠 MAJOR | P0 | Backfill EC post-test results from paper forms into module | Personnel Lead | 1 day | Data migration from v1.3 records |
| **E.g.: Management Review template not configured** | A | 🔴 CRITICAL | P0 | Populate all 15 fields in management-review module + configure auto-aggregation | Compliance Lead | <1 day | Required for Phase 13 audit closure |
| **E.g.: Risk assessment incomplete (only 15 of 20 risks identified)** | D | 🟡 MINOR | P1 | Expand FMEA matrix with additional process risks + NPR re-scoring | QA Lead | v1.4.1 | Document in v1.4.1 remediation log |

---

## 6. Auditor Briefing Materials

### Objectives
- **What changed v1.3 → v1.4:** Summarize phase deliverables, module launches, compliance jumps
- **Module-by-module compliance map:** Show RDC/DICQ coverage per module
- **Known gaps + remediation plan:** Transparent about any P0/P1 items
- **Decision framework:** Help auditor understand design choices (e.g., coleta deferred to v1.5, why)

### Deliverable: `AUDITOR_BRIEFING_v1.4.md`

```markdown
# HC Quality v1.4 — Auditor Briefing

## Executive Summary

HC Quality improved DICQ conformance from **78.5% (v1.3)** to **≥88% (v1.4)** through structured phase execution (Phases 0–12 complete; Phase 13 pre-audit in progress). Compliance investment focused on 4 high-gap blocks: B (SGD, +27 pts), D (Quality, +25 pts), G (Post-analytic, +22 pts), A (Governance, +14 pts).

**Key Achievements:**
- ✅ All Phase 0 RDC blockers shipped (lab-apoio, turnos supervisor, LGPD skeleton)
- ✅ 25 new modules deployed across v1.4 (13 in Phases 0–9; 7 in Phases 10–13; 5 deferred to v1.5)
- ✅ 13 orphan DICQ items resolved (100% addressed; 77% fully resolved)
- ✅ Audit infrastructure live (internal audit cycle, risk management FMEA, indicators dashboard)
- ✅ Evidence collection protocol standardized (JSON + PDF + CSV exports)

**Target Audit Readiness:** 2026-10-15 (6 weeks post-Phase 13 completion)

---

## What Changed: v1.3 → v1.4 by Phase

[Phase breakdown with module list, RDC articles addressed, DICQ block impact]

---

## Compliance Map: Module → RDC/DICQ Binding

[Table showing each module + its RDC article(s) + DICQ block(s)]

---

## Known Gaps + Remediation

### P0 (Immediate — Phase 13 closure)
[List any critical gaps found + fix timeline]

### P1 (Defer to v1.4.1)
[List minor gaps + v1.4.1 timeline]

---

## Decision Framework

### Why Coleta/Patient Portal Phase 5–6 and not earlier?
RDC Art. 113 (collection traceability) is foundational; PHR can defer post-launch since results can be released via email until portal ready.

[Similar decision explanations for other deferred/deferred-to-v1.5 items]

---

```

---

## 7. Pre-Approval Call Preparation

### Objective
30-min call with CTO + RT + Compliance Lead before auditor visit to align on findings, remediation strategy, and Q&A talking points.

### Agenda (30 minutes)

1. **Block-by-block summary (10 min)**
   - Which blocks are ✅ / 🟡 / 🔴
   - Any surprises from Phase 13 audit?
   - Confidence in ≥88% target

2. **Known gaps + remediation (5 min)**
   - P0 items completed? Evidence sign-off?
   - P1 items documented + scheduled for v1.4.1?
   - Auditor concerns anticipated?

3. **Auditor talking points (10 min)**
   - Why this gap exists (design choice or phasing constraint)
   - Mitigation in place (compensating control or roadmap commitment)
   - Evidence of intent (ADR registered, issue tracked, v1.4.1 committed)

4. **Q&A + sign-off (5 min)**
   - Any open questions?
   - Sign-off: Ready to proceed with external audit? (Yes/No/Conditional)
   - Next step: Auditor scheduling

### Checklist — Pre-Call Preparation
- [ ] All Phase 13 audit results compiled in JSON (DICQ_AUDIT_RESULTS.json)
- [ ] Remediation log finalized (P0 completed; P1 documented)
- [ ] Auditor briefing PDF ready (printed + digital)
- [ ] RDC article coverage 100% confirmed
- [ ] Evidence package spot-checked (no broken PDFs, all artifacts present)
- [ ] CTO/RT calendar holds (30 min, 1 week before auditor arrival)

---

## 8. Phase 13 Execution Timeline

### Week 1 (Days 1–5)

**Monday:** Kickoff + Block A audit
- [ ] Open live system + staging environment
- [ ] Block A walkthrough: governança, norteadores, designações, management review
- [ ] Screenshot capture + audit log exports
- [ ] Identify any gaps in A.1–A.4

**Tuesday:** Block B audit
- [ ] SGD walkthrough: Manual, Lista Mestra, document control
- [ ] PDF sealing + download audit verification
- [ ] Export evidence artifacts

**Wednesday:** Blocks C + D audit
- [ ] Personnel dossiè spot-check (3 employees, completeness)
- [ ] Risk register + auditoria interna module verification
- [ ] Indicators dashboard + KPI data export
- [ ] NC trending + CAPA linkage

**Thursday:** Blocks E + F audit
- [ ] Coleta mobile form + sample records review
- [ ] Transport log + temperature monitoring verification
- [ ] Method validation + CEQ report sampling

**Friday:** Blocks G + H audit
- [ ] Patient portal login + download audit log
- [ ] Critical values alerts + NOTIVISA integration
- [ ] Support lab contracts + calibration certs
- [ ] Compile Week 1 evidence

### Week 2 (Days 6–10)

**Monday:** Blocks I + J audit
- [ ] Temperature/humidity dashboard + cleaning checklist
- [ ] LGPD policy + disaster recovery plan
- [ ] Final gap assessment

**Tuesday–Wednesday:** Remediation + re-audit
- [ ] Fix any P0 items identified
- [ ] Re-audit blocks with gaps
- [ ] Compile final remediation log (P0 + P1)

**Thursday:** Evidence package + JSON snapshot
- [ ] Organize all artifacts into directory structure
- [ ] Generate DICQ_AUDIT_RESULTS.json
- [ ] Spot-check for completeness

**Friday:** Auditor briefing + pre-call
- [ ] Finalize auditor briefing PDF
- [ ] Schedule pre-approval call with CTO/RT
- [ ] Deliver evidence package to CTO

---

## Success Criteria — Phase 13 Completion

✅ **Audit Checklist 100% Complete**
- All 10 blocks audited (A–J)
- All block-level scores recorded (% conformance)
- All evidence artifacts exported (PDFs, JSON, CSV, screenshots)

✅ **Remediation Plan Finalized**
- P0 items (if any): fixed + re-verified
- P1 items: documented + v1.4.1 timeline committed
- Sign-off: RT approval on remediation log

✅ **Auditor Materials Ready**
- Briefing PDF with module map + decision framework
- Evidence package (organized, spot-checked)
- Pre-call scheduled + attendees confirmed

✅ **Compliance Snapshot JSON**
- DICQ block scores populated
- RDC article mapping 100% (15/15)
- Orphan resolution summary confirmed
- Phase 13 findings + recommendations documented

✅ **Internal Sign-Off**
- CTO + RT sign off on ≥88% target (achieved, at-risk, or miss)
- Compliance lead certifies evidence integrity
- Pre-approval call completed successfully

---

## Appendix: Quick Reference Checklists

### Phase 13 Audit Roles + Responsibilities

| Role | Responsibility | Hours | Deliverable |
|------|---|------|------|
| **Compliance Lead** | Orchestrate Phase 13; block-by-block audit; evidence org; auditor briefing | 15 | DICQ_AUDIT_RESULTS.json + briefing PDF |
| **QA Lead** | Execute test cases; screenshot capture; data spot-check; gap identification | 20 | Screenshots + spot-check findings |
| **Module Leads (10)** | Support block audits (provide system access, data queries, explanation of design choices) | 10 each | Evidence artifacts per module |
| **IT/DevOps** | Log exports; audit trail queries; backup verification; DR drill report | 5 | Log files + audit trail exports |
| **RT (Responsável Técnico)** | Review phase 13 findings; approve remediation plan; sign-off on final compliance snapshot | 3 | Signatures on remediation log + sign-off |

### Evidence Export SOP

**For each evidence artifact:**
1. [ ] Query live system (production or staging, documented)
2. [ ] Export to file (PDF, JSON, CSV, or PNG screenshot)
3. [ ] Validate file integrity (non-empty, correct format, readable)
4. [ ] Add metadata (export date, system version, data owner, any PII redactions)
5. [ ] Move to `/docs/PHASE_13_EVIDENCE/` directory + subdirectory per block
6. [ ] Update evidence manifest (log file name + checksum)

---

## Final Artifact Deliverables

**By Phase 13 Completion (May 14, 2026):**

1. ✅ `PHASE_13_AUDIT_RESULTS.json` — Block scores + gaps + remediation
2. ✅ `docs/PHASE_13_EVIDENCE/` — Full evidence tree (screenshots, PDFs, JSON, CSV)
3. ✅ `AUDITOR_BRIEFING_v1.4.md` — Module map + decision framework + known gaps
4. ✅ `REMEDIATION_LOG_v1.4.md` — P0 + P1 items + owner + timeline
5. ✅ `COMPLIANCE_SNAPSHOT_v1.4.json` — Metrics dashboard feed
6. ✅ `RDC_978_ARTICLE_COVERAGE_v1.4.md` — 15/15 articles verified

---

**Prepared by:** Compliance Lead  
**Date:** 2026-05-07 (template creation)  
**Status:** Ready for Phase 13 execution  
**Next:** Phase 13 kickoff (Week of 2026-05-13)

