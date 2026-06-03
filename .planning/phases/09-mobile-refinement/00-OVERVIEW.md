# Phase 09 Planning Complete

**Timestamp:** 2026-05-07 | **Status:** ✅ APPROVED FOR EXECUTION

---

## What Was Planned

**Phase 09 — Mobile Refinement (Dark Mode + Biometric + Performance + E2E)**

Transformation of HC Quality mobile from Phase 3.3 scaffold into production-grade app.

---

## Four Plans (2 Waves)

### Wave 1 (Parallel, Days 1–4)

| Plan      | Owner       | Scope                                    | Key Output                                                                       |
| --------- | ----------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| **09-01** | Mobile Lead | Dark mode 100% coverage (26 screens)     | All screens use dark theme tokens, no hardcoded colors, 10+ snapshot tests       |
| **09-02** | Mobile Lead | Biometric auth + PIN fallback + Keychain | Face ID/fingerprint detection, 6-digit PIN form, secure JWT storage, 8 E2E flows |

### Wave 2 (Parallel, Days 5–8, depends on Wave 1)

| Plan      | Owner           | Scope                             | Key Output                                                                    |
| --------- | --------------- | --------------------------------- | ----------------------------------------------------------------------------- |
| **09-03** | DevOps + Mobile | Bundle optimization + performance | APK <10MB, startup <2s, LCP <1.5s, code-split routes, performance baseline    |
| **09-04** | QA Lead         | E2E expansion + offline + CI      | 20+ Detox flows, offline read-only mode, GitHub Actions workflow, deploy gate |

---

## Planning Documents

```
.planning/phases/09-mobile-refinement/
├── 00-OVERVIEW.md (this file — 1-page quick reference)
├── INDEX.md (comprehensive phase guide — read first for full context)
├── 09-PHASE-BRIEF.md (strategic overview with goals, risks, metrics)
├── 09-01-PLAN.md (dark mode plan — 3 tasks)
├── 09-02-PLAN.md (biometric auth plan — 4 tasks)
├── 09-03-PLAN.md (performance plan — 4 tasks)
└── 09-04-PLAN.md (E2E + offline + CI plan — 4 tasks)
```

**How to use these:**

1. **START HERE:** Read this file (00-OVERVIEW.md) — 2 min
2. **THEN READ:** INDEX.md — full phase guide — 10 min
3. **BEFORE EXECUTING:** Read the specific PLAN.md for your wave — 15 min each
4. **EXECUTE:** Use individual PLAN.md as your task list and verification guide

---

## Success Criteria (One-Line Each)

| Plan  | Criterion                                                                             | Status     |
| ----- | ------------------------------------------------------------------------------------- | ---------- |
| 09-01 | All 26 screens dark-only; 0 hardcoded colors; 10+ snapshot tests passing              | ✅ Defined |
| 09-02 | Biometric + PIN working; 5-min lockout active; JWT in Keychain; 8 E2E flows pass      | ✅ Defined |
| 09-03 | APK ≤10MB (gzip); startup <2s; LCP <1.5s; memory <200MB; perf tests green             | ✅ Defined |
| 09-04 | 20+ E2E flows automated; offline read-only mode functional; CI gate active; 100% pass | ✅ Defined |

---

## Timeline & Effort

| Phase                  | Duration     | Team           | Wall-Clock   | Context Cost |
| ---------------------- | ------------ | -------------- | ------------ | ------------ |
| Planning (now)         | Complete     | CTO            | 2h           | 15%          |
| Wave 1 (09-01 + 09-02) | 4 days       | 2 FTE parallel | Days 1–4     | ~45%         |
| Wave 2 (09-03 + 09-04) | 4 days       | 2 FTE parallel | Days 5–8     | ~50%         |
| **Total**              | **7–8 days** | **2 FTE**      | **~2 weeks** | **~110%**    |

**Context cost note:** Plans are sized for parallel execution (2 FTE working simultaneously on different concerns). Total ~110% reflects Wave 1 (45%) + Wave 2 (50%) + buffer (15%).

---

## Risk Summary

| Risk                            | Level                    | Mitigation                                              |
| ------------------------------- | ------------------------ | ------------------------------------------------------- |
| Dark mode incomplete coverage   | 🟡 2/10                  | Audit all 26 screens + snapshot tests catch regressions |
| Biometric flakiness on emulator | 🟡 4/10                  | PIN fallback always available; extensive error handling |
| Bundle bloat                    | 🟡 4/10                  | Code-split pre-analyzed; CI gate enforces <10MB         |
| E2E timeouts                    | 🟡 4/10                  | Detox v20+ stable; emulator performance validated       |
| Memory leak                     | 🟢 2/10                  | Performance baseline + regression tests catch early     |
| Offline sync race               | 🟡 3/10                  | AsyncStorage queue + idempotent server-side syncs       |
| **Overall Risk**                | **🟢 3/10 (LOW-MEDIUM)** | All mitigations pre-planned and documented              |

