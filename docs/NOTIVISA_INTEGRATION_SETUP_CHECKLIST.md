# NOTIVISA Integration Setup Checklist

**Purpose:** Pre-deployment validation of NOTIVISA integration infrastructure (Phase 4)  
**Status:** Preparation  
**Timeline:** To be completed by 2026-05-19 (1 day before Phase 4 kickoff)  
**Owner:** Agent 3 (Phase 4-03)  
**Regulatory:** RDC 978 Art. 6º §1 (notification of results to healthcare professionals)

---

## 1. Credentials & Authentication

### 1.1 Sandbox Account Access
- [ ] **Receive sandbox credentials** from NOTIVISA provider
  - Username/email
  - API key or OAuth token (note format: Bearer/Basic/Custom)
  - Certificate files (if mTLS required)
  - Endpoint URL (sandbox vs. production)
  - Contact name and phone for escalation
- [ ] **Store credentials in Firebase Secrets Manager**
  - Secret name: `notivisa_sandbox_key`
  - Secret name: `notivisa_sandbox_cert` (if applicable)
  - Verify secret can be referenced in `functions/src/services/notivisaService.ts`
  - Confirm rotation schedule (recommend 90-day key rotation)
- [ ] **Document credential expiry**
  - Expiry date in project wiki
  - Add calendar reminder 2 weeks before expiry
  - Establish backup credentials or alternative contact

### 1.2 Test Credentials Validation
- [ ] **Test connectivity** with credentials (manual cURL test)
  ```bash
  curl -X POST https://sandbox.notivisa.gov.br/api/v3/authenticate \
    -H "Authorization: Bearer <API_KEY>" \
    -H "Content-Type: application/json"
  ```
- [ ] **Document response format** (HTTP status, payload schema)
- [ ] **Set up 2FA/MFA** (if provider offers it)

---

## 2. API Documentation & Schema Validation

### 2.1 Portaria 204 Compliance
- [ ] **Obtain official NOTIVISA v3.0 API documentation** from provider
  - File path: `/docs/NOTIVISA_API_v3.0_Official.pdf` (store in shared drive)
  - Confirm document date (must be current 2026 version)
  - Verify schema version is 3.0 (not legacy 2.x)
- [ ] **Extract key endpoints** and document in `/docs/NOTIVISA_API_ENDPOINTS.md`:
  - Authentication endpoint
  - Notification submission endpoint
  - Status polling endpoint
  - Webhook callback endpoint
  - Batch submission endpoint (if available)
- [ ] **Validate payload schema** against RDC 978 requirements
  - Required fields: `resultId`, `labId`, `rtId`, `analyteName`, `value`, `units`, `referenceRange`, `timestamp`
  - Optional fields: `criticality`, `notes`, `attachments`
  - String formats: UTF-8, max lengths, character restrictions
  - Date/time formats: ISO 8601 with UTC timezone

### 2.2 Data Mapping to Firestore Models
- [ ] **Review `notivisa-outbox` collection schema** (designed in Phase 3)
  ```typescript
  interface NotivisaOutboxEvent {
    id: string; // docId
    labId: string;
    resultId: string; // reference to criticos or liberacao result
    rtId: string; // recipient RT ID
    payload: NotivisaPayload; // raw API schema
    status: 'pending' | 'queued' | 'sent' | 'failed' | 'retrying';
    attempts: number;
    lastAttemptAt?: Timestamp;
    nextRetryAt?: Timestamp;
    sentAt?: Timestamp;
    notivisaEventId?: string; // response ID from NOTIVISA
    errorLog: ErrorEntry[];
    criadoEm: Timestamp;
    deletadoEm?: Timestamp;
    signature: LogicalSignature;
  }
  ```
- [ ] **Map Firestore fields to NOTIVISA API payload**
  - Validate no data loss in serialization
  - Confirm all required NOTIVISA fields are populated
  - Test with 5 sample result records (manual JSON export)
- [ ] **Document field transformations** (e.g., `resultId` → NOTIVISA `exameId`, timezone conversions)

