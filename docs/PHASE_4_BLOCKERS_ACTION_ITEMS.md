---
title: 'Phase 4 Pre-Kickoff Action Items'
date: 2026-05-07
priority: HIGH
blocking_phase_4: true
---

# Phase 4 Pre-Kickoff Action Items — Critical Path

**Status:** 3 soft-blockers, 0 hard-blockers. **Phase 4 can kick off 2026-05-20 with these in parallel.**

---

## Action Item #1: Provision Email/SMS Credentials

**Impact:** Escalation features (Phase 6) will work email-only until SMS provisioned.  
**Effort:** 1–2 hours (SMTP) + 2–3 days (Twilio procurement)  
**Owner:** DevOps / CTO  
**Priority:** HIGH (Phase 4 → Phase 5 blocker if SMS in scope)

### Task 1a: SMTP Setup (Email Escalation) — DO FIRST

Choose one provider:

**Option 1: Gmail (dev/test)**

```bash
# Create app password at https://myaccount.google.com/apppasswords
firebase functions:secrets:set SMTP_HOST --data="smtp.gmail.com"
firebase functions:secrets:set SMTP_PORT --data="587"
firebase functions:secrets:set SMTP_USER --data="labclin-noreply@gmail.com"
firebase functions:secrets:set SMTP_PASS --data="<app-password>"
```

**Option 2: Brevo (production) — RECOMMENDED**

```bash
# Sign up at https://www.brevo.com (free tier available)
firebase functions:secrets:set SMTP_HOST --data="smtp-relay.brevo.com"
firebase functions:secrets:set SMTP_PORT --data="587"
firebase functions:secrets:set SMTP_USER --data="<brevo-email@company.com>"
firebase functions:secrets:set SMTP_PASS --data="<api-key>"
```

**Verification:**

```bash
firebase deploy --only functions:criticos_escalate
# Test: send escalation, verify email received in 10 min
```

**Deadline:** 2026-05-20 (before Phase 4 execution)  
**Runbook:** See section 4.1 in `PHASE_3_4_INTEGRATION_REPORT.md`

---

### Task 1b: Twilio Provisioning (SMS Escalation) — OPTIONAL, CAN DEFER

**If SMS is in Phase 4 scope:**

```bash
# 1. Create account at https://www.twilio.com
# 2. Provision Brazil phone number
# 3. Set secrets:
firebase functions:secrets:set TWILIO_ACCOUNT_SID --data="<sid>"
firebase functions:secrets:set TWILIO_AUTH_TOKEN --data="<token>"
firebase functions:secrets:set TWILIO_FROM_NUMBER --data="+551199999999"
firebase deploy --only functions:criticos_escalate
```

**If NOT in Phase 4 scope (defer to 4.1):**

- Email-only escalation works immediately
- SMS wired asynchronously (no re-architecture needed)
- Mark in Phase 4 spec as "stretch goal"

**Deadline:** 2026-05-20 (if scope critical); else 2026-06-03 (Phase 4.1)  
**Effort:** 30 min setup + 2–3 days Twilio account approval (gov SLA)  
**Owner:** Operations/Admin

---

## Action Item #2: Create Cloud Tasks Queue for NOTIVISA

**Impact:** NOTIVISA retry mechanism won't process until queue exists.  
**Effort:** 15 minutes  
**Owner:** DevOps  
**Priority:** HIGH (Phase 4 → Phase 8 blocker)

```bash
gcloud tasks queues create notivisa-outbox-queue \
  --location=southamerica-east1 \
  --max-attempts=5 \
  --max-retry-delay=3600s \
  --max-dispatches-per-second=100 \
  --project=hmatologia2
```

**Verify:**

```bash
gcloud tasks queues describe notivisa-outbox-queue \
  --location=southamerica-east1 \
  --project=hmatologia2
```

**Deadline:** 2026-05-20 (before Phase 4 execution)  
**Runbook:** See section 3.2 in `PHASE_3_4_INTEGRATION_REPORT.md`

---

## Action Item #3: Enable & Test Email-Link Auth

**Impact:** Patient portal passwordless login won't work until enabled.  
**Effort:** 30 min (enable) + 1 hour (E2E test)  
**Owner:** Frontend lead + DevOps  
**Priority:** MEDIUM (Phase 5 blocker if patient portal in v1.4 scope)

