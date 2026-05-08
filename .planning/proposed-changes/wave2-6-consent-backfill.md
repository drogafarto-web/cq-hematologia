# Wave 2 Agent 6 — Consent Backfill (Migration)

## What was added (in code)

- `functions/src/modules/consents/migration/exportPatientList.ts` —
  admin-only callable `consents_exportPatientList`. Streams every patient
  in `/labs/{labId}/patients`, joins current consent state from
  `/consents/{labId}/patients/{patientId}`, writes a CSV to
  `gs://<bucket>/exports/{labId}/consent-backfill/{ts}-{uuid}.csv`, returns
  a 24h v4-signed URL. CPF is sha256-hashed in the artefact; plaintext
  stays in Firestore. No PII in the audit payload.
- `functions/src/modules/consents/migration/batchRecordConsent.ts` —
  admin-only callable `consents_batchRecordConsent`. Accepts ≤ 200 entries
  per call. Per row: validates the patient exists, `capturedBy` is an
  active lab member, `consentedAt` parses, the signed-doc Storage path
  exists, then upserts the consent doc with the same shape as
  `recordPatientConsent` plus a `paperTrail[]` chain-of-custody entry.
  Never throws on partial failure — returns per-row outcomes.
- `functions/src/modules/consents/migration/index.ts` — barrel.
- `docs/lgpd/PATIENT_CONSENT_BACKFILL_PLAN.md` — operational plan
  (inventory → outreach → batch upload → cutover) with timeline, success
  criteria, rollback, edge cases, and audit evidence map.

## Wiring required (DO NOT deploy without CTO ack)

`functions/src/index.ts` needs to export the two new callables. Wave 2
Agent 6 deliberately did not touch that file per task constraints. Add:

```ts
// Phase 4 — Consent backfill (admin-only migration tooling)
export {
  consents_exportPatientList,
  consents_batchRecordConsent,
} from './modules/consents/migration';
```

Place near the existing consents export (`recordPatientConsent` /
`revokePatientConsent` from Wave 2 Agent 2).

## Firestore rules to add (DO NOT deploy without CTO ack)

The two callables write through Admin SDK so they bypass rules. The only
new client-readable artefact is the CSV in Cloud Storage, which is gated
by a v4 signed URL with a 24h expiry — no Firestore rule change is
strictly required for that.

However, the paper-trail Storage bucket needs rules so operators can
upload signed PDFs but un-privileged users cannot:

```ruby
# storage.rules
match /labs/{labId}/consent-paper-trail/{patientId}/{file=**} {
  allow read: if request.auth != null
              && firestore.exists(/databases/(default)/documents/labs/$(labId)/members/$(request.auth.uid))
              && firestore.get(/databases/(default)/documents/labs/$(labId)/members/$(request.auth.uid)).data.active == true;
  allow write: if request.auth != null
               && firestore.exists(/databases/(default)/documents/labs/$(labId)/members/$(request.auth.uid))
               && firestore.get(/databases/(default)/documents/labs/$(labId)/members/$(request.auth.uid)).data.active == true
               && request.resource.contentType == 'application/pdf'
               && request.resource.size < 10 * 1024 * 1024;
}

match /exports/{labId}/consent-backfill/{file=**} {
  // Cloud Function service account writes; humans never write here directly.
  allow write: if false;
  // CSV downloads are gated by signed URL only — no public read.
  allow read: if false;
}
```

## Firestore indexes (none required)

Both callables iterate `/labs/{labId}/patients` and read consent docs by
full path. No composite indexes needed.

## Why no client SDK changes here

The web admin console will call the two callables via the existing
`httpsCallable` factory used by every other admin tool. UI work is not in
this agent's scope; the doc describes the operator workflow so the UI
team has a clear contract.

## Open follow-ups (not blocking deploy)

1. **Lab-level feature flag for `consentGate`** — needed for per-lab
   rollback in Phase 4 cutover. Tracked in
   `docs/lgpd/PATIENT_CONSENT_BACKFILL_PLAN.md` §11.1. Owner: Wave 1.
2. **Guardian fields on consent doc** — `guardian: { name, cpfHash,
   legalBasis }`. Until v1.5 ships, lives in `paperTrail[].notes`. §11.2.
3. **Cloud Logs alert** — daily count of `consent-not-captured` errors.
   Owner: SRE.
