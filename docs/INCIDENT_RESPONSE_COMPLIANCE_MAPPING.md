# Incident Response — RDC 978 / LGPD / DICQ Compliance Mapping

**Document ID:** IRC-COMPLIANCE-001  
**Version:** 1.0  
**Effective Date:** 2026-05-07  
**Classification:** DICQ 4.4 (Gestão de documentação + Rastreabilidade)  

---

## Executive Summary

This document maps incident response procedures in the Incident Response Playbook to regulatory requirements in:
- **RDC 978/2025** — ANVISA regulation for clinical laboratories
- **Lei 13.709/2018 (LGPD)** — Brazilian Data Protection Law
- **DICQ v4.3** — ISO 15189 Competency Accreditation Program

**Compliance Approach:** Every incident type and phase has a regulatory basis documented below. Auditors can trace from incident → playbook section → regulatory clause.

---

## 1. RDC 978 — Regulatory Requirements

### RDC 978 Art. 5 — Gestão de Qualidade (Quality Management)

**Requirement:**
> "O Laboratório Clínico deve estabelecer e manter documentada uma política de qualidade que garanta a confiabilidade dos resultados, a segurança do paciente e a rastreabilidade das operações. Incidentes de segurança e conformidade devem ser documentados, investigados e resolvidos dentro de prazos regulamentares."

**Mapping to Playbook:**

| Playbook Section | RDC 978 Compliance | Evidence |
|---|---|---|
| **Section 1 — Incident Classification** | Art. 5: Incidents must be classified by impact and risk | Severity matrix (P0/P1/P2) with patient safety + regulatory implications |
| **Section 2.4 — Investigation** | Art. 5: Root cause analysis required | Investigation checklist + evidence collection procedures |
| **Section 3.5 — Post-Mortem** | Art. 5: Findings must be documented | Post-mortem template with RCA + preventive actions |
| **Section 6 — Compliance Checklist** | Art. 5: Audit trail immutable | Evidence preservation in GCS + signing |

**Evidence Required for Auditor:**
- Incident log with date/time/severity
- Investigation file with root cause analysis
- Post-mortem report with preventive actions
- Evidence archive (Cloud Logs, Firestore snapshot)

---

### RDC 978 Art. 86 — Rastreabilidade (Traceability)

**Requirement:**
> "Todas as operações com resultados de exames, laudos e registros críticos devem ser rastreáveis. Incluindo: quem fez, quando, o quê, por quê (indicação), assinatura eletrônica com data/hora."

**Mapping to Playbook:**

| Incident Type | Art. 86 Impact | Playbook Response |
|---|---|---|
| **Data Corruption** | Rastreabilidade quebrada (compromised audit trail) | Section 2.6.3: Chain-hash validation, backup restore, audit trail repair |
| **Unauthorized Access** | Reads not logged (breach of who-accessed-what) | Section 2.6.1: Evidence preservation, Firestore audit log export |
| **System Outage** | Operations not recorded during downtime | Section 2.6.2: Downtime window documented, no data loss claim, RTO target |
| **Chain Hash Invalid** | Signatures forged or tampered | Section 4.3: Rule evaluation trace, signature verification test |

**Auditor Checklist:**
- [ ] Audit trail for all operations ≥12 months old (per Art. 115)
- [ ] Chain-hash verification script running periodically
- [ ] Incident logs show who investigated + when
- [ ] Corrupted records marked as such (not silently fixed)

---

### RDC 978 Art. 122 — Supervisão de Atividades (Supervision)

**Requirement:**
> "Supervisão contínua das operações laboratoriais, incluindo monitoramento de incidentes, registros de não-conformidade, rastreabilidade de pessoal."

**Mapping to Playbook:**

| Playbook Section | Art. 122 Compliance | Frequency |
|---|---|---|
| **Section 2 — Incident Response Workflow** | Supervision: timely detection + escalation | Real-time monitoring (continuous) |
| **Cloud Logs Monitoring** | Art. 122: Continuous system monitoring | 24h post-deployment + ongoing (docs/CLOUD_LOGS_MONITORING_GUIDE.md) |
| **Section 5.1 — Hotfix vs Rollback** | Art. 122: Documented decision-making | Per-incident decision tree |
| **Section 6 — Compliance Checklist** | Art. 122: Post-incident improvement tracking | 30-day review cycle |

