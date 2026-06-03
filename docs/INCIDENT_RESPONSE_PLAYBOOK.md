# Incident Response Playbook — HC Quality Phase 3

**Document ID:** IRP-001  
**Version:** 1.0  
**Effective Date:** 2026-05-07  
**Next Review:** 2026-05-07 + 6 months  
**Owner:** CTO + DevOps + Security Lead  
**Classification:** DICQ 4.4 (Gestão de documentação + Trilha de auditoria)

---

## Executive Summary

This playbook defines response procedures for critical incidents in HC Quality (hmatologia2) — a production SaaS system serving clinical laboratories with quality control data, patient results, and regulatory documentation.

**Scope:** Data breach, system outage, data corruption, compliance violations, security incidents.

**RDC 978 Art. 5 Compliance:** All procedures include mandatory notification timelines, audit trail preservation, and evidence collection per LGPD Art. 34 (72h breach notification) and ANVISA reporting requirements.

**Incident Severity Levels:**

| Priority | Impact                                                                                  | RTO     | Notification                          |
| -------- | --------------------------------------------------------------------------------------- | ------- | ------------------------------------- |
| **P0**   | Patient safety risk, data breach, system down, regulatory reporting required            | 15 min  | Immediate: CTO + customer + regulator |
| **P1**   | Significant service degradation, data integrity concern, potential compliance violation | 1 hour  | Within 30 min: CTO + customer         |
| **P2**   | Minor service impact, isolated user report, no compliance implications                  | 8 hours | Within 4 hours: team + customer       |
| **P3**   | Informational, post-incident improvement                                                | No SLA  | End of day                            |

---

## 1. Incident Classification

### 1.1 Data Breach (Patient PII / Health Records Exposed)

**Regulatory Impact:** RDC 978 Art. 5 + LGPD Art. 34 + LGPD Art. 35  
**Notification Deadline:** 72 hours to affected patients + ANPD  
**Investigative Scope:** Who accessed? How much data? When was breach detected?

**Indicators:**

- Unauthorized read access to `/pacientes/{labId}/*`, `/laudos/{labId}/*`, `/declaracoes/{labId}/*`
- Firestore audit logs show `read` from unexpected IP / service account
- Customer reports patient complaint about unauthorized access
- External notification (e.g., data found on dark web)

**Severity Assignment:**

- P0 if: >100 patients affected OR contains health data (diagnoses, test results) OR data exported/exfiltrated
- P1 if: <100 patients, only contact info, contained to single lab
- P2 if: Suspicious read denied by rules (attempted breach, not successful)

---

### 1.2 System Outage (Firestore Rules Broken, Functions Down)

**Regulatory Impact:** RDC 978 Art. 122 (supervisão contínua), DICQ 4.1 (funções documentadas)  
**Notification Deadline:** Immediate to customer; ANVISA notified if >1h downtime  
**Investigative Scope:** Root cause, which modules affected, how long?

**Indicators:**

- Firebase Hosting returns 5xx errors or connection refused
- Cloud Functions time out or crash on invocation
- Firestore rules reject all writes with permission error
- Customer reports "app is down" or "can't save my work"
- Cloud Monitoring alerts: error rate >5%, latency >10s

**Severity Assignment:**

- P0 if: All modules down OR downtime >30 min without ETA recovery
- P1 if: Specific module down (e.g., CIQ analyzer) but core hub accessible OR downtime 5–30 min
- P2 if: Intermittent errors, specific user action fails, system recovers within 5 min

---

### 1.3 Data Corruption (Laudo Draft Locked, Chain Hash Invalid)

**Regulatory Impact:** RDC 978 Art. 86 (rastreabilidade), DICQ 4.4 (registros íntegros)  
**Notification Deadline:** 24 hours to determine scope; 72h to remediate if patient-facing  
**Investigative Scope:** Which documents? Root cause? Scope of corruption?

**Indicators:**

- Firestore document hash verification fails (`chainHash` mismatch)
- Cloud Function writes inconsistent data (missing `labId`, null timestamps)
- Laudo marked "locked" but operator reports they didn't lock it
- Audit trail shows write timestamp but author is deactivated
- NOTIVISA payload validation fails (missing required fields)

**Severity Assignment:**

