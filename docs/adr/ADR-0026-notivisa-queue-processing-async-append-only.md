# ADR-0026 — NOTIVISA Queue Processing: Async Append-Only Outbox Pattern (Phase 4+)

**Date:** 2026-05-07  
**Status:** PROPOSED  
**Decided by:** CTO / fundador  
**Supersedes:** —  
**Superseded by:** —

---

## Problem

RDC 978 Art. 66 requires notification of reportable diseases to Ministério da Saúde (NOTIVISA system) within **24 hours** of result approval. Portaria 204/2016 defines 99 notifiable diseases (sífilis, dengue, HIV, tuberculose, etc.).

v1.4 Phase 8 (ADR-0014) implements NOTIVISA form generation (sandbox); Phase 12+ will integrate with real Anvisa API. Challenge: **how to handle API failures gracefully without losing submissions?**

**Failure scenarios:**

1. Anvisa API is down (gov servers, unreliable).
2. Network latency (Anvisa slow; timeout after 30 sec).
3. Form validation fails (missing field, wrong format).
4. Lab certificate expires (authentication fails; requires manual renewal).

Without proper queue handling, risk of:

- **Lost notifications:** form generated but not submitted (auditor sees no receipt).
- **Duplicate submissions:** retry logic causes same form to be submitted 3× (Anvisa sees duplicates).
- **No visibility:** operator has no way to check "was this form submitted?" or "why did it fail?".

**Timeline constraint:** v1.4 Phase 8 must ship sandbox version; Phase 12+ integrates API. Queue design must be **future-proof** (work for both mock + real API).

---

## Decision

**v1.4 Phase 4+ (Phase 8 onwards) implements async append-only outbox queue with exponential-backoff scheduled processor, ensuring at-least-once delivery + idempotent API calls.**

### Queue Architecture

#### 1. Append-Only Outbox Collection

```
/labs/{labId}/notivisa-outbox/{entryId}
├── status: 'pending' | 'submitted' | 'acknowledged' | 'failed-permanent'
├── diseaseCode: string (MS Portaria code)
├── patientData: { name_anon, dob, gender } (no PII)
├── resultValue: string (positive, negative, etc.)
├── resultDate: Timestamp
├── submissionAttempts: Array<AttemptRecord> (append-only log)
├── receiptCodeFromAnvisa?: string (only after real submission in Phase 12+)
├── notificationDeadline: Timestamp (24h after result approval)
└── (other fields from ADR-0014)
```

#### 2. Submission Attempt Lifecycle (Append-Only)

```
Phase 8 (Sandbox):
1. Form generated: entry created with status='pending'
   submissionAttempts = []

2. RT approves form in UI:
   → appendAttempt({ ts, attempt: 1, method: 'mock-submit', status: 'mocked', result: 'OK' })
   → status → 'acknowledged' (sandbox treats all as success)

Phase 12+ (Real API):
1. Form generated: entry created with status='pending'
   submissionAttempts = []

2. Scheduled processor runs (every 5 min):
   → Find all pending entries with `notificationDeadline <= now() + 5min`
   → For each entry:
      → Attempt API call to Anvisa
      → Record attempt: { ts, attempt: N, method: 'soap-anvisa', status: 'sent' | 'failed', error?, receiptCode? }
      → Update status based on Anvisa response:
         - 200 OK + receiptCode: status='submitted', then → 'acknowledged' (after Anvisa confirmation)
         - 400/422 validation error: status='failed-permanent' (don't retry; operator must fix)
         - 500/timeout: status='pending' (retry with backoff)

3. If no ACK after 24h deadline: escalate to supervisor (alert: "NOTIVISA form past deadline")
```

#### 3. Firestore Schema (Detailed)

