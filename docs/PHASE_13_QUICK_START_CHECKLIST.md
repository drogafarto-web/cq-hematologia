# Phase 13 — Quick Start Checklist

**Timeline:** 10 working days (May 13–24, 2026)  
**Owner:** Compliance Lead  
**Success Metric:** ≥88% DICQ conformance verified + evidence package complete

---

## Pre-Phase (May 12 — Day Before Kickoff)

- [ ] **Documentation review** (2 hrs)
  - Read PHASE_13_DETAILED_PLAN.md cover-to-cover
  - Highlight 3–5 questions for CTO/RT clarification call
  - Familiarize with evidence artifact directory structure

- [ ] **Team kickoff prep** (1 hr)
  - Schedule Phase 13 kickoff meeting (30 min, all roles)
  - Send agenda: overview → block assignments → timeline → Q&A
  - Confirm attendee availability (Compliance, QA, 10 module leads, IT, RT)

- [ ] **System access verification** (30 min)
  - Production environment accessible (read-only audit mode)
  - Staging environment ready (data export tests)
  - Credentials for 10 module leads provisioned
  - Firestore Emulator pre-configured (for rules audit if needed)

- [ ] **Directory structure created** (30 min)
  - Create `docs/PHASE_13_EVIDENCE/` (base directory)
  - Create 10 subdirectories: `A_Governanca/`, `B_SGD/`, ..., `J_Continuidade/`
  - Create manifest file: `docs/PHASE_13_EVIDENCE/MANIFEST.json` (artifact tracker)

- [ ] **Test data staging** (1 hr)
  - Ensure 3–5 representative records per module available (for spot-check)
  - Confirm no PII exposure during screenshots (redact or use test accounts)
  - Flag any production data that might reveal sensitive info

---

## Week 1: Blocks A–H Audit

### Monday — Block A: Governança & Direção (4 hrs)

**QA Lead:** Test execution + screenshots  
**Module Leads:** Personnel, SGD (policy docs)

- [ ] **A.1 Pessoa Jurídica** (30 min)
  - [ ] Navigate `labSettings` → Legal Documents
  - [ ] Verify: CNES, Alvará, Conselho, CNPJ all present
  - [ ] Check expiry dates + 30-day alert system
  - [ ] Screenshot: legal docs list + metadata panel
  - [ ] Export: audit log (upload history + changes)
  - [ ] **Evidence:** `A_Governanca/A1-legal-docs-screenshot.png` + `.json`

- [ ] **A.2 Norteadores + Código Ética** (1 hr)
  - [ ] Open SGD → Governance section
  - [ ] Verify 5 docs: Missão, Visão, Valores, Código Ética, Política Qualidade
  - [ ] Check: all marked Approved + RT signature + version history
  - [ ] Verify: distribution log (read confirmations)
  - [ ] Screenshot: governance docs list
  - [ ] Export: version history JSON
  - [ ] **Evidence:** `A_Governanca/A2-governance-docs-list.png` + `-version-history.json`

- [ ] **A.3 Designações Formais** (1 hr)
  - [ ] Navigate `personnel/designacoes`
  - [ ] Verify: Lab Director, QA Manager, Supervisor designations (all with RT signature + date)
  - [ ] Check: Substitutes documented for each role
  - [ ] Export: org chart PDF + designations audit trail
  - [ ] **Evidence:** `A_Governanca/A3-org-chart-screenshot.png` + `-audit-trail.json`

- [ ] **A.4 Management Review Template** (1.5 hrs)
  - [ ] Open `management-review` module
  - [ ] Verify: 15-point checklist template configured
  - [ ] Check: auto-aggregation logic (pulling from NC, CAPA, audit, KPIs modules)
  - [ ] If v1.3 ata exists: review structure + completeness
  - [ ] If template only (no ata yet): confirm structure ready for Phase 14
  - [ ] Screenshot: template + auto-aggregation config
  - [ ] Export: template JSON + sample ata (if exists)
  - [ ] **Evidence:** `A_Governanca/A4-management-review-template.json` + `-ata.pdf` (if exists)

**End of Day:** Block A status → update `COMPLIANCE_SNAPSHOT.json` Block_A entry