- P0 if: Regulatory document (NOTIVISA, certification) corrupted OR >50 docs affected
- P1 if: Working copy (draft laudo) corrupted but published version intact OR <50 docs
- P2 if: Single document corruption, easily recoverable, no patient-facing impact

---

### 1.4 Compliance Violation (LGPD Erasure Not Processed)

**Regulatory Impact:** LGPD Art. 18 (direito de acesso), LGPD Art. 35 (direito de exclusão), RDC 978 Art. 5.3  
**Notification Deadline:** 30 days to customer's data subject; audit trail must be preserved  
**Investigative Scope:** Which request? Processed status? Audit trail intact?

**Indicators:**

- Data subject requests deletion; system does not act within 30 days
- Soft-delete flag set but data still visible in queries
- Export request (Art. 18) incomplete or malformed
- Audit trail for deletion request missing
- DPIA findings not addressed (risk mitigation overdue)

**Severity Assignment:**

- P0 if: Legal obligation deadline passed (>30 days since valid request)
- P1 if: Valid request not actioned within 15 days
- P2 if: Technical issue processing request but deadline not approached

---

### 1.5 Security Incident (Unauthorized Access, Secret Exposed)

**Regulatory Impact:** RDC 978 Art. 5.3 (confidentiality), LGPD Art. 34 + 35 (notification), Lei 13.787/2018 (electronic signatures)  
**Notification Deadline:** Immediate to CTO; 72h to customer if data exfiltration confirmed  
**Investigative Scope:** Credential scope, affected systems, attacker capability?

**Indicators:**

- API key or `HCQ_SIGNATURE_HMAC_KEY` found in git history
- Firebase Admin SDK credentials leaked via third-party tool
- Anomalous audit log activity (writes from unexpected location, timezone, IP)
- Invalid HMAC on historical signatures (indicates secret compromise)
- Phishing attack reports on team

**Severity Assignment:**

- P0 if: Admin-level credential compromised OR secret in public repo OR attacker already wrote data
- P1 if: Read-only credential leaked (no immediate write risk) OR secret in private repo
- P2 if: Credential rotated before use detected

---

## 2. Incident Response Workflow

### 2.1 Universal Workflow (All Incident Types)

```
Detection
    ↓
[0–5 min] Triage & Severity Assignment
    ↓
[5–15 min] Escalation & Incident Channel
    ↓
[15–60 min] Investigation & Cause Analysis
    ↓
[Parallel] Evidence Preservation
    ↓
[15–120 min] Remediation (Context-Dependent)
    ↓
[Post-Remediation] Communication & Notification
    ↓
[24–72 hours] Post-Mortem & Prevention
```

### 2.2 Phase: Detection → Triage (0–5 minutes)

**Who:** On-call engineer or operations team  
**Actions:**

1. **Confirm incident is real** (not false positive, not isolated user issue):
   - Check Cloud Monitoring dashboard: error rate, latency, function invocations
   - Ping Firestore: single read operation from Cloud Console
   - Test public Hosting URL in incognito browser
   - Check GCP Cloud Status (are we in a region outage?)

2. **Determine severity level** using classification matrix above
3. **Note timestamp** when issue was first observed (detection time)
4. **Create Slack thread** in `#incident` channel: `[P0|P1|P2] <title> — <one-line description>`

**Example:**

```
[P0] Data Breach — Unauthorized reads detected in pacientes collection
Detected: 2026-05-07 14:23 UTC
Classification: Data Breach
Scope: Unknown (investigation in progress)
```

---

### 2.3 Phase: Escalation & Incident Channel (5–15 minutes)

**Who:** Triage engineer escalates; incident commander (IC) designated by CTO

**Actions by Priority:**

#### P0 → Immediate escalation

1. **Ping on Slack:** `@CTO @DevOps-Lead @Security-Lead` in `#incident`
2. **Phone call:** (if Slack acknowledgment >2 min)
3. **Open incident room:** [Google Meet link in pinned message on thread]
4. **Notify customer:** "We have detected an issue affecting your service. Investigation underway. ETA update in 15 minutes."
5. **Notify regulator (if applicable):**
   - Data breach: ANPD initial report placeholder ("Investigation in progress, detailed report within 72h")
   - System outage >30 min: ANVISA system status update

#### P1 → Escalation within 30 minutes

1. Ping on Slack: `@CTO @DevOps-Lead`
2. Email CTO with incident link
3. Notify customer: "We are investigating a service issue. Updates every 30 minutes."

