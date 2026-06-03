---
title: On-Call Rotation Setup & Execution Guide
version: 1.0
status: active
effective_date: 2026-05-20
last_updated: 2026-05-07
owner: Team Lead
audience: Team leads, SRE/DevOps, on-call rotation members
---

# On-Call Rotation Setup & Execution Guide

**Purpose:** Detailed, copy-paste-ready setup playbook for team lead to establish 24/7 on-call rotation for HC Quality v1.4 production launch (2026-05-20).

**Deliverables Checklist:**

- ✅ 4-week rotating schedule (Primary + Secondary pairs)
- ✅ Severity classification matrix (Green/Yellow/Red/Black)
- ✅ Slack channels creation guide
- ✅ Google Calendar iCal file (ready to import)
- ✅ Contact tree template (names, phone, email, Slack)
- ✅ Runbook links registry
- ✅ Post-mortem template (copy-paste)
- ✅ Quick-reference laminate cards (PDF-ready)

**Success Criteria:** All sections below completed and team trained by **2026-05-20 00:00 BRT**.

---

## Part 1: Severity Classification (Reference & Decision Framework)

### 1.1 Severity Matrix — Quick Reference

Use this matrix to classify incidents in **<30 seconds**. If unsure, escalate up.

| Severity      | Definition                                | Users Affected           | SLA Impact                 | Paging                                             | ETA                              | Page Frequency |
| ------------- | ----------------------------------------- | ------------------------ | -------------------------- | -------------------------------------------------- | -------------------------------- | -------------- |
| **🟢 GREEN**  | Feature degraded, slow, non-critical      | <1%                      | <15 min                    | Primary only                                       | 1h to start investigation        | 15 min initial |
| **🟡 YELLOW** | Feature down or cascading degradation     | 1–10%                    | 15m–1h                     | Primary + Secondary + notify CTO                   | 15 min to mitigation             | Every 5 min    |
| **🔴 RED**    | Core service down or audit trail affected | >10% or audit trail down | >1h or data integrity risk | **All hands:** Primary + Secondary + CTO + IC      | 5 min to acknowledge, declare IC | Every 5 min    |
| **⚫ BLACK**  | Data loss, security breach, legal hold    | Any scale                | Compliance risk            | **All hands + Legal:** CTO + CEO + auditor + legal | 2 min to declare                 | Every 2–5 min  |

### 1.2 Decision Tree (Laminate & Post at Desk)

```
┌─── INCIDENT DETECTED ───┐
│ Ask: How many % of       │
│ users can't work?        │
└───────────┬──────────────┘
            ↓
    ┌───────┴────────┐
    ↓                ↓
 <1% ?           1–10% ?           >10% ?        Data Loss?
    ↓                ↓                ↓             ↓
  🟢 GREEN      🟡 YELLOW        🔴 RED        ⚫ BLACK
                                                    ↓
                                          Page all + Legal
              ↓                ↓
        Page Primary     Page Primary
        + Secondary      + Secondary
        + CTO            + CTO + IC
        Notify only      Status every
        when escalating  5 min
```

**Decision Tree in Words (for uncertain calls):**

1. **"Can users work around this issue?"** → YES = 🟢 GREEN; NO = continue
2. **"Is audit trail or signature recording affected?"** → YES = 🔴 RED (or ⚫ if data loss); NO = continue
3. **"Is data loss happening right now?"** → YES = ⚫ BLACK; NO = continue
4. **"How long is the outage likely to be?"** → <1h = 🟡 YELLOW; >1h or unknown = 🔴 RED

---

## Part 2: 4-Week Rotation Schedule Template

### 2.1 Schedule Setup Instructions

**Step 1: Identify rotation members**

Gather 4 Primary engineers + 4 Secondary engineers (8 people total minimum).

| Week                         | Primary  | Phone | Email | Secondary | Phone | Email |
| ---------------------------- | -------- | ----- | ----- | --------- | ----- | ----- |
| W1 (2026-05-20 – 2026-05-26) | [Name A] | [TBD] | [TBD] | [Name A2] | [TBD] | [TBD] |
| W2 (2026-05-27 – 2026-06-02) | [Name B] | [TBD] | [TBD] | [Name B2] | [TBD] | [TBD] |
| W3 (2026-06-03 – 2026-06-09) | [Name C] | [TBD] | [TBD] | [Name C2] | [TBD] | [TBD] |
| W4 (2026-06-10 – 2026-06-16) | [Name D] | [TBD] | [TBD] | [Name D2] | [TBD] | [TBD] |
| W5+ (Repeat 4-week cycle)    | —        | —     | —     | —         | —     | —     |

**Step 2: Fill in phone & email**

- Contact each engineer; collect phone number (mobile preferred) and email
- Verify phone numbers work (test SMS/call once)
- Add to shared contact sheet

**Step 3: Generate Google Calendar iCal file**

See **Part 2.3** below for iCal template. Edit names and dates, save as `.ics` file.

**Step 4: Handoff schedule**

Every Friday 18:00 BRT, outgoing on-call meets incoming:

- Friday 18:00–19:00: Handoff meeting (Zoom)
- Friday 19:00–20:00: Wrap-up (answers questions, document open incidents)

### 2.2 Coverage Rules

