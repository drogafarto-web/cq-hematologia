# Disaster Recovery Plan — HC Quality (hmatologia2)

**Document ID:** DR-001
**Version:** 1.0
**Effective Date:** 2026-05-06
**Next Review:** 2026-05-06 + 12 months
**Owner:** CTO
**Classification:** DICQ 4.2 (Gestão de documentos)

---

## Executive Summary

HC Quality operates a production SaaS system for internal quality control in clinical laboratories. This DR plan documents recovery procedures for 4 critical failure scenarios, with defined RTO (Recovery Time Objective) and RPO (Recovery Point Objective) targets.

**System criticality:** Production laboratory data (patient results, audit logs, quality control records). Compliance: RDC 978, LGPD, DICQ.

**Backup strategy:** Automated daily snapshots (GCP Cloud Firestore managed backups) + manual snapshots on-demand. Staging project maintains hot-standby copy.

---

## Scenario 1: Firestore Data Corruption

**Trigger:** Data consistency issue detected (hash verification failure, phantom docs, orphaned references).

**RTO:** 2 hours (max downtime acceptable)
**RPO:** < 1 hour (max data loss acceptable)

**Root cause examples:** Bug in Cloud Function, accidental batch write, index misconfiguration, third-party library bug.

**Recovery steps:**

1. **Detection (0-5 min):** Monitoring alerts OR manual report. Engineer investigates Firestore audit logs. Confirm corruption scope.
2. **Decision (5-15 min):** CTO + Tech Lead decide: rollback vs. patch in-place. If corruption > 1 collection, rollback is faster.
3. **Preparation (15-30 min):**
   - Stop all writes to production (disable Cloud Functions, API rate-limit to read-only).
   - Snapshot production state (for analysis post-recovery).
   - Identify clean snapshot (latest before corruption detection).
4. **Restore (30-90 min):** Import clean snapshot to staging. Validate. If good, restore to prod (see Runbook 1).
5. **Verification (90-120 min):** Smoke tests (hub loads, CIQ run can be viewed, audit trail readable), chain-hash verification (100 samples), re-enable writes.

**Communication:**

- Internal: Slack #incident + email CTO/Tech Lead/PM
- Customer: Maintenance window notice (1h estimated)
- Evidence: Timestamp + snapshot ID + validation results → archived in `docs/DR_TEST_*.md`

---

## Scenario 2: GCP Region Outage

**Trigger:** `southamerica-east1` (São Paulo) becomes unavailable (network partition, zone failure).

**RTO:** 4 hours (acceptable — multi-region failover not in v1.2 scope)
**RPO:** < 1 hour (latest backup)

**Root cause examples:** GCP zone-wide outage, network partition, DDoS mitigation in region.

**Recovery steps:**

1. **Detection (0-10 min):** Cloud monitoring alerts (function invocations fail, API latency spikes). Status page check (GCP Cloud Status Dashboard).
2. **Communication (10-15 min):** Public status update, customer notification, internal incident channel.
3. **Escalation (15-20 min):** Contact GCP support (SLA 1h for critical). Prepare secondary-region deployment plan.
4. **Wait & retry (20 min - 2h):** Most regional outages resolve in < 1h. Monitor recovery.
5. **If outage persists > 2h, execute secondary-region deploy:**
   - Restore latest Firestore backup to secondary project (e.g., `northamerica-northeast1`).
   - Redeploy functions to secondary region.
   - Update DNS / Firebase Hosting to secondary project.
   - Validation: smoke tests + chain-hash check.
   - ~2 additional hours for full deployment.
6. **Verification (2-4h):** Smoke tests on secondary region, audit trail accessible, users can log in.

**Communication:**

- Status page: "Investigating regional outage, ETA recovery [time]"
- Post-recovery: "Service restored from backup to secondary region"
- Evidence: GCP Cloud Status screenshot + deploy log + validation report

---

## Scenario 3: Compromised Credentials (Firebase Admin SDK key, GCP service account)

**Trigger:** Credential exposed in git history, leaked via third-party tool, or stolen from dev machine.

**RTO:** 1 hour (max — threat is active)
**RPO:** < 30 min (rollback to pre-compromise state)

**Root cause examples:** Accidental commit of .env file, CI/CD secret rotation failure, phishing attack on dev, npm package supply chain attack.

**Recovery steps:**

1. **Detection (0-5 min):** Audit log anomaly (unusual IP, service account writes from unexpected location), or manual discovery in git history.
2. **Incident response (5-15 min):**
   - Immediately rotate compromised credential in GCP Console (Firebase Console → Project Settings → Service Accounts).
   - Revoke old key, generate new key.
   - Identify scope: which system (functions, admin SDK, CI/CD)? Did attacker have write access?
3. **Forensics (15-30 min):** Review audit logs 24h back. Query which writes were suspicious. Determine if data was exfiltrated or modified.
4. **Remediation (30-60 min):**
   - If only read access: just rotate key, no data impact.
   - If write access: restore from clean snapshot (Scenario 1 procedure). Verify no malicious writes remain.
   - Update all systems using the credential (functions deploy, CI/CD secrets, .env in deployed instances).
5. **Verification (60 min):** Smoke tests, audit logs clean, new credential working.

**Communication:**

