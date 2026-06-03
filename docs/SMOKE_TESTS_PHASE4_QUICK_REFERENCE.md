# Phase 4 E2E Smoke Test — Quick Reference Card

**Print this card and post at desk on May 20, 2026**

---

## 🚀 Quick Start (5 minutes to begin)

```bash
# macOS / Linux
bash scripts/phase4-e2e-smoke.sh

# Windows PowerShell
.\scripts\phase4-e2e-smoke.ps1
```

**Time required:** ~45 minutes  
**Exit code:** `0` = PASS ✅ · `1` = FAIL ❌

---

## ✅ Go / No-Go Criteria

### 🟢 PASS (Ready to Deploy)

- [x] All 8 checklist items green ✅
- [x] Total tests: all passed
- [x] Exit code: 0
- [x] No red errors in console

**Action:** Proceed with deploy (Step 1: Rules → Step 2: Functions → Step 3: Hosting)

### 🔴 FAIL (Do Not Deploy)

- [ ] Any section shows ❌ FAIL
- [ ] Exit code: 1
- [ ] Bundle size exceeds 365 KB
- [ ] E2E tests fail
- [ ] Lighthouse average <87/100

**Action:** STOP. Review error. Fix. Re-run smoke test. DO NOT DEPLOY.

---

## 🔧 Troubleshooting (Quick Fixes)

| Problem                    | Quick Fix                                                                     |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Port 5173 in use**       | `lsof -i :5173 \| awk '{print $2}' \| xargs kill -9`                          |
| **Port 8080 in use**       | `lsof -i :8080 \| awk '{print $2}' \| xargs kill -9`                          |
| **Java not found**         | `brew install openjdk@11` (macOS) or `apt-get install openjdk-11-jdk` (Linux) |
| **Firebase CLI not found** | `npm install -g firebase-tools`                                               |
| **TypeScript errors**      | `npm run typecheck` to review; fix errors; re-run smoke test                  |
| **Build fails**            | Check `/tmp/build.log`; likely missing dependency in `package.json`           |
| **Lighthouse unavailable** | `npm install -g @lhci/cli`                                                    |

---

## 📊 Expected Results

### Prerequisites (Step 1)

```
✅ Node.js v22+
✅ npm 10+
✅ Firebase CLI
✅ Java 11+
```

### Build (Steps 2-3)

```
✅ TypeScript: 0 errors (web)
✅ TypeScript: 0 errors (functions)
✅ Build: 362 KB (target: ≤365 KB)
✅ Total JS: 1200 KB (target: ≤2.0 MB)
```

### Tests & Audit (Steps 4-7)

```
✅ Emulator: started
✅ E2E Tests: 22/22 passed
✅ Lighthouse: 91/100 (target: ≥87)
✅ Security: Rules enforced
```

### Summary (Step 8)

```
Total Tests: 8
Passed: 8 ✅
Failed: 0 ❌
Status: PASS ✅
```

---

## 📝 Result Files

After execution, check:

1. **Text report** (human-readable):

   ```bash
   cat .planning/SMOKE_TEST_RESULTS_May_*.txt
   ```

2. **JSON export** (machine-readable for CI):
   ```bash
   cat .planning/SMOKE_TEST_RESULTS_May_*.json | jq .
   ```

---

## ⚡ Performance Targets (v1.3 Baseline)

| Metric               | v1.3 Baseline | Phase 4 Target | Hard Limit     |
| -------------------- | ------------- | -------------- | -------------- |
| **Bundle (main)**    | 362 KB        | ≤365 KB        | 380 KB         |
| **Lighthouse avg**   | 91/100        | ≥87/100        | <82/100 = FAIL |
| **LCP (Web Vitals)** | 1.9s          | <2.5s          | —              |
| **INP (Web Vitals)** | 110ms         | <200ms         | —              |
| **CLS (Web Vitals)** | 0.04          | <0.1           | —              |

---

## 🚨 Critical Blockers (Deploy Stoppers)

