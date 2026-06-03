# ADR-0021 — NOTIVISA Queue & Retry Pattern

**Status:** Accepted
**Date:** 2026-05-07
**Decided by:** CTO (drogafarto)
**Related:** ADR-0014 (NOTIVISA sandbox-to-production), ADR-0019 (notivisa-outbox collection schema)

---

## Context

Phase 5 integrates NOTIVISA (Notificação Imediata de Vítima de Violência — ANVISA mandatory submission for critical results flagged as public-health emergencies). NOTIVISA submission is:

1. **Asynchronous** — the patient's results arrive in HC Quality, an async job determines if NOTIVISA-reportable (e.g., result for Hepatitis C in a first-time donor), and submits the notification to ANVISA.
2. **Unreliable** — ANVISA's NOTIVISA API is a legacy SOAP/XML service maintained by a government agency. It can be:
   - Temporarily unavailable (maintenance windows, DDoS)
   - Slow (response time varies from <1s to >30s)
   - Reject payloads for malformed data (typo in CPF masking, invalid state code, etc.)
3. **Non-idempotent** — ANVISA does not provide request IDs; duplicate submissions create duplicate notifications in their system. We must track which submissions have already succeeded and skip retries.
4. **Auditable** — RDC 286/1994 § 6 requires an audit trail of all NOTIVISA submissions, including failed attempts and the timestamp of each.

The question is: **how to queue, retry, and audit NOTIVISA submissions in a way that is resilient, observable, and compliant?**

---

## Problem

Two naive approaches fail:

**(a) Synchronous submission on result write:**

- Client creates a result; a Cloud Function trigger immediately calls ANVISA API.
- If ANVISA is slow or down, the function times out (max 9 minutes for Gen 2), and the result write is retried.
- Result data is sound, but NOTIVISA submission may never land.
- No visibility into "did NOTIVISA submission succeed or fail?"

**(b) Fire-and-forget background job (Pub/Sub without tracking):**

- Trigger enqueues NOTIVISA submission to Pub/Sub.
- A worker processes it asynchronously.
- If it fails, Pub/Sub dead-letter-queues it, but there's no way to manually retry or query "what NOTIVISA submissions failed in the last 24 hours?"
- No audit trail (no history of attempts, no per-attempt error messages).

This ADR proposes **approach (c) — Queue-and-Retry with Audit Trail**.

---

## Decision

We adopt **a queue-and-retry pattern** with the following architecture:

### 1. Queue Schema

Create `labs/{labId}/notivisa-outbox/events/{docId}` for each NOTIVISA submission:

```typescript
{
  laudo_id: string;           // Reference to the result
  patient_cpf: string;        // PII (masked before sending to ANVISA)

  // NOTIVISA API Payload (RDC 286 § 6)
  payload: {
    tipo_notificacao: 'SUSPEITA' | 'CONFIRMADA';
    doenca_notificavel: string; // e.g., 'HEPATITE_C'
    descricao: string;
    resultado_teste: string;
  };

  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED_PERMANENT' | 'FAILED_TEMP';

  // Retry tracking
  attempts: number;           // Current attempt count (1, 2, 3, ...)
  maxAttempts: number;        // Default 5
  nextRetry: timestamp;       // When to retry next (exponential backoff)
  lastError: string;          // Error from last attempt (for debugging)

  // Audit trail
  createdAt: timestamp;       // When result was written (decision point)
  firstAttemptAt: timestamp;  // When first submission attempt was made
  sentAt: timestamp;          // When ANVISA returned 200 OK (nullable until status=DELIVERED)

  // ANVISA response tracking (for compliance)
  anvisa_protocol_id?: string; // NOTIVISA ticket ID if available
  anvisa_response?: object;    // Full SOAP response XML-to-JSON for audit
}
```

### 2. Submission Workflow

**Step 1: Enqueue (on result creation)**

