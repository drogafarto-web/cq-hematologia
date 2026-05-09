# Incident Severity Matrix

## Green — Low Risk / Development Issue

**Impact:** No patient impact, internal systems only, non-urgent  
**Examples:** UI typo, dev environment broken, documentation gap, test failure  
**Response Time SLA:** Next business day  
**Team Notification:** Slack #dev-incidents (async)  
**Escalation Trigger:** None (resolve in normal sprint)

**Decision Criteria:**
- Zero production data affected
- Zero regulatory/audit impact
- Non-blocking for users

---

## Yellow — Moderate Impact / Partial Degradation

**Impact:** Some users affected, non-critical workflow, workaround available  
**Examples:** Analytics dashboard slow (>3s load), 5% of laudo exports failing, audit trail query timeout (auditor can use report API instead)  
**Response Time SLA:** 4 hours (on-call engineer)  
**Team Notification:** Slack @oncall, Slack #incidents  
**Escalation:** If not resolved in 2h, escalate to Yellow IC

**Decision Criteria:**
- <10% of users affected
- Workaround available (manual process, alternate feature)
- Regulatory impact: none or minimal (DICQ only)

---

## Red — High Impact / Critical Degradation

**Impact:** Core workflow down, many users affected, regulatory implications  
**Examples:** Patient portal down, laudo release blocked (RT can't sign), audit trail corrupted, NOTIVISA submissions failing (gov deadline risk)  
**Response Time SLA:** 1 hour (Incident Commander on call)  
**Team Notification:** All + on-call + leadership  
**Escalation:** Automatic after 30min without progress

**Decision Criteria:**
- ≥50% of users affected OR
- Core workflow (laudo release, CAPA, audit trail) down OR
- RDC Art. 128 impact (audit trail integrity breach)
- DICQ 4.4 impact (external communication blocked)

---

## Black — Complete System Failure / Regulatory Crisis

**Impact:** System down, patient safety risk, regulatory authority notification required  
**Examples:** Database entirely inaccessible, all functions failing, patient data lost/corrupted, NOTIVISA breach (gov reporting law)  
**Response Time SLA:** Immediate (CTO + full team)  
**Team Notification:** All hands on deck  
**Escalation:** Declared immediately by CTO or IC

**Decision Criteria:**
- System completely unavailable OR
- Patient safety at risk OR
- RDC Art. 128 violation (audit trail corrupted, cannot verify) OR
- Legal/regulatory obligation to notify (LGPD breach, gov API failure)

---

## Decision Tree

```
1. Is patient data affected (read/write/integrity)?
   → YES: Red or Black (see 2)
   → NO: Go to 3

2. Is patient data lost or corrupted?
   → YES: Black (immediate CTO escalation)
   → NO: Red (RDC audit trail impact)

3. Is a core workflow (laudo, CAPA, audit, NOTIVISA) down?
   → YES: Red (many users blocked)
   → NO: Go to 4

4. Is a non-critical system slow or failing (analytics, exports)?
   → YES: Yellow (workaround available)
   → NO: Green (minor issue)
```

---

## Response Time SLA by Severity

| Severity | Detection | First Response | Resolution Target |
|----------|-----------|---------------|--------------------|
| **Green** | Next standup | Next business day | Next sprint |
| **Yellow** | On-call monitoring (30s) | 15 min | 4 hours |
| **Red** | Automated alert (1min) | 5 min | 1 hour |
| **Black** | Automated alert + manual verification | Immediate | 30 min (if possible; escalate to restore) |

---

## On-Call Escalation

**Yellow incident escalates to Red if:**
- Not resolved in 2 hours
- More data emerges showing higher impact
- On-call engineer unable to make progress (asks for backup)

**Red incident escalates to Black if:**
- Data loss / corruption confirmed
- Unable to restore within 30 min
- Regulatory notification appears necessary