```typescript
// /labs/{labId}/notivisa-outbox/{entryId}
interface NotivisaOutboxEntry {
  id: string;
  labId: string;

  // Link to result
  laudoId: string;
  resultadoId: string;

  // Disease info
  diseaseCode: string; // MS Portaria code (e.g., '99078' = syphilis)
  diseaseName: string;

  // Anonymized patient data
  patientData: {
    name_anon: string; // anonymized: "Paciente 1234"
    dateOfBirth: Timestamp;
    gender: 'M' | 'F' | 'outro';
  };

  // Result details
  resultValue: string; // "positivo", "negativo", "reagente", etc.
  resultDate: Timestamp; // date result was generated
  testMethod?: string; // method used (e.g., "PCR", "ELISA")

  // SLA
  notificationDeadline: Timestamp; // resultDate + 24h

  // State machine (main)
  status: 'pending' | 'submitted' | 'acknowledged' | 'failed-permanent';

  // Anvisa integration (Phase 12+)
  receiptCodeFromAnvisa?: string;
  anvisa_eventId?: string;

  // Attempt history (append-only)
  submissionAttempts: Array<{
    attempt: number; // 1, 2, 3, ... (max 5)
    ts: Timestamp;
    method: 'mock-submit' | 'soap-anvisa' | 'rest-anvisa';
    status: 'sent' | 'mocked' | 'failed' | 'success';
    error?: {
      errorCode?: string;
      errorMessage?: string;
      isRetryable: boolean; // true if 5xx/timeout, false if 4xx validation
    };
    receiptCode?: string; // Anvisa receipt ID (if success)
    roundTripMs?: number; // latency of API call
  }>;

  // Escalation (if past deadline)
  escalatedToSupervisor?: boolean;
  escalationTs?: Timestamp;
  escalationMotivo?: 'deadline-passed' | 'permanent-failure';
  supervisorId?: string;

  // Manual override
  overrideStatus?: string; // if supervisor manually marks resolved
  overrideTs?: Timestamp;
  overridePor?: string;

  // Audit
  criadoEm: Timestamp;
  criadoPor: string; // operatorId or system
}
```

#### 4. Scheduled Processor Function

