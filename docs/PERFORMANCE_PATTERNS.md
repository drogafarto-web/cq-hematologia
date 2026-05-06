# Performance Patterns — HC Quality v1.2

**Version:** 2026-05  
**Owner:** CTO  
**Audience:** Engineers implementing features in HC Quality  
**Referenced in:** `.claude/rules/performance.md`, Phase 4 cleanup (CLEAN-02)

---

## Purpose

This document formalizes performance patterns already established in the codebase. Every pattern has:
- **What:** The pattern name and why it matters
- **Where:** Codebase examples
- **How:** Implementation steps
- **Metrics:** Expected performance impact
- **Anti-patterns:** What NOT to do

---

## Pattern 1: Route Code-Splitting with React.lazy + Suspense

### What

Large route components (>50KB) must be code-split into separate chunks. Prevents main bundle bloat when adding new routes.

### Why

Main shell bundle (`src/app/layout.tsx` + route list) is currently ~362 KB gzip. Every eager import adds to this. Code-splitting ensures:
- New routes don't inflate the critical path
- Users see fast initial load, then lazy-load route chunks on-demand
- Lighthouse LCP stays <2.5s

### Where

- ✅ `src/features/analytics/AnalyticsHub.tsx` — lazy-loaded at `/features/analytics`
- ✅ `src/features/export/ExportWizard.tsx` — lazy-loaded at `/features/export`
- ✅ `src/features/auditoria-interna/AuditoriaRoot.tsx` (Phase 5 pattern)

### How

```typescript
// In router definition (AppRouter.tsx):
import { lazy, Suspense } from 'react';

const AnalyticsHub = lazy(() => import('src/features/analytics/components/AnalyticsHub'));

// In route config:
<Route 
  path="/features/analytics"
  element={
    <Suspense fallback={<Skeleton variant="dashboard" />}>
      <AnalyticsHub />
    </Suspense>
  }
/>
```

**Bundling config (vite.config.ts):**
```typescript
manualChunks(id) {
  if (id.includes('node_modules/xlsx')) return 'vendor-xlsx';
  if (id.includes('features/analytics')) return 'chunk-analytics';
  if (id.includes('features/export')) return 'chunk-export';
  // ... other manual splits
}
```

### Metrics

| Metric | Without split | With split |
|--------|---------------|-----------|
| Main bundle | +50KB | 0 KB (moved to chunk) |
| Route load time | <100ms (cached) | ~200-400ms first load |
| LCP impact | +400-600ms | negligible |

### Anti-pattern ❌

```typescript
// WRONG: eager import into main shell
import AnalyticsHub from 'src/features/analytics/AnalyticsHub';

export const routes = [
  { path: '/features/analytics', element: <AnalyticsHub /> },
];
```
This adds 50KB to main bundle → LCP regression.

---

## Pattern 2: Firestore onSnapshot Cleanup (Listener Lifecycle)

### What

Every `onSnapshot()` call must be unsubscribed in the hook cleanup function. Leaked listeners silently accumulate, killing performance and billing.

### Why

- Each listener holds an active connection to Firestore
- Stale listeners continue to listen even after component unmounts
- Memory: 10 leaked listeners = 10 MB+ wasted per user session
- Billing: leaked listeners = extra read ops (1 per listener per refresh interval)
- Performance: background churn + garbage collection pauses

### Where

- ✅ `src/features/educacao-continuada/hooks/useColaboradores.ts` (reference implementation)
- ✅ All other modules using real-time data (audit trail, CQ runs)

### How

```typescript
import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, where } from 'firebase/firestore';

export function useColaboradores(labId: LabId) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Create query once per mount
    const q = query(
      collection(db, 'educacaoContinuada', labId, 'colaboradores'),
      where('deletadoEm', '==', null),
      orderBy('nome')
    );

    // Subscribe
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Colaborador))
          .filter(c => !c.deletadoEm);
        setColaboradores(docs);
      },
      (err) => {
        console.error('useColaboradores subscription failed:', err);
        setError(err as Error);
      }
    );

    // ⚠️ CRITICAL: Cleanup unsubscribe on unmount
    return () => unsubscribe();
  }, [labId]); // Only re-subscribe if labId changes

  return { colaboradores, error, isLoading: false };
}
```

### Metrics

| Scenario | Impact |
|----------|--------|
| 1 listener, 1-hour session | ~1 MB memory, ~100 reads/hour |
| 10 leaked listeners, same session | ~10 MB memory, ~1000 reads/hour |
| 100 users × 10 leaked listeners | ~10 GB memory, massive billing |

### Anti-pattern ❌

