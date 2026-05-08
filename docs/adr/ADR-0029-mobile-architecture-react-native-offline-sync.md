# ADR-0029 — Mobile Architecture: React Native vs. Flutter, Offline Sync & Biometric Auth (Phase 7)

**Status:** Accepted  
**Date:** 2026-05-08  
**Decided by:** CTO (drogafarto)  
**Related:** ADR-0009 (react-19-typescript-58-version-lock), Phase 3.3 Mobile (completed), Phase 7 kickoff (July 2026)

---

## Context

Phase 7 (July 2026) ships the production mobile app. Current Phase 3.3 implementation uses React Native with NativeWind dark theme + Expo, Detox E2E testing, and biometric auth integration (fingerprint + Face ID on iOS, fingerprint on Android).

The question is: **should we continue with React Native (current trajectory), or evaluate Flutter as an alternative?** Each has tradeoffs:

- **React Native:** code-sharing with web (both use React), proven TypeScript support, existing codebase momentum
- **Flutter:** better performance (native Dart VM), superior offline sync, simpler state management (Provider/Riverpod), cleaner UI composition

This ADR documents the decision to **continue React Native** for Phase 7, with offline sync powered by Firestore's Persistence SDK + custom sync queue.

---

## Problem

Current v1.3 web architecture is **React 19 + TypeScript 5.8 + Zustand 5 + Firebase 12**. Phase 3.3 mobile started with **React Native + Expo + NativeWind**, mirroring web stack.

**Two viable paths:**

**(A) React Native (current)**
- Pros: Code sharing with web (shared `hooks/`, `types/`, `services/`), team expertise, proven TypeScript stack
- Cons: Bridge overhead (React Native → native), performance lag vs. Flutter, offline sync more complex (requires custom queue)

**(B) Flutter (alternative)**
- Pros: Superior performance (Dart native VM), built-in offline sync (Hive + local caching), cleaner async/await, single language for all layers
- Cons: Team ramp-up time, no code sharing with React web, new testing infrastructure (Flutter test + Detox alternative), DICQ compliance validation needed

**Constraints:**
- Phase 7 launch: July 2026 (8 weeks from now)
- Team size: 3 engineers (web-focused, limited mobile experience)
- DICQ compliance mandatory: audit trail, data integrity, encryption for PII
- Offline usage critical: lab staff must work in WiFi-dead zones

**Question:** Stay the course (React Native) or pivot (Flutter)?

---

## Decision

**We adopt React Native with custom offline sync queue for Phase 7.** Here's why:

### 1. React Native Rationale

**Code Sharing (Critical for small team):**

```typescript
// Shared across web + mobile
// src/hooks/useLoadResult.ts
export const useLoadResult = (resultId: string) => {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, `labs/${labId}/laudos/${resultId}`),
      (doc) => {
        setResult(doc.data());
        setLoading(false);
      },
      (err) => { setError(err); setLoading(false); }
    );
    return unsub;
  }, [resultId, labId]);

  return { result, loading, error };
};

// Mobile: import { useLoadResult } from '../../src/hooks/useLoadResult';
// Web: import { useLoadResult } from '@/hooks/useLoadResult';
```

**Momentum:** Phase 3.3 already has:
- Biometric auth (fingerprint + Face ID via `react-native-biometrics`)
- Dark theme (NativeWind)
- Detox E2E (5 critical flows tested)
- Firebase SDK integrated

**Time-to-launch:** Restarting in Flutter would delay Phase 7 by 4–6 weeks (learning curve, test suite rewrite, compliance validation).

### 2. Offline Sync Architecture

**Problem with naive Firebase:** Firestore Offline Persistence (on-device SQLite cache) works, but:
- Limited to Firestore's automatic persistence (no custom conflict resolution)
- Writes queued locally are blindly replayed online (can fail if data changed server-side)
- No audit trail of offline-written documents (DICQ 4.4 requirement)

**Solution: Custom Offline Sync Queue**

