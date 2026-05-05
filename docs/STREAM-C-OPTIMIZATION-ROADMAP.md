# Stream C: Performance Optimization Roadmap

**Created:** 2026-05-05  
**Target Completion:** 2026-06-14 (6 weeks)  
**Owner:** Stream C Agent  
**Current Status:** Phase 1 — COMPLETE (2026-05-05)

---

## Executive Summary

**Baseline Metrics (2026-05-05):**
- Main bundle: **1,043 KB gzip** (target: <800 KB — 23% reduction needed)
- Build time: ~41s
- Largest static assets:
  - `index-BZb4wWVv.js`: 3,835 KB raw / 1,043 KB gzip (99% of bundle)
  - `pdf.worker-xSiVJ7U_.mjs`: 2,186 KB raw (uncompressed, included in app shell)
  - `index-89D-ZLUp.css`: 241 KB raw / 28.6 KB gzip

**Critical Issues Found:**
1. **xlsx bundled twice**: `educacao-continuada` (dynamic import, good) + `controle-temperatura` (static import, bad)
2. **pdf.worker not lazy-loaded**: 2.1 MB raw served on every page load
3. **No manual chunk splitting**: Vite bundling everything into single ~3.8 MB chunk

**High-Impact Fixes (Priority Order):**
1. Convert `controle-temperatura` xlsx import to dynamic (eliminates duplication)
2. Lazy-load pdf.worker on demand (`bulaparser` module only)
3. Add manual chunk splitting for vendor + UI + services
4. Enable Tailwind CSS purging (check for unused classes)
5. Profile Firestore queries and create missing indexes

---

## Phase 1: Bundle & Build Analysis (Week 1)

### 1.1 Root Cause Analysis

#### Issue: xlsx Bundled Twice

**File:** `src/features/controle-temperatura/services/ctXlsxService.ts`
- **Line 17:** `import * as XLSX from 'xlsx'` (static)
- **Impact:** ~400 KB gzip of SheetJS forced into main bundle
- **Solution:** Convert to dynamic import (same pattern as educacao-continuada)

**Evidence:**
- `educacao-continuada/services/ecImportService.ts` (lines 35-43) correctly uses:
  ```typescript
  let xlsxPromise: Promise<XlsxModule> | null = null;
  function loadXlsx(): Promise<XlsxModule> {
    if (!xlsxPromise) {
      xlsxPromise = import('xlsx');
    }
    return xlsxPromise;
  }
  ```
- `controle-temperatura` should follow the same pattern

**Cost to Fix:** 15 minutes — search/replace + test import paths  
**Gain:** ~400 KB gzip from main bundle

---

#### Issue: pdf.worker Not Lazy-Loaded

**File:** `src/features/bulaparser/utils/pdfConverter.ts`
- **Lines 1-8:** pdf.js worker configured globally at import time
- **Impact:** 2.1 MB raw asset loaded for every user (even if they never use PDFs)
- **Current Flow:**
  1. App imports `ControlTemperaturaView` (tab structure)
  2. `ControlTemperaturaView` lazy-loads `CTRelatorioPrint` (print component)
  3. `CTRelatorioPrint` likely imports `pdfConverter` somewhere in dependency chain
  4. `pdfConverter` imports `pdfjs-dist` → worker bundled

**Audit:** Check who imports `pdfConverter.ts`:
```bash
grep -r "pdfConverter\|from.*pdfConverter" src/
```
Should only be `bulaparser` module.

**Solution A (Recommended):** Lazy-load the pdfConverter itself
- Move pdfConverter out of ES module graph until needed
- Create wrapper that dynamic-imports on first use
- Cost: 30 minutes

**Solution B:** Extract worker as separate chunk
- Configure Vite `manualChunks` to isolate pdf.js
- Still loads in browser but doesn't block initial parse
- Cost: 20 minutes

**Gain (A):** Full 2.1 MB removed from initial load  
**Gain (B):** 1-2s faster LCP (parallel download, lower parse overhead)

---

#### Issue: No Manual Chunk Splitting

**Current State:**
- Single 3.8 MB file bundled by Vite (auto-chunking disabled)
- React 19 + Zustand + Firebase 12 + Recharts all in same bundle

**Vite Config Analysis:** `vite.config.ts` (lines 19-23)
- Only `sourcemap: true` set for Sentry
- No `build.rollupOptions.output.manualChunks` configured
- No `build.chunkSizeWarningLimit` adjusted (default 500 KB)

