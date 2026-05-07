# Backup & Disaster Recovery — Operational Checklist

**Document ID:** BDR-OPS-001  
**Version:** 1.0  
**Effective Date:** 2026-05-07  
**Classification:** DICQ 4.2 (Operational Procedures)

---

## Daily Checklist (5 min, 00:15 UTC)

Run **after** scheduled daily backup completes (00:00 UTC).

```bash
# Check daily backup status
bash scripts/backup-status.sh hmatologia2

# OR (Windows)
powershell -ExecutionPolicy Bypass -File scripts/backup-status.ps1 -Project "hmatologia2"
```

- [ ] Daily backup completed without errors
- [ ] GCS bucket `gs://hc-quality-backups/daily/` has latest snapshot
- [ ] No alerts in Cloud Monitoring dashboard
- [ ] Firestore size within expected bounds (no anomalies)

**If any check fails:** Escalate to DevOps immediately.

---

## Weekly Checklist (30 min, Sundays 02:30 UTC)

Run **after** weekly backup completes.

```bash
# Full status report
bash scripts/backup-status.sh hmatologia2

# List all recovery points
gcloud firestore backups list --project=hmatologia2 \
  --format="table(name.basename(),create_time.date('%Y-%m-%d'),state)"

# Verify GCS retention locks
gsutil retention get gs://hc-quality-backups/
gsutil retention get gs://hc-quality-archives/
```

- [ ] Weekly backup completed
- [ ] GCS buckets have retention locks (immutable for 7 years)
- [ ] Document count stable (no unexpected deletions)
- [ ] No failed Cloud Function invocations

**If GCS locks missing:** Reapply immediately:
```bash
gsutil retention set 2557d gs://hc-quality-backups/
gsutil retention set 2557d gs://hc-quality-archives/
```

---

## Monthly Checklist (2 hours, 1st Friday 10:00 UTC)

Run **monthly restore test** to validate all backups are recoverable.

```bash
# Automated test (generates report)
bash scripts/backup-test.sh

# View test results
cat docs/DR_RESTORE_TEST_$(date +%Y-%m-%d).md
```

**Test must verify:**

- [ ] Backup selected from 2 weeks ago
- [ ] Restore to staging completed (< 2 hours)
- [ ] Document count matches production (within 1%)
- [ ] Chain-hash verification passed (> 95% valid)
- [ ] Smoke tests passed (hub, CIQ, audit accessible)
- [ ] Test report generated (`docs/DR_RESTORE_TEST_YYYY-MM-DD.md`)

**If test fails:** Investigate root cause + document in incident log.

---

## Quarterly Checklist (4 hours, Q1/Q2/Q3/Q4)

**Full Disaster Recovery Drill** — simulate complete failure scenario.

**Scope:** Corruption detection → Isolation → Forensics → Restore → Validation

### Phase 1: Setup (30 min)

- [ ] Declare test incident in Slack #incident
- [ ] Notify team (CTO, Tech Lead, DevOps)
- [ ] Record start time (for RTO measurement)
- [ ] Clear staging project for restore

### Phase 2: Corruption Simulation (30 min)

- [ ] Identify a "corrupted" backup (2-3 weeks old)
- [ ] Document as evidence
- [ ] Note "detection" time

```bash
# Simulate detecting corruption
gcloud firestore query laudos --project=hmatologia2 --limit=10 --format=json
# (Note: in real scenario, chain-hash verification would trigger alert)
```

### Phase 3: Isolation (10 min)

- [ ] Stop Cloud Functions (disable deployment)
- [ ] Record isolation timestamp

```bash
# Verify functions are disabled
gcloud functions list --project=hmatologia2
```

### Phase 4: Restore to Staging (90 min)

```bash
# Execute restore
bash scripts/restore-pitr.sh "2026-05-06T10:00:00Z" staging

# Monitor progress
gcloud firestore operations list \
  --project=hmatologia2-staging \
  --filter="operationType:IMPORT" \
  --format="table(name,done,progressPercent)"
```

- [ ] Restore initiated
- [ ] Restore progressing (monitor every 15 min)
- [ ] Restore completed

### Phase 5: Validation in Staging (30 min)

```bash
# Verify documents
gcloud firestore stat --project=hmatologia2-staging

# Check chain-hash
bash scripts/verify-chain-hash.sh hmatologia2-staging 100

# Run smoke tests (manual)
curl https://hmatologia2-staging.web.app/api/health
```