```typescript
// src/features/mobile/hooks/useOfflineSync.ts

interface OfflineOp {
  id: string; // UUID
  docPath: string; // e.g., 'labs/lab123/laudos/456'
  operation: 'create' | 'update' | 'softDelete';
  payload: any;
  operatorUid: string;
  timestamp: number; // Local time
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  error?: string;
  serverTimestamp?: number; // When server confirmed
}

export const useOfflineSync = () => {
  const syncQueue = useRef<OfflineOp[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [conflicts, setConflicts] = useState<OfflineOp[]>([]);

  // 1. Queue write (offline-first)
  const queueWrite = async (
    docPath: string,
    operation: 'create' | 'update' | 'softDelete',
    payload: any
  ) => {
    const op: OfflineOp = {
      id: uuidv4(),
      docPath,
      operation,
      payload,
      operatorUid: auth.currentUser?.uid || '',
      timestamp: Date.now(),
      syncStatus: 'pending',
    };

    syncQueue.current.push(op);

    // Save to AsyncStorage (for persistence across app restarts)
    await AsyncStorage.setItem('offlineQueue', JSON.stringify(syncQueue.current));

    // Optimistically update local state (UI feels responsive)
    applyOptimisticUpdate(op);

    // Trigger sync if online
    if (isNetworkOnline()) {
      await performSync();
    }
  };

  // 2. Perform sync (when online)
  const performSync = async () => {
    setSyncStatus('syncing');

    for (const op of syncQueue.current.filter(o => o.syncStatus === 'pending')) {
      try {
        // Call Cloud Function (server-side conflict resolution)
        const result = await syncOfflineOpCallable({
          op,
          baselineServerTimestamp: op.serverTimestamp, // For optimistic locking
        });

        if (result.conflict) {
          // Server detected conflict (e.g., someone else wrote this doc since offline write)
          op.syncStatus = 'conflict';
          setConflicts([...conflicts, op]);
          logger.warn(`Conflict detected for ${op.docPath}; awaiting user resolution`);
        } else {
          // Success
          op.syncStatus = 'synced';
          op.serverTimestamp = result.serverTimestamp;
          applyOptimisticUpdate(op); // Update UI
        }
      } catch (error) {
        op.syncStatus = 'error';
        op.error = error.message;
        logger.error(`Sync failed for ${op.docPath}:`, error);
      }
    }

    // Persist updated queue
    await AsyncStorage.setItem('offlineQueue', JSON.stringify(syncQueue.current));

    // Update sync status
    if (conflicts.length > 0) {
      setSyncStatus('error');
    } else {
      setSyncStatus('idle');
    }
  };

  // 3. Resolve conflict (user chooses: keep local or accept server version)
  const resolveConflict = async (opId: string, resolution: 'local' | 'server') => {
    const op = syncQueue.current.find(o => o.id === opId);
    if (!op) return;

    if (resolution === 'local') {
      // Retry sync with same payload
      op.syncStatus = 'pending';
      await performSync();
    } else {
      // Discard local changes; fetch server version
      const docRef = doc(db, op.docPath);
      const serverDoc = await getDoc(docRef);
      applyOptimisticUpdate({ ...op, payload: serverDoc.data() });
      op.syncStatus = 'synced';
      await AsyncStorage.setItem('offlineQueue', JSON.stringify(syncQueue.current));
    }

    setConflicts(conflicts.filter(c => c.id !== opId));
  };

  return {
    queueWrite,
    performSync,
    resolveConflict,
    syncStatus,
    conflicts,
  };
};
```

**Server-Side Callable (Conflict Resolution):**

```typescript
// functions/src/modules/mobile/syncOfflineOpCallable.ts

export const syncOfflineOpCallable = onCall(
  async (data: {
    op: OfflineOp;
    baselineServerTimestamp?: number;
  }, context) => {
    const { op, baselineServerTimestamp } = data;
    const docRef = doc(db, op.docPath);

    try {
      // 1. Fetch server version
      const serverDoc = await getDoc(docRef);
      const serverTimestamp = serverDoc.exists() ? serverDoc.data().lastModified : 0;

      // 2. Conflict detection: if server has changed since offline write, it's a conflict
      if (baselineServerTimestamp && serverTimestamp > baselineServerTimestamp) {
        return {
          conflict: true,
          serverData: serverDoc.data(),
          serverTimestamp,
        };
      }

      // 3. No conflict: apply offline write
      if (op.operation === 'create') {
        await setDoc(docRef, {
          ...op.payload,
          offlineCreated: true,
          offlineCreatedAt: new Timestamp.fromDate(new Date(op.timestamp)),
          lastModified: serverTimestamp(),
        });
      } else if (op.operation === 'update') {
        await updateDoc(docRef, {
          ...op.payload,
          offlineUpdated: true,
          offlineUpdatedAt: new Timestamp.fromDate(new Date(op.timestamp)),
          lastModified: serverTimestamp(),
        });
      } else if (op.operation === 'softDelete') {
        await updateDoc(docRef, {
          deletadoEm: new Timestamp.fromDate(new Date(op.timestamp)),
          offlineDeleted: true,
          lastModified: serverTimestamp(),
        });
      }

      // 4. Log audit trail (RDC 978 Art. 5.3)
      await auditLog('offline_sync_completed', {
        docPath: op.docPath,
        operation: op.operation,
        offlineTimestamp: op.timestamp,
        serverTimestamp,
        operatorUid: context.auth.uid,
      });

      return {
        conflict: false,
        serverTimestamp,
      };
    } catch (error) {
      logger.error(`Sync failed for ${op.docPath}:`, error);
      throw new HttpsError('internal', `Sync error: ${error.message}`);
    }
  }
);
```