**Evidence Required:**
- Cloud Monitoring alerts (configured + logged)
- On-call schedule (coverage matrix)
- Incident response time logs (detection → escalation → resolution)
- Monthly supervisory report (summary of incidents + trends)

---

## 2. LGPD — Lei 13.709/2018 (Data Protection Law)

### LGPD Art. 18 — Direito de Acesso (Access Right)

**Requirement:**
> "O titular dos dados tem direito de acessar seus dados pessoais coletados. O controlador deve fornecer cópia dentro de 30 dias."

**Mapping to Playbook:**

| Incident Type | Art. 18 Scenario | Playbook Response |
|---|---|---|
| **Compliance Violation** | LGPD request not processed in time | Section 2.6.4: Immediate remediation + deadline verification |
| **Data Corruption** | Export request returns corrupted data | Section 2.6.3: Restore from backup before sending export |
| **Data Breach** | Unauthorized accessed request export | Section 2.6.1: Notify requester of breach |

**Evidence Required:**
- LGPD request tracking: received date, response date, deadline (30 days)
- Export file manifest (list of fields provided)
- Audit log showing request processing steps
- If overdue: remediation action + timeline

---

### LGPD Art. 34 — Notificação de Incidente (Breach Notification)

**Requirement:**
> "Em caso de incidente de segurança com potencial risco ao titular de dados, o controlador deve notificar: (1) os titulares, (2) a ANPD, (3) órgãos públicos (ANVISA se saúde)."  
> **Deadline:** 72 hours from detection of confirmed breach

**Mapping to Playbook:**

| Incident Type | Art. 34 Trigger | Playbook Section | Notification |
|---|---|---|---|
| **Data Breach** | Patient PII or health records exposed | Section 2.6.1 | Yes: customer + ANPD + ANVISA (if >100 patients) |
| **Unauthorized Access** | Attacker accessed sensitive data | Section 2.5 | Yes: evidence investigation required |
| **Credential Compromise** | Secret leaked (potential for exfiltration) | Section 2.6.5 | Only if data exfiltration confirmed |

**Notification Procedure:**

```
Breach Detected (timestamp T)
    ↓
[0–24h] Verify breach scope + confirm data actually exposed
    ├─ If not confirmed: no notification
    └─ If confirmed: proceed to notifications
    ↓
[24–48h] Draft notification to affected customers
    ├─ List: names, DOBs, test results (specific fields exposed)
    ├─ Timeline: when detected, when notified, remediation taken
    └─ Next steps: what they should do
    ↓
[48–72h] Submit to ANPD (via portal or certified mail)
    ├─ Include: scope, root cause, remediation, preventive measures
    └─ Keep receipt for audit
    ↓
[Post-72h] Submit to ANVISA (if patient safety risk)
    └─ RDC 978 coordination required
```

**Evidence Required:**
- Breach detection log (timestamp, who detected, evidence)
- Investigation findings (scope confirmed, root cause)
- Customer notification (template + list of recipients)
- ANPD submission receipt (registration number)
- Post-breach mitigation measures documented

---

### LGPD Art. 35 — Direito de Exclusão (Deletion Right)

**Requirement:**
> "O titular tem direito a solicitar exclusão de seus dados ('direito ao esquecimento'). O controlador deve cumprir em até 30 dias, exceto se há base legal para retenção (compliance com RDC 978)."

**Mapping to Playbook:**

| Scenario | Art. 35 Compliance | Playbook Section |
|---|---|---|
| **Patient requests deletion** | Soft-delete within 30 days | Section 2.6.4: LGPD remediation workflow |
| **Soft-delete overdue** | Incident if not completed in time | Section 1.4: Compliance violation classification |
| **Legal hold exception** | Patient data retained for DICQ 4.3 (5-year retention) | ADR-0006 (Pessoa-Qualificacoes LGPD) |

**Deletion Procedure (from Drill 4):**

```
Deletion Request (T=0)
    ↓
[0–15 days] System processes request
    ├─ Verify patient identity (email, patient ID, etc.)
    ├─ Get CTO approval (clinical judgment exception?)
    └─ Execute soft-delete (set deletadoEm = now())
    ↓
[15–30 days] Audit verification
    ├─ Confirm data no longer visible in normal queries
    ├─ Verify audit trail shows deletion
    └─ Notify patient: "Your deletion has been completed"
    ↓
[30+ days] If overdue: incident + remediation
    └─ Section 2.6.4: Immediate action + documentation
```

