# Integration Dependency Matrix — Phase 4–5 (v1.4)

**Purpose:** Map dependencies between NOTIVISA, Twilio, SendGrid, and HC Quality phases; identify blockers and go/no-go criteria  
**Owner:** CTO (integration orchestration)  
**Timeline:** Active through Phase 5 completion (2026-06-30)  
**Status:** Reference document for Phase 4–5 execution

---

## Executive Summary

HC Quality v1.4 integrates three external vendors to meet RDC 978 critical article requirements:

1. **NOTIVISA** (Phase 4) — RDC 978 Art. 6º §1 (result notification)
2. **Twilio SMS** (Phase 5) — RDC 978 Arts. 115–117 (critical value escalation)
3. **SendGrid Email** (Phase 5 fallback) — Escalation redundancy

**Critical path:** Phase 3 (schema complete) → Phase 4 (NOTIVISA) → Phase 5 (Twilio) → Phase 8 (CAPA closure)

**Go-live target:** 2026-06-30 (with 2-week buffer before auditor pre-alignment Phase 8 kickoff)

---

## Phase Dependency Chain

```
Phase 0 (RDC Blockers) ✅ COMPLETE
    ↓
Phase 1 (Stabilization) ✅ COMPLETE
    ↓
Phase 2 (Planning) ✅ COMPLETE
    ↓
Phase 3 (Schema Extensions) ✅ COMPLETE
    ├─ 5 Firestore collections designed + rules
    ├─ 50+ Cloud Function stubs scaffolded
    ├─ Indexes created
    └─ Helper modules: notivisa, sms, laudo, ia
    ↓
Phase 4 (Portal + NOTIVISA) 📋 KICKOFF 2026-05-20
    ├─ NOTIVISA queue processor deployed
    ├─ Webhook receiver live
    ├─ E2E: result → notification → RT ✓
    └─ DEPENDENCY GATE: Blocked until NOTIVISA credentials received
    ↓
Phase 5 (Critical Escalation + IA) 📋 KICKOFF 2026-06-09
    ├─ Twilio SMS integration deployed
    ├─ Critical threshold detection live
    ├─ SMS + email fallback operational
    └─ DEPENDENCY GATE: Blocked until Twilio phone numbers active
    ↓
Phase 6 (Liberación Completion) 📅 KICKOFF 2026-07-01
    └─ Not blocked by integrations (independent)
    ↓
Phase 7 (Reclamações Polish) 📅 KICKOFF 2026-07-08
    └─ Not blocked by integrations (independent)
    ↓
Phase 8 (CAPA Closure) 📅 KICKOFF 2026-06-15 [PARALLEL with Phase 5]
    ├─ Integration completeness → auditor pre-alignment
    └─ DEPENDENCY GATE: Phase 4 + Phase 5 must be LIVE before closure ceremony
```

---

## Detailed Dependency Matrix

### A. Phase 4 (NOTIVISA Integration) → Subsequent Phases

| Deliverable | Phase 4-01 | Phase 4-02 | Phase 4-03 | Phase 4-04 | Phase 5 | Phase 8 | Notes |
|-----------|-----------|-----------|-----------|-----------|---------|---------|-------|
| **Portal auth (RT login)** | ✓ (callable) | — | — | ✓ (test) | (used) | (audit) | Required for Phase 5 (RT acknowledgment) |
| **NOTIVISA queue processor** | — | — | ✓ (function) | ✓ (test) | (depends) | (audit) | Core Phase 4; Phase 5 uses same queue pattern |
| **Webhook receiver** | — | — | ✓ (function) | ✓ (test) | (optional) | (audit) | Phase 4 critical; Phase 5 mirrors for SMS |
| **Firestore rules** | — | — | ✓ (rules) | ✓ (test) | (extends) | (audit) | Phase 3 → Phase 4 deploy; Phase 5 adds rules |
| **E2E: result → NOTIVISA → RT** | — | — | — | ✓ PASS | — | — | Phase 4 go/no-go criterion |

