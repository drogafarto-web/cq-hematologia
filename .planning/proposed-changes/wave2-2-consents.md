# Wave 2 Agent 2 — Consent Callables (`consents/`)

## What was added (in code)

- `functions/src/modules/consents/validators.ts` — `assertConsentsWriteAccess` (active-member gate, no role restriction), `RecordConsentInputSchema`, `RevokeConsentInputSchema`, path helpers.
- `functions/src/modules/consents/recordPatientConsent.ts` — callable. Upserts `consents/{labId}/patients/{patientId}` with `iaProcessing: true`, `consentedAt: serverTimestamp()`, `consentVersion`, `capturedBy`, `revokedAt: null`, `scope: string[]`, `lastUpdated`. Re-capture merges `scope` (union, dedup) and resets `revokedAt`. Audit: `consent-captured` via `writeAuditLog`.
- `functions/src/modules/consents/revokePatientConsent.ts` — callable. Sets `revokedAt: serverTimestamp()`, `revokedBy: <uid>`, `revokeReason`. Returns `not-found` when no consent record exists (avoids silent no-op masking client bugs). Audit: `consent-revoked`.
- `functions/src/modules/consents/index.ts` — module barrel.
- `functions/src/modules/consents/__tests__/validators.test.ts` — 19 tests (auth gate × 6, RecordConsentInputSchema × 8, RevokeConsentInputSchema × 5). Pure-Zod + injected-firestore — no live Firestore required.

## Wire-up to add (DO NOT deploy without CTO ack)

The consents callables are NOT exported from `functions/src/index.ts` yet. Apply the following diff after CTO review:

```diff
--- a/functions/src/index.ts
+++ b/functions/src/index.ts
@@
 export {
   criticosConfig_createThreshold,
   criticosConfig_updateThreshold,
   criticosConfig_getThresholds,
 } from './modules/criticosConfig/index';

+// ─── consents module (Wave 2 Agent 2 — LGPD opt-in for AI processing) ────────
+// Operator captures consent on behalf of patient. Required by `consentGate`
+// (ia-strip guardrail) which refuses Gemini calls without an active consent
+// record. Re-capture merges scopes and clears `revokedAt`. Revocation keeps
+// the document (audit trail) and only sets `revokedAt`.
+export {
+  recordPatientConsent,
+  revokePatientConsent,
+} from './modules/consents/index';
+
 export { aprovarBatchImport } from './sgq/aprovarBatchImport';
```

Deploy command (run AFTER `bash scripts/preflight-secrets-check.sh` is green):

```bash
firebase deploy --only functions:recordPatientConsent,functions:revokePatientConsent --project hmatologia2
```

## Firestore rules — ALREADY DONE

The collection rule was added by Wave 1 Agent 7 (see `agent-7-pii-guardrail.md`). Server-side writes only (`allow create, update: if false`), reads gated by `isActiveMemberOfLab(labId)`, no deletes. **Do not touch.**

## Firestore indexes — none required

Both callables read/write `consents/{labId}/patients/{patientId}` by full document path. No composite queries.

## Callable contracts

### `recordPatientConsent`

```ts
input: {
  labId: string;          // required
  patientId: string;      // required, max 120 chars
  consentVersion: string; // required, [A-Za-z0-9._-]+, max 64
  capturedBy?: string;    // optional override; defaults to caller UID
  scope?: ('ia-strip' | 'ia-laudo' | 'analytics')[]; // default ['ia-strip']
}
returns: {
  ok: true;
  labId, patientId, consentVersion, scope, capturedBy;
  iaProcessing: true;
}
errors:
  - unauthenticated      → no auth context
  - invalid-argument     → labId missing OR Zod rejection
  - permission-denied    → not active member of labId
```

### `revokePatientConsent`

```ts
input: {
  labId: string;     // required
  patientId: string; // required
  reason?: string;   // optional, max 500 chars
}
returns: {
  ok: true;
  labId, patientId, revokedBy;
}
errors:
  - unauthenticated      → no auth context
  - invalid-argument     → labId missing OR Zod rejection
  - permission-denied    → not active member of labId
  - not-found            → no consent record exists for that patient
```

## Open follow-ups (out of scope for Wave 2 Agent 2)

- Web UI: "Capturar consentimento" dialog wired to `recordPatientConsent` (and a "Revogar" action in the patient header). Should surface `consent-not-captured` HttpsError from `consentGate` with a CTA.
- Backfill of existing patients — Wave 2 Agent 6 (`docs/lgpd/PATIENT_CONSENT_BACKFILL_PLAN.md` + `consents/migration/` callables) handles the bulk migration path. The two efforts are independent.
- Optional future scope `analytics` is reserved in the enum but not yet enforced anywhere — wire when analytics flow lands.
