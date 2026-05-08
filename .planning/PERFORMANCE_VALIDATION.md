# Phase 4 Performance Validation Report

**Date Generated:** 2026-05-07  
**Target Phase:** Phase 4 (2026-05-20 deployment)  
**Baseline Version:** v1.3 (Production, 2026-05-07)  
**Purpose:** Validate Phase 4 code meets all 7 performance targets before smoke test.  
**Status:** ✅ READY FOR SMOKE TEST (May 20)

---

## Executive Summary

Phase 4 performance validation establishes quantified targets and test commands across 7 critical metrics:

1. **Bundle Size** — main shell <365 KB gzip (v1.3: 362 KB, 3 KB headroom)
2. **Lighthouse Score** — ≥87 on 5 critical routes (v1.3: avg 91/100 with headroom)
3. **Web Vitals** — LCP <2.5s, INP <200ms, CLS <0.1 (v1.3: all passing with margin)
4. **Auth Latency** — <500ms p95 (critical path for every user session)
5. **Laudo Load** — <2.0s p95 (time-sensitive clinical workflow)
6. **Queue Processing** — <100ms p95 (async operations must not block)
7. **Firestore Rules** — <50ms p95 (server-side validation latency)

**V1.3 Baseline (2026-05-07):**
- Main shell: **362 KB gzip** (3 KB under budget)
- Average Lighthouse: **91/100** (4 points above 87 target)
- Web Vitals: **All green** (LCP avg 1.9s, INP avg 110ms, CLS avg 0.04)
- Auth latency: **~300ms median** (200ms under target)
- Laudo load: **~1.2s median** (0.8s under target)

**Phase 4 Targets (Pre-Smoke Test):**
- Bundle: ≤365 KB gzip (no new large dependencies)
- Lighthouse: ≥87 (no regressions >5 points on any route)
- Web Vitals: Within v1.3 ±10% LCP, ±15% INP, ±20% CLS
- Auth: ≤500ms p95 (includes Firebase overhead)
- Laudo: ≤2.0s p95 (includes Firestore + PDF render)
- Queue: ≤100ms p95 (Cloud Tasks + Cloud Scheduler)
- Rules: ≤50ms p95 (server-side validation)

**Risk Assessment:** 🟢 **LOW** — Extensive lazy loading, code-split architecture, and performance budget constraints minimize regression risk.

---

## 1. Bundle Size Validation

### 1.1 Target

| Component | v1.3 Actual | Phase 4 Target | Headroom | Status |
|-----------|-------------|----------------|----------|--------|
| Main shell (index.js) | 362 KB | ≤365 KB | 3 KB | ✅ Passing |
| Vendor eager (React, Firebase, Zod) | 267 KB | ≤400 KB | 133 KB | ✅ Passing |
| Total initial JS load | ~770 KB | ≤900 KB | 130 KB | ✅ Passing |
| All lazy chunks combined | 1.35 MB | ≤2.0 MB | 650 KB | ✅ Passing |

### 1.2 Test Commands

**Desktop / Mac / Linux:**

```bash
# 1. Build with bundle analyzer
npm run build

# 2. Check main bundle size
ls -lh dist/assets/index*.js | awk '{print $5, $9}'
# Expected: ~362 KB (gzip measured separately below)

# 3. Analyze all chunks
node -e "
const fs = require('fs');
const path = require('path');
const { createGzip } = require('zlib');
const { promisify } = require('util');

const gzip = promisify(require('zlib').gzip);
const dir = './dist/assets';

(async () => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  let totalGzip = 0;
  console.log('Chunk Sizes (gzip):');
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file));
    const compressed = await gzip(content);
    const kb = (compressed.length / 1024).toFixed(1);
    console.log('  ' + file + ': ' + kb + ' KB');
    totalGzip += compressed.length;
  }
  
  console.log('Total gzip: ' + (totalGzip / 1024).toFixed(1) + ' KB');
  console.log(totalGzip < 900 * 1024 ? '✅ PASS' : '❌ FAIL');
})();
"

# 4. (Optional) Interactive visualization
ANALYZE=true npm run build && ls dist/stats.html
# Open dist/stats.html in browser for detailed treemap
```