### 2.3 Webhook Receiver Specification
- [ ] **Confirm webhook schema** from NOTIVISA provider
  - Callback event types: `notification_delivered`, `notification_failed`, `notification_expired`
  - Signature validation method (HMAC-SHA256? Custom?)
  - Retry policy if webhook receiver is down
  - Request timeout expectation (<5s typical)
- [ ] **Document webhook flow** in `/docs/NOTIVISA_WEBHOOK_RECEIVER.md`

---

## 3. Rate Limits & Throttling Strategy

### 3.1 NOTIVISA API Limits
- [ ] **Request rate limit** from documentation
  - Requests per minute (RPM): ___
  - Requests per day (RPD): ___
  - Burst allowance: ___
  - Throttling error code: ___
- [ ] **Payload size limits**
  - Max bytes per notification: ___
  - Max concurrent requests: ___
- [ ] **Document limits** in `/docs/NOTIVISA_RATE_LIMITS.md`

### 3.2 Client-Side Throttling Implementation
- [ ] **Implement exponential backoff** in `notivisaService.ts`
  - Start delay: 2 seconds
  - Max delay: 5 minutes
  - Backoff multiplier: 2.0
  - Max retries: 5 (total ~10 min window)
- [ ] **Implement queue processor** (polling from `notivisa-outbox`)
  - Poll interval: 30 seconds (configurable)
  - Batch size per poll: 10 (configurable)
  - Max concurrent submissions: 3 (configurable via env var)
- [ ] **Add metrics** to track:
  - Queue depth (pending + retrying count)
  - Submission rate (events/minute)
  - Error rate (failed / submitted %)
  - Avg latency from event creation to NOTIVISA send

### 3.3 Firestore Write Throttling
- [ ] **Verify Firestore write quota** is sufficient
  - Baseline daily writes: 50K (estimated for 50 labs, 10 results/day each)
  - Spike capacity: 1M writes/day (burst tolerance)
  - Document quota in Firestore console for `notivisa-outbox` collection
- [ ] **Set up write quota monitoring** via Firebase Console alerts
  - Alert threshold: 80% of daily quota
  - Notification: Slack webhook to #hc-quality-ops

---

## 4. Error Handling & Failure Scenarios

### 4.1 NOTIVISA Service Unavailability
- [ ] **Define retry strategy** when NOTIVISA API is down
  - HTTP 5xx errors: exponential backoff (max 5 retries)
  - Connection timeout (>10s): retry after 30s, max 3 times
  - DNS resolution failure: treat as timeout
  - Fallback: queue remains in Firestore, manual retry via Cloud Task
- [ ] **Implement circuit breaker**
  - Trip circuit if error rate >50% for 5 consecutive requests
  - Circuit open duration: 5 minutes (then try 1 probe request)
  - Log circuit state changes to Cloud Logs

### 4.2 Invalid Payload Errors
- [ ] **Handle schema validation failures** (4xx errors from NOTIVISA)
  - HTTP 400 (Bad Request): validate payload schema, log error, mark as `failed` (no retry)
  - HTTP 401/403 (Auth): log error, escalate to ops (check credentials)
  - HTTP 422 (Validation): parse error details, log for debugging
- [ ] **Implement payload sanitization**
  - Strip PII before logging (mask RT email/phone in error messages)
  - Validate UTF-8 encoding
  - Test with non-ASCII lab names (e.g., "Laboratório de Análises")

### 4.3 Network & Timeout Errors
- [ ] **Define timeout thresholds**
  - Connection timeout: 5 seconds
  - Read timeout: 10 seconds (for large payloads)
  - Total timeout: 15 seconds (request → response)
- [ ] **Implement timeout recovery**
  - Log timeout with request ID and retry count
  - Mark event as `retrying` with next retry timestamp
  - Alert ops if timeout rate >10% in a 1-hour window
- [ ] **Test timeout behavior** in emulator with artificial latency

### 4.4 Audit Trail for Failed Events
- [ ] **Log all failures to `events` subcollection** under `notivisa-outbox/{eventId}/events`
  ```typescript
  interface NotivisaEvent {
    id: string; // docId
    type: 'submission_attempt' | 'success' | 'failure' | 'retry';
    timestamp: Timestamp;
    httpStatus?: number;
    errorMessage?: string;
    errorCode?: string; // NOTIVISA error code
    retryAttempt: number;
    operatorId: string; // operator who triggered submission
    ipAddress: string; // request IP (for audit)
    signature: LogicalSignature;
  }
  ```
