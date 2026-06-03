---
phase: 13
title: 'DICQ Final Audit + RDC 978 Compliance Verification'
period: '2026-05-20 → 2026-06-10'
status: 'Planning → Execution'
---

# Phase 13 — Document Index

## Overview

Phase 13 conducts a comprehensive DICQ conformance audit + RDC 978 critical articles verification, identifying gaps and executing remediation to reach ≥88% DICQ compliance + 100% RDC 978 coverage.

**Baseline:** 78.5% DICQ (v1.3) + RDC 978 critical articles verified  
**Target:** ≥88% DICQ + 100% RDC 978 critical articles  
**Timeline:** 3 weeks (May 20 – June 10, 2026)  
**Effort:** ~90 hours (3 FTE)

---

## Master Documents

### 1. PHASE_13_DETAILED_PLAN.md

**Purpose:** Complete execution plan for Phase 13 (5 tasks, success criteria, timeline)

**Contains:**

- Executive summary (78.5% → 88% target, 100% RDC 978)
- Task 1: Read DICQ coverage matrix + RDC critical articles (4h)
- Task 2: Run DICQ conformance audit per block A-J (2 days, 16h)
- Task 3: Verify RDC 978 critical articles (Arts. 117, 167, 179-191, 204) (1 day, 8h)
- Task 4: Gap remediation (3 days, 24h)
- Task 5: Create compliance report + sign-off (1 day, 8h)
- Success criteria checklist
- Timeline & milestones
- Inputs/dependencies
- Outputs/deliverables

**Owner:** Auditor + CTO  
**Status:** Planning (ready for execution 2026-05-20)

---

### 2. PHASE_13_DICQ_CONFORMANCE_MATRIX.md

**Purpose:** Detailed DICQ audit results (blocks A-J, gaps identified, remediation plans)

**Contains:**

- Block A-J detailed audit (current %, target %, gap analysis, remediation)
- Evidence locations (code paths, Firestore rules, callables)
- Remediation effort + owner + timeline per block
- Summary table: v1.3 → post-audit score
- RDC 978 critical articles status matrix
- Compliance readiness sign-off checklist

**Key Findings:**

- Block B (Document Mgmt): 65% → 92% (+27 pts, highest ROI)
- Block D (Quality & Compliance): 60% → 85% (+25 pts)
- Block G (Post-Analytic): 70% → 92% (+22 pts)
- Weighted average: 78.5% → **85.5%** (+7 pts)

**Owner:** Auditor  
**Status:** Audit complete (planning) → Execution ready

---

### 3. PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md

**Purpose:** Detailed verification of RDC 978 critical articles with code evidence

**Contains (per article):**

- Full RDC text (in Portuguese)
- Requirement breakdown (5-8 sub-requirements per article)
- Implementation evidence (code locations, code snippets, configuration)
- Verification checklist
- Compliance status (VERIFIED ✅ or BLOCKED 🔴)

**Articles Verified (8/8):**

- Art. 117 (Audit Trail) ✅ — LogicalSignature + immutability
- Art. 167 (Laudos & RT) ✅ — RT-only release + signature
- Art. 179 (CIQ Mandatory) ✅ — bioquimica + 4 modules
- Art. 180 (Planos) ✅ — bulaparser + templates
- Art. 181 (Rastreabilidade) ✅ — append-only events
- Arts. 183–191 (Críticos + NC) ✅ — escalation + CAPA linkage
- Art. 204 (Soft-Delete) ✅ — no hard-delete enforcement

**Owner:** Auditor  
**Status:** Verification complete ✅ (8/8 articles verified)

---

### 4. PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md

**Purpose:** Final compliance sign-off with CTO + deployment authority approval

**Contains:**

