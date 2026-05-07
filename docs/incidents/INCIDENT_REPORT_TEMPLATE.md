---
title: "Incident Report Template — v1.4 Launch"
version: "1.0"
instructions: "Copy this file, rename to YYYY-MM-DD-incident-name.md, fill during/after incident"
created: "2026-05-07"
---

# Incident Report: [Service Name] — [Date] [INCIDENT-ID]

**Report prepared by:** _________________________ (your name)  
**Date filed:** _________________________  
**Filing time (24h):** _________________________  
**Approval by CTO:** ☐ YES ☐ NO  
**Approval by QA:** ☐ YES ☐ NO  

---

## Executive Summary

### Quick Facts

| Field | Value |
|-------|-------|
| **Incident ID** | INC-2026-05-XX-### |
| **Service affected** | [Portal / NOTIVISA / Auth / Laudo Draft / Other] |
| **Severity** | P0 / P1 / P2 |
| **Duration** | [HH:MM] (discovery → resolution) |
| **Start time (UTC-3)** | 2026-05-XX HH:MM |
| **End time (UTC-3)** | 2026-05-XX HH:MM |
| **Total duration** | _____ minutes |
| **Root cause** | [1–2 sentences, plain English] |
| **Resolution method** | Hotfix deployed / Rollback executed / Configuration change / Other |
| **Affected users** | [Number or "All"] |
| **Data impact** | None / Audit trail gap / Incomplete signature / Data corruption / Other |
| **Customer notification required?** | ☐ YES ☐ NO |
| **RDC 978 violation risk?** | ☐ YES ☐ NO (if YES, notify Regulatory Officer) |

### Impact Summary

```
System: [Name] → Status: [DOWN / DEGRADED / PARTIAL / OTHER]
Users: [N affected out of M total]
Business impact: [Brief impact statement]
Data integrity: [Compromised? Verified clean? Recovery needed?]
```

---

## Timeline

### Discovery & Notification

| Time | Event | Reporter | Notes |
|------|-------|----------|-------|
| HH:MM | Issue discovered | [Name] | [Description: what was noticed?] |
| HH:MM | Report filed to Slack #incidents | [Name] | [Link to Slack thread] |
| HH:MM | P0/P1/P2 declared | [CTO/Lead] | [Reasoning] |
| HH:MM | War room activated (or status update queued) | [CTO] | [Video bridge link if applicable] |

### Investigation

| Time | Event | Owner | Duration | Findings |
|------|-------|-------|----------|----------|
| HH:MM | Initial assessment started | [Name] | [mins] | [What was checked?] |
| HH:MM | Cloud Logs reviewed | [Backend] | [mins] | [Error patterns?] |
| HH:MM | Firestore checked for data integrity | [Backend] | [mins] | [Corruption? Missing data?] |
| HH:MM | Root cause identified | [Owner] | [mins] | [Exact root cause statement] |

### Mitigation & Resolution

| Time | Event | Owner | Action | Result |
|------|-------|-------|--------|--------|
| HH:MM | Decision made | [CTO] | Forward fix OR Rollback | [Decision rationale] |
| HH:MM | Fix deployed / Rollback initiated | [DevOps] | [What changed?] | [Green / Red] |
| HH:MM | Post-fix testing started | [QA] | Smoke tests | [Number of tests run] |
| HH:MM | All-clear signal given | [CTO] | System stable | [Confidence level] |

### Post-Resolution

| Time | Event | Owner | Notes |
|------|-------|-------|-------|
| HH:MM | Incident report started | [Tech Writer] | [Time to first draft] |
| HH:MM | Follow-up PR created (if needed) | [Engineer] | [Link to PR] |
| HH:MM | Root cause review completed | [CTO] | [Approval] |
| HH:MM | Team debriefing held | [CTO] | [Attendance, key takeaways] |

---

## Root Cause Analysis

### What Happened (Narrative)

[Write a clear, chronological account of events. Explain:
- What the user / system detected
- What was initially suspected
- What was actually wrong
- How long before root cause was confirmed
]

**Key technical details:**
- [Code change that introduced issue, if applicable]
- [Configuration that was wrong, if applicable]
- [External service behavior (Twilio, Gemini, Firebase), if applicable]
- [Data state that triggered the issue, if applicable]

---

### Why It Happened (Root Cause)

[Statement of the actual root cause — be specific, not vague. Example:]

> "The `rtPortalLogin` callable was calling `sendEmail()` synchronously, blocking on Twilio API timeout. When Twilio degraded to 10-second latency (external issue), users saw 'request timeout' after 30 seconds. Root cause: synchronous call should have been async + queued."

[If multiple contributing factors, list each:]
1. [Factor 1]
2. [Factor 2]
3. [Factor 3]

---

### Contributing Factors (Check All That Apply)

