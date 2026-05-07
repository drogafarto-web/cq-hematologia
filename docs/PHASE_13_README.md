# Phase 13 — DICQ Final Audit & Compliance Closure

## Overview

This directory contains the complete execution plan for **Phase 13 of HC Quality v1.4**: a 10-day sprint to close DICQ compliance gaps, achieve ≥88% conformance (from v1.3 baseline 78.5%), and prepare the system for external DICQ/SBAC audit (target 2026-10-15).

**Created:** 2026-05-07  
**Target Completion:** May 24, 2026  
**Audit Date:** October 15–31, 2026

---

## Documents in This Folder

### 1. **PHASE_13_DETAILED_PLAN.md** (Main Artifact — 1,500 lines)

**Purpose:** Comprehensive execution guide for Compliance Lead and Phase 13 team.

**Sections:**
1. **Block-by-Block DICQ Audit Checklist** (40+ items across 10 blocks A–J)
   - Detailed audit steps per requirement
   - Expected evidence artifacts (PDFs, JSON, CSV, screenshots)
   - Pass/fail criteria and spot-check methodology

2. **Evidence Collection Summary**
   - Standardized directory structure
   - Format specifications and metadata requirements
   - Verification checklist

3. **RDC 978 Compliance Mapping**
   - All 15 applicable RDC articles mapped to v1.4 modules
   - Coverage confirmation (100%)
   - Critical-path RDC blockers highlighted

4. **Compliance Snapshot JSON Template**
   - Structured metrics for dashboard feed
   - Block-level scores (v1.3 baseline → v1.4 target → projected)
   - Module readiness tracker
   - Auditor readiness assessment

5. **Remediation Planning**
   - Severity assessment (critical/major/minor)
   - P0 (immediate fix) vs. P1 (defer to v1.4.1) decision tree
   - Example remediation items

6. **Auditor Briefing Materials**
   - What changed v1.3 → v1.4
   - Module-to-RDC/DICQ compliance map
   - Known gaps + mitigation strategies
   - Decision framework (design rationales)

7. **Pre-Approval Call Preparation**
   - 30-minute agenda
   - Pre-call checklist
   - Sign-off decision framework

8. **Phase 13 Execution Timeline**
   - Week-by-week breakdown (10 working days)
   - Block assignments by day
   - Resource allocation

---

### 2. **PHASE_13_QUICK_START_CHECKLIST.md** (Operational Guide — 400 lines)

**Purpose:** Day-by-day actionable checklist for Compliance Lead and QA team.

**Includes:**
- **Pre-Phase (May 12):** Documentation review, team prep, system access, directory setup
- **Week 1 (Mon–Fri):** Blocks A–H audit, evidence collection per day
- **Week 2 (Mon–Fri):** Blocks I–J, remediation, evidence packaging, pre-call prep
- **Anticipated Auditor Q&A** with talking points
- **Go/No-Go Checklist** for phase completion
- **Team communication templates** (daily standup, weekly summary)

---

### 3. **PHASE_13_EXECUTION_SUMMARY.txt** (Reference Overview — 250 lines)

**Purpose:** Quick reference summary of key metrics, deliverables, and team allocation.

**Contains:**
- Overview + success criteria
- Key deliverables list (audit checklist, evidence framework, RDC mapping, JSON template, remediation tree, auditor briefing, pre-call prep, timeline)
- Audit scope per block (10 blocks, 40+ items)
- Team roles + hours
- Evidence package structure
- RDC article coverage
- Compliance projection (86–92% range)
- Key risks + mitigations
- Document navigation hints

---

### 4. **PHASE_13_README.md** (This File)

**Purpose:** Index and orientation guide.

---

## Key Metrics at a Glance

| Metric | Value | Status |
|--------|-------|--------|
| **Timeline** | 10 working days (May 13–24, 2026) | 🟡 Tight, achievable |
| **Compliance Baseline (v1.3)** | 78.5% | ✅ Baseline confirmed |
| **Compliance Target (v1.4)** | 88.0% | 🟡 Achievable (85–92% range) |
| **DICQ Blocks to Audit** | 10 (A–J) | ✅ Complete coverage |
| **Sub-items to Verify** | 40+ | ✅ Detailed checklist ready |
| **RDC Articles Mapped** | 15/15 (100%) | ✅ Complete coverage |
| **Evidence Artifacts** | 40+ files | ✅ Directory structure ready |
| **Team Hours Required** | 68 hours | 🟡 Needs allocation |
| **Remediation Items (Expected)** | P0: 2–5 / P1: 3–7 | 🟡 TBD (Phase 13 discovery) |

---

## How to Use These Documents

