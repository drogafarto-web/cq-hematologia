# Pub/Sub Infrastructure — Phase 3.1

## Topics

### `exports` Topic
- **Purpose**: Job queue for export processing (XLSX, PDF, CSV generation)
- **Message schema**: `{ labId, jobId, format, dateRange, initiatedBy, ts }`
- **Subscriber**: `exportWorker` Cloud Function (Phase 3.1 Wave 1)
- **Retention**: 7 days (Cloud Pub/Sub default)
- **DLQ**: Dead-letter topic `exports-dlq` for failed jobs after 5 retries

### `analytics-refresh` Topic (Optional Phase 3.2)
- **Purpose**: Signal to invalidate cached analytics aggregates
- **Message schema**: `{ labId, aggregateId, refreshedAt }`
- **Subscriber**: Optional webhook or Cloud Function to broadcast to connected clients
- **Current status**: Deferred to Phase 3.2+ (Phase 3.1 uses simple Firestore metadata polling)

---

## Implementation

Pub/Sub topics are created automatically when a Cloud Function subscribes via `onMessagePublished()` in Firebase Functions SDK v2.

**In Phase 3.1 Wave 1 (`exportWorker` scaffold):**

```typescript
// functions/src/modules/export/exportWorker.ts
import { onMessagePublished } from 'firebase-functions/v2/pubsub';

export const exportWorker = onMessagePublished(
  {
    topic: 'exports',
    region: 'southamerica-east1',
    memory: '2GiB',
    timeoutSeconds: 540,
  },
  async (event) => {
    const message = Buffer.from(event.data.message.data, 'base64').toString();
    const { labId, jobId, format, dateRange, initiatedBy } = JSON.parse(message);
    
    // TODO: Implement export generation (Wave 1 scaffold only)
    // - Fetch runs from Firestore with date range filter
    // - Generate XLSX via xlsxGenerator
    // - Upload to Cloud Storage
    // - Update job record with signed URL + status=completed
    // - Audit log: operator + file size + duration
  },
);
```

**Publishing to topic (in `initiateExport` callable):**

```typescript
const admin = require('firebase-admin');
const pubsub = admin.pubsub();

const topic = pubsub.topic('exports');
const messageData = Buffer.from(JSON.stringify({
  labId,
  jobId,
  format,
  dateRange,
  initiatedBy: request.auth.uid,
  ts: admin.firestore.Timestamp.now(),
}));

await topic.publish(messageData);
```

---

## Firestore Job Record

Path: `/labs/{labId}/export-jobs/{jobId}`

```typescript
interface ExportJob {
  jobId: string;
  labId: string;
  format: 'xlsx' | 'pdf' | 'csv';
  dateRange: {
    start: Timestamp;
    end: Timestamp;
  };
  status: 'queued' | 'processing' | 'completed' | 'failed';
  initiatedBy: string; // operatorId
  initiatedAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  error?: string;
  
  // Post-generation
  gsPath?: string; // gs://bucket/exports/{labId}/{jobId}/{filename}
  signedUrl?: string; // 7-day signed download URL
  expiresAt?: Timestamp;
  fileSize?: number; // bytes
  
  // Audit
  assinatura?: {
    hash: string; // HMAC-SHA256 of job + operator
    operatorId: string;
    ts: Timestamp;
  };
}
```

---

## Deployment Order

1. **Phase 3.1 Wave 1**: Create `initiateExport` callable + `exportWorker` scaffold (non-functional, returns TODO)
2. **Phase 3.1 Wave 1**: Unit tests mock Pub/Sub publish + job creation
3. **Phase 3.1 Wave 2**: Deploy to Cloud Functions emulator, verify topic auto-creation
4. **Phase 3.2 Wave 2+**: Implement `exportWorker` generation logic, deploy to production

---

## Testing Locally

Use Firebase Emulator:

```bash
firebase emulators:start --only pubsub,functions
```

In tests:
```typescript
// Simulate Pub/Sub message
const testMessage = {
  labId: 'test-lab',
  jobId: 'job-123',
  format: 'xlsx',
  dateRange: { start: now, end: now },
  initiatedBy: 'operator-1',
  ts: now,
};

// Mock publish
await pubsub.topic('exports').publish(
  Buffer.from(JSON.stringify(testMessage)),
);

// Verify job was created in Firestore (emulator)
const job = await db.collection('labs').doc('test-lab')
  .collection('export-jobs').doc('job-123').get();
expect(job.data().status).toBe('queued');
```

---

**Created**: 2026-05-05 (Phase 3.1 infrastructure setup)
