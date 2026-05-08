---
task: Task #17 — Auditor Alignment Call Materials
status: COMPLETE
date_completed: 2026-05-07
deliverables: 2 documents + reference materials index
audience: CTO, QA Lead, External Auditor
---

# Task #17 Deliverables — Auditor Alignment Call Materials

**Task:** Create detailed agenda for auditor alignment call. Compile reference materials: v1.3-COMPLETION-SUMMARY.md, COMPLIANCE_SUMMARY_v1.3.md, CAPA process flow, cloud logs sample. Return: agenda document + materials index.

**Status:** ✅ COMPLETE

**Date Completed:** 2026-05-07T15:00:00Z

---

## Deliverables (3 Documents)

### 1. AUDITOR_ALIGNMENT_CALL_AGENDA.md
**Location:** `C:\hc quality\docs\AUDITOR_ALIGNMENT_CALL_AGENDA.md`  
**Type:** Meeting agenda + procedural playbook  
**Length:** 15 pages  
**Owner:** QA Lead (facilitate call), CTO (decision authority)

**Contents:**
- **Pre-call preparation** (30 min checklist for CTO + QA Lead)
- **Call flow (120 minutes):**
  - Section 1: v1.3 context + compliance baseline (20 min)
    - Status: live in production; DICQ 78.5%; RDC 978 62/200 articles
    - Deferred features documented
    - Known issues resolved (TS errors, v1→v2 migration)
  - Section 2: Phase 4 roadmap (35 min)
    - CAPA closure 5-state machine (from ADR-0022)
    - 7 Cloud Function callables + evidence integrity checks
    - Auditor RFI workflow + evidence requirements
  - Section 3: Compliance roadmap (25 min)
    - RDC 978 phased coverage (Phases 4–15)
    - DICQ block advancement (target 88%+ by Aug 31)
    - Weekly auditor briefing cadence (Fridays 14:00 BRT)
  - Section 4: Cloud logs monitoring (15 min)
    - Setup instructions, critical filters, red flags
    - Auditor access (IAM Viewer role)
    - Emergency rollback procedures
  - Section 5: Materials index + action items (20 min)
    - Document inventory + update schedule
    - Action owners + due dates
    - Escalation path
  - Section 6: Closing + signature (5 min)
- **Appendix:** CAPA evidence checklist + DICQ block priorities

**Use:** Run through this agenda in the actual call with auditor; sections can be skipped if auditor familiar with topics.

---

### 2. AUDITOR_MATERIALS_INDEX.md
**Location:** `C:\hc quality\docs\AUDITOR_MATERIALS_INDEX.md`  
**Type:** Reference library + quick-access guide  
**Length:** 12 pages  
**Owner:** QA Lead (maintain & distribute)

**Contents:**
- **Quick navigation by role:**
  - Auditor: v1.3 baseline → compliance mapping → CAPA spec → weekly checklist
  - QA Lead: weekly checklist → call template → cloud logs → compliance tracker
  - CTO: CAPA spec → architecture → deployment procedures
- **Materials by category:**
  - Compliance audit documents (4 docs)
  - Technical specifications (4 docs)
  - Operational procedures (4 docs)
  - v1.3 archived reference (4 docs)
- **Access & update schedule:** Google Drive folder structure + Friday update deadlines
- **Reference by phase:** v1.3 (complete), Phase 4 (May 20–28), Phases 5–15 (May 27–Aug 31)
- **Document summaries:** 1-page synopsis of each major doc
- **Contact directory:** Auditor, QA Lead, CTO, Lab Director with availability

**Use:** Share in Week 1 of alignment; auditor bookmarks for quick reference during audit.

---

### 3. Reference Materials Compiled (Existing, Cross-Referenced)

All required materials already exist in the codebase; indexed in AUDITOR_MATERIALS_INDEX.md:

| Material | Location | Pages | Purpose | Owner |
|----------|----------|-------|---------|-------|
| **v1.3-COMPLETION-SUMMARY.md** | `.planning/milestones/` | 4 | Scope delivered, metrics, deferred features | QA Lead |
| **COMPLIANCE_SUMMARY_v1.3.md** | `docs/` | 12 | RDC 978, DICQ, LGPD, ISO 15189 mapping | QA Lead |
| **ADR-0022-capa-closure-workflow-5-state-machine.md** | `docs/adr/` | 8 | CAPA process flow (5-state machine) | CTO |
| **CLOUD_LOGS_QUICK_REFERENCE.md** | `docs/` | 2 | Cloud logs setup + critical filters + red flags | QA Lead |
| **Cloud logs sample** | Scripts output format | — | JSON export + gcloud CLI commands | DevOps |