#### P2 → Logged, addressed within 8 hours

1. Log in `#incident` thread
2. Assign to on-call engineer
3. No immediate customer notification unless asked

---

### 2.4 Phase: Investigation & Cause Analysis (15–60 minutes)

**Incident Commander Responsibilities:**

- Designate primary investigator (usually the on-call engineer who detected it)
- Update status every 15 minutes in Slack + customer
- Collect evidence in real-time (see Section 3 below)
- Make go/no-go decisions: patch in-place vs. rollback vs. restore from backup

**Investigation Checklist:**

- [ ] **Timeline:** When did the issue start? Any recent deploys? Rule changes?
- [ ] **Scope:** Which users? Which data? Which modules?
- [ ] **Root cause hypothesis:** Bad deploy, misconfiguration, third-party failure, or intentional?
- [ ] **Blast radius:** How many customers affected? How much data at risk?
- [ ] **Reversibility:** Can we rollback? Is rollback safe?

**Where to Look (by incident type):**

**Data Breach → Check Firestore audit logs:**

```
gcloud logging read "resource.type=cloud_firestore AND severity >= WARNING" \
  --project=hmatologia2 --limit=1000 --format=json | jq '.[] | select(.jsonPayload.operation == "read")'
```

Look for: unusual IPs, service accounts, read patterns that match `pacientes`, `laudos`, `declaracoes` collections.

**System Outage → Check Cloud Functions logs:**

```
gcloud logging read "resource.type=cloud_function AND severity >= ERROR" \
  --project=hmatologia2 --limit=500 --format=json
```

Look for: timeout, permission denied, out of memory, deploy failures.

**Data Corruption → Check Firestore directly:**

- Navigate to document in Firebase Console
- Check `chainHash`, `assinatura`, `labId` fields
- Run spot-check: `validateChainIntegrityScheduled` on 10 random docs from the affected collection
- Check audit logs for writes that created/modified the corrupted doc

**Compliance Violation → Check LGPD audit trail:**

```
gcloud logging read "resource.type=cloud_firestore AND jsonPayload.collection = 'lgpd-requests'" \
  --project=hmatologia2 --limit=100
```

Look for: request date, completion status, delay vs. 30-day deadline.

**Security Incident → Check Cloud IAM + Firestore rules:**

- Review recent IAM role assignments (Cloud Console → IAM & Admin)
- Check git history for accidental commits: `git log -p --all -S 'HMAC_KEY' | head -100`
- Review Firestore rule changes: `git log -p firestore.rules | head -50`
- Check Secret Manager audit log for access to `HCQ_SIGNATURE_HMAC_KEY`

---

### 2.5 Phase: Evidence Preservation (Parallel, ongoing)

**Golden Rule:** Do NOT touch production data while investigating. Make copies.

**Immediate Actions (within 15 min of triage):**

1. **Cloud Logs snapshot:**

   ```bash
   gcloud logging read "resource.type=cloud_function OR resource.type=cloud_firestore" \
     --project=hmatologia2 --limit=10000 --format=json > /tmp/incident-logs-$(date +%s).json
   ```

   Upload to incident Slack thread.

2. **Firestore rules snapshot:**

   ```bash
   firebase firestore:indexes --project hmatologia2 > /tmp/firestore-indexes.json
   cat firestore.rules > /tmp/firestore-rules-snapshot.txt
   ```

   Archive in incident folder.

3. **Affected documents (read-only):**
   If investigating data corruption, export samples:

   ```bash
   gcloud firestore export gs://hmatologia2-incident-backups/export-$(date +%s) \
     --project=hmatologia2
   ```

   Do NOT download to local machine without CTO approval.

4. **Screenshot audit trail:**
   Cloud Console → Logs Explorer → capture current state (filters, results) as PNG.

---

### 2.6 Phase: Remediation (Context-Dependent)

#### Data Breach → Immediate containment, then investigation

**Steps:**

1. **Contain (0–15 min):**
   - **If attacker has active access:** Rotate compromised credential immediately (see Section 2.6.5)
   - **If breach was read-only via stolen session:** Invalidate user sessions, force re-auth
   - **If breach via compromised rule:** Deploy fixed rules immediately (after emergency review)

2. **Investigate scope (15–60 min):**
   - Query: Which collections were accessed? What date range?
   - Sample 10 records from each affected collection. Any sensitive fields missing (redacted)?
   - Cross-check with customer access logs. Do customer records match system logs?

