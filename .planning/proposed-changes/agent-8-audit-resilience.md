# Agent 8 — Audit Log Resilience (writeAuditLog helper)

**Status:** proposed (not yet deployed)  
**Author:** Agent 8 (autonomous overnight pass)  
**Date:** 2026-05-08  
**Constraint compliance:** firestore.rules NOT modified — change proposed here for review.

## Background

Audit found audit-log writes across `functions/src/` using the silent-catch pattern:

```ts
db.collection('auditLogs')
  .add({...})
  .catch(() => {});
```

This swallows every failure (network blip, quota, rule rejection, schema validation
error). The audit-trail loss is invisible — both to operators and to compliance
auditors. RDC 978 Art. 128 + DICQ 4.4 require demonstrable traceability of
regulatory events; a silent drop is a compliance hole.

## Change implemented (code, this PR)

New helper `functions/src/shared/audit/writeAuditLog.ts`:

- 3 attempts, exponential backoff (100ms / 400ms / 1500ms).
- On final failure: structured `console.error` (Cloud Logs alert) **and**
  fallback write to `auditLogFailures/{labId|_unknown}/events/{autoId}`.
- Returns `{ ok: true, id }` or `{ ok: false, error }`. Never throws.
- The fallback write is the auditable evidence that an audit attempt was lost.

Callsites swapped (all confirmed audit-log writes — categorisation in commit message).
Criticos module (`functions/src/modules/criticos/index.ts`) already used `await
eventoRef.set(...)` directly without the silent catch — verified clean,
no change needed there.

## Proposed Firestore Rules Block (NOT YET DEPLOYED)

Add to `firestore.rules` (under the existing helper section):

```firestore
// Audit log failure fallback — written by Cloud Functions when the primary
// auditLogs/ write exhausts its retries. Read-only by superadmin/RT.
//
// Why: silent .catch(() => {}) used to mask write failures. Helper now fans
// out a fallback so the lost audit attempt is itself traceable.
//
// Path: /auditLogFailures/{labId}/events/{eventId}
match /auditLogFailures/{labId}/events/{eventId} {
  // Read: superadmin OR active RT/admin/owner of the lab.
  allow read: if request.auth != null
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
  allow create, update, delete: if false;
}
```

## Operational impact

- Existing observability: `auditLogs/` queries continue unchanged — fallback
  collection is inspected only when investigating gaps.
- Recommended monitoring rule (Cloud Logging): alert on the line
  `[writeAuditLog] FAILED after retries` — that is the canonical signal.
- Recommended Firestore export: include `auditLogFailures` in the daily GCS
  export (already covered by collectionGroup pattern) so the failures themselves
  are immutably archived.

## Rollout plan (when CTO approves)

1. Land code (this PR) — helper + callsite swaps. **No rules deploy required**;
   the fallback collection writes through Admin SDK (rules-bypassed).
2. Deploy functions: `firebase deploy --only functions --project hmatologia2`.
3. Smoke test: induce a write failure (e.g., temporary quota cap on auditLogs
   collection in staging) and verify both the `console.error` and the fallback
   doc appear.
4. Then deploy the rules block above so client-side reads of the fallback
   collection work for SuperAdmin/RT (without it, the fallback exists but only
   Admin SDK can read it — acceptable interim state).

## Excluded from this pass (left intact, noted for follow-up)

- `functions/src/modules/notivisa/**` — module excluded from `tsconfig.json`,
  cannot be safely typechecked here. 4 silent-catch sites remain, all on
  audit-log paths. Should be migrated when notivisa exits the exclude list.
- `functions/src/modules/compras/notaFiscal.ts:92,178` — uses `signAuditEntry`,
  a separate HMAC-chained per-collection audit subsystem (writes to
  `/labs/{labId}/notas-fiscais/audit/...`, not `/auditLogs/`). Routing it
  through `writeAuditLog` would change the chain target and break verification.
  These warrant their own resilience helper inside `modules/audit/cryptoAudit.ts`.
