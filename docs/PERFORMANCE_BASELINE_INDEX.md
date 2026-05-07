# Performance Baseline Index — HC Quality v1.3 → v1.4

**Updated:** 2026-05-07  
**Owner:** Performance Team  
**Phase:** 12 — Performance Optimization  

---

## Overview

This index tracks performance baseline captures across HC Quality versions. Each baseline serves as a quantified reference point for regression detection and optimization tracking.

### Why Baselines Matter

- **Regression Detection:** Catches performance regressions >10% via automated CI
- **Optimization Proof:** Measures actual improvement from Phase 12 work
- **Audit Trail:** Demonstrates performance discipline over time
- **SLA Compliance:** Validates targets align with regulatory requirements (RDC 978)

---

## Version History

### v1.3 Baseline — 2026-05-06 (Initial Capture)

**Status:** Baseline Established  
**Document:** [`docs/PERFORMANCE_BASELINE_2026-05.md`](./PERFORMANCE_BASELINE_2026-05.md)

**Metrics Captured:**
- Lighthouse CI on 5 critical routes (desktop + mobile)
- Real User Monitoring via CrUX API (28-day aggregate)
- Bundle size breakdown (gzip + brotli)
- Firestore query latency (p50/p95/p99)
- PDF export timing (50-page generation)

**Key Findings:**
- All Web Vitals within target thresholds
- Main shell: 362 KB gzip (target: <400 KB) ✓
- LCP: 1.8s desktop / 2.1s mobile ✓
- PDF export: 2.4s average (acceptable for 50 pages)

---

### v1.4 Baseline — 2026-05-07 (Phase 12 Starting Point)

**Status:** Capture Instructions Ready  
**Document:** [`docs/v1.4_PERFORMANCE_BASELINE_CAPTURE.md`](./v1.4_PERFORMANCE_BASELINE_CAPTURE.md) ← **START HERE**

**Steps to Execute Today:**

1. **Lighthouse CI on 5 routes** (desktop + mobile profiles)
   - `/hub` — Dashboard entry point
   - `/features/bioquimica` — Quantitative CIQ
   - `/features/analytics` — Charting heavy
   - `/features/export` — Export wizard
   - `/portal` — Medical portal

2. **Real User Monitoring (RUM) — 24h snapshot**
   - CrUX API or Sentry Real User Monitoring
   - p50/p75/p90 Web Vitals from production traffic

3. **Bundle size snapshot**
   - Run `npm run build`
   - Extract gzip + brotli sizes per chunk
   - Main shell + lazy features

4. **Firestore query latency (24h Cloud Logs)**
   - p50/p95/p99 latency via `gcloud logging read`
   - Sample 5000+ operations

5. **PDF export timing test**
   - 50-page generation, 10 runs
   - Average TTI: ~2.4s expected

6. **Tablet/mobile TTI test**
   - Lighthouse mobile profile + real device (optional)
   - Validate 3.5s TTI on mid-range devices

**Automated Execution (Recommended):**

```bash
# macOS/Linux
bash scripts/capture-v14-baseline.sh

# Windows PowerShell
.\scripts\capture-v14-baseline.ps1

# Node.js helper to merge outputs
node scripts/generate-v14-baseline.mjs --dir ./baselines
```

**Expected Output:**
```
v1.4_BASELINE.json
├── web_vitals (Lighthouse + CrUX)
├── bundle (size breakdown)
├── backend (Firestore latency + PDF timing)
├── mobile (TTI testing)
└── regression_thresholds (alert criteria)
```

---

## Baseline File Structure

### Core Baseline Files

| File | Purpose | Updated |
|------|---------|---------|
| `PERFORMANCE_BASELINE_2026-05.md` | v1.3 reference baseline | 2026-05-06 |
| `v1.4_PERFORMANCE_BASELINE_CAPTURE.md` | Step-by-step capture guide | **2026-05-07** |
| `PERFORMANCE_BASELINE_INDEX.md` | This index | **2026-05-07** |
| `v1.4_BASELINE.json` | Consolidated v1.4 metrics (auto-generated) | — |

