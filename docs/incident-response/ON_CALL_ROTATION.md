# On-Call Rotation — 4-Week Cycle

## Rotation Schedule

| Week | Primary IC | Backup IC | Coverage    | Timezone   |
| ---- | ---------- | --------- | ----------- | ---------- |
| 1    | [Name]     | [Name]    | Mon–Sun 24h | BR (UTC-3) |
| 2    | [Name]     | [Name]    | Mon–Sun 24h | BR (UTC-3) |
| 3    | [Name]     | [Name]    | Mon–Sun 24h | BR (UTC-3) |
| 4    | [Name]     | [Name]    | Mon–Sun 24h | BR (UTC-3) |

_Fill in names and contact methods below._

---

## Role: Primary Incident Commander (IC)

**Responsibilities:**

- Monitor Cloud Logs + alerts during on-call week (24/7)
- Respond to Slack #incidents within 15 min (Yellow) or 5 min (Red)
- Declare incident severity (Green/Yellow/Red/Black)
- Activate runbook if needed
- Coordinate team escalation (if Red/Black)
- Communicate status updates (every 30 min for Red, every 2 hours for Yellow)
- Post-mortem lead (after incident resolves)

**Authority:**

- Can override normal deployment procedures (e.g., hot-fix without full review)
- Can declare severity and activate on-call team
- Can make critical decisions (e.g., "rollback function X")
- Cannot unilaterally decide to contact external parties — requires CTO approval unless Black

**Contact Methods (IC to fill in):**

- Phone: [+55 number]
- Slack: @[name]
- Email: [email]

---

## Role: Backup IC

**Responsibilities:**

- Assume Primary IC duties if Primary unreachable
- Assist with escalation (Yellow → Red decision)
- Cover handoff during shift change

**Contact Methods (to fill in):**

- Phone: [+55 number]
- Slack: @[name]

---

## Shift Handoff Procedure

**Friday 17:00 (outgoing IC):**

- Review last week's incidents (if any)
- Brief incoming IC on ongoing issues
- Share access to critical tools
- Document any known risks

**Monday 09:00 (incoming IC):**

- Run health check: Cloud Logs, monitoring, functions
- Verify all contacts in tree are current
- Read post-mortem from previous week (if any)
- Declare "on-call week started" in Slack

---

## Tools & Access

- Cloud Console: [link to project]
- Cloud Logs: [saved filter for errors]
- Monitoring Dashboard: [link]
- Firestore Console: [link]
- Deployment Keys: [location]

---

## Escalation Triggers

**Escalate to Backup IC if:**

- Primary IC unreachable for 5 min
- Primary IC says "need backup"
- Severity upgraded (Yellow → Red)

**Escalate to CTO if:**

- Black incident declared
- Red incident not resolved in 30 min
- External party notification needed

---

## Compensation / Rest Days

- Primary IC on-call week: +2 days off following week
- Backup IC: +0.5 day off (if backup called in)
- If Black incident: +1 day off for all responders
