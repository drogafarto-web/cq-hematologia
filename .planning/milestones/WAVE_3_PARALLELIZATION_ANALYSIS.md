---
artifact: Wave 3 Parallelization Analysis (Phases 8–11)
status: AUTHORITATIVE
period: 2026-09-13 → 2026-10-22 (9 weeks)
scope: Critical path, parallelization DAG, blockers, resource constraints, risk mitigation
created: 2026-05-07
sources:
  - v1.4-DEPENDENCY-MATRIX.md (Phase-by-phase critical path)
  - v1.4-RISK-DEEP-DIVE.md (top 10 risks + mitigation)
  - v1.4-REQ-PHASE-MATRIX.md (requirement mapping)
  - v1.4-ROADMAP.md (22-week v1.4 schedule)
---

# WAVE 3 PARALLELIZATION ANALYSIS — Phases 8–11 (NOTIVISA + Docs + Multi-Equipment CIQ + IA)

**Executive Summary:** Wave 3 (Weeks 9–15 = Days 64–105 calendar) delivers the most complex parallelization in v1.4, with 4 autonomous streams (A/B/C/D) running simultaneously across 4 critical phases. All phases are parallelizable (zero hard blocking dependencies between them), but Phase 10 (Multi-Equipment CIQ) has tight resource coupling with Phases 9 + 11. This document provides the complete task decomposition, dependency DAG, staging readiness checklist, and risk mitigation strategy.

---

## 1. DEPENDENCY DAG — Phase 8–11 Task Graph

### 1.1 Dependencies Matrix (Hard + Soft)

```
PHASE 8 (NOTIVISA Integration) — Weeks 9–10 (14 days)
├─ Depends on: Phase 3 schema ✓ (portal-configuracao, notivisa-outbox collections)
├─ Depends on: Phase 6 escalation draft ✓ (soft)
├─ Hard blockers: NOTIVISA gov sandbox access + Portaria 204 clarity
├─ Blocks: Phase 15 production deploy (NOTIVISA must be staged first)
├─ Parallel with: Phases 9, 10, 11 (all independent)
└─ No inter-phase task dependencies (true parallel execution)

PHASE 9 (Documentation Hardening) — Weeks 9–10 (10 days)
├─ Depends on: Phase 3 schema ✓ (sgq-documentos collection)
├─ Depends on: Phase 4 CAPA closure ✓ (evidence as template + precedent)
├─ Hard blockers: RDC 978 Art. 117 clarity (SGD retention + versioning rules)
├─ Blocks: Phase 13 (DICQ audit needs docs as baseline)
├─ Parallel with: Phases 8, 10, 11 (all independent)
├─ Soft dependency: Phase 10 (if analyte-validation docs needed for CIQ annex)
└─ No critical inter-phase task dependencies

PHASE 10 (Multi-Equipment CIQ Expansion) — Weeks 10–12 (17 days)
├─ Depends on: Phase 3 schema ✓ (runs collection extended for multi-instrument)
├─ Soft dependency: Phase 9 docs (method validation procedures)
├─ Hard blockers: Equipment partnership confirmations (Yumizen + ≥2 others validated)
├─ Blocks: Phase 12 (performance baseline requires CIQ module bundle size measured)
├─ Blocks: Phase 13 (multi-equipment validation needed for DICQ Bloco F)
├─ Parallel with: Phases 8, 9, 11 (resource contention possible with Phase 11 dataset)
├─ Strong internal coupling: analyte expansion + instrument validation + lot expiry = tightly sequential
└─ Task overlap with Phase 11: dataset labeling (both use analyte images)

PHASE 11 (IA Foundation — Strip OCR Classification) — Weeks 12–14 (14 days, stagger Week 12)
├─ Depends on: Phase 3 schema ✓ (imuno-ias-dev collection)
├─ Hard blockers: Gemini 2.5 Flash API provisioning + quota confirmed
├─ Soft dependency: Phase 10 analyte results (images used as IA ground truth labels)
├─ Blocks: Phase 15 production (IA dataset must be collected + validated)
├─ Does NOT block Phases 12–14 (launch doesn't depend on IA accuracy in v1.4; feature is IA-assisted, not authoritative)
├─ Parallel with: Phases 8, 9, 10 (resource allocation: 1 IA lead + 1 backend eng dedicated)
└─ Task overlap with Phase 10: analyte dataset sharing (CIQ images used for IA training)
```

### 1.2 Critical Path Through Wave 3

**Longest chain (zero slack):**

```
Phase 3 Complete (Day 13)
  → Phase 8 start (Day 14) [0 slack]
     └─ Phase 8 complete (Day 28) [soft dependency on Phase 6, not blocking]
  → Phase 9 start (Day 14) [0 slack — depends on Phase 3 + 4]
     └─ Phase 9 complete (Day 24) [feeds Phase 13, but Phase 13 is Week 17]
  → Phase 10 start (Day 21, Week 10) [stagger; depends on Phase 3 + analyte scope]
     └─ Phase 10 complete (Day 38) [feeds Phase 12 for bundle baseline]
  → Phase 11 start (Day 35, Week 12) [stagger; depends on Gemini provisioning]
     └─ Phase 11 complete (Day 49) [no hard blocker downstream, but IA dataset captured]

CRITICAL PATH (Actual): Phase 3 → Phase 10 → Phase 12 → Phase 13 → Phase 14 → Phase 15
  (Phase 8, 9, 11 have slack; Phase 10 feeds Phase 12 performance baseline)
```

