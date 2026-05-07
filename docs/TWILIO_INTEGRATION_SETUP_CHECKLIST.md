# Twilio Integration Setup Checklist

**Purpose:** Pre-deployment validation of Twilio SMS & WhatsApp integration (Phase 5)  
**Status:** Preparation  
**Timeline:** To be completed by 2026-06-08 (1 day before Phase 5 kickoff)  
**Owner:** Agent 1 (Phase 5-01)  
**Regulatory:** RDC 978 Arts. 6, 115–117 (critical value notification + escalation)

---

## 1. Account Provisioning & Setup

### 1.1 Twilio Account Configuration
- [ ] **Confirm account provisioning** from Twilio (sign-up complete)
  - Account SID: _______________
  - Auth Token: _______________
  - Account type: Standard or Enterprise?
  - Region: southamerica-east1 (if available) or us-east-1 (fallback)
  - Pricing plan: Pay-as-you-go or committed (preferred)
- [ ] **Store credentials in Firebase Secrets Manager**
  - Secret name: `twilio_account_sid`
  - Secret name: `twilio_auth_token`
  - Rotation schedule: 90-day key rotation
  - Access: Cloud Functions only (IAM role: `Secret Accessor`)
- [ ] **Enable required Twilio services** in account settings
  - [ ] SMS service (Messaging API)
  - [ ] WhatsApp Business API (if Phase 5 expansion approved)
  - [ ] Phone number service (TwiML)

### 1.2 Account Security & Compliance
- [ ] **Enable account-level security features**
  - [ ] Two-factor authentication (2FA) for account login
  - [ ] IP whitelisting (restrict API access to GCP Cloud Functions subnet)
  - [ ] API key rotation policy (90 days)
  - [ ] Disable API keys not in use
- [ ] **Configure fraud prevention**
  - [ ] Enable Twilio's fraud detection
  - [ ] Set spending limit (daily cap, recommended: 2x average daily spend)
  - [ ] Configure alerts for unusual activity (>150% daily increase)
- [ ] **Document account details** in secure location (1Password / shared vault)
  - Account owner name
  - Backup admin contact
  - Emergency support number

---

## 2. Phone Numbers & Regional Allocation

### 2.1 SMS Short Code / Long Code Provisioning
- [ ] **Determine phone number strategy**
  - Option A: Long code (traditional 11-digit number) — slower, cheaper, no approval
  - Option B: Short code (5–6 digits) — faster delivery, requires approval, ~2 week wait
  - Option C: Toll-free number — approved by Twilio, takes ~1 week
  - **Recommended for lab:** Long code + SMS (no approval needed, good for internal use)
- [ ] **Provision phone number(s) for Brazil (southamerica-east1)**
  - Country: BR (Brazil)
  - Area code(s): 11 (São Paulo), 21 (Rio), 31 (Minas Gerais) — or national
  - Quantity: 2 numbers (primary + backup) recommended
  - Phone number 1: _____________
  - Phone number 2: _____________
  - Purchase date(s): ___________
- [ ] **Verify phone number details in Twilio Console**
  - Confirm status: "Active"
  - Confirm SMS capability: "Enabled"
  - Confirm incoming webhook ready (if two-way SMS planned)

### 2.2 Incoming SMS Configuration (if needed for future)
- [ ] **Set incoming webhook callback** (for Phase 5 expansion or later)
  - Webhook URL: `https://hmatologia2.web.app/api/sms-webhook`
  - HTTP method: POST
  - Format: application/x-www-form-urlencoded
  - Retry policy: Twilio retries 3x over 10 minutes
- [ ] **Test webhook connectivity** (manual curl test)
  ```bash
  # Simulate Twilio webhook
  curl -X POST https://hmatologia2.web.app/api/sms-webhook \
    -d "MessageSid=SMxxxxx" \
    -d "From=%2B5511999999999" \
    -d "Body=Test+message"
  ```

### 2.3 Number Verification (Business Requirements)
- [ ] **Verify numbers are registered to lab** (if required by Twilio)
  - Lab name: _______________
  - Lab CNPJ: _______________
  - Registered address: _______________
  - Verification status: Approved / Pending
