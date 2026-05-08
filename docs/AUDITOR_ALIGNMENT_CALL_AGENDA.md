---
document: Auditor Alignment Call — Detailed Agenda
created: 2026-05-07
duration: 120 minutes (2 hours)
participants:
  - External Auditor (DICQ + RDC 978 verification lead)
  - QA Lead (lab liaison)
  - CTO (technical sign-off, decision authority)
  - Lab Director (compliance accountability)
status: Ready for execution
---

# Auditor Alignment Call — Detailed Agenda

**Date:** TBD (scheduled after v1.3 deployment sign-off)  
**Time:** 120 minutes (recommend: first business day after v1.3 live, 10:00–12:00 BRT)  
**Platform:** Zoom (recording permitted for audit trail)  
**Materials:** All documents in `/docs/` + audit checklist  
**Outcome:** Written alignment on Phase 4 deliverables, CAPA closure timeline, weekly standing call schedule  

---

## Pre-Call Preparation (CTO + QA Lead, 30 min before)

1. **Verify deployment status** (`DEPLOYMENT_SUMMARY_v1.3.md`)
   - [ ] v1.3 live in production (hmatologia2.web.app)
   - [ ] All 35 modules operational
   - [ ] DICQ baseline: 78.5% verified (independent audit)
   - [ ] RDC 978 critical articles: Phase 0–3 coverage mapped

