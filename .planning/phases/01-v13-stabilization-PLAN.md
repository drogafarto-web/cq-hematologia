---
phase: 01-v13-stabilization
title: 'v1.3 Stabilization & Deployment Wrap-Up — Execution Plan'
duration_days: 4
estimated_effort_points: 24
parallelizable_streams: 'A + DevOps (independent paths)'
owner: CTO
status: READY
---

# Phase 1 Execution Plan — 8 Tasks with Acceptance Criteria

**Period:** 2026-05-07 → 2026-05-10 (4 calendar days, ~3–4 days elapsed work)  
**Wave:** 1 (Foundation & Planning)  
**Gate unblocks:** Phase 2 (v1.4 Requirements Deep-Dive)

---

## Task 1: Cloud Logs 24h Analysis & Sign-Off

**Owner:** DevOps Lead + QA Lead  
**Duration:** 4 hours  
**Start:** Day 1, 08:00 BRT  
**Effort points:** 2

### What to do:

1. **Extract Cloud Logs from deployment window (May 5 07:00 → May 6 07:00 UTC)**
   - Use `gcloud logging read` with filters for `ERROR`, `CRITICAL`, `WARNING`
   - Save raw JSON + human-readable summary

2. **Categorize errors:**
   - **Expected:** Firestore index build (bg work), function cold starts, SDK init logs
   - **Unexpected:** Crashed functions, timeout cascades, data-layer failures, auth denials
   - **Unknown:** New error types → escalate for investigation

3. **Audit Firestore indexes:**
   - Confirm all Phase 3 indexes built to 100%
   - Document any in-progress rebuilds (should be near-complete)

4. **Cross-check against deploy steps:**
   - Step 1 (Rules): Check for any rule validation failures
   - Step 2 (Functions): Check for any function timeout during deploy
   - Step 3 (Hosting): Check for PWA SW install errors
   - Step 4 (Smoke tests): Match test execution logs to any errors

5. **Document & export:**
   - Summary: count of ERROR lines, categorized breakdown
   - Action items: any that require immediate remediation
   - PDF export: auditor-ready (include sign-off line)

### Acceptance criteria:

- [ ] 0 unaccounted-for ERROR or CRITICAL lines in 24h tail
- [ ] All ERROR/WARNING lines categorized (expected/unexpected/investigation)
- [ ] Firestore index build documented (>95% complete is acceptable)
- [ ] Function cold start latency baseline captured (p99 <5s)
- [ ] Memo drafted: "No blockers; production stable for 48h+ monitoring window"
- [ ] PDF export generated with DevOps + QA sign-off

### Deliverable:

```
.planning/logs/CLOUD_LOGS_24H_SUMMARY.md
.planning/logs/CLOUD_LOGS_24H_TAIL.json (raw export)
.planning/logs/CLOUD_LOGS_24H_SUMMARY.pdf (auditor-ready)
```

### Success signal:

Email from DevOps Lead to CTO + QA: "Cloud Logs reviewed. 0 errors blocking production. Summary PDF attached. Ready for memo sign-off."

---

## Task 2: Phase 0 Deployment Closure Memo

**Owner:** CTO  
**Duration:** 2–3 hours  
**Start:** Day 1, 08:00 BRT (parallel to T1)  
**Effort points:** 2

### What to do:

1. **Gather input from stakeholders:**
   - **RT input:** Medical/compliance sign-off (DICQ 78.5% baseline acceptable)
   - **DevOps input:** Infrastructure health, incident count, deployment SLAs met
   - **QA input:** All smoke tests passing, 0 regressions in test suite
   - **CTO sign-off:** Architectural decisions locked, v1.4 roadmap approved