**Evidence Required:**
- Deletion request log (received date, patient ID)
- Processing timeline (steps taken, completion date)
- Audit trail showing soft-delete execution
- Patient notification (sent date)
- If overdue: remediation record

---

## 3. DICQ v4.3 — ISO 15189 Accreditation Requirements

### DICQ 4.1.2 — Qualidade e Competência (Quality & Competence)

**Requirement 4.1.2.7:**
> "Organização deve estabelecer mecanismo para monitoramento e supervisão contínua de suas operações laboratoriais. Incluindo sistema de alerta para falhas críticas."

**Mapping to Playbook:**

| Playbook Component | DICQ 4.1.2.7 Compliance |
|---|---|
| **Section 2 — Incident Response Workflow** | Monitoring + escalation = continuous supervision |
| **Cloud Logs Monitoring** | Automated alerts for errors + anomalies |
| **Section 5.1 — Hotfix Decision** | Documented decision-making process (quality = proof of system) |
| **Drill Program (every 3 months)** | Proof that system works + team is trained |

**Auditor Evidence:**
- Monitoring dashboard screenshots (errors/latency/load)
- Alert configuration (rules, thresholds, recipients)
- On-call schedule + escalation matrix
- Drill results + post-mortem improvements

---

### DICQ 4.3 — Documentação (Documentation)

**Requirement:**
> "Registros de qualidade, não-conformidade, auditorias internas, incidentes de segurança e medidas corretivas devem ser mantidos, acessíveis para inspeção."

**Mapping to Playbook:**

| Playbook Artifact | DICQ 4.3 Classification |
|---|---|
| Incident log (date/time/severity) | Management Review Record (entrada de reunião CQ) |
| Investigation findings | Quality Assurance Record (evidência de análise) |
| Post-mortem report | Corrective Action (CAPA) trigger |
| Evidence archive (logs/snapshots) | Quality Record (retention ≥5 years) |
| Drill results | Training Record (competency verification) |

**Retention Policy:**
- **Active incidents:** Archive in `docs/incidents/` with full evidence
- **Closed incidents:** Archive in `docs/incidents/closed/` + backup to GCS
- **Retention period:** 5 years minimum (per RDC 978 Art. 115 + DICQ 4.3)
- **Access:** Available to internal audits, external audits (ANVISA, accreditation bodies)

---

### DICQ 4.4 — Registros Íntegros (Data Integrity)

**Requirement:**
> "Registros clínicos e de qualidade devem ser íntegros, rastreáveis e imutáveis. Alterações devem ser auditadas. Assinaturas eletrônicas devem ser verificáveis."

**Mapping to Playbook:**

| Incident Type | DICQ 4.4 Compliance | Remediation |
|---|---|---|
| **Data Corruption** | Integrity compromised | Section 2.6.3: Restore from backup, validate chain-hash |
| **Chain Hash Invalid** | Signature verification failed | Section 4.3: Rule evaluation trace, HMAC re-verification |
| **Audit Trail Tampered** | Immutability violated | Section 3.2: Export to immutable storage (GCS), cryptographic proof |
| **HMAC Secret Leaked** | Signature forgery possible | Section 2.6.5: Rotate secret, baseline reset, document pre-rotation window |

**Auditor Checklist:**
- [ ] Chain-hash validator runs regularly + results logged
- [ ] Incident log itself is immutable (in GCS, not editable)
- [ ] All deletions marked as soft-delete (not hard-deleted)
- [ ] Baseline reset events documented (ADR-0017 for HMAC rotation)
- [ ] Historical data integrity window marked (pre-rotation baseline)

---

### DICQ 4.14.6 — Gestão de Riscos (Risk Management)

**Requirement:**
> "Laboratório deve identificar e gerenciar riscos operacionais, incluindo incidentes de segurança. FMEA ou análise similar deve documentar: Probability, Severity, Detection ability, Preventive measures."

**Mapping to Playbook:**

| Phase | DICQ 4.14.6 Compliance |
|---|---|
| **Incident Detection** | Severity matrix (P0/P1/P2) = Risk severity assessment |
| **Investigation** | Root cause analysis = FMEA P (Probability) |
| **Prevention** | Preventive actions = Risk mitigation measures |
| **Drill Program** | Detection capability verification (part of audit) |