---

### Tuesday — Block B: Gestão Documental / SGD (3.5 hrs)

**QA Lead:** Test execution + screenshots  
**Module Lead:** SGD

- [ ] **B.1 Manual da Qualidade** (1 hr)
  - [ ] Open SGD → Manual da Qualidade
  - [ ] Verify: 10 sections present (4.1–4.15, scope, roles, procedures, DICQ statement)
  - [ ] Check: RT signature + version date
  - [ ] Spot-check: 3 procedure references (links to PQ in SGD active?)
  - [ ] Export: PDF version (with seal)
  - [ ] **Evidence:** `B_SGD/B1-manual-qualidade.pdf`

- [ ] **B.2 Lista Mestra Hierárquica** (1 hr)
  - [ ] Open SGD → Lista Mestra
  - [ ] Count docs per category: MQ (1), PQ (?), IT (?), FR (?), POL (?), POP (?)
  - [ ] Spot-check 5 random docs: verify version, status, approval date, distribution date
  - [ ] Check: obsolescence tracking (old versions marked obsolete?)
  - [ ] Export: full lista mestra as CSV + screenshot of master list
  - [ ] **Evidence:** `B_SGD/B2-lista-mestra-full-export.csv` + `-screenshot.png`

- [ ] **B.3 Controle de Documentos Eletrônicos** (1.5 hrs)
  - [ ] Download 1 SGD document (e.g., a PQ)
  - [ ] Verify PDF has: version stamp, hash, integrity statement, QR code (if implemented)
  - [ ] Export: download audit log (last 30 days, timestamp + user + IP)
  - [ ] Spot-check 3 distributions: verify email sent + read receipt captured
  - [ ] Check: obsolete docs are hidden/replaced properly
  - [ ] **Evidence:** `B_SGD/B3-sealed-pdf-sample.pdf` + `-download-audit.json`

**End of Day:** Block B status → update `COMPLIANCE_SNAPSHOT.json`

---

### Wednesday — Blocks C (Pessoal) + D (Qualidade) (7 hrs)

**QA Lead:** Test execution + spot-checks  
**Module Leads:** Personnel, QA/Compliance

**BLOCK C: Pessoal (3 hrs)**

- [ ] **C.1 Dossiê Unificado** (1.5 hrs) — CRITICAL PATH
  - [ ] Open `personnel/dossie`
  - [ ] Select 3 random employees
  - [ ] For each, verify all 6 sections: Qualificação, Treinamentos, Competência, Desempenho, Biossegurança, Saúde/Segurança
  - [ ] Data integrity check: no gaps, dates logical, signatures present
  - [ ] Spot-check EC linkage: each training has post-test assessment?
  - [ ] Export: 1 complete dossiê (PDF) + completeness audit log (JSON)
  - [ ] **Risk Assessment:** If >10% missing EC records → mark 🟡 Partial; if <10% → ✅ Covered
  - [ ] **Evidence:** `C_Pessoal/C1-dossie-sample-employee.pdf` + `-completeness-audit.json`

- [ ] **C.2 Política de Pessoal** (45 min)
  - [ ] Open SGD → Personnel Policy
  - [ ] Verify: 10 sections (recruitment, qualifications, EC, competency, performance, benefits, health/safety, conflict resolution, whistleblower, compliance)
  - [ ] Check: RT + Lab Director signature + version control
  - [ ] Export: policy PDF
  - [ ] **Evidence:** `C_Pessoal/C2-personnel-policy.pdf`

- [ ] **C.3 Designações & Cargos** (45 min)
  - [ ] Open `personnel/cargos` (job descriptions)
  - [ ] Verify: Lab Director, QA Manager, Supervisor, Lead Tech descriptions exist
  - [ ] Each includes: authority limits, reporting line, 20+ responsibilities, education requirements
  - [ ] Check org chart consistency with `personnel/designacoes`
  - [ ] Verify: substitutes named + delegation dates set
  - [ ] Export: job descriptions PDF + org chart JSON
  - [ ] **Evidence:** `C_Pessoal/C3-job-descriptions.pdf` + `-org-chart-with-subs.json`

**BLOCK D: Qualidade & Compliance (4 hrs)**

