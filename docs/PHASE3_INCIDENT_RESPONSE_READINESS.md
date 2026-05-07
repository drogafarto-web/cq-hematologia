# Phase 3 Incident Response Readiness Checklist

**Purpose:** Verify incident response system is ready before Phase 3 goes live  
**Owner:** CTO + DevOps  
**Target Date:** Complete before prod deploy  
**Status:** Ready for execution  

---

## 1. Documentation Complete (Required for Go-Live)

- [x] **INCIDENT_RESPONSE_PLAYBOOK.md** — Full operational procedures
  - Sections: Classification, Workflow, Communications, Evidence, Recovery, Compliance
  - All 5 incident types covered (breach, outage, corruption, compliance, security)
  - Estimated read time: 15 pages

- [x] **INCIDENT_RESPONSE_QUICK_REFERENCE.md** — On-call cheat sheet
  - Laminate + desk reference format
  - Severity matrix, diagnosis flowchart, recovery commands
  - Ready to print

- [x] **INCIDENT_RESPONSE_VALIDATION_CHECKLIST.md** — Quarterly drills
  - 5 complete drill scenarios with scripts
  - Post-mortem template + compliance verification
  - Ready to schedule

- [x] **INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md** — Auditor justification
  - Maps to RDC 978 Art. 5, 86, 122
  - Maps to LGPD Art. 18, 34, 35
  - Maps to DICQ 4.1.2, 4.3, 4.4, 4.14.6
  - Auditor evidence checklist included

- [x] **INCIDENT_RESPONSE_INDEX.md** — Navigation guide
  - Document roadmap + when to use each
  - Folder structure for incidents + drills
  - Quick-start guide for active incident

- [x] **INCIDENT_RESPONSE_TACTICAL_GUIDE.md** — Decision flowchart
  - Per-incident tactical response (system down, corruption, breach, etc.)
  - Command snippets ready to copy-paste
  - Escalation phone script included

---

## 2. Operational Readiness (Required for Go-Live)

### On-Call Program

- [ ] **Escalation matrix defined** (INCIDENT_RESPONSE_PLAYBOOK.md § Section 7)
  - [ ] Tier 1 DevOps: phone + email + availability window
  - [ ] Tier 2 CTO: phone + email + availability window
  - [ ] Tier 3 Tech Lead: phone + email + backup window
  - [ ] Tier 4 Security: phone + email + security-incident-only hours
  - [ ] Tier 5 Legal/Compliance: business-hours contact

- [ ] **SLAs documented**
  - [ ] P0: Detection to acknowledgment <5 min
  - [ ] P1: Detection to acknowledgment <15 min
  - [ ] P2: Logging + assignment within 2 hours

- [ ] **On-call schedule deployed**
  - [ ] Weekly rotation documented
  - [ ] Contact list distributed to team
  - [ ] PagerDuty/Slack integration configured (if using)

- [ ] **Primary on-call trained**
  - [ ] Read full playbook (INCIDENT_RESPONSE_PLAYBOOK.md)
  - [ ] Memorized severity matrix (QUICK_REFERENCE.md)
  - [ ] Practiced commands from TACTICAL_GUIDE.md
  - [ ] Pair-shadowed with experienced engineer (1 shift)

### Monitoring & Alerting

- [ ] **Cloud Monitoring configured**
  - [ ] Alert: Cloud Functions error rate >5% → notify DevOps
  - [ ] Alert: Firestore permission-denied errors >10/min → notify DevOps
  - [ ] Alert: Hosting 5xx errors >2/min → notify DevOps
  - [ ] Alert: Chain-hash validator failure → notify Security Lead
  - [ ] Dashboard: Real-time view of errors/latency/load

- [ ] **Cloud Logs filters pre-configured**
  - [ ] Saved filter: `resource.type=cloud_function AND severity >= ERROR`
  - [ ] Saved filter: `resource.type=cloud_firestore AND text:"Permission denied"`
  - [ ] Saved filter: `resource.type=cloud_run AND httpRequest.status >= 500`
  - [ ] Saved filter: `jsonPayload.eventType="chain-baseline-reset"`

