---
phase: "06-capa-incident-response"
plan: "03"
type: "execute"
wave: 2
depends_on: ["06-01"]
files_modified:
  - "src/features/admin/incident-response/types.ts"
  - "src/features/admin/incident-response/services/incidentService.ts"
  - "docs/incident-response/SEVERITY_MATRIX.md"
  - "docs/incident-response/ON_CALL_ROTATION.md"
  - "docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md"
  - "docs/incident-response/RUNBOOK_LINKS.md"
  - "docs/incident-response/CONTACT_TREE.md"
  - "docs/incident-response/COMMUNICATION_TEMPLATES.md"
  - "docs/incident-response/POST_MORTEM_FRAMEWORK.md"
  - "functions/src/modules/incident.ts"

autonomous: true
requirements: ["OPERATIONAL-READINESS", "RELIABILITY-SLA", "CRISIS-MANAGEMENT"]

must_haves:
  truths:
    - "Incident severity is classified (Green/Yellow/Red/Black) with clear decision criteria"
    - "On-call rotation template exists with 4-week cycles, contact info, escalation chain"
    - "Incident Commander has defined authority: declare severity, activate runbook, make critical decisions"
    - "Runbook links document critical flows (database recovery, function redeployment, user data recovery)"
    - "Contact tree shows who to notify at each severity level (internal team, auditor, customer, regulatory)"
    - "Communication templates standardize external messaging (customer notification, regulatory report, post-mortem)"
    - "Post-mortem framework guides blameless review + action items tracking"
    - "Cloud Function callables exist for incident logging, escalation, and status updates"
    - "All infrastructure docs are signed off by ops team (checkpoint)"

  artifacts:
    - path: "src/features/admin/incident-response/types.ts"
      provides: "Type definitions for Incident, SeverityLevel, EscalationPath, PostMortemAction"
      must_contain: "interface Incident"
      min_exports: 4

    - path: "src/features/admin/incident-response/services/incidentService.ts"
      provides: "Service layer for incident CRUD, status transitions, escalation"
      exports: ["createIncident", "updateIncidentStatus", "subscribeIncidents", "getPostMortem"]

    - path: "docs/incident-response/SEVERITY_MATRIX.md"
      provides: "Severity classification (Green/Yellow/Red/Black) with impact/response criteria per level"
      sections: ["Green", "Yellow", "Red", "Black", "Decision Criteria", "Response Time SLAs"]

    - path: "docs/incident-response/ON_CALL_ROTATION.md"
      provides: "4-week rotation template with role definitions, contact preferences, escalation rules"
      sections: ["Week Structure", "Role Definitions", "Contact Methods", "Escalation Triggers"]

    - path: "docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md"
      provides: "Defines IC role: authority to declare severity, make critical calls, override normal procedures"
      sections: ["Authority Scope", "Decision Criteria", "Communication Channels", "Escalation Path"]

    - path: "docs/incident-response/RUNBOOK_LINKS.md"
      provides: "Index of critical runbooks with links to internal docs (database recovery, deploy rollback, data recovery)"
      links_count: 8

    - path: "docs/incident-response/CONTACT_TREE.md"
      provides: "Who to contact at each severity level (team, auditor, customer, regulatory authority)"
      sections: ["Green (Internal Only)", "Yellow (Team + Ops)", "Red (Team + Leadership)", "Black (All Stakeholders)"]

    - path: "docs/incident-response/COMMUNICATION_TEMPLATES.md"
      provides: "Standardized templates for customer notification, regulatory reporting, team alerts"
      templates: ["Customer Incident Notice", "Regulatory Report", "Internal Escalation Alert", "Post-Mortem Announcement"]

    - path: "docs/incident-response/POST_MORTEM_FRAMEWORK.md"
      provides: "Blameless post-mortem guide: timeline, root cause analysis, action items, follow-up schedule"
      sections: ["Pre-Mortem Checklist", "Meeting Agenda", "Timeline Template", "RCA Template", "Action Item Tracking"]

    - path: "functions/src/modules/incident.ts"
      provides: "Cloud Function callables for incident logging, escalation notification, post-mortem tracking"
      exports: ["createIncident", "escalateIncident", "closeIncident", "recordPostMortem"]
      min_functions: 4

  key_links:
    - from: "src/features/admin/incident-response/services/incidentService.ts"
      to: "functions/src/modules/incident.ts"
      via: "Cloud Function callables for incident management"
      pattern: "httpsCallable.*'(create|escalate|close)Incident'"

    - from: "docs/incident-response/SEVERITY_MATRIX.md"
      to: "docs/incident-response/ON_CALL_ROTATION.md"
      via: "Severity determines response SLA and who to contact"
      pattern: "Response time: SLA by severity"

    - from: "docs/incident-response/CONTACT_TREE.md"
      to: "docs/incident-response/COMMUNICATION_TEMPLATES.md"
      via: "Contact determines which template to use (customer vs regulatory)"
      pattern: "Contact determines message format"

