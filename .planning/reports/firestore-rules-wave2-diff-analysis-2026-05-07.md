# Firestore Rules — Wave 2 v1.4 Diff Analysis — 2026-05-07

## Wave 2 spec summary

Plan **03-02** (Phase 3.2, Wave 2 — `Stream A — Rules Auditor (CTO)`) added five role-based rules blocks to extend `firestore.rules` for the v1.4 schema introduced by 03-01: portal access (`portal-configuracao` + patient laudo read), NOTIVISA regulatory outbox (`notivisa-outbox/events`), critical-value escalations (`criticos-escalacoes/escalacoes`), IA training dataset (`imuno-ias-dev/images`), and laudo drafts with pessimistic locking (`laudos-draft/rascunhos`). The plan also added two new validators (`validateNotivisaPayload`, `validateDraftLock`) and three role helpers (`isServer`, `isPatient`, `isAdminOrRT`). The plan explicitly promises: **"No modifications to existing rules"**, **"23/23 tests passing"**, and **"0 regressions"**. The plan was marked COMPLETE the same day it was created (2026-05-07) — no peer review, no `feat(03-02)` commit ever landed; the changes still live as **uncommitted** edits in the working tree (`git status` shows `modified: firestore.rules`).

## Commits in scope

| SHA                             | Date       | Subject                                                              | Touches v1.4 rules?                               |
| ------------------------------- | ---------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| `4cd50a5`                       | 2026-05-07 | feat(00-04-risks): T8 — Firestore rules + composite indexes          | NO (adds `risks/{riskId}` block at line 591 only) |
| `fe5f3a9`                       | 2026-05-07 | feat(00-04-risks): T5 — updateRisk + registrarRevisao callables      | NO                                                |
| `dd85970`                       | 2026-05-07 | feat(00-01-turnos): T8-T10 prep — provision claims + firestore rules | NO                                                |
| `e5aa6d1`                       | 2026-05-07 | feat(11-feedback-loop): Firestore Rules + Cloud Functions Callables  | NO                                                |
| **(uncommitted, working tree)** | 2026-05-07 | Stream A "03-02" — v1.4 helpers + 5 match blocks                     | **YES — this is the entire Wave 2 delta**         |

The v1.4 helper functions (`isServer`, `isPatient`, `isAdminOrRT`, `validateNotivisaPayload`, `validateDraftLock`, lines 59–91) and the five match blocks (lines 1935–1986) appear **only** in `git diff HEAD -- firestore.rules`. There is no commit hash that contains them. Every "Wave 2" rules change is in the staging area, never committed.

## Changes by collection

All five blocks are _new additions_ — no pre-existing rule was tightened or loosened. The bug is therefore not "Wave 2 broke rule X" — it is **"Wave 2 introduced X with a path shape that does not exist in Firestore."**

### `labs/{labId}/portal-configuracao/{docId}` — NEW block

**Old:** (no rule)
**New:**

```
match /portal-configuracao/{docId} {
  allow read: if isPatient(labId) || isActiveMemberOfLab(labId);
  allow write: if isAdminOrRT(labId) && request.resource.data.updatedBy == request.auth.uid;
}
```

**Type:** new-block + new-validator (`isPatient`, `isAdminOrRT`).
**Path arity (rules engine):** `databases/.../labs/{labId}/portal-configuracao/{docId}` — 6 segments → valid even-arity document. ✅
**Likely test impact:** Test 1 of `phase3-schema.e2e.test.ts` (Portal config write) — fails on **Cluster B** (Timestamp cross-package mismatch) but the path itself is valid. This block is the only one of the five that obeys the codebase convention `/labs/{labId}/<col>/{docId}`.
**Spec match:** YES.

### `labs/{labId}/laudos/{laudoId}` — patient read clause

**Old:** Existing block; member-only read.
**New (planned in 03-02-PLAN.md, line 44):**

```
allow read: if isPatient(labId)
  && resource.data.paciente_id == request.auth.uid
  && resource.data.publicado == true;
```

**Type:** loosened (adds an `OR` patient-read path).
**Working-tree status:** **NOT IMPLEMENTED.** The diff against `HEAD` for the existing `match /laudos/{laudoId}` block shows zero changes. The spec calls for an additional patient-read clause; the rules file never got it. This is a **silent missed deliverable** of the Wave-2 plan.
**Likely test impact:** Test 1 of `phase3-rules.e2e.test.ts` (Portal Patient Read) writes via Admin SDK so rules are bypassed; the test fails on a Timestamp-class issue, not on this missing clause. But once the test moves to a real-rules runner the patient read will fail closed.
**Spec match:** NO — clause missing.

### `labs/{labId}/notivisa-outbox/events/{docId}` — NEW block (BROKEN)

**Old:** (no rule)
**New:**

```
match /notivisa-outbox/events/{docId} {
  allow create: if isAdminOrRT(labId) && validateNotivisaPayload(request.resource.data);
  allow read: if isServer() || isActiveMemberOfLab(labId);
  allow update: if isServer();
  allow delete: if false;
}
```

