# Stream C: Web Vitals & Performance Baseline

**Date:** 2026-05-05  
**Phase:** 2 Batch 1/2 Hardening & Performance Audit  
**Status:** Baseline Measurement Initialized

---

## Objective

Establish performance baselines for all 5 live modules (POPs, NC, Auditoria, Treinamentos, Biosseguranca) to:
- Measure Web Vitals (LCP, INP, CLS)
- Identify bottlenecks (Firestore latency, bundle size, React re-renders)
- Set up Firebase Performance Monitoring with alert thresholds
- Create foundation for continuous performance tracking

---

## Infrastructure Deployed

### 1. Web Vitals Measurement (`src/lib/web-vitals.ts`)

**Purpose:** Measure Core Web Vitals on production (hmatologia2.web.app)

**Metrics collected:**

| Metric | Threshold (Good) | Threshold (Poor) | Status |
|--------|-----------------|-----------------|--------|
| **LCP** (Largest Contentful Paint) | <2.5s | >4s | ✓ Measuring |
| **INP** (Interaction to Next Paint) | <200ms | >500ms | ✓ Measuring |
| **CLS** (Cumulative Layout Shift) | <0.1 | >0.25 | ✓ Measuring |
| **FCP** (First Contentful Paint) | <1.8s | >3s | ✓ Measuring |
| **TTFB** (Time to First Byte) | <800ms | >1.8s | ✓ Measuring |

**Features:**
- Automatic collection via PerformanceObserver API
- Real-time reporting to browser console (dev mode)
- Integration with Firebase Performance Monitoring
- Fallback reporting via `navigator.sendBeacon()`

**Usage:**
```typescript
import { initWebVitals, getWebVitalsSummary } from './lib/web-vitals';

// Initialize in App.tsx (automatic)
initWebVitals();

// Get current metrics in browser console
const vitals = getWebVitalsSummary();
console.log(vitals); // { lcp: 1850, inp: 145, cls: 0.05 }
```

---

### 2. Performance Tracing (`src/lib/performance-tracing.ts`)

**Purpose:** Measure custom operations and module-specific performance

**Standard trace names:**

```typescript
POPS_LIST_LOAD        // Time to render POPs list
NC_LIST_LOAD          // Time to render NC list
AUDITORIA_LIST_LOAD   // Time to render Auditoria list
TREINAMENTOS_LIST_LOAD // Time to render Treinamentos list
BIOSSEGURANCA_AREAS_LOAD // Time to render Biosseguranca areas

NC_DIALOG_OPEN        // Time to open NC form dialog
POP_DIALOG_OPEN       // Time to open POP form dialog
AUDIT_DIALOG_OPEN     // Time to open Audit form dialog

NC_CREATE_SUBMIT      // Time to submit NC form
POP_CREATE_SUBMIT     // Time to submit POP form
AUDIT_CHECKLIST_SUBMIT // Time to submit audit checklist

AUDIT_CHECKLIST_RENDER // Time to render audit checklist
NC_LIST_RENDER         // Time to render NC list
POPS_LIST_RENDER       // Time to render POPs list

FIRESTORE_QUERY       // Firestore query latency
FIRESTORE_WRITE       // Firestore write latency
FIRESTORE_DELETE      // Firestore delete latency

AUTH_STATE_CHANGE     // Auth state change latency
AUTH_LOGIN            // Login latency
AUTH_LOGOUT           // Logout latency
```

**Usage:**

```typescript
import { traceAsync, PerformanceTrace, TRACE_NAMES } from './lib/performance-tracing';

// Measure async operation
await traceAsync(TRACE_NAMES.POPS_LIST_LOAD, async (trace) => {
  const data = await fetchPOPs();
  trace.putMetric('item_count', data.length);
  return data;
});

// Manual tracing
const trace = new PerformanceTrace('custom_operation');
trace.putMetric('result_count', 42);
trace.putAttribute('status', 'success');
const metrics = trace.stop();
```

---

### 3. React Hook for Tracing (`src/lib/usePerformanceTrace.ts`)

**Purpose:** Measure component render performance within React lifecycle

**Specialized hooks:**

- `usePerformanceTrace()` - Generic performance tracing
- `useListTrace()` - Trace list rendering with item count
- `useDataFetchTrace()` - Trace data fetching with latency measurement
- `useInteractionTrace()` - Trace user interactions (dialogs, forms)
- `useFirestoreQueryTrace()` - Trace Firestore query performance

**Usage:**

