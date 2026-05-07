# Phase 12 Pre-Merge Performance Checklist

**Purpose:** Gating checklist for all PRs during Phase 12 (and enforced going forward in v1.4).  
**When to use:** Before opening PR that touches performance-critical paths or adds dependencies.  
**For:** All engineers contributing to v1.4.

---

## Checklist (Copy & Paste into PR Description)

```markdown
## Performance Checklist (Phase 12 Gate)

### Web Vitals & Bundle
- [ ] No new dependencies >50 KB gzip (or justified with size + rationale in PR)
- [ ] No eager imports of routes (all new routes use `React.lazy` + `Suspense`)
- [ ] No new listeners without cleanup (useEffect always returns unsubscribe)
- [ ] Bundle size verified locally: `npm run analyze` → main <400 KB gzip
- [ ] Lighthouse locally green: `npx @lhci/cli@latest autorun` → performance ≥0.85

### Mobile & Accessibility
- [ ] Touch targets ≥48×48px (buttons, inputs, checkboxes)
- [ ] Form responsive on landscape iPad (tested in Chrome DevTools)
- [ ] No keyboard hidden by mobile keyboard on input focus
- [ ] Contrast ratios ≥4.5:1 (normal text), ≥3:1 (large text)
- [ ] All interactive elements keyboard navigable (`aria-label` on icon buttons)

### Database & Queries
- [ ] No N+1 query patterns (loop with `getDoc` inside callback)
- [ ] Firestore listeners deduplicated (one listener per path per view)
- [ ] No `onSnapshot` without cleanup function in useEffect
- [ ] All `getDocs` paginated if result >500 docs
- [ ] Signatures, equipment, analytes denormalized (not separate fetches)

### Code Quality
- [ ] TypeScript: `npx tsc --noEmit` passes
- [ ] Tests pass: `npm test -- --run` (738+ baseline tests)
- [ ] No console errors or warnings in DevTools
- [ ] No memory leaks (Chrome DevTools Detached DOM check)

### If Adding a Heavy Library (>50 KB gzip)
- [ ] Justify in PR comment:
  - Actual gzip size
  - Why lighter alternative insufficient
  - Which chunk it lands in (lazy vs. critical)
- [ ] Add entry to `vite.config.ts` `manualChunks` if new
- [ ] Verify in `npm run analyze` output that size matches claim

### If Adding a New Route
- [ ] Route uses `React.lazy` + `Suspense` (not eager import)
- [ ] Route chunk size audited: `npm run analyze` → <150 KB gzip
- [ ] Skeleton fallback rendered during load
- [ ] Data prefetch considered (parent route on route-anticipation)

### If Touching Form TTI (e.g., Laudo, CIQ Run)
- [ ] Form skeleton loads immediately (100ms)
- [ ] Data fetch parallel (not blocking skeleton)
- [ ] Validation schema lazy-loaded (not on module import)
- [ ] Form handlers memoized (`useCallback`)
- [ ] Local TTI measured: <1.5s (laudo), <1.2s (CIQ run)

### If Touching Chart/Analytics
- [ ] Memoized chart components (`React.memo` on series data)
- [ ] Large datasets (>100 points) tested for <500ms render
- [ ] Responsive container (`width="100%"`, not fixed px)
- [ ] Zoom/filter interactions don't cause full re-render
- [ ] Levey-Jennings load time <500ms verified locally

### If Adding Export/PDF Feature
- [ ] PDF generation <10s for 50 pages (verify via Cloud Function timing)
- [ ] Stream generation if possible (not buffer-all approach)
- [ ] Cloud Function warm (dedicated trigger or keep-alive)
- [ ] Export wizard UI snappy (step navigation <100ms)

---

## Review Instructions for Code Reviewer

**As reviewer, verify:**

1. **Bundle impact:** Run `npm run analyze` on branch, compare main chunk size
   - If >400 KB, ask for justification or code-split recommendation
   - If increases >50 KB, ask for rationale comment

2. **No lazy-load regressions:** Grep for eager imports of feature modules
   ```bash
   git diff main -- src/app/AppRouter.tsx
   # Should NOT see: import Foo from 'src/features/...'
   # Should see: const Foo = lazy(() => import(...))
   ```

3. **Firestore cleanup:** Check hooks for unsubscribe
   ```bash
   git diff main -- 'src/features/**/hooks/**'
   # Should see: useEffect(() => { const unsub = onSnapshot(...); return () => unsub(); }, [])
   ```

4. **No new >50 KB deps:** Check package.json diff
   ```bash
   git diff main -- package.json
   # If new dependency, verify gzip size in PR comment
   ```

5. **Tests pass on CI:** Verify GitHub Actions status
   - TypeScript check ✓
   - Unit tests (738/738) ✓
   - Lighthouse CI performance ≥0.85 ✓

6. **Performance claim vs. code:** If PR claims "form TTI <1.5s", spot-check implementation
   - Is skeleton rendered first?
   - Is data fetch parallel?
   - Are handlers memoized?

---

## Common Rejections & Fixes

### ❌ "Main chunk >400 KB"

**Problem:** PR increases main bundle size.

**Cause:** Eager import of large module.

**Fix:**
```typescript
// Before: ❌ Eager import (bloats main bundle)
import HeavyModule from 'src/features/heavy/HeavyModule';
const routes = [{ path: '/heavy', element: <HeavyModule /> }];