- Internal: Slack #security, CTO, IT Lead
- If data exfiltration suspected: Privacy officer + compliance alert
- Customer: Only if unauthorized access to their lab data occurred
- Public: No public statement unless breach obligations (LGPD) triggered

**Evidence:** Credential rotation timestamp, audit log excerpt, forensics report, new key activation.

---

## Scenario 4: Ransomware / Malicious Write Attack

**Trigger:** Cloud Function exploited (or credential compromised), attacker bulk-deletes/modifies docs, encrypts data.

**RTO:** 24 hours (severe; requires full DB rebuild vs. rollback)
**RPO:** < 1 hour (latest clean snapshot)

**Root cause examples:** Unpatched CF vulnerability, SQL injection equivalent in Firestore query (unlikely but possible), mass-assignment in service layer, insider threat.

**Recovery steps:**

1. **Detection (0-15 min):**
   - Alert: Firestore disk usage spikes or suddenly decreases (mass deletion).
   - Alert: Unusual write volume from single Cloud Function.
   - Alert: Chain-hash verification fails on 10+ documents (data tampering).
   - Manual report: "All docs are corrupted / deleted."
2. **Immediate containment (15-30 min):**
   - Isolate production: disable all Cloud Functions (deploy blank version to all functions).
   - Disable API traffic (Firebase Hosting fallback to static "system under maintenance" page).
   - Preserve evidence: snapshot the compromised DB (for analysis), note timestamp.
   - Change all service account credentials.
3. **Forensics (30-120 min):** Review audit logs, identify attack vector (which function? which credential?). Determine scope of corruption.
4. **Restore (120-240 min):**
   - Restore production from clean snapshot (pre-attack, ideally < 1h old).
   - Re-enable Cloud Functions (patched/reviewed).
   - Re-enable API.
   - Smoke tests + full chain-hash verification (all docs, not just sample).
5. **Post-incident (240+ min):**
   - Implement: rate-limiting on writes, tighter CF access controls, input validation hardening.
   - Conduct: root cause analysis + security audit.
   - Review: backup rotation policy (ensure oldest backup also not compromised).

**Communication:**

- **Internal (immediately):** Incident channel, CTO, Tech Lead, Security Officer, PM
- **Legal/Compliance (immediately):** Data breach? LGPD Art. 34 requires notification within 48h if patient data exposed.
- **Customer:**
  - Immediate: "Service offline, investigating incident, ETA restoration [time]"
  - Post-restore: "Service restored from backup. No unauthorized data access detected. Full incident report: [url]"
- **Public:** Statement on status page (transparency). Avoid admitting breach unless confirmed.

**Evidence:** Compromised snapshot timestamp, clean snapshot import timestamp, validation results, audit log analysis, security review, remediation steps.

---

## Dependency Diagram

```
Scenario 1 (corruption): Firestore audit logs → gcloud export → staging restore → validation
Scenario 2 (outage):     GCP Status + monitoring → secondary deploy → DNS failover → validation
Scenario 3 (credentials): Audit logs → credential rotation → key update → validation
Scenario 4 (ransomware):  Alert system → isolation → forensics → snapshot restore → hardening
```

---

## Roles & Escalation

| Role                 | Responsibility                                            | Availability              |
| -------------------- | --------------------------------------------------------- | ------------------------- |
| **CTO**              | Declare incident, approve recovery plan, customer comms   | On-call 24/7 (pager)      |
| **Tech Lead**        | Execute recovery steps, coordinate team, validation       | Business hours + on-call  |
| **Security Officer** | Forensics, breach determination, LGPD notification        | On-call for Scenarios 3-4 |
| **PM**               | Customer comms, status page updates, post-incident review | Business hours            |
| **DevOps**           | gcloud CLI commands, deployment, infrastructure changes   | On-call 24/7              |

**On-call rotation:** CTO is primary on-call. Tech Lead is secondary. Escalation: CTO calls Sec Officer + PM if incident severity is high (customer data impact).

---

## Key Contact Info

- **CTO:** [phone], [email]
- **Tech Lead:** [phone], [email]
- **Security Officer:** [email]
- **GCP Support:** [SLA link], [support case URL if open]
- **Customer Success:** [email], [Slack]

---

## Testing & Validation

**Annual DR test required:** This plan must be tested at least once per year (RDC 978 5.6).

**Test checklist:**

- [ ] Snapshot production successfully
- [ ] Restore to staging successfully
- [ ] Validate chain-hash on 100+ samples
- [ ] Smoke tests pass (hub, CIQ, audit, reports)
- [ ] Documentation updated
- [ ] Team debriefs (what went well, what needs improvement)
- [ ] Evidence archived

**Last test:** 2026-05-06 (executed in Phase 6 Plan 02)
**Next test scheduled:** 2027-05-06

---

## Approval & Sign-off

| Name                    | Role     | Date       | Signature |
| ----------------------- | -------- | ---------- | --------- |
| [CTO]                   | Owner    | 2026-05-06 | **\_**    |
| [Tech Lead]             | Executor | 2026-05-06 | **\_**    |
| [Responsible Tech — RT] | Approver | 2026-05-06 | **\_**    |

---

**Document history:**

- v1.0 (2026-05-06): Initial version, 4 scenarios documented, annual test scheduled.