| Blocker                        | Severity    | Action                             |
| ------------------------------ | ----------- | ---------------------------------- |
| TypeScript errors              | 🔴 CRITICAL | Fix + re-run                       |
| Build fails                    | 🔴 CRITICAL | Fix + re-run                       |
| Bundle >380 KB                 | 🔴 CRITICAL | Investigate new deps + refactor    |
| E2E tests fail                 | 🔴 CRITICAL | Debug + fix + re-run               |
| Lighthouse <82 avg             | 🔴 CRITICAL | Profile + optimize + re-run        |
| Unauthenticated access allowed | 🔴 CRITICAL | Review firestore.rules immediately |

---

## 📞 If Stuck

1. **Check logs:**

   ```bash
   cat /tmp/build.log        # Build errors
   cat /tmp/e2e-tests.log    # Test failures
   cat /tmp/preview.log      # Lighthouse errors
   ```

2. **Manual investigation:**

   ```bash
   # TypeScript
   npm run typecheck

   # E2E tests (interactive)
   firebase emulators:start --only firestore,functions &
   npm run dev &
   npm run test:e2e -- --run

   # Lighthouse
   npm run preview &
   npx lighthouse http://localhost:4173/hub
   ```

3. **Escalate to CTO if:**
   - Unsure about error
   - Blocker prevents deployment
   - Need decision on non-blocking warning

---

## 🎯 Deployment Sequence (if PASS)

1. **09:30 UTC** — Deploy Rules (Step 1)
2. **09:35 UTC** — Deploy Functions (Step 2)
3. **09:45 UTC** — Deploy Hosting (Step 3)
4. **09:50 UTC** — Health check
5. **10:00 UTC** — Go-live

---

## 🔐 Security Checklist

- [ ] Firestore rules enforce multi-tenant (labId isolation)
- [ ] Unauthenticated reads denied (HTTP 401/403)
- [ ] Signed requests validated (chainHash present)
- [ ] No secrets in bundle
- [ ] Cloud Functions protected (auth required)

---

## 📅 When to Run

| Scenario                    | When                              |
| --------------------------- | --------------------------------- |
| **Pre-deployment (ALWAYS)** | Day of deploy (May 20, 08:30 UTC) |
| **After code merge**        | If major changes since last run   |
| **Bundle optimization**     | After upgrading dependencies      |
| **Regression suspected**    | If reports of slowness in prod    |

---

## 📋 Sign-Off Template

**Copy this to PR comment after PASS:**

```
## Phase 4 Smoke Test Results ✅

Executed: [DATE] [TIME] UTC
Status: PASS ✅

Checklist:
- [x] Prerequisites verified
- [x] TypeScript clean (web + functions)
- [x] Build successful (362 KB, <365 KB target)
- [x] Emulator + test data seeded
- [x] E2E tests: 22/22 passed
- [x] Lighthouse: 91/100 avg (≥87 target)
- [x] Security rules enforced
- [x] Exit code: 0

Ready for May 20 deployment.

Results: `.planning/SMOKE_TEST_RESULTS_May_*.{txt,json}`
```

---

## 🗂️ File Locations

```
.planning/
├── SMOKE_TEST_RESULTS_May_*.txt    ← Text report (human-readable)
├── SMOKE_TEST_RESULTS_May_*.json   ← JSON export (CI-ready)
└── PERFORMANCE_VALIDATION.md       ← Detailed metric guide

scripts/
├── phase4-e2e-smoke.sh             ← Main script (Bash/Linux/macOS)
├── phase4-e2e-smoke.ps1            ← PowerShell version (Windows)
└── phase4-validation.sh            ← Performance validation (7 metrics)

docs/
├── SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md    ← Full guide (this folder)
└── SMOKE_TESTS_PHASE4_QUICK_REFERENCE.md    ← This card
```

---

**Last Updated:** 2026-05-07  
**For:** May 20, 2026 Phase 4 Deployment  
**Status:** Ready