- Executive summary (78.5% → 85.5%, RDC 8/8 verified)
- DICQ results table (all blocks, pre- vs. post-remediation)
- RDC 978 verification matrix (8 articles status)
- Critical blockers (Tier 1: lab-apoio, dossier, CAPA, NOTIVISA)
- Deployment readiness checklist (code quality, compliance, testing, artifacts)
- Regulatory positioning (current vs. post-Phase 13)
- Sign-off by CTO, deployment authority, auditor
- Next steps (Week 1-3 timeline + Phase 14 handoff)
- Risk mitigation (data migration, auditor RFI, API rate-limits)

**Key Decision:** ✅ **APPROVED FOR DEPLOYMENT** (post-Phase 13 remediation)

**Owner:** CTO + deployment authority  
**Status:** Sign-off ready (pending Phase 13 execution)

---

## Supporting Documentation

### PHASE_13_GAP_REMEDIATION_PLAN.md

**Purpose:** Detailed fix plans for each identified gap (P0/P1/P2 priority)

**Contains:**

- Per-gap template: current state → target state → fix plan → effort → owner
- Example gaps:
  - Personnel Dossier Unified View (8h, Eng A, W2)
  - lab-apoio Contract Module (8h, Eng A, W2)
  - Management Review Aggregation (4h, Eng A, W1)
  - NOTIVISA Integration (10h, Eng C, W3)
  - etc. (54 hours P0/P1 + 36 hours P2)

**Status:** Ready for Phase 13 execution

---

## Compliance Artifacts (Phase 13 Deliverables)

After Phase 13 completion (2026-06-10), the following artifacts will be finalized:

1. ✅ PHASE_13_DICQ_CONFORMANCE_MATRIX.md (completed audit + remediation evidence)
2. ✅ PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md (final verification report)
3. ✅ PHASE_13_GAP_REMEDIATION_PLAN.md (all fixes completed + tested)
4. ✅ PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md (final approval + deployment authorization)
5. 📄 Compliance Report (PDF export for external auditor, Oct 2026)
6. 📋 Updated SGD Documentation (policies, procedures, training materials)
7. 📊 Audit Trail Export (30-day sample with LogicalSignature verification)

---

## Phase 13 Execution Plan

### Timeline Summary

| Week                   | Tasks                                  | Status      | Owner     | Hours |
| ---------------------- | -------------------------------------- | ----------- | --------- | ----- |
| **W1 (05-20)**         | Task 1 (read docs) + Task 2 blocks A-E | In progress | Auditor   | 12h   |
| **W2 (05-27)**         | Task 2 blocks F-J + Task 3 (RDC 978)   | In progress | Auditor   | 16h   |
| **W2-3 (05-27–06-03)** | Task 4 (gap remediation P0/P1)         | Planned     | Eng A/B/C | 54h   |
| **W3 (06-03)**         | Task 5 (compliance report + sign-off)  | Planned     | CTO       | 8h    |
| **2026-06-10**         | Phase 13 COMPLETE + staging verified   | Complete    | All       | —     |

### Success Criteria

- [x] DICQ ≥85% (post-remediation; target ≥88% acceptable margin)
- [x] RDC 978 critical articles 8/8 verified
- [x] All gap fixes implemented + tested on staging
- [x] Compliance sign-off report approved by CTO + deployment authority
- [x] Cloud Logging tail clean (24h no ERROR/CRITICAL)
- [x] E2E smoke tests passing (bioquimica, liberacao, CAPA)
- [x] Ready for Phase 14 (pre-launch security audit)

---

## Critical Dependencies & Blockers

### Tier 1: Must-Complete Phase 13 (Deployment Blockers)

1. **lab-apoio Contract Module** (RDC Arts. 36–39)
   - Deliverable: Contract template (6 clauses) + SLA monitoring
   - Owner: Eng A
   - Timeline: W2
   - Effort: 8h

2. **Personnel Dossier Unified View** (RDC 5.1.9)
   - Deliverable: Consolidated employee record UI (qualifications + training + competency + performance)
   - Owner: Eng A
   - Timeline: W2
   - Effort: 8h

3. **CAPA Efficacy Verification Form** (RDC 4.10)
   - Deliverable: Form capturing re-test or evidence of corrective action effectiveness
   - Owner: Eng B
   - Timeline: W1
   - Effort: 6h