- [ ] **D.1 FMEA-Lite Riscos** (1 hr)
  - [ ] Open `risks` module
  - [ ] Verify: 20+ process risks identified (specimen handling, analyzer maintenance, result review, etc.)
  - [ ] Spot-check 3 risks: P, S, D scores + NPR calc + current controls + action plan + effectiveness check
  - [ ] Check: annual review cycle documented (last review date?)
  - [ ] Export: full risk register (JSON)
  - [ ] **Evidence:** `D_Qualidade/D1-risk-register-fmea.json` + `-matrix-screenshot.png`

- [ ] **D.2 Auditoria Interna** (1.5 hrs)
  - [ ] Open `auditoria-interna` module
  - [ ] Verify: annual audit plan (all DICQ blocks A–J covered)
  - [ ] Check: DICQ checklist template exists (40–50 yes/no questions)
  - [ ] If Phase 9 complete: review latest internal audit
    - [ ] Dates, auditors, scope documented
    - [ ] Findings categorized (Major/Minor/Observation)
    - [ ] NC linkage: findings create NCs in NC module?
    - [ ] Action plans assigned + due dates
  - [ ] Export: audit schedule + template + latest audit report (PDF if exists)
  - [ ] **Evidence:** `D_Qualidade/D2-audit-checklist-template.json` + `-latest-audit-report.pdf` (if exists)

- [ ] **D.3 Indicadores KPI** (1 hr)
  - [ ] Open `indicators` dashboard
  - [ ] Count KPIs (target: 15+): pre-analytic, analytic, post-analytic, quality, operational
  - [ ] Spot-check 3 KPIs: target value set? actual vs. target visible? trending data (6 mo)? escalation rule active?
  - [ ] Check: management review linkage (auto-aggregation or manual?)
  - [ ] Export: dashboard screenshot + KPI data (CSV)
  - [ ] **Evidence:** `D_Qualidade/D3-indicators-dashboard-screenshot.png` + `-kpi-data-export.csv`

- [ ] **D.4 NC Trending** (30 min)
  - [ ] Open `non-conformidades` or `capa` module
  - [ ] Sample 5 recent NCs (last 30 days)
  - [ ] Verify: source, severity, root cause, NC → CAPA linkage, closure date, compliance with deadlines
  - [ ] Export: NC register (last 6 mo sample) + trending chart
  - [ ] **Evidence:** `D_Qualidade/D4-nc-register-sample.json` + `-trending.png`

**End of Day:** Blocks C + D status → update `COMPLIANCE_SNAPSHOT.json`

---

### Thursday — Blocks E (Pré-Analítico) + F (Analítico) (3 hrs)

**QA Lead:** Test execution + mobile app verification  
**Module Leads:** Coleta/Transport, Analytics

**BLOCK E: Pré-Analítico (1 hr)**

- [ ] **E.1 Coleta** (30 min)
  - [ ] Open `coleta` module (mobile or web interface)
  - [ ] Verify: SOP accessible (patient prep, tube types, volume requirements)
  - [ ] Check: mobile form has all fields (sample ID barcode, collector name/ID, date/time, patient info, sample type, photo)
  - [ ] Spot-check 3 collections: fields filled? photos attached with correct timestamps? barcodes valid?
  - [ ] Verify: rejection criteria configured (hemolyzed, insufficient volume, contamination)
  - [ ] Export: mobile form screenshot + sample records (JSON)
  - [ ] **Evidence:** `E_Pre-Analitico/E1-coleta-mobile-form-screenshot.png` + `-sample-records.json`

- [ ] **E.2 Transporte** (30 min)
  - [ ] Open `transporte-amostras` module
  - [ ] Verify: transport SOP (max time, temperature requirements, container, contingency)
  - [ ] Check: temperature monitoring integration to `controle-temperatura` (alert thresholds)
  - [ ] Spot-check 3 transports: pickup time, delivery time, T° data (if cold chain), delivery confirmation, any excursions?
  - [ ] Verify: if transport time >SLA or T° excursion → result flagged for RT review
  - [ ] Export: transport log (last 30 days sample) + temperature data
  - [ ] **Evidence:** `E_Pre-Analitico/E2-transport-log-sample.json` + `-temperature-excursion-sample.png`

