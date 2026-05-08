# Phase 4 Performance Validation — Quick Reference

**For May 20 Smoke Test**

---

## TL;DR — 3 Commands to Run

**Option 1: Full validation (15 min)**

```bash
# macOS/Linux
bash scripts/phase4-validation.sh --full

# Windows
.\scripts\phase4-validation.ps1 -Mode "full"
```

**Option 2: Fast validation (5 min, skip Lighthouse)**

```bash
bash scripts/phase4-validation.sh --quick
.\scripts\phase4-validation.ps1 -Mode "quick"
```

**Option 3: Lighthouse only (10 min)**

```bash
bash scripts/phase4-validation.sh --lighthouse-only
.\scripts\phase4-validation.ps1 -Mode "lighthouse-only"
```

---

## 7 Metrics at a Glance

| # | Metric | v1.3 Baseline | Phase 4 Target | Status |
|---|--------|---------------|----------------|--------|
| 1 | Bundle size | 362 KB | ≤365 KB | ✅ PASS (3 KB headroom) |
| 2 | Lighthouse avg | 91/100 | ≥87/100 | ✅ PASS (4 pt headroom) |
| 3 | LCP (Web Vitals) | 1.9s avg | <2.5s hard limit | ✅ PASS (600 ms headroom) |
| 4 | INP (Web Vitals) | 110ms avg | <200ms hard limit | ✅ PASS (90 ms headroom) |
| 5 | CLS (Web Vitals) | 0.04 avg | <0.1 hard limit | ✅ PASS (0.06 headroom) |
| 6 | Auth latency p95 | ~400ms | <500ms | ✅ PASS (100 ms headroom) |
| 7 | Laudo load p95 | ~1.2s | <2.0s | ✅ PASS (0.8s headroom) |

**Overall:** 🟢 LOW RISK — All targets have healthy margins.

---

## Automated Test Suite

### What It Does

1. ✅ TypeScript check (detects type errors)
2. ✅ Production build (catch build failures early)
3. ✅ Bundle size validation (gzip measurement)
4. ✅ Lighthouse audits (5 critical routes, 3 runs each)
5. ✅ Unit tests (smoke test suite)
6. ✅ Cloud Functions build (ensures functions compile)
7. ✅ Secrets verification (required secrets set)

### What It Returns

**Pass:** All 7 checks green → ready to deploy  
**Fail:** Any red check → fix issues before smoke test  
**Warnings:** Yellow items may not block (review before deploy)

---

## Manual Test Alternatives

If the automated script doesn't work on your machine:

### Bundle Size (1 min)

```bash
npm run build
ls -lh dist/assets/index*.js
# Should see ~362 KB (gzip is internal to Vite)
```

### Lighthouse (10 min)

```bash
npm run preview &
# In another terminal:
npx lighthouse http://localhost:4173/hub --output=json --output-path=lh.json
jq '.lighthouseResult.categories.performance.score' lh.json
# Should see 0.92 (92/100)
```

### Web Vitals (from Lighthouse JSON)

```bash
jq '.lighthouseResult.audits.metrics.details.items[0] | {
  lcp: (.largestContentfulPaint / 1000),
  inp: .totalInteractionLatency,
  cls: .cumulativeLayoutShift
}' lh.json
```

---

## Pass/Fail Criteria

### PASS ✅ (Ready to deploy)

- Bundle size: ≤365 KB gzip (main shell)
- Lighthouse average: ≥87/100
- All routes: Lighthouse ≥82/100
- Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1
- No TypeScript errors
- No build failures
- All secrets configured

### FAIL ❌ (Block deployment)

- Bundle size: >400 KB (investigate new dependencies)
- Lighthouse average: <82/100 (regression >5 pts on any route)
- Web Vitals hard limits exceeded (LCP >2.5s, INP >250ms, CLS >0.1)
- TypeScript errors
- Build fails
- Missing secrets

### WARNING ⚠️ (Review, may not block)

- Bundle size: 365-380 KB (document why)
- Lighthouse: 82-87/100 (review code changes)
- Web Vitals within hard limits but >target (monitor after deploy)

---

## Deployment Timeline

**2026-05-20 (Monday, smoke test day):**

