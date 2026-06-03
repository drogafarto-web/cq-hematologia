# Phase 12 — Performance Audit & Web Vitals Compliance (Index)

**Status:** Planning Complete  
**Kickoff:** 2026-05-20  
**Duration:** 1.5 weeks (May 20 → Jun 2)  
**Target Deploy:** 2026-06-02

---

## Documents in This Phase

### Core Planning

1. **[PHASE_12_DETAILED_PLAN.md](./PHASE_12_DETAILED_PLAN.md)** — Master plan (7 sections, 50 pages)
   - Web Vitals enforcement & targets
   - Bundle analysis & optimization
   - Runtime optimization (4 critical journeys)
   - Lighthouse CI setup & gates
   - Mobile/tablet optimization
   - Database query optimization
   - Weekly baseline monitoring
   - Success metrics & sign-off template

2. **[../../../docs/PHASE_12_MONITORING_RUNBOOK.md](../../../docs/PHASE_12_MONITORING_RUNBOOK.md)** — Operations guide
   - Weekly baseline monitoring setup (GitHub Actions)
   - Google Sheets dashboard (optional)
   - Operating the system (weekly review checklist)
   - Troubleshooting playbook
   - Metric interpretation
   - Regression investigation
   - Maintenance schedule

### Supporting Artifacts

3. **[../../../docs/PERFORMANCE_PATTERNS.md](../../../docs/PERFORMANCE_PATTERNS.md)** — Established patterns (v1.3)
   - Route code-splitting (React.lazy + Suspense)
   - Firestore listener cleanup
   - Lazy-loading best practices
   - Web Vitals targets

4. **[../../../docs/PERFORMANCE_BASELINE_2026-05.md](../../../docs/PERFORMANCE_BASELINE_2026-05.md)** — v1.3 Baseline
   - Current metrics (all routes passing)
   - Per-route analysis (/hub, /analytics, /export)
   - Optimization opportunities identified

5. **[../../../docs/STREAM-C-BUNDLE-ANALYSIS.md](../../../docs/STREAM-C-BUNDLE-ANALYSIS.md)** — Bundle breakdown
   - Current chunk breakdown (vendor-_, module-_)
   - Bundle visualizer setup
   - Known heavy dependencies
   - Code-splitting strategy

### Utilities & Scripts

6. **[../../../scripts/extract-bundle-stats.js](../../../scripts/extract-bundle-stats.js)** — Bundle stats extraction
   - Parses `dist/stats.json` (Rollup Visualizer output)
   - Outputs JSON or CSV for baseline tracking
   - Used in automated weekly runs

7. **[../../../scripts/firestore-latency-baseline.sh](../../../scripts/firestore-latency-baseline.sh)** — Firestore perf capture
   - Fetches 24h Firestore logs from Cloud Logging
   - Computes p50/p95/p99 latency percentiles
   - Outputs analysis JSON for baseline tracking

8. **[../../../src/utils/firestoreQueryProfiler.ts](../../../src/utils/firestoreQueryProfiler.ts)** — Runtime query profiler
   - Lightweight debugging utility
   - Tracks query operations and latency
   - Warns on slow queries (>500ms)
   - Can be enabled with `DEBUG_FIRESTORE=true`

### Related Documentation

9. **[../../../lighthouserc.js](../../../lighthouserc.js)** — Lighthouse CI config
   - Web Vitals assertion thresholds
   - Performance score gates
   - Multi-URL audit setup

10. **[../../../.github/workflows/lighthouse-ci.yml](../.github/workflows/lighthouse-ci.yml)** — GitHub Actions workflow
    - Runs on push to main + weekly Monday 08:00 UTC
    - Triggers `@lhci/cli` against static dist/
    - Uploads report to temporary storage

11. **[../../../vite.config.ts](../../../vite.config.ts)** (excerpt) — Bundle configuration
    - Manual chunk splits (vendor-_, module-_)
    - PWA service worker config
    - Bundle visualizer setup (ANALYZE=true)
    - Chunk size warning limits

---

## Phase 12 at a Glance

### Objectives

1. Enforce Web Vitals targets (LCP <2.0s, INP <200ms, CLS <0.05)
2. Keep bundle size ≤400 KB main shell, ≤150 KB per module
3. Optimize critical journeys (laudo form <1.5s, CIQ run <1.2s, Levey-Jennings <500ms)
4. Establish Lighthouse CI gates (pre-merge + post-merge)
5. Optimize for mobile/tablet (48×48px targets, orientation handling)
6. Audit Firestore queries (N+1 detection, p99 <500ms)
7. Set up weekly baseline monitoring (Google Sheets + GitHub Actions)

