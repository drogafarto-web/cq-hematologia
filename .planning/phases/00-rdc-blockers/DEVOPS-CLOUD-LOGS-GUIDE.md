# DevOps Manual: 24h Cloud Logs Monitoring (Phase 0 Post-Deploy)

## Task

Run Cloud Logs monitoring for 24 hours post-deploy on all 4 Phase 0 plans and generate reports.

---

## Prerequisites

- Firebase project: `hmatologia2`
- gcloud CLI installed + authenticated (`gcloud auth list`)
- bash (Linux/macOS) or PowerShell (Windows)
- Deployed functions from Phase 0: `turnos`, `labApoio`, `risks`, `lgpd`

---

## Step-by-step

### 1. Run Cloud Logs Monitor (Background)

Run in separate terminals, one per plan. Each monitor runs for 24 hours continuously.

#### Plan 00-01 (turnos)

**macOS/Linux:**

```bash
# Terminal 1
bash scripts/monitor-cloud-logs.sh 24 30 > .planning/phases/00-rdc-blockers/00-01-cloud-logs-day1.md
```

**Windows PowerShell:**

```powershell
# Terminal 1
& '.\scripts\monitor-cloud-logs.ps1' -Duration 24 -Interval 30 | Tee-Object -FilePath '.planning/phases/00-rdc-blockers/00-01-cloud-logs-day1.md'
```

#### Plan 00-02 (LGPD)

**macOS/Linux:**

```bash
# Terminal 2
bash scripts/monitor-cloud-logs.sh 24 30 > .planning/phases/00-rdc-blockers/00-02-cloud-logs-day1.md
```

**Windows PowerShell:**

```powershell
# Terminal 2
& '.\scripts\monitor-cloud-logs.ps1' -Duration 24 -Interval 30 | Tee-Object -FilePath '.planning/phases/00-rdc-blockers/00-02-cloud-logs-day1.md'
```

#### Plan 00-03 (lab-apoio)

**macOS/Linux:**

```bash
# Terminal 3
bash scripts/monitor-cloud-logs.sh 24 30 > .planning/phases/00-rdc-blockers/00-03-cloud-logs-day1.md
```

**Windows PowerShell:**

```powershell
# Terminal 3
& '.\scripts\monitor-cloud-logs.ps1' -Duration 24 -Interval 30 | Tee-Object -FilePath '.planning/phases/00-rdc-blockers/00-03-cloud-logs-day1.md'
```

#### Plan 00-04 (risks)

**macOS/Linux:**

```bash
# Terminal 4
bash scripts/monitor-cloud-logs.sh 24 30 > .planning/phases/00-rdc-blockers/00-04-cloud-logs-day1.md
```

**Windows PowerShell:**

```powershell
# Terminal 4
& '.\scripts\monitor-cloud-logs.ps1' -Duration 24 -Interval 30 | Tee-Object -FilePath '.planning/phases/00-rdc-blockers/00-04-cloud-logs-day1.md'
```

**Note:** Scripts run in background. Monitor progress with tail or Get-Content:

```bash
tail -f .planning/phases/00-rdc-blockers/00-01-cloud-logs-day1.md
```

---

### 2. Monitor Key Metrics

Watch for these signals in real-time (check outputs every 2–4 hours):

**Green lights (✅):**

- No errors in function execution (0 errors from `turnos_*`, `labApoio_*`, `risks_*`, `lgpd_scheduledAnnualReview`)
- No Firestore permission errors (rules enforced correctly)
- No Storage errors (PDF uploads in lab-apoio succeed)
- Scheduler runs successfully (lgpd + lab-apoio + risks cron jobs execute daily 06:00–07:00 BRT)
- Latencies <500ms for callables, <2s for cron jobs

**Yellow flags (⚠️):**

- High latencies (>1s) — may indicate cold starts or resource constraints
- Occasional timeouts — document frequency
- Permission warnings — check DL-1 rules implementation

**Red flags (❌):**

- Persistent errors across multiple invocations
- Firestore quota errors (`RESOURCE_EXHAUSTED`)
- Storage permission denials
- Scheduler failures

---

### 3. Review Generated Reports

Each script produces an `.md` file with automated analysis:

- **Summary:** error count, warning count, execution totals
- **Timeline:** event breakdown by hour
- **Recommendations:** anomalies and tuning suggestions

**Expected output (sample):**

