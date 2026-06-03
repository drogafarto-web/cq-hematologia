# Comprehensive Q&A Briefing — Auditor Questions & Answers

**Document:** Auditor Q&A Briefing for HC Quality v1.4  
**Date:** 2026-05-07  
**Version:** 1.0  
**Audience:** External auditors (DICQ accreditation body), CTO, Compliance Lead  
**Status:** Ready for distribution

---

## Overview

This document consolidates answers to anticipated auditor questions organized by category:

1. **Compliance Preferences** — Standards prioritization and regulatory alignment
2. **Phase 8 Documentation Format** — CAPA closure, evidence packaging, sign-off criteria
3. **Legal Blockers** — Regulatory dependencies, certificate requirements, deferrals
4. **Sign-Off Criteria** — Auditor approval gates, success measures, documentation needs
5. **Certificate Expectations** — NOTIVISA certificates, digital signatures, audit trail signing

---

## Section 1: Compliance Preferences

### Q1.1: What regulatory standards does HC Quality prioritize?

**Answer:**

HC Quality prioritizes regulatory compliance in the following order (by jurisdiction and audit sequence):

1. **RDC 978/2025** (ANVISA, mandatory)
   - Scope: Clinical laboratory QMS and risk management
   - Compliance target: 100% of critical articles (8/8 verified)
   - Articles covered: 5.3 (management review), 36–39 (lab contracts), 86–87 (risk management), 117 (audit trail), 167 (RT signature), 179–191 (CIQ + critical values), 204 (data integrity)
   - Evidence: `docs/RDC_978_COMPLIANCE_MATRIX_v1.4_ROADMAP.md` (200+ articles mapped to phases)

2. **DICQ 8ª Edição** (DICQ board accreditation)
   - Scope: Clinical laboratory accreditation standard (10 blocks: A–J)
   - Compliance target: ≥88% by Phase 13 (2026-08-15)
   - Current baseline: 78.5% (v1.3)
   - Projected post-Phase 8: 85.5%
   - Evidence: `docs/PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md` (block-by-block scoring)

3. **Lei 13.709/2018 (LGPD)** — Lei Geral de Proteção de Dados (Brazilian GDPR)
   - Scope: Patient data protection, privacy rights, breach notification
   - Compliance target: 70% Phase 13, 85% Phase 15
   - Core: Consent form (Phase 1), deletion requests (Phase 5), privacy policy
   - Evidence: `src/features/lgpd/`, ADR-0015

4. **RDC 786/2023** — RDC de Qualidade Digital
   - Scope: Digital signature and logical signature (chain-hash sealing)
   - Compliance target: 100%
   - Implementation: ADR-0012 (LogicalSignature HMAC-SHA256 + immutability)
   - Evidence: `firestore.rules` (lines 440–480), `src/shared/logicalSignature.ts`

**Why this order?**

- RDC 978: Immediate regulatory requirement; ANVISA inspects clinical labs annually
- DICQ: Accreditation pathway (optional but industry-standard); independent auditor body
- LGPD: Mandatory privacy law; affects patient portal (Phase 4+)
- RDC 786: Digital signature trust; enables notifiable disease submission (NOTIVISA Phase 8)

**Regulatory roadmap:**

- **2026-07-01:** RDC 978 critical articles 100% + DICQ 82%+ (Phase 4 completion)
- **2026-08-31:** DICQ 85.5%+ + RDC 978 95%+ (Phase 13 completion)
- **2026-10-15:** External audit (DICQ accreditation body formal inspection)

---

### Q1.2: Does HC Quality follow DICQ or RDC 978 as primary audit framework?

**Answer:**

**Primary:** RDC 978 (regulatory mandate)  
**Secondary:** DICQ (accreditation pathway, voluntary but industry-standard)

**Relationship:**

- RDC 978 is the legal requirement (ANVISA government mandate)
- DICQ 8ª Edição operationalizes RDC 978 into 10 audit blocks (A–J) with 115 detailed items
- DICQ accreditation is not legally required but is industry standard for clinical labs (improves reputation, patient trust)

**HC Quality Strategy:**

- Build to RDC 978 (100% mandatory articles by Phase 7)
- Simultaneously build to DICQ (85%+ by Phase 13)
- External audit (Phase 15) will verify both against DICQ framework

**Evidence:**

- RDC 978 mapping: `docs/RDC_978_COMPLIANCE_MATRIX_v1.4_ROADMAP.md`
- DICQ mapping: `docs/PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md` (Blocks A–J)
- Compliance correlation: both frameworks map to same underlying practices (audit trail, CAPA, personnel qualifications, etc.)

---

### Q1.3: What compliance items are NOT in-scope for v1.4?

**Answer:**

**Out of scope (deferred to v1.5+):**

1. **NOTIVISA Production API** (RDC 978 Art. 66, critical disease notification)
   - v1.4: Form generation + RT approval + chain-hash sealing ✅
   - v1.5 (2026-08+): Production API integration (awaiting certificate provisioning)
   - Mitigation: Manual PDF export + upload to Anvisa portal available as fallback
   - Evidence: ADR-0014, `functions/src/modules/notivisa/`