**Hours:** 24/7 (Mon 00:00 – Sun 23:59 BRT)  
**Weekends:** Same people (no separate weekend rotation)  
**Handoff Day:** Every Friday 18:00 BRT (1 hour)  
**Vacation/Unavailability:** Swap with another week in advance (get CTO approval first)

### 2.3 Google Calendar iCal File (Generate & Import)

**Instructions to generate:**

1. Copy the text below into a text editor
2. Replace all `[Name X]` and `[Name X2]` with actual engineer names
3. Verify `America/Sao_Paulo` timezone is correct
4. Save file as `hc-quality-oncall-2026-q2.ics`
5. Email or Google Drive → Share → "Subscribe to calendar" → paste iCal URL

**iCal Template (copy below):**

```ical
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//HC Quality//On-Call Rotation//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:HC Quality On-Call v1.4
X-WR-TIMEZONE:America/Sao_Paulo
X-WR-CALDESC:24/7 on-call rotation for HC Quality production (2026-05-20 onwards)

BEGIN:VEVENT
DTSTART:20260520T000000
DTEND:20260526T235959
RRULE:FREQ=WEEKLY;INTERVAL=4;UNTIL=20260930T235959
SUMMARY:[WEEK 1] Primary: [Name A] | Secondary: [Name A2]
DESCRIPTION:Handoff Friday 18:00 BRT. See .planning/ON_CALL_ROTATION_SETUP.md
LOCATION:Slack #on-call-paging
STATUS:CONFIRMED
SEQUENCE:0
UID:hcq-oncall-w1-2026@hmatologia2.web.app
END:VEVENT

BEGIN:VEVENT
DTSTART:20260527T000000
DTEND:20260602T235959
RRULE:FREQ=WEEKLY;INTERVAL=4;UNTIL=20260930T235959
SUMMARY:[WEEK 2] Primary: [Name B] | Secondary: [Name B2]
DESCRIPTION:Handoff Friday 18:00 BRT. See .planning/ON_CALL_ROTATION_SETUP.md
LOCATION:Slack #on-call-paging
STATUS:CONFIRMED
SEQUENCE:0
UID:hcq-oncall-w2-2026@hmatologia2.web.app
END:VEVENT

BEGIN:VEVENT
DTSTART:20260603T000000
DTEND:20260609T235959
RRULE:FREQ=WEEKLY;INTERVAL=4;UNTIL=20260930T235959
SUMMARY:[WEEK 3] Primary: [Name C] | Secondary: [Name C2]
DESCRIPTION:Handoff Friday 18:00 BRT. See .planning/ON_CALL_ROTATION_SETUP.md
LOCATION:Slack #on-call-paging
STATUS:CONFIRMED
SEQUENCE:0
UID:hcq-oncall-w3-2026@hmatologia2.web.app
END:VEVENT

BEGIN:VEVENT
DTSTART:20260610T000000
DTEND:20260616T235959
RRULE:FREQ=WEEKLY;INTERVAL=4;UNTIL=20260930T235959
SUMMARY:[WEEK 4] Primary: [Name D] | Secondary: [Name D2]
DESCRIPTION:Handoff Friday 18:00 BRT. See .planning/ON_CALL_ROTATION_SETUP.md
LOCATION:Slack #on-call-paging
STATUS:CONFIRMED
SEQUENCE:0
UID:hcq-oncall-w4-2026@hmatologia2.web.app
END:VEVENT

BEGIN:VEVENT
DTSTART:20260517T180000
DTEND:20260517T190000
RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20260927T190000
SUMMARY:🤝 On-Call Handoff (Friday 18:00 BRT)
DESCRIPTION:Outgoing meets incoming on-call. Document state, open incidents, critical alerts. See .planning/ON_CALL_ROTATION_SETUP.md Part 2.4
LOCATION:Zoom [LINK TBD]
STATUS:CONFIRMED
SEQUENCE:0
UID:hcq-oncall-handoff-2026@hmatologia2.web.app
END:VEVENT

BEGIN:VEVENT
DTSTART:20260517T190000
DTEND:20260517T200000
RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20260927T200000
SUMMARY:📋 On-Call Wrap-Up (Friday 19:00 BRT)
DESCRIPTION:Post-handoff: outgoing on-call documents incidents in Slack thread, answers questions.
LOCATION:Slack #on-call-paging
STATUS:CONFIRMED
SEQUENCE:0
UID:hcq-oncall-wrapup-2026@hmatologia2.web.app
END:VEVENT

END:VCALENDAR
```

**After saving .ics file:**

1. Upload to Google Drive (share with team)
2. Or email to all engineers with subject: "HC Quality On-Call Calendar — import this into your calendar"
3. In Google Calendar → **+ Other calendars** → **Subscribe to calendar** → paste iCal URL (if in Drive) or import `.ics` file
4. Verify all 4 weeks show up with correct names

---

## Part 3: Slack Channels Setup

### 3.1 Create Required Channels

**Team lead action items:**

```bash
# Create channels (Slack workspace admin)
1. #on-call-paging        [Private, invite on-call members]
2. #production-alerts     [Private, invite eng team + CTO + CEO]
3. #production-emergency  [Private, invite eng team + CTO + CEO + legal]
4. #incident-command      [Private, invite IC rotation + CTO]
```

**Do NOT make these channels public.** Customers should not see incident chatter.