- [ ] **Document number allocation strategy** in `/docs/TWILIO_PHONE_NUMBERS.md`
  - Which lab gets which number?
  - Fallback logic if primary number fails

---

## 3. SMS Configuration & Rate Limits

### 3.1 SMS API Settings
- [ ] **Review Twilio Messaging API limits** (from account console)
  - Concurrent connections: ___ (typically 500–1000)
  - Throughput: ___ messages/second (typically 1–10 depending on plan)
  - Regional latency: ___ ms to Brazil
- [ ] **Document limits** in `/docs/TWILIO_RATE_LIMITS.md`
- [ ] **Confirm character encoding**
  - SMS standard: 160 characters (GSM 7-bit)
  - Unicode: 70 characters (for lab names with accents: "Laboratório")
  - Plan: Use GSM encoding with automatic rollover to Unicode if needed

### 3.2 Outbound SMS Configuration
- [ ] **Set up SMS sender ID** (From number)
  - Use provisioned phone number (above)
  - Alternatively, use Twilio shortcode (if purchased)
  - Document in code as environment variable: `TWILIO_SENDER_PHONE`
- [ ] **Configure message delivery reports** (status callbacks)
  - Callback URL: `https://hmatologia2.web.app/api/sms-status-callback`
  - Statuses: `queued | failed | sent | delivered | undelivered`
  - Failure codes: Document which codes warrant escalation
- [ ] **Test SMS delivery**
  - Send test SMS to team member's phone
  - Expected delivery: <30 seconds (Brazil coverage)
  - Confirm delivery status callback received

### 3.3 Throughput & Throttling Strategy
- [ ] **Calculate daily SMS volume**
  - 50 labs × 5 critical alerts/lab/day = 250 SMS/day (typical)
  - Peak scenario: 500 labs × 10 alerts/day = 5,000 SMS/day
  - Throughput: 5,000 / (8 hours business = 28,800 seconds) ≈ 0.17 SMS/sec ✓ (well below Twilio limits)
- [ ] **Implement client-side rate limiting**
  - Per-operator: Max 1 SMS per 10 seconds (avoid duplicate escalations)
  - Per-lab: Max 10 SMS per minute (surge protection)
  - Implement queue processor with exponential backoff (if Twilio rate limit hit)
- [ ] **Configure Twilio spending limit**
  - Estimated daily cost: $0.01/SMS × 250 = $2.50 (typical)
  - Set daily spending cap: $50 (20x buffer)
  - Alert threshold: $40 (80% of cap)
  - Billing contact: _____________

---

## 4. WhatsApp Business API Setup (Phase 5 Expansion)

### 4.1 WhatsApp Business Account (Deferred to Phase 5)
- [ ] **Status:** Deferred (non-blocking for Phase 5-01 SMS core)
- [ ] **Prerequisites for future enablement**
  - [ ] Lab CNPJ verified with Meta/Twilio
  - [ ] Business phone number registered
  - [ ] Privacy policy + Terms of Service published
  - [ ] Message templates pre-approved by Meta
- [ ] **Placeholder:** Document expansion strategy in `/docs/TWILIO_WHATSAPP_ROADMAP.md`

---

## 5. Error Handling & Failure Scenarios

### 5.1 Twilio Service Unavailability
- [ ] **Define retry strategy** when Twilio API is down
  - HTTP 5xx errors: exponential backoff (start 2s, max 5 retries)
  - Connection timeout (>10s): retry after 30s, max 3 times
  - Rate limit (429): backoff per `Retry-After` header (respect immediately)
  - Queue in Firestore `criticos-escalacoes/escalation-queue` if all retries fail
- [ ] **Implement circuit breaker**
  - Trip circuit if error rate >50% for 5 consecutive requests
  - Circuit open duration: 5 minutes (then probe)
  - Fall back to email delivery (SendGrid) when circuit open

### 5.2 Invalid Phone Number Errors
- [ ] **Handle Twilio response codes** (from API)
  - 400 (Invalid number): Log, mark as `failed`, no retry (flag for human review)
  - 404 (Not found): Retry 1x with Twilio's number lookup service
  - 429 (Too many requests): Exponential backoff + queue
  - 500+ (Server error): Retry with backoff