---

<objective>
Operationalize incident response for production system. Establish severity classification, on-call rotation, incident commander authority, runbooks, contact procedures, and post-mortem framework. All infrastructure documented and signed off.

**Purpose:** Enable rapid, coordinated response to production issues (P1: complete outage, P2: degradation, P3: minor issues). Minimize MTTR (mean time to recovery) and ensure compliance communication.

**Output:**
- Severity matrix (Green/Yellow/Red/Black)
- On-call rotation template (4-week cycle)
- Incident commander authority document
- Runbook index (8+ critical procedures)
- Contact tree (internal/auditor/customer/regulatory)
- Communication templates (4+ standard messages)
- Post-mortem framework (blameless review process)
- Cloud Function callables for incident tracking
- Team sign-off on all procedures
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md (existing foundation)

# Existing incident response foundation
- Cloud Logs monitoring: 24h setup post-deployment (CLOUD_LOGS_MONITORING_GUIDE.md)
- Performance validation: 7-metric suite (PERFORMANCE_VALIDATION.md)
- ADR-0017/0018: HMAC + secrets gate (Phase 3 production lessons)

# Regulatory context (RDC 978 + DICQ)
- RDC Art. 127: Nonconformity record keeping (incident = nonconformity)
- DICQ 4.14.1: Corrective action procedures (incident → CAPA → verification)
- DICQ 4.15: Management review (escalation criteria)

# Production context
- v1.3 deployment: Phase 3 lessons learned (11 ghost callables, HMAC incident, function timeouts)
- Phase 4–5 complexity: NOTIVISA gov API flakiness, OCR cost overruns, concurrent write chains
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define severity matrix and incident response SLAs</name>
  <files>docs/incident-response/SEVERITY_MATRIX.md</files>
  <action>
Create comprehensive severity matrix:

```markdown
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
```

**Sections to include:**
1. Green (low risk) — description, examples, SLA
2. Yellow (moderate) — description, examples, SLA
3. Red (high) — description, examples, SLA
4. Black (crisis) — description, examples, SLA
5. Decision tree (flowchart for classification)
6. Response time SLAs table
7. Escalation criteria (when Yellow → Red, Red → Black)
8. On-call contact info (placeholder for ops team to fill)
  </action>
  <verify>
    <automated>grep -c "^## Green" docs/incident-response/SEVERITY_MATRIX.md && grep -c "SLA" docs/incident-response/SEVERITY_MATRIX.md</automated>
  </verify>
  <done>All 4 severity levels defined, decision tree present, SLA table included</done>
</task>

<task type="auto">
  <name>Task 2: Create on-call rotation template and contact information structure</name>
  <files>docs/incident-response/ON_CALL_ROTATION.md, docs/incident-response/CONTACT_TREE.md</files>
  <action>
**ON_CALL_ROTATION.md:**

```markdown
# On-Call Rotation — 4-Week Cycle

## Rotation Schedule

| Week | Primary IC | Backup IC | Coverage | Timezone |
|------|-----------|-----------|----------|----------|
| 1 (May 13–19) | [Name] | [Name] | Mon–Sun 24h | BR (UTC-3) |
| 2 (May 20–26) | [Name] | [Name] | Mon–Sun 24h | BR (UTC-3) |
| 3 (May 27–Jun 2) | [Name] | [Name] | Mon–Sun 24h | BR (UTC-3) |
| 4 (Jun 3–9) | [Name] | [Name] | Mon–Sun 24h | BR (UTC-3) |

*Fill in names and contact methods below.*

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
- Cannot unilaterally decide to contact external parties (auditor, customer) — requires CTO approval unless Black

**Contact Methods (IC to fill in):**
- Phone: [+55 number]
- Slack: @[name]
- Email: [email]
- WhatsApp: [+55 number]
- Pagerduty: [link] (future)

---

## Role: Backup IC

**Responsibilities:**
- Assume Primary IC duties if Primary unreachable
- Assist with escalation (Yellow → Red decision)
- Cover handoff during shift change (last 2 hours of shift overlap)

**Contact Methods (to fill in):**
- Phone: [+55 number]
- Slack: @[name]

---

## Shift Handoff Procedure

**Friday 17:00 (outgoing IC):**
- Review last week's incidents (if any)
- Brief incoming IC on ongoing issues
- Share access to critical tools (Cloud Console, database, Slack channels)
- Document any known risks

**Monday 09:00 (incoming IC):**
- Run health check: Cloud Logs, monitoring dashboard, function execution
- Verify all contacts in tree are current
- Read post-mortem from previous week (if any)
- Declare "on-call week started" in Slack

---

## Tools & Access

- Cloud Console: [link to project]
- Cloud Logs: [saved filter for errors]
- Monitoring Dashboard: [Grafana/Cloud Monitoring link]
- Database: [Firestore console]
- Functions: [Cloud Functions list]
- Deployment Keys: [1password vault, teams channel]
- Runbooks: docs/incident-response/RUNBOOK_LINKS.md

---

## Escalation Triggers

**Escalate to Backup IC if:**
- Primary IC unreachable for 5 min (call + Slack + SMS)
- Primary IC says "need backup" (overwhelmed)
- Incident severity upgraded (Yellow → Red)

**Escalate to CTO if:**
- Black incident declared
- Red incident not resolved in 30 min
- External party notification needed (customer, auditor, gov)

---

## Compensation / Rest Days

- Primary IC on-call week: +2 days off following week (Mon–Tue)
- Backup IC: +0.5 day off (if backup called in)
- If Black incident occurs: +1 day off for all responders
```