---

## How to Use These Materials

### For the Alignment Call (First Week of May)

1. **CTO + QA Lead (before call):**
   - [ ] Print/screen-share AUDITOR_ALIGNMENT_CALL_AGENDA.md
   - [ ] Verify v1.3 live status + DICQ 78.5% baseline
   - [ ] Prepare Cloud Logs demo (open console, show filters)
   - [ ] Send agenda link to auditor 24 hours before

2. **During call (120 minutes):**
   - [ ] Follow Section 1–6 of agenda (can skip familiar sections)
   - [ ] Use AUDITOR_MATERIALS_INDEX.md as reference for doc locations
   - [ ] Share Google Drive folder link (access TBD by CTO)
   - [ ] Confirm action items at end

3. **After call (<24 hours):**
   - [ ] QA Lead emails alignment summary + action item list
   - [ ] CTO confirms Phase 4 kickoff date (May 20)
   - [ ] Lab Director designates CAPA evidence coordinator

### For Weekly Auditor Briefings (Fridays 14:00 BRT)

1. **QA Lead (Friday 13:30 BRT, 30 min before call):**
   - [ ] Update v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md rows (CAPA progress, RDC articles, DICQ blocks)
   - [ ] Pull weekly Cloud Logs summary (JSON export)
   - [ ] Prepare slide or bullet-point summary of blockers/wins

2. **During call (30 min):**
   - [ ] Review updated checklist rows
   - [ ] Report Cloud Logs health (error count, resolution status)
   - [ ] Discuss any escalations or blockers
   - [ ] Confirm action items for next week

3. **After call:**
   - [ ] Update action item tracking
   - [ ] Send email recap to auditor

### For Phase 4 Implementation (Starting May 20)

1. **CTO:**
   - [ ] Reference ADR-0022-capa-closure-workflow-5-state-machine.md for Cloud Function specs
   - [ ] Generate CAPA Firestore rules block (from ADR-0022 appendix)
   - [ ] Deliver PHASE_4_DEPLOYMENT_CHECKLIST.md (adapt from v1.3)

2. **QA Lead:**
   - [ ] Create CAPA_EVIDENCE_SUBMISSION_SOP.md (lab workflow)
   - [ ] Create AUDITOR_REVIEW_RUNBOOK.md (auditor UI walkthrough)
   - [ ] Prepare CAPA tracking dashboard demo (Week 1 call with auditor)

3. **Auditor:**
   - [ ] Review ADR-0022 for design feedback (Week 1)
   - [ ] Spot-check Cloud Logs weekly (via Cloud Console)
   - [ ] Review CAPA evidence submissions (batches of 3–4 per week)

---

## Compliance Baseline (v1.3 Locked)

**DICQ:** 78.5% (independent baseline audit, frozen until v1.4 completion)

| Block | Current | Target (Aug 31) | Key Phases |
|-------|---------|-----------------|-----------|
| A — Responsibility | 72% | 95% | Phases 4, 14 |
| B — Resources | 85% | 95% | Phase 3✓ |
| C — Opportunity | 65% | 88% | Phases 4, 8 |
| D — Planning | 80% | 95% | Phases 5, 9 |
| E — Audit | 70% | 90% | Phase 13 |
| F — KPIs | 68% | 85% | Phase 11 |
| G — Procedures | 75% | 92% | Phase 13 |
| H — Monitoring | 78% | 90% | Phase 14 |
| **I — Nonconformity/CAPA** | **55%** | **92%** | **Phase 4** |
| J — Escalation | 82% | 95% | Phase 15 |

**RDC 978/2025:** 62/200 critical articles (Phase 0–3 coverage, mapped in COMPLIANCE_SUMMARY_v1.3.md)

**LGPD:** 50% (policy + DPIA, pending Phase 4+ execution)

**ISO 15189:** 88% (aligned via DICQ blocks)

---

## Key Decisions Captured

### CAPA Closure (Phase 4, from ADR-0022)
- **5-state machine:** aberto → em-andamento → evidencia-submetida → auditor-revisando → fechado
- **All writes via callables** (no client-side mutations)
- **Evidence integrity:** SHA-256 hash verified at submission time
- **Audit trail:** append-only, chainHash per transition (HMAC seal)
- **Auditor authority:** `auditorIdAprovador` field (non-repudiable)
- **SLA:** Lab submits evidence within 5 days; auditor reviews within 5 business days per batch

