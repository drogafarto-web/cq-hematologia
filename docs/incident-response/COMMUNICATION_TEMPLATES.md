# Incident Communication Templates

Standard templates for customer notification, regulatory reporting, and internal escalation.

---

## Template 1: Customer Incident Notice (Yellow/Red Outage <1h)

**To:** [customer-list]  
**Subject:** Service Interruption — [Date] [Duration]

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

**To:** @oncall (Slack)  
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

**Who:**  
[@ic-primary] Incident Commander, [@backup-ic] Backup, [@eng-lead] Engineering

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
Example: "Our monitoring alert thresholds were not sensitive enough; they have since been adjusted."

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