// After: ✅ Lazy import (separate chunk)
const HeavyModule = lazy(() => import('src/features/heavy/HeavyModule'));
const routes = [
  {
    path: '/heavy',
    element: (
      <Suspense fallback={<Skeleton variant="module" />}>
        <HeavyModule />
      </Suspense>
    ),
  },
];
```

### ❌ "Lighthouse performance <0.85"

**Problem:** Local Lighthouse run fails.

**Cause:** Slow route (LCP >2.5s or TBT >300ms).

**Fix (example: CIQ run form):**

```typescript
// Before: ❌ Validation schema imported at module level
import { createRunSchema } from './schemas'; // Zod parse on import

// After: ✅ Lazy schema parse on form mount
const useRunSchema = () => {
  const [schema, setSchema] = useState(null);
  useEffect(() => {
    import('./schemas').then(m => setSchema(m.createRunSchema()));
  }, []);
  return schema;
};
```

### ❌ "Firestore listener leak"

**Problem:** onSnapshot called but not unsubscribed.

**Cause:** useEffect doesn't return cleanup function.

**Fix:**
```typescript
// Before: ❌ No cleanup
useEffect(() => {
  onSnapshot(query(...), snap => { setRuns(...); });
}, []);

// After: ✅ Cleanup returned
useEffect(() => {
  const unsub = onSnapshot(query(...), snap => { setRuns(...); });
  return () => unsub();
}, []);
```

### ❌ "N+1 query detected"

**Problem:** Firestore query runs in a loop.

**Cause:** Fetching equipment/analyte for every run separately.

**Fix (denormalization):**
```typescript
// Before: ❌ N+1 queries (100 runs → 101 queries)
useEffect(() => {
  const unsub = onSnapshot(collection(db, 'runs'), snap => {
    snap.forEach(async doc => {
      const equip = await getDoc(doc.data().equipmentRef); // N additional queries!
      setRuns(...);
    });
  });
  return () => unsub();
}, []);

// After: ✅ Single query (equipment already in run doc)
useEffect(() => {
  const unsub = onSnapshot(collection(db, 'runs'), snap => {
    setRuns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    // Equipment already in d.data().equipmentId / equipmentName (denormalized)
  });
  return () => unsub();
}, []);
```

### ❌ "Form TTI >1.5s"

**Problem:** Form slow to interact with.

**Cause:** All data loaded before skeleton rendered.

**Fix (skeleton + prefetch):**
```typescript
// Before: ❌ Fetch then render
export const LaudoPanel = () => {
  const [laudo, setLaudo] = useState(null);
  useEffect(() => {
    getDoc(ref).then(snap => setLaudo(snap.data())); // Blocks render
  }, []);
  return laudo ? <LaudoForm data={laudo} /> : null;
};

// After: ✅ Skeleton first, then fetch
export const LaudoPanel = () => {
  const [laudo, setLaudo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parallel: skeleton renders instantly, fetch in background
    getDoc(ref)
      .then(snap => { setLaudo(snap.data()); setLoading(false); })
      .catch(e => console.error(e));
  }, []);

  return loading ? <Skeleton variant="form" /> : <LaudoForm data={laudo} />;
};
```

---

## Lighthouse CI Details

### What Gets Tested
When you push to main, GitHub Actions automatically runs:
1. Build: `npm run build`
2. Lighthouse: 3 runs on static `dist/`
3. Assert: All metrics in lighthouserc.js

### Thresholds (Phase 12)
- Performance score ≥0.85 (hard fail)
- LCP ≤2000ms (hard fail)
- CLS ≤0.05 (hard fail)
- TBT ≤200ms (hard fail)
- Accessibility ≥0.9 (hard fail)
- PWA ≥0.9 (hard fail)

### How to Debug Locally
```bash
# 1. Build
npm run build

# 2. Run Lighthouse locally (same as CI)
npx @lhci/cli@latest autorun \
  --collect.numberOfRuns=3 \
  --collect.staticDistDir=./dist \
  --collect.url=http://localhost

# 3. Check report
cat .lighthouseci/result.json | jq '.[0].categories.performance.score'
```

### If CI Fails
1. Check `.lighthouseci/` artifact on failed workflow run
2. Download and analyze report (look at DevTools → Performance tab data)
3. Identify slow metric (LCP? TBT? CLS?)
4. Fix locally, re-test with Lighthouse, commit
5. Re-push to trigger CI again

---

## Performance Testing on Different Networks

**Recommended:** Test on Slow 4G before merge (clinic WiFi is often similarly slow).

```bash
# Chrome DevTools → Network → throttle to "Slow 4G"
# Measure:
# 1. App shell load time
# 2. Form interaction time
# 3. Chart render time
```

---

## Sign-Off Template

When PR is ready, add this comment to signal performance review complete:

```markdown
## Performance Sign-Off

✅ Bundle: main <400 KB gzip (verified via `npm run analyze`)
✅ Lighthouse: performance ≥0.85 (local 3-run average)
✅ Web Vitals: LCP <2.0s, INP <200ms, CLS <0.05 (all passing)
✅ Mobile: 48×48px targets, landscape tested
✅ Database: No N+1 queries, listeners cleanup verified
✅ Tests: 738/738 passing, no regressions

Ready for performance review.
```

---

## Questions?

- **Bundle questions:** See `docs/STREAM-C-BUNDLE-ANALYSIS.md`
- **Web Vitals targets:** See `docs/PERFORMANCE_BASELINE_2026-05.md`
- **Lighthouse setup:** See `lighthouserc.js`
- **Full phase plan:** See `.planning/phases/12-performance-audit/PHASE_12_DETAILED_PLAN.md`

---

**Effective:** Phase 12 kickoff (2026-05-20)  
**Enforced:** On all PRs to `main` during v1.4  
**Version:** 1.0  
**Owner:** CTO (Performance Lead)