### Success Criteria

- ✅ All critical routes meet Web Vitals targets
- ✅ Bundle size stays within limits (verified via `npm run analyze`)
- ✅ Lighthouse CI gates active and passing (performance ≥0.85)
- ✅ No N+1 queries in critical paths
- ✅ Mobile/tablet optimization complete
- ✅ Weekly baseline monitoring live (Monday 08:00 UTC)
- ✅ Zero regressions from v1.3 (738/738 tests)

### Key Metrics

| Metric                 | Target | Hard Limit |
| ---------------------- | ------ | ---------- |
| LCP (desktop)          | <2.0s  | 2.5s       |
| LCP (mobile)           | <2.0s  | 2.5s       |
| INP                    | <200ms | —          |
| CLS                    | <0.05  | 0.1        |
| TBT                    | <200ms | 300ms      |
| Bundle (main)          | 362 KB | 400 KB     |
| Bundle (total)         | 850 KB | —          |
| Lighthouse Performance | ≥0.85  | —          |
| Firestore p99          | <500ms | —          |

### Task Breakdown (4 Parallel Tracks)

**Track 1: Bundle & Lighthouse** (Agent 1, ~3 days)

- Audit bundle sizes
- Update lighthouserc.js thresholds
- Extend GitHub Actions (multi-URL)
- Document pre-merge checklist

**Track 2: Runtime Optimization** (Agent 2, ~4 days)

- Profile laudo form (skeleton + prefetch)
- Profile CIQ run form (schema lazy-load)
- Profile Levey-Jennings (memoization)
- Profile PDF export (warmth + streaming)
- Implement fastest wins

**Track 3: Database & Mobile** (Agent 3, ~3 days)

- N+1 query audit
- Firestore p99 baseline capture
- Touch target audit
- Orientation testing
- Slow network testing

**Track 4: Monitoring & Gates** (Agent 4, ~2 days)

- Weekly baseline monitoring script
- Google Sheets dashboard
- Regression detection
- Monitoring runbook
- End-to-end test

---

## Pre-Phase 12 Checklist (Phase 11 dependencies)

Before Phase 12 kickoff on 2026-05-20:

- [ ] v1.3 all 35 modules live and stable (DICQ 78.5%)
- [ ] Baseline metrics captured (v1.3 Performance Baseline doc)
- [ ] Lighthouse CI workflow running and passing
- [ ] Bundle visualizer working (`npm run analyze` generates `dist/stats.html`)
- [ ] Unit test suite stable (738/738 passing)
- [ ] Smoke test suite executed (19/19 flows)
- [ ] Cloud Logs monitoring active (24h baseline for Firestore metrics)

---

## Post-Phase 12 Expectations (Phase 4 Dependencies)

After Phase 12 deploy on 2026-06-02:

✅ Lighthouse CI gates enforced on all PRs (pre-merge)
✅ Weekly baseline monitoring active (Monday runs)
✅ Performance regressions detected automatically (GitHub Actions)
✅ Mobile/tablet responsive confirmed (DevTools audit)
✅ Firestore query audit clean (N+1 free)
✅ All v1.4 Phase 4 routes (Portal Auth) pre-audited for Web Vitals

Phase 4 (Portal Auth + NOTIVISA, 2026-05-20 start) will inherit:

- Performance testing procedures
- Bundle size guardrails
- Lighthouse CI gates
- Mobile optimization checklist
- Weekly monitoring (continues)

---

## Quick Links

- **Kick Off:** May 20, 2026
- **Deploy:** June 2, 2026
- **Planning:** Complete (this phase)
- **Next Phase:** Phase 4 (Portal Auth, May 20 start, May 20 → Jun 2)
- **Milestone:** v1.4 Wave 1 (Phases 4–7)
- **Final Target:** v1.4 complete Aug 31, 2026 (before external audit)

---

**Phase Owner:** CTO (Performance Lead)  
**Coordination:** Architecture Review Board  
**Stakeholders:** DevOps, Engineers, QA, Release Lead  
**Created:** 2026-05-07  
**Status:** Ready for Phase 4 Integration Planning