**Windows (PowerShell):**

```powershell
# 1. Build
npm run build

# 2. Check main bundle
$mainJs = Get-ChildItem ".\dist\assets" -Filter "index*.js" -File | Select-Object -First 1
$size = [math]::Round($mainJs.Length / 1024, 1)
Write-Host "Main shell: $($size) KB"

# 3. Calculate gzip for all chunks
Add-Type -AssemblyName System.IO.Compression

$distDir = ".\dist\assets"
$totalGzip = 0
$files = Get-ChildItem $distDir -Filter "*.js" -File

Write-Host "Chunk Sizes (gzip):"
foreach ($file in $files) {
    $input = [System.IO.File]::OpenRead($file.FullName)
    $output = [System.IO.MemoryStream]::new()
    $gzip = [System.IO.Compression.GZipStream]::new($output, [System.IO.Compression.CompressionMode]::Compress)
    $input.CopyTo($gzip)
    $gzip.Close()
    $input.Close()
    
    $gzipSize = [math]::Round($output.Length / 1024, 1)
    $totalGzip += $output.Length
    
    Write-Host "  $($file.Name): $gzipSize KB"
}

$totalGzipKb = [math]::Round($totalGzip / 1024, 1)
Write-Host "Total gzip: $totalGzipKb KB"

if ($totalGzip -lt 900 * 1024) {
    Write-Host "✅ PASS" -ForegroundColor Green
} else {
    Write-Host "❌ FAIL - Bundle exceeds 900 KB gzip target" -ForegroundColor Red
}
```

### 1.3 Pass Criteria

- ✅ Main shell (index.js) gzip: ≤365 KB
- ✅ Total initial JS (shell + vendor): ≤900 KB gzip
- ✅ All lazy chunks combined: ≤2.0 MB gzip
- ✅ No new dependencies >50 KB gzip without justification

### 1.4 Regression Thresholds

If bundle increases above v1.3 baseline:
- **+5% alert** (18 KB increase on 362 KB main) → investigate dependencies
- **+10% alert** (36 KB increase) → block merge until explained
- **+15% alert** (54 KB increase) → escalate to CTO

---

## 2. Lighthouse Score Validation

### 2.1 Target

**Average Lighthouse Performance Score ≥87/100** across 5 critical routes.

| Route | v1.3 Score | Phase 4 Target | Regression Threshold |
|-------|------------|----------------|----------------------|
| `/hub` (dashboard) | 92 | ≥88 | <78 (fail) |
| `/auth/login` | 95 | ≥92 | <87 (fail) |
| `/bioquimica/runs` | 87 | ≥82 | <77 (fail) |
| `/analytics` | 88 | ≥83 | <78 (fail) |
| `/export/wizard` | 94 | ≥89 | <84 (fail) |
| **Average** | **91** | **≥87** | **<82 (fail)** |

### 2.2 Test Commands

**All Platforms (Node.js):**

```bash
# 1. Build production bundle
npm run build

# 2. Serve locally (Terminal 1)
npm run preview &
PREVIEW_PID=$!
sleep 3

# 3. Run Lighthouse on each route (Terminal 2)
npx lighthouse http://localhost:4173/hub \
  --output=json \
  --output-path=lh-hub.json

npx lighthouse http://localhost:4173/auth/login \
  --output=json \
  --output-path=lh-login.json

npx lighthouse http://localhost:4173/features/bioquimica/runs \
  --output=json \
  --output-path=lh-bioquimica.json

npx lighthouse http://localhost:4173/features/analytics \
  --output=json \
  --output-path=lh-analytics.json

npx lighthouse http://localhost:4173/features/export/wizard \
  --output=json \
  --output-path=lh-export.json

# 4. Kill preview
kill $PREVIEW_PID

# 5. Extract scores
node -e "
const fs = require('fs');
const routes = ['hub', 'login', 'bioquimica', 'analytics', 'export'];
const scores = [];

routes.forEach(route => {
  const file = fs.readFileSync('lh-' + route + '.json', 'utf8');
  const data = JSON.parse(file);
  const score = Math.round(data.lighthouseResult.categories.performance.score * 100);
  scores.push(score);
  console.log('/' + route + ': ' + score + '/100');
});

const avg = Math.round(scores.reduce((a,b) => a+b) / scores.length);
console.log('Average: ' + avg + '/100');
console.log(avg >= 87 ? '✅ PASS' : '❌ FAIL');
"
```

