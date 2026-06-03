# Phase 09 — Mobile Refinement (Dark Mode + Biometric + Performance + E2E)

**Planning Complete — 2026-05-07**

---

## Overview

Phase 09 transforms HC Quality mobile from Phase 3.3 scaffold into production-ready app. Four focused plans deliver dark mode 100% coverage, biometric auth + PIN fallback, performance optimization (<10MB bundle, <2s startup), and extensive E2E testing (20+ flows) with offline support.

**Duration:** 3 weeks (aggressive)  
**Team:** 2 FTE  
**Waves:** 2 (parallel design)  
**Risk Level:** 3/10 (LOW-MEDIUM)

---

## Plans

| Plan      | Wave | Focus                             | Deliverables                                                                        | Context                        |
| --------- | ---- | --------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------ |
| **09-01** | 1    | Dark Mode Audit + Coverage        | All 26 screens dark-only, no hardcoded colors, 10+ snapshot tests                   | [09-01-PLAN.md](09-01-PLAN.md) |
| **09-02** | 1    | Biometric + PIN + Keychain        | Face ID/fingerprint, PIN fallback, secure JWT storage, lockout, 8 E2E flows         | [09-02-PLAN.md](09-02-PLAN.md) |
| **09-03** | 2    | Bundle Optimization + Performance | <10MB APK, <2s startup, <1.5s LCP, code-split routes, lazy images, metrics baseline | [09-03-PLAN.md](09-03-PLAN.md) |
| **09-04** | 2    | E2E Expansion + Offline + CI      | 20+ Detox flows, offline read-only mode, GitHub Actions CI, deploy gate             | [09-04-PLAN.md](09-04-PLAN.md) |

---

## Phase Brief

**Strategic Guide:** [09-PHASE-BRIEF.md](09-PHASE-BRIEF.md)

Comprehensive overview with:

- Phase goal and success criteria
- Performance targets (bundle, startup, LCP, memory)
- Risk assessment (likelihood, impact, mitigation)
- Effort breakdown and sequencing
- Dependencies graph

---

## Execution Sequence

```
Wave 1 (Days 1–4, parallel):
├── 09-01: Dark Mode Audit (3 days)
│   └─ Task 1: Screen audit + gap analysis
│   └─ Task 2: Component refactor + tokens
│   └─ Task 3: Visual regression tests
│
└── 09-02: Biometric + PIN (4 days)
    └─ Task 1: Enhanced useBiometricAuth + PINForm
    └─ Task 2: Keychain integration + secure storage
    └─ Task 3: AuthScreen orchestration + error handling
    └─ Task 4: 8 E2E auth flows

Wave 2 (Days 5–8, depends on Wave 1):
├── 09-03: Performance Optimization (3 days)
│   └─ Task 1: Bundle analysis + code-split
│   └─ Task 2: Performance metrics baseline
│   └─ Task 3: Image optimization + lazy load
│   └─ Task 4: Regression tests (Jest)
│
└── 09-04: E2E Expansion + Offline + CI (4 days)
    └─ Task 1: 20+ E2E flows (Detox)
    └─ Task 2: Offline mode (read-only + sync queue)
    └─ Task 3: GitHub Actions CI workflow + deploy gate
    └─ Task 4: Documentation + validation
```

**Critical Path:** Wave 1 completes Days 1–4 (2 FTE parallel), unblocks Wave 2.  
**Estimated Wall-Clock:** 7–8 days (aggressive) or 10–12 days (conservative buffers).

---

## File Structure

```
.planning/phases/09-mobile-refinement/
├── INDEX.md (this file)
├── 09-PHASE-BRIEF.md (strategic overview)
├── 09-01-PLAN.md (dark mode plan)
├── 09-02-PLAN.md (biometric auth plan)
├── 09-03-PLAN.md (performance plan)
├── 09-04-PLAN.md (E2E + offline + CI plan)
│
├── 09-01-DARK-MODE-AUDIT.md (output from 09-01, Task 1)
├── 09-03-BUNDLE-ANALYSIS.md (output from 09-03, Task 1)
├── 09-03-PERFORMANCE-BASELINE.md (output from 09-03, Task 2)
├── 09-04-E2E-SUMMARY.md (output from 09-04, Task 4)
│
└── {phase}-{plan}-SUMMARY.md (execution summaries, created during execution)
    ├── 09-01-SUMMARY.md
    ├── 09-02-SUMMARY.md
    ├── 09-03-SUMMARY.md
    └── 09-04-SUMMARY.md
```

---

## Success Metrics

| Category        | Metric              | Target                           | Owner      |
| --------------- | ------------------- | -------------------------------- | ---------- |
| **Dark Mode**   | Screen coverage     | 100% (26/26 screens)             | Plan 09-01 |
| **Dark Mode**   | Hardcoded colors    | 0 in src/screens, src/components | Plan 09-01 |
| **Dark Mode**   | Snapshot tests      | ≥10 pass rate                    | Plan 09-01 |
| **Auth**        | Biometric detection | Face ID + Fingerprint supported  | Plan 09-02 |
| **Auth**        | PIN fallback        | 6-digit entry, masked display    | Plan 09-02 |
| **Auth**        | Lockout protection  | 5 failures → 5-min lockout       | Plan 09-02 |
| **Auth**        | Secure storage      | JWT in Keychain (encrypted)      | Plan 09-02 |
| **Auth**        | E2E coverage        | 8 flows, 100% pass               | Plan 09-02 |
| **Performance** | APK size (gzip)     | <10 MB                           | Plan 09-03 |
| **Performance** | Startup time        | <2 seconds                       | Plan 09-03 |
| **Performance** | LCP                 | <1.5 seconds                     | Plan 09-03 |
| **Performance** | Memory at startup   | <200 MB                          | Plan 09-03 |
| **Performance** | Navigation latency  | <500 ms                          | Plan 09-03 |
| **Performance** | Regression tests    | 100% pass                        | Plan 09-03 |
| **E2E**         | Flow count          | 20+                              | Plan 09-04 |
| **E2E**         | Pass rate           | 100% on CI                       | Plan 09-04 |
| **E2E**         | Duration            | <10 minutes                      | Plan 09-04 |
| **Offline**     | Read-only mode      | Functional                       | Plan 09-04 |
| **Offline**     | Sync queue          | Auto-sync on reconnect           | Plan 09-04 |
| **CI**          | Workflow coverage   | All 4 deploy gate checks         | Plan 09-04 |
| **CI**          | Trigger accuracy    | Push to main → auto-run          | Plan 09-04 |

