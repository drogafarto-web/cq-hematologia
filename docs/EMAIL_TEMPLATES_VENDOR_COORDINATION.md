# Email Templates — Vendor Coordination (NOTIVISA + Twilio)

**Purpose:** Ready-to-send email templates for confirming integration readiness with NOTIVISA and Twilio vendors  
**Owner:** CTO (final send authority)  
**Timeline:** Send by 2026-05-15 (5 days before Phase 4 kickoff)  
**Status:** Draft templates — customize with project specifics before sending

---

## Template 1: NOTIVISA Provider — Sandbox Account Request

**To:** [NOTIVISA Account Manager / Sales Contact]  
**CC:** [CTO email] [Engineering Manager email]  
**Subject:** HC Quality (Labclin) — NOTIVISA Sandbox Integration — Credentials Request  
**Send Date:** 2026-05-15 (or ASAP if no response)

---

### Email Body

```
Dear [Account Manager Name],

We are integrating NOTIVISA notifications into HC Quality, our clinical quality 
control system for Labclin. As part of Phase 4 deployment (starting 2026-05-20), 
we need to confirm sandbox environment access and API documentation.

INTEGRATION TIMELINE
- Sandbox integration + testing: 2026-05-15 to 2026-06-02
- Production deployment: 2026-06-02
- Go-live: 2026-06-03

IMMEDIATE REQUIREMENTS (Blockers for Phase 4 Start)

1. Sandbox Account Credentials
   - Sandbox username/email: ___
   - API key or OAuth token: ___
   - Certificate files (if mTLS required): ___
   - Sandbox API endpoint URL: ___
   - Expected format: [Bearer | Basic | Custom] authorization

2. API Documentation (Portaria 204 v3.0)
   - Confirm current API version: 3.0
   - Confirm documentation includes:
     * Authentication methods (supported schemes)
     * Notification submission endpoint (POST /api/v3/notifications)
     * Status polling endpoint (GET /api/v3/notifications/{id}/status)
     * Webhook callback specification (signature validation method, retry policy)
     * Error codes and handling guidance
     * Rate limits (RPM, RPD, payload size limits)
   - Estimated documentation delivery: [ASAP]

3. Rate Limits & Service Level Agreement
   - Requests per minute (RPM): ___
   - Requests per day (RPD): ___
   - Payload size limit: ___
   - API availability SLA: ___
   - Support contact for critical issues: ___
   - Support hours: ___

4. Webhook Configuration
   - Callback event types: [delivered | failed | expired]
   - Signature validation method: [HMAC-SHA256 | Custom]
   - Signature header name: ___
   - Retry policy (if webhook receiver is down):
     * Retry interval: ___
     * Max retries: ___
     * Total retry window: ___

5. Compliance & Contract Terms
   - Portaria 204 compliance confirmation: [ ] Yes [ ] No
   - LGPD compliance confirmation: [ ] Yes [ ] No
   - Standard MSA/DPA (if not signed): Please send
   - Data residency requirements: ___
   - Audit/compliance certifications held: ___

TECHNICAL CONTACT
- Integration Owner: [Agent 3 Name] (agent3@hc-quality.internal)
- Engineering Manager: [Manager Name] (manager@hc-quality.internal)
- CTO/Architecture: [CTO Name] (cto@hc-quality.internal)

NEXT STEPS
Please confirm receipt of this request and provide an ETA for:
1. Sandbox credentials (target: 2026-05-16)
2. API documentation (target: 2026-05-16)
3. Rate limits & SLA (target: 2026-05-17)

If there are any prerequisites we must complete on our end, please advise 
(e.g., account registration, contract signing, business verification).

We are committed to a smooth integration and appreciate your support.

Best regards,

[Your Name]
[Your Title] — HC Quality / Labclin
[Your Email] | [Phone]
[Project URL]: https://hmatologia2.web.app
```

---

## Template 2: Twilio Account Manager — Integration Confirmation

**To:** [Twilio Account Manager / Sales Contact]  
**CC:** [CTO email] [Engineering Manager email]  
**Subject:** HC Quality (Labclin) — Twilio Integration Setup — Confirmation & Onboarding  
**Send Date:** 2026-05-15

---

### Email Body