- [ ] Document count matches production
- [ ] Chain-hash valid (> 95%)
- [ ] Hub endpoint accessible
- [ ] Firestore queries working

### Phase 6: Restore to Production (90 min)

```bash
# Restore production (AFTER staging validation passes)
bash scripts/restore-pitr.sh "2026-05-06T10:00:00Z" prod
```

- [ ] Production restore initiated
- [ ] Monitoring progress
- [ ] Production restore completed

### Phase 7: Re-enable Production (10 min)

```bash
# Verify production is online
gcloud firestore stat --project=hmatologia2

# Run smoke tests
curl https://hmatologia2.web.app/api/health
```

- [ ] Firestore accessible
- [ ] Hub loads
- [ ] API responding
- [ ] Record recovery completion time (RTO)

### Phase 8: Post-Drill Debrief (30 min)

- [ ] Document findings in `docs/DR_DRILL_YYYY-Q#.md`
- [ ] Note any issues encountered
- [ ] Update runbooks if needed
- [ ] Calculate RTO (actual vs target)
- [ ] Identify improvements

**Debrief template:**

```markdown
# Q2 2026 Disaster Recovery Drill

**Date:** 2026-05-10  
**Scenario:** Firestore data corruption  
**Team:** CTO, Tech Lead, DevOps

## Timeline
- Detection: 10:00 UTC
- Isolation: 10:10 UTC (RTO: 10 min)
- Staging restore: 10:15 - 11:45 UTC (90 min)
- Validation: 11:45 - 12:15 UTC (30 min)
- Production restore: 12:15 - 13:45 UTC (90 min)
- Re-enable: 13:45 - 13:55 UTC
- **Total RTO: 3h 55m** (target: 2-4h) ✓

## Issues Encountered
- [ ] None
- [ ] [Issue 1]: [Resolution]

## Improvements Identified
- [ ] [Improvement 1]
- [ ] [Improvement 2]

## Sign-off
- CTO: _____ 
- Tech Lead: _____
```

---

## Annual Checklist (1 day, May 2026 + annually)

**Comprehensive Compliance Audit** — RDC 978 Art. 115 + DICQ 4.2

```bash
# Generate comprehensive status report
bash scripts/backup-status.sh hmatologia2 > /tmp/annual-audit-$(date +%Y-%m-%d).txt

# Review all backup tiers
gsutil ls -L gs://hc-quality-backups/
gsutil ls -L gs://hc-quality-archives/

# Verify retention policies
gcloud firestore backups list --project=hmatologia2 --limit=20 \
  --format="table(name,create_time,retention_time)"
```

**Compliance verification:**

- [ ] **RDC 978 Art. 115:** Backup policy documented + implemented
  - [ ] Documented retention periods (5y laudos, 10y NOTIVISA, etc.)
  - [ ] Soft-delete grace periods enforced
  - [ ] Archive strategy in place

- [ ] **DICQ 4.2:** Backup procedures + testing
  - [ ] Daily full backups operational
  - [ ] Weekly incremental backups operational
  - [ ] Monthly cold storage archival operational
  - [ ] Monthly restore tests completed (12 tests)
  - [ ] Quarterly DR drills completed (4 drills)

- [ ] **DICQ 4.2.3:** Testing & validation
  - [ ] Monthly restore test procedure documented
  - [ ] Quarterly DR drill procedure documented
  - [ ] Test reports archived (monthly + quarterly)
  - [ ] Chain-hash verification passing

- [ ] **LGPD Art. 12:** Data subject rights
  - [ ] Export-on-demand capability verified
  - [ ] Soft-delete + archive audit trail maintained
  - [ ] Retention policy compliant with legal hold periods

- [ ] **ISO 15189:** Clinical laboratory data
  - [ ] 5-year retention enforced for patient results
  - [ ] Immutable audit trail maintained
  - [ ] Quality control records preserved

- [ ] **Infrastructure:**
  - [ ] GCS retention locks active (7-year immutable)
  - [ ] Versioning enabled on backup buckets
  - [ ] Lifecycle rules configured (Standard → Nearline → Coldline)
  - [ ] Cloud Monitoring dashboard operational
  - [ ] Alerts configured + monitored