### 3.2 Channel Purpose & Rules

| Channel                 | Purpose                                     | Who Joins                      | Message Rules                                                                                                  |
| ----------------------- | ------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `#on-call-paging`       | Incident pages only (no chatter)            | Primary, Secondary, CTO        | ONLY paging notifications + ACK. No comments, no unrelated chatter. Bot auto-archives old incidents weekly.    |
| `#production-alerts`    | Status updates, metrics, resolved incidents | Eng team + CTO + CEO + auditor | Incident summaries (Green not posted, Yellow+ posted automatically). Daily metrics digest. Alert rule changes. |
| `#production-emergency` | Real-time updates for Red/Black incidents   | Eng team + CTO + CEO + legal   | Minute-by-minute updates during Red/Black. Customer notifications. Escalation decisions.                       |
| `#incident-command`     | IC weekly handoff + RCA tracking            | IC rotation + CTO + team lead  | Weekly handoff notes, open RCA actions, post-mortem links. Closed to on-call members (read-only).              |

### 3.3 Slack Workflow: Incident Page Template

**Shortcut to page on-call:**

Set up Slack Workflow (Slack Workflow Builder):

1. Create shortcut: `/incident-page`
2. Form fields:
   - Severity (dropdown: 🟢 Green / 🟡 Yellow / 🔴 Red / ⚫ Black)
   - Service (text)
   - Brief Description (text)
   - Runbook Link (text, optional)
3. Action: Post message to `#on-call-paging`:
   ```
   🔔 @on-call-primary — INCIDENT PAGE
   [Severity]: [Service]
   [Detection Time]: [auto-filled with current time]
   [Brief Description]: [user input]
   [Runbook]: [user input or "SEE THREAD"]
   ---
   IC: [auto-assigned — Primary name]
   ACK REQUIRED: Reply with ✅ + ETA for status
   ```

---

## Part 4: Contact Tree Template (Fill In & Share)

### 4.1 On-Call Primary Rotation

**Status:** [ ] INCOMPLETE (awaiting names & phone numbers)

| Week | Period                  | Primary Name | Phone   | Email   | Slack Handle |
| ---- | ----------------------- | ------------ | ------- | ------- | ------------ |
| W1   | 2026-05-20 – 2026-05-26 | [NAME]       | [PHONE] | [EMAIL] | @[HANDLE]    |
| W2   | 2026-05-27 – 2026-06-02 | [NAME]       | [PHONE] | [EMAIL] | @[HANDLE]    |
| W3   | 2026-06-03 – 2026-06-09 | [NAME]       | [PHONE] | [EMAIL] | @[HANDLE]    |
| W4   | 2026-06-10 – 2026-06-16 | [NAME]       | [PHONE] | [EMAIL] | @[HANDLE]    |

### 4.2 On-Call Secondary Rotation

**Status:** [ ] INCOMPLETE (awaiting names & phone numbers)

| Week | Period                  | Secondary Name | Phone   | Email   | Slack Handle |
| ---- | ----------------------- | -------------- | ------- | ------- | ------------ |
| W1   | 2026-05-20 – 2026-05-26 | [NAME]         | [PHONE] | [EMAIL] | @[HANDLE]    |
| W2   | 2026-05-27 – 2026-06-02 | [NAME]         | [PHONE] | [EMAIL] | @[HANDLE]    |
| W3   | 2026-06-03 – 2026-06-09 | [NAME]         | [PHONE] | [EMAIL] | @[HANDLE]    |
| W4   | 2026-06-10 – 2026-06-16 | [NAME]         | [PHONE] | [EMAIL] | @[HANDLE]    |

### 4.3 Leadership & Escalation Contacts

**Status:** [ ] INCOMPLETE (awaiting approval & contact info)

| Role                    | Name   | Phone   | Email   | Slack     | Availability                                        |
| ----------------------- | ------ | ------- | ------- | --------- | --------------------------------------------------- |
| **CTO**                 | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] | 24/7 (emergency); office Mon–Fri 9–18 BRT           |
| **CEO**                 | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] | 24/7 (Red/Black only); office Mon–Fri 9–18 BRT      |
| **Clinical Supervisor** | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] | Office Mon–Fri 7–17 BRT (critical values)           |
| **External Auditor**    | [NAME] | [PHONE] | [EMAIL] | —         | Office Mon–Fri 9–17 BRT (compliance alerts)         |
| **Infra/DevOps Lead**   | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] | 24/7 (secondary escalation)                         |
| **Product Lead**        | [NAME] | [PHONE] | [EMAIL] | @[HANDLE] | Office Mon–Fri 9–18 BRT (customer impact decisions) |

### 4.4 Escalation Flowchart (Laminate & Post)

```
🚨 INCIDENT DETECTED
        ↓
🔔 PAGE PRIMARY (@primary-oncall in #on-call-paging)
        ↓
10 min no ACK?
 ├─ YES: Page Secondary (@secondary-oncall in thread)
 └─ NO: Primary proceeding
        ↓
Secondary no ACK in 5 min + Primary unavailable?
 ├─ YES: Page CTO (@cto, mention incident severity + time)
 └─ NO: Secondary taking action
        ↓
CTO no ACK in 10 min OR Red/Black severity?
 ├─ YES: Page CEO (@ceo, Slack DM + SMS)
 └─ NO: CTO deciding next steps
        ↓
Red Severity + Compliance Related?
 ├─ YES: Notify Auditor (email + phone)
 └─ NO: Notify only leadership
        ↓
Black Severity?
 └─ YES: CEO + CTO + Auditor + Legal (legal gates action)
```