**Phase 4 Blockers:**
1. ❌ NOTIVISA sandbox credentials (awaiting vendor)
2. ❌ API documentation Portaria 204 v3.0 (awaiting vendor)
3. ✅ Firestore schema (Phase 3 complete)
4. ✅ Cloud Function scaffolding (Phase 3 complete)
5. ✅ Integration test suite (Phase 4-04 ready)

**Phase 4 Go/No-Go Criteria (2026-06-02):**
- [ ] NOTIVISA credentials received + tested
- [ ] API documentation reviewed + endpoints mapped
- [ ] Rate limits documented + env vars configured
- [ ] E2E test: 8 flows PASS (Phase 4-04)
- [ ] Cloud Logs: 0 errors, <5% warnings
- [ ] Unit tests: 100% pass rate (738+ baseline maintained)
- [ ] Performance: LCP <2.5s, queue latency <5s

---

### B. Phase 5 (Twilio Integration) → Subsequent Phases

| Deliverable | Phase 5-01 | Phase 5-02 | Phase 5-03 | Phase 5-04 | Phase 6 | Phase 7 | Phase 8 | Notes |
|-----------|-----------|-----------|-----------|-----------|---------|---------|---------|-------|
| **Critical threshold config** | ✓ (callable) | — | — | ✓ (test) | — | — | (audit) | Dependency: labId + analyte config |
| **SMS escalation trigger** | ✓ (callable) | — | — | ✓ (test) | — | — | (audit) | Core Phase 5; RDC 978 Arts. 115–117 |
| **Twilio SMS send** | — | ✓ (function) | — | ✓ (test) | — | — | (audit) | Requires: Twilio account + phone numbers |
| **SMS status tracking** | — | — | — | ✓ (test) | — | — | (audit) | Webhook callback + SLA monitoring |
| **IA training dataset (Phase 5-03)** | — | — | ✓ (upload) | ✓ (test) | — | — | (audit) | Independent of SMS; Gemini Vision integration |
| **E2E: critical value → SMS → delivery → SLA** | — | — | — | ✓ PASS | — | — | — | Phase 5 go/no-go criterion |

**Phase 5 Blockers:**
1. ❌ Twilio account provisioning (awaiting vendor)
2. ❌ Brazil phone numbers x2 (awaiting vendor, 2–3 day lead time)
3. ❌ SMS service enabled (awaiting Twilio activation)
4. ✅ Firestore schema (Phase 3 complete)
5. ✅ Critical detection logic (Phase 3 design complete)
6. ✅ Integration test suite (Phase 5-04 ready)

**Phase 5 Go/No-Go Criteria (2026-06-30):**
- [ ] Twilio account active + credentials tested
- [ ] 2 Brazil phone numbers provisioned + SMS sent successfully
- [ ] SMS service enabled + delivery tested (<30s typical)
- [ ] Critical threshold config deployed + operator workflow tested
- [ ] E2E test: 8 flows PASS (Phase 5-04)
- [ ] SMS + email fallback both operational (SendGrid live)
- [ ] Cloud Logs: 0 errors, <5% warnings
- [ ] Unit tests: 100% pass rate (738+ baseline maintained)
- [ ] SLA monitoring dashboard live (delivery <2min)
- [ ] Performance: SMS queue latency <5s, SMS delivery <30s

---

### C. Cross-Phase Dependencies (Shared Infrastructure)

#### Firestore Collections (Phase 3 → Phase 4/5)

| Collection | Phase Created | Phase 4 Usage | Phase 5 Usage | Notes |
|-----------|--------------|--------------|--------------|-------|
| `portal-configuracao` | Phase 3 | Portal branding | — | Shared read-only |
| `notivisa-outbox` | Phase 3 | Queue + processor | Observer only | Phase 4 owns; Phase 5 can read for audit |
| `criticos-escalacoes` | Phase 3 | — | SMS queue + SLA | Phase 5 owns; includes email fallback log |
| `imuno-ias-dev` | Phase 3 | — | IA training dataset | Phase 5 owns; independent of SMS |
| `laudos-draft` | Phase 3 | RT draft editing | — | Portal feature; independent of notifications |

**Risk:** If Phase 3 schema is incomplete, both Phase 4 and Phase 5 are blocked. → Mitigation: Phase 3 complete ✅

#### Cloud Functions (Shared Deployment)

