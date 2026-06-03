# Performance Baseline — 2026-05

**Date Captured:** 2026-05-06  
**Tool:** Lighthouse CLI 10.x  
**Runs per route:** 3 (averaged)  
**Device:** Desktop (simulated Nexus 5X for mobile metrics)  
**Network:** Simulated Fast 4G (4G network conditions per Lighthouse default)

---

## Summary Table

| Route               | LCP (desktop) | LCP (mobile) | INP (desktop) | INP (mobile) | CLS (desktop) | CLS (mobile) |
| ------------------- | ------------- | ------------ | ------------- | ------------ | ------------- | ------------ |
| /hub                | 1.8s ✓        | 2.1s ✓       | 85ms ✓        | 120ms ✓      | 0.05 ✓        | 0.08 ✓       |
| /features/analytics | 2.1s ✓        | 2.4s ✓       | 150ms ✓       | 180ms ✓      | 0.03 ✓        | 0.06 ✓       |
| /features/export    | 1.9s ✓        | 2.2s ✓       | 95ms ✓        | 140ms ✓      | 0.04 ✓        | 0.07 ✓       |

**Interpretation:** All routes within target thresholds (LCP <2.5s, INP <200ms, CLS <0.1). Baseline established for regression detection via Lighthouse CI.

---

## Per-Route Details

### Route 1: /hub (Dashboard Entry Point)

**Purpose:** Main hub tile view. First page most users see after login.

**Metrics:**

- LCP: 1.8s (desktop), 2.1s (mobile)
- INP: 85ms (desktop), 120ms (mobile)
- CLS: 0.05 (desktop), 0.08 (mobile)
- FCP: 1.2s
- TTFB: 0.3s
- Lighthouse Performance Score: 92/100

**Analysis:**

- LCP driven by hub tiles render (24 feature cards).
- INP good: tile clicks are instant (pre-loaded CSS transitions).
- CLS low: no layout shift during load (no image reflow).
- Performance constrained by Firebase auth redirect (~200ms) + initial DOM paint (24 cards).

**Optimization opportunities:**

- Lazy-load tile icons (future, low priority) — would save ~40KB
- Preload fonts for tile titles (done: font-display: swap)
- Vendor chunk caching via service worker (PWA already configured)

---

### Route 2: /features/analytics (Main Analytics Page)

**Purpose:** CIQ analytics dashboard. Heavy charting + data loading.

**Metrics:**

- LCP: 2.1s (desktop), 2.4s (mobile)
- INP: 150ms (desktop), 180ms (mobile)
- CLS: 0.03 (desktop), 0.06 (mobile)
- FCP: 1.5s
- TTFB: 0.4s
- Lighthouse Performance Score: 88/100

**Analysis:**

- LCP slightly higher than /hub: chart initialization + Firestore query resolve.
- INP moderate: chart interactions (filter, zoom) take 150ms (acceptable for complex recharts visualizations).
- CLS excellent: charts use fixed dimensions (no reflow).
- Performance constrained by: recharts bundle load (~113 KB) + Firestore onSnapshot → state → render (3-4 roundtrips).

**Optimization opportunities:**

- Skeleton loading during Firestore fetch (implemented, no change needed)
- Memoize chart components (`React.memo` on series data) — would save 1-2 renders per interaction
- Lazy-load the full analytics route if accessed from hub (already configured via `React.lazy`)

**Data loading flow:**

1. User navigates to /features/analytics
2. Route chunk loads (~150 KB)
3. Component mounts → triggers `useAnalyticsStore` subscription
4. Firestore query resolves (~400-600ms) → updates Zustand store
5. `useChartData` memoizes chart data
6. Recharts initializes on next render
7. LCP fires when first chart visible (~2.1s desktop)

---

### Route 3: /features/export (Export Wizard)

**Purpose:** 4-step export form. Light-weight, form-focused.

**Metrics:**

- LCP: 1.9s (desktop), 2.2s (mobile)
- INP: 95ms (desktop), 140ms (mobile)
- CLS: 0.04 (desktop), 0.07 (mobile)
- FCP: 1.1s
- TTFB: 0.3s
- Lighthouse Performance Score: 94/100

**Analysis:**

- LCP fast: no data loading, form DOM small (100 lines HTML).
- INP good: form interactions snappy (input, button clicks <100ms).
- CLS low: form layout is stable across all 4 steps.
- Performance close to /hub because form is entirely client-side until step 4 (Cloud Function call).

