# Stream C: Firebase Performance Monitoring Setup Guide

**Date:** 2026-05-05  
**Project:** hmatologia2  
**Region:** southamerica-east1

---

## Firebase Performance Monitoring Status

### Current State

- **Status:** ✓ Infrastructure deployed
- **Library:** Firebase SDK 10.14.1 (already in dependencies)
- **Initialization:** Configured in `src/lib/firebase-performance.ts`
- **Web Vitals:** Integrated via `src/lib/web-vitals.ts`
- **Custom Traces:** Defined in `src/lib/performance-tracing.ts`

### What's Working

1. **Web Vitals Collection**
   - LCP, INP, CLS, FCP, TTFB automatically measured
   - Reported to Firebase Performance Monitoring
   - Fallback to `navigator.sendBeacon()`

2. **Custom Traces**
   - Module-specific traces defined (POPs, NC, Auditoria, etc)
   - Firestore query tracing ready
   - Auth operation tracing ready

3. **React Integration**
   - Hooks available for component-level tracing
   - Automatic cleanup on unmount
   - Support for custom metrics and attributes

---

## Firebase Console Configuration (Manual Steps)

### Step 1: Access Firebase Console

Go to: https://console.firebase.google.com/project/hmatologia2/performance

**Expected to see:**

- Overview dashboard
- Performance metrics (empty initially)
- Custom traces section (will appear after data arrives)

### Step 2: Enable Real-time Monitoring

1. Click **Settings** (gear icon, top right)
2. Ensure "Performance Monitoring" is **Enabled**
3. Check data retention: Set to **30 days** (default)
4. Save

### Step 3: Configure Alerts

Firebase doesn't have built-in alert UI yet, but we've configured thresholds in code:

**Email Alerts (Future Setup)**

Once Firebase adds alert UI (or use Cloud Monitoring):

1. Go to Cloud Monitoring: https://console.cloud.google.com/monitoring/dashboards
2. Create alert policy:
   - Metric: `firebaseperf.googleapis.com/trace/user_metric`
   - Trace name: `web-vital-LCP`
   - Condition: When value > 3000 (milliseconds)
   - Notification channel: Email

**For now:** Alerts are configured in code; monitor via Sentry or custom logging.

### Step 4: Create Custom Dashboard

1. Go to Cloud Monitoring: https://console.cloud.google.com/monitoring/dashboards
2. Click **+ CREATE DASHBOARD**
3. Name: `HC Quality - Web Vitals`
4. Add charts for:
   - LCP (last 24h, p50/p95/p99)
   - INP (last 24h, p50/p95/p99)
   - CLS (last 24h, p50/p95/p99)
   - Module-specific traces (pops_list_load, nc_open_dialog, etc)

---

## Sending Data to Firebase

### Current Data Flow

```
App Component
    ↓
initWebVitals() [App.tsx]
    ↓
Web Vitals Observers [web-vitals.ts]
    ↓
getPerformance() [firebase-performance.ts]
    ↓
Firebase Performance Monitoring API
    ↓
Firebase Console Dashboard
```

### Verify Data is Being Sent

1. **Browser Network Tab**
   - Open DevTools → Network tab
   - Filter by `firestore` or `googleapis`
   - Look for requests to `firebaseremoteconfig.googleapis.com` or `firebaseinstallations.googleapis.com`

2. **Browser Console**
   - Run: `localStorage.getItem('firebase:previous_websocket_failure')`
   - Should be `null` (no connection errors)

3. **Firebase Console**
   - Go to: https://console.firebase.google.com/project/hmatologia2/performance
   - Wait 5-10 minutes after page load
   - Refresh dashboard
   - Should see metrics appearing

### Manual Test Data Injection

For testing (development only), you can manually send trace data:

```typescript
import { getPerformance } from 'firebase/performance';

const perf = getPerformance();
if (perf) {
  const trace = perf.trace('test_trace');
  trace.putMetric('test_metric', 123);
  trace.putAttribute('test_attr', 'test_value');
  trace.stop();
}
```

---

## Module-Specific Traces (To Implement)

### 1. POPs List (`src/features/sgq/pops`)

**File to modify:** `src/features/sgq/pops/POPsList.tsx` (or equivalent)

```typescript
import { usePerformanceTrace } from '../../../lib/usePerformanceTrace';

function POPsList() {
  const [pops, setPops] = useState([]);
  const trace = usePerformanceTrace('pops_list_load', {
    autoStop: false,
  });

  useEffect(() => {
    // Fetch POPs
    const startTime = Date.now();
    fetchPOPs().then((data) => {
      const latency = Date.now() - startTime;
      trace.recordMetric('query_latency_ms', latency);
      trace.recordMetric('item_count', data.length);
      setPops(data);
    });

    return () => trace.stop();
  }, []);

  return <div className="pops-list">...</div>;
}
```

### 2. NC Dialog (`src/features/sgq/naoConformidade`)