- [ ] **Implement soft-delete** for failed events (never hard delete)
- [ ] **Generate daily failure report** (Cloud Logs + Cloud Function)
  - Report path: `/reports/notivisa-failures-{YYYY-MM-DD}.json`
  - Include: total failures, error categories, affected labs
  - Send to #hc-quality-ops Slack channel

---

## 5. Webhook Receiver Setup (Receiving Notifications)

### 5.1 Cloud Function Webhook Endpoint
- [ ] **Create Cloud Function** `notivisaWebhookReceiver`
  - HTTP trigger (public endpoint)
  - Region: southamerica-east1
  - Memory: 256 MB
  - Timeout: 60 seconds
  - Max instances: 100
- [ ] **Implement signature validation**
  - Extract `X-Notivisa-Signature` header
  - Compute HMAC-SHA256 of request body using secret key
  - Compare signatures (constant-time comparison)
  - Reject if signature invalid (HTTP 401)
- [ ] **Log webhook requests**
  - Log request headers (no Authorization/secrets)
  - Log request body (no PII)
  - Log response status

### 5.2 Webhook Event Processing
- [ ] **Parse webhook payload** and validate schema
  - Expected events: `delivered`, `failed`, `expired`
  - Update corresponding `notivisa-outbox/{eventId}` document
  - Mark as `sent` if delivered, `failed` if not
- [ ] **Idempotency**
  - Store webhook event IDs in `webhook-events` collection to detect duplicates
  - If duplicate detected, return HTTP 200 (success) without re-processing
  - Retention: 7 days (auto-delete via TTL)
- [ ] **Error handling in webhook**
  - If Firestore write fails, return HTTP 500 (NOTIVISA will retry)
  - Log error for manual investigation
  - Alert ops if >5 consecutive failures

### 5.3 Webhook Retry Tolerance
- [ ] **Document NOTIVISA webhook retry policy**
  - Retry interval: ___ (e.g., 5, 10, 30 minutes)
  - Max retries: ___ (e.g., 5 times)
  - Total retry window: ___ (e.g., 24 hours)
- [ ] **Test webhook receiver availability**
  - Monitor Cloud Function uptime (target: 99.9%)
  - Set up Cloud Monitoring alert if function errors >1% in 5-min window
  - Have fallback: manual polling endpoint in NOTIVISA API

---

## 6. Firestore Indexes & Performance

### 6.1 Collection Indexes
- [ ] **Verify `notivisa-outbox` indexes** are created
  ```
  Collection: notivisa-outbox
  Index 1: labId (Asc), status (Asc), criadoEm (Desc) — for queue polling
  Index 2: labId (Asc), rtId (Asc), status (Asc) — for RT-specific queries
  Index 3: status (Asc), nextRetryAt (Asc) — for retry scheduling
  ```
- [ ] **Verify indexes in Firebase Console**
  - Go to Firestore → Indexes
  - Confirm status: "Enabled" for all 3 indexes
- [ ] **Check `events` subcollection indexes** (if needed)
  - Typically not required if queries filter by parent + timestamp only

### 6.2 Query Performance Baseline
- [ ] **Benchmark baseline queries**
  - Query: `notivisa-outbox` where `status = pending` and `labId = X` (limit 100)
  - Target latency: <100ms
  - Test with 10K events in collection
  - Document result in `/docs/NOTIVISA_PERFORMANCE_BASELINE.md`
- [ ] **Monitor Firestore metrics**
  - Cloud Monitoring dashboard: "HC Quality → Firestore → notivisa-outbox"
  - Metric: Read latency, Write latency, Document size
  - Alert threshold: Latency >200ms for 5 consecutive reads

---

## 7. Testing & Validation

### 7.1 Sandbox Integration Tests
- [ ] **Unit tests** (in `/functions/src/__tests__/notivisaService.test.ts`)
  - [ ] Payload schema validation
  - [ ] HMAC signature generation/validation
  - [ ] Exponential backoff calculation
  - [ ] Queue state transitions (pending → sent → failed)