```typescript
// functions/src/modules/notivisa/processNotivisaQueueScheduled.ts
export const processNotivisaQueueScheduled = onSchedule(
  { schedule: 'every 5 minutes', secrets: [HCQ_SIGNATURE_HMAC_KEY, TWILIO_SMS_API_KEY] },
  async (context: ScheduledFunctionContext): Promise<void> => {
    const admin = getAdminSDK();
    const db = admin.firestore();

    // 1. Find all labs
    const labsSnap = await db.collection('labs').listDocuments();

    for (const labDoc of labsSnap) {
      const labId = labDoc.id;

      // 2. Query: pending entries + approach deadline
      const pendingEntries = await db
        .collection(`labs/${labId}/notivisa-outbox`)
        .where('status', '==', 'pending')
        .where('notificationDeadline', '<=', admin.firestore.Timestamp.now())
        .limit(100) // process max 100 per run (avoid timeout)
        .get();

      for (const entryDoc of pendingEntries.docs) {
        const entry = entryDoc.data() as NotivisaOutboxEntry;

        // 3. Check attempt count (max 5 retries)
        if (entry.submissionAttempts.length >= 5) {
          // Too many failures; mark as failed-permanent + escalate
          await entryDoc.ref.update({
            status: 'failed-permanent',
            escalatedToSupervisor: true,
            escalationTs: admin.firestore.FieldValue.serverTimestamp(),
            escalationMotivo: 'max-retries-exceeded',
          });

          // Send SMS alert to supervisor
          await notifySupervsorOfNotivisaFailure(labId, entry);
          continue; // skip to next entry
        }

        // 4. Check if last attempt failed + should retry
        const lastAttempt = entry.submissionAttempts[entry.submissionAttempts.length - 1];
        const attemptNum = entry.submissionAttempts.length + 1;

        // Exponential backoff: 1m → 5m → 15m → 45m → 120m between attempts
        const backoffMinutes = [1, 5, 15, 45, 120][attemptNum - 1] || 120;
        const nextRetryTime = new Date(
          lastAttempt.ts.toDate().getTime() + backoffMinutes * 60 * 1000,
        );

        if (lastAttempt && nextRetryTime > new Date()) {
          // Not yet time to retry
          continue;
        }

        // 5. Perform submission attempt
        try {
          const result = await submitNotivisaToAnvisa(labId, entry);

          // Record success attempt
          const newAttempt = {
            attempt: attemptNum,
            ts: admin.firestore.Timestamp.now(),
            method: process.env.NOTIVISA_API_MODE === 'sandbox' ? 'mock-submit' : 'soap-anvisa',
            status: 'success' as const,
            receiptCode: result.receiptCode,
            roundTripMs: result.roundTripMs,
          };

          await entryDoc.ref.update({
            submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
            status: 'submitted',
            receiptCodeFromAnvisa: result.receiptCode,
            anvisa_eventId: result.eventId,
          });

          console.log(`[NOTIVISA] Success: ${entryDoc.id} (attempt ${attemptNum})`);
        } catch (error: any) {
          // Record failed attempt
          const isRetryable = error.code >= 500 || error.code === 'ETIMEDOUT';

          const newAttempt = {
            attempt: attemptNum,
            ts: admin.firestore.Timestamp.now(),
            method: process.env.NOTIVISA_API_MODE === 'sandbox' ? 'mock-submit' : 'soap-anvisa',
            status: 'failed' as const,
            error: {
              errorCode: error.code?.toString(),
              errorMessage: error.message || 'Unknown error',
              isRetryable,
            },
            roundTripMs: error.roundTripMs || 0,
          };

          if (isRetryable && attemptNum < 5) {
            // Retryable error; log and wait for next cycle
            await entryDoc.ref.update({
              submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
              // status remains 'pending'
            });
            console.log(
              `[NOTIVISA] Retryable failure: ${entryDoc.id} (attempt ${attemptNum}/${5})`,
            );
          } else {
            // Non-retryable error (4xx) or max retries hit
            await entryDoc.ref.update({
              submissionAttempts: admin.firestore.FieldValue.arrayUnion(newAttempt),
              status: 'failed-permanent',
              escalatedToSupervisor: true,
              escalationTs: admin.firestore.Timestamp.now(),
              escalationMotivo: isRetryable ? 'max-retries-exceeded' : 'validation-error',
            });

            // Alert supervisor
            await notifySupervsorOfNotivisaFailure(labId, entry);
            console.log(`[NOTIVISA] Permanent failure: ${entryDoc.id}`);
          }
        }
      }

      // 6. Check for past-deadline escalations
      const pastDeadlineWithoutAck = await db
        .collection(`labs/${labId}/notivisa-outbox`)
        .where('status', 'in', ['pending', 'submitted'])
        .where('notificationDeadline', '<', admin.firestore.Timestamp.now())
        .where('escalatedToSupervisor', '==', false)
        .get();

      for (const docSnap of pastDeadlineWithoutAck.docs) {
        const data = docSnap.data() as NotivisaOutboxEntry;
        await docSnap.ref.update({
          escalatedToSupervisor: true,
          escalationTs: admin.firestore.Timestamp.now(),
          escalationMotivo: 'deadline-passed',
        });

        await notifySupervsorOfNotivisaFailure(labId, data);
      }
    }
  },
);
```

#### 5. Idempotency: Deduplication Key

To prevent duplicate submissions (if processor retries same form):

```typescript
// For Phase 12+ real API submission:
// Each form submission includes idempotency key: SHA-256(labId + diseaseCode + patientId + resultDate)
// Anvisa API respects idempotency key: if you submit same key twice, returns same receipt (no duplicate)

const idempotencyKey = crypto
  .createHash('sha256')
  .update(`${entry.labId}:${entry.diseaseCode}:${entry.patientData.dateOfBirth}:${entry.resultDate}`)
  .digest('hex');

const soapPayload = {
  evento: { ... },
  idempotencyKey, // Anvisa will check this
};
```