### For Compliance Lead
1. **Start:** Read **PHASE_13_DETAILED_PLAN.md** cover-to-cover (2 hrs)
2. **Prepare:** Use **PHASE_13_QUICK_START_CHECKLIST.md** to set up pre-phase (May 12)
3. **Execute:** Follow checklist day-by-day (Week 1–2)
4. **Deliver:** Compile evidence package + compliance snapshot + auditor briefing

### For QA Lead
1. **Start:** Review block audit steps in **PHASE_13_DETAILED_PLAN.md** (relevant blocks only)
2. **Prepare:** Screenshot SOP + spot-check test cases (May 12)
3. **Execute:** Follow QA tasks in **PHASE_13_QUICK_START_CHECKLIST.md** (day-by-day)
4. **Deliver:** Evidence artifacts (PDFs, JSONs, CSVs, screenshots)

### For Module Leads (10 people)
1. **Start:** Read your block section in **PHASE_13_DETAILED_PLAN.md** (1 hr)
2. **Prepare:** Data staging + test accounts ready (May 12)
3. **Execute:** Respond to Compliance/QA requests; provide system access; explain design choices
4. **Deliver:** Module-specific evidence artifacts + auditor Q&A talking points

### For CTO / RT
1. **Start:** Skim **PHASE_13_EXECUTION_SUMMARY.txt** + key sections of main plan (45 min)
2. **Review:** Weekly summaries from Compliance Lead (Friday EODs)
3. **Approve:** Remediation log (P0/P1 decisions)
4. **Sign-Off:** Compliance snapshot + go/no-go for external audit

### For External Auditor (Reference Only)
- **Auditor Briefing PDF** (generated from Section 6 of main plan)
- **Evidence Package** (`docs/PHASE_13_EVIDENCE/` directory)
- **Compliance Snapshot JSON** (dashboard metrics)

---

## Critical Paths (Manage These Closely)

### Phase 0 RDC Blockers (Must-Have)
- `lab-apoio` (support lab contracts, 6 clauses) — RDC Arts. 36–39
- `turnos` supervisor presence — RDC Art. 122
- `lgpd-policy` skeleton — RDC Art. 77
- `risks` FMEA skeleton — Risk management foundation

**Impact:** Without Phase 0, cannot pass RDC audit. These are **audit prerequisites**, not nice-to-have features.

### Phase 4 CAPA Closure (Auditor Interaction)
- 12 findings closure verification with external auditor RFI
- Impacts Block D compliance significantly
- **Risk:** Auditor delays can cascade to Phase 9, 13

**Mitigation:** Async email gate + weekly calls + parallel Phase 5 work

### Phase 9 Documentation Breadth (Highest Volume)
- 50+ governance items (Manual Qualidade, Norteadores, Org Chart, SOPs, etc.)
- Impacts Blocks A, B, C, D, G, H, I (7 blocks)
- **Risk:** Scope creep; documentation inconsistency

**Mitigation:** Pre-write templates; scope to DICQ-essential items only; 2-day buffer

### Personnel Dossiè Data Migration (Critical Path Item)
- Records scattered across EC module, auth, turnos, biosseguranca
- Phase 1 backfill job is mandatory (data completeness audit needed)
- **Risk:** Incomplete migration; audit failure on C.1

**Mitigation:** Phase 0 backfill design; Phase 9 completeness verification

---

## Compliance Confidence Assessment

| Block | v1.3 % | v1.4 Target | Δ | Confidence | Owner |
|-------|--------|-------------|---|------------|----|
| **A** Governança | 78% | 92% | +14 | 🟡 Medium | Phase 13 (management review deferred to Phase 14) |
| **B** SGD | 65% | 92% | +27 | ✅ High | Phase 9 (foundation solid) |
| **C** Pessoal | 80% | 92% | +12 | 🟡 Medium | Phase 1+9 (data migration risk) |
| **D** Qualidade | 60% | 85% | +25 | 🟡 Medium | Phase 4+9 (auditor RFI dependency) |
| **E** Pré-Analítico | 64% | 75% | +11 | 🟡 Medium | Phase 6 (coleta/transporte operational) |
| **F** Analítico | 92% | 95% | +3 | ✅ High | Phase 10 (already strong) |
| **G** Pós-Analítico | 70% | 92% | +22 | ✅ High | Phase 5–9 (portal + critical values + NOTIVISA) |
| **H** Recursos | 75% | 88% | +13 | 🟡 Medium | Phase 0+9–10 (lab-apoio RDC blocker) |
| **I** Ambiente | 64% | 80% | +16 | 🟡 Medium | Phase 9 (IoT firmware dependency) |
| **J** Continuidade | 70% | 78% | +8 | ✅ High | Phase 0–1 (policy) + maintenance (DR) |
| **WEIGHTED AVG** | 78.5% | **88.0%** | **+9.5** | **🟡 75%** | Multi-phase |

---

## Key Decisions (Rationale for Auditor Discussion)