2. **Draft memo structure:**

   ```
   v1.3 DEPLOYMENT CLOSURE MEMO
   ----
   Date: [Day 3]
   Phase: v1.3 (complete)
   Status: CLOSED (production ready)

   ## Deployment summary
   - Timeline: [dates of phase 9 + deployment]
   - Modules: 25 live + auditable
   - Tests: 738/738 passing
   - DICQ baseline: 78.5% (locked)

   ## Sign-offs
   - CTO (architecture): [signature + date]
   - RT (medical): [signature + date]
   - DevOps (infra): [signature + date]
   - QA (testing): [signature + date]

   ## Known issues resolved (if any)
   - [List any TEMP-IMPLANTACAO flags or Phase 0 blockers that are closed]

   ## Next steps
   - Production monitoring: 48h post-deploy window
   - v1.4 Phase 1 kickoff: 2026-05-08 (pending memo)
   - Phase 2 gate unblocks: upon Phase 1 completion
   ```

3. **Collect sign-offs:**
   - Email each stakeholder with memo draft
   - Request written approval in email thread
   - Compile into final memo by Day 3 EOD

4. **Publish to planning:**
   - Merge to main with commit: "docs(v1.3): Deployment closure memo signed — production stable"

### Acceptance criteria:

- [ ] Memo drafted with all sections filled
- [ ] Signatures from CTO, RT, DevOps, QA (email chain evidence)
- [ ] DICQ 78.5% baseline formally locked in memo
- [ ] All known Phase 0 issues resolved or escalated with mitigation
- [ ] No ambiguities re: v1.3 readiness for v1.4 handoff

### Deliverable:

```
.planning/V1.3_DEPLOYMENT_CLOSURE_MEMO.md
  - Status: v1.3 CLOSED (production ready for next phase)
  - Signatures: 4 stakeholders
```

### Success signal:

CTO posts in Slack #v1.4-phase-1: "v1.3 closure memo signed by RT, DevOps, QA. Production health verified. Phase 1 kickoff 09:00 tomorrow."

---

## Task 3: v1.3 Phases Archive & Indexing

**Owner:** CTO / Planning Lead  
**Duration:** 3–4 hours  
**Start:** Day 2, 08:00 BRT  
**Effort points:** 2

### What to do:

1. **Identify v1.3 phase directories:**
   - Phase 08 (CAPAs v1.3 portion): `.planning/phases/05-auditoria-interna/`
   - Phase 09 (Bioquímica): `.planning/phases/06-compliance/`
   - Phase 10–12 (cleanup + dry-run): `.planning/phases/07-dry-run/`
   - Note: Some phases may be in `00-rdc-blockers`, `02-construction`, etc. (v1.3 retro)

2. **Create archive directory structure:**

   ```
   .planning/milestones/v1.3-ARCHIVE/
     ├── phases/
     │   ├── 00-rdc-blockers/
     │   ├── 02-construction/
     │   ├── 03.1-foundation/
     │   ├── 03.2-core-features/
     │   ├── 03.3-polish/
     │   ├── 04-cleanup/
     │   ├── 05-auditoria-interna/
     │   ├── 06-compliance/
     │   └── 07-dry-run/
     ├── v1.3-ARCHIVE-INDEX.md
     └── README.md
   ```

3. **Move phase directories to archive:**
   - Use `mv` or similar to relocate complete phase folders
   - Preserve all metadata (dates, owners, test logs)
   - Update `.planning/phases/README.md` to point to archive

4. **Create archive index (v1.3-ARCHIVE-INDEX.md):**

   ```
   # v1.3 Archive Index

   **Period:** 2026-03-15 → 2026-05-07
   **Total phases:** 12 (phases 00–07)
   **Modules delivered:** 25
   **Tests passing:** 738/738

   | Phase | Title | Dates | Owner | Modules | Status |
   |-------|-------|-------|-------|---------|--------|
   | 00 | RDC Blockers | 2026-03-15–2026-04-01 | CTO | 5 | Complete |
   | 02 | Construction | 2026-04-01–2026-04-15 | Stream A | 8 | Complete |
   | 03.1 | Foundation | 2026-04-15–2026-04-25 | Stream B | 5 | Complete |
   | 03.2 | Core Features | 2026-04-25–2026-05-01 | Stream C | 4 | Complete |
   | 03.3 | Polish | 2026-05-01–2026-05-03 | Stream D | 2 | Complete |
   | 04 | Cleanup | 2026-05-03–2026-05-05 | CTO | — | Complete |
   | 05 | Auditoria Interna | 2026-05-05–2026-05-06 | QA | — | Complete |
   | 06 | Compliance | 2026-05-06–2026-05-07 | Compliance | — | Complete |
   | 07 | Dry Run | 2026-05-07–2026-05-07 | DevOps | — | Complete |

   **Key artifacts:**
   - Phase execution summaries (1 per phase)
   - Test results + coverage reports
   - Deployment logs + incident reports
   - ADR links (0001–0008)
   ```