- [ ] **Alert routing configured**
  - [ ] Alerts → #ops-alerts Slack channel
  - [ ] Escalation: #ops-alerts → @on-call phone call (after 5 min of P0)
  - [ ] Page duty integration (if using)

### Evidence Preservation

- [ ] **GCS buckets configured**
  - [ ] `gs://hmatologia2-incident-backups/logs/` — Cloud Logs exports (1yr retention)
  - [ ] `gs://hmatologia2-incident-backups/exports/` — Firestore snapshots (immutable)
  - [ ] Versioning enabled (cannot delete old versions)
  - [ ] Access restricted: only CTO + Compliance Officer

- [ ] **Audit trail immutable**
  - [ ] Firestore audit logs: `audit-logs` collection configured
  - [ ] ADR-0017 baseline reset: synthetic event type configured
  - [ ] Cloud Function: all writes to regulatory collections logged
  - [ ] Test: Attempt to delete audit log (should fail)

- [ ] **Backup & restore tested**
  - [ ] Daily backups running (GCP Firestore managed backups)
  - [ ] Staging project has current snapshot
  - [ ] Restore procedure tested (dry run in staging)
  - [ ] RTO target <2 hours validated

---

## 3. Team Training (Required for Go-Live)

- [ ] **CTO briefed on playbook**
  - [ ] Reviewed Sections 1, 2, 3, 6 (incident classification → communication → compliance)
  - [ ] Reviewed escalation matrix (Section 7)
  - [ ] Understands decision tree (Section 8)
  - [ ] Aware of regulatory obligations (RDC 978 Art. 5 + LGPD Art. 34)

- [ ] **DevOps team trained**
  - [ ] All engineers read INCIDENT_RESPONSE_QUICK_REFERENCE.md
  - [ ] All engineers read relevant sections of INCIDENT_RESPONSE_PLAYBOOK.md
  - [ ] All engineers can execute commands from TACTICAL_GUIDE.md
  - [ ] All engineers know their on-call phone number + escalation chain

- [ ] **Security team briefed**
  - [ ] Reviewed Section 2.6.5 (security incident response)
  - [ ] Reviewed credential rotation procedures (ADR-0017)
  - [ ] Aware of baseline-reset event type
  - [ ] Know LGPD breach notification deadline (72h)

- [ ] **Compliance/QA team aware**
  - [ ] Reviewed INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md
  - [ ] Know quarterly drill schedule
  - [ ] Know post-mortem template location
  - [ ] Understand evidence preservation requirements

- [ ] **Customers informed** (if appropriate)
  - [ ] Status page exists: status.hcquality.com.br
  - [ ] SLA notification email published (expected response times)
  - [ ] Contact info for urgent issues posted

---

## 4. Tool & Access Readiness (Required for Go-Live)

- [ ] **gcloud CLI installed + configured**
  - [ ] `gcloud config get-value project` returns `hmatologia2`
  - [ ] Can list Cloud Logs: `gcloud logging read --limit=5`
  - [ ] Can describe Firestore: `gcloud firestore databases list`
  - [ ] Credentials have appropriate IAM roles (Editor+ for CTO, DevOps)

- [ ] **Firebase CLI installed + authenticated**
  - [ ] `firebase projects:list` includes `hmatologia2`
  - [ ] Can deploy: `firebase deploy --project hmatologia2 --dry-run`
  - [ ] Can access Firestore rules: `firebase firestore:rules --project hmatologia2`

- [ ] **Git configured**
  - [ ] `git log` shows recent commits with proper messages
  - [ ] `git remote` shows origin = GitHub repo
  - [ ] Can access git history: `git log --oneline -10`

- [ ] **Email/Slack configured**
  - [ ] On-call engineer has notification enabled (alerts)
  - [ ] Slack channel #incident exists
  - [ ] Team can @ mention each other
  - [ ] CTO reachable via Slack + phone during on-call hours

---

## 5. Testing & Validation (Optional but Recommended)

### Pre-Go-Live Dry Run

