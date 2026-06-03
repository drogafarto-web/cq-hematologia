# ADR-0020 — Pessimistic Locking for Concurrent Laudo Draft Editing

**Status:** Accepted
**Date:** 2026-05-07
**Decided by:** CTO (drogafarto)
**Related:** ADR-0019 (laudos-draft collection schema)

---

## Context

Phase 7 introduces the laudo draft editing workflow: Result Technicians (RTs) log into the portal, open a laudo (report), edit it, and save draft versions before final publication. Multiple RTs may attempt to edit the same laudo concurrently (e.g., RT-A edits comments, RT-B edits equipment reference at the same time).

Without locking, concurrent edits risk:

1. **Lost writes** — RT-A saves their changes (version 5 → 6), but RT-B simultaneously saves (version 5 → 6 with different content). One write overwrites the other.
2. **Merge ambiguity** — "whose content is canonical after the conflict?" Firestore doesn't have CRDT or automatic conflict resolution; the application must decide.
3. **Audit liability** — RDC 978 Art. 5.3 / DICQ 4.4 require "clear identification of who made each change." Concurrent edits make it unclear which RT's action took precedence.

Three strategies exist:

**(a) Optimistic locking** — attach a `version` field to the draft. On update, check `if currentVersion == expectedVersion` before write. If mismatch, reject and ask user to reload.

- **Pro:** No server-side state. Simple.
- **Con:** High conflict rate if two RTs edit within seconds. User experience is jarring ("your changes were rejected, please reload").

**(b) CRDT (Conflict-Free Replicated Data Type)** — use a library like Yjs or Automerge to merge concurrent edits automatically at the field level.

- **Pro:** No conflicts; users can edit simultaneously without rejection.
- **Con:** Heavy (50+ KB), requires significant refactoring of edit form, RDC 978 audit trail becomes ambiguous ("which part did RT-A change, which part did RT-B?"). Overkill for typical lab workflow (RTs rarely edit the same laudo at the exact same moment).

**(c) Pessimistic locking** — when an RT opens a draft for editing, the system locks it (`locked_until_ts = now + 1 hour`). Only the locking user can edit. Lock auto-expires if the user disconnects. Other users see "locked by RT-A until 15:00" and must wait.

- **Pro:** Zero conflicts. Clear audit trail (exactly one RT owns the draft at a time). Simple mental model.
- **Con:** One RT blocks others; if RT-A walks away without closing the editor, others are blocked for 1 hour. UX requires clear "lock status" messaging.

This ADR documents the choice of **strategy (c) — pessimistic locking**.

---

## Problem

RDC 978 Art. 5.3 mandates "clear identification of the author and date of each record modification." Concurrent writes to the same document violate this principle — the system cannot clearly say "RT-A modified field X at 14:30 and RT-B modified field Y at 14:30.001."

Additionally, lab workflow is predominantly sequential: one RT pulls a result, edits it, saves it, moves on. Concurrent edits of the same laudo are rare (estimated <5% of all draft edits). Optimistic locking adds user friction for a rare case; pessimistic locking blocks the rare case cleanly and transparently.

---

## Decision

We adopt **pessimistic locking** for laudo draft editing with the following implementation:

### Schema

Draft documents in `labs/{labId}/laudos-draft/rascunhos/{draftId}` contain:

```typescript
{
  laudo_id: string;           // Reference to the immutable laudo
  edited_by: string;          // UID of the RT who opened the draft (read-only after creation)
  content_json: object;       // Editable copy of laudo content
  locked_until_ts: timestamp; // When the lock expires (lock holder can extend)
  locked_by: string;          // UID currently holding the lock (== edited_by initially)
  version: number;            // Conflict marker (optimistic fallback); incremented on each save
  status: enum('EDITING' | 'LOCKED_BY_OTHER' | 'PUBLISHED' | 'DISCARDED');
  updatedAt: timestamp;
  publishedAt?: timestamp;
  draft_notes: string;        // Internal notes not visible to patient
}
```

### Lock Acquisition & Release

**Acquire lock on draft open:**

```typescript
// Client-side call: rt-portal/pages/LaudoDraft.tsx:openForEditing()
const acquire = await acquireDraftLock(draftId, labId);
// CF callable: functions/src/modules/laudos/draftLocking.ts:acquireDraftLock()
// Returns: { locked: true, lockExpiresAt: T+1hour } or { locked: false, lockedBy: 'RT-A', expiresAt: T }
```

On success:

- Set `locked_by = currentUserId`.
- Set `locked_until_ts = now + 1 hour`.
- Set `status = EDITING`.

On conflict (someone else holds lock):

- Return `{ locked: false, lockedBy, expiresAt }`.
- Client shows "This draft is locked by RT-A until 15:00. Please try again later."

**Release lock on save or close:**

- When user clicks "Save draft": callable updates `locked_until_ts = now + 1 hour` (extend lock) and increments `version`.
- When user clicks "Close editor": callable clears `locked_by = null` and sets `status = EDITING` (lock released).
- Unsubscribe from `onSnapshot` listener on close.

**Auto-expire lock (cron):**