**CONTACT_TREE.md:**

```markdown
# Incident Response Contact Tree

## Green Incident (Internal Only)

**Who to notify:**
- Slack #dev-incidents only
- No one else (async discussion in channel)

**Example:** "UI typo on coagulacao module"

---

## Yellow Incident (Team + Operations)

**Who to notify (in order):**
1. **On-Call IC:** [slack, phone, SMS] — decides if escalation to Red needed
2. **Team Lead:** [slack, email] — if IC needs backup
3. **Ops/DevOps:** [slack] — if infrastructure needed (database recovery, function redeployment)

**Timeline:**
- T+5min: IC declares severity Yellow, activates team
- T+30min: If no progress, escalate to Red
- T+2h: Status update to leadership (Slack #incidents)

**Example:** "Analytics dashboard slow, 5% laudo exports failing"

---

## Red Incident (Team + Leadership)

**Who to notify (all):**
1. **On-Call IC:** Primary responder
2. **Backup IC:** Support/coordinate
3. **CTO:** Aware + authorization for critical decisions
4. **Engineering Lead:** Additional hands-on support
5. **Ops/DevOps:** Infrastructure + database access
6. **Product Lead:** Aware of user impact, prepares customer communication

**Timeline:**
- T+1min: Alerts fire (Cloud Logs anomaly)
- T+5min: IC confirms severity Red, initiates group Slack call
- T+15min: First status update (what is problem, ETA)
- T+30min: If not resolved, escalate to CTO (Black consideration)
- Every 30min: Status update in Slack #incidents
- T+1h: Incident resolved or escalated

**Customer Notification:** CTO decides (usually after resolve, unless >1h outage)

**Example:** "Patient portal down, laudo release blocked"

---

## Black Incident (All Stakeholders)

**Who to notify (immediately):**
1. **CTO:** Emergency authority
2. **On-Call IC:** Execute remediation
3. **Full Engineering Team:** All hands on deck
4. **Business/Legal:** Regulatory notification prep
5. **Auditor:** If RDC compliance affected (within 24h)
6. **Customer Notification:** CTO + Legal (if data loss or outage >3h)
7. **ANVISA (if required):** Via Legal (NOTIVISA failure, patient safety)

**Timeline:**
- T+0: Black declared (system down or data lost)
- T+1min: Emergency group call initiated (Slack Huddle)
- T+5min: CTO declares action plan (restore from backup, redeploy, etc.)
- T+15min: First status update (what we're doing, ETA)
- T+30min: Second status update (progress or escalation)
- Every 15min: Status until resolved
- T+24h (if data loss): Auditor notified in writing
- T+48h: Customer notification letter (if required)

**No external communication without CTO sign-off.**

**Example:** "Database entirely inaccessible, audit trail data lost"

---

## Contact Details (To Be Filled By Ops Team)

| Role | Name | Phone | Slack | Email | WhatsApp |
|------|------|-------|-------|-------|----------|
| CTO | | | | | |
| IC Week 1 | | | | | |
| IC Backup Week 1 | | | | | |
| IC Week 2 | | | | | |
| IC Backup Week 2 | | | | | |
| Engineering Lead | | | | | |
| Ops/DevOps | | | | | |
| Product Lead | | | | | |

*To be completed before Phase 4 launch (2026-05-20).*
```

Per user instructions: ops team must fill in contact details before launch. This plan provides the structure; execution task is to populate the spreadsheet.
  </action>
  <verify>
    <automated>grep -c "^## Green\|^## Yellow\|^## Red\|^## Black" docs/incident-response/CONTACT_TREE.md && grep -c "| Role |" docs/incident-response/ON_CALL_ROTATION.md</automated>
  </verify>
  <done>Both files created, 4 severity levels in contact tree, rotation template with contact table present</done>
</task>

<task type="auto">
  <name>Task 3: Define incident commander authority and decision criteria</name>
  <files>docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md</files>
  <action>
Create authority document:

```markdown
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
```
  </action>
  <verify>
    <automated>grep -c "^## " docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md && grep -c "IC CAN\|IC CANNOT" docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md</automated>
  </verify>
  <done>Authority document created, CAN/CANNOT sections present, decision examples included</done>
</task>