### 3. Biometric Authentication

Integrate with native biometric APIs:

```typescript
// src/features/mobile/hooks/useBiometricAuth.ts

import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

export const useBiometricAuth = () => {
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'faceID' | null>(null);

  useEffect(() => {
    const checkBiometrics = async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (compatible && enrolled) {
        setBiometricAvailable(true);

        // Detect type
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('faceID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        }
      }
    };

    checkBiometrics();
  }, []);

  const authenticateWithBiometric = async (): Promise<boolean> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        disableDeviceFallback: false,
        reason: 'Authenticate to access HC Quality',
        fallbackLabel: 'Use passcode',
      });

      if (result.success) {
        // Retrieve stored session token from SecureStore
        const sessionToken = await SecureStore.getItemAsync('sessionToken');
        if (sessionToken) {
          // Verify token with server
          const isValid = await verifySessionTokenCallable({ token: sessionToken });
          if (isValid) {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      logger.error('Biometric authentication failed:', error);
      return false;
    }
  };

  const enrollBiometric = async (sessionToken: string): Promise<boolean> => {
    try {
      // Store session token securely
      await SecureStore.setItemAsync('sessionToken', sessionToken);
      // Client-side consent: user taps "Enable Biometric"
      await SecureStore.setItemAsync('biometricConsent', 'true');
      return true;
    } catch (error) {
      logger.error('Biometric enrollment failed:', error);
      return false;
    }
  };

  return {
    biometricAvailable,
    biometricType,
    authenticateWithBiometric,
    enrollBiometric,
  };
};
```

### 4. Data Encryption & PII Handling

```typescript
// src/features/mobile/utils/encryptionUtils.ts

import { encryptBytes, decryptBytes } from 'react-native-rsa-native';

// On-device encryption for PII (patient names, CPFs)
export const encryptPII = async (plaintext: string, publicKey: string): Promise<string> => {
  return encryptBytes(plaintext, publicKey);
};

export const decryptPII = async (ciphertext: string, privateKey: string): Promise<string> => {
  return decryptBytes(ciphertext, privateKey);
};

// Firebase rule-level encryption (fields are encrypted in Firestore)
export const getPIIFieldsFromResult = (result: any): string[] => {
  const encryptedFields = ['patientName', 'patientCpf', 'patientPhone'];
  return encryptedFields.filter(field => result[field]);
};
```

**Firestore Rules (PII Access Control):**

```firestore
match /labs/{labId}/laudos/{docId} {
  // Read: only if user is analyst or RT on this lab
  allow read: if isActiveMemberOfLab(labId) &&
              (request.auth.token.role == 'analyst' ||
               request.auth.token.role == 'RT' ||
               request.auth.token.role == 'admin');
  
  // Create: client callable (via offline sync)
  allow create: if isActiveMemberOfLab(labId) &&
                   request.resource.data.labId == labId &&
                   request.resource.data.operatorId == request.auth.uid;
  
  // Update: client callable (via offline sync)
  allow update: if isActiveMemberOfLab(labId) &&
                   resource.data.labId == labId;
  
  // Soft-delete only
  allow delete: if false;
}
```

### 5. Performance Targets (React Native on Android/iOS)

| Metric | Target | Mechanism |
|---|---|---|
| **App launch** | <2s | Code splitting, lazy module loading |
| **Result list load** | <1s (10 results) | Firestore offline cache, pagination |
| **Sync latency** | <5s (online), instant (offline) | Optimistic updates + background sync |
| **Memory** | <150 MB (at-rest) | Efficient state management (Zustand) |
| **Battery drain** | <5% per hour (idle) | Disable logging, optimize Firebase SDK usage |

---

## Alternatives Considered

**(A) Continue React Native (what this ADR chooses)**
- **Pros:** Code sharing with web, team expertise, proven TypeScript
- **Cons:** Performance lag, custom offline sync (dev effort)
- **Selected because:** Timeline (Phase 7 July 2026), team constraints, early momentum

**(B) Pivot to Flutter**
- **Pros:** Better performance, built-in offline sync, cleaner state management
- **Cons:** Team ramp-up (4–6 weeks), code-sharing loss, compliance validation needed
- **Rejected because:** Phase 7 timeline (8 weeks), team has zero Flutter experience