**BLOCK F: Analítico (2 hrs)**

- [ ] **F.1 Validação de Métodos** (40 min)
  - [ ] Open SGD → Method Validation Templates
  - [ ] Identify all non-standard/custom methods in lab
  - [ ] For each, verify: validation report exists, CLSI EP standard referenced, analytical parameters (accuracy, precision, linearity, LOD, LOQ) assessed, approval by RT
  - [ ] Spot-check 2 reports: data quality, conclusions supported, limitations stated
  - [ ] Export: template + 2 sample reports (PDF)
  - [ ] **Evidence:** `F_Analitico/F1-method-validation-template.json` + `-validation-report-samples.pdf`

- [ ] **F.2 Incerteza de Medição** (40 min)
  - [ ] Open `incerteza-medicao` module (or SGD procedures)
  - [ ] Verify: GUM/CLSI methodology documented
  - [ ] Spot-check 5 analytes (glucose, cholesterol, hemoglobin, K+, creatinine): uncertainty value + calculation method + source breakdown
  - [ ] Check: uncertainty reasonable vs. CLIA/RDC limits? Patient report includes uncertainty notation (if required)?
  - [ ] Verify: annual review (updated if method/reagent changes)
  - [ ] Export: calculations (JSON) + patient report sample (PDF)
  - [ ] **Evidence:** `F_Analitico/F2-uncertainty-calculations.json` + `-patient-report-sample.pdf`

- [ ] **F.3 CEQ Avaliação Periódica** (40 min)
  - [ ] Open `ceq` module → Annual Reports
  - [ ] If Phase 10 complete: review latest annual CEQ report
    - [ ] Program(s), z-score summary, count of |z| > 2, corrective actions taken
  - [ ] Spot-check 2 corrective actions: root cause, action, re-test, closure
  - [ ] Verify: CEQ summary feeds into management review (annual)
  - [ ] Check: participation certificates + receipts present
  - [ ] Export: CEQ annual report (PDF) + corrective actions (JSON)
  - [ ] **Evidence:** `F_Analitico/F3-ceq-annual-report.pdf` + `-ceq-corrective-actions.json`

**End of Day:** Blocks E + F status → update `COMPLIANCE_SNAPSHOT.json`

---

### Friday — Blocks G (Pós-Analítico) + H (Recursos) (6 hrs)

**QA Lead:** Portal testing + critical value testing  
**Module Leads:** Patient Portal, NOTIVISA, Equipment/Support Labs

**BLOCK G: Pós-Analítico & Laudos (3 hrs)**

- [ ] **G.1 Patient Portal & Liberação** (1 hr)
  - [ ] Access patient portal (test account)
  - [ ] Verify: OAuth/email-link auth working
  - [ ] Check: patient dashboard displays name, reports list, filters work
  - [ ] Download 1 report: PDF renders correctly, all required fields per RDC present (patient ID, test, result, ref range, units, method, analyst, RT sig, date)
  - [ ] Spot-check: download audit log (timestamp, user ID, IP recorded for 3 downloads)
  - [ ] Check: physician portal (if separate) read-only, revision history visible
  - [ ] Export: portal screenshots + download audit log (JSON)
  - [ ] **Evidence:** `G_Pos-Analitico/G1-portal-login-screenshot.png` + `-download-audit-log.json` + `-report-pdf-sample.pdf`

- [ ] **G.2 Valores Críticos** (1 hr)
  - [ ] Open `valores-criticos` module
  - [ ] Verify: thresholds configured per analyte (glucose, K+, INR, troponin, etc.)
  - [ ] Check: alert delivery (SMS, email, portal notification) + acknowledgment workflow
  - [ ] Spot-check 3 critical value events (if available):
    - [ ] Alert triggered correctly? Delivery successful? Ack time <15 min SLA?
  - [ ] If SLA missed: escalation to lab director?
  - [ ] Export: critical value log + alert template + SLA report (CSV)
  - [ ] **Evidence:** `G_Pos-Analitico/G2-critical-value-log-sample.json` + `-alert-template-screenshot.png` + `-sla-report.csv`

