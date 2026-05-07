---
title: "Phase 15 Deployment Checklist — Quick Reference"
date: 2026-05-07
purpose: "Print & use during live deployment"
---

# Phase 15 Deployment Checklist — Quick Reference

**Print this page. Check off as you go. Keep on monitor.**

---

## PRE-EXECUTION (2026-05-07 19:00 UTC Deadline)

- [ ] Phase 14 merged to main (git log confirms latest commit)
- [ ] CTO authorization email received (subject: "Phase 15 Launch Authorization")
- [ ] On-call engineer assigned (name + phone number documented)
- [ ] War room Slack channel created: `#hc-quality-v14-deploy-war-room`
- [ ] Monitoring script staged: `scripts/monitor-cloud-logs.ps1` (or `.sh`)
- [ ] GCP credentials verified: `gcloud config get-value project` → `hmatologia2`
- [ ] Firebase CLI authenticated: `firebase projects:list` shows `hmatologia2`
- [ ] Baseline metrics from v1.3 captured (screenshot DICQ % + RDC matrix)
- [ ] Test accounts pre-created:
  - [ ] Auditor: `auditor.test@hmatologia2.lab` (password in 1Password)
  - [ ] Patient: `patient.test@hmatologia2.lab`
  - [ ] RT: `rt.test@hmatologia2.lab`

---

## STEP 1: FIRESTORE RULES + INDEXES (20:00–20:30 UTC)

**Owner:** DevOps Lead + QA Lead

### Pre-Deploy (5 min)

Terminal 1 — Type-check:
```bash
npx tsc --noEmit
```
- [ ] Output: `0 errors` ✓

Terminal 2 — Rules validation:
```bash
firebase deploy --only firestore:rules --dry-run --project hmatologia2
```
- [ ] Output: Shows rule blocks OR "no changes" ✓

**GATE:** Both green? → Proceed. Red? → Escalate, do NOT deploy.

### Rules Backup (2 min)

```bash
# Backup (async)
gcloud firestore export gs://hmatologia2-backups/rules-backup-$(date +%Y%m%d_%H%M%S)/ \
  --project hmatologia2 --async
```
- [ ] Command executed ✓

### Deploy Rules (10 min)

```bash
firebase deploy --only firestore:rules --project hmatologia2
```
- [ ] Output: `Deploy complete!` ✓
- [ ] New collections visible in GCP Console: Firestore → Rules ✓
- [ ] Screenshot taken ✓

### Deploy Indexes (10 min)

```bash
firebase deploy --only firestore:indexes --project hmatologia2
```
- [ ] Output: `Deployment complete!` ✓
- [ ] ~25 new indexes building in background (OK if still building) ✓

### Safety Check (3 min)

```bash
gcloud logging read \
  "resource.type=cloud_firestore AND severity=ERROR AND text:\"Permission denied\"" \
  --limit=10 --project hmatologia2 --format=json | jq length
```
- [ ] Output: `0` ✓

**GATE:** All checks pass? → Proceed to Step 2. Error detected? → Revert rules, escalate.

---

## STEP 2: CLOUD FUNCTIONS (20:35–21:15 UTC)

**Owner:** DevOps Lead + on-call engineer

### Pre-Deploy Security Gate (5 min)

**MANDATORY:**
```bash
bash scripts/preflight-secrets-check.sh
```
- [ ] Output: `exit code 0` (green) ✓

If exit code 1 (red):
- [ ] Note missing secrets from output
- [ ] Run: `firebase functions:secrets:set [SECRET_NAME]` for each
- [ ] Paste value from 1Password, confirm
- [ ] Re-run `preflight-secrets-check.sh` until exit 0 ✓

### Type-Check (5 min)

```bash
cd functions
npx tsc --noEmit
npm run build
```
- [ ] Output: `0 errors` ✓
- [ ] Output: `Successfully compiled X functions` ✓

### Deploy Functions (25 min)