- [ ] **Validate phone numbers** before sending
  - Format: +55 11 XXXX-XXXX (Brazil)
  - Use Twilio's lookup API to validate (optional, costs $0.01/lookup)
  - Log validation result in Firestore for audit

### 5.3 Network & Timeout Errors
- [ ] **Define timeout thresholds**
  - Connection timeout: 5 seconds
  - Read timeout: 10 seconds
  - Total timeout: 15 seconds
- [ ] **Implement timeout recovery**
  - Log timeout with request ID + timestamp
  - Mark as `retrying` with next retry timestamp
  - Alert ops if timeout rate >10% in 1-hour window

### 5.4 Message Delivery Failures
- [ ] **Handle undelivered messages**
  - Twilio status callback: `undelivered`
  - Error code: (documented in Twilio response)
  - Action: Log, mark as failed, don't retry (customer out of service likely)
  - Fallback: Trigger email escalation (SendGrid)
- [ ] **Handle invalid recipients**
  - Invalid numbers identified at submission time (400 error)
  - Invalid numbers identified at delivery time (status callback)
  - Action: Flag for admin review, suggest manual intervention

### 5.5 Audit Trail for SMS Events
- [ ] **Log all SMS interactions** to Firestore `criticos-escalacoes/{escalationId}/events`
  ```typescript
  interface SMSEvent {
    id: string; // docId
    type: 'sms_queued' | 'sms_sent' | 'sms_delivered' | 'sms_failed' | 'sms_retry';
    timestamp: Timestamp;
    phoneNumber: string; // recipient (masked: +55 11 XXXX-*****)
    messageBody: string; // (redacted if contains PII)
    twilioSid: string; // Twilio message SID
    twilioStatus: string; // queued | sent | delivered | failed | undelivered
    twilioErrorCode?: string;
    twilioErrorMessage?: string;
    retryAttempt: number;
    operatorId: string; // who triggered escalation
    ipAddress: string;
    signature: LogicalSignature;
  }
  ```
- [ ] **Implement soft-delete** for SMS events (never hard delete)
- [ ] **Generate daily SMS report** (Cloud Logs + Cloud Function)
  - Report path: `/reports/sms-escalations-{YYYY-MM-DD}.json`
  - Include: total sent, delivery rate, failed count, cost
  - Send to #hc-quality-ops Slack channel

---

## 6. Firestore Integration & Schemas

### 6.1 Escalation Queue Collection
- [ ] **Verify `criticos-escalacoes` collection schema** (designed in Phase 3)
  ```typescript
  interface CriticalEscalation {
    id: string; // docId
    labId: string;
    resultId: string; // reference to result
    operatorId: string; // who triggered escalation
    analyteName: string; // e.g., "Hemoglobina"
    value: number;
    units: string;
    criticality: 'low' | 'medium' | 'high' | 'critical';
    escalationLevel: 1 | 2 | 3; // 1=SMS to tech, 2=SMS to RT, 3=Phone call
    recipients: { // dynamic per lab config
      techs: string[]; // tech phone numbers
      rts: string[]; // RT emails + phones
      supervisors: string[]; // supervisor phone numbers
    };
    smsStatus: 'queued' | 'sent' | 'delivered' | 'failed';
    emailStatus: 'queued' | 'sent' | 'delivered' | 'failed';
    acknowledgedBy?: string; // operator ID who acknowledged
    acknowledgedAt?: Timestamp;
    smsDeliveryTime?: number; // milliseconds from send to delivery
    slaMet: boolean; // true if delivery within SLA (default 2 min)
    events: { /* SMS/Email events */ };
    criadoEm: Timestamp;
    deletadoEm?: Timestamp;
    signature: LogicalSignature;
  }
  ```
- [ ] **Map Twilio response to Firestore**
  - Twilio `messageSid` → Firestore `events[].twilioSid`
  - Twilio status callback → Firestore `smsStatus` + `smsDeliveryTime`
  - Twilio error code → Firestore `events[].twilioErrorCode`