| Function | Phase 4 | Phase 5 | Phase 6+ | Deployed Step | Owner |
|----------|---------|---------|----------|---------------|-------|
| `notivisaQueueProcessor` | Core | Observer | Audit | Step 2 (Functions) | Agent 3 |
| `notivisaWebhookReceiver` | Core | Observer | Audit | Step 2 (Functions) | Agent 3 |
| `escalateViaTwilio` | — | Core | Audit | Step 2 (Functions) | Agent 1 |
| `twilioStatusCallback` | — | Core | Audit | Step 2 (Functions) | Agent 1 |
| `sendGridFallback` | — | Core | Audit | Step 2 (Functions) | Agent 1 |

**Risk:** Function deployment failure blocks both Phase 4 and Phase 5. → Mitigation: Deploy in waves; Phase 4 functions first, then Phase 5.

#### Firestore Rules (Phase 3 → Phase 4/5)

| Rule Block | Collection | Phase 4 Compliance | Phase 5 Compliance | Notes |
|-----------|-----------|-------------------|-------------------|-------|
| Multi-tenant isolaton | notivisa-outbox | labId filter required | — | Phase 4 enforces |
| Soft-delete only | notivisa-outbox | deletedAt flag | deletedAt flag | Both phases enforce |
| Immutable events | events subcollection | append-only | append-only | Both phases enforce |
| No client writes | notivisa-outbox | Functions only | — | Phase 4 enforces |
| Signature validation | events | LogicalSignature | LogicalSignature | Both phases enforce |

**Risk:** Rules error blocks both phases. → Mitigation: Rules tested in Phase 3 ✅

#### Secrets Manager (Shared Credentials)

| Secret | Phase 4 | Phase 5 | Phase 6+ | Rotation | Owner |
|--------|---------|---------|----------|----------|-------|
| `notivisa_sandbox_key` | Required | Optional | Optional | 90 days | CTO |
| `notivisa_sandbox_cert` | Optional | — | — | 90 days | CTO |
| `twilio_account_sid` | — | Required | Required | 90 days | CTO |
| `twilio_auth_token` | — | Required | Required | 90 days | CTO |
| `sendgrid_api_key` | Optional | Required | Required | 90 days | CTO |

**Risk:** Credential rotation mid-phase = outage. → Mitigation: Rotate on non-critical days; 2-week advance notice; test rotation in staging first.

---

## Vendor Readiness & SLA

### NOTIVISA Readiness Matrix

| Item | Status | ETA | Owner | Blocker? |
|------|--------|-----|-------|----------|
| Sandbox account provisioned | ❌ Pending | 2026-05-15 | NOTIVISA | **YES** |
| API documentation (v3.0) | ❌ Pending | 2026-05-15 | NOTIVISA | **YES** |
| Rate limits documented | ❌ Pending | 2026-05-15 | NOTIVISA | **YES** |
| Webhook retry policy | ❌ Pending | 2026-05-15 | NOTIVISA | No (can default) |
| Production account access | ⏳ Not yet (Phase 4 only sandbox) | 2026-05-29 | NOTIVISA | No |
| Production endpoint | ⏳ Not yet | 2026-05-29 | NOTIVISA | No |

**SLA Expectations:**
- NOTIVISA sandbox typically available same-day (urgent requests)
- Production contract execution: 1–2 weeks typical
- API documentation: Should be publicly available on NOTIVISA website

**Escalation:** If no response by 2026-05-16 EOD → CTO phones account manager

---

### Twilio Readiness Matrix

| Item | Status | ETA | Owner | Blocker? |
|------|--------|-----|-------|----------|
| Account provisioned | ❌ Pending | 2026-05-15 | Twilio | **YES** |
| Brazil phone numbers x2 | ❌ Pending | 2026-05-20 | Twilio | **YES** |
| SMS service enabled | ❌ Pending | 2026-05-20 | Twilio | **YES** |
| Rate limits confirmed | ❌ Pending | 2026-05-16 | Twilio | **YES** |
| Webhook callback support | ⏳ Assumed yes | 2026-05-15 | Twilio | No (standard feature) |
| Spending limit configured | ⏳ Phase 5-01 | 2026-06-05 | HC Quality | No |

