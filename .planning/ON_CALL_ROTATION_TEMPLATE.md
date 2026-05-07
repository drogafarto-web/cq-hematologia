---
version: 1.0
created: 2026-05-07
milestone: v1.4
scope: On-call rotation + incident response framework
duration: 4-week rotating cycle (May 20 - Aug 5)
---

# HC Quality v1.4 — On-Call Rotation Template

**Purpose:** Define on-call schedule, severity matrix, and incident response for Phase 4–9 execution (2026-05-20 to 2026-08-05).

**Effective Date:** 2026-05-20 (Phase 4 kickoff)

---

## Severity Matrix

| Severity | Definition | Response SLA | Escalation | Examples |
|----------|-----------|--------------|------------|----------|
| 🟢 **GREEN** | Informational / Monitoring alert | 24h | None required | Lighthouse score <95, non-blocking warning, documentation typo |
| 🟡 **YELLOW** | Minor issue / Partial degradation | 4h | Team lead | Portal feature lag (>2s), 1-2 users affected, non-critical module |
| 🟠 **RED** | Major issue / Service degradation | 1h | CTO + On-call | 5+ users blocked, critical module down (bioquímica, auth), 95% error rate |
| ⚫ **BLACK** | Critical outage / Complete service loss | 15min | CTO + All leads + Incident Commander | Production down, 100% traffic affected, ANVISA deadline at risk, RDC violation imminent |

---

## Incident Commander Authority

**Role:** On-call engineer (rotates weekly) + CTO on BLACK severity.

**Authority (BLACK severity only):**
- Immediate rollback decision (no waiting for code review)
- Halt Phase 4+ work (all engineers pivot to incident)
- Direct communication with auditor (if RDC-related)
- Executive escalation (if business impact >4h)

**Decision Checklist:**
1. Confirm severity (BLACK or RED)
2. Assess service impact (% users, RDC risk)
3. Evaluate fix vs. rollback time (estimate both)
4. Execute rollback if fix time >30min OR RDC risk detected
5. Post-mortem scheduled within 24h

---

## 4-Week Rotation Schedule (Repeating Template)

### Week 1: On-Call Lead (Mon-Sun)

| Role | Name | On-Call Hours | Escalation | Contact |
|------|------|---------------|-----------|----|
| **Primary On-Call** | [Week 1 TBD] | 24/7 (emergency contact) | Team lead (4h issue) | [Phone/Slack] |
| **Secondary On-Call** | [Week 1 TBD] | 08:00–18:00 BRT (business hours) | Primary (if unavailable) | [Phone/Slack] |
| **CTO Escalation** | drogafarto | 24/7 (BLACK severity only) | Incident Commander | drogafarto@gmail.com |

**Duties:**
- Monitor Cloud Logs continuously (alert thresholds set in Firebase Console)
- Respond to Slack #incidents within 15min (GREEN/YELLOW) or 5min (RED/BLACK)
- Execute runbook for specific issue (see Runbook Index below)
- Update status in #incidents-status Slack channel (15min cadence for RED+)
- Post-mortem notes for any RED or BLACK incident

**Notes:**
- Primary on-call: response SLA 15min (daytime), 30min (nighttime)
- Secondary: response SLA 30min (daytime), escalate to primary (nighttime)
- CTO: strategic decision authority (rollback, auditor contact), 5min response on BLACK

---

### Week 2: On-Call Lead (Mon-Sun)

| Role | Name | On-Call Hours | Escalation | Contact |
|------|------|---------------|-----------|----|
| **Primary On-Call** | [Week 2 TBD] | 24/7 (emergency contact) | Team lead (4h issue) | [Phone/Slack] |
| **Secondary On-Call** | [Week 2 TBD] | 08:00–18:00 BRT (business hours) | Primary (if unavailable) | [Phone/Slack] |
| **CTO Escalation** | drogafarto | 24/7 (BLACK severity only) | Incident Commander | drogafarto@gmail.com |

---

### Week 3: On-Call Lead (Mon-Sun)

| Role | Name | On-Call Hours | Escalation | Contact |
|------|------|---------------|-----------|----|
| **Primary On-Call** | [Week 3 TBD] | 24/7 (emergency contact) | Team lead (4h issue) | [Phone/Slack] |
| **Secondary On-Call** | [Week 3 TBD] | 08:00–18:00 BRT (business hours) | Primary (if unavailable) | [Phone/Slack] |
| **CTO Escalation** | drogafarto | 24/7 (BLACK severity only) | Incident Commander | drogafarto@gmail.com |

---

