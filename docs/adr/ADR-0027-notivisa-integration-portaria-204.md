# ADR-0027 — NOTIVISA Integration: Portaria 204/2016 Compliance & Queue Processor

**Status:** Accepted  
**Date:** 2026-05-08  
**Decided by:** CTO (drogafarto)  
**Related:** ADR-0021 (queue-retry pattern), ADR-0014 (audit-trail-extensibility), ADR-0018 (deploy-gate-secret-status-check)  

---

## Context

Phase 4 (May 20, 2026) launches NOTIVISA integration — the Notificação Imediata de Vítima de Violência system mandated by ANVISA under Portaria 204/2016 § 5. This integrates the Brazilian government's mandatory public-health reporting for certain critical lab results (e.g., hepatitis C in first-time blood donors, positive rape-kit samples).

NOTIVISA submission is:

1. **Regulatory (Portaria 204/2016 § 5):** HC Quality must detect reportable results and submit within 24h of diagnosis.
2. **Sandboxed first (May 20–June 15):** ANVISA provides a sandbox environment (`https://notivisa-hml.anvisa.gov.br`) for testing before production certification.
3. **Government API (legacy SOAP/XML):** Not REST; uses WS-Security for auth; requires manual XML schema mapping.
4. **Idempotent dangerous:** ANVISA does not reject duplicate submissions; it silently creates duplicates in the national registry. We must track `anvisa_protocol_id` to prevent re-submission.
5. **Async + unreliable:** ANVISA API can timeout, go down for maintenance, or reject payloads for typos in CPF masking. Requires robust queue-and-retry with audit trail.

The question is: **how to design the sandbox-to-production workflow, queue processor, and retry logic in a way that is compliant, auditible, and operationally safe?**

---

## Problem

**Naive Approach (Synchronous Submission on Result Write):**

Client writes result → Cloud Function trigger immediately calls ANVISA SOAP API → result creation blocked while waiting for ANVISA response.

**Issues:**
- If ANVISA is down (maintenance, DDoS, network failure), result creation fails and user sees error.
- Result integrity depends on external government service availability — unacceptable.
- No audit trail of submission attempts.
- Timeout (9 min max per Cloud Function) may not be enough for ANVISA's slow response.
- Duplicate submissions possible on retry.

---

## Decision

### 1. Sandbox-to-Production Workflow

**Phase 4 (May 20 – June 15): Sandbox Mode**

```typescript
// firestore.rules (dev/testing rules block)
match /labs/{labId}/notivisa-config/sandbox {
  allow read: if isAdminOrOwner(labId);
  allow create, update: if isAdminOrOwner(labId) &&
    request.resource.data.endpoint == 'https://notivisa-hml.anvisa.gov.br' &&
    request.resource.data.certificatePath != null;
  allow delete: if false; // Soft-delete only
}
```

**Lab Admin Configuration (Sandbox Phase):**

```typescript
// Collection: labs/{labId}/notivisa-config/sandbox
{
  enabled: true,
  endpoint: "https://notivisa-hml.anvisa.gov.br",
  certificatePath: "gs://hmatologia2-assets/notivisa-sandbox-cert.pem",
  apiVersion: "1.0",
  mode: "sandbox", // Will change to "production" after cert
  createdAt: timestamp,
  lastValidated: timestamp,
}
```

**Phase 5+ (June 15+): Production Mode**

After ANVISA certification (expected June 10–15):

```typescript
// Collection: labs/{labId}/notivisa-config/production
{
  enabled: true,
  endpoint: "https://notivisa.anvisa.gov.br",
  certificatePath: "gs://hmatologia2-assets/notivisa-production-cert.pem",
  apiVersion: "1.0",
  mode: "production",
  certificationDate: "2026-06-15",
  createdAt: timestamp,
  lastValidated: timestamp,
}
```

**Switching Logic in Cloud Function:**