5. **Verify archive integrity:**
   - Check all subdirs have PLAN.md + execution reports
   - Verify timestamps are consistent
   - Confirm no dangling references from active phases

### Acceptance criteria:

- [ ] All v1.3 phase directories moved to archive
- [ ] Archive index created + complete (5+ entries)
- [ ] Active phase directory (`.planning/phases/`) only contains Phase 01+ (v1.4)
- [ ] No broken symlinks or missing files
- [ ] Archive is readable (can be referenced in audits)

### Deliverable:

```
.planning/milestones/v1.3-ARCHIVE/
  └── v1.3-ARCHIVE-INDEX.md
      - 12 phases indexed
      - 25 modules tracked
      - Completion dates locked
```

### Success signal:

CTO posts in #v1.4-phase-1: "v1.3 archive complete. Phase 00–07 indexed. Auditable trail preserved. 738/738 tests ✓"

---

## Task 4: v1.3 Final Smoke Tests (4 Critical Flows)

**Owner:** QA Lead  
**Duration:** 3–4 hours  
**Start:** Day 2, 09:00 BRT (after T1/T2 kickoff)  
**Effort points:** 3

### What to do:

1. **Pre-test environment check:**
   - Confirm staging Riopomba is production-mirror (or test on production)
   - Document browser + device used (e.g., Chrome 126, iPad Pro 2023)
   - Check network: no VPN throttling

2. **Flow 1: Login → Hub → CIQ Entry (Hematology)**
   - Start timer at login page
   - Login with test RT account
   - Navigate to Hub
   - Click "Hematologia" tile
   - Create new CIQ run (QC entry)
   - Submit + confirm save
   - **Measure:** Time-to-Interactive (TTI) per step
   - **Target:** <1.5s total TTI
   - **Errors:** 0

3. **Flow 2: Laudo Creation → Review → Signature**
   - From hub, go to "Laudos"
   - Create new laudo (pre-populated patient data)
   - Fill in results (Yumizen H550 hematology values)
   - Submit to RT review
   - RT account: review laudo
   - Sign with digital signature (mock if needed)
   - Confirm in audit log
   - **Measure:** Form submission latency, signature latency
   - **Target:** <2.0s per form section
   - **Errors:** 0

4. **Flow 3: Export Wizard (Multi-page XLSX + PDF)**
   - From Laudos, select 3+ laudos
   - Open Export Wizard
   - Step 1: Select format (XLSX + PDF)
   - Step 2: Choose date range
   - Step 3: Filter by equipment
   - Step 4: Download + verify files
   - **Measure:** Export generation time
   - **Target:** <10s for 50-page PDF, <2s for XLSX
   - **Errors:** 0
   - **Verify:** File integrity (open in Excel, Adobe Reader)

5. **Flow 4: Analytics Dashboard (30s Polling, Multi-filter)**
   - From Hub, go to Analytics
   - Confirm dashboard loads
   - Set filter: Equipment = "Yumizen H550"
   - Set filter: Date range (last 30d)
   - Set filter: Operator = "RT-01"
   - Watch polling (30s interval)
   - Update one param; confirm data refreshes
   - **Measure:** Initial load TTI, filter response latency, polling latency
   - **Target:** Load <2.0s, filters <500ms, polling <1.0s
   - **Errors:** 0

6. **Mobile responsiveness check:**
   - Run Flow 1 + Flow 3 on iPad (landscape + portrait)
   - Confirm touch targets ≥48×48px
   - Verify no layout breaks
   - Document screenshots

7. **Document results:**
   - Create test execution log (`.md` format)
   - Include per-flow: TTI measurements, errors, screenshots
   - Summarize: "4/4 flows ✓, no regressions, mobile responsive"