### Week 4: On-Call Lead (Mon-Sun)

| Role | Name | On-Call Hours | Escalation | Contact |
|------|------|---------------|-----------|----|
| **Primary On-Call** | [Week 4 TBD] | 24/7 (emergency contact) | Team lead (4h issue) | [Phone/Slack] |
| **Secondary On-Call** | [Week 4 TBD] | 08:00–18:00 BRT (business hours) | Primary (if unavailable) | [Phone/Slack] |
| **CTO Escalation** | drogafarto | 24/7 (BLACK severity only) | Incident Commander | drogafarto@gmail.com |

---

## Rotation Assignments (May 20 - Aug 5)

**Cycle 1: May 20 - Jun 16 (4 weeks)**

| Week | Primary | Secondary | Contact Info |
|------|---------|-----------|--------------|
| **W1 (May 20-26)** | [Agent 1 Backend Sr.] | [Agent 3 Backend Mid] | [Phone] [Slack] |
| **W2 (May 27-Jun 2)** | [Agent 2 Frontend Sr.] | [Agent 4 QA Sr.] | [Phone] [Slack] |
| **W3 (Jun 3-9)** | [Agent 3 Backend Mid] | [Agent 2 Frontend Sr.] | [Phone] [Slack] |
| **W4 (Jun 10-16)** | [Agent 4 QA Sr.] | [Agent 1 Backend Sr.] | [Phone] [Slack] |

**Cycle 2: Jun 17 - Jul 14 (4 weeks)**

| Week | Primary | Secondary | Contact Info |
|------|---------|-----------|--------------|
| **W1 (Jun 17-23)** | [Agent 5 IA Specialist] | [Agent 1 Backend Sr.] | [Phone] [Slack] |
| **W2 (Jun 24-30)** | [Agent 1 Backend Sr.] | [Agent 2 Frontend Sr.] | [Phone] [Slack] |
| **W3 (Jul 1-7)** | [Agent 2 Frontend Sr.] | [Agent 3 Backend Mid] | [Phone] [Slack] |
| **W4 (Jul 8-14)** | [Agent 3 Backend Mid] | [Agent 4 QA Sr.] | [Phone] [Slack] |

**Cycle 3: Jul 15 - Aug 5 (3 weeks + CAPA Phase 8)**

| Week | Primary | Secondary | Contact Info | Phase 8 Override |
|------|---------|-----------|--------------|------------------|
| **W1 (Jul 15-21)** | [Agent 4 QA Sr.] | [Agent 2 Frontend Sr.] | [Phone] [Slack] | CTO Phase 8 F-05 |
| **W2 (Jul 22-28)** | [Agent 1 Backend Sr.] | [Agent 5 IA Specialist] | [Phone] [Slack] | CTO Phase 8 F-06 |
| **W3 (Jul 29-Aug 5)** | [Agent 2 Frontend Sr.] | [Agent 3 Backend Mid] | [Phone] [Slack] | CTO Phase 8 F-07 (final) |

**Note:** Phase 8 (CAPA Closure) runs concurrently Jul 15 - Aug 5. CTO overrides on-call for F-05/F-06/F-07 strategic decisions. Team still maintains operational on-call for Phase 4–7 issues.

---

## Incident Response Workflow

### 1. Alert Reception (0 min)

- Firebase Cloud Logs alert fires → Slack #incidents
- On-call primary receives Slack notification (pin, @mention)
- Secondary on-call monitors in parallel

### 2. Severity Assessment (0–5 min)

**On-call engineer:**
1. Check alert context (error rate, affected resource, user count)
2. Open Cloud Logs dashboard (pre-configured filters)
3. Classify severity:
   - [ ] GREEN — Non-urgent, log typo, Lighthouse warning
   - [ ] YELLOW — Feature lag, partial degradation, 1-5 users
   - [ ] RED — Major degradation, 5%+ error rate, critical module
   - [ ] BLACK — Outage, 100% service loss, ANVISA risk

### 3. Incident Commander Activation

**If YELLOW or RED:**
1. Post summary to #incidents-status (severity, affected module, ETA)
2. Assign team lead (if not available, escalate)
3. Start runbook execution (see Runbook Index)

**If BLACK:**
1. Immediately page CTO (SMS + Slack @channel)
2. Page incident commander (on-call primary)
3. Halt all Phase 4+ work
4. Gather all leads in #incidents Slack channel (video call if >30 min)
5. CTO decides: fix vs. rollback within 5 min
6. Execute decision with merge gate override (if rollback)

### 4. Resolution & Logging (varies)

