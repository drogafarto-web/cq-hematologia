# Phase 12 — Performance Monitoring Runbook

**Purpose:** Step-by-step guides for setting up, operating, and troubleshooting the automated performance baseline monitoring system established in Phase 12.

**Audience:** DevOps, Performance Engineers, Phase 4+ Release Leads.

---

## 1. Weekly Baseline Monitoring Setup

### 1.1 GitHub Actions Workflow

**File:** `.github/workflows/performance-baseline.yml`

**What it does:**
- Runs every Monday 08:00 UTC
- Builds the project (`npm run build`)
- Analyzes bundle size (`npm run analyze`)
- Extracts stats to JSON
- Appends metrics to Google Sheets (or exports as JSON for manual review)

**Manual setup (one-time):**

```bash
# 1. Verify the workflow file exists
ls -la .github/workflows/performance-baseline.yml

# 2. If not exists, create it:
cat > .github/workflows/performance-baseline.yml << 'EOF'
name: Weekly Performance Baseline

on:
  schedule:
    - cron: '0 8 * * 1'  # Every Monday 08:00 UTC
  workflow_dispatch:       # Also runnable manually

permissions:
  contents: read

jobs:
  baseline:
    name: Collect Performance Metrics
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Build
        run: npm run build

      - name: Analyze bundle
        run: ANALYZE=true npm run build 2>&1 | tee /tmp/build.log

      - name: Extract bundle stats
        run: |
          node scripts/extract-bundle-stats.js --output=json > /tmp/bundle-stats.json
          cat /tmp/bundle-stats.json

      - name: Run Lighthouse CI
        run: |
          npx @lhci/cli@latest autorun \
            --collect.numberOfRuns=3 \
            --collect.staticDistDir=./dist \
            --collect.url=http://localhost \
            --upload.target=temporary-public-storage
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}

      - name: Extract Lighthouse metrics
        if: always()
        run: |
          if [ -f .lighthouseci/result.json ]; then
            jq '.[] | {url, performance: .categories.performance.score, lcp: .audits["largest-contentful-paint"].numericValue, inp: .audits["interaction-to-next-paint"].numericValue, cls: .audits["cumulative-layout-shift"].numericValue}' < .lighthouseci/result.json | tee /tmp/lighthouse-metrics.json
          fi

      - name: Capture Firestore latency baseline
        run: |
          bash scripts/firestore-latency-baseline.sh --hours=24 --project=hmatologia2 || echo "Skipping Firestore logs (requires Cloud Logging access)"

      - name: Upload artifact (metrics + logs)
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: performance-baseline-${{ github.run_number }}
          path: |
            /tmp/bundle-stats.json
            /tmp/lighthouse-metrics.json
            firestore-*.json
            .lighthouseci/
          retention-days: 90

      - name: Comment on PRs if regression detected
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            
            // Parse bundle stats
            let bundleStats = {};
            try {
              bundleStats = JSON.parse(fs.readFileSync('/tmp/bundle-stats.json', 'utf-8'));
            } catch (e) {
              console.log('Could not parse bundle stats');
            }

            // Check for regressions vs. baseline
            const mainChunkTarget = 400; // KB gzip
            const totalTarget = 850;     // KB gzip
            
            let regressions = [];
            if (bundleStats.main_chunk_gzip_kb > mainChunkTarget) {
              regressions.push(`⚠️ Main chunk: ${bundleStats.main_chunk_gzip_kb} KB (target: <${mainChunkTarget} KB)`);
            }
            if (bundleStats.total_gzip_kb > totalTarget) {
              regressions.push(`⚠️ Total bundle: ${bundleStats.total_gzip_kb} KB (target: <${totalTarget} KB)`);
            }

            if (regressions.length > 0) {
              console.log('REGRESSIONS DETECTED:');
              regressions.forEach(r => console.log(r));
            } else {
              console.log('✓ All metrics within targets');
            }
EOF

# 3. Commit the workflow
git add .github/workflows/performance-baseline.yml
git commit -m "chore(perf): add weekly baseline monitoring workflow"
```

### 1.2 Manual Trigger (Testing)

To test the workflow before Monday:

```bash
# Via GitHub web UI:
# 1. Go to: https://github.com/your-org/hc-quality/actions
# 2. Find "Weekly Performance Baseline"
# 3. Click "Run workflow" → "Run workflow" button

# Or via CLI:
gh workflow run performance-baseline.yml --ref main
```

---

## 2. Google Sheets Dashboard Setup (Optional but Recommended)