### 6.2 SMS Template Management
- [ ] **Define SMS templates** (stored in Firestore or code)
  - Template 1: Critical result notification (max 160 chars)
    ```
    "CRÍTICO: Hemoglobina 12.5 g/dL [Lab Saúde]. Paciente: [ID]. Revisar imediatamente."
    ```
  - Template 2: Escalation acknowledged
    ```
    "Alerta recebido. Protocolo #[ID]. Aguardando validação manual."
    ```
  - Template 3: Fallback (generic)
    ```
    "Resultado crítico gerado. Verifique sistema para detalhes."
    ```
- [ ] **Implement template validation**
  - Max 160 characters (GSM encoding)
  - No PII in template (inject patient ID/name at send time with care)
  - Internationalization ready (Portuguese/English placeholders)

---

## 7. Firestore Indexes & Performance

### 7.1 Collection Indexes
- [ ] **Verify `criticos-escalacoes` indexes** are created
  ```
  Collection: criticos-escalacoes
  Index 1: labId (Asc), smsStatus (Asc), criadoEm (Desc) — for queue monitoring
  Index 2: labId (Asc), slaMet (Asc), criadoEm (Desc) — for SLA dashboard
  Index 3: smsStatus (Asc), acknowledgedAt (Desc) — for acknowledgment tracking
  ```
- [ ] **Verify indexes in Firebase Console**
  - Go to Firestore → Indexes
  - Confirm status: "Enabled" for all indexes

### 7.2 Query Performance Baseline
- [ ] **Benchmark baseline queries**
  - Query: `criticos-escalacoes` where `smsStatus = sent` and `slaMet = false` (unmet SLA)
  - Target latency: <100ms
  - Test with 10K escalations in collection
  - Document result in `/docs/TWILIO_PERFORMANCE_BASELINE.md`
- [ ] **Monitor Firestore metrics**
  - Cloud Monitoring dashboard: "HC Quality → Firestore → criticos-escalacoes"
  - Alert threshold: Latency >200ms for 5 consecutive reads

---

## 8. Testing & Validation

### 8.1 Unit Tests
- [ ] **Tests in `/functions/src/__tests__/twilioService.test.ts`**
  - [ ] Message formatting (160 char limit, special chars)
  - [ ] Phone number validation (Brazil format)
  - [ ] Rate limiting calculation
  - [ ] Exponential backoff strategy
  - [ ] Circuit breaker state machine
  - [ ] Credential injection from Secrets Manager
- [ ] **Test coverage target:** >90% line coverage

### 8.2 Integration Tests (Twilio Sandbox)
- [ ] **Use Twilio test credentials** (sandbox mode)
  - Account SID: AC_TEST_12345
  - Auth Token: test_token_xyz
  - Phone number: +1 (sandbox only)
- [ ] **Test scenarios**
  - [ ] Send SMS via Twilio API, confirm queued
  - [ ] Simulate status callback, confirm Firestore updated
  - [ ] Test rate limiting (queue multiple SMS, confirm throttle)
  - [ ] Test timeout scenario (artificial latency)
  - [ ] Test invalid phone number (400 error)
  - [ ] Test Twilio API 5xx error (retry logic)
- [ ] **Document test results** in `/docs/TWILIO_TEST_REPORT.md`

### 8.3 End-to-End Testing (Production Credentials, Test Phone)
- [ ] **Set up production account + test numbers** (above)
- [ ] **E2E test flow**
  1. Create critical result in Firestore (test data)
  2. Trigger escalation via Cloud Function
  3. Confirm SMS queued in Firestore
  4. Confirm Twilio API returns `messageSid`
  5. Confirm SMS received on test phone (within 30s)
  6. Confirm status callback received (via webhook)
  7. Confirm Firestore `smsStatus` updated to `delivered`
  8. Confirm `smsDeliveryTime` calculated correctly
  9. Confirm SLA status updated (`slaMet: true` if <2 min)
- [ ] **Repeat E2E test** with 10 messages (load baseline)
- [ ] **Test failure scenarios**
  - Disable Twilio API (circuit breaker), confirm fallback to email
  - Send to invalid phone, confirm error logged + human review flag

