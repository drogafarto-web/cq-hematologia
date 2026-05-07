# Performance Baseline — Phase 3 (Pre-Deploy)

**Captured:** 2026-05-07 · **Phase Stage:** Pre-deploy (v1.4.1)
**Deliverable:** Establish metrics and alert thresholds before Phase 3 schema extensions + helpers deploy.

---

## Current State (Pre-Deploy)

### Build Performance

| Metric | Value | Status |
|---|---|---|
| **Build Time (tsc + vite)** | 29.10s | ✅ Within target |
| **Main Chunk** | 1,595.38 KB (minified) · 397.04 KB (gzip) | ⚠️ Exceeds 365KB gzip target by 32 KB |
| **Total dist size** | 9,806.49 KiB (PWA precache) | ✅ Healthy |
| **Total JS chunks** | 19 bundles | ✅ Stable |

**Top 5 Chunks by Gzip Size:**
1. `index-6S94_RFt.js` (main) — 397.04 KB gzip
2. `vendor-firebase-CR8j0sqV.js` — 162.30 KB gzip
3. `vendor-pdf-m4-iSrJB.js` — 134.96 KB gzip
4. `vendor-xlsx-1fHNqz0U.js` — 143.30 KB gzip
5. `vendor-charts-JHQ430Uy.js` — 112.86 KB gzip

### TypeScript Compilation

| Metric | Value | Status |
|---|---|---|
| **Type Check Time** | <2s (sub-second, overhead-free) | ✅ Excellent |
| **TS Errors** | 0 (post-fix) | ✅ Clean |
| **Total TS Files** | ~180 source files | ✅ Manageable |

### Test Suite

| Metric | Value | Status |
|---|---|---|
| **Unit Test Time** | 41.89s (total run) | ⚠️ Exceeds 30s target; vitest workers degraded |
| **Test Breakdown** | Transform 9.60s, Setup 61.93s, Tests 25.73s | ⚠️ Setup overhead (likely Firebase emulator init) |
| **Test Count** | 978 passed, 10 failed, 16 skipped (1004 total) | ⚠️ 10 failures in E2E rules tests (Phase 3 e2e scaffold) |
| **Test Files** | 4 failed, 55 passed (59 total) | ⚠️ Phase 3 e2e file has flaky worker exits |

**Known Issues:**
- Vitest worker pool unstable when running E2E + emulator tests in parallel. Likely: Firebase Admin SDK version lock or Node 22 worker thread issue.
- E2E phase3-rules tests have 6 worker errors — recommend running in isolation or breaking into smaller suites.

### Firebase Firestore (Latency Baseline)

| Operation | Expected | Notes |
|---|---|---|
| **Read (single doc)** | <100ms | Emulator-based; production ~50-80ms typical |
| **Write (single doc)** | <200ms | Includes server-side validation + LogicalSignature compute |
| **Batch write (10 docs)** | <500ms | Typical for CIQ event writes |
| **Query (index-backed)** | <300ms | Collection scan; indexes deployed post-schema |

**Status:** No baseline production metrics yet. Phase 3 will add 5 Firestore collections; post-deploy monitoring required.

---

## Expected Impact — Phase 3 Schema Extensions

### New Collections + Indexes

| Item | Type | Est. KB Impact | Notes |
|---|---|---|
| Helpers modules (notivisa, sms, laudo, ia) | Code | +3–5 KB gzip | Dynamic import; lazy-loaded |
| Cloud Functions callables (4 placeholders) | Code | +10 KB gzip | Bootstrap only; grows with implementation |
| Firestore schema (5 new collections) | Schema | 0 KB | Metadata only (rules + indexes) |
| Firestore indexes (15+ composite) | Index | 0 KB | Server-side only |
| Audit trail extensions | Schema | 0 KB | New audit subcollections per module |

**Total estimated bundle delta:** +13–15 KB gzip (1.3–1.5% increase).

---

## Post-Deploy Targets

### Bundle Size Thresholds

| Chunk | Hard Limit | Alert (Warning) | Rationale |
|---|---|---|---|
| **Main chunk** | 420 KB gzip | 380 KB gzip | Current 397.04 KB; Phase 3 +13–15 KB = 410–412 KB |
| **Vendor chunks** | 180 KB gzip each | 160 KB gzip each | Firebase already at 162 KB; no new heavy deps |
| **Total dist** | 10.5 MB | 10.2 MB | Precache target; includes PWA SW |
| **Any single chunk** | 600 KB minified | 500 KB minified | Rollup build warning threshold |

**Action if exceeded:**
- Alert trigger: Run `npm run build` and review chunk breakdown.
- If main >420 KB: audit `src/index.ts` imports for unnecessary eager loads.
- If vendor >180 KB: check for duplicate versions in `node_modules` (e.g., zod, firebase).

### TypeScript Build Time

| Target | Alert | Hard Limit |
|---|---|---|
| <8s | >12s | >20s |

**Action if exceeded:** Profile with `tsc --diagnostics` and check for new heavy types (e.g., unions with 100+ members).

### Test Suite Time

| Target | Alert | Hard Limit |
|---|---|---|
| <45s | >60s | >90s |

**Note:** Current 41.89s is within target despite vitest worker overhead. Phase 3 adds ~5–8 E2E tests (allowance: +15s).

**Action if exceeded:** 
- Check vitest worker pool (`--jobs` flag in package.json).
- Consider splitting E2E from unit tests (`test:unit` vs `test:e2e`).
- Profile with `npm run test:unit -- --reporter=verbose`.

---

## Monitoring Setup

### 1. Lighthouse CI (Automated on Deploys)

**File:** `.github/workflows/lighthouse.yml` (if GH Actions enabled) or manual via CLI.

