# Phase 4 Feature Flag Strategy — Gradual NOTIVISA Rollout

**Effective Date:** 2026-05-20 (Phase 4 Launch)  
**Rollout Window:** May 20 → June 10, 2026 (3 weeks)  
**Final Status:** 100% rollout (all labs NOTIVISA-enabled by June 10)  
**Region:** `southamerica-east1`  
**Compliance:** RDC 978 Art. 41 (ANVISA adverse event notification)

---

## Overview

This document defines the feature flag system for gradual, safe rollout of NOTIVISA integration to production labs. Flags are stored in Firestore and evaluated server-side (Cloud Functions) and client-side (Portal UI).

**Philosophy:** Rollout is **capability-gated**, not user-gated. All labs can access the UI, but submission to ANVISA is controlled by a percentage-based flag that increases over time.

---

## Feature Flags Architecture

### Flag Storage Location

**Firestore Collection:** `/featureFlags/{flagId}`

```typescript
interface FeatureFlag {
  id: string; // e.g., "notivisa-rollout"
  name: string; // Human-readable name
  enabled: boolean; // Global on/off
  rolloutPercentage: number; // 0–100; % of labs with the feature
  rolloutBuckets: {
    // Lab assignment strategy
    type: 'percentage' | 'labIds';
    labIdWhitelist?: string[]; // If type='labIds'
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string; // uid of operator
  config: Record<string, any>; // Feature-specific config (timeout, retries, etc)
}
```

### Flag Evaluation

**Client-Side (React Portal):**

```typescript
// Hook: useFeatureFlag
const isNotivisaEnabled = useFeatureFlag('notivisa-rollout');
// → Shows NOTIVISA UI only if enabled for this lab

// Callable: Can user submit?
const canSubmitToAnvisa = (labId: string) => {
  const flag = getFeatureFlagSync('notivisa-rollout');
  return flag.enabled && labBelongsToRolloutBucket(labId, flag.rolloutPercentage);
};
```

**Server-Side (Cloud Functions):**

```typescript
// Callable: submitNotivisa
const shouldAllowSubmission = async (labId: string) => {
  const flag = await getFeatureFlag('notivisa-rollout');
  if (!flag.enabled) return false;

  // Hash labId to deterministic bucket (0–100)
  const bucket = hashLabIdToBucket(labId, 100);
  return bucket < flag.rolloutPercentage;
};
```

---

## Rollout Schedule

### Week 1 (May 20–26): Pilot — 0% → 25%

**May 20 (08:30 UTC-3):**

- Deploy Phase 4 code
- Set flag: `enabled = true`, `rolloutPercentage = 0%`
- Status: **Code live, feature OFF**
- Action: Monitor system health with zero user impact

**May 22:**

- Enable for **internal labs only** (whitelist: `["lab-internal-test-1", "lab-internal-test-2"]`)
- Status: **Internal testing active**
- Validation: Submit 5 adverse events to sandbox ANVISA, verify receipt codes

**May 24 (14:00 UTC-3):**

- Roll out to **25% of production labs** (by hash)
- Set flag: `enabled = true`, `rolloutPercentage = 25%`
- Labs affected: ~3 labs (if ~12 total labs active)
- Status: **Quarter rollout**
- Monitor: Alert channels live, on-call watching 24/7

### Week 2 (May 27–June 2): Gradual Expansion — 25% → 50%

**May 29 (10:00 UTC-3):**

- Roll out to **50% of production labs**
- Set flag: `enabled = true`, `rolloutPercentage = 50%`
- Labs affected: ~6 labs
- Status: **Half rollout**
- Validation: Ensure queue processing latency <100ms p95, error rate <0.5%

### Week 3 (June 3–9): Final Push — 50% → 100%

**June 6 (10:00 UTC-3):**

- Roll out to **100% of production labs**
- Set flag: `enabled = true`, `rolloutPercentage = 100%`
- Status: **Full rollout**
- Action: Archive flag strategy, begin post-deployment stabilization

---

## Feature Flag Management

### Creating & Updating Flags

**Create Flag (Firestore):**