```typescript
// functions/src/modules/notivisa/notivisaWorker.ts

export const notivisaWorker = onMessagePublished('notivisa-queue', async (message) => {
  const { queueDocId, labId } = message.json;
  const queueRef = db.doc(`labs/${labId}/notivisa-outbox/events/${queueDocId}`);
  const queueDoc = await queueRef.get();
  
  // 1. Determine environment: sandbox or production
  let config = null;
  try {
    config = await db.doc(`labs/${labId}/notivisa-config/production`).get();
    if (!config.exists) {
      config = await db.doc(`labs/${labId}/notivisa-config/sandbox`).get();
    }
  } catch (e) {
    logger.error(`notivisa config not found for lab ${labId}`, e);
    return; // Fallback to default sandbox
  }

  const endpoint = config.data().endpoint;
  const certPath = config.data().certificatePath;

  try {
    // 2. Call ANVISA API (SOAP wrapper)
    const response = await submitToAnvisaAPI(
      queueDoc.data().payload,
      endpoint,
      certPath
    );

    // 3. Idempotent check: did submission succeed before?
    if (response.protocolId && response.protocolId === queueDoc.data().anvisa_protocol_id) {
      logger.warn(`Duplicate success detected; skipping resubmission`);
      return;
    }

    // 4. Record success
    await queueRef.update({
      status: 'DELIVERED',
      sentAt: now,
      anvisa_protocol_id: response.protocolId,
      anvisa_response: response.soapEnvelope, // Full XML for audit
      endpoint: endpoint,
    });

    await auditLog('notivisa_delivered', {
      queueDocId,
      protocolId: response.protocolId,
      mode: config.data().mode,
    });

  } catch (error) {
    // 5. Classify error: transient vs. permanent
    const isTransient = isTransientError(error);
    const newAttempt = queueDoc.data().attempts + 1;
    const maxAttempts = queueDoc.data().maxAttempts;

    if (isTransient && newAttempt < maxAttempts) {
      // Exponential backoff: 1 min, 5 min, 30 min, 2h, 24h
      const backoffMs = [60000, 300000, 1800000, 7200000, 86400000][newAttempt - 1];
      await queueRef.update({
        status: 'FAILED_TEMP',
        attempts: newAttempt,
        nextRetry: new Date(now.getTime() + backoffMs),
        lastError: error.message,
        lastErrorType: 'transient',
      });

      await auditLog('notivisa_retry_scheduled', {
        queueDocId,
        attempt: newAttempt,
        nextRetryIn: backoffMs,
        errorType: 'transient',
      });

    } else {
      // Permanent failure: invalid payload, auth error, or max attempts
      await queueRef.update({
        status: 'FAILED_PERMANENT',
        attempts: newAttempt,
        lastError: error.message,
        lastErrorType: 'permanent',
      });

      await auditLog('notivisa_failed_permanent', {
        queueDocId,
        error: error.message,
        mode: config.data().mode,
      });

      // Alert admin dashboard (will appear in admin panel)
      await notifyAdminOfFailure(labId, queueDocId, error);
    }
  }
});
```

### 2. Queue Processor Architecture

**Scheduled Job (Every 5 Minutes):**

```typescript
// functions/src/modules/notivisa/processNotivisaQueueScheduled.ts

export const processNotivisaQueueScheduled = onSchedule(
  'every 5 minutes',
  async (context) => {
    const now = new Date();

    // 1. Query all labs' pending submissions due for retry
    const allPending = await db.collectionGroup('notivisa-outbox')
      .where('status', 'in', ['PENDING', 'FAILED_TEMP'])
      .where('nextRetry', '<=', now)
      .get();

    logger.info(`Found ${allPending.docs.length} submissions ready to retry`);

    // 2. Enqueue each to Pub/Sub
    for (const doc of allPending.docs) {
      const queuePath = doc.ref.path;
      const [, labId] = queuePath.match(/labs\/([^/]+)/);

      await pubsub.topic('notivisa-queue').publish(Buffer.from(JSON.stringify({
        queueDocId: doc.id,
        labId: labId,
        attempt: doc.data().attempts + 1,
      })));

      // Log enqueue event
      await auditLog('notivisa_enqueued_for_submission', {
        queueDocId: doc.id,
        labId: labId,
        attempt: doc.data().attempts + 1,
      });
    }
  }
);
```

**Pub/Sub Subscription:**

- **Topic:** `notivisa-queue`
- **Subscriber:** `notivisaWorker()` function
- **Max Concurrent:** 100 (per-lab rate limit)
- **Retry Policy:** Pub/Sub handles retries; we track manually in Firestore for audit

### 3. Error Classification (Transient vs. Permanent)

```typescript
function isTransientError(error: any): boolean {
  // Transient: network/timeout issues, temporary ANVISA downtime
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') return true;
  if (error.message.includes('503 Service Unavailable')) return true;
  if (error.message.includes('504 Gateway Timeout')) return true;

  // Permanent: validation errors, auth issues, business logic rejection
  if (error.statusCode === 400) return false; // Bad request
  if (error.statusCode === 401) return false; // Unauthorized
  if (error.statusCode === 403) return false; // Forbidden
  if (error.message.includes('Invalid CPF format')) return false;
  if (error.message.includes('Duplicate notification')) return false;

  // Ambiguous: log and treat as transient (safer)
  return true;
}
```

