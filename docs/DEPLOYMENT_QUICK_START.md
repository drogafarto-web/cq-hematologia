# v1.3 Deployment — Quick Start

**Copy this to your screen before deploying.**

---

## The 3-Terminal Setup

```bash
# Terminal 1: Type-check
npm run tsc --noEmit

# Terminal 2: Deploy (wait for complete)
npm run build && firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2

# Terminal 3: Monitor (while Terminal 2 runs + 24h after)
bash scripts/monitor-cloud-logs.sh 24 30
# or
.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30
```

---

## Timeline

| Step                   | Terminal | Time         | Status                                         |
| ---------------------- | -------- | ------------ | ---------------------------------------------- |
| 1. Type-check          | 1        | 5 min        | `npm run tsc --noEmit`                         |
| 2. Functions           | 2        | 5 min        | `firebase deploy --only functions`             |
| **→ Start monitoring** | **3**    | **parallel** | **`bash scripts/monitor-cloud-logs.sh 24 30`** |
| 3. Hosting             | 2        | 2 min        | `firebase deploy --only hosting`               |
| 4. Verify              | 1        | 5 min        | Watch Terminals 2 + 3 for errors               |
| 5. Monitor             | 3        | 24h          | Running in background                          |
| 6. Sign-off            | 1        | 15 min       | Review report + commit to git                  |

**Active time:** ~17 min (deploy) + 15 min (sign-off) = 32 min  
**Clock time:** 24h+ (monitoring in background)

---

## What Happens (Mental Model)

```
Terminal 1                Terminal 2 (Main Deploy)    Terminal 3 (Monitoring)
———————————————————————————————————————————————————————————————————————————————
tsc --noEmit
npm run build
                          deploy functions     START HERE ───→ poll Cloud Logs
                          ✓ Done (5 min)           every 30 min

                          deploy hosting
                          ✓ Done (2 min)           monitoring continues...
                                                    (24h total)

[after 24h or on-demand]  ← Continue normally       Report auto-generated
Create sign-off report    ← Document findings       JSON export created
Commit to git             ← Archive
Mark deployment complete
```

---

## Monitoring Script Output

After 24 hours (or when you stop it):

**File 1: Auto-generated report**

```bash
cat docs/MONITORING_REPORT_*.md
```

Shows:

- Total errors found
- Function/Firestore/Hosting breakdown
- Recommendation: ✅ APPROVE or ⚠️ ESCALATE

**File 2: Error export**

```bash
cat scripts/cloud-logs-export-*.json | jq . | head -30
```

Shows:

- Every error logged during monitoring
- Timestamp, severity, details

---

## Red Flags (Escalate Immediately)

If you see ANY of these:

1. **`"Exceeded timeout"`** → Async handler broken
2. **`"Permission denied"` on `/labs/{labId}/*`** → Rules regression
3. **HTTP 502/503 sustained >5 min** → Hosting/runtime failure
4. **`"undefined is not a function"`** → Missing dependency
5. **`"Document too large"`** → Data model overflow

**Action:** Screenshot + timestamp + message CTO (@drogafarto)

---

## Post-Monitoring (After 24h)

```bash
# View auto-generated report
cat docs/MONITORING_REPORT_*.md

# If all clear (0 errors):
git add docs/MONITORING_REPORT_* docs/SIGN_OFF_CLOUD_LOGS_*
git commit -m "docs: v1.3 cloud logs monitoring — 24h verification complete, 0 errors"

# If errors found:
# 1. Check red flags table above
# 2. If critical, escalate
# 3. If minor, document in sign-off
# 4. Commit both
```

---

## Essential Links

- **Full guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md` (read once)
- **Quick ref:** `docs/CLOUD_LOGS_QUICK_REFERENCE.md` (bookmark)
- **Workflow:** `.planning/DEPLOYMENT_MONITORING_WORKFLOW.md`
- **Checklist:** `docs/CLOUD_LOGS_INTEGRATION_CHECKLIST.md`

---

## One-Minute Commands

```bash
# Deploy in one shot (if you know it's clean)
npm run tsc --noEmit && npm run build && firebase deploy --only functions --project hmatologia2 && firebase deploy --only hosting --project hmatologia2

# Start monitoring (in another terminal)
bash scripts/monitor-cloud-logs.sh 24 30

# Quick error check (if can't run full script)
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20

# View report after 24h
cat docs/MONITORING_REPORT_*.md

# Sign-off and commit
git add docs/MONITORING_REPORT_* && git commit -m "docs: v1.3 monitoring complete"
```

---

## Troubleshooting

**"gcloud not found"**

```bash
gcloud config set project hmatologia2
# If error, install Google Cloud SDK
```

**"Script hangs"**

- Ctrl+C to stop
- Check: `gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=5`
- Re-run script if needed

**"Monitoring disappeared"**

- It's in background. Check file outputs: `ls -la docs/MONITORING_REPORT_*.md`
- Reports auto-generate after 24h

---

## Success Criteria

**Deployment is successful when:**

- [ ] Step 1: `tsc --noEmit` returns no errors
- [ ] Step 2: Functions deploy shows ✓ complete
- [ ] Step 3: Hosting deploy shows ✓ complete
- [ ] Terminal 3: Monitoring script is running (or manually monitoring)
- [ ] After 24h: `docs/MONITORING_REPORT_*.md` shows "Total Errors: 0"
- [ ] Signed off: `docs/SIGN_OFF_CLOUD_LOGS_*.md` created and committed

---

**v1.3 is now live.**

---

**Last Updated:** 2026-05-06 | **Version:** 1.3
