# Agent 7 — PII Guardrail (ia-strip)

## What was added (in code)

- `functions/src/modules/ia-strip/guardrails/consentGate.ts` — verifies `consents/{labId}/patients/{patientId}` has `iaProcessing === true`, `consentedAt` set, `revokedAt === null`. Throws `HttpsError('failed-precondition', 'consent-not-captured')` on miss.
- `functions/src/modules/ia-strip/guardrails/metadataStripper.ts` — pure-JS stripper for JPEG (APPn + COM), PNG (tEXt/iTXt/zTXt/tIME/eXIf), WebP (EXIF/XMP RIFF chunks). Zero new deps.
- Wired into `classifyStripGemini.ts` BEFORE the Gemini call. Audit event written to `imuno-ia-guardrails/{labId}/events/{captureId}` with `event: 'guardrail-check-passed'`.
- `ClassifyStripPayload.patientId` is now required.

## Firestore rules to add (DO NOT deploy without CTO ack)

The new collections need rules. Proposed block (append to `firestore.rules` inside the existing helper-function scope):

```firestore
// ─── Patient consent records (LGPD opt-in for AI processing) ────────────
match /consents/{labId}/patients/{patientId} {
  // Read: any active member of the lab (operators need to verify before capture)
  allow read: if isActiveMemberOfLab(labId);

  // Create / update: only via Cloud Function callable (server-side validation
  // of patient identity, signature, and consent version). Client-side direct
  // writes are blocked — use `recordPatientConsent` callable.
  allow create, update: if false;

  // Delete: never. Revocation is `revokedAt = serverTimestamp()` not delete.
  allow delete: if false;
}

// ─── Guardrail audit trail (immutable) ──────────────────────────────────
match /imuno-ia-guardrails/{labId}/events/{eventId} {
  // Read: lab admin, RT, or auditor
  allow read: if isActiveMemberOfLab(labId);

  // Create: Cloud Function only (the classifyStripGemini callable writes here)
  allow create: if false;

  // Immutable
  allow update, delete: if false;
}
```

## Firestore indexes (none required)

Both collections are accessed by full document path — no composite indexes needed.

## Why this is defense-in-depth, not a replacement

- LGPD DPIA (Agent 3) defines policy. Guardrail enforces it at runtime.
- Even if the web client forgets to check, server refuses to call Gemini.
- Even if a future caller passes raw camera bytes, EXIF/GPS is stripped before egress to `generativelanguage.googleapis.com`.
- Audit event is written BEFORE the Gemini call so a successful guardrail check is recorded even if Gemini later fails.

## Open follow-ups (out of scope for Agent 7)

- A `recordPatientConsent` callable (Agent 3 / DPIA stream).
- Surface `consent-not-captured` error in the web UI with a "Capturar consentimento" CTA.
- Backfill: existing patients in Firestore need a one-shot consent migration tool (separate ticket).
- Optional: pull in `exifr` (NPM, MIT, ~30 KB) to surface a structured warning when stripper detects metadata — current stripper just removes silently. See `agent-7-deps.md`.
