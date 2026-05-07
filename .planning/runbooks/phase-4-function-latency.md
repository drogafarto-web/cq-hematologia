# Runbook: Function Latency > 2s (p95)

**Alert Name:** `function-latency-degradation`  
**Severity:** P3 — Poor UX (not critical)  
**Response Time SLA:** <4 hours  
**Escalation:** None required (informational)

---

## What This Alert Means

Portal auth or laudo read functions are slow. p95 latency (95th percentile) >2 seconds means 5% of requests are taking >2 seconds. This degrades user experience but doesn't block access.

**Typical causes:**
- Missing Firestore indexes (slow queries)
- Function cold start (first invocation after deploy)
- Firestore quota throttling
- CPU-intensive signature validation

---

## Step 1: Identify Slow Function (5 minutes)

```bash
cd /c/hc\ quality

# Find p95 latency per function
gcloud logging read \
  'resource.type="cloud_function"' \
  --limit=500 --project=hmatologia2 --format=json | \
  jq 'group_by(.labels.functionName) | map({
    name: .[0].labels.functionName,
    p50: (map(.duration) | sort | .[0.50 * length] | round),
    p95: (map(.duration) | sort | .[0.95 * length] | round),
    p99: (map(.duration) | sort | .[0.99 * length] | round),
    count: length
  }) | sort_by(.p95) | reverse'
```

**Expected output:**
```json
[
  { "name": "verifyPatientAuthToken", "p50": 450, "p95": 950, "p99": 1200, "count": 150 },
  { "name": "getPatientLaudos", "p50": 500, "p95": 2100, "p99": 3500, "count": 100 },
  ...
]
```

**Alert threshold:** p95 > 2000ms (2 seconds)

**Slow functions identified:** `getPatientLaudos` (2100ms), others with p95 >2s

---

## Step 2: Determine Bottleneck Type

```bash
# For the slow function, check if it's cold start or warm execution
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="getPatientLaudos"' \
  --limit=100 --project=hmatologia2 --format=json | \
  jq '.[] | {
    timestamp: .timestamp,
    duration: .duration,
    initializationTime: .labels.initializationTime,
    isWarm: (if .labels.initializationTime then "cold" else "warm" end)
  }'
```

**Analysis:**
- **If all slow invocations have high initializationTime:** Cold starts (normal for fresh deploys)
- **If warm execution is slow:** Actual performance issue → Continue to Step 3

### Interpretation

```bash
# Count warm vs cold executions
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="getPatientLaudos"' \
  --limit=100 --project=hmatologia2 --format=json | \
  jq 'group_by(if .labels.initializationTime then "cold" else "warm" end) | \
      map({type: .[0], count: length, avg_duration: (map(.duration) | add / length | round)})'
```

**Expected:**
```json
[
  { "type": "cold", "count": 5, "avg_duration": 2500 },    # Cold starts OK
  { "type": "warm", "count": 95, "avg_duration": 800 }     # Warm execution good
]
```

**If warm execution >2s:** Real performance issue

---

## Step 3: Profile Function Execution

### Option A: Cloud Trace (Best)

```bash
# Get recent traces for slow function
gcloud trace list \
  --filter="name:getPatientLaudos" \
  --limit=10 \
  --project=hmatologia2 | \
  head -5
```

**Analyze slowest trace:**
```bash
gcloud trace describe <trace-id> \
  --project=hmatologia2 | \
  jq '.spans[] | {name: .displayName, duration_ms: (.endTime - .startTime) / 1e6}'
```

**Look for:**
- Which span is slowest?
- Is it Firestore query? JS execution? Network?

### Option B: Add Detailed Logging

If Cloud Trace is not available, add timing logs to function:

```typescript
// functions/src/modules/auth/getPatientLaudos.ts

export const getPatientLaudos = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    const startTotal = Date.now();
    
    console.log(`[PERF] getPatientLaudos START`);
    
    // Firestore query
    const startFS = Date.now();
    const laudosSnap = await db
      .collection('labs').doc(labId)
      .collection('laudos')
      .where('patientId', '==', patientId)
      .get();
    const fsTime = Date.now() - startFS;
    console.log(`[PERF] Firestore query: ${fsTime}ms (docs: ${laudosSnap.size})`);
    
    // Processing
    const startProc = Date.now();
    const laudos = laudosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const procTime = Date.now() - startProc;
    console.log(`[PERF] Processing: ${procTime}ms`);
    
    const totalTime = Date.now() - startTotal;
    console.log(`[PERF] Total: ${totalTime}ms`);
    
    return { data: laudos };
  }
);
```

**Deploy with logging:**
```bash
firebase deploy --only functions:getPatientLaudos --project=hmatologia2
```

**Re-run slow scenario + check logs:**
```bash
gcloud logging read \
  'resource.type="cloud_function" AND \
   labels.functionName="getPatientLaudos" AND \
   textPayload=~"\[PERF\]"' \
  --limit=20 --project=hmatologia2
```

---

## Step 4: Fix Bottleneck

### If Bottleneck is Firestore Query

**Check for missing indexes:**

```bash
# List existing indexes
gcloud firestore indexes composite list --project=hmatologia2

# Or look for index errors in logs
gcloud logging read \
  'textPayload=~"index|Index" AND \
   (textPayload=~"missing|FAILED_PRECONDITION")' \
  --limit=10 --project=hmatologia2
```