### Acceptance criteria:

- [ ] All 4 flows execute without errors
- [ ] TTI targets met on all flows (CIQ <1.5s, Laudo <2.0s, Analytics <2.0s, Export <10s)
- [ ] Mobile responsive (iPad landscape + portrait)
- [ ] Screenshots captured for audit trail
- [ ] Test execution log complete + signed by QA

### Deliverable:

```
.planning/V1.3_FINAL_SMOKE_TESTS.md
  - 4 flows documented (entry, execution, TTI, errors)
  - Screenshots + device info
  - Mobile responsiveness verified
  - QA sign-off
```

### Success signal:

QA Lead posts: "v1.3 smoke tests complete. 4/4 flows passing. No regressions. Mobile ✓. Ready for production baseline documentation."

---

## Task 5: v1.4 ROADMAP Review & Approval

**Owner:** CTO + all 4 Stream Leads (A, B, C, D)  
**Duration:** 4–5 hours (spread Days 1–3)  
**Start:** Day 1, 09:00 BRT  
**Effort points:** 4

### What to do:

1. **Day 1 kickoff call (09:00 BRT, 45 min):**
   - CTO presents v1.4 vision: Compliance closure + Portal + IA foundation
   - Timeline: 22 weeks, 4 waves, 12 phases, 22-week delivery by 2026-09-30
   - High-level roadmap: Wave 1 (Foundation), Wave 2 (Operations), Wave 3 (Compliance + IA), Wave 4 (Launch)
   - Q&A: Stream leads ask clarifying questions

2. **Day 1–2: Stream-by-stream review (1h per stream):**
   - **Stream A (Compliance):** Phases 1–4, 8–9, 13 (CAPA, docs, final audit)
   - **Stream B (Operations):** Phases 5–7 (Portal, críticos, feedback)
   - **Stream C (IA):** Phases 11–12 (IA foundation, perf audit)
   - **Stream D (DevOps):** Phases 3, 12–15 (schema, perf, security, deploy)
   - Each lead confirms: scope clarity, effort estimate, blockers, dependencies

3. **Day 3 alignment & approval (14:00 BRT, 45 min):**
   - All 4 leads present 3-min summary of their wave assignment
   - CTO facilitates consensus on critical-path phases (4, 5, 8, 13, 14)
   - Approval: all leads sign-off on ROADMAP header (commitment)

4. **ROADMAP artifact review:**
   - Check Section "Phase Breakdown (12 phases)" — each phase has: goal, requirements, dependencies, duration, success criteria, artifacts, risk
   - Check Section "Wave Grouping & Timeline" — ensures logical sequencing
   - Check Section "Cross-Phase Risks" — 10 risks identified + mitigations

### Acceptance criteria:

- [ ] CTO presents + facilitates (no ambiguity on vision/scope)
- [ ] All 4 stream leads attend kickoff call + stream reviews
- [ ] Each stream lead articulates their phase scope + owner
- [ ] No critical blockers identified (if found, escalate to CTO same-day)
- [ ] ROADMAP.md approved by CTO + all 4 leads (signatures in header)

### Deliverable:

```
.planning/milestones/v1.4-ROADMAP.md (v1.0, approved)
  - Signatures: CTO + Stream A/B/C/D leads
  - Status: APPROVED (ready for Phase 2 execution)
```

### Success signal:

CTO posts: "v1.4 ROADMAP approved by all 4 stream leads. 22-week timeline locked. Wave 1 kickoff 2026-05-08. Phase 2 ready."

---

## Task 6: v1.4 REQUIREMENTS Finalized & Phase-Assigned

**Owner:** CTO + Compliance Lead  
**Duration:** 3–4 hours  
**Start:** Day 2, 14:00 BRT  
**Effort points:** 3

### What to do:

1. **REQ-by-REQ phase assignment audit:**
   - Review each REQ-401 → REQ-415 (15 main)
   - Verify phase assignment aligns with ROADMAP dependencies
   - Example: REQ-403 (Personnel Dossier) must be Phase 1 (not Phase 8)
   - Flag any out-of-order assignments