**(C) Hybrid (React Native + native modules for sync)**
- **Rejected as redundant.** We're already using native modules (biometrics). Custom Firestore sync queue provides same effect.

**(D) Web PWA only (no native app)**
- **Rejected.** Biometric auth and offline sync require native capabilities (not available in web PWA on Android/iOS).

---

## Consequences

### Phase 3.3 → Phase 7 Continuity

**Carry forward from Phase 3.3:**
- React Native + Expo setup
- NativeWind dark theme
- Biometric auth integration (fingerprint + Face ID)
- Detox E2E test suite (5 critical flows)

**Phase 7 New Work (July 2026):**
- [ ] Custom offline sync queue (AsyncStorage + Firestore Persistence)
- [ ] Server-side sync callable (conflict detection + audit trail)
- [ ] Conflict resolution UI (user chooses: keep local or sync server version)
- [ ] PII encryption on-device (RSA for sensitive fields)
- [ ] Performance profiling (memory, battery, app launch)
- [ ] Expanded E2E tests (20+ flows covering offline scenarios)
- [ ] DICQ compliance review (audit trail for offline writes, encryption)
- [ ] Biometric enrollment UX (one-time setup on login)

### Positive

- **Code sharing:** leverage shared hooks/services/types (React 19 web ↔ React Native mobile)
- **Time-to-launch:** Phase 3.3 momentum carries into Phase 7 (no rewrite)
- **Team expertise:** team already knows React + TypeScript + Firebase
- **Compliance-ready:** offline writes include audit trail + operator ID tracking
- **User experience:** offline-first UI (responsive, works in dead zones)

### Negative

- **Custom implementation:** offline sync queue not as polished as Flutter's built-in Hive
- **Bridge overhead:** React Native ↔ native (fingerprint, biometric) has latency (~50–100ms per call)
- **Performance tuning:** likely need native module optimization for large result sets (>1000 items)
- **Testing complexity:** E2E tests must cover offline scenarios (conflict resolution, sync retry)

### Cost (Phase 7)

- Development: 3 engineers, 4 weeks (offline sync + biometric + testing)
- Performance profiling + native optimization: 1 week
- Compliance audit (DICQ review): 1 week
- Total: 6 weeks (within Phase 7 scope)

---

## Operational Checklist

- [ ] **Phase 7 Sprint (July 2026):**
  - [ ] Finalize offline sync queue architecture (AsyncStorage + Firestore)
  - [ ] Implement `useOfflineSync` hook + `syncOfflineOpCallable` function
  - [ ] Implement conflict resolution UI + flow
  - [ ] Implement PII encryption (on-device RSA)
  - [ ] Firestore rules: restrict PII access to analyst+RT+admin
  - [ ] Biometric enrollment UX (one-time setup)
  - [ ] Expand E2E tests: 20+ flows (online, offline, conflict scenarios)
  - [ ] Performance profiling: measure memory, battery, app launch time
  - [ ] Security audit: Secure Store + encryption validation
  - [ ] DICQ compliance: audit trail for offline writes, operator tracking
  - [ ] Cloud Logs monitoring: watch for sync callable errors
  - [ ] Manual testing: offline scenario (flight mode → sync → resolve conflicts)

- [ ] **Phase 7 Pre-Deployment (July 20):**
  - [ ] Generate signed APK + iOS build (TestFlight)
  - [ ] Beta testing: 5 lab users, 1 week offline scenarios
  - [ ] Performance validation: LCP <2s, memory <150 MB, battery impact <5%/hour
  - [ ] Compliance sign-off: DICQ audit trail validation
  - [ ] Security review: Secure Store, encryption key rotation, PII handling

---

## References

- **Phase 3.3 Mobile (Complete):** NativeWind + biometric + Detox baseline
- **ADR-0009:** React 19 + TypeScript 5.8 version lock (applies to mobile as well)
- **Firebase Offline Persistence:** Firestore docs on on-device caching
- **Expo Secure Store:** `expo-secure-store` for biometric tokens
- **React Native Biometrics:** `expo-local-authentication` + `react-native-biometrics`
- **`.planning/CLOUD_LOGS_PHASE_4-9_SETUP.md`** — Phase 7 monitoring checkpoints
- **RDC 978 Art. 5.3** — Audit trail requirement for offline writes
- **DICQ 4.4** — Record integrity + immutability (applies to offline-written docs)

---

**Version:** 1.0  
**Last Updated:** 2026-05-08  
**Status:** Ready for Phase 7 implementation (July 2026)
