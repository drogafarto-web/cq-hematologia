# Auditor RFI Documentation — Complete Index

**Purpose:** Navigation guide to all auditor-facing compliance documents. Use this to quickly locate evidence for any RDC 978 article, DICQ block, or compliance question.

**Last Updated:** 2026-05-07  
**Distribution:** External auditors, compliance team, CTO, QM

---

## Document Directory

### 📋 Main RFI Response Document
- **File:** `.planning/AUDITOR_RFI_PHASE4_RESPONSES.md`
- **Size:** 48 KB
- **Contains:** 7 common auditor questions + detailed answers + evidence paths
- **Quick Links:**
  - RFI #1 (Email Auth Security): § lines 34–108
  - RFI #2 (Portal Privacy): § lines 112–227
  - RFI #3 (NOTIVISA Integrity): § lines 232–330
  - RFI #4 (Penetration Testing): § lines 335–395
  - RFI #5 (ADRs & Risk Matrix): § lines 400–513
  - RFI #6 (Deferrals): § lines 518–588
  - RFI #7 (Rollback & Incident Response): § lines 593–723

### 📊 Executive Summary
- **File:** `.planning/AUDITOR_RFI_EXECUTIVE_SUMMARY.md`
- **Size:** 4 KB
- **Audience:** CTO, external auditors (executive-level overview)
- **Contains:** Quick answers to 7 RFIs + compliance snapshot table

### 📄 Compliance Compliance Matrix (RDC 978)
- **File:** `docs/RDC_978_COMPLIANCE_MATRIX_v1.4_ROADMAP.md`
- **Size:** 27 KB
- **Contains:** All 200+ RDC 978 articles mapped to v1.4 phases + implementation status
- **Structure:**
  - Chapter I (Arts. 1–15): General Provisions
  - Chapter II (Arts. 16–50): Organization & Management
  - Chapter III (Arts. 51–100): Pre-analytical Phase
  - Chapter IV (Arts. 101–150): Analytical Phase
  - Chapter V (Arts. 151–191): Post-analytical Phase
  - Chapter VI (Arts. 192–210): Quality Management

### 📋 DICQ Compliance Roadmap
- **File:** `docs/COMPLIANCE_ROADMAP_Phase4to9.md`
- **Size:** 19 KB
- **Contains:** Phase-by-phase DICQ compliance evolution (78.5% → 92%+)
- **Key Sections:**
  - Phase 0 (May 14): Tier-1 blockers (+3.5%)
  - Phase 1 (May 22): Governance + LGPD (+2%)
  - Phase 4 (Jul 15): CAPA + Auditoria + Portal (+3%)
  - Phase 5 (Aug 15): NOTIVISA API integration (+1%)
  - Phase 9 (Oct 15): Final compliance push (+4%)

### 🔒 Security Audit Report
- **File:** `docs/SECURITY_AUDIT_Phase3.md`
- **Size:** 24 KB
- **Scope:** Firestore Rules, Cloud Functions, OWASP Top 10 mapping
- **Key Sections:**
  - OWASP mapping (10 categories)
  - Firestore Rules assessment (data isolation, privilege escalation, signature validation)
  - Cloud Functions security
  - Shared helpers (input validation, sanitization, encryption)
  - Finding remediation roadmap

### 📋 Auditor Evidence Checklist
- **File:** `docs/AUDITOR_EVIDENCE_CHECKLIST.md`
- **Size:** 19 KB
- **Purpose:** Field-by-field verification guide for auditors
- **Structure:**
  - RDC 978 mandatory articles (A, Art. 5; B, Art. 75; C, Art. 115; D, Art. 122; E, Art. 167)
  - DICQ blocks (A–J)
  - LGPD compliance
  - Checkbox format (yes/no/partial)

### 🏗️ Phase 3 Compliance Audit (Complete)
- **File:** `docs/PHASE_3_COMPLIANCE_AUDIT.md`
- **Size:** 40 KB
- **Scope:** All 20 modules (Phase 2 complete + Phase 3 new modules)
- **Contains:** Module-by-module compliance checklist + test coverage + audit trail verification