### Supporting Documentation

| File | Purpose |
|------|---------|
| `PERFORMANCE_PATTERNS.md` | Architecture patterns for optimization |
| `PERFORMANCE_MONITORING_GUIDE.md` | Production monitoring setup |
| `.claude/rules/performance.md` | Code-level performance rules |
| `.github/workflows/lighthouse-ci.yml` | Automated Lighthouse CI pipeline |

### Raw Measurement Files (in `docs/baselines/`)

```
baselines/
├── baseline-lighthouse-2026-05-07.json     # Lighthouse CI results
├── baseline-crux-2026-05-07.json           # CrUX Real User Monitoring
├── baseline-bundle-2026-05-07.json         # Bundle size breakdown
├── baseline-firestore-latency-2026-05-07.json  # Cloud Logs p-percentiles
├── baseline-pdf-export-2026-05-07.json     # PDF generation timing
└── baseline-mobile-tti-2026-05-07.json     # Mobile device testing
```

---

## Regression Thresholds

| Metric | Alert Threshold | Hard Limit | Action |
|--------|-----------------|-----------|--------|
| **LCP** | >10% increase | 2.5s | Block merge if exceeded |
| **INP** | >15% increase | 200ms | Block merge if exceeded |
| **CLS** | >20% increase | 0.1 | Block merge if exceeded |
| **Bundle (gzip)** | >8% increase | 400KB main shell | Review before merge |
| **Firestore p99** | >20% increase | 500ms | Investigate query inefficiency |
| **PDF export TTI** | >15% increase | 3.0s | Block Cloud Function deploy |

**Enforcement:** Lighthouse CI automatically blocks PRs that exceed thresholds. Manual approval required for exceptions.

---

## Phase 12 Optimization Targets

Once v1.4 baseline is captured, Phase 12 work will focus on:

### Performance Goals

| Metric | v1.3 Baseline | v1.4 Target | Improvement |
|--------|---------------|-------------|-------------|
| LCP (desktop) | 1.8s | <1.5s | -16.7% |
| LCP (mobile) | 2.1s | <1.8s | -14.3% |
| Main shell (gzip) | 362 KB | <320 KB | -11.6% |
| Bundle total (gzip) | 1,456 KB | <1,400 KB | -3.8% |
| Firestore p99 | 245ms | <200ms | -18.4% |
| PDF export (50pp) | 2.4s | <2.1s | -12.5% |

### Optimization Initiatives

**Code-Level:**
- Tree-shake unused Firebase modules
- Lazy-load `recharts` (charting library)
- Code-split analytics route (already done, verify)
- Defer non-critical CSS

**Caching:**
- Extend service worker cache TTL (PWA optimization)
- Add `stale-while-revalidate` for static assets
- Cache Firestore query results (Zustand + IndexedDB)

**Network:**
- Enable Brotli compression (Firebase Hosting)
- Pre-connect to Firebase domain
- Reduce Firestore query round-trips (batch reads)

**Backend:**
- Index composite Firestore queries
- Add Cloud Function memory bump (512MB → 1GB)
- Optimize PDF generation pipeline (parallel page rendering)

---

## How to Compare v1.3 → v1.4

### Method 1: Manual Comparison

```bash
# 1. Generate v1.4 baseline (after optimizations complete)
node scripts/generate-v14-baseline.mjs --dir ./baselines

# 2. Compare metrics manually
cat v1.4_BASELINE.json | jq '.web_vitals.lighthouse.metrics'

# 3. Calculate improvements
# Example: v1.3 LCP 1.8s → v1.4 LCP 1.5s = 16.7% improvement
```

### Method 2: Automated Report

