# Phase 06 Plan 03: Incident Response System — Operational Callables & Docs — SUMMARY

**Phase:** 06-capa-incident-response  
**Plan:** 03 (Part 2)  
**Wave:** 2  
**Status:** COMPLETE  
**Date:** 2026-05-09

---

## Executive Summary

Plan 06-03 delivers a production-grade incident response system for HC Quality, operationalizing severity classification, on-call procedures, incident commander authority, crisis communication templates, and Cloud Function callables for lifecycle management. All infrastructure documented and team-ready.

**Key Deliverables:**

- 7 comprehensive incident response documentation files (SEVERITY_MATRIX, ON_CALL_ROTATION, INCIDENT_COMMANDER_AUTHORITY, RUNBOOK_LINKS, CONTACT_TREE, COMMUNICATION_TEMPLATES, POST_MORTEM_FRAMEWORK)
- 5 Cloud Function callables for incident management (createIncident, escalateIncident, closeIncident, recordPostMortem, softDeleteIncident)
- Multi-tenant incident types and service layer
- Blameless post-mortem framework
- RDC 978 + DICQ compliance alignment

---

## Completed Tasks

### Task 1: Severity Matrix & Response SLAs

**File:** `docs/incident-response/SEVERITY_MATRIX.md`

Defines 4-level incident classification with clear decision criteria:

| Level      | Impact                                 | SLA               | Example                                    |
| ---------- | -------------------------------------- | ----------------- | ------------------------------------------ |
| **Green**  | No patient impact, internal only       | Next business day | UI typo, dev environment broken            |
| **Yellow** | Some users affected, workaround exists | 4 hours           | Analytics slow, 5% exports failing         |
| **Red**    | Core workflow down, many users         | 1 hour            | Patient portal down, audit trail corrupted |
| **Black**  | System failure or patient safety risk  | Immediate         | Database inaccessible, data lost           |

**Decision Tree:** Flowchart for classifying incidents (patient data affected? → core workflow down? → non-critical system slow?)

**Escalation Rules:** Yellow→Red if unresolved 2h; Red→Black if data loss/patient safety risk.

**Response Time SLAs:** Detection → First Response → Resolution targets by severity.

---

### Task 2: On-Call Rotation & Contact Structure

**Files:**

- `docs/incident-response/ON_CALL_ROTATION.md`
- `docs/incident-response/CONTACT_TREE.md`

**On-Call Rotation:**

- 4-week cycle template (Primary IC + Backup IC per week)
- Role definitions: Primary IC responsibilities, Backup IC duties
- Shift handoff procedure (Friday 17:00 outgoing, Monday 09:00 incoming)
- Tools & access checklist (Cloud Console, Cloud Logs, Firestore, Functions, Deployment Keys, Runbooks)
- Escalation triggers (when to call Backup, when to escalate to CTO)
- Compensation framework (2 days off after on-call week, +0.5 day if backup called, +1 day if Black incident)

**Contact Tree (by severity):**

**Green:** Slack #dev-incidents only (async)

**Yellow:**

1. On-Call IC → Team Lead → Ops/DevOps
2. Timeline: T+5min declare Yellow, T+30min escalate if no progress, T+2h status update

**Red:**

1. IC → Backup IC → CTO → Eng Lead → Ops → Product Lead
2. Timeline: T+1min alert fires, T+5min confirm Red + group call, T+15min status update, T+30min escalate/resolve, every 30min updates
3. Customer notification: CTO decides

**Black:**

1. CTO → IC → Full team → Business/Legal → Auditor → Customer/ANVISA
2. Timeline: T+0 declared, T+1min emergency call, T+5min action plan, T+15min status, T+30min update, every 15min until resolved
3. No external communication without CTO sign-off

---

### Task 3: Incident Commander Authority

**File:** `docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md`

Defines IC scope and limits:

**IC CAN (Yellow-level authority):**

- Classify severity
- Activate on-call team + Backup IC
- Apply Yellow runbook (restart, retry)
- Deploy rollback if <15 min old
- Document timeline in incident log

**IC CAN (Red-level authority, added):**

- Hot-fix deployment (skip normal PR review)
- Database recovery from backup
- Function redeployment with canary
- Disable non-critical features
- Contact Backup IC / escalate to CTO if stuck ≥30min

**IC CAN (Black-level authority, added):**

- Execute full system restore from backup
- Declare SLA breach to customers (subject to CTO confirmation)
- Authorize external communication prep