### 8.4 Load Testing
- [ ] **Simulate daily critical alerts**
  - 50 labs × 5 alerts/day = 250 SMS/day
  - Spread over 8 business hours (30 SMS/hour)
  - Test: Send 30 SMS in rapid sequence, confirm all queue + deliver
  - Confirm Firestore writes don't exceed quota
- [ ] **Simulate peak load**
  - Scenario: All 50 labs flag critical alerts simultaneously
  - Total: 500 SMS in 1 minute
  - Confirm: Rate limiting activated, queue respected, Firestore OK
  - Confirm: Twilio API responds within SLA (<2s per request)

---

## 9. Billing & Cost Management

### 9.1 Cost Estimation & Budgeting
- [ ] **Calculate SMS costs**
  - Twilio rate (Brazil): ~$0.01 per SMS (inbound/outbound similar)
  - Estimated volume: 250 SMS/day × 30 days = 7,500 SMS/month
  - Estimated cost: 7,500 × $0.01 = $75/month
  - Annual budget: $900
- [ ] **Cost tracking setup**
  - Enable Twilio billing exports (CSV to Cloud Storage)
  - Set up BigQuery table for cost analysis
  - Dashboard in Data Studio (cost per lab, cost per escalation)
- [ ] **Spending alerts**
  - Daily limit alert: $50 (20x average)
  - Monthly limit alert: $500 (5x budget)
  - Escalation: Notify #hc-quality-ops Slack if limit exceeded

### 9.2 Cost Optimization
- [ ] **Identify cost drivers**
  - Monitor SMS count by lab (find high-volume labs)
  - Monitor SMS count by escalation level (level 3 = phone call fallback?)
  - Analyze failed SMS (retries = wasted cost)
- [ ] **Optimization opportunities**
  - Reduce false positive critical alerts (improve threshold tuning)
  - Batch multiple alerts into single SMS (if clinically safe)
  - Use email for non-urgent escalations (Phase 5 expansion)

---

## 10. Audit Trail & Compliance

### 10.1 Audit Log Requirements (RDC 978 Art. 5.3)
- [ ] **Log all SMS interactions**
  - Timestamp of SMS queued
  - Recipient phone number (masked: +55 11 XXXX-****)
  - Message body (redacted of patient details)
  - Operator who triggered escalation (audit trail)
  - Twilio messageSid (for correlation)
  - Delivery status + timestamp
- [ ] **Log storage**
  - Primary: Firestore `events` subcollection (append-only, immutable)
  - Secondary: Cloud Logs (30-day retention)
  - Archive: Cloud Storage (5-year retention for regulatory)
- [ ] **Soft-delete only**
  - Never hard-delete SMS logs
  - Mark deleted with `deletedAt` timestamp + operator

### 10.2 Data Privacy (LGPD Arts. 9, 18, 38)
- [ ] **PII in SMS messages**
  - Patient ID only (no patient name)
  - Result value (clinical, not PII)
  - Lab name (public information)
  - Never include phone numbers of other recipients
- [ ] **Recipient consent**
  - Confirm operator phone numbers in lab config have opt-in consent
  - Log consent date + method in Firestore
  - Provide unsubscribe mechanism (SMS reply + manual admin config)
- [ ] **Data retention**
  - Retain SMS logs for 5 years (RDC 978)
  - Delete SMS logs when result is deleted (soft-delete)
  - Purge from Twilio's servers (request from Twilio support if needed)

### 10.3 Compliance Checklist
- [ ] **RDC 978 Art. 6** — Result notification
  - Confirm SMS includes result value + interpretation
  - Confirm timestamp recorded for audit trail
- [ ] **RDC 978 Arts. 115–117** — Critical value escalation
  - Confirm SMS triggered for critical values only
  - Confirm escalation timeline documented (≤30 min recommended)
  - Confirm SLA tracking in place (criticos-escalacoes.slaMet)
- [ ] **RDC 978 Art. 204** — Audit trail
  - Confirm each SMS is logged with operator + timestamp
  - Confirm immutability (cannot delete or modify logs)
- [ ] **LGPD Art. 9** — Informed consent
  - Confirm operators have opted in to SMS notifications
  - Confirm consent logged in Firestore
- [ ] **DICQ 4.2.2** — Critical value procedures
  - Confirm SMS escalation procedure documented (POL-CRITICOS or similar)
  - Confirm training on SMS escalation (treinamentos module)

