# Phase 4 Pre-Deployment Checklist

**Version:** 1.0  
**Date:** 2026-05-07  
**Target Date:** 2026-05-20 (Deploy Day)  
**Owner:** CTO + QA

---

## 🎯 Deployment Timeline

| Date                     | Task                      | Owner       | Status     |
| ------------------------ | ------------------------- | ----------- | ---------- |
| **2026-05-13**           | Final Phase 4 code review | Engineering | ⏳ Pending |
| **2026-05-19 15:00 UTC** | Run full smoke test suite | QA          | ⏳ Pending |
| **2026-05-20 08:00 UTC** | Final pre-flight check    | DevOps      | ⏳ Pending |
| **2026-05-20 09:30 UTC** | Deploy Step 1: Rules      | DevOps      | ⏳ Pending |
| **2026-05-20 09:35 UTC** | Deploy Step 2: Functions  | DevOps      | ⏳ Pending |
| **2026-05-20 09:45 UTC** | Deploy Step 3: Hosting    | DevOps      | ⏳ Pending |
| **2026-05-20 10:00 UTC** | Go-live confirmation      | CTO         | ⏳ Pending |

---

## 📋 Pre-Smoke Test Checklist (2026-05-19)

### Code & Branch Readiness

- [ ] All Phase 4 code merged to `main`
- [ ] Zero uncommitted changes: `git status` clean
- [ ] All tests passing locally: `npm run test:unit`
- [ ] TypeScript clean: `npm run typecheck` (0 errors)
- [ ] No TypeScript baseline deviations: `npm run typecheck | grep -c "error TS"` = 0

### Environment Readiness

- [ ] Machine has ≥500 MB free disk space
- [ ] Firewall allows `localhost:8080` (emulator) and `localhost:5173` (dev server)
- [ ] Internet connection stable (Lighthouse needs external access)
- [ ] Node.js 22+ installed: `node -v`
- [ ] npm 10+ installed: `npm -v`
- [ ] Firebase CLI installed: `firebase --version`
- [ ] Java 11+ installed: `java -version`

### Dependency & Configuration

- [ ] `npm ci` completed (clean install): `ls -la node_modules | wc -l` > 1000
- [ ] Functions dependencies installed: `cd functions && npm ci && cd ..`
- [ ] `.firebase.json` exists and is valid
- [ ] `firestore.rules` checked (no syntax errors)
- [ ] `firestore.indexes.json` up to date
- [ ] `vite.config.ts` has no debug flags or uncommitted changes

### Secrets & Access

- [ ] Firebase project access verified: `firebase list`
- [ ] Cloud project ID correct: `hmatologia2`
- [ ] Region correct: `southamerica-east1`
- [ ] Service account key available (for deployment)
- [ ] Staging lab test account exists and is active
- [ ] Test user email/password noted for manual testing (if needed)

---

## 📊 Smoke Test Execution Checklist (2026-05-20, 08:30 UTC)

### Pre-Execution (5 minutes)

- [ ] Terminal is clean (no background jobs)
- [ ] Working directory is project root: `pwd` shows `hc-quality`
- [ ] No unfinished emulator/dev processes: `lsof -i :5173` returns nothing
- [ ] Kill any lingering jobs: `pkill -f firebase; pkill -f npm run dev; sleep 1`
- [ ] Notes app/document open for recording results

### Execution (40 minutes)

```bash
# macOS / Linux
bash scripts/phase4-e2e-smoke.sh

# Windows PowerShell
.\scripts\phase4-e2e-smoke.ps1
```

- [ ] Script starts without errors
- [ ] Section 1 (Prerequisites): All green ✅
- [ ] Section 2 (TypeScript + Build): All green ✅
- [ ] Section 3 (Bundle Size): All green ✅
- [ ] Section 4 (Emulator + Data): All green ✅
- [ ] Section 5 (E2E Tests): All green ✅ (22/22 tests pass)
- [ ] Section 6 (Lighthouse): All green ✅ (avg ≥87/100)
- [ ] Section 7 (Security): All green ✅
- [ ] Section 8 (Summary): Shows `STATUS: ✅ PASS`

### Post-Execution (5 minutes)

- [ ] Exit code is 0: `echo $?` (macOS/Linux) or `$LASTEXITCODE` (PowerShell)
- [ ] Text report exists: `.planning/SMOKE_TEST_RESULTS_May_*.txt`
- [ ] JSON export exists: `.planning/SMOKE_TEST_RESULTS_May_*.json`
- [ ] Results reviewed and understood
- [ ] Screenshot of final summary taken (for audit trail)