```bash
# (To be implemented in Phase 12)
npm run generate-performance-report -- \
  --baseline ./docs/baselines/baseline-lighthouse-2026-05-06.json \
  --current ./v1.4_BASELINE.json \
  --output ./PHASE_12_PERFORMANCE_REPORT.md
```

---

## Monitoring in Production

### Real User Monitoring (RUM)

**Active Services:**
- Sentry: `https://labclin.sentry.io/projects/javascript-react/`
- Firebase Performance: `https://console.firebase.google.com/project/hmatologia2/performance`
- CrUX API: `https://chromeuxreport.googleapis.com/`

**Alert Conditions:**
- LCP degrades >15% month-over-month → page speed alert
- INP > 200ms for >5% of users → interaction slowdown alert
- Firestore reads > p99 baseline → query optimization needed

### Cloud Logs Monitoring

```bash
# Active monitoring via Cloud Logs (see CLOUD_LOGS_MONITORING_GUIDE.md)
bash scripts/monitor-cloud-logs.sh 24 30
```

Monitors for:
- Function latency > 5s
- Firestore quota exceeded
- PDF generation errors

---

## Checklist: Baseline Capture (Today)

- [ ] Build production bundle (`npm run build`)
- [ ] Run Lighthouse CI on 5 routes
  - [ ] Desktop profile
  - [ ] Mobile profile
  - [ ] 3 runs per route (average)
- [ ] Query CrUX API for real user data (28-day aggregate)
- [ ] Extract bundle size metrics (gzip + brotli)
- [ ] Sample Firestore latency from Cloud Logs (24h, 5000+ ops)
- [ ] Test PDF export timing (10 runs, 50 pages each)
- [ ] Mobile device TTI test (optional but recommended)
- [ ] Run `node scripts/generate-v14-baseline.mjs` to consolidate
- [ ] Commit to git: `git add v1.4_BASELINE.json && git commit -m "..."`

---

## FAQ

### Q: Why capture v1.3 baseline before v1.4 optimizations?

**A:** Establishes honest starting metrics without knowledge of what to optimize. Prevents "moving goalposts." Enables scientific proof of Phase 12 impact.

### Q: What if Lighthouse CI is not set up?

**A:** Follow **Step 1c (Manual Audit)** in `v1.4_PERFORMANCE_BASELINE_CAPTURE.md`. Run locally via `vite preview` + `lighthouse` CLI.

### Q: Can I skip PDF export or mobile TTI testing?

**A:** Optional but recommended. PDF export is production-critical (users rely on it daily). Mobile TTI validates tablet responsiveness (ISO 15189 compliance).

### Q: How do we handle variance in measurements?

**A:** Lighthouse runs **3 times per route** and averages. Cloud Logs samples 5,000+ operations. PDF export runs 10 times. Regression thresholds (10-20%) account for natural variance.

### Q: What happens if v1.4 performs worse?

**A:** Investigate before shipping. Common causes:
- New dependency added (check bundle size)
- Firebase query unindexed (check Cloud Logs)
- CSS/JavaScript not minified (check build config)
- Service Worker cache miss (check PWA precache list)

---

## Contacts & Escalation

| Role | Responsibility | Contact |
|------|-----------------|---------|
| **Performance Owner** | Baseline capture, Phase 12 planning | CTO |
| **Frontend Lead** | Bundle size, code-level optimization | Frontend Team |
| **Backend Lead** | Firestore optimization, Cloud Functions | Backend Team |
| **DevOps Lead** | Infrastructure, caching, CDN | DevOps Team |

---

## Related Documentation

- **Global Rules:** `.claude/rules/performance.md`
- **Stack Reference:** `CLAUDE.md` (Performance section)
- **Obsidian (Strategic):** `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Roadmap.md`
- **Design System:** `DESIGN_SYSTEM.md` (typography, spacing optimization)

---

**Version:** 1.0  
**Last Updated:** 2026-05-07  
**Next Review:** After Phase 12 complete (2026-05-21 projected)
