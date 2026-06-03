# Incident Response — Complete Documentation Index

**Document Set:** HC Quality Phase 3 Incident Response Playbook  
**Version:** 1.0  
**Effective:** 2026-05-07  
**Classification:** DICQ 4.4 / RDC 978 Art. 5 / LGPD Art. 34

---

## Overview

This index provides a roadmap to the 4-document incident response system for HC Quality (hmatologia2). The system is designed for production use and RDC 978 + LGPD compliance.

---

## Document 1: INCIDENT_RESPONSE_PLAYBOOK.md

**Purpose:** Complete operational procedures for all incident types  
**Audience:** Incident commanders, on-call engineers, CTO, compliance  
**Length:** ~15 pages

**Contents:**

- Section 1: Incident classification (5 types: breach, outage, corruption, compliance, security)
- Section 2: Universal workflow (detection → triage → escalation → investigation → remediation → communication → post-mortem)
- Section 3: Communication templates (customer, regulator, internal)
- Section 4: Evidence preservation procedures
- Section 5: Recovery & prevention strategies
- Section 6: RDC 978 Art. 5 compliance checklist
- Section 7: On-call escalation matrix
- Section 8: Incident decision tree (quick reference)

**When to Use:**

- During actual incident (reference Section 2 + applicable remediation section)
- During training (read full document)
- During audit prep (Sections 1, 2, 6 demonstrate compliance)

**Key Procedures:**

- Data Breach → Section 2.6.1 (containment + investigation + notification)
- System Outage → Section 2.6.2 (rollback or restore decision)
- Data Corruption → Section 2.6.3 (stop writes + restore from backup)
- Compliance Violation → Section 2.6.4 (immediate remediation + document)
- Security Incident → Section 2.6.5 (rotate credential + verify scope)

---

## Document 2: INCIDENT_RESPONSE_QUICK_REFERENCE.md

**Purpose:** On-call cheat sheet — print and laminate  
**Audience:** On-call engineers (primary), DevOps team  
**Length:** 2 pages

**Contents:**

- 0–5 min: Is this real?
- Severity in 30 seconds (P0/P1/P2 decision matrix)
- Quick diagnosis (command snippets for each incident type)
- Fastest recovery paths (rollback + restore)
- Evidence preservation (one-liners)
- Customer message templates (copy-paste)
- Escalation procedures (who to page, when)
- Common errors & fixes
- Key numbers & URLs

**When to Use:**

- During active incident (quick lookup)
- Desk reference (print on card stock, laminate, keep on monitor)
- Training new on-call engineers (reference during onboarding)

**Example Usage:**

```
Incident happens → Check severity in quick-reference table
→ Get command from "Quick Diagnosis" section
→ Escalate per "Escalation" table
→ Copy message template
→ Execute recovery path
```

---

## Document 3: INCIDENT_RESPONSE_VALIDATION_CHECKLIST.md

**Purpose:** Quarterly drill procedures to verify incident response system works  
**Audience:** DevOps, QA, security team, CTO  
**Length:** ~25 pages (detailed drill scripts)

**Contents:**

- Pre-drill setup (scheduling, environment prep, backups)
- Drill 1: Data Breach Detection & Containment (90 min)
- Drill 2: System Outage & Rollback (120 min)
- Drill 3: Data Corruption Detection & Restore (180 min)
- Drill 4: LGPD Compliance — Data Subject Rights (90 min)
- Drill 5: Security Incident — Credential Rotation (60 min)
- Post-drill debrief template (findings + action items)
- Quarterly schedule + compliance verification

**When to Use:**

- Quarterly (Q1, Q2, Q3, Q4 — one drill per month)
- Before major deploy (validate system handles new services)
- After team changes (onboard new on-call engineer)
- Before accreditation audit (prove system works)

**Execution:**