**Slack analysis:**
- **Phase 8:** 15–20 days slack (NOTIVISA completes Day 28, but Phase 13 doesn't start until Day 75)
- **Phase 9:** 25–30 days slack (docs complete Day 24, Phase 13 doesn't need them until Day 75)
- **Phase 10:** 0–2 days slack (multi-equipment validation feeds Phase 12 baseline; 17-day duration = longest in Wave 3)
- **Phase 11:** 15–20 days slack (IA dataset complete Day 49, Phase 15 doesn't verify until Day 92)

---

## 2. CRITICAL PATH ANALYSIS (CPA)

### 2.1 Wave 3 Critical Path (Phases 8–11 Segment)

```
PHASE 10 is on critical path (feeds Phase 12 performance baseline):

Phase 3 complete (Day 13)
  ↓
Phase 10 start (Day 21, Week 10) — stagger to avoid resource conflict
  • Day 21–38: multi-instrument validation (17 calendar days)
  • Deliverable: ≥3 instruments validated for coag, imuno, uro
  • Completion gate: Phase 12 baseline includes Phase 10 bundle size
  ↓
Phase 12 start (Day 64, Week 16) — depends on Phase 10 completion
  • Day 64–74: performance audit (10 calendar days)
  • Depends on: Phase 10 CIQ module bundle measurement
  ↓
Phase 13 start (Day 75, Week 17)
  • Day 75–85: DICQ audit (10 calendar days)
  • Depends on: Phase 10 multi-equipment validation + Phase 9 docs
  ↓
Phase 14 (security) → Phase 15 (deploy)
```

**Phases 8, 9, 11 have 15–30 day slack; can slip without delaying Phase 12 start (as long as Phase 10 finishes Day 38).**

### 2.2 Wave 3 Critical Path Duration

| Segment | Duration | Days | Weeks |
|---------|----------|------|-------|
| Phase 3 completion → Phase 10 start (stagger buffer) | 8 days | 8 | 1.1 |
| Phase 10 execution (multi-analyte + multi-instrument) | 17 days | 17 | 2.4 |
| Phase 10 complete → Phase 12 start (buffer) | 13 days | 13 | 1.9 |
| **Wave 3 critical path (Phases 3→10→12)** | **38 days** | **38** | **5.4 weeks** |

**Non-critical slippage tolerance:**
- Phase 8 can slip up to 15 days without impact (completes Day 28 OR Day 43 — Phase 13 still has buffer)
- Phase 9 can slip up to 25 days without impact (completes Day 24 OR Day 49 — Phase 13 still has buffer)
- Phase 11 can slip up to 20 days without impact (completes Day 49 OR Day 69 — Phase 15 still has buffer)

---

## 3. PARALLELIZATION STRATEGY — 4-Stream Execution

### 3.1 Resource Allocation (Weeks 9–15)

```
WEEK 9:

Stream A (Compliance + NOTIVISA)
├─ Phase 8 start (NOTIVISA Integration)
│  ├─ 1 backend eng (NOTIVISA payload + API integration)
│  ├─ 1 QA eng (sandbox testing + RT gate design)
│  └─ 0.5 CTO (oversight)
├─ Phase 9 start (Documentation Hardening)
│  ├─ 1 backend eng (SGQ content + versioning rules)
│  ├─ 1 QA/compliance eng (RDC 978 + DICQ mapping)
│  └─ 0.5 CTO (governance alignment)
└─ Total: 4 FTE (2 eng dedicated to Phase 8 + 1.5 dedicated to Phase 9 + CTO shared)

Stream B (Portals + CIQ Operations)
├─ Phase 10 start (Multi-Equipment CIQ)
│  ├─ 1 frontend eng (UI: instrument selector, analyte matrix, lot expiry)
│  ├─ 1 backend eng (multi-instrument runs, lot lifecycle)
│  └─ 0.5 QA eng (analyte validation test matrix)
└─ Total: 2.5 FTE

Stream C (IA Foundation)
├─ Phase 11 start (IA Foundation — deferred to Week 12 to avoid resource conflict)
│  ├─ 1 IA lead (Gemini Vision integration, confidence thresholds)
│  └─ 1 backend eng (dataset pipeline, accuracy monitoring)
└─ Total: 0 FTE (Week 9 — NOT STARTED; waits for Phase 10 bootstrap)

Stream D (DevOps + Continuous)
├─ Lighthouse CI monitoring (weekly Friday reports)
├─ Cloud cost tracking (weekly budget report)
├─ Staging mirror (prep for Phase 10–11 deploys)
└─ Total: 0.5 FTE (continuous, shared across all phases)

WEEK 9 TOTAL: 7 FTE (4A + 2.5B + 0C + 0.5D)

---

WEEK 10:

Stream A
├─ Phase 8 mid-point (NOTIVISA sandbox testing)
├─ Phase 9 mid-point (MQ + Quality Policy drafts)
└─ Total: 3.5 FTE

Stream B
├─ Phase 10 mid-point (analyte expansion)
├─ Task overlap with Phase 11 dataset prep (1 backend eng starts dataset pipeline)
└─ Total: 2.5 FTE

Stream C
├─ Phase 11 prep (Gemini setup, dataset structure design)
└─ Total: 0.5 FTE (setup; not full execution yet)

Stream D
├─ Lighthouse CI + cost
└─ Total: 0.5 FTE

WEEK 10 TOTAL: 6.5 FTE

---

WEEK 11:

Stream A
├─ Phase 8 complete (NOTIVISA sandbox signed off) ✓
├─ Phase 9 tail (governance checklist)
└─ Total: 2 FTE (Phase 9 remains)

Stream B
├─ Phase 10 tail (multi-instrument validation, lot expiry enforcement)
├─ Phase 10 bundle measurement for Phase 12 baseline
└─ Total: 2.5 FTE

Stream C
├─ Phase 11 full start (image upload pipeline, Gemini integration)
└─ Total: 1.5 FTE (now active)

Stream D
├─ Lighthouse CI + cost
└─ Total: 0.5 FTE

WEEK 11 TOTAL: 6.5 FTE

---

WEEK 12:

Stream A
├─ Phase 9 complete (docs baseline for Phase 13) ✓
├─ Monitoring + 1 eng available for spillover
└─ Total: 1 FTE

Stream B
├─ Phase 10 complete (multi-equipment validated) ✓
├─ Bundle size measurement fed to Phase 12
├─ 1 eng available for spillover (Phase 11 support if needed)
└─ Total: 1 FTE

Stream C
├─ Phase 11 mid-point (500+ images collected + labeled)
└─ Total: 2 FTE (peak IA phase)

Stream D
├─ Phase 12 prep (baseline measurement from Phase 10)
├─ Lighthouse CI + cost
└─ Total: 1.5 FTE (transition to Phase 12 setup)

WEEK 12 TOTAL: 5.5 FTE (low overall, IA-focused)

---

WEEK 13–14:

Stream A
├─ Monitoring (1 eng available for Phase 13 prep)
└─ Total: 0.5 FTE

Stream B
├─ Spillover / Phase 13 prep
└─ Total: 0.5 FTE

Stream C
├─ Phase 11 tail (accuracy dashboard, CI integrations, dataset finalization)
└─ Total: 1.5 FTE

Stream D
├─ Phase 12 prep + cost monitoring
└─ Total: 0.5 FTE

TOTAL WEEKS 13–14: 3 FTE (low; Phase 11 winding down, Phase 12 prep)

---

WEEK 15:

Buffer week — all phases 8–11 complete; Phase 12 readiness validation
Total: 1 FTE (verification only)
```

### 3.2 Parallelization Factor

| Metric | Value | Calculation |
|--------|-------|-------------|
| **Serial duration (all phases sequential)** | 55 days | Phase 8 (14d) + Phase 9 (10d) + Phase 10 (17d) + Phase 11 (14d) |
| **Parallel duration (Wave 3 actual)** | 35 days | Phases 8, 9, 10 parallel (max 17d) + Phase 11 stagger (14d) |
| **Parallelization gain** | 20 days | 55 − 35 = 20 days saved |
| **Parallelization factor** | 1.57x | 55 / 35 |
| **Resource utilization (avg FTE)** | 5.2 FTE | Total FTE-weeks / 7 weeks |
| **Peak FTE** | 7 FTE | Week 9 (all 4 streams active) |

**Interpretation:** Executing Phases 8–11 in parallel saves 20 days (37%) vs. serial execution, at cost of 5.2 avg FTE (peak 7 FTE). No idle time; high resource efficiency.

---

## 4. BLOCKERS PER PHASE (Hard + Soft)

### 4.1 Phase 8 — NOTIVISA Integration (Weeks 9–10)

**Hard blockers (Block Execution Unless Resolved):**

| Blocker | Status | Mitigation | Risk |
|---------|--------|-----------|------|
| **NOTIVISA sandbox API access** | Pending gov contact (Week 1) | Request access by Day 3 (2026-05-13); fallback Firestore mocks Week 2 | Low (historical: sandbox available <7 days) |
| **Portaria 204 official text clarity** | RDC 978 Art. 66 + Art. 191 ambiguous on payload fields | Pre-alignment call Week 1; CTO confirms reading with compliance consultant | Low (article is published; interpretation likely clear) |
| **RT approval workflow design** | NOTIVISA requires RT manual sign-off before submission | Phase 6 critical-values escalation provides template; adapt for NOTIVISA gate | Medium (if Phase 6 incomplete, Phase 8 blocked 5–7 days) |

**Soft blockers (Delay, but Parallelizable):**

| Blocker | Mitigation | Impact |
|---------|-----------|--------|
| Phase 6 escalation escalation draft complete | Phase 6 completes Week 7; Phase 8 starts Week 9 (2-week buffer) | No impact; Phase 8 uses escalation template as reference |
| Phase 10 analyte expansion (if NOTIVISA payload includes analyte codes) | Phase 10 starts Week 10; Phase 8 Week 9 — **SAFE** (payload finalized before codes needed) | 0–3 days slip if codes delay Phase 8 week 2 |

**Risk Register Integration:**
- **RISK-410 (NOTIVISA API downtime):** Mitigation: sandbox testing in Week 9 + mock Firestore unblocks if API unavailable
- **RISK-406 (Schema migration flaws):** `notivisa-outbox` collection deployed Phase 3; Phase 8 relies on it (no new schema work)

---

### 4.2 Phase 9 — Documentation Hardening (Weeks 9–10)

**Hard blockers:**

| Blocker | Status | Mitigation |
|---------|--------|-----------|
| **RDC 978 Art. 117 (SGD retention rules)** | DICQ 4.3 specifies retention periods (5yr); RDC 978 Art. 115 clarifies | Pre-alignment call confirms interpretation; document in `v1.4-ASSUMPTIONS.md` |
| **Quality Policy template + governance checklist** | v1.3 has none; ISO 15189 provides template | Week 1: source template from ISO doc; adapt to lab context by Week 9 |
| **Environment procedures (collection, transport, analysis)** | RDC 978 Arts. 122–127 specify; DICQ 4.1.2 details | Copy v1.3 POPs as baseline; Phase 9 hardens with audit evidence |

**Soft blockers:**

| Blocker | Mitigation | Impact |
|---------|-----------|--------|
| Phase 4 CAPA closure (evidence as template) | Phase 4 completes Week 7; Phase 9 starts Week 9 (2-week buffer) | Phase 9 uses CAPA evidence format as documentation precedent |
| Phase 10 multi-analyte validation docs | Phase 10 completes Week 12; Phase 9 Week 10 — **docs COMPLETE BEFORE analyte validation published** | 0–2 days slip if method validation docs delay Phase 9 Week 2 |

**Risk Register Integration:**
- **RISK-405 (Auditor interpretation):** Phase 9 documents all assumptions; pre-alignment call confirms interpretation (Week 1)

---

### 4.3 Phase 10 — Multi-Equipment CIQ Expansion (Weeks 10–12)

**Hard blockers (Critical Path):**

| Blocker | Status | Mitigation | Risk |
|---------|--------|-----------|------|
| **Equipment partnerships confirmed** (Yumizen H550 + ≥2 others) | Pending (Week 1 check) | CTO reaches out Week 1; fallback: Yumizen-only v1.4 + defer multi-equip to v1.4.1 | Medium (if partners unavailable, Phase 10 scope reduced but not blocked) |
| **30+ analyte expansion scope locked** | Scope: coagulation (10), immunology (12), urine (8) = 30 baseline | Week 2: analyte list finalized; no scope creep after Day 12 | Low (analyte list is repeatable from v1.3) |
| **Lot expiry enforcement (calendar + auto-invalidation)** | Requires `lots` collection update + CIQ run validation logic | Phase 3 schema extends `runs`; Phase 10 implements validation | Low (schema ready; implementation straightforward) |

**Soft blockers (Parallelizable):**

| Blocker | Mitigation | Impact |
|---------|-----------|--------|
| Phase 9 method validation procedures | Phase 9 completes Week 10; Phase 10 Week 10 — **TIGHT COUPLING** | If Phase 9 slips 3+ days, Phase 10 Week 2 validation lacks docs (phase continues, docs follow Day 24) |
| Phase 11 dataset (analyte images as IA ground truth) | Phase 11 starts Week 12; Phase 10 completes Week 12 — **tight overlap** | Phase 10 images collected Week 12; handed to Phase 11 for labeling Week 12–14 (no blocker) |
| Phase 12 performance baseline (bundle size measurement) | Phase 10 completes Day 38; Phase 12 starts Day 64 (26-day buffer) | **ON CRITICAL PATH**: Phase 10 must provide bundle size for Phase 12 baseline |

**Resource Contention:**

- **Week 10–11:** Phase 10 front-end dev + 1 backend eng (2.5 FTE) vs. Phase 11 setup (0.5 FTE) = **NO CONFLICT** (distinct engineering roles)
- **Week 12:** Phase 10 tail (bundle measurement) + Phase 11 dataset pipeline (1 backend eng shared) = **RESOURCE CONFLICT if either slips** (mitigation: swap eng from Stream A if needed)

**Risk Register Integration:**
- **RISK-406 (Schema migration):** Phase 10 relies on Phase 3 schema; ruled out by Phase 3 emulator testing
- **RISK-413 (Performance regression):** Phase 10 bundle size feeds Phase 12 baseline (must measure accurately)

---

### 4.4 Phase 11 — IA Foundation — Strip OCR (Weeks 12–14)

**Hard blockers:**

| Blocker | Status | Mitigation | Risk |
|---------|--------|-----------|------|
| **Gemini 2.5 Flash API provisioning** | Requires GCP quota allocation + API key | Week 1: request quota (typical SLA <3 days); fallback: Gemini 1.5 Flash if 2.5 unavailable | Low (Gemini quota requests typically approved same-day) |
| **Confidence threshold guardrails** | Need 0.85 default threshold + RT manual override | Design Week 1; implement Phase 11 Week 1 (Day 35) | Low (straightforward feature) |
| **500+ labeled image dataset** | Phase 10 generates analyte images (500+ candidate); Phase 11 labels | Phase 10 delivers 500+ images Week 12; Phase 11 labels them Week 12–14 | Medium (if Phase 10 delivers <400 images, Phase 11 scrambles Week 14) |

**Soft blockers:**

| Blocker | Mitigation | Impact |
|---------|-----------|--------|
| Phase 10 analyte expansion (images source) | Phase 10 completes Week 12; Phase 11 starts Week 12 — **overlap** | Phase 11 uses images from Phase 10 Week 12+ (no blocker, overlapping timeline) |
| Phase 12 + 13 readiness (IA not on critical path) | Phase 11 completes Day 49; Phase 12 starts Day 64 (15-day buffer) | **PHASE 11 NOT ON CRITICAL PATH**; slip up to 15 days acceptable |

**Safety Constraints:**

- **False negative risk:** Gemini misclassifies HIV/Dengue/syphilis as negative → patient harm
- **Mitigation:** Confidence threshold 0.85 + confusion matrix tracking + RT manual override always available
- **See RISK-411 (Gemini Vision Drift) for detail**

**Risk Register Integration:**
- **RISK-411 (IA accuracy drift):** Mitigation: confidence threshold + monthly accuracy check (Phase 11 Week 3+)
- **RISK-418 (Cloud cost overrun):** Gemini Vision $500/month budget; Phase 11 cost tracking (Day 49 estimate: $200 for 500 images)

---

## 5. INTEGRATION POINTS BETWEEN PHASES

### 5.1 Phase 8 ↔ Phase 10 Integration (NOTIVISA ↔ CIQ)

**Data flow:**
```
Phase 10 (Multi-Equipment CIQ)
  → generates critical-value runs (analyte results)
  → Phase 8 (NOTIVISA Integration)
    → submits critical values to gov API
    → RDC 978 Art. 167 trigger: "critical value → electronic notification within X hours"
```

**Dependency:**
- Phase 8 NOTIVISA payload must include analyte codes (standardized names from Phase 10 expansion)
- Phase 10 must finalize analyte codes by Week 10, Day 28 (before Phase 8 payload finalization Week 10, Day 35)
- **Soft dependency:** Phase 8 can finalize payload with placeholder codes; Phase 10 provides final codes Day 28+

**Risk:** If Phase 10 analyte codes differ from NOTIVISA payload codes → submission failures
- **Mitigation:** Centralized `analyteCodeMapping.ts` (Phase 3 schema defines once; both Phase 8 + 10 reference it)

**Timeline compatibility:**
- Phase 8 payload finalization: Day 28 (end Week 10)
- Phase 10 analyte finalization: Day 38 (end Week 12)
- **Slack:** 10 days (Phase 8 completes before Phase 10 requires code alignment; safe)

---

### 5.2 Phase 9 ↔ Phase 10 Integration (Docs ↔ CIQ)

**Data flow:**
```
Phase 9 (Documentation Hardening)
  → creates method validation procedures (MQ Annex B)
  → Phase 10 (Multi-Equipment CIQ)
    → implements analyte validation per procedures
    → evidence: test runs + accuracy logs per documented methods
```

**Dependency:**
- Phase 10 needs Phase 9 documentation to validate analyte results against method specs
- Phase 9 method doc finalization: Day 24 (end Week 10)
- Phase 10 analyte validation: Days 21–38 (Week 10–12)
- **Overlap:** Phase 10 starts Day 21; Phase 9 docs available Day 24 (3-day lag)

**Risk:** If Phase 9 method docs unavailable, Phase 10 Week 1 validation proceeds without docs (rework needed Week 2)
- **Mitigation:** Phase 9 drafts method outlines Day 14–17 (before Phase 10 starts); finals published Day 24

**Timeline compatibility:**
- Phase 9 doc draft: Day 14–17 (ready for Phase 10 Week 1 reference)
- Phase 9 doc final: Day 24 (confirmation for Phase 10 Week 2 validation)
- Phase 10 analyte expansion: Days 21–38 (uses draft Week 1 + final Week 2)
- **Slack:** 3 days (tight, but manageable with draft-first strategy)

---

### 5.3 Phase 10 ↔ Phase 11 Integration (CIQ ↔ IA)

**Data flow:**
```
Phase 10 (Multi-Equipment CIQ)
  → collects 500+ analyte test images (photo + result)
  → Phase 11 (IA Foundation — Strip OCR)
    → labels images with ground-truth result (from Phase 10 runs)
    → trains/validates Gemini Vision model on labeled dataset
```

**Dependency:**
- Phase 11 needs Phase 10 images as training dataset
- Phase 10 image collection: Days 21–38 (Weeks 10–12)
- Phase 11 dataset labeling: Days 35–49 (Weeks 12–14)
- **Overlap:** Phase 11 starts Day 35; Phase 10 completes Day 38 (images flowing during Week 12)

**Risk:** If Phase 10 delivers <400 images, Phase 11 has insufficient dataset (confidence <85%)
- **Mitigation:** Phase 10 collects bonus images Days 30–38 (10% buffer); Phase 11 labels on rolling basis (not all-or-nothing on Day 38)

**Integration points:**
1. **Image pipeline (Day 21):** Phase 10 provisions `imuno-ias-dev` collection (Phase 3 schema) for Phase 11 to write labeled images
2. **Ground-truth mapping (Day 28):** Phase 10 finalizes analyte result IDs; Phase 11 references them for labeling
3. **Dataset completeness check (Day 49):** Phase 11 Week 3 verifies ≥500 labeled images; escalates if <450

**Timeline compatibility:**
- Phase 10 image delivery: 50 images/day → 500 images by Day 38 (realistic, ~50 CIQ runs/day during Week 10–12)
- Phase 11 labeling: 50 images/day → 500 labeled by Day 49 (rate-matched to Phase 10 delivery)
- **Slack:** Rolling; no single date dependency (images flow continuously, not batched)

---

### 5.4 Phase 8 ↔ Phase 9 Integration (NOTIVISA ↔ Docs)

**Data flow:**
```
Phase 9 (Documentation Hardening)
  → creates governance procedures (RDC 978 Art. 167 submission rules)
  → Phase 8 (NOTIVISA Integration)
    → implements RT approval gate per documented procedure
    → evidence: audit trail of approvals (matches governance doc)
```

**Dependency:**
- Phase 8 RT approval workflow should align with Phase 9 governance checklist
- Phase 9 governance draft: Day 14–17
- Phase 8 workflow design: Days 14–21
- **Parallel, non-blocking:** Both reference same governance model; designed together in Week 1 alignment call

**Risk:** If Phase 8 workflow and Phase 9 governance diverge → audit finding (inconsistency)
- **Mitigation:** CTO owns both; single approval workflow documented (Phase 1 kickoff call specifies structure)

---

### 5.5 Cross-Phase Data Consistency

**Shared schema + code references:**

| Artifact | Used by | Consistency |
|----------|---------|-------------|
| `analyteCodeMapping.ts` | Phase 8 (NOTIVISA), Phase 10 (CIQ), Phase 11 (IA) | **Centralized** — single source of truth (Phase 3) |
| `notivisa-outbox` collection | Phase 8 writes, Phase 13 audits | **Immutable after Phase 8** — no Phase 10/11 changes |
| `runs` collection (extended) | Phase 10 (multi-instrument runs), Phase 11 (image linkage) | **Additive schema** — Phase 10 adds fields, Phase 11 reads them |
| `imuno-ias-dev` collection | Phase 11 writes (labeled images), Phase 13 audits | **Append-only** — write intent + read consent pattern |

**Consistency enforcement:**
- Schema validation (TypeScript `types/` directory)
- Firestore rules (security + structure validation)
- Unit tests per phase (Vitest)
- E2E tests across phases (4-phase smoke suite)

---

## 6. STAGING READINESS CHECKLIST (Pre-Wave 3)

### 6.1 Infrastructure Readiness (By Week 8 End)

**Firestore Schema:**
- [ ] Phase 3 schema deployed + indexes live (`notivisa-outbox`, `criticos-escalacoes`, `portal-configuracao`, `imuno-ias-dev`, `laudos-draft`)
- [ ] Rules emulator tests green (23/23 test suite pass)
- [ ] Staging Firestore mirror populated with v1.3 data (Riopomba copy)
- [ ] Index build time <5 min (performance baseline established)

**Cloud Functions Readiness:**
- [ ] Phase 8 functions skeleton deployed (NOTIVISA payload builder + API caller + retry logic)
- [ ] Phase 9 functions skeleton deployed (document versioning + SGD sync)
- [ ] Phase 10 functions skeleton deployed (multi-instrument run creation + lot validation)
- [ ] Phase 11 functions skeleton deployed (Gemini Vision caller + confidence threshold)
- [ ] All functions tsconfig clean (0 TS errors)

**Cloud Storage + External APIs:**
- [ ] NOTIVISA sandbox credentials in `hcq_signature_hmac_key` secret (verified via `preflight-secrets-check.sh`)
- [ ] Gemini 2.5 Flash API quota provisioned (request Week 1, confirm Week 3)
- [ ] Twilio SMS configuration live (carry-over from Phase 6)
- [ ] GCP cost alerts configured (50%, 80%, 100% thresholds for Gemini, Functions, Firestore)

**Testing Infrastructure:**
- [ ] Vitest + Playwright setup ready (unit tests + E2E)
- [ ] Lighthouse CI baseline captured (362 KB gzip target, LCP <2.5s)
- [ ] Staging smoke tests written for Phases 8–11 (4 specs total)
- [ ] Cloud Logs monitoring alert templates ready (Phase 13 post-deploy)

---

### 6.2 Requirements + Documentation Readiness (By Week 8 End)

**Phase 8 (NOTIVISA):**
- [ ] `PHASE_8_PLAN.md` written (payload spec, RT approval flow, audit trail)
- [ ] Portaria 204 art-by-art requirement mapping (RDC 978 Arts. 66, 167, 191)
- [ ] NOTIVISA sandbox API mock (Firestore collections simulating gov responses)
- [ ] RT approval state machine diagram (Lucidchart or text diagram)

**Phase 9 (Documentation):**
- [ ] ISO 15189 templates sourced + customized (Manual da Qualidade, Quality Policy)
- [ ] `PHASE_9_PLAN.md` written (content + versioning + audit trail)
- [ ] RDC 978 Art. 117 (SGD retention) interpretation locked (documented in `v1.4-ASSUMPTIONS.md`)
- [ ] DICQ Blocks A–E gap map (which Phase 9 docs close)

**Phase 10 (Multi-Equipment CIQ):**
- [ ] 30 analyte scope finalized (coag 10, imuno 12, uro 8) — **NO CREEP AFTER DAY 12**
- [ ] `PHASE_10_PLAN.md` written (instrument validation, lot expiry, analyte expansion)
- [ ] Equipment partnership confirmations (Yumizen H550 + ≥2 others: vendor, model, method docs)
- [ ] Method validation test matrix (per analyte, per instrument, per lot scenario)

**Phase 11 (IA Foundation):**
- [ ] `PHASE_11_PLAN.md` written (Gemini integration, confidence thresholds, dataset pipeline)
- [ ] Dataset collection protocol (image quality specs, lighting, strip types, 500+ target)
- [ ] Accuracy dashboard design (confusion matrix, false-negative tracking, monthly review)
- [ ] Safety guardrails spec (RT override, confidence threshold 0.85, never authoritative flag)

---

### 6.3 Resource Allocation + Communication (By Week 8 End)

**Stream Assignment:**
- [ ] `v1.4-STREAM-ALLOCATION.md` published (who's on which stream, working hours, escalation path)
- [ ] Stream leads confirmed (A=QA Lead, B=Frontend Lead, C=IA Lead, D=DevOps)
- [ ] Daily standup calendar sent (09:00 BRT weekdays, 15 min, all streams)
- [ ] Weekly wave review calendar sent (Fridays 14:00 BRT, 45 min, CTO + 4 stream leads)

**Stakeholder Communication:**
- [ ] Auditor pre-alignment call scheduled (Week 1, Day 2 = 2026-05-14, 10:00 BRT)
- [ ] Equipment partners contacted (Week 1) — multi-instrument confirmations by Week 3
- [ ] CTO stakeholder memo sent (sales + customers + investors: "v1.4 single-lab; v1.5 multi-tenant")
- [ ] Compliance consultant booked (contingency for Phase 13)

**Risk Mitigation Activation:**
- [ ] Phase 0 critical risks resolved (RISK-401, RISK-403 from v1.4-RISK-DEEP-DIVE.md)
- [ ] Phase 2 risk mitigations active (RISK-406, RISK-407 templates ready)
- [ ] Cost tracking dashboard live (GCP Console + Slack bot posting weekly Friday 15:00 BRT)
- [ ] Phase 13 DICQ matrix audit schedule sent (Week 16 pre-dry-run, Week 17 final audit)

---

### 6.4 Code + Data Readiness (By Week 8 End)

**Codebase State:**
- [ ] Main branch CI green (all 738 tests passing, 0 TS errors)
- [ ] Feature branches for Phases 8–11 created (8-phase-notivisa, 9-phase-docs, 10-phase-ciq, 11-phase-ia)
- [ ] .env.staging updated with Phase 8–11 feature flags (PHASE_8_ENABLED=true, etc.)
- [ ] No TEMP-IMPLANTACAO markers remaining (Phase 4 cleanup complete)

**Staging Data:**
- [ ] Riopomba v1.3 data snapshot copied to staging Firestore (baseline for Phase 8–11 testing)
- [ ] 50 synthetic CIQ runs created (Phase 10 testing substrate)
- [ ] 10 synthetic notivisa-outbox entries created (Phase 8 testing substrate)
- [ ] Auth test accounts created (5 RT + 5 admin for Phase 8–11 E2E)

---

## 7. CRITICAL RISK MITIGATIONS (Phase 8–11 Segment)

### 7.1 Top 5 Risks Impacting Wave 3

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| **RISK-406 (Schema Migration Flaws)** | Phase 3 schema errors → all Phases 8–11 blocked | Staging dry-run (3d before Week 9); rules emulator tests green; rollback procedure | Tech Lead + Stream A |
| **RISK-402 (Auditor Bottleneck)** | Phase 4 slip → cascade to Phase 8–11 timing compression | Pre-alignment call Week 1; written RFI SLA; weekly standing calls; backup auditor | QA Lead |
| **RISK-411 (Gemini Vision Accuracy Drift)** | Phase 11 model <85% → patient safety risk | Confidence threshold 0.85 + RT override always available; monthly accuracy check (Day 49+) | Stream C (IA Lead) |
| **RISK-413 (Performance Regression)** | Phase 10 bundle bloats → Phase 12 baseline exceeds LCP <2.5s | Weekly Lighthouse report (Fridays); pre-merge CI gate; Phase 10 bundle measurement Day 38 | Stream D (DevOps) |
| **RISK-418 (Cloud Cost Overrun)** | Gemini + Functions costs exceed $1,500/month → feature throttling | Weekly GCP cost report (Fridays); hard caps ($500 Gemini, $200 Twilio, $300 Functions); throttle at 80% | Stream D (DevOps) |

### 7.2 Weekly Risk Review Cadence (Weeks 9–15)

```
EVERY FRIDAY 14:00 BRT (Wave 3 Review Meeting, 45 min)

Agenda:
├─ Phase 8 status (% complete, blockers)
├─ Phase 9 status (% complete, blockers)
├─ Phase 10 status (% complete, blockers, bundle size measurement)
├─ Phase 11 status (% complete, blockers, accuracy check if applicable)
├─ Risk dashboard review
│  ├─ RISK-406: Schema migration — any issues staging?
│  ├─ RISK-402: Auditor availability — RFI response SLA on track?
│  ├─ RISK-411: IA accuracy — monthly check (Phase 11 Week 3+)
│  ├─ RISK-413: Performance — Lighthouse metrics vs baseline
│  └─ RISK-418: Cloud costs — week-over-week spend
├─ Cross-phase integration check
│  ├─ Phase 8 ↔ 10 analyte codes synchronized?
│  ├─ Phase 9 ↔ 10 method docs completed for validation?
│  ├─ Phase 10 ↔ 11 image delivery on pace (50/day target)?
│  └─ Phase 8 ↔ 9 governance model aligned?
├─ Resource allocation + context-switch overhead (survey results)
└─ Next week blockers + escalations

Attendees: CTO, Stream A lead, Stream B lead, Stream C lead, Stream D lead
Decisions logged in `v1.4-WEEKLY-RISK-REPORT-{WEEK}.md`
```

### 7.3 Contingency Activation Triggers

**Phase 8 Contingency: NOTIVISA Sandbox Unavailable**
- **Trigger:** Gov sandbox API downtime >24h (verify at start of each daily standup)
- **Activation:** Stream A switches to Firestore mock (pre-built responses simulating gov API)
- **Impact:** Phase 8 functionality testing proceeds offline; gov API integration deferred to Phase 14 (staging verification)
- **Recovery:** Once API restored, 2-day integration test + deploy to staging

**Phase 9 Contingency: RDC 978 Interpretation Conflict**
- **Trigger:** Auditor flags interpretation difference during Phase 4 pre-call (Week 1)
- **Activation:** Emergency CTO + compliance consultant alignment call (same day)
- **Impact:** Phase 9 documentation adjusted; re-review by auditor (1–3 day delay)
- **Recovery:** Locked interpretation published; Phase 9 resumes with clarity

**Phase 10 Contingency: Equipment Partnership Not Confirmed**
- **Trigger:** Vendor nonresponse >5 business days (Week 1 check)
- **Activation:** Phase 10 scope reduced to Yumizen-only v1.4 + defer multi-equipment to v1.4.1
- **Impact:** Phase 10 duration compressed from 17 days to 10 days (analyte expansion without multi-instrument complexity)
- **Recovery:** Multi-equipment scheduled as v1.4.1 Phase A (contingency plan documented)

**Phase 11 Contingency: Gemini Vision Accuracy <85%**
- **Trigger:** Phase 11 Week 3 (Day 42) accuracy check shows <85% accuracy OR any false negative on critical disease
- **Activation:** Immediate CTO + Stream C call; escalation to patient safety committee
- **Impact:** Gemini feature disabled (reverts to manual RT entry only)
- **Recovery:** Investigate dataset bias + model drift; defer fine-tuned model to v1.5

---

## 8. INTEGRATION TEST PLAN (Smoke Suite)

### 8.1 E2E Test Scenarios (4 specs, 1 per phase)

**Spec 1: Phase 8 — NOTIVISA Integration**
```
Given: Lab admin in /laudos with critical-value run (Hemoglobin >20g/dL)
When: RT approves escalation → NOTIVISA submission triggered
Then: 
  ✓ notivisa-outbox entry created with RT signature
  ✓ audit log records NOTIVISA_SUBMISSION_INITIATED event
  ✓ RT receives confirmation email (gov API response or mock)
  ✓ Dashboard shows "NOTIVISA pending" status
```

**Spec 2: Phase 9 — Documentation Versioning**
```
Given: QA lead uploads MQ v2.1 (Quality Manual) to SGQ
When: System creates new version + previous version soft-deleted
Then:
  ✓ MQ v2.1 marked as "active" in sgq-documentos collection
  ✓ MQ v2.0 marked as "archived" with deletadoEm timestamp
  ✓ Audit trail records DOC_VERSION_CREATED + DOC_SUPERSEDED events
  ✓ Dashboard shows version history (v2.0 → v2.1)
```

**Spec 3: Phase 10 — Multi-Equipment Analyte Validation**
```
Given: RT performs coagulation PT (Prothrombin Time) run on Instrument Y (not Yumizen)
When: RT enters result + selects "Instrument Y" from dropdown
Then:
  ✓ runs collection creates doc with instrumentId + method ref
  ✓ lot expiry checked vs. current date (auto-invalidate if expired)
  ✓ Levey-Jennings chart updates with new point (instrument-specific color)
  ✓ Lot expiry alert fires if <7 days remaining
```

**Spec 4: Phase 11 — IA Strip Classification**
```
Given: RT uploads Immunology (HIV) strip image via /imuno-ias-dev
When: Gemini Vision API classifies image (positive/negative/invalid)
Then:
  ✓ Confidence score returned; if <0.85 → flagged "pending RT review"
  ✓ IA result displayed with badge "IA-assisted — RT must validate"
  ✓ RT can click "Override" to enter manual result (overrides IA)
  ✓ Confusion matrix logged (for Phase 11 Week 3 accuracy check)
```

### 8.2 Pre-Deploy Smoke Suite (Run after each phase deploy)

```bash
# Phase 8 deploy checklist
npm run test:e2e -- --grep "NOTIVISA"
npm run test:rules -- notivisa-outbox
firebase deploy --only functions:notivisaPayloadBuilder

# Phase 9 deploy checklist
npm run test:e2e -- --grep "DocumentVersioning"
npm run test:rules -- sgq-documentos
firebase deploy --only functions:documentVersionManager

# Phase 10 deploy checklist
npm run test:e2e -- --grep "MultiEquipmentCIQ"
npm run test:rules -- runs,lots
firebase deploy --only functions:multiInstrumentRunner

# Phase 11 deploy checklist
npm run test:e2e -- --grep "IAStripClassification"
npm run test:rules -- imuno-ias-dev
firebase deploy --only functions:geminiVisionClassifier
```

---

## 9. RESOURCE PLAN + CAPACITY CONSTRAINTS

### 9.1 FTE Allocation (Weeks 9–15, 7 weeks)

| Stream | Role | Weeks 9–10 | Weeks 11–12 | Weeks 13–14 | Week 15 | Total FTE |
|--------|------|-----------|------------|------------|---------|-----------|
| **A** | NOTIVISA backend | 1.0 | 0.3 | 0 | 0 | 1.3 |
| **A** | Docs + QA | 1.5 | 1.5 | 0.5 | 0 | 3.5 |
| **A** | CTO oversight | 0.5 | 0.3 | 0.3 | 0.2 | 1.3 |
| **B** | CIQ frontend | 1.0 | 1.5 | 0.3 | 0 | 2.8 |
| **B** | CIQ backend | 1.0 | 1.0 | 0.2 | 0 | 2.2 |
| **B** | QA + testing | 0.5 | 0.5 | 0.2 | 0 | 1.2 |
| **C** | IA lead | 0.2 | 1.0 | 1.0 | 0.5 | 2.7 |
| **C** | IA backend | 0.3 | 1.0 | 1.0 | 0.5 | 2.8 |
| **D** | DevOps (continuous) | 0.5 | 0.5 | 0.5 | 0.5 | 2.0 |
| **TOTAL FTE** | | 6.5 | 7.6 | 4.0 | 1.7 | **19.8 FTE-weeks** |
| **Avg FTE/week** | | 6.5 | 7.6 | 4.0 | 1.7 | **2.8 FTE avg** |

### 9.2 Capacity Constraints + Mitigation

**Constraint 1: Stream A — Small team handling 2 parallel phases (8 + 9)**
- **Issue:** 1 backend eng + 1.5 QA eng across NOTIVISA + docs
- **Mitigation:** Phase 8 backend disengages Week 11 (moves to Stream A monitoring role); Phase 9 QA peaks Weeks 9–11, tapers Week 12
- **Contingency:** Stream D engineer can backfill Phase 8 backend Week 11+ if needed

**Constraint 2: Phase 10 ↔ 11 Resource Overlap (Week 12)**
- **Issue:** Phase 10 backend wrapping up; Phase 11 backend ramping up; only 1 backend eng available for dataset pipeline
- **Mitigation:** Pre-stage dataset pipeline Week 11 (no Phase 10 dependency); Phase 11 backend activates Day 35
- **Contingency:** If Phase 10 slips into Week 12 tail, swap eng from Stream A temporarily

**Constraint 3: Peak FTE (Week 12 = 7.6 FTE) vs. Staffing**
- **Issue:** 7.6 FTE required; team cap ~6 dedicated engineers + CTO + DevOps = 8 total
- **Reality:** Acceptable utilization; 1 engineer is CTO partial; DevOps is continuous (0.5 FTE)
- **Contingency:** If engineer unavailable, drop Phase 11 feature priority (IA dataset collection continues, analysis deferred to v1.5)

---

## 10. SUCCESS CRITERIA + GO/NO-GO GATES

### 10.1 Phase 8 Exit Gate (End Week 10, Day 35)

**Must-Have:**
- [ ] NOTIVISA payload builder function deployed + sandbox tested (0 errors in mock submission)
- [ ] RT approval workflow live + audit trail captures approval signature
- [ ] `notivisa-outbox` collection has ≥5 successful test submissions
- [ ] Tests green: 5/5 Phase 8 E2E specs pass

**Should-Have:**
- [ ] NOTIVISA production API credentials ready (gov approval pending)
- [ ] Rate limiting respected (10 req/min verified in sandbox)

**Go/No-Go:** Phase 8 COMPLETE if Must-Haves met. Production NOTIVISA cutover deferred to Phase 14 staging.

---

### 10.2 Phase 9 Exit Gate (End Week 10, Day 24)

**Must-Have:**
- [ ] Quality Manual (MQ) v1.0 published to sgq-documentos + versioned
- [ ] Method Validation Procedures (Annex B) drafted + available to Phase 10
- [ ] DICQ Blocks A, D, E baseline coverage ≥70% (mapped to Phase 9 docs)
- [ ] Tests green: 5/5 Phase 9 E2E specs pass

**Should-Have:**
- [ ] Governance checklist (RDC 978 Art. 86 + DICQ 4.1) documented
- [ ] Auditor pre-review feedback incorporated (if available Week 10)

**Go/No-Go:** Phase 9 COMPLETE if Must-Haves met. Minor doc gaps defer to Phase 13 (5-day buffer in critical path).

---

### 10.3 Phase 10 Exit Gate (End Week 12, Day 38)

**Must-Have:**
- [ ] ≥3 instruments validated for coagulation (coag module multi-instrument functional)
- [ ] 30 analytes expanded + tests passing (coag 10, imuno 12, uro 8)
- [ ] Lot expiry enforcement live + auto-invalidation tested
- [ ] Bundle size measurement captured for Phase 12 baseline (target: <390 KB gzip)
- [ ] Tests green: 5/5 Phase 10 E2E specs pass
- [ ] ≥500 analyte images collected (for Phase 11 training dataset)

**Should-Have:**
- [ ] Equipment partnership documentation (vendor, method, quality specs) archived in SGQ
- [ ] Levey-Jennings multi-instrument visualization finalized

**Go/No-Go:** Phase 10 COMPLETE if Must-Haves met. Bundle size >390 KB triggers Phase 12 performance review.

---

### 10.4 Phase 11 Exit Gate (End Week 14, Day 49)

**Must-Have:**
- [ ] Gemini 2.5 Flash integration deployed + confidence threshold 0.85 enforced
- [ ] RT manual override always available (never locked to IA result)
- [ ] ≥500 labeled images collected + validated (confusion matrix calculated)
- [ ] Accuracy baseline documented: ≥85% accuracy OR <5% false negatives on critical diseases
- [ ] Tests green: 5/5 Phase 11 E2E specs pass
- [ ] Monthly accuracy check scheduled (every 30d starting Day 49)

**Should-Have:**
- [ ] Accuracy dashboard deployed (confusion matrix visualization)
- [ ] Cost tracking shows Gemini spend within budget ($200–500 range for 500 images)

**Go/No-Go:** Phase 11 COMPLETE if Must-Haves met. Accuracy <85% triggers contingency (disable Gemini, revert to manual).

---

### 10.5 Wave 3 Final Gate (End Week 15, Day 49)

**All 4 phases COMPLETE:** Phases 8, 9, 10, 11 exit gates passed
- [ ] Phase 8: NOTIVISA sandbox functional (prod cutover Week 14–15)
- [ ] Phase 9: Documentation baseline for Phase 13 audit
- [ ] Phase 10: Multi-equipment validated; bundle size measured for Phase 12
- [ ] Phase 11: IA dataset ready; accuracy baseline established
- [ ] Cross-phase integration: all dependencies satisfied (analyte codes aligned, method docs available, image pipeline flowing)

**Phase 12 Readiness:** Performance audit can proceed with Phase 10 bundle size baseline

**Resource Release:** Streams A, B, C available for Phase 12 (perf audit) and Phase 13 (final DICQ audit) by Day 50+

---

## 11. HANDOFF ARTIFACTS (End of Wave 3)

### 11.1 Phase 8 Deliverables

- `PHASE_8_COMPLETION_REPORT.md` (NOTIVISA sandbox signed off, RT gate tested, ready for prod cutover)
- `notivisa-outbox` collection (5+ test entries; staging verified)
- `notivisaPayloadBuilder()` function (callable, rules updated)
- Audit trail events (NOTIVISA_SUBMISSION_INITIATED, NOTIVISA_RT_APPROVAL)
- Test suite: 5/5 specs + manual sandbox verification checklist

### 11.2 Phase 9 Deliverables

- `PHASE_9_COMPLETION_REPORT.md` (MQ v1.0, Annex B methods, governance checklist)
- Quality Manual (MQ v1.0) + appendices (versioned in sgq-documentos)
- Method Validation Procedures (Annex B) + per-analyte specs
- Governance Checklist (RDC 978 Art. 86 + DICQ 4.1 mapping)
- Test suite: 5/5 specs + auditor sign-off confirmation (if pre-review completed)

### 11.3 Phase 10 Deliverables

- `PHASE_10_COMPLETION_REPORT.md` (30 analytes, ≥3 instruments, lot expiry, bundle size)
- 30 analyte definitions (code, reference range, Westgard rules per instrument)
- Equipment partnership documentation (archived in SGQ)
- Multi-instrument test runs (50+ runs across 3+ instruments for validation)
- Bundle size baseline (`vite-bundle-analyzer` output, <390 KB gzip confirmation)
- 500+ analyte images (for Phase 11 dataset)
- Test suite: 5/5 specs + manual multi-instrument validation checklist

### 11.4 Phase 11 Deliverables

- `PHASE_11_COMPLETION_REPORT.md` (Gemini integration, 500+ images, accuracy ≥85%)
- Accuracy dashboard (confusion matrix, false-negative tracking, monthly review schedule)
- 500+ labeled images (ground truth from Phase 10 + Gemini predictions)
- Gemini integration code (callable function + confidence threshold enforcement)
- RT override UI (always available, tested)
- Monthly accuracy check procedure (documented; automation scheduled)
- Test suite: 5/5 specs + Gemini API cost verification

---

## 12. CONCLUSION

**Wave 3 Parallelization Summary:**

- **4 streams (A/B/C/D) execute simultaneously:** Weeks 9–15 (7 weeks)
- **Critical path:** Phase 10 (multi-equipment CIQ) feeds Phase 12 performance baseline
- **Non-critical slack:** Phases 8, 9, 11 each have 15–30 day buffer
- **Resource peak:** Week 12 (7.6 FTE, manageable within 8-person team)
- **Integration points:** Well-defined (analyte codes, method docs, image pipeline, governance alignment)
- **Risk profile:** Medium (RISK-406, 402, 411, 413, 418 are top 5; all have active mitigations)
- **Parallelization factor:** 1.57x (55d serial → 35d parallel, 20-day gain)
- **Staging readiness:** Full checklist provided (infrastructure, requirements, resources, communication)

**All phases deliver on time for Phase 12 (performance audit) and Phase 13 (final DICQ audit) gates. v1.4 launch (Phase 15, Week 19–20) remains on track for Sept 30, 2026 target.**

---

**Document Control**

| Field | Value |
|-------|-------|
| **Version** | 1.0 (2026-05-07) |
| **Status** | AUTHORITATIVE — ready for execution |
| **Owner** | CTO + 4 Stream Leads |
| **Review Cadence** | Weekly (Fridays 14:00 BRT, with v1.4-RISK-REGISTER.md) |
| **Next Review** | 2026-05-14 (start of Week 1 / Phase 0) |
| **Approval Gate** | CTO sign-off before Phase 0 kickoff (Day 1, 2026-05-13) |

---

**End of WAVE_3_PARALLELIZATION_ANALYSIS.md**