- **09:00** — Run `phase4-validation.sh` (full suite, ~15 min)
- **09:30** — Review results + document in SLACK/EMAIL
- **10:00** — CTO sign-off if all green
- **11:00** — Deploy to production (if sign-off)
- **12:00** — Monitor 24h via Firebase Performance dashboard

**2026-05-21 (Tuesday, post-deploy):**

- Monitor Cloud Logs for errors + latency
- Run `bash scripts/monitor-cloud-logs.sh 24 30` (full 24h report)
- Verify no regressions in production metrics

---

## Performance Budget Headroom

| Metric | Headroom | Risk |
|--------|----------|------|
| Bundle | 3 KB (0.8%) | 🟢 Very low — can't add new libs >50 KB |
| Lighthouse | 4 pts (4.4%) | 🟢 Low — code changes won't regress 4 pts alone |
| LCP | 600 ms (25%) | 🟢 Low — major regression needed to fail |
| Auth latency | 100 ms (20%) | 🟢 Low — network variance won't fail |
| Laudo load | 800 ms (40%) | 🟢 Low — safety margin for Firestore variance |

**Recommendation:** Keep headroom intact. Don't add dependencies or features that would reduce these margins.

---

## If Validation Fails

### "Bundle size over 365 KB"

**Action:**
1. Run `ANALYZE=true npm run build`
2. Open `dist/stats.html`
3. Identify the largest chunk
4. If it's a new dependency: remove or lazy-load it
5. If it's existing code growth: request code review

**Acceptable reasons for size increase:**
- New feature explicitly required (document in code)
- Unavoidable dependency (justify in PR)
- Code duplication resolved by refactor (ok to grow)

**Not acceptable:**
- Multiple polyfills for same feature
- Duplicate node_modules entries
- Unintentional large library imports

---

### "Lighthouse below 87/100"

**Action:**
1. Run Lighthouse locally on same route
2. Check the "Opportunities" section (recommended fixes)
3. Most common:
   - New heavy component without React.lazy → wrap in lazy()
   - New image without width/height → add explicit dimensions
   - New Firestore query without index → add index + redeploy
4. If local ≥87, likely a transient issue (re-test)

---

### "Web Vitals over hard limit"

**Action:**
1. Check which metric: LCP/INP/CLS
2. LCP >2.5s: Check Firestore latency (add indexes) or new dependency (lazy-load)
3. INP >200ms: Check for expensive JavaScript (profile in DevTools)
4. CLS >0.1: Check for late-loading images or modals without reserved space
5. If issue persists, escalate to CTO

---

## Key Files

| File | Purpose |
|------|---------|
| `.planning/PERFORMANCE_VALIDATION.md` | Full spec + test commands (read this first) |
| `scripts/phase4-validation.sh` | Bash automation (Linux/macOS) |
| `scripts/phase4-validation.ps1` | PowerShell automation (Windows) |
| `docs/PERFORMANCE_PATTERNS.md` | Architectural patterns for optimization |
| `docs/FIREBASE_PERFORMANCE_BUDGET.md` | Alert thresholds + monitoring setup |
| `.planning/v1.3-PERFORMANCE_BASELINE.md` | v1.3 baseline data (for comparison) |

---

## Post-Deployment Monitoring

### Real-Time (Firebase Console)

https://console.firebase.google.com/project/hmatologia2/performance

Watch for:
- LCP alerts >2500ms (automated email + Slack)
- INP alerts >200ms (automated email + Slack)
- CLS alerts >0.1 (automated email + Slack)

### Manual Check (24h after deploy)

```bash
# Capture 24h of Cloud Logs (Bash/macOS/Linux)
bash scripts/monitor-cloud-logs.sh 24 30

# Or PowerShell (Windows)
.\scripts\monitor-cloud-logs.ps1 24 30
```

This will generate a report showing:
- Latency percentiles (p50/p95/p99)
- Error rates
- Recommendations

---

## Questions?

Refer to:
1. **Full spec:** `.planning/PERFORMANCE_VALIDATION.md` (150+ pages)
2. **Test commands:** Run the script with `--help` flag
3. **Architecture:** `docs/PERFORMANCE_PATTERNS.md`
4. **History:** `.planning/v1.3-PERFORMANCE_BASELINE.md`

---

**Document Version:** 1.0  
**Date:** 2026-05-07  
**For Phase 4 Deployment:** 2026-05-20