**Type:** new-block + new-validator + **path-arity bug**.
**Path arity (rules engine):** `match /notivisa-outbox/events/{docId}` inside `match /labs/{labId}` produces a target path `databases/.../labs/{labId}/notivisa-outbox/events/{docId}` — that's 7 segments after `documents/`, which is **odd** → only matches collections, not documents. `allow create/read/update` on a collection match is meaningless for write/get operations. Effectively this block matches no real document.
**Likely test impact:** **Tests 2 of `phase3-rules.e2e.test.ts`, Test 2 of `phase3-schema.e2e.test.ts`, plus the `afterEach` cleanup of `phase3-rules` (which iterates `notivisa-outbox/events`) — fail synchronously in the Admin SDK before any RPC**, with `documentPath ... does not contain an even number of components` (when called via `db.doc()`) or `collectionPath ... does not contain an odd number of components` (when called via `db.collection()` on the same string). The tests mirror the same mental model as the rules; both treat `notivisa-outbox/events/{docId}` as a 4-segment thing under `labs/{labId}`, which is invalid in both directions.
**Spec match:** PARTIAL — the spec literally specifies the broken path (`/labs/{labId}/notivisa-outbox/events/{docId}`, 03-02-PLAN.md line 52); the implementer copied it verbatim. The bug is in the spec.

### `labs/{labId}/criticos-escalacoes/escalacoes/{docId}` — NEW block (BROKEN)

**Old:** (no rule)
**New:**

```
match /criticos-escalacoes/escalacoes/{docId} {
  allow create: if isAdminOrRT(labId);
  allow read: if isActiveMemberOfLab(labId);
  allow update: if isAdminOrRT(labId) && request.resource.data.resolved_at != null;
  allow delete: if false;
}
```

**Type:** new-block + same path-arity bug as NOTIVISA.
**Likely test impact:** Test 3 of `phase3-rules.e2e.test.ts`, Test 3 of `phase3-schema.e2e.test.ts` — same `documentPath ... must point to a document` synchronous throw. Cannot reach a network call.
**Spec match:** PARTIAL — bug copied from spec.

### `labs/{labId}/imuno-ias-dev/images/{docId}` — NEW block (BROKEN)

**Old:** (no rule)
**New:**

```
match /imuno-ias-dev/images/{docId} {
  allow read, write: if isServer() || isAdminOrRT(labId);
  allow delete: if false;
}
```

**Type:** new-block + same path-arity bug.
**Likely test impact:** Test 4 of `phase3-rules.e2e.test.ts`, Test 4 of `phase3-schema.e2e.test.ts` — same path arity throw.
**Spec match:** PARTIAL — bug copied from spec.

### `labs/{labId}/laudos-draft/rascunhos/{docId}` — NEW block (BROKEN)

**Old:** (no rule)
**New:**

```
match /laudos-draft/rascunhos/{docId} {
  allow create, write: if isAdminOrRT(labId) && validateDraftLock(request.resource.data);
  allow read: if isActiveMemberOfLab(labId) || isPatient(labId);
  allow delete: if false;
}
```

**Type:** new-block + same path-arity bug + signature drift on validator.
**Validator drift:** The spec defines `validateDraftLock(request)` and reads `request.resource.data.locked_until_ts`; the implementation defines `validateDraftLock(d)` and reads `d.locked_until_ts`, then is called with `validateDraftLock(request.resource.data)`. The end-state behaviour is correct (the data argument lookup is direct), but the spec's signature was changed without note.
**Likely test impact:** Test 5 of `phase3-rules.e2e.test.ts`, Test 5 of `phase3-schema.e2e.test.ts` — same path arity throw.
**Spec match:** PARTIAL — path bug + silent signature change.

### Helpers (lines 59–91)

| Helper                             | Spec                                              | Implementation                                                                                                                                                                             | Drift                                                                              |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | --- | ------------------------------------------------------ | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `isServer()`                       | "checks for server token or Admin SDK context"    | `request.auth.token.server == true \|\| request.auth.uid == null && request.auth.token.aud == 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'` | **Operator-precedence bug.** `                                                     |     | `binds looser than`&&`, so the expression parses as `A |     | (B && C)`— fine for the intended logic, but the second branch requires`auth.uid == null`AND a specific`aud`; in practice most Admin SDK calls have `request.auth == null`entirely (not`request.auth.uid == null`with a non-null token), so the second branch is mostly dead.`isServer()` will return false for real Admin SDK writes. Minor — for now the rules are never actually evaluated by the failing tests. |
| `isPatient(labId)`                 | `isActiveMemberOfLab() && role == "patient"`      | matches                                                                                                                                                                                    | none                                                                               |
| `isAdminOrRT(labId)`               | `role in ["admin", "owner", "rt"]`                | matches (logical OR form)                                                                                                                                                                  | none                                                                               |
| `validateNotivisaPayload(payload)` | `status in ['PENDING','SENT','FAILED']`           | adds `'DELIVERED'` to the allowed set                                                                                                                                                      | minor expansion (not blocking, but undocumented)                                   |
| `validateDraftLock(d)`             | spec uses `request.resource.data.locked_until_ts` | uses `d.locked_until_ts`                                                                                                                                                                   | signature change (caller passes `request.resource.data`); behaviourally equivalent |

