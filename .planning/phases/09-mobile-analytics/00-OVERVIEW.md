# Phase 09 — Mobile + Advanced Analytics

**Status:** ✅ PLANNING COMPLETE (Ready for Execution)  
**Date:** 2026-05-08  
**Timeline:** 3 weeks (aggressive, 2 parallel waves)  
**Scope:** 5 coordinated task plans

---

## Phase Goal

Transform HC Quality mobile + analytics from Phase 3.3 scaffold into production-grade, feature-complete application. Enable:
- **Mobile:** Biometric + PIN authentication, offline-first sync, secure storage
- **Analytics:** Real-time KPI dashboard (turnaround, retrabalho%, conformidade), predictive SPC with Westgard rules, benchmarking
- **Quality:** 20+ E2E automated tests, CI/CD pipeline, deploy gates

**Success Criteria:**
- Mobile app: auth working, offline sync functional, dark-first UI, WCAG AA
- Analytics: KPI aggregation, SPC anomaly detection, benchmarking comparison
- Testing: 20+ E2E flows automated, CI/CD enforces quality
- Deployment: Firebase App Distribution, GitHub Actions, deploy gates

---

## Five Plans at a Glance

| Plan | Focus | Duration | Wave | Dependencies | Context |
|------|-------|----------|------|--------------|---------|
| **09-01** | Mobile Auth (Biometric + PIN + Secure Storage) | 4 days | 1 | None | 08-01-PLAN.md |
| **09-02** | Offline Sync (AsyncStorage Queue + Auto-Sync) | 4 days | 1 | None | 09-02-PLAN.md |
| **09-03** | Analytics Engine (KPI, SPC, Benchmarking) | 3 days | 2 | (uses outputs) | 09-03-PLAN.md |
| **09-04** | Analytics Dashboard UI (Dark-First, Drill-Down) | 4 days | 2 | 09-03 | 09-04-PLAN.md |
| **09-05** | E2E Tests + CI/CD (20+ flows, Deploy Gate) | 4 days | 2 | all prior | 09-05-PLAN.md |

---

## Timeline & Waves

```
Week 1 (Days 1-7):
├─ Wave 1 (Parallel):
│  ├─ 09-01 Mobile Auth (4 days)
│  └─ 09-02 Offline Sync (4 days)
│
Week 2-3 (Days 8-21):
├─ Wave 2 (Parallel):
│  ├─ 09-03 Analytics Engine (3 days)
│  ├─ 09-04 Dashboard UI (4 days, starts after 09-03)
│  └─ 09-05 E2E Tests + CI/CD (4 days, integrates 09-01-04)
│
Deployment:
└─ Firebase App Distribution (post 09-05 green)
```

**Parallelization:**
- **Wave 1:** 09-01 + 09-02 independent; no file conflicts; 2 FTE can execute simultaneously
- **Wave 2:** 09-03 must complete before 09-04 starts (analytics engine → UI consumes it); 09-05 integrates all

**Wall-clock time:** ~3 weeks (aggressive, 2 parallel agents)

---

## Compliance Coverage

| Requirement | Plans | Details |
|------------|-------|---------|
| **RDC 978 Art. 6** | 09-01 | Patient/RT mobile access control |
| **RDC 978 Art. 22** | 09-03, 09-04 | Quality oversight + trending dashboard |
| **RDC 978 Art. 167** | 09-01 | Laudo release (auth gate) |
| **DICQ 4.14.7** | 09-03, 09-04 | KPI dashboard (quality metrics) |
| **LGPD Art. 9** | 09-01, 09-02 | Biometric data + offline sync security |

---

## Key Deliverables

### Mobile Authentication (09-01)
✅ Biometric detection (Face ID + Fingerprint)  
✅ PIN fallback (6-digit entry, 5-attempt lockout)  
✅ Secure storage (iOS Keychain + Android Credential Manager)  
✅ 8 E2E flows (biometric, PIN, lockout, logout, persistence)  
✅ Dark-first UI, WCAG AA accessible  

### Offline Sync (09-02)
✅ AsyncStorage queue for offline writes  
✅ Network status detection hook  
✅ Auto-sync on reconnect (idempotent)  
✅ OfflineIndicator UI component  
✅ 3 E2E flows (offline read, queue write, auto-sync)  

### Analytics Engine (09-03)
✅ KPI aggregation (turnaround, retrabalho%, conformidade)  
✅ Predictive SPC (Westgard rules: 2-2s, R-4s, 10x)  
✅ Control limits computation (mean ± 3σ)  
✅ Benchmarking vs regional/national  
✅ Client-side cache (30s TTL)  
✅ Cloud Function callables + type safety  

### Analytics Dashboard (09-04)
✅ Real-time KPI cards (turnaround, retrabalho%, conformidade)  
✅ SPC chart (control limits, violation highlighting)  
✅ Benchmark comparison (your lab vs regional vs national)  
✅ Drill-down navigation + date range filtering  
✅ Auto-refresh (30s) + manual refresh  
✅ Dark-first UI, responsive, WCAG AA  

### E2E Tests + CI/CD (09-05)
✅ 20+ E2E test flows (auth, offline, analytics, benchmarking, navigation)  
✅ 8 smoke tests (quick feedback)  
✅ GitHub Actions workflow (on push, pull requests)  
✅ Deploy gate script (APK size, TypeScript, E2E validation)  
✅ Firebase App Distribution integration  
✅ Performance E2E (startup <2s, no memory leaks)  
✅ Integration E2E (full workflows)  

