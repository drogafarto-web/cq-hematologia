# Cloud Logs Monitoring Guide — v1.3 Post-Deployment Verification

**Purpose:** Continuous 24-hour verification of Cloud Functions, Firestore, and Hosting logs after Step 2 (Functions deploy).

**Monitoring Window:** From Functions deploy completion through +24h.

**Owner Responsibility:** Any authorized deployer. Non-blocking; runs in parallel with other post-deploy tasks.

---

## 1. Pre-Monitoring Setup

| Setting                 | Value                                     |
| ----------------------- | ----------------------------------------- |
| **GCP Project**         | `hmatologia2`                             |
| **Region**              | `southamerica-east1`                      |
| **Duration**            | 24h continuous or spot-check every 30 min |
| **Alert Threshold**     | Any `ERROR` or `EXCEPTION` severity       |
| **Expected Error Rate** | <5 errors per 10,000 invocations          |

### Prerequisites

- GCP account with Editor+ role on `hmatologia2`
- `gcloud` CLI installed and configured: `gcloud config set project hmatologia2`
- (Optional) `jq` for JSON parsing: available on macOS/Linux; Windows use PowerShell equivalents

---

## 2. What to Monitor

### 2.1 Cloud Functions Logs

**Entry Point:** [Cloud Console Logs Explorer](https://console.cloud.google.com/logs/query)

**Filter:**

```
resource.type="cloud_function"
AND resource.labels.function_name=~".*"
```

**Watch For:**

- `severity >= ERROR` (red flag icons in UI)
- Text contains: `"Exception"`, `"Timeout"`, `"Crash"`, `"undefined is not a function"`
- `"Exceeded timeout of X seconds"` — async operations not completing

**Expected Outcome:**

- 0 permission/auth errors (v1.3 rules are fully permissive during implantação)
- <1 unhandled exception per deployment
- Cold-start latency on first invocation (expected, not an error)

---

### 2.2 Firestore Logs

**Entry Point:** Cloud Console Logs Explorer

**Filter:**

```
resource.type="cloud_firestore"
```

**Watch For:**

- `"Request rate exceeded"` — quota/throttling warning
- `"Permission denied"` — rules rejecting writes (should be 0 in v1.3)
- `"Document too large"` — data model exceeds 1 MB
- `"Index missing"` — composite index not created

**Expected Outcome:**

- 0 permission denied errors
- 0 document-too-large errors
- Rate exceeded OK during load spike; auto-backs off after 60s

---

### 2.3 Hosting Logs

**Entry Point:** Cloud Console Logs Explorer

**Filter:**

```
resource.type="cloud_run"
OR resource.labels.service="hmatologia2"
```

**Watch For:**

- HTTP status `5xx` (500, 502, 503, 504)
- `severity=ERROR`
- Latency >5s (P99)

**Expected Outcome:**

- 0 5xx errors post-deploy
- LCP <2.5s
- All 200/204 responses

---

## 3. Common Issues & Troubleshooting

| Symptom                                    | Log Signature                                        | Root Cause                                                        | Resolution                                                                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Function stops after 30s                   | `"Exceeded timeout of 30 seconds"`                   | Async handler not awaiting; missing `return`                      | Check callable handler in `functions/src/modules/*/index.ts`; ensure all promises are awaited                                                              |
| `undefined is not a function`              | Stack trace with line number                         | Missing dependency or import path wrong                           | Run `npm list` in `functions/`; check `package.json` for Supabase CLI tool, Cloud Tasks, etc.                                                              |
| `"Permission denied"` on Firestore write   | `"Error writing document at path /...` + perm denied | Rules too restrictive                                             | Verify v1.3 rules in `firestore.rules` — should be `.allow write: if request.auth.uid != null;` OR check `allowUnauthenticated` setting in Firebase config |
| Rate limit spam: `"Request rate exceeded"` | Repeated in logs every 1-2 sec                       | Client polling too aggressively or bulk operation hammering quota | Confirm polling interval >30s; check if migration script (Drive importer, etc.) is running — if so, whitelist quota temporarily in GCP                     |
| `"Document too large"`                     | Error on `laudo`, `declaracao`, or bulk update       | Data model field exceeds 1 MB (e.g., PDF embedded as base64)      | Split into subcollection or move to Cloud Storage; avoid storing binary in Firestore                                                                       |
| `"Invalid grant"` (OAuth)                  | Auth error during Drive import                       | Token refresh failed or credentials rotated                       | Check Cloud Functions environment variable `GOOGLE_APPLICATION_CREDENTIALS`; re-deploy functions with fresh credentials                                    |
| Missing `labId` in reads                   | Query returns empty on `/labs/{labId}/*`             | Collection path using default `uid` instead of `labId`            | Verify hook/query uses `labId` from auth payload; check `useColaboradores`, `useOrcamentos` patterns                                                       |

---

## 4. Monitoring Methods

### Option A: Cloud Console (Recommended for 24h Passive)

**Best for:** Non-technical users, long passive monitoring, visual context.

**Steps:**

1. Navigate to [Cloud Logging Console](https://console.cloud.google.com/logs/query)
2. Copy one of the filters from **Section 2** above into the query editor
3. Set time range: **Last 24 hours**
4. Click **Run Query**
5. Sort by `timestamp` DESC to see latest first
6. **Auto-refresh:** Cloud Console does NOT auto-refresh. Manually refresh every 15–30 min:
   - Press `Cmd + R` (macOS) or `Ctrl + R` (Windows/Linux)
   - Or click the refresh icon (top-right, circular arrow)

**Visual Cues:**

- Red icon = ERROR, orange = WARNING, blue = INFO
- Click any log line to expand full stack trace

---

### Option B: gcloud CLI (Recommended for Automation)

**Best for:** Developers, automated checks, scripting.

**Setup:**

```bash
# Verify project is set
gcloud config get-value project
# Should output: hmatologia2

# If not, set it:
gcloud config set project hmatologia2
```

**Command 1: Last-24h Error Snapshot**

```bash
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 \
  --limit=100 \
  --format=json | jq '.[].textPayload'
```

**Command 2: Real-Time Error Tail (Streaming)**

```bash
gcloud logging read "severity >= ERROR" \
  --project=hmatologia2 \
  --limit=50 \
  --follow
```

Press `Ctrl + C` to stop. Tails last 50 errors and streams new ones.

**Command 3: Function-Specific Errors**

```bash
gcloud logging read \
  'resource.type="cloud_function" AND severity >= ERROR' \
  --project=hmatologia2 \
  --format=json | jq -r '.[] | "\(.timestamp): \(.labels.function_name) — \(.textPayload)"'
```

---

### Option C: Bash Monitoring Script (Automated Spot-Checks)

**Best for:** Scripted 24-hour monitoring with periodic checks.

See **CLOUD_LOGS_MONITORING_SCRIPT.sh** below for full executable.

**Quick Usage:**

```bash
# Monitor for 24 hours, check every 30 minutes
./scripts/monitor-cloud-logs.sh 24 30

# Monitor for 6 hours, check every 10 minutes (tighter loop for dev)
./scripts/monitor-cloud-logs.sh 6 10
```

---

## 5. Spot-Check Sequence (If Continuous Monitoring Not Possible)

Run this sequence every 2 hours for 24 hours (12 spot-checks total):

```bash
# Check 1: Last 2 hours of errors
gcloud logging read "severity >= ERROR AND timestamp > now - 120m" \
  --project=hmatologia2 \
  --limit=50 \
  --format=json | jq length

# If count > 0, get details:
gcloud logging read "severity >= ERROR AND timestamp > now - 120m" \
  --project=hmatologia2 \
  --limit=10 \
  --format="table(timestamp, severity, jsonPayload.function_name, textPayload)"

# Check 2: Firestore quota/permission errors
gcloud logging read \
  'resource.type="cloud_firestore" AND (textPayload=~".*Permission.*" OR textPayload=~".*rate.*")' \
  --project=hmatologia2 \
  --limit=20

# Check 3: Hosting 5xx errors
gcloud logging read \
  'resource.type="cloud_run" AND httpRequest.status >= 500' \
  --project=hmatologia2 \
  --limit=20
```

---

## 6. Sign-Off Report Template

Use this template to document the 24-hour monitoring period. **Save as:** `docs/SIGN_OFF_CLOUD_LOGS_<DATE>.md`

```markdown
# Cloud Logs Verification Report — v1.3 Deployment

**Monitoring Period:** 2026-05-07 00:00 UTC → 2026-05-08 00:00 UTC (24h)

**Method Used:** [☐ Cloud Console | ☐ gcloud CLI | ☐ Monitoring Script]

**Reviewer Name:** ************\_************

**Reviewer Email:** ************\_************

---

## Summary

| Metric                              | Value |
| ----------------------------------- | ----- |
| **Total Function Invocations**      |       |
| **Total Firestore Operations**      |       |
| **Total Hosting Requests**          |       |
| **Error Count (severity >= ERROR)** |       |
| **Error Rate %**                    |       |
| **P99 Latency (Functions)**         |       |
| **P99 Latency (Hosting)**           |       |

---

## Errors Detailed

### Functions Errors

- [ ] None found ✅
- [ ] Found [N] errors:
  - Error 1: [description + timestamp]
  - Error 2: [description + timestamp]
  - (list up to 5; if >5, attach JSON export)

### Firestore Errors

- [ ] None found ✅
- [ ] Found [N] errors:
  - Permission denied: [count] — [resolution]
  - Rate limited: [count] — [resolution]

### Hosting Errors

- [ ] None found ✅
- [ ] Found [N] errors: [list status codes]

---

## Issues Found & Resolved

| Issue                    | Detection Time       | Root Cause | Action Taken | Status      |
| ------------------------ | -------------------- | ---------- | ------------ | ----------- |
| [e.g., Function timeout] | 2026-05-07 14:30 UTC | [cause]    | [action]     | ✅ Resolved |

---

## Recommendation

**☐ APPROVE** — All checks passed, no blockers. Safe for production use.

**☐ ESCALATE** — Issues found, require investigation before full sign-off. See issues above.

**☐ BLOCK** — Critical errors detected. Do not release until resolved.

---

**Signature:** ************\_************ | **Date:** ******\_******
```

---

## 7. Emergency Escalation

If **any of these** are found during monitoring, escalate immediately:

1. **>10 ERROR logs in 1 hour** → Possible cascading failure
2. **`"Permission denied"` on `/labs/{labId}/*` writes** → Rules regression
3. **HTTP 502 or 503 sustained >5 min** → Hosting/runtime failure
4. **Function timeout on every invocation** → Async handler broken
5. **`"Document too large"` on laudo/declaracao** → Data model overflow

**Escalation Process:**

1. Note exact timestamp + log snippet
2. Alert deployer / CTO (@drogafarto)
3. Rollback to previous deploy if critical: `firebase deploy --only functions --project hmatologia2` (revert `functions/` to git HEAD~1)
4. Investigate root cause before re-deploying

---

## 8. Post-Monitoring Cleanup

**After 24h monitoring completes:**

1. Save report (Section 6) to repo: `docs/SIGN_OFF_CLOUD_LOGS_<YYYYMMDD>.md`
2. Commit report: `git add docs/SIGN_OFF_CLOUD_LOGS_*.md && git commit -m "docs: v1.3 cloud logs sign-off <date>"`
3. If automated script was used, retain `.sh` output log in `docs/` for audit trail
4. Close monitoring (if using streaming tail, Ctrl+C; if Cloud Console, just close tab)

---

## Appendix: GCP Quota Limits (Reference)

| Resource                    | Daily Limit         | Alert Threshold      |
| --------------------------- | ------------------- | -------------------- |
| Cloud Functions invocations | Unlimited           | N/A                  |
| Firestore writes per second | 10,000 (adjustable) | >8,000               |
| Firestore document size     | 1 MB                | Document approaching |
| Drive API calls per user    | 1,000,000 / day     | >800,000             |

If Drive importer is running during monitoring, expect rate-limit warnings after 100k reads. This is **expected** and **not a blocker**. Backoff + retry logic handles it automatically.

---

**Last Updated:** 2026-05-06 | **Version:** 1.3
