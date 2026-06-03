---
phase: 12
title: Performance Audit & Web Vitals Compliance
milestone: v1.4 Wave 4 (Launch Prep)
duration: 1.5 weeks
kickoff: 2026-05-20
target_deploy: 2026-06-02
status: planning
---

# Phase 12 — Performance Audit & Web Vitals Compliance (1.5 weeks)

**Objective:** Enforce Web Vitals targets across all critical user journeys, optimize bundle size for v1.4 launch, and establish runtime performance baselines for tablet deployment.

**Success Criteria:**

- All critical routes meet Web Vitals targets (LCP <2.0s, INP <200ms, CLS <0.05)
- Bundle size stays ≤400 KB gzip (main shell), per-module chunks ≤150 KB
- Critical TTI targets met (laudo form <1.5s, CIQ run <1.2s, PDF export <10s)
- Lighthouse CI gates pre-merge with 0 regressions
- Mobile/tablet optimization complete (48×48px targets, orientation handling)
- Firestore query p99 <500ms, N+1 audit clean
- Weekly baseline monitoring chart established

---

## 1. Web Vitals Enforcement & Targets

### 1.1 Current Baseline (v1.3)

| Route                 | LCP    | INP     | CLS    | FCP  | Performance Score |
| --------------------- | ------ | ------- | ------ | ---- | ----------------- |
| `/hub`                | 1.8s ✓ | 85ms ✓  | 0.05 ✓ | 1.2s | 92/100            |
| `/features/analytics` | 2.1s ✓ | 150ms ✓ | 0.03 ✓ | 1.5s | 88/100            |
| `/features/export`    | 1.9s ✓ | 95ms ✓  | 0.04 ✓ | 1.1s | 94/100            |

**Status:** All routes pass. Baseline stable for regression detection.

### 1.2 Phase 12 Targets

| Metric  | Target | Hard Limit | Rationale                                             |
| ------- | ------ | ---------- | ----------------------------------------------------- |
| **LCP** | <2.0s  | 2.5s       | Largest element render (first hub tile or form)       |
| **INP** | <200ms | —          | Input latency (<100ms ideal for form interactions)    |
| **CLS** | <0.05  | 0.1        | No layout shift post-skeleton (strict for medical UI) |
| **TBT** | <200ms | 300ms      | Total blocking time (chunked JS execution)            |
| **FCP** | <1.5s  | —          | First paint (shell + auth + nav)                      |

### 1.3 Testing Procedure

**Per-route testing (every route with data loading or interaction):**

```bash
# Local testing with Lighthouse CLI (desktop + mobile)
npm run build
npx lighthouse https://hmatologia2.web.app/hub \
  --form-factor=desktop \
  --output-path=./lighthouse/hub-desktop.html \
  --output=html \
  --only-categories=performance,accessibility,pwa

npx lighthouse https://hmatologia2.web.app/hub \
  --form-factor=mobile \
  --output-path=./lighthouse/hub-mobile.html \
  --output=html \
  --only-categories=performance,accessibility,pwa
```

**Routes to audit (critical paths):**

- `/hub` — entry point (24 tiles, Firestore auth redirect)
- `/features/analytics` — heavy charting + 30s polling
- `/features/export` — form wizard (4 steps, batch export)
- `/features/bioquimica` — new in v1.4 (Westgard + Levey-Jennings)
- `/features/liberacao` — laudo review + signature (RT portal, new)
- `/features/criticos` — critical value escalation (new)

**Gate:** All routes must pass before deploy. If metric exceeds hard limit, blocker for shipping.

---

## 2. Bundle Analysis & Optimization

### 2.1 Current Bundle Breakdown (v1.3)

| Chunk               | Size (gzip) | Type    | Load        | Notes                                              |
| ------------------- | ----------- | ------- | ----------- | -------------------------------------------------- |
| `vendor-react`      | ~50 KB      | Eager   | Critical    | React + React DOM                                  |
| `vendor-firebase`   | ~200 KB     | Eager   | Critical    | Firebase SDK (auth, Firestore, functions, storage) |
| `vendor-charts`     | ~90 KB      | Lazy    | Route       | Recharts (only loaded by analytics/bioquimica)     |
| `vendor-pdf`        | ~500 KB     | Lazy    | User action | pdf.js-dist (lazy via ControlTemperaturaView)      |
| `vendor-zod`        | ~30 KB      | Eager   | Shared      | Validation (AI payloads, forms)                    |
| `vendor-xlsx`       | ~220 KB     | Dynamic | User action | SheetJS (import/export, via dynamic import)        |
| `module-educacao`   | ~80 KB      | Lazy    | Route       | XLSX importer + training registry                  |
| `module-ct`         | ~60 KB      | Lazy    | Route       | Temperature control + PDF export                   |
| `module-sgq`        | ~50 KB      | Lazy    | Route       | Quality docs (MQ/PQ/IT/FR/POL)                     |
| `module-bioquimica` | ~65 KB      | Lazy    | Route       | Westgard + Levey-Jennings (new v1.4)               |
| `module-liberacao`  | ~55 KB      | Lazy    | Route       | Laudo release workflow (Phase 4, new)              |
| `shared`            | ~40 KB      | Eager   | Shared      | Services, store, utils                             |
| App shell           | ~120 KB     | Eager   | Critical    | AppRouter, auth, shared components, main UI        |