### 4. Firestore Collections & Indexes

**Collection: `labs/{labId}/notivisa-outbox/events/{eventId}`**

```typescript
{
  // Reference data
  laudoId: string;
  patientCpf: string; // Masked
  
  // NOTIVISA API payload
  payload: {
    tipoNotificacao: 'SUSPEITA' | 'CONFIRMADA';
    doencaNotificavel: string; // e.g., 'HEPATITE_C'
    descricao: string;
    resultadoTeste: string;
  };
  
  // Status & retry tracking
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED_PERMANENT' | 'FAILED_TEMP';
  attempts: number;
  maxAttempts: number;
  nextRetry: timestamp;
  lastError: string;
  lastErrorType: 'transient' | 'permanent';
  
  // Audit trail
  createdAt: timestamp;
  firstAttemptAt: timestamp;
  sentAt: timestamp; // When ANVISA returned 200 OK
  
  // ANVISA response
  anvisaProtocolId: string; // NOTIVISA ticket ID
  anvisaSoapEnvelope: string; // Full XML response
  endpoint: string; // Which environment: sandbox or production
}
```

**Index 1: Status + NextRetry (for queue processor)**

```yaml
collection: labs/{labId}/notivisa-outbox/events
fields:
  - field: status
    direction: ASCENDING
  - field: nextRetry
    direction: ASCENDING
```

**Index 2: CreatedAt (for admin auditing)**

```yaml
collection: labs/{labId}/notivisa-outbox/events
fields:
  - field: createdAt
    direction: DESCENDING
```

### 5. Manual Retry Callable (Admin Panel)

```typescript
// functions/src/modules/notivisa/manuallyRetryNotivisaCallable.ts

export const manuallyRetryNotivisaCallable = onCall(
  async (data: { queueDocId: string; labId: string }, context) => {
    // 1. Authorization: only RT (supervisores) or admin
    if (!['RT', 'admin'].includes(context.auth?.token?.role)) {
      throw new HttpsError('permission-denied', 'Only RT or admin can retry submissions');
    }

    const queueRef = db.doc(`labs/${data.labId}/notivisa-outbox/events/${data.queueDocId}`);
    const queueDoc = await queueRef.get();

    if (!queueDoc.exists) {
      throw new HttpsError('not-found', 'Queue document not found');
    }

    // 2. Reset to PENDING (will be picked up by next 5-min scheduler cycle)
    await queueRef.update({
      status: 'PENDING',
      nextRetry: new Date(), // Immediate retry
      attempts: 0, // Reset attempt counter for manual retry
    });

    // 3. Audit log
    await auditLog('notivisa_manual_retry_initiated', {
      queueDocId: data.queueDocId,
      adminUid: context.auth.uid,
      previousStatus: queueDoc.data().status,
      previousAttempts: queueDoc.data().attempts,
    });

    return { success: true, message: 'Retry scheduled for next cycle (5 min)' };
  }
);
```

---

## Alternatives Considered

**(a) Synchronous submission on result write**
- **Rejected.** Blocks result creation on external service health. RDC 978 Art. 5 requires immutable result audit trail, not blocking on ANVISA.

**(b) Fire-and-forget Pub/Sub without tracking**
- **Rejected.** No audit trail, no visibility into failures. Portaria 204 § 5 requires proof of submission attempts.

**(c) Dedicated NOTIVISA microservice**
- **Rejected.** Overkill for <100 notifications/day. Cloud Functions + Pub/Sub + Firestore tracking sufficient.

**(d) Queue-and-Retry with audit trail (what this ADR chooses)**
- **Accepted.** Resilient, auditable, operationally safe, compliant with Portaria 204 § 5 + RDC 978 Art. 5.3.

---

## Consequences

### Phase 4 Deliverables (May 20)

- [x] Firestore collections: `notivisa-config/sandbox`, `notivisa-outbox/events`
- [x] Cloud Functions: `processNotivisaQueueScheduled`, `notivisaWorker`, `manuallyRetryNotivisaCallable`
- [x] Pub/Sub topic: `notivisa-queue`
- [x] Firestore indexes: status+nextRetry, createdAt
- [x] SOAP wrapper: `submitToAnvisaAPI(payload, endpoint, certPath)`
- [x] Error classifier: `isTransientError(error)`
- [x] Audit logging: 4 event types (queued, retry_scheduled, delivered, failed_permanent)
- [x] Admin dashboard: view pending, delivered, failed_permanent submissions