- [ ] **G.3 NOTIVISA & Tecnovigilância** (1 hr)
  - [ ] Open `notivisa-outbox` module (if Phase 8 complete)
  - [ ] Verify: notifiable disease list (Portaria 204)
  - [ ] Check: event intake form (event details, severity, immediate actions)
  - [ ] Workflow: submit → RT approval → gov API submit → status tracking
  - [ ] If Phase 8 complete: spot-check 1 submitted event
    - [ ] Form complete? Supporting docs attached? Gov response captured?
  - [ ] Verify: audit trail (all changes logged, no post-submission edits)
  - [ ] Export: form template + sample submission (JSON + gov response PDF)
  - [ ] **Evidence:** `G_Pos-Analitico/G3-notivisa-form-template.json` + `-sample-submission-gov-response.pdf`

**BLOCK H: Recursos (3 hrs)**

- [ ] **H.1 Laboratórios de Apoio** (1 hr) — RDC CRITICAL
  - [ ] Open `lab-apoio` module
  - [ ] List all active support labs (name, CNPJ, services)
  - [ ] For 2 active labs, verify contracts have 6 mandatory clauses:
    - [ ] Capacity + Quality (accreditation/standards)
    - [ ] Turnaround time SLA
    - [ ] Quality control + proficiency testing
    - [ ] Contingency plan
    - [ ] Audit rights
    - [ ] Liability + responsibility
  - [ ] Check: contracts signed, executed <2 years ago, monitored (quarterly/annual review)
  - [ ] Spot-check: result imports (auto or manual with QA check?)
  - [ ] Export: lab list + 2 sample contracts (PDF, redacted if sensitive)
  - [ ] **Evidence:** `H_Recursos/H1-support-lab-list.json` + `-support-lab-contract-samples.pdf`

- [ ] **H.2 Calibração** (1 hr)
  - [ ] Open `equipamentos` module
  - [ ] Select 3 active analyzers (e.g., hematology, chemistry, coagulation)
  - [ ] For each, verify calibration sub-section:
    - [ ] Latest cert (PDF), date + expiry, range, uncertainty, PT/NIST traceability, calibrating entity
    - [ ] Expiry alert: 30-day warning configured?
  - [ ] Check: expired instruments marked unavailable (samples not analyzed on OOC equipment?)
  - [ ] Spot-check: last 2–3 certs traceable, intervals follow manufacturer spec
  - [ ] Export: calibration list + certificate sample
  - [ ] **Evidence:** `H_Recursos/H2-calibration-list.json` + `-sample-calibration-cert.pdf`

- [ ] **H.3 Manutenção** (1 hr)
  - [ ] Open `equipamentos` → maintenance sub-section
  - [ ] Verify: preventive maintenance plan + checklist per equipment type
  - [ ] Spot-check 2 PM records: last PM on schedule? Checklist signed? Parts replaced logged?
  - [ ] Check 3 corrective maintenance events: issue described, root cause, repair action, verification post-repair
  - [ ] Verify: OOS equipment tracked, status visible
  - [ ] Check: equipment availability % calculated (in-use days / total days)
  - [ ] Export: PM schedule + CM log (last 6 mo sample)
  - [ ] **Evidence:** `H_Recursos/H3-maintenance-schedule.json` + `-cm-log-sample.json`

**End of Day:** Blocks G + H status → update `COMPLIANCE_SNAPSHOT.json`

**Week 1 Summary:** Compile evidence from A–H; identify any gaps; document findings

---

## Week 2: Blocks I–J + Remediation + Delivery

### Monday — Blocks I (Acomodações) + J (Continuidade) (3 hrs)

**QA Lead:** Dashboard verification, policy review  
**Module Leads:** Environment, Disaster Recovery

**BLOCK I: Acomodações & Ambiente (1.5 hrs)**