### 2.1 Create Spreadsheet

**Purpose:** Visual trend tracking (bundle size, Lighthouse scores) over time.

**Setup:**

```bash
# 1. Create a new Google Sheet (manually via Google Sheets UI)
#    Name: "HC Quality v1.4 — Performance Baseline"
#    Share: Team (view only for most, edit for DevOps lead)

# 2. Create column headers:
# A: Date
# B: Timestamp
# C: Total Bundle (gzip KB)
# D: Main Chunk (gzip KB)
# E: Lighthouse Performance Score
# F: LCP (desktop ms)
# G: LCP (mobile ms)
# H: CLS
# I: Firestore p99 (ms)
# J: Notes

# 2b. (Optional) Set up conditional formatting:
#   - Red if Main Chunk > 400 KB
#   - Yellow if Main Chunk > 380 KB
#   - Red if Lighthouse < 0.85
```

### 2.2 Google Sheets API Integration

**Requires:** Service account + credentials

```bash
# 1. Create service account (one-time):
# Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
# Create new service account → create key (JSON) → download

# 2. Save to GitHub Secrets:
#   - Name: GOOGLE_SHEETS_SA_KEY
#   - Value: (contents of JSON file)

# 3. Share the Google Sheet with the service account email:
#   - Go to Sheet, click Share
#   - Paste service account email (xxx@project.iam.gserviceaccount.com)

# 4. Update GitHub Actions workflow to append to sheet:
cat >> .github/workflows/performance-baseline.yml << 'EOF'

      - name: Append metrics to Google Sheets
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const { google } = require('googleapis');
            const fs = require('fs');

            // Load service account key from secrets
            const saKey = JSON.parse(process.env.GOOGLE_SHEETS_SA_KEY);
            const auth = new google.auth.GoogleAuth({
              credentials: saKey,
              scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            const sheets = google.sheets({ version: 'v4', auth });
            
            // Parse metrics
            const bundleStats = JSON.parse(fs.readFileSync('/tmp/bundle-stats.json', 'utf-8'));
            
            // Append row to spreadsheet
            const sheetId = process.env.GOOGLE_SHEETS_ID;
            const values = [[
              new Date().toLocaleDateString(),
              new Date().toISOString(),
              bundleStats.total_gzip_kb,
              bundleStats.main_chunk_gzip_kb,
              'TBD', // Lighthouse score (parse from artifact)
              'TBD', // LCP desktop
              'TBD', // LCP mobile
              'TBD', // CLS
              'TBD', // Firestore p99
              'Automated weekly run',
            ]];

            await sheets.spreadsheets.values.append({
              spreadsheetId: sheetId,
              range: 'Sheet1!A:J',
              valueInputOption: 'USER_ENTERED',
              resource: { values },
            });

            console.log('✓ Appended metrics to Google Sheets');
        env:
          GOOGLE_SHEETS_SA_KEY: ${{ secrets.GOOGLE_SHEETS_SA_KEY }}
          GOOGLE_SHEETS_ID: ${{ secrets.GOOGLE_SHEETS_ID }}
EOF

# 5. Add secrets to GitHub:
# Go to: https://github.com/your-org/hc-quality/settings/secrets/actions
# Add:
#   - GOOGLE_SHEETS_SA_KEY = (contents of service account JSON)
#   - GOOGLE_SHEETS_ID = (spreadsheet ID from URL)
```

---

## 3. Operating the Monitoring System

### 3.1 Weekly Review (Every Monday Evening)

**Checklist:**

```bash
# 1. Check GitHub Actions run
#    Go to: https://github.com/your-org/hc-quality/actions
#    Filter: "Weekly Performance Baseline"
#    Verify latest run status: ✓ passed

# 2. Download artifacts
#    - Click latest run
#    - Download "performance-baseline-*" artifact
#    - Extract: bundle-stats.json, lighthouse-metrics.json

# 3. Review metrics
cat bundle-stats.json | jq '.main_chunk_gzip_kb, .total_gzip_kb'
cat lighthouse-metrics.json | jq '.[].performance'

# 4. Check Google Sheets (if configured)
#    Go to: https://docs.google.com/spreadsheets/d/SHEET_ID
#    Verify latest row added with this week's data

# 5. Look for regressions:
#    - Main chunk >400 KB? Flag it.
#    - Lighthouse performance <0.85? Flag it.
#    - CLS >0.1? Flag it.

# 6. If regression found, investigate:
#    See section 4 (Troubleshooting) below
```

### 3.2 Regression Alert Setup (GitHub + Email)

