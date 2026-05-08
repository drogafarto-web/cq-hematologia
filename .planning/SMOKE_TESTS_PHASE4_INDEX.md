# Phase 4 Smoke Test Suite — Documentation Index

**Quick Navigation for May 20, 2026 Deployment**

---

## 🚀 I Want To...

### ...Run the Smoke Test (First Time)

1. **Read:** [`docs/SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md`](../docs/SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md) (20 min)
   - Complete step-by-step walkthrough
   - Troubleshooting guide
   - Pass/fail criteria

2. **Execute:**
   ```bash
   bash scripts/phase4-e2e-smoke.sh        # macOS/Linux
   .\scripts\phase4-e2e-smoke.ps1          # Windows PowerShell
   ```

3. **Review Results:**
   ```bash
   cat .planning/SMOKE_TEST_RESULTS_May_*.txt
   cat .planning/SMOKE_TEST_RESULTS_May_*.json | jq .
   ```

### ...Run the Smoke Test (Quick Reference)

→ Print & use: [`docs/SMOKE_TESTS_PHASE4_QUICK_REFERENCE.md`](../docs/SMOKE_TESTS_PHASE4_QUICK_REFERENCE.md)

- One-page summary
- Expected results
- Quick fixes table
- Go/No-Go criteria

### ...Prepare for May 20 Deployment

→ Follow: [`docs/SMOKE_TESTS_PHASE4_PRE_DEPLOYMENT_CHECKLIST.md`](../docs/SMOKE_TESTS_PHASE4_PRE_DEPLOYMENT_CHECKLIST.md)

- Pre-smoke test checklist (2026-05-19)
- Smoke test execution (2026-05-20 08:30 UTC)
- Deployment sign-offs + health checks

### ...Understand the Full Suite

→ Read: [`PHASE4_SMOKE_TEST_SUITE_SUMMARY.md`](PHASE4_SMOKE_TEST_SUITE_SUMMARY.md)

- What was created
- 8-stage pipeline overview
- Benefits vs manual tests
- Success metrics

### ...Fix a Problem

→ See: [`docs/SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md`](../docs/SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md#troubleshooting)

Covers:
- Port conflicts
- Java not found
- Build failures
- E2E test timeouts
- Lighthouse issues
- Security rule failures

---

## 📋 Documentation Files

### Execution (Run the Tests)

| File | Purpose | Audience | Read Time |
|---|---|---|---|
| [`SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md`](../docs/SMOKE_TESTS_PHASE4_EXECUTION_GUIDE.md) | Complete step-by-step guide + troubleshooting | QA / DevOps (first-time) | 20 min |
| [`SMOKE_TESTS_PHASE4_QUICK_REFERENCE.md`](../docs/SMOKE_TESTS_PHASE4_QUICK_REFERENCE.md) | One-page quick ref (print & post) | QA / DevOps (deployment day) | 5 min |

### Planning & Checklists (Prepare & Verify)

| File | Purpose | Audience | Read Time |
|---|---|---|---|
| [`SMOKE_TESTS_PHASE4_PRE_DEPLOYMENT_CHECKLIST.md`](../docs/SMOKE_TESTS_PHASE4_PRE_DEPLOYMENT_CHECKLIST.md) | Pre/post deployment checklists + sign-offs | DevOps / CTO | 15 min |
| [`PHASE4_SMOKE_TEST_SUITE_SUMMARY.md`](PHASE4_SMOKE_TEST_SUITE_SUMMARY.md) | What was created + overview | Engineering Lead | 10 min |

### Scripts (The Automation)

| File | Language | Purpose | Platform |
|---|---|---|---|
| [`scripts/phase4-e2e-smoke.sh`](../scripts/phase4-e2e-smoke.sh) | Bash | Main automation script | macOS / Linux |
| [`scripts/phase4-e2e-smoke.ps1`](../scripts/phase4-e2e-smoke.ps1) | PowerShell | Windows automation | Windows |

### Reference

| File | Purpose |
|---|---|
| `.planning/PERFORMANCE_VALIDATION.md` | 7 performance metrics (bundle, Lighthouse, Web Vitals, latencies) |
| `docs/CLOUD_LOGS_MONITORING_GUIDE.md` | Post-deploy 24h monitoring setup |
| `.planning/SMOKE_TESTS_PHASE4_INDEX.md` | This file (navigation index) |

---

## 🎯 Quick Facts

**What:** Phase 4 E2E smoke test suite for May 20 deployment  
**When:** 2026-05-20 08:30 UTC (45 minutes)  
**Who:** QA / DevOps (execution) + CTO (sign-off)  
**Where:** Run locally before deployment (not in production)

**What it validates:**
- Prerequisites (Node.js, npm, Firebase CLI, Java)
- TypeScript clean (web + functions)
- Production build successful
- Bundle size <365 KB
- Firebase emulator + test data
- 22 E2E tests passing
- Lighthouse avg ≥87/100
- Security rules enforced

**Exit code:**
- `0` = PASS ✅ (ready to deploy)
- `1` = FAIL ❌ (blockers found)

---

## 📅 Timeline for May 20

| Time (UTC) | Task | Docs |
|---|---|---|
| 08:00 | Final pre-flight | Checklist: Step 1 |
| 08:30 | **Run smoke test** | Execution Guide |
| 09:15 | Review results + sign-off | Quick Ref + Checklist |
| 09:30 | Deploy Step 1 (Rules) | Checklist: Step 2 |
| 09:35 | Deploy Step 2 (Functions) | Checklist: Step 2 |
| 09:45 | Deploy Step 3 (Hosting) | Checklist: Step 2 |
| 10:00 | Go-live confirmation | Checklist: Step 3 |

---

## 🆘 Need Help?

### Common Questions

**Q: Where do I run the smoke test?**  
A: Locally (your machine), NOT in production. Requires Node.js + npm + Firebase CLI + Java.

**Q: How long does it take?**  
A: ~45 minutes start to finish. Longest steps: E2E tests (10 min) + Lighthouse (10 min).

**Q: What if it fails?**  
A: See troubleshooting in Execution Guide. Most common fixes: kill processes on ports, install missing tools, fix TypeScript errors.

**Q: Can I run it multiple times?**  
A: Yes. Each run generates new `.planning/SMOKE_TEST_RESULTS_May_*.txt` and `.json` files (timestamped).

**Q: Do I need to merge Phase 4 code first?**  
A: Yes. Smoke test runs on `main` branch after Phase 4 is merged.

### Escalation

- **Script issues:** Review logs in `/tmp/` (build.log, e2e-tests.log, preview.log)
- **Blocker (can't deploy):** Contact CTO immediately
- **Question:** Check this index + Execution Guide

---

## ✨ Success Looks Like

```
═══════════════════════════════════════════════════════════
PHASE 4 E2E SMOKE TEST RESULTS
═══════════════════════════════════════════════════════════
Total Tests:      8
Passed:           8 ✅
Failed:           0 ❌
Warnings:         0 ⚠️

STATUS: ✅ PASS — Ready for May 20 deployment
═══════════════════════════════════════════════════════════
```

---

## 📚 Additional Resources

- **Performance Metrics:** `.planning/PERFORMANCE_VALIDATION.md` (7 validators)
- **Post-Deploy Monitoring:** `docs/CLOUD_LOGS_MONITORING_GUIDE.md`
- **v1.3 Manual Tests (for UAT):** `docs/SMOKE_TESTS_v1.3.md`
- **Phase 4 Overview:** `.planning/STATE.md`

---

**Last Updated:** 2026-05-07  
**For Deployment:** 2026-05-20  
**Status:** ✅ Ready
