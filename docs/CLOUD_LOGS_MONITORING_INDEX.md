# Cloud Logs Monitoring — Complete Index

**Purpose:** Central reference for post-deployment Cloud Logs verification (v1.3+).

**Status:** Ready to use. All documents + scripts created and tested.

**Date:** 2026-05-06

---

## Files Created (6 Documents + 2 Scripts)

### Core Documents (Read These First)

| File | Audience | Read Time | Purpose |
|------|----------|-----------|---------|
| **`DEPLOYMENT_QUICK_START.md`** | Deployers | 2 min | Copy to screen before deploying. 3-terminal setup + timeline. |
| **`CLOUD_LOGS_QUICK_REFERENCE.md`** | Everyone | 3 min | Bookmark. Essential commands, red flags, cheat sheet. |
| **`CLOUD_LOGS_MONITORING_GUIDE.md`** | Reference | 20 min | Full guide. Sections 1–8 + troubleshooting. **Read once, reference often.** |

### Workflow / Integration

| File | Audience | Purpose |
|------|----------|---------|
| **`CLOUD_LOGS_INTEGRATION_CHECKLIST.md`** | Deployers | Pre/during/post deploy tasks. Scenario-based (red flags, rollback, etc.). |
| **`.planning/DEPLOYMENT_MONITORING_WORKFLOW.md`** | Project leads | Complete workflow from Steps 1–5. Timeline + decision tree. |
| **`CLOUD_LOGS_MONITORING_SETUP_SUMMARY.md`** | Technical leads | What was created, why, how it works. Questions + answers. |

### Automated Tools (Scripts)

| File | Platform | Lines | Usage |
|------|----------|-------|-------|
| **`scripts/monitor-cloud-logs.sh`** | Bash (macOS/Linux) | 250+ | `bash scripts/monitor-cloud-logs.sh 24 30` |
| **`scripts/monitor-cloud-logs.ps1`** | PowerShell (Windows) | 280+ | `.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30` |

### This File

| File | Purpose |
|------|---------|
| **`CLOUD_LOGS_MONITORING_INDEX.md`** | You are here. Navigation + quick links. |

---

## Quick Navigation by Role

### I'm a Deployer (About to Deploy v1.3)

**Start here:**
1. Read: `DEPLOYMENT_QUICK_START.md` (2 min)
2. Print/bookmark: `CLOUD_LOGS_QUICK_REFERENCE.md`
3. Open Terminal 2, run: `bash scripts/monitor-cloud-logs.sh 24 30` (while Terminal 1 deploys)
4. After 24h, create sign-off: `docs/SIGN_OFF_CLOUD_LOGS_*.md` (use template in `CLOUD_LOGS_MONITORING_GUIDE.md`)
5. Commit: `git add docs/MONITORING_REPORT_* && git commit -m "..."`

**If questions:** See `CLOUD_LOGS_MONITORING_GUIDE.md` sections 2–5

**If errors:** Check red flags in `CLOUD_LOGS_QUICK_REFERENCE.md`

---

### I'm a Project Lead (Overseeing Deployment)

**Read these (in order):**
1. `DEPLOYMENT_QUICK_START.md` (2 min) — understand timeline
2. `.planning/DEPLOYMENT_MONITORING_WORKFLOW.md` (10 min) — full workflow + decision tree
3. `CLOUD_LOGS_INTEGRATION_CHECKLIST.md` (5 min) — integration + scenario handling

**Key points:**
- Monitoring is non-blocking; deploy proceeds regardless
- Red flags require escalation; document in sign-off
- Post-deployment sign-off is required before releasing to users

---

### I'm a CTO / Tech Lead (Reviewing Deployment)

**Essential reading:**
1. `CLOUD_LOGS_MONITORING_SETUP_SUMMARY.md` (5 min) — what was created + why
2. `CLOUD_LOGS_MONITORING_GUIDE.md` sections 2–3 (10 min) — red flags + common issues
3. `.planning/DEPLOYMENT_MONITORING_WORKFLOW.md` (5 min) — escalation decision tree

**Key questions to ask deployer:**
- "What's the total error count from `MONITORING_REPORT_*.md`?"
- "Any red flags (timeout, permission denied, 502/503)?"
- "Have we documented findings in `SIGN_OFF_CLOUD_LOGS_*.md`?"