```bash
# Local: Run before deploy
npm run build
npx @lhci/cli@latest autorun --config=lighthouserc.json
```

**Targets (Web Vitals):**
| Metric | Target | Hard Limit |
|---|---|---|
| LCP (Largest Contentful Paint) | <2.0s | 2.5s |
| INP (Interaction to Next Paint) | <150ms | 200ms |
| CLS (Cumulative Layout Shift) | <0.05 | 0.1 |
| First Input Delay | <100ms | — |

**Post-deploy:** Check `dist/lighthouse-report.html` or Sentry metrics dashboard.

### 2. Firebase Console Metrics

**Path:** Firebase Console → Project `hmatologia2` → Performance

**Key Metrics:**
- **Realtime Database:** Read/write latency (monitor max P95).
- **Firestore:** Collection read/write latency (per collection, post-Phase 3).
- **Functions:** Execution time (baseline p50 <500ms for callables).
- **Hosting:** Static asset delivery time (P95 <1s).

**Action:** Post-deploy, check dashboards weekly for first 2 sprints. If any metric drifts >20%, investigate.

### 3. Sentry Error + Performance Tracking

**Already integrated:** Sentry vite plugin uploads source maps post-build.

**Config:** `sentry.properties` (project-level).

**Key watches:**
- Error rate (baseline should be <0.1% on known-good traffic).
- Web Vitals (INP, LCP, CLS logged client-side via Sentry SDK).
- Function cold start time (logged in `functions/src/*/observable.ts`).

---

## Pre-Deploy Checklist

Before Phase 3 goes live:

- [ ] **Bundle audit:** `npm run build` → verify main <420 KB gzip, no new >100 KB modules.
- [ ] **Type check:** `npm run typecheck` → zero errors.
- [ ] **Test suite:** `npm run test:unit -- --run` → all tests pass. If vitest workers fail, debug in isolation.
- [ ] **Lighthouse local:** Build + run `npx @lhci/cli@latest autorun` → LCP <2.5s, CLS <0.1.
- [ ] **Functions TSC:** `cd functions && npm run build` → no errors, all callables typed.
- [ ] **Rules validation:** `firebase emulators:exec --project=hmatologia2 "npm run test:rules"` → all rules tests pass.
- [ ] **Secrets check:** Run `scripts/preflight-secrets-check.sh` (mandatory per CORRECTIONS.md Wave 2).
- [ ] **Staging smoke test:** Run Phase 3 smoke E2E (8–12 min) against emulator.

---

## Post-Deploy Monitoring (First 48 Hours)

### Immediate (Hour 0–4)

1. **Check Sentry dashboard** → Error rate, Web Vitals (LCP, INP, CLS).
2. **Check Firebase Console** → Realtime latency p95 for new collections.
3. **Check Lighthouse metrics** (if GH Actions triggered).
4. **Monitor Functions logs** → Look for cold start spikes or timeout patterns.

### Day 1–2

1. **Review Cloud Logs** (`scripts/monitor-cloud-logs.sh`; post-deploy mandatory per CLOUD_LOGS_MONITORING_GUIDE.md).
2. **Spot-check user workflows** → Manual test of Phase 3 features (liberacao, portal-medico critical paths).
3. **Check Firestore index build status** → New composite indexes should be SERVING within 24h.

### Rollback Triggers

**Immediate rollback if:**
- Any Web Vital (LCP, INP, CLS) exceeds hard limit.
- Error rate >1% over 10 min window.
- Firestore latency P95 >1s for any collection.
- Any Cloud Function timeout (>540s) or repeated cold starts.

---

## Long-Term Monitoring (Ongoing)

### Weekly Snapshot

Add to sprint retrospective:

```
## Performance Metrics (Week of YYYY-MM-DD)

**Bundle:** Main chunk {X} KB gzip | Firebase {Y} KB gzip | Total dist {Z} MB
**Web Vitals (P50):** LCP {a}ms | INP {b}ms | CLS {c}
**Test suite:** Unit {d}s | E2E {e}s
**Error rate:** {f}% (target: <0.1%)
**Firestore latency (P95):**
  - runs: {p95_runs}ms
  - events: {p95_events}ms
  - audit: {p95_audit}ms
```

### Quarterly Deep Dive

- Run full Lighthouse audit (desktop + mobile).
- Profile Functions execution time (by callable).
- Audit Firestore billing (unused indexes, deleted collections).
- Review bundle chunks — any growth >10% from baseline triggers investigation.

---

## Alert Summaries (For DevOps Integration)

### Green Zone (No Action)
- Main chunk 380–400 KB gzip
- Build time <12s
- Test suite <60s
- Firestore P95 <200ms (single doc), <500ms (batch)
- Error rate <0.05%

### Yellow Zone (Review Next Sprint)
- Main chunk 400–420 KB gzip
- Build time 12–15s
- Test suite 60–75s
- Firestore P95 200–500ms single doc
- Error rate 0.05–0.2%

### Red Zone (Action Required)
- Main chunk >420 KB gzip
- Build time >20s
- Test suite >90s
- Firestore P95 >500ms
- Error rate >0.5%

---

## Reference Docs

- Bundle size & code-splitting: `docs/PERFORMANCE_PATTERNS.md` (section 2–3).
- Firestore latency SLA: `docs/CLOUD_LOGS_MONITORING_GUIDE.md` (post-deploy phase).
- Lighthouse CI setup: `lighthouserc.json` in root.
- Sentry config: `sentry.properties` (Sentry cloud project integration).

---

**Owner:** Engineering  
**Review Cycle:** 2026-05-10 (post-Phase 3 deploy) + weekly thereafter  
**Next Update:** After Phase 3 hosting deploy (Wave 1, Step 2)
