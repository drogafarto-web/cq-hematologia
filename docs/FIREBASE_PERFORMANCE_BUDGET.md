# Firebase Performance Monitoring — Budget Alerts

**Project:** hmatologia2  
**Date Configured:** 2026-05-06  
**Notification channels:** Email (to CTO inbox), Slack (to #engineering)  
**Region:** southamerica-east1 (functions), hmatologia2.web.app (hosting)

---

## Budget Thresholds

| Metric                          | Threshold | Severity    | Action                    |
| ------------------------------- | --------- | ----------- | ------------------------- |
| LCP (Largest Contentful Paint)  | > 2500 ms | 🔴 Critical | Block merge + investigate |
| INP (Interaction to Next Paint) | > 200 ms  | 🟠 Warning  | Review + monitor next 24h |
| CLS (Cumulative Layout Shift)   | > 0.1     | 🟠 Warning  | Review + monitor next 24h |

**Rationale:**

- **LCP > 2.5s**: Lighthouse fails; users perceive site as slow to load
- **INP > 200ms**: Users perceive slow interactions; indicates main thread bottleneck
- **CLS > 0.1**: Visual jank visible to users; compliance concern for lab workflows

---

## Alert Configuration

### Alert 1: LCP Budget (Web)

- **Name:** LCP Budget (Web)
- **Metric:** Largest Contentful Paint
- **Condition:** Page load time exceeds 2500 milliseconds
- **Notification:** Email + Slack
- **Scope:** All pages
- **Purpose:** LCP > 2.5s is Lighthouse FAIL; alerts on production regression

**When this fires:**

1. Check Firebase Performance dashboard → Web Vitals → LCP
2. Identify which page(s) regressed (view by page/route)
3. Correlate with recent deploys via git log
4. Run `npm run lighthouse:ci` locally to reproduce
5. If confirmed regression, revert deploy or apply fix before next merge

### Alert 2: INP Budget (Web)

- **Name:** INP Budget (Web)
- **Metric:** Interaction to Next Paint
- **Condition:** User interaction response > 200 milliseconds
- **Notification:** Email + Slack
- **Scope:** All pages
- **Purpose:** Slow INP = unresponsive UI; flag before it reaches 300ms hard limit

**When this fires:**

1. Check dashboard: which interactions are slow (filter by page/event type)
2. Likely cause: main thread blocked by expensive computation
3. Remediation: move work to worker, memoize expensive renders, lazy-load heavy libs
4. Monitor for 24h; if persists, escalate

### Alert 3: CLS Budget (Web)

- **Name:** CLS Budget (Web)
- **Metric:** Cumulative Layout Shift
- **Condition:** Visual stability < 0.1
- **Notification:** Email + Slack
- **Scope:** All pages
- **Purpose:** Layout shift > 0.1 is Lighthouse FAIL; very noticeable to users

**When this fires:**

1. Check dashboard: which pages have shift (likely new route or feature)
2. Common causes: missing image dimensions, late-loading content, modals without z-index reserve
3. Fix: add fixed `width`/`height` to images, reserve space with skeleton loaders, ensure z-index stacking
4. Monitor until resolved

---

## Monitoring Dashboard

**Access at:** https://console.firebase.google.com/project/hmatologia2/performance

**Views available:**

- By Device: desktop / mobile / tablet — different budgets may apply
- By Browser: Chrome, Safari, Edge, Firefox — helps identify platform-specific issues
- By Page: broken down by route (/hub, /features/analytics, etc) — see which routes underperform
- By Time range: last 7d, 30d, 90d custom — trend analysis

**Key navigation:**

1. Go to "Performance" tab in Firebase Console
2. View "Web Vitals" section
3. Scroll to "Web Vitals by page" card
4. Click on any metric (LCP, INP, CLS) to drill down by page/device/browser

---

## Escalation & Remediation

### Priority-based response:

**CRITICAL (LCP >2.5s):**

1. Fire: CTO + eng team notified immediately
2. Assess: Is it a new deploy? Check git log + staging environment
3. Triage:
   - If regression introduced in last 2 hours → rollback immediately
   - If gradual degradation over days → new code + infrastructure debt; prioritize fix
4. Fix: Apply Performance Pattern from `docs/PERFORMANCE_PATTERNS.md`
   - Code-split heavy routes? → Move to `React.lazy`
   - Large library? → Make it lazy
   - Firebase query slow? → Check indexes + rules
5. Verify: Run `npm run lighthouse:ci` locally
6. Deploy: Merge fix to main
7. Monitor: Watch dashboard for 2 hours post-deploy; confirm alert clears

**WARNING (INP >200ms or CLS >0.1):**

1. Fire: Team notified
2. Assess: Is it reproducible? Check same page/device combo multiple times
3. If noise (single outlier): wait 24h, resample
4. If real: add to backlog, prioritize for next sprint
5. Interim: document known issue + set expectations

### Investigation checklist:

- [ ] Identify exact page/route with regression
- [ ] Check git log for recent changes to that route
- [ ] Run `npm run build` locally and check chunk sizes
- [ ] Run `npm run lighthouse:ci` on current main + on commit before regression
- [ ] Check Firestore rules for new queries (missing indexes slow TTFB)
- [ ] Use Chrome DevTools Performance tab to profile main thread
- [ ] Ask: "Did we add a new dependency? new listener? new computation?"

---

## Automation + CI Gates

### Lighthouse CI (automated)

**File:** `lighthouse.config.js` in project root

```javascript
module.exports = {
  ci: {
    upload: {
      target: 'filesystem',
      outputDir: '.lhci-results',
    },
    collect: {
      numberOfRuns: 3,
      url: [
        'https://hmatologia2.web.app/hub',
        'https://hmatologia2.web.app/features/analytics',
        'https://hmatologia2.web.app/features/export',
      ],
      settings: {
        chromeFlags: ['--no-sandbox', '--disable-dev-shm-usage'],
        onlyCategories: ['performance', 'accessibility'],
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['error', { minScore: 0.85 }],
        'metrics:largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'metrics:interaction-to-next-paint': ['error', { maxNumericValue: 200 }],
        'metrics:cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
  },
};
```

**Run locally before merging:**

```bash
npm run lighthouse:ci
```

If any assertion fails (LCP/INP/CLS violated), fix before commit. This prevents regressions from reaching production.

### Firebase Performance Alerts (automated)

Configured in Firebase Console (manually set up; see "Configuration" above).

**How they work:**

1. Firebase SDK in browser periodically reports Web Vitals
2. Firebase Performance Monitoring aggregates metrics per page/device
3. If aggregate crosses threshold (e.g., LCP > 2.5s), alert fires
4. Alert sends email + Slack notification
5. Engineering team investigates via dashboard

**Why both Lighthouse CI + Firebase alerts?**

- **Lighthouse CI**: Synthetic monitoring (controlled environment) — catches regressions early
- **Firebase alerts**: Real user monitoring (RUM) — catches production issues real users see
- **Together**: Layer-1 (merge gate) + Layer-2 (production safety net)

---

## Backlog Items (Future Optimization)

- [ ] Configure anomaly detection (Firebase auto-detects outliers beyond normal variance)
- [ ] Set up Slack webhook for real-time incident response (vs. email digest)
- [ ] Create runbook for INP regressions (profiling guide + common causes)
- [ ] Monthly review: adjust thresholds if baseline improves (celebrate improvements!)
- [ ] Configure alerts for other metrics: FCP, TTFB, Time to Interactive
- [ ] Integrate Lighthouse CI results into GitHub Actions for automatic blocking
- [ ] Set up performance trend dashboard (month-over-month comparison)

---

## Evidence & Screenshots

**Screenshots showing alert configuration (attach to Phase 4 summary):**

1. Firebase Console → Performance → Web Vitals → Alerts tab (showing 3 active alerts)
2. LCP Alert dialog (threshold 2500ms, condition > selected, notifications enabled)
3. INP Alert dialog (threshold 200ms)
4. CLS Alert dialog (threshold 0.1)

**Lighthouse CI baseline captured:**

- 3 routes × 2 devices (desktop + mobile) = 6 baselines
- 3 runs per baseline, averaged
- Results in `.lhci-results/` (JSON reports for auditor)
- Regression thresholds: LCP +10%, INP +15%, CLS +20%

---

## Alert Test & Verification

**To verify alert is working (optional):**

1. Lower one threshold temporarily (e.g., LCP to 1500ms — known to be violated)
2. Wait 5 minutes for Firebase to aggregate and fire alert
3. Receive email/Slack notification
4. Restore threshold to 2500ms
5. Alert should clear within next 5 minutes

**Expected outcome:** You receive email + Slack message confirming alerts are connected to notification channels.

---

**Last Updated:** 2026-05-06 (Phase 4, CLEAN-03)
