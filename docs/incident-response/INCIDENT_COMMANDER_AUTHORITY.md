# Incident Commander — Authority & Decision Authority

## Role Definition

**Incident Commander (IC)** is the senior decision-maker during a Yellow, Red, or Black incident. IC authority supersedes normal process, with explicit scope limits.

---

## Authority Scope

### IC CAN (without additional approval):

**Yellow Incident:**

- Classify incident severity
- Activate on-call team (notify Slack #incidents)
- Request Backup IC assistance
- Activate Yellow runbook (e.g., "restart function X")
- Make tactical decisions (retry, restart, rollback if ≤15min old)
- Update status in Slack every 30 min
- Approve team member helping (allocate FTE)
- Document timeline in incident log

**Red Incident:**

- All Yellow authority PLUS:
- Declare Red severity (notify CTO + team)
- Hot-fix deployment (skip normal PR review)
- Database recovery from backup (if <1h old)
- Function redeployment with canary (10% users first)
- Disable non-critical features (e.g., analytics polling to reduce load)
- Override normal SLA commitments (skip E2E tests if needed for restore)
- Activate Red runbook
- Contact Backup IC / escalate to CTO if stuck ≥30min

**Black Incident:**

- All Red authority PLUS:
- Declare Black severity (notify all stakeholders)
- Execute full system restore (from clean backup)
- Declare SLA breach to customers (subject to CTO confirmation)

### IC CANNOT (requires CTO approval):

- Contact customers / external parties directly (CTO decides messaging)
- Contact auditor / regulatory authority (Legal + CTO decision)
- Delete customer data (even if corrupted; only soft-delete flagging)
- Disable authentication / security rules
- Accept permanent data loss (must attempt restore even if lengthy)
- Deploy code not in git history (no secrets in command line)
- Override Firestore Rules security (escalate to CTO + security review)

---

## Decision Criteria by Incident Type

### Yellow: "Should We Escalate to Red?"

**Escalate if:**

- Problem not localized (affects >10% of users)
- Workaround insufficient
- Time to resolution >30 min
- Unknown root cause

**Remain Yellow if:**

- Isolated issue (affects <5 users)
- Workaround available
- Time to resolution <15 min
- Root cause identified

### Red: "Should We Escalate to Black?"

**Escalate if:**

- Data loss confirmed
- Corruption detected
- Unable to restore
- Patient safety at risk (>30 min)

**Remain Red if:**

- Degradation only (slow, data intact)
- Partial outage (10–50% affected)
- Restore in progress (ETA <30 min)

---

## Communication Authority

### Who Decides What We Tell Customers?

**Yellow/Red:**

- **IC decides internal (team) communication** — Slack #incidents updates every 30 min
- **CTO decides customer communication** — IF and WHEN to notify
- **Legal decides regulatory communication** — IF compliance breach suspected

**Black:**

- **CTO decides immediate customer notification** (usually yes, within 1h)
- **Legal handles regulatory notification** (within 24h if required)
- **IC documents timeline for post-mortem**

---

## Examples of IC Decisions

### Example 1: Yellow → Red Escalation

```
T+0: Alert: Firestore writes latency >5s
T+5min: IC investigates, finds 1 function timing out
T+10min: Restarts function, writes still slow
T+12min: Checks Rules - 500k docs being scanned per write
T+15min: IC escalates to Red, notifies CTO
T+20min: CTO OKs temporary Rules change
T+25min: IC deploys Rules + new index
T+30min: Incident resolved
```

### Example 2: Red → Rollback Decision

```
T+0: Deploy Phase 4 laudo release feature
T+5min: Alert: laudo release calls failing (403)
T+10min: IC identifies: Routes changed, Rules don't match
T+15min: IC decision: Rollback latest Rules
T+20min: Rollback executed, feature works
```

---

## Post-Incident Review

After incident resolves:

- IC leads post-mortem (blameless, within 24h)
- IC documents decision timeline
- IC identifies improvements
- CTO approves findings

No blame — focus on process and tooling improvements.
