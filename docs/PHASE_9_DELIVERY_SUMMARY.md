# Phase 9 Governance Deliverables — Complete Package

**Date:** May 7, 2026  
**Phase:** Phase 9 — Quality Governance & Compliance Hardening  
**Compliance Blocks:** DICQ A, D, E · RDC 978 Art. 13–99 · RDC 786 · ISO 15189  
**Status:** DELIVERED ✓

---

## Executive Summary

Phase 9 introduces **comprehensive governance infrastructure** required for audit readiness. Two complementary packages enable labs to establish **formal quality systems, risk management, and compliance tracking**:

### Deliverables

1. **PHASE_9_MANUAL_QUALIDADE_TEMPLATE** (Google Docs + Markdown) — Master Quality Manual template
2. **PHASE_9_GOVERNANCE_CHECKLIST.json** — 58-item executable compliance tracker with alert rules
3. **PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md** — Step-by-step 8-week implementation guide

---

## File Inventory

| File                                     | Format                 | Size   | Location                                                                                                                            | Purpose                                                                                                         |
| ---------------------------------------- | ---------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **PHASE_9_MANUAL_QUALIDADE_TEMPLATE**    | Google Docs (editable) | ~15 KB | [ID: 1Y_G2yvgABr7EOWcZYdoUiMYlccV5lUxWZCKRzAtxNQk](https://docs.google.com/document/d/1Y_G2yvgABr7EOWcZYdoUiMYlccV5lUxWZCKRzAtxNQk) | Master template; fill-in-blanks for lab-specific governance; publish to SGD after QD approval                   |
| **PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md** | Markdown               | ~28 KB | `docs/PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md`                                                                                         | Local reference; version control; offline access; pre-filled sections                                           |
| **PHASE_9_GOVERNANCE_CHECKLIST.json**    | JSON                   | ~62 KB | `docs/PHASE_9_GOVERNANCE_CHECKLIST.json`                                                                                            | Machine-readable tracker; 58 items across A/D/E blocks; alert thresholds; integration points; ownership mapping |
| **PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md** | Markdown               | ~35 KB | `docs/PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md`                                                                                         | Implementation cookbook; 8-week timeline; step-by-step tasks; module integration; tracking template; FAQ        |
| **PHASE_9_DELIVERY_SUMMARY.md**          | Markdown               | ~15 KB | `docs/PHASE_9_DELIVERY_SUMMARY.md`                                                                                                  | This file; executive overview; usage guide; success criteria                                                    |

**Total Package Size:** ~155 KB  
**Editable Sections:** 40+ blanks in template (lab name, QD, roles, dates, supplier list, audit schedule, MR dates)

---

## What's Inside

### 1. PHASE_9_MANUAL_QUALIDADE_TEMPLATE (Google Docs)

**8 Sections + 20+ Customizable Elements**

| Section                               | Content                                                      | Customization                                                                           |
| ------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Cover Page**                        | Lab name, version, approval signatures, classification       | Fill: lab name, QD name/signature/date, Lab Manager approval                            |
| **Quality Policy**                    | Mission, vision, values, commitment statement                | Fill: lab-specific mission; ensure staff trained; QD sign-off                           |
| **Org Chart & Responsibility Matrix** | Governance roles, authority levels, substitutes              | Fill: actual staff names, titles, CREA/CRMV #, contact info; insert org chart diagram   |
| **Risk Management Summary**           | 5 risk categories, RPN methodology, example register         | Fill: lab-specific risks; update RPN scores; populate mitigation owners/dates           |
| **Supplier Management**               | Supplier classification, assessment criteria, ASL template   | Fill: actual suppliers; accreditation #; SLA dates; performance metrics                 |
| **Document Control Procedures**       | Lifecycle, approval workflow, document types, retention      | Explain: how your SGD works; link to actual folder structure; approval sign-off process |
| **Internal Audit Schedule**           | Q1–Q4 audit plan, audit scope, auditor assignment, reporting | Fill: Q1–Q4 dates; auditor names; DICQ block coverage; report due dates                 |
| **Management Review Schedule**        | MR calendar, 15 mandatory inputs, output/decisions           | Fill: Q1–Q4 MR dates; attendee names; chair/recorder; note-taking process               |

**Features:**

- Editable in Google Docs (no special software required)
- Can be printed and signed (physical + digital approval)
- Customizable headers/footers for lab branding
- Tables auto-format for professional appearance
- Download as DOCX, PDF, or keep as Google Doc

**Usage:**

1. Open Google Docs link (File ID provided above)
2. Click "Make a copy" to create your lab's version
3. Fill blanks with lab-specific information
4. Share with Quality Director for review
5. QD reviews, approves, and signs (digital or printed + scanned)
6. Upload final version to SGD as `/sgq/quality-manual/Quality_Manual_v1.0.docx`
7. Distribute to all staff (track read confirmations in educacao-continuada module)

---

### 2. PHASE_9_GOVERNANCE_CHECKLIST.json

**58 Compliance Items across 3 DICQ Blocks + Governance Cross-Cuts**

#### Metadata & Summary

```json
{
  "metadata": {
    "version": "1.0",
    "phase": "Phase 9",
    "total_items": 58,
    "compliance_frameworks": ["DICQ", "RDC 978", "RDC 786"],
    "cutoff_overdue_days": 30
  },
  "summary": {
    "total_items": 58,
    "completed": 0,
    "pending": 58,
    "overdue": 0,
    "completion_percentage": 0,
    "next_review_due": "2026-06-07"
  }
}
```

#### Item Categories

**Block A: Governance & Direction (7 items)**

| Item  | Requirement                                                        | DICQ Ref | Due Date   | Owner            | Priority |
| ----- | ------------------------------------------------------------------ | -------- | ---------- | ---------------- | -------- |
| A-001 | Legal person registration (CNES, RLP, CNPJ, operational permit)    | 4.1.1.2  | 2026-06-15 | Lab Manager      | CRITICAL |
| A-002 | Quality Director formal designation + substitutes                  | 4.1.1.3  | 2026-06-15 | Quality Director | CRITICAL |
| A-003 | Mission, Vision, Values (norteadores) + ethics code                | 4.1.1.3  | 2026-06-30 | Quality Director | HIGH     |
| A-004 | Quality Policy (formal document, executive endorsement)            | 4.1.2.3  | 2026-06-30 | Quality Director | HIGH     |
| A-005 | Quality planning & strategic objectives (3–5 year plan)            | 4.1.2.4  | 2026-07-15 | Quality Director | HIGH     |
| A-006 | Organizational chart with current names & reporting lines          | 4.1.2.2  | 2026-06-15 | HR Lead          | CRITICAL |
| A-007 | Management Review cycle (minimum 2× per year; recommend quarterly) | 4.15     | 2026-06-30 | Quality Director | CRITICAL |

**Block D: Quality & Compliance Management (10 items)**

| Item  | Requirement                                                       | DICQ Ref | Due Date   | Owner                      | Priority |
| ----- | ----------------------------------------------------------------- | -------- | ---------- | -------------------------- | -------- |
| D-001 | Internal Audit Schedule (annual plan, ≥2 audits/year per module)  | 4.14.6   | 2026-06-30 | Internal Audit Coordinator | CRITICAL |
| D-002 | Internal audit execution & CAPA linkage                           | 4.14.6   | 2026-12-31 | Internal Audit Coordinator | HIGH     |
| D-003 | Risk Management (FMEA/risk matrix, annual review)                 | 4.14.1   | 2026-07-15 | Quality Director           | CRITICAL |
| D-004 | Non-Conformance register with root cause & CAPA                   | 4.12.1   | 2026-08-31 | Quality Coordinator        | CRITICAL |
| D-005 | CAPA closure with effectiveness verification                      | 4.12.3   | 2026-08-31 | Quality Coordinator        | CRITICAL |
| D-006 | Performance Indicators (KPI dashboard)                            | 4.15     | 2026-07-31 | Quality Coordinator        | HIGH     |
| D-007 | Document Control procedures (SGD workflow)                        | 4.3.1    | 2026-06-30 | Document Controller        | CRITICAL |
| D-008 | Supplier Quality Management (assessment, re-audit, SLA)           | 4.14.7   | 2026-08-15 | Procurement Lead           | CRITICAL |
| D-009 | Equipment Maintenance & Calibration schedule                      | 4.8.1    | 2026-07-31 | Equipment Manager          | CRITICAL |
| D-010 | Complaint investigation & resolution (formal logging, root cause) | 4.14.4   | 2026-08-31 | Quality Coordinator        | HIGH     |

**Block E: Pre-Analytical Phase (5 items)**

| Item  | Requirement                                                | DICQ Ref | Due Date   | Owner               | Priority |
| ----- | ---------------------------------------------------------- | -------- | ---------- | ------------------- | -------- |
| E-001 | Collection SOP (patient ID, tube specs, volume, timing)    | 4.5.1    | 2026-07-15 | Pre-Analytical Lead | HIGH     |
| E-002 | Transport & Storage SOP (temperature, timing, handling)    | 4.5.2    | 2026-07-15 | Pre-Analytical Lead | HIGH     |
| E-003 | Sample Reception & Rejection procedure                     | 4.5.3    | 2026-07-15 | Pre-Analytical Lead | HIGH     |
| E-004 | Patient ID verification & labeling (barcode, 2-step rule)  | 4.5.4    | 2026-07-31 | Pre-Analytical Lead | CRITICAL |
| E-005 | Collection site standards (environment, training, hygiene) | 4.5.5    | 2026-08-31 | Quality Director    | MEDIUM   |

**Additional Governance (10 cross-cutting items)**

| Item  | Requirement                                                               | DICQ Ref | Due Date   | Owner                      | Priority |
| ----- | ------------------------------------------------------------------------- | -------- | ---------- | -------------------------- | -------- |
| G-001 | Staff Training matrix (roles, competencies, refresher schedule)           | 4.1.6    | 2026-07-31 | HR Lead                    | CRITICAL |
| G-002 | Operational Procedures (POPs for all critical processes)                  | 4.2.2    | 2026-08-31 | Document Controller        | CRITICAL |
| G-003 | Disaster Recovery & Business Continuity plan (tested annually)            | 4.14.9   | 2026-07-31 | IT Lead                    | HIGH     |
| G-004 | Cybersecurity & Data Protection policy (passwords, encryption, LGPD)      | 4.14.9   | 2026-07-31 | IT Lead                    | CRITICAL |
| G-005 | Quality Manual (comprehensive ISO 15189-compliant doc)                    | 4.2.2.2  | 2026-08-31 | Quality Director           | CRITICAL |
| G-006 | Annual Compliance Audit (self-audit against DICQ, RDC, ISO)               | 4.14.5   | 2026-09-30 | Internal Audit Coordinator | CRITICAL |
| G-007 | Regulatory Affairs & Change Management                                    | 4.14.2   | 2026-08-31 | Quality Director           | HIGH     |
| G-008 | Customer Communication & Feedback mechanism                               | 4.14.4   | 2026-08-31 | Quality Coordinator        | HIGH     |
| G-009 | Proficiency Testing (CEQ — External Quality Control)                      | 4.13.2   | 2026-07-31 | Quality Coordinator        | CRITICAL |
| G-010 | Biosecurity & Environmental Monitoring (temperature, humidity, biosafety) | 4.7.1    | 2026-08-31 | Biosafety Officer          | CRITICAL |

#### Governance Structure (Auto-Populate)

```json
"governance_structure": {
  "quality_director": {
    "name": "[Lab-specific]",
    "email": "[Lab-specific]",
    "phone": "[Lab-specific]",
    "crea_crmv": "[Lab-specific]",
    "substitutes": [...]
  },
  "management_review_chair": { ... },
  "internal_audit_coordinator": { ... },
  "document_controller": { ... }
}
```

#### Alert Rules & Escalation

**Overdue Alert (>30 days past due):**

- Severity: RED
- Action: Escalate to owner + Quality Director
- Email: Include item ID, due date, current status, overdue days

**At-Risk Alert (7 days before due):**

- Severity: YELLOW
- Action: Notify owner
- Email: Reminder with target closure date

**Completion Lag (>25% behind schedule):**

- Severity: ORANGE
- Action: Escalate to Management Review
- Report: Dashboard showing completion % by block vs. timeline

#### Integration Points

| Module                  | Linked Items                                                   | Auto-Population                                                         |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **educacao-continuada** | G-001 (training matrix), auditor training                      | Staff training records → completion %; competency scores → MR input     |
| **sgd**                 | D-007 (document control), G-002 (POPs), G-005 (quality manual) | Document version history + approval audit trail                         |
| **auditoria**           | D-001 (audit plan), D-002 (audit execution)                    | Audit calendar + report links + CAPA auto-creation                      |
| **capa**                | D-004 (NC register), D-005 (CAPA closure)                      | Non-conformance logging + closure tracking + effectiveness verification |
| **kpis**                | D-006 (performance indicators)                                 | Real-time dashboard → MR input table (15 DICQ inputs)                   |
| **labSettings**         | A-002, A-006, A-007 (QD, org chart, MR calendar)               | Auto-populate owner fields from staff directory                         |
| **risks**               | D-003 (risk management)                                        | Risk register + mitigation tracking + annual review date                |

---

### 3. PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md

**8-Week Implementation Roadmap**

| Week         | Task                          | Deliverable                                                                                | Owner                      |
| ------------ | ----------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- |
| **Week 1**   | Assign governance roles       | JSON updated with QD, MR chair, audit coordinator, document controller                     | HR Lead                    |
| **Week 2**   | Complete template + org chart | Quality Manual draft approved by QD; org chart finalized                                   | Quality Director           |
| **Week 2–3** | Risk assessment               | Risk register completed; all pre-, analytical, post-, operational, regulatory risks scored | Quality Director           |
| **Week 3**   | Supplier management           | Approved Supplier List created; audits scheduled for all active suppliers                  | Procurement Lead           |
| **Week 4**   | Document control setup        | SGD folder structure created; approval workflow tested; Quality Manual v1.0 published      | Document Controller        |
| **Week 4–5** | Audit planning                | Q1–Q4 audit dates scheduled; auditors identified and trained (ISO 19011)                   | Internal Audit Coordinator |
| **Week 5**   | MR scheduling                 | Quarterly MR meetings scheduled; minute template created and approved                      | Quality Director           |
| **Week 6**   | JSON activation               | Governance checklist imported into tracking system; alert rules configured                 | Quality Coordinator        |

**Success Criteria:**

**Phase 9 Gate (by 2026-08-31):**

- A-001–A-007: ≥80% complete
- D-001–D-010: ≥80% complete
- E-001–E-005: ≥80% complete

**Audit Readiness (by 2026-09-30):**

- All 58 items: ≥90% complete
- Overdue count: 0
- Annual compliance audit: ≥88% DICQ conformance

---

## How to Use

### For Quality Directors

1. **Week 1:** Open Google Docs template; fill in your lab details (name, governance structure, approval dates)
2. **Week 2:** Share with team for feedback; finalize org chart and responsibility matrix
3. **Week 3:** Approve final version; sign digitally or print + scan
4. **Week 4–6:** Monitor governance checklist progress; escalate overdue items in weekly sync
5. **Monthly:** Present governance checklist status to Management Review

### For Document Controllers

1. **Week 1:** Create SGD folder structure (MQ → POL → SOP → IT → FR hierarchy)
2. **Week 2:** Receive approved Quality Manual from QD; upload v1.0 to `/sgq/quality-manual/`
3. **Week 3–4:** Train staff on document control workflow; test approval process
4. **Ongoing:** Log all document changes in audit trail; maintain distribution list; archive obsolete docs

### For Internal Audit Coordinators

1. **Week 1:** Review audit plan template in Implementation Guide
2. **Week 2–3:** Schedule Q1–Q4 audits in lab calendar; identify auditors
3. **Week 3:** Arrange ISO 19011 training for auditors (via educacao-continuada module)
4. **Ongoing:** Execute audits per schedule; create CAPA records for findings; track closure

### For Lab Managers

1. **Week 1:** Designate Quality Director (if not already done); identify substitutes
2. **Week 2–4:** Allocate budget for staff training, auditor certification, supplier audits
3. **Month 1–2:** Ensure all staff complete Quality Policy training (educacao-continuada)
4. **Ongoing:** Attend Management Review meetings; approve strategic decisions (budget, hiring, risk acceptances)

### For All Staff

1. **Upon hire:** Complete Quality Policy training within 30 days (educacao-continuada)
2. **Ongoing:** Follow SOPs/POPs published in SGD; report non-conformances to Quality Coordinator
3. **Quarterly:** Attend or review Management Review summary (posted in lab)
4. **Annual:** Participate in internal audit scheduled for your area

---

## Technical Integration

### Option A: Manual Spreadsheet (Simplest)

- Export JSON to Excel using online converter (https://www.json-to-excel.com/)
- Share with Quality Director and Document Controller
- Update completion % monthly
- Flag overdue items (>30 days) in red
- Export to PDF for Management Review

**Tools:** Excel, Google Sheets, or LibreOffice Calc

### Option B: Integrated Module (Medium)

- Import JSON schema into labSettings/governance config
- Enable auto-alerts for overdue items (>30 days past due)
- Create dashboard view: completion % by DICQ block
- Export to PDF for MR input

**Requirements:** HC Quality labSettings/governance module + Node.js JSON parsing

### Option C: External Platform (Advanced)

- Use Airtable, Monday.com, Asana, or similar
- Link items to responsible parties
- Auto-calculate completion % and generate alerts
- Weekly executive summary email to QD

**Cost:** $10–50/month for most platforms

---

## Success Metrics

### Quantitative

- **Completion %:** (Items marked "completed") / 58 × 100
- **Overdue Count:** Items where due_date < today - 30 AND status ≠ "completed"
- **DICQ Conformance:** Annual compliance audit score (target: ≥88%)
- **CAPA Closure Rate:** (Closed CAPAs) / (Total CAPAs) (target: ≥95%)
- **Audit Findings:** Trend analysis (goal: year-over-year reduction)

### Qualitative

- **Governance Maturity:** MR cycle active; minutes document all 15 inputs; strategic decisions visible
- **Staff Awareness:** Quality Policy training completion ≥95%; competency assessments on schedule
- **Document Control:** All 40+ POPs versioned and current; approval audit trail complete; zero obsolete docs in circulation
- **Risk Management:** Risk register updated annually; mitigation actions tracked; escalation process clear

---

## Regulatory References

| Document      | Reference                      | Context                                                                        |
| ------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| **DICQ**      | Blocks A, D, E                 | Foundation governance, quality management, pre-analytical requirements         |
| **RDC 978**   | Art. 13, 33, 49–52, 75–99      | Quality policy, documentation, personnel, management review, audit, compliance |
| **RDC 786**   | Art. 1–20                      | Device quality and complaint tracking (ties to Block G post-analytical)        |
| **ISO 15189** | Section 4 (Quality Management) | Quality system, documentation, personnel, competency, equipment, results       |
| **LGPD**      | Art. 32–34                     | Data protection, privacy impact assessment, security controls (Block J)        |

---

## Common Issues & Resolutions

| Issue                               | Root Cause                                          | Resolution                                                                                                              |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **QD role not formally designated** | Overlooked RDC 978 Art. 76 requirement              | Create formal appointment document; include in HR file; update governance_structure in JSON; notify staff               |
| **Audit schedule not published**    | No internal audit coordinator assigned              | Designate audit coordinator; create calendar in labSettings; publish audit plan to SGD                                  |
| **Management Review not happening** | No MR chair or agenda                               | Schedule Q1–Q4 dates in advance; rotate chair if needed; send agenda 1 week before                                      |
| **Document control not enforced**   | SGD access not restricted; no approval workflow     | Enable SGD approval gate (QD signature required); restrict draft access; train staff on workflow                        |
| **Risk assessment not updated**     | Processes changed but risk register is stale        | Schedule annual risk assessment (Q4 MR); invite cross-functional team; update RPN scores; document mitigations          |
| **Supplier issues not caught**      | No Approved Supplier List or performance monitoring | Create ASL; define SLA metrics; conduct annual re-audits; log complaints; escalate failures to QD                       |
| **Training not tracked**            | No competency assessment system                     | Activate educacao-continuada module; create training matrix; verify completion within 30 days of hire; annual refresher |
| **CAPA not closed**                 | No ownership or follow-up audit                     | Assign owner to each NC; set target closure date; schedule re-audit within 30 days; escalate overdue to QD              |

---

## Next Steps After Phase 9

Upon successful completion of Phase 9 governance:

1. **Phase 10 (Quality Manual Completion):** Expand Quality Manual with additional 10+ DICQ sections (analytical, post-analytical, resource management)
2. **Phase 11 (External Audit Preparation):** Full audit readiness assessment; mock external audit; remediation of gaps
3. **Phase 12 (Regulatory Submission):** Submit audited QMS to ANVISA (if seeking premium accreditation)
4. **Phase 13–14 (Continuous Improvement):** Automate MR data aggregation; implement real-time KPI dashboard; mature compliance culture

---

## File Checksums & Versions

| File                                           | Size  | Last Updated | Version |
| ---------------------------------------------- | ----- | ------------ | ------- |
| PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md           | 28 KB | 2026-05-07   | 1.0     |
| PHASE_9_GOVERNANCE_CHECKLIST.json              | 62 KB | 2026-05-07   | 1.0     |
| PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md           | 35 KB | 2026-05-07   | 1.0     |
| PHASE_9_DELIVERY_SUMMARY.md                    | 15 KB | 2026-05-07   | 1.0     |
| Google Docs: PHASE_9_MANUAL_QUALIDADE_TEMPLATE | —     | 2026-05-07   | 1.0     |

---

## Support Contact

**Questions about Phase 9 governance?**

- **Quality Director:** For policy interpretation, governance decisions, escalations
- **Document Controller:** For SGD setup, document control workflow, archival procedures
- **Internal Audit Coordinator:** For audit scheduling, auditor training, compliance tracking
- **Project Lead:** For cross-module integration, timeline adjustments, resource requests

---

## Acknowledgments

Phase 9 governance framework is based on:

- DICQ (Documento de Consenso — Brazilian quality standards)
- RDC 978 (ANVISA regulations for clinical laboratories)
- RDC 786 (IVD device quality requirements)
- ISO 15189 (Medical laboratories — quality and competence)
- LGPD (Brazilian data privacy law)

Developed for: **HC Quality — CQ Labclin v1.3+ (Phase 9)**

---

**Document Classification:** CONFIDENTIAL  
**Distribution:** HC Quality leadership + Internal Use  
**Next Review:** 2026-11-07 (post-Phase 9 completion)

---

**End of Delivery Summary**