**After incident cleared:**
1. Notify #incidents-status (incident closed, time to resolution)
2. Post incident notes (what happened, duration, actions taken)
3. If RED or BLACK → Post-mortem within 24h
4. Update runbook with lessons learned

---

## Runbook Index

### Critical Module Runbooks (By Severity + Module)

| Module | Issue | Severity | Runbook | Owner |
|--------|-------|----------|---------|-------|
| **Portal Auth** | Login callable fails | RED | [See Runbook: Portal Auth Failure](docs/runbook-portal-auth.md) | Agent 1 Backend Sr. |
| **Portal Auth** | Session corruption | BLACK | [See Runbook: Session Corruption](docs/runbook-session-corruption.md) | CTO + Agent 1 |
| **NOTIVISA Queue** | Queue stuck (no submissions) | RED | [See Runbook: Queue Deadlock](docs/runbook-queue-deadlock.md) | Agent 3 Backend Mid |
| **NOTIVISA Queue** | ANVISA API timeout | YELLOW | [See Runbook: ANVISA Timeout](docs/runbook-anvisa-timeout.md) | Agent 3 |
| **Critical Dashboard** | SMS/WhatsApp delivery fails | RED | [See Runbook: Escalation Failure](docs/runbook-escalation-failure.md) | Agent 1 Backend Sr. |
| **Critical Dashboard** | SLA miss (>5min delivery) | YELLOW | [See Runbook: SLA Miss](docs/runbook-sla-miss.md) | Agent 4 QA Sr. |
| **PDF Export** | PDF generation timeout | YELLOW | [See Runbook: PDF Timeout](docs/runbook-pdf-timeout.md) | Agent 1 Backend Sr. |
| **IA Strip Upload** | Gemini Vision batch fails | RED | [See Runbook: IA Batch Failure](docs/runbook-ia-batch-failure.md) | Agent 5 IA Specialist |
| **Firestore Rules** | Permission denied errors spike | RED | [See Runbook: Rules Regression](docs/runbook-rules-regression.md) | Agent 1 Backend Sr. |
| **Cloud Functions** | Function deployment stuck | YELLOW | [See Runbook: Deploy Stuck](docs/runbook-deploy-stuck.md) | Agent 4 QA Sr. |
| **Performance** | Lighthouse score drop >10 pts | YELLOW | [See Runbook: Perf Degradation](docs/runbook-perf-degradation.md) | Agent 2 Frontend Sr. |

**Note:** Runbooks stored in `docs/runbooks/` directory. Each contains:
- Problem statement + symptoms
- Severity classification
- Investigation steps (Cloud Logs filters, queries)
- Fix procedure (code change or rollback)
- Verification checklist
- Post-incident review template

---

## Communication Templates

### Slack #incidents-status (YELLOW severity, example)

```
🟡 YELLOW — Portal Auth Lag (10:15 BRT)
Module: auth-portal
Symptom: Login requests delayed >2s (baseline 500ms)
Affected: ~3 users reporting slow login
ETA Resolution: 30min (investigating callable execution time)
On-Call: [Agent 1]
Status: INVESTIGATING
```

### Slack #incidents-status (RED severity, example)

```
🔴 RED — NOTIVISA Queue Deadlock (14:23 BRT)
Module: notivisa-queue
Symptom: 47 events queued, 0 submissions in 2h (threshold 10/h)
Root Cause: Cloud Function timeout on ANVISA API call
Affected: All draft submissions (100% blocked)
ETA Resolution: 15min (rolling back to 2026-05-19 version)
On-Call: [Agent 3] | Incident Commander: [Team Lead]
Status: ROLLBACK IN PROGRESS
```

### Post-Incident Summary (template, sent 24h after RED/BLACK)

```markdown
# Post-Incident Review — NOTIVISA Queue Deadlock (2026-05-24)

**Incident:** Queue processing stopped for 90min
**Severity:** RED
**Duration:** 90 min (14:23–15:53 BRT)
**Root Cause:** Cloud Function timeout (30s limit) on ANVISA API (slow endpoint)
**Fix:** Increased timeout to 60s, added exponential backoff retry (max 3 attempts)

**Timeline:**
- 14:23 UTC: Alert fires (queue lag spike)
- 14:28 UTC: On-call [Agent 3] investigates
- 14:35 UTC: Root cause identified (timeout in logs)
- 14:40 UTC: Rollback decision made (fix would take 20min, rollback 5min)
- 14:45 UTC: Rollback deployed
- 15:53 UTC: Queue processing resumed (100 submissions caught up)

**Action Items:**
- [ ] Implement ANVISA timeout buffer (60s) in Phase 5 (Agent 3, due Jun 15)
- [ ] Add pre-deploy ANVISA connectivity check (Agent 4, due Jun 1)
- [ ] Update runbook with ANVISA latency table (Agent 1, due May 31)

**Prevention:**
- Load test NOTIVISA queue with 1,000+ events before Phase 4 deploy
- Add Cloud Logging alert for queue lag >5min
- Implement circuit breaker pattern for ANVISA API (fallback: local queue with retry)
```