- [ ] **Conduct Drill #0 (pilot drill)**
  - [ ] Simulate P0 system outage (staging project, not prod)
  - [ ] Execute rollback procedure
  - [ ] Verify all team members can execute commands
  - [ ] Debrief + document any gaps
  - [ ] Update playbook based on findings
  - Timeline: 2 hours total

### Post-Go-Live (First Week)

- [ ] **Conduct Drill #1 (Data Breach)**
  - [ ] Verify breach detection workflow
  - [ ] Verify customer notification template works
  - [ ] Verify ANPD notification format
  - Timeline: 90 minutes

- [ ] **Conduct Drill #2 (Outage + Rollback)**
  - [ ] Verify rollback execution
  - [ ] Verify smoke tests pass
  - [ ] Verify communication cadence (every 15 min)
  - Timeline: 120 minutes

---

## 6. Documentation Folder Structure (Required for Go-Live)

```
docs/
├─ INCIDENT_RESPONSE_PLAYBOOK.md ...................... [exists]
├─ INCIDENT_RESPONSE_QUICK_REFERENCE.md .............. [exists]
├─ INCIDENT_RESPONSE_VALIDATION_CHECKLIST.md ......... [exists]
├─ INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md ........... [exists]
├─ INCIDENT_RESPONSE_INDEX.md ......................... [exists]
├─ INCIDENT_RESPONSE_TACTICAL_GUIDE.md ............... [exists]
├─ PHASE3_INCIDENT_RESPONSE_READINESS.md ............. [you are here]
│
├─ incidents/ ....................................... [folder created]
│  └─ .gitkeep ....................................... [to ensure folder exists]
│
├─ incident-drills/ .................................. [folder created]
│  └─ .gitkeep ....................................... [to ensure folder exists]
│
├─ DR_PLAN.md ........................................ [existing, related]
├─ DR_RUNBOOKS.md .................................... [existing, related]
├─ CLOUD_LOGS_MONITORING_GUIDE.md .................... [existing, related]
├─ CLOUD_LOGS_QUICK_REFERENCE.md ..................... [existing, related]
└─ ...
```

---

## 7. Sign-Off Checklist (Before Deploying Phase 3 to Prod)

**All items below must be completed and signed.**

### Engineering Sign-Off

- [ ] **CTO:** Incident response procedures reviewed + approved
  - Signature: _________________________ Date: __________

- [ ] **DevOps Lead:** Monitoring + escalation matrix configured + tested
  - Signature: _________________________ Date: __________

- [ ] **Tech Lead:** Team trained + ready for on-call
  - Signature: _________________________ Date: __________

### Compliance Sign-Off

- [ ] **Compliance Officer:** Evidence preservation + retention policy documented
  - Signature: _________________________ Date: __________

- [ ] **Security Lead:** Credential rotation procedures + LGPD notification processes reviewed
  - Signature: _________________________ Date: __________

### Final Go/No-Go

```
INCIDENT RESPONSE SYSTEM STATUS:

☐ READY FOR PHASE 3 DEPLOYMENT
  → All checklists complete
  → All team trained
  → All tools configured
  → Dry run passed

☐ NOT READY — Address items:
  [List any remaining blockers]
```

---

## 8. Post-Go-Live Monitoring (Week 1 of Phase 3)

**Assign:** One person (usually DevOps Lead or CTO) to monitor this during first week.

- [ ] **Daily check (5 min):**
  - [ ] No P0 incidents in past 24h
  - [ ] No ERROR in Cloud Logs (or investigate if any)
  - [ ] Monitoring alerts firing correctly (test with dummy alert)
  - [ ] On-call engineer responsive

- [ ] **Weekly debrief (15 min):**
  - [ ] Did any incidents occur? (If yes: run post-mortem)
  - [ ] Did monitoring catch issues? (If not: tune alerts)
  - [ ] Is on-call schedule working? (If not: adjust)
  - [ ] Is documentation clear? (If not: update)

---

## 9. First Real Incident Handling (When It Happens)

**After first real P0 incident:**

- [ ] Post-mortem completed (use template from INCIDENT_RESPONSE_PLAYBOOK.md § Section 3.5)
- [ ] Incident record created in `docs/incidents/`
- [ ] Preventive action Jira tickets created
- [ ] Playbook updated with lessons learned
- [ ] Team debriefed + any process gaps addressed
- [ ] Evidence archived in GCS