```bash
curl -X POST "https://firestore.googleapis.com/v1/projects/hmatologia2/databases/(default)/documents/featureFlags" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "id": { "stringValue": "notivisa-rollout" },
      "name": { "stringValue": "NOTIVISA Gradual Rollout" },
      "enabled": { "booleanValue": true },
      "rolloutPercentage": { "integerValue": 25 },
      "rolloutBuckets": {
        "mapValue": {
          "fields": {
            "type": { "stringValue": "percentage" }
          }
        }
      },
      "createdAt": { "timestampValue": "2026-05-20T08:30:00Z" },
      "updatedAt": { "timestampValue": "2026-05-20T08:30:00Z" },
      "updatedBy": { "stringValue": "cto-user-id" },
      "config": {
        "mapValue": {
          "fields": {
            "maxRetries": { "integerValue": 5 },
            "timeoutMs": { "integerValue": 30000 },
            "apiEndpoint": { "stringValue": "https://anvisa-sandbox.gov.br" }
          }
        }
      }
    }
  }'
```

**Update Flag (Set rollout percentage):**

```bash
# Via Firestore CLI or GCP Console
# Update document: /featureFlags/notivisa-rollout
# Field: rolloutPercentage = 50
```

### Access Control

**Firestore Rules:**

```firestore
match /featureFlags/{flagId} {
  // Read: anyone can read to evaluate client-side
  allow read: if request.auth != null;

  // Write: admin only (CTO + on-call manager)
  allow create, update: if isAdmin(request.auth.uid);
  allow delete: if false; // Never delete, only disable
}

function isAdmin(uid) {
  return get(/databases/$(database)/documents/admins/$(uid)).data.role == 'admin';
}
```

---

## Bucketing Strategy

### Deterministic Lab Assignment

Each lab is assigned to a **percentage bucket** (0–100) using a hash function. This ensures:

- Same lab always belongs to the same bucket
- Rollout is proportional (25% rollout = bottom 25 buckets)
- No additional Firestore queries needed (hash is local)

**Implementation:**

```typescript
import crypto from 'crypto';

export function hashLabIdToBucket(labId: string, maxBucket: number): number {
  // SHA-256(labId) → hex → first 8 chars as uint32 → modulo
  const hash = crypto.createHash('sha256').update(labId).digest('hex');
  const uint32 = parseInt(hash.substring(0, 8), 16);
  return uint32 % maxBucket;
}

// Example:
hashLabIdToBucket('lab-001', 100); // → 42 (lab is in 42nd percentile)
// If rollout = 50%, lab-001 is NOT in rollout (42 < 50 = true, so IS in rollout)
// If rollout = 25%, lab-001 is NOT in rollout (42 < 25 = false)
```

### Whitelist Override

For internal testing, labs can be whitelisted regardless of percentage:

```typescript
export async function isLabInRollout(labId: string, flag: FeatureFlag): Promise<boolean> {
  // 1. Check whitelist first (internal labs)
  if (flag.rolloutBuckets.labIdWhitelist?.includes(labId)) {
    return true;
  }

  // 2. Check percentage bucket
  const bucket = hashLabIdToBucket(labId, 100);
  return bucket < flag.rolloutPercentage;
}
```

---

## Client-Side Flag Evaluation

### React Hook

**File:** `src/features/notivisa-portal/hooks/useFeatureFlag.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export interface FeatureFlag {
  id: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  config: Record<string, any>;
}

export function useFeatureFlag(flagId: string): FeatureFlag | null {
  const { data } = useQuery(
    ['featureFlag', flagId],
    async () => {
      const docRef = doc(db, 'featureFlags', flagId);
      const snapshot = await getDoc(docRef);
      return snapshot.data() as FeatureFlag;
    },
    { staleTime: 60000 }, // Cache 1 minute (cheap to refresh)
  );

  return data || null;
}
```

### Portal UI Integration

**File:** `src/features/notivisa-portal/NotivisaPortal.tsx`