```bash
firebase deploy --only functions --project hmatologia2 --region southamerica-east1
```
- [ ] Output: Lists 50+ function names ✓
- [ ] All functions have ✅ checkmark (no ❌) ✓
- [ ] Output: `Deploy complete!` ✓

**GCP Console Verification:**
- [ ] Cloud Functions page shows ~50 new functions ✓
- [ ] All status = `OK` (green) ✓
- [ ] No ERROR state ✓

### Cold-Start Smoke (10 min)

Test 3 high-traffic callables:

```bash
# Test 1: NOTIVISA
curl -X POST https://southamerica-east1-hmatologia2.cloudfunctions.net/notivisa-send \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"labId": "test-lab", "dryRun": true}'
```
- [ ] Response: 200 OR 400 (NOT 500/502) ✓

```bash
# Test 2: Portal config
curl -X POST https://southamerica-east1-hmatologia2.cloudfunctions.net/portal-config-update \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  -H "Content-Type: application/json" \
  -d '{"labId": "test-lab", "dryRun": true}'
```
- [ ] Response: 200 OR 400 (NOT 500/502) ✓

```bash
# Test 3: Pub/Sub subscriptions
gcloud pubsub subscriptions list --project hmatologia2 --format=json | \
  jq '.[] | .name' | grep -E "(exports|nps-recurring)"
```
- [ ] Output: Shows subscriptions ✓

**GATE:** All 3 tests pass? → Proceed to Step 3. Any 500/502? → Escalate, investigate.

---

## STEP 3: HOSTING (21:15–21:45 UTC)

**Owner:** DevOps Lead

### Pre-Deploy (5 min)

```bash
# Type-check (re-confirm)
npx tsc --noEmit
# Build
npm run build
# Check sizes
ls -lh dist/ | head -20
```
- [ ] Type-check: `0 errors` ✓
- [ ] Build output: `✓ built in XXs` ✓
- [ ] Bundle sizes sanity (no file >1 MB) ✓

### Deploy Hosting (20 min)

```bash
firebase deploy --only hosting --project hmatologia2
```
- [ ] Output: `Deploy complete!` ✓
- [ ] Output shows Hosting URL: `https://hmatologia2.web.app` ✓
- [ ] Output shows ~XXX files deployed ✓

**GCP Console Verification:**
- [ ] Hosting tab shows latest deploy timestamp (matches current time) ✓
- [ ] Status: green ✓

### PWA Service Worker (5 min)

1. **Fresh Session Test:**
   - Open Incognito/Private window
   - Navigate to `https://hmatologia2.web.app`
   - [ ] Page loads ✓
   - [ ] DevTools → Application → Service Workers → Status = "activated and running" ✓

2. **Cache Verification:**
   - DevTools → Storage → Cache
   - [ ] New cache entry appears (e.g., "v1.4-*") ✓

3. **Offline Test:**
   - DevTools → Network → toggle "Offline"
   - Refresh page
   - [ ] App still loads (assets from cache) ✓

---

## STEP 4: PRODUCTION SMOKE TESTS (21:45–22:30 UTC)

**Owner:** QA Lead + on-call engineer | Environment: Production

### Test Case AU-01: Auditor Login

1. Navigate: `https://hmatologia2.web.app/auth/login`
2. Email: `auditor.test@hmatologia2.lab`
3. Password: [from 1Password]
4. [ ] Dashboard loads ✓
5. [ ] Hub tiles visible ✓
6. [ ] DevTools → localStorage shows `auth_token`, `refresh_token` ✓

### Test Case AU-02: Admin Access

1. Logged in as auditor
2. Navigate: `/admin/system-status`
3. [ ] Admin panel visible ✓
4. Navigate: `/features/bioquimica`
5. [ ] Module loads with live data ✓

### Test Case CR-01: Critical Value NOTIVISA

1. Navigate: `/features/bioquimica/runs`
2. Create run:
   - Equipment: Roche Cobas
   - Analyte: Glucose
   - Result: 500 mg/dL