**SLA Expectations:**
- Twilio account: Same-day provisioning (standard)
- Brazil phone numbers: 2–3 business days (typical lead time)
- SMS delivery: <30 seconds to Brazil (typical)
- Webhook delivery: <5 seconds (Twilio standard)

**Escalation:** If phone numbers delayed → Request fallback with US number (test only) or use alpha sender (if available in Brazil)

---

### SendGrid Readiness Matrix (Email Fallback)

| Item | Status | ETA | Owner | Blocker? |
|------|--------|-----|-------|----------|
| Account provisioned | ✅ Assumed active | n/a | HC Quality | No (existing) |
| Sender domain verified | ✅ Assumed ready | n/a | HC Quality | No (existing) |
| API key active | ✅ Assumed ready | n/a | HC Quality | No (existing) |
| Webhook callbacks configured | ⏳ Phase 5-01 | 2026-06-05 | HC Quality | No |
| Email delivery SLA | ✅ <1min (industry standard) | n/a | SendGrid | No |

**SLA Expectations:**
- SendGrid delivery: <1 minute typical (well within RDC 978 escalation window)
- Fallback trigger: Twilio SMS fails or SMS rate limit hit
- Cost: ~$0.10 per email (included in SendGrid plan, typically 5,000 free/month)

---

## Go/No-Go Checkpoints

### Checkpoint 1: Phase 4 Kickoff (2026-05-20)

**Pre-Kickoff Validation (2026-05-19):**

| Gate | Item | Pass Criteria | Status | Owner |
|------|------|--------------|--------|-------|
| **Vendor** | NOTIVISA credentials received | Sandbox key + cert in Secrets Manager | ⏳ TBD | CTO |
| **Vendor** | API documentation available | v3.0 docs reviewed + endpoints mapped | ⏳ TBD | Agent 3 |
| **Code** | notivisaService.ts complete | All CRUD ops + error handling | ✅ Phase 3 | Agent 3 |
| **Rules** | Firestore rules updated | notivisa-outbox rules deployed | ✅ Phase 3 | CTO |
| **Tests** | Unit tests passing | `npm run test -- notivisaService` = 100% | ✅ Phase 3 | Agent 3 |
| **Infra** | Secrets Manager provisioned | CTO has read permission | ⏳ TBD | CTO |
| **Planning** | Runbook ready | Phase 4-03 execution plan | ✅ Phase 3 | Agent 3 |

**Decision:**
- [ ] GO — All gates pass, Phase 4 kickoff 2026-05-20
- [ ] NO-GO — Blockers present, defer to [DATE]
- [ ] CONDITIONAL — Proceed with mitigations documented

---

### Checkpoint 2: Phase 4 Deployment (2026-06-02)

**Pre-Deployment Validation (2026-06-01):**

| Gate | Item | Pass Criteria | Status | Owner |
|------|------|--------------|--------|-------|
| **Integration** | E2E test: result → NOTIVISA API | 8 flows PASS (create, queue, send, webhook, ack) | ⏳ Phase 4 | Agent 4 |
| **Performance** | Queue latency benchmark | <5s typical, <10s P95 | ⏳ Phase 4 | Agent 3 |
| **Reliability** | Error rate in sandbox | <0.5% over 100+ submissions | ⏳ Phase 4 | Agent 3 |
| **Logs** | Cloud Logs review | 0 errors, <5% warnings | ⏳ Phase 4 | Agent 4 |
| **Regression** | Unit test suite | 738+ baseline tests PASS, zero regressions | ⏳ Phase 4 | Agent 4 |
| **Load** | Firestore quota | <10% daily write quota consumed | ⏳ Phase 4 | Agent 3 |
| **Readiness** | TypeScript build | `npm run build` succeeds, `npx tsc --noEmit` = 0 errors | ⏳ Phase 4 | Agent 4 |
| **Sec audit** | NOTIVISA API calls | All logged + signatures validated | ⏳ Phase 4 | Agent 3 |

**Decision:**
- [ ] GO — All gates pass, Phase 4 deploy 2026-06-02
- [ ] NO-GO — Blockers present, extend Phase 4 by [N days]
- [ ] CONDITIONAL — Proceed with known issues documented (e.g., minor logging gap, acceptable risk)