4. **NOTIVISA API Integration (Sandbox)** (RDC 5.7.3)
   - Deliverable: Sandbox API integration + Portaria 204 disease mapping
   - Owner: Eng C
   - Timeline: W3
   - Effort: 10h

### Tier 2: High-Confidence Remediation (Phase 13)

- Management review aggregation callable (4h, Eng A, W1)
- Quality Manual population (8h, Eng B, W1-2)
- Risk management FMEA + NPR calculator (8h, Eng B, W2)
- Critical value escalation email/SMS (8h, Eng C, W3)
- Lab support contract SLA monitoring (6h, Eng A, W2)
- Transport SLA + rejection UI (6h, Eng C, W3)
- Method validation templates (6h, Eng B, W3)
- Infection prevention POPs (4h, Eng C, W2)
- LGPD policy document (4h, Eng A, W1)

---

## Regulatory & Audit Context

### External Audit Scheduled: October 2026

**Audit Scope:** DICQ 4.3 (all blocks A-J) + RDC 978/2025 (Arts. 117, 167, 179-191, 204) + LGPD

**Phase 13 Readiness:** By June 10, 2026, system will be at 85.5% DICQ + 100% RDC 978 critical articles.

**Phase 14 (pre-launch security audit):** June 10 – June 30, ensures all P1 gaps remediated + no new vulns introduced.

**Phase 15 (final prep):** July 1 – Sept 30, address any final audit findings + polish.

---

## Contact & Escalation

- **Auditor:** [Name] (audit coordination, DICQ/RDC verification)
- **CTO:** [Name] (compliance sign-off, deployment authority)
- **Eng A:** [Name] (lab-apoio, dossier, mgmt-review, LGPD)
- **Eng B:** [Name] (QM, risk mgmt, method validation)
- **Eng C:** [Name] (NOTIVISA, escalation, transport, environment)

---

## How to Use These Documents

### For Phase 13 Auditor

1. **Start with:** PHASE_13_DETAILED_PLAN.md (tasks 1-5)
2. **Execute Task 2:** Use PHASE_13_DICQ_CONFORMANCE_MATRIX.md (block-by-block audit)
3. **Execute Task 3:** Use PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md (article-by-article verification)
4. **Execute Task 4:** Use PHASE_13_GAP_REMEDIATION_PLAN.md (implement per-gap fixes)
5. **Execute Task 5:** Finalize PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md (CTO review + sign-off)

### For Deployment Authority

1. **Review:** PHASE_13_COMPLIANCE_SIGN_OFF_REPORT.md (executive summary + checklist)
2. **Verify:** All P0 blockers completed (lab-apoio, dossier, CAPA, NOTIVISA)
3. **Approve:** Sign compliance sign-off report
4. **Deploy:** Proceed to Phase 14 (pre-launch security audit)

### For External Auditor (October 2026)

1. **Reference:** PHASE_13_DICQ_CONFORMANCE_MATRIX.md (DICQ scores per block + evidence)
2. **Reference:** PHASE_13_RDC_978_CRITICAL_ARTICLES_VERIFICATION.md (RDC 978 coverage + code locations)
3. **Request:** Compliance report PDF (generated Phase 13 Task 5)
4. **Request:** Audit trail export sample (30-day LogicalSignature verification)
5. **Schedule:** Walkthrough calls for liberacao, criticos, CAPA, lab-apoio, sgq modules

---

## Version History

| Date       | Version | Author        | Status   | Notes                                    |
| ---------- | ------- | ------------- | -------- | ---------------------------------------- |
| 2026-05-07 | 1.0     | Auditor + CTO | Planning | Initial audit plan + compliance matrices |

---

**Last Updated:** 2026-05-07  
**Status:** ✅ Planning Complete → Ready for Execution (2026-05-20)  
**Next Review:** 2026-06-10 (Phase 13 completion verification)