3. **Notify customers affected (60–120 min):**
   - For each lab: "We detected unauthorized access to [X] patient records. Details: [summary]. Remediation: [what we did]. Next steps: [what customer should do]."
   - Prepare ANPD initial report (template in Section 4).

4. **Preserve audit trail (ongoing):**
   - Do NOT delete any audit logs, even suspicious ones.
   - Mark affected users for forensic review (do not change their access until post-mortem).

#### System Outage → Restore or rollback

**Decision tree:**

```
Is root cause a recent code/rule deploy?
  YES → Rollback to previous version (see Rollback Procedure below)
  NO → Is Firestore/Functions quota exceeded?
       YES → Request GCP quota increase; enable auto-scaling if not enabled
       NO → Is GCP region having issues?
            YES → Wait up to 2 hours for recovery; if ongoing, failover to secondary region
            NO → Local application error; investigate root cause, apply hotfix + deploy
```

**Rollback Procedure (if applicable):**

1. Identify last known-good commit:

   ```bash
   git log --oneline | head -10
   # Example output:
   # a1b2c3d [PROD] Phase 3 feature release
   # d4e5f6g [STAGING] WIP: new CIQ module
   # x7y8z9a [PROD] Critical hotfix — rules regression
   ```

2. Check if deploy of `x7y8z9a` is associated with outage. If yes, rollback to `a1b2c3d`:

   ```bash
   # Option A: Redeploy specific services from previous commit
   git checkout a1b2c3d -- firestore.rules functions/
   firebase deploy --only firestore:rules,functions --project hmatologia2

   # Option B: Revert commit (creates new commit that undoes changes)
   git revert --no-edit x7y8z9a
   git push origin main
   firebase deploy --only hosting,functions,firestore:rules --project hmatologia2
   ```

3. **After rollback:**
   - Wait 2 minutes for Cloud Functions to re-warm
   - Run smoke test: [See Smoke Test Checklist, Section 4.3]
   - If outage persists, proceed to **Data Restore from Backup** (Scenario 1 procedure in DR_PLAN.md)

#### Data Corruption → Restore from backup

1. **Stop all writes immediately:**
   - Deploy a maintenance rule that rejects all writes:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read: if true;
           allow write: if false; // MAINTENANCE MODE
         }
       }
     }
     ```

2. **Determine scope of corruption:**
   - Check `criadoEm` of oldest corrupted document
   - Identify clean backup from before that timestamp (DR_PLAN.md Scenario 1)

3. **Restore from snapshot:**
   - Restore to staging project first (validate)
   - If good, restore to production (detailed steps in DR_PLAN.md §Restore)
   - Re-enable rules from step 1

4. **Post-restore:**
   - Run chain-hash validation on 100 random documents
   - Notify customers: "Data has been restored to [timestamp]. Any changes after that are lost."

#### Compliance Violation → Remediate + document

**Example: LGPD Erasure Request overdue**

1. **Immediate action:**
   - Locate deletion request in `/lgpd-requests/{labId}/{requestId}`
   - Check `status` field. If not `completed`, update to `completed` and set `completedAt: now()`
   - Execute soft-delete via callable:
     ```bash
     gcloud functions call deletePatientsDataByRequest \
       --project=hmatologia2 --region=southamerica-east1 \
       --data='{"requestId":"xyz","labId":"lab123"}'
     ```

2. **Document remediation:**
   - Update request with `overdueDays` calculation
   - Create incident log entry in `audit-violations` collection

3. **Root cause analysis:**
   - Why was request not processed? Missing webhook? Cloud Function crashed?
   - Fix the root cause to prevent recurrence

#### Security Incident → Rotate credential + verify scope

**Example: API key leaked**

1. **Immediate action:**

   ```bash
   # Revoke compromised key
   gcloud services api-keys delete projects/hmatologia2/locations/global/keys/abc123 \
     --project=hmatologia2

   # Create new key
   gcloud services api-keys create --project=hmatologia2 --restrictions api_target=firestore.googleapis.com

   # Update application (Functions, CI/CD, client SDKs)
   firebase functions:secrets:set FIRESTORE_API_KEY --project hmatologia2 # paste new key
   firebase deploy --only functions --project hmatologia2
   ```

2. **Verify attacker did not escalate privilege:**
   - Query Cloud Audit Logs for writes from compromised key in last 7 days:
     ```bash
     gcloud logging read "protoPayload.authenticationInfo.principalEmail = 'firestore-api-key@...'" \
       --project=hmatologia2 --limit=1000
     ```
   - If any writes found: proceed to **Data Corruption** remediation

3. **Monitor for re-compromise:**
   - Set up alert on Secret Manager access to new key
   - Check git history for any re-exposed keys

---

## 3. Communication Templates

### 3.1 Customer Notification — Outage

**Subject:** Service Incident — [Lab Name] HC Quality

**Template:**

```
Dear [Lab Name] team,