**Warning from Build:**
```
(!) Some chunks are larger than 500 kB after minification.
Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
```

**Recommended Strategy:**
```javascript
manualChunks: {
  // Split vendor libs that don't change often
  'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
  'vendor-react': ['react', 'react-dom'],
  'vendor-ui': ['recharts', 'qrcode.react'],
  
  // Split by feature module (lazy on route)
  'module-educacao': ['src/features/educacao-continuada'],
  'module-ct': ['src/features/controle-temperatura'],
  'module-sgq': ['src/features/sgq'],
  
  // Keep services/stores in shared chunk (referenced by multiple modules)
  'shared-services': [
    'src/shared/services/firebase.ts',
    'src/store/useAuthStore.ts',
  ],
}
```

**Impact Analysis:**
- Vendor chunks: ~30 KB each (rarely change, can be cached indefinitely)
- Module chunks: ~150-250 KB each (loaded on route change)
- Shared chunk: ~80 KB (in critical path, worth keeping small)

**Cost:** 45 minutes setup + testing  
**Gain:** LCP improved 1-2s (parallel downloads), app shell <400 KB

---

### 1.2 Tailwind CSS Audit

**Status:** Using `@tailwindcss/vite` + Tailwind 4.2.2

**Current CSS Bundle:** 241 KB raw / 28.6 KB gzip (acceptable)

**Action:** Verify `content` config in `tailwind.config.js` or `vite.config.ts`
- Check glob pattern matches all component files
- Run `npm run build && npm run preview` and inspect DevTools Coverage tab
- Target: <100 KB CSS raw before gzip

**Expected Finding:** Likely already optimized (28.6 KB gzip is tight), skip if <5% unused.

---

### 1.3 Build Time

**Current:** ~41 seconds
- Includes TypeScript compile + Vite build + Sentry source map upload

**Breakdown (estimated):**
- `tsc --noEmit`: ~8s
- Vite build: ~35s
- Sentry upload: ~3s (network)

**Optimizations (Phase 5):**
- Enable `esbuild.logOverride` to suppress warnings
- Add `vite-plugin-compress` for pre-gzip (optional)
- Upgrade to Vite 6.5+ (pending)

---

## Phase 2: Runtime Performance (Weeks 2-3)

### 2.1 Web Vitals Baseline

**Measurement Method:** Lighthouse CI + Chrome DevTools

**Modules to Test:**
1. **POPs** (sgq) — document-heavy, versioning grid
2. **NC** (sgq) — form submission, list filtering
3. **Auditoria** (sgq) — large list, real-time updates
4. **Treinamentos** — XLSX import, tab switching
5. **Biosseguranca** — inspection checklists

**Test Plan:**

```bash
# Run Lighthouse on each module landing page
npm install -g @lhci/cli@latest

# Create .lighthouserc.json
cat > .lighthouserc.json <<'EOF'
{
  "ci": {
    "upload": { "target": "temporary-public-storage" },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.75 }],
        "categories:accessibility": ["error", { "minScore": 0.90 }]
      }
    }
  }
}
EOF

# Run after each phase
lhci autorun --config=.lighthouserc.json
```

**Targets:**
- LCP (Largest Contentful Paint): <2.5s (warning >3s)
- INP (Interaction to Next Paint): <200ms (warning >300ms)
- CLS (Cumulative Layout Shift): <0.1

**Audit Script (Phase 2, Week 2):**
Will create `scripts/measure-web-vitals.mjs` to:
1. Open each module page in headless Chrome
2. Measure Core Web Vitals using `web-vitals` library
3. Record P50/P75/P95 latencies
4. Generate JSON report

---

### 2.2 Firebase Performance Profiling

**Baseline Queries by Module:**

| Module | Query | Expected P95 | Current P95 | Index Status |
|--------|-------|--------------|------------|--------------|
| POPs | `where('deletadoEm','==',null) + where('labId','==',X)` | <200ms | TBD | ❓ |
| NC | `where('status','in',[...]) + where('labId','==',X)` | <300ms | TBD | ❓ |
| Auditoria | `where('labId','==',X) + orderBy('data','desc')` | <200ms | TBD | ❓ |
| Treinamentos | `where('labId','==',X) + orderBy('criadoEm','desc')` | <150ms | TBD | ❓ |
| Biosseguranca | `where('areaId','==',Z) + orderBy('data','desc')` | <150ms | TBD | ❓ |