---

## Prerequisites

### By Phase Start (Wave 1 Kickoff)

- [ ] Phase 3.3 mobile codebase finalized (Detox, hooks, screens exist)
- [ ] Emulator setup: Android API 30+ configured
- [ ] CI/CD: GitHub repo access + Actions enabled
- [ ] Dependencies: `react-native-biometrics@3.0.1`, `react-native-keychain` ready for install
- [ ] Design tokens: Baseline `darkTheme.ts` structure exists (from Phase 3.3)

### User Setup (Human-Required)

**No external services requiring human setup for Phase 09.** (Dark mode, auth, performance, E2E are all local/internal.)

---

## Known Risks & Mitigations

| Risk                        | Likelihood | Impact | Mitigation                                                                 |
| --------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Dark mode incomplete        | 2/10       | 4/10   | Task 1 audit catches all 26 screens + snapshot tests                       |
| Biometric flaky on emulator | 4/10       | 3/10   | PIN always available fallback; extensive error handling                    |
| APK bloat creep             | 4/10       | 6/10   | Bundle analyzer enforced, code-split pre-vetted, CI gate blocks >10MB      |
| E2E timeout/flakiness       | 4/10       | 4/10   | Detox v20+ stable; proper waits + timeouts; emulator performance validated |
| Memory leak                 | 2/10       | 6/10   | Performance baseline tracks; regression tests catch; manual profiling      |
| Offline sync race condition | 3/10       | 5/10   | Queue persisted in AsyncStorage; idempotent syncs; server-side dedup       |
| CI infra unavailable        | 1/10       | 5/10   | GitHub Actions auto-retry 2x; manual override gate if needed               |

---

## Communication Plan

### Stakeholders

- **CTO** (decision-maker): Weekly checkpoint (Wave 1 end, Wave 2 mid, Phase end)
- **QA Lead** (verifier): Per-plan sign-off (09-01 snapshot validation, 09-04 E2E pass rate)
- **DevOps** (CI/deploy): CI workflow approval, deploy gate sign-off

### Check-In Schedule

- **Day 4 (Wave 1 end):** Both 09-01 and 09-02 complete; demo dark mode + auth screen
- **Day 8 (Wave 2 end):** Both 09-03 and 09-04 complete; run full E2E suite + deploy gate
- **Day 10 (Phase close):** All SUMMARY docs created; production readiness assessment

### Deployment Gate

- **Pre-Condition:** All 4 plans COMPLETE, all success criteria GREEN
- **Check:** `scripts/mobile-deploy-gate.sh` passes (bundle <10MB, E2E 100%, tsc clean)
- **Artifact:** app-release.apk signed + uploaded to Firebase App Distribution
- **Monitoring:** Cloud Logs 24h post-deploy

---

## Rollback Plan

If Phase 09 introduces critical regression (startup >2.5s, crash on startup, E2E >50% fail):

1. **Rollback decision:** CTO approval (within 2h of detection)
2. **Action:** Revert to Phase 3.3 commit (tag: `phase-3.3-stable`)
3. **Timeline:** 30 min to production
4. **Post-mortem:** RCA + mitigation in next iteration (Phase 10)

**Note:** Dark mode + biometric are safe to roll back independently (no schema changes). Performance + E2E are additive (no functional regressions).

---

## What's Next (Phase 10 Outlook)

After Phase 09 ships:

1. **iOS Support** — Extend mobile to App Store (same codebase, TestFlight distribution)
2. **Advanced Performance** — Profiling + optimization (startup <1.5s target)
3. **Biometric Enrollment** — Settings UI for users to enable/disable Face ID
4. **Extended Offline** — Write capability while offline (with conflict resolution)
5. **Accessibility** — WCAG AA audit + voice commands

---

## Document Ownership

| Document             | Owner           | Last Updated |
| -------------------- | --------------- | ------------ |
| INDEX.md (this file) | CTO             | 2026-05-07   |
| 09-PHASE-BRIEF.md    | CTO             | 2026-05-07   |
| 09-01-PLAN.md        | Mobile Lead     | 2026-05-07   |
| 09-02-PLAN.md        | Mobile Lead     | 2026-05-07   |
| 09-03-PLAN.md        | DevOps + Mobile | 2026-05-07   |
| 09-04-PLAN.md        | QA Lead         | 2026-05-07   |

---

**Created:** 2026-05-07  
**Status:** Phase 9 planning COMPLETE — Ready for execution kickoff (target 2026-05-27 after Phase 4 stabilization)  
**Next:** `/gsd-execute-phase 09` to begin Wave 1 (Plans 09-01 + 09-02 parallel)

---

## Quick Reference

**Start execution:** `/gsd-execute-phase 09`  
**Reference during execution:** See individual PLAN.md files (09-01 through 09-04)  
**Monitor progress:** Check `.planning/phases/09-mobile-refinement/*-SUMMARY.md` files post-execution  
**CI status:** GitHub Actions → Workflows → Mobile E2E Tests