```typescript
// Cloud Function trigger: onLaudoCreated
if (isNotivisaReportable(result)) {
  const queueRef = db.collection(`labs/${labId}/notivisa-outbox/events`).doc();
  await queueRef.set({
    laudo_id: result.id,
    patient_cpf: maskCPF(result.patient_cpf),
    payload: buildNotivisaPayload(result),
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 5,
    nextRetry: now,
    createdAt: now,
  });
  // Write audit event
  await auditLog('notivisa_queued', { laudo_id: result.id, dueTime: now });
}
```

**Step 2: Process queue (Cloud Function callable + Pub/Sub)**

A scheduled function runs every 5 minutes and queries for ready-to-retry submissions:

```typescript
// functions/src/modules/notivisa/processNotivisaQueueScheduled.ts
const ready = await db
  .collectionGroup('notivisa-outbox')
  .where('status', '==', 'PENDING')
  .where('nextRetry', '<=', now)
  .get();

for (const doc of ready.docs) {
  enqueue_to_pubsub(doc.id, doc.data());
}
```

Pub/Sub worker processes each job:

```typescript
// functions/src/modules/notivisa/notivisaWorker.ts
export const notivisaWorker = onMessagePublished('notivisa-queue', async (message) => {
  const { queueDocId, labId } = message.json;
  const queueRef = db.doc(`labs/${labId}/notivisa-outbox/events/${queueDocId}`);
  const queueDoc = await queueRef.get();

  try {
    const response = await submitToAnvisaAPI(queueDoc.data().payload);
    await queueRef.update({
      status: 'DELIVERED',
      sentAt: now,
      anvisa_protocol_id: response.protocolId,
      anvisa_response: response.xml,
    });
    await auditLog('notivisa_delivered', { queueDocId, protocolId: response.protocolId });
  } catch (error) {
    const newAttempt = queueDoc.data().attempts + 1;
    const maxAttempts = queueDoc.data().maxAttempts;

    if (error.isTransient && newAttempt < maxAttempts) {
      // Exponential backoff: 1 min, 5 min, 30 min, 2 hours, 24 hours
      const backoffMs = [60000, 300000, 1800000, 7200000, 86400000][newAttempt - 1];
      await queueRef.update({
        status: 'FAILED_TEMP',
        attempts: newAttempt,
        nextRetry: new Date(now.getTime() + backoffMs),
        lastError: error.message,
      });
      await auditLog('notivisa_retry_scheduled', {
        queueDocId,
        attempt: newAttempt,
        nextRetryIn: backoffMs,
      });
    } else {
      // Permanent failure or max attempts exceeded
      await queueRef.update({
        status: 'FAILED_PERMANENT',
        attempts: newAttempt,
        lastError: error.message,
      });
      await auditLog('notivisa_failed_permanent', { queueDocId, error: error.message });
      // Alert admin (email or dashboard flag)
      notifyAdminOfFailure(queueDocId, error);
    }
  }
});
```

### 3. Manual Retry

Admin can manually retry a failed submission via a callable:

```typescript
export const manuallyRetryNotivisaCallable = onCall(async (data: { queueDocId; labId }) => {
  const queueRef = db.doc(`labs/${data.labId}/notivisa-outbox/events/${data.queueDocId}`);
  await queueRef.update({
    status: 'PENDING',
    nextRetry: now,
    attempts: 0, // Reset for manual retry
  });
  await auditLog('notivisa_manual_retry', {
    queueDocId: data.queueDocId,
    adminUid: request.auth.uid,
  });
});
```

### 4. Idempotency

To prevent duplicate submissions:

- Track `anvisa_protocol_id` (NOTIVISA ticket ID returned by ANVISA).
- Before retrying, query ANVISA API with the original payload to see if it was already submitted.
- If it was, update local record to `DELIVERED` without resubmitting.

---

## Alternatives Considered

**(a) Synchronous submission on result write**

- **Rejected.** Blocks result creation on ANVISA API availability. Result data must not depend on external service health.

**(b) Fire-and-forget Pub/Sub**

- **Rejected.** No audit trail, no visibility into failures, no manual retry mechanism.

**(c) Database transaction with ANVISA submission** (what this ADR chooses)

