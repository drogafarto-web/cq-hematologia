# Phase 5 Execution Monitoring Guide

**Status:** Phase 5 is executing asynchronously in background (sleep-safe mode).  
**Last Update:** 2026-05-08  
**Orchestrator:** gsd-execute-phase (4 subagents, 2 waves)

---

## Quick Status Checks

### 1. Current Phase Status

```bash
cd "C:\hc quality"
cat .planning/STATE.md | grep -A1 "Phase 5"
```

**Expected Output:**

```
| **Phase 5** | 🔄 EXECUTING | 2026-05-15 (est.) | Critical escalation + IA training ...
```

---

### 2. Wave Progress

```bash
cd "C:\hc quality"
cat .planning/PHASE_5_EXECUTION_MANIFEST.json | jq '.execution.waves[] | {wave_id, plans, status: .agents[].status}'
```

**Expected Evolution:**

- **Wave 1 (05-01, 05-03):** `executing` → `complete` (3–4 days)
- **Wave 2 (05-02, 05-04):** `pending (wave 1)` → `executing` → `complete` (3–4 days)

---

### 3. Per-Plan Summaries (As They Complete)

```bash
cd "C:\hc quality"
ls -lah .planning/phases/05-criticos-ia-strip/*-SUMMARY.md 2>/dev/null || echo "Summaries will appear here as agents complete"
```

**Files to Watch:**

- `05-01-SUMMARY.md` — Threshold config completion
- `05-02-SUMMARY.md` — Detection + SLA completion
- `05-03-SUMMARY.md` — IA upload + Gemini completion
- `05-04-SUMMARY.md` — Dataset aggregation completion

---

### 4. Git Commits (Real-Time)

```bash
cd "C:\hc quality"
git log --oneline --since="2026-05-08" | head -20
```

**Expected Commits:**

```
feat(criticos): 05-01 threshold config + UI (Agent 1)
feat(criticos): 05-02 detection engine + SMS (Agent 2)
feat(ciq-imuno): 05-03 strip upload + Gemini (Agent 3)
feat(ciq-imuno): 05-04 accuracy dashboard + dataset (Agent 4)
```

Each commit is atomic per plan + SUMMARY.md.

---

### 5. TypeScript & Lint Validation

```bash
cd "C:\hc quality"
npm run build 2>&1 | grep -E "(error|warning)" || echo "Build clean"
npm run lint:web 2>&1 | grep "error" || echo "No lint errors"
npm run typecheck 2>&1 | tail -5
```

**Target:**

- 0 errors
- ≤88 warnings (baseline from Phase 4)

---

### 6. Unit Test Coverage

```bash
cd "C:\hc quality"
npm run test:unit -- --coverage 2>&1 | tail -20
```

**Target per Task:**

- ≥80% coverage (functions, statements)
- 0 failed tests

---

### 7. E2E Test Validation (Wave 2 completion)

```bash
cd "C:\hc quality"
npm run test:e2e 2>&1 | grep -E "(PASS|FAIL|critical)" || echo "E2E not yet started"
```

**Target:**

- 10+ specs passing
- Critical paths (threshold config, SMS delivery, IA classification)

---

### 8. Cloud Logs (Post-Deploy)

Once Phase 5 is merged and deployed:

```bash
cd "C:\hc quality"
bash scripts/monitor-cloud-logs.ps1 24 30  # Windows users: .ps1 file
```

**Red Flags:**

- `ERROR criticos` → detection engine failure
- `ERROR classifyStripGemini` → Gemini Vision API issues
- `WARN escalacaoCriticos` → SMS delivery delays
- `Quota exceeded` → API rate limit hit

---

## Timeline Expectations

| When          | What                         | Check                                     |
| ------------- | ---------------------------- | ----------------------------------------- |
| 2026-05-08    | Wave 1 starts (05-01, 05-03) | git log, no summaries yet                 |
| 2026-05-09–10 | Wave 1 completes             | 05-01-SUMMARY.md, 05-03-SUMMARY.md appear |
| 2026-05-10    | Wave 2 starts (05-02, 05-04) | State update, agent logs                  |
| 2026-05-11–12 | Wave 2 completes             | 05-02-SUMMARY.md, 05-04-SUMMARY.md appear |
| 2026-05-12–13 | E2E testing + verification   | npm run test:e2e passes                   |
| 2026-05-14    | Code review + final sign-off | STATE.md → Phase 5: ✅ COMPLETE           |
| 2026-05-15    | Ready to merge + deploy      | Phase 6 kickoff ready                     |

---

## Detailed Monitoring (Per Wave)

### Wave 1 Execution (05-01 + 05-03)

**Agent 1 (05-01 — Threshold Config):**

```bash
# Watch for files being created
watch -n 5 "ls -la src/features/criticos/ 2>/dev/null | tail -5"

# Expected files:
# - src/features/criticos/types/threshold.ts
# - src/features/criticos/services/thresholdService.ts
# - src/features/criticos/components/ThresholdConfigPanel.tsx
# - src/features/criticos/hooks/useDetectCritico.ts
# - src/features/criticos/__tests__/thresholdService.test.ts
```