**If escalation:** Section 7 of `CLOUD_LOGS_MONITORING_GUIDE.md` has contact + process.

---

### I'm a QA / Auditor (Verifying Deployment Health)

**Documents to review:**
1. `docs/MONITORING_REPORT_<timestamp>.md` — auto-generated report (summary)
2. `docs/SIGN_OFF_CLOUD_LOGS_<date>.md` — manual sign-off with recommendation
3. `scripts/cloud-logs-export-<timestamp>.json` — detailed error log (if any errors)

**What you're checking:**
- Total error count: should be 0 or <5
- No red flags (timeout, permission, 502, etc.)
- Sign-off recommendation: ✅ APPROVE (safe) or ⚠️ ESCALATE (needs investigation)

---

## How to Use During Deployment

### Pre-Deployment (15 min before)

```bash
# 1. Verify prerequisites
npm run tsc --noEmit          # Should pass
gcloud config set project hmatologia2  # Verify project
which bash                    # For macOS/Linux
which powershell              # For Windows

# 2. Read quick reference
cat docs/CLOUD_LOGS_QUICK_REFERENCE.md

# 3. Prepare 3 terminals
# Terminal 1: Type-check + build
# Terminal 2: Deploy functions + hosting
# Terminal 3: Monitoring script
```

### During Deployment (17 min active)

**Terminal 1:**
```bash
npm run tsc --noEmit
npm run build
```

**Terminal 2 (while Terminal 1 runs):**
```bash
firebase deploy --only functions --project hmatologia2
# Wait for ✓ complete
firebase deploy --only hosting --project hmatologia2
# Wait for ✓ complete
```

**Terminal 3 (start AFTER Terminal 2 starts Functions deploy):**
```bash
bash scripts/monitor-cloud-logs.sh 24 30
# Let it run. Will auto-complete after 24h.
```

### Post-Deployment (15 min, after 24h or on-demand)

```bash
# 1. View auto-generated report
cat docs/MONITORING_REPORT_*.md

# 2. Create manual sign-off (use template from GUIDE)
vi docs/SIGN_OFF_CLOUD_LOGS_2026-05-07.md

# 3. Commit to git
git add docs/MONITORING_REPORT_* docs/SIGN_OFF_CLOUD_LOGS_*
git add scripts/cloud-logs-export-*.json
git commit -m "docs: v1.3 cloud logs monitoring sign-off

Monitoring period: 2026-05-07 00:00 → 2026-05-08 00:00 UTC
Total errors: 0 (Functions: 0, Firestore: 0, Hosting: 0)
Recommendation: APPROVE
Signed by: [deployer name]"
```

---

## Common Commands (Copy + Paste)

### Deploy Commands
```bash
# Full deploy (Steps 1–3)
npm run tsc --noEmit && npm run build && firebase deploy --only functions --project hmatologia2 && firebase deploy --only hosting --project hmatologia2
```

### Monitoring Commands
```bash
# Automated (24h, 30-min checks) — Bash
bash scripts/monitor-cloud-logs.sh 24 30

# Automated (24h, 30-min checks) — PowerShell
.\scripts\monitor-cloud-logs.ps1 -Hours 24 -IntervalMinutes 30

# Quick error check (right now)
gcloud logging read "severity >= ERROR" --project=hmatologia2 --limit=20

# Real-time tail (Ctrl+C to stop)
gcloud logging read "severity >= ERROR" --project=hmatologia2 --follow

# Error count snapshot
gcloud logging read "severity >= ERROR" --project=hmatologia2 --format=json | jq length
```

### Rollback Commands
```bash
# If Functions failed
git checkout HEAD~1 functions/
firebase deploy --only functions --project hmatologia2

# If Hosting failed
git checkout HEAD~1 hosting/
firebase deploy --only hosting --project hmatologia2

# After rollback, restart monitoring (tight)
bash scripts/monitor-cloud-logs.sh 2 10  # 2h with 10-min checks
```

### Review Commands
```bash
# View auto-generated report
cat docs/MONITORING_REPORT_*.md

# View error export
cat scripts/cloud-logs-export-*.json | jq '.[0:5]'  # First 5 errors

# View sign-off (after you create it)
cat docs/SIGN_OFF_CLOUD_LOGS_*.md
```

---

## Red Flags Quick Table

**If you see ANY of these, escalate immediately:**