#### 6. Webhook for Anvisa Acknowledgment (Phase 12+)

```typescript
// functions/src/modules/notivisa/handleAnvisaWebhook.ts
// Anvisa notifies HC Quality: "your submission was received + processed"
export const handleAnvisaWebhook = onRequest(
  { secrets: [ANVISA_WEBHOOK_SECRET] },
  async (req: Request, res: Response): Promise<void> => {
    // 1. Verify webhook signature (HMAC-SHA256)
    const signature = req.headers['x-anvisa-signature'] as string;
    const payload = JSON.stringify(req.body);
    const computedSig = crypto
      .createHmac('sha256', ANVISA_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== computedSig) {
      res.status(401).send('Unauthorized');
      return;
    }

    // 2. Parse webhook: { idempotencyKey, status, eventId, timestamp }
    const { idempotencyKey, status, eventId, timestamp } = req.body;

    // 3. Find outbox entry by idempotencyKey
    // (requires secondary index: idempotencyKey)
    const db = admin.firestore();
    const allLabsSnap = await db.collection('labs').listDocuments();

    for (const labDoc of allLabsSnap) {
      const entryQuery = await db
        .collection(`labs/${labDoc.id}/notivisa-outbox`)
        .where('idempotencyKey', '==', idempotencyKey)
        .get();

      if (!entryQuery.empty) {
        const entryDoc = entryQuery.docs[0];
        await entryDoc.ref.update({
          status: 'acknowledged',
          anvisa_eventId: eventId,
          anvisa_acknowledgmentTs: admin.firestore.Timestamp.fromDate(new Date(timestamp)),
        });

        res.status(200).send({ received: true });
        return;
      }
    }

    // Not found (edge case); acknowledge anyway so Anvisa doesn't retry
    res.status(200).send({ received: true });
  },
);
```

---

## Rationale

1. **Append-only audit trail:** every attempt (success or failure) is logged immutably; auditor can see full history.
2. **At-least-once delivery:** scheduler will keep retrying until success (or permanent failure is declared).
3. **Idempotent API calls:** deduplication key prevents duplicate submissions if processor retries same form.
4. **Exponential backoff:** avoids hammering Anvisa API with tight retry loops (1m → 5m → 15m spacing).
5. **Phase 8 sandbox-ready:** mock submitter responds instantly; same code path when real API added in Phase 12.
6. **RDC 978 Art. 66 compliance:** form + submission audit trail + receipt code form defensible evidence.

---

## Alternatives Considered

### A. Sync HTTP call (no queue)

**Pros:** simpler code; result known immediately.  
**Cons:** RDC 978 requires 24h submission; sync call blocks RT workflow (unacceptable UX); if Anvisa slow, RT waits (bad).  
**Rejected:** violates UX + regulatory timeline.

### B. Message queue (RabbitMQ / Google Pub/Sub)

**Pros:** proven, battle-tested queue pattern; guaranteed delivery.  
**Cons:** adds operational complexity (another service to run); extra cost (PubSub); overkill for low-volume notivisa (5–10 forms/day).  
**Rejected:** Firestore outbox pattern sufficient for v1.4 scale.

### C. Scheduled processor with hardcoded retry (no backoff)

**Pros:** simpler implementation.  
**Cons:** if Anvisa is overloaded, tight retries make it worse (stampede effect); risk of exceeding rate limits.  
**Rejected:** exponential backoff is essential for resilience.

### D. No queue; manual submission

**Pros:** no automation complexity.  
**Cons:** RT must manually export form + submit to Anvisa portal (labor-intensive; error-prone); no audit trail of automation.  
**Rejected:** defeats Phase 8 purpose (automate form generation).

---

## Consequences

### Positive