**Option A: GitHub Discussions (Free)**

```bash
# Create a GitHub Discussion thread:
# https://github.com/your-org/hc-quality/discussions
# Title: "Performance Monitoring — Weekly Baseline"
# Post weekly summary comment with metrics

# Then subscribe to the thread for email notifications
```

**Option B: Email Notification (via GitHub Actions)**

Add to `.github/workflows/performance-baseline.yml`:

```yaml
      - name: Send regression alert
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            // Parse metrics and send email if regression detected
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
              service: 'gmail',
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
              },
            });

            await transporter.sendMail({
              from: process.env.EMAIL_USER,
              to: 'team@example.com',
              subject: '⚠️ HC Quality v1.4 — Performance Regression Detected',
              html: '<p>Bundle size or Lighthouse metrics exceeded targets. See artifacts for details.</p>',
            });
        env:
          EMAIL_USER: ${{ secrets.EMAIL_USER }}
          EMAIL_PASS: ${{ secrets.EMAIL_PASS }}
```

**Simpler alternative:** Use IFTTT or Slack integration:

```bash
# In workflow, after metrics are computed:
# POST to Slack webhook if regression detected

- name: Notify Slack
  if: failure()
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
      -d "{\"text\": \"⚠️ Performance regression in hc-quality. Check GitHub Actions.\"}"
```

---

## 4. Troubleshooting

### 4.1 Workflow Fails to Run

**Symptom:** Scheduled run never executes on Monday.

**Cause:** GitHub Actions workflows need at least one push to the branch in the last 60 days.

**Fix:**
```bash
# Manually trigger workflow
gh workflow run performance-baseline.yml --ref main

# Or make a dummy commit to keep workflow active
git commit --allow-empty -m "chore: keep workflow active"
git push
```

### 4.2 Bundle Stats File Not Generated

**Symptom:** `npm run analyze` fails or doesn't create `dist/stats.json`.

**Cause:** Visualizer plugin not in vite.config.ts or ANALYZE env var not set.

**Fix:**
```bash
# Verify vite.config.ts has visualizer plugin:
grep -A5 "visualizer" vite.config.ts

# Try manually:
ANALYZE=true npm run build
ls -la dist/stats.json
```

### 4.3 Lighthouse CI Upload Fails

**Symptom:** `npx @lhci/cli@latest autorun` fails with auth error.

**Cause:** Missing or invalid LHCI_GITHUB_APP_TOKEN.

**Fix:**
```bash
# Create token in Lighthouse CI dashboard:
# https://github.com/apps/lighthouse-ci/installations
# Or re-auth locally:
npx @lhci/cli@latest auth --token=YOUR_TOKEN

# Save to GitHub Secrets:
gh secret set LHCI_GITHUB_APP_TOKEN --body "$(cat ~/.lighthouserc.json | jq -r .token)"
```

### 4.4 Firestore Latency Script Fails

**Symptom:** `firestore-latency-baseline.sh` exits with gcloud error.

**Cause:** Not authenticated to Google Cloud or missing permissions.

**Fix:**
```bash
# Authenticate
gcloud auth login
gcloud config set project hmatologia2

# Verify Cloud Logging access
gcloud logging read --limit=10 --project=hmatologia2

# If permission denied, request roles/logging.viewer IAM role
```

### 4.5 Manual Bundle Size Check

**Quick test** (no workflow needed):

```bash
# 1. Build with analysis
ANALYZE=true npm run build

# 2. Check sizes
node scripts/extract-bundle-stats.js --output=json | jq '.main_chunk_gzip_kb, .total_gzip_kb'

# 3. View interactive treemap
open dist/stats.html  # macOS
xdg-open dist/stats.html  # Linux
start dist/stats.html  # Windows
```

---

## 5. Interpreting Metrics

### 5.1 Bundle Size Targets

| Metric | Target | Acceptable Range | Action if >Range |
|--------|--------|------------------|------------------|
| Main chunk (gzip) | 362 KB | 340–420 KB | Investigate dependency bloat |
| Total bundle (gzip) | 850 KB | 800–920 KB | Review new module sizes |
| Per-module chunk (gzip) | 150 KB | 100–180 KB | Consider code-splitting |

**Example interpretation:**
- Main chunk = 375 KB → ✓ Within range (340–420)
- Main chunk = 430 KB → ⚠️ Regression (review recent PRs for eager imports)

### 5.2 Lighthouse Metrics