```markdown
# Cloud Logs Report — Phase 0 Plan 00-01 (turnos)

Duration: 24h (2026-05-07 14:00 UTC → 2026-05-08 14:00 UTC)

Functions:

- turnos_createTurno
- turnos_updateTurno
- turnos_softDeleteTurno
- turnos_backfill90Days
- onTurnoEventCreated

## Execution Summary

- Successful calls: 47
- Failed calls: 0
- Errors: 0
- Warnings: 0
- Average latency: 127ms
- Max latency: 1,240ms

## Timeline

| Hour            | Calls | Avg Latency | Errors | Status |
| --------------- | ----- | ----------- | ------ | ------ |
| 14:00–15:00 UTC | 8     | 95ms        | 0      | ✅     |
| 15:00–16:00 UTC | 7     | 142ms       | 0      | ✅     |
| ...             | ...   | ...         | ...    | ...    |

## Recommendation

No anomalies detected. Production ready. ✅
```

---

### 4. Post-Monitoring Actions

Once all 4 reports complete (24h monitoring + ~1h for processing = ~25h elapsed):

1. **Review all 4 reports** in `.planning/phases/00-rdc-blockers/`:
   - `00-01-cloud-logs-day1.md`
   - `00-02-cloud-logs-day1.md`
   - `00-03-cloud-logs-day1.md`
   - `00-04-cloud-logs-day1.md`

2. **Verify all plans are green:**
   - 0 critical errors across all functions
   - All cron jobs executed successfully
   - No quota or permission issues

3. **Archive reports** (already saved automatically)

4. **Update Phase 0 Closure** in `.planning/STATE.md`:

   ```markdown
   ## Phase 0: COMPLETE ✅

   - Cloud Logs: 4/4 plans monitored 24h, all green
   - Functions: All 4 deployments stable
   - Estimated DICQ delta: +4–5 points (78.5% → 82–83%)
   - RDC 978 status: Audit trail (5.3) + Scheduler/Cron (5.2) ✅
   ```

5. **Notify CTO:**
   - Phase 0 production-ready for hand-off
   - Phase 1 unblock gate reached
   - Next: Monitor live usage over 48–72 hours before Phase 1 kick-off

---

## Troubleshooting

### Script fails to run

**Check gcloud authentication:**

```bash
gcloud auth list
gcloud config get-value project  # Should be: hmatologia2
```

**Verify script path:**

```bash
ls -la scripts/monitor-cloud-logs.sh   # macOS/Linux
ls -Recurse scripts\monitor-cloud-logs.ps1  # Windows
```

### No logs appearing

**Check function names in filter:**

- Deployed functions should include: `turnos_*`, `labApoio_*`, `risks_*`, `lgpd_*`

**Verify functions deployed successfully:**

```bash
firebase deploy --list --project hmatologia2
# Check for all 4 plan functions in the list
```

**Check region:**

- All Phase 0 functions deployed to `southamerica-east1`
- Filter in monitoring script must match

### High error rates

**Check Firestore rules:**

- Verify DL-1 enforcement rules compiled correctly
- Test rule with `firebase emulators:start` locally

**Check function environment variables:**

- API keys, Firebase service account, Gemini key (for lab-apoio PDFs)
- Review in Firebase Console → Functions → Environment

**Check Storage permissions:**

- PDF upload paths must match Security Rules (lab-apoio module)
- Verify service account has `storage.buckets.get` + `storage.objects.create`

**Check scheduler configuration:**

- Verify cron strings are valid: `gcloud scheduler jobs list --location=southamerica-east1`
- Expected: 4 jobs (lgpd, lab-apoio, risks, and one backup)

### Disk space or log file size

**If .md files grow large (>100 MB):**

```bash
# Compress completed report
gzip .planning/phases/00-rdc-blockers/00-01-cloud-logs-day1.md
```

---

## Estimated Time

- **Setup (all 4 terminals):** 1–2 minutes
- **Monitoring:** 24 hours (continuous, background)
- **Report review + archival:** 15–30 minutes
- **Total wall time:** ~24–25 hours

---

## Sign-off Template

Copy this into `.planning/STATE.md` after all 4 reports are green:

```markdown
### Phase 0 Cloud Logs Monitoring — COMPLETE

**Date:** 2026-05-[XX] (24h window)

**Reports:**

- ✅ 00-01 (turnos): 0 errors, 47 calls, avg 127ms
- ✅ 00-02 (LGPD): [summary here]
- ✅ 00-03 (lab-apoio): [summary here]
- ✅ 00-04 (risks): [summary here]

**Overall Status:** Production Ready

**DICQ Impact:** +4–5 points (78.5% → 82–83%)
**RDC 978 Status:** Audit trail + Scheduler compliance ✅

**Next Gate:** Phase 1 (live usage monitoring 48–72h, then kick-off)
```

---

## Reference

- **Monitoring script source:** `scripts/monitor-cloud-logs.sh` (bash) and `scripts/monitor-cloud-logs.ps1` (PowerShell)
- **Quick reference:** `docs/CLOUD_LOGS_QUICK_REFERENCE.md`
- **Integration checklist:** `docs/CLOUD_LOGS_INTEGRATION_CHECKLIST.md`
- **Full monitoring guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