```typescript
function POPsList() {
  const [items, setItems] = useState([]);
  const trace = usePerformanceTrace('pops_list_render', {
    autoStop: true,
    onStop: (metrics) => console.log('POPs render completed:', metrics),
  });

  useEffect(() => {
    trace.recordMetric('item_count', items.length);
    trace.recordAttribute('status', 'loaded');
  }, [items]);

  return <div>{items.map(item => ...)}</div>;
}
```

---

### 4. Firebase Performance Monitoring (`src/lib/firebase-performance.ts`)

**Purpose:** Configure Firebase Performance Monitoring with alert thresholds

**Alert thresholds:**

| Threshold | Value | Action |
|-----------|-------|--------|
| LCP (warning) | 2500ms | Monitor |
| LCP (critical) | 3000ms | Alert |
| INP (warning) | 200ms | Monitor |
| INP (critical) | 300ms | Alert |
| CLS (warning) | 0.1 | Monitor |
| CLS (critical) | 0.25 | Alert |
| List Load (warning) | 1000ms | Monitor |
| List Load (critical) | 1500ms | Alert |
| Dialog Open (warning) | 500ms | Monitor |
| Dialog Open (critical) | 1000ms | Alert |
| Firestore Query (warning) | 500ms | Monitor |
| Firestore Query (critical) | 1000ms | Alert |

**Initialization:**

```typescript
import { initFirebasePerformance } from './lib/firebase-performance';

// Called in App component on load
initFirebasePerformance();
```

---

## Target Modules (Week 2)

### 1. POPs List (`src/features/sgq/pops`)

**URL:** `/hub` → POPs tile  
**Landing page:** `POPsList` component  
**Key metrics:**
- **LCP:** Time to render list view
- **INP:** Click on POP item (open dialog)
- **CLS:** Skeleton → content swap

**Expected performance:**
- LCP: <2.5s (target)
- INP: <200ms (target)
- CLS: <0.1 (target)

---

### 2. NC List (`src/features/sgq/naoConformidade`)

**URL:** `/hub` → NC tile  
**Landing page:** `NCList` component  
**Key metrics:**
- **LCP:** Time to render list view
- **INP:** Open new NC dialog
- **CLS:** Skeleton → content swap

**Expected performance:**
- LCP: <2.5s (target)
- INP: <200ms (target)
- CLS: <0.1 (target)

---

### 3. Auditoria List (`src/features/sgq/auditoria`)

**URL:** `/hub` → Auditoria tile  
**Landing page:** `AuditoriaList` component  
**Key metrics:**
- **LCP:** Time to render checklist
- **INP:** Click checklist item
- **CLS:** Item state changes

**Expected performance:**
- LCP: <2.5s (target)
- INP: <200ms (target)
- CLS: <0.1 (target)

---

### 4. Treinamentos List (`src/features/treinamentos`)

**URL:** `/hub` → Treinamentos tile  
**Landing page:** `TreinamentosList` component  
**Key metrics:**
- **LCP:** Time to render list view
- **INP:** Open training assignment dialog
- **CLS:** Skeleton → content swap

**Expected performance:**
- LCP: <2.5s (target)
- INP: <200ms (target)
- CLS: <0.1 (target)

---

### 5. Biosseguranca Areas (`src/features/biosseguranca`)

**URL:** `/hub` → Biosseguranca tile  
**Landing page:** `BiossegurancaList` component  
**Key metrics:**
- **LCP:** Time to render areas list
- **INP:** Open area details
- **CLS:** Skeleton → content swap

**Expected performance:**
- LCP: <2.5s (target)
- INP: <200ms (target)
- CLS: <0.1 (target)

---

## Measurement Process

### Step 1: Browser Console Verification

1. Open Chrome DevTools → Console
2. Go to production: `https://hmatologia2.web.app`
3. Login and navigate to hub
4. Type in console:

```javascript
// Get current Web Vitals
window.__web_vitals__ = {};
// Or use the library directly
getWebVitalsSummary();
```

### Step 2: Chrome DevTools Lighthouse

1. Open DevTools → Lighthouse tab
2. Run audit (Mobile, Performance)
3. Record scores:
   - Performance score (target: >85)
   - LCP (target: <2.5s)
   - INP (target: <200ms)
   - CLS (target: <0.1)

### Step 3: Firebase Console

1. Go to: `https://console.firebase.google.com/project/hmatologia2/performance`
2. Check custom traces for each module
3. Verify alert thresholds are configured

### Step 4: Web Vitals Dashboard (to be created)

Create dashboard showing:
- Real-time LCP/INP/CLS across all modules
- Trend detection (hourly, daily, weekly)
- Alert notifications
- Comparison with targets

---

## Firestore Query Optimization (Phase 2.3)

### Missing Indexes

These indexes are required to optimize Firestore queries:

```
Collection: pops
  Query: where('deletadoEm', '==', null) + where('labId', '==', X) + orderBy('criadoEm', 'desc')
  Index needed: labId + deletadoEm + criadoEm DESC

Collection: naoConformidades
  Query: where('status', 'in', [...]) + where('labId', '==', X) + orderBy('criadoEm', 'desc')
  Index needed: labId + status + criadoEm DESC

Collection: auditorias
  Query: where('labId', '==', X) + orderBy('data', 'desc')
  Index needed: labId + data DESC

Collection: treinamentos
  Query: where('labId', '==', X) + where('operadorId', '==', Y) + orderBy('data', 'desc')
  Index needed: labId + operadorId + data DESC

Collection: biosseguranca-inspecoes
  Query: where('areaId', '==', Z) + orderBy('data', 'desc')
  Index needed: areaId + data DESC
```

**Create indexes via Firebase CLI:**

```bash
firebase firestore:indexes --indexes=firestore.indexes.json --project hmatologia2
```

Or via Firebase Console:
1. Go to Firestore → Indexes
2. Click "Create Index"
3. Select collection, fields, sort order
4. Click "Create"

---

## Baseline Metrics (To be filled during Week 2)

### Module: POPs List

| Page | Metric | Value | Rating | Target | Status |
|------|--------|-------|--------|--------|--------|
| POPs List | LCP | TBD | TBD | <2.5s | Pending |
| POPs List | INP (click) | TBD | TBD | <200ms | Pending |
| POPs List | CLS | TBD | TBD | <0.1 | Pending |

### Module: NC List

| Page | Metric | Value | Rating | Target | Status |
|------|--------|-------|--------|--------|--------|
| NC List | LCP | TBD | TBD | <2.5s | Pending |
| NC List | INP (open dialog) | TBD | TBD | <200ms | Pending |
| NC List | CLS | TBD | TBD | <0.1 | Pending |

### Module: Auditoria List

| Page | Metric | Value | Rating | Target | Status |
|------|--------|-------|--------|--------|--------|
| Auditoria List | LCP | TBD | TBD | <2.5s | Pending |
| Auditoria List | INP (click item) | TBD | TBD | <200ms | Pending |
| Auditoria List | CLS | TBD | TBD | <0.1 | Pending |

### Module: Treinamentos List

| Page | Metric | Value | Rating | Target | Status |
|------|--------|-------|--------|--------|--------|
| Treinamentos List | LCP | TBD | TBD | <2.5s | Pending |
| Treinamentos List | INP (open dialog) | TBD | TBD | <200ms | Pending |
| Treinamentos List | CLS | TBD | TBD | <0.1 | Pending |

### Module: Biosseguranca Areas

| Page | Metric | Value | Rating | Target | Status |
|------|--------|-------|--------|--------|--------|
| Biosseguranca | LCP | TBD | TBD | <2.5s | Pending |
| Biosseguranca | INP (open details) | TBD | TBD | <200ms | Pending |
| Biosseguranca | CLS | TBD | TBD | <0.1 | Pending |

---

## Next Steps (Week 2)

1. **Manual Testing**
   - Visit each module on production
   - Measure Web Vitals using browser console
   - Document baseline metrics in this file

2. **Lighthouse Audits**
   - Run Lighthouse on each module
   - Identify top bottlenecks
   - Compare with targets

3. **Firebase Console Setup**
   - Verify custom traces are being sent
   - Configure alert thresholds
   - Set up dashboards

4. **Identify Bottlenecks**
   - Profile slowest components (DevTools Profiler)
   - Check Firestore query latency
   - Analyze bundle impact

5. **Create Findings Document**
   - Document STREAM-C-WEB-VITALS-FINDINGS.md
   - List blockers and optimizations needed
   - Prioritize by impact

---

## Related Files

- `src/lib/web-vitals.ts` — Web Vitals measurement library
- `src/lib/performance-tracing.ts` — Custom performance traces
- `src/lib/usePerformanceTrace.ts` — React hooks for performance
- `src/lib/firebase-performance.ts` — Firebase configuration
- `docs/STREAM-C-WEB-VITALS-FINDINGS.md` — Detailed findings (to be created)
- `docs/PERFORMANCE_PATTERNS.md` — Best practices (to be created)

---

## References

- [Web Vitals](https://web.dev/articles/vitals)
- [Core Web Vitals Guide](https://web.dev/articles/vitals)
- [Firebase Performance Monitoring](https://firebase.google.com/docs/perf-mod)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance)
- [React Profiler](https://react.dev/reference/react/Profiler)

---

**Owner:** Stream C Agent  
**Created:** 2026-05-05  
**Last Updated:** 2026-05-05