**IC CANNOT (requires CTO):**

- Contact customers/external parties directly (CTO decides messaging)
- Contact auditor/regulatory authority (Legal + CTO)
- Delete customer data (only soft-delete flagging)
- Disable authentication/security rules
- Accept permanent data loss (must attempt restore)
- Deploy code not in git history
- Override Firestore Rules security

**Decision Criteria:**

- Yellow→Red: >10% affected, no workaround, >30 min to resolve
- Red→Black: data loss, corruption, patient safety risk, unable to restore

**IC Examples (real scenarios):**

1. Function timeout → escalate → CTO OKs Rules index → deploy index → recover
2. Laudo release 403 → identify Rules permissioning → hot-fix deploy → resolve
3. Database replication failure → CTO decides data loss acceptance → restore from backup

---

### Task 4: Runbooks, Communication, Post-Mortem

**Files:**

- `docs/incident-response/RUNBOOK_LINKS.md`
- `docs/incident-response/COMMUNICATION_TEMPLATES.md`
- `docs/incident-response/POST_MORTEM_FRAMEWORK.md`

**Runbook Index (8+ critical procedures):**

| Scenario               | Severity | Trigger            | MTTR Target    | Actions                                                     |
| ---------------------- | -------- | ------------------ | -------------- | ----------------------------------------------------------- |
| Function timeout       | Yellow   | >5s response       | 15 min         | Check recent deploy, restart, or increase timeout           |
| Database unavailable   | Red      | Connection fails   | 30 min         | Check Firebase status, region status, fallback to read-only |
| Auth service down      | Red      | Login failures     | 15 min         | Check Firebase Auth, app code, secret rotation              |
| Firestore Rules broken | Red      | Permission denied  | 20 min         | Revert Rules from history, or re-deploy with syntax check   |
| Data corruption        | Black    | Audit chain broken | 1 hour restore | DO NOT DELETE, escalate to CTO, restore from backup         |
| NOTIVISA API failure   | Red      | Gov endpoint down  | 30 min         | Check gov status, escalate to CTO for communications        |

Each runbook includes: trigger detection, IC actions, prevention, and workarounds.

**Communication Templates (4+ standard messages):**

1. **Customer Incident Notice** (Yellow/Red <1h outage)
   - Subject: Service Interruption — [Timestamp] [Duration]
   - Sections: What happened, What was affected, What we did, Next steps, Contact

2. **Regulatory Incident Report** (Black / Data Loss)
   - To: ANVISA contact, Auditor
   - Includes: Incident ID, Timeline, RDC compliance impact, Corrective actions, POC

3. **Internal Escalation Alert** (Red Incident)
   - To: @oncall Slack channel
   - Format: Severity badge, Impact statement, Current status, ETA, Who's involved, Links

4. **Post-Mortem Announcement** (After Resolve)
   - To: Customer
   - Sections: Root cause, Why it happened, What we're doing, Action items, Apology, ETA

**Approval Chain:** IC drafts message within 1h of resolve → CTO reviews + approves → Legal reviews (if data loss) → Send within 4h of resolve.

**Post-Mortem Framework (Blameless Review):**

**Pre-Mortem Checklist:**

