# Cloud Logs Monitoring — Setup Summary

**Date Created:** 2026-05-06  
**Status:** Ready for deployment  
**Applies to:** v1.3 post-deployment verification (24-hour window after Step 2: Functions deploy)

---

## What Was Created

Four documents + two scripts for monitoring Cloud Logs after deployment:

| File | Type | Lines | Purpose |
|------|------|-------|---------|
| `CLOUD_LOGS_MONITORING_GUIDE.md` | MD Guide | 450+ | Full reference: setup, filters, issues, methods, escalation |
| `CLOUD_LOGS_QUICK_REFERENCE.md` | Quick Ref | 150+ | TL;DR: commands, red flags, cheat sheet |
| `CLOUD_LOGS_INTEGRATION_CHECKLIST.md` | Checklist | 400+ | Deploy workflow integration: pre/during/post tasks |
| `scripts/monitor-cloud-logs.sh` | Bash Script | 250+ | Automated 24h monitoring (macOS/Linux) |
| `scripts/monitor-cloud-logs.ps1` | PowerShell Script | 280+ | Automated 24h monitoring (Windows) |
| This file | Summary | — | You are here |

---

## How It Works

### Three Monitoring Options

**Option A: Automated (Recommended)**
```bash
bash scripts/monitor-cloud-logs.sh 24 30
# or
.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30
```
✅ Runs unattended for 24h  
✅ Auto-generates report + JSON export  
✅ No manual intervention needed  