- [ ] **Documentation:**
  - [ ] Backup procedures current (this document)
  - [ ] Disaster recovery plan current (`docs/DR_PLAN.md`)
  - [ ] Runbooks current + tested (`docs/DR_RUNBOOKS.md`)
  - [ ] Scripts current + executable
  - [ ] Contact information up-to-date

- [ ] **Team:**
  - [ ] CTO trained on incident response
  - [ ] Tech Lead trained on recovery procedures
  - [ ] DevOps trained on GCS operations
  - [ ] At least 1 team member completed all drills

**Audit sign-off:**

| Role | Name | Date | Compliance Status |
|---|---|---|---|
| CTO | — | 2026-05-07 | ☐ Approved |
| Tech Lead | — | 2026-05-07 | ☐ Approved |
| Security Officer | — | 2026-05-07 | ☐ Approved |

---

## Incident Response Checklist

**Use when backup/recovery issue detected.**

### Immediate Actions (0-15 min)

- [ ] Declare incident in Slack #incident
- [ ] Notify CTO + Tech Lead
- [ ] Gather information:
  - [ ] What went wrong? (backup failed, restore failed, data anomaly?)
  - [ ] When did it happen?
  - [ ] Which backup/project affected?
- [ ] Check `gcloud firestore operations list` for errors

### Diagnosis (15-45 min)

- [ ] Review Cloud Logs:
  ```bash
  gcloud logging read "resource.type=cloud_firestore_database" \
    --limit=100 --format=json --project=hmatologia2
  ```

- [ ] Check backup bucket integrity:
  ```bash
  gsutil ls gs://hc-quality-backups/
  gsutil du gs://hc-quality-backups/
  ```

- [ ] Verify GCS retention locks:
  ```bash
  gsutil retention get gs://hc-quality-backups/
  ```

- [ ] Check Firestore size anomalies:
  ```bash
  gcloud firestore stat --project=hmatologia2
  ```

### Escalation

| Issue | Action | Owner |
|---|---|---|
| Backup function error | Check CF logs + redeploy | DevOps |
| GCS bucket error | Verify bucket existence + permissions | DevOps |
| Restore timeout | Check Firestore size + increase timeout | Tech Lead |
| Chain-hash anomaly | Trigger corruption recovery | CTO |
| Ransomware suspected | Isolate + forensics (Runbook 4) | CTO + Security |

---

## Maintenance Windows

### Monthly (1st Friday 02:00 - 04:00 UTC)

- Monthly backup creation (automatic)
- Backup test execution
- Retention log cleanup

**No customer impact expected.** Backups are read-only; production unaffected.

### Quarterly (1st day of Q+1 month, 10:00 - 14:00 UTC)

- DR drill execution
- Runbook testing
- Team debrief

**Customer notification:** Non-critical testing; no production impact. Optional notification on status page.

### Annual (May, 3rd Friday 09:00 - 17:00 UTC)

- Comprehensive compliance audit
- Full policy review
- Team training update

**Customer notification:** Recommended. Transparency improves trust.

---

## Escalation Matrix

| Issue | Severity | Owner | Response Time |
|---|---|---|---|
| Backup failed | High | DevOps → Tech Lead | 1 hour |
| Restore timeout | High | Tech Lead | 2 hours |
| Corruption detected | Critical | CTO → Security | 30 min |
| Chain-hash anomaly | Critical | CTO → Forensics | 15 min |
| GCS bucket access denied | High | DevOps → GCP Support | 1 hour |
| Ransomware suspected | Critical | CTO → Incident Commander | 5 min |

**On-call rotation:** CTO primary, Tech Lead secondary, DevOps tertiary.

---

## Key Contact Information

| Role | Name | Phone | Email | Slack |
|---|---|---|---|---|
| **CTO** | — | — | — | @cto |
| **Tech Lead** | — | — | — | @tech-lead |
| **DevOps** | — | — | — | @devops |
| **Security Officer** | — | — | — | @security |
| **GCP Support** | — | [SLA link] | — | — |

---

## Document History

- **v1.0** (2026-05-07): Initial operational checklist. Daily/weekly/monthly/quarterly/annual procedures. Incident response playbook.

---

**Owner:** DevOps · Tech Lead  
**Last Updated:** 2026-05-07  
**Next Review:** 2027-05-07
