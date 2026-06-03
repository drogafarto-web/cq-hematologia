# Wave 2 Agent 10 — NOTIVISA test-mode lifecycle (proposed changes)

**Status:** ready for review. No production wiring touched.
**Author:** Wave 2 Agent 10
**Date:** 2026-05-08

---

## Goal

Build a working NOTIVISA lifecycle skeleton (draft → approve → submit → queue → outbox) that runs end-to-end **without hitting the real ANVISA endpoint**. Real-API switch becomes a single env-var flip when sandbox creds arrive.

## What was added

All new files. No existing files in `functions/src/modules/notivisa/` were modified — race-window discipline with Wave 2 Agent 3.

| Path                                                                  | Purpose                                                                                                                                              |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/modules/notivisa/testMode.ts`                          | Mode resolver (`NOTIVISA_MODE` env) + synthetic responder + `dispatchSubmission` indirection.                                                        |
| `functions/src/modules/notivisa/createDraft.ts`                       | `createDraft` callable. Idempotent on `laudoId`.                                                                                                     |
| `functions/src/modules/notivisa/approveDraft.ts`                      | `approveDraft` callable. RT/admin/owner only.                                                                                                        |
| `functions/src/modules/notivisa/submitDraft.ts`                       | `submitDraft` callable. Atomically updates draft + enqueues to `notivisa-queue`.                                                                     |
| `functions/src/modules/notivisa/processQueue.ts`                      | `processQueue` scheduled cron — every 5 minutes — picks pending events, dispatches via test-mode synth, archives ack to outbox or backs off retries. |
| `functions/src/modules/notivisa/exportOutbox.ts`                      | `exportOutbox` callable. AUDITOR-only. CSV upload to Cloud Storage + signed URL (15min TTL).                                                         |
| `functions/src/modules/notivisa/__tests__/wave2-10-lifecycle.test.ts` | Happy-path unit tests for mode resolver, synthetic responder, dispatch, CSV escaping, schema validation, backoff curve.                              |

## Required wiring (NOT applied — propose only)

### `functions/src/index.ts`

Add the following exports near the existing `notivisa*` block. These are additive — do **not** remove the legacy `notivisaDraftCreate` / `approveNotivisaDraft` / `submitNotivisaDraft` / `rejectNotivisaDraft` exports; both lifecycles coexist until Wave 3 reconciliation.

```ts
// Wave 2 Agent 10 — test-mode NOTIVISA lifecycle
export { createDraft as notivisaCreateDraft } from './modules/notivisa/createDraft';
export { approveDraft as notivisaApproveDraft } from './modules/notivisa/approveDraft';
export { submitDraft as notivisaSubmitDraft } from './modules/notivisa/submitDraft';
export { exportOutbox as notivisaExportOutbox } from './modules/notivisa/exportOutbox';
export { processQueue as notivisaProcessQueue } from './modules/notivisa/processQueue';
```

Five exports total: 4 callables (`onCall`) + 1 scheduled (`onSchedule`).

### `firestore.rules`

Already covered by `.claude/rules/notivisa-firestore-rules.md`. No new collections introduced — the new callables write to the same paths the rules document already prescribes:

- `notivisa-drafts/{labId}/drafts/{draftId}` — created with `status: 'pending'`
- `notivisa-drafts/{labId}/drafts/{draftId}/auditLog/{logId}` — append-only
- `notivisa-queue/{labId}/events/{eventId}` — created with `status: 'pending'`, `nextRetry`
- `notivisa-outbox/{labId}/archives/{archiveId}` — created on successful ack, `exportedBy` stamped on first export

**Diff vs the rules-doc proposal:**

- Drafts now use `status: 'pending'` as the initial state (rules-doc allowed `'pending'` implicitly via the Cloud Function-only create). No rules change required.
- Queue events use a `nextRetry` Timestamp field. Already present in the proposed indexes (`labId + status + nextRetry`).

### `firestore.indexes.json`

Two indexes from `.claude/rules/notivisa-firestore-rules.md` are required for the new code paths. Confirm they are deployed before enabling the cron at scale:

1. `notivisa-drafts` — `(laudoId ASC, status ASC)` — drives idempotency lookup in `createDraft.ts`.
2. `notivisa-queue` collection-group — `(status ASC, nextRetry ASC)` — drives `processQueue.ts` polling.

Existing single-field indexes cover the `notivisa-outbox` `archivedAt` ordering used by `exportOutbox.ts`.

### Env var (test mode default)

```
NOTIVISA_MODE=test     # default; synthetic responder
NOTIVISA_MODE=sandbox  # throws unimplemented until gov sandbox client lands
NOTIVISA_MODE=prod     # throws unimplemented until prod cutover
```

No secret needed in test mode. When sandbox creds arrive, add `NOTIVISA_API_KEY` / `NOTIVISA_ENDPOINT` via `firebase functions:secrets:set` and gate via `defineSecret` inside a future `sandboxClient.ts`.

## Idempotency strategy

`createDraft` queries `notivisa-drafts/{labId}/drafts where laudoId == X and status in ['pending', 'approved', 'submitted']`. If a doc exists, the call short-circuits and returns its `draftId` with `idempotent: true`. Rejected drafts are not considered — a rejected draft can be replaced by a new one for the same `laudoId` (matches the `notivisa-firestore-rules.md` index design).

## Test mode contract

- Synthetic responder logs every call with `[NOTIVISA_TEST_MODE]` prefix — operators reading Cloud Logs can confirm at a glance that production traffic is not being sent.
- Random latency 200–800ms per submit, mimicking realistic gov API behaviour.
- Receipt codes shaped `NV-TEST-{ms}-{8 alpha-num}` — visually distinct from real ANVISA receipts.
- `isSynthetic: true` flag persisted on every outbox archive so audit downstream can filter test artefacts out of compliance reports.
- `injectFailure` flag on the synthetic API exists for tests only — there is no path that lets a callable trigger it.

## Backoff & retry

`processQueue` retries with `nextRetry = now + 2^n minutes` where `n` is the new attempt number (1, 2, 4, 8, 16). Permanent failure on `attempt >= maxAttempts` (default 5) or non-retryable error → `status: 'failed-permanent'` + `escalatedToSupervisor: true`. Sandbox/prod `unimplemented` errors are also classified as permanent so we don't loop on missing creds.

## Tests

`__tests__/wave2-10-lifecycle.test.ts` covers:

- Mode resolver default + variants
- Synthetic responder happy-path + injected-failure path
- `dispatchSubmission` rejecting sandbox/prod with `unimplemented`
- CSV escaping in `buildOutboxCsv` (commas inside fields)
- Zod input schema for `createDraft`
- Backoff curve sanity

Each callable file is also smoke-validated indirectly via the schema test. End-to-end coverage with Firestore emulator can be added once Wave 2 stabilises.

## Out of scope

- UI (`src/features/notivisa-portal/**`) — separate task.
- Real HTTP client for sandbox / prod — gated behind feature flag, follow-up.
- `notivisa-config/{labId}` admin write callables — flag exists in the rules doc but not yet needed for the test-mode lifecycle.
- Deduplication of legacy `notivisaDraftCreate` vs new `createDraft` — Wave 3 reconciliation.