- Scheduled function `validateDraftLocksScheduled` runs every 15 minutes.
- Query `laudos-draft` for docs where `locked_until_ts < now`.
- Set `locked_by = null`, `status = EDITING` for each expired lock.
- Write synthetic audit event: `{ type: 'lock_expired', lockedBy, expiresAt, ... }`.

### Firestore Rules

```
match /labs/{labId}/laudos-draft/{draftId} {
  allow read: if isActiveMemberOfLab(labId);
  allow write: if request.resource.data.locked_by == request.auth.uid
            || request.resource.data.locked_by == null; // Anyone can acquire lock
  allow delete: never; // Soft delete only
}
```

### Conflict Fallback (Optimistic Marker)

If somehow two saves race (e.g., network hiccup causes duplicate callable invocation), the `version` field breaks the tie:

- Version is incremented on every successful save.
- Client sends `expectedVersion` with each save.
- If `requestedVersion != currentVersion`, reject with "draft was modified, please reload."

This is a safety net, not the primary locking mechanism.

---

## Alternatives Considered

**(a) Optimistic locking with version field**

- **Rejected.** Frequent lock conflicts for concurrent edits (even 5% rejections = poor UX). Lab operators will resort to workarounds (e.g., "I'll wait 10 minutes so no one else edits it").

**(b) CRDT (Yjs / Automerge)**

- **Rejected.** Overkill complexity, +50 KB bundle, RDC 978 audit trail becomes ambiguous ("which user made which sub-edit?"), requires significant client-side refactoring for Yjs binding to form fields.

**(c) No locking; Last-Write-Wins**

- **Rejected.** Violates RDC 978 Art. 5.3 (cannot identify who made final change). Silent data loss is unacceptable.

**(d) Read-only portal** (defer drafts to Phase 12)

- **Rejected.** Blocks patient portal Phase 4; RT portal (Phase 7) is a blocker for final accreditation audit.

---

## Consequences

**Immediate (Phase 7 task 07-01):**

- Add `locked_by`, `locked_until_ts` to draft schema.
- Create `acquireDraftLock()`, `releaseDraftLock()`, `extendDraftLock()` callables in `functions/src/modules/laudos/draftLocking.ts`.
- Create `validateDraftLocksScheduled` cron job.
- Add Firestore rules for lock validation.
- Wire lock status UI in RT portal: show "Editing (locked)" or "Locked by RT-A until 15:00" banner.

**Positive:**

- Zero conflicts; clear linear edit history.
- RDC 978 compliance: audit log has one author per save.
- Simple mental model for operators: "if locked, wait or contact the other RT."
- No CRDT complexity; no merge algorithms.

**Negative:**

- One RT blocks others; if RT-A forgets to close the editor, others are blocked 1 hour (worst case).
- UX requires education: operators must understand locks and lock expiration.
- Lock extension on every save adds ~100ms latency per save (one callable + one Firestore write).

**Mitigation:**

- **Lock expiration:** 1 hour is forgiving (unlikely an RT keeps editor open >1 hour without saving).
- **Auto-close on logout:** when user logs out of RT portal, release all their locks immediately (detect via `onAuthStateChanged`).
- **Lock status banner:** prominent display + countdown timer ("Locked by you, expires in 45 minutes").
- **Manual release option:** admin can forcibly release a lock from the superadmin panel if an RT disappears mid-edit.

**Cost:**

- ~200 LOC: 3 callables + 1 cron job + Firestore rules.
- Per-edit latency: +100ms (one callable round-trip to extend lock). Acceptable for RTs (not bulk operations).
- Storage: negligible (lock fields per draft document).

**Trade-offs:**

- **Concurrency vs. Simplicity:** Pessimistic sacrifices concurrent edits but gains simplicity + compliance. RDC 978 prioritizes clarity over throughput.
- **UX vs. Correctness:** Lock timeouts may frustrate users, but guarantee data integrity. Acceptable trade-off for clinical workflow.

---

## Operational Checklist

- [ ] **Phase 7 Task 07-01:** Add `locked_by`, `locked_until_ts` to `laudos-draft` schema in firestore.rules + TypeScript types.
- [ ] **Phase 7 Task 07-02:** Implement `draftLocking.ts` callables (acquire / release / extend).
- [ ] **Phase 7 Task 07-03:** Implement `validateDraftLocksScheduled` cron job.
- [ ] **Phase 7 Task 07-04:** Add lock status UI to RT portal editor (banner + countdown).
- [ ] **Phase 7 Task 07-05:** Add E2E tests: acquire lock, save draft, release lock, lock expiration.
- [ ] **Phase 7 Task 07-06:** Test lock auto-expiration: wait 1 hour (or mock time), verify cron clears expired locks.
- [ ] **Phase 7 Task 07-07:** Document lock behavior in RT portal help + training.

---

## References

- ADR-0019 — Phase 3 schema design (defines laudos-draft collection).
- `.planning/phases/03-schema-extensions/03-01-PLAN.md` § 5. `laudos-draft` collection.
- `firestore.rules` — will be updated with pessimistic lock validation rules.
- `functions/src/modules/laudos/draftLocking.ts` — lock acquisition/release implementation (to be created).
- `functions/src/modules/laudos/validateDraftLocksScheduled.ts` — lock expiration cron (to be created).
- RDC 978 Art. 5.3 — audit trail requirement.
- DICQ 4.4 — record integrity requirement.