3. [ ] "Mark as Entered" ✓
4. [ ] Dialog shows: "⚠️ CRITICAL VALUE" ✓
5. Click "Send Now"
6. [ ] Success: "NOTIVISA sent to ANVISA + lab RT" ✓
7. Check Cloud Logs:
   ```bash
   gcloud logging read "function_name=notivisa-send" --limit=1
   ```
   [ ] Log entry shows `"status":"sent"` ✓

### Test Case PR-01: Patient Portal Laudo Download

1. New Incognito window
2. Navigate: `https://hmatologia2.web.app/patient-portal`
3. Patient code: `PAC-00001`
4. [ ] Patient info appears ✓
5. [ ] Recent laudo list visible ✓
6. Click "Download Laudo"
7. [ ] PDF downloads ✓
8. [ ] PDF size >500 KB ✓
9. [ ] Signature block visible in PDF ✓

### Test Case DH-01: Hub Dashboard

1. Logged in as auditor
2. Navigate: `/hub`
3. [ ] 35 module tiles visible ✓
4. [ ] Bioquímica, SGQ, Reclamações tiles present ✓
5. Click Bioquímica tile
6. [ ] Dashboard loads in <2s ✓
7. [ ] Real-time data: "Today's Runs: [count]" visible ✓
8. [ ] Levey-Jennings chart visible ✓

### Test Case CQ-01: Bioquímica Entry

1. Navigate: `/features/bioquimica`
2. Create run:
   - Equipment: [Select from dropdown]
   - Analyte: Glucose
   - Result: 100 mg/dL (normal)
3. [ ] "Save" ✓
4. [ ] Run entered without error ✓
5. [ ] Levey-Jennings chart updates within 1s ✓
6. [ ] DevTools Console: no errors ✓

### Test Case SG-01: SGD Document List

1. Navigate: `/features/sgq/documentos`
2. [ ] Document list appears ✓
3. [ ] 80+ Riopomba docs visible ✓
4. Click any MQ (Manual de Qualidade)
5. [ ] Document preview loads ✓
6. [ ] Version history visible ✓
7. [ ] Audit trail shows created/modified info ✓

### Test Case FB-01: NPS Submission

1. Patient portal → "Feedback" tab
2. NPS question: Select "9/10"
3. Comment: "Excellent service"
4. [ ] "Submit" ✓
5. [ ] Success: "Thank you for your feedback" ✓
6. [ ] No PII (patient name) in comment field ✓

### Test Case FB-02: Complaint

1. Patient portal → "Report Issue"
2. Category: "Test report error"
3. Description: "Test complaint"
4. [ ] "Submit" ✓
5. [ ] Success message appears ✓

### Web Vitals Spot-Check

In DevTools Console, run:
```javascript
web.vitals.getCLS()  // Expected: <0.1
web.vitals.getINP()  // Expected: <200ms
web.vitals.getLCP()  // Expected: <2.5s
```
- [ ] All within target ✓

**GATE:** 8/8 tests pass? → Proceed to 48h Monitoring. Any fail? → Escalate, investigate.

---

## START 48H CLOUD LOGS MONITORING (22:30 UTC)

```bash
# Terminal (keep running for 48h)
bash scripts/monitor-cloud-logs.sh 48 30
# OR Windows:
.\scripts\monitor-cloud-logs.ps1 -Hours 48 -IntervalMinutes 30
```

- [ ] Script started ✓
- [ ] Output shows monitoring window: 48 hours ✓
- [ ] Interval: 30 minutes ✓
- [ ] Export file created (JSON) ✓
- [ ] Report file will be created (Markdown) ✓

### Slack War Room Posts (Every 6 hours)

- [ ] 23:00 UTC — Initial post: "Deployment complete ✓. Monitoring started."
- [ ] 06:00 UTC next day — "6h check: X errors, status [🟢/🟡/🔴]"
- [ ] 12:00 UTC — "12h check: X errors, status [🟢/🟡/🔴]"
- [ ] 18:00 UTC — "18h check: X errors, status [🟢/🟡/🔴]"
- [ ] 24:00 UTC — "24h mark: X errors total, status [🟢/🟡/🔴]"
- [ ] (repeat pattern for 24–48h window)
- [ ] 22:30 UTC end — "48h monitoring complete. Report: [PDF link]"