---

### Checkpoint 3: Phase 5 Kickoff (2026-06-09)

**Pre-Kickoff Validation (2026-06-08):**

| Gate | Item | Pass Criteria | Status | Owner |
|------|------|--------------|--------|-------|
| **Phase 4** | NOTIVISA production-ready | Phase 4 deploy LIVE + no critical issues | ✅ Expected | CTO |
| **Vendor** | Twilio account active | Account SID + Auth Token in Secrets Manager | ⏳ TBD | CTO |
| **Vendor** | Brazil phone numbers ready | 2 numbers provisioned + SMS test delivery <30s | ⏳ TBD | CTO |
| **Code** | twilioService.ts complete | All CRUD ops + error handling + fallback | ✅ Phase 3 | Agent 1 |
| **Rules** | Firestore rules updated | criticos-escalacoes rules deployed | ✅ Phase 3 | CTO |
| **Tests** | Unit tests passing | `npm run test -- twilioService` = 100% | ✅ Phase 3 | Agent 1 |
| **Infrastructure** | SendGrid fallback ready | API key active + email delivery tested | ✅ Phase 3 | Agent 1 |
| **Planning** | Runbook ready | Phase 5-01 execution plan | ✅ Phase 3 | Agent 1 |

**Decision:**
- [ ] GO — All gates pass, Phase 5 kickoff 2026-06-09
- [ ] NO-GO — Blockers present, defer to [DATE]
- [ ] CONDITIONAL — Proceed with mitigations documented

---

### Checkpoint 4: Phase 5 Deployment (2026-06-30)

**Pre-Deployment Validation (2026-06-29):**

| Gate | Item | Pass Criteria | Status | Owner |
|------|------|--------------|--------|-------|
| **Integration** | E2E test: critical → SMS → delivery | 8 flows PASS (threshold, trigger, queue, send, callback, SLA) | ⏳ Phase 5 | Agent 4 |
| **Performance** | SMS queue latency benchmark | <5s typical, <10s P95 | ⏳ Phase 5 | Agent 1 |
| **Reliability** | SMS delivery rate | >95% (accounting for out-of-service numbers) | ⏳ Phase 5 | Agent 1 |
| **SLA tracking** | SLA dashboard live | Delivery time <2min shown for 95%+ of escalations | ⏳ Phase 5 | Agent 2 |
| **Logs** | Cloud Logs review | 0 errors, <5% warnings | ⏳ Phase 5 | Agent 4 |
| **Regression** | Unit test suite | 738+ baseline tests PASS, zero regressions | ⏳ Phase 5 | Agent 4 |
| **Load** | Firestore quota | <15% daily write quota consumed (both notivisa + criticos) | ⏳ Phase 5 | Agent 1 |
| **Failover** | Email fallback tested | SMS fails → email sends successfully | ⏳ Phase 5 | Agent 1 |
| **Readiness** | TypeScript build | `npm run build` succeeds, `npx tsc --noEmit` = 0 errors | ⏳ Phase 5 | Agent 4 |

**Decision:**
- [ ] GO — All gates pass, Phase 5 deploy 2026-06-30
- [ ] NO-GO — Blockers present, extend Phase 5 by [N days]
- [ ] CONDITIONAL — Proceed with known issues documented

---

## Risk Mitigation & Contingencies

### Risk 1: Vendor Credential Delay (NOTIVISA or Twilio)

**Probability:** Medium (3/10) — Vendors usually respond quickly but RDC compliance docs can slow some vendors  
**Impact:** High (8/10) — Phase kickoff blocked

