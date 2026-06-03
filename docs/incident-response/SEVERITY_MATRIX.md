# Incident Severity Matrix

Classification system for production incidents: Green/Yellow/Red/Black with clear decision criteria and response SLAs.

---

## Green — Low Risk / Development Issue

**Impact:** No patient impact, internal systems only, non-urgent

**Examples:**

- UI typo or visual bug
- Dev environment broken
- Documentation gap
- Test failure in non-critical module

**Response Time SLA:** Next business day (8 hours)

**Team Notification:** Slack `#dev-incidents` (async)

**Decision Criteria:**

- Zero production data affected
- Zero regulatory impact
- Non-blocking for users

---

## Yellow — Moderate Impact / Partial Degradation

**Impact:** Some users affected, non-critical workflow, workaround available

**Examples:**

- Analytics dashboard slow (>3s load)
- 5% of laudo exports failing
- Audit trail query timeout

**Response Time SLA:** 4 hours (on-call engineer)

**Team Notification:** Slack `@oncall`, Slack `#incidents`

**Decision Criteria:**

- <10% of users affected
- Workaround available
- Regulatory impact: none or minimal

---

## Red — High Impact / Critical Degradation

**Impact:** Core workflow down, many users affected, regulatory implications

**Examples:**

- Patient portal down
- Laudo release blocked
- Audit trail corrupted
- NOTIVISA submissions failing

**Response Time SLA:** 1 hour (Incident Commander on call)

**Team Notification:** All + on-call + leadership

**Decision Criteria:**

- ≥50% of users affected OR
- Core workflow (laudo release, CAPA, audit) down OR
- RDC Art. 128 impact (audit trail integrity)

---

## Black — Complete System Failure / Regulatory Crisis

**Impact:** System down, patient safety risk, regulatory notification required

**Examples:**

- Database entirely inaccessible
- All functions failing
- Patient data lost/corrupted
- NOTIVISA breach

**Response Time SLA:** Immediate (CTO + full team)

**Team Notification:** All hands on deck

**Decision Criteria:**

- System completely unavailable OR
- Patient safety at risk OR
- Data loss confirmed OR
- Regulatory notification required

---

## Decision Tree

```
1. Is patient data affected (read/write/integrity)?
   ├─ YES: Go to 2
   └─ NO: Go to 3

2. Is patient data lost or corrupted?
   ├─ YES: BLACK
   └─ NO: RED

3. Is core workflow (laudo, CAPA, audit) down?
   ├─ YES: RED
   └─ NO: Go to 4

4. Is non-critical system slow/failing (analytics)?
   ├─ YES: YELLOW
   └─ NO: GREEN
```

---

## Response Time SLA by Severity

| Severity | Detection          | First Response    | Resolution Target |
| -------- | ------------------ | ----------------- | ----------------- |
| Green    | Next standup       | Next business day | Next sprint       |
| Yellow   | 30s monitoring     | 15 min            | 4 hours           |
| Red      | 1min alert         | 5 min             | 1 hour            |
| Black    | Immediate + verify | <2 min            | 30 min (restore)  |

---

## Escalation Criteria

**Yellow → Red:**

- > 10% of users affected
- No workaround available
- > 30 min to resolution
- Unknown root cause

**Red → Black:**

- Data loss confirmed
- Corruption detected
- All backups failed
- Patient safety at risk

---

## Customer Notification Rules

| Severity | Notify? | Timeline         | Approver    |
| -------- | ------- | ---------------- | ----------- |
| Green    | No      | —                | N/A         |
| Yellow   | If >1h  | After resolution | CTO         |
| Red      | If >1h  | After 30min      | CTO         |
| Black    | Yes     | Within 1h        | CTO + Legal |