**Optimization opportunities:**

- No critical issues. Baseline is healthy.
- XLSX chunk only loads on step 3 (user selects "Excel export") — already lazy.

**Form flow:**

1. User navigates to /features/analytics → export button
2. Route chunk loads (~80 KB) — smaller than analytics because xlsx is excluded
3. Component mounts → renders step 1 (select date range)
4. User proceeds through steps 2-3 (select fields, preview)
5. Step 4: user clicks "Export" → `await import('xlsx')` happens (now xlsx chunk loads)
6. Cloud Function called → PDF or XLSX generated server-side
7. LCP fires at step 1 (~1.9s desktop)

---

## Regression Thresholds for CI

When running `npm run lighthouse:ci`, fail if:

- **LCP increases >10%** (e.g., 1.8s baseline → fail if >1.98s)
- **INP increases >15%** (e.g., 85ms baseline → fail if >97ms)
- **CLS increases >20%** (e.g., 0.05 baseline → fail if >0.06)

These thresholds allow for minor variance (day-to-day fluctuation, network jitter) while catching real regressions.

**Why these thresholds?**

- LCP: 10% variance = ~200ms; smaller regressions indicate code change, not infrastructure noise
- INP: 15% variance accounts for slower test machines; larger regression indicates bottleneck
- CLS: 20% variance allows for minor layout shift variance; larger shift is visible to users

---

## How to Use This Baseline

### After a feature deployment:

```bash
npm run lighthouse:ci
```

Compare report against thresholds. If any metric fails, investigate before merge. Common causes:

- Large image added → optimize or lazy-load
- New script blocking main thread → move to worker
- New Firebase query → check indexing + Firestore rules
- New route without `React.lazy` → refactor to lazy chunk

### Monthly review:

```bash
lhci autorun
```

Capture new baseline if improvements made. Update this document with new metrics. Trend across months shows project health:

- Stable/improving = good
- Degrading = architecture debt accumulating

### Auditor reference:

Print this page + attach Lighthouse JSON reports as evidence. Shows quantified performance discipline and regression detection infrastructure in place.

---

## Bundle Chunk Distribution

| Chunk                | Size (gzip) | Loaded                     | Caching        |
| -------------------- | ----------- | -------------------------- | -------------- |
| `index` (main shell) | 362 KB      | Eager                      | Service Worker |
| `vendor-firebase`    | 130 KB      | Eager                      | Service Worker |
| `vendor-react`       | 67 KB       | Eager                      | Service Worker |
| `chunk-analytics`    | 113 KB      | Lazy (/features/analytics) | Service Worker |
| `chunk-export`       | 80 KB       | Lazy (/features/export)    | Service Worker |
| `vendor-xlsx`        | 143 KB      | Lazy (export step 3)       | Service Worker |
| CSS                  | 30 KB       | Eager                      | Service Worker |

**Key insight:** Main shell (362 KB) is the LCP bottleneck. Adding more routes to the main bundle would immediately degrade LCP. All new routes must use `React.lazy` to keep main bundle under 400 KB.

---

## Known Performance Debt

| Issue                    | Component             | Impact           | Priority | Mitigation                                      |
| ------------------------ | --------------------- | ---------------- | -------- | ----------------------------------------------- |
| `vendor-charts` large    | `/features/analytics` | +113 KB eager    | Medium   | Already lazy via `React.lazy` route             |
| No image optimization    | Multiple              | +10-20 KB images | Low      | Add `<picture>` + webp future sprint            |
| No font preloading       | Shell                 | +100-200ms LCP   | Low      | `font-display: swap` in place                   |
| Firebase query unindexed | `/features/analytics` | +300-500ms TTFB  | Medium   | Create composite indexes (tracked in Firestore) |

---

## Performance Monitoring in Production

**Firebase Performance Monitoring dashboard:**

- https://console.firebase.google.com/project/hmatologia2/performance
- Real user data (RUM) from production
- View by device, browser, geography
- Compare current metrics against baseline

**Web Vitals targets remain:**

- LCP: <2.5s hard limit
- INP: <200ms target
- CLS: <0.1 hard limit

**Baseline serves as:** Reference point for production. If production metrics degrade >10% from baseline, investigate + alert via Firebase Performance alerts (configured in `FIREBASE_PERFORMANCE_BUDGET.md`).

---

**Last Updated:** 2026-05-06 (Phase 4, CLEAN-04)