**Agent 3 (05-03 — IA Upload):**

```bash
watch -n 5 "ls -la src/features/ciq-imuno/strip-classifier/ 2>/dev/null | tail -5"

# Expected files:
# - src/features/ciq-imuno/strip-classifier/StripUploadComponent.tsx
# - src/features/ciq-imuno/strip-classifier/ImunoIADashboard.tsx
# - src/features/ciq-imuno/strip-classifier/types.ts
```

### Wave 2 Execution (05-02 + 05-04)

**Agent 2 (05-02 — Detection + SLA):**

```bash
watch -n 5 "ls -la functions/src/modules/criticos/ 2>/dev/null | tail -5"

# Expected files:
# - functions/src/modules/criticos/escalacaoCriticos.ts
# - functions/src/modules/criticos/escalarCriticoViaSmS.ts
# - functions/src/modules/criticos/escalacao-sla-monitor.ts
```

**Agent 4 (05-04 — Dataset):**

```bash
watch -n 5 "ls -la functions/src/modules/ciqImuno/ 2>/dev/null | tail -5"

# Expected files:
# - functions/src/modules/ciqImuno/collectIADataset.ts
# - functions/src/modules/ciqImuno/accuracyCalculator.ts
```

---

## Troubleshooting

### Issue: No commits appearing after 2 days

**Check 1: Agent logs**

```bash
cd "C:\hc quality"
find .planning -name "*EXECUTION*" -o -name "*execute*" 2>/dev/null | xargs ls -lah
```

**Check 2: TypeScript errors (compile blocker)**

```bash
npm run typecheck 2>&1 | grep "error TS" | head -5
```

**Check 3: Dependency issues**

```bash
npm list --all 2>&1 | grep "UNMET"
```

**Fix: Re-trigger agent for specific plan**

```bash
# (Manual) Run a single plan directly
# (Or) Re-invoke gsd-execute-phase with --wave filter
```

---

### Issue: Phase 5 Completion Blocked on Compliance

**Recheck Compliance Checklist:**

```bash
cat docs/COMPLIANCE_CHECKLIST_v1.4.md | grep -A10 "Phase 5"
```

**Key Gating Requirements:**

- RDC 978 Arts. 17, 128, 167 covered
- DICQ 5.8.7 critical values validation
- Audit trail 100% (zero untracked escalations)
- SMS delivery >99% SLA met

---

### Issue: Gemini Vision API Quota Hit

**Check API usage:**

```bash
# (In Firebase Console)
Cloud APIs → Vertex AI Vision API → Quotas & Usage
```

**Mitigation:**

1. Check `.planning/RISK_ASSESSMENT_v1.4.md` → Gemini quota mitigation
2. Reduce test batch size or switch to confidence threshold 0.95 (stricter filtering)
3. Open ticket with Google Cloud support (Quota increase)

---

## Verification Checklist (Pre-Merge)

Once all 4 summaries appear, verify:

```bash
# 1. Type safety
npm run typecheck 2>&1 | grep "error" && echo "FAIL: TS errors" || echo "PASS: TS clean"

# 2. Linting
npm run lint:web 2>&1 | grep "error" && echo "FAIL: Lint errors" || echo "PASS: Lint baseline OK"

# 3. Unit tests
npm run test:unit 2>&1 | grep "failed" && echo "FAIL: Test failures" || echo "PASS: Tests pass"

# 4. Build
npm run build 2>&1 | grep "error" && echo "FAIL: Build error" || echo "PASS: Build OK"

# 5. Firestore rules validation
npm run rules:test 2>&1 | grep "failed" && echo "FAIL: Rules test failure" || echo "PASS: Rules OK"
```

**Gate:** All ✅ PASS before merging to main.

---

## Post-Completion Handoff

Once Phase 5 SUMMARY.md is created:

1. **Merge to main** (atomic, one commit per plan)
2. **Deploy rules** (if updated)
3. **Deploy functions** (escalacaoCriticos, ciqImuno)
4. **Deploy hosting** (React app + PWA)
5. **24h Cloud Logs monitoring** (post-deploy)
6. **Phase 6 kickoff** (2026-05-22)

---

## Contact & Escalation

**If Phase 5 is stuck >1 week:**

1. Check `.planning/PHASE_5_EXECUTION_MANIFEST.json` for agent task IDs
2. Review agent error logs in `.claude/logs/` (if available)
3. Check git history for failed commits
4. Re-run `/gsd-execute-phase phase:5 --wave 1` to restart from Wave 1

**CTO Decision Point:** If major blockers emerge (Gemini API quota exhausted, RDC 978 compliance gap), escalate to:

- Run `/gsd-debug` for diagnostics
- Run `/gsd-spike` for risk mitigation spike
- Adjust Phase 5 scope or timeline via `.planning/STATE.md` update

---

**Document:** `.planning/PHASE_5_MONITORING_GUIDE.md`  
**Version:** 1.0  
**Generated:** 2026-05-08