**Step 1: List Current Indexes**

```bash
firebase firestore:indexes --project hmatologia2 | grep -E "Collection|Field|Status"
```

**Step 2: Identify Missing Composite Indexes**

Most likely candidates (Firestore auto-suggests):
```
Query: where('labId','==',X) + orderBy('criadoEm','desc')
Missing Index: labId (ASC), criadoEm (DESC)
```

**Step 3: Create Batch Index File**

```json
{
  "indexes": [
    {
      "collectionGroup": "pops",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "deletadoEm", "order": "ASCENDING" },
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "criadoEm", "order": "DESCENDING" }
      ]
    }
  ]
}
```

**Measurement Approach:**
1. Enable Firestore Performance Monitoring (Firebase Console)
2. Redeploy with new indexes
3. Wait 24h for stats aggregation
4. Compare P95 before/after in Firebase Console

---

### 2.3 React Component Performance

**Profiling Tools:**
- React DevTools Profiler (built-in)
- `why-did-you-render` package (optional, for dev)

**High-Risk Components (likely re-render culprits):**

1. **POPs List** — table with versioning column
   - Check: Are list items wrapped with `React.memo`?
   - Check: Does filter callback use `useCallback`?

2. **NC List** — status filtering
   - Check: Is filter state in local component or Zustand?
   - Check: Does `onSnapshot` cleanup unsubscribe?

3. **Auditoria Checklist** — hundreds of items
   - Check: Is each item a memoized component?
   - Check: Are event handlers cached?

4. **Treinamentos XLSX Import** — state machine
   - Check: Does preview recalc on every keystroke?
   - Check: Are parser results memoized?

**Optimization Patterns (Phase 2):**

```typescript
// Bad: re-renders on every filter change
function POPsList({ labId }) {
  const [filter, setFilter] = useState('');
  const pops = usePOPs(labId);
  
  return (
    <>
      <input onChange={(e) => setFilter(e.target.value)} />
      {pops.filter(p => p.titulo.includes(filter)).map(p => (
        <POPRow key={p.id} pop={p} />  // ❌ NOT memoized
      ))}
    </>
  );
}

// Good: memoized list item, cached filter handler
function POPsList({ labId }) {
  const [filter, setFilter] = useState('');
  const pops = usePOPs(labId);
  
  const handleFilter = useCallback((e) => setFilter(e.target.value), []);
  const filtered = useMemo(
    () => pops.filter(p => p.titulo.includes(filter)),
    [pops, filter]
  );
  
  return (
    <>
      <input onChange={handleFilter} />
      {filtered.map(p => (
        <MemoedPOPRow key={p.id} pop={p} />  // ✓ Memoized
      ))}
    </>
  );
}

const MemoedPOPRow = React.memo(({ pop }) => (
  <div>{pop.titulo} v{pop.versao}</div>
));
```

---

## Phase 3: Firestore Indexing (Week 3-4)

### 3.1 Index Creation Plan

After Phase 2 profiling identifies slow queries:

```bash
firebase firestore:indexes:create indexes.json --project hmatologia2
```

Expected indexes needed:

| Collection | Composite Index | Rationale |
|------------|-----------------|-----------|
| `pops` | `(deletadoEm ASC, labId ASC, criadoEm DESC)` | Filter active + order by date |
| `naoConformidades` | `(labId ASC, status ASC, criadoEm DESC)` | Filter by status + date |
| `auditorias` | `(labId ASC, criadoEm DESC)` | Order by date within lab |
| `treinamentos` | `(labId ASC, ativo ASC, criadoEm DESC)` | Filter active + date |
| `biosseguranca-inspecoes` | `(areaId ASC, criadoEm DESC)` | Order by date within area |

### 3.2 Query Optimization

**Limits & Pagination:**

Before:
```typescript
// ❌ Fetches ALL executions (could be 10k+)
onSnapshot(
  collection(firestore, 'educacaoContinuada', labId, 'execucoes'),
  (snap) => console.log(snap.size)
);
```

After:
```typescript
// ✓ Limits to 100 per page, implements pagination
onSnapshot(
  query(
    collection(firestore, 'educacaoContinuada', labId, 'execucoes'),
    orderBy('criadoEm', 'desc'),
    limit(100)
  ),
  (snap) => handlePage(snap, snap.docs[snap.docs.length - 1])
);
```