- [ ] **I.1 Monitoramento Ambiental** (45 min)
  - [ ] Open `controle-temperatura` module
  - [ ] Verify: sensors deployed (all critical zones: pre-analytic, analytic, storage)
  - [ ] Check: parameters monitored (T° + humidity + particle count if ISO 14644)
  - [ ] Thresholds: normal range 18–24°C, alerts, critical alerts
  - [ ] Spot-check: 7-day trend data (stable? any excursions? incidents filed?)
  - [ ] If humidity monitored: verify 30–70% target + alerts
  - [ ] If particle counting: verify class documented + quarterly verification done
  - [ ] Export: dashboard screenshot + 30-day trend data (CSV)
  - [ ] **Evidence:** `I_Ambiente/I1-temperature-humidity-dashboard.png` + `-temperature-trend-30days.csv`

- [ ] **I.2 Programa Prevenção Infecções** (45 min)
  - [ ] Open SGD → Infection Prevention Policy
  - [ ] Verify: POP covers (housekeeping, decontamination, hand hygiene, PPE, spill response, training, inspection/audit cycle)
  - [ ] Check: cleaning checklist implemented (daily log per zone, staff signature, issues noted)
  - [ ] Verify: staff trained (initial + annual, records in personnel dossiès)
  - [ ] Any incident tracking? Nosocomial infections reported? Corrective actions taken?
  - [ ] Verify: effectiveness (environmental culture/ATP swab results if done, trending data)
  - [ ] Export: POPs + cleaning checklist sample + training records + incident log
  - [ ] **Evidence:** `I_Ambiente/I2-infection-prevention-pops.pdf` + `-cleaning-checklist-sample.json`

**BLOCK J: Continuidade & Confidencialidade (1.5 hrs)**

- [ ] **J.1 LGPD Policy Formal** (45 min)
  - [ ] Open SGD → LGPD Privacy Policy
  - [ ] Verify: covers LGPD articles (Art. 8 data processing, Art. 18 data subject rights, Art. 38 breach notification, Art. 77 information security)
  - [ ] Check: patient data categories, retention periods, purpose, sharing restrictions
  - [ ] Rights exercício workflow: patient access request → response within 30 days
  - [ ] Deletion request: assessment of legal hold vs. right to be forgotten
  - [ ] Breach notification: procedure documented (detect → contain → assess → notify ANVISA → communicate to patients)
  - [ ] Version control + approval (RT + Legal)
  - [ ] Check: policy accessible to staff + patients
  - [ ] Export: policy PDF + rights exercício workflow diagram
  - [ ] **Evidence:** `J_Continuidade/J1-lgpd-policy.pdf` + `-rights-exercicio-workflow.png`

- [ ] **J.2 Disaster Recovery Plan** (45 min)
  - [ ] Open DR documentation (SGD or IT runbook)
  - [ ] Verify: RTO/RPO defined (e.g., "4 hrs to restore; 0 data loss via continuous replication")
  - [ ] Check: backup strategy (Firebase daily auto-backups, secure storage)
  - [ ] Last backup: timestamp <24 hrs old? File size consistent?
  - [ ] Restoration test: sample restore to staging, data integrity verified?
  - [ ] Annual DR drill: latest drill documented?
    - [ ] Scenario, time to restore (actual vs. RTO), issues found + remediation
  - [ ] Communication plan: key contacts notified? Status updates provided?
  - [ ] Export: DR plan + backup verification log + latest DR drill report
  - [ ] **Evidence:** `J_Continuidade/J2-dr-plan.pdf` + `-backup-verification-log.json` + `-dr-drill-report.pdf`

**End of Day:** Blocks I + J status → update `COMPLIANCE_SNAPSHOT.json`

---

### Tuesday–Wednesday — Remediation + Re-Audit (8 hrs)

- [ ] **Review Week 1 audit findings** (1 hr)
  - [ ] Which blocks have gaps? Severity assessment (critical/major/minor)
  - [ ] P0 items: fix immediately
  - [ ] P1 items: document for v1.4.1

- [ ] **P0 Remediation (if any)** (up to 8 hrs)
  - [ ] Per item: owner assigned, timeline <2 days, fix plan detailed
  - [ ] Example: If management review template incomplete → populate 15 fields + configure auto-aggregation (4 hrs)
  - [ ] Example: If personnel dossiè missing EC records → backfill from paper forms (2 hrs)
  - [ ] Verify fix: re-audit block, screenshot confirmation, log audit trail
  - [ ] Sign-off: RT approves remediation