- [ ] **Integration tests** (using emulator)
  - [ ] Queue write → submission attempt → success
  - [ ] Queue write → submission failure → retry after backoff
  - [ ] Webhook callback → update Firestore status
  - [ ] Timeout scenario → circuit breaker activation
- [ ] **End-to-end tests** (in sandbox environment)
  - [ ] Create a test result in Firestore
  - [ ] Trigger NOTIVISA submission (manual or via Cloud Task)
  - [ ] Confirm NOTIVISA API receives payload
  - [ ] Confirm webhook callback updates Firestore
  - [ ] Verify audit trail is complete

### 7.2 Error Scenario Testing
- [ ] **Test invalid credentials** (use expired/fake key)
  - Expected: HTTP 401, circuit breaker trips
- [ ] **Test network timeout** (artificial latency via mocked HTTP client)
  - Expected: timeout after 10s, exponential backoff triggered
- [ ] **Test invalid payload** (missing required fields)
  - Expected: HTTP 422, event marked as failed, no retry
- [ ] **Test NOTIVISA unavailability** (mock 503 Service Unavailable)
  - Expected: exponential backoff + retry up to 5 times
- [ ] **Test webhook receiver down** (simulate function error)
  - Expected: NOTIVISA retries webhook per its policy

### 7.3 Load Testing (Pre-Production)
- [ ] **Simulate daily load**
  - 50 labs × 10 results/day = 500 NOTIVISA submissions/day
  - Spread over business hours (8am–6pm BRT, 10 hours)
  - Rate: ~50 submissions/hour = ~1 per minute
  - Test with load generator (Apache JMeter or similar)
  - Confirm queue doesn't exceed 100 pending events at any time
- [ ] **Simulate burst load**
  - 500 submissions in 1 hour (spike scenario)
  - Confirm rate limiting works + no errors
  - Verify Firestore quota not exceeded

### 7.4 Test Reporting
- [ ] **Document test results** in `/docs/NOTIVISA_TEST_REPORT.md`
  - Test date: ___
  - Sandboxgel API version tested: ___
  - Test scenarios: Scenario | Pass/Fail | Notes
  - Error scenarios: All scenarios | Pass
  - Load test: Peak load | Latency | Errors

---

## 8. Audit Trail & Compliance

### 8.1 Audit Log Requirements (RDC 978 Art. 5.3)
- [ ] **Log all NOTIVISA interactions**
  - Submission timestamp + request body (sanitized)
  - Response status + response body
  - Operator who initiated submission (if manual trigger)
  - Audit trail in Firestore `events` subcollection + Cloud Logs
- [ ] **Implement immutability** for audit logs
  - `events` subcollection is append-only (security rules block deletes)
  - Soft-delete only via `deletedAt` flag (never hard delete)
- [ ] **Retention policy**
  - Retain logs for 5 years (regulatory requirement)
  - Archive to Cloud Storage after 1 year (cost optimization)

### 8.2 Data Privacy (LGPD Arts. 9, 18, 38)
- [ ] **PII in logs**
  - Never log RT email/phone in error messages (mask if necessary)
  - Never log patient name/ID if visible in result payload
  - Log only operator ID, not operator name
- [ ] **Webhook payload handling**
  - Validate webhook signature to ensure authenticity
  - Log only success/failure status, not full webhook body
- [ ] **Data retention after result lifecycle ends**
  - When result is deleted (soft-delete), mark NOTIVISA event as deleted
  - Purge from queue after 7 days if status is `failed`

### 8.3 Compliance Checklist
- [ ] **RDC 978 Art. 6º §1** — Result notification requirements
  - Confirm NOTIVISA payload includes: result value, interpretation, reference range
  - Confirm timestamp is recorded and audited
- [ ] **RDC 978 Art. 204** — Audit trail for result release
  - Confirm each NOTIVISA submission is logged with operator ID and timestamp
- [ ] **LGPD Art. 9** — Informed consent
  - Confirm RT has consented to receive notifications (document in `portal-configuracao`)