We are currently investigating a service issue affecting HC Quality.

Incident Details:
- Detected: [timestamp UTC]
- Services Affected: [CIQ analyzer / All modules / Specific modules]
- Status: [Investigating / Remediating / Resolved]
- ETA Recovery: [timeframe, or "Unknown"]

What we are doing:
[1–2 sentences about root cause hypothesis and actions underway]

What you should do:
- Do NOT attempt to re-save incomplete work (retry after recovery)
- Contact support if you have questions: suporte@hcquality.com.br

Next update: [time + 30 min]

Regards,
HC Quality Operations
```

**Send via:** Email + Slack (if customer has integration) + status page (status.hcquality.com.br)

---

### 3.2 Customer Notification — Data Breach

**Subject:** Data Security Notice — [Lab Name] HC Quality

**Template:**

```
Dear [Lab Name] team,

We are writing to inform you of a data security incident that may affect your laboratory.

Incident Summary:
- Date Detected: [date time UTC]
- Type: Unauthorized access to [patient records / quality control data / other]
- Scope: [Estimated number of patients/records affected]
- Regulatory Notification: We are notifying ANPD (Brazilian Data Protection Authority) as required

What data was accessed:
[List specific fields: names, patient IDs, test results, etc.]

What data was NOT accessed:
[Passwords, credit cards, billing info (if applicable)]

What we are doing:
1. Containing the breach (revoking unauthorized access)
2. Investigating the scope and root cause
3. Implementing additional security controls to prevent recurrence

What you should do:
1. Inform your patients of potential exposure (we are providing a template)
2. Contact us with any questions: security@hcquality.com.br
3. Review your access logs (available in HC Quality portal)

Detailed Incident Report:
[Attach detailed report — see Section 3.5]

Regards,
HC Quality Security Team
```

---

### 3.3 Regulator Notification — ANPD (LGPD Breach Report)

**Required per:** Lei 13.709/2018 (LGPD) Art. 34, ANPD Guidelines

**Initial Report (within 72 hours of confirmed breach):**

```
NOTIFICAÇÃO DE INCIDENTE DE SEGURANÇA — PROTEÇÃO DE DADOS PESSOAIS

Requerente: [Lab Name], CNPJ [CNPJ]
Data de Envio: [data/hora]
Data do Incidente: [data/hora primeira detecção]

1. Descrição do Incidente
   Tipo: Acesso não autorizado
   Dados afetados: [Pacientes, resultados de exames, etc.]
   Número estimado de titulares: [número]

2. Causa Raiz (Investigação em andamento)
   Hipótese: [credencial comprometida / falha de regra / outro]
   Status: [a confirmar / confirmado]

3. Medidas Tomadas Imediatamente
   - [Medida 1]
   - [Medida 2]
   - [Medida 3]

4. Próximos Passos
   - Relatório completo dentro de 72 horas
   - Notificação aos titulares de dados
   - Implementação de controles adicionais

Contato:
   Nome: [CTO / Security Lead]
   Email: drogafarto@gmail.com
   Telefone: [número]
```

**Detailed Report (within 72 hours, before notifying patients):**

- Root cause analysis
- Scope confirmation (exact number of patients, fields accessed)
- Timeline of access
- Attacker/threat actor identification (if possible)
- Remediation completed
- Measures to prevent recurrence

---

### 3.4 Regulator Notification — ANVISA (System Outage Report)

**Required per:** RDC 978/2025 Art. 5, DICQ 4.1 (supervisão)

**Notification:** If production outage >1 hour AND patient results affected

```
NOTIFICAÇÃO DE FALHA OPERACIONAL — RDC 978