2. **Prepare reference stack** (print/screen-share ready)
   - [ ] v1.3-COMPLETION-SUMMARY.md (top of conversation)
   - [ ] COMPLIANCE_SUMMARY_v1.3.md (compliance mapping)
   - [ ] ADR-0022-capa-closure-workflow (state machine)
   - [ ] v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md (weekly cadence)
   - [ ] Cloud logs sample filter (paste in Slack #audit-channel)

3. **Confirm attendee access** (24 hours before)
   - [ ] Auditor has read-only access to hmatologia2 project (gcloud auth setup)
   - [ ] QA Lead has Firestore console access for live demo
   - [ ] Zoom link sent; recording consent documented

---

## Call Flow (120 minutes)

### **Section 1: v1.3 Context & Compliance Baseline (20 minutes)**
*Goal: Establish common understanding of what shipped, what scores, what's deferred.*

**Opening (CTO, 2 min)**
- v1.3 deployed 2026-05-07 00:25 UTC; currently live in production
- 4 new analytical modules shipped (Bioquímica, Liberação+Críticos, Reclamações+Satisfação+Sugestões, SGD/Drive Importer)
- 80 documents migrated from legacy system (Riopomba pilot)
- All 35 modules operational; 0 P0 security findings

**Compliance Snapshot (QA Lead, 5 min — screen-share COMPLIANCE_SUMMARY_v1.3.md)**
- DICQ: **78.5%** (independent baseline audit completed, locked until v1.4 Phase completion)
  - Bloco B (Gestão Documental): 0% → 65% (headline gain via SGD module)
  - Bloco F (Analítico): 85% → 92% (Bioquímica with Westgard CLSI)
  - Bloco G (Qualidade): 70% → 78% (feedback loop, NC tracking)
- **RDC 978/2025:** 62/200 critical articles covered (Arts. 117, 167, 179–180, 181, 184–191)
  - Laudo signing (Art. 167) ✅ implemented
  - CIQ quantitative (Art. 179) ✅ Bioquímica live
  - Críticos framework (Art. 183) ✅ ready (threshold config pending Phase 10)
  - LGPD (feedback loop PII) ✅ 50% (policy + DPIA, execution Phase 4+)

**Deferred explicitly to v1.4 (CTO, 3 min)**
- NC-011 (order-entry/patient demographics) — too large for 14-week window; documented with auditor
- Phase 10 Plans 04–07 — PDF generation, QR validation, physician portal, E2E suite
- Phase 11 Plans 06–08 — external patient portal, trending dashboard integration
- Phase 8 Plans 05–07 — CAPA process execution + closure ceremony (now **Phase 4** in v1.4)
- Pen-test (portal surfaces) — deferred to v1.4 with surface deployment

**Known Issues & Resolution (QA Lead, 3 min)**
- TypeScript errors (121 in functions) — **RESOLVED** (Phase 8.5, commits `71d48a4` through `ae3babd`)
- Firebase v1 → v2 API migration — **RESOLVED** (Phase 8.5 Batch 1)
- Missing dependencies — **RESOLVED** (Phase 8.5 Batch 2)
- **Build status verified:** Web TSC 0 errors · Functions TSC 0 errors · All tests passing (347/347)

**Auditor Q&A (5 min)**
- Clarify any deferred features or blockers
- Confirm auditor's baseline acceptance of 78.5% + 62/200 RDC coverage

---

### **Section 2: Phase 4 Roadmap — CAPA Closure + Compliance Advance (35 minutes)**
*Goal: Lock Phase 4 timeline, CAPA closure process, auditor involvement cadence.*

**Phase 4 Scope (CTO, 5 min — screen-share v1.4-KICKOFF-SUMMARY.md)**
- **Duration:** May 20 – Jun 17, 2026 (4 weeks)
- **Streams:** 3 parallel workstreams
  - **Stream A (CAPA Closure):** Phase 4 Plans 01–04 (5-state machine + UI + evidence storage + auditor dashboard)
  - **Stream B (RDC Critical Articles):** Phase 5+ (patient portal, critical value escalation, physician notification)
  - **Stream C (DICQ Blocks):** Phase 8+ (management review, personnel qualifications, risk management)
- **Target:** DICQ 78.5% → **88%+** by Aug 31 (Phases 4–15)

**CAPA Closure Process (CTO, 10 min — present ADR-0022)**

**5-State Machine:**
```
aberto (initial) 
  → em-andamento (investigation)
    → evidencia-submetida (evidence uploaded, hash verified)
      → auditor-revisando (auditor review in progress)
        → fechado (approved by auditor; immutable thereafter)
```

**Key Design Points:**
- All state transitions via Cloud Function callables (no client-side writes)
- Evidence integrity: SHA-256 hash captured at submission; hash mismatch = auto-rejection
- Audit trail: append-only `transicoesCAPAs[]` array; chainHash per transition (HMAC seal)
- Auditor accountability: `auditorIdAprovador` field makes approval non-repudiable
- Legacy CAPA migration: ~12 Riopomba CAPAs mapped to `fechado` state with synthetic history

**Cloud Function Callables (7 total):**
1. `capaOpenNewCAPAWorkflow()` — create CAPA
2. `capaStartInvestigation()` — transition to em-andamento
3. `capaSubmitEvidence()` — upload + validate evidence hash
4. `capaAuditorReviewStart()` — auditor begins review
5. `capaAuditorApprove()` — close CAPA
6. `capaAuditorReject()` — request rework
7. `capaSoftDelete()` — soft-delete (preserves history)

**Firestore Rules:**
- CAPA collection: callables-only writes (no client-side mutations)
- Audit events: append-only (client write denied)
- Evidence files: world-readable after approval (cannot be deleted by operator)

**CAPA Evidence Submission SLA (QA Lead, 3 min)**
- **Lab responsibility:** submit evidence within 5 business days of CAPA opening
- **Auditor RFI:** 5 business days max to approve/reject per batch
- **Evidence checklist per CAPA:**
  1. Root cause investigation (5-why or Fishbone)
  2. Corrective action plan (responsible party, timeline, metric)
  3. Implementation evidence (before/after screenshots, process docs, training)
  4. Verification re-audit (spot-check showing resolution)
  5. Preventive action (if systemic risk)

**CAPA Tracking Dashboard (QA Lead, 3 min)**
- Auditor-facing UI: list of `evidencia-submetida` + `auditor-revisando` CAPAs
- Evidence download button (PDF/image storage link)
- Approval/rejection form with required comment field
- Status history view (show all transitions + timestamps)

**Auditor Q&A (3 min)**
- Confirm evidence submission process
- Clarify approval authority + escalation path if evidence insufficient
- Address any concerns about audit trail immutability

---

### **Section 3: Compliance Roadmap — RDC 978 + DICQ Path to 88%+ (25 minutes)**
*Goal: Map which articles/blocks advance in which phase; set weekly reporting cadence.*

**RDC 978 Phased Coverage (CTO, 8 min — screen-share AUDITOR-COMPLIANCE-CHECKLIST.md)**

| Phase | Focus | Articles | Target | Due | Stream |
|-------|-------|----------|--------|-----|--------|
| **4** | CAPA closure | 77, 86 (LGPD + risk) | Close w/ auditor sign-off | May 28 | Stream A |
| **5** | Patient portal + laudo download | 167, 204 | Portal live | May 27 | Stream B |
| **6** | Critical value escalation + physician notification | 115–117 | Email/SMS/log live | Jun 3 | Stream B |
| **13** | NOTIVISA reporting + final docs | 179–191, Art. 6 | Government API + audit trail | Jul 29 | Stream B |
| **14–15** | Final polishing + auditor sign-off ceremony | All | 100% coverage | Aug 31 | CTO |

**DICQ Block-by-Block Advance (CTO, 5 min)**

| Block | Title | v1.3 | Target | Key Phases | Due |
|-------|-------|------|--------|-----------|-----|
| A | Responsibility | 72% | 95% | 4, 14 | Aug 12 |
| B | Resources (Personnel, Training) | 85% | 95% | 3✓, 14 | Aug 12 |
| **C** | **Opportunity (Customer)** | 65% | 88% | 4, 8 | Jul 1 |
| **D** | **Planning** | 80% | 95% | 5, 9 | Jul 1 |
| **E** | **Implementation Review** | 70% | 90% | 13 | Jul 29 |
| F | Measurable Objectives (KPIs) | 68% | 85% | 11 | Jul 15 |
| **G** | **Procedures (SOPs)** | 75% | 92% | 13 | Jul 29 |
| H | Monitoring (Analytics) | 78% | 90% | 14 | Aug 12 |
| **I** | **Nonconformity & CAPA** | 55% | 92% | **4** | **May 28** |
| J | Escalation & Audit Review | 82% | 95% | 15 | Aug 26 |
| **OVERALL** | — | **78.5%** | **88%+** | — | **Aug 31** |

**Key insight:** Blocks A, C, I advance most in Phase 4 (CAPA closure); highest impact on timeline. If Phase 4 slips >1 week, DICQ timeline pressured.

**Weekly Auditor Briefing Cadence (QA Lead, 3 min)**
- **When:** Every Friday 14:00 BRT (30 min call)
- **What:** 
  - CAPA closure progress (which batch closing this week)
  - RDC article checklist (status per phase)
  - DICQ block scores (pre-computed by system, auditor spot-checks)
  - Blockers + escalations
- **Format:** Email + async review OK; call required for decision gates
- **Owner:** QA Lead (primary) + CTO (escalation only)

**Pre-External-Audit Call (CTO, 2 min)**
- **Date:** Aug 22, 2026 (90 min, 2 weeks before external audit)
- **Scope:** Final compliance walkthrough; auditor confirms no gaps; schedules external team
- **Output:** Audit readiness sign-off memo

**Auditor Q&A (3 min)**
- Confirm Friday cadence + meeting invite
- Clarify escalation path if compliance gap found
- Confirm Aug 22 final call date

---

### **Section 4: Cloud Logs & Post-Deploy Monitoring (15 minutes)**
*Goal: Establish shared observability; ensure auditor can spot-check production health.*

**Cloud Logs Setup (QA Lead, 3 min)**

**Current Health Checks:**
- **Status:** v1.3 deployed 2026-05-07 00:25 UTC; Cloud Logs tailed for 24h per CLOUD_LOGS_MONITORING_GUIDE.md
- **Tools:** gcloud CLI + Bash script (scripts/monitor-cloud-logs.sh) + Cloud Console UI
- **Critical Filters** (paste into console):
  1. All errors: `severity >= ERROR AND timestamp > now - 60m`
  2. Cloud Functions only: `resource.type="cloud_function" AND severity >= ERROR`
  3. Firestore permission errors: `resource.type="cloud_firestore" AND textPayload=~".*Permission.*"`
  4. Hosting 5xx: `resource.type="cloud_run" AND httpRequest.status >= 500`
  5. Function timeouts: `resource.type="cloud_function" AND textPayload=~".*Exceeded timeout.*"`

**Red Flags & Actions:**
- 🔴 `"Exceeded timeout of X seconds"` → Check async handlers; increase timeout or split work
- 🔴 `"Permission denied"` on `/labs/{labId}/*` → Firestore rules regression; compare to git HEAD
- 🔴 HTTP 502/503 sustained >5 min → Hosting/runtime failure; consider rollback
- 🔴 `"undefined is not a function"` → Missing dependency; check functions/package.json
- 🟡 Request rate exceeded (Firestore) → Expected during load; auto-backoff handles
- 🟡 Cold-start latency → Expected; not an error

**Emergency Rollback (QA Lead, 2 min)**
If critical error found:
1. Note timestamp + error signature
2. Check git diff from HEAD~1
3. If bad: `git checkout HEAD~1 functions/ && firebase deploy --only functions`
4. Escalate to CTO with timestamp + log snippet + rollback action taken

**Auditor Access to Cloud Logs (CTO, 3 min)**
- **Setup:** Auditor added as `Viewer` role to hmatologia2 GCP project (IAM console)
- **Permissions:** Read-only access to Cloud Logging UI + Cloud Console dashboards; no deploy authority
- **Scope:** Can view all logs; cannot delete or modify
- **Spot-check workflow:**
  1. Open [Cloud Logs Console](https://console.cloud.google.com/logs/query)
  2. Paste filter (e.g., all errors last hour)
  3. Review results; export JSON if needed for audit report

**Weekly Log Audit (QA Lead, 2 min)**
- **When:** Fridays 13:30 BRT (before 14:00 call)
- **Task:** QA Lead pulls weekly error summary; reports to auditor in Friday call
- **Format:** JSON export + summary metrics (error count, error types, resolution status)
- **Example output:**
  ```json
  {
    "period": "2026-05-07 to 2026-05-14",
    "total_errors": 3,
    "by_severity": {"ERROR": 2, "WARNING": 1},
    "resolved": 2,
    "pending": 1,
    "critical_issues": []
  }
  ```

**Auditor Q&A (2 min)**
- Confirm GCP project access + IAM role
- Clarify what auditor can/cannot modify
- Request historical logs retention policy (when old logs deleted)

---

### **Section 5: Materials Index & Action Items (20 minutes)**
*Goal: Provide auditor with complete reference library; confirm action owners + due dates.*

**Materials Provided (QA Lead, 3 min)**

Reference documents provided in shared folder (`/docs/auditor-materials/`):

1. **v1.3-COMPLETION-SUMMARY.md** (4 pages)
   - Scope delivered, metrics, known issues resolved, deployment plan
   - *Use:* Quick reference for what shipped + what's deferred

2. **COMPLIANCE_SUMMARY_v1.3.md** (12 pages)
   - RDC 978 coverage per article, DICQ block mapping, LGPD inventory, ISO 15189 alignment
   - *Use:* Detailed compliance audit trail; reference for auditor sign-off memo

3. **ADR-0022-capa-closure-workflow-5-state-machine.md** (8 pages)
   - CAPA state machine design, Cloud Function callables, Firestore schema, audit trail design
   - *Use:* Technical specification for Phase 4 implementation; auditor can audit code against this

4. **v1.4-AUDITOR-COMPLIANCE-CHECKLIST.md** (12 pages)
   - Weekly compliance matrix, DICQ block progress, RDC article roadmap, CAPA closure schedule
   - *Use:* Weekly briefing template + auditor verification checklist (updated Fridays 14:00 BRT)

5. **CLOUD_LOGS_QUICK_REFERENCE.md** (2 pages)
   - One-minute setup, three monitoring approaches, critical filters, red flags, emergency rollback
   - *Use:* Quick copy-paste filters for spot-checking production; emergency procedures

6. **ARCHITECTURE_v1.3.md** (archived, supplementary)
   - System architecture patterns, multi-tenant isolation, security rules, API design
   - *Use:* Deep-dive reference for technical audits (if needed)

7. **DEPLOY_ROADMAP_v1.3.md** (archived, supplementary)
   - Deployment sequence, rollback plan, smoke test checklist, post-deploy monitoring
   - *Use:* Reference for Phase 4 deployment procedures (will be updated for v1.4)

**Access:**
- Documents hosted in shared folder (Google Drive link provided via email)
- Updates pushed weekly (Friday 18:00 BRT after QA Lead review)
- Email notifications when docs change

**Action Items (CTO + QA Lead, 5 min)**

**Before next Friday:**
- [ ] **CTO:** Confirm Phase 4 kickoff date (May 20)
- [ ] **CTO:** Provide CAPA legacy data dump (12 Riopomba CAPAs + evidence refs)
- [ ] **QA Lead:** Send auditor GCP project invite (IAM Viewer role)
- [ ] **QA Lead:** Share Google Drive folder link + document access
- [ ] **QA Lead:** Schedule Friday standing calls (May 15 kickoff, then weekly Fridays 14:00 BRT through Aug 31)

**Before Phase 4 kickoff (May 20):**
- [ ] **CTO:** Finalize CAPA Cloud Function specs (based on ADR-0022 feedback)
- [ ] **CTO:** Deliver CAPA Firestore rules block (ready for review)
- [ ] **QA Lead:** Prepare CAPA tracking dashboard demo (show to auditor Week 1 of Phase 4)
- [ ] **Lab Director:** Designate CAPA evidence coordinator (responsible for gathering docs per CAPA)

**Before Aug 22 final call:**
- [ ] **CTO:** Compile v1.4 full compliance audit (RDC 978 + DICQ + LGPD + ISO 15189)
- [ ] **CTO:** Prepare auditor sign-off memo template
- [ ] **QA Lead:** Deliver consolidated CAPA closure report (all 12 CAPAs + auditor sign-offs)

**Escalation Path (CTO, 2 min)**
- **If blocker:** CTO → Lab Director → Auditor (same-day call if P0)
- **If compliance gap:** QA Lead → Auditor → CTO (48-hour response SLA)
- **If Phase slip:** CTO → Auditor (weekly call + mitigation plan required)

**Contact List (QA Lead, 1 min)**
- **Auditor Lead:** [Name, email, phone]
- **QA Lead:** [Name, email, phone]
- **CTO:** drogafarto@gmail.com · [phone]
- **Lab Director:** [Name, email, phone]

**Auditor Q&A (3 min)**
- Confirm action items + owners
- Request any additional materials
- Clarify escalation triggers

---

### **Section 6: Closing & Signature (5 minutes)**
*Goal: Document alignment; confirm next steps.*

**Auditor Confirmation (Auditor, 2 min)**
- [ ] v1.3 baseline (78.5% DICQ + 62/200 RDC) accepted
- [ ] Phase 4 CAPA timeline (May 20 kickoff, May 28 auditor co-sign target) accepted
- [ ] Friday standing calls (14:00 BRT) + Aug 22 final call scheduled
- [ ] Materials + access confirmed
- [ ] No unresolved blockers

**Next Standup (CTO, 1 min)**
- **Date:** Friday, May 15, 2026 14:00 BRT (pre-Phase 4 kickoff)
- **Agenda:** Phase 4 Week 1 plan review; CAPA tooling demo; evidence submission SOP walkthrough
- **Owner:** QA Lead to send Zoom link + agenda 24 hours prior

**Meeting Close (CTO, 2 min)**
- Thank you for alignment
- Confirm recording archived to audit folder (if applicable)
- Exchange contact info; confirm follow-up email to be sent within 24 hours

**Post-Call Deliverable (QA Lead, <24 hours):**
- Email summary of alignment + action items + next standup link
- Google Drive folder share link (auditor access)
- GCP project IAM invite (pending CTO approval)
- Friday standing call calendar invite (recurring, May 15 – Aug 31)

---

## Appendix: Quick Reference Tables

### CAPA Evidence Requirements Checklist
*For auditor to reference when reviewing submitted evidence per CAPA:*

| Item | Description | Example |
|------|---|---|
| Root cause | 5-why analysis or Fishbone diagram | PDF diagram + narrative analysis |
| Corrective action | Specific plan, responsible party, deadline, success metric | "Retrain X team on procedure Y by [date]; metric: 0 failures in 30-day verification" |
| Implementation evidence | Before/after proof that corrective action was taken | Screenshots of config change, training sign-off sheet, process audit |
| Verification re-audit | Spot-check showing issue resolved (same scenario, successful outcome) | Lab report showing corrected result + signature |
| Preventive action (if systemic) | Systemic risk addressed to prevent recurrence | "Updated SOP to include step Z; added checklist item; trained all operators" |

### DICQ Block Priorities (Phase 4 Focus)
*Auditor perspective: which blocks yield fastest compliance gain in Phase 4?*

| Block | Current | Phase 4 Target | Effort | Impact | Owner |
|-------|---------|---|--------|--------|-------|
| **I — Nonconformity & CAPA** | 55% | 82% | CAPA state machine (3 wks) | **HIGHEST** (+27 pts) | Stream A |
| **C — Opportunity** | 65% | 78% | Mgmt review + feedback (2 wks) | High (+13 pts) | Stream A |
| **A — Responsibility** | 72% | 86% | Org chart + role matrix (1 wk) | Medium (+14 pts) | Stream A |

**Strategy:** Phase 4 focuses on Blocks I, C, A → biggest DICQ gain + fastest ROI.

---

## Sign-Off

**Attendees:**
- [ ] Auditor (print name, signature, date)
- [ ] QA Lead (print name, signature, date)
- [ ] CTO (print name, signature, date)
- [ ] Lab Director (print name, signature, date)

**Alignment confirmed:** _________________ (date)

**Next review:** Friday, May 15, 2026 14:00 BRT

---

**Document prepared by:** QA Lead + CTO  
**Last updated:** 2026-05-07T14:30:00Z  
**Version:** 1.0 (Ready for Call)