- [ ] **DICQ 4.3 Block I** — Result release and communication
  - Confirm NOTIVISA integration satisfies requirement 4.3.I.1 (clinical notification)

---

## 9. Deployment Checklist (Pre-Phase 4 Deployment)

### 9.1 Pre-Deployment Validation
- [ ] **All tests passing** (unit + integration + E2E)
  - Run: `npm run test -- notivisaService`
  - Expected: 100% pass rate
- [ ] **TypeScript compilation** without errors
  - Run: `npx tsc --noEmit`
  - Expected: 0 errors in `functions/src/`
- [ ] **Cloud Function deployment** successful
  - Run: `firebase deploy --only functions:notivisaQueueProcessor`
  - Expected: Deployment success, no warnings
- [ ] **Firestore Rules** deployed with NOTIVISA collection rules
  - Confirm rules block client-side writes to `notivisa-outbox`
  - Confirm only Cloud Functions can write (via `request.auth.uid === null`)
- [ ] **Secrets Manager** provisioned
  - Confirm `notivisa_sandbox_key` exists and is accessible
  - Confirm Cloud Function has permission to read secret
  - Run test: `gcloud secrets versions access latest --secret="notivisa_sandbox_key"`

### 9.2 Deployment Order (Dependency Chain)
1. Deploy Firestore Rules (includes notivisa-outbox collection rules)
2. Deploy Cloud Functions (`notivisaQueueProcessor`, `notivisaWebhookReceiver`)
3. Update Firestore Indexes (if not auto-created)
4. Configure Cloud Tasks (if using task scheduler instead of polling)
5. Enable Cloud Logging + Metrics
6. Validate with smoke tests (Phase 4-04)

### 9.3 Go/No-Go Gate
- [ ] **All items in sections 1–8 are complete** ✓
- [ ] **No blocking risks** (see Risk Register below)
- [ ] **Stakeholder sign-off** from RT lead + CTO
- [ ] **Phase 4 kickoff date: 2026-05-20** (mark calendar)

---

## 10. Support & Escalation

### 10.1 NOTIVISA Provider Contact
- **Provider:** NOTIVISA
- **Account Manager:** ___ (Name, email, phone)
- **Technical Support:** support@notivisa.gov.br | +55-XX-XXXX-XXXX
- **Support Hours:** Business days, 8am–6pm BRT
- **SLA:** ___ (expected response time for critical issues)

### 10.2 Internal Escalation Path
- **L1 (Agent):** Agent 3 (Phase 4-03 owner) — notivisaService + queue processor
- **L2 (Team Lead):** Engineering manager — resource allocation, urgent decisions
- **L3 (CTO):** Compliance + architecture decisions + vendor coordination

### 10.3 Known Issues & Workarounds
| Issue | Status | Workaround | Owner |
|-------|--------|-----------|-------|
| (To be populated after sandbox testing) | — | — | — |

---

## Appendix A: Key Files & References

- **Integration code:** `functions/src/services/notivisaService.ts`
- **Queue processor:** `functions/src/callables/notivisaQueueProcessor.ts`
- **Webhook receiver:** `functions/src/callables/notivisaWebhookReceiver.ts`
- **Firestore Rules:** `firestore.rules` (lines TBD)
- **Type definitions:** `functions/src/types/notivisa.ts`
- **Tests:** `functions/src/__tests__/notivisaService.test.ts`
- **Design doc:** `.planning/milestones/v1.4-PHASE-0-PLAN.md` (Phase 0, Task 04-03)
- **RDC 978 mapping:** `.planning/milestones/v1.4-RDC-978-COMPLIANCE-MATRIX.md` (Art. 6º §1)

---

## Appendix B: Sign-Off Template

**Integration Validation Complete:** `[ ] Yes [ ] No`  
**Date:** ___________  
**Validated By:** _________________ (Agent 3, Phase 4-03)  
**Reviewed By:** _________________ (Engineering Manager)  
**Approved By:** _________________ (CTO)  

**Notes / Open Items:**
```
(Use this section to document any blockers or deferred items)
```

---

**Last Updated:** 2026-05-07  
**Status:** Ready for Phase 4 (2026-05-20)
