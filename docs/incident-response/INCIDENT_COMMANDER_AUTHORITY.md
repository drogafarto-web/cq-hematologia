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
- Hot-fix deployment (skip normal PR review, go straight to deploy)
- Database recovery from backup (if <1h old)
- Function redeployment with canary (10% users first)
- Disable non-critical features (e.g., analytics polling to reduce load)
- Override normal SLA commitments (e.g., skip E2E tests if needed for restore)
- Activate Red runbook (e.g., "restore from backup")
- Contact Backup IC / escalate to CTO if stuck ≥30min

**Black Incident:**
- All Red authority PLUS:
- Declare Black severity (notify all stakeholders)
- Execute full system restore (from clean backup)
- Declare SLA breach to customers (subject to CTO confirmation)
- Authorize external communication prep (CTO writes message)

### IC CANNOT (requires CTO approval):

- Contact customers / external parties directly (CTO decides messaging)
- Contact auditor / regulatory authority (Legal + CTO decision)
- Delete customer data (even if corrupted; only soft-delete flagging)
- Disable authentication / security rules (even if causing slow recovery)
- Accept permanent data loss (must attempt restore even if lengthy)
- Deploy code not in git history (no secrets in command line)
- Override Firestore Rules security (escalate to CTO + security review)

---

## Decision Criteria by Incident Type

### Yellow: "Should We Escalate to Red?"

**Escalate if:**
- Problem not localized (affects >10% of users)
- Workaround insufficient (users blocked completely)
- Time to resolution >30 min (trending toward SLA breach)
- Unknown root cause (needs deeper investigation)

**Remain Yellow if:**
- Isolated issue (affects <5 users or 1 feature)
- Workaround available (users can proceed)
- Time to resolution <15 min (under control)
- Root cause identified, fix in progress

### Red: "Should We Escalate to Black?"

**Escalate if:**
- Data loss confirmed (query shows missing records)
- Corruption detected (audit chain broken, hashes don't match)
- Unable to restore (all backups failed, need forensic recovery)
- Patient safety at risk (clinical result system down >30 min)

**Remain Red if:**
- Degradation only (slow, but data intact)
- Partial outage (10-50% users affected)
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
- **Legal handles regulatory notification** (ANVISA, auditor, within 24h if required)
- **IC documents timeline for post-mortem**

### Message Authority Chain

```
Incident declared → IC reports to CTO + Team
→ CTO assesses customer impact
  → If affecting <1% users OR isolated feature: no customer message
  → If affecting >1% users OR >30min outage: customer message required
→ CTO + Legal draft message (20 min)
→ CTO approves + sends (via status.company email list)
→ IC logs in incident record
```

---

## Examples of IC Decisions

### Example 1: Yellow → Red Escalation (Real)
```
T+0: Alert fires "Firestore writes latency >5s"
T+2min: IC investigates, finds 1 function timing out
T+5min: IC restarts function, writes still slow
T+10min: IC checks Rules - 500k docs being scanned per write (unexpected load)
T+12min: IC asks "Is this user-facing?" — checks query logs — YES, affects 5 users creating laudo
T+15min: IC escalates to Red, notifies CTO
T+20min: CTO OKs temporary Rules change (add index)
T+25min: IC deploys Rules + new index, performance recovers
T+30min: Incident resolved, post-mortem scheduled

**IC Authority Used:** Escalation decision, approval for Rules deploy (CTO gave it)
```

### Example 2: Red → Rollback Decision (Real)
```
T+0: Deploy Phase 4 laudo release feature
T+5min: Alert fires "laudo release calls failing (403)"
T+10min: IC checks: Cloud Function newly deployed, but Routes changed
T+12min: IC identifies: new Rules block laudo-release because permission check changed
T+15min: IC decision: "Rollback latest Rules + re-push with test"
T+20min: Rollback executed, feature works
T+25min: Incident resolved

**IC Authority Used:** Hot-fix authority (skip normal PR review, go straight to deploy)
**CTO Approval:** Not needed (IC can rollback within 15 min of deploy)
```

### Example 3: Black → Data Loss (Real)
```
T+0: Database replication failure, Firestore data inaccessible
T+2min: IC checks: primary region down, replica lag >1h
T+5min: IC CAN restore from 24h-old backup (loses 1h recent data)
T+8min: IC CANNOT decide to delete recent data — must attempt restore
T+15min: IC escalates to CTO: "Data loss confirmed, customer notification needed"
T+20min: CTO + Legal prepare message: "We experienced service interruption 1-2 hours ago..."
T+30min: Restore begins from backup (may take 1-2h)

**IC Authority Used:** Escalation decision
**CTO Authority Used:** Communication approval, data loss acceptance
```

---

## Incident Command System (ICS)

IC follows simplified ICS structure for clarity:

- **IC (Incident Commander):** Strategy + authority
- **Ops Lead:** Infrastructure (database, functions, monitoring)
- **Dev Lead:** Code (debug, deploy, revert)
- **Comms Lead:** Messaging (status updates, customer comms — CTO approval)

Each lead reports to IC. IC reports to CTO. CTO final authority.

---

## Post-Incident Review

After incident resolves:
- IC leads post-mortem (blameless, within 24h)
- IC documents decision timeline
- IC identifies IC improvements (e.g., "needed access X earlier")
- CTO approves findings
- Action items tracked in Slack #incidents-followup

No "blame" — focus on process and tooling improvements.
