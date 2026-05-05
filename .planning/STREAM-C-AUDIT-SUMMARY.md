---
stream: C
phase: 2
title: Batch 1/2 Hardening & Performance Audit
status: PARTIAL
assessed_date: "2026-05-05"
phases_complete:
  - CI infrastructure (Lighthouse CI workflow + config)
phases_partial:
  - Phase 3 (Firestore indexing — partial, existing indexes don't include all Stream C targets)
phases_not_started:
  - Phase 1 (Bundle & Build Analysis — process task, no artifacts expected)
  - Phase 2 (Runtime Performance baseline — process task, no artifacts expected)
  - Phase 4 (Monitoring & Alerts)
  - Phase 5 (Documentation & Optimization Patterns)
artifacts_present:
  - .github/workflows/lighthouse-ci.yml
  - lighthouserc.js
artifacts_missing:
  - docs/PERFORMANCE_PATTERNS.md
  - .claude/rules/performance.md
---

# Stream C: Live Module Audit + Optimization — Summary

**One-liner:** CI/infrastructure skeleton delivered (Lighthouse CI workflow + config), but runtime profiling, monitoring setup, and pattern documentation are not started. Stream C is structurally blocked on human-execution steps (Phases 1-2) and two concrete artifacts remain undelivered (Phases 4-5).

---

## What Was Found

### Infrastructure Deliverables (Present)

**`.github/workflows/lighthouse-ci.yml`** — EXISTS  
Runs on push to main, scheduled weekly (Mondays 08:00 UTC), and on workflow_dispatch.  
Steps: checkout → Node 20 → npm ci → build → `@lhci/cli@0.14.x autorun` → upload artifact (retention 30 days).  
Uses `LHCI_GITHUB_APP_TOKEN` secret for GitHub App integration.

**`lighthouserc.js`** — EXISTS  
Targets production URL `https://hmatologia2.web.app` with 3 runs.  
Assert thresholds configured:
- Performance ≥ 0.85 (warn)
- Accessibility ≥ 0.9 (warn)
- FCP ≤ 2,000ms, LCP ≤ 2,500ms, TBT ≤ 300ms, CLS ≤ 0.1 (all warn)

**Firestore indexes (partial)** — EXISTS IN `firestore.indexes.json`  
Stream C specified 5 required composite indexes. Current `firestore.indexes.json` has:
- `naoConformidades (labId + dataAbertura DESC)` — present (covers NC query)
- `treinamentos (ativo + titulo)` — present but missing `operadorId + data DESC` pattern
- Missing: `pops (labId + deletadoEm + criadoEm DESC)`
- Missing: `auditorias (labId + criadoEm DESC)` — collection name unclear
- Missing: `biosseguranca-inspecoes (areaId + data DESC)`
- `analytics-aggregates` and `export-jobs` indexes present (from Phase 3.1)

### Process Phases (Not Codified — Expected)

**Phase 1 (Bundle & Build Analysis):** Checklist of manual tasks — no file artifact expected. The plan identifies `xlsx` static/dynamic conflict and `pdf.worker` lazy-loading as the top targets. No evidence these fixes were applied. Bundle target is <800 KB gzip; current baseline is 1,043 KB gzip (as stated in plan).

**Phase 2 (Runtime Performance):** Manual profiling steps — no file artifact expected. Web Vitals targets (LCP <2.5s, INP <200ms, CLS <0.1) are encoded in `lighthouserc.js` but no profiling results or React optimization commits are recorded.

### Missing Artifacts

**`docs/PERFORMANCE_PATTERNS.md`** — NOT CREATED  
Plan Phase 5.1 specifies this document to record: query patterns needing indexes, common bottlenecks, optimization recipes, Web Vitals targets per page type.

**`.claude/rules/performance.md`** — NOT CREATED  
Plan Phase 5.2 specifies this rule file to enforce: query patterns, component memo guidelines, bundle size targets per feature, Web Vitals gates before deploy.

**Firebase Performance Monitoring custom traces** — NOT VERIFIED  
Plan Phase 4.1 specifies custom traces (`pops_list_load`, `nc_open_dialog`, `audit_checklist_render`) and alert thresholds. No evidence of implementation.

---

## Status by Phase

| Phase | Deliverable | Status | Evidence |
|-------|-------------|--------|----------|
| CI Infrastructure | lighthouse-ci.yml + lighthouserc.js | COMPLETE | Files exist with correct thresholds |
| Phase 1 — Bundle Analysis | Identify + fix xlsx/pdf.worker conflicts | NOT STARTED | No bundle fix commits found |
| Phase 2 — Web Vitals Baseline | Profiling + React optimization | NOT STARTED | No profiling artifacts |
| Phase 3 — Firestore Indexing | 5 composite indexes created | PARTIAL | 1-2 of 5 Stream C indexes present |
| Phase 4 — Monitoring & Alerts | Firebase Perf Monitoring + custom traces | NOT STARTED | No implementation evidence |
| Phase 5 — Pattern Docs | PERFORMANCE_PATTERNS.md + performance.md rule | NOT STARTED | Files do not exist |

---

## What Remains for Stream C Completion

### Concrete File Deliverables (Claude can create)
1. `docs/PERFORMANCE_PATTERNS.md` — document known bottlenecks, query patterns, optimization recipes
2. `.claude/rules/performance.md` — enforced rule file for future module development
3. Missing Firestore indexes in `firestore.indexes.json`:
   - `pops (labId + deletadoEm + criadoEm DESC)`
   - `auditorias (labId + criadoEm DESC)`
   - `biosseguranca-inspecoes (areaId + data DESC)`
   - `treinamentos (labId + operadorId + data DESC)` (current index missing operadorId)

### Human-Execute Steps (Require Runtime Access)
- Bundle profiling + `xlsx`/`pdf.worker` optimization (requires build + DevTools measurement)
- Firebase Performance Monitoring custom traces setup (requires Firebase Console + SDK instrumentation)
- Alert threshold configuration (requires Firebase Console)
- React DevTools Profiler sessions for each module

### Lighthouse CI Gate
The `lighthouserc.js` uses `warn` (not `error`) for all assertions — so the CI does not currently block deploys on performance regression. Per Stream C success criteria, this should be a hard gate. Consider changing `warn` → `error` for LCP and Performance score once a baseline run passes.

---

## Risk Assessment

Stream C is a 6-week audit plan created 2026-05-05 and marked `in-progress`. Given that Phase 3.2 and 3.3 are now complete (per STATE.md), Stream C optimization work was likely deprioritized in favor of feature delivery. The Lighthouse CI workflow running weekly provides ongoing visibility, but without the pattern docs and monitoring setup, regressions may go undetected.

The two highest-impact gaps:
1. **`xlsx` static/dynamic conflict** — both `educacao-continuada` and `controle-temperatura` import xlsx; if one uses dynamic import and one uses static, the bundle pays twice (~500KB gzip). This is the single largest bundle reduction opportunity.
2. **Missing `.claude/rules/performance.md`** — without an enforced rule, new modules (Phase 3.x) may repeat patterns that Stream C was meant to prevent.

---

**Assessed:** 2026-05-05  
**Plan created:** 2026-05-05  
**Target completion:** 2026-06-14  
**Current status:** PARTIAL — CI gates operational, pattern docs and monitoring not delivered
