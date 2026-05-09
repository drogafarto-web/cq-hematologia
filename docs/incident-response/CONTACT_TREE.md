# Incident Response Contact Tree

Who to contact at each severity level.

---

## Green Incident (Internal Only)

**Who to notify:**
- Slack #dev-incidents only
- No one else (async discussion in channel)

**Example:** "UI typo on coagulacao module"

---

## Yellow Incident (Team + Operations)

**Who to notify (in order):**
1. **On-Call IC:** Decides if escalation to Red needed
2. **Team Lead:** If IC needs backup
3. **Ops/DevOps:** If infrastructure needed

**Timeline:**
- T+5min: IC declares Yellow
- T+30min: If no progress, escalate to Red
- T+2h: Status update to leadership

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
- T+1min: Alerts fire
- T+5min: IC confirms Red, initiates group Slack call
- T+15min: First status update
- T+30min: If not resolved, escalate to CTO
- Every 30min: Status update in Slack #incidents
- T+1h: Resolved or escalated

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
7. **ANVISA (if required):** Via Legal

**Timeline:**
- T+0: Black declared
- T+1min: Emergency group call initiated
- T+5min: CTO declares action plan
- T+15min: First status update
- T+30min: Second status update
- Every 15min: Updates until resolved
- T+24h (if data loss): Auditor notified
- T+48h: Customer notification letter

**No external communication without CTO sign-off.**

**Example:** "Database inaccessible, audit trail data lost"

---

## Contact Details (To Be Filled By Ops Team)

| Role | Name | Phone | Slack | Email |
|------|------|-------|-------|-------|
| CTO | | | | |
| IC Week 1 | | | | |
| IC Backup Week 1 | | | | |
| IC Week 2 | | | | |
| IC Backup Week 2 | | | | |
| Engineering Lead | | | | |
| Ops/DevOps | | | | |
| Product Lead | | | | |

*To be completed before production go-live.*