```typescript
// WRONG: no cleanup
useEffect(() => {
  onSnapshot(collection(db, 'items'), (snap) => {
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  // Missing: return () => unsubscribe()
}, []);
```
Creates new listener on every render. After 10 renders, 10 active listeners.

---

## Pattern 3: Polling with Meta Diff Guard (Analytics + Export)

### What

Polling (interval-based reads) must compare a `lastUpdated` marker before updating state. Prevents unnecessary re-renders and state thrashing.

### Why

- Without guard: every 30s poll → `setState(data)` → re-render, even if data unchanged
- With guard: 30s poll → fetch, compare ETag/hash, skip `setState` if identical
- Impact: ~2/3 of polls prevent React re-render → less work for hooks/components downstream
- Especially critical in dashboards (analytics page with 3-5 charts polling simultaneously)

### Where

- ✅ `src/features/analytics/hooks/useChartData.ts` (polling with diff guard via `useAnalyticsStore`)
- ✅ `src/features/export/hooks/useExportJobs.ts` (polling status updates)

### How

```typescript
import { useEffect, useRef, useState } from 'react';

export function useChartData(labId: LabId, equipmentId?: string) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const lastFetchHashRef = useRef<string | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const freshData = await fetchChartData(labId, equipmentId);
        
        // Compute hash of fresh data
        const newHash = hashChartData(freshData);
        
        // Guard: only update state if data changed
        if (newHash !== lastFetchHashRef.current) {
          setChartData(freshData);
          lastFetchHashRef.current = newHash;
        }
        // If identical, skip setState → no re-render
      } catch (err) {
        console.error('Chart data fetch failed:', err);
      }
    };

    // Initial fetch
    poll();

    // Poll every 30s (minimum for analytics)
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [labId, equipmentId]);

  return { chartData };
}

// Hash helper (simple JSON stringify for scalar fields, crypto.subtle.digest for large payloads)
function hashChartData(data: ChartData): string {
  const payload = JSON.stringify({
    lastRefreshAt: data.lastRefreshAt,
    runCount: data.runCount,
    // Include only "change-significant" fields, not timestamps
  });
  return btoa(payload); // Simple encoding (upgrade to SHA-256 if > 1MB)
}
```

### Metrics

| Scenario | Re-renders / 60s | React work |
|----------|-----------------|-----------|
| No guard (poll every 30s) | 120 (2 per poll, even if data same) | High |
| With guard (data usually stable) | ~20 (new data 1× per 3 minutes) | Low |
| Improvement | -83% | Significant |

### Anti-pattern ❌

```typescript
// WRONG: setState on every poll
const poll = async () => {
  const freshData = await fetchChartData(labId);
  setChartData(freshData); // ← re-render every 30s, regardless
};
```

---

## Pattern 4: Avoid Listeners for Polling

### What

**Do NOT use `onSnapshot()` for polling updates.** Use `getDoc()` / `getDocs()` at intervals instead.

### Why

- `onSnapshot` holds persistent connection → bandwidth + memory overhead
- `getDoc` is a one-shot read → cheaper, no connection cost
- Polling interval (30s+) makes persistent connection uneconomical
- Rule: if update frequency < 5s, consider `onSnapshot`; if > 5s, use polling

### Where

- ✅ Analytics charts (refresh every 30s) → polling with `getDoc`
- ✅ Export job status (check every 2s during export) → polling with `getDocs`
- ❌ Real-time chat / live collab → needs `onSnapshot`

### How

```typescript
// CORRECT: polling with getDocs
const pollExportJobs = async () => {
  const q = query(
    collection(db, 'labs', labId, 'export-jobs'),
    where('status', 'in', ['pending', 'processing']),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q); // One-shot read
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// Then: setInterval(() => pollExportJobs().then(setJobs), 2000)
```

### Anti-pattern ❌

```typescript
// WRONG: onSnapshot for polling
const unsubscribe = onSnapshot(
  query(collection(db, 'export-jobs'), where('status', 'in', ['pending', 'processing'])),
  (snapshot) => setJobs(snapshot.docs.map(...))
);
// setInterval to unsubscribe/re-subscribe every 30s = thrashing
```

---

## Pattern 5: Lazy Import Heavy Libraries (xlsx, canvas, etc)

### What

Large libraries (>50KB) used only in specific routes or functions should be imported dynamically, not at bundle entry.

### Why

- `xlsx` (SheetJS): ~300KB gzip. Only needed on Export route.
- `canvas`, `puppeteer`: server-only (Functions). Never import in client code.
- Dynamic import (`await import()`) keeps them out of main bundle.