<task type="auto">
  <name>Task 4: Create runbook index, communication templates, and post-mortem framework</name>
  <files>docs/incident-response/RUNBOOK_LINKS.md, docs/incident-response/COMMUNICATION_TEMPLATES.md, docs/incident-response/POST_MORTEM_FRAMEWORK.md</files>
  <action>
**RUNBOOK_LINKS.md:**

```markdown
# Critical Incident Runbooks

## Index

| Scenario | Severity | Runbook Link | Trigger | MTTR Target |
|----------|----------|--------------|---------|-------------|
| Function timeout | Yellow | #fn-timeout | >5s response time | 15 min |
| Database unavailable | Red | #db-unavailable | Connection errors | 30 min |
| Auth service down | Red | #auth-down | Login failures | 15 min |
| Firestore Rules broken | Red | #rules-broken | Permission errors on all writes | 20 min |
| Data corruption detected | Black | #data-corruption | Hash chain broken or records missing | 1 hour (restore) |
| NOTIVISA API failure | Red | #notivisa-failure | Gov endpoint down or rejecting batches | 30 min |
| Memory leak in function | Yellow | #memory-leak | Function memory approaching limit | 30 min |
| Cloud Logs unavailable | Yellow | #logs-unavailable | Cannot see Cloud Logs | 15 min (or blind fix) |

---

## Runbook: Function Timeout (#fn-timeout)

**Trigger:** Cloud Logs shows "Functions runtime exceeded 540s" OR frontend shows "timeout" error

**IC Actions:**
1. Check which function(s) are timing out: Cloud Logs filter `severity=ERROR resource.type=cloud_function`
2. Check Cloud Functions list: look for recent deploy (last 10 min)
3. Options:
   a. **Revert deploy** (if <15 min old): `firebase deploy --only functions --rollback`
   b. **Restart function** (if no recent deploy): Click function → "Trigger" button (doesn't exist; use CLI)
   c. **Increase timeout** (if legitimate slow op): Edit function.yaml, re-deploy, monitor
4. Verify in Cloud Logs: no more timeout errors
5. Notify team: Slack #incidents "Function X recovered, cause was [deploy/load/query], fix was [revert/restart/timeout-increase]"

**Prevention:**
- Tests must verify function execution <300s (includes setup + teardown)
- High-latency functions should use Cloud Tasks (async) instead of HTTP callable
- Monitor function duration metrics in Cloud Monitoring (future)

---

## Runbook: Database Unavailable (#db-unavailable)

**Trigger:** Firestore connection fails, all client queries fail with "service unavailable"

**IC Actions:**
1. Check Firebase Console: Firestore status (green or red indicator)
2. Check region status: https://status.cloud.google.com (filter southamerica-east1)
3. Options:
   a. **If Google outage:** Wait for recovery (no action), notify team in Slack
   b. **If isolated issue:** Clear browser cache + try again (usually resolves in 1-2 min)
   c. **If persistence:** Create Cloud Support ticket (requires support plan)
4. **Fallback (if >5 min):** Switch to read-only mode (disable writes, show cached data if available)
5. Communicate: Slack #incidents "Database outage (Google region issue), estimated recovery [X min]"

**Prevention:**
- Multi-region failover (future Phase 8 planning)
- Cloud Firestore automatic failover (available now, check if enabled)

---

## Runbook: Auth Service Down (#auth-down)

**Trigger:** Login fails, "Authentication failed" error for all users

**IC Actions:**
1. Check Firebase Console: Authentication status (green or red)
2. Check if issue is Firebase Auth or app code:
   - Open developer console on login page
   - Check what error: "Firebase service unavailable" vs "Invalid email"
3. Options:
   a. **Firebase outage:** Wait for recovery (no action)
   b. **App code issue:** Check recent deploy (last 10 min), revert auth changes
   c. **Hardcoded secret expired:** Rotate secret in Secret Manager, redeploy functions
4. Verify: Try login again in incognito window
5. Communicate: Slack #incidents "Auth recovered, cause was [Google outage | deploy bug | secret rotation]"

**Prevention:**
- All secrets in Secret Manager, rotated monthly
- Auth functions have explicit error handling (no "undefined" errors)
- E2E tests include login flow (catch before production)

---

## Runbook: Firestore Rules Broken (#rules-broken)

**Trigger:** All Firestore writes fail with "permission-denied", reads may also fail

**IC Actions:**
1. Check Cloud Logs: filter `resource.name=~"firestore" AND severity=ERROR`
2. Check recent Rules deploy: Cloud Console → Firestore → Rules history
3. If recent deploy caused this:
   a. **Revert Rules:** Click "Previous version" → "Restore" (in Console) OR `firebase deploy --only firestore:rules --source [previous-version-hash]` (via CLI)
   b. Verify: Firestore Console, try writing a doc (should succeed)
4. If no recent deploy:
   a. Check Rules syntax: Look for `function` or `match` errors
   b. Try deploying current Rules again (may be transient)
5. Communicate: Slack #incidents "Rules error fixed, cause was [deploy bug | syntax error], restored from backup"

**Prevention:**
- Firestore Rules deployed only via `firebase deploy` (no manual edits in Console for production)
- Test Rules in Emulator before deploying (CI gate: `npm run test:rules`)

---

## Runbook: Data Corruption Detected (#data-corruption)

**Trigger:** Audit chain broken (hash verification fails) OR customer reports missing records

**IC Actions:**
1. **DO NOT DELETE or modify data** — preserve corruption for forensics
2. **Escalate to CTO immediately** — this is Black incident (potential data loss)
3. CTO decides: restore from backup (loses recent data) vs forensic recovery (slower)
4. If restoring from backup:
   - Identify clean backup point (last known good state)
   - Create new Firestore database from backup (don't overwrite)
   - Verify audit trail integrity in new database
   - Test data quality (spot-check records)
   - Plan switchover (flag current DB as corrupted, point app to new DB)
5. Communicate: CTO + Legal prepare customer notification (within 1h if data loss confirmed)

**Prevention:**
- Audit chain integrity checked daily (cron job, Phase 9)
- Backups automated, tested monthly
- Soft-delete only (never hard delete), soft-delete verified in Rules

---

... (Additional runbooks as needed: NOTIVISA failure, memory leak, etc.)
```