**Option B: Cloud Console (Visual)**
1. Open [Cloud Logs Explorer](https://console.cloud.google.com/logs/query)
2. Paste filter: `severity >= ERROR`
3. Set time range: Last 24h
4. Refresh every 15–30 min manually

✅ Visual context  
❌ Requires manual refresh  

**Option C: CLI Spot-Checks**
```bash
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20
```
Run every 2 hours (12 checks total).

✅ Quick  
❌ Non-continuous  

---

## Key Filters (Copy + Paste)

**All Errors (Last 1h):**
```
severity >= ERROR AND timestamp > now - 60m
```

**Functions Only:**
```
resource.type="cloud_function" AND severity >= ERROR
```

**Firestore Permissions:**
```
resource.type="cloud_firestore" AND textPayload=~".*Permission.*"
```

**Hosting 5xx:**
```
resource.type="cloud_run" AND httpRequest.status >= 500
```

---

## Red Flags (Escalate Immediately)

| Error | Action |
|-------|--------|
| `"Exceeded timeout of X seconds"` | Check async handlers; may need to increase timeout |
| `"Permission denied"` on `/labs/{labId}/*` writes | Rules regression; compare to git HEAD; rollback or fix |
| HTTP 502/503 sustained >5 min | Hosting failure; consider rollback |
| `"undefined is not a function"` | Missing dependency; check `functions/package.json` |
| `"Document too large"` on laudo/declaracao | Data model exceeds 1 MB; refactor to subcollection |

**Any red flag:** Screenshot + timestamp + notify CTO (@drogafarto).

---

## Deployment Workflow Integration

### Before Deploy (Step 1: Type-check)
- [ ] Read `CLOUD_LOGS_QUICK_REFERENCE.md` (2 min)
- [ ] Verify `gcloud config get-value project` is `hmatologia2`

### During Deploy (Step 2: Functions)
- [ ] Run: `npm run build && firebase deploy --only functions ...`
- [ ] **In parallel, Terminal 2:** Start monitoring (auto script or passive)

### After Deploy (Step 3: Hosting)
- [ ] Hosting deploy completes
- [ ] Review auto-generated report (if script) or manually check Cloud Console
- [ ] Fill `docs/SIGN_OFF_CLOUD_LOGS_<date>.md` (template in guide)
- [ ] Commit reports to git

### Total Time
- **Deploy:** ~15 min (Steps 1–3)
- **Monitoring:** 24h (runs in parallel, non-blocking)
- **Sign-off:** 15 min (after 24h or on-demand)

---

## Script Output

### Automated Script Generates

**File 1:** `docs/MONITORING_REPORT_<timestamp>.md`
```
## Summary
| Metric | Count |
| Total Checks | 48 (one per 30 min) |
| Total Errors | 0 |
| Function Errors | 0 |
| Firestore Errors | 0 |
| Hosting 5xx Errors | 0 |

## Status
✅ ALL CLEAR — No errors detected
```

**File 2:** `scripts/cloud-logs-export-<timestamp>.json`
```json
[
  {
    "timestamp": "2026-05-07T14:32:15Z",
    "severity": "ERROR",
    "textPayload": "Function execution timed out"
  },
  // ... (one entry per error found)
]
```

**Console Output:**
```
[2026-05-07 14:00:00] Check #1 (24h 0m remaining)
  [Functions] ✅ No function errors
  [Firestore] ✅ No Firestore errors
  [Hosting] ✅ No hosting 5xx errors
  
Aggregated: +0 errors (total so far: 0)
Waiting 30m until next check...
```

---

## Common Questions

**Q: Can I stop monitoring early?**  
A: Yes. Ctrl+C anytime. Report will cover partial window. Create manual sign-off.

**Q: What if errors appear?**  
A: Check red flags table above. If 🔴 BLOCK: escalate immediately. If ⚠️ OK: continue monitoring, document in sign-off.

**Q: Do I have to use the script?**  
A: No. Cloud Console or gcloud CLI work fine. Script is just automation.

**Q: What's the expected error rate?**  
A: <5 errors per 10,000 invocations. 0 is ideal. >10 in 24h is concerning.

**Q: Can I monitor multiple regions?**  
A: Current config is `southamerica-east1` only. To monitor multiple regions, modify script filter to `AND resource.labels.region=~".*"`.

**Q: Where do I report issues?**  
A: Email CTO (@drogafarto) with timestamp + log snippet + decision (APPROVE/ESCALATE/BLOCK).

---

## Integration with Deploy Protocol

This monitoring system is part of the v1.3 **deploy-protocol.md** workflow:

```
Step 1: Type-check (5 min)
  └─ npm run tsc --noEmit

Step 2: Functions deploy (5 min) [+ MONITORING STARTS PARALLEL]
  └─ firebase deploy --only functions --project hmatologia2
  
Step 3: Hosting deploy (2 min) [+ MONITORING CONTINUES]
  └─ firebase deploy --only hosting --project hmatologia2

Step 4: Post-deploy verification (24h)
  └─ [This] Cloud Logs monitoring (runs in background)
     - Auto-generates report (optional)
     - Manual sign-off required (required)
     - Commit reports to git (required)
```

**Non-blocking:** Monitoring does not halt deploy. Deploy succeeds or fails independently. Monitoring is surveillance.

---

## File Locations (Quick Reference)

```
C:\hc quality\
├── docs/
│   ├── CLOUD_LOGS_MONITORING_GUIDE.md          [Full reference]
│   ├── CLOUD_LOGS_QUICK_REFERENCE.md           [TL;DR + commands]
│   ├── CLOUD_LOGS_INTEGRATION_CHECKLIST.md     [Workflow + scenarios]
│   ├── MONITORING_REPORT_*.md                  [Auto-generated by script]
│   ├── SIGN_OFF_CLOUD_LOGS_*.md                [Manual sign-off template]
│   └── cloud-logs-export-*.json                [All errors exported]
│
└── scripts/
    ├── monitor-cloud-logs.sh                   [Bash script (macOS/Linux)]
    └── monitor-cloud-logs.ps1                  [PowerShell script (Windows)]
```

---

## Checklist Before Using

- [ ] `gcloud config set project hmatologia2` ✓
- [ ] `gcloud auth login` (if not already authenticated) ✓
- [ ] Read `docs/CLOUD_LOGS_QUICK_REFERENCE.md` ✓
- [ ] Decide: Automated script, Cloud Console, or CLI spot-checks?
- [ ] If script: choose Bash (.sh) or PowerShell (.ps1)
- [ ] If manual: have a notepad ready for timestamps + observations

---

## What's NOT Included (Out of Scope)

❌ Real-time alerting (SNS/PagerDuty integration)  
❌ Automated rollback on errors (manual escalation only)  
❌ Long-term metrics dashboard (Looker/DataStudio setup separate)  
❌ Custom anomaly detection (error spikes vs baselines)  

These can be added post-v1.3 as needed.

---

## Next Deployment: Quick Start

**Copy this to your notes for next deploy:**

```bash
# Terminal 1: Deploy
npm run build && firebase deploy --only functions --project hmatologia2

# Terminal 2 (while deploy runs): Start monitoring
bash scripts/monitor-cloud-logs.sh 24 30

# After 24h: Review report + commit
cat docs/MONITORING_REPORT_*.md
git add docs/MONITORING_REPORT_* docs/SIGN_OFF_CLOUD_LOGS_*
git commit -m "docs: cloud logs monitoring sign-off — v1.3 deployment"
```

Done. System is live.

---

## Support + Escalation

**Issue Found?**
1. Check `CLOUD_LOGS_QUICK_REFERENCE.md` red flags table
2. Screenshot error from Cloud Console
3. Note timestamp + error type
4. Message CTO with: `🔴 BLOCK [error] at [timestamp] — escalating`

**Questions?**
- Read `CLOUD_LOGS_MONITORING_GUIDE.md` sections 2–5 (comprehensive)
- Or ask: "monitoring issue X, what do I do?"

---

**Last Updated:** 2026-05-06 | **Version:** 1.3  
**Ready for:** 2026-05-07 00:00 UTC (v1.3 post-deployment)