---

## 11. Deployment Checklist (Pre-Phase 5 Deployment)

### 11.1 Pre-Deployment Validation
- [ ] **All tests passing** (unit + integration + E2E)
  - Run: `npm run test -- twilioService`
  - Expected: 100% pass rate
- [ ] **TypeScript compilation** without errors
  - Run: `npx tsc --noEmit`
  - Expected: 0 errors in `functions/src/`
- [ ] **Cloud Functions deployment** successful
  - Run: `firebase deploy --only functions:escalateViatwilio`
  - Expected: Deployment success, no warnings
- [ ] **Firestore Rules** deployed with escalation config rules
  - Confirm rules allow operators to update `recipients` config
  - Confirm rules block client-side SMS submissions
- [ ] **Secrets Manager** provisioned
  - Confirm `twilio_account_sid` exists
  - Confirm `twilio_auth_token` exists
  - Test access: `gcloud secrets versions access latest --secret="twilio_account_sid"`

### 11.2 Deployment Order (Dependency Chain)
1. Provision Twilio account + phone numbers (if not done)
2. Store credentials in Secrets Manager
3. Deploy Firestore Rules (includes criticos-escalacoes collection rules)
4. Deploy Cloud Functions (`escalateViatwilio`, `twilioStatusCallback`)
5. Update Firestore Indexes
6. Configure SMS status callback webhook (in Twilio console)
7. Test end-to-end with test phone number
8. Enable Cloud Logging + Metrics
9. Validate with smoke tests (Phase 5-04)

### 11.3 Go/No-Go Gate
- [ ] **All items in sections 1–10 are complete** ✓
- [ ] **No blocking risks** (see Risk Register below)
- [ ] **Twilio account provisioned + funds available** ✓
- [ ] **Test phone numbers operational** ✓
- [ ] **Stakeholder sign-off** from RT lead + CTO
- [ ] **Phase 5 kickoff date: 2026-06-09** (mark calendar)

---

## 12. Support & Escalation

### 12.1 Twilio Support Contact
- **Vendor:** Twilio  
- **Account Manager:** ___ (Name, email, phone)  
- **Technical Support:** support@twilio.com | 1-844-TWILIO-1  
- **Support Hours:** 24/7 (with varying response SLA by plan)  
- **SLA:** Enterprise plan includes 4-hour response time for critical issues

### 12.2 Internal Escalation Path
- **L1 (Agent):** Agent 1 (Phase 5-01 owner) — SMS integration + escalation logic
- **L2 (Team Lead):** Engineering manager — resource allocation, vendor coordination
- **L3 (CTO):** Regulatory decisions + vendor contracts

### 12.3 Known Issues & Workarounds
| Issue | Status | Workaround | Owner |
|-------|--------|-----------|-------|
| (To be populated after testing) | — | — | — |

---

## Appendix A: Key Files & References

- **Integration code:** `functions/src/services/twilioService.ts`
- **Escalation callable:** `functions/src/callables/escalateViaTwilio.ts`
- **Status callback handler:** `functions/src/callables/twilioStatusCallback.ts`
- **Firestore Rules:** `firestore.rules` (lines TBD)
- **Type definitions:** `functions/src/types/twilio.ts`
- **Tests:** `functions/src/__tests__/twilioService.test.ts`
- **Design doc:** `.planning/milestones/v1.4-KICKOFF-SUMMARY.md` (Phase 5, Task 05-01)
- **RDC 978 mapping:** `.planning/milestones/v1.4-RDC-978-COMPLIANCE-MATRIX.md` (Arts. 115–117)

---

## Appendix B: Sign-Off Template

**Integration Validation Complete:** `[ ] Yes [ ] No`  
**Date:** ___________  
**Validated By:** _________________ (Agent 1, Phase 5-01)  
**Reviewed By:** _________________ (Engineering Manager)  
**Approved By:** _________________ (CTO)  

**Notes / Open Items:**
```
(Use this section to document any blockers or deferred items)
```

---

**Last Updated:** 2026-05-07  
**Status:** Ready for Phase 5 (2026-06-09)
