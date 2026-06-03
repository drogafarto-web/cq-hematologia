# Firestore Indexes for Audit Chains

**Purpose:** Define composite indexes required for chain-hash audit collections to ensure sub-second query performance.

**Affected collections:**

- All chain-target collections (e.g., `notas-fiscais`, `criticos-log-eventos`, future audit chains)
- All `-auditFailures` sibling collections (for failure marker queries)

---

## Indexes by operation

### For `cryptoAudit.getPreviousHashInCollection()`

This function queries a chain collection for the most recent entry by `timestamp`:

```typescript
export async function getPreviousHashInCollection(
  collectionPath: string,
  secret: string,
  orderBy: 'timestamp' | 'createdAt' = 'timestamp'
): Promise<string | null> {
  const snapshot = await db
    .collection(collectionPath)
    .orderBy(orderBy, 'desc')
    .limit(1)
    .get();
```

**Required indexes per collection:**

| Collection                            | Index        | Fields      | Order      |
| ------------------------------------- | ------------ | ----------- | ---------- |
| `labs/{labId}/notas-fiscais`          | Single field | `timestamp` | DESCENDING |
| `labs/{labId}/criticos-log-eventos`   | Single field | `timestamp` | DESCENDING |
| `labs/{labId}/compras-chain` (future) | Single field | `timestamp` | DESCENDING |

For most single-field queries on indexed fields, Firestore auto-creates the index. These are listed for completeness.

### For `validateChainIntegrity()` range queries

This function scans a collection in chronological order:

```typescript
const snapshot = await db.collection(collectionPath).orderBy('timestamp', 'asc').get();
```

**Status:** Auto-indexed by Firestore (single-field ascending on `timestamp`).

### For failure marker queries

Auditors query `-auditFailures` collections by timestamp and optional filters:

```typescript
// "Show me all failures in this lab from the last 24h"
await db
  .collection('labs/{labId}/notas-fiscais-auditFailures')
  .where('recordedAt', '>=', Date.now() - 24 * 60 * 60 * 1000)
  .orderBy('recordedAt', 'desc')
  .get();
```

**Required composite indexes:**

| Collection                                        | Index     | Fields            | Purpose                    |
| ------------------------------------------------- | --------- | ----------------- | -------------------------- |
| `labs/{labId}/notas-fiscais-auditFailures`        | Composite | `recordedAt` DESC | Query by failure timestamp |
| `labs/{labId}/criticos-log-eventos-auditFailures` | Composite | `recordedAt` DESC | Query by failure timestamp |

---

## JSON configuration for `firestore.indexes.json`

Add or update `firestore.indexes.json` in the project root:

```json
{
  "indexes": [
    {
      "collectionGroup": "notas-fiscais",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "timestamp",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "criticos-log-eventos",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "timestamp",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "notas-fiscais-auditFailures",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "recordedAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "criticos-log-eventos-auditFailures",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "recordedAt",
          "order": "DESCENDING"
        }
      ]
    }
  ]
}
```

---

## Adding a new chained collection

When you add a new chain-audited module:

1. **Identify your collection path:** e.g., `/labs/{labId}/your-collection`
2. **Add indexes to `firestore.indexes.json`:**

```json
{
  "collectionGroup": "your-collection",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "timestamp",
      "order": "ASCENDING"
    }
  ]
}
```

3. **Add failure marker indexes:**

```json
{
  "collectionGroup": "your-collection-auditFailures",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "recordedAt",
      "order": "DESCENDING"
    }
  ]
}
```

4. **Deploy:**

```bash
firebase deploy --only firestore:indexes --project hmatologia2
```

5. **Wait for Firestore to build indexes** (usually 5–30 minutes, visible in Firebase Console under **Indexes**).

---

## Performance expectations

With proper indexes:

| Collection Size   | Query Latency | Notes                                  |
| ----------------- | ------------- | -------------------------------------- |
| 0–1K documents    | <50ms         | Single field index sufficient          |
| 1K–100K documents | 50–200ms      | Composite indexes recommended          |
| 100K+ documents   | 200ms–2s      | May need pagination or pre-aggregation |

---

## Testing indexes before deployment

### In Firestore emulator (local)

```bash
# Start emulator with indexes loaded
firebase emulators:start --import=.firebase-emulator-exports --export-on-exit

# Run your queries in tests
npm test -- --testPathPattern=audit
```

Emulator automatically creates indexes on-demand; no explicit setup needed.

### In production

```bash
# Check index status
firebase firestore:indexes --project hmatologia2

# After deploy, verify in Firebase Console:
# > Firestore Database > Indexes > Index (creation % visible)
```

---

## Troubleshooting slow queries

If a query is slow (>500ms):

1. **Check if index exists:**

```bash
firebase firestore:indexes --project hmatologia2 | grep "your-collection"
```

2. **If not listed:** Deploy indexes, wait for build.

3. **If listed but still slow:**
   - Check collection size: `SELECT COUNT(*) FROM your-collection WHERE labId = ?`
   - If >1M documents, consider pre-aggregation (summary collection updated hourly).

4. **If indexing is stuck:**
   - Delete index in Firebase Console, redeploy.
   - Report to Firebase support if >48h.

---

## Monitoring index health

Add to `docs/observability/policies/`:

```json
{
  "displayName": "Firestore Index Build Failure",
  "conditions": [
    {
      "displayName": "Index status = FAILED",
      "conditionThreshold": {
        "filter": "resource.type=\"firestore_index\" AND status=\"FAILED\""
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "86400s"
  }
}
```

---

## Index naming convention

Firestore auto-names composite indexes, but for clarity in reviews:

- **Format:** `collectionName-field1-order-field2-order`
- **Example:** `notas-fiscais-timestamp-ASC`

---

**Last updated:** 2026-05-08 (Wave 3 Agent 8)