---

## Part 5: Runbook Links Registry

### 5.1 Runbooks To Create (Before v1.4 Launch)

**Location:** `docs/runbooks/`

**Team lead action:** For each runbook below, copy `docs/runbooks/RUNBOOK_TEMPLATE.md`, fill in details, and link here.

| Incident Type                        | Runbook File                     | Owner (TBD) | Decision Point                   | Status      |
| ------------------------------------ | -------------------------------- | ----------- | -------------------------------- | ----------- |
| **Error Rate Spike (>1%)**           | `error-rate-spike.md`            | @[TBD]      | Single module or platform-wide?  | [ ] PENDING |
| **P99 Latency (>5s)**                | `p99-latency-investigation.md`   | @[TBD]      | Query, function, or frontend?    | [ ] PENDING |
| **Firestore Quota >80%**             | `firestore-quota-breach.md`      | @[TBD]      | Scale or cleanup?                | [ ] PENDING |
| **Memory/CPU OOM**                   | `function-memory-leak.md`        | @[TBD]      | Specific function or general?    | [ ] PENDING |
| **Auth Degradation**                 | `auth-degradation.md`            | @[TBD]      | Firebase status red or local?    | [ ] PENDING |
| **Hosting/CDN Down (5xx)**           | `hosting-outage.md`              | @[TBD]      | GCP down or local config?        | [ ] PENDING |
| **Audit Trail Not Recording**        | `audit-trail-corruption.md`      | @[TBD]      | Functions invoked but no events? | [ ] PENDING |
| **Data Loss / Signature Corruption** | `data-loss-recovery.md`          | @[TBD]      | 1 doc, 100, or 1000+?            | [ ] PENDING |
| **Security Incident**                | `security-breach-response.md`    | @[TBD]      | Ongoing or past breach?          | [ ] PENDING |
| **Regulatory/Audit Alert**           | `regulatory-alert-escalation.md` | @[TBD]      | ANVISA, auditor, or customer?    | [ ] PENDING |

### 5.2 Runbook Template (Copy & Fill For Each Incident Type)

**File:** `docs/runbooks/RUNBOOK_TEMPLATE.md`

````markdown
# Runbook: [Incident Type]

## Quick Decision Tree

START → Is [condition]?
YES → [Severity Level] → [Primary Action] → Go to "Action Steps"
NO → [Alternative Path]

## Severity Assessment (30 seconds)

- [ ] Check Cloud Logs → error count, affected users, SLA impact
- [ ] Check Firestore quota + index status (if relevant)
- [ ] Check function cold-start latency
- [ ] Declare severity (🟢/🟡/🔴/⚫)

## Action Steps (In Order)

1. **Confirm Scope** — Is it 1% or 50% of users? (check by tenant/region/module)
2. **Identify Root** — Use Cloud Trace, Cloud Logs, or error message + stack trace
3. **Communicate** — Post to #production-alerts with ETA (5 min max from incident start)
4. **Mitigate** — Hotfix, scale, or rollback (decide within 10 min)
5. **Verify** — Confirm metric return to baseline (error rate <0.1%, latency <2s, etc.)

## Rollback Procedure (If Mitigation Fails)

```bash
git revert -m 1 <commit-hash>
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2
```
````

## Post-Incident Checklist

- [ ] Schedule RCA within 48h
- [ ] Tag incident in Slack with #incident-[number]
- [ ] Notify auditor if compliance-related (Yellow+)
- [ ] Update this runbook if gaps found

```

### 5.3 Runbook Quick Reference (Bookmark & Print)

**Quick links for on-call:**

```

Error Rate Spike: docs/runbooks/error-rate-spike.md
P99 Latency Investigation: docs/runbooks/p99-latency-investigation.md
Firestore Quota Breach: docs/runbooks/firestore-quota-breach.md
Function Memory Leak: docs/runbooks/function-memory-leak.md
Auth Degradation: docs/runbooks/auth-degradation.md
Hosting Outage: docs/runbooks/hosting-outage.md
Audit Trail Corruption: docs/runbooks/audit-trail-corruption.md
Data Loss Recovery: docs/runbooks/data-loss-recovery.md
Security Incident: docs/runbooks/security-breach-response.md
Regulatory Alert: docs/runbooks/regulatory-alert-escalation.md

Cloud Logs Console: https://console.cloud.google.com/logs/query
GCP Project: hmatologia2
Region: southamerica-east1
Firebase Console: https://console.firebase.google.com/project/hmatologia2

```

---

## Part 6: Handoff Protocol (Friday 18:00 BRT)

### 6.1 Handoff Meeting Format

**Duration:** 1 hour (Friday 18:00–19:00 BRT)
**Attendees:** Outgoing Primary + Secondary, Incoming Primary + Secondary, CTO (optional)
**Location:** Zoom [INSERT LINK]
**Notes:** Posted in Slack thread (#on-call-paging) within 5 min of meeting end

### 6.2 Agenda (Copy-Paste & Timebox)

```

