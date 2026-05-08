---
document: Auditor Materials Index & Quick Access Guide
created: 2026-05-07
updated: 2026-05-07
audience: External Auditor + QA Lead + CTO
status: Ready for distribution
---

# Auditor Materials Index — Quick Access Guide

**Purpose:** Centralized inventory of all audit-relevant materials for v1.3 (live) and v1.4 (roadmap) phases.

**Organization:** Grouped by use case (compliance audit, technical deep-dive, operational procedures, weekly reporting).

**Last Updated:** 2026-05-07  
**Distribution:** Shared folder + email weekly updates  
**Access Level:** Auditor = Viewer (read-only GCP + Drive)

---

## Quick Navigation by Role

### For External Auditor (Compliance Lead)
**Start here → Use in order:**

1. **AUDITOR_ALIGNMENT_CALL_AGENDA.md** (this meeting)
   - 120-min call flow + materials overview
   - *When to use:* Before/during alignment call

2. **COMPLIANCE_SUMMARY_v1.3.md** (12 pages)
   - RDC 978 article mapping, DICQ block scores, LGPD inventory, ISO 15189 alignment
   - *When to use:* Detailed audit trail reference; verify v1.3 baseline (78.5%)

3. **v1.3-COMPLETION-SUMMARY.md** (4 pages)
   - What shipped, what deferred, metrics, known issues resolved
   - *When to use:* Quick overview of v1.3 scope + scope boundaries

4. **v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md** (12 pages)
   - Weekly compliance matrix, DICQ roadmap, RDC article phased coverage, CAPA closure schedule
   - *When to use:* Weekly Friday calls (13:30 BRT review before 14:00 call); track progress

5. **ADR-0022-capa-closure-workflow-5-state-machine.md** (8 pages)
   - CAPA state machine technical spec; Cloud Function callables; Firestore schema; audit trail design
   - *When to use:* Deep-dive into Phase 4 CAPA implementation; verify against code before sign-off

6. **CLOUD_LOGS_QUICK_REFERENCE.md** (2 pages)
   - Cloud Logs setup, critical filters, red flags, emergency procedures
   - *When to use:* Spot-check production health; emergency troubleshooting

---

### For QA Lead (Liaison)
**Maintain these weekly:**

1. **v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md** (update every Friday 14:00 BRT)
   - Track compliance progress + CAPA closure status + phase milestones
   - Owner: QA Lead (rows update before Friday call)

2. **AUDITOR_ALIGNMENT_CALL_AGENDA.md** (reference for weekly calls)
   - Meeting template + action item tracker
   - Owner: QA Lead (facilitate every Friday)

3. **Weekly Cloud Logs Summary** (generated Friday 13:30 BRT)
   - Error count, error types, resolution status, critical issues
   - Format: JSON export (see CLOUD_LOGS_QUICK_REFERENCE.md for script)
   - Owner: QA Lead (email summary to auditor)

---

### For CTO (Technical Authority)
**Use for Phase 4 delivery + design decisions:**

1. **ADR-0022-capa-closure-workflow-5-state-machine.md** (design specification)
   - Reference for Cloud Function implementation + Firestore rules generation
   - Auditor may challenge design; ADR documents rationale

2. **ARCHITECTURE_v1.3.md** (system patterns)
   - Multi-tenant isolation, security rules, API design, audit trail patterns
   - Use for Phase 4 modules (apply same patterns to CAPA + evidence management)

3. **DEPLOY_ROADMAP_v1.3.md** (deployment procedures)
   - Will be updated for v1.4 Phase 4 deployment
   - Reference for rollback + smoke test procedures

4. **COMPLIANCE_SUMMARY_v1.3.md** (compliance baseline)
   - Verify Phase 4 doesn't introduce compliance regressions
   - Spot-check RDC 978 article coverage before Phase 4 kickoff

---

## Materials by Category

### 1. Compliance Audit Documents
*For auditor verification + sign-off*