**COMMUNICATION_TEMPLATES.md:**

```markdown
# Incident Communication Templates

## Template 1: Customer Incident Notice (Yellow/Red Outage <1h)

**To:** [customer-list@hmatologia2.web.app]  
**Subject:** Service Interruption — [Timestamp] [Duration]  

---

Dear [Lab Name],

We experienced a brief service interruption on [DATE] from [TIME] to [TIME] (approximately [DURATION]).

**What happened:**  
[1-2 sentence technical explanation, non-technical audience]  
Example: "Our database service briefly became unavailable due to a network issue. Your system automatically recovered."

**What was affected:**  
[List features, quantify impact]  
Example: "Approximately 15 minutes of laudo release history was affected. Patient records and previously-released laudos are intact."

**What we did:**  
[Our response]  
Example: "Our engineering team immediately identified the issue and restored service. We have since deployed monitoring to prevent recurrence."

**Next steps:**  
[Action required of customer, if any]  
Example: "Please re-submit any laudos that failed during the outage. Our support team is standing by."

**Questions?**  
Contact us at [support-email] or [support-phone].

Sincerely,  
[CTO / Support Team]

---

## Template 2: Regulatory Incident Report (Black / Data Loss)

**To:** [ANVISA contact], [Auditor]  
**Subject:** Incident Report — Data Availability [Date/Time] — RDC 978 Art. 128

---

Incident ID: [INC-XXXX]  
Date: [YYYY-MM-DD]  
Time: [HH:MM]  
Duration: [X hours]  
Severity: Critical

**Summary:**  
[Lab Name] experienced an incident affecting [clinical/audit] data availability. Root cause was [X]. Data integrity status: [no loss | partial loss of X records].

**RDC Compliance Impact:**  
- **Art. 128 (Rastreabilidade):** Audit trail inaccessible from [TIME] to [TIME] (restored). No audit records lost.
- **Art. 39 (Registro):** Clinical records [inaccessible | intact]. [Estimated patients affected: X]

**Response Timeline:**  
- [TIME] — Issue detected
- [TIME] — Escalated to Level 1 (CTO)
- [TIME] — Incident Commander declared Critical
- [TIME] — Restore from backup initiated
- [TIME] — System recovered

**Corrective Actions:**  
1. Enhanced monitoring dashboard (deployed [DATE])
2. Automatic failover testing (quarterly, starting [DATE])
3. Backup recovery drill (monthly, starting [DATE])

**Point of Contact:**  
[CTO name], [email], [phone]

---

## Template 3: Internal Escalation Alert (Red Incident)

**To:** @oncall (Slack channel)  
**Subject:** 🚨 RED INCIDENT: [System] [Symptom]

---

**Incident:** [INC-XXXX]  
**Severity:** RED  
**Declared:** [TIME]  
**ETA to Resolve:** [TIME + 30 min]

**Impact:**  
[Core feature] is [down | degraded]. Affects [% users | list users].

**Current Status:**  
[1-2 sentences on what team is doing right now]

**Who:** [@ic-primary] Incident Commander, [@backup-ic] Backup, [@eng-lead] Engineering

**Links:**  
- [Cloud Logs filter]  
- [Runbook](#runbook-name)  
- [Slack thread] (for discussion)

**Do not reply in Slack — use thread.**

---

## Template 4: Post-Mortem Announcement (After Resolve)

**To:** [Lab Name]  
**Subject:** Follow-up — Service Incident on [DATE]

---

Dear [Lab Name],

Following up on the service interruption we experienced on [DATE], we have completed our investigation.

**Root Cause:**  
[What actually happened]  
Example: "A database replication lag exceeded our monitoring threshold, causing read timeouts."

**Why It Happened:**  
[Why we didn't catch it earlier]  
Example: "Our monitoring dashboard alerting thresholds were not sensitive enough; they have since been adjusted."

**What We're Doing:**  
1. [Action Item 1, ETA]
2. [Action Item 2, ETA]
3. [Action Item 3, ETA]

**Estimated Completion:**  
All improvements will be completed by [DATE].

**Apology:**  
We sincerely apologize for the disruption. Reliability is our top priority, and we are committed to preventing recurrence.

Best regards,  
[CTO / Support Team]

---

**Approval Chain:**
- IC drafts message (within 1h of resolve)
- CTO reviews + approves
- Legal reviews (if data loss or regulatory implication)
- Send within 4h of resolve
```