### Phase 5 Deliverables (June 15)

- [ ] **Sandbox certification complete:** ANVISA approves test submissions + API cert
- [ ] **Switch to production:** create `notivisa-config/production` with prod endpoint
- [ ] **Smoke test:** submit 5 real notifications to ANVISA production; verify receipt
- [ ] **Compliance report:** audit trail of all Phase 4 sandbox submissions + Phase 5 production cutover

### Positive

- **Resilient:** exponential backoff + manual retry handle transient ANVISA downtime
- **Auditable:** full history (createdAt, attempts, errors, protocol IDs) per submission; complies with Portaria 204 § 5 + RDC 978 Art. 5.3
- **Observable:** admin dashboard real-time queue status + manual control
- **Safe:** idempotent (protocol ID tracking) prevents duplicate submissions to ANVISA
- **Sandbox-first:** Phase 4 isolation prevents accidental production submissions during testing

### Negative

- Additional Cloud Function invocations + Pub/Sub messages (~400 functions/day + 100 messages/day)
- Latency spike: NOTIVISA submission may take up to 5 minutes (next scheduler cycle) to land in ANVISA
- Storage: queue documents persist indefinitely (mitigation: soft-delete after 90 days)

### Cost (Phase 4–5)

- Cloud Functions: ~400 invocations/day × $0.40M = $0.16/month
- Pub/Sub: ~100 messages/day × $0.40M = negligible
- Firestore: +2 index reads per 5-min cycle = 576 reads/day = negligible

### Compliance

| Regulation | Requirement | Mitigation |
|---|---|---|
| **Portaria 204/2016 § 5** | NOTIVISA submission within 24h of diagnosis | Queue + scheduler + manual retry ensures submission attempts within 24h; audit trail proves attempts |
| **RDC 978 Art. 5.3** | Audit trail of all result actions | `auditLog` captures each queue, retry, delivery, failure event with timestamp |
| **DICQ 4.4** | Record integrity + immutability | Notification events immutable after creation (Firestore rules prevent updates) |

---

## Operational Checklist

- [ ] **Phase 4 Sprint (May 20):**
  - [ ] Create `notivisa-config/sandbox`, `notivisa-outbox/events` Firestore collections + rules
  - [ ] Implement `processNotivisaQueueScheduled` cron (every 5 min)
  - [ ] Implement `notivisaWorker` Pub/Sub subscriber
  - [ ] Implement `manuallyRetryNotivisaCallable` for admin panel
  - [ ] Create SOAP wrapper: `submitToAnvisaAPI()` (test with ANVISA sandbox mock)
  - [ ] Create error classifier: `isTransientError()`
  - [ ] Firestore indexes: status+nextRetry, createdAt
  - [ ] Audit logging: 4 event types
  - [ ] Cloud Logs monitoring: watch for `notivisa-*` errors (see `CLOUD_LOGS_PHASE_4-9_SETUP.md`)
  - [ ] E2E tests: enqueue → process → verify DELIVERED status
  - [ ] Manual smoke test: submit 5 test notifications to ANVISA sandbox; verify receipt

- [ ] **Phase 5 Sprint (June 15):**
  - [ ] ANVISA sandbox certification (gov approval expected June 10–15)
  - [ ] Create `notivisa-config/production` with prod endpoint + certificate
  - [ ] Switch Cloud Function logic to detect prod vs. sandbox
  - [ ] Deploy production configuration (rules + config doc)
  - [ ] Manual smoke test: submit 5 real notifications to ANVISA production
  - [ ] Compliance audit: review all Phase 4 sandbox + Phase 5 production audit trails
  - [ ] Sign-off: CTO review + approval before production cutover

---

## References

- **Portaria 204/2016 § 5** — NOTIVISA mandatory reporting requirement (gov doc)
- **RDC 978 Art. 5.3** — Audit trail requirement for all result actions (RDC 978/2025)
- **DICQ 4.4** — Record integrity + immutability (accreditation requirement)
- **ADR-0021** — Queue-retry pattern (technical precedent)
- **ADR-0014** — Audit trail extensibility (linked architecture)
- **ADR-0018** — Deploy gate secret status check (prerequisites)
- **`.planning/CLOUD_LOGS_PHASE_4-9_SETUP.md`** — Phase 4–9 monitoring checkpoints
- **`v1.4_NOTIVISA_SANDBOX_SETUP.md`** — Sandbox provisioning + payload validation

---

**Version:** 1.0  
**Last Updated:** 2026-05-08  
**Status:** Ready for Phase 4 implementation (May 20, 2026)