### 📋 Phase 5 Execution Checklist (For Upcoming Phases)
- **File:** `docs/PHASE_5_EXECUTION_CHECKLIST.md`
- **Size:** 18 KB
- **Purpose:** Phase 5 (Patient Portal Phase 1) deployment readiness
- **Includes:** infrastructure checks, test coverage, compliance verification

---

## Architecture Decision Records (ADRs)

**Location:** `docs/adr/`

### Critical for Phase 4 Audits

| ADR | Title | RDC 978 Coverage | Status | Link |
|---|---|---|---|---|
| **ADR-0012** | RDC 978 Audit Trail Logical Signature | Art. 5.3, Art. 122 | ✅ Deployed | `docs/adr/ADR-0012-rdc-978-audit-trail-logical-signature.md` |
| **ADR-0014** | NOTIVISA Integration (Sandbox v1.4, API v1.5+) | Art. 66 | ✅ Planned Phase 5 | `docs/adr/ADR-0014-notivisa-integration-sandbox-to-production.md` |
| **ADR-0015** | Patient Portal Email-Link Auth v1.4 | Art. 36–39, LGPD Art. 17 | ✅ Planned Phase 4 | `docs/adr/ADR-0015-patient-portal-email-link-auth-v1-4.md` |
| **ADR-0016** | FMEA-Lite Risk Methodology (Phase 0) | Art. 86–87 | ✅ Phase 0 | `docs/adr/ADR-0016-fmea-lite-risk-methodology-phase-0.md` |
| **ADR-0017** | HMAC Baseline Reset (2026-05-07) | Art. 5.3, RDC 786 Art. 21 | ✅ Deployed | `docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md` |

### All ADRs (Phase 0–3 Complete)

| ADR | Title | Phase | Status |
|---|---|---|---|
| ADR-0001 | SPINES Architecture | Phase 0 | ✅ |
| ADR-0002 | Lote NF obrigatório | Phase 0 | ✅ |
| ADR-0003 | Não-Conformidade Capa | Phase 0 | ✅ |
| ADR-0004 | POP versioning | Phase 0 | ✅ |
| ADR-0005 | Crypto helper (HMAC) | Phase 0 | ✅ |
| ADR-0006 | Pessoa (personnel) + LGPD | Phase 0 | ✅ |
| ADR-0007 | Equipamento gate | Phase 2 | ✅ |
| ADR-0009 | React 19 + TS 5.8 version lock | Phase 1 | ✅ |
| ADR-0010 | Gemini Vision API baseline | Phase 2 | ✅ |
| ADR-0011 | Single-lab deployment model v1.4 | Phase 2 | ✅ |
| ADR-0012 | Audit trail logical signature | Phase 3 | ✅ |
| ADR-0013 | Critical results state machine | Phase 3 | ✅ |
| ADR-0014 | NOTIVISA integration | Phase 5 plan | ✅ Planned |
| ADR-0015 | Patient portal auth | Phase 4 plan | ✅ Planned |
| ADR-0016 | FMEA-Lite risk methodology | Phase 0 | ✅ Planned |
| ADR-0017 | HMAC baseline reset | Phase 3→4 | ✅ Deployed |

---

## Risk Management & Threat Modeling

### Risk Matrix (FMEA-Lite)
- **File:** `docs/FMEA_PHASE0_MATRIX.md` (coming 2026-05-14)
- **Contains:** 8 key risks, probability × severity scoring, NPR 1–125, mitigations
- **Compliance:** RDC 978 Art. 86–87 (risk management)

### Threat Model (STRIDE)
- **File:** `docs/STRIDE_THREAT_MODEL_PHASE4.md` (in-progress, due 2026-06-15)
- **Scope:** Patient portal + NOTIVISA workflow
- **Categories:** Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation

---

## Operational & Incident Response

### Incident Response & Rollback
- **File:** `docs/INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md`
- **Size:** 20 KB
- **Contains:** Runbook for Phase 4 failures + 3-layer rollback (Rules/Functions/Hosting) + recovery procedures
- **RDC 978 Article:** Art. 50 (contingency plans), Art. 115 (retention + recovery)