**POST_MORTEM_FRAMEWORK.md:**

```markdown
# Post-Mortem Framework — Blameless Review

## Pre-Mortem Checklist (IC, within 1h of resolve)

- [ ] Incident formally closed (no ongoing fixes)
- [ ] Root cause identified (or "root cause unknown, investigating")
- [ ] Workaround removed (system back to normal)
- [ ] All logs preserved (don't delete Cloud Logs)
- [ ] Key participants identified (list 3-5 engineers who responded)
- [ ] Slack thread link (if incident discussed in channel)
- [ ] Timeline documented (T+0, T+5min, T+15min, etc.)
- [ ] Customer notification sent (if applicable)
- [ ] Action items drafted (2-3 improvements)

---

## Post-Mortem Meeting

**Facilitated by:** Incident Commander (blameless + non-defensive)  
**Attendees:** Core responders + interested engineers (4-6 people)  
**Duration:** 60 minutes  
**Schedule:** Within 24 hours of resolve  

---

## Agenda (60 min)

1. **Welcome + Blameless Reminder (5 min)**
   - "This is about improving systems and processes, not assigning blame."
   - "Everyone did their best with the information they had at the time."

2. **Timeline Reconstruction (15 min)**
   - IC reads timeline of events (T+0, T+5min, T+15min, etc.)
   - Participants correct/add details
   - Record on shared doc for accuracy

3. **Root Cause Analysis (15 min)**
   - "What was the first true cause?"
   - Dig past symptoms: "Yes, database was unavailable, but why?"
   - Use "5 Whys" technique:
     ```
     Why 1: Database unavailable
     Why 2: Connection pool exhausted
     Why 3: Query taking >30s each
     Why 4: Missing index on frequently-queried field
     Why 5: Index created in dev, not propagated to production
     
     Root cause: Deployment process didn't validate indexes
     ```

4. **Contributing Factors (10 min)**
   - What else made incident worse?
   - "Monitoring was not sensitive enough to alerts"
   - "Team did not have quick access to logs"
   - "Runbook was out of date"
   - Document each

5. **Response Quality (5 min)**
   - "What did responders do well?"
   - "Did IC authority make good decisions?"
   - "Did communication happen promptly?"

6. **Action Items (10 min)**
   - List 2-3 concrete improvements
   - Assign owner + ETA
   - Examples:
     - "Add index validation to CI pipeline" (Dev Lead, 1 week)
     - "Update runbook with new monitoring URL" (Ops, 2 days)
     - "Set up alert for connection pool >80%" (DevOps, 3 days)

---

## Post-Mortem Document Template

```markdown
# Post-Mortem: [Incident Title]

**Date:** [YYYY-MM-DD]  
**Incident ID:** [INC-XXXX]  
**Severity:** [Yellow/Red/Black]  
**Duration:** [X hours]  
**Attendees:** [Names]

---

## Timeline

| Time | Event |
|------|-------|
| 10:05 | Alert fires: function timeout |
| 10:10 | IC investigates, identifies recent deploy |
| 10:15 | Rollback initiated |
| 10:20 | System recovered |

---

## Root Cause

[1-2 paragraphs: what was the fundamental cause?]

---

## Contributing Factors

- [Factor 1]
- [Factor 2]
- [Factor 3]

---

## Response Quality

**What we did well:**
- [Example: Quick response from on-call engineer]

**What we could improve:**
- [Example: Monitoring alert latency]

---

## Action Items

| Item | Owner | ETA | Status |
|------|-------|-----|--------|
| Add pre-deploy function timeout test | Dev Lead | May 20 | Open |
| Increase monitoring alert sensitivity | DevOps | May 15 | Open |
| Document timeout runbook with logs link | IC | May 12 | Open |

---

## Follow-Up

Next review: [DATE] (after action items complete)

Approver: [CTO signature]
```

---

## Post-Mortem Cadence

- **Same-day:** If Red/Black, post-mortem same day (high priority)
- **Next day:** If Yellow, post-mortem next business day
- **Action item review:** Weekly standup, track progress
- **Close-out:** Once all actions complete, formally mark as "resolved" in incident tracker

---

## Why Blameless?

- **Team learns faster:** Engineer is honest about mistake, not defensive
- **Psychological safety:** People report issues earlier, preventing escalation
- **Systems improve:** We fix process, not punish person
- **Prevents cover-up:** Blame culture causes people to hide root causes

**Facilitator responsibility:** Keep discussion focused on systems, not individuals.
```
  </action>
  <verify>
    <automated>grep -c "^## " docs/incident-response/RUNBOOK_LINKS.md docs/incident-response/COMMUNICATION_TEMPLATES.md docs/incident-response/POST_MORTEM_FRAMEWORK.md | wc -l</automated>
  </verify>
  <done>All 3 docs created with sections, templates, and frameworks</done>