- [ ] **Code change** — A PR deployed that introduced this
  - [ ] Test coverage was insufficient
  - [ ] Test was added but didn't catch this scenario
  - [ ] Code was reviewed but issue missed
  - [ ] Merge conflict not resolved correctly
  - [ ] Type checking didn't catch this

- [ ] **Dependency conflict**
  - [ ] Package version mismatch
  - [ ] Breaking API change in library
  - [ ] Native module incompatibility

- [ ] **Cloud quota or limit**
  - [ ] Firebase Firestore write quota exceeded
  - [ ] Function invocation quota hit
  - [ ] Cloud Logs ingestion quota exceeded
  - [ ] Firebase Storage transfer limit

- [ ] **Configuration missing or wrong**
  - [ ] Environment variable not set (e.g., `NOTIVISA_API_KEY`)
  - [ ] Firebase secret not provisioned
  - [ ] Firestore rule didn't deploy
  - [ ] Function package.json dependency missing

- [ ] **Third-party service issue**
  - [ ] Twilio degraded / rate limiting
  - [ ] Gemini API timeout
  - [ ] Google Cloud service unavailable
  - [ ] NOTIVISA API responding slowly

- [ ] **Infrastructure issue**
  - [ ] Database connection pool exhausted
  - [ ] Firestore experiencing latency
  - [ ] Network packet loss or jitter
  - [ ] Regional outage

- [ ] **Human error**
  - [ ] Manual configuration change that wasn't tested
  - [ ] Accidental deletion or modification
  - [ ] Incomplete deploy (skipped a layer)
  - [ ] Wrong secrets deployed to wrong project

- [ ] **Data state issue**
  - [ ] Unexpected data condition triggered code path
  - [ ] Audit trail in inconsistent state
  - [ ] Firestore document missing required field

- [ ] **Monitoring / alerting gap**
  - [ ] No alert fired (should have)
  - [ ] Alert fired but was ignored
  - [ ] No visibility into this component

- [ ] **Other:** _________________________________________________________________

---

## Prevention & Remediation

### Immediate Actions (0–24 hours, already completed)

- [ ] Applied **hotfix** / confirmed **rollback** stable
  - [ ] Commit hash: _________________________
  - [ ] Deploy time: _________________________

- [ ] **Updated tests** to prevent regression
  - [ ] Test added / updated: _________________________
  - [ ] Test covers scenario: [Describe]
  - [ ] Test passes: ☐ YES

- [ ] **Notified team** of issue + fix
  - [ ] Slack update posted: ☐ YES
  - [ ] Email sent to on-call: ☐ YES

- [ ] **Verified fix** in production
  - [ ] Smoke tests passed: ☐ YES
  - [ ] Manual testing passed: ☐ YES
  - [ ] No new errors in Cloud Logs: ☐ YES

### Short-term Actions (1–7 days)

- [ ] **Pre-deploy gate enhanced**
  - [ ] What was added: _________________________
  - [ ] Gate now prevents this: ☐ YES
  - [ ] Gate implemented: ☐ YES
  - [ ] PR: _________________________

- [ ] **Monitoring improved**
  - [ ] New alert added: _________________________
  - [ ] Alert threshold: _________________________
  - [ ] Alert tested: ☐ YES

- [ ] **Documentation updated**
  - [ ] Runbook revised: [Path]
  - [ ] Troubleshooting guide added: [Path]
  - [ ] Team meeting held to share: ☐ YES

- [ ] **Code refactored** to reduce brittleness
  - [ ] Refactor PR: _________________________
  - [ ] Changes reduce future risk: [Explain]

### Long-term Actions (1–4 weeks)

- [ ] **Architectural change**
  - [ ] Design: _________________________
  - [ ] Why it prevents recurrence: _________________________
  - [ ] Effort estimate: _________________________
  - [ ] Scheduled for: [Phase / Sprint]

- [ ] **Test coverage improved**
  - [ ] New E2E test added: _________________________
  - [ ] Test covers: [Scenario]
  - [ ] Test passing: ☐ YES

- [ ] **On-call training**
  - [ ] Topic: _________________________
  - [ ] Owner: _________________________
  - [ ] Scheduled: ☐ YES Date: _________________________

- [ ] **Dependency upgrade**
  - [ ] Old version: _________________________
  - [ ] New version: _________________________
  - [ ] Reason for upgrade: _________________________
  - [ ] Scheduled for: [Phase]

---

## Lessons Learned

### What Went Well

- [ ] Team responded quickly
- [ ] Root cause found in < X minutes
- [ ] Rollback plan worked flawlessly
- [ ] Communication was clear + timely
- [ ] QA caught issue during initial testing
- [ ] Firestore data integrity verified
- [ ] Cloud Logs made debugging easy
- [ ] No customer complaints escalated
- [Other: _________________________]

### What We'll Do Differently Next Time