1. **Resilient to API failures:** retries automatically; no manual operator intervention needed for transient Anvisa downtime.
2. **Audit trail:** complete history of all submission attempts (timestamp, status, error reason).
3. **Compliance-ready:** 24h deadline enforced; past-deadline escalation alerts supervisor.
4. **Phase 8 sandbox + Phase 12 real API:** same code path; mock implementation in Phase 8, real API swapped in Phase 12 (no refactor).
5. **Idempotency:** Anvisa webhook confirms receipt; system self-corrects if ACK is missed.

### Negative

1. **Delayed notification:** form may not be submitted until 2nd or 3rd attempt (eventual consistency, not immediate).
2. **Permanent failures:** if Anvisa has persistent bug or certificate expires, form sits in failed-permanent (requires manual intervention).
3. **Supervisor alerting:** past-deadline escalations assume supervisor is responsive; if supervisor ignores alerts, forms still not submitted.

### Mitigation

- **Immediate sandbox confirmation:** Phase 8 mock submitter confirms "success" instantly (no delay).
- **Permanent failure escalation:** supervisor gets SMS + email alert; runbook covers recovery steps (re-generate cert, re-submit).
- **Manual override:** supervisor can manually mark entry as 'acknowledged' if operator confirms form was submitted manually to Anvisa portal.

---

## Derived Commitments

1. **Phase 8 deliverables (Weeks 1–2):**
   - Cloud Function callable: `generateNotivisaDraft(labId, laudoId)` (creates outbox entry).
   - Scheduled processor: `processNotivisaQueueScheduled` (mock submitter).
   - Firestore schema: `/labs/{labId}/notivisa-outbox` (with submissionAttempts append-only field).
   - Firestore rules: outbox collection protected (only functions can write).
   - E2E tests: 6 specs (draft creation, mock submission, attempt logging, past-deadline escalation).

2. **Phase 12 deliverables (Weeks 1–3, post-certificate provisioning):**
   - Replace mock submitter with real `submitNotivisaToAnvisa(labId, entry)` that calls Anvisa SOAP API.
   - Implement deduplication key + idempotency handling.
   - Webhook handler for Anvisa acknowledgment.
   - Integration test: submit real form to Anvisa sandbox, confirm receipt.

3. **Configuration (Phase 8 + Phase 12):**
   - Environment flag: `NOTIVISA_API_MODE = 'sandbox' | 'production'`.
   - Anvisa credentials (certificate path, WSDL endpoint) in Secret Manager.
   - Webhook URL: register with Anvisa console.

4. **Supervisor runbook (Phase 8 Week 3):**
   - How to check past-deadline forms: `db.collection('labs/{labId}/notivisa-outbox').where('escalatedToSupervisor', '==', true)`.
   - How to manually resolve: `updateNotivisaEntryStatus(labId, entryId, 'acknowledged', motivo='manual')`.
   - Troubleshooting: "form stuck in pending? Check submissionAttempts[].error for reason; if cert expired, renew + reprocess".

5. **Firestore Rules & Audit:**
   - `/labs/{labId}/notivisa-outbox`: append-only (submissionAttempts can only grow, not shrink).
   - Webhook signature validation (HMAC-SHA256 over payload).
   - Chain hash over final state (status, receipt, timestamp) per ADR-0012.

---

## Links to Related ADRs & Phases

- **ADR-0012** — RDC 978 audit trail logical signature (chainHash implementation).
- **ADR-0014** — NOTIVISA integration sandbox-to-production (overall strategy; this ADR is the queue implementation detail).
- **Phase 8** — NOTIVISA Integration (sandbox form generation + queue setup).
- **Phase 12** — NOTIVISA Production (API integration + certificate provisioning).
- **RDC 978 Art. 66** — Notificação de eventos adversos (statutory reference).
- **Portaria 204/2016 MS** — 99 doenças notificáveis (disease code list).

---

**ADR Status:** PROPOSED (2026-05-07)  
**Gate Review:** End of Phase 8 Week 2 (confirm mock queue processing working, attempt logging ≥90% accuracy).  
**Phase 12 Readiness:** Confirm Anvisa certificate provisioned + sandbox API tested before Phase 12 kickoff.