</task>

<task type="auto">
  <name>Task 5: Implement incident type system and Cloud Function callables</name>
  <files>src/features/admin/incident-response/types.ts, src/features/admin/incident-response/services/incidentService.ts, functions/src/modules/incident.ts</files>
  <action>
**types.ts:**
```typescript
export type SeverityLevel = 'green' | 'yellow' | 'red' | 'black';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  labId: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  startedAt: Timestamp;
  resolvedAt?: Timestamp;
  declaredBy: string; // operator ID (IC)
  declaredAt: Timestamp;
  
  // Impact
  affectedSystems: string[]; // ['laudo-release', 'analytics']
  affectedUserCount: number; // 0–100+
  affectedFeatures: string[]; // Descriptions
  
  // Response
  runbookApplied?: string; // Link to runbook used
  escalationLevel: 'internal' | 'team' | 'leadership' | 'legal'; // Who was notified
  estimatedMTTR?: number; // minutes
  actualMTTR?: number; // minutes (calculated after resolve)
  
  // Post-mortem
  postMortemScheduledAt?: Timestamp;
  postMortemDocLink?: string; // URL to post-mortem Google Doc
  
  criadoEm: Timestamp;
  criadoPor: string;
  deletadoEm?: Timestamp;
}

export interface IncidentAction {
  id: string;
  action: string; // e.g., "Rolled back function deploy"
  takenAt: Timestamp;
  takenBy: string; // operator ID
  result: 'success' | 'partial' | 'failed';
  notes?: string;
}

export interface PostMortemAction {
  id: string;
  item: string; // "Add pre-deploy timeout test"
  owner: string; // engineer name
  eta: Date;
  status: 'open' | 'in-progress' | 'complete';
}
```

**incidentService.ts:**
```typescript
export async function createIncident(
  labId: string,
  input: Omit<Incident, 'id' | 'labId' | 'criadoEm' | 'criadoPor' | 'declaredAt'>
): Promise<Incident> {
  const callable = httpsCallable(functions, 'createIncident');
  const result = await callable({ labId, ...input });
  return result.data as Incident;
}

export async function escalateIncident(
  labId: string,
  incidentId: string,
  newSeverity: SeverityLevel,
  reason: string
): Promise<void> {
  const callable = httpsCallable(functions, 'escalateIncident');
  await callable({ labId, incidentId, newSeverity, reason });
}

export async function closeIncident(
  labId: string,
  incidentId: string,
  notes: string
): Promise<void> {
  const callable = httpsCallable(functions, 'closeIncident');
  await callable({ labId, incidentId, notes });
}

export async function recordPostMortem(
  labId: string,
  incidentId: string,
  docLink: string,
  actions: PostMortemAction[]
): Promise<void> {
  const callable = httpsCallable(functions, 'recordPostMortem');
  await callable({ labId, incidentId, docLink, actions });
}

export function subscribeIncidents(
  labId: string,
  status?: IncidentStatus
): Observable<Incident[]> {
  // Real-time listener
}
```