**Risk Register Update:**
- After each incident, update `docs/RISK_REGISTER.md`
- Add row: `Incident [date] — [type] — [P×S×D score] — Mitigation: [ticket]`
- Quarterly review: Are preventive actions reducing incident rate?

---

## 4. Compliance Evidence Index

### For RDC 978 Audit (ANVISA Inspector)

**Ask:** "Show me your incident response procedures"

**You show:**
```
docs/INCIDENT_RESPONSE_PLAYBOOK.md
├─ Section 1: Incident classification (maps to Art. 5 quality management)
├─ Section 2: Workflows + escalation (maps to Art. 122 supervision)
├─ Section 3: Notifications (maps to Art. 5 rastreabilidade)
├─ Section 6: Compliance checklist (audit trail requirements)
└─ Real incidents: docs/incidents/INC-*.md (investigation + remediation)
```

**Ask:** "How do you verify chain-hash integrity?"

**You show:**
```
- Cloud Function: validateChainIntegrityScheduled (runs 2x daily)
- Results logged: `audit-violations` collection
- Manual drill: Section 3 in INCIDENT_RESPONSE_VALIDATION_CHECKLIST.md
- Evidence: Last 3 months of validation runs (Cloud Logs export)
```

**Ask:** "What happens if someone tries to forge a signature?"

**You show:**
```
- Firestore rules: validate HMAC signature on critical writes
- Secret management: HCQ_SIGNATURE_HMAC_KEY in Secret Manager
- Incident response: Section 2.6.5 (credential rotation procedure)
- Evidence: ADR-0017 (baseline reset after key compromise 2026-05-07)
```

---

### For LGPD Audit (ANPD Inspector)

**Ask:** "Show me your data breach notification procedures"

**You show:**
```
docs/INCIDENT_RESPONSE_PLAYBOOK.md
├─ Section 1.1: Data Breach classification
├─ Section 2.6.1: Breach containment + investigation
├─ Section 3.2: Customer notification template
├─ Section 3.3: ANPD notification template
└─ Real breaches: docs/incidents/INC-BREACH-*.md (investigation + ANPD receipt)
```

**Ask:** "How do you track deletion requests?"

**You show:**
```
- Request tracking: /lgpd-requests/{labId}/{requestId} collection
- Audit log: eventType = "GDPR_DELETION", with timestamps
- Drill 4: docs/INCIDENT_RESPONSE_VALIDATION_CHECKLIST.md (quarterly test)
- Verification: Request status + deletion evidence + patient notification
```

**Ask:** "What is your 72-hour breach notification process?"

**You show:**
```
Section 2.3 (Escalation) + Section 3.3 (Notification templates)
Timeline:
  [0–24h] Investigation + scope confirmation
  [24–48h] Draft notification to customers
  [48–72h] Submit to ANPD
Proof: Incident logs + ANPD submission receipts (docs/incidents/*)
```

---

### For DICQ Accreditation Auditor

**Ask:** "How do you ensure data integrity? Show me your controls."

**You show:**
```
1. Preventive: Firestore rules validate payload + HMAC on writes
2. Detective: validateChainIntegrityScheduled runs 2x daily
3. Responsive: Incident Response Playbook Section 2.6.3 (data restore)
4. Verification: Quarterly drills testing detection + recovery
Evidence: Chain validator logs + last 3 drill reports
```

**Ask:** "Show me your incident documentation from the past 12 months"

**You show:**
```
docs/incidents/
├─ INC-2026-04-15-001.md (outage, resolved via rollback)
├─ INC-2026-04-22-002.md (chain-hash failure, resolved via baseline reset)
├─ INC-2026-05-03-003.md (data corruption, resolved via restore)
└─ ... (one entry per incident)

Each includes:
  - Timeline (detection → investigation → resolution)
  - Root cause analysis
  - Preventive actions taken
  - Chain-hash validation on affected data
```

**Ask:** "How do you know your incident response system works?"

**You show:**
```
Quarterly drills: docs/INCIDENT_RESPONSE_VALIDATION_CHECKLIST.md
├─ Drill #1: Data Breach (Q1, Q3, etc.)
├─ Drill #2: Outage + Rollback
├─ Drill #3: Data Corruption + Restore
├─ Drill #4: LGPD Compliance
├─ Drill #5: Security Incident
Post-mortem for each: action items + completion proof
```

---

## 5. Evidence Preservation Requirements