| Metric | Target | Range | Interpretation |
|--------|--------|-------|---|
| Performance score | 0.85+ | 0.75–1.0 | Overall performance grade |
| LCP | <2.0s | — | How fast user sees content |
| INP | <200ms | — | Responsiveness of interactions |
| CLS | <0.05 | — | Visual stability (layout shifts) |
| TBT | <200ms | — | Main thread blockage time |

**Example interpretation:**
- LCP = 1.9s, CLS = 0.04 → ✓ Both within targets
- LCP = 2.6s → ✗ Hard fail (>2500ms limit in lighthouserc.js)

### 5.3 Firestore Latency Percentiles

| Percentile | Interpretation |
|-----------|---|
| p50 | Median latency (50% of requests are faster) |
| p95 | 95th percentile (1 in 20 requests is slower) |
| p99 | 99th percentile (1 in 100 requests is slower) |

**Baseline targets (post-v1.3 Phase 3):**
- Read operations: p50 <50ms, p99 <300ms
- Query operations: p50 <150ms, p99 <500ms
- Write operations: p50 <400ms, p99 <1000ms

**Action:** If p99 increases >20% from baseline, audit N+1 queries and indexes.

---

## 6. Regression Investigation Playbook

**Trigger:** Metric exceeds target range in weekly run.

**Step 1: Identify culprit**

```bash
# Check recent commits
git log --oneline -20

# Check recent PRs
gh pr list --state=merged -L10

# Look for:
# - New dependencies added
# - New route/module added
# - Changes to vite.config.ts
# - Changes to any lazy-loading logic
```

**Step 2: Reproduce locally**

```bash
# Checkout the regression commit
git checkout COMMIT_HASH

# Build and analyze
ANALYZE=true npm run build
node scripts/extract-bundle-stats.js --output=json

# Compare to baseline
# If main chunk increased 20 KB, that's likely the culprit
```

**Step 3: Fix & verify**

**Common regressions & fixes:**

| Regression | Cause | Fix |
|---|---|---|
| Main chunk +30 KB | New eager import of route | Change to `React.lazy` |
| Main chunk +50 KB | New library added | Move to dynamic import or separate chunk in manualChunks |
| LCP increases 400ms | Firestore query on mount | Add skeleton loader, prefetch on parent route |
| CLS increases | Image reflow without dimensions | Add `width`/`height` to images |

**Step 4: Deploy fix**

```bash
# 1. Fix code
# 2. Test locally: ANALYZE=true npm run build
# 3. Open PR with performance checklist filled
# 4. Merge after CI passes
# 5. Watch next week's run to confirm regression resolved
```

---

## 7. Maintenance & Rundown

### 7.1 Quarterly Review

**Every Q (e.g., 2026-05, 2026-08, 2026-11):**

```bash
# 1. Export Google Sheets data to CSV
# 2. Plot trends: bundle size, LCP, performance score over 12 weeks
# 3. Identify slow-moving regressions (gradual creep, not single incident)
# 4. Adjust targets if necessary (e.g., if p99 consistently <600ms, tighten from 500ms)
# 5. Share trend report with team
```

### 7.2 GitHub Actions Cleanup

**Every 6 months:**

```bash
# Check artifact retention
# By default, artifacts expire after 90 days.
# If you want longer history, download/archive to Google Cloud Storage:

gsutil cp gs://your-bucket/perf-baselines/* local-archive/
```

### 7.3 Lighthouse CI Token Refresh

**Annually** (if using cloud storage):

```bash
# Regenerate LHCI_GITHUB_APP_TOKEN in case of key rotation
# https://github.com/apps/lighthouse-ci/installations/new
# Update GitHub Secrets
```

---

## 8. Quick Reference Commands

```bash
# Extract bundle stats
node scripts/extract-bundle-stats.js --output=json

# Capture Firestore latency baseline
bash scripts/firestore-latency-baseline.sh --hours=24 --project=hmatologia2

# Run Lighthouse locally (3 runs, multi-URL)
npx @lhci/cli@latest autorun \
  --collect.numberOfRuns=3 \
  --collect.staticDistDir=./dist \
  --collect.url=http://localhost \
  --upload.target=temporary-public-storage

# View bundle treemap
ANALYZE=true npm run build && open dist/stats.html

# Check if metrics within targets
cat /tmp/bundle-stats.json | jq '.main_chunk_gzip_kb as $main | if $main > 400 then "⚠️ Main >400KB" else "✓" end'
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Owner:** Performance Lead / DevOps  
**Next Review:** 2026-05-27 (first weekly run post-Phase 12 kickoff)