---

## ✅ Pass / Fail Decision Matrix

### ✅ PASS Criteria (All must be true)

- [x] Exit code = 0
- [x] All 8 sections show ✅ PASS
- [x] 0 blockers or failed tests
- [x] Bundle size <365 KB
- [x] E2E tests: 22/22 passed
- [x] Lighthouse average ≥87/100
- [x] Security rules validated
- [x] No critical errors in console

**Decision:** ✅ **READY TO DEPLOY**

### ❌ FAIL Criteria (Any one is true)

- [ ] Exit code = 1
- [ ] Any section shows ❌ FAIL
- [ ] Bundle size >365 KB
- [ ] E2E tests: <22 passed
- [ ] Lighthouse average <87/100
- [ ] Security rules allow unauthenticated access
- [ ] TypeScript errors present
- [ ] Critical errors in console

**Decision:** ❌ **STOP — DO NOT DEPLOY**

### If FAIL:

1. Document the exact failure(s)
2. Identify root cause
3. Fix the issue
4. Re-run smoke test
5. Confirm PASS before proceeding

---

## 🚀 Deployment Checklist (If PASS)

### Pre-Deployment (08:30–09:30 UTC)

- [ ] Smoke test results documented
- [ ] CTO reviewed results and approved deployment
- [ ] Team notified: "Deploying Phase 4 at 09:30 UTC"
- [ ] Monitoring dashboards opened (Firebase Console + Cloud Logs)
- [ ] Rollback plan reviewed (if deployment fails)
- [ ] Post-deploy runbook reviewed by ops team

### Step 1: Deploy Firestore Rules (09:30 UTC, ~5 minutes)

```bash
firebase deploy --only firestore:rules --project hmatologia2
```

- [ ] Command executed without error
- [ ] Firebase Console shows rules updated
- [ ] No `PERMISSION_DENIED` errors in logs
- [ ] Test read/write still works (manual verification)

### Step 2: Deploy Cloud Functions (09:35 UTC, ~10 minutes)

```bash
firebase deploy --only functions --project hmatologia2
```

- [ ] All 78 functions deployed successfully
- [ ] No timeout errors
- [ ] Cloud Functions dashboard shows 0 errors
- [ ] Sample callable tested (e.g., analytics query)

### Step 3: Deploy Hosting (09:45 UTC, ~5 minutes)

```bash
firebase deploy --only hosting --project hmatologia2
```

- [ ] Deployment completed
- [ ] https://hmatologia2.web.app loads
- [ ] PWA service worker updated (hard refresh may be needed)
- [ ] No 404 or 500 errors in browser console

### Post-Deployment Health Check (09:50–10:00 UTC, ~10 minutes)

- [ ] **Homepage loads** — https://hmatologia2.web.app/ renders
- [ ] **Auth works** — Can log in with test account
- [ ] **Core module loads** — Navigate to `/hub`, see module tiles
- [ ] **Firestore accessible** — No permission errors in console
- [ ] **Cloud Logs clean** — No ERROR or CRITICAL messages in past 10 min
- [ ] **Bundle serves correctly** — DevTools Network tab shows JS/CSS loaded, <365 KB main

### Go-Live (10:00 UTC)

- [ ] All health checks passed ✅
- [ ] Team notified: "Phase 4 is live in production"
- [ ] Update status in `.planning/STATE.md`
- [ ] Begin 24h monitoring (Cloud Logs + Firebase Performance)

---

## 🔍 Smoke Test Troubleshooting Quick Reference

| Issue                 | Likely Cause             | Quick Fix                                         |
| --------------------- | ------------------------ | ------------------------------------------------- |
| **Exit code 1**       | One or more tests failed | Review output above summary                       |
| **Build fails**       | Missing dependency       | Check `package.json` and `functions/package.json` |
| **TypeScript errors** | Code has type issues     | `npm run typecheck` and fix                       |
| **Bundle >365 KB**    | New large dependency     | Lazy load or refactor                             |
| **E2E tests fail**    | Firebase emulator issue  | `pkill -f firebase; sleep 2; retry`               |
| **Lighthouse <87**    | Performance regression   | Profile with DevTools Performance tab             |
| **Port in use**       | Background process       | Kill with `lsof -i :[port]`                       |

---

## 📝 Sign-Off & Documentation

