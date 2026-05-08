# Wave 3 Agent 4 — Phase 6 Art. 22 RT Presence Enforcement

**Proposed Changes for RDC 978/2025 Art. 22 Compliance**

---

## Overview

RDC 978 Art. 22 mandates that the Responsável Técnico (RT) be **continuously present during critical QC operations**. This proposal implements a presence-gating mechanism structurally identical to Art. 122 (supervisor presence in turnos), but scoped to RT role and applied to three critical write paths:

1. **Threshold approval** (`criticos/thresholds/` create/update)
2. **Bioquimica CIQ runs** (`bioquimica/runs/` create/update)
3. **CEQ external submissions** (`ceq/submissions/` create/update)

---

## Deliverables

### 1. Cloud Functions Callables

**Module:** `functions/src/modules/rt-presence/`

- **`rtPresenceCheckin`** — RT checks in (starts active session)
  - Input: `{ labId: string }`
  - Output: `{ ok: true, checkedInAt: ISO timestamp, sessionId: string }`
  - Writes to `/labs/{labId}/rt-presenca/current`: `{ hasActiveRT: true, rtId, rtNome, rtCrbm, sessionId, checkedInAt, expiresAt: now + 8h }`
  - Appends to `/labs/{labId}/rt-presenca-events/{eventId}`: chain-hashed audit entry `{ tipo: 'checkin', operadorId, rtUid, sessionId, timestamp, chainHash }`
  - Audit log: `[RT_PRESENCA_CHECKIN]` with labId, rtUid, sessionId

- **`rtPresenceCheckout`** — RT checks out (ends active session)
  - Input: `{ labId: string, sessionId: string }`
  - Output: `{ ok: true, checkedOutAt: ISO timestamp, duration: minutes }`
  - Verifies caller uid === rtId in current status doc
  - Verifies sessionId matches stored session
  - Updates status: `{ hasActiveRT: false, rtId: null, checkedOutAt }`
  - Appends to presenca-events: chain-hashed `{ tipo: 'checkout', duration, ...}`
  - Audit log: `[RT_PRESENCA_CHECKOUT]` with duration

**Validators (shared):**
- `assertRtPresenceAccess(auth, labId)` — validates:
  1. User authenticated
  2. Has `modules['rt-presence'] === true` claim
  3. Is active member of lab
  4. Member role is `'rt'`
- `rtPresenceStatusDoc(db, labId)` — path helper for current status
- `rtPresenceEventsCol(db, labId)` — path helper for event audit trail
- `generateSessionId(labId, rtUid, nowMs)` — format: `rt-<labId>-<rtUid>-<timestamp>`

**Access Control:**
- Fail-closed: caller must have RT role; non-RT members cannot check in/out
- Audit trail: all operations logged with precise timestamps + chain hashing (identical to turnos pattern)

---

### 2. Firestore Rules

#### Helper Function

Add to firestore.rules **helpers section** (alongside `hasActiveSupervisor`):

```firestore
// hasActiveRT(labId) — RDC 978/2025 Art. 22 enforcement.
// Reads /labs/{labId}/rt-presenca/current (server-only cache;
// rtPresenceCheckin / rtPresenceCheckout maintain it).
// FAIL-CLOSED: if the cache doc doesn't exist, returns false and blocks
// critical operations. Each lab must bootstrap an rt-presenca doc
// before deploy via the one-shot migration script.
// SuperAdmin bypass remains for incident response.
function hasActiveRT(labId) {
  let statusPath = /databases/$(database)/documents/labs/$(labId)/rt-presenca/current;
  return exists(statusPath)
    && get(statusPath).data.hasActiveRT == true;
}
```

#### Rules Blocks

Add to firestore.rules **after supervisor-status sections**:

```firestore
// ── /criticos/thresholds — RDC 978 Art. 22 gate ─────────────────────────
// Approval of new quality thresholds requires RT presence.
match /criticos/{labId}/thresholds/{thresholdId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('criticos'));
  
  // RDC 978 Art. 22: create/update thresholds require active RT.
  allow create, update: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('criticos') && hasActiveRT(labId));
  
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}

// ── /bioquimica/runs — RDC 978 Art. 22 gate ───────────────────────────
// New CIQ runs (quantitative biomarkers) require RT presence.
match /bioquimica/{labId}/runs/{runId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('bioquimica'));
  
  // RDC 978 Art. 22: create runs require active RT.
  allow create: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('bioquimica') && hasActiveRT(labId));
  
  allow update: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && (isAdminOrOwner(labId) || hasActiveRT(labId)));
  
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}

// ── /ceq/submissions — RDC 978 Art. 22 gate ────────────────────────────
// External quality control submissions require RT presence.
match /ceq/{labId}/submissions/{submissionId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('ceq'));
  
  // RDC 978 Art. 22: create submissions require active RT.
  allow create: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('ceq') && hasActiveRT(labId));
  
  allow update: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && (isAdminOrOwner(labId) || hasActiveRT(labId)));
  
  allow delete: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
}

// ── /labs/{labId}/rt-presenca (status cache) ────────────────────────────
match /labs/{labId}/rt-presenca/{document=**} {
  // Read: lab admin, RT, or auditor
  allow read: if isActiveMemberOfLab(labId) &&
    (request.auth.token.role == 'RT' ||
     request.auth.token.role == 'auditor' ||
     isAdminOrOwner(labId));
  
  // Create/Update: Cloud Function only (not client)
  allow create, update: if false;
  
  // Delete: never (soft-delete only)
  allow delete: if false;
}

// ── /labs/{labId}/rt-presenca-events (audit trail) ─────────────────────
match /labs/{labId}/rt-presenca-events/{eventId} {
  // Read: lab admin, RT, or auditor
  allow read: if isActiveMemberOfLab(labId) &&
    (request.auth.token.role == 'RT' ||
     request.auth.token.role == 'auditor' ||
     isAdminOrOwner(labId));
  
  // Create: Cloud Function only
  allow create: if false;
  
  // Update/Delete: never (immutable audit trail)
  allow update, delete: if false;
}
```

---

### 3. Firestore Collections

#### `/labs/{labId}/rt-presenca/current`

Cache doc for current RT active status (server-side only; callables maintain it).

**Schema:**
```typescript
{
  labId: string;
  hasActiveRT: boolean;
  rtId: string | null;           // UID of checked-in RT
  rtNome: string | null;         // Snapshot of colaborador.nome
  rtCrbm: string | null;         // Snapshot of colaborador.crbm
  sessionId: string | null;      // Unique session identifier
  checkedInAt: Timestamp | null;
  expiresAt: Timestamp | null;   // Automatic expiry after 8 hours
  checkedOutAt: Timestamp | null;
  atualizadoEm: Timestamp;
}
```

#### `/labs/{labId}/rt-presenca-events/{eventId}`

Immutable audit trail of check-in/out events.

**Schema:**
```typescript
{
  tipo: 'checkin' | 'checkout';
  operadorId: string;            // UID who triggered the event
  rtUid: string;                 // UID of the RT
  sessionId: string;             // Link to session
  durationMs?: number;           // checkout only
  timestamp: Timestamp;
  chainHash: string;             // SHA256, size == 64
  chainHashAnterior: string | null;
}
```

---

### 4. Firestore Indexes

Create composite indexes for efficient querying:

#### Index 1: rt-presenca-events — status + createdAt

```yaml
collection: labs/{labId}/rt-presenca-events
fields:
  - field: tipo
    direction: ASCENDING
  - field: timestamp
    direction: DESCENDING
```

**Reason:** For audit queries ("all checkout events for lab X in date range Y")

#### Index 2: rt-presenca-events — rtUid + timestamp (optional)

```yaml
collection: labs/{labId}/rt-presenca-events
fields:
  - field: rtUid
    direction: ASCENDING
  - field: timestamp
    direction: DESCENDING
```

**Reason:** For per-RT audit reports (not urgent; can defer to Phase 7)

---

## Deployment Order

1. **Firestore rules**: Deploy helper `hasActiveRT()` + new collections match blocks
   ```bash
   firebase deploy --only firestore:rules --project hmatologia2
   ```

2. **Firestore indexes**: Create indexes via Console or Terraform
   ```bash
   firebase deploy --only firestore:indexes --project hmatologia2
   ```

3. **Migration**: Initialize `/labs/{labId}/rt-presenca/current` for each active lab
   ```bash
   # Runs as part of post-deploy checklist; see `PHASE_6_MIGRATION_RT_BOOTSTRAP.md`
   node scripts/bootstrap-rt-presenca.js
   ```

4. **Cloud Functions**: Deploy callables
   ```bash
   firebase deploy --only functions:rtPresenceCheckin,functions:rtPresenceCheckout --project hmatologia2
   ```