**If index is missing:**
1. Create composite index via Firebase Console:
   - Collection: `laudos`
   - Fields: `patientId` (ASC), `criadoEm` (DESC)
   - Index name: auto-generated
   
2. Or create via CLI:
   ```bash
   # Add to firestore.indexes.json:
   {
     "collectionGroup": "laudos",
     "queryScope": "COLLECTION",
     "fields": [
       { "fieldPath": "patientId", "order": "ASCENDING" },
       { "fieldPath": "criadoEm", "order": "DESCENDING" }
     ]
   }
   
   # Deploy indexes
   firebase firestore:indexes create --path=firestore.indexes.json --project=hmatologia2
   ```

3. Wait for index to build (usually <5 minutes)

4. Test query performance (should improve significantly):
   ```bash
   firebase emulators:start --only firestore
   npm run test:performance
   ```

5. Redeploy function:
   ```bash
   firebase deploy --only functions:getPatientLaudos --project=hmatologia2
   ```

**If index exists but query still slow:**
1. Check Firestore quota usage:
   ```bash
   gcloud monitoring read \
     'metric.type="firestore.googleapis.com/document_reads"' \
     --project=hmatologia2 | tail -1
   ```

2. If approaching daily quota (100M reads for hmatologia2):
   - Scale up quota in Firebase Console → Project Settings → Firestore
   - Or optimize query (fewer documents, more specific filter)

**Optimize query:**
```typescript
// Bad: Reads all laudos for patient
const laudos = await db.collection('laudos')
  .where('patientId', '==', patientId)
  .get();  // May read thousands of docs

// Better: Limit results + pagination
const laudos = await db.collection('laudos')
  .where('patientId', '==', patientId)
  .orderBy('criadoEm', 'desc')
  .limit(50)  // Only recent 50
  .get();
```

---

### If Bottleneck is Function CPU

**Check function memory allocation:**

```bash
gcloud functions describe getPatientLaudos \
  --region=southamerica-east1 \
  --project=hmatologia2 | grep -E "availableMemory|timeout"
```

**Expected:**
```
availableMemory: 256MB (default)
```

**If memory is low:**
1. Increase allocation:
   ```bash
   gcloud functions deploy getPatientLaudos \
     --memory=512MB \
     --region=southamerica-east1 \
     --project=hmatologia2
   ```

2. Monitor improvement over 10 minutes

3. If still slow: Optimize code (see below)

**Optimize CPU-intensive operations:**
```typescript
// Slow: Full JSON stringification for large result set
const jsonString = JSON.stringify(largeLaudoArray);  // Could be 10MB+

// Better: Only serialize needed fields
const optimized = largeLaudoArray.map(l => ({
  id: l.id,
  resultado: l.resultado,
  dataLaudo: l.dataLaudo
  // Exclude large nested objects
}));

// Or: Stream response to client instead of buffering
response.setHeader('Content-Type', 'application/x-ndjson');
for (const laudo of largeLaudoArray) {
  response.write(JSON.stringify(laudo) + '\n');
}
response.end();
```

---

### If Bottleneck is Cold Starts

**This is normal — no action needed.**

Cold starts happen for:
- First invocation after fresh deploy
- Function not invoked for >15 minutes (Auto-scaling down)

**Mitigation (optional):**
- Keep-alive pings (call function every 10 min to keep warm)
- Or: Accept 2–3s latency for first request (user experience tradeoff)

---

## Step 5: Validate Fix

```bash
# After fix deployed, monitor new latency
watch -n 30 'gcloud logging read \
  "resource.type=cloud_function AND \
   labels.functionName=getPatientLaudos" \
  --limit=50 --project=hmatologia2 --format=json | \
  jq "map(.duration) | {
    p50: (sort | .[0.50 * length] | round),
    p95: (sort | .[0.95 * length] | round),
    p99: (sort | .[0.99 * length] | round)
  }"'
```

**Success criteria:**
- p95 latency < 1500ms (below alert threshold)
- Sustained for 30 minutes
- No cold-start latency in measurements (exclude first 2 min after deploy)

---

## Post-Incident Checklist

- [ ] Document optimization applied (for team reference)
- [ ] Update function deployment config in `firebase.json` if memory changed
- [ ] Add performance test to CI/CD to prevent regression
- [ ] Update alerts if thresholds need adjustment
- [ ] Notify team of optimization (share timing details)

---

## Performance Tips

**Best practices to prevent latency issues:**

1. **Index coverage:**
   - All frequently-queried fields should be indexed
   - Composite indexes for multi-field filters
   - Run `npm run test:firestore-indexes` before deploy

2. **Query optimization:**
   - Limit results (pagination)
   - Filter early (where clause)
   - Use sub-collections for sharding (if >100k docs)

3. **Caching:**
   - Cache frequently-read data (patient info, lab settings)
   - Use Cloud Memcache if available

4. **Memory tuning:**
   - Start at 512MB for production functions
   - Monitor and scale based on actual usage

5. **Monitoring:**
   - Log timing for each major operation
   - Set up alerts for p95/p99 (not just average)
   - Review quarterly for trends

---

**Last Updated:** 2026-05-07  
**Owner:** Alert Manager + Engineering Team  
**Review Frequency:** Quarterly (or per incident)