| Document | Pages | Purpose | Owner | Update Freq |
|----------|-------|---------|-------|-------------|
| **COMPLIANCE_SUMMARY_v1.3.md** | 12 | v1.3 RDC/DICQ/LGPD/ISO mapping; audit-ready baseline | QA Lead | Never (frozen at v1.3) |
| **v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md** | 12 | Weekly progress tracker; RDC article roadmap; CAPA closure schedule | QA Lead | Every Friday |
| **AUDITOR_ALIGNMENT_CALL_AGENDA.md** | 15 | Alignment call template; action items; contact list | QA Lead | Before each call |
| **Weekly Cloud Logs Summary** | 1 | Error count + types + resolution status (JSON export) | QA Lead | Every Friday 13:30 BRT |

### 2. Technical Specifications & Architecture
*For code audits + design reviews*

| Document | Pages | Purpose | Owner | Update Freq |
|----------|-------|---------|-------|-------------|
| **ADR-0022-capa-closure-workflow-5-state-machine.md** | 8 | CAPA state machine spec; callables; Firestore schema; audit trail design | CTO | Locked (Phase 4 design) |
| **ARCHITECTURE_v1.3.md** | 10 | System patterns; multi-tenant isolation; auth; compliance rules | CTO | Archived (v1.3 reference) |
| **FIRESTORE-RULES-BACKUP.md** | 5 | v1.3 rules export (backup); can be compared to git HEAD | DevOps | On deployment |
| **CAPA-FIRESTORE-RULES-BLOCK.md** | 3 | Phase 4 CAPA collection rules (generated from ADR-0022) | CTO | Before Phase 4 deploy |

### 3. Operational Procedures
*For lab + auditor execution*

| Document | Pages | Purpose | Owner | Update Freq |
|----------|-------|---------|-------|-------------|
| **CLOUD_LOGS_QUICK_REFERENCE.md** | 2 | One-min setup; critical filters; red flags; emergency rollback | QA Lead | As needed |
| **CAPA_EVIDENCE_SUBMISSION_SOP.md** | 3 | Lab workflow for submitting CAPA evidence; deadline; checklist | Lab Director | Before Phase 4 |
| **AUDITOR_REVIEW_RUNBOOK.md** | 3 | Auditor workflow for CAPA approval/rejection; UI navigation | QA Lead | Before Phase 4 |
| **PHASE_4_DEPLOYMENT_CHECKLIST.md** | 4 | Pre/during/post-deploy tasks; sign-off | DevOps | Before Phase 4 deploy |

### 4. v1.3 Snapshot (Archived Reference)
*For baseline comparison + historical tracking*

| Document | Pages | Purpose | Use Case |
|----------|-------|---------|----------|
| **v1.3-COMPLETION-SUMMARY.md** | 4 | What shipped, what deferred, scope boundaries, metrics | "What's in v1.3?" |
| **v1.3-DEPLOYMENT_LOG.md** | 2 | Deployment date/time, environment, build status, post-deploy monitoring | Deployment history |
| **v1.3-ARCHIVE.md** | 2 | Consolidated summary of v1.3 (1-pager) | Executive summary |
| **DEPLOY_ROADMAP_v1.3.md** | 5 | v1.3 deployment procedures; will be adapted for v1.4 | Deployment procedures (template) |

---

## Access & Update Schedule

### Google Drive Folder Structure
```
/Auditor Materials (v1.3 + v1.4)/
├── Compliance/
│   ├── COMPLIANCE_SUMMARY_v1.3.md (frozen)
│   ├── v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md (updated Fridays)
│   └── Weekly-Cloud-Logs-Summaries/ (JSON exports)
│
├── Technical/
│   ├── ADR-0022-capa-closure-workflow-5-state-machine.md
│   ├── ARCHITECTURE_v1.3.md
│   └── CAPA-FIRESTORE-RULES-BLOCK.md (Phase 4)
│
├── Operations/
│   ├── CLOUD_LOGS_QUICK_REFERENCE.md
│   ├── CAPA_EVIDENCE_SUBMISSION_SOP.md
│   └── AUDITOR_REVIEW_RUNBOOK.md (Phase 4)
│
└── Archive-v1.3/
    ├── v1.3-COMPLETION-SUMMARY.md
    ├── v1.3-DEPLOYMENT_LOG.md
    └── DEPLOY_ROADMAP_v1.3.md
```