6.1 Handoff Meeting — Friday 18:00–19:00 BRT
═══════════════════════════════════════════════════════════

⏱️ OPEN INCIDENTS (10 min)
□ List all open incidents (if any)
□ Current state, ETA, action owner
□ Incoming on-call reviews mitigation plan

⏱️ CRITICAL ALERTS & THRESHOLDS (5 min)
□ Firestore quota utilization (alert at >60%)
□ Function error rate trend
□ Any deploy or config change affecting alerts

⏱️ BASELINE METRICS & LAST 7 DAYS (5 min)
□ Uptime % (target >99.5%)
□ Incident count split (Green/Yellow/Red/Black)
□ MTTR for Yellow+ incidents
□ Any patterns or concerns

⏱️ CONTACT TREE VALIDATION (5 min)
□ Verify phone numbers are current
□ CTO availability for incoming week
□ Escalation contact changes

⏱️ RUNBOOK REVIEW & QUESTIONS (10 min)
□ Incoming asks questions about runbooks
□ Outgoing reviews recent incidents learned from

⏱️ SLACK CHANNEL SETUP (5 min)
□ Verify #on-call-paging is in incoming workspace
□ Test paging: "@incoming-primary, testing 1-2-3"
□ Incoming ACKs with ✅

⏱️ CLOSE & DOCUMENT (5 min)
□ Outgoing posts in #on-call-paging:
"Handoff to [Name] complete. Open incidents: [list].
CTO this week: [Name]. —[Outgoing Primary]"
□ Incoming posts:
"Incoming. Briefed on [count] incidents. Ready.
—[Incoming Primary]"

```

### 6.3 Open Incident Document Template

**Create a Slack post in #on-call-paging on Friday 18:00 BRT:**

```

📋 HANDOFF DOCUMENT — [Outgoing Primary] → [Incoming Primary]
Date: Friday [DATE] 18:00 BRT
═══════════════════════════════════════════════════════════

OPEN INCIDENTS (if any):

1. [Incident Title] — Status: [mitigating/monitoring], ETA: [time], Owner: [name]
2. [Incident Title] — Status: [resolved/closed], RCA due: [date]