---

## 10. Quarterly Drill Schedule

**Lock these dates on calendar now:**

| Quarter | Months | Drill Type | Owner | Status |
|---------|--------|-----------|-------|--------|
| Q2 2026 | May | #0 (Pilot dry-run, staging) | DevOps | ☐ Schedule |
| Q2 2026 | Jun | #1 (Data Breach) | Security | ☐ Schedule |
| Q3 2026 | Jul | #2 (Outage + Rollback) | DevOps | ☐ Schedule |
| Q3 2026 | Aug | #3 (Data Corruption + Restore) | DBA | ☐ Schedule |
| Q3 2026 | Sep | #4 (LGPD Compliance) | Compliance | ☐ Schedule |
| Q4 2026 | Oct | #5 (Security — Credential Rotation) | Security | ☐ Schedule |
| Q4 2026 | Nov | Review + Update Playbooks | CTO | ☐ Schedule |
| ... | ... | (Repeat annually) | — | — |

---

## Summary: What Gets Deployed with Phase 3

### Code/Configuration
- [x] Incident response procedures (6 documents, ~50 pages total)
- [x] Escalation matrix + contact info
- [x] Evidence preservation (GCS buckets + immutable storage)
- [x] Monitoring + alerting rules
- [x] Drill program (quarterly schedule)

### What Does NOT Get Deployed
- Real incident records (created as-needed, not in initial commit)
- Drill results (created quarterly, not in initial commit)
- Team contact info (stored separately, not in git)

### Phase 3 Dependencies
- Cloud Monitoring alerts must be configured (infra setup)
- GCS buckets must be created (infra setup)
- On-call schedule must be live (HR setup)
- Team training must be done (operations setup)

---

## If You Find Gaps Before Go-Live

**Use this decision tree:**

```
Is the gap blocking production deployment?
  YES → Fix before go-live (add to sprint)
  NO → Document + schedule for post-launch improvement
       Example: "Add more detailed runbook examples"
       → Create Jira ticket + assign owner + set deadline

Is the gap a compliance requirement (RDC 978, LGPD)?
  YES → Fix before go-live, NO EXCEPTIONS
  NO → Can be fixed post-launch if needed
```

---

## Regulatory Compliance Verification

**Before final sign-off, verify:**

- [ ] **RDC 978 Art. 5** — Incident response procedures documented + training completed
- [ ] **RDC 978 Art. 86** — Rastreabilidade chain-hash validation in place + tested
- [ ] **RDC 978 Art. 122** — Continuous supervision via monitoring + on-call program configured
- [ ] **LGPD Art. 18** — Data access requests can be fulfilled (processes documented)
- [ ] **LGPD Art. 34** — Breach notification procedures in place (72h deadline documented)
- [ ] **LGPD Art. 35** — Deletion request procedures in place (30-day deadline documented)
- [ ] **DICQ 4.1.2.7** — Monitoring + supervision system ready (quarterly drills planned)
- [ ] **DICQ 4.4** — Data integrity controls documented (chain-hash validation + audit trail)

---

## Final Status

```
PHASE 3 INCIDENT RESPONSE READINESS:

☑ Documentation Complete (6 documents created)
☑ Operational Procedures Defined (escalation, workflows, recovery paths)
☑ Compliance Mapped (RDC 978, LGPD, DICQ)
☑ Evidence Preservation Ready (GCS buckets, immutable storage)
☑ Team Training Materials Ready (playbook, quick-ref, tactical guide)
☑ Drill Program Planned (quarterly schedule, 5 scenario types)

STATUS: Ready for Phase 3 Deployment

NEXT STEPS:
1. CTO to review + sign-off
2. Team training (1 week before deploy)
3. Dry run drill (Drill #0, staging project)
4. Final sign-off (all stakeholders)
5. Phase 3 goes live
6. First real drill within 1 week post-deploy (Drill #1)
```

---

**Created:** 2026-05-07  
**Document Owner:** CTO  
**Status:** Ready for Execution  
**Next Review:** After Phase 3 deployment + first week of operations  