### Where

- ✅ `src/features/export/hooks/useExportGenerate.ts` → `import('xlsx')` on demand
- ✅ `functions/src/services/generatePDF.ts` → server-only, no client import
- ❌ Never: `import xlsx from 'xlsx'` at top-level client code

### How

```typescript
// In a handler that triggers export:
const handleGenerateExport = async (format: 'xlsx' | 'pdf') => {
  if (format === 'xlsx') {
    // Dynamic import only when needed
    const { utils, write } = await import('xlsx');
    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Sheet1');
    write(wb, { bookType: 'xlsx', type: 'array' });
  }
};
```

### Bundle impact

| Strategy | Main bundle | Dedicated chunk |
|----------|-------------|-----------------|
| Static `import xlsx` | +300 KB | — |
| Dynamic `await import('xlsx')` | 0 KB | 300 KB (loaded on demand) |

---

## Pattern 6: Web Vitals Targets + Monitoring

### What

Three key Web Vitals must stay within thresholds:

| Metric | Target | Hard limit |
|--------|--------|-----------|
| **LCP** (Largest Contentful Paint) | <2.0s | 2.5s (Lighthouse FAILS if ≥2.5s) |
| **INP** (Interaction to Next Paint) | <200ms | — (no hard fail, but <300ms recommended) |
| **CLS** (Cumulative Layout Shift) | <0.05 | 0.1 (Lighthouse FAILS if ≥0.1) |

### Why

These metrics correlate with user experience:
- **LCP**: "When is the main content visible?" Fast LCP = site feels responsive.
- **INP**: "When do I see response to my click?" Slow INP = unresponsive buttons, sluggish forms.
- **CLS**: "Does content jump around?" High CLS = broken usability, especially on mobile.

Lab system context: Operators running CIQ runs + generating reports need fast, responsive UI. Slow LCP kills trust in real-time data updates.

### How to measure

1. **Local (Lighthouse CLI):**
   ```bash
   npm run lighthouse -- --config-path=lighthouse.config.js https://hmatologia2.web.app/hub
   ```

2. **CI (Lighthouse CI):**
   ```bash
   npm run lighthouse:ci
   ```
   Compares current score against baseline. Fails if LCP degraded >10%, INP degraded >15%.

3. **Production (Firebase Performance Monitoring):**
   - Dashboard at `console.firebase.google.com` → hmatologia2 → Performance → Web Vitals
   - View by page, device, browser
   - Budget alerts trigger when metric violates threshold

### Anti-pattern ❌

```typescript
// WRONG: Large unoptimized image in LCP region
<img src="/hero-image-4mb.jpg" alt="Hero" />

// CORRECT: Optimize + lazy-load
<img 
  src="/hero-image-optimized.webp" 
  alt="Hero"
  loading="lazy"
  width="1200" height="600"
/>
```

---

## Pre-Ship Checklist

Before marking any feature as ready:

1. **Bundle size**: run `npm run build` and check the chunk that changed. If raw size grew >50 KB, justify.
2. **No new static xlsx/puppeteer imports in client code**: grep for `import.*xlsx` in `src/` — all results must use `import()` (dynamic).
3. **New route**: if you added a new view in `AppRouter`, it must use `React.lazy`. Eager import into the main shell is a regression.
4. **onSnapshot cleanup**: every new `useEffect` with `onSnapshot` must return the unsubscribe.
5. **LCP target**: <2.5s. The login redirect is a known ~200ms overhead; don't add more.
6. **INP target**: <200ms. No synchronous operations >50ms in event handlers — offload to workers or async.
7. **CLS target**: <0.1. Use `<Skeleton>` placeholders; never render elements that shift layout on load.
8. **Run Lighthouse CI locally** if touching the shell, auth flow, or any above-the-fold component: `npx lhci autorun`.

---

## References

- **Firebase Performance Monitoring:** https://firebase.google.com/docs/perf-mod
- **Web Vitals Overview:** https://web.dev/vitals
- **React Code-Splitting:** https://react.dev/reference/react/lazy
- **Firestore Best Practices:** https://firebase.google.com/docs/firestore/best-practices
- **HC Quality Rules:** `.claude/rules/performance.md` (performance compliance checks)
- **Bundle Budget Baseline:** `docs/PERFORMANCE_BASELINE_2026-05.md` (Lighthouse metrics + regression thresholds)
- **Firebase Alerts:** `docs/FIREBASE_PERFORMANCE_BUDGET.md` (budget thresholds + monitoring)

---

**Last Updated:** 2026-05-06 (Phase 4 cleanup, CLEAN-02)