```
Dear [Account Manager Name],

We are implementing SMS-based critical value escalation in HC Quality using Twilio. 
As part of Phase 5 deployment (starting 2026-06-09), we need to confirm account 
provisioning and regional setup.

INTEGRATION TIMELINE
- Account provisioning & testing: 2026-05-15 to 2026-06-08
- Production escalation go-live: 2026-06-30
- Expected SMS volume: 250/day typical, 500/day peak (low volume)

IMMEDIATE REQUIREMENTS (Blockers for Phase 5 Start)

1. Account Provisioning Status
   - [ ] Account SID: ___
   - [ ] Auth Token: ___
   - [ ] Account type: [ ] Standard [ ] Enterprise
   - [ ] Pricing plan: [ ] Pay-as-you-go [ ] Committed
   - [ ] Account status: [ ] Active [ ] Pending review [ ] Requires action
   
   Action needed: Confirm account is provisioned and ready for SMS.

2. Phone Numbers (Brazil / southamerica-east1)
   - Number type desired: [ ] Long code [ ] Short code [ ] Toll-free
   - Regional requirements: Brazil (state codes: 11 SP, 21 RJ, 31 MG, or national)
   - Quantity: 2 (primary + backup)
   - Timeline for provisioning: ___
   
   Action needed: Provision 2 phone numbers for SMS delivery. If approval required 
   (short codes), please advise timeline.

3. SMS Messaging Service Configuration
   - [ ] SMS service enabled
   - [ ] SMS in Brazil region enabled
   - [ ] Incoming webhooks configured (for delivery status callbacks)
   - [ ] Rate limits documented: ___ requests/sec, ___ requests/minute
   
   Action needed: Confirm SMS service is active and ready for testing.

4. Spending Controls & Billing
   - Estimated SMS volume: 250 SMS/day × 30 = 7,500/month (~$75/month)
   - Preferred billing model: [ ] Monthly invoice [ ] Pay-as-you-go [ ] Prepaid
   - Daily spending cap recommended: $50 (20x daily average)
   - Billing contact email: ___
   
   Action needed: Confirm spending limits are set. Provide billing contact for 
   invoice questions.

5. Webhook Delivery & Status Callbacks
   - [ ] Status callback support confirmed (for delivery/failure tracking)
   - [ ] Callback retry policy documented: ___ retries, ___ interval
   - [ ] Signature validation method: [HMAC-SHA256 | Other: ___]
   - [ ] Timeout tolerance: ___
   
   Action needed: Confirm webhook infrastructure is ready for integration.

6. Support & SLA
   - Support tier: [ ] Standard [ ] Enterprise [ ] Premium
   - Support hours: ___
   - Critical issue response time SLA: ___
   - Emergency contact (for go-live issues): ___
   
   Action needed: Provide 24/7 emergency contact for Phase 5 deployment window.

7. WhatsApp Business API (Future Phase 5 Expansion)
   - Status: [ ] Not needed yet [ ] Evaluate for Phase 5 expansion
   - If yes: Timeline for WhatsApp business account setup: ___
   
   Action needed: No action required now; provide roadmap if available.

TECHNICAL CONTACT
- Integration Owner: [Agent 1 Name] (agent1@hc-quality.internal)
- Engineering Manager: [Manager Name] (manager@hc-quality.internal)
- CTO/Architecture: [CTO Name] (cto@hc-quality.internal)

NEXT STEPS
1. Confirm all items above by 2026-05-16
2. Provision Brazil phone numbers by 2026-05-20
3. Enable SMS service by 2026-05-20
4. Schedule brief onboarding call (30 min) to review integration architecture
   - Proposed time: 2026-05-18 or 2026-05-19, 2pm BRT

Expected test volume: 100–200 SMS during integration testing (no production traffic until go-live).

Please reply with status on all items above.

Best regards,

[Your Name]
[Your Title] — HC Quality / Labclin
[Your Email] | [Phone]
[Project URL]: https://hmatologia2.web.app
```

---

## Template 3: Internal Team — Integration Readiness Gate

**To:** [Engineering Team] [Product Lead] [CTO]  
**CC:** [Operations] [QA Lead]  
**Subject:** Integration Readiness Gate — Phase 4 & Phase 5 Blockers (May 15 Sync)  
**Send Date:** 2026-05-15

---

### Email Body

