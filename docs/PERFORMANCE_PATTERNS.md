# Performance Patterns — HC Quality

Reference guide for maintaining bundle health and runtime performance across all modules.
Last updated: 2026-05-05 (build hc-quality@1.4.1).

---

## Bundle Budget

### Current chunk map (build 1.4.1, gzip sizes)

| Chunk | Raw | Gzip | Budget |
|---|---|---|---|
| `index` (main shell) | 1,433 KB | **362 KB** | target <400 KB gzip |
| `vendor-firebase` | 567 KB | 130 KB | — (fixed SDK cost) |
| `vendor-xlsx` | 430 KB | **143 KB** | lazy-only, never in main |
| `vendor-pdf` | 453 KB | 135 KB | lazy-only (pdf.js worker) |
| `vendor-charts` (recharts) | 385 KB | 113 KB | lazy candidate |
| `vendor-react` | 210 KB | 67 KB | — (fixed React cost) |
| `module-educacao` | 234 KB | 52 KB | OK |
| `module-ct` | 127 KB | 35 KB | OK |
| `module-sgq` | 48 KB | 14 KB | OK |
| `module-bulaparser` | 25 KB | 8 KB | OK |
| `vendor-zod` | 55 KB | 13 KB | OK |
| `shared` | 19 KB | 7 KB | OK |
| CSS | 252 KB | **30 KB** | OK |

**Targets:**
- Main shell (`index`): <400 KB gzip. Currently 362 KB — within budget but near ceiling.
- Any single vendor chunk: <150 KB gzip. `vendor-xlsx` (143 KB) and `vendor-charts` (113 KB) are the biggest risks.
- Feature modules: <60 KB gzip each.
- New library >50 KB gzip: requires explicit justification in the PR (see `.claude/rules/performance.md`).

**Known oversizes:**
- `index` at 362 KB gzip is the top priority to reduce. The main shell contains all views via eager import in `AuthWrapper.tsx`; migrating AppRouter views to `React.lazy` would move ~200 KB of feature code out.
- `vendor-charts` (113 KB gzip) is loaded on first render — it's not lazy. Candidate for lazy-loading behind the Analytics route.

---

## Lazy Loading

### Currently lazy (correct)

- `CTRelatorioPrint` — pdf.js-backed print preview inside `ControlTemperaturaView`, loaded only when user opens the print tab.
- `xlsx` (SheetJS) — dynamic `import('xlsx')` in both `ecImportService.ts` and `ctXlsxService.ts`, cached after first load. Lands in `vendor-xlsx` chunk, never in main bundle.
- `pdf.worker` — pdf.js worker asset (`pdf.worker-*.mjs`, 2.18 MB raw) is a separate asset loaded by the browser only when the PDF viewer mounts.

### Routes that should use React.lazy (current gap)

The `AppRouter` in `src/features/auth/AuthWrapper.tsx` uses eager `if/else` switches — every module view is imported at the top of the file and bundled into the main `index` chunk. These are candidates for `React.lazy`:

| View | Complexity | Priority |
|---|---|---|
| `AnalyticsHub` | Medium | High — dashboard with recharts |
| `ExportsView` | Low | Medium |
| `RastreabilidadeView` | Medium | Medium |
| `SGQView` | Medium | Medium |
| `EducacaoContinuadaView` | High | Low — already its own chunk via `manualChunks` |
| `ControlTemperaturaView` | High | Low — already its own chunk via `manualChunks` |

Converting the top 3 to `React.lazy` + `Suspense` would move their code out of the 362 KB main shell and into separate async chunks, reducing the initial download by an estimated ~80-120 KB gzip.

Pattern:
```tsx
// Replace eager import:
import { AnalyticsHub } from '../analytics/AnalyticsHub';

// With:
const AnalyticsHub = lazy(() =>
  import('../analytics/AnalyticsHub').then((m) => ({ default: m.AnalyticsHub }))
);

// Wrap render site in Suspense:
<Suspense fallback={<FullScreenLoader />}>
  {view}
</Suspense>
```

---

## Firebase Read Patterns

### onSnapshot (real-time listeners)

Use for data the user actively monitors: leituras, CQ runs, audit trail.

Rules:
- Always return the unsubscribe function and call it in the `useEffect` cleanup.
- Never create a listener inside a render function or conditional block.
- One listener per collection per active view — do not fork multiple listeners for the same path.

```typescript
useEffect(() => {
  const unsub = onSnapshot(query(col, where('labId', '==', labId)), (snap) => {
    setData(snap.docs.map(mapper));
  });
  return unsub; // cleanup on unmount
}, [labId]);
```

### getDoc / getDocs (point reads)

Use for:
- One-time lookups (user profile, lab config on mount).
- Polling at intervals where a listener would be excessive (e.g. export job status).
- Data that the user triggered explicitly (download, print).

Do NOT use `onSnapshot` for polling — it holds a persistent WebSocket and billing increases with document writes, not reads.

---

## Analytics Polling — Meta Diff Guard

The Analytics module polls Cloud Functions for aggregate data on a 30-second interval. To prevent unnecessary re-renders when the data hasn't changed, every polling hook compares the incoming `lastUpdated` timestamp (or ETag) before updating state:

```typescript
const lastMetaRef = useRef<string | null>(null);

setInterval(async () => {
  const result = await fetchAnalyticsSnapshot(labId);
  // Only update state if something actually changed
  if (result.meta.lastUpdated === lastMetaRef.current) return;
  lastMetaRef.current = result.meta.lastUpdated;
  setData(result.data);
}, 30_000);
```

This is the canonical pattern for any polling hook. Never update state on every tick unconditionally — even if the new object is structurally equal, it will trigger a re-render of every consumer.

---

## KPI Aggregates — Pre-computed Server-Side

The KPI dashboard (`src/features/kpis/`) does not compute aggregates on the client. Instead:

1. A Cloud Function (scheduled, hourly) reads raw runs/NCs and writes pre-computed KPI documents into `kpiAggregates/{labId}/monthly/{period}`.
2. The client uses a single `onSnapshot` on those aggregate documents.
3. The UI renders directly from the aggregate — no `.reduce()`, no `.filter()` over thousands of docs.

This is the scalability pattern for any metric that requires cross-collection joins or large dataset iteration. Implement it server-side before the data volume makes client-side computation visible in INP.

---

## Pre-ship Checklist

Before marking any feature as ready:

1. **Bundle size**: run `npm run build` and check the chunk that changed. If raw size grew >50 KB, justify.
2. **No new static xlsx/puppeteer imports in client code**: grep for `import.*xlsx` in `src/` — all results must use `import()` (dynamic).
3. **New route**: if you added a new view in `AppRouter`, it must use `React.lazy`. Eager import into the main shell is a regression.
4. **onSnapshot cleanup**: every new `useEffect` with `onSnapshot` must return the unsubscribe.
5. **LCP target**: <2.5s. The login redirect is a known ~200ms overhead; don't add more.
6. **INP target**: <200ms. No synchronous operations >50ms in event handlers — offload to workers or async.
7. **CLS target**: <0.1. Use `<Skeleton>` placeholders; never render elements that shift layout on load.
8. **Run Lighthouse CI locally** if touching the shell, auth flow, or any above-the-fold component: `npx lhci autorun`.
