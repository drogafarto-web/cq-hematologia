# Phase 3.1 Wave 2 — Firestore Indices & Performance Gates

**Phase:** 03.1-foundation (Mobile + Analytics + Export)
**Wave:** 2 (Integration & Validation)
**Date:** 2026-05-05

---

## 1. Firestore Composite Indices

### 1.1 Index Configuration File

**File:** `firestore.indexes.json`

Create this file in the project root to define all required composite indices:

```json
{
  "indexes": [
    {
      "collectionGroup": "entries",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "deletadoEm", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "ciq-runs",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "criadoEm", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "export-jobs",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "analytics",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "labId", "order": "ASCENDING" },
        { "fieldPath": "computedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 1.2 Index Definitions (Detailed)

#### Index 1: CIQ Runs Entry Status + Soft Delete

**Purpose:** Analytics queries for "valid runs" need to filter by status and exclude soft-deleted entries.

**Path:** `/labs/{labId}/ciq-runs/{runId}/entries`

**Query pattern:**

```typescript
// Example: Count valid runs excluding deleted ones
const validRuns = db
  .collectionGroup('entries')
  .where('status', '==', 'VALID')
  .where('deletadoEm', '==', null);
```

**Index definition:**

```json
{
  "collectionGroup": "entries",
  "queryScope": "Collection",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "deletadoEm", "order": "DESCENDING" }
  ]
}
```

**Fields:**

- `status` (ASCENDING): Filter entries by status (VALID, INVALID, REVIEW)
- `deletadoEm` (DESCENDING): Exclude soft-deleted entries (RN-06 convention)

**Expected query latency:**

- Without index: >5s (full scan)
- With index: <500ms (indexed lookup)

---

#### Index 2: CIQ Runs by Lab + Creation Date

**Purpose:** Analytics scheduled function queries all runs for a lab ordered by creation date.

**Path:** `/labs/{labId}/ciq-runs`

**Query pattern:**

```typescript
// Example: Get all runs for a lab, ordered by creation date
const runs = db.collection(`/labs/${labId}/ciq-runs`).orderBy('criadoEm', 'desc').limit(1000);
```

**Index definition:**

```json
{
  "collectionGroup": "ciq-runs",
  "queryScope": "Collection",
  "fields": [
    { "fieldPath": "labId", "order": "ASCENDING" },
    { "fieldPath": "criadoEm", "order": "DESCENDING" }
  ]
}
```

**Fields:**

- `labId` (ASCENDING): Filter by lab (multi-tenant isolation)
- `criadoEm` (DESCENDING): Sort by creation date (newest first)

**Expected query latency:**

- Without index: >3s (full scan)
- With index: <200ms (index range query)

---

#### Index 3: Export Jobs by Lab + Creation Date

**Purpose:** Client polls export job status for a specific lab.

**Path:** `/labs/{labId}/export-jobs`

**Query pattern:**

```typescript
// Example: Get recent export jobs for a lab
const jobs = db.collection(`/labs/${labId}/export-jobs`).orderBy('createdAt', 'desc').limit(10);
```

**Index definition:**

```json
{
  "collectionGroup": "export-jobs",
  "queryScope": "Collection",
  "fields": [
    { "fieldPath": "labId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

**Fields:**

- `labId` (ASCENDING): Filter by lab
- `createdAt` (DESCENDING): Sort by creation date (newest first)

**Expected query latency:**

- Without index: >2s (full scan)
- With index: <150ms (index lookup)

---

#### Index 4: Analytics Cache by Lab + Computation Date

**Purpose:** React hook fetches analytics cache for a specific lab.

**Path:** `/labs/{labId}/analytics/cache/metrics`

**Query pattern:**

```typescript
// Example: Get most recent analytics cache for a lab
const cache = db
  .collection(`/labs/${labId}/analytics/cache/metrics`)
  .orderBy('computedAt', 'desc')
  .limit(1);
```

**Index definition:**

```json
{
  "collectionGroup": "analytics",
  "queryScope": "Collection",
  "fields": [
    { "fieldPath": "labId", "order": "ASCENDING" },
    { "fieldPath": "computedAt", "order": "DESCENDING" }
  ]
}
```

**Fields:**

- `labId` (ASCENDING): Filter by lab
- `computedAt` (DESCENDING): Sort by computation date (newest first)

**Expected query latency:**

- Without index: >1s (full scan)
- With index: <100ms (direct lookup)

---

### 1.3 Deployment Instructions

**Method 1: Firebase Console (Manual)**

1. Navigate to: https://console.firebase.google.com/project/hmatologia2/firestore/indexes
2. Click **Create Index**
3. Fill in each index from section 1.2
4. Click **Create Index**
5. Wait for status to change from "Creating" to "Enabled" (2-5 minutes)

**Method 2: gcloud CLI (Automated)**

```bash
# Deploy all indices from firestore.indexes.json
gcloud firestore indexes create --config=firestore.indexes.json --project=hmatologia2

# Verify deployment
gcloud firestore indexes list --project=hmatologia2
```

**Method 3: Firebase Deploy**

```bash
# If firestore.indexes.json is present, deploy includes indices
firebase deploy --only firestore:indexes --project=hmatologia2
```

**Verification:**

After deployment, verify indices are enabled:

```bash
gcloud firestore indexes list --project=hmatologia2 --format=json
```

Expected output:

```json
[
  {
    "name": "projects/hmatologia2/databases/(default)/collectionGroups/entries/indexes/...",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "deletadoEm", "order": "DESCENDING" }
    ],
    "state": "READY"
  },
  ...
]
```

**Status field values:**

- `READY`: Index is enabled and ready for queries
- `CREATING`: Index is being created (wait 2-5 minutes)
- `DELETING`: Index is being deleted (skip if not needed)

**Go/No-Go checklist:**

- [ ] All 4 indices deployed
- [ ] All indices show `state: READY`
- [ ] Deployment time: <10 minutes total

---

## 2. Performance Gates & Acceptance Criteria

### 2.1 Firestore Query Performance

**Gate 1: Analytics Query Latency**

**Requirement:** Aggregation queries for analytics complete in <2 seconds for typical lab (50k docs).

**Test scenario:**

```typescript
// Query aggregateDaily executes this
const startTime = Date.now();
const entries = await db
  .collectionGroup('entries')
  .where('status', '==', 'VALID')
  .where('deletadoEm', '==', null)
  .get();
const latency = Date.now() - startTime;
console.log(`Query latency: ${latency}ms`);
```

**Acceptance criteria:**

- [ ] P50 latency: <500ms
- [ ] P95 latency: <1500ms
- [ ] P99 latency: <2000ms
- [ ] No timeouts (Firestore timeout: 60s, plenty of headroom)

**Measurement method:**

1. Deploy indices (from section 1.3)
2. Populate Firestore emulator with test data:
   ```bash
   npm run seed:firestore -- --entries=50000 --status=mixed
   ```
3. Run performance test:
   ```bash
   npm run perf:analytics --entries=50000
   ```
4. Verify output shows latencies within acceptance criteria

**If latency exceeds gate:**

- ✓ Index missing: Deploy from section 1.3
- ✓ Query not using index: Check WHERE and ORDER BY clauses match index fields
- ✓ Too much data: Implement data pruning (soft-delete old runs)

---

**Gate 2: Export Job Polling Latency**

**Requirement:** Client can poll job status with <150ms latency.

**Test scenario:**

```typescript
// React hook polls this on interval
const startTime = Date.now();
const jobRef = doc(db, 'labs', labId, 'export-jobs', jobId);
const job = await getDoc(jobRef);
const latency = Date.now() - startTime;
console.log(`Poll latency: ${latency}ms`);
```

**Acceptance criteria:**

- [ ] P50 latency: <50ms
- [ ] P95 latency: <150ms
- [ ] P99 latency: <300ms

**Measurement method:**

1. Create test job in Firestore emulator
2. Poll job document 100 times with `getDoc()`
3. Measure latencies
4. Verify within criteria

**If latency exceeds gate:**

- ✓ Firestore location: Use regional instance (southamerica-east1)
- ✓ Network: Check emulator is on localhost (not remote)
- ✓ Load: Reduce poll frequency if bottleneck (but 150ms is ample)

---

**Gate 3: Analytics Cache Subscription Latency**

**Requirement:** React hook `useAnalytics` receives Firestore updates in <100ms.

**Test scenario:**

```typescript
// Hook subscribes via onSnapshot
const startTime = Date.now();
const unsubscribe = onSnapshot(cacheRef, (doc) => {
  const latency = Date.now() - startTime;
  console.log(`Subscription latency: ${latency}ms`);
});
```

**Acceptance criteria:**

- [ ] First snapshot: <100ms
- [ ] Update notifications: <50ms
- [ ] No memory leaks (unsubscribe cleans up)

**Measurement method:**

1. Create test cache document
2. Subscribe with `onSnapshot`
3. Measure time to first snapshot
4. Update document and measure notification latency
5. Verify within criteria

---

### 2.2 Cloud Function Performance

**Gate 1: Scheduled Analytics Function**

**Requirement:** `aggregateAnalytics` scheduled function completes in <30 seconds for typical deployment (1-10 labs).

**Measurement method:**

1. Deploy function to emulator
2. Manually trigger function
3. Measure execution time from logs:
   ```
   [Analytics] Hourly aggregation started — 2026-05-05T12:00:00Z
   [Analytics] ✓ Lab lab-001: cached metrics — 2026-05-05T12:00:03Z
   [Analytics] ✓ Lab lab-002: cached metrics — 2026-05-05T12:00:06Z
   [Analytics] Aggregation completed in 6123ms
   ```

**Acceptance criteria:**

- [ ] Function completes in <30 seconds
- [ ] Per-lab processing: <5 seconds per lab (scales linearly)
- [ ] No timeout errors (function timeout: 300s)
- [ ] No OOM errors (memory: 256MB, sufficient)

**If performance fails:**

- [ ] Optimize aggregation query: Use index, add date range filter
- [ ] Batch process labs: Split into smaller batches if >20 labs
- [ ] Cache results: Store in Firestore cache document (already done)

---

**Gate 2: Export Callable Response Time**

**Requirement:** `initiateExport` callable returns immediately (<100ms) with jobId.

**Measurement method:**

```bash
time curl -X POST http://localhost:5001/hmatologia2/southamerica-east1/initiateExport \
  -H "Content-Type: application/json" \
  -d '{"labId":"test-lab","format":"xlsx","startDate":"2026-01-01","endDate":"2026-05-04"}'
```

**Acceptance criteria:**

- [ ] Response time: <100ms
- [ ] HTTP 200 status
- [ ] JSON response with jobId, status, etc.

**If performance fails:**

- [ ] Check Cloud Function invocation time (should be <50ms)
- [ ] Check Firestore write time (document creation <50ms)
- [ ] Check network latency (localhost should be <10ms)

---

**Gate 3: Export Worker Processing**

**Requirement:** Worker function processes 1000-row export in <60 seconds.

**Measurement method:**

1. Create test job with 1000 CIQ runs
2. Publish to Pub/Sub
3. Worker processes and uploads XLSX
4. Measure end-to-end time

**Acceptance criteria:**

- [ ] Data query: <10 seconds
- [ ] XLSX generation: <20 seconds
- [ ] Cloud Storage upload: <20 seconds
- [ ] **Total: <60 seconds**
- [ ] No timeout (function timeout: 540s, comfortable)

**If performance fails:**

- [ ] Optimize data query: Add index, filter by date range
- [ ] Optimize XLSX generation: Stream rows instead of loading all in memory
- [ ] Optimize Cloud Storage upload: Use multipart upload for large files

---

### 2.3 Mobile Performance

**Gate 1: Mobile App Startup Time**

**Requirement:** App boots to HomeScreen in <3 seconds after launch.

**Measurement method:**

1. Force close app
2. Tap app icon to launch
3. Measure time from tap to HomeScreen visible
4. Use iOS Profiler: Xcode → Product → Profile → App Launch

**Acceptance criteria:**

- [ ] Cold start: <3 seconds
- [ ] Hot start: <1 second
- [ ] Time to interactive: <2 seconds
- [ ] No splash screen stuck

**If performance fails:**

- [ ] Check Firebase initialization: Move to `useEffect`, not render
- [ ] Check Zustand store hydration: Verify AsyncStorage not blocking
- [ ] Check bundle size: Ensure <5MB uncompressed

---

**Gate 2: Analytics Dashboard Load Time**

**Requirement:** Analytics metrics load and render in <2 seconds.

**Measurement method:**

1. Navigate to Analytics screen
2. Measure time from tap to metrics visible
3. Monitor Firestore `onSnapshot` timing

**Acceptance criteria:**

- [ ] Initial load: <2 seconds
- [ ] Re-renders (after data update): <500ms
- [ ] No UI jank (60 FPS scrolling)

**If performance fails:**

- [ ] Check Firestore query: Verify index used
- [ ] Check React render: Use React Profiler, look for expensive components
- [ ] Check AsyncStorage: Might be blocking if large cache

---

**Gate 3: Export Job Polling (No Network Impact)**

**Requirement:** Polling job status doesn't impact battery or network.

**Acceptance criteria:**

- [ ] Poll interval: ≥2 seconds (not aggressive)
- [ ] Firestore reads per poll: 1 document (efficient)
- [ ] No exponential backoff (linear retry)
- [ ] Unsubscribe after job completes (cleanup)

---

### 2.4 Bundle Size Gates

**Web App Bundle**

**Requirement:** Web app production build <850KB gzip.

**Measurement method:**

```bash
npm run build
du -sh dist/assets/
gzip -c dist/assets/*.js | wc -c
```

**Acceptance criteria:**

- [ ] Total dist/ size: <2MB uncompressed
- [ ] Main JS bundle: <500KB gzip
- [ ] Total with CSS/HTML: <850KB gzip

**Breakdown (example for 800KB gzip total):**

- React + Router: ~150KB
- Firebase SDK: ~200KB
- Zustand: ~5KB
- UI components: ~100KB
- App code: ~200KB
- Other (Tailwind, deps): ~145KB

**If bundle size exceeds:**

- [ ] Check for unused dependencies: `npm audit`
- [ ] Code split by route: `React.lazy()` for feature modules
- [ ] Lazy load images: `loading="lazy"` on `<img>`
- [ ] Remove unused Tailwind: Configure purge in `tailwind.config.js`

---

**Mobile App Bundle**

**Requirement:** React Native app <50MB uncompressed (iOS/Android combined).

**Measurement method:**

```bash
cd hc-quality-mobile
npm run build:ios
ls -lh dist/hc-quality-mobile.ipa
```

**Acceptance criteria:**

- [ ] IPA (iOS): <30MB
- [ ] APK (Android): <25MB
- [ ] No unused native modules

---

### 2.5 Web Vitals Gates (Core Web Vitals)

**Requirement:** All pages meet Core Web Vitals targets.

**Metrics:**
| Metric | Target | Gate |
|--------|--------|------|
| LCP (Largest Contentful Paint) | <2.5s | GOOD |
| INP (Interaction to Next Paint) | <200ms | GOOD |
| CLS (Cumulative Layout Shift) | <0.1 | GOOD |

**Measurement method:**

1. Use Lighthouse CI:

   ```bash
   npm install -g @lhci/cli@latest
   lhci autorun --config=.lightningrc.json
   ```

2. Or manually in Chrome:
   - F12 → Lighthouse → Run audit
   - Mobile mode
   - Check Core Web Vitals section

**Acceptance criteria:**

- [ ] LCP: <2.5s (should be <1.5s ideally)
- [ ] INP: <200ms (should be <100ms ideally)
- [ ] CLS: <0.1 (should be <0.05 ideally)
- [ ] Performance score: ≥85

**If gates fail:**

**LCP >2.5s:**

- [ ] Check image sizes: Serve optimized images
- [ ] Check critical CSS: Inline above-fold CSS
- [ ] Check JavaScript: Defer non-critical JS

**INP >200ms:**

- [ ] Check JavaScript execution: Profile in DevTools
- [ ] Check layout shifts: Add `width/height` to images
- [ ] Check input handling: Debounce event handlers

**CLS >0.1:**

- [ ] Check layout shifts: Use `aspect-ratio` for images
- [ ] Check ads/embeds: Reserve space before loading
- [ ] Check fonts: Use `font-display: swap`

---

### 2.6 Security Gates

**Gate 1: No Cross-Lab Data Access**

**Requirement:** Multi-tenant isolation enforced at all layers.

**Test method:**

```typescript
// Test: User logged into Lab A tries to query Lab B
const labAToken = await loginAs('user@lab-a');
const labBJobs = await fetch(`/api/jobs?labId=lab-b`, {
  headers: { Authorization: `Bearer ${labAToken}` },
});
expect(labBJobs.status).toBe(403); // Forbidden
```

**Acceptance criteria:**

- [ ] Firestore rules block cross-lab reads
- [ ] Cloud Function callables validate auth token lab scope
- [ ] No data leaked in error messages
- [ ] Tests cover: 5+ cross-lab scenarios

---

**Gate 2: Input Validation**

**Requirement:** All user inputs validated server-side.

**Test method:**

```typescript
// Test: Invalid export format rejected
const response = await initiateExport({
  labId: 'lab-001',
  format: 'invalid-format',
  startDate: '2026-01-01',
  endDate: '2026-05-04',
});
expect(response.error).toBeDefined();
expect(response.status).toBe(400);
```

**Acceptance criteria:**

- [ ] Format validation: whitelist ['xlsx', 'pdf', 'csv']
- [ ] Date range validation: startDate < endDate, range <= 1 year
- [ ] All inputs validated before use in queries
- [ ] No SQL/NoSQL injection possible

---

**Gate 3: Signed URL Expiry**

**Requirement:** Cloud Storage signed URLs expire after 7 days.

**Verification:**

```typescript
// Check URL generation code
const url = admin
  .storage()
  .bucket()
  .file(path)
  .getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
```

**Acceptance criteria:**

- [ ] Expiry: 7 days (604800 seconds)
- [ ] No indefinite URLs
- [ ] Tests verify expiry enforced

---

## 3. Performance Testing Checklist

### 3.1 Pre-Testing Setup

- [ ] Firestore indices deployed (section 1.3)
- [ ] Firebase emulator running (or GCP dev environment)
- [ ] Test data seeded (50k+ docs for analytics)
- [ ] Cloud Functions compiled and deployed
- [ ] Mobile app built for testing
- [ ] Performance monitoring tools available:
  - [ ] Xcode Profiler (iOS)
  - [ ] Chrome DevTools (Web)
  - [ ] Firebase Cloud Logging (Functions)

### 3.2 Testing Execution

| Gate               | Test               | Target   | Result | Pass/Fail |
| ------------------ | ------------------ | -------- | ------ | --------- |
| Analytics Query    | <2s for 50k docs   | <2000ms  | —      |           |
| Export Polling     | <150ms per poll    | <150ms   | —      |           |
| Cache Subscription | <100ms first       | <100ms   | —      |           |
| Scheduled Function | <30s processing    | <30000ms | —      |           |
| Callable Response  | <100ms response    | <100ms   | —      |           |
| Worker Processing  | <60s for 1000 rows | <60000ms | —      |           |
| App Startup        | <3s cold start     | <3000ms  | —      |           |
| Analytics Load     | <2s dashboard      | <2000ms  | —      |           |
| Bundle Size (Web)  | <850KB gzip        | <850KB   | —      |           |
| LCP Score          | <2.5s              | <2500ms  | —      |           |
| INP Score          | <200ms             | <200ms   | —      |           |
| CLS Score          | <0.1               | <0.1     | —      |           |

### 3.3 Results & Sign-Off

- [ ] All gates passed
- [ ] No regressions vs baseline
- [ ] Performance data logged for future comparison
- [ ] Performance Engineer approval: [Name] — [Date]

---

## 4. Rollback / Remediation

If any gate fails:

1. **Identify root cause:**
   - Missing index? Deploy from section 1.3
   - Slow query? Check EXPLAIN plan in Firestore Console
   - Memory leak? Profile with DevTools
   - Bundle bloat? Run code coverage analysis

2. **Fix:** Implement optimization

3. **Re-test:** Run affected gate again

4. **Document:** Record fix in WAVE2-PERFORMANCE-FIXES.md

5. **Re-assess:** Confirm no new regressions

---

**Created:** 2026-05-05
**Owner:** Performance Engineer / Engineering Lead
**Status:** Ready for Wave 2 validation