2. **Create v1.4-REQ-PHASE-MATRIX.md:**

   ```
   # v1.4 Requirements ↔ Phase Matrix

   **Purpose:** Resolves RISK-401 (REQ↔Phase inconsistency). Single source of truth for execution.

   | REQ ID | Title | DICQ Block | RDC Article | Phase | Owner | Effort (pts) | Status |
   |--------|-------|-----------|-------------|-------|-------|--------------|--------|
   | REQ-401 | Advanced KPI Dashboarding | 4.12.1, 4.14.7 | Art. 86 | 1 | Stream D | 16–20 | Planned |
   | REQ-402 | SGD Hard Launch | 4.3 | Art. 117 | 1 | Stream A | 24–28 | Planned |
   | REQ-403 | Personnel Dossier | 5.1 | Arts. 122–127 | 1 | Stream A | 22–26 | Planned |
   | REQ-404 | Coleta + Transporte | 5.4 | Arts. 128–131 | 2 | Stream B | 18–22 | Planned |
   | … | … | … | … | … | … | … | … |
   | REQ-415 | Laudo Reconciliation | 4.13 | Art. 115 | 3 | Stream A | 13–16 | Planned |

   **Summary:**
   - Total REQs: 15 main
   - Total effort: ~160–190 pts
   - Timeline: 12–14 weeks (parallelized)
   - Phase distribution: 7 Phase 1, 5 Phase 2, 3 Phase 3
   ```

3. **Lock effort estimates:**
   - Confirm all story point estimates are v1.3 velocity-calibrated
   - If estimate >25 pts, check for decomposition opportunity
   - Stream leads validate estimates for their assigned REQs

4. **Confirm DICQ + RDC mappings:**
   - Each REQ must map to ≥1 DICQ block (A–J)
   - Each REQ must map to ≥1 RDC article (if mandatory)
   - Verify no DICQ block is orphaned (all covered by some REQ or deferred)

5. **Mark scope boundaries:**
   - REQ-501–507: Out-of-scope v1.4 (parking lot for v2)
   - TD-401–405: Technical debt (must-have, parallelizable with REQ-\*)

6. **CTO sign-off:**
   - Review matrix for ambiguities + conflicts
   - Approve + publish

### Acceptance criteria:

- [ ] All 15 REQs phase-assigned (no orphan requirements)
- [ ] DICQ + RDC mappings 100% complete
- [ ] Effort estimates locked ± 10% (within velocity tolerance)
- [ ] Out-of-scope items (REQ-501–507) clearly marked
- [ ] v1.4-REQ-PHASE-MATRIX.md published + committed
- [ ] RISK-401 (REQ↔Phase) closed (mitigation complete)

### Deliverable:

```
.planning/milestones/v1.4-REQ-PHASE-MATRIX.md (new)
  - 15 REQs × 7 columns (REQ ID, Title, DICQ, RDC, Phase, Owner, Effort)
  - CTO sign-off
  - Status: LOCKED (no changes without CTO approval)
```

### Success signal:

CTO posts: "v1.4 REQUIREMENTS finalized. REQ↔Phase matrix published. 15 main + 5 stretch + 5 technical debt. All mapped to DICQ + RDC. RISK-401 closed."

---

## Task 7: Risk Register Locked & Review Scheduled

**Owner:** QA Lead  
**Duration:** 2–3 hours  
**Start:** Day 3, 10:00 BRT  
**Effort points:** 2

### What to do:

1. **Risk review audit:**
   - Read all 19 RISK entries in v1.4-RISK-REGISTER.md
   - Check format consistency (title, description, probability, impact, mitigation, contingency, owner, SLA)
   - Verify top risks are flagged (RISK-401, RISK-403 = 🔴 critical)

2. **Assign owners + escalation:**
   - RISK-401 (REQ↔Phase): Owner = CTO (closed once T6 complete)
   - RISK-402 (Auditor availability): Owner = QA Lead
   - RISK-403 (4 RDC blockers): Owner = CTO + QA Lead (joint)
   - RISK-404 → RISK-419: Each has single owner
   - Verify escalation chain (Phase Lead → QA Lead → CTO)