| Error Signature | Severity | Action |
|---|---|---|
| `"Exceeded timeout of X seconds"` | 🔴 BLOCK | Async handler not awaiting; check `functions/src/modules/*/index.ts` |
| `"Permission denied"` on `/labs/{labId}/*` writes | 🔴 BLOCK | Firestore rules regression; compare to git HEAD |
| HTTP 502 or 503 sustained >5 min | 🔴 BLOCK | Hosting/runtime failure; consider rollback |
| `"undefined is not a function"` | 🔴 BLOCK | Missing dependency; check `functions/package.json` |
| `"Document too large"` on laudo/declaracao | 🔴 BLOCK | Data model exceeds 1 MB; refactor to subcollection |
| `"Request rate exceeded"` (Firestore) | 🟡 OK | Expected during load; backoff handles automatically |
| Cold-start latency on first invoke | 🟡 OK | Expected; not an error |

**For any 🔴 BLOCK:**
1. Screenshot error from Cloud Console
2. Note exact timestamp
3. Message CTO (@drogafarto): "🔴 BLOCK — [error type] at [timestamp]"
4. Wait for response before proceeding

---

## File Structure

```
C:\hc quality\
├── docs/
│   ├── CLOUD_LOGS_MONITORING_GUIDE.md          ← Full reference (40 sections)
│   ├── CLOUD_LOGS_QUICK_REFERENCE.md           ← TL;DR + commands
│   ├── CLOUD_LOGS_INTEGRATION_CHECKLIST.md     ← Workflow + scenarios
│   ├── CLOUD_LOGS_MONITORING_SETUP_SUMMARY.md  ← Q&A + status
│   ├── CLOUD_LOGS_MONITORING_INDEX.md          ← You are here (navigation)
│   ├── DEPLOYMENT_QUICK_START.md               ← Quick setup
│   ├── MONITORING_REPORT_*.md                  ← Auto-generated (after deploy)
│   ├── SIGN_OFF_CLOUD_LOGS_*.md                ← Manual sign-off (after deploy)
│   └── cloud-logs-export-*.json                ← Error export (if errors found)
│
├── scripts/
│   ├── monitor-cloud-logs.sh                   ← Bash automation
│   └── monitor-cloud-logs.ps1                  ← PowerShell automation
│
└── .planning/
    └── DEPLOYMENT_MONITORING_WORKFLOW.md       ← Full workflow doc
```

---

## FAQ

**Q: When do I use this?**  
A: After Step 2 (Functions deploy) and during Step 3 (Hosting deploy). Monitoring runs for 24h in background.

**Q: Can I skip monitoring?**  
A: No. Monitoring is part of the v1.3 deployment protocol. Use automated script (easiest) or manual spot-checks.

**Q: What if I find errors during monitoring?**  
A: Check red flags table above. If 🔴 BLOCK: escalate immediately. If 🟡 OK: continue monitoring, document in sign-off.

**Q: How long does monitoring take?**  
A: 24h of background monitoring + 15 min sign-off work = ~32 min active time (deploy) + 24h background.

**Q: Can I stop monitoring early?**  
A: Yes, Ctrl+C anytime. Report will cover partial window. Create manual sign-off noting the truncation.

**Q: Where do I report issues?**  
A: Screenshot + timestamp + message CTO (@drogafarto) immediately.

**Q: What happens after sign-off?**  
A: v1.3 is released to production. Reports archived in git for audit trail.

---

## Next Steps

1. **Before deploying:** Read `DEPLOYMENT_QUICK_START.md`
2. **During deploying:** Run monitoring script in Terminal 3
3. **After 24h:** Create sign-off + commit to git
4. **System is live:** v1.3 in production

---

## Integration with Project

Updated in root `CLAUDE.md`:

```markdown
**Post-Deployment Monitoring (v1.3+):**

- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — full setup
- `docs/CLOUD_LOGS_QUICK_REFERENCE.md` — TL;DR
- `docs/CLOUD_LOGS_INTEGRATION_CHECKLIST.md` — workflow
- `scripts/monitor-cloud-logs.sh` — Bash script
- `scripts/monitor-cloud-logs.ps1` — PowerShell script

Use: `bash scripts/monitor-cloud-logs.sh 24 30` after Step 2 deploy.
```

---

**Last Updated:** 2026-05-06 | **Version:** 1.3  
**Status:** Ready for v1.3 Deployment