METRICS (Last 7 Days):
• Uptime: [%]
• Incidents: Green [#] | Yellow [#] | Red [#] | Black [#]
• MTTR (Yellow+): [minutes]
• Spike events: [if any]

CRITICAL ALERTS TO MONITOR THIS WEEK:
• Firestore quota at [%] (alert if >80%)
• Function error rate at [%]
• [Any other critical metric]

CTO AVAILABILITY (Next Week):
• Available: [days/times]
• Blocked: [dates — vacation, meetings]

LESSONS FROM THIS WEEK:
• [Incident + learned rule]
• [Incident + learned rule]

RUNBOOK UPDATES NEEDED:
• [Runbook title] — reason: [...]

QUESTIONS FOR INCOMING:
• [Ask here if anything unclear]

---

Signed: [Outgoing Primary]
Acknowledged: [Incoming Primary] — ✅ Ready to take over

````

---

## Part 7: Post-Mortem Template & RCA Process

### 7.1 Post-Mortem Trigger

**Schedule post-mortem within 24 hours of:**
- Any 🔴 RED incident resolved
- Any 🟡 YELLOW incident resolved (if duration >30 min)
- Any incident that required escalation to Red

**Do NOT hold post-mortems for 🟢 GREEN incidents.**

### 7.2 Post-Mortem Template (Copy-Paste)

**Location:** `incidents/[INCIDENT-ID]-postmortem.md`

```markdown
# Post-Mortem: [Incident Title]

**Incident ID:** IC-[0001]
**Date:** [DATE]
**Resolved:** [DATE TIME]
**Duration:** [X min Y sec]
**Severity:** 🟢/🟡/🔴/⚫

---

## 1. Timeline (Minute-by-Minute)

| Time | Event |
|------|-------|
| HH:MM:SS | Alert fires: [what happened] |
| HH:MM:SS | @alice pages in #on-call-paging |
| HH:MM:SS | @bob ACKs; scope assessment begins |
| HH:MM:SS | Root cause identified: [cause] |
| HH:MM:SS | Mitigation deployed / applied |
| HH:MM:SS | Metric validation passes |
| HH:MM:SS | Incident resolved; customer notification sent |

---

## 2. Root Cause (Single Sentence)

[One sentence explaining exactly what broke and why.]

---

## 3. Contributing Factors

- **Factor 1:** [What system gap allowed this?]
- **Factor 2:** [What assumption was wrong?]
- **Factor 3:** [What automation was missing?]

---

## 4. Immediate Mitigation (What We Did)

1. [Action taken]
2. [Action taken]
3. [Action taken]

**Data Loss:** [0/N documents affected]
**Customer Impact:** [Impact duration]

---

## 5. Short-Term Fix (Deploy Within 1 Week)

**Action:** [What to fix]
**Owner:** @[name]
**PR:** [LINK]
**Testing:** [Test approach]
**Deploy:** [Date]
**Success Criteria:** [Measurable outcome]

---

## 6. Long-Term Prevention (Architectural Fix)

**Action:** [What to change in the system]
**Owner:** @[name]
**Change Details:** [Implementation notes]
**Deploy Window:** [Date]
**Success Criteria:** [Measurable prevention]

---

## 7. Lessons Learned

**What Surprised Us:**
1. [Thing 1]
2. [Thing 2]

**What Went Well:**
1. [Thing 1]
2. [Thing 2]

**What We'll Do Differently:**
1. [Change 1]
2. [Change 2]

---

## 8. Action Items

| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| [Action title] | @[name] | [DATE] | TBD |
| [Action title] | @[name] | [DATE] | TBD |

---

## Approvals

- [ ] IC: [IC name] — Reviewed
- [ ] CTO: [CTO name] — Reviewed
- [ ] Date Approved: [DATE]

**Status:** Draft / Approved
````

### 7.3 RCA Scheduling (Team Lead Responsibility)

**Within 24 hours of Red incident:**

1. Open `incidents/` directory
2. Create new file: `incidents/[INCIDENT-ID]-postmortem.md` (copy template above)
3. Schedule meeting: Incident Commander + Primary Engineer + CTO + relevant on-call
4. Duration: 30–45 min
5. Post document link in Slack #incident-command after meeting

---

## Part 8: Quick-Reference Laminate Cards

### 8.1 Paging Checklist (Laminate & Post at Desk)

```
═══════════════════════════════════════════════════════════
🔔 I RECEIVED A PAGE IN #on-call-paging — QUICK START
═══════════════════════════════════════════════════════════

□ Step 1:  READ the page carefully (severity? service? what failed?)
□ Step 2:  REPLY with ✅ + ETA (e.g., "✅ ETA 2 min, investigating")
□ Step 3:  ASSESS severity using decision tree (see reverse side)
□ Step 4:  START investigation (Cloud Logs, runbook link)
□ Step 5:  POST status update every 5 min (no longer than 30 sec)
□ Step 6:  DECIDE action (hotfix / rollback / scale / escalate)
□ Step 7:  EXECUTE decision (deploy with 2-person review if Yellow)
□ Step 8:  VERIFY metrics return to baseline
□ Step 9:  DECLARE resolution (post ✅ INCIDENT RESOLVED)
□ Step 10: SCHEDULE RCA (within 48h for Yellow+)

───────────────────────────────────────────────────────────

Time Elapsed: _____ min | Severity: 🟢/🟡/🔴/⚫ | Status: ✅/🔄/❌

CLOUD LOGS CONSOLE: https://console.cloud.google.com/logs/query
GCP PROJECT: hmatologia2 | REGION: southamerica-east1
```

### 8.2 Severity Decision Matrix (Laminate & Post at Desk)

```
═══════════════════════════════════════════════════════════
🔴 SEVERITY DECISION MATRIX — 30-SECOND ASSESSMENT
═══════════════════════════════════════════════════════════

⚫ FIRST CHECK: Data Loss OR Security Breach?
  ├─ YES: ⚫ BLACK — Page all hands + legal (2 min SLA)
  └─ NO: Continue below

🔴 SECOND CHECK: Audit Trail Down OR >10% Users Can't Work?
  ├─ YES: 🔴 RED — Page all hands, update every 5 min (5 min SLA)
  └─ NO: Continue below

🟡 THIRD CHECK: 1–10% Users OR Feature Down OR Batch Failed?
  ├─ YES: 🟡 YELLOW — Page primary + secondary, notify CTO (15 min SLA)
  └─ NO: Continue below

🟢 FOURTH CHECK: <1% Users AND No SLA Breach?
  ├─ YES: 🟢 GREEN — Page primary only (1h SLA)
  └─ NO: UNSURE? → Escalate up (page CTO)

───────────────────────────────────────────────────────────

UNCERTAIN? Ask:
  1. How many % of users affected?
  2. How long until SLA breach?
  3. Is data safe? Is audit trail recording?
  → If ANY answer points to Red/Black → ESCALATE UP
```

### 8.3 Runbook Quick Links (Print & Bookmark)

```
═══════════════════════════════════════════════════════════
📚 RUNBOOK QUICK LINKS — INCIDENT RESPONSE
═══════════════════════════════════════════════════════════

Error Rate Spike (>1%):
  docs/runbooks/error-rate-spike.md

P99 Latency (>5s):
  docs/runbooks/p99-latency-investigation.md

Firestore Quota (>80%):
  docs/runbooks/firestore-quota-breach.md

Function Memory/CPU OOM:
  docs/runbooks/function-memory-leak.md

Auth Degradation (2FA, tokens):
  docs/runbooks/auth-degradation.md

Hosting/CDN Down (5xx):
  docs/runbooks/hosting-outage.md

Audit Trail Not Recording:
  docs/runbooks/audit-trail-corruption.md

Data Loss / Signature Corruption:
  docs/runbooks/data-loss-recovery.md

Security Incident:
  docs/runbooks/security-breach-response.md

Regulatory/Audit Alert:
  docs/runbooks/regulatory-alert-escalation.md

───────────────────────────────────────────────────────────

MONITORING CONSOLES:

Cloud Logs:       https://console.cloud.google.com/logs/query
GCP Console:      https://console.cloud.google.com/
Firebase Console: https://console.firebase.google.com/project/hmatologia2
Slack #prod-*:    [Workspace name]
```

---

## Part 9: Execution Checklist for Team Lead

### 9.1 Before v1.4 Launch (2026-05-20)

**Completion Status:** Track with checkboxes below

#### Week 1: Setup (2026-05-13 – 2026-05-15)

- [ ] **Identify on-call members** (8 people: 4 Primary, 4 Secondary)
- [ ] **Collect contact info** (phone, email, Slack handle) for each person
- [ ] **Verify phone numbers** work (test SMS/call to each)
- [ ] **Create Slack channels:**
  - [ ] `#on-call-paging`
  - [ ] `#production-alerts`
  - [ ] `#production-emergency`
  - [ ] `#incident-command`
- [ ] **Set channel permissions** (private, invite relevant members)
- [ ] **Create Slack workflow** for `/incident-page` shortcut

#### Week 2: Calendar & Training (2026-05-16 – 2026-05-18)

- [ ] **Generate Google Calendar iCal file** (edit template, save as `.ics`)
- [ ] **Share calendar** with all on-call members (email or Drive link)
- [ ] **Verify calendar import** worked for all members (spot-check 2–3 people)
- [ ] **Create runbook directory:** `docs/runbooks/`
- [ ] **Copy runbook template** to `docs/runbooks/RUNBOOK_TEMPLATE.md`
- [ ] **Create 10 incident runbooks** (assign each to an engineer):
  - [ ] error-rate-spike.md
  - [ ] p99-latency-investigation.md
  - [ ] firestore-quota-breach.md
  - [ ] function-memory-leak.md
  - [ ] auth-degradation.md
  - [ ] hosting-outage.md
  - [ ] audit-trail-corruption.md
  - [ ] data-loss-recovery.md
  - [ ] security-breach-response.md
  - [ ] regulatory-alert-escalation.md
- [ ] **Review runbooks** (CTO spot-check 2–3)
- [ ] **Create `incidents/` directory** for post-mortem documents
- [ ] **Copy post-mortem template** to `incidents/POSTMORTEM_TEMPLATE.md`

#### Week 3: Team Training (2026-05-19)

- [ ] **Schedule training session** (60 min, all on-call members)
- [ ] **Agenda:**
  - [ ] 10 min: Severity matrix (Green/Yellow/Red/Black)
  - [ ] 10 min: Paging protocol (#on-call-paging page format)
  - [ ] 10 min: Escalation tree (decision flowchart)
  - [ ] 10 min: Slack channels (which to use, when)
  - [ ] 10 min: Runbook walkthrough (error-rate-spike example)
  - [ ] 10 min: Mock incident drill (page primary, ACK, resolve)
- [ ] **Print & distribute quick-ref cards** (laminate these):
  - [ ] Paging Checklist
  - [ ] Severity Decision Matrix
  - [ ] Runbook Quick Links
- [ ] **CTO briefing** on decision authority (Part 3.2 of v1.4-INCIDENT_RESPONSE_CONTACTS.md)
- [ ] **Mock incident drill** (test Slack page, ACK response, status updates)
- [ ] **Verify contact tree** filled in (all names, phones, emails, Slack handles)

#### Launch Day (2026-05-20 00:00 BRT)

- [ ] **Confirm W1 Primary + Secondary are ready** (both confirmed via Slack)
- [ ] **Verify Cloud Logs access** for on-call members (test query)
- [ ] **Verify Firebase Console access** for on-call members
- [ ] **Post "Go Live" message** in `#on-call-paging`:

  ```
  🚀 HC QUALITY V1.4 LAUNCH — ON-CALL ACTIVE

  W1 (2026-05-20 – 2026-05-26)
  Primary: [Name A] — @[handle]
  Secondary: [Name A2] — @[handle]

  Status: 🟢 All systems nominal. Monitoring active.
  Handoff: Friday 2026-05-24 18:00 BRT

  If incident: Use /incident-page shortcut or post format:
  🔔 @on-call-primary — INCIDENT PAGE
  [SEVERITY]: [SERVICE]
  [BRIEF DESCRIPTION]
  [RUNBOOK LINK or "SEE THREAD"]
  ```

### 9.2 Post-Launch (2026-05-20 – 2026-06-30)

- [ ] **First handoff** (Friday 2026-05-24 18:00 BRT)
  - [ ] Meeting held (Zoom recorded for training)
  - [ ] Handoff document posted in #on-call-paging
  - [ ] W2 primary + secondary confirmed ready

- [ ] **First incident post-mortem** (if any incident occurs)
  - [ ] RCA scheduled within 24h
  - [ ] Post-mortem written within 48h
  - [ ] Action items assigned and tracked

- [ ] **Weekly review** (every Friday 19:00 BRT, in #incident-command)
  - [ ] Incident count & severity split reviewed
  - [ ] MTTR metrics checked (target: Yellow+ <45 min)
  - [ ] Runbook updates needed (from incidents)
  - [ ] Contact tree validation (any changes?)
  - [ ] Team sentiment check (burnout? rotate out?)

- [ ] **Monthly review** (first Monday of each month, 60 min)
  - [ ] All incidents reviewed (Green/Yellow/Red/Black split)
  - [ ] Runbooks updated
  - [ ] Rotation adjusted if needed (burnout, skill gaps)
  - [ ] CTO + CEO briefed on trends

### 9.3 Ongoing Maintenance (Monthly)

- [ ] **Update contact tree** if people change phone/email
- [ ] **Refresh runbooks** after each incident (add new decision points if found)
- [ ] **Verify Slack channels** still have correct members
- [ ] **Review calendar** for next quarter (vacation blackouts?)
- [ ] **Test Cloud Logs access** for new team members
- [ ] **Review post-mortem action items** (close when complete)

---

## Part 10: Success Metrics & Monitoring

### 10.1 On-Call Health Metrics

**Track these metrics weekly; review in `#incident-command`:**

| Metric                        | Target | Yellow Alert | Red Alert |
| ----------------------------- | ------ | ------------ | --------- |
| Uptime                        | >99.5% | <99.5%       | <99%      |
| Incident Count (Yellow+/week) | <2     | ≥2           | ≥5        |
| MTTR (Yellow+, minutes)       | <45    | >60          | >120      |
| Primary ACK Time (minutes)    | <5     | >10          | >15       |
| Post-mortem Delay (hours)     | <48    | >48          | >72       |
| Team Sentiment (1–5)          | ≥4     | 3            | <3        |

**Actions if metric misses:**

- Yellow: Discuss in next handoff; plan improvement
- Red: Escalate to CTO; adjust rotation or process

### 10.2 Monthly On-Call Report (Template)

**Owner:** Team Lead  
**Frequency:** 1st Monday of each month  
**Location:** `#incident-command` (Slack message thread)

```
📊 ON-CALL HEALTH REPORT — [Month/Year]
═══════════════════════════════════════════════════

INCIDENT SUMMARY:
  Total Incidents: [#]
  Green: [#] | Yellow: [#] | Red: [#] | Black: [#]
  MTTR (Yellow+): [minutes]
  Uptime: [%]

ESCALATIONS:
  Secondary paged: [# times]
  CTO paged: [# times]
  CEO paged: [# times]
  Avg escalation time: [minutes]

TEAM HEALTH:
  Rotation members: [list]
  Sentiment (1–5): [#]
  Feedback: [if any]

ACTION ITEMS FROM INCIDENTS:
  [ ] Item 1 (due [DATE])
  [ ] Item 2 (due [DATE])

RUNBOOK IMPROVEMENTS:
  • Updated: [runbook name] (reason: [incident #])
  • Added: [new runbook type, if any]

NEXT MONTH FOCUS:
  • [Priority 1]
  • [Priority 2]

Signed: [Team Lead]
CTO Approved: [CTO Name] — Date: [DATE]
```

---

## Part 11: Links & References

### 11.1 Related Documents

- **Severity Matrix (detailed):** `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` § 1
- **Incident Commander Role:** `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` § 3
- **Decision Authority Matrix:** `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` § 3.3
- **Root CLAUDE.md:** Link to incident response section
- **Cloud Logs Monitoring Guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`

### 11.2 External Resources

- **Google Cloud Logs Console:** https://console.cloud.google.com/logs/query
- **Firebase Console:** https://console.firebase.google.com/project/hmatologia2
- **Slack Workflow Builder:** https://api.slack.com/workflows
- **Google Calendar iCal:** https://support.google.com/calendar/answer/37100

---

## Final Checklist: Ready to Launch?

```
⚠️  BEFORE ENABLING PRODUCTION ON-CALL (2026-05-20)

SETUP:
  [ ] Contact tree 100% filled (names, phone, email, Slack)
  [ ] Slack channels created (#on-call-paging, #production-alerts, #production-emergency, #incident-command)
  [ ] Slack workflow /incident-page working
  [ ] Google Calendar iCal imported + verified (all on-call members confirmed)

DOCUMENTATION:
  [ ] 10 runbooks created in docs/runbooks/
  [ ] Post-mortem template in incidents/POSTMORTEM_TEMPLATE.md
  [ ] Quick-reference cards printed + posted at desks
  [ ] This document (ON_CALL_ROTATION_SETUP.md) checked into repo

TRAINING:
  [ ] All on-call members trained on severity matrix (30 min, in-person or async)
  [ ] All on-call members trained on paging protocol (demos in Slack)
  [ ] Mock incident drill completed (on-call paged, ACK'd, updated status, resolved)
  [ ] CTO briefed on decision authority + escalation tree
  [ ] CEO notified (Black incident escalation path)

SYSTEMS:
  [ ] Cloud Logs accessible to all on-call members (test query)
  [ ] Firebase Console accessible to all on-call members (test read)
  [ ] Slack #on-call-paging notifications enabled (test page)

FINAL:
  [ ] This checklist signed off by Team Lead
  [ ] CTO approval obtained
  [ ] CEO aware of on-call handoff schedule
  [ ] First on-call rotation (W1) ready to go

─────────────────────────────────────────────────────

🟢 GO / 🟡 CONDITIONAL / 🔴 NO-GO

Status: _______________

Team Lead: _________________________ Date: __________

CTO Approval: _______________________ Date: __________
```

---

## Document Revision History

| Version | Date       | Author | Changes                                          |
| ------- | ---------- | ------ | ------------------------------------------------ |
| 1.0     | 2026-05-07 | CTO    | Initial creation — ready for team lead execution |

**Next Review:** 2026-06-30 (post-stabilization, Phase 1 complete)

---

**Status:** ✅ READY FOR TEAM LEAD EXECUTION (2026-05-13 start)