### Cloud Logs Monitoring Setup
- **File:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
- **Size:** 13 KB
- **Purpose:** 24/7 post-deploy monitoring (mandatory after Phase 4 deploy)
- **Includes:** Filter expressions, red flag patterns, alert thresholds

### Data Retention & Soft Delete Policy
- **File:** `docs/RETENTION_POLICY_v1.4.md` (planned)
- **RDC 978 Article:** Art. 115 (5-year retention, no hard-delete)
- **Implementation:** Firestore soft-delete via service, daily backup exports

---

## Compliance Mapping Tables

### By RDC 978 Article

**Arts. 1–15 (General Provisions):**
- Art. 5 (Quality Management System): `COMPLIANCE_ROADMAP_Phase4to9.md` § Phase 1 governance
- Art. 6 (Patient rights): RFI #2 § Patient Portal Privacy + ADR-0015
- Art. 8 (Records & document control): `COMPLIANCE_ROADMAP_Phase4to9.md` § SGD module

**Arts. 16–50 (Organization & Management):**
- Art. 20 (Supervisor presence): `COMPLIANCE_ROADMAP_Phase4to9.md` § Phase 0 turnos module
- Art. 28 (Risk management): ADR-0016 (FMEA-Lite)
- Art. 29–30 (CAPA): Phase 4 Phase execution checklist
- Art. 31 (Internal audit): Phase 4 execution checklist
- Art. 36–39 (Lab contracts + patient communication): ADR-0015 + RFI #2
- Art. 45 (Confidentiality): RFI #2 § LGPD compliance framework
- Art. 48 (NOTIVISA): ADR-0014 + RFI #3

**Arts. 167–191 (Post-analytical Phase & QC):**
- Art. 167 (Laudo 14 fields): `AUDITOR_EVIDENCE_CHECKLIST.md` § Art. 167 checklist
- Art. 179–191 (CIQ requirements): Phase 3 Compliance Audit (v1.3 complete)

### By DICQ Block

| DICQ Block | Focus | Phase | Evidence File |
|---|---|---|---|
| **A** | Quality Management | Phase 1 | `COMPLIANCE_ROADMAP_Phase4to9.md` |
| **B** | Organizational Structure | Phase 1 | `COMPLIANCE_ROADMAP_Phase4to9.md` |
| **C** | Personnel Management | Phase 1, 9 | `COMPLIANCE_ROADMAP_Phase4to9.md` |
| **D** | Risk Management | Phase 0 | ADR-0016, FMEA_PHASE0_MATRIX.md |
| **E** | Document Control | Phase 0–1 | SGD module (v1.3 complete) |
| **F** | Equipment & Supplies | Phase 0–3 | Module audit checklists |
| **G** | Pre-analytical Quality | Phase 0–3 | Module audit checklists |
| **H** | Analytical Quality | Phase 0–3 | Module audit checklists |
| **I** | Post-analytical Quality | Phase 0–3 | Module audit checklists |
| **J** | Management Review | Phase 4–5 | CAPA + Auditoria modules |

### By LGPD Article

| LGPD Clause | Requirement | v1.4 Implementation | Phase |
|---|---|---|---|
| Art. 6 | Data minimization | Portal shows only patient's laudo + NPS | Phase 4 |
| Art. 10 | Transparency | Privacy policy + consent form | Phase 1 |
| Art. 12 | Explicit consent | LGPD consent form + immutable logging | Phase 1 |
| Art. 17 | Subject access request | `exportPatientData` callable | Phase 4 |
| Art. 17 | Right to erasure | `deletionRequestHandler` (30-day anonymization) | Phase 5 |
| Art. 32 | Security measures | HMAC sealing + immutable audit trail | Phase 3–4 |
| Art. 33 | Breach notification | Incident response plan + email template | Phase 4–5 |

---

## Quick Reference by Audit Question

### "How do you prevent patient auth token reuse?"
→ **RFI #1** in `AUDITOR_RFI_PHASE4_RESPONSES.md` (§ lines 34–108)  
→ Evidence: `generatePatientAuthToken.ts` + unit tests