### Update Schedule
| Document | Owner | Frequency | Deadline | Notification |
|----------|-------|-----------|----------|--------------|
| v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md | QA Lead | Weekly | Friday 14:00 BRT | Email + calendar |
| Weekly Cloud Logs Summary | QA Lead | Weekly | Friday 13:30 BRT | Email |
| CAPA tracking rows | QA Lead | As phases complete | Real-time | Friday call |
| ADR-0022 (CAPA design) | CTO | Locked (design phase) | Before Phase 4 deploy | One-time approval |
| CAPA-FIRESTORE-RULES-BLOCK.md | CTO | Before Phase 4 deploy | May 19 | Email |
| AUDITOR_REVIEW_RUNBOOK.md | QA Lead | Before Phase 4 deploy | May 19 | Email |

---

## Reference Documents by Phase

### v1.3 (Complete & Live — 2026-05-07)
**Status:** Production live; auditor baseline established.

**Must-Read (compliance verification):**
- ✅ COMPLIANCE_SUMMARY_v1.3.md (78.5% DICQ baseline)
- ✅ v1.3-COMPLETION-SUMMARY.md (scope boundaries)
- ✅ ARCHITECTURE_v1.3.md (security patterns)

**Archive (reference only):**
- v1.3-DEPLOYMENT_LOG.md
- v1.3-ARCHIVE.md
- DEPLOY_ROADMAP_v1.3.md

---

### v1.4 Phase 4 (Kickoff May 20 — Due May 28)
**Status:** Roadmap locked; implementation in progress.

**Must-Read (Phase 4 implementation):**
- ADR-0022-capa-closure-workflow-5-state-machine.md (design spec)
- v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md (weekly progress)
- CAPA-FIRESTORE-RULES-BLOCK.md (rules spec, generated Week 1)

**Generated during Phase 4 (Week 1–2):**
- CAPA_EVIDENCE_SUBMISSION_SOP.md (lab procedure)
- AUDITOR_REVIEW_RUNBOOK.md (auditor UI workflow)
- PHASE_4_DEPLOYMENT_CHECKLIST.md (pre-deploy tasks)

---

### v1.4 Phases 5–15 (May 27 — Aug 31)
**Status:** RDC article rollout + DICQ block polishing.

**Weekly Updates (every Friday):**
- v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md (row updates for phases in flight)
- Cloud Logs Summary (production health)

**Phase Completion Deliverables (as phases complete):**
- RDC 978 article verification (per phase)
- DICQ block audit (per phase)
- Compliance regression test results

---

## How to Request Changes

**If auditor needs additional materials:**
1. Email QA Lead + CTO with specific request
2. Response SLA: 24 hours for simple docs; 1 week for new specifications
3. Track requests in shared Google Doc (link provided in kickoff call)

**If compliance gap discovered:**
1. Log in v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md as "gap" + date
2. Email CTO for remediation plan
3. CTO responds within 48 hours with mitigation strategy

**If production issue found (Cloud Logs):**
1. Screenshot error + timestamp
2. Email QA Lead + CTO immediately (P0 handling)
3. Follow CLOUD_LOGS_QUICK_REFERENCE.md emergency rollback procedures

---

## Quick Links (Copy + Paste)

**Drive Folder:** (link provided in email)  
**Cloud Logs Console:** https://console.cloud.google.com/logs/query  
**GCP Project:** hmatologia2  
**Firestore Console:** https://console.firebase.google.com/project/hmatologia2/firestore  
**Deployment Logs:** https://console.firebase.google.com/project/hmatologia2/hosting/logs  
**GitHub Repo:** (link provided if applicable)

---

## Contact Directory

| Role | Name | Email | Phone | Availability |
|------|------|-------|-------|--------------|
| External Auditor | [Name] | [auditor@firm.com] | [+55-XX-XXXX-XXXX] | 09:00–18:00 BRT |
| QA Lead (Liaison) | [Name] | [qa@lab.com] | [+55-XX-XXXX-XXXX] | 09:00–18:00 BRT |
| CTO | [CTO Name] | drogafarto@gmail.com | [+55-XX-XXXX-XXXX] | 10:00–19:00 BRT (escalation) |
| Lab Director | [Name] | [director@lab.com] | [+55-XX-XXXX-XXXX] | 08:00–19:00 BRT |