3. **Lock weekly review schedule:**
   - **Cadence:** Every Monday, 09:30 BRT, 30 min
   - **Attendees:** CTO, QA Lead, Stream Leads (A–D)
   - **Agenda:** Status updates on 🔴 + top 5 🟡 risks; new risks; closure proposals
   - **Calendar invite sent** to all participants

4. **Confirm SLAs for Phase 1 critical risks:**
   - RISK-401: 48h to lock matrix (T6 milestone)
   - RISK-403: 7 days to close Phase 0 items (Days 1–7 of phase)
   - RISK-402: Auditor RFI SLA = 5 business days (starts Week 2)

5. **Publish register approval:**
   - Update RISK-REGISTER.md header: Status = APPROVED, Owner assigned, Review scheduled
   - Commit to main

### Acceptance criteria:

- [ ] All 19 risks assigned to owners
- [ ] Escalation matrix clear (Phase Lead / QA / CTO)
- [ ] Weekly review scheduled (calendar invites sent)
- [ ] Phase 1 critical risks (RISK-401, RISK-403) have SLAs locked
- [ ] v1.4-RISK-REGISTER.md approved + published

### Deliverable:

```
.planning/milestones/v1.4-RISK-REGISTER.md (v1.0, approved)
  - All owners assigned
  - Weekly review scheduled (Mondays 09:30 BRT)
  - Status: ACTIVE (under weekly review)
```

### Success signal:

QA Lead posts: "v1.4 Risk Register approved. 19 risks tracked. Weekly reviews start Monday. RISK-401 + RISK-403 critical path. Dashboard ready."

---

## Task 8: Phase 2 Schema & Cross-Cutting Prep

**Owner:** Tech Lead (Stream D) + Stream A Lead  
**Duration:** 4–5 hours (Days 2–3)  
**Start:** Day 2, 14:00 BRT  
**Effort points:** 4

### What to do:

1. **Whiteboard Phase 3 schema (new collections):**
   - `portal-configuracao` (patient portal branding per lab)
   - `notivisa-outbox` (notification queue + submission log)
   - `criticos-escalacoes` (critical value escalation + SLA tracking)
   - `imuno-ias-dev` (IA strip image + metadata + classification)
   - `laudos-draft` (laudo edit state for RT portal)
   - **For each:** Identify fields, indexes, validation rules, audit requirements

2. **List schema dependencies:**
   - Which Phases (4–7) read/write to each collection?
   - Which fields must be immutable (audit)?
   - Which require soft-delete (RN-06)?
   - Which need logical signature?

3. **Rules audit plan:**
   - Phase 3 must extend firestore.rules for 5 new collections
   - Schedule rules review: Week 2, Day 1 (with hcq-firestore-rules-generator skill)
   - Identify membership checks + role-based access patterns

4. **Shared helpers list:**
   - `notivisaFormatter` (Art. 6º format + Zod schema)
   - `smsTemplate` (critical value escalation message)
   - `laudoDraftManager` (transactional state machine)
   - `iaStripValidator` (Zod schema for OCR input)
   - `escalacaoSLACalculator` (SLA drift tracking)
   - **For each:** Identify signature, test coverage, owner

5. **Cloud Functions base structure:**
   - Create `functions/src/v1.4-base/` skeleton
   - List all new callables (estimated 50+)
   - Allocate callable owners per stream
   - Document common error handling patterns (retry, rate-limit)

6. **Phase 2 kickoff checklist:**
   - Create `.planning/phases/02-v14-requirements-deepdive-CHECKLIST.md`
   - 8 tasks: Phase 2 planning, REQ decomposition, dependency audit, staging prep, rules review, helper stubs, E2E test scaffold, stream kickoff

### Acceptance criteria:

- [ ] Phase 3 schema whiteboarded (5 collections mapped)
- [ ] Rules audit plan scheduled (Week 2)
- [ ] Shared helpers list + owner assignments finalized
- [ ] Cloud Functions base structure skeleton created
- [ ] Phase 2 kickoff checklist drafted
- [ ] No critical blockers identified for Phase 2 start