- [ ] **Add this test scenario** — [Describe what test should catch]
- [ ] **Improve this pre-deploy gate** — [Describe improvement]
- [ ] **Escalate earlier** — [When should we have called CTO?]
- [ ] **Better monitoring** — [What alert should have fired?]
- [ ] **Documentation** — [What runbook should be clearer?]
- [ ] **Team training** — [What skill gap was exposed?]
- [Other: _________________________]

### Team Feedback

**Quote from team member on what worked:**
> "[Quote about positive aspect of incident handling]"

**Quote from team member on what could improve:**
> "[Quote about area for improvement]"

---

## Data Integrity Verification

### Firestore Audit Trail Check

**Performed by:** _________________________ (QA or Backend Lead)  
**Date checked:** _________________________

- [ ] Audit trail collection not affected
- [ ] All writes during incident have signatures
- [ ] All timestamps correct (not null, not future-dated)
- [ ] Operand IDs match request.auth.uid
- [ ] No corrupt documents (verified sample of 10)
- [ ] Document count consistent with expected
- [ ] No unexplained deletions

**Sample verification (10 random documents):**

| Doc ID | Signature present? | Timestamp valid? | Operator match? |
|--------|-------------------|------------------|-----------------|
| _____________________________ | ☐ YES | ☐ YES | ☐ YES |
| _____________________________ | ☐ YES | ☐ YES | ☐ YES |
| _____________________________ | ☐ YES | ☐ YES | ☐ YES |
| [etc.] | | | |

**Result:** ☐ CLEAN ☐ NEEDS INVESTIGATION

**If investigation needed:** [Describe what was found, remediation taken]

---

## Compliance & Regulatory Impact

### RDC 978 Assessment

**Does this incident expose an RDC 978 compliance gap?** ☐ YES ☐ NO

If YES, which article(s)?
- [ ] Art. 5.3 (Audit trail requirement)
- [ ] Art. 6 (Notification to ANVISA)
- [ ] Art. 115–117 (Critical values escalation)
- [ ] Art. 167 (Laudo release)
- [ ] Other: _________________________

**Regulatory Officer notified?** ☐ YES ☐ NO  
**NOTIVISA notification required?** ☐ YES ☐ NO  
**Legal review completed?** ☐ YES ☐ NO  

---

### LGPD Assessment

**Does this incident expose personal data?** ☐ YES ☐ NO

If YES:
- [ ] Customer notification required (Art. 18)
- [ ] Data Protection Officer informed
- [ ] Incident report filed with ANPD
- [ ] Legal review completed

**Users affected:** _________  
**Data type:** [PII / PHI / Other]  
**Exposure duration:** _________  
**Remediation:** _________________________  

---

## Sign-Off & Approval

### Investigation Complete

**Lead engineer confirms:**
- [ ] Root cause understood
- [ ] Fix verified in production
- [ ] Regression tests passing
- [ ] Data integrity confirmed

Name: _______________________  
Date: _______________________  
Signature: _______________________  

### Management Approval

**CTO / Stream Lead approves incident closure:**
- [ ] All remediation complete
- [ ] Follow-up actions assigned
- [ ] Team confident in prevention

Name: _______________________  
Date: _______________________  
Signature: _______________________  

### QA Sign-Off

**QA Lead confirms:**
- [ ] Smoke tests passing
- [ ] Regression not detected
- [ ] Monitoring alerts working

Name: _______________________  
Date: _______________________  
Signature: _______________________  

---

## References & Attachments

### Related Documents

- Slack incident thread: [Link to #incidents]
- GitHub commit(s): [Link to rollback or fix commit]
- GitHub PR (fix): [Link to PR if fix forward]
- Related ADR: [e.g., ADR-0017-hmac-baseline-reset]
- Previous incident: [If similar issue happened before]

### Attachments

- [ ] Cloud Logs screenshot (errors leading up to incident)
- [ ] Firestore data snapshot (before/after verification)
- [ ] Performance metrics (LCP, INP, CLS during incident)
- [ ] Team communication log (Slack + video call transcript)

---

## Post-Incident Meeting (Optional)

**Scheduled for:** _________________________  
**Participants:** [List names]  
**Duration:** _____ min  

**Agenda:**
1. Timeline review (5 min)
2. Root cause recap (5 min)
3. What went well (5 min)
4. Improvements (10 min)
5. Action items (5 min)

**Key takeaways:**
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]

---

## Document Control

| Field | Value |
|-------|-------|
| **Report ID** | INC-2026-05-XX-### |
| **Filed by** | ___________________________ |
| **Filing date** | 2026-05-XX |
| **Last updated** | 2026-05-XX |
| **Archive location** | `docs/incidents/2026-05-XX-name.md` |
| **Retention policy** | Permanent (audit trail requirement) |

---

**Template version:** 1.0 | Created: 2026-05-07 | For: v1.4 Phase 4 launch (May 20 – Jun 2)
