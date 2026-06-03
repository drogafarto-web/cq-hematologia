# Firebase Emulator Setup — Phase 3.1

## Emulator Services

Updated in `firebase.json` for Phase 3.1:

| Service         | Port | Purpose                      | Phase 3.1 Use                                                   |
| --------------- | ---- | ---------------------------- | --------------------------------------------------------------- |
| **Auth**        | 9099 | Firebase Auth emulation      | Mobile + Web auth flow testing                                  |
| **Firestore**   | 8080 | Firestore database emulation | Query + write testing (analytics aggregates, export jobs)       |
| **Functions**   | 5001 | Cloud Functions emulation    | Test `initiateExport`, `analyticsAggregation` callables locally |
| **Storage**     | 9199 | Cloud Storage emulation      | Test export file upload + signed URL generation                 |
| **Pub/Sub**     | 8085 | Cloud Pub/Sub emulation      | **NEW** — Test export job queue                                 |
| **Emulator UI** | 4000 | Web dashboard                | Inspect all services state in real-time                         |

---

## Starting the Emulator Suite

```bash
cd C:\hc\ quality
firebase emulators:start --import .firebase/emulator-state --export-on-exit
```

**Output indicators:**

```
✓  auth emulator started at http://localhost:9099
✓  firestore emulator started at http://localhost:8080
✓  functions emulator started at http://localhost:5001
✓  storage emulator started at http://localhost:9199
✓  pubsub emulator started at http://localhost:8085
✓  emulator ui started at http://localhost:4000
```

Then open **http://localhost:4000** in browser to see live dashboard.

---

## Connection in Phase 3.1 Code

### Web (existing pattern, no change for Phase 3.1)

```typescript
// src/core/firebase.ts (web) — already handles emulator
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';

if (process.env.VITE_USE_EMULATOR === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### Mobile (NEW for Phase 3.1)

```typescript
// hc-quality-mobile/src/core/firebase.ts
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';

if (process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  // React Native requires http:// (not https://localhost)
  connectAuthEmulator(auth, 'http://10.0.2.2:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '10.0.2.2', 8080);
  connectFunctionsEmulator(functions, '10.0.2.2', 5001);
}
```

**Note:** Android emulator uses `10.0.2.2` to reach host localhost. iOS simulator uses `localhost` directly.

### Functions (Cloud Function tests)

```typescript
// functions/src/__tests__/export.test.ts
import { initializeAdminApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const adminApp = initializeAdminApp({ projectId: 'test-project' });
const db = getFirestore(adminApp);

// Firestore emulator auto-detected from FIREBASE_DATABASE_EMULATOR_HOST env var
// (set by `firebase emulators:exec`)
```

---

## Phase 3.1 Testing Scenarios

### 1. Mobile Auth Flow (iOS Simulator)

```bash
# Terminal 1: Start emulator
firebase emulators:start

# Terminal 2: Start Xcode iOS simulator
open -a Simulator

# Terminal 3: Start mobile dev server
cd hc-quality-mobile
npm start
```

Then in Simulator: Tap "i" → Select app → Login with test account (emulator auto-creates on auth).

### 2. Analytics Aggregation Function

```bash
# Start emulator, then run test
firebase emulators:exec "npm --prefix functions run test -- analyticsAggregation"
```

In test:

```typescript
// functions/src/modules/analytics/__tests__/aggregation.test.ts
import { onRequest } from 'firebase-functions/v2/https';

describe('analyticsAggregation', () => {
  it('should compute KPIs from runs and store aggregates', async () => {
    // Seed Firestore with test runs
    const db = getFirestore(adminApp);
    await db.collection('labs').doc('test-lab').collection('runs').add({
      labId: 'test-lab',
      testType: 'ciq',
      resultadoObtido: 'válido',
      dataRealizacao: now,
    });

    // Call Cloud Function (emulator)
    const response = await callFunction('analyticsAggregation', {
      labId: 'test-lab',
    });

    // Verify aggregate was written
    const agg = await db
      .collection('labs')
      .doc('test-lab')
      .collection('analytics-aggregates')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    expect(agg.docs[0].data().totalRuns).toBe(1);
  });
});
```

### 3. Export Job Queue (Pub/Sub)

```bash
# Start emulator, then run test
firebase emulators:exec "npm --prefix functions run test -- exportWorker"
```

In test:

```typescript
// functions/src/modules/export/__tests__/worker.test.ts
describe('exportWorker', () => {
  it('should process job from Pub/Sub and upload XLSX', async () => {
    // Create test job in Firestore
    const jobRef = db.collection('labs').doc('test-lab').collection('export-jobs').doc('job-123');
    await jobRef.set({
      status: 'queued',
      format: 'xlsx',
      dateRange: { start: now, end: now },
    });

    // Publish to Pub/Sub (emulator)
    const pubsub = admin.pubsub();
    const topic = pubsub.topic('exports');
    await topic.publish(
      Buffer.from(
        JSON.stringify({
          labId: 'test-lab',
          jobId: 'job-123',
          format: 'xlsx',
          dateRange: { start: now, end: now },
        }),
      ),
    );

    // Wait for worker to process (emulator runs sync)
    // Verify job updated with completed status
    const updated = await jobRef.get();
    expect(updated.data().status).toBe('completed');
    expect(updated.data().signedUrl).toBeDefined();
  });
});
```

---

## State Management

### Saving State Between Sessions

```bash
# Run emulator and auto-save state on exit
firebase emulators:start --import .firebase/emulator-state --export-on-exit
```

This persists:

- All Firestore collections
- Auth user accounts
- Storage files
- Pub/Sub messages (limited history)

**Directory structure:**

```
.firebase/
├── emulator-state/
│   ├── auth_export/
│   ├── firestore_export/
│   └── storage_export/
```

### Clearing State (Fresh Start)

```bash
# Delete saved state
rm -rf .firebase/emulator-state

# Emulator will start with blank slate
firebase emulators:start
```

---

## CI/CD Integration (Phase 3.2+)

Phase 3.1 uses emulator for local development only. Phase 3.2 GitHub Actions tests will use:

```yaml
# .github/workflows/test.yml (Phase 3.2)
- name: Start Firebase Emulator
  run: firebase emulators:start --only=firestore,functions,pubsub &

- name: Wait for Emulator
  run: sleep 3

- name: Run Unit Tests
  run: npm --prefix functions run test

- name: Run E2E Tests (Web)
  run: npm run test:e2e
```

---

## Known Limitations

1. **Pub/Sub ordering**: Emulator does NOT guarantee FIFO ordering (unlike production). Phase 3.1 exports assume single-threaded processing OK; upgrade if needed.
2. **Signed URLs**: Emulator Storage generates signed URLs, but they don't expire (use mock expiry in tests).
3. **Firestore indices**: Emulator auto-indexes; production requires explicit composite indices (already added in `firestore.indexes.json`).
4. **Auth claims**: Emulator auth doesn't verify custom claims; tests must mock auth context.

---

**Created**: 2026-05-05 (Phase 3.1 infrastructure setup)