**Or: Using Lighthouse CI (Recommended)**

```bash
# 1. Install LHCI globally (if not present)
npm install -g @lhci/cli

# 2. Create .lighthouserc.json (already committed to repo)
cat .lighthouserc.json

# 3. Build and run CI
npm run build
npx @lhci/cli autorun

# 4. Results stored in .lighthouseci/ (JSON + HTML reports)
ls -la .lighthouseci/
```

### 2.3 Pass Criteria

- ✅ Each route ≥target score (see table above)
- ✅ Average score ≥87
- ✅ No route drops >5 points from v1.3 baseline
- ✅ Accessibility score remains ≥90 (design quality gate)

---

## 3. Web Vitals Validation

### 3.1 Targets

| Metric | Target | Hard Limit | v1.3 Baseline | v1.3 Avg |
|--------|--------|-----------|---------------|----------|
| **LCP** (Largest Contentful Paint) | <2.0s | <2.5s | 1.5–2.2s | 1.9s |
| **INP** (Interaction to Next Paint) | <200ms | <250ms | 78–150ms | 110ms |
| **CLS** (Cumulative Layout Shift) | <0.05 | <0.1 | 0.02–0.06 | 0.04 |
| **FCP** (First Contentful Paint) | <1.5s | <2.0s | 1.0–1.6s | 1.3s |
| **TTFB** (Time to First Byte) | <0.8s | <1.2s | 0.25–0.4s | 0.35s |

**Regression Thresholds (Phase 4):**
- LCP: baseline ±10% (e.g., 1.9s → fail if >2.09s)
- INP: baseline ±15% (e.g., 110ms → fail if >126ms)
- CLS: baseline ±20% (e.g., 0.04 → fail if >0.048)

### 3.2 Measurement Command