1. Schedule 1 week in advance (don't surprise customers)
2. Alert customers: "Scheduled incident response drill. No data loss expected."
3. Use staging project (not production) when possible
4. Execute drill procedures step-by-step
5. Complete post-mortem debrief + action items
6. Archive results (evidence for auditor)

**Compliance Value:**

- DICQ 4.1.2.7: Proves monitoring + supervision system works
- DICQ 4.4: Proves data integrity + recovery procedures tested
- RDC 978 Art. 5: Proves incident response training + competency

---

## Document 4: INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md

**Purpose:** Regulatory compliance justification for auditors  
**Audience:** CTO, compliance officer, auditors (ANVISA, ANPD, DICQ)  
**Length:** ~10 pages

**Contents:**

- Executive summary (incident response = compliance with 3 regulatory frameworks)
- RDC 978 mapping (Art. 5, 86, 122 — quality, traceability, supervision)
- LGPD mapping (Art. 18, 34, 35 — access, notification, deletion rights)
- DICQ mapping (4.1.2, 4.3, 4.4, 4.14.6 — quality, documentation, integrity, risk)
- Compliance evidence index (what to show auditors for each type)
- Auditor-ready incident report template

**When to Use:**

- Audit preparation (1 month before audit, familiarize team)
- During audit (reference when auditor asks "How do you comply with RDC 978 Art. 5?")
- Internal compliance training (explain why we have incident response)
- Risk assessment updates (FMEA/probability-severity-detection scores)

**Example Audit Q&A:**

```
Auditor: "Show me your incident response procedures."
Answer: "INCIDENT_RESPONSE_PLAYBOOK.md § Sections 1–6"

Auditor: "How do you verify chain-hash integrity?"
Answer: "Section 4.3 + validateChainIntegrityScheduled logs"

Auditor: "Where are your real incidents documented?"
Answer: "docs/incidents/ folder (each incident has investigation + remediation)"
```

---

## How to Use This System

### For On-Call Engineers

1. **Day 1 (Onboarding):**
   - Read INCIDENT_RESPONSE_QUICK_REFERENCE.md (memorize severity matrix)
   - Skim INCIDENT_RESPONSE_PLAYBOOK.md (know where each section is)

2. **Day 1–7 (Training):**
   - Read full INCIDENT_RESPONSE_PLAYBOOK.md
   - Bookmark Cloud Logs URL + Firestore Console
   - Practice commands from "Quick Diagnosis" section
   - Pair with experienced on-call on their shift

3. **During Incident:**
   - Quick-reference card at desk
   - Playbook pulled up in second window
   - Link to quick-reference in Slack #incident channel

### For CTO / Incident Commander

1. **Before Incident:**
   - Review INCIDENT_RESPONSE_PLAYBOOK.md (at least once per quarter)
   - Run escalation drill (fake Slack + fake phone call)

2. **During Incident:**
   - Reference Section 2 (decision tree + timelines)
   - Reference Section 3 (notification templates)
   - Reference Section 6 (compliance checklist)
   - Update status every 15 minutes per Section 2.3

3. **After Incident:**
   - Document findings in incident record (template in Section 3.5)
   - Update playbook if gaps found

### For Compliance / Auditors

1. **Pre-Audit (1 month before):**
   - Read INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md
   - Review past 12 months of real incidents in docs/incidents/
   - Verify quarterly drill results archived

2. **During Audit:**
   - Use mapping document to answer "How do you comply?" questions
   - Show auditor-ready incident report template
   - Point to evidence in GCS (Cloud Logs) + Firestore snapshots

---

## Incident Documentation Folder Structure

```
docs/
├─ INCIDENT_RESPONSE_PLAYBOOK.md ..................... [this system, Phase 3 operations]
├─ INCIDENT_RESPONSE_QUICK_REFERENCE.md ............. [on-call cheat sheet]
├─ INCIDENT_RESPONSE_VALIDATION_CHECKLIST.md ........ [quarterly drills]
├─ INCIDENT_RESPONSE_COMPLIANCE_MAPPING.md .......... [auditor justification]
├─ INCIDENT_RESPONSE_INDEX.md ........................ [you are here]
│
├─ incidents/ ....................................... [real incidents, 1 file per incident]
│  ├─ INC-2026-04-15-001.md ......................... [example: outage, resolved via rollback]
│  ├─ INC-2026-04-22-002.md ......................... [example: data corruption, restore from backup]
│  ├─ INC-2026-05-03-003.md ......................... [example: chain-hash failure, baseline reset]
│  └─ ... (new incident records added as they occur)
│
├─ incident-drills/ .................................. [quarterly drill results]
│  ├─ 2026-01-15-drill-breach-detection.md .......... [Drill #1 post-mortem]
│  ├─ 2026-02-14-drill-rollback.md .................. [Drill #2 post-mortem]
│  ├─ 2026-03-13-drill-restore.md ................... [Drill #3 post-mortem]
│  ├─ 2026-04-16-drill-lgpd.md ...................... [Drill #4 post-mortem]
│  ├─ 2026-05-21-drill-security.md .................. [Drill #5 post-mortem]
│  └─ ... (drills continue quarterly)
│
├─ DR_PLAN.md ...................................... [related: disaster recovery scenarios + RTO/RPO]
├─ DR_RUNBOOKS.md .................................. [related: step-by-step restore procedures]
├─ CLOUD_LOGS_MONITORING_GUIDE.md ................... [related: 24h post-deploy monitoring]
├─ CLOUD_LOGS_QUICK_REFERENCE.md .................... [related: log query syntax]
└─ ...
```

---

## Quick Start: "An Incident Happened Right Now"

1. **First 30 seconds:**
   - Grab INCIDENT_RESPONSE_QUICK_REFERENCE.md
   - Determine severity (Section "Severity in 30 Seconds")

2. **Next 2 minutes:**
   - Post in Slack `#incident`: `[P?] <title> — <brief desc>`
   - Ping appropriate person (Section "Escalation")

3. **Next 5–15 minutes:**
   - Run diagnostic command from "Quick Diagnosis" section
   - Copy current state screenshot (Cloud Logs or Firebase Console)
   - Escalate per Section 2.3 of playbook

4. **Next 15–60 minutes:**
   - Open INCIDENT_RESPONSE_PLAYBOOK.md
   - Find your incident type in Section 2.6 (5 subsections: breach, outage, corruption, compliance, security)
   - Follow steps sequentially
   - Update Slack every 15 min with status

5. **After remediation:**
   - Create incident record in docs/incidents/INC-YYYY-MM-DD-###.md
   - Schedule post-mortem within 24 hours (use template in playbook Section 3.5)
   - Create Jira tickets for preventive actions
   - Close incident

---

## Key Contacts & Links

**On-Call Matrix:**

- See INCIDENT_RESPONSE_PLAYBOOK.md Section 7

**Cloud Resources:**

- Cloud Logs: https://console.cloud.google.com/logs/query
- Firebase: https://console.firebase.google.com/project/hmatologia2
- GCP Dashboard: https://console.cloud.google.com
- Status Page: https://status.hcquality.com.br

**Runbooks (related docs):**

- Firestore Restore: docs/DR_RUNBOOKS.md (Scenario 1)
- Rollback: docs/deploy-protocol.md
- Cloud Logs Setup: docs/CLOUD_LOGS_MONITORING_GUIDE.md

---

## Compliance Certifications

This incident response system is designed to meet:

- **RDC 978/2025** (ANVISA) — Clinical Laboratory Quality Management
  - Art. 5: Quality management + incident response + documentation
  - Art. 86: Rastreabilidade (traceability)
  - Art. 122: Supervisão (supervision)

- **Lei 13.709/2018 (LGPD)** — Brazilian Data Protection Law
  - Art. 18: Direito de acesso (access rights)
  - Art. 34: Breach notification (72h deadline)
  - Art. 35: Direito de exclusão (deletion rights)

- **DICQ v4.3** (ISO 15189) — Competency Accreditation
  - 4.1.2: Quality management + continuous supervision
  - 4.3: Documentation management
  - 4.4: Data integrity + immutable records
  - 4.14.6: Risk management (FMEA-lite integration)

---

## Document History & Maintenance

| Version | Date       | Changes          | Author |
| ------- | ---------- | ---------------- | ------ |
| 1.0     | 2026-05-07 | Initial creation | CTO    |

**Next Review:** 2026-11-07  
**Owner:** CTO + DevOps + Compliance Officer  
**Update Triggers:** Post-incident updates, quarterly drill results, regulatory changes

---

**Print, bookmark, and practice.**

Phase 3 is production. Incidents will happen. This system makes sure we handle them right.