```typescript
export function NotivisaPortal() {
  const flag = useFeatureFlag('notivisa-rollout');
  const { labId } = useAuth();
  const canSubmit = flag?.enabled && (bucket < flag.rolloutPercentage);

  if (!flag?.enabled) {
    return (
      <div className="p-6 bg-yellow-50 rounded-lg border border-yellow-200">
        <h2>NOTIVISA Feature Coming Soon</h2>
        <p>This feature is not yet available. Check back later.</p>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h2>NOTIVISA Staged Rollout</h2>
        <p>Your lab is enrolled in the next rollout phase. Expected date: [DATE]</p>
      </div>
    );
  }

  return <NotivisaDraftForm />;
}
```

---

## Server-Side Flag Evaluation

### Cloud Function: Check Before Submission

**File:** `functions/src/modules/notivisa/callables/submitNotivisa.ts`

```typescript
import { getFeatureFlag, isLabInRollout } from '../utils/featureFlags';

export const submitNotivisa = functions
  .region('southamerica-east1')
  .onCall(async (request): Promise<SubmitNotivisaOutput | SubmitNotivisaError> => {
    try {
      const { labId, draftId } = request.data;

      // ========== Check feature flag ==========
      const flag = await getFeatureFlag('notivisa-rollout');

      if (!flag?.enabled) {
        return {
          ok: false,
          code: 'FEATURE_DISABLED',
          message: 'NOTIVISA submission is not yet enabled for your lab.',
        };
      }

      const inRollout = await isLabInRollout(labId, flag);
      if (!inRollout) {
        return {
          ok: false,
          code: 'NOT_IN_ROLLOUT',
          message: 'Your lab is not yet in the NOTIVISA rollout phase. Expected date: TBD',
        };
      }

      // ========== Proceed with submission ==========
      // (rest of function logic)
    } catch (error) {
      // Error handling
    }
  });
```

### Helper: Get Feature Flag

**File:** `functions/src/modules/notivisa/utils/featureFlags.ts`

```typescript
import * as admin from 'firebase-admin';
import crypto from 'crypto';

const db = admin.firestore();

export interface FeatureFlag {
  id: string;
  enabled: boolean;
  rolloutPercentage: number;
  rolloutBuckets: {
    type: 'percentage' | 'labIds';
    labIdWhitelist?: string[];
  };
  config: Record<string, any>;
}

export async function getFeatureFlag(flagId: string): Promise<FeatureFlag | null> {
  try {
    const docRef = db.collection('featureFlags').doc(flagId);
    const snapshot = await docRef.get();
    return (snapshot.data() as FeatureFlag) || null;
  } catch (error) {
    console.error(`Error fetching feature flag ${flagId}:`, error);
    return null;
  }
}

export function hashLabIdToBucket(labId: string, maxBucket: number = 100): number {
  const hash = crypto.createHash('sha256').update(labId).digest('hex');
  const uint32 = parseInt(hash.substring(0, 8), 16);
  return uint32 % maxBucket;
}

export async function isLabInRollout(labId: string, flag: FeatureFlag): Promise<boolean> {
  // Whitelist check
  if (flag.rolloutBuckets?.labIdWhitelist?.includes(labId)) {
    return true;
  }

  // Percentage bucket check
  const bucket = hashLabIdToBucket(labId, 100);
  return bucket < flag.rolloutPercentage;
}
```

---

## Monitoring Feature Flag State

### Dashboard Widget: Flag Status

**Add to Dashboard 2 (NOTIVISA Queue Health):**

```
Title: Feature Flag Status
Metrics:
  - Flag enabled: [Yes/No]
  - Rollout percentage: [25% / 50% / 100%]
  - Labs in rollout: [N / total]
  - Last updated: [timestamp]
  - Updated by: [uid]

Query:
SELECT
  enabled,
  rolloutPercentage,
  updatedAt,
  updatedBy
FROM `hc_quality.cloud_logs.featureFlags`
WHERE id = 'notivisa-rollout'
LIMIT 1
```

### Alert: Flag State Changes

**Alert Policy: Feature Flag Modified**