### Setup (Firebase Console)

1. Go to https://console.firebase.google.com/project/hmatologia2/authentication/providers
2. Click **Email/Password**
3. Enable **"Email link (passwordless sign-in)"**
4. Set redirect URL: `https://hmatologia2.web.app/auth/link-callback`
5. Save

### E2E Test

```typescript
// In test:
const auth = getAuth();
await sendSignInLinkToEmail(auth, 'patient@example.com', {
  url: 'https://hmatologia2.web.app/auth/link-callback',
  handleCodeInApp: true,
});

// Check email → click link
// Verify: app redirects to /portals/dashboard
```

**Deadline:** 2026-05-20 if Phase 5 (patient portal) in scope; else defer to 2026-06-03  
**Runbook:** See section 2.5 in `PHASE_3_4_INTEGRATION_REPORT.md`

---

## Action Item #4 (BLOCKED): NOTIVISA Sandbox Credentials

**Impact:** Real NOTIVISA integration (Phase 8) blocked until credentials arrive.  
**Effort:** N/A (gov procurement)  
**Owner:** Compliance / ANVISA liaison  
**Priority:** HIGH (Phase 8 blocker, ~7 weeks out)  
**Timeline:** 5–7 days (gov SLA)

**Status:** Initiate procurement immediately if not already done.

**Mitigation:** Phase 4–7 can mock NOTIVISA API using Firestore `notivisa-outbox` collection without real credentials. Phase 8 integrates real API once credentials arrive.

**Action:** Contact ANVISA for sandbox API access. Escalate if procurement blocked.

---

## Go/No-Go Decision Gate (2026-05-20)

```checklist
## PRE-PHASE-4 GO/NO-GO

### Required (Blocking)
- [ ] SMTP credentials set (Gmail or Brevo)
- [ ] Cloud Tasks queue created
- [ ] Phase 3 rules + schema verified in production (rules test suite 27/28 passing)
- [ ] No P0 security findings in Cloud Logs (last 7 days)

### Recommended (Soft-block if missed)
- [ ] Email-link auth enabled in Firebase
- [ ] Twilio provisioned (if SMS in Phase 4 scope)

### Informational (Deferred)
- [ ] NOTIVISA sandbox credentials (Phase 8, not Phase 4)

### Sign-off
- CTO: __________ Date: __________
- DevOps Lead: __________ Date: __________
- QA Lead: __________ Date: __________

**Decision:** [ ] GO — Phase 4 kickoff 2026-05-20
             [ ] NO-GO — resolve blockers, re-assess 2026-05-24
```

---

## Quick Reference: Unblocking Timeline

```timeline
Day 1 (2026-05-20):
  ├─ 09:00 — SMTP setup (30 min)
  ├─ 09:30 — Test email escalation (20 min)
  ├─ 10:00 — Cloud Tasks queue creation (15 min)
  ├─ 10:15 — Email-link auth enable (15 min)
  └─ 11:00 — Go/No-Go decision standup

Day 2–4 (2026-05-21–23):
  ├─ Parallel: Phase 4 kickoff + Twilio procurement starts
  └─ If Twilio unavailable by Day 4, Phase 4 proceeds with email-only

Week 2 (2026-05-27–31):
  └─ Twilio credentials arrive (likely) → wire + deploy (1–2h)

Week 9 (2026-07-07):
  └─ Phase 8 begins; NOTIVISA sandbox credentials required (escalate if still pending)
```

---

## Dependencies Summary

| Action Item          | Blocks Phase | Effort | Owner      | Deadline          |
| -------------------- | ------------ | ------ | ---------- | ----------------- |
| #1a: SMTP            | 4            | 1h     | DevOps     | 2026-05-20        |
| #1b: Twilio          | 5 (optional) | 2–3d   | Ops        | 2026-05-20 (soft) |
| #2: Cloud Tasks      | 4 + 8        | 15m    | DevOps     | 2026-05-20        |
| #3: Email-link Auth  | 5 (optional) | 1.5h   | Frontend   | 2026-05-20 (soft) |
| #4: NOTIVISA Sandbox | 8            | —      | Compliance | 2026-06-28        |

---

**Report Version:** 1.0  
**Date:** 2026-05-07  
**Next Review:** 2026-05-19 (1 day pre-kickoff)