### 1. Why is Management Review (4.15) Phase 13 → Phase 14?
**Rationale:** Template + auto-aggregation live Phase 13. First ata scheduled Q3 2026 post-launch. Auditor can observe first review if available; Phase 13 validates infrastructure.

### 2. Why defer Patient Catalog + Consent (5.4.2) to v1.5?
**Rationale:** Phase 5 covers critical path (portal auth + download + critical values alert). Patient catalog (exam info, prep instructions) is informational; can be email-based until portal phase 2. RDC doesn't mandate online catalog, only "patient information."

### 3. Why defer Staff Well-Being (5.1.11) to v1.5?
**Rationale:** Classified as "stretch goal" in DICQ (ISO 15189 recommendation, not mandate). Phase 9 covers core personnel (qualifications, training, competency, performance). Well-being surveys deferred pending HR process design.

### 4. Why Lab Apoio (4.5) is RDC Blocker in Phase 0?
**Rationale:** RDC Arts. 36–39 explicitly require support lab contracts. Inspector will ask for 6-clause contract on first visit. No lab passes without this. Phase 0 non-negotiable.

### 5. Why NOTIVISA (5.7.3) Phase 8 not earlier?
**Rationale:** Portaria 204 (notifiable disease list) + gov API integration require careful testing. Phase 5–6 prioritize patient portal + critical values. Fallback: manual NOTIVISA submission (documented SOP) if API integration delayed.

---

## Handoff Checklists

### Phase 13 → External Audit (May 24 → Oct 15)

- [ ] Evidence package organized + manifest complete
- [ ] Compliance snapshot JSON + PDF dashboard ready
- [ ] RDC article coverage 100% verified
- [ ] Auditor briefing printed + digital
- [ ] Known gaps (P0/P1) remediation plan approved + scheduled
- [ ] Pre-approval call completed → CTO/RT sign-off "Ready for audit"
- [ ] Auditor scheduling coordination in progress (Oct 15–31 window)

### Post-Audit (Oct 31 → v1.4.1 Planning)

- [ ] External auditor findings documented
- [ ] Compliance score confirmed (vs. ≥88% target)
- [ ] Remediation items from audit (if any) planned for v1.4.1
- [ ] P1 items from Phase 13 still scheduled for v1.4.1
- [ ] v1.4.1 roadmap updated + baseline reset

---

## FAQ

**Q: What if Phase 13 finds more gaps than expected?**  
A: P0 items (critical): fix immediately (< 2 days). P1 items (major/minor): document + schedule v1.4.1. If >5 P0 items discovered → escalate to CTO → possible Phase 14 sprint extension.

**Q: How long does the pre-approval call take?**  
A: 30 minutes. Agenda: 10 min block summary, 5 min gaps, 10 min Q&A, 5 min sign-off.

**Q: Can we audit blocks in parallel?**  
A: Partially. Blocks A–B can run in parallel with C–D in Week 1 (different team members). Blocks A–J must complete sequentially per the plan to avoid resource contention.

**Q: What if the auditor visits earlier than Oct 15?**  
A: Pre-approval call gives 1–2 week buffer post-Phase 13. If auditor requests earlier visit → escalate to CTO → compress remediation timeline.

**Q: Are all evidence artifacts required for the auditor to review?**  
A: Yes. Auditor will select sample artifacts per block (e.g., "show me 3 LGPD policy versions" or "audit log for 5 downloads"). Having all 40+ artifacts demonstrates completeness.

**Q: What's the minimum acceptable DICQ score?**  
A: v1.3 set precedent at 78.5% (audit-ready). v1.4 target 88% is stretch but achievable. If Phase 13 confirms 86% → still audit-ready; if <85% → P0 remediation required.

---

## Contact + Escalation

- **Compliance Lead:** [TBD — Phase 0 assignment]
- **CTO:** [TBD — review + sign-off authority]
- **RT (Responsável Técnico):** [TBD — final compliance approval]

**Escalation Path:** Phase 13 blocker → Compliance Lead → CTO (24 hrs response time)

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-07 | Phase 13 Planning Agent | Initial plan creation |

---

## Next Steps

1. **CTO reviews plan** (2 hrs) → approves execution
2. **Compliance Lead creates Gantt chart** (May 8–9) → weekly milestones visible
3. **Module leads stage data** (May 12) → system ready for audit
4. **Phase 13 kickoff** (May 13, Monday) → team aligned on execution
5. **Daily standups** (EOD, 5 min) → track progress
6. **Friday summaries** (EOD, 15 min) → escalate blockers
7. **May 24 (Friday)** → evidence package complete → schedule pre-approval call
8. **Pre-approval call** (week of May 27) → CTO/RT sign-off
9. **Oct 15** → external auditor arrives → show evidence package + compliance snapshot

---

**Created:** 2026-05-07  
**Target Completion:** 2026-05-24  
**External Audit:** 2026-10-15–31

Good luck. 🎯
