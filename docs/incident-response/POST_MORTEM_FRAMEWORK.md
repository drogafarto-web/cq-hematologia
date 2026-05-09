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