- [ ] Incident formally closed
- [ ] Root cause identified
- [ ] Workaround removed
- [ ] All logs preserved (don't delete Cloud Logs)
- [ ] Key participants identified (3-5 engineers)
- [ ] Slack thread link preserved
- [ ] Timeline documented (T+0, T+5min, T+15min, etc.)
- [ ] Customer notification sent
- [ ] Action items drafted (2-3 improvements)

**Post-Mortem Meeting (60 min):**

1. **Welcome + Blameless Reminder (5 min)** — "This is about systems, not blame"
2. **Timeline Reconstruction (15 min)** — IC reads timeline, participants correct details
3. **Root Cause Analysis (15 min)** — Use "5 Whys" to dig to fundamental cause
4. **Contributing Factors (10 min)** — List what made incident worse (monitoring, access, runbook quality)
5. **Response Quality (5 min)** — What responders did well, IC decision quality
6. **Action Items (10 min)** — List 2-3 concrete improvements, assign owner, ETA

**Post-Mortem Document Template:**

- Timeline table (T+X: Event)
- Root Cause (1-2 paragraphs)
- Contributing Factors (bulleted)
- Response Quality assessment
- Action Items table (Item, Owner, ETA, Status)

**Cadence:** Same-day post-mortem for Red/Black, next-day for Yellow. Action item review weekly in standup. Close-out once all actions complete.

**Why Blameless:** Engineer honest about mistake → team learns faster. Psychological safety → people report issues earlier. Systems improve → we fix process, not punish person.

---

## Cloud Function Callables

### Types & Service Layer

**File:** `src/features/admin/incident-response/types.ts`

**Type Definitions:**

- `SeverityLevel`: 'green' | 'yellow' | 'red' | 'black' (with Zod schema)
- `IncidentStatus`: 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed' (with Zod schema)
- `EscalationLevel`: 'internal' | 'team' | 'leadership' | 'legal' (with Zod schema)

**Main Interface: Incident**

```typescript
{
  // Identity
  id: string; labId: string;

  // Basics
  title: string; description: string;

  // Severity & Status
  severity: SeverityLevel;
  status: IncidentStatus;

  // Timeline
  startedAt: Timestamp; resolvedAt?: Timestamp;
  declaredAt: Timestamp;

  // Who
  declaredBy: string; (operator ID, IC)
  declaredByName?: string;

  // Impact
  affectedSystems: string[]; (e.g., ['laudo-release', 'analytics'])
  affectedUserCount: number;
  affectedFeatures: string[];

  // Response
  runbookApplied?: string;
  escalationLevel: EscalationLevel;
  estimatedMTTR?: number; (minutes)
  actualMTTR?: number; (calculated after resolve)

  // Post-mortem
  postMortemScheduledAt?: Timestamp;
  postMortemDocLink?: string; (URL to Google Doc or Slack thread)

  // Audit
  criadoEm: Timestamp;
  criadoPor: string;
  deletadoEm?: Timestamp;
}
```

**Subcollections:**

- `actions` — IncidentAction (action taken, result, notes)
- `post-mortem-actions` — PostMortemAction (improvement item, owner, ETA, status)

**Helper Functions:**

- `isValidStatusTransition(from, to)` — validates state machine
- `isValidSeverityEscalation(from, to)` — prevents downgrade
- `getEscalationLevelBySeverity(severity)` — maps severity to escalation level
- `getSLAMinutes(severity)` — returns response SLA

**Input DTOs (Zod-validated):**

- `CreateIncidentInput` — title, description, severity, affected systems, user count, features, estimated MTTR
- `UpdateIncidentStatusInput` — new status, notes, actual MTTR
- `EscalateIncidentInput` — new severity, reason
- `RecordPostMortemInput` — doc link, action items

### Service Layer

**File:** `src/features/admin/incident-response/services/incidentService.ts`

**Callable Wrappers (all use httpsCallable):**

1. **createIncident(labId, input)** → CreateIncidentResponse
   - Calls Cloud Function `createIncident`
   - Returns incidentId + auditEntryId
   - Error handling: validation, auth, creation failure

2. **escalateIncident(labId, incidentId, input)** → void
   - Calls Cloud Function `escalateIncident`
   - Validates severity escalation
   - Error handling: not found, invalid escalation, auth

3. **closeIncident(labId, incidentId, notes)** → void
   - Calls Cloud Function `closeIncident`
   - Calculates MTTR
   - Error handling: not found, invalid state

4. **recordPostMortem(labId, incidentId, input)** → void
   - Calls Cloud Function `recordPostMortem`
   - Stores doc link + action items
   - Error handling: not found, duplicate

5. **softDeleteIncident(labId, incidentId)** → void
   - Calls Cloud Function `softDeleteIncident`
   - Sets `deletadoEm` timestamp (RN-06 convention)
   - Error handling: not found, not admin

**Read Helpers:**

6. **getIncident(labId, incidentId)** → Incident
   - One-time fetch via getDoc (not real-time)

7. **getIncidentActions(labId, incidentId)** → IncidentAction[]
   - Fetches actions subcollection
   - Ordered by takenAt (asc)

8. **subscribeIncidents(labId, options, callback)** → Unsubscribe
   - Real-time listener with optional filters (status, severity, limit)
   - **IMPORTANT:** Caller must unsubscribe in useEffect cleanup

9. **listIncidents(labId, maxResults)** → Incident[]
   - One-time paginated fetch (not real-time)

10. **formatIncidentForDisplay(incident)** → formatted object
    - Helper for view layer (date formatting, MTTR display)

### Cloud Functions

**File:** `functions/src/modules/incident.ts`

**5 Callables (v2 API, server-sealed via auth checks):**

1. **createIncident(data, request)**
   - Validates input (Zod schema)
   - Checks authentication + lab membership (RT/admin/auditor role)
   - Creates incident doc in `labs/{labId}/incidents/{incidentId}`
   - Calculates escalation level from severity
   - Logs to Cloud Logs for monitoring
   - Returns incidentId
   - Errors: UNAUTHENTICATED, MISSING_LAB_ID, INSUFFICIENT_ROLE, VALIDATION_ERROR

2. **escalateIncident(data, request)**
   - Validates escalation input + severity progression
   - Checks auth + lab membership
   - Updates incident severity + escalationLevel
   - Auto-transitions status to 'investigating'
   - Adds action log (escalation reason)
   - Logs to Cloud Logs
   - Returns { escalated: true }
   - Errors: NOT_LAB_MEMBER, INVALID_ESCALATION, NOT_FOUND

3. **closeIncident(data, request)**
   - Checks auth + lab membership
   - Calculates MTTR (milliseconds → minutes)
   - Updates incident status to 'resolved' + resolvedAt timestamp
   - Adds action log (closure notes)
   - Logs MTTR to Cloud Logs
   - Returns { closed: true, mttr: number }
   - Errors: NOT_FOUND, UNAUTHENTICATED

4. **recordPostMortem(data, request)**
   - Validates post-mortem input (doc link, action items)
   - Checks auth + lab membership
   - Updates incident status to 'closed' + postMortemDocLink
   - Stores action items as subcollection `post-mortem-actions/{actionId}`
   - Logs count of actions to Cloud Logs
   - Returns { recorded: true }
   - Errors: VALIDATION_ERROR, NOT_FOUND, UNAUTHENTICATED

5. **softDeleteIncident(data, request)**
   - Checks auth + lab membership (admin)
   - Sets `deletadoEm` timestamp (RN-06 soft-delete convention)
   - Logs to Cloud Logs
   - Returns { deleted: true }
   - Errors: NOT_LAB_MEMBER, NOT_FOUND, UNAUTHENTICATED

**Shared Helpers:**

- `assertAuthenticated(request)` — returns userId or throws UNAUTHENTICATED
- `assertLabMember(labId, userId, role?)` — validates active membership
- `handleError(error)` — maps Zod + CallableError + generic errors to HttpsError

**Error Handling:**

- Custom `CallableError` class (code, message, details)
- Zod validation errors → 'invalid-argument'
- Auth errors → 'unauthenticated'
- Other errors → 'internal'
- All errors logged to Cloud Logs with context

**Audit Trail:**

- All incident writes include operatorId + timestamp
- Action logs preserve who did what when
- Post-mortem actions tracked with owner + ETA + status

---

## Compliance Mapping

### RDC 978 Articles

- **Art. 6:** Regulatory reporting — incident system enables NOTIVISA/ANVISA notifications (Template 2)
- **Art. 39:** Record keeping — incidents stored in Firestore with soft-delete audit trail
- **Art. 86:** Risk management — FMEA-lite post-mortem identifies systemic risks
- **Art. 99:** CAPA procedures — post-mortem action items tracked with owner/ETA (links to CAPA module)
- **Art. 127:** Nonconformity records — incidents = nonconformities; all logged + audited
- **Art. 128:** Audit trail integrity — incident system itself is part of audit trail; Black incidents trigger integrity checks

### DICQ Articles

- **4.14.1:** Corrective action procedures — post-mortem framework (blameless, RCA, action items)
- **4.14.6:** Risk management — incident escalation criteria align with risk severity
- **4.15:** Management review — IC decision authority + CTO sign-off on Black incidents
- **4.3.3:** Competence — on-call IC role requires documented authority scope

---

## Known Limitations & Future Work

**Phase 6 Next Steps:**

1. Ops team fills in CONTACT_TREE.md with actual names + phone numbers + email (checkpoint)
2. Firestore Rules deployment for `labs/{labId}/incidents` collection (read access: admin/rt/auditor)
3. Slack integration for #incidents + #incidents-followup channels (notification on create/escalate/close)
4. Cloud Monitoring dashboards for incident detection (latency, error rates, SLA tracking)
5. Incident metrics dashboard in admin UI (open incidents, SLA compliance, MTTR trends)

**Phase 7+ Opportunities:**

- Pagerduty integration (auto-escalation, duty calendar)
- Automated incident creation from Cloud Logs anomaly detection
- Incident trend analysis (frequency by system, seasonal patterns)
- Post-mortem effectiveness tracking (% action items completed, time-to-fix improvement)

---

## Files Delivered

| File                                                               | Purpose                                                                                                          | Status                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `docs/incident-response/SEVERITY_MATRIX.md`                        | 4-level classification + decision tree + SLAs                                                                    | ✅ COMPLETE                    |
| `docs/incident-response/ON_CALL_ROTATION.md`                       | 4-week rotation template + role definitions + escalation                                                         | ✅ COMPLETE (ops team to fill) |
| `docs/incident-response/CONTACT_TREE.md`                           | Notification tree by severity + contact table                                                                    | ✅ COMPLETE (ops team to fill) |
| `docs/incident-response/INCIDENT_COMMANDER_AUTHORITY.md`           | IC scope, decision criteria, examples                                                                            | ✅ COMPLETE                    |
| `docs/incident-response/RUNBOOK_LINKS.md`                          | Index of 8+ critical procedures + full runbooks                                                                  | ✅ COMPLETE                    |
| `docs/incident-response/COMMUNICATION_TEMPLATES.md`                | Customer, regulatory, internal, post-mortem messages                                                             | ✅ COMPLETE                    |
| `docs/incident-response/POST_MORTEM_FRAMEWORK.md`                  | Blameless review process + agenda + template                                                                     | ✅ COMPLETE                    |
| `src/features/admin/incident-response/types.ts`                    | Incident, SeverityLevel, EscalationLevel, IncidentAction, PostMortemAction + helpers                             | ✅ COMPLETE                    |
| `src/features/admin/incident-response/services/incidentService.ts` | Service layer with 10 methods (create, escalate, close, record post-mortem, soft-delete, subscribe, list, fetch) | ✅ COMPLETE                    |
| `functions/src/modules/incident.ts`                                | 5 Cloud Function callables (v2 API) + helpers + error handling                                                   | ✅ COMPLETE                    |

---

## Success Criteria Met

- [x] All 4 severity levels defined (Green/Yellow/Red/Black) with clear decision criteria
- [x] On-call rotation template created (4-week cycle, role definitions, escalation triggers)
- [x] Incident Commander authority scope documented (CAN/CANNOT, decision examples)
- [x] Runbook index with 8+ critical procedures (function timeout, DB unavailable, auth down, Rules broken, data corruption, NOTIVISA failure, etc.)
- [x] Contact tree showing who to notify at each severity level
- [x] 4+ communication templates (customer notification, regulatory report, internal escalation, post-mortem announcement)
- [x] Post-mortem framework (blameless, timeline, RCA, action tracking)
- [x] Cloud Function callables: createIncident, escalateIncident, closeIncident, recordPostMortem, softDeleteIncident
- [x] Multi-tenant incident types (SeverityLevel, IncidentStatus, EscalationLevel, Incident interface)
- [x] Service layer with real-time listeners + pagination
- [x] Zod input validation on all callables
- [x] Auth checks (user auth + lab membership + role validation)
- [x] Error handling with specific error codes
- [x] Cloud Logs integration for monitoring
- [x] RDC 978 + DICQ compliance alignment documented

---

## Deviations from Plan

None — plan executed exactly as specified.

---

## Commits Included

- `07ff289` docs(06-03-A2): incident response operational runbooks (Part 1)
- `81c5981` feat(06-capa): Firestore Rules and Indexes (includes incident collection rules)
- Previous: types.ts, incidentService.ts, all documentation committed in prior agents (06-03-A1, 06-03-A2)

---

## Next Steps (Phase 6 Continuation)

1. **Ops Team:** Fill in `ON_CALL_ROTATION.md` and `CONTACT_TREE.md` with actual contact details
2. **Firestore Rules:** Deploy rules for incident collection read access (admin/rt/auditor only, soft-delete filter)
3. **Slack Integration:** Set up @oncall mentions + channel notifications
4. **Admin UI:** Build incident dashboard (list, create, escalate, close, post-mortem link)
5. **Monitoring:** Cloud Logs filters for incident detection (P1/P2/P3 severity)
6. **Testing:** E2E tests for incident lifecycle (create → escalate → close → post-mortem)
7. **Training:** Team walkthrough of runbooks + decision tree before go-live

---

**Prepared by:** Executor Agent  
**Execution Date:** 2026-05-09T00:00:00Z  
**Phase Status:** READY FOR DEPLOYMENT (pending ops team contact details + Firestore Rules deployment)