Laboratório: [Lab Name], CNPJ [CNPJ]
Data da Falha: [data/hora início]
Duração: [horas]

Descrição:
Falha no sistema HC Quality afetou [módulos específicos] por [duração].
Pacientes afetados: [número estimado]
Resultados não processados: [número]

Causa:
[Descrição técnica — deploy defeituoso, quota excedida, outage regional GCP, etc.]

Ações Tomadas:
- Sistema restaurado em [data/hora]
- Todos os resultados pendentes reprocessados
- Rastreabilidade mantida via log de auditoria

Documentação:
- Logs de incidente disponíveis em [link ao Portal HC Quality]
- Análise de causa raiz: [arquivo anexado]
```

---

### 3.5 Internal Post-Incident Report (Post-Mortem)

**Template:**

```markdown
# Incident Post-Mortem Report

**Incident ID:** [INC-YYYY-MM-DD-001]  
**Date:** [YYYY-MM-DD]  
**Severity:** [P0|P1|P2]  
**Duration:** [HH:MM]

## 1. Summary

[1–2 paragraph summary of what happened, who was affected, resolution]

## 2. Timeline

| Time (UTC) | Event                                      |
| ---------- | ------------------------------------------ |
| 14:23      | Issue detected via alert / customer report |
| 14:28      | Triage complete, severity assigned P0      |
| 14:35      | Root cause identified: [description]       |
| 14:50      | Remediation deployed                       |
| 15:01      | System recovered, validation passed        |
| 15:15      | Customer notified                          |

## 3. Root Cause Analysis

**Primary cause:** [description]

**Contributing factors:**

- [Factor 1]
- [Factor 2]

## 4. Impact

- **Systems:** [affected modules]
- **Users:** [number of labs/operators]
- **Data:** [any data loss? corruption? exposure?]
- **Compliance:** [any regulatory violations?]

## 5. Resolution

**What we did:**
[Steps taken to resolve]

**What worked well:**
[Positive aspects: fast detection, clear escalation, effective communication]

**What we should improve:**
[Gaps in process, tools, documentation]

## 6. Preventive Actions

| Action                                 | Owner    | Due Date   |
| -------------------------------------- | -------- | ---------- |
| [Action 1: Implement monitoring for X] | Engineer | YYYY-MM-DD |
| [Action 2: Update runbook for Y]       | DevOps   | YYYY-MM-DD |
| [Action 3: Add test for Z]             | QA       | YYYY-MM-DD |

## 7. Approval

- CTO approval: **\_\_** (sign + date)
- Tech Lead approval: **\_\_** (sign + date)
```

---

## 4. Evidence Preservation Procedures

### 4.1 Cloud Logs Snapshot

**When:** Immediately upon incident triage (P0/P1 only)  
**How:**

```bash
# Export full logs to GCS (persistent backup)
gcloud logging read "resource.type=(cloud_function OR cloud_firestore OR cloud_run)" \
  --project=hmatologia2 \
  --limit=10000 \
  --format=json > incident-logs-$(date +%Y%m%d-%H%M%S).json

# Upload to incident folder
gsutil cp incident-logs-*.json gs://hmatologia2-incident-backups/logs/

# Alternative: Create Cloud Logging sink (real-time)
gcloud logging sinks create incident-sink \
  gs://hmatologia2-incident-backups/logs/ \
  --log-filter='severity >= ERROR' \
  --project=hmatologia2
```

**Retention:** Minimum 1 year in GCS (per DICQ 4.4 + RDC 978 Art. 115)

---

### 4.2 Firestore Audit Trail Export

**When:** After evidence collection, before any remediation writes  
**How:**

```bash
# Export full database to GCS
gcloud firestore export gs://hmatologia2-incident-backups/exports/export-$(date +%s) \
  --project=hmatologia2 \
  --async

# Monitor export job
gcloud firestore operations list --project=hmatologia2

# Download to local for analysis (CTO approval required)
gsutil -m cp -r gs://hmatologia2-incident-backups/exports/export-TIMESTAMP/* /tmp/firestore-export/
```

**Includes:** All collections, subcollections, deleted documents (soft-delete), audit metadata

---

### 4.3 Rule Evaluation Trace (Security Incidents)

**When:** If incident involves unauthorized access or rule bypass  
**How:**

1. **Enable debug logging in Firestore rules (temporary):**

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     function debugLog(message) {
       return debug(message);
     }

     match /databases/{database}/documents {
       match /pacientes/{labId}/{rest=**} {
         allow read: if debugLog('read attempt from ' + request.auth.uid) && isActiveMemberOfLab(labId);
       }
     }
   }
   ```