### Deliverable:

```
.planning/phases/02-v14-requirements-deepdive-BRIEF.md (draft)
  - Phase 2 objective + scope
  - 8 tasks (Phase 2 sub-phases)
  - Timeline + effort

functions/src/v1.4-base/
  - Skeleton directory structure (no implementation yet)
  - README with callable list + ownership
```

### Success signal:

Tech Lead posts: "Phase 2 planning complete. Schema whiteboarded. Rules audit scheduled for Week 2. Phase 2 kickoff ready. CTO: authorize Phase 1 closure?"

---

## Effort & Timeline Summary

| Task               | Hours      | Days       | Effort Pts | Parallelizable          | Owner                |
| ------------------ | ---------- | ---------- | ---------- | ----------------------- | -------------------- |
| T1: Cloud Logs     | 4h         | 1          | 2          | Yes (parallel w/ T2)    | DevOps               |
| T2: Closure memo   | 2–3h       | 1–3        | 2          | Yes (parallel w/ T1)    | CTO                  |
| T3: Archive        | 3–4h       | 2          | 2          | Solo                    | CTO                  |
| T4: Smoke tests    | 3–4h       | 2          | 3          | Solo                    | QA                   |
| T5: ROADMAP review | 4–5h       | 1–3        | 4          | Sync needed (all leads) | CTO + Streams        |
| T6: REQUIREMENTS   | 3–4h       | 2          | 3          | Solo                    | CTO + Compliance     |
| T7: Risk register  | 2–3h       | 3          | 2          | Solo                    | QA                   |
| T8: Phase 2 prep   | 4–5h       | 2–3        | 4          | Solo                    | Tech Lead + Stream A |
| **TOTAL**          | **28–35h** | **4 days** | **24 pts** | —                       | —                    |

**Estimated work capacity:** 3–4 days elapsed time (with parallelization of T1/T2 + sync gates)

---

## Critical Path & Dependencies

```
Day 1:
  T1 (Logs) ───┐
  T2 (Memo) ──┤
  T5 kickoff ─┘ → CTO alignment with streams

Day 2:
  T1 → T2 (memo sign-off)
  T3 (Archive) + T4 (Smoke tests) [parallel]
  T5 (Stream reviews) [parallel]
  T6 kickoff (Reqs)
  T8 whiteboard schema [parallel]

Day 3:
  T5 + T6 finalize + approve
  T7 (Risk register)
  T8 complete (Phase 2 prep)

Day 4:
  Gate review: all tasks ✓
  Commit all artifacts
  Phase 1 → Phase 2 authorization (CTO decision)
```

**Critical-path items:**

- T5 (ROADMAP approval) — must finish Day 3 for Phase 2 kickoff
- T6 (REQ phase-assignment) — resolves RISK-401 (blocker)
- T1 (Logs) + T2 (Memo) — prerequisite for deployment sign-off

---

## Gate Criteria (Phase 1 → Phase 2 Unblock)

**All of these must be ✅:**

1. ✅ **Deployment health:**
   - Cloud Logs 24h: 0 critical errors (T1)
   - Smoke tests 4/4: passing (T4)

2. ✅ **Closure:**
   - v1.3 closure memo signed (T2)
   - v1.3 archive complete + indexed (T3)

3. ✅ **v1.4 alignment:**
   - ROADMAP approved (T5)
   - REQUIREMENTS phase-assigned (T6) — RISK-401 closed
   - RISK REGISTER scheduled (T7)
   - Phase 2 prep done (T8)

4. ✅ **Commit & sign-off:**
   - All artifacts merged
   - Phase 1 commit: `docs(phase-1): complete — v1.3 stabilization wrap-up`
   - CTO authorization: Phase 2 kickoff

**Phase 2 starts** when gate ✅ + CTO approval.

---

## Document Control

- **Version:** 1.0 (2026-05-07)
- **Status:** READY FOR EXECUTION
- **Owner:** CTO
- **Phase 1 start:** 2026-05-07, 08:00 BRT
- **Phase 1 gate review:** 2026-05-10, 10:00 BRT

---

**End of Phase 1 Execution Plan**