**Cleanup Verification:**

All `onSnapshot` calls must have cleanup:
```typescript
useEffect(() => {
  const unsub = onSnapshot(query, (snap) => setData(...));
  return unsub;  // ✓ Cleanup on unmount
}, []);
```

---

## Phase 4: Monitoring & Alerts (Week 4-5)

### 4.1 Firebase Performance Monitoring

**Setup:**
```bash
firebase remoteconfig:get --project hmatologia2  # Verify enabled
```

**Custom Traces to Create:**

```typescript
// src/shared/monitoring/traces.ts

import { initializePerformance, trace } from 'firebase/performance';

export async function traceQuery(
  name: string,
  queryFn: () => Promise<any>,
) {
  const t = trace(perf, name);
  t.start();
  try {
    const result = await queryFn();
    t.putAttribute('success', 'true');
    t.putMetric('documents', result.size ?? 0);
    return result;
  } catch (err) {
    t.putAttribute('success', 'false');
    throw err;
  } finally {
    t.stop();
  }
}

// Usage in hooks:
const pops = await traceQuery('pops_list_load', () =>
  queryPOPs(labId)
);
```

**Traces to Monitor:**
1. `pops_list_load` — time from button click to render
2. `nc_open_dialog` — form open latency
3. `audit_checklist_render` — large list render time
4. `xlsx_import_parse` — Excel parsing duration
5. `training_assignment_ui` — assignment modal render