### "Can patients see other patients' data?"
→ **RFI #2** in `AUDITOR_RFI_PHASE4_RESPONSES.md` (§ lines 112–227)  
→ Evidence: Firestore Rules test suite (45 specs)

### "How do you prove NOTIVISA forms are correct?"
→ **RFI #3** in `AUDITOR_RFI_PHASE4_RESPONSES.md` (§ lines 232–330)  
→ Evidence: ADR-0014 + `notivisaDraftGenerator.ts` + audit trail

### "Have you done penetration testing?"
→ **RFI #4** in `AUDITOR_RFI_PHASE4_RESPONSES.md` (§ lines 335–395)  
→ Evidence: Phase 3 security audit + Phase 4 pen-test plan + Phase 8 third-party pen-test RFP

### "Where are your ADRs and risk matrix?"
→ **RFI #5** in `AUDITOR_RFI_PHASE4_RESPONSES.md` (§ lines 400–513)  
→ Evidence: `docs/adr/` (18 ADRs) + `FMEA_PHASE0_MATRIX.md` + `STRIDE_THREAT_MODEL_PHASE4.md`

### "What features are deferred? Are they regulatory mandates?"
→ **RFI #6** in `AUDITOR_RFI_PHASE4_RESPONSES.md` (§ lines 518–588)  
→ Evidence: ADR-0014 (NOTIVISA), ADR-0015 (LIS), operational fallback procedures

### "Can you roll back if Phase 4 breaks?"
→ **RFI #7** in `AUDITOR_RFI_PHASE4_RESPONSES.md` (§ lines 593–723)  
→ Evidence: `INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md` + automated backups

---

## Compliance Status Snapshot

**v1.3 (Current):** 78.5% DICQ, RDC 978 Art. 167, 179–191 ✅

**v1.4 Phase 0 (May 14):** 82% DICQ, Arts. 122, 36–39, 86–87 ✅

**v1.4 Phase 4 (Jul 15):** 87% DICQ, Arts. 31, 36–39, 66 + Portal ✅

**Phase 5–9 (Sep–Oct):** 92%+ DICQ, full RDC 978 compliance ✅

**External Audit:** 2026-10-31 (DICQ accreditation)

---

## Document Handoff Checklist

For auditor distribution, ensure these files are included:

- [ ] `AUDITOR_RFI_PHASE4_RESPONSES.md` (main Q&A document)
- [ ] `AUDITOR_RFI_EXECUTIVE_SUMMARY.md` (one-page overview)
- [ ] `RDC_978_COMPLIANCE_MATRIX_v1.4_ROADMAP.md` (all 200+ articles)
- [ ] `COMPLIANCE_ROADMAP_Phase4to9.md` (phase-by-phase breakdown)
- [ ] `SECURITY_AUDIT_Phase3.md` (findings + remediation)
- [ ] `AUDITOR_EVIDENCE_CHECKLIST.md` (field-by-field verification)
- [ ] `PHASE_3_COMPLIANCE_AUDIT.md` (module-by-module audit)
- [ ] `docs/adr/` directory (all 18 ADRs, zipped or linked)
- [ ] `INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md` (rollback playbook)
- [ ] `CLOUD_LOGS_MONITORING_GUIDE.md` (post-deploy monitoring)

**Optional (for deep-dive auditors):**
- [ ] `FMEA_PHASE0_MATRIX.md` (risk assessment)
- [ ] `STRIDE_THREAT_MODEL_PHASE4.md` (threat analysis)
- [ ] `PHASE_5_EXECUTION_CHECKLIST.md` (upcoming phase planning)

---

## Contact & Escalation

- **CTO (Decision Maker):** drogafarto@gmail.com
- **Tech Lead (Implementation):** [email]
- **QM (Compliance Lead):** [email]

---

**Version:** 1.0  
**Created:** 2026-05-07  
**Status:** Ready for distribution  
**Next Update:** 2026-06-15 (Phase 4 mid-point review)