| Scenario | Mitigation | Fallback |
|----------|-----------|----------|
| NOTIVISA sandbox unavailable by 2026-05-15 | CTO escalates immediately; request phone call | Use Twilio + SendGrid only for Phase 4 (defer NOTIVISA to Phase 6) |
| Twilio phone numbers delayed >2 days (after 2026-05-20) | Use test SMS (to CTO's number only) for Phase 5 testing; request priority provisioning | Defer Phase 5 SMS live by 1 week; use email-only escalation (Phase 5.5) |

### Risk 2: API Integration Mismatch (Schema/Signature)

**Probability:** Low (2/10) — Vendor APIs usually match documentation  
**Impact:** High (8/10) — Phase blocks, E2E test fails

| Scenario | Mitigation | Fallback |
|----------|-----------|----------|
| NOTIVISA webhook signature format different from docs | Test with vendor support; coordinate fix in 4–8 hours | Use polling fallback (query API status every 5 min instead of webhook) |
| Twilio status callback schema unexpected | Test with Twilio's webhook simulator; coordinate format mapping | Log all callbacks to Cloud Storage, process async via scheduled function |

### Risk 3: Service Unavailability During Go-Live

**Probability:** Very low (1/10) — Major vendors have 99.9% SLA  
**Impact:** Medium (6/10) — Escalations don't reach intended recipient (email fallback kicks in)

| Scenario | Mitigation | Fallback |
|----------|-----------|----------|
| Twilio SMS service down for 1 hour during Phase 5 go-live | Fallback to email via SendGrid (operators get email instead of SMS) | Manual escalation: operator calls department supervisor |
| NOTIVISA API down for 1 hour during Phase 4 deployment | Queue backs up in Firestore; automatic retry when NOTIVISA recovers | Manual escalation: ops team manually notifies RTs via phone |

### Risk 4: Firestore Quota Exceeded

**Probability:** Very low (1/10) — Estimated volume 250 events/day = <1% of daily quota  
**Impact:** High (8/10) — System stops writing; escalations don't queue

| Scenario | Mitigation | Fallback |
|----------|-----------|----------|
| Daily Firestore write quota exceeded (50K limit) | Implement quota monitoring alert (at 80%); implement backpressure (reject submissions if quota >75%) | Scale Firestore or archive old events to BigQuery |

---

## Critical Path Summary

**Phase 4 (NOTIVISA):**
- Blocker: NOTIVISA credentials (vendor) — **must receive by 2026-05-16**
- Blocker: API documentation (vendor) — **must receive by 2026-05-16**
- Code ready: Phase 3 complete ✅
- Deploy: 2026-06-02 (2.5 weeks execution)

**Phase 5 (Twilio):**
- Blocker: Twilio account + phone numbers (vendor) — **must receive by 2026-05-20** (kickoff day)
- Blocker: SMS service enabled (vendor) — **must confirm by 2026-05-20**
- Code ready: Phase 3 complete ✅
- Deploy: 2026-06-30 (3 weeks execution)

**Phase 8 (CAPA Closure) — Parallel Dependency:**
- Blocker: Phase 4 + Phase 5 must be LIVE — **by 2026-06-15** (CAPA kickoff)
- Auditor pre-alignment calls weekly starting 2026-06-01
- CAPA findings closure ceremony: 2026-08-05 (deadline for Phase 8 completion)

**Critical path duration:** 14 weeks (Phase 0 start: 2026-05-07 → Phase 8 end: 2026-08-05)

---

## Sign-Off & Approval

**Document Owner:** CTO  
**Last Updated:** 2026-05-07  
**Review Cycle:** Weekly (Monday 10am BRT, sync with Auditor pre-alignment calls)  
**Next Update:** 2026-05-13 (Phase 4 kickoff − 7 days)

| Role | Name | Sign-Off | Date |
|------|------|----------|------|
| CTO | [Name] | Approved | 2026-05-07 |
| Engineering Manager | [Name] | Acknowledged | 2026-05-07 |
| Agent 1 (Phase 5) | [Name] | Acknowledged | TBD |
| Agent 3 (Phase 4) | [Name] | Acknowledged | TBD |

---

**Appendix: Vendor Contacts**

| Vendor | Account Manager | Email | Phone | Hours |
|--------|-----------------|-------|-------|-------|
| NOTIVISA | [Name] | [email] | [phone] | Business hours (BRT) |
| Twilio | [Name] | [email] | [phone] | 24/7 support |
| SendGrid | [Name] | [email] | [phone] | Business hours (US-EST) |

---

**Last Updated:** 2026-05-07  
**Status:** Active (Phase 4–5 execution planning)