```
Condition: Any write to /featureFlags/notivisa-rollout
Threshold: Immediate (1 occurrence)
Severity: P2 (informational)
Notification: #production-alerts Slack
Message: "Feature flag updated: [previous % → new %] by [uid]"
```

---

## Rollback via Feature Flag

If issues detected during rollout, **disable the flag without touching code:**

```typescript
// Update Firestore document
db.collection('featureFlags').doc('notivisa-rollout').update({
  enabled: false,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedBy: 'incident-commander-uid',
});

// Immediate effect:
// - All submitNotivisa calls return "FEATURE_DISABLED"
// - Portal UI shows "Coming Soon" message
// - NO code rollback needed
// - Existing queue jobs continue processing (safe)
```

**Time to disable:** <1 minute (no deployment)  
**Time to re-enable:** <1 minute (no code changes)

---

## Decision Framework: When to Advance Percentage

### Pre-Rollout Checklist

Before advancing to next percentage tier:

- [ ] Current percentage running for ≥48 hours
- [ ] 0 unhandled exceptions in Cloud Logs (P0/P1 clean)
- [ ] NOTIVISA queue latency <100ms p95
- [ ] Submission success rate >95%
- [ ] No new auth/permission errors
- [ ] On-call engineer confirms stability
- [ ] CTO approves advancement

### Metrics to Monitor During Rollout

| Metric                   | Target        | Alert Threshold |
| ------------------------ | ------------- | --------------- |
| Submission success rate  | >95%          | <90%            |
| Queue latency (p95)      | <100ms        | >200ms          |
| Error rate               | <0.5%         | >1%             |
| Function cold start      | <1s           | >2s             |
| ANVISA API latency (p95) | <3s           | >5s             |
| Rule rejections          | <5 per minute | >10 per minute  |

---

## Post-Rollout (June 10+)

**Archive feature flag:**

- After 100% rollout and 1-week stability window, mark flag as archived
- Keep flag document for audit trail (set `archived: true`)
- Remove flag checks from UI code (no longer needed)
- Remove flag from callables (feature is permanent)

**Document final state:**

- Log in: `.planning/PHASE_4_ROLLOUT_COMPLETION.md`
- Include: rollout timeline, issues encountered, total submissions processed

---

## Feature Flag Configuration Defaults

```json
{
  "id": "notivisa-rollout",
  "name": "NOTIVISA Gradual Rollout",
  "enabled": true,
  "rolloutPercentage": 25,
  "rolloutBuckets": {
    "type": "percentage",
    "labIdWhitelist": ["lab-internal-test-1", "lab-internal-test-2"]
  },
  "config": {
    "maxRetries": 5,
    "timeoutMs": 30000,
    "apiEndpoint": "https://anvisa-sandbox.gov.br",
    "submissionDeadlineHours": 24,
    "escalationThreshold": {
      "maxFailures": 3,
      "escalateToSupervisor": true
    }
  }
}
```

---

## Troubleshooting

### Flag Not Taking Effect

1. **Check Firestore:** Verify document exists in `/featureFlags/notivisa-rollout`
2. **Check rules:** Ensure Portal has read access to `/featureFlags/*`
3. **Clear cache:** Client-side hook caches 1 minute — wait or hard reload
4. **Verify labId:** Test with lab in current rollout bucket (`hashLabIdToBucket < percentage`)

### Lab Stuck in "Not in Rollout"

1. Check: `hashLabIdToBucket(labId, 100)` value
2. Compare: Is value < current rolloutPercentage?
3. If yes: Lab should be in rollout (check UI cache)
4. If no: Lab will be included in next rollout tier

### Feature Flag Firestore Write Fails

1. Check: Admin rules allow the write (do you have `isAdmin` role?)
2. Check: No concurrent writes (another admin updating simultaneously)
3. Retry: Wait 5 seconds and retry

---

**Next Document:** `PHASE_4_ROLLBACK_PROCEDURES.md` (keep existing; references this flag strategy)  
**Monitoring:** `PHASE_4_MONITORING_INDEX.md` (add flag status widget)  
**Related:** `docs/adr/ADR-0029-feature-flags.md` (optional: architecture record)