### Weekly Auditor Engagement (Phase 4–Aug 31)
- **Standing call:** Every Friday 14:00 BRT (30 min)
- **Agenda:** Compliance progress, CAPA closure status, Cloud Logs health, blockers/escalations
- **Owner:** QA Lead (facilitate); CTO (escalation only)
- **Pre-final-audit call:** Aug 22, 2026 (90 min, auditor confirms no gaps)

### Cloud Logs Monitoring (Post-Deployment)
- **Tool:** gcloud CLI + Cloud Logs Console UI + Bash script (scripts/monitor-cloud-logs.sh)
- **Auditor access:** IAM Viewer role (read-only, no deploy authority)
- **Critical filters:** All errors, functions, permissions, hosting, timeouts (provided in CLOUD_LOGS_QUICK_REFERENCE.md)
- **Red flags:** Timeout, permission denied, 502/503, undefined function, rate limit
- **Emergency rollback:** git diff → git checkout HEAD~1 → firebase deploy + escalate

---

## File Structure (New Documents Created)

```
C:\hc quality\docs\
├── AUDITOR_ALIGNMENT_CALL_AGENDA.md (15 pages, NEW)
├── AUDITOR_MATERIALS_INDEX.md (12 pages, NEW)
└── [existing materials, cross-referenced]
    ├── COMPLIANCE_SUMMARY_v1.3.md
    ├── v1.3-COMPLETION-SUMMARY.md
    ├── CLOUD_LOGS_QUICK_REFERENCE.md
    └── adr/
        └── ADR-0022-capa-closure-workflow-5-state-machine.md
```

---

## Next Steps (Action Items)

**Week of 2026-05-07 (this week):**
- [ ] **CTO:** Confirm Phase 4 kickoff date (May 20) + announce to team
- [ ] **QA Lead:** Send alignment call invite (scope: auditor + QA Lead + CTO + Lab Director)
- [ ] **QA Lead:** Prepare link to shared Google Drive folder (pending CTO approval)

**Before alignment call (2026-05-13 or 2026-05-15, TBD):**
- [ ] **CTO:** Set up GCP IAM for auditor (Viewer role on hmatologia2 project)
- [ ] **QA Lead:** Create shared folder in Google Drive + add auditor with read-only access
- [ ] **Lab Director:** Confirm attendance + provide contact info for auditor

**During alignment call:**
- [ ] **Follow AUDITOR_ALIGNMENT_CALL_AGENDA.md (120 min, Sections 1–6)**
- [ ] **Record Zoom call (with auditor consent)**
- [ ] **Collect signed alignment memo**

**After alignment call (<24 hours):**
- [ ] **QA Lead:** Send alignment summary email + action item list
- [ ] **CTO:** Provide CAPA legacy data (12 Riopomba CAPAs)
- [ ] **QA Lead:** Confirm Friday standing call schedule (May 15 or May 22 kickoff)

**Before Phase 4 kickoff (May 20):**
- [ ] **CTO:** Finalize CAPA Cloud Function specs (feedback from ADR-0022 review)
- [ ] **QA Lead:** Prepare CAPA tracking dashboard UI (demo in Week 1 of Phase 4)
- [ ] **Lab Director:** Collect CAPA evidence coordinator assignment

---

## Sign-Off

**Prepared by:** Agent (Claude Code, Haiku 4.5)  
**QA Lead review pending:** _______________  
**CTO approval pending:** _______________  
**Ready for distribution:** _______________  

**Document prepared:** 2026-05-07T15:00:00Z  
**Expected use:** Week of 2026-05-13 (auditor alignment call)  
**Next revision:** After alignment call (if feedback requires changes)

---

## References

- **v1.3 Completion:** `.planning/milestones/v1.3-COMPLETION-SUMMARY.md`
- **v1.3 Compliance:** `docs/COMPLIANCE_SUMMARY_v1.3.md`
- **CAPA Process:** `docs/adr/ADR-0022-capa-closure-workflow-5-state-machine.md`
- **Cloud Logs:** `docs/CLOUD_LOGS_QUICK_REFERENCE.md`
- **v1.4 Roadmap:** `.planning/milestones/v1.4-KICKOFF-SUMMARY.md`
- **Auditor Checklist:** `docs/v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md` (updated Fridays)

---

**End of Deliverables Summary**
