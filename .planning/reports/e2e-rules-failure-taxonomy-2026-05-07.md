# E2E Rules Failures Taxonomy — 2026-05-07

## Context

- **Test files run**:
  - `src/__tests__/e2e/phase3-rules.e2e.test.ts` (5 tests, 5 failed)
  - `src/__tests__/e2e/phase3-helpers.e2e.test.ts` (18 tests, 0 failed)
  - `src/__tests__/e2e/phase3-schema.e2e.test.ts` (10 tests, 5 failed)
  - `src/__tests__/e2e/phase-3-integration.test.ts` (run, all passed)
- **Total tests across files**: 40
- **Passing**: 30
- **Failing**: **10** (matches the user's expectation)
- **Test framework**: Vitest 4.1.4 (config in `vite.config.ts`, include glob `src/**/__tests__/**/*.test.ts`)
- **Command run**: `npx vitest run "src/__tests__/e2e/phase3-rules.e2e.test.ts" "src/__tests__/e2e/phase3-helpers.e2e.test.ts"` then same for `phase3-schema.e2e.test.ts` + `phase-3-integration.test.ts`
- **Output log**: `C:\hc quality\.planning\reports\e2e-rules-test-output-2026-05-07.log`
- **Pre-existing analysis**: `C:\hc quality\RULES_FAILURES_DEBUG.md` is **stale** — it lists 10 failures spread across rules+helpers files, but reality is 5+5 across rules+schema. Helpers file is fully green. Do not trust that document.

> **Important**: these tests use the **Firebase Admin SDK** against a **real Firestore project** (`hmatologia2` by default). They are NOT backed by `@firebase/rules-unit-testing` and they do NOT exercise security rules at all — Admin SDK bypasses rules. The failures are **client-side path-shape validation errors** thrown by `@google-cloud/firestore` before any network call. The emulator is never even contacted.

---

## Failure clusters

### Cluster A — Path arity mismatch on 4-segment "tab/doc" collections (9 failures)

**Affected tests (9):**

`phase3-rules.e2e.test.ts`:
- Test 1: Portal rules allow patient to read published laudo (cleanup-only failure — see Cluster B for the primary failure of this test)
- Test 2: NOTIVISA rules allow RT to create and server to update — `db.doc("labs/X/notivisa-outbox/events/eventId")`
- Test 3: Critical escalation rules enforce role-based access — `db.doc("labs/X/criticos-escalacoes/escalacoes/escalacaoId")`
- Test 4: IA strip dev rules enforce server-only access — `db.doc("labs/X/imuno-ias-dev/images/imageId")`
- Test 5: Laudo draft lock rules enforce pessimistic concurrency — `db.doc("labs/X/laudos-draft/rascunhos/draftId")`

`phase3-schema.e2e.test.ts`:
- Test 2: NOTIVISA outbox index query succeeds — `db.collection("labs/X/notivisa-outbox/events")` (treats it as a collection — opposite arity error)
- Test 3: Critical escalation write succeeds with complete schema — `db.doc("labs/X/criticos-escalacoes/escalacoes/escalacaoId")`
- Test 4: IA strip image metadata write succeeds with model version — `db.doc("labs/X/imuno-ias-dev/images/imageId")`
- Test 5: Laudo draft state transitions work correctly — `db.doc("labs/X/laudos-draft/rascunhos/draftId")`

**Common pattern:** Every test treats paths shaped `labs/{labId}/<collection>/<fixedSubName>/<docId>` as either a document (5 segments → odd → invalid for `db.doc`) or as a collection (5 segments → odd → valid as collection but the test wraps it as a doc and vice versa). The Admin SDK throws synchronously:
- `"...documentPath" must point to a document, but was "..."`. **Your path does not contain an even number of components.**
- `"...collectionPath" must point to a collection, but was "..."`. **Your path does not contain an odd number of components.**

**Likely root cause hypothesis:** The intended schema is `labs/{labId}/<collection>/{docId}` (4 segments — a document). Both the tests AND the rules introduced an extra hard-coded fixed segment (`events`, `escalacoes`, `images`, `rascunhos`) in the path, mirroring the same mistake. In `firestore.rules` lines 1949 / 1961 / 1972 / 1982 the matchers literally read:

```
match /notivisa-outbox/events/{docId}        // l.1949
match /criticos-escalacoes/escalacoes/{docId} // l.1961
match /imuno-ias-dev/images/{docId}           // l.1972
match /laudos-draft/rascunhos/{docId}         // l.1982
```

In rules grammar `match /a/b/{c}` means **collection `a` → document `b` → collection (implicit) → document `{c}`**, which would require 4 path components. Combined with the outer `match /labs/{labId}` (2 components), the full document path the rule expects is **6 components** (`labs/X/notivisa-outbox/Y/events/Z/eventId/W` or similar pseudo) — also wrong. So the rules and the tests were written from the same mental model, but that model is invalid Firestore path arithmetic in **both** the SDK and the rules engine.

**Suggested fix scope:** Choose ONE of two corrections, then apply to both rules and tests in lockstep:

- **Option A (shrink to standard):** Drop the fixed middle segment everywhere. Tests use `labs/X/notivisa-outbox/{eventId}`; rules become `match /notivisa-outbox/{docId}`. 4-segment doc path, valid. **Recommended** — matches the codebase convention (`/labs/{labId}/<coleção>/{docId}`) called out in root `CLAUDE.md`.
- **Option B (keep nesting, fix arity):** Treat `events`, `escalacoes`, etc. as a **document** that owns a subcollection. Tests use `labs/X/notivisa-outbox/events/items/{eventId}` (6 segments — doc). Rules become `match /notivisa-outbox/events/items/{docId}`. More invasive; only justified if you need a parent doc with siblings (e.g. metadata + items).

Either way, this is a **mirrored bug**: rules and tests are wrong **in the same direction**. Don't fix only one side or you'll just shift the failure mode.

---

### Cluster B — Cross-package Timestamp instance mismatch (1 failure, partial)

**Affected tests (1):**
- `phase3-rules.e2e.test.ts` Test 1 — Portal rules allow patient to read published laudo

**Common pattern:** Test imports `Timestamp` from `firebase/firestore` (client SDK) and writes it via `admin.firestore().doc(...).set({assinatura: { ts: Timestamp.now() }})`. Admin SDK throws:

```
Value for argument "data" is not a valid Firestore document. Detected an object
of type "Timestamp" that doesn't match the expected instance (found in field
"assinatura.ts"). Please ensure that the Firestore types you are using are from
the same NPM package.
```

**Likely root cause hypothesis:** All 4 rules+schema test files do `import { Timestamp } from 'firebase/firestore'` while writing through `admin.firestore()`. The Admin SDK requires `Timestamp` from `firebase-admin/firestore` (or `@google-cloud/firestore`). Test 1 hits this first because its document is the only one in `phase3-rules.e2e.test.ts` that lands in a valid path (`labs/X/laudos/laudoId` — 4 segments, OK), so it gets past Cluster A and hits this serializer error. Tests 2-5 in the same file don't reach this check because they fail at the path validation step first. **If you fix Cluster A, expect Cluster B to surface in 4 more tests.**

**Suggested fix scope:** Replace `import { Timestamp } from 'firebase/firestore'` with `import { Timestamp } from 'firebase-admin/firestore'` in all 3 affected files (`phase3-rules.e2e.test.ts`, `phase3-schema.e2e.test.ts`, plus `phase-3-integration.test.ts` as a precaution). 1-line change per file, low risk.

---

### Cluster C — afterEach cleanup uses Cluster A bad path (1 secondary failure)

**Affected tests (1):**
- `phase3-rules.e2e.test.ts` `afterEach` (counted by vitest as additional failure on Test 1; Test 1 thus shows 2 errors)

**Common pattern:** `afterEach` line 426-440 lists `labs/${testLabId}/notivisa-outbox/events` etc. as collection paths to clean. Even after Test 1's body succeeds, cleanup throws on the same arity error.

**Likely root cause hypothesis:** Same as Cluster A — `notivisa-outbox/events` is 4 segments under labs (still odd, but vitest reports it as a collection arity error too because `db.collection(colPath)` rejects when path doesn't end in odd-count). Resolved automatically when Cluster A is fixed.

**Suggested fix scope:** None separate from Cluster A.

---

## Raw failure data

| # | File | Test | Path used | Op (SDK) | Auth | Error type | Error snippet |
|---|------|------|-----------|----------|------|------------|---------------|
| 1 | phase3-rules | Test 1 Portal | `labs/X/laudos/laudoId` | `set` (admin) | Admin (no rules check) | Cross-pkg Timestamp | `Detected an object of type "Timestamp" that doesn't match the expected instance` |
| 2 | phase3-rules | Test 1 cleanup | `labs/X/notivisa-outbox/events` | `db.collection().get()` | Admin | Path arity | `collectionPath ... does not contain an odd number of components` |
| 3 | phase3-rules | Test 2 NOTIVISA | `labs/X/notivisa-outbox/events/eventId` | `db.doc()` | Admin | Path arity | `documentPath ... does not contain an even number of components` |
| 4 | phase3-rules | Test 3 Crit Escal | `labs/X/criticos-escalacoes/escalacoes/escId` | `db.doc()` | Admin | Path arity | `documentPath ... does not contain an even number of components` |
| 5 | phase3-rules | Test 4 IA Strip | `labs/X/imuno-ias-dev/images/imgId` | `db.doc()` | Admin | Path arity | `documentPath ... does not contain an even number of components` |
| 6 | phase3-rules | Test 5 Draft Lock | `labs/X/laudos-draft/rascunhos/draftId` | `db.doc()` | Admin | Path arity | `documentPath ... does not contain an even number of components` |
| 7 | phase3-schema | Test 2 NOTIVISA index | `labs/X/notivisa-outbox/events` | `db.collection()` | Admin | Path arity | `collectionPath ... does not contain an odd number of components` |
| 8 | phase3-schema | Test 3 Crit Escal | `labs/X/criticos-escalacoes/escalacoes/escId` | `db.doc()` | Admin | Path arity | `documentPath ... does not contain an even number of components` |
| 9 | phase3-schema | Test 4 IA Strip | `labs/X/imuno-ias-dev/images/imgId` | `db.doc()` | Admin | Path arity | `documentPath ... does not contain an even number of components` |
| 10 | phase3-schema | Test 5 Draft Lock | `labs/X/laudos-draft/rascunhos/draftId` | `db.doc()` | Admin | Path arity | `documentPath ... does not contain an even number of components` |

**Note on auth column**: every test runs through `firebase-admin` Admin SDK with no token. Admin SDK ignores rules entirely. None of these tests would catch a real rules regression — they only catch **schema/path shape**. This is itself a finding.

---

## Cross-cutting findings

1. **The pre-existing `RULES_FAILURES_DEBUG.md` is wrong.** It claims failures in `phase3-helpers.e2e.test.ts` and traces them to operator precedence in `isServer()`. The helpers file is **fully green** (18/18 passing). Do not act on its diagnosis. The `isServer()` operator-precedence concern may still be a real security hardening item, but it is **not** what is failing the tests.
2. **These tests do not test rules.** They use Admin SDK against the live project (or whatever `FIREBASE_PROJECT` env points to). They will silently pollute the real `hmatologia2` Firestore with `TEST-LAB-RULES-001` / `TEST-LAB-PHASE3-001` documents. Even when "passing", they only verify that the path string parses and a write goes through — the rules block is never exercised.
3. **The rules themselves contain the same path-shape mistake** as the tests (lines 1949, 1961, 1972, 1982 in `firestore.rules`). The matcher syntax `/notivisa-outbox/events/{docId}` does not match what the test thinks it does, and arguably matches no real document path at all because the outer `labs/{labId}` block + this inner pattern produce 6-segment paths.
4. **The `phase3-schema.e2e.test.ts` Test 1 (Portal config)** passes because `labs/X/portal-configuracao/{docId}` is the only path that actually obeys the codebase convention. Use it as the reference shape.

---

## Recommended next action

**Fix in this order:**

1. **Decide schema shape** for the 4 nested collections (Option A vs Option B above). Default: Option A — drop the middle segment.
2. **Update `firestore.rules`** lines 1949, 1961, 1972, 1982 to the chosen shape.
3. **Update both test files** (`phase3-rules.e2e.test.ts` and `phase3-schema.e2e.test.ts`) path strings to match.
4. **Fix Timestamp imports** in `phase3-rules.e2e.test.ts`, `phase3-schema.e2e.test.ts`, and `phase-3-integration.test.ts` — change `from 'firebase/firestore'` to `from 'firebase-admin/firestore'`.
5. **Strongly recommend a separate follow-up**: rewrite these as actual rules tests using `@firebase/rules-unit-testing` against the local emulator. As-is, they verify nothing about security rules. This is a documentation/labeling defect — they are named `*-rules.e2e.test.ts` but never exercise rules.