- **Accepted.** Queue + Pub/Sub provides resilience, audit trail, and manual control.

**(d) Dedicated NOTIVISA microservice**

- **Rejected.** Overkill for <100 notifications/day. Cloud Functions + Pub/Sub sufficient.

---

## Consequences

**Immediate (Phase 5 task 05-01):**

- Create `notivisa-outbox` collection + indices in Firestore.
- Implement `submitToAnvisaAPI()` integration wrapper (handles SOAP → JSON translation).
- Create `processNotivisaQueueScheduled` cron job (every 5 minutes).
- Create `notivisaWorker` Pub/Sub subscriber.
- Create `manuallyRetryNotivisaCallable` for admin panel.
- Add Firestore rules to prevent unauthorized reads/writes to notivisa-outbox.
- Create test fixtures: mock ANVISA API responses (success, transient failure, permanent failure).

**Positive:**

- **Resilient:** retries with exponential backoff handle transient ANVISA downtime.
- **Auditable:** full history of attempts, timestamps, and error messages per submission. Complies with RDC 286 § 6.
- **Observable:** admin dashboard can show "X pending, Y delivered, Z failed" in real-time.
- **Controllable:** manual retry for failed submissions without code changes.
- **Idempotent:** NOTIVISA protocol ID prevents duplicate submissions even if we retry.

**Negative:**

- Additional infrastructure (Pub/Sub topic + subscription).
- Latency spike: NOTIVISA submission may take up to 5 minutes to appear in ANVISA's system (time until next scheduled worker run).
- Storage: queue documents persist indefinitely (mitigation: soft-delete after 90 days, or archive to Cloud Storage).

**Cost:**

- Pub/Sub: ~$0.40/million messages (negligible for <100 messages/day).
- Firestore: +5 index queries per 5-min cycle (20 index queries/day = ~0.0006 reads/day, negligible).
- Cloud Functions: scheduled job runs 288 times/day (5-min interval) + worker runs per queued job (~100/day) = ~400 function invocations/day (~$0.40/month).

**Trade-offs:**

- **Latency vs. Reliability:** 5-minute queue delay is acceptable for a regulatory notification (target is "within business hours of result creation," not real-time).
- **Storage vs. Auditability:** persisting queue history adds storage, but is mandatory for RDC 286 audit trail.

---

## Operational Checklist

- [x] Architecture documented and agreed by CTO.
- [ ] **Phase 5 Task 05-01:** Create `notivisa-outbox` collection + indices.
- [ ] **Phase 5 Task 05-02:** Implement `submitToAnvisaAPI()` SOAP wrapper (mock ANVISA for testing).
- [ ] **Phase 5 Task 05-03:** Implement `processNotivisaQueueScheduled` cron job.
- [ ] **Phase 5 Task 05-04:** Implement `notivisaWorker` Pub/Sub subscriber.
- [ ] **Phase 5 Task 05-05:** Implement `manuallyRetryNotivisaCallable` for admin panel.
- [ ] **Phase 5 Task 05-06:** Add test fixtures: mock ANVISA success/failure responses.
- [ ] **Phase 5 Task 05-07:** Add E2E tests: enqueue → process → verify DELIVERED.
- [ ] **Phase 5 Task 05-08:** Add monitoring: alert on FAILED_PERMANENT status.
- [ ] **Phase 5 Task 05-09:** Document NOTIVISA workflow in runbook + admin training.

---

## References

- ADR-0014 — NOTIVISA integration sandbox-to-production (precursor decision).
- ADR-0019 — Phase 3 schema design (defines notivisa-outbox collection).
- `.planning/phases/03-schema-extensions/03-01-PLAN.md` § 2. `notivisa-outbox` collection schema.
- RDC 286/1994 § 6 — NOTIVISA regulatory requirement.
- RDC 978/2025 Art. 5.3 — audit trail requirement (applies to NOTIVISA audit log).
- DICQ 4.4 — record integrity requirement.
- Firebase Pub/Sub documentation — retry policy + dead-letter handling.
- `functions/src/modules/notivisa/` — implementation directory (to be created).