---

## Pre-Execution Checklist

- [ ] **Dependencies:** Verify Phase 3.3 mobile scaffold exists (React Native project + Detox)
- [ ] **Android SDK:** Android emulator API 30+ or 33+ ready
- [ ] **Node:** v20 LTS installed locally + CI
- [ ] **Firebase:** hmatologia2 project accessible, southamerica-east1 region confirmed
- [ ] **Secrets:** `FIREBASE_SERVICE_ACCOUNT`, `SLACK_WEBHOOK` prepared for GitHub Actions
- [ ] **Team:** 2 FTE assigned (one per Wave 1 plan ideally)
- [ ] **Design System:** DESIGN_SYSTEM.md accessible (dark theme tokens)

---

## Risk Summary

| Risk | Level | Mitigation |
|------|-------|-----------|
| **Biometric flakiness on emulator** | 🟡 Medium | PIN fallback always available; extensive error handling |
| **APK size creep** | 🟡 Medium | Code-split routes, tree-shake, deploy gate enforces <10MB |
| **E2E test flakiness** | 🟡 Medium | Detox best practices (waitFor, no hardcoded delays); retry on timeout |
| **Offline sync race conditions** | 🟡 Medium | Idempotent write IDs; server-side deduplication |
| **SPC rule false positives** | 🟢 Low | Extensive validation; mock data verified manually |
| **Overall** | 🟢 **LOW-MEDIUM (3/10)** | All mitigations pre-planned; known patterns |

---

## Success Metrics (Go/No-Go)

### Metrics to Hit
- **Biometric auth:** Works on iOS + Android emulator
- **Offline sync:** Writes queue correctly; auto-sync succeeds
- **Analytics load:** KPI data loads in <3s
- **E2E coverage:** 20+ flows, all green
- **APK size:** ≤10MB gzipped
- **Startup time:** <2s cold launch
- **Memory:** No leak >50MB over 10 nav cycles
- **Accessibility:** WCAG AA (4.5:1 contrast, touch targets ≥48pt)

### Go/No-Go Decision
- **GO:** All metrics hit, 20+ E2E green, deploy gate passes, Firebase distribution successful
- **NO-GO:** Any metric failed, E2E <85% pass rate, APK >10MB, auth flow broken

---

## Post-Deploy Monitoring

**24-Hour Monitoring (after Firebase distribution):**
- Cloud Logs: 0 critical errors expected
- Crash Analytics: Monitor for new crash patterns
- Performance: LCP, startup times on real devices
- Auth: Biometric fallback rate, lockout triggers

**Sign-Off:**
- Mobile Lead: Offline mode verified on device
- DevOps: Deploy gate passed, Firebase upload successful
- CTO: Demo to stakeholder (auth flow, analytics dashboard, dark theme)

---

## Next Phase (Phase 10)

After Phase 09 closes:
- **iOS Distribution:** Extend to TestFlight + App Store
- **Advanced Optimization:** Runtime profiling, further startup reduction
- **Extended Offline:** Write capability offline with conflict resolution
- **Analytics Expansion:** Predictive trending, anomaly alerts

See `.planning/phases/10-*/` for Phase 10 planning (TBD).

---

## Files Overview

```
.planning/phases/09-mobile-analytics/
├── 00-OVERVIEW.md (this file — quick reference)
├── 09-01-PLAN.md (Mobile Auth)
├── 09-02-PLAN.md (Offline Sync)
├── 09-03-PLAN.md (Analytics Engine)
├── 09-04-PLAN.md (Analytics Dashboard)
├── 09-05-PLAN.md (E2E Tests + CI/CD)
└── [SUMMARY files created after execution]
    ├── 09-01-SUMMARY.md
    ├── 09-02-SUMMARY.md
    ├── 09-03-SUMMARY.md
    ├── 09-04-SUMMARY.md
    └── 09-05-SUMMARY.md
```

**How to use:**
1. **Quick overview:** Read this file (5 min)
2. **Before execution:** Read PLAN.md for your assigned task (15 min each)
3. **During execution:** Use PLAN.md as your task checklist + verification guide
4. **After execution:** Create SUMMARY.md documenting results + learnings

---

## Questions or Issues?

Phase 09 planning is **comprehensive and detailed**. All PLAN.md files are **ready for handoff to executors**.

If clarification needed during execution:
- Check task `<action>` section (most detailed)
- Review `<verify>` for automated tests
- Consult `<done>` for acceptance criteria
- Cross-reference related PLAN.md for dependencies

---

**Created:** 2026-05-08  
**Status:** 🟢 READY FOR EXECUTION  
**Target Kickoff:** Immediately after Phase 4 stabilization  
**Target Completion:** 3 weeks wall-clock (aggressive, 2 parallel agents)  
**Deployment:** Firebase App Distribution (internal testers)

---

**CTO's Note:**

Phase 09 is **ambitious but achievable**. The 5-plan structure maximizes parallelism:
- Wave 1 (09-01 + 09-02) can run in true parallel with 2 FTE for 4 days
- Wave 2 (09-03/04/05) sequences properly and overlaps where possible

The **key success factor** is staying disciplined about deployment gates: we don't ship if E2E <100%, APK >10MB, or TypeScript has errors. This discipline protects quality.

Mobile + analytics is the **user-facing soul** of HC Quality v1.4. This phase transforms the app from "works" to "delightful."

—CTO