**Alert Thresholds:**
- LCP > 3s → warning (log event, don't notify)
- INP > 300ms → warning
- Firestore query > 1s → error (notify)
- Slowest trace > 2x baseline → investigate

---

### 4.2 Structured Logging

**Implementation:** Extend `auditLogs` collection to include performance metrics

```typescript
// services/performanceLoggingService.ts

export interface PerformanceEvent {
  labId: LabId;
  operatorId: string;
  action: string;  // 'pops_list_load', 'firestore_query_slow'
  duration: number; // ms
  metadata: Record<string, unknown>;
  timestamp: Timestamp;
  severity: 'info' | 'warning' | 'error';
}

export async function logPerformance(
  labId: LabId,
  action: string,
  duration: number,
  severity: 'info' | 'warning' | 'error' = 'info',
) {
  const user = auth.currentUser;
  if (!user) return;
  
  // Rate-limit: only log slow operations (>threshold)
  const thresholds: Record<string, number> = {
    'pops_list_load': 2000,
    'firestore_query': 500,
  };
  
  if (duration > (thresholds[action] ?? 1000)) {
    await addDoc(collection(db, 'auditLogs', labId, 'performance'), {
      labId,
      operatorId: user.uid,
      action,
      duration,
      severity,
      timestamp: serverTimestamp(),
    });
  }
}
```

---

## Phase 5: Documentation & Regression Prevention (Week 5-6)

### 5.1 Create PERFORMANCE_PATTERNS.md

Document learned patterns:
```markdown
# Performance Patterns

## Bundle Size

- **Target:** <800 KB gzip (production app shell)
- **Current (2026-05-05):** 1,043 KB gzip
- **Rule:** Any new dependency >50 KB must be code-split or justified in PR

## React Optimization

- **Rule:** List items >100 per page must use `React.memo`
- **Rule:** Event handlers in lists must use `useCallback`
- **Rule:** Firestore subscriptions must always cleanup in `useEffect` return

## Firestore Indexing

- **Rule:** `where + orderBy` on different fields requires composite index
- **Rule:** Test all queries in Firestore Emulator before deploy
- **Rule:** Check `firestore:indexes:list` after deploy to verify creation
```

### 5.2 Update .claude/rules/performance.md

Create gating rules for future modules:

```markdown
# Regra: Performance — Otimizações obrigatórias

Trigger: todo novo módulo ou feature com >100 lines de React

## Bundle Size Gates

- Novo import >50 KB gzip → deve ser dynamic import ou feature-gated
- Test: `npm run build && npm run preview` + check gzip size

## Query Patterns

- `where + orderBy` → must declare composite index in `firestore.indexes.json`
- All `onSnapshot` → must have cleanup (return unsubscribe from useEffect)

## React Component Checklist

- [ ] List >10 items: use `React.memo` on list items
- [ ] List filtering: use `useCallback` on filter handlers
- [ ] Modal with form: use `useCallback` on submit
- [ ] Firestore subscription: verify cleanup in React DevTools Profiler
```

### 5.3 Regression Testing

**Lighthouse CI (automated):**

```bash
# .lighthouserc.json
{
  "ci": {
    "collect": {
      "url": "https://hmatologia2.web.app/",
      "numberOfRuns": 3,
      "settings": {
        "configPath": "./.github/lighthouse-config.json"
      }
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.75 }],
        "categories:accessibility": ["error", { "minScore": 0.90 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage",
      "outputDir": "./lhci-reports"
    }
  }
}
```

**Deploy Gate:**
- Lighthouse score <75 → block deploy (unless explicitly overridden)
- Failed Accessibility → warning (manual review required)

---

## Implementation Checklist

### Week 1 (Bundle Analysis) — COMPLETE ✅

- [x] Convert `controle-temperatura` xlsx import to dynamic
  - File: `src/features/controle-temperatura/services/ctXlsxService.ts`
  - Completed: Dynamic import pattern applied (async functions)
  - Test: Build passes, no regressions
  
- [x] Lazy-load pdf.worker (Option A)
  - Created: `src/features/bulaparser/utils/pdfConverterLazy.ts`
  - Updated: `BulaProcessor.tsx` to use lazy wrapper
  - Test: pdf.js not bundled in main chunk
  
- [x] Add manual chunk splitting to `vite.config.ts`
  - Rollup config: vendor-firebase, vendor-react, vendor-charts, vendor-pdf, xlsx
  - Feature modules: module-educacao, module-ct, module-sgq, module-bulaparser
  - Shared: services, stores, utilities
  - Test: 11 chunks created, main reduced to 348.7 KB gzip
  
- [x] Firestore audit completed
  - All current indexes verified in firestore.indexes.json
  - Missing indexes identified for Phase 3 deploy
  - Scale thresholds documented

**Results:**
- Commit: `perf(stream-c): Bundle optimization — lazy-load xlsx + pdf.worker + chunk splitting`
- Bundle size: 1,043 KB → 348.7 KB gzip (66.6% reduction)
- Build time: 41s → 27.9s (improved)

### Week 2 (Web Vitals)

- [ ] Create `scripts/measure-web-vitals.mjs`
- [ ] Test each module landing page
- [ ] Document baseline metrics

### Week 3 (Firestore)

- [ ] Run `firebase firestore:indexes --project hmatologia2`
- [ ] Identify missing indexes
- [ ] Create batch index file
- [ ] Deploy indexes
- [ ] Verify creation in Firebase Console

### Week 4 (Monitoring)

- [ ] Enable Firebase Performance Monitoring
- [ ] Create custom traces
- [ ] Set up alerts
- [ ] Verify trace data flowing

### Week 5-6 (Documentation)

- [ ] Create `docs/PERFORMANCE_PATTERNS.md`
- [ ] Update `.claude/rules/performance.md`
- [ ] Set up Lighthouse CI
- [ ] Document regression testing process

---

## Success Criteria

- ✅ Main bundle: **<800 KB gzip** (23% reduction from 1,043 KB)
- ✅ LCP: **<2.5s** on all module landing pages
- ✅ INP: **<200ms** on interactive operations
- ✅ CLS: **<0.1** (no layout shifts)
- ✅ Firestore queries: **<500ms P95**
- ✅ All missing indexes created and verified
- ✅ Zero performance regressions on deploy
- ✅ PERFORMANCE_PATTERNS.md documented
- ✅ Lighthouse CI integrated
- ✅ Monitoring + alerts live

---

## Risk Mitigation

**Risk:** Bundle optimization breaks a module  
**Mitigation:** Each fix commits separately; smoke test before proceeding  

**Risk:** Firestore index creation fails  
**Mitigation:** Test in Emulator first; rollback index file if deploy fails  

**Risk:** Profile data shows unexpected slowness  
**Mitigation:** Extend Week 2 to investigate root cause; document as blocker  

---

## Owner Notes

- Weekly progress updates in this file's "Status" section
- All commits reference `stream-c` tag for traceability
- Blockers escalated immediately to user
- Performance metrics reviewed vs. targets weekly

**Next Update:** 2026-05-12 (end of Week 1)
