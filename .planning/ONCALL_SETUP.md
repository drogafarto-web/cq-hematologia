# On-Call Rotation + Incident Response Workflow

**Version**: 1.0  
**Effective date**: 2026-05-07  
**Last updated**: 2026-05-07  
**Audience**: SRE, Incident Commanders, Team Leads  
**Status**: Live · Phase 4 launch (24/7 coverage required)

---

## Table of Contents

1. [On-Call Rotation Schedule](#on-call-rotation-schedule)
2. [Slack Integration & Alerts](#slack-integration--alerts)
3. [Incident Commander Role](#incident-commander-role)
4. [Runbook Linkage](#runbook-linkage)
5. [Communication Templates](#communication-templates)
6. [Post-Incident Review](#post-incident-review)
7. [Escalation Matrix](#escalation-matrix)
8. [Tools & Access](#tools--access)

---

## On-Call Rotation Schedule

### Team Structure

**On-call rotation**: weekly, Monday 00:00 UTC → Sunday 23:59 UTC  
**Primary on-call**: responds to all severity levels  
**Secondary on-call**: escalation tier (called if primary unresponsive after 10 min)  
**Manager on-call**: final escalation (called if secondary unresponsive after 15 min)

### Rotation Template (Phase 4 launch)

| Week | Primary | Secondary | Manager Backup |
|------|---------|-----------|-----------------|
| W19 (May 5-11) | [Name A] | [Name B] | [CTO] |
| W20 (May 12-18) | [Name C] | [Name D] | [CTO] |
| W21 (May 19-25) | [Name B] | [Name E] | [CTO] |
| W22 (May 26-Jun 1) | [Name D] | [Name A] | [CTO] |

### Contact Info Template

**On-Call: [Name]**  
- **Slack handle**: @[slack_handle]
- **Phone (out-of-hours)**: +55 (XX) [number]
- **SMS**: same as phone
- **Secondary escalation**: [Secondary Name] @ [slack + phone]
- **Manager escalation**: CTO @ [slack + phone]

### SLA Response Times

| Severity | Definition | Response Time | Update Freq |
|----------|-----------|----------------|-------------|
| **RED** | Production down, data loss, security breach, error rate >5% | **15 minutes** | Every 5 min |
| **YELLOW** | Degradation, slow queries, <2% error rate, one feature down | **1 hour** | Every 15 min |
| **GREEN** | Minor issue, no customer impact, informational | **4 hours** | Daily |

**Note**: Response time = from alert firing to on-call acknowledging in Slack + starting investigation. Not TTR (time-to-resolve).

### Calendar Invite Template

**Title**: On-Call: [Name] (W[week number])  
**Recurrence**: None (weekly manual update)  
**Time**: Monday 00:00 → Sunday 23:59 (UTC)  
**Calendar**: Shared calendar `HC Quality On-Call`  
**Description**:
```
PRIMARY: [Name]
Phone: [number]
Slack: @[handle]

SECONDARY: [Secondary Name]
Phone: [number]
Slack: @[handle]

Start investigating at:
- Cloud Logs: https://console.cloud.google.com/logs
- Firebase Console: https://console.firebase.google.com/project/hmatologia2
- Runbook: .planning/INCIDENT_RESPONSE_RUNBOOK.md
```

---

## Slack Integration & Alerts

### Channel Setup

**#production-alerts** (readonly)
- Purpose: Cloud Monitoring webhooks fire here automatically
- Do NOT post manually
- Monitored by on-call (phone notification enabled)
- Retention: 90 days
- Visibility: `@hc-quality-team` + SRE + manager

**#incidents-live** (read-write)
- Purpose: incident commander posts status updates (every 5-15 min during RED/YELLOW)
- Include: severity, ETA, current action, owner
- When resolved, pin incident summary + post-mortem link
- Retention: 180 days
- Visibility: `@hc-quality-team` + `@engineering` + manager

### Cloud Monitoring → Slack Webhook

**Setup (Firebase Admin):**

1. Open Cloud Monitoring console (southamerica-east1 region)
2. Create notification channel:
   - Type: Slack
   - Webhook URL: `https://hooks.slack.com/services/[workspace]/[token]`
   - Channel: `#production-alerts`
   - Test: send test alert
3. Create alert policy:
   - **Alert Name**: `Production Error Rate >5%`
   - **Metric**: `logging.googleapis.com/user_defined_metrics/error_count`
   - **Condition**: `error_count > 5% of baseline`
   - **Duration**: 2 minutes (avoid flapping)
   - **Notification channel**: Slack webhook
   - **Documentation link**: `.planning/INCIDENT_RESPONSE_RUNBOOK.md`

**Repeat for**:
- Hosting CPU >80%
- Firestore reads >10M/day (billing alert)
- Cloud Functions timeout (p99 >30s)
- Unhandled exceptions in Cloud Logs
- Custom metric: `lackluster_response` (LCBF from INITIAL_SPEC_legacy.md)

### Slack Commands

**Start incident** (IC or on-call):
```
/incident start
- Severity: [RED|YELLOW|GREEN]
- Service: [hosting|functions|firestore|auth]
- Title: [one-liner description]
```
→ Creates incident ticket + message in #incidents-live

**Update severity**:
```
/sev RED
```
→ Updates incident severity, re-notifies on-call if escalated

**Post resolution**:
```
/incident end
- Impact: [# of users affected, timeframe]
- Duration: [total downtime]
- Owner: [who will write post-mortem]
```
→ Pins incident + alerts #incidents-live → "RESOLVED"

**Note**: Commands require Slack bot installed in workspace. Bot scopes:
- `chat:write` (post messages)
- `chat:write.public` (post to public channels)
- `commands:read` (listen for slash commands)
- `users:read` (resolve @mentions)

---

## Incident Commander Role

**Rotates weekly** with on-call (IC = primary on-call + backup).

### Primary Responsibilities

| Task | Owner | Timing |
|------|-------|--------|
| Acknowledge alert in Slack | IC | <5 min |
| Declare severity (RED/YELLOW/GREEN) | IC | <10 min |
| Post initial update to #incidents-live | IC | <15 min |
| Gather stakeholders (if RED) | IC | <15 min |
| Lead investigation via runbook | IC + team | ongoing |
| Post status updates | IC or delegate | every 5 min (RED), 15 min (YELLOW) |
| Declare resolution | IC | once all systems green |
| Schedule post-mortem | IC | within 2 hours of resolution |

### Decision-Making Authority

**IC does NOT**:
- Deploy code to production without explicit approval from CTO or tech lead
- Delete data from Firestore/Cloud Storage
- Disable authentication or billing controls
- Post customer-facing communications without manager sign-off

**IC does**:
- Restart Cloud Functions
- Restart Cloud Run services
- Rebuild Firestore indexes
- Rollback to previous Firebase Hosting deployment
- Kill runaway queries / halt polling loops
- Declare escalation to manager/CTO

**Approval flow for production patches**:
1. IC identifies root cause
2. IC drafts patch + estimated impact
3. IC posts to #incidents-live with `@[tech-lead]`
4. Tech lead reviews + approves or suggests alternative
5. IC (or tech lead if code-heavy) deploys
6. Monitor 10 minutes → if error rate <0.1%, call resolved
7. If revert needed → rollback to previous deployment (1-click in Firebase Hosting console)

### Incident Commander Checklist

**At shift start (Monday 00:00 UTC)**:
- [ ] Confirm calendar invite received
- [ ] Phone + Slack notifications enabled
- [ ] Verified access to Cloud Console (test login)
- [ ] Read most recent post-mortem from #incidents-live
- [ ] Familiar with current known issues (check `.planning/STATE.md` "Known Issues" section)

**During alert**:
- [ ] Acknowledge alert in Slack within 5 min (👀 reaction or message)
- [ ] Switch to #incidents-live + join Slack huddle
- [ ] Post initial message: `🔴 INCIDENT: [title] | ETA [time] | [owner] investigating`
- [ ] Follow runbook scenario (see next section)
- [ ] Update every 5-15 min (no longer than)
- [ ] If stuck >30 min, escalate to secondary + tech lead
- [ ] Upon resolution: `/incident end` + schedule post-mortem within 24h

---

## Runbook Linkage

**Full runbook**: `.planning/INCIDENT_RESPONSE_RUNBOOK.md`  
**How to use**: When alert fires, scan scenario list (below) + jump to section in runbook.

### 7 Core Scenarios (Estimated TTR)

| # | Scenario | Runbook Section | TTR | Commands |
|---|----------|-----------------|-----|----------|
| 1 | **Firestore reads spiking** | Runbook §3.1 | 5-15 min | `gcloud firestore indexes list` + rebuild |
| 2 | **Cloud Functions timeout** | Runbook §3.2 | 10-20 min | `gcloud functions describe` + logs + possible memory bump |
| 3 | **Authentication errors** | Runbook §3.3 | 15-30 min | Firebase Auth console + test login flow |
| 4 | **Error rate spike (app layer)** | Runbook §3.4 | 20-45 min | Cloud Logs filter + identify service + possible rollback |
| 5 | **Hosting 503 / CDN down** | Runbook §3.5 | 5-15 min | `firebase hosting:channel:list` + check deploy logs + redeploy if needed |
| 6 | **Data corruption / ghost records** | Runbook §3.6 | 1-2 hours | Audit trail inspection + Firestore backup restore (if available) + post-mortem |
| 7 | **Unresponsive mobile app** | Runbook §3.7 | 15-45 min | Mobile app logs (if available) + backend health check + possible PWA cache clear |

**Each scenario includes**:
- Diagnostic commands (gcloud, Firebase CLI, curl)
- Expected error messages + what they mean
- Step-by-step mitigation
- When to escalate (to CTO, to Google Cloud support)
- When to declare major incident (notify CEO, customers)

---

## Communication Templates

### Slack Message Templates

#### Initial Incident Notification (post within 15 min)

**#incidents-live**:
```
🔴 INCIDENT START — Production Error Spike

**Severity**: RED
**Service**: [hosting | functions | firestore | auth]
**Detected**: [alert timestamp, e.g. 14:32 UTC]
**Current Status**: Investigating
**Estimated Resolution**: [30 min | 1 hour | TBD]
**Owner**: @[IC Name]

**What we know**:
- Error rate spiked from 0.1% → 5.2% at 14:32 UTC
- Affects: [# users] on [feature name]
- Data loss: [yes/no/unknown]

**Next steps**: Following runbook scenario §3.X
**Updates**: Every 5 minutes

Join Slack huddle: [link]
```

#### 5-Minute Status Update (RED severity)

**#incidents-live** (threaded reply):
```
🔴 **[14:37 UTC] Status Update — 5 min in**

**Findings**:
- Identified: Firestore index missing on `laboratories.{labId}.runs` collection
- Root cause: Query in new export feature not optimized
- Mitigation: Building index now (ETA 10 min)

**Actions taken**:
- @[Tech Lead] reviewing code for similar queries
- Firestore dashboard monitoring

**Impact so far**: ~50 users affected, 2 customers reported

**Next ETA**: 14:47 UTC (index built + queries re-running)
```

#### 15-Minute Status Update (YELLOW severity)

**#incidents-live** (threaded reply):
```
🟡 **[15:45 UTC] Status Update — 15 min in**

**Current status**: Degraded · Investigating

**Root cause** (suspected): Slow query on analytics rollup. Not production-breaking but affecting dashboard load time.

**Actions**: 
- Deploying optimized query (PR #456 reviewed by @[Tech Lead])
- ETA deployment: 5 min
- ETA full resolution: 16:00 UTC

**Customer impact**: No data loss. Dashboard loads in 8-12s instead of 2s.
```

#### Resolution Notification

**#incidents-live**:
```
✅ **INCIDENT RESOLVED**

**Duration**: 47 minutes (14:32 → 15:19 UTC)
**Root cause**: Missing Firestore composite index on `(labId, operatorId, runNumber)`
**Fix**: Index built + queries re-optimized
**Data loss**: None
**Customer impact**: ~50 users affected, 0 data corruption, 0 money lost

**Next steps**: Post-mortem meeting scheduled 2026-05-07 @ 16:00 UTC in #incidents-live
Post-mortem owner: @[IC Name]

**Thank you all** for quick response. Update on prevention in 24 hours.
```

### Email Template (to customers / stakeholders)

**Subject**: `[RESOLVED] Production Incident: Error Rate Spike (2026-05-07 14:32 UTC)`

**To**: Customers + support team + management

**Body**:
```
Hi [Customer Name],

We experienced a production incident on 2026-05-07 from 14:32 to 15:19 UTC (47 minutes).

**What happened**:
During this window, users of the Export feature experienced slow dashboard loads (8-12s instead of 2s). We detected an unoptimized Firestore query that was triggered by our latest release.

**Impact to you**:
- Timeframe: 47 minutes
- Services affected: Dashboard / Export feature
- Your data: No data loss, no corruption
- Your work: Any in-progress exports were paused; no data was lost

**What we did**:
1. Detected the issue via automated monitoring (2 min response)
2. Identified root cause: missing Firestore index (10 min investigation)
3. Built index + redeployed optimized code (25 min mitigation)
4. Verified system health (10 min)

**How we prevent this**:
- [Action 1]: Added pre-deployment test for all Firestore queries
- [Action 2]: Increased monitoring on index creation latency
- [Action 3]: Code review process now includes query performance checklist

**Next steps**:
- Complete post-mortem within 24 hours (shared in your account)
- Improved monitoring deployed by 2026-05-08
- Follow-up: Your account manager will check in within 48h

We apologize for the disruption. Our SLA is <15 min response for RED severity; we met that (2 min). TTR is 47 min, which exceeds our internal target of 30 min. We're improving our index monitoring to prevent similar incidents.

Questions? Reply to this email or contact support@labclin.hc.

Best,  
HC Quality SRE Team
```

---

## Post-Incident Review

### Timing & Owner

- **Scheduled**: within 2 hours of resolution (async meeting, recorded)
- **Duration**: 30-45 minutes
- **Owner**: IC of the incident
- **Attendees**: on-call team, tech lead, CTO, relevant engineers
- **Location**: Slack thread in #incidents-live + Zoom recording (optional)

### Blameless Culture

**Principle**: Focus on systems, tools, and processes — not people.

**Forbidden**:
- "Why did [Person] miss this?"
- "Who deployed that code?"
- Assigning blame to individual

**Encouraged**:
- "Why did our testing not catch this?"
- "How can we automate this check?"
- "What system changes prevent recurrence?"

### Post-Mortem Template

**Location**: Google Doc (link pinned in #incidents-live incident thread)

**Title**: `[POST-MORTEM] Firestore Index Spike — 2026-05-07`

**Sections**:

```markdown
## Executive Summary
- **Incident**: Firestore index missing, error rate spike to 5.2%
- **Duration**: 47 minutes (14:32 → 15:19 UTC)
- **Impact**: ~50 users, 2 customer reports, 0 data loss
- **Root cause**: Pre-deployment index validation not in test suite

---

## Timeline

| Time (UTC) | Event |
|---|---|
| 14:32 | Alert fires: error rate >5% for 2 min |
| 14:34 | IC @[Name] acknowledges in Slack |
| 14:42 | Root cause identified: missing composite index |
| 14:47 | Firestore begins building index |
| 14:58 | Index ready; queries re-execute |
| 15:19 | Error rate back to 0.1%; incident resolved |

---

## Root Cause Analysis

**Direct cause**: Export feature v1.3 queries `(labId, operatorId, runNumber)` without Firestore composite index. Optimizer falls back to collection scan → slow queries → timeout → error.

**Why we didn't catch this**:
1. Pre-deployment test suite doesn't validate Firestore indexes
2. Code review checklist didn't include "new queries need index?"
3. Staging environment has <1% of prod data; test didn't surface slow query

**Why this mattered now**:
- Export feature is new (Phase 3.3)
- Query pattern wasn't used in prior phases
- Prod data volume exposed the issue

---

## Short-Term Fix (Already done)
✅ Firestore composite index built  
✅ Query re-optimized and deployed  
✅ Monitoring alert added for index latency  

---

## Long-Term Prevention

| Action | Owner | Target date | Priority |
|--------|-------|-------------|----------|
| Add Firestore index validator to pre-deploy checks (`scripts/preflight-*.sh`) | @[SRE Name] | 2026-05-14 | P0 |
| Update code review checklist (new Firestore queries need index audit) | @[Tech Lead] | 2026-05-09 | P0 |
| Increase prod-like data in staging (10% of prod volume) | @[Ops Name] | 2026-05-21 | P1 |
| Set up Firestore quota alerts (reads >10M/day) | @[SRE Name] | 2026-05-10 | P1 |
| Document Firestore index patterns in ADR (reference to ADR-0002) | @[CTO] | 2026-05-16 | P2 |

---

## Lessons Learned

**What went well**:
- IC responded in 2 minutes
- Runbook was followed precisely
- Team communicated clearly every 5 min
- Zero data loss

**What we can improve**:
- TTR was 47 min; target is 30 min. Firestore index build took 20 min (acceptable), but investigation took 10 min. Opportunity: pre-flight script could catch this in <1 min.
- Customer communication came after resolution. Next time: notify within 5 min of RED declaration.

---

## Sign-Off

- **Post-mortem author**: @[IC Name]
- **Tech lead review**: @[Tech Lead] (date: 2026-05-07 16:15 UTC) ✓
- **CTO review**: @[CTO] (date: 2026-05-07 17:00 UTC) ✓

**Status**: Closed · All action items assigned + tracked in project board

---

## Attachments

- Cloud Logs export: [link to log excerpt]
- Runbook section 3.1: [link to runbook]
- Code change (fix): PR #458
```

---

## Escalation Matrix

### Level 1: On-Call Primary

**Triggered by**: Alert in #production-alerts  
**Responds within**: 15 min (RED), 1 hour (YELLOW)  
**Authority**: Start investigation, follow runbook, gather team, declare severity  
**Escalates to Level 2 if**:
- Unresponsive for >10 minutes
- Investigation hits blocker (needs CTO decision)
- Issue appears to be data corruption (requires backup restore)
- Customer impact >30 min

### Level 2: On-Call Secondary

**Triggered by**: IC not acknowledged within 10 min, or IC escalates  
**Responds within**: 10 minutes of being paged  
**Authority**: Assume IC role, override IC decisions if blocked, authorize production patches  
**Escalates to Level 3 if**:
- Issue not resolved within 1 hour of secondary taking over
- Requires executive decision (customer credit, public statement)
- Requires backup restore from Google Cloud support

### Level 3: CTO / Manager On-Call

**Triggered by**: Secondary escalates, or RED incident >1 hour  
**Responds within**: 5 minutes (emergency override)  
**Authority**: Full production access, customer escalation, executive communication  
**Actions**:
- Pair with tech lead to unblock investigation
- Authorize schema changes / data repairs
- Contact Google Cloud support if infra issue
- Notify CEO + customers if needed
- Schedule incident review within 24h

### Escalation Trigger Flowchart

```
Alert fires (production-alerts)
    ↓
on-call-primary notified via Slack + phone
    ↓
Primary acknowledges within 5 min? 
    ├─ YES → Start investigation (Level 1)
    │         ├─ Resolved in 30 min? → Close incident
    │         └─ Unresolved in 30 min? → Escalate to secondary (Level 2)
    └─ NO → Secondary auto-paged at 10 min (Level 2)
              ├─ Secondary responds? → Secondary takes lead
              └─ No response? → Manager auto-paged at 15 min (Level 3)
```

---

## Tools & Access

### Required Access (per person)

- **Cloud Console**: https://console.cloud.google.com/
  - Project: `hmatologia2`
  - Roles: `Editor` (on-call), `Viewer` (secondary can observe)
  - MFA: required, backup codes in secure vault

- **Firebase Console**: https://console.firebase.google.com/project/hmatologia2
  - Roles: `Editor` (on-call)
  - Firestore access: full read + selective write (runbook approvals only)

- **Slack**: #production-alerts (unmuted), #incidents-live (admin)
  - Notifications: enabled phone + desktop
  - Huddle: can start on-demand

- **GitHub**: hcquality repo
  - Roles: `Triage` (view, comment) + `Maintain` (deploy approval)
  - Branch protection: main (requires 1 approval before merge)

- **Google Cloud CLI** (`gcloud`):
  - Install: `curl https://sdk.cloud.google.com | bash`
  - Authenticate: `gcloud auth application-default login`
  - Test: `gcloud functions list --project hmatologia2`

- **Firebase CLI** (`firebase`):
  - Install: `npm install -g firebase-tools`
  - Authenticate: `firebase login`
  - Test: `firebase projects:list`

### Commands Cheat Sheet

**Firestore (queries, indexes)**:
```bash
# List all indexes
gcloud firestore indexes list --project hmatologia2

# Describe specific index
gcloud firestore indexes describe [index-id] --project hmatologia2

# Create index from spec (if needed)
gcloud firestore indexes create --spec-file=index.yaml --project hmatologia2
```

**Cloud Functions**:
```bash
# List all functions
gcloud functions list --project hmatologia2 --region=southamerica-east1

# View function logs (last 50 lines)
gcloud functions logs read [function-name] --project hmatologia2 --limit=50 --region=southamerica-east1

# Restart function (no args; cold start can reset state)
gcloud functions delete [function-name] --project hmatologia2 --region=southamerica-east1 --quiet
# Then re-deploy via: firebase deploy --only functions

# Check function memory / timeout
gcloud functions describe [function-name] --project hmatologia2 --region=southamerica-east1
```

**Cloud Logs**:
```bash
# Filter by error rate
gcloud logging read "severity=ERROR" --project hmatologia2 --limit=100 --format=json

# Filter by service
gcloud logging read "resource.type=cloud_function AND function_name=[name]" --project hmatologia2 --limit=50

# Real-time tail (if using gcloud beta)
gcloud beta logging tail "resource.type=cloud_function" --project hmatologia2
```

**Firebase Hosting**:
```bash
# List recent deployments
firebase hosting:channel:list --project hmatologia2

# View deployment details
firebase hosting:sites:list --project hmatologia2

# Rollback to previous version (in Firebase console UI)
```

**Auth**:
```bash
# Test auth endpoint
curl -X POST https://identitytoolkit.googleapis.com/v1/accounts:signUp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"[test]","returnSecureToken":true}' \
  -H "X-Firebase-Project: hmatologia2"
```

---

## Appendix: Calendar Invite Template (iCal)

**To schedule**: Use shared Google Calendar `HC Quality On-Call` and add manually each week.

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HC Quality//On-Call//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:20260505T000000Z
DTEND:20260512T000000Z
DTSTAMP:20260505T000000Z
UID:oncall-w19-2026@hmatologia2.internal
SUMMARY:On-Call: [Primary Name] (W19)
DESCRIPTION:
 PRIMARY: [Name]
 Phone: [+55-XX-XXXXX]
 Slack: @[handle]
 
 SECONDARY: [Secondary Name]
 Phone: [+55-XX-XXXXX]
 Slack: @[handle]
 
 Runbook: .planning/INCIDENT_RESPONSE_RUNBOOK.md
 Slack channels: #production-alerts #incidents-live
 Cloud Console: https://console.cloud.google.com/
 Firebase: https://console.firebase.google.com/project/hmatologia2
LOCATION:Virtual (Slack #incidents-live)
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

---

## Implementation Checklist

- [ ] Form on-call rotation (3-5 people, assign 4 weeks ahead)
- [ ] Create shared Google Calendar (`HC Quality On-Call`)
- [ ] Add calendar invites for all team members
- [ ] Enable Slack notifications (#production-alerts, #incidents-live)
- [ ] Set up Cloud Monitoring → Slack webhook
- [ ] Create Cloud Monitoring alert policies (7 scenarios)
- [ ] Install Slack incident management bot (e.g., `incident` app)
- [ ] Test on-call notification (send test alert)
- [ ] Verify all on-call have Cloud Console / Firebase / gcloud / firebase CLI access
- [ ] Distribute gcloud cheat sheet to team
- [ ] Run tabletop incident drill (week 1 of Phase 4)
- [ ] Schedule monthly on-call retrospective (30 min, 1st Friday of month)
- [ ] Post this doc in #incidents-live pinned messages

---

## Related Documents

- **`.planning/INCIDENT_RESPONSE_RUNBOOK.md`** — 7 step-by-step scenarios with diagnostic commands
- **`.planning/STATE.md`** — Current known issues + blockers
- **`docs/CLOUD_LOGS_MONITORING_GUIDE.md`** — Post-deployment 24h monitoring
- **`docs/CLOUD_LOGS_QUICK_REFERENCE.md`** — gcloud commands cheat sheet
- **`scripts/monitor-cloud-logs.sh` / `.ps1`** — Automated log monitoring (24h post-deploy)

---

**Version history**:
- **1.0** (2026-05-07): Initial setup for Phase 4 launch. 24/7 coverage, RED/YELLOW/GREEN severity levels, 7 core runbook scenarios, blameless post-mortem culture.