```typescript
import { useInteractionTrace } from '../../../lib/usePerformanceTrace';

function NCDialog() {
  const trace = useInteractionTrace('nc_open_dialog');

  useEffect(() => {
    trace.recordAttribute('dialog_type', 'create_nc');
    return () => trace.stop();
  }, []);

  return <Dialog open={true}>...</Dialog>;
}
```

### 3. Auditoria Checklist (`src/features/sgq/auditoria`)

```typescript
import { useListTrace } from '../../../lib/usePerformanceTrace';

function AuditoriaChecklist({ items }) {
  const trace = useListTrace('audit_checklist_render', items.length, {
    onStop: (metrics) => {
      console.log('Audit checklist rendered:', metrics);
    },
  });

  return <div className="checklist">{items.map(...)}</div>;
}
```

---

## Querying Firebase Performance Data

### Via Firebase Console

1. Go to: https://console.firebase.google.com/project/hmatologia2/performance
2. Select trace or metric
3. Filter by:
   - Time range (1h, 24h, 7d, 30d)
   - Country
   - Device type
   - App version

### Via Cloud Monitoring API (Advanced)

```bash
# List metrics for a project
gcloud monitoring metrics-descriptors list \
  --filter="metric.type:firebaseperf.googleapis.com" \
  --project=hmatologia2

# Query time series data
gcloud monitoring time-series list \
  --filter='metric.type="firebaseperf.googleapis.com/trace/duration"' \
  --interval-start-time="2026-05-05T00:00:00Z" \
  --interval-end-time="2026-05-05T23:59:59Z" \
  --project=hmatologia2
```

---

## Common Issues & Troubleshooting

### Issue: No data in Firebase Console after 30 minutes

**Troubleshooting:**

1. Check that Firebase app is initialized:

   ```typescript
   import app from './config/firebase.config';
   console.log('Firebase app:', app);
   ```

2. Verify performance monitoring is enabled:

   ```typescript
   import { getPerformance } from 'firebase/performance';
   const perf = getPerformance();
   console.log('Performance monitoring:', perf);
   ```

3. Check browser console for errors
4. Verify `.env` file has correct Firebase credentials

### Issue: Traces not appearing in Firebase Console

**Solutions:**

1. Ensure `trace.stop()` is called (required to send data)
2. Check that custom metrics use metric names without spaces
3. Verify attribute values are strings (not numbers)

### Issue: High latency or missing traces

**Possible causes:**

- Network issues
- Firestore auth gate (onAuthStateChanged blocking load)
- Large bundle size delaying app startup
- Missing Firestore indexes

---

## Performance Targets & Thresholds

### Web Vitals Targets

| Metric | Target | Warning | Critical |
| ------ | ------ | ------- | -------- |
| LCP    | <2.5s  | >2.5s   | >3.0s    |
| INP    | <200ms | >200ms  | >300ms   |
| CLS    | <0.1   | >0.1    | >0.25    |
| FCP    | <1.8s  | >1.8s   | >3.0s    |
| TTFB   | <800ms | >800ms  | >1.8s    |

### Custom Trace Targets

| Operation       | Target | Warning | Critical |
| --------------- | ------ | ------- | -------- |
| List Load       | <1s    | >1s     | >1.5s    |
| Dialog Open     | <500ms | >500ms  | >1s      |
| Form Submit     | <2s    | >2s     | >5s      |
| Firestore Query | <500ms | >500ms  | >1s      |

---

## Monitoring Over Time

### Week 2 Goals

- [ ] Baseline metrics collected for all 5 modules
- [ ] Web Vitals dashboard created in Cloud Monitoring
- [ ] Alert thresholds configured
- [ ] Bottlenecks identified and documented

### Week 3 Goals

- [ ] Firestore indexes created
- [ ] React render optimizations applied
- [ ] Re-measure all metrics
- [ ] Document improvements

### Week 4-5 Goals

- [ ] Performance monitoring fully automated
- [ ] Continuous regression testing enabled
- [ ] Alert notifications configured
- [ ] Team documentation complete

---

## Integration with Sentry

For richer context, Firebase Performance data can be integrated with Sentry:

```typescript
import * as Sentry from '@sentry/react';

// Link Firebase trace to Sentry transaction
Sentry.startTransaction({
  name: 'pops_list_load',
  op: 'pageload',
});

// Firebase trace data automatically captured
```

**Already set up in project:** Sentry integration is active (see `src/lib/sentry.ts`)

---

## References

- [Firebase Performance Monitoring Docs](https://firebase.google.com/docs/perf-mod)
- [Firebase Performance API Reference](https://firebase.google.com/docs/reference/js/performance.md)
- [Cloud Monitoring](https://cloud.google.com/monitoring/docs)
- [Web Vitals](https://web.dev/articles/vitals)

---

**Owner:** Stream C Agent  
**Created:** 2026-05-05