### Smoke Test Sign-Off (by QA/DevOps)

```
Phase 4 E2E Smoke Test Results
════════════════════════════════
Date: [DATE]
Time: [TIME] UTC
Executor: [NAME]

Exit Code: 0 ✅
Status: PASS ✅

Results Files:
- .planning/SMOKE_TEST_RESULTS_May_*.txt
- .planning/SMOKE_TEST_RESULTS_May_*.json

All 8 checklist items PASS. Ready for production deployment.

Signed: _________________ Date: _________
```

### Deployment Sign-Off (by CTO)

```
Approved for Production Deployment
═══════════════════════════════════
Phase: 4
Date: 2026-05-20
Time: 09:30 UTC

Smoke Test: PASS ✅
Code Review: PASS ✅
Security: PASS ✅

Authorized: _________________ Date: _________
```

### Post-Deployment Sign-Off (by Ops/Support)

```
Phase 4 Post-Deployment Verification
═════════════════════════════════════
Start Time: 2026-05-20 09:50 UTC
End Time: 2026-05-20 10:00 UTC

All health checks: PASS ✅
No error spikes: PASS ✅
24h monitoring: ARMED ✅

Verified: _________________ Date: _________
```

---

## 📞 Escalation Protocol

### If Blocker Found (Stop Deployment)

1. **Notify CTO immediately** — "Smoke test FAILED, blocker found"
2. **Document the error** — Screenshot + exact error message
3. **Don't merge or deploy** — Even if requested
4. **Wait for root cause investigation** — CTO will advise next steps

### Critical Issues (Phone/Chat)

- Bundle size 15+ KB over target → Phone CTO
- Lighthouse <80/100 avg → Phone CTO
- Security rules failure → Phone CTO immediately
- E2E test suite <20/22 passing → Phone CTO

### Non-Critical Issues (Can wait for business hours)

- Lighthouse warning (but avg ≥87) → Document in PR
- Individual Lighthouse route <87 (but avg ≥87) → Document in PR
- Minor test seed issues → Manual seed + re-run

---

## 🛠️ Smoke Test Script Maintenance

### If Script Needs Updates

1. **Update only** — `scripts/phase4-e2e-smoke.{sh,ps1}`
2. **Never modify** — Smoke test scope/checklist (frozen for deployment)
3. **Document changes** — Update this checklist
4. **Test changes locally** — Before production use

### If New Tests Needed Post-Phase 4

- Create separate script: `scripts/smoke-extended.sh`
- Keep core smoke test frozen (for consistency)
- Update documentation separately

---

## 📅 Deployment History

| Phase       | Date       | Status     | Notes                                    |
| ----------- | ---------- | ---------- | ---------------------------------------- |
| **Phase 4** | 2026-05-20 | 🔜 Pending | First execution of this smoke test suite |
| (Future)    | —          | —          | —                                        |

---

## 🎓 Training & Handoff

### For New Team Members (Before Deployment Day)

1. Read: `SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md` (20 min)
2. Read: `SMOKE_TESTS_PHASE4_QUICK_REFERENCE.md` (5 min)
3. Review: This checklist (10 min)
4. **Dry-run** (optional): Execute smoke test on local branch `git checkout -b test-smoke && bash scripts/phase4-e2e-smoke.sh`

### For DevOps / Post-Deployment

1. Monitor: `.planning/SMOKE_TEST_RESULTS_May_*.json` for success
2. Archive: Copy final results to deployment documentation
3. Report: Link in incident response post-mortems if issues arise

---

## ✨ Success Metrics

**Phase 4 Deployment Success = :**

- ✅ Smoke test suite: PASS
- ✅ Production uptime: 99.9%+ (24h post-deploy)
- ✅ Error rate: <0.1% (no spike)
- ✅ User reports: Zero blockers
- ✅ Security: No breaches or permission issues

---

## 📎 Appendix: Links

- **Execution Guide:** `docs/SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md`
- **Quick Reference:** `docs/SMOKE_TESTS_PHASE4_QUICK_REFERENCE.md`
- **Performance Validation:** `.planning/PERFORMANCE_VALIDATION.md`
- **Deploy Roadmap:** `.planning/milestones/DEPLOY_ROADMAP_v1.3.md`
- **Cloud Logs Guide:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`

---

**Document Version:** 1.0  
**Created:** 2026-05-07  
**Target Deployment:** 2026-05-20  
**Status:** Ready for use
