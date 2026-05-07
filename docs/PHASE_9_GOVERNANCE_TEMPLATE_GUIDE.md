# Phase 9 Governance Template & Checklist — Implementation Guide

**Date:** May 7, 2026  
**Version:** 1.0  
**Scope:** PHASE_9_MANUAL_QUALIDADE_TEMPLATE + PHASE_9_GOVERNANCE_CHECKLIST.json  
**Audience:** Quality Directors, Document Controllers, Internal Audit Coordinators, Lab Managers  

---

## Overview

Phase 9 governance deliverables establish **foundational compliance infrastructure** across DICQ Blocks A, D, and E. Two complementary files work together:

1. **PHASE_9_MANUAL_QUALIDADE_TEMPLATE** — Editable master governance document (Quality Manual template in Google Docs + Markdown for local reference)
2. **PHASE_9_GOVERNANCE_CHECKLIST.json** — Executable compliance tracker with 58 governance items, alert rules, owner assignment, and integration points

Together, these files enable labs to:
- Document governance decisions and organizational structure
- Assign accountability with due dates
- Track compliance across DICQ blocks with measurable progress
- Escalate overdue items automatically (>30 days)
- Feed audit readiness data to Management Review

---

## File Locations

| File | Format | Location | Purpose |
|------|--------|----------|---------|
| **PHASE_9_MANUAL_QUALIDADE_TEMPLATE** | Google Docs (editable) | Google Drive: [File ID: 1Y_G2yvgABr7EOWcZYdoUiMYlccV5lUxWZCKRzAtxNQk](https://docs.google.com/document/d/1Y_G2yvgABr7EOWcZYdoUiMYlccV5lUxWZCKRzAtxNQk) | Master template; fill in lab-specific details; publish to SGD after approval |
| **PHASE_9_MANUAL_QUALIDADE_TEMPLATE** | Markdown | `C:\hc quality\docs\PHASE_9_MANUAL_QUALIDADE_TEMPLATE.md` | Local reference; version control; offline access |
| **PHASE_9_GOVERNANCE_CHECKLIST.json** | JSON | `C:\hc quality\docs\PHASE_9_GOVERNANCE_CHECKLIST.json` | Machine-readable tracker; integrates with labSettings/governance, sgd, auditoria modules |
| **This Guide** | Markdown | `C:\hc quality\docs\PHASE_9_GOVERNANCE_TEMPLATE_GUIDE.md` | Step-by-step implementation instructions |

---

## Phase 9 Gate Criteria

**All labs must achieve:**

- **A-001 through A-007** ≥80% complete by 2026-08-31 (governance foundation)
- **D-001 through D-010** ≥80% complete by 2026-08-31 (quality/compliance infrastructure)
- **E-001 through E-005** ≥80% complete by 2026-08-31 (pre-analytical procedures)

**Audit Readiness:**

- All items ≥90% complete by 2026-09-30
- Overdue count = 0
- Annual compliance audit score ≥88% (DICQ conformance)

---

## Step-by-Step Implementation

### Step 1: Assign Governance Roles (Week 1)

**Action:** Designate individuals for each governance position.

**Roles Required:**

| Role | Typical Seniority | Mandatory? | Owner in JSON |
|------|------------------|-----------|---------------|
| Quality Director | Executive | YES | `governance_structure.quality_director` |
| Management Review Chair | Executive / Senior | YES | `governance_structure.management_review_chair` |
| Internal Audit Coordinator | Senior / Staff | YES | `governance_structure.internal_audit_coordinator` |
| Document Controller | Senior / Staff | YES | `governance_structure.document_controller` |

**Update JSON:**

Edit `PHASE_9_GOVERNANCE_CHECKLIST.json`:

```json
"governance_structure": {
  "quality_director": {
    "name": "[YOUR QD NAME]",
    "email": "[YOUR QD EMAIL]",
    "phone": "[YOUR QD PHONE]",
    "crea_crmv": "[CREA/CRMV #]",
    "since": "2026-05-07",
    "substitutes": [
      { "name": "[SUBSTITUTE 1]", "crea_crmv": "[#]", "since": "2026-05-07" },
      { "name": "[SUBSTITUTE 2]", "crea_crmv": "[#]", "since": "2026-05-07" }
    ]
  },
  ...
}
```

**Track in Module:** `labSettings/governance`  
**Evidence:** HR records + organizational chart + CREA/CRMV registration copies

---

### Step 2: Complete Quality Policy & Organizational Chart (Week 2)

**Action:** Fill in the governance template with lab-specific information.

**Use the Template:**

1. Download or access **PHASE_9_MANUAL_QUALIDADE_TEMPLATE** from Google Drive
2. Fill in blanks (lab name, Quality Director, dates, roles, contact info)
3. Insert organizational chart diagram (can be hand-drawn and scanned, or Lucidchart/Visio export)
4. Complete responsibility matrix with actual staff names

**Key Sections to Customize:**

- **Cover Page:** Lab name, version, approval dates
- **Quality Policy:** Add lab-specific mission/values; ensure all staff are trained
- **Organizational Chart:** Insert actual structure with reporting lines and CREA/CRMV numbers
- **Governance Contacts Table:** Real phone numbers and emails
- **Risk Register:** Populate with lab-specific risks (pre-analytical, analytical, operational)
- **Supplier List:** List actual reagent suppliers, equipment vendors, referral partners
- **Audit Schedule:** Align dates with actual Q1–Q4 planning
- **MR Schedule:** Schedule actual Management Review dates for 2026

**Update JSON Checklist:**

Mark A-003 (Norteadores), A-004 (Quality Policy), A-006 (Org Chart) as "in_progress":

```json
{
  "id": "A-004",
  "status": "in_progress",
  "completion_date": null,
  "completion_percentage": 75  // e.g., draft approved, awaiting printing
}
```

**Track in Module:** `sgd/quality-documents/norteadores/` and `sgd/quality-manual/`  
**Evidence:** Signed QD approval; staff training records in educacao-continuada

---

### Step 3: Risk Assessment & Register (Week 2–3)

**Action:** Complete annual risk assessment using methodology in Section 3.2.

**Methodology:**

1. **Identify Risks:** Brainstorm across 5 categories (pre-analytical, analytical, post-analytical, operational, regulatory)
2. **Score Each Risk:** RPN = Probability (1–5) × Severity (1–5) × Detection (1–5)
3. **Prioritize:** Focus first on High (75–125) and Medium (25–74) risks
4. **Plan Mitigation:** Assign owner and target date for each High/Medium risk
5. **Document:** Record in `/risks/risk-register.xlsx` module

**Example Risk Register Entry:**

```
Risk: Sample mislabeling
Category: Pre-analytical
Probability: 3 (possible; human factor)
Severity: 5 (critical; results sent to wrong patient)
Detection: 3 (detected at lab reception; not at collection site)
RPN: 3 × 5 × 3 = 45 (Medium Risk)
Mitigation: Barcode system + 2-step ID verification at collection and lab
Owner: Pre-Analytical Lead
Target Closure: 2026-07-15
```

**Update JSON Checklist:**

Mark D-003 as "pending":

```json
{
  "id": "D-003",
  "status": "pending",
  "due_date": "2026-07-15",
  "owner": "Quality Director"
}
```

**Track in Module:** `risks/risk-register.xlsx`  
**Evidence:** Risk spreadsheet + mitigation action tracking

---

### Step 4: Supplier Management & Approved Supplier List (Week 3)

**Action:** Audit and document all active suppliers.

**For Each Supplier Type:**

| Type | Assessment | Frequency | Documents |
|------|-----------|-----------|-----------|
| Reagent & Calibrator | ISO 13485 cert OR QMS doc | Triennial | ASL entry + cert scan + SLA |
| Calibration Service | ISO 17025 cert + response SLA | Annual | ASL entry + cert + SLA + performance log |
| Equipment Maintenance | Service contract + SLA | Annual | ASL entry + contract + uptime log |
| Lab Support / Referral | CAP/CLIA/ISO accreditation | Annual | ASL entry + accreditation cert + complaint log |

**Create Approved Supplier List (ASL):**

```
Supplier Name | Type | Accreditation | Contact | SLA | Last Audit | Next Audit Due
Reanalitica | Reagent | ISO 13485 | contratos@reanalitica.com.br | On-time delivery >95% | 2026-04-15 | 2027-04-15
Bio-Rad | QC/Calibrator | ISO 13485 | br@bio-rad.com | CV <5% | 2026-04-20 | 2027-04-20
Metrolab | Calibration | ISO 17025 | calibracao@metrolab.com.br | Response ≤24h | 2026-05-01 | 2027-05-01
```

**Update JSON Checklist:**

Mark D-008 and items in "governance_structure" as "in_progress":

```json
{
  "id": "D-008",
  "status": "in_progress",
  "completion_percentage": 60,  // 6 of 10 suppliers audited
  "due_date": "2026-08-15"
}
```

**Track in Module:** `fornecedores/approved-supplier-list.xlsx`  
**Evidence:** ASL spreadsheet + supplier audit reports + SLA documentation

---

### Step 5: Document Control System Setup (Week 4)

**Action:** Implement SGD approval workflow; establish document hierarchy.

**Hierarchy:**

```
Quality Manual (MQ)
  └─ Quality Policies (POL)
      └─ Standard Operating Procedures (SOP)
          └─ Work Instructions (IT)
              └─ Forms (FR)
```

**Approval Workflow (Example):**

```
Author Draft 
  → [Manager Review] 
  → QD Approval (sign + date)
  → Archive as "Active" in SGD
  → Distribute with read confirmation
  → [Every 3 years: review]
  → Archive as "Obsolete" when superseded
```

**Setup Steps:**

1. **Create SGD Folder Structure:** In Drive, create `/sgq/quality-documents/` with subfolders:
   - `/sgq/quality-documents/quality-manual/`
   - `/sgq/quality-documents/policies/`
   - `/sgq/quality-documents/sops/`
   - `/sgq/quality-documents/instructions/`
   - `/sgq/quality-documents/forms/`

2. **Upload Template:** Save completed PHASE_9_MANUAL_QUALIDADE_TEMPLATE as version 1.0 in `/sgq/quality-manual/`

3. **Create Approval Workflow:** In SGD module, enable approval workflow:
   - Require QD signature before "published" status
   - Log distribution date and recipient list
   - Auto-archive superseded versions

4. **Train Staff:** All staff must read and sign acknowledgment of Quality Manual within 30 days of hire

**Update JSON Checklist:**

Mark D-007 (Document Control) as "in_progress":

```json
{
  "id": "D-007",
  "status": "in_progress",
  "completion_percentage": 70,  // SGD structure in place; workflows in testing
  "due_date": "2026-06-30"
}
```

**Track in Module:** `sgd/` (audit trail per RDC 978 5.3)  
**Evidence:** SGD audit log + approval signature scans + distribution list + staff read confirmations

---

### Step 6: Internal Audit Planning (Week 4–5)

**Action:** Schedule Q1–Q4 audits; assign auditors; create audit plan.

**Annual Audit Schedule (Example):**

| Quarter | DICQ Blocks | Schedule | Auditor(s) | Format |
|---------|-------------|----------|-----------|--------|
| Q1 | Block A, B | Jan 15–Feb 28 | QC + Lab Manager | Walkaround + doc review |
| Q2 | Block D, E | Apr 1–May 31 | QC + Pre-Analytical Lead | Process walkthrough + SOP audit |
| Q3 | Block F, G | Jul 1–Aug 31 | QC + Technical Lead | Equipment audit + method review |
| Q4 | Block H–J | Oct 1–Nov 30 | QC + HR Lead | Infrastructure inspection + records |
| Annual | Full System | Sep–Nov | QC + External (optional) | Compliance checklist (115+ items) |

**Create Audit Plan Document:**

Save as SGD doc: `/auditoria/audit-plan-2026.xlsx`

```
Audit ID | Quarter | DICQ Blocks | Scheduled Dates | Primary Auditor | Secondary Auditor | Report Due | Status
AUD-Q1-2026 | Q1 | A, B | Jan 15–Feb 28 | [Name] | [Name] | Mar 31 | Scheduled
AUD-Q2-2026 | Q2 | D, E | Apr 1–May 31 | [Name] | [Name] | Jun 30 | Scheduled
AUD-Q3-2026 | Q3 | F, G | Jul 1–Aug 31 | [Name] | [Name] | Sep 30 | Scheduled
AUD-Q4-2026 | Q4 | H–J | Oct 1–Nov 30 | [Name] | [Name] | Dec 31 | Scheduled
AUD-Annual-2026 | Annual | A–J | Sep–Nov | [Name] | [Name] | Nov 30 | Planned
```

**Auditor Training:**

- All auditors must be trained on ISO 19011 or equivalent (via educacao-continuada module)
- Training completion recorded with certificate
- Auditors independent from auditee (no direct reporting relationship for conflict of interest)

**Update JSON Checklist:**

Mark D-001 (Audit Plan) as "completed":

```json
{
  "id": "D-001",
  "status": "completed",
  "completion_date": "2026-05-31",
  "completion_percentage": 100,
  "due_date": "2026-06-30"  // Already met
}
```

**Track in Module:** `auditoria/audit-plan-2026.xlsx` + training records in educacao-continuada  
**Evidence:** Audit calendar + auditor training certificates + planned audit checklist

---

### Step 7: Management Review Calendar (Week 5)

**Action:** Schedule quarterly MR meetings; designate MR chair and recorder.

**MR Schedule (Example — adjust to your lab):**

| Meeting | Date | Chair | Recorder | Attendees | Focus Area |
|---------|------|------|----------|-----------|-----------|
| Q1 MR | Mar 15, 2026 | QD | Quality Coordinator | QD, Lab Manager, Finance, Ops Manager | Year-start review; audit findings from prior year; CAPA status; KPI baseline |
| Q2 MR | Jun 15, 2026 | QD | Quality Coordinator | QD, Lab Manager, Finance, Ops Manager | H1 performance review; customer complaints trend; resource needs |
| Q3 MR | Sep 15, 2026 | QD | Quality Coordinator | QD, Lab Manager, Finance, Audit Lead | Pre-external audit readiness; compliance gaps; risk reassessment |
| Q4 MR | Dec 15, 2026 | QD | Quality Coordinator | QD, Lab Manager, Finance, All Dept Heads | Annual audit results; year-end KPI; 2027 quality plan approval |

**MR Minute Template:**

- Date, time, location, attendees (+ signatures)
- Each of 15 DICQ 4.15 inputs documented (brief notes)
- Decisions made (approvals, risk acceptances, resource allocations)
- Action items (owner, target date, success criteria)
- Quality Plan updates (if any)

**Update JSON Checklist:**

Mark A-007 (MR Cycle) as "completed":

```json
{
  "id": "A-007",
  "status": "completed",
  "completion_date": "2026-05-31",
  "completion_percentage": 100,
  "notes": "MR calendar scheduled; minute template created and approved"
}
```

**Track in Module:** `labSettings/governance/mr-calendar` + `sgq/management-review/` (minutes archive)  
**Evidence:** Published calendar + minute template + Q1 MR scheduled

---

### Step 8: JSON Checklist Activation (Week 6)

**Action:** Import governance checklist into compliance tracking system.

**Setup Options:**

**Option A: Manual Spreadsheet (Simplest)**
- Export JSON to Excel using `jq` or online converter
- Share with Quality Director and Document Controller
- Update completion % monthly
- Flag overdue items (>30 days past due) in red
- Export to Management Review input table

**Option B: Integrated Module (Medium)**
- If labSettings/governance module exists, import JSON schema as config
- Link items to owner fields from directory (auto-populate from organizational chart)
- Enable auto-alerts for overdue items (send email to owner + QD when >30 days past due)
- Dashboard shows completion % by DICQ block (A, D, E)
- Export to PDF for Management Review

**Option C: External Platform (Advanced)**
- Use Airtable, Monday.com, or similar for shared tracking
- Link each item to responsible party
- Auto-calculate completion % by category
- Conditional alerts (due within 7 days = yellow; >30 days overdue = red)
- Weekly executive summary email to QD

**Import Instructions (if using Option B in labSettings/governance):**

1. Copy JSON content from `PHASE_9_GOVERNANCE_CHECKLIST.json`
2. Import as `governance_checklist.json` in labSettings/governance config
3. In UI, create views by DICQ block (filter by `categories.A_GOVERNANCE`, `categories.D_QUALITY_COMPLIANCE`, etc.)
4. Set up alert rule: IF `due_date < today - 30` THEN send email to `owner` + `quality_director`
5. Monthly dashboard report: completion % by block + overdue item count

**Sample Alert Rule (pseudo-code):**

```javascript
if (item.status === "pending" && 
    item.due_date < today - 30 && 
    !item.completion_date) {
  sendEmailAlert({
    to: [item.owner, governanceStructure.quality_director.email],
    subject: `OVERDUE: ${item.requirement} (${item.id})`,
    body: `Item is ${daysOverdue} days overdue. Due date was ${item.due_date}. Please complete by [NEW TARGET DATE].`
  });
}
```

**Update JSON Checklist:**

Mark all items with status "pending" (don't change items yet):

```json
{
  "metadata": {
    "last_updated": "2026-05-31",
    "tracking_system": "Option A (Manual Spreadsheet)" // or B/C
  },
  "summary": {
    "total_items": 58,
    "completed": 7,  // A-007 + D-001 + others marked above
    "pending": 51,
    "overdue": 0,
    "completion_percentage": 12  // (7/58) × 100
  }
}
```

**Track in Module:** `labSettings/governance/checklist-config.json` (if using Option B) or spreadsheet share link (Option A)  
**Evidence:** Imported checklist + setup screenshots

---

## Integration Points

### educacao-continuada Module

**Linked Items:**

- **G-001 (Training Matrix):** Staff training records auto-populate from educacao-continuada module
- **Auditor Training:** Quality Coordinator + auditors must complete ISO 19011 or equivalent training
- **Quality Policy Training:** All new staff must be trained within 30 days of hire; track completion in educacao-continuada
- **Competency Assessment:** Annual scores auto-feed to Management Review input (DICQ 4.15 input #8)

**Action:** Add training courses:
- ISO 19011 Audit Standards (for auditors)
- Quality Policy & Philosophy (for all staff)
- Document Control (for Document Controller + super-users)
- LGPD & Data Privacy (for all staff)
- Complaint Handling & CAPA Process (for QC team)

---

### sgd Module (Document Management)

**Linked Items:**

- **D-007 (Document Control):** SGD approval workflow must enforce QD signature before publication
- **G-002 (POPs & SOPs):** All 40+ operational docs stored with version, approval, and obsolescence control
- **G-005 (Quality Manual):** Master quality manual stored as version-controlled document in SGD; read confirmations logged
- **A-004 (Quality Policy):** Formal policy document published to SGD; staff training completion linked

**Action:**
- Enable SGD approval workflow (draft → review → QD approval → active → obsolete archive)
- Create document hierarchy folders (MQ → POL → SOP → IT → FR)
- Upload Quality Manual template as version 1.0
- Set up distribution tracking with read confirmations
- Run quarterly audit of SGD completeness (are all 40+ required POPs present and current?)

---

### auditoria Module (Internal Audit)

**Linked Items:**

- **D-001 (Audit Plan):** Annual audit schedule stored and tracked
- **D-002 (Audit Execution):** Audit reports with findings, CAPA links, and follow-up dates
- **D-004–D-005 (NC & CAPA):** Non-conformances from audits auto-create CAPA records
- **Annual Compliance Audit (G-006):** Comprehensive audit across all 10 DICQ blocks; results feed to Management Review

**Action:**
- Create audit templates for each DICQ block (A–J)
- Schedule Q1–Q4 audits in calendar
- Train auditors on ISO 19011 standards
- After each audit, create CAPA records in capa module for any findings
- Track CAPA closure within 30 days of target date
- Annual compliance audit (Nov 2026) should score ≥88% DICQ conformance

---

### risks Module (Risk Management)

**Linked Items:**

- **D-003 (Risk Management):** Risk register with RPN scoring; annual review; mitigation tracking
- **D-004–D-005 (CAPA):** High-risk items (RPN >75) trigger preventive actions and CAPA closure

**Action:**
- Complete risk assessment across 5 categories (pre-analytical, analytical, post-analytical, operational, regulatory)
- Score each risk using Probability × Severity × Detection methodology
- Document mitigation actions for all High (75–125) and Medium (25–74) risks
- Assign owner and target closure date
- Quarterly review in Management Review; escalate overdue mitigations
- Annual risk assessment (Q4 MR) to refresh RPN scores

---

### capa Module (Corrective/Preventive Actions)

**Linked Items:**

- **D-004 (Non-Conformance Register):** All defects, complaints, errors logged with root cause
- **D-005 (CAPA Closure):** CAPA implemented, verified effective, and formally closed
- **D-010 (Complaint Investigation):** Customer complaints escalate to CAPA if systemic issue detected
- **Audit Findings:** Internal audit findings auto-create CAPA records

**Action:**
- Enable CAPA module with NC register and closure tracking
- Set target closure dates (typically 30–90 days from NC logging)
- Require root cause analysis (5 Why or fishbone diagram)
- QD must verify CAPA effectiveness before closure
- Follow-up audit within 30 days of target date
- Report CAPA closure rate to Management Review (goal: ≥95%)

---

### kpis Module (Key Performance Indicators)

**Linked Items:**

- **D-006 (Performance Indicators):** Real-time KPI dashboard tracking turnaround, errors, conformance, customer satisfaction
- **Management Review (A-007):** KPI trends presented as part of 15 mandatory inputs

**Action:**
- Define KPI targets for each metric (turnaround time, error rate, retest %, rework %, NC origin)
- Set up daily/weekly automatic data pulls from lab system (LIS integration)
- Create dashboard visible to all staff
- Monthly trend analysis; annual target refresh
- Export KPI report to MR input table (Q1, Q2, Q3, Q4)

---

### labSettings/governance Module

**Linked Items:**

- **governance_structure:** Director, MR chair, audit coordinator, document controller names and contacts
- **governance_structure.substitutes:** Backup staff for QD and other key roles
- **Organizational Chart:** Upload current org structure (visual diagram + staff list)
- **Legal Documents:** CNES, RLP, CNPJ, operational permits (RDC blockers — Phase 0)
- **MR Calendar:** Publish quarterly MR scheduled dates

**Action:**
- Create config file: `labSettings/governance/governance-config.json`
- Populate QD name, email, phone, CREA/CRMV, substitutes
- Link to organizational chart (Drive URL or embed)
- Publish MR calendar to staff
- Update directory whenever staff changes occur

---

## Monthly Progress Tracking

**Use this template for monthly status updates to Management Review:**

| DICQ Block | Item | Owner | Status | % Complete | Due Date | Notes |
|------------|------|-------|--------|------------|----------|-------|
| A | A-001 (Legal Registration) | Lab Manager | Pending | 0% | 2026-06-15 | Waiting for RLP documentation |
| A | A-002 (QD Designation) | Quality Director | Pending | 50% | 2026-06-15 | Draft approval in progress; substitutes identified |
| A | A-003 (Norteadores) | Quality Director | In Progress | 75% | 2026-06-30 | Draft completed; awaiting QD final approval |
| A | A-004 (Quality Policy) | Quality Director | In Progress | 70% | 2026-06-30 | Policy written; staff training scheduled Q2 |
| ... | ... | ... | ... | ... | ... | ... |
| **Summary** | **DICQ Block A (7 items)** | — | — | **66%** | — | **On track for Phase 9 gate (≥80% by 8/31)** |

---

## Deliverables Checklist

- [ ] **Week 1:** Governance roles assigned; names entered in JSON
- [ ] **Week 2:** Quality Manual template completed and QD-approved; Org chart finalized
- [ ] **Week 2–3:** Risk assessment completed; risk register documented
- [ ] **Week 3:** Approved Supplier List created; audits scheduled
- [ ] **Week 4:** SGD folder structure created; document control workflow active
- [ ] **Week 4–5:** Q1–Q4 audit plan published; auditors identified and trained
- [ ] **Week 5:** MR calendar scheduled; minute template ready
- [ ] **Week 6:** JSON checklist imported into tracking system; alert rules configured
- [ ] **Week 6+:** Monthly progress updates to Management Review; overdue items escalated

---

## Success Criteria

**Phase 9 Gate (by 2026-08-31):**
- A-001 through A-007: ≥80% complete
- D-001 through D-010: ≥80% complete
- E-001 through E-005: ≥80% complete

**Audit Readiness (by 2026-09-30):**
- All 58 items: ≥90% complete
- Overdue count: 0
- Annual compliance audit: ≥88% DICQ conformance score

**Governance Maturity:**
- Management Review cycle active (Q1, Q2, Q3, Q4 meetings held and minutes documented)
- Minutes document all 15 DICQ 4.15 mandatory inputs
- CAPA closure rate: ≥95%

---

## FAQ

### Q: What if we don't have a Quality Director?

**A:** Designate a senior lab professional with CREA/CRMV registration. This is a critical RDC 978 requirement (Art. 76). A substitute must be named. If transitioning, the Quality Director must formally designate in writing with an approval date.

### Q: Can we use an external auditor instead of internal auditors?

**A:** Internal audits are mandatory per DICQ 4.14.6 and RDC 978 Art. 85. You may use external auditors to supplement or train your internal team, but at least the Q1 or Q2 audit should be executed by your internal team to build capability. External auditors are recommended for the annual compliance audit (annual conformance assessment).

### Q: How long does Phase 9 governance work take?

**A:** For a lab with no existing QMS, expect 6–8 weeks to fully implement and achieve Phase 9 gate criteria. For labs already running a basic QMS, 3–4 weeks. The critical path is (1) QD designation, (2) risk assessment, (3) SGD setup, (4) audit planning.

### Q: What if we have less than 58 items done by 2026-08-31?

**A:** Prioritize the 22 critical items (marked with "priority: critical" in JSON):

1. A-001 (Legal registration)
2. A-002 (QD designation)
3. A-007 (MR cycle)
4. D-001 (Audit plan)
5. D-003 (Risk assessment)
6. D-004 (NC register)
7. D-005 (CAPA closure)
8. D-007 (Document control)
9. D-008 (Supplier management)
10. D-009 (Equipment maintenance)
11. E-004 (Patient ID verification)
12. G-001 (Training matrix)
13. G-002 (POPs & SOPs)
14. G-004 (Cybersecurity & LGPD)
15. G-005 (Quality Manual)
16. G-006 (Annual compliance audit)
17. G-009 (Proficiency testing — CEQ)
18. G-010 (Biosecurity & environmental monitoring)

If these 18 items are ≥80% complete by 8/31, you'll pass the Phase 9 gate. Lower-priority items (marked "high" or "medium") can be carried forward to Phase 10.

### Q: How often should we review this checklist?

**A:** Minimum monthly (before Management Review). Quarterly is standard for most labs. Items approaching due dates should be flagged in red and escalated to the owner + QD.

### Q: Can we edit the JSON checklist?

**A:** Yes. The structure is provided as a template. You may:
- Add lab-specific items (don't exceed 75 total)
- Adjust due dates based on your lab's calendar
- Rename owners to match your organizational structure
- Add custom alert thresholds (e.g., flag as "at risk" when <14 days away instead of 7)

However, do **not** remove DICQ-required items (A-001 through A-007, D-001 through D-010, E-001 through E-005) as these are DICQ compliance blockers.

### Q: Who has write access to the Google Docs template?

**A:** By default, only the Quality Director. We recommend:
1. **Quality Director:** Full edit access (approval authority)
2. **Document Controller:** Comment-only access (tracking changes)
3. **All Staff:** View-only access (awareness)

Once finalized and QD-approved, the template is published to SGD (read-only for most staff, edit-only for Document Controller with QD sign-off).

---

## Support & Questions

**Questions about this guide?**
Contact: Quality Director or Internal Audit Coordinator

**Questions about DICQ/RDC compliance?**
Refer to: `/docs/DICQ_GAP_ANALYSIS_v1.4.md` (compliance roadmap) and `/docs/COMPLIANCE_AUDIT_INDEX.md` (audit checklist)

**Questions about HC Quality modules?**
Refer to: `src/features/<module>/CLAUDE.md` (module-specific documentation) and root `CLAUDE.md` (project-wide conventions)

---

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-07 | Phase 9 Team | Initial publication |

---

**End of Implementation Guide**