---

## Appendix: Document Summaries

### COMPLIANCE_SUMMARY_v1.3.md
**Length:** 12 pages | **Owner:** QA Lead | **Freezing:** Yes (v1.3 locked)

**Key sections:**
- RDC 978 coverage per critical article (Arts. 167, 179–180, 181, 183, 184–191)
- DICQ Blocks A–J with percentages (current 78.5%)
- LGPD inventory (62% coverage, pending Phase 4+)
- ISO 15189 alignment (88% coverage)
- Audit-ready checklist (✅ complete for v1.3)
- Critical gaps roadmap (Phase 10+ deferrals)

**Use:** Verify v1.3 baseline; reference for RDC article interpretation.

---

### ADR-0022-capa-closure-workflow-5-state-machine.md
**Length:** 8 pages | **Owner:** CTO | **Freezing:** Yes (design locked)

**Key sections:**
- Problem statement (audit trail gaps, premature closures, evidence loss)
- 5-state machine: aberto → em-andamento → evidencia-submetida → auditor-revisando → fechado
- 7 Cloud Function callables (create, start, submit, approve, reject, soft-delete)
- Firestore schema (chainHash per transition, append-only audit trail)
- Rationale (RDC 978 Art. 147 compliance, evidence chain-of-custody, auditor accountability)
- Alternatives considered (flat flags, event sourcing, rules-only; all rejected)

**Use:** Code audit reference; design challenge during Phase 4 if needed.

---

### v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md
**Length:** 12 pages | **Owner:** QA Lead | **Freezing:** No (updated Fridays)

**Key sections:**
- Executive summary (v1.4 mission, pre-alignment confirmations)
- Weekly compliance matrix (Baseline → Current → Target → Owner → Status)
- DICQ block-by-block progress (A–J, roadmap Phases 4–15)
- RDC 978 article mapping (Part 1–4, phase assignments)
- CAPA closure schedule (12 CAPAs, evidence requirements, auditor RFI SLA)
- Weekly auditor briefing cadence (Fridays 14:00 BRT, 30 min)

**Use:** Weekly tracking + Friday call reference. Update rows before each Friday call.

---

### CLOUD_LOGS_QUICK_REFERENCE.md
**Length:** 2 pages | **Owner:** QA Lead | **Freezing:** No (as-needed updates)

**Key sections:**
- One-minute setup (gcloud config, filter templates)
- Three monitoring approaches (Cloud Console, gcloud CLI, Bash script)
- Critical filters (errors, functions, permissions, hosting, timeouts)
- Red flags + actions (timeout, permission denied, 502/503, undefined, rate limit)
- Emergency rollback procedure (note timestamp, git diff, rollback, escalate)

**Use:** Spot-check production. Paste filters into Cloud Console. Emergency procedures if P0 issue found.

---

### v1.3-COMPLETION-SUMMARY.md
**Length:** 4 pages | **Owner:** QA Lead | **Freezing:** Yes (v1.3 archived)

**Key sections:**
- Executive summary (TL;DR: v1.3 delivered 4 new modules + CAPA closure infrastructure + Riopomba migration)
- Scope delivered (Phase 8–12 with status)
- Deferred to v1.4 (NC-011, Phase 10 Plans 04–07, Phase 11 Plans 06–08)
- Key metrics (12K LOC, 150 files, 50 functions, 30 components)
- DICQ conformance (71.3% → 78.5%, +7.2 pts)
- Lessons learned (functions API debt, phase parallelism, deferral honesty)

**Use:** Understand v1.3 scope boundaries; confirm what shipped and what didn't.

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-05-07 | 1.0 | Initial index created for alignment call | QA Lead |

---

## Approval & Sign-Off

**Prepared by:** QA Lead + CTO  
**Reviewed by:** CTO  
**Approved for distribution:** CTO  
**Distribution date:** 2026-05-07

---

**Next update:** Friday, 2026-05-15 (after Phase 4 Week 1 kickoff)  
**Quarterly review:** Last week of each month (sync with audit roadmap)