- [ ] **P1 Documentation** (1 hr)
  - [ ] Create `REMEDIATION_LOG_v1.4.md` (per template in main plan)
  - [ ] For each P1 item: gap description, severity (major/minor), v1.4.1 timeline, owner, justification for deferral
  - [ ] CTO approval of P1 list

---

### Thursday — Evidence Package Completion (4 hrs)

- [ ] **Verify all evidence artifacts present** (2 hrs)
  - [ ] Run through evidence manifest checklist
  - [ ] For each artifact: file exists, format correct, non-empty, readable
  - [ ] Spot-check 5 random PDFs/JSONs (not corrupted?)
  - [ ] Any PII exposure? Redact or replace with test accounts if needed

- [ ] **Organize final evidence tree** (1 hr)
  - [ ] Copy all artifacts to `docs/PHASE_13_EVIDENCE/` subdirectories
  - [ ] Update `MANIFEST.json` (file name + size + checksum + description)
  - [ ] Verify directory structure matches plan

- [ ] **Generate compliance snapshot** (1 hr)
  - [ ] Populate `compliance-snapshot-v1.4.json` (from template in main plan)
  - [ ] Block-by-block scores finalized
  - [ ] RDC article coverage verified (15/15)
  - [ ] Orphan resolution summary
  - [ ] Phase 13 findings recorded

---

### Friday — Auditor Briefing + Pre-Call (6 hrs)

- [ ] **Finalize auditor briefing PDF** (2 hrs)
  - [ ] Draft outline (see main plan Section 6)
  - [ ] Module → RDC/DICQ binding table
  - [ ] Known gaps + P0/P1 remediation strategy
  - [ ] Decision framework (why deferred coleta to phase 6? why patient portal phase 5?)
  - [ ] PDF export, print 5 copies, digital copy ready

- [ ] **Schedule pre-approval call** (30 min)
  - [ ] Calendar: CTO + RT + Compliance Lead (30 min)
  - [ ] Target: 1 week before auditor arrival
  - [ ] Agenda prepared (block summary, gaps, talking points, sign-off)

- [ ] **Prepare talking points document** (1.5 hrs)
  - [ ] For each anticipated auditor question (see list below), draft response
  - [ ] "Why was [gap] deferred?" → explain design choice + mitigation
  - [ ] "How do you know ≥88%?" → point to block scores + evidence
  - [ ] "What's your remediation plan?" → reference P0/P1 log + v1.4.1 timeline

- [ ] **Final sign-off** (2 hrs)
  - [ ] CTO review: evidence package complete? COMPLIANCE_SNAPSHOT.json accurate? Auditor briefing ready?
  - [ ] RT review: remediation log reasonable? All P0 items fixed? P1 timeline commits realistic?
  - [ ] Compliance Lead final checklist:
    - [ ] All blocks A–J audited + scored
    - [ ] Evidence artifacts = 40+ files organized
    - [ ] RDC 978 mapping 100% (15/15)
    - [ ] Remediation plan (P0 closed, P1 documented)
    - [ ] Auditor briefing + pre-call ready
    - [ ] → **Ready for pre-approval call**

---

## Anticipated Auditor Questions + Talking Points

### Question 1: "How do you know you're at 88%?"

**Talking Point:** Block-by-block audit (40+ requirements audited). Evidence artifacts per block (PDFs, JSON, screenshots). Weighted average: (Block A 92% + Block B 92% + ... + Block J 78%) / 10 blocks = 88.5%.

### Question 2: "Gap [X] — why deferred to v1.4.1?"

**Talking Point:** Assessment of criticality + timeline. [Example: Well-being surveys (5.1.11) deferred because not patient-safety critical; covered by quarterly staff feedback mechanism; v1.4.1 committed for formal questionnaire.] Compensating control documented.

### Question 3: "Management review — first cycle is Phase 14. How do I verify 4.15?"

**Talking Point:** Template live + 15-point checklist configured + auto-aggregation logic tested. First ata will be scheduled Q3 2026 (post-launch). Pre-audit coverage by template validation + auditor can observe first review if timing aligns.

### Question 4: "Personnel dossiè data migration — how complete?"