**By Law (RDC 978 + LGPD):**
- Incident investigations must be preserved for ≥5 years
- Audit trail must be immutable (hash-protected or in append-only storage)
- Evidence cannot be altered retroactively

**By Technical Best Practice:**
- Cloud Logs exports → GCS (immutable, versioned)
- Firestore backups → separate project (read-only)
- Git commits → signed (GPG), pushed to remote (cannot rewrite history)

**HC Quality Implementation:**

```
Incident Discovery (T=0)
    ↓
[Immediately] Preserve evidence
    ├─ Cloud Logs snapshot → gs://hmatologia2-incident-backups/logs/
    ├─ Firestore export → gs://hmatologia2-incident-backups/exports/
    └─ Git log screenshot → docs/incidents/INC-*.md
    ↓
[Investigation phase] Collect findings
    ├─ Root cause hypothesis
    ├─ Scope (affected records, dates)
    └─ Timeline of events
    ↓
[Post-incident] Create incident record
    └─ docs/incidents/INC-YYYY-MM-DD-### .md
       └─ Final report + links to evidence in GCS
    ↓
[Retention] Archive minimum 5 years
    └─ GCS bucket versioning enabled (immutable)
```

---

## 6. Compliance Checklist for Incident Closure

**Before closing any P0 incident:**

- [ ] **Regulatory:** Notification sent if required (72h for breach, 24h for corruption)
- [ ] **Audit Trail:** Cloud Logs exported to GCS + link in incident record
- [ ] **Data Integrity:** Chain-hash verified on sample of affected documents
- [ ] **Root Cause:** Documented in post-mortem (not "unknown")
- [ ] **Preventive Action:** Jira ticket created + assigned (if applicable)
- [ ] **Compliance:** Incident record matches RDC 978 Art. 5 + DICQ 4.4 standards
- [ ] **Communication:** Customer + team + regulator notified (if applicable)
- [ ] **Evidence:** All documents archived in `docs/incidents/` for auditor review

---

## 7. Auditor-Ready Incident Report Template

**When an auditor asks to review incidents, provide this:**

```markdown
# Incident Report — [INC-YYYY-MM-DD-###]

## Regulatory Classification
- RDC 978 Art. 5? **YES** (Quality Management incident)
- RDC 978 Art. 86? **YES** (Rastreabilidade impact)
- LGPD Art. 34? **YES/NO** (Breach notification required)
- DICQ 4.4? **YES** (Data integrity question)

## Executive Summary
[1 paragraph overview]

## Timeline
| Time (UTC) | Event | Responsible |
| --- | --- | --- |
| [time] | Detection | [name] |
| [time] | Investigation | [name] |
| [time] | Remediation | [name] |
| [time] | Closure | [name] |

## Root Cause (RDC 978 Art. 5 requirement)
[Description of why incident occurred]

## Regulatory Notifications (RDC 978 Art. 5 + LGPD Art. 34)
- [ ] Customer notified: [date/time]
- [ ] ANPD notified: [date/time] (if breach)
- [ ] ANVISA notified: [date/time] (if safety impact)

## Data Integrity Verification (DICQ 4.4 requirement)
- Chain-hash validation: [date] — 50 documents sampled — PASS/FAIL
- Audit trail integrity: [date] — reviewed — OK/ISSUES

## Preventive Actions (RDC 978 Art. 5 requirement)
| Action | Jira Ticket | Owner | Due Date |
| --- | --- | --- | --- |
| [action] | [ticket] | [owner] | [date] |

## Compliance Officer Approval
Signature: _____________ Date: _________
```

---

## 8. Document Governance

**Responsibility:**
- **Incident Response Playbook:** Updated by CTO after each incident (lessons learned)
- **Validation Checklist:** Executed quarterly by QA + DevOps
- **Compliance Mapping:** Updated annually or when regulations change
- **Evidence Archive:** Managed by Compliance Officer (retention policy enforced)

**Review Cycles:**
- **Immediate:** After P0 incidents (within 10 days)
- **Quarterly:** After drill cycle (every 3 months)
- **Annually:** Before accreditation audits (DICQ, ANVISA)
- **As-Needed:** When regulatory requirements change (LGPD updates, RDC amendments)

---

**Document Owner:** CTO + Compliance Officer  
**Next Review:** 2026-11-07  
**Classification:** DICQ 4.4 / RDC 978 Art. 5 / LGPD Art. 34–35  