2. **Deploy rules, reproduce incident**
3. **Capture debug logs:**

   ```bash
   gcloud logging read "resource.type=cloud_firestore AND jsonPayload.debugOutput != null" \
     --project=hmatologia2 --limit=1000 --format=json
   ```

4. **Revert to production rules (remove debug)**

---

### 4.4 Function Error Logs

**When:** For all outages + data corruption  
**How:**

```bash
# Export error logs from specific function
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=createLaudoCallable" \
  --project=hmatologia2 --format=json | jq '.[] | select(.severity == "ERROR")'
```

**Preserve:** Stack traces, error messages, invocation IDs

---

## 5. Recovery & Prevention

### 5.1 Hotfix Deployment vs. Rollback Decision Tree

```
Is the bug a clear regression in the current deploy?
  └─ YES → Can we rollback to stable version?
     └─ YES → Rollback (faster)
        Rollback procedure: (see Section 2.6, step 2)
     └─ NO → Apply hotfix (minimize custom code)
        Hotfix procedure: (see below)

  └─ NO → Is this a pre-existing bug surfaced by load/usage?
     └─ YES → Apply hotfix + increase test coverage
     └─ NO → Investigate further before deciding
```

**Hotfix Procedure:**

1. Create hotfix branch from production tag:

   ```bash
   git checkout tags/prod-v1.3-2026-05-07
   git checkout -b hotfix/incident-INC-001-quick-fix
   ```

2. Make minimal change (1–3 lines):

   ```bash
   # Example: Fix permission check in rules
   nano firestore.rules
   # Change one condition
   git diff firestore.rules
   ```

3. Test locally:

   ```bash
   npm run test:firestore  # Must pass 100%
   npm run build           # No errors
   ```

4. Deploy with incident ID in commit message:

   ```bash
   git add firestore.rules
   git commit -m "hotfix(INC-001): fix permission check for CIQ reads"
   firebase deploy --only firestore:rules,functions --project hmatologia2
   ```

5. Validate in production (smoke test + logs clean)

6. Merge back to main:
   ```bash
   git checkout main
   git merge hotfix/incident-INC-001-quick-fix
   ```

---

### 5.2 Post-Incident Improvements

**30-Day Review Cycle:**

1. **Week 1 (day 1–7):** Root cause analysis complete. Initial preventive actions logged.
2. **Week 2 (day 7–14):** Quick wins (documentation, monitoring, test coverage) completed.
3. **Week 3 (day 14–21):** Medium-term improvements (architectural changes, rule refactors) in progress.
4. **Week 4 (day 21–30):** All preventive actions closed OR rescheduled with new date.

**Preventive Action Categories:**

| Category          | Examples                                                     | Timeline |
| ----------------- | ------------------------------------------------------------ | -------- |
| **Monitoring**    | Add alert for unusual IP patterns, add rate-limit alert      | 1 week   |
| **Documentation** | Update runbook, add FAQ entry, create decision tree          | 1 week   |
| **Testing**       | Add integration test for [scenario], add chaos test          | 2 weeks  |
| **Architecture**  | Refactor [module], extract [common pattern], add retry logic | 4 weeks  |
| **Training**      | Team training on [incident type], update on-call runbook     | 1 week   |

**Ticket Creation:**

Create Jira/GitHub ticket for each preventive action:

```
Title: [PREVENT-INC-001] Add rate-limit alert for CIQ writes

Description:
Incident INC-001 exposed missing alert for CIQ write spike.
If >1000 writes/min to CIQ collections for >5 min, alert ops team.

Acceptance Criteria:
- Alert rule created in Cloud Monitoring
- Alert routing configured to #ops-alerts
- Alert has been triggered and acknowledged in test environment
- Runbook linked to alert
```

---

## 6. RDC 978 Art. 5 Compliance Checklist

**RDC 978 Art. 5** requires laboratories to:

> "Manter registros de rastreabilidade e conformidade, incluindo incidentes de segurança, relatórios de investigação e medidas corretivas, acessíveis para inspeção por órgãos reguladores."

**Incident Response Compliance:**