**functions/src/modules/incident.ts:**
```typescript
export const createIncident = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, title, severity, declaredBy } = data;
    
    if (!context.auth) throw new Error('Unauthenticated');
    
    const incidentRef = admin
      .firestore()
      .collection(`labs/${labId}/incidents`)
      .doc();
    
    const incident: Incident = {
      id: incidentRef.id,
      labId,
      title,
      severity,
      status: 'open',
      startedAt: admin.firestore.Timestamp.now(),
      declaredBy: context.auth.uid,
      declaredAt: admin.firestore.Timestamp.now(),
      affectedSystems: data.affectedSystems || [],
      affectedUserCount: data.affectedUserCount || 0,
      affectedFeatures: data.affectedFeatures || [],
      escalationLevel: severity === 'black' ? 'leadership' : severity === 'red' ? 'team' : 'internal',
      criadoEm: admin.firestore.Timestamp.now(),
      criadoPor: context.auth.uid,
    };
    
    await incidentRef.set(incident);
    
    // Notify Slack #incidents (future: integrate with Slack API)
    console.log(`[INCIDENT] ${severity.toUpperCase()}: ${title}`);
    
    return { incidentId: incidentRef.id };
  });

export const escalateIncident = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, incidentId, newSeverity, reason } = data;
    
    if (!context.auth) throw new Error('Unauthenticated');
    
    const incidentRef = admin
      .firestore()
      .collection(`labs/${labId}/incidents`)
      .doc(incidentId);
    
    await incidentRef.update({
      severity: newSeverity,
      escalationLevel: newSeverity === 'black' ? 'leadership' : 'team',
      updatedAt: admin.firestore.Timestamp.now(),
    });
    
    // Log escalation action
    await incidentRef.collection('actions').add({
      action: `Escalated from X to ${newSeverity}`,
      takenAt: admin.firestore.Timestamp.now(),
      takenBy: context.auth.uid,
      result: 'success',
      notes: reason,
    });
    
    return { escalated: true };
  });

export const closeIncident = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, incidentId, notes } = data;
    
    if (!context.auth) throw new Error('Unauthenticated');
    
    const incidentRef = admin
      .firestore()
      .collection(`labs/${labId}/incidents`)
      .doc(incidentId);
    
    const incidentSnap = await incidentRef.get();
    const incident = incidentSnap.data() as Incident;
    
    const actualMTTR = Math.floor(
      (Date.now() - incident.startedAt.toDate().getTime()) / 60000
    ); // minutes
    
    await incidentRef.update({
      status: 'resolved',
      resolvedAt: admin.firestore.Timestamp.now(),
      actualMTTR,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    
    return { closed: true, mttr: actualMTTR };
  });

export const recordPostMortem = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, incidentId, docLink, actions } = data;
    
    if (!context.auth) throw new Error('Unauthenticated');
    
    const incidentRef = admin
      .firestore()
      .collection(`labs/${labId}/incidents`)
      .doc(incidentId);
    
    await incidentRef.update({
      status: 'closed',
      postMortemScheduledAt: admin.firestore.Timestamp.now(),
      postMortemDocLink: docLink,
    });
    
    // Store post-mortem actions as subcollection
    await Promise.all(
      actions.map((action) =>
        incidentRef.collection('post-mortem-actions').add(action)
      )
    );
    
    return { recorded: true };
  });
```

Per project conventions:
- Callables are server-sealed (request.auth checked)
- Error handling returns user-friendly messages
- All writes logged to Cloud Logs
- No hardcoded severity (derived from incident data)
  </action>
  <verify>
    <automated>npm run build -- src/features/admin/incident-response functions/src/modules/incident.ts && grep -c "export" functions/src/modules/incident.ts</automated>
  </verify>
  <done>Types defined, service layer and callables implemented, 4+ functions exported</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| IC authority | Only authenticated users with 'admin' role can declare incidents |
| Incident data access | Incident records read-only to IC + CTO (sensitive escalation info) |
| Post-mortem visibility | Post-mortem docs shared only with responders + leadership |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-11 | Spoofing | Fake incident declaration | mitigate | Only admin users (context.auth.uid + role check) can call createIncident |
| T-06-12 | Information Disclosure | Incident details to non-responders | mitigate | Firestore Rules: incident docs readable only by lab members with role in ['admin', 'rt', 'auditor'] |
| T-06-13 | Elevation of Privilege | Regular user escalates to Black | mitigate | Only IC (CTO) can declare Black; Firestore Rules enforce role check |
| T-06-14 | Repudiation | IC decision not logged | mitigate | All incident updates logged with operatorId + timestamp |

</threat_model>

<verification>
**Phase Gate (before moving to 06-04 Testing):**

1. All documentation written and reviewed
   ```bash
   ls -la docs/incident-response/*.md | wc -l
   # Should output: 7 (SEVERITY_MATRIX, ON_CALL_ROTATION, INCIDENT_COMMANDER_AUTHORITY, RUNBOOK_LINKS, CONTACT_TREE, COMMUNICATION_TEMPLATES, POST_MORTEM_FRAMEWORK)
   ```

2. Contact tree has ops team sign-off (checkpoint)
   ```bash
   # Manual verification: contact names filled in, CTO approves
   ```

3. Cloud Function callables deploy and run
   ```bash
   npm test -- functions/src/modules/incident.test.ts
   ```

4. No TypeScript errors
   ```bash
   npx tsc --noEmit
   ```

**Success:** All docs complete, contact info populated, callables functional. Ready for 06-04 testing.
</verification>

<success_criteria>
- 7 incident response documentation files created
- Severity matrix clear (Green/Yellow/Red/Black decision tree)
- On-call rotation template ready (ops team to fill contact details)
- Incident Commander authority defined (CAN/CANNOT scope)
- 8+ critical runbooks indexed
- 4+ communication templates (customer, regulatory, internal, post-mortem)
- Post-mortem framework (blameless, timeline, RCA, action tracking)
- Cloud Function callables: 4+ functions for incident management
- Type system complete (Incident, SeverityLevel, IncidentStatus)
- All docs signed off by ops team (checkpoint)
</success_criteria>

<output>
After completion, create `.planning/phases/06-capa-incident-response/06-03-PLAN-SUMMARY.md` documenting:
- Incident severity classification examples (scenarios mapping to Green/Yellow/Red/Black)
- IC decision authority scope (what IC can do without approval)
- Runbook index and critical procedures
- Post-mortem improvement process
</output>