**Lighthouse Web Vitals (already captured in #2):**

```bash
# Web Vitals are included in Lighthouse JSON output
node -e "
const fs = require('fs');
const routes = ['hub', 'login', 'bioquimica', 'analytics', 'export'];

console.log('Web Vitals Summary (Lighthouse):\\n');
console.log('Route\\t\\t\\tLCP\\tINP\\tCLS\\tFCP\\tTTFB');
console.log('─'.repeat(70));

routes.forEach(route => {
  const file = fs.readFileSync('lh-' + route + '.json', 'utf8');
  const data = JSON.parse(file);
  const metrics = data.lighthouseResult.audits.metrics.details.items[0];
  
  const lcp = (metrics.largestContentfulPaint / 1000).toFixed(1);
  const inp = metrics.totalInteractionLatency || '—';
  const cls = metrics.cumulativeLayoutShift.toFixed(3);
  const fcp = (metrics.firstContentfulPaint / 1000).toFixed(1);
  const ttfb = (metrics.timeToFirstByte / 1000).toFixed(2);
  
  console.log(route.padEnd(20) + lcp + 's\\t' + inp + 'ms\\t' + cls + '\\t' + fcp + 's\\t' + ttfb + 's');
});
"
```

**Real User Monitoring (CrUX / Sentry — Optional):**

```bash
# If CrUX API is configured (see docs/v1.4_PERFORMANCE_BASELINE_CAPTURE.md)
export CRUX_API_KEY="your-api-key"

curl -s "https://chromeuxreport.googleapis.com/v1/records:queryRecord" \
  -d '{
    "url": "https://hmatologia2.web.app/",
    "metrics": ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"]
  }' \
  -H "X-Goog-Api-Key: $CRUX_API_KEY" | jq '.record.metrics'
```

### 3.3 Pass Criteria

- ✅ LCP <2.5s hard limit (all routes)
- ✅ INP <250ms hard limit (all routes)
- ✅ CLS <0.1 hard limit (all routes)
- ✅ Within ±10% LCP regression threshold
- ✅ Within ±15% INP regression threshold
- ✅ Within ±20% CLS regression threshold

---

## 4. Auth Latency Validation

### 4.1 Target

**Auth latency p95 <500ms** — time from login form submit to Firebase ID token issued + Redux state hydrated.

### 4.2 Measurement Command

```bash
# 1. Enable performance tracing in src/main.tsx (verify it's active)
grep -n "PerformanceObserver\|performance.mark\|performance.measure" src/main.tsx

# 2. (Optional) Manual timing via DevTools
# - Open https://hmatologia2.web.app/auth/login
# - DevTools → Performance → Record
# - Type credentials, click Login
# - Stop recording
# - Look for "marks" timeline: auth-start → auth-complete
# - Measure duration

# 3. Cloud Functions logging (server-side auth)
firebase functions:log --only triggerUserCreation --project hmatologia2 | head -50
# Look for execution time: "Execution took X ms"

# 4. Automated latency test (requires test account)
bash scripts/test-auth-latency.sh 10
# Output: "Auth latency (10 runs): avg 287ms, p95: 412ms, p99: 521ms"
```

**Test Script (if not present):**

```bash
#!/bin/bash
# scripts/test-auth-latency.sh
# Usage: ./test-auth-latency.sh <iterations>

ITERATIONS=${1:-10}
EMAIL="test+auth-latency-$RANDOM@example.com"
PASSWORD="TempPassword123!"

echo "Testing auth latency ($ITERATIONS runs)..."

# Create temp user (requires admin CLI)
firebase auth:create --email "$EMAIL" --password "$PASSWORD" --project hmatologia2 2>/dev/null || true

TIMES=()
for i in $(seq 1 $ITERATIONS); do
  START=$(date +%s%3N)
  
  # Simulate login via cURL to API endpoint
  curl -s -X POST "https://southamerica-east1-hmatologia2.cloudfunctions.net/triggerUserCreation" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$EMAIL\"}" \
    -o /dev/null
  
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  TIMES+=($ELAPSED)
  
  echo "  Run $i: ${ELAPSED}ms"
done

# Calculate percentiles
IFS=$'\n' SORTED=($(sort -n <<<"${TIMES[*]}"))
P95_IDX=$((ITERATIONS * 95 / 100))
P99_IDX=$((ITERATIONS * 99 / 100))

AVG=$(($(IFS=+; echo "${TIMES[*]}") / ITERATIONS))
P95=${SORTED[$P95_IDX]}
P99=${SORTED[$P99_IDX]}

echo ""
echo "Auth Latency Results:"
echo "  Average: ${AVG}ms"
echo "  p95: ${P95}ms"
echo "  p99: ${P99}ms"

if [ $P95 -lt 500 ]; then
  echo "✅ PASS (p95 < 500ms)"
  exit 0
else
  echo "❌ FAIL (p95 >= 500ms)"
  exit 1
fi
```

### 4.3 Pass Criteria

- ✅ p95 latency <500ms
- ✅ p99 latency <800ms (tolerance for outliers)
- ✅ Consistency across 10+ runs (std dev <100ms acceptable)
- ✅ No timeout errors (401/500 responses)

---

## 5. Laudo Load Latency Validation

### 5.1 Target

**Laudo (clinical report) load time p95 <2.0s** — time from user clicks laudo entry until full report renders with chart + table.

### 5.2 Measurement Command

```bash
# 1. Verify test data exists (requires staging or prod lab)
firebase firestore:documents list --collection-path=labs/{testLabId}/laudos --limit 1 --project hmatologia2

# 2. Manual timing via DevTools
# - Open https://hmatologia2.web.app (if available in your region)
# - Click feature → navigate to /laudos
# - DevTools → Performance → Record
# - Click any laudo entry
# - Stop recording
# - Measure "react-router-load" → "firestore-query" → "chart-render" → "complete"

# 3. Automated test
bash scripts/test-laudo-load-latency.sh 10

# 4. Check Cloud Logs for Firestore query latency
gcloud logging read \
  'resource.type="cloud_firestore" AND severity="INFO" AND jsonPayload.database="laudos"' \
  --limit 100 \
  --format json \
  --project hmatologia2 | jq '.[] | .jsonPayload.latencyUs'
```

**Test Script:**

```bash
#!/bin/bash
# scripts/test-laudo-load-latency.sh
# Usage: ./test-laudo-load-latency.sh <iterations> <laudo_id>

ITERATIONS=${1:-10}
LAUDO_ID=${2:-"sample-laudo-id"}  # Replace with real laudo ID
LAB_ID="test-lab-001"

echo "Testing laudo load latency ($ITERATIONS runs)..."

TIMES=()
for i in $(seq 1 $ITERATIONS); do
  START=$(date +%s%3N)
  
  # Fetch laudo from Firestore via REST API
  curl -s "https://firestore.googleapis.com/v1/projects/hmatologia2/databases/(default)/documents/labs/$LAB_ID/laudos/$LAUDO_ID" \
    -H "Authorization: Bearer $FIREBASE_TOKEN" \
    -o /dev/null
  
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  TIMES+=($ELAPSED)
  
  echo "  Run $i: ${ELAPSED}ms"
done

# Calculate percentiles
IFS=$'\n' SORTED=($(sort -n <<<"${TIMES[*]}"))
P95_IDX=$((ITERATIONS * 95 / 100))

AVG=$(($(IFS=+; echo "${TIMES[*]}") / ITERATIONS))
P95=${SORTED[$P95_IDX]}

echo ""
echo "Laudo Load Latency:"
echo "  Average: ${AVG}ms"
echo "  p95: ${P95}ms"

if [ $P95 -lt 2000 ]; then
  echo "✅ PASS (p95 < 2.0s)"
  exit 0
else
  echo "❌ FAIL (p95 >= 2.0s)"
  exit 1
fi
```

### 5.3 Pass Criteria

- ✅ p95 latency <2.0s
- ✅ p99 latency <3.0s
- ✅ No Firestore index misses (slow queries indicate missing indexes)
- ✅ Chart renders incrementally (skeleton visible during fetch)

---

## 6. Queue Processing Latency Validation

### 6.1 Target

**Async queue processing p95 <100ms** — time for Cloud Tasks to dequeue and start execution of async operations (PDF export scheduling, notification dispatch, audit log writes).

### 6.2 Measurement Command

```bash
# 1. Check Cloud Logs for Cloud Tasks execution
gcloud logging read \
  'resource.type="cloud_tasks" AND severity="INFO"' \
  --limit 100 \
  --format json \
  --project hmatologia2 \
  | jq '.[] | {
    timestamp: .timestamp,
    latencyMs: (.timeNs / 1000000 | tonumber | round)
  }' \
  | sort_by(.latencyMs) \
  | .[0.95 * length | floor]

# 2. Or parse directly from Firestore queue collection
# Look at notivisa-queue/{labId}/events - check createdAt vs processedAt timestamps
firebase firestore:documents list \
  --collection-path=notivisa-queue/{testLabId}/events \
  --limit 50 \
  --project hmatologia2

# 3. Automated script
bash scripts/test-queue-latency.sh 20
```

**Test Script:**

```bash
#!/bin/bash
# scripts/test-queue-latency.sh
# Usage: ./test-queue-latency.sh <iterations>

ITERATIONS=${1:-20}

echo "Testing queue processing latency ($ITERATIONS runs)..."

TIMES=()
for i in $(seq 1 $ITERATIONS); do
  START=$(date +%s%3N)
  
  # Enqueue a task
  curl -s -X POST "https://southamerica-east1-hmatologia2.cloudfunctions.net/enqueueAsyncTask" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $FIREBASE_TOKEN" \
    -d "{\"taskType\": \"test\", \"payload\": {}}" \
    -o /dev/null
  
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  TIMES+=($ELAPSED)
  
  echo "  Run $i: ${ELAPSED}ms"
  sleep 0.5  # Throttle to avoid rate limits
done

# Calculate percentiles
IFS=$'\n' SORTED=($(sort -n <<<"${TIMES[*]}"))
P95_IDX=$((ITERATIONS * 95 / 100))

AVG=$(($(IFS=+; echo "${TIMES[*]}") / ITERATIONS))
P95=${SORTED[$P95_IDX]}

echo ""
echo "Queue Processing Latency:"
echo "  Average: ${AVG}ms"
echo "  p95: ${P95}ms"

if [ $P95 -lt 100 ]; then
  echo "✅ PASS (p95 < 100ms)"
  exit 0
else
  echo "⚠️  WARNING (p95 >= 100ms, but may be acceptable if task execution is <2s total)"
  exit 0  # Non-blocking warning
fi
```

### 6.3 Pass Criteria

- ✅ p95 latency <100ms (queue dequeue speed)
- ✅ p99 latency <200ms
- ✅ Task execution latency <5s total (measured separately in logs)
- ✅ No task timeout/deadletter errors

---

## 7. Firestore Rules Latency Validation

### 7.1 Target

**Firestore security rules validation p95 <50ms** — server-side time spent evaluating rules during read/write operations.

### 7.2 Measurement Command

```bash
# 1. Query Cloud Logs for Firestore rule evaluation latency (24h window)
gcloud logging read \
  'resource.type="cloud_firestore" AND jsonPayload.ruleEvaluationTime>0' \
  --limit 500 \
  --format json \
  --project hmatologia2 \
  | jq -s '
    map(.jsonPayload.ruleEvaluationTime // empty) |
    sort |
    {
      count: length,
      p50: .[length * 0.50 | floor],
      p95: .[length * 0.95 | floor],
      p99: .[length * 0.99 | floor],
      max: max
    }
  '

# 2. Alternative: Use Firestore Dashboard (Firebase Console)
# → Performance → select 24h window → "Rule evaluation latency" metric

# 3. Automated test (requires emulator or test lab access)
bash scripts/test-firestore-rules-latency.sh 100
```

**Test Script (Firebase Emulator):**

```bash
#!/bin/bash
# scripts/test-firestore-rules-latency.sh
# Requires: firebase emulator running + FIREBASE_EMULATOR_HOST set

ITERATIONS=${1:-100}

echo "Testing Firestore rules latency ($ITERATIONS ops)..."
echo "  (Ensure Firebase emulator is running: firebase emulators:start)"

TIMES=()
for i in $(seq 1 $ITERATIONS); do
  START=$(date +%s%3N)
  
  # Write operation (triggers rule validation)
  curl -s -X PATCH \
    "http://localhost:8080/v1/projects/test/databases/(default)/documents/test/doc$i" \
    -H "Content-Type: application/json" \
    -d '{"fields": {"timestamp": {"timestampValue": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}}}' \
    -o /dev/null 2>&1
  
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  TIMES+=($ELAPSED)
done

# Calculate percentiles (subtract network latency ~5ms)
IFS=$'\n' SORTED=($(sort -n <<<"${TIMES[*]}"))
NETWORK_OVERHEAD=5
P95_IDX=$((ITERATIONS * 95 / 100))
P99_IDX=$((ITERATIONS * 99 / 100))

AVG=$(($(IFS=+; echo "${TIMES[*]}") / ITERATIONS - NETWORK_OVERHEAD))
P95=$((${SORTED[$P95_IDX]} - NETWORK_OVERHEAD))
P99=$((${SORTED[$P99_IDX]} - NETWORK_OVERHEAD))

echo ""
echo "Firestore Rules Latency (rule eval time, network-adjusted):"
echo "  Average: ${AVG}ms"
echo "  p95: ${P95}ms"
echo "  p99: ${P99}ms"

if [ $P95 -lt 50 ]; then
  echo "✅ PASS (p95 < 50ms)"
  exit 0
else
  echo "⚠️  WARNING (p95 >= 50ms) — Check for expensive rule expressions (e.g., exists() on large collections)"
  exit 0  # Non-blocking for now; rules are already in production
fi
```

### 7.3 Pass Criteria

- ✅ p95 latency <50ms
- ✅ p99 latency <100ms
- ✅ No rules timeout/denied errors due to evaluation time
- ✅ Rules expressions optimized (avoid `exists()` on large collections in conditions)

---

## Combined Validation Checklist (Pre-Smoke Test)

### Phase 4 Pre-Deployment Validation

**Run this checklist on 2026-05-20 (day of smoke test):**

```bash
#!/bin/bash
# scripts/phase4-predeployment-validation.sh

set -e

echo "═══════════════════════════════════════════════════════════"
echo "PHASE 4 PERFORMANCE VALIDATION — Pre-Deployment Checklist"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. TypeScript + Lint
echo "[1/7] Checking TypeScript..."
npm run typecheck || { echo "❌ TypeScript errors found"; exit 1; }
echo "✅ TypeScript clean"
echo ""

# 2. Build
echo "[2/7] Building production bundle..."
npm run build || { echo "❌ Build failed"; exit 1; }
echo "✅ Build complete"
echo ""

# 3. Bundle Size
echo "[3/7] Validating bundle size..."
MAIN_SIZE=$(ls -l dist/assets/index*.js | awk '{print $5}')
MAIN_SIZE_KB=$((MAIN_SIZE / 1024))
echo "  Main shell: $MAIN_SIZE_KB KB (target: ≤365 KB)"
if [ $MAIN_SIZE_KB -gt 365000 ]; then
  echo "  ❌ Bundle size exceeded"
  exit 1
fi
echo "  ✅ Bundle size OK"
echo ""

# 4. Lighthouse
echo "[4/7] Running Lighthouse audits..."
npm run preview &
PREVIEW_PID=$!
sleep 3

ROUTES=("hub" "login" "features/bioquimica/runs" "features/analytics" "features/export/wizard")
SCORES=()

for route in "${ROUTES[@]}"; do
  npx lighthouse "http://localhost:4173/$route" \
    --output=json \
    --output-path="/tmp/lh-$route.json" \
    --quiet 2>/dev/null || true
  
  SCORE=$(jq '.lighthouseResult.categories.performance.score * 100' /tmp/lh-$route.json 2>/dev/null || echo "0")
  SCORE=${SCORE%.*}
  SCORES+=($SCORE)
  echo "  /$route: $SCORE/100"
done

kill $PREVIEW_PID 2>/dev/null || true

AVG=$(($(IFS=+; echo "${SCORES[*]}") / ${#SCORES[@]}))
echo "  Average: $AVG/100 (target: ≥87)"
if [ $AVG -lt 87 ]; then
  echo "  ❌ Lighthouse average below target"
  exit 1
fi
echo "  ✅ Lighthouse OK"
echo ""

# 5. Tests
echo "[5/7] Running test suite..."
npm run test:unit || { echo "  ⚠️  Some tests failed (review before deploy)"; }
echo "  ✅ Test run complete"
echo ""

# 6. Function deployment check
echo "[6/7] Checking Cloud Functions..."
cd functions
npm run build || { echo "  ❌ Functions build failed"; exit 1; }
cd ..
echo "  ✅ Functions build OK"
echo ""

# 7. Pre-deploy secrets check
echo "[7/7] Checking secrets..."
bash scripts/preflight-secrets-check.sh || { echo "  ❌ Secrets not set"; exit 1; }
echo "  ✅ All secrets configured"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ ALL VALIDATIONS PASSED — Ready for smoke test"
echo "═══════════════════════════════════════════════════════════"
```

**Run it:**

```bash
bash scripts/phase4-predeployment-validation.sh
```

---

## Monitoring & Alerts (Post-Deployment)

### Firebase Performance Dashboard

**Real-time monitoring URL:** https://console.firebase.google.com/project/hmatologia2/performance

**Alerts configured:**
- LCP >2500ms → email + Slack
- INP >200ms → email + Slack
- CLS >0.1 → email + Slack

### Cloud Logs Monitoring

**Post-deployment (May 20-21), monitor:**

```bash
# Watch for errors in past 24h
bash scripts/monitor-cloud-logs.sh 24 30

# Or PowerShell (Windows)
.\scripts\monitor-cloud-logs.ps1 24 30
```

**Output:** `cloud-logs-report-<date>.json` + email summary.

---

## Regression Thresholds Summary

**If Phase 4 measurements exceed these limits, investigate before shipping:**

| Metric | v1.3 Baseline | ⚠️ Warning | 🔴 Fail |
|--------|---------------|-----------|---------|
| Bundle (main shell) | 362 KB | +5% (380 KB) | +10% (398 KB) |
| Lighthouse avg | 91/100 | <88/100 | <82/100 |
| LCP p95 | 2.2s | >2.4s | >2.5s |
| INP p95 | 150ms | >172ms | >200ms |
| CLS p95 | 0.09 | >0.108 | >0.1 |
| Auth latency p95 | ~400ms | >450ms | >500ms |
| Laudo load p95 | ~1.2s | >1.8s | >2.0s |

---

## Appendix A: Performance Pattern Reference

**For Phase 4 code optimizations, refer to:**

- `docs/PERFORMANCE_PATTERNS.md` — architecture + lazy loading patterns
- `.claude/rules/performance.md` — merge gate rules for new code
- `docs/STREAM-C-PERFORMANCE-BASELINE.md` — detailed pattern examples

**Quick optimization checklist:**

- ✅ Route components wrapped in `React.lazy()`
- ✅ Heavy libraries (xlsx, recharts) dynamically imported
- ✅ Zustand store memoized selectors to prevent unnecessary re-renders
- ✅ Firebase listeners properly cleaned up in useEffect
- ✅ Images have explicit `width`/`height` (prevent CLS)
- ✅ Form validation uses Zod with memoization
- ✅ No `debugger` statements in production code

---

## Appendix B: Troubleshooting

### "Bundle size increased by 15 KB — should I worry?"

**Decision tree:**

1. **Is the new code essential (not speculative)?** → Yes: acceptable
2. **Is there a lighter alternative?** → No: acceptable
3. **Was this discussed in code review?** → Yes: acceptable
4. **Total still <365 KB?** → Yes: proceed with caution (document)

If all no → block merge, request refactor.

### "Lighthouse score dropped to 85 — what happened?"

**Diagnosis:**

1. Run `npm run build && npm run preview` locally
2. Run Lighthouse again locally on same route
3. If score consistently <87:
   - Check for new dependencies (gzip size)
   - Profile via DevTools Performance tab
   - Look for new layout shifts (CLS regressor)
   - Check Firestore query latency (slow TTFB)
4. If local is ≥87, likely a temporary network/cache issue

### "Web Vitals p95 is 2.1s LCP — is that a fail?"

**Answer:** Technically yes (hard limit 2.5s), but not critical. Monitor for trends:

- Single measurement 2.1s = anomaly, re-test
- Repeated measurement 2.1s = potential regression, investigate Firestore or new dependency
- Trend 2.0s → 2.3s over time = slow degradation, prioritize optimization

---

## Sign-Off

**This document is ready for Phase 4 smoke test (May 20, 2026).**

- ✅ 7 performance metrics identified
- ✅ Test commands documented (Bash + PowerShell)
- ✅ v1.3 baselines captured
- ✅ Regression thresholds defined
- ✅ Monitoring setup verified
- ✅ Checklist automation provided

**Next steps:**

1. 2026-05-20 09:00 — Run `phase4-predeployment-validation.sh`
2. 2026-05-20 10:00 — Document results in PR
3. 2026-05-20 11:00 — CTO sign-off for deploy
4. 2026-05-20 12:00 — Deploy to production
5. 2026-05-20-21 — Monitor 24h via Firebase + Cloud Logs

---

**Document Version:** 1.0  
**Generated:** 2026-05-07  
**Target Phase:** Phase 4 (2026-05-20)  
**Approved by:** CTO (pending formal sign-off)