---

## REAL-WORLD SMOKE TESTS (2026-05-08, 08:00–17:00 UTC)

**Participants:** Auditor, RT, QA lead

- [ ] RW-01: Auditor SGD compliance review (30 min) — Auditor signs off
- [ ] RW-02: RT critical value response time (45 min) — <2 min SLA validated
- [ ] RW-03: Patient portal laudo download (20 min) — Design + security validated
- [ ] RW-04: Portal médico links (20 min, optional)
- [ ] RW-05: NPS feedback PII check (15 min) — No PII leakage confirmed

---

## POST-MONITORING CLOSURE (2026-05-09, 23:00 UTC)

### Metrics Capture

```bash
# Export cloud logs (JSON)
cp scripts/cloud-logs-export-*.json docs/v1.4-cloud-logs-export.json

# Generate PDF report (if Markdown exists)
pandoc docs/MONITORING_REPORT_*.md -o docs/MONITORING_REPORT_v1.4.pdf
```

- [ ] JSON export saved ✓
- [ ] PDF report generated ✓

### Closure Tasks

- [ ] Merge Phase 14 branches to main ✓
- [ ] Git tag: `git tag -a v1.4-deploy-2026-05-07 -m "v1.4 production deploy complete"` ✓
- [ ] Create `DEPLOYMENT_LOG_v1.4.md` with timeline + metrics ✓
- [ ] Create `LESSONS_LEARNED.md` ✓
- [ ] Update `STATE.md` — v1.4 live ✓
- [ ] Update `CLAUDE.md` — Module table + deployment status ✓
- [ ] Capture `METRICS_BASELINE_v1.4.json` ✓
- [ ] Update Obsidian roadmap ✓

### Sign-Offs

- [ ] CTO approval email: "v1.4 LIVE" (async)
- [ ] Auditor acknowledgment email: "Compliance verified" (async)

---

## FINAL SIGN-OFF CHECKLIST

- [ ] All 4 deploy steps executed ✓
- [ ] 48h monitoring complete, 0 P0 incidents ✓
- [ ] 8/8 smoke tests passing ✓
- [ ] Real-world validation done ✓
- [ ] Cloud logs exported ✓
- [ ] Metrics captured ✓
- [ ] Closure tasks complete ✓
- [ ] CTO + Auditor approvals obtained ✓
- [ ] War room closed with final status ✓
- [ ] On-call engineer released ✓

---

## EMERGENCY ROLLBACK PROCEDURE

**Only if P0 incident cannot be fixed in 15 minutes.**

```bash
# 1. Find latest stable commit
git log --oneline | grep "Phase 14 complete" | head -1

# 2. Revert
git reset --hard [COMMIT_HASH]

# 3. Re-deploy
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
firebase deploy --only functions --project hmatologia2
firebase deploy --only hosting --project hmatologia2

# 4. Smoke test (5 min)
# Navigate to https://hmatologia2.web.app → login

# 5. War room: "ROLLBACK EXECUTED [reason]"
```

- [ ] Rollback executed (if needed) ✓
- [ ] Incident documented ✓
- [ ] Post-mortem scheduled ✓

---

## ESCALATION CONTACTS

| Role | Name | Email | Phone |
|------|------|-------|-------|
| CTO | — | — | — |
| DevOps Lead | — | — | — |
| QA Lead | — | — | — |
| On-Call Engineer | — | — | — |
| Auditor | — | — | — |

---

**Print this checklist. Check off each item as you complete it. Save this page.**

**Date:** 2026-05-07  
**Deployment Window:** 20:00–22:30 UTC  
**Monitoring Window:** 22:30 UTC → 2026-05-09 22:30 UTC
