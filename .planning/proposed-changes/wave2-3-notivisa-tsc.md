# Wave 2 Agent 3 — NOTIVISA tsc exclude follow-up

**Date:** 2026-05-08
**Status:** Migration complete. tsconfig exclude **kept in place** — module has 149 pre-existing TS errors unrelated to audit migration.

## What Wave 2 Agent 3 did

Migrated the 4 remaining silent-catch sites in `functions/src/modules/notivisa/` to `writeAuditLog` (Wave 1 Agent 8 helper). Sites: `approveNotivisaDraft.ts:175`, `submitNotivisaDraft.ts:146`, `rejectNotivisaDraft.ts:178`, `notivisaDraftCreate.ts:162`. All four now retry 3× and fall back to `auditLogFailures/` on persistent error — RDC 978 Art. 128 / DICQ 4.4 audit-trail traceability is no longer silently dropped.

The 4 migrated files themselves compile cleanly with the new helper import.

## Why notivisa stays in `tsconfig.json` exclude

Temporarily removing `src/modules/notivisa/**` from the exclude list surfaced **149 TS errors** across the module — all pre-existing, all structural, none introduced by the audit migration. Categories:

1. **Wrong firebase-functions v2 API usage** (~80% of errors). All `src/modules/notivisa/callables/*.ts` files use `functions.region(...).https.onCall(...)` and `functions.logger.*` — that is the v1 API surface. The file imports `firebase-functions/v2/providers/https` which exposes `onCall` directly, no `region`/`https`/`logger` properties. Every callable file is affected.
2. **Unused declarations** (`noUnusedLocals: true` + `noImplicitReturns: true`). Multiple `*Input` types declared with `z.infer` but never referenced; constants like `MFA_REQUIRED_MARKER`, `LAST_POLL_CACHE_KEY`, `CHAIN_VERIFICATION_GRACE_PERIOD_MS` unused.
3. **Type-narrowing failures in `logAuditTrail.ts`** — `signature` typed as `unknown` then accessed as if structured (`.hash`, spread, etc).
4. **Schema/result-type drift in `fetchTestResults.ts`, `getPatientData.ts`** — `null` not handled in arrays declared non-nullable; `missingFields` property missing from result union.
5. **Mock file unused export** (`__mocks__/soapClient.ts`).

These are not 1-pass fixable. The right scope is a dedicated NOTIVISA Phase 8 cleanup: rewrite all `callables/*` to v2 idiom (`onCall(opts, handler)` + structured `logger` from `firebase-functions/logger`), prune unused exports, narrow `logAuditTrail` signatures to schema types, fix `fetchTestResults`/`getPatientData` result types. Estimate: 1 focused day of work.

## Recommended next step

Open a follow-up phase plan:

- Rewrite all `src/modules/notivisa/callables/*.ts` to firebase-functions v2 API.
- Run `npx tsc --noEmit` with notivisa included after each file fixed.
- When TSC=0 with notivisa included, remove `src/modules/notivisa/**` from `tsconfig.json` exclude in the same commit.
- Add a smoke test for one callable end-to-end.

Until then, the silent-catch removal stands as a quality win regardless of tsc visibility — runtime observability is decoupled from compile-time inclusion.