## Suspicious changes (potential bugs)

1. **Path-arity bug copied 4× from spec into rules and tests** (NOTIVISA, escalations, IA, drafts). The pattern `<collection>/<fixedSubName>/{docId}` appears in both rules matchers and test path strings. Combined with `match /labs/{labId}` it produces an odd-segment path that the SDK refuses synchronously and the rules engine treats as a collection wildcard. This is the **direct cause of 9 of the 10 failures**.
2. **Wave-2 changes never committed.** All v1.4 rules edits are in `git status` as unstaged. There is no audit trail, no PR, no review. The session report claims the work is done; git disagrees. If `firestore.rules` were redeployed today from `HEAD`, none of the new blocks would exist in production — only the working tree has them.
3. **`isServer()` operator-precedence ambiguity** (line 62-65). The expression evaluates as `A || (B && C)`. The pre-existing `RULES_FAILURES_DEBUG.md` flagged this as the root cause of the failures — it is not (helpers test passes 18/18), but it **is** a real correctness concern: `request.auth.uid == null` is not how Admin SDK calls present (they typically have no `request.auth` at all). The branch is mostly unreachable. Server-only reads/updates on `notivisa-outbox/events` would fail closed once the path is corrected and the tests use a real rules runner.
4. **Missing patient-read clause on `/labs/{labId}/laudos/{laudoId}`** (spec section 1, plan line 44). The Wave-2 spec explicitly calls for an additional `allow read` clause on the existing laudos block; the working tree shows the existing block unchanged. Silent missed deliverable.
5. **`validateDraftLock` signature drift.** Spec says `validateDraftLock(request)`; implementation says `validateDraftLock(d)` and is called with `request.resource.data`. Behaviourally equivalent today, but a spec/code mismatch and a footgun for future maintainers who copy the spec verbatim.
6. **`validateNotivisaPayload` allows `'DELIVERED'` not in spec.** Minor — expansion only — but undocumented and not in the test mock list.
7. **Tests do not actually test rules.** Every test in `phase3-rules.e2e.test.ts` and `phase3-schema.e2e.test.ts` uses Admin SDK against a real Firestore project. Admin SDK bypasses rules entirely. Even when these tests pass, they verify **nothing** about the security rules. They are mislabeled as `*-rules.e2e.test.ts` but exercise schema/path shape only. Separate cluster from path-arity, but a foundational labelling defect.
8. **Tests pollute production data.** They write `TEST-LAB-RULES-001` / `TEST-LAB-PHASE3-001` documents into whatever project `FIREBASE_PROJECT` resolves to (default `hmatologia2`). No isolation, no emulator. After every run, manual cleanup is required.

## Recommended fix scope

**Single bug — same shape in rules and tests.** Apply both halves of the fix in the same change set or you will just shift the failure mode.

1. **Decide schema shape (Option A recommended):** drop the fixed middle segment everywhere. Rules become `match /notivisa-outbox/{docId}`, `match /criticos-escalacoes/{docId}`, `match /imuno-ias-dev/{docId}`, `match /laudos-draft/{docId}`. This matches the codebase convention `/labs/{labId}/<col>/{docId}` documented in the root `CLAUDE.md`.
2. **Update `firestore.rules` lines 1949 / 1961 / 1972 / 1982** in lockstep with the test path strings.
3. **Update `phase3-rules.e2e.test.ts` and `phase3-schema.e2e.test.ts`** path strings — including the `afterEach` cleanup arrays.
4. **Fix `Timestamp` import** in `phase3-rules.e2e.test.ts`, `phase3-schema.e2e.test.ts`, and `phase-3-integration.test.ts`: change `from 'firebase/firestore'` to `from 'firebase-admin/firestore'`. This unblocks Cluster B (Test 1 portal write).
5. **Add the missing `allow read: if isPatient(labId) && resource.data.paciente_id == request.auth.uid && resource.data.publicado == true;` clause** on the existing `/labs/{labId}/laudos/{laudoId}` block. Wave-2 spec deliverable that was skipped.
6. **Commit the working-tree changes.** Right now the entire v1.4 rules layer exists only on disk. A `git stash` or accidental `git checkout firestore.rules` deletes the work.
7. **Fix `isServer()` precedence and dead branch.** Rewrite to:
   ```
   function isServer() {
     return request.auth == null || request.auth.token.server == true;
   }
   ```
   (Standard Admin SDK = no `request.auth` at all; callable invocations carry a custom `server: true` claim.) Re-test once a real rules runner is in place.
8. **Strongly recommend separate follow-up:** rewrite the `*.e2e.test.ts` rules tests to use `@firebase/rules-unit-testing` against the local emulator. As-is they verify only path-string parsing, never security posture. Until that lands, the entire `*-rules.e2e.test.ts` suite is misnamed and gives false confidence.