**Talking Point:** Phase 1 backfill job migrated records from v1.3 (EC module, auth system, turnos, biosseguranca). Phase 9 completeness audit flagged <10% gaps (minor fields). Non-critical records (well-being assessments) noted in P1 log.

### Question 5: "Lab apoio contracts — when did you finalize?"

**Talking Point:** Phase 0 (RDC Art. 36–39 blocker). All 6 mandatory clauses present. [# active support labs] monitored. On-site audits scheduled [date]. Participation records available.

### Question 6: "NOTIVISA — production or test?"

**Talking Point:** Phase 8 integration [current status]. Gov API endpoint: [test/prod]. Submission workflow: [draft → RT approval → auto-submit → status tracking]. Fallback: manual API if rate-limit hits (contingency SOP in SGD).

### Question 7: "What's your compliance target drift — why 88% not 90%?"

**Talking Point:** Risk-based scope. 88% covers all RDC 978 mandatory articles + DICQ critical path. 90%+ requires patient portal phase 2 (v1.5) + full staff well-being program (v1.5) + internal audit multi-year trend (available post-2027). Defensible conservative estimate.

---

## Go/No-Go Checklist — Phase 13 Completion

**Before pre-approval call:**

- [ ] All 10 blocks audited (A–J)
- [ ] ≥88% conformance confirmed (block scores average ≥88%)
- [ ] RDC 978: 15/15 articles mapped + evidence per article
- [ ] Evidence package: 40+ artifacts organized + manifest complete
- [ ] Remediation log: P0 items fixed + re-verified; P1 items documented
- [ ] Auditor briefing: PDF + talking points ready
- [ ] Pre-call scheduled: CTO + RT + Compliance Lead confirmed
- [ ] RT sign-off: "Ready for external audit" (Yes/Conditional/No)

**If all checks pass → Schedule pre-approval call → Proceed to external audit (2026-10-15)**

**If checks incomplete → Identify blocker → Fix in 24–48 hrs → Re-verify → Schedule call**

---

## Team Communication Template

**Daily Standup (5 min, EOD)**

```
Block(s) audited today: [A–B / C–D / E–F / G–H / I–J]
Evidence artifacts collected: [#/40]
Gaps identified: [0 critical, # major, # minor]
Blockers: [none / describe]
EOD status: ✓ On track / 🟡 Minor delay / 🔴 Blocked
```

**Weekly Summary (Friday EOD)**

```
Week 1 Completion: Blocks A–H audited, evidence 100%
Week 1 Gaps: [P0 list] / [P1 list]
Remediation Status: [P0 items fixed: #/# / in progress: #/# / pending: #/#]
Next week: Blocks I–J + remediation + evidence packaging
CTO awareness: [Any escalations?]
```

---

## Success Criteria — Phase 13 Complete

✅ **Audit checklist 100% complete**

- All 10 blocks audited (A–J)
- Block-level scores recorded (conformance %)
- All evidence artifacts exported (PDFs, JSON, CSV, screenshots)

✅ **Compliance target met or at-risk documented**

- ≥88% conformance verified (or confidence interval 86–92% explained)
- Block scores justify target claim
- Remediation plan (if gaps) credible + approved

✅ **RDC 978 mapped 100%**

- All 15 applicable articles assigned to modules
- Evidence per article in evidence package
- Critical-path articles (36–39, 77, 122) signed off as complete

✅ **Remediation finalized**

- P0 items: fixed + re-verified + RT approved
- P1 items: documented + v1.4.1 timeline committed + tracked in project management

✅ **Auditor materials ready**

- Briefing PDF (module map + decision framework + known gaps)
- Evidence package (organized, spot-checked, PII reviewed)
- Pre-call agenda + talking points

✅ **Internal sign-off**

- CTO: "Audit-ready yes/no/conditional"
- RT: "Compliance snapshot approved, sign-off on record"
- Compliance Lead: "Phase 13 execution complete, evidence integrity certified"

---

**Phase 13 Kickoff:** Week of May 13, 2026  
**Phase 13 Completion Target:** May 24, 2026 (Friday EOD)  
**External Audit:** October 15–31, 2026

**Good luck.** 🎯