---

## Alert Rules (Firebase Cloud Logging)

### Pre-configured Alerts (to be set up by QA Sr. before Phase 4)

| Alert Name | Condition | Severity | Notification |
|------------|-----------|----------|--------------|
| `auth-callable-errors` | error_rate > 5% for 5min | RED | Slack #incidents + SMS |
| `queue-lag-spike` | queue_lag > 5min OR events_queued > 100 | RED | Slack #incidents + SMS |
| `notivisa-api-timeout` | response_time > 10s OR timeout_count > 5 | YELLOW | Slack #incidents |
| `gemini-vision-failure` | batch_error_rate > 10% | RED | Slack #incidents + SMS |
| `pdf-generation-timeout` | generation_time > 10s for 3+ consecutive | YELLOW | Slack #incidents |
| `firestore-rules-deny` | permission_denied_count > 10/min | RED | Slack #incidents + SMS |
| `function-deploy-stuck` | deploy_duration > 30min | YELLOW | Slack #engineering |
| `lighthouse-regression` | score_drop > 10 points | YELLOW | Slack #engineering |
| `uptime-drop` | availability < 99.8% (24h) | YELLOW | Slack #incidents-status |
| `ssl-certificate-expiry` | days_until_expiry < 30 | GREEN | Slack #ops (informational) |

---

## Handoff Checklist (Weekly Rotation)

**Outgoing On-Call → Incoming On-Call (Every Monday)**

- [ ] Review last week's incidents (if any)
- [ ] Share Cloud Logs dashboard link + saved filters
- [ ] Review runbooks for any updates
- [ ] Confirm Slack + SMS notification settings
- [ ] Test alert delivery (fire test alert to new on-call)
- [ ] Share ANVISA contact info (if Phase 4+ active)
- [ ] Confirm backup on-call secondary is ready
- [ ] Schedule knowledge-transfer call (15min, async Slack OK)

---

## Escalation Matrix

```
Issue Detected
    ↓
On-Call Primary (15min response)
    ↓ (if no response OR YELLOW/RED)
On-Call Secondary (30min response)
    ↓ (if no response OR RED)
Team Lead (1h response)
    ↓ (if no response OR RED severity >2h)
CTO (5min response on BLACK, decision authority)
    ↓ (if BLACK OR business-critical impact)
Executive Escalation (auditor contact, ANVISA deadline at risk)
```

---

## Compliance Notes

**RDC 978/2025 Alignment:**
- Incident response tracked in audit trail (notivisa-queue + auditLog subcollection)
- All emergency changes logged with operator ID + timestamp (Art. 5.3)
- Rollback decisions documented (Art. 86 — risk management)
- Post-mortem root causes analyzed (FMEA-lite pattern, Art. 147)

**DICQ 4.4 (Trilha de Audit):**
- Every incident generates audit record: { operator, action, timestamp, severity, resolution }
- On-call decisions captured: { decision_type, rationale, approver, timestamp }

---

## Document Structure

**File:** `.planning/ON_CALL_ROTATION_TEMPLATE.md`  
**Version:** 1.0 (2026-05-07)  
**Next Review:** 2026-05-20 (Phase 4 kickoff — finalize names + Slack setup)  
**Audience:** All engineers, team leads, CTO

---

## Next Steps (Pre-Phase 4)

1. **By 2026-05-10:** Fill in team names for rotation Weeks 1–12
2. **By 2026-05-13:** Set up Slack channels (`#incidents`, `#incidents-status`, `#ops`)
3. **By 2026-05-15:** Configure Firebase Cloud Logs alerts (see Alert Rules above)
4. **By 2026-05-19:** Create runbooks in `docs/runbooks/` (link from index)
5. **By 2026-05-20:** Test on-call SMS notification delivery (fire test alert)
6. **2026-05-20 (Mon):** Phase 4 kickoff — on-call rotation LIVE

---

**Prepared by:** CTO (drogafarto@gmail.com)  
**Date:** 2026-05-07  
**Status:** Ready for team review + name population