```
Team,

Attached is our integration readiness checklist for Phase 4 (NOTIVISA) and Phase 5 
(Twilio SMS). Please review and confirm status on all items by EOD 2026-05-17.

PHASE 4 READINESS (NOTIVISA) — Kickoff 2026-05-20

Blockers (Must Complete Before May 20):
1. [ ] NOTIVISA sandbox credentials received + stored in Secrets Manager
2. [ ] API documentation (Portaria 204 v3.0) reviewed + endpoint list extracted
3. [ ] Rate limits confirmed + documented in code + env vars configured
4. [ ] Cloud Function `notivisaQueueProcessor` deployed (sandbox)
5. [ ] Firestore Rules include `notivisa-outbox` collection rules
6. [ ] End-to-end test: Create event → Queue → NOTIVISA API → Webhook callback → Firestore update
7. [ ] No TypeScript errors: `npx tsc --noEmit`
8. [ ] All unit tests pass: `npm run test -- notivisaService`

Owner: Agent 3 (Phase 4-03)
Status check: 2026-05-17 EOD
Escalation: If any blocker at risk, notify manager + CTO immediately

---

PHASE 5 READINESS (TWILIO SMS) — Kickoff 2026-06-09

Blockers (Must Complete Before June 9):
1. [ ] Twilio account provisioned + credentials stored in Secrets Manager
2. [ ] 2 Brazil phone numbers provisioned + active
3. [ ] SMS service enabled + delivery tested (to test phone)
4. [ ] Rate limits confirmed (RPM, daily volume) + env vars configured
5. [ ] Cloud Function `escalateViaTwilio` deployed (production credentials)
6. [ ] Firestore Rules include `criticos-escalacoes` collection rules
7. [ ] Status callback webhook configured in Twilio console
8. [ ] End-to-end test: Create escalation → SMS queued → Twilio API response → Status callback → Firestore update
9. [ ] No TypeScript errors: `npx tsc --noEmit`
10. [ ] All unit tests pass: `npm run test -- twilioService`

Owner: Agent 1 (Phase 5-01)
Status check: 2026-06-06 EOD
Escalation: If any blocker at risk, notify manager + CTO immediately

---

VENDOR COMMUNICATION (CTO Responsibility)

Send by 2026-05-15:
1. [ ] Email to NOTIVISA (Template 1) — request sandbox + docs + SLA
2. [ ] Email to Twilio (Template 2) — confirm account + phone numbers + SLA
3. [ ] Follow up calls if no response by 2026-05-16 EOD

Expected responses:
- NOTIVISA: Credentials + docs by 2026-05-16 (sandboxes typically fast)
- Twilio: Phone numbers provisioned by 2026-05-20 (standard 2–3 day lead time)

---

SHARED DEPENDENCIES (Cross-Agent Coordination)

Phase 4 → Phase 5 Dependency:
- Firestore schema `criticos-escalacoes` designed in Phase 3 ✓
- Cloud Task scheduler configured for polling ✓
- SendGrid fallback (email) tested + ready ✓

No blocking dependencies identified.

---

RISK ITEMS (Watch List)

| Risk | Mitigation | Owner |
|------|-----------|-------|
| **NOTIVISA sandbox delayed** | API might not be available same-day; request early | CTO |
| **Twilio Brazil numbers take >3 days** | Provision early; have US fallback (test only) | CTO |
| **Webhook signature mismatch** | Test with sandbox first; coordinate with vendor tech support | Agent |
| **Rate limiting surprises** | Load test with 2x expected peak; have backoff ready | Agent |

---

TESTING TIMELINE (Recommended Cadence)

- 2026-05-16–05-18: Vendor credential receipt + unit test pass
- 2026-05-19: Integration test (sandbox API) + E2E dry-run
- 2026-05-20: Phase 4 kickoff + smoke tests
- 2026-05-29: Phase 4 deploy (production)
- 2026-06-09: Phase 5 kickoff + SMS testing
- 2026-06-30: Phase 5 deploy (SMS live)

---

SIGN-OFF REQUIRED BY 2026-05-17 EOD

For each phase:
- Integration Owner: Confirm all blockers on-track or escalate
- Engineering Manager: Approve timeline or propose adjustment
- CTO: Approve vendor communication + SLA terms

Please reply to this email with status and any blockers.

Best regards,

[CTO Name]
CTO — HC Quality / Labclin
```

---

## Template 4: SendGrid Fallback Confirmation (Email Escalation)

**To:** [SendGrid Account Manager / Support]  
**CC:** [CTO email] [Engineering Manager email]  
**Subject:** HC Quality (Labclin) — SendGrid Integration Confirmation (Email Fallback for Critical Escalation)  
**Send Date:** 2026-05-15

---

### Email Body

```
Dear SendGrid Support / Account Manager,

We are using SendGrid as a fallback email delivery service for critical lab value 
notifications (when SMS is unavailable). This is a critical compliance requirement 
under RDC 978 (Brazilian healthcare regulation).

INTEGRATION DETAILS
- Service: Critical value escalation via email (fallback to SMS)
- Volume: 50–100 emails/day typical, 500/day peak
- Recipients: Lab managers, radiologists, technicians (internal use)
- Service tier: [Standard | Enhanced | Advanced]

REQUIREMENTS CONFIRMATION

Please confirm the following:

1. [ ] SendGrid account is active and verified
2. [ ] API key is provisioned and functional
3. [ ] Sender domain is verified (SPF/DKIM/DMARC configured)
4. [ ] Email delivery SLA documented:
   - Typical delivery time: ___
   - Bounce rate: <0.5% (industry standard)
   - Spam complaint rate: <0.1% (industry standard)
5. [ ] Webhook callbacks configured for delivery status tracking:
   - [ ] Delivered
   - [ ] Bounced
   - [ ] Complained
   - [ ] Unsubscribed
6. [ ] Unsubscribe rate acceptable for critical alerts (typically exempt from unsubscribe)

ACTION REQUIRED
Please confirm all items above by 2026-05-16 EOD. 

Our integration goes live 2026-06-30. Test volume: 50–100 emails during 
integration testing (May 20 – Jun 30).

If there are any concerns or action items on your end, please advise immediately.

Best regards,

[CTO Name]
CTO — HC Quality / Labclin
```