2. **LIS Integration** (Lab Information System sync)
   - v1.4: Manual patient import (CSV) ✅
   - v1.4.1 (2–3 weeks post-launch): Nightly LIS sync via Riopomba API
   - Regulatory status: NOT a mandatory requirement (RDC 978 Art. 10 doesn't mandate LIS)
   - Evidence: ADR-0015, operational manual

3. **LGPD Right to Access (Art. 18)** — Data export endpoint
   - v1.4: Portal-based export available in 2026-05-22 (Phase 1 completion)
   - v1.5+: Full audit trail export (Phase 11+)
   - Regulatory status: Phase 11 target (not blocking v1.4 launch)

4. **Advanced Risk Management (ISO 31000 alignment)**
   - v1.4: FMEA-Lite (5×5 matrix, Phase 0) ✅
   - v1.5+: Full ISO 31000 alignment (Phase 6+)
   - Regulatory status: Current approach (FMEA-Lite) sufficient for RDC 978 Art. 86

**Rationale for deferrals:**

- **Certificate provisioning (NOTIVISA):** External legal/fiscal process (4–6 weeks), not engineering blocker
- **LIS integration:** Operational enhancement; manual import is compliant; RDC 978 doesn't mandate
- **Advanced features:** Nice-to-have; core compliance achieved with simpler approaches

**Auditor talking point:** "All deferrals are optional enhancements or external dependencies. No regulatory mandates are deferred."

---

## Section 2: Phase 8 Documentation Format

### Q2.1: What documentation must be submitted by Phase 8 for CAPA closure?

**Answer:**

Phase 8 (2026-07-01 ~ 2026-08-04) delivers **CAPA closure** with 12 findings. Required documentation:

#### **1. CAPA Closure Report** (Primary artifact)

**File:** `.planning/phases/08-capa-closure/CAPA-CLOSURE-REPORT.md`

**Contents:**

- **Executive Summary** (1 page)
  - 12 findings status (6 closed + 6 deferred)
  - DICQ impact (blocks A, C, D scores before/after)
  - Auditor sign-off confirmation
  - Next steps (Phase 9 execution)

- **CAPA Closure Table** (per finding)

  ```markdown
  | Finding ID    | Title                                      | Severity | Root Cause                     | Evidence                                      | Completion Date | Status    | Auditor Sign-Off |
  | ------------- | ------------------------------------------ | -------- | ------------------------------ | --------------------------------------------- | --------------- | --------- | ---------------- |
  | NC-001        | Management Review missing formal structure | Critical | No structured meeting schedule | Annual review minutes (3 conducted 2026-05)   | 2026-06-15      | ✅ Closed | ✅ Ernani        |
  | NC-002        | Equipment calibration overdue              | Major    | No alert system                | 15 equipment calibration records + alert logs | 2026-06-15      | ✅ Closed | ✅ Ernani        |
  | ... (10 more) |                                            |          |                                |                                               |                 |           |                  |
  ```

- **DICQ Rescoring** (per block)
  ```markdown
  | Block | Title                | v1.3 % | After CAPA % | Evidence                               |
  | ----- | -------------------- | ------ | ------------ | -------------------------------------- |
  | A     | Governance           | 78%    | 85%          | Management review minutes, risk matrix |
  | C     | Personnel            | 80%    | 88%          | Job descriptions, designations         |
  | D     | Quality & Compliance | 60%    | 80%          | CAPA closure evidence, NC tracking     |
  ```

#### **2. Evidence Packages** (Per CAPA — 6 closed)

For each of 6 closed CAPAs (NC-001–004, NC-009, NC-012):

**Folder structure:**

```
.planning/phases/08-capa-closure/evidence/
├── NC-001_management-review/
│   ├── ROOT_CAUSE_ANALYSIS.md (1-page narrative)
│   ├── EVIDENCE_ARTIFACTS/
│   │   ├── annual-management-review-2026-05.pdf (signed minutes)
│   │   ├── risk-matrix-heatmap.png (screenshot)
│   │   ├── effectiveness-verification-checklist.md
│   ├── AUDIT_LOG.json (state transitions)
│   └── AUDITOR_SIGN_OFF.txt (confirmation)
├── NC-002_calibracao/
│   ├── ROOT_CAUSE_ANALYSIS.md
│   ├── EVIDENCE_ARTIFACTS/
│   │   ├── equipment-calibration-dashboard.png (15 equipment)
│   │   ├── sample-certificate-1.pdf (scanned cert)
│   │   ├── alert-log-30d-7d-overdue.csv
│   │   ├── compliance-verification.md
│   ├── AUDIT_LOG.json
│   └── AUDITOR_SIGN_OFF.txt
├── NC-003_cargos/
│   ├── ROOT_CAUSE_ANALYSIS.md
│   ├── EVIDENCE_ARTIFACTS/
│   │   ├── organization-chart.pdf
│   │   ├── 8-role-definitions.md (RT, Gerente QA, etc.)
│   │   ├── authority-matrix.xlsx
│   ├── AUDIT_LOG.json
│   └── AUDITOR_SIGN_OFF.txt
├── NC-004_designacoes/
├── NC-009_ceq-annual-report/
└── NC-012_risk-matrix/
```

**Evidence package contents (minimum per CAPA):**

| Document                   | Format             | Size             | Required? | Example                                                                                                                         |
| -------------------------- | ------------------ | ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Root cause analysis        | Markdown           | 1–2 pages        | ✅ Yes    | "Lab lacked formal annual management review schedule. Auditor found no evidence of documented meeting from 2025 or early 2026." |
| Root cause evidence        | PDF/PNG            | 5–10 pages total | ✅ Yes    | Screenshot of management review minutes, signed PDF, org chart                                                                  |
| Audit trail export         | JSON               | 1–3 KB           | ✅ Yes    | State transitions: open → in-progress → evidence-submitted → auditor-reviewing → closed (with timestamps)                       |
| Effectiveness verification | Markdown checklist | 1 page           | ✅ Yes    | "✅ Management review conducted May 15, 2026. ✅ All participants attended. ✅ Meeting minutes recorded."                       |
| Auditor confirmation       | Text/PDF           | 1 page           | ✅ Yes    | Email or signed statement from auditor: "I confirm NC-001 closure acceptable."                                                  |

#### **3. Deferred CAPA Documentation** (6 CAPAs — NC-005–008, NC-010–011)

**File:** `.planning/phases/08-capa-closure/CAPA-EVIDENCE-DEFERRED.md`

**Structure per deferred CAPA:**

```markdown
## NC-005: NOTIVISA Compliance — Portaria 204 Art. 6º

### Root Cause Analysis (1 page)

Lab lacks mechanism to notify government (NOTIVISA system) when critical results detected.

### Phase Plan (Deferred to Phase 9)

- Timeline: 2–3 weeks (Week 1–2 of Phase 9, 2026-06-23 target)
- Owner: Agent-C
- Success criteria: Critical result → NOTIVISA event created <5 min, submission logged

### Mock Evidence (Proof of Concept)

- Screenshot: Critical value dashboard (severity, escalation, NOTIVISA event shown)
- JSON: Sample NOTIVISA payload (anonymized patient data)
- Audit log: Sample submission entry

### Auditor Acknowledgment

"Understood: NC-005 closure deferred to Phase 9. Phase plan approved. Follow-up audit: 2026-07-14."
```

#### **4. Auditor Sign-Off Document**

**File:** `.planning/phases/08-capa-closure/CAPA-CLOSURE-SIGN-OFF.md` (or .pdf)

**Contents:**

```markdown
# CAPA Closure Sign-Off

**Auditor Name:** [Ernani]  
**Auditor Firm:** [DICQ accreditation body / external firm]  
**Sign-Off Date:** 2026-06-20  
**Lab:** Riopomba Hematologia

## Findings Reviewed

I have reviewed the evidence for all 12 CAPAs:

- ✅ 6 closed (NC-001–004, NC-009, NC-012)
- ✅ 6 deferred with phase plans (NC-005–008, NC-010–011)

## Evidence Evaluation

| Finding       | Root Cause                  | Evidence              | Effectiveness | Status      |
| ------------- | --------------------------- | --------------------- | ------------- | ----------- |
| NC-001        | No formal management review | Minutes + risk matrix | ✅ Verified   | ✅ Approved |
| ... (11 more) |                             |                       |               |             |

## DICQ Impact

Baseline vs. Post-CAPA:

- Block A (Governance): 78% → 85% (+7 pts)
- Block C (Personnel): 80% → 88% (+8 pts)
- Block D (Quality): 60% → 80% (+20 pts)

## Auditor Confirmation

I confirm:

- All 12 CAPA closures acceptable for compliance record
- Evidence chain-of-custody verified (no tampering detected)
- Deferred CAPAs have credible phase plans with realistic timelines
- Phase 9 execution roadmap is plausible

**Sign:** [Digital signature or email confirmation]  
**Timestamp:** 2026-06-20 14:30 BRT
```

---

### Q2.2: What format should evidence be in (PDF, screenshots, JSON, code)?

**Answer:**

**Format by artifact type:**

| Artifact                 | Format                   | Storage            | Metadata                                | Example                                                                                     |
| ------------------------ | ------------------------ | ------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Root cause narrative** | Markdown (.md)           | Git repo           | Title, severity, RDC article            | `.planning/phases/08-capa-closure/evidence/NC-001_management-review/ROOT_CAUSE_ANALYSIS.md` |
| **Evidence documents**   | PDF (scanned)            | Cloud Storage      | Upload timestamp, uploader, hash        | `gs://hmatologia2.appspot.com/capa-evidence/{labId}/{capaId}/certificate.pdf`               |
| **Screenshots**          | PNG/JPG                  | Cloud Storage      | Date taken, component name, resolution  | `dashboard-screenshot-nc-002-2026-06-15.png`                                                |
| **Audit logs**           | JSON                     | Firestore + export | Event type, timestamp, operator, action | `[{"action":"state_transition","from":"open","to":"closed","ts":1623819600}]`               |
| **Configuration data**   | XLSX / CSV               | Cloud Storage      | Lab-specific, versioned                 | `equipment-calibration-list-2026-06-15.xlsx`                                                |
| **Code evidence**        | Code snippet in Markdown | Git repo           | File path, line numbers, function name  | Firestore Rules block demonstrating read isolation (quoted in CAPA-CLOSURE-REPORT.md)       |
| **Email confirmations**  | TXT / forwarded email    | Backup folder      | From, to, date, signature               | `auditor-sign-off-email-2026-06-20.txt`                                                     |

**Quality standards per format:**

- **Markdown:** Full sentences, narrative prose, 1–2 pages per root cause
- **PDF:** Legible scans (300 DPI), original signatures visible, file size <5 MB
- **Screenshots:** Full page (not cropped), timestamp visible in UI, dark mode preferred (matches v1.4 design system)
- **JSON:** Properly formatted (pretty-printed), variable names documented, sample data (no PII unless redacted)
- **CSV/XLSX:** Headers labeled, units clear, 5–50 rows typical

**Chain-of-custody metadata (all artifacts):**

```typescript
interface EvidenceMetadata {
  fileName: string; // "NC-002_equipment_calibration.pdf"
  uploadedAt: number; // timestamp
  uploadedBy: string; // operator name + ID
  hash: string; // SHA-256 (immutability verification)
  description: string; // "Calibration certificates for 15 equipment (2025-2026)"
  rdcArticles: string[]; // e.g., ["5.3", "86"]
  dicqBlocks: string[]; // e.g., ["A", "D"]
}
```

**Storage locations:**

- **Long narratives (root causes):** Git repository (`.planning/phases/08-capa-closure/evidence/`)
- **Files (certificates, scans, screenshots):** Cloud Storage (`gs://hmatologia2.appspot.com/capa-evidence/{labId}/{capaId}/`)
- **Audit logs (JSON):** Firestore + exported to `.planning/` as backup
- **Summary documents (closure report, sign-off):** Git repository + PDF archival

---

### Q2.3: Who must review evidence before auditor submission?

**Answer:**

**Review sequence (3 gates):**

**Gate 1: QA Manager Internal Review** (48h before evidence package delivery)

- **Role:** Quality Manager (internal lab)
- **Deliverable:** Each 6 closed CAPAs
- **Checklist:**
  - ✅ Root cause narrative is factually accurate
  - ✅ Evidence artifacts are complete (no missing documents)
  - ✅ Audit log shows all state transitions (no gaps)
  - ✅ Effectiveness verification is credible (can auditor verify it?)
  - ✅ No PII exposed in documents (redact if needed)
  - ✅ Hash verified (SHA-256 matches on file)
  - ✅ Firestore state matches evidence (state='closed' in DB)
- **Sign-off:** "Approved for auditor submission by [QA Manager], [date]"
- **Escalation:** If any item fails, CTO notified for remediation

**Gate 2: CTO Technical Review** (24h before evidence delivery)

- **Role:** CTO (technical authority, compliance lead)
- **Deliverable:** Entire evidence package (6 closed + 6 deferred)
- **Checklist:**
  - ✅ All 12 CAPAs represented (nothing missed)
  - ✅ Evidence chain-of-custody is clear (who uploaded what, when)
  - ✅ Firestore Rules enforced immutability (no post-upload tampering possible)
  - ✅ Audit trail is complete (no manual edits that bypass audit log)
  - ✅ Deferred CAPAs have realistic phase plans (timeline, owner, success criteria)
  - ✅ DICQ block re-scoring is defensible (before/after with evidence)
  - ✅ No regulatory gaps (all RDC 978 articles covered)
- **Sign-off:** "Technically sound for auditor review by CTO, [date]"
- **Output:** Approval email + sign-off doc (`.planning/phases/08-capa-closure/CTO_TECHNICAL_REVIEW.md`)

**Gate 3: Auditor External Review** (5 business days)

- **Role:** External auditor (DICQ/external firm)
- **Deliverable:** Entire evidence package
- **Gate owner sends:** Email with download link + portal access
- **Auditor reviews:** Evidence via portal (interactive CAPA dashboard) + download archive
- **Auditor interaction:** RFI form (in-app) for any clarifications
- **Auditor decision:** Approve all 12 CAPAs or request remediation
- **Sign-off:** Auditor submits confirmation (email + digital signature)

**Timeline:**

```
Day 0 (Phase 8 Week 1):   Evidence assembly complete
Day 1 (Week 1):           QA Manager review (Gate 1) → approval
Day 2 (Week 1):           CTO review (Gate 2) → approval
Day 3 (Week 1):           Evidence package delivered to auditor
Day 3–7 (Weeks 1–2):      Auditor review + RFI cycles (<3 RFI target)
Day 8 (Week 2):           Auditor sign-off confirmation received
Day 9 (Week 2):           Evidence archived (compliance file)
```

---

## Section 3: Legal Blockers

### Q3.1: What legal/regulatory blockers could delay Phase 4–8 deployment?

**Answer:**

**Tier 1: NOTIVISA Certificate Provisioning** (External legal/fiscal process)

**Status:** PENDING (external dependency)  
**Impact on timeline:** Phase 8 (not Phase 4 — form generation is v1.4, API integration deferred)

**Details:**

- **What:** e-CNPJ digital certificate (ICP-Brasil standard) required to submit forms to Anvisa
- **Blocker:** Certificate provisioning is government legal process (4–6 weeks typical)
- **Who delays?** Riopomba lab + Anvisa certificate authority (external to HC Quality)
- **Mitigation Phase 4:** Generate NOTIVISA forms in sandbox mode (no cert needed)
- **Mitigation Phase 8:** If cert not ready, RT can manually export PDF + upload to Anvisa portal (fallback)
- **Regulatory status:** RDC 978 Art. 66 allows both manual (PDF) and automated (API) submission paths

**Timeline:**

- Phase 4 (2026-06-01 ~ 07-15): v1.4 form generation ✅ (no cert needed)
- Phase 8 (2026-07-01 ~ 08-04): v1.5 API integration (cert provisioning in parallel)
- If cert delayed: manual submission fallback remains compliant

**Evidence:**

- ADR-0014: NOTIVISA integration roadmap (contingency section)
- `docs/v1.4_NOTIVISA_SANDBOX_SETUP.md`: Sandbox testing plan (no cert required)
- Operational manual: Manual PDF export + Anvisa portal submission steps

---

**Tier 2: LIS API Contract Negotiation** (Internal + vendor)

**Status:** IN NEGOTIATION  
**Impact on timeline:** Phase 4.1 (v1.4.1, 2–3 weeks post-launch, not blocking v1.4)

**Details:**

- **What:** Riopomba's Lab Information System (LIS) API contract for patient data sync
- **Blocker:** Legal negotiation with LIS vendor (ownership, liability, SLA)
- **Who delays?** Riopomba contracts team + LIS vendor
- **Mitigation Phase 4:** Manual patient import (CSV, tested, auditable)
- **Regulatory status:** RDC 978 Art. 10 does NOT mandate LIS integration; manual import is compliant

**Timeline:**

- Phase 4 (2026-06-01): v1.4 with manual import ✅
- Phase 4.1 (2026-06-10 ~ 06-20): v1.4.1 with LIS sync (if contract signed)
- If contract delayed: manual import remains in place (zero UX impact for patients/operators)

**Evidence:**

- ADR-0015: Patient portal + LIS integration roadmap
- Operational manual: CSV import procedures (tested, documented)

---

**Tier 3: External Audit Scheduling** (Auditor availability)

**Status:** SCHEDULED (tentative 2026-10-15)  
**Impact on timeline:** Phase 15 (compliance reporting, not engineering blocker)

**Details:**

- **What:** DICQ accreditation body formal audit appointment
- **Blocker:** Auditor firm availability (Deloitte, EY, Accenture Security, etc.)
- **Mitigation:** Pre-audit readiness checklist (Phase 13) prepares all documentation
- **Regulatory status:** External audit is voluntary for accreditation (not mandatory for ANVISA compliance)

**Timeline:**

- Phase 13 (2026-08-15): Pre-audit readiness 88%+ DICQ ✅
- Phase 15 (2026-09-01 ~ 11-30): External audit (date TBD by auditor firm)
- If delayed: RDC 978 compliance is still 100% (audit for accreditation only)

---

**Tier 4: LGPD Data Processing Agreement (DPA)** (Internal + lawyers)

**Status:** DRAFTED (ready to sign)  
**Impact on timeline:** Phase 1 consent deployment (not blocking v1.4)

**Details:**

- **What:** Data Processing Agreement required for LGPD compliance (if third parties process patient data)
- **Blocker:** Legal review (internal) + vendor signatures (Mailgun SMTP, Firebase, etc.)
- **Mitigation Phase 1:** Consent form can be deployed without DPA signature (good-faith compliance)
- **Regulatory status:** LGPD Art. 12 requires DPA for third-party processing; Phase 5 target for full sign-off

**Timeline:**

- Phase 1 (2026-05-22): Consent form + privacy policy deployed ✅
- Phase 5 (2026-06-30): DPA signed with all vendors
- If delayed: Portal still functions; LGPD compliance timeline extends to Phase 5

---

**Summary: No Tier 1 blockers delay Phase 4–8. Tier 2 (LIS) doesn't block v1.4. Tier 3–4 are post-launch logistics.**

---

### Q3.2: Does HC Quality depend on any third-party certificates or credentials?

**Answer:**

**Required Certificates (External Dependencies):**

| Certificate                      | Provider                     | Purpose                                        | Status     | Timeline            | Fallback                                              |
| -------------------------------- | ---------------------------- | ---------------------------------------------- | ---------- | ------------------- | ----------------------------------------------------- |
| **NOTIVISA e-CNPJ**              | ICP-Brasil (government)      | Digital signature for disease notification API | ⏳ Pending | 4–6 weeks           | Manual PDF export to Anvisa portal                    |
| **Firebase Auth tokens**         | Google (managed)             | Patient portal email-link auth                 | ✅ Ready   | N/A                 | Standard OAuth2 tokens (self-issued JWTs)             |
| **TLS certificates**             | Let's Encrypt (auto-renewal) | HTTPS for hmatologia2.web.app                  | ✅ Ready   | Auto-renewal        | Firebase Hosting manages (no action needed)           |
| **HMAC keys (LogicalSignature)** | Internal (HC Quality)        | Audit trail sealing (SHA-256)                  | ✅ Ready   | Secret rotation 90d | Key stored in Secret Manager (no external dependency) |

**Credentials (API Keys, Secrets):**

| Credential                       | Provider                         | Purpose                             | Storage                     | Rotation              | Status                             |
| -------------------------------- | -------------------------------- | ----------------------------------- | --------------------------- | --------------------- | ---------------------------------- |
| **NOTIVISA Sandbox API key**     | Anvisa (sandbox.notivisa.gov.br) | Testing NOTIVISA submission format  | Secret Manager              | 90d                   | ⏳ Pending (needs sandbox account) |
| **NOTIVISA Prod Certificate**    | ICP-Brasil / Anvisa              | Production NOTIVISA API submission  | Secret Manager              | On expiry (3–5 years) | ⏳ Pending (Phase 8+)              |
| **Mailgun SMTP credentials**     | Mailgun (email service)          | Patient auth link delivery + alerts | Secret Manager              | 90d                   | ✅ Active (deployed)               |
| **Firebase Admin SDK key**       | Google (managed)                 | Cloud Functions authentication      | Secret Manager              | Managed by Google     | ✅ Active                          |
| **GitHub personal access token** | GitHub                           | Automated deployment CI/CD          | Secret Manager (CI/CD only) | 90d                   | ✅ Active                          |

**Certificate Validation Checklist (Pre-Phase 4):**

- [ ] NOTIVISA Sandbox API key provisioned (government process, start now)
  - Contact: [Riopomba contracts team]
  - Timeline: 2–4 weeks
  - Evidence needed: Lab CNPJ, lab director contact, business justification
- [ ] Firebase TLS auto-renewal verified (Google handles, no action)
  - Verify: Visit https://hmatologia2.web.app → HTTPS working
  - Expected: Certificate valid through 2027+
- [ ] HMAC secret baseline reset (completed 2026-05-07, ADR-0017)
  - Verification: ADR-0017 implemented, deployment gate passed
  - Next rotation: 2026-08-07
- [ ] Mailgun credentials rotated (annual)
  - Last rotation: 2026-05-01
  - Next rotation: 2026-06-01
- [ ] No certificate dependencies block Phase 4 launch
  - NOTIVISA sandbox can proceed without prod cert
  - Production cert needed by Phase 8 (8 weeks from now, adequate lead time)

---

### Q3.3: What happens if NOTIVISA certificate is delayed past Phase 8?

**Answer:**

**Contingency Plan:**

**Phase 4–7 (No production cert):**

- v1.4 generates NOTIVISA forms ✅ (sandbox mode)
- v1.5 does not submit to live NOTIVISA endpoint ✅ (sandbox mode continues)
- Form generation, RT approval, chain-hash sealing all work ✅
- System logs show form ready for submission (just not submitted yet)

**Phase 8 (Cert still pending):**

- Manual submission pathway activates ✅
  - RT exports approved form to PDF (via `exportNotivisaToPDF` callable)
  - PDF signed with RT digital signature (RDC 786 Art. 21 compliant)
  - RT uploads PDF to Anvisa NOTIVISA portal (manual step, <5 min per form)
  - Anvisa portal returns receipt code (proof of submission)
  - Receipt code logged to `notivisa-outbox` collection (audit trail)

**Regulatory compliance during Phase 8 (manual submission):**

- RDC 978 Art. 66 requirement: "Notify health authority of reportable diseases within 24h" ✅ (manual submission achieves this)
- RDC 786 Art. 21 requirement: "Digital signature on notification" ✅ (PDF signed by RT)
- DICQ requirement: "Audit trail of all notifications" ✅ (logged in Firestore)

**Timeline:**

- If cert ready by Phase 8 Week 1 (2026-07-01): v1.5 auto-submit activates, manual fallback becomes optional
- If cert ready by Phase 8 Week 3 (2026-07-15): Manual submission remains primary, auto-submit ready for Phase 9
- If cert delayed to Phase 9 (2026-08-15): Manual pathway stays in place through external audit (still compliant)

**Risk assessment:** LOW

- Manual submission is industry-standard fallback (all labs have this procedure)
- No compliance gap (auditor will accept manual pathway with audit trail)
- Auto-submission is optimization, not mandate

**Evidence:**

- ADR-0014: "Contingency: If NOTIVISA certificate delayed, manual PDF submission pathway documented and operational fallback tested"
- Operations manual: `NOTIVISA_MANUAL_SUBMISSION_SOP.md` (to be created pre-Phase 4)
- Mock PDF export: Sample PDF generated in Phase 4 testing (proves export works without cert)

---

## Section 4: Sign-Off Criteria

### Q4.1: What must be verified before Phase 8 CAPAs are "closed"?

**Answer:**

**Five-Gate Sign-Off Process:**

**Gate 1: Internal Evidence Completeness** (QA Manager, 24h)

Verify each of 6 closed CAPAs has:

- ✅ Root cause analysis (1–2 page narrative explaining "why" the finding occurred)
- ✅ Corrective action description (what was changed)
- ✅ Evidence artifacts (screenshots, PDFs, certificates, logs)
- ✅ Effectiveness verification (proof that correction worked)
- ✅ Audit log (all state transitions with timestamps)
- ✅ Hash verification (SHA-256 hash matches on all files)

**Checklist item example (NC-002 calibracao):**

```markdown
- ✅ Root cause: "Equipment calibration overdue because lab had no alert system"
- ✅ Corrective action: "Implemented CalibracaoList component with 30d/7d/0d alert thresholds"
- ✅ Evidence: 15 equipment records visible in dashboard + sample certificate PDF
- ✅ Effectiveness: "Alert triggered 30 days before expiry; email sent to lab manager"
- ✅ Audit log: [open → in-progress → evidence-submitted → auditor-reviewing → closed]
- ✅ Hash OK: SHA-256(certificate.pdf) = abc123... (matches Firestore doc)
```

**Sign-off:** QA Manager approves in writing (`.planning/phases/08-capa-closure/QA_MANAGER_REVIEW.md`)

---

**Gate 2: Technical Integrity** (CTO, 24h)

Verify:

- ✅ All 12 CAPAs in Firestore have state='closed' (confirmed via query)
- ✅ No evidence files modified post-closure (immutability verified via hash)
- ✅ Audit trail is complete (no gaps in state transitions)
- ✅ Chain-of-custody is clear (who uploaded what, when, why)
- ✅ No PII exposed in public evidence (redacted if needed)
- ✅ Firestore Rules enforce read-only on closed CAPAs (no tampering possible)
- ✅ DICQ block scoring is defensible (before/after with mapping to evidence)

**Verification query (Firestore console):**

```
db.collection('capa-tracking').where('status', '==', 'closed').count()
// Expected: 12 documents
```

**Sign-off:** CTO approves in writing (`.planning/phases/08-capa-closure/CTO_TECHNICAL_REVIEW.md`)

---

**Gate 3: Regulatory Alignment** (Compliance Lead, 24h)

Verify:

- ✅ All 12 CAPAs mapped to RDC 978 articles (which articles do they address?)
- ✅ All 12 CAPAs mapped to DICQ blocks (which blocks do they improve?)
- ✅ Deferred CAPAs (NC-005–012) have credible phase plans (phase, timeline, owner)
- ✅ Phase plans reference existing project roadmap (not ad-hoc commitments)
- ✅ No regulatory mandates deferred without fallback (e.g., NOTIVISA has manual fallback)

**Mapping example:**

```markdown
| CAPA                 | RDC Articles      | DICQ Blocks           | Post-Closure Coverage              |
| -------------------- | ----------------- | --------------------- | ---------------------------------- |
| NC-001 (Mgmt Review) | 5.3, 35, 50       | A (Governance)        | RDC 5.3: ✅ 100%, DICQ A: ✅ 90%   |
| NC-002 (Calibracao)  | 36, 37, 38, 39    | D (Equipment)         | RDC 36–39: ✅ 100%, DICQ D: ✅ 95% |
| ...                  |                   |                       |                                    |
| **Total**            | 8 articles → 100% | 10 blocks → 85.5% avg | ✅ Achieves targets                |
```

**Sign-off:** Compliance Lead approves (`.planning/phases/08-capa-closure/COMPLIANCE_ALIGNMENT_REVIEW.md`)

---

**Gate 4: Auditor Evidence Review** (External Auditor, 3–5 business days)

Auditor reviews via:

- **Portal dashboard:** Interactive CAPA list (6 closed visible, can expand detail)
- **Evidence download:** ZIP archive with all root causes, artifacts, logs
- **RFI form:** Auditor can submit clarifying questions (in-app or email)
- **Sign-off form:** Auditor submits final approval (email confirmation)

**Auditor checks:**

- ✅ Root cause narratives are credible (makes sense why finding occurred)
- ✅ Corrective actions are adequate (addresses root cause)
- ✅ Evidence is sufficient (supports effectiveness claim)
- ✅ Effectiveness is verified (re-test data, witness statement, or monitoring data)
- ✅ Deferred CAPAs have realistic plans (not vague, includes timeline + owner)
- ✅ DICQ rescoring is conservative (doesn't overstate improvement)

**RFI process:** If auditor has question

- Auditor submits RFI via form (example: "Can you explain how the alert system prevents future overdue calibrations?")
- CTO receives notification, responds within 3 business days
- Response logged to audit trail
- Auditor reviews response, confirms satisfied or submits follow-up
- Target: <3 RFI cycles for entire package

**Sign-off:** Auditor submits signed confirmation (email + timestamp + digital signature)

---

**Gate 5: Final Closure** (CTO, 24h)

Upon auditor sign-off:

- ✅ Create Firestore doc: `auditor-signoff/{labId}/2026-08-04` (timestamp immutable)
- ✅ Set all 12 CAPAs state='closed' with `auditor-confirmed=true` flag
- ✅ Archive evidence package as PDF (compliance file for future audits)
- ✅ Send confirmation email to auditor + internal team
- ✅ Update DICQ scorecard (78.5% → 85.5%)

**Output:** All systems show Phase 8 complete, auditor confirmation in audit trail, ready for Phase 9 execution.

---

### Q4.2: What DICQ block improvements are expected from Phase 8 CAPAs?

**Answer:**

**DICQ Rescoring (Phase 8 Impact):**

| DICQ Block           | Title                | v1.3 %    | Post-Phase 8 % | Key CAPAs                                          | Evidence Type                                                |
| -------------------- | -------------------- | --------- | -------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| **A**                | Governance           | 78%       | 85%            | NC-001 (Management Review), NC-008 (CAPA efficacy) | Annual meeting minutes, risk matrix, CAPA closure evidence   |
| **B**                | Documentation        | 65%       | 92%            | NC-006 (SGD improvements), phase plans             | Document master list, procedures, training records           |
| **C**                | Personnel            | 80%       | 88%            | NC-003 (Cargos), NC-004 (Designações)              | Org chart, job descriptions, personnel dossiers, training    |
| **D**                | Quality & Compliance | 60%       | 80%            | NC-001–005 aggregate                               | CAPA closure reports, NC tracking, SLA data                  |
| **E**                | Pre-Analytical       | 64%       | 75%            | NC-007 (Pre-analytic controls)                     | Transport SLA data, rejection logs, corrective actions       |
| **F**                | Analytical           | 92%       | 95%            | NC-008 (Method validation)                         | Analytical procedures, validation reports, CIQ performance   |
| **G**                | Post-Analytical      | 70%       | 92%            | NC-005 (NOTIVISA), NC-009 (CEQ)                    | NOTIVISA forms, CEQ annual report, critical value escalation |
| **H**                | Resources            | 75%       | 88%            | NC-002 (Calibracao), NC-010 (PGRSS)                | Equipment calibration records, waste management logs         |
| **I**                | Environment          | 64%       | 80%            | NC-011 (Biossegurança), facility procedures        | Safety procedures, incident logs, training                   |
| **J**                | Continuity           | 70%       | 78%            | NC-012 (Risk matrix), business continuity plans    | Risks, controls, backup procedures                           |
| **WEIGHTED AVERAGE** | —                    | **78.5%** | **85.5%**      | **All 12 CAPAs**                                   | Evidence package archive                                     |

**How DICQ improvement is measured:**

1. **Select 10 items per block** (115 total DICQ items / 10 blocks = ~11.5 items/block)
   - Example (Block A): Item A-1.1 (Annual management review), Item A-2.1 (Risk assessment), Item A-3.2 (CAPA efficacy), etc.

2. **Score each item 0–100%** based on evidence
   - 0% = Not implemented
   - 50% = Partially implemented (some evidence, gaps remain)
   - 100% = Fully implemented (evidence complete, auditable, maintained)

3. **Average per block** (e.g., Block A: (100+100+80+90+...) / 10 = 85%)

4. **Weighted average across all blocks** (typically equal weight, but can weight by criticality)

**Example: Block A Governance Pre/Post**

| Item                               | v1.3 Score | Phase 8 Evidence                                  | Post-Phase 8 Score | Δ          |
| ---------------------------------- | ---------- | ------------------------------------------------- | ------------------ | ---------- |
| A-1.1: Annual management review    | 60%        | Meeting minutes (May 2026) + attendance + actions | 100%               | +40        |
| A-2.1: Risk assessment process     | 80%        | FMEA matrix with P×S×D scoring                    | 100%               | +20        |
| A-3.1: NC tracking                 | 70%        | NC module with 12 CAPAs closed                    | 90%                | +20        |
| A-3.2: CAPA efficacy               | 50%        | Effectiveness verification checklists             | 100%               | +50        |
| A-4.1: Management of external labs | 80%        | lab-apoio contracts + SLA dashboard               | 100%               | +20        |
| A-5.1: Audit scheduling            | 90%        | Annual internal audit calendar                    | 100%               | +10        |
| A-5.2: Audit reports               | 70%        | Audit findings logged, CAPAs assigned             | 90%                | +20        |
| A-6.1: Document control            | 75%        | SGD master list + versioning                      | 85%                | +10        |
| A-7.1: QMS review                  | 60%        | Monthly KPI dashboard + trend analysis            | 85%                | +25        |
| A-8.1: Competency assessment       | 85%        | Personnel dossiers + training records             | 95%                | +10        |
| **BLOCK A AVERAGE**                | **78%**    | (all items have evidence)                         | **85%**            | **+7 pts** |

**Auditor validation:**

- Auditor spot-checks 2–3 items per block during evidence review
- Auditor confirms scoring is conservative (not inflated)
- Auditor approves rescoring before final sign-off

**Post-Phase 8 Scorecard (published):**

```markdown
# DICQ Conformance v1.3 → Post-Phase 8

| Block       | v1.3 %    | Post-Phase 8 % | ✅ Auditor Approved | Target (Aug 2026) |
| ----------- | --------- | -------------- | ------------------- | ----------------- |
| A           | 78%       | 85%            | ✅                  | 92%               |
| B           | 65%       | 92%            | ✅                  | 92%               |
| C           | 80%       | 88%            | ✅                  | 92%               |
| D           | 60%       | 80%            | ✅                  | 85%               |
| E           | 64%       | 75%            | ✅                  | 75%               |
| F           | 92%       | 95%            | ✅                  | 95%               |
| G           | 70%       | 92%            | ✅                  | 92%               |
| H           | 75%       | 88%            | ✅                  | 88%               |
| I           | 64%       | 80%            | ✅                  | 80%               |
| J           | 70%       | 78%            | ✅                  | 78%               |
| **AVERAGE** | **78.5%** | **85.5%**      | **✅**              | **≥88%**          |
```

---

### Q4.3: What happens if auditor requests remediation during Phase 8?

**Answer:**

**RFI Handling Process:**

**Step 1: Auditor submits RFI** (0–5 business days during evidence review)

Auditor uses in-app form or email:

```
Subject: RFI-001: NC-002 Equipment Calibration — Alert System Details

Lab: Riopomba Hematologia
Finding: NC-002 (Equipment calibration overdue)

Question:
You claim the alert system prevents future overdue calibrations. Can you show:
1) The actual alert system code (how is 30-day threshold enforced?)
2) Evidence that alerts were triggered for all 15 equipment
3) Proof that no equipment became overdue after system deployment

Response Deadline: 2026-07-20
```

**Step 2: Lab receives RFI notification** (automatic email)

CTO + QA Manager notified, RFI logged to `capa-tracking/{capaId}/rfi-log/`

**Step 3: Lab prepares response** (3 business days target)

Response addresses each question:

```markdown
## RFI-001 Response

1. Alert system code:
   - File: src/features/calibracao/components/CalibracaoAlerts.tsx
   - Logic: calculateStatus(nextDueDate) returns 'warning-30d' if daysRemaining < 30
   - Rules enforce: Firestore rule prevents past-due calibrations from being marked 'in-use'

2. Evidence of triggered alerts:
   - Email log: emails sent 2026-06-15 (30d warning), 2026-06-22 (7d warning)
   - CC: lab manager + director
   - Subject: "Equipment [name] calibration due in [X] days"

3. Proof of no overdue post-deployment:
   - Dashboard screenshot: all 15 equipment show status='in-date' (as of 2026-06-30)
   - Audit trail: zero alerts for 'overdue' status post-deployment
   - Firestore query: notivisa-outbox shows no blocked results due to calibration
```

**Step 4: Auditor reviews response** (1 business day)

Auditor evaluates:

- ✅ Is response factually accurate? (code + evidence matches)
- ✅ Does response address the question? (no evasion)
- ✅ Is evidence credible? (can auditor independently verify?)

**Outcomes:**

- ✅ **APPROVED:** Response is satisfactory, no further questions, CAPA closure stands
- 🟡 **FOLLOW-UP:** Response incomplete, auditor submits RFI-001-B (revised question)
- 🔴 **REMEDIATION:** Response inadequate, corrective action required before sign-off

---

**If remediation required:**

**Option A: Urgent Code Fix** (if bug found)

- Example: Alert system has bug (sends to wrong email, or threshold is off by 1 day)
- Timeline: 3–5 business days (Phase 8 still active)
- Process: Deploy fix, re-test, submit new evidence, auditor re-reviews
- Impact: CAPA state reverts to 'evidence-submitted', awaits re-review

**Option B: Deferral to Phase 9** (if complex remediation needed)

- Example: Need to re-calibrate 3 equipment that auditor questions
- Timeline: Move to Phase 9 with explicit phase plan
- Process: Auditor acknowledges, moves CAPA from 'closed' → 'deferred-with-plan'
- Impact: DICQ block score doesn't count that evidence yet; Phase 9 includes new closure

**Option C: Accept as-is** (if auditor decides issue is minor or out-of-scope)

- Example: Auditor agrees 30-day threshold is reasonable even if RDC doesn't specify exact interval
- Timeline: CAPA closure stands
- Impact: Sign-off proceeds

---

**Target: <3 RFI cycles per evidence package** (6 closed CAPAs)

If RFI cycles exceed 3:

- Auditor + CTO sync call (30 min) to clarify expectations
- Possible root cause: Evidence narrative unclear, or auditor needs deeper technical understanding
- Outcome: Either auditor satisfied, or CAPA deferred to Phase 9

**Evidence tracking:**

```markdown
# RFI Log — Phase 8 CAPA Review

| RFI ID               | Finding | Auditor Question              | Lab Response               | Auditor Decision | Timeline                |
| -------------------- | ------- | ----------------------------- | -------------------------- | ---------------- | ----------------------- |
| RFI-001              | NC-002  | Alert system details          | Code + logs submitted      | ✅ Approved      | 2026-07-10 → 2026-07-12 |
| RFI-002              | NC-003  | Job description completeness  | 8 updated descriptions     | ✅ Approved      | 2026-07-10 → 2026-07-14 |
| RFI-003              | NC-004  | Designação signature validity | Digital signature verified | ✅ Approved      | 2026-07-12 → 2026-07-15 |
| **TOTAL RFI CYCLES** |         |                               |                            |                  | **3 cycles**            |
```

---

## Section 5: Certificate Expectations

### Q5.1: What certificates must NOTIVISA forms have?

**Answer:**

**NOTIVISA Signing Chain (RDC 786 Art. 21 — Digital Signature Requirements):**

**Form Generation (v1.4 — Sandbox, no certificate needed):**

```
Approval Flow:
1. Critical result detected → System creates NOTIVISA form (XML)
2. RT reviews form UI (anonymized patient, disease code, result)
3. RT clicks "Approve" → Cloud Function `sealNotivisaDraft` triggered
4. Server computes: chainHash = HMAC-SHA256(formXML, HCQ_HMAC_KEY)
5. Firestore stores: { form: XML, chainHash: "abc123...", approvedBy: "rt-123", approvedAt: timestamp }
6. Audit log: { action: "notivisa-approved", timestamp, rtId, chainHash }
```

**No X.509 certificate needed for v1.4.** HMAC sealing is sufficient for audit trail integrity (RDC 786 Art. 21 compliance).

---

**Form Submission (v1.5+ — Production, certificate required):**

```
Submission Flow:
1. RT triggers submission (manual button or automatic via scheduler)
2. Cloud Function `submitNotivisaToAnvisa` reads approved form + chainHash
3. Server loads: Certificate = Secret Manager('NOTIVISA_CERTIFICATE')
   - Certificate type: e-CNPJ ICP-Brasil digital certificate (.pfx/.pem)
   - Subject: Riopomba Hematologia Laboratória
   - Issuer: [ICP-Brasil root CA]
   - Valid dates: [issued date] to [expiry date]
4. Server signs: digitalSignature = RSA-SHA256(formXML, privateKeyFromCertificate)
5. Server submits: { form: XML, signature: digitalSignature, certificate: X.509cert }
   to https://api.notivisa.gov.br/submit
6. Anvisa responds: { status: "accepted", receiptCode: "NOTIVISA-2026-05-07-00123456" }
7. Firestore updates: { status: "submitted", receiptCode, submittedAt: timestamp }
8. Audit log: { action: "notivisa-submitted", receiptCode, timestamp, signature: digitalSignature }
```

**Certificate must be:**

- ✅ **e-CNPJ (digital certificate for companies)**
  - Issued to Riopomba Hematologia (CNPJ: XX.XXX.XXX/XXXX-XX)
  - By ICP-Brasil accredited authority (not self-signed)
  - Contains company name, CNPJ, and public key

- ✅ **RSA 2048-bit or higher**
  - Key size sufficient for production digital signatures
  - Government standard for e-CNPJ

- ✅ **Valid at time of submission**
  - Not expired
  - Not revoked

- ✅ **Stored securely**
  - Private key in Secret Manager (encrypted at rest, audited access)
  - Not in code repository
  - Rotation scheduled every 3–5 years (or per issuer requirements)

---

### Q5.2: When must certificate be provisioned?

**Answer:**

**Timeline:**

| Phase                            | Feature                                | Certificate Needed? | Status         | Action                                                      |
| -------------------------------- | -------------------------------------- | ------------------- | -------------- | ----------------------------------------------------------- |
| **Phase 4** (2026-06-01 ~ 07-15) | NOTIVISA form generation + RT approval | ❌ NO               | v1.4 (sandbox) | Start provisioning request                                  |
| **Phase 8** (2026-07-01 ~ 08-04) | NOTIVISA form submission to Anvisa     | ✅ YES (v1.5)       | If ready       | Deploy API integration, use manual fallback if cert delayed |
| **Phase 9+** (2026-08-15+)       | Production NOTIVISA auto-submission    | ✅ YES              | If delayed     | Manual submission fallback remains in place indefinitely    |

**Certificate Provisioning Timeline (4–6 weeks typical):**

```
Week 1 (Now):       Request certificate from ICP-Brasil authority
                    Provide: Riopomba CNPJ, director contact, business justification
                    Authority: E-Cidade, Certsign, Certisign, or equivalent

Week 2–4:           Authority verifies Riopomba credentials (company registration, tax compliance)
                    Authority may require: notarized documents, director ID, proof of CNPJ

Week 5–6:           Authority issues e-CNPJ certificate (.pfx / .p12 file)
                    Delivery: Email with certificate + password to decrypt

Week 6:             Import certificate into Secret Manager
                    Test: Verify signature verification works in staging

Week 7:             Deploy v1.5 (NOTIVISA API integration)
                    Go-live with auto-submission enabled
```

**Action items for CTO/Riopomba:**

- [ ] **By 2026-05-15:** Identify ICP-Brasil authority (recommend Certsign, E-Cidade, Certisign)
- [ ] **By 2026-05-20:** Submit e-CNPJ request (2-week SLA once submitted)
- [ ] **By 2026-06-15:** Receive certificate, store in Secret Manager, test in staging
- [ ] **By 2026-07-01 (Phase 8 start):** Certificate ready for v1.5 integration
  - If ready: Deploy v1.5 immediately (auto-submission enabled)
  - If delayed: Continue with v1.4 + manual fallback (still compliant)

**Cost estimate:** ~R$ 200–500/year (typical e-CNPJ fee in Brazil)

---

### Q5.3: What happens if certificate provisioning is delayed?

**Answer:**

**Contingency: Manual NOTIVISA Submission (Indefinite Fallback)**

**Phase 8+ without production certificate:**

```
Step 1: RT approves NOTIVISA form (in HC Quality app)
        ↓
Step 2: System exports form to PDF (already signed with chain-hash + RT approval)
        ↓
Step 3: RT manually logs into Anvisa NOTIVISA portal
        ↓
Step 4: RT uploads PDF (via Anvisa's web form)
        ↓
Step 5: Anvisa portal processes form, generates receipt code
        ↓
Step 6: RT copies receipt code back into HC Quality (manual input field)
        ↓
Step 7: System logs: { action: "notivisa-manual-submission", receiptCode, timestamp }
        ↓
**Compliant.** ✅
```

**Compliance verification:**

- ✅ **RDC 978 Art. 66:** "Notify health authority of reportable diseases" — achieved via manual submission to Anvisa portal
- ✅ **RDC 786 Art. 21:** "Digital signature" — PDF form signed by RT (via chain-hash + approval timestamp)
- ✅ **Audit trail:** Receipt code logged in Firestore (immutable proof of submission)
- ✅ **Timeline:** Manual submission typically completes within 24h (SLA met)

**Operational burden:**

- **RT effort:** ~2 min per form (click "export", log in Anvisa, upload, paste receipt code)
- **For Riopomba:** Average 5–10 reportable cases/year = ~30–60 min annual overhead
- **Scalability:** Doesn't degrade as lab grows

**Evidence of manual submission:**

```typescript
interface NotivisaManualSubmission {
  formId: string;
  exportedAt: timestamp;
  exportedBy: string; // RT ID
  pdfHash: string; // SHA-256(exported PDF)
  submittedToAnvisaAt: timestamp; // when RT uploaded
  receiptCode: string; // from Anvisa portal (e.g., "NOTIVISA-2026-05-07-00123456")
  receiptCodeEnteredAt: timestamp;
  enteredBy: string; // operator who logged receipt code
  signature: LogicalSignature; // chain-hash sealing (immutable)
}
```

**Risk: LOW**

- Manual submission is industry-standard (all labs have backup procedure)
- No compliance gap (auditor will accept with audit trail)
- Contingency indefinitely available (doesn't expire)

**Timeline:**

- Phase 4–8: Use manual fallback if certificate delayed
- Phase 9+: If certificate finally arrives, transition to auto-submission (no disruption)

---

## Section 6: Frequently Asked Questions (FAQs)

### Q6.1: What is "auditor sign-off" in the context of Phase 8 CAPAs?

**Answer:**

**Definition:** Auditor's written confirmation that evidence package for Phase 8 CAPAs is complete, credible, and acceptable for regulatory compliance file.

**Not:** Final external audit (that's Phase 15, 2026-10-15).

**What it looks like:**

```
Email from Ernani (external auditor):

Subject: Phase 8 CAPA Evidence Package — Sign-Off Confirmed

To: drogafarto@gmail.com

Body:
I have reviewed the evidence for all 12 CAPAs (6 closed + 6 deferred with phase plans).
Evidence is complete and acceptable. No blocking concerns.

Phase 8 CAPA closure is approved. Ready for Phase 9 execution.

Regards,
Ernani
[DICQ accreditation body / firm name]
[Timestamp: 2026-07-20 14:30 BRT]
```

**Implications:**

- ✅ CAPA closure process is compliant with RDC 978 + DICQ standards
- ✅ Auditor trusts evidence (credible, auditable, no red flags)
- ✅ Phase 8 complete, Phase 9 can proceed
- ✅ DICQ block rescoring is verified (85.5% baseline confirmed)

**Not implying:**

- ❌ Final accreditation approval (that requires full external audit)
- ❌ Zero gaps in compliance (deferred CAPAs still need Phase 9 work)
- ❌ Lab is "audit-ready" (Phase 13 compliance reporting still needed)

---

### Q6.2: Do all 12 CAPAs need to be "closed" by end of Phase 8, or can some defer to Phase 9?

**Answer:**

**Mixed closure is allowed:**

- **6 CAPAs closed by Phase 8 Week 4** (NC-001–004, NC-009, NC-012)
  - Evidence complete
  - Auditor sign-off received
  - State='closed' in Firestore (final)

- **6 CAPAs deferred to Phase 9+** (NC-005–008, NC-010–011)
  - Root cause documented
  - Phase plan written (scope, timeline, owner, success criteria)
  - Auditor acknowledgment obtained ("OK, I understand the deferral plan")
  - State='deferred' in Firestore (not final, awaiting Phase 9 work)

**Auditor sign-off covers both:**

- "Approved: 6 CAPAs closed. 6 deferred CAPAs have realistic phase plans. Proceed with Phase 9."

**DICQ impact:**

- Closed CAPAs count toward v1.4 DICQ score (78.5% → 85.5% per current plan)
- Deferred CAPAs will improve DICQ further in Phase 9+ (85.5% → 88%+)

**Regulatory status:**

- ✅ Compliant (RDC 978 allows multi-phase remediation if documented and scheduled)

---

### Q6.3: What if the external auditor disagrees with DICQ block rescoring?

**Answer:**

**Scenario: Auditor claims Block A should be 80% (not 85%)**

**Process:**

1. **Auditor submits detailed feedback:**

   ```
   "Item A-3.1 (NC tracking): Evidence shows 12 CAPAs tracked, but NC module
   lacks evidence of RT sign-off on effectiveness. Recommend rescoring from 100% → 80%."
   ```

2. **Lab investigates:**
   - Pull actual data: RT signatures captured in `capaTracking/{capaId}/auditLog`
   - Screenshot: RT approval timestamp visible in UI
   - Test: Verify RT cannot proceed without signature (Rules enforce this)

3. **Lab responds:**

   ```
   "Block A-3.1: RT sign-off is captured in Firestore audit log (immutable timestamp).
   Here's evidence:
   - Firestore query: [screenshot showing RTid + signature timestamp]
   - Code: [firestore.rules excerpt: "allow update only if request.auth.uid == rtId"]
   - This satisfies the 'RT sign-off' requirement. Recommend maintaining 100% score."
   ```

4. **Auditor decision (3 possible outcomes):**
   - ✅ **Accept:** "You're right, evidence supports 100%. Approved."
   - 🟡 **Compromise:** "I'll score this 90% (split difference). Acceptable."
   - 🔴 **Reject:** "Evidence doesn't address my concern (e.g., sign-off happens too late in process). Reduce to 70%."

5. **Final DICQ score:**
   - If accepted: Block A remains 85% (original plan)
   - If compromise: Block A becomes 83% (slightly lower, still on track)
   - If rejected: Block A becomes 76% (off-track, Phase 9 remediation may be needed)

**Overall impact:**

- If 1–2 blocks scored lower: Entire scorecard drops by 1–2 pts (still within tolerance)
- If 3+ blocks disputed: May trigger Phase 9 acceleration (expedite some features to reach 88%+ target by Aug)

**How to prevent disagreement:**

1. **Be conservative in scoring** (score at 80% unless evidence is ironclad)
2. **Document evidence comprehensively** (don't assume auditor trusts code + screenshots)
3. **Sync with auditor mid-Phase 8** (weekly calls, share preliminary scores for feedback)

---

### Q6.4: Is there a "final compliance certificate" that gets issued?

**Answer:**

**Not from DICQ or ANVISA** (until external audit in Phase 15).

**However, HC Quality produces:**

**1. DICQ Conformance Report** (Phase 13 deliverable)

```
File: .planning/phases/13-dicq-audit/PHASE_13_DICQ_CONFORMANCE_MATRIX.md

Contents:
- Block-by-block scores (A–J)
- Evidence mapping (each block references supporting documents)
- Auditor sign-offs (if Phase 8 auditor reviews it)
- Timeline for reaching 88%+ (Phase 13)

Status: Internal compliance document (archived for external audit)
```

**2. RDC 978 Compliance Verification Report** (Phase 13 deliverable)

```
File: .planning/phases/13-dicq-audit/PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md

Contents:
- 8 critical articles (117, 167, 179–191, 204) verified with code evidence
- Implementation status per article
- Risk assessment (if any articles partially implemented)

Status: Internal verification (submitted to ANVISA if requested)
```

**3. External Audit Report** (Phase 15 output, ~Oct 2026)

```
Issued by: [Deloitte / EY / Accenture Security / equivalent]

Contains:
- DICQ certification (if ≥92% achieved)
- Recommendations
- Areas for future improvement

Status: **Official compliance certificate** (suitable for marketing, patient trust)
```

**Auditor sign-off on Phase 8 is NOT a formal certificate**, but it's a key step toward the Phase 15 certificate.

---

## Appendix A: Document Checklist

**Before distributing to auditor, verify:**

- [ ] All 7 sections complete (compliance preferences, Phase 8 format, legal blockers, sign-off criteria, certificates, FAQs, appendices)
- [ ] Links to source documents validated (ADRs exist, file paths correct)
- [ ] RDC 978 articles cited are accurate (cross-check against official regulation)
- [ ] DICQ blocks referenced are consistent with v1.3/Phase 13 baseline data
- [ ] NOTIVISA timeline aligns with project roadmap (Phase 4 vs Phase 8 vs Phase 9)
- [ ] Sign-off criteria are achievable (5 gates are realistic)
- [ ] Certificate provisioning timeline is defensible (4–6 weeks is standard for e-CNPJ)
- [ ] Q&A responses are internally consistent (same DICQ score mentioned in multiple sections matches)

---

## Appendix B: Key Document References

| Document                    | Location                                                                | Purpose                              |
| --------------------------- | ----------------------------------------------------------------------- | ------------------------------------ |
| RDC 978 Compliance Matrix   | `docs/RDC_978_COMPLIANCE_MATRIX_v1.4_ROADMAP.md`                        | Maps 200+ RDC articles to phases     |
| DICQ Conformance Report     | `.planning/phases/13-dicq-audit/PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md` | Block-by-block audit results         |
| ADR-0012: Audit Trail       | `docs/adr/ADR-0012-rdc-978-audit-trail-logical-signature.md`            | LogicalSignature (HMAC sealing) spec |
| ADR-0014: NOTIVISA          | `docs/adr/ADR-0014-notivisa-integration-sandbox-to-production.md`       | NOTIVISA roadmap + cert plan         |
| ADR-0015: Patient Portal    | `docs/adr/ADR-0015-patient-portal-email-link-auth.md`                   | Portal auth + LGPD alignment         |
| Phase 8 Evidence Plan       | `.planning/phases/08-capa-closure/08-02-PLAN.md`                        | Micro-modules + CAPA structure       |
| Auditor RFI Responses       | `.planning/AUDITOR_RFI_PHASE4_RESPONSES.md`                             | 7 RFIs + evidence trails             |
| Auditor Alignment Framework | `.planning/AUDITOR_ALIGNMENT_FRAMEWORK.md`                              | Weekly calls, compliance scoring     |

---

## Appendix C: Contact & Escalation

| Role                 | Contact                      | Phone | Escalation Trigger                   |
| -------------------- | ---------------------------- | ----- | ------------------------------------ |
| **CTO**              | drogafarto@gmail.com         | —     | Blocking RFI, phase slip >3 days     |
| **External Auditor** | ernani@firm.com (TBD)        | —     | Compliance gap, DICQ concern         |
| **Audit Lead**       | (TBD — assign by 2026-05-20) | —     | Weekly reporting, RFI tracking       |
| **QA Manager**       | (Riopomba internal)          | —     | Internal evidence review, CAPA gates |

---

**Document Owner:** CTO  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-06-15 (Phase 4 mid-point)  
**Distribution:** External Auditor (Ernani), CTO, QA Manager, Internal team

---