---

## Kickoff Prerequisites

Before starting Wave 1:

- [ ] Phase 3.3 mobile codebase finalized
- [ ] Android emulator API 30+ ready
- [ ] Team aligned on success criteria
- [ ] `react-native-biometrics` and `react-native-keychain` in package.json

**No external service setup needed for Phase 09.**

---

## Deliverables Checklist

After execution completes, these files will exist:

### Artifacts (Created During Execution)

- [ ] `09-01-DARK-MODE-AUDIT.md` — All 26 screens documented, gaps resolved
- [ ] `09-03-BUNDLE-ANALYSIS.md` — Bundle breakdown, code-split savings
- [ ] `09-03-PERFORMANCE-BASELINE.md` — Startup, LCP, memory metrics
- [ ] `09-04-E2E-SUMMARY.md` — All 20+ flows documented, pass rate reported

### SUMMARY Files (One Per Plan)

- [ ] `09-01-SUMMARY.md` — Dark mode completion, tokens, test coverage
- [ ] `09-02-SUMMARY.md` — Auth flow diagram, lockout mechanics, security sign-off
- [ ] `09-03-SUMMARY.md` — Bundle results, optimization recommendations
- [ ] `09-04-SUMMARY.md` — E2E inventory, offline behavior, CI status

---

## After Execution: Post-Deploy Monitoring

Phase 09 ships to Firebase App Distribution (internal testing).

**24-Hour Monitoring:**

- Cloud Logs: 0 errors expected
- E2E suite: Run once more in staging
- Crash analytics: Monitor for new crash patterns
- Performance: Track LCP, startup on real devices

**Sign-Off:**

- QA Lead: Offline mode verified on device
- DevOps: Deploy gate passed all checks
- CTO: Demo to stakeholder (auth flow, dark theme)

---

## Next Phase (Phase 10 Preview)

After Phase 09 closes:

- **iOS Distribution** — Extend to TestFlight + App Store
- **Advanced Optimization** — Runtime profiling, further startup reduction
- **Extended Offline** — Write capability offline with conflict resolution

See `.planning/phases/10-*/` for Phase 10 planning (TBD).

---

## Quick Links

| Doc                                    | Purpose                                           |
| -------------------------------------- | ------------------------------------------------- |
| [INDEX.md](INDEX.md)                   | Complete phase guide (read this for full context) |
| [09-PHASE-BRIEF.md](09-PHASE-BRIEF.md) | Strategic overview + detailed breakdown           |
| [09-01-PLAN.md](09-01-PLAN.md)         | Dark mode (3 tasks, 3 days)                       |
| [09-02-PLAN.md](09-02-PLAN.md)         | Biometric auth (4 tasks, 4 days)                  |
| [09-03-PLAN.md](09-03-PLAN.md)         | Performance (4 tasks, 3 days)                     |
| [09-04-PLAN.md](09-04-PLAN.md)         | E2E + offline + CI (4 tasks, 4 days)              |

---

## Questions?

**Planning phase complete.** All four PLAN.md files are ready for execution.

**To begin execution:**

```bash
/gsd-execute-phase 09
```

This will load Wave 1 (Plans 09-01 and 09-02) and prepare Claude executors.

---

**Created:** 2026-05-07  
**Phase Status:** 🟢 READY FOR EXECUTION  
**Target Kickoff:** 2026-05-27 (after Phase 4 stabilization)  
**Target Completion:** 2026-06-07

---

**CTO's Note:**

Phase 09 is aggressive but achievable. Two critical success factors:

1. **Wave 1 parallel execution:** Dark mode (09-01) and biometric auth (09-02) are **completely independent**. Run them in parallel with 2 FTE (one per plan) to compress Days 1–4 to actual concurrent work, not sequential.

2. **CI gate discipline:** The deploy gate (09-04 Task 3) must not be bypassed. If E2E fails or bundle exceeds 10MB, we don't ship. This enforces quality.

The roadmap target is Phase 4–5 for portal/NOTIVISA, but mobile polish (Phase 09) ensures end-users have a world-class experience on day 1. Worth the compression.

—CTO