---

## Template 5: Post-Deployment Vendor Confirmation (After Go-Live)

**To:** [NOTIVISA Account Manager] [Twilio Account Manager] [SendGrid Support]  
**CC:** [CTO email] [Operations Lead]  
**Subject:** HC Quality (Labclin) — Integration Go-Live Confirmation (Phase 4 & Phase 5 Deployed)  
**Send Date:** 2026-06-30 (after Phase 5 deployment)

---

### Email Body

```
Dear [Vendor Partners],

HC Quality successfully deployed NOTIVISA notification integration (Phase 4, June 2) 
and Twilio SMS critical escalation (Phase 5, June 30). Thank you for your support 
during integration.

DEPLOYMENT SUMMARY

Phase 4 (NOTIVISA) — Live since 2026-06-02
- Status: All notifications queued and delivered
- Volume: ~50 notifications/day (expected)
- Error rate: <0.5%
- SLA met: 100% of events transmitted within SLA

Phase 5 (Twilio SMS) — Live since 2026-06-30
- Status: Critical escalations via SMS + email
- Volume: ~100 SMS/day (expected)
- Delivery rate: 98% (2% failures = out of service numbers)
- Error rate: <0.5%
- SLA met: 100% of critical alerts within 2-minute escalation window

IMMEDIATE NEXT STEPS
1. Each vendor: Review deployment logs + confirm no issues on your end
2. Each vendor: Confirm monitoring/alerting is active for our account
3. Each vendor: Schedule post-deployment health check (optional, 30 min call)

ONGOING MONITORING
We have configured internal monitoring for:
- API availability (uptime monitoring, latency tracking)
- Error rate trends (daily reports to #hc-quality-ops)
- Cost tracking (daily spend reports)
- Customer escalation path (24/7 L1 support, CTO L2 escalation)

Please reply to confirm deployment success on your end and provide 
emergency contact information for critical issues.

Production status: https://hmatologia2.web.app (internal use only)

Best regards,

[CTO Name]
CTO — HC Quality / Labclin
[Phone] | [Email]
```

---

## Appendix A: Pre-Send Checklist

Before sending any email template:

- [ ] Customize all placeholders ([Name], [Phone], [Email], dates, etc.)
- [ ] Add specific project/company details (HC Quality, Labclin, hmatologia2.web.app)
- [ ] Review for tone (professional, urgent but not pushy)
- [ ] Confirm recipient email address (no typos)
- [ ] CC appropriate stakeholders (Manager, CTO, Operations)
- [ ] Set send date (recommend business hours, e.g., 10am BRT)
- [ ] Prepare response tracking (add email to CRM or project wiki)
- [ ] Document in project: who sent, when, expected response date

---

## Appendix B: Response Tracking Template

**Email Send Log** (maintain in shared wiki or spreadsheet)

| Date Sent | Recipient | Company | Email Subject | Owner | Due Response | Status | Notes |
|-----------|-----------|---------|---------------|-------|--------------|--------|-------|
| 2026-05-15 | [Name] | NOTIVISA | Sandbox Account Request | CTO | 2026-05-16 | Sent | Follow up if no response by 2pm |
| 2026-05-15 | [Name] | Twilio | Integration Confirmation | CTO | 2026-05-16 | Sent | Phone numbers by 2026-05-20 |
| 2026-05-15 | Team | Internal | Integration Readiness Gate | CTO | 2026-05-17 | Sent | Blockers check-in |
| 2026-05-15 | [Name] | SendGrid | Fallback Confirmation | CTO | 2026-05-16 | Sent | Email SLA confirmation |

---

## Appendix C: Escalation Matrix

If vendor does not respond by deadline:

| Vendor | No Response By | Escalation Action | Contact | Timeline |
|--------|----------------|-------------------|---------|----------|
| NOTIVISA | 2026-05-16 2pm | Phone call to account manager | [Phone] | Immediate |
| Twilio | 2026-05-16 2pm | Phone call to account manager; alternative: web chat | [Phone] | Immediate |
| SendGrid | 2026-05-16 2pm | Email escalation + web portal support ticket | n/a | Next business day |

---

**Last Updated:** 2026-05-07  
**Status:** Templates ready for CTO review + send (2026-05-15)