**Total:** ~1,400 KB raw / ~850 KB gzip (main: ~362 KB, chunks: ~488 KB)

### 2.2 Optimization Targets

#### 2.2.1 Main Shell (Critical Path)

**Target:** Keep ≤400 KB gzip

**Checklist:**

- [ ] No eager imports of >50 KB libraries outside manualChunks
- [ ] All new routes use `React.lazy` + `Suspense`
- [ ] Duplicate dependencies audit (e.g., two versions of zod, lodash variants)
- [ ] Tree-shake unused exports from shared services
- [ ] No inline base64 images (use lazy loading + blur-up placeholders)

**Testing:**

```bash
npm run build && npm run analyze
# Open dist/stats.html, filter by "Main", check gzip size
```

#### 2.2.2 Per-Module Chunks

**Target:** Each ≤150 KB gzip

**Modules to audit (Phase 12):**

- `module-bioquimica` (NEW) — target <70 KB
  - Westgard CLSI rules (~8 KB logic)
  - Levey-Jennings chart (~30 KB, includes recharts subset)
  - CIQ form/data entry (~32 KB)
- `module-liberacao` (NEW, Phase 4) — target <60 KB
  - Laudo review UI (~25 KB)
  - Signature component + logic (~20 KB)
  - State/hooks (~15 KB)
- `module-criticos` (NEW, Phase 5) — target <50 KB
  - Critical rule engine (~15 KB)
  - Escalation UI (~20 KB)
  - SMS/email integration stubs (~15 KB)

**Testing per module:**

```bash
npm run build && npm run analyze
# In dist/stats.html, search module name, verify gzip ≤ target
```

#### 2.2.3 Dependency Audit

**Items to check:**

1. No duplicate versions of the same package
2. No unused dependencies in `package.json`
3. Heavy libs (>100 KB gzip) properly lazy-loaded or verified as critical
4. Tree-shake report from build (Vite log)

**Commands:**

```bash
npm ls | grep -E "^├──|dedup"
npm ls | grep "UNMET"
```

### 2.3 Code-Splitting Rules (Enforce)

**Trigger on:** Any new feature, new route, or >50 KB import

**Rule 1: New routes must be lazy**

```typescript
// ✅ CORRECT
const BiochemistryModule = React.lazy(() =>
  import('src/features/bioquimica/BiochemistryRoot')
);

export const routes = [
  {
    path: '/features/bioquimica',
    element: (
      <Suspense fallback={<Skeleton variant="module" />}>
        <BiochemistryModule />
      </Suspense>
    ),
  },
];

// ❌ WRONG
import BiochemistryModule from 'src/features/bioquimica/BiochemistryRoot';
export const routes = [{ path: '/features/bioquimica', element: <BiochemistryModule /> }];
```

**Rule 2: Dependencies >50 KB must justify or be excluded**

Every PR adding a large dependency must include:

- Actual gzip size (from build)
- Justification (why lighter alternative doesn't work)
- Which chunk it lands in

Example PR comment:

```
+ Added `heavy-lib@1.2.3` (78 KB gzip)
Rationale: Only WCAG-compliant library for medical form validation
Chunk: vendor-validation (new, lazy-loaded by auth flow, <5% of routes)
Alternative: zod alone insufficient (no async validation for Notivisa queue)
```

**Rule 3: Manual chunks must be stable**

Any new vendored library or feature chunk should have an entry in `vite.config.ts` `manualChunks`:

```typescript
if (id.includes('node_modules/heavy-lib')) return 'vendor-heavy-lib';
if (id.includes('src/features/new-module')) return 'module-new';
```

Keeps chunk names consistent across rebuilds → better caching (users don't re-download on no-op changes).

---

## 3. Runtime Optimization

### 3.1 Critical Journeys & TTI Targets

| Journey            | Component                           | Current  | Target    | Blocker                      |
| ------------------ | ----------------------------------- | -------- | --------- | ---------------------------- |
| **Laudo Review**   | LaudoPanel (RT portal, Phase 4)     | TBD      | <1.5s     | Form parse + Firestore fetch |
| **CIQ Run**        | RunForm (any CIQ module, analytics) | TBD      | <1.2s     | Validation + chart init      |
| **Levey-Jennings** | ChartView (100+ points)             | TBD      | <500ms    | Recharts render + zoom       |
| **PDF Export**     | ExportWizard (50 pages)             | TBD      | <10s      | Cloud Function execution     |
| **Analytics Load** | AnalyticsHub (filters + charts)     | 2.1s LCP | <2.0s LCP | Firebase query + recharts    |

### 3.2 Optimization Strategies

#### 3.2.1 Form TTI (<1.5s target: Laudo Review)

**Problem:** LaudoPanel mounts → fetches full laudo doc → Firestore round-trip (400-600ms) → renders form → user can interact.

**Optimization A: Skeleton loading**

- Show form skeleton immediately (100ms render)
- Fetch laudo in background (parallel)
- Swap skeleton for real form when ready
- **Expected gain:** -200ms perceived TTI (skeleton appears instant)

**Optimization B: Prefetch on parent route**

```typescript
// In RT portal list page, on hover of laudo row:
const prefetchLaudo = (laudoId: string) => {
  getDoc(doc(db, 'laudos', laudoId)).then((snap) => {
    // Stash in zustand store — ready when detail opens
  });
};
```

- **Expected gain:** -150ms (parallel fetch, not on-route)

**Optimization C: Code-split form components**

- If LaudoPanel is >50 KB, split signature widget separately
- Load sig component only on scroll-to-sig or user focus
- **Expected gain:** -50ms (smaller component parse)

**Testing:**

```bash
# Measure TTI with DevTools Performance tab
# 1. Hard reload (cache clear)
# 2. Open RT portal detail route
# 3. Mark "first interactive" (form usable, not all fields loaded)
# 4. Record time
```

#### 3.2.2 CIQ Run Form (<1.2s target)

**Problem:** RunForm mounts → validations schema load + Firestore query for equipment → render.

**Optimization A: Lazy-load schema validation**

```typescript
// Before: Zod schema parsed on module load
import { createRunSchema } from 'src/features/ciq/validation/schemas';

// After: Lazy parse only when form mounts
const useRunSchema = () => {
  const schema = useMemo(() => {
    import('src/features/ciq/validation/schemas').then((m) => m.createRunSchema());
  }, []);
  return schema;
};
```

- **Expected gain:** -80ms (defer schema parsing)

**Optimization B: Equipment list from Zustand cache**

- Pre-load equipment list on hub load (low-priority, can idle)
- Form mounts → immediate dropdown population (no Firestore call)
- **Expected gain:** -200ms (eliminate Firestore round-trip)

**Optimization C: Memoize form handlers**

```typescript
const handleSubmit = useCallback(async (data) => { ... }, []);
const handleChange = useCallback((field, value) => { ... }, []);
```

- Prevents re-renders on each keystroke
- **Expected gain:** -100ms (fewer render cycles)

**Testing:**

```bash
# Use Lighthouse "Trace" tab
# 1. Record user interaction (click RunForm route, fill first field)
# 2. Check "Scripting" time in Performance panel
# 3. Compare before/after optimization
```

#### 3.2.3 Levey-Jennings (<500ms for 100+ points)

**Problem:** 100 data points → recharts calculates scales, domains, positions → renders SVG.

**Optimization A: Virtual scrolling (if zoomed to subset)**

- If user zoomed to 10-point window, render only visible + 5px padding
- Library: `recharts` + custom `<ResponsiveContainer>` with `viewBox` clipping
- **Expected gain:** -250ms (render 10 points instead of 100)

**Optimization B: Canvas fallback for large datasets**

- If >150 points, render chart as canvas instead of SVG
- Library: `visx` (Airbnb, smaller, canvas-optimized) or recharts canvas renderer
- **Expected gain:** -300ms (canvas paint faster than SVG DOM)

**Optimization C: Memoize chart components**

```typescript
const MemoizedLineChart = React.memo(LineChart, (prev, next) => {
  // Only re-render if data OR domain changed, not on every hover
  return prev.data === next.data && prev.domain === next.domain;
});
```

- **Expected gain:** -150ms (skip unnecessary re-renders on filter/zoom)

**Testing:**

```bash
# Measure Levey-Jennings load time with 100 points
# 1. Generate test data (100 runs, 5 CIQ modules)
# 2. Load `/features/analytics?module=...&points=100`
# 3. Measure LCP (first line visible) + Time to Interactive
# 4. Target: <500ms TTI
```

#### 3.2.4 PDF Export (<10s for 50 pages)

**Problem:** ExportWizard step 4 calls Cloud Function → generates PDF with 50 pages → uploads to Storage → returns signed URL.

**Bottleneck breakdown:**

- Cloud Function cold start: ~3-5s
- PDF generation (puppeteer): ~3-5s
- Upload to Storage: ~1-2s
- Return signed URL: <100ms

**Optimization A: Keep Cloud Function warm**

- Add pub/sub trigger that pings every 60s (cost: ~$0.01/day)
- Cold start → warm start (3-5s → <500ms)
- **Expected gain:** -3-4s

**Optimization B: Stream PDF instead of buffering**

```typescript
// Before: Generate full PDF in memory, then upload
const pdf = await generatePDF(data); // 50 pages buffered
await uploadPDF(pdf);

// After: Stream generation directly to Storage
const writeStream = bucket.file(...).createWriteStream();
pdfGenerator.pipe(writeStream);
```

- **Expected gain:** -1-2s (parallel generation + upload)

**Optimization C: Pregenerate common templates**

- If PDF template is static (letterhead, signatures), generate once
- On export, only fill in dynamic data (results, timestamps)
- Library: `pdfkit` or `jsPDF` (smaller than puppeteer)
- **Expected gain:** -2-3s (template caching vs. full generation)

**Optimization D: Lazy load PDF library**

- Current: `pdfjs-dist` eager in vendor-pdf chunk
- Change: Import only on first export action
- **Expected gain:** -50-100ms client-side (already lazy, low gain)

**Testing:**

```bash
# Time Cloud Function execution
# 1. Call exportPDF({ labId, pages: 50 })
# 2. Measure end-to-end latency (call start → signed URL received)
# 3. Current baseline: TBD (new function)
# 4. Target: <10s
# 5. Break down: cold start vs. generation vs. upload
```

### 3.3 Firestore Query Optimization

#### 3.3.1 Query Audit (N+1 Detection)

**Problem:** Hook fetches docs, then for each doc fetches subcollections or references → N+1 query explosion.

**Example (anti-pattern):**

```typescript
// ❌ WRONG: N+1 queries
useEffect(() => {
  const unsubscribe = onSnapshot(collection(db, 'laudos'), (snap) => {
    snap.forEach(async (doc) => {
      const sigSnap = await getDoc(doc.ref.collection('signatures').doc('latest'));
      // Executes 1 query per laudo → 100 laudos = 101 queries
    });
  });
  return () => unsubscribe();
}, []);
```

**Corrected version:**

```typescript
// ✅ CORRECT: Single query + denormalization
useEffect(() => {
  const unsubscribe = onSnapshot(
    collection(db, 'laudos'),
    { includeMetadataChanges: false },
    (snap) => {
      snap.forEach((doc) => {
        const laudo = doc.data();
        // Signature already in doc (denormalized) — 0 additional queries
        setLaudos((prev) => [...prev, { ...laudo, id: doc.id }]);
      });
    },
  );
  return () => unsubscribe();
}, []);
```

**Audit checklist:**

- [ ] No `getDoc` loops inside `onSnapshot` callbacks
- [ ] No `getDocs` for every item in a list
- [ ] Signature stored in laudo doc (not separate fetch)
- [ ] Equipment, analyte, reagent refs denormalized or lazy-loaded on detail-view only

**Tool:** Enable Firebase Emulator debug logging

```bash
firebase emulators:start --import=./seed --export-on-exit
# In browser console: firebase.firestore().enableLogging(true);
# Then check Cloud Logs for read count per operation
```

#### 3.3.2 p99 Latency Target: <500ms

**Measurement:**

- Use Firebase console → Firestore → Performance → Read Latency percentiles
- Track p99 (99th percentile) latency per collection
- Baseline: TBD (capture from production logs post-v1.4 Phase 3)

**Optimization levers:**

1. **Index effectiveness** — if query needs index, Firestore rounds up latency
   - Action: Run Cloud Logs parser to detect "slow queries"
   - Run `firebase firestore:indexes` to verify all indexes deployed
2. **Document size** — if doc >100 KB, serialize/deserialize overhead rises
   - Action: Audit docs >50 KB, consider splitting into subcollections
3. **Listener count** — if 50+ active listeners on same path, contention rises
   - Action: Check for listener leaks (unsubscribe in cleanup)
4. **Batch size** — `getDocs` can page; if >500 docs, call paginate
   - Action: Add pagination checks to hooks

**Testing:**

```bash
# Capture baseline post-Phase 3 deploy
# 1. Open production app
# 2. Navigate to each major route (hub, analytics, export, etc.)
# 3. Collect 1 hour of Cloud Logs
# 4. Filter for "Read" operations, calculate p99
# 5. Expected: <500ms for 95% of reads, <1s for p99
```

---

## 4. Lighthouse CI Setup & Gates

### 4.1 Current Config

**File:** `lighthouserc.js`

**Current assertion thresholds:**

- Performance score ≥0.75 (warn only, not hard fail — PWA penalty)
- Accessibility ≥0.9 (hard fail)
- Best Practices ≥0.9 (hard fail)
- SEO ≥0.7 (warn — not relevant for B2B SaaS)
- PWA ≥0.9 (hard fail)

**Current metric thresholds:**

- FCP ≤2000ms (first contentful paint)
- LCP ≤2500ms (largest contentful paint)
- TBT ≤300ms (total blocking time)
- CLS ≤0.1 (cumulative layout shift)

### 4.2 Phase 12 Updates

#### 4.2.1 Strengthen Performance Score

**Change:** Performance score from 0.75 (warn) → 0.85 (hard fail)

**Rationale:** v1.3 is stable at 88-92/100. v1.4 should not regress below 0.85.

**Updated config:**

```javascript
// lighthouserc.js
'categories:performance': ['error', { minScore: 0.85 }], // was 0.75
```

#### 4.2.2 Add Metric Thresholds (Web Vitals targets)

**New assertions:**

```javascript
'largest-contentful-paint': ['error', { maxNumericValue: 2000 }], // was 2500
'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],  // was 0.1
'total-blocking-time': ['error', { maxNumericValue: 200 }],       // was 300
'first-input-delay': ['warn', { maxNumericValue: 200 }],          // new
```

#### 4.2.3 Multi-URL Auditing

**Change:** Audit more routes (not just `/`)

```javascript
collect: {
  url: [
    'https://hmatologia2.web.app/',
    'https://hmatologia2.web.app/hub',
    'https://hmatologia2.web.app/features/analytics',
    'https://hmatologia2.web.app/features/export',
    // Add as new routes release in v1.4:
    // 'https://hmatologia2.web.app/features/bioquimica',
    // 'https://hmatologia2.web.app/features/liberacao',
  ],
  numberOfRuns: 3,
  settings: { skipAudits: [] }, // Audit everything
},
```

### 4.3 Pre-Merge Gate Checklist

**Required before opening PR:**

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Analyze bundle (visual confirmation)
npm run analyze
# Open dist/stats.html, verify main <400 KB gzip

# 4. Run Lighthouse locally (3 runs)
npx @lhci/cli@latest autorun \
  --collect.numberOfRuns=3 \
  --collect.staticDistDir=./dist \
  --collect.url=http://localhost \
  --upload.target=temporary-public-storage
# Check report: all metrics pass

# 5. Run unit tests
npm test -- --run

# 6. Run smoke tests (on staging, if available)
npm run test:smoke
```

**In PR description (required):**

```markdown
## Performance Checklist

- [x] Web Vitals targets met (LCP <2.0s, INP <200ms, CLS <0.05)
- [x] Bundle size verified (main <400 KB gzip)
- [x] No lazy-load regressions (new routes use React.lazy)
- [x] Lighthouse score ≥0.85 (performance)
- [x] All smoke tests pass
- [ ] Firestore queries audited (N+1 check)
```

### 4.4 Post-Merge Gate (GitHub Actions)

**File:** `.github/workflows/lighthouse-ci.yml`

**Current:** Runs on push to main + weekly Monday 08:00 UTC.

**Change for Phase 12:**

```yaml
# .github/workflows/lighthouse-ci.yml
- name: Run Lighthouse CI
  run: |
    npx @lhci/cli@latest autorun \
      --collect.numberOfRuns=3 \
      --collect.staticDistDir=./dist \
      --collect.url=http://localhost \
      --assert.preset=lighthouse:recommended \
      --upload.target=temporary-public-storage
  # Fail the workflow if any assertion fails
  # (already hardcoded in lighthouserc.js)

- name: Comment PR with Lighthouse results
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v6
  with:
    script: |
      // Parse .lighthouseci/result.json
      // Post summary comment to PR with metrics
      // Flag any regressions vs. baseline
```

---

## 5. Mobile & Tablet Optimization

### 5.1 Touch Target Sizing (WCAG 2.5.5)

**Standard:** 48×48 CSS pixels for all interactive elements.

**Affected areas:**

- Form buttons (submit, cancel, clear)
- Checkboxes, radio buttons, select dropdowns
- Filter pills (analytics, reports)
- Icon buttons (menu, close, help)
- Laudo action buttons (sign, send, archive)

**Audit checklist:**

```bash
# Use Chrome DevTools → Device Mode → Inspect element
# For each interactive element, check computed size:
# 1. Right-click → Inspect
# 2. Look at dimensions in Styles panel
# 3. If <48×48px, add padding/margin to parent
```

**Example fix:**

```typescript
// Before: 32×32 icon button
<button className="p-2">
  <IconClose className="w-4 h-4" />
</button>

// After: 48×48 touch target
<button className="p-3" aria-label="Close">
  <IconClose className="w-6 h-6" />
</button>
// p-3 = 12px padding → 12 + 24 + 12 = 48px total
```

### 5.2 Orientation Handling (Landscape Tablet)

**Problem:** Forms, charts, and modal dialogs can break on landscape (iPad in landscape = 1024px width, but app designed for portrait-first).

**Audit checklist:**

- [ ] Form layouts reflow to 2 columns on landscape
- [ ] Chart responsive (width: 100%, not fixed px)
- [ ] Modals have max-height for landscape (leave header + footer visible)
- [ ] Keyboard doesn't hide bottom action buttons

**Implementation:**

```typescript
// Use responsive Tailwind classes
<form className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[calc(100vh-120px)] overflow-y-auto">
  <input /> {/* Column 1 */}
  <input /> {/* Column 2 on lg+ */}
</form>

// For charts, always use responsive container
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={data}>
    {/* Recharts handles responsive resizing */}
  </LineChart>
</ResponsiveContainer>
```

### 5.3 Viewport & Zoom

**Ensure in `index.html`:**

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0, maximum-scale=5, user-scalable=yes"
/>
```

- Don't disable pinch zoom (medical users may need magnification)
- Allow up to 5x zoom (WCAG 2.5.4)
- Minimum font size 16px (prevents auto-zoom on focus)

### 5.4 Performance on Slower Networks (Tablet in clinic)

**Scenario:** iPad on WiFi, but WiFi is clinic-wide (shared, slow).

**Optimization:**

- Reduce image sizes (lazy loading already enabled)
- Minify chart bundles (recharts already tree-shaken)
- Prefetch critical data on route transition (not initial load)

**Testing:**

```bash
# Chrome DevTools → Network → set to "Slow 4G"
# Simulate: 400 Kbps down, 400 Kbps up, 400ms latency
# Load app, interact with forms, export PDF
# Measure TTI under slow conditions
```

---

## 6. Database Query Optimization

### 6.1 N+1 Query Audit

**High-risk modules (to audit Phase 12):**

| Module       | Risk   | Audit Action                                             |
| ------------ | ------ | -------------------------------------------------------- |
| `bioquimica` | HIGH   | Check if CIQ run fetch loads all analytes separately     |
| `liberacao`  | HIGH   | Check if laudo fetch resolves signatures, audit trail    |
| `criticos`   | HIGH   | Check if critical value fetch loads rules per value      |
| `analytics`  | MEDIUM | Check if polling refetches equipment, reagent every tick |
| `export`     | MEDIUM | Check if PDF generation loops docs                       |

**Audit process:**

1. Enable Firestore debug logging in browser
2. Navigate to module
3. Open DevTools Console
4. Check for unexpected `getDoc` / `getDocs` calls
5. If found, denormalize or lazy-load on detail-view only

**Tool: Firestore Query Profiler**

```bash
# functions/lib/queryProfiler.ts (new utility)
export const logQueryMetrics = (operation: string, startTime: number) => {
  const duration = Date.now() - startTime;
  console.log(`[Firestore] ${operation}: ${duration}ms`);
  if (duration > 500) console.warn(`⚠️ Slow query: ${operation}`);
};
```

### 6.2 Index Effectiveness

**Goal:** All queries using an index (0 documents scanned > index size).

**Audit:**

```bash
# In Cloud Logs → Firestore Analytics
# Filter: "docCount" field
# If docCount > collectionSize, query did full scan (slow)

# Or, run:
firebase firestore:indexes
# List all created indexes. Any not deployed?
firebase deploy --only firestore:indexes
```

### 6.3 p99 Latency Baseline Capture

**Post-Phase 3 deploy (2026-05-07), collect 24h baseline:**

```bash
# Script: docs/scripts/firestore-latency-baseline.sh
gcloud logging read "resource.type=cloud_firestore" \
  --limit=100000 \
  --format=json \
  --project=hmatologia2 > firestore-logs-24h.json

# Parse for read latency percentiles
node scripts/parse-firestore-latency.js firestore-logs-24h.json
# Output: p50, p95, p99 latencies per operation
```

**Expected baseline (from Phase 0-3 operations):**

- Read (single doc): p50 <50ms, p99 <200ms
- Query (collection): p50 <100ms, p99 <500ms
- Write (callable): p50 <300ms, p99 <1000ms

**Gate:** Phase 12 target is no regression from baseline.

---

## 7. Weekly Baseline Monitoring Chart

### 7.1 Metrics to Track

**Every Monday 08:00 UTC (automated via GitHub Actions):**

| Metric                 | Source            | Target  | Gate                 |
| ---------------------- | ----------------- | ------- | -------------------- |
| Lighthouse Performance | `lighthouserc.js` | ≥0.85   | Hard fail if <0.85   |
| LCP (desktop)          | Lighthouse        | <2.0s   | Hard fail if >2500ms |
| LCP (mobile)           | Lighthouse        | <2.5s   | Hard fail if >2500ms |
| INP                    | Lighthouse        | <200ms  | Warn if >200ms       |
| CLS                    | Lighthouse        | <0.05   | Hard fail if >0.1    |
| Bundle size (main)     | `npm run analyze` | <400 KB | Warn if >420 KB      |
| Bundle size (vendors)  | `npm run analyze` | <800 KB | Warn if >850 KB      |
| Firestore p99 read     | Cloud Logs        | <500ms  | Warn if >600ms       |
| Cloud Function p99     | Cloud Logs        | <2000ms | Warn if >3000ms      |

### 7.2 Dashboard Setup (Google Sheets or Grafana)

**Automated via GitHub Actions:**

```yaml
# .github/workflows/performance-baseline.yml
name: Weekly Performance Baseline

on:
  schedule:
    - cron: '0 8 * * 1' # Every Monday 08:00 UTC

jobs:
  baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run build
      - run: npm run analyze
      # Extract stats from dist/stats.json
      - run: |
          node scripts/extract-bundle-stats.js > /tmp/bundle-stats.json
      # Append to Google Sheet via API
      - run: |
          node scripts/append-to-sheet.js \
            --sheet=${{ secrets.PERF_BASELINE_SHEET_ID }} \
            --stats=/tmp/bundle-stats.json
```

**Dashboard columns:**

- Date
- Lighthouse Performance score
- LCP (desktop) / (mobile)
- INP
- CLS
- Bundle size (main / total)
- Firestore p99
- Notes (e.g., "Added bioquimica module, +10 KB")

### 7.3 Regression Detection

**Alert if:**

- Performance score drops >0.05 points
- LCP increases >200ms
- Bundle size increases >50 KB
- Firestore p99 increases >100ms

**Action:** Flag in PR review, require explanation + optimization plan.

---

## Success Metrics & Sign-Off

### 7.1 Gating Criteria

| Criterion                                           | Status | Verification               |
| --------------------------------------------------- | ------ | -------------------------- |
| All routes pass Web Vitals targets                  | TODO   | Lighthouse local audit     |
| Bundle size <400 KB (main), <800 KB (vendors)       | TODO   | `npm run analyze`          |
| Lighthouse CI gates active (pre-merge + post-merge) | TODO   | GitHub Actions workflow    |
| N+1 query audit clean                               | TODO   | Firestore logs review      |
| Firestore p99 <500ms baseline established           | TODO   | Cloud Logs capture + chart |
| Mobile/tablet optimization complete                 | TODO   | DevTools responsive test   |
| Weekly baseline monitoring chart live               | TODO   | Google Sheets + script     |
| 0 regressions from v1.3 (738/738 tests)             | TODO   | CI run                     |

### 7.2 Pre-Phase 4 Sign-Off

**Before Phase 4 kickoff (2026-05-20):**

- [ ] Performance audit checklist 100% complete
- [ ] Bundle baseline snapshot published
- [ ] Lighthouse CI gates enforced on `main`
- [ ] Mobile/tablet responsive test battery documented
- [ ] Firestore query optimization audit complete
- [ ] v1.4 critical routes (bioquimica, liberacao, criticos) pre-audited

---

## Phase 12 Task Breakdown

### Parallel Track 1: Bundle & Lighthouse (Agent 1)

- [ ] 12-01-01 Audit bundle sizes (main, vendors, modules)
- [ ] 12-01-02 Enforce manual chunks (vite.config.ts review)
- [ ] 12-01-03 Update lighthouserc.js (new thresholds)
- [ ] 12-01-04 Extend GitHub Actions (multi-URL audit)
- [ ] 12-01-05 Document pre-merge checklist
- **Deliverable:** Bundle report + Lighthouse config ready

### Parallel Track 2: Runtime Optimization (Agent 2)

- [ ] 12-02-01 Profile laudo form (skeleton loading + prefetch)
- [ ] 12-02-02 Profile CIQ run form (schema lazy-load, equipment cache)
- [ ] 12-02-03 Profile Levey-Jennings (memoization, virtual scrolling)
- [ ] 12-02-04 Profile PDF export (Cloud Function warmth, streaming)
- [ ] 12-02-05 Implement fastest wins (estimated <2h implementation per optimization)
- **Deliverable:** Runtime optimization matrix + code changes

### Parallel Track 3: Database & Mobile (Agent 3)

- [ ] 12-03-01 N+1 query audit (bioquimica, liberacao, criticos)
- [ ] 12-03-02 Firestore p99 baseline capture (24h logs)
- [ ] 12-03-03 Touch target audit (48×48px)
- [ ] 12-03-04 Orientation testing (landscape iPad)
- [ ] 12-03-05 Slow network testing (Chrome throttle, Slow 4G)
- **Deliverable:** Optimization recommendations + baseline chart

### Parallel Track 4: Monitoring & Gates (Agent 4)

- [ ] 12-04-01 Set up weekly baseline monitoring script
- [ ] 12-04-02 Create Google Sheets dashboard
- [ ] 12-04-03 Regression detection alerts (email on fail)
- [ ] 12-04-04 Document monitoring runbook
- [ ] 12-04-05 Test end-to-end (trigger manually, verify alert)
- **Deliverable:** Monitoring system live

---

## Risks & Mitigations

| Risk                                                           | Probability | Impact | Mitigation                                              |
| -------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------- |
| New v1.4 modules (bioquimica, liberacao) exceed bundle targets | Medium      | High   | Pre-audit on Phase 3 branches, code-split aggressively  |
| Firestore p99 regression from v1.3                             | Low         | High   | N+1 audit + index verification before deploy            |
| Lighthouse CI flakiness (network variance)                     | Medium      | Medium | Run 3 times per audit, use mean ± 1σ for gates          |
| PDF export still >10s after optimization                       | Low         | Medium | Fallback to async email (user polls for result)         |
| Mobile testing reveals untested interaction patterns           | Medium      | Medium | E2E test suite on tablets (Detox, Phase 3.3)            |
| Monitoring script fails silently (chart never updates)         | Low         | Medium | Test manually in Phase 12, add alerts to GitHub Actions |

---

## Dependencies & Prerequisites

- Phase 0-3 complete (v1.3 live, 738/738 tests passing)
- Lighthouse CI workflow active (`.github/workflows/lighthouse-ci.yml`)
- Firestore Query Profiler available (new utility, ~100 LOC)
- Google Sheets API credentials for baseline chart (or alternative: JSON export + GitHub)
- Access to Cloud Logs + performance insights (IAM: Viewer role minimum)

---

## References

- `docs/PERFORMANCE_PATTERNS.md` — established patterns (route code-splitting, listener cleanup)
- `docs/PERFORMANCE_BASELINE_2026-05.md` — v1.3 baseline metrics
- `docs/STREAM-C-BUNDLE-ANALYSIS.md` — bundle breakdown + visualizer setup
- `.claude/rules/performance.md` — performance rules (enforce on all code)
- `lighthouserc.js` — Lighthouse CI config (update per 4.2)
- `.github/workflows/lighthouse-ci.yml` — CI workflow (extend per 4.4)
- `vite.config.ts` — bundle chunking strategy (review + extend per 2.3)

---

## Phase 12 Success Criteria (Sign-Off Template)

```markdown
# Phase 12 Complete — Performance Audit & Web Vitals Compliance

## Metrics Achieved

- [x] Web Vitals: LCP <2.0s (achieved X.Xs), INP <200ms (achieved Xms), CLS <0.05 (achieved X)
- [x] Bundle: Main <400 KB (achieved Y KB gzip), Vendors <800 KB (achieved Z KB)
- [x] Lighthouse: Performance ≥0.85 (achieved X/100), Accessibility ≥0.9 (achieved Y/100)
- [x] Critical TTI: Laudo form <1.5s, CIQ run <1.2s, Levey-Jennings <500ms, PDF <10s
- [x] Firestore p99: <500ms (achieved X.Xms from baseline)
- [x] Mobile: 48×48px targets, landscape orientation, Slow 4G tested
- [x] Monitoring: Weekly baseline live, regression alerts active

## Testing

- 738/738 unit tests passing (0 regressions)
- Lighthouse CI gates enforced (pre-merge + post-merge)
- Smoke tests all routes passing
- E2E critical paths verified (laudo, CIQ run, export)

## Readiness for Phase 4

✅ Phase 4 (Portal Auth + NOTIVISA) can begin 2026-05-20 without performance blockers.
All baseline metrics captured for regression detection during v1.4 Wave 2-4.
```

---

**Document Version:** 1.0  
**Created:** 2026-05-07  
**Owner:** CTO (Performance Lead)  
**Next Review:** Phase 3 completion + v1.4 kickoff (2026-05-20)
