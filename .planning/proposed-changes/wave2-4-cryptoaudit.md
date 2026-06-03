# Wave 2 Agent 4 — Chained Audit Resilience (writeChainedAudit helper)

**Status:** proposed (not yet deployed)
**Author:** Wave 2 Agent 4
**Date:** 2026-05-08
**Constraint compliance:** `firestore.rules` NOT modified — change proposed
here for review.

## Background

Wave 1 Agent 8 migrated flat `auditLogs/{autoId}` writes to the resilient
`writeAuditLog` helper. It deliberately left two callsites untouched —
`functions/src/modules/compras/notaFiscal.ts:92` and `:178` — because those
sites use `signAuditEntry` from `modules/audit/cryptoAudit.ts`, an HMAC-chained
per-collection audit subsystem. Routing them through `writeAuditLog` would
change the chain target and break verification.

The chain works like this: each entry's `previousHash` references the prior
entry written into the same `collectionPath`. Failure markers therefore CANNOT
be written into the chain target — doing so either corrupts the chain
(if the marker is signed) or breaks `previousHash` continuity for the next
real entry (if it isn't).

The two notaFiscal callsites still used the silent
`.catch(() => {})` pattern, so an HMAC-secret outage or quota reject was
invisible to operators.

## Change implemented (code, this PR)

New helper `functions/src/shared/audit/writeChainedAudit.ts`:

- 3 attempts, exponential backoff (100ms / 400ms / 1500ms) — same cadence as
  `writeAuditLog`.
- Wraps `signAuditEntry` (does NOT modify `cryptoAudit.ts`).
- On final failure: structured `console.error` (Cloud Logs alert) **and**
  failure marker written into a **sibling** collection
  `<parent>/<leaf>-auditFailures/{autoId}`.
  - Example: chain path `/labs/{labId}/notas-fiscais` → markers land in
    `labs/{labId}/notas-fiscais-auditFailures/{autoId}`.
  - The sibling lives next to the chain — never inside it — so chain hash
    continuity is preserved.
- Returns `{ ok: true, id }` or `{ ok: false, error }`. Never throws.

Callsites swapped:

- `functions/src/modules/compras/notaFiscal.ts:86–92`
  (`notaFiscal.criada`)
- `functions/src/modules/compras/notaFiscal.ts:172–178`
  (`notaFiscal.conferida`)

Sweep of `modules/compras/**` confirmed those were the only silent catches —
`fornecedor.ts` does not write audit chain entries.

## Failure marker schema

Document at `labs/{labId}/{leaf}-auditFailures/{autoId}`:

```ts
{
  chainCollectionPath: string; // e.g. "/labs/abc/notas-fiscais"
  operation: string; // e.g. "notaFiscal.criada"
  operadorId: string; // request.auth.uid
  intendedPayload: Record<string, unknown>;
  error: string; // truncated to 2000 chars
  attempts: 3;
  recordedAt: serverTimestamp;
}
```

The marker is the auditable evidence that a chain write was lost. Operators
investigating gaps cross-reference `chainCollectionPath` against the actual
chain integrity report (`validateChainIntegrity`) — a marker without a
corresponding gap in the chain means the retry eventually surfaced a write
that the helper missed (worth a post-mortem); a gap without a marker means
the helper itself crashed before reaching fallback (worth alerting).

## Proposed Firestore Rules Block (NOT YET DEPLOYED)

Add to `firestore.rules` (under the existing helper section). Pattern matches
the `auditLogFailures` block proposed by Wave 1 Agent 8 — same access model.

```firestore
// Chained-audit failure markers — written by Cloud Functions when the HMAC
// chain write (modules/audit/cryptoAudit.ts:signAuditEntry) exhausts its
// retries. Read-only by superadmin/RT. Never written to the chain target
// itself — markers preserve chain hash continuity.
//
// Sibling pattern: chain path `/labs/{labId}/notas-fiscais` → markers at
// `/labs/{labId}/notas-fiscais-auditFailures/{eventId}`.
//
// Path: /labs/{labId}/{leafAuditFailures}/{eventId}
//   where leafAuditFailures matches `^.*-auditFailures$`.
match /labs/{labId}/{leafAuditFailures}/{eventId} {
  // Only intercept paths that end in -auditFailures. Other subcollections
  // under labs/{labId} keep their existing rules.
  allow read: if leafAuditFailures.matches('.*-auditFailures')
              && request.auth != null
              && (
                request.auth.token.isSuperAdmin == true
                || (
                  exists(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid))
                  && get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.role
                     in ['owner','admin','RT']
                )
              );

  // Create / update / delete: never from client. Cloud Function (Admin SDK)
  // only — Admin SDK bypasses rules, so blanket false is the right default.
  allow create, update, delete: if leafAuditFailures.matches('.*-auditFailures')
                                && false;
}
```

> **Reviewer note:** the `matches` guard is the discriminator that lets a
> single rule block cover all current and future chain-target subcollections
> (notas-fiscais, future labApoio, future ceq) without per-leaf duplication.
> If a stricter allow-list is preferred, replace the regex with an explicit
> `in ['notas-fiscais-auditFailures', ...]` set.

## Tests added

`functions/src/shared/audit/__tests__/writeChainedAudit.test.ts`:

- `failureMarkerCollectionPath` — sibling derivation across rooted /
  unrooted / nested / single-segment / invalid inputs.
- `writeChainedAudit` — happy path (`{ ok: true, id }`), transient retry
  (3rd attempt succeeds), permanent failure (writes sibling marker into
  `labs/lab-42/notas-fiscais-auditFailures` — explicitly asserts the marker
  did NOT land in the chain target), and double-failure (marker collection
  also down — still no throw).

`signAuditEntry` is mocked — the real HMAC + chain lookup logic is already
covered by `cryptoAudit.test.ts`.

## Operational impact

- The chain target collections (`notas-fiscais` etc.) are unaffected.
- Recommended monitoring rule (Cloud Logging): alert on the line
  `[writeChainedAudit] FAILED after retries` — that is the canonical signal,
  paired with the existing `[writeAuditLog] FAILED after retries` alert from
  Wave 1.
- Daily Firestore export should include `*-auditFailures` collections (already
  covered by collectionGroup pattern) so the markers themselves are
  immutably archived.

## Rollout plan (when CTO approves)

1. Land code (this PR) — helper + callsite swaps. **No rules deploy required**;
   the marker collection writes through Admin SDK (rules-bypassed).
2. Deploy functions: `firebase deploy --only functions:criarNotaFiscal,functions:confirmarRecebimento --project hmatologia2`.
3. Smoke test: induce a write failure (e.g., temporary quota cap on
   `notas-fiscais` in staging) and verify both the `console.error` and the
   sibling marker doc appear at
   `labs/{stagingLabId}/notas-fiscais-auditFailures/{autoId}`.
4. Then deploy the rules block above so client-side reads of the marker
   collection work for SuperAdmin/RT.

## Out of scope

- `cryptoAudit.ts` itself — wrapped, not modified (per task constraint).
- Non-chain audit sites — handled by Wave 1 Agent 8 (`writeAuditLog`).
- Other modules using `signAuditEntry` (`equipamentos`, `qualidade/*`) —
  separate review pass; same helper applies cleanly when prioritised.