- [ ] **Detection logged:** Incident detected and logged in audit trail within 5 minutes
- [ ] **Severity assigned:** Classification documented with rationale
- [ ] **Escalation chain:** Appropriate roles notified per severity level
- [ ] **Investigation documented:** Root cause analysis with evidence preserved
- [ ] **Notification timeline met:** 72h for breach, 24h for corruption, 30 days for LGPD
- [ ] **Audit trail immutable:** All incident logs exported to Cloud Storage before any remediation
- [ ] **Remediation verified:** Smoke tests pass, chain-hash validates on samples
- [ ] **Communication archived:** Customer notifications, regulator reports saved
- [ ] **Post-mortem completed:** Within 10 days of incident close
- [ ] **Preventive actions tracked:** Jira tickets created, assigned, deadline set

---

## 7. On-Call Escalation Matrix

| Role                               | On-Call Hours                     | Phone   | Email                     | Escalation Path                         |
| ---------------------------------- | --------------------------------- | ------- | ------------------------- | --------------------------------------- |
| **Tier 1: DevOps**                 | 24/7                              | [phone] | devops@hcquality.com.br   | Initial response, triage                |
| **Tier 2: CTO**                    | 24/7 weekdays, on-demand weekends | [phone] | drogafarto@gmail.com      | P0/P1 decision, remediation approval    |
| **Tier 3: Tech Lead**              | 24/7 (backup CTO)                 | [phone] | tech@hcquality.com.br     | If CTO unreachable >15 min              |
| **Tier 4: Security Lead**          | 24/7 for security incidents       | [phone] | security@hcquality.com.br | Data breach, credential compromise      |
| **Tier 5: Legal + ANVISA Liaison** | Business hours                    | —       | legal@hcquality.com.br    | Regulatory notification (>8h incidents) |

**Escalation SLA:**

- **Tier 1 responds:** <5 min (P0), <15 min (P1), <2h (P2)
- **Tier 2 responds:** <15 min (P0), <30 min (P1)
- **Tier 3 override:** If Tier 2 unresponsive >15 min

---

## 8. Quick Reference: Incident Decision Tree

```
INCIDENT DETECTED
    ↓
Is it a real issue? (not false positive)
  ├─ NO  → Log and move on
  └─ YES → TRIAGE (Section 2.2)
          Determine Severity (P0/P1/P2)
          ↓
          Is it P0?
          ├─ YES ──→ ESCALATE IMMEDIATELY (Section 2.3)
          │          Phone call + Slack + Incident room
          │          ↓
          │          ROOT CAUSE? (Section 2.4)
          │          ├─ Data breach → CONTAIN + PRESERVE (Section 2.6.1)
          │          ├─ System outage → ROLLBACK OR RESTORE (Section 2.6.2)
          │          ├─ Corruption → STOP WRITES + RESTORE (Section 2.6.3)
          │          ├─ Compliance violation → REMEDIATE + DOCUMENT (Section 2.6.4)
          │          └─ Security → ROTATE CREDENTIAL (Section 2.6.5)
          │          ↓
          │          NOTIFY CUSTOMER (Section 3.2)
          │          NOTIFY REGULATOR IF REQUIRED (Section 3.3/3.4)
          │          ↓
          │          VERIFY FIX (Smoke tests, chain-hash validation)
          │          ↓
          │          POST-MORTEM (Section 5.2)
          │
          └─ NO (P1/P2) → LOG IN SLACK + ASSIGN
                          Follow same flow as P0 but slower SLA
```

---

## 9. Appendix: Runbook Links

- **Firestore Restore:** `docs/DR_RUNBOOKS.md` § Scenario 1 (Data Corruption)
- **Rollback Procedure:** `docs/deploy-protocol.md` § Rollback
- **Smoke Test Checklist:** `docs/SMOKE_TESTS_v1.3.md`
- **Cloud Logs Query Reference:** `docs/CLOUD_LOGS_QUICK_REFERENCE.md`
- **Firestore Rules Security Audit:** `.claude/rules/firestore-security.md`

---

## 10. Document History

| Version | Date       | Changes          | Author |
| ------- | ---------- | ---------------- | ------ |
| 1.0     | 2026-05-07 | Initial creation | CTO    |

---

**Document Owner:** CTO  
**Next Review Date:** 2026-11-07  
**Classification:** DICQ 4.4 / RDC 978 Art. 5