5. **Verification**:
   - RT can check in → status doc updated
   - RT can check out → session validated, duration logged
   - Non-RT cannot check in → permission-denied
   - Rules gate writes to criticos/bioquimica/ceq without active RT

---

## Fail-Closed Behavior

**By design, this implementation fails closed:**

- If `/labs/{labId}/rt-presenca/current` **does not exist**, `hasActiveRT()` returns `false`
- If `hasActiveRT()` returns `false`, all writes to gated collections are **blocked**
- This is intentional: better to block operations than to skip validation

**Recovery (incident response):**
- SuperAdmin can bypass with `isSuperAdmin()` in all gated rules
- Callable can be invoked directly to re-initialize status doc
- For sustained outage: roll back rules to pre-Art.22 version

---

## Integration Points

### 1. Cloud Functions Export

Add to `functions/src/index.ts`:

```typescript
// rt-presence callables (RDC 978 Art. 22)
import { rtPresenceCheckin, rtPresenceCheckout } from './modules/rt-presence';

export const rtPresenceCheckin = region('southamerica-east1').onCall(rtPresenceCheckin);
export const rtPresenceCheckout = region('southamerica-east1').onCall(rtPresenceCheckout);
```

### 2. Portal-RT Web UI (separate Wave)

Not in scope for this task. Portal-RT (phase TBD) will wire:
- "Check In" button → calls `rtPresenceCheckin({ labId })`
- "Check Out" button → calls `rtPresenceCheckout({ labId, sessionId })`
- Session status display → reads from cache doc (read-only)

Buttons only visible to logged-in RT users in their active lab.

### 3. Modules Claim Provisioning

Ensure all active RT users have `modules['rt-presence'] = true` before deploy.

```bash
firebase functions:secrets:set PROVISION_MODULES_SCRIPT="..." --project hmatologia2
node scripts/provision-modules-rt-presence.js
```

---

## Testing

**Unit tests (10 tests minimum):**
- ✓ rtPresenceCheckin: happy path (checkin succeeds, status updated, sessionId valid)
- ✓ rtPresenceCheckin: denies non-RT role
- ✓ rtPresenceCheckin: denies inactive colaborador
- ✓ rtPresenceCheckin: denies missing module claim
- ✓ rtPresenceCheckin: denies unauthenticated
- ✓ rtPresenceCheckout: happy path (checkout succeeds, duration logged)
- ✓ rtPresenceCheckout: denies wrong RT (different uid)
- ✓ rtPresenceCheckout: denies wrong sessionId
- ✓ rtPresenceCheckout: denies when no active presence
- ✓ rtPresenceCheckout: denies when never initialized

**Emulator rules test (Phase 6 integration):**
- Query `/criticos/{labId}/thresholds/` create blocked without hasActiveRT
- Query `/bioquimica/{labId}/runs/` create blocked without hasActiveRT
- Query `/ceq/{labId}/submissions/` create blocked without hasActiveRT

---

## Compliance Mapping

| Requisito | Implementação | Status |
|-----------|---|---|
| RDC 978 Art. 22 — RT continuous presence | rtPresenceCheckin + rules gate | ✓ Proposto |
| DICQ 4.1.2.7 — Supervisor/RT logging | Chain-hashed events + timestamps | ✓ Proposto |
| Audit trail retention | `/rt-presenca-events/` immutable | ✓ Proposto |
| Fail-closed enforcement | Rules block without `hasActiveRT` | ✓ Design |

---

## Notes

1. **Session expiry**: Set to 8 hours; can be tuned per lab via metadata if needed (Phase 7+).
2. **Cleanup cron**: Expired sessions auto-cleaned via scheduled function (deferred to Wave 3.5).
3. **Chain hashing**: Identical to supervisor-presenca; ensures audit trail integrity (RN-PRESENCA-05 analog).
4. **SuperAdmin bypass**: Preserved for incident response; logged separately.

---

## Acceptance Criteria

- [ ] Callables deploy with no errors
- [ ] Rules deploy with no blocking errors
- [ ] Indexes created in Firestore Console
- [ ] 10 unit tests all passing
- [ ] Rules emulator tests pass (gated writes blocked without hasActiveRT)
- [ ] One commit: `feat(rt-presence): Phase 6 Art. 22 RT presence enforcement (W3-4)`

