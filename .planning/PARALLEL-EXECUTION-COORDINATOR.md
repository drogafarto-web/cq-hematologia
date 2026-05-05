---
coordination: 3-stream-parallel
phase: 2-3
start_date: 2026-05-05
streams: A, B, C
---

# Parallel Execution: Streams A, B, C Coordinator

**Objective:** Execute Batch 3 (new modules) + Phase 3.1 (platform foundation) + Batch 1/2 (hardening) simultaneously with clean dependencies and weekly sync.

---

## Stream Definitions

| Stream | Scope | Duration | Objective | Owner |
|--------|-------|----------|-----------|-------|
| **A** | Batch 3: CIQ Bio, CEQ, Validação, Liberação, Críticos | 8-10w | 5 analytical modules live | `/gsd-execute-phase 2.3` |
| **B** | Phase 3.1: Mobile (RN CLI), Analytics (hourly CF), Export (server-side) | 6-8w | Platform foundation live | `/gsd-plan-phase 3.1` then execute |
| **C** | Batch 1/2 Hardening: Performance audit + optimization + monitoring | 4-6w | Zero regressions, <800KB bundle | Custom audit agent |

---

## Dependency Graph

```
Week 1:  [C: Audit baseline]
         ├── Identify bottlenecks
         └── Create Firestore indexes

Week 2:  [A: Batch 3 Task 1 (CIQ Bio)]   [B: Phase 3.1 Design]
         ├── Schema + service         └── Mobile setup
         └── Tests                       Analytics schema
                                        Export CF skeleton

Week 3:  [A: Batch 3 Task 2 (CEQ)]      [B: Mobile auth] [C: Optimization]
         ├── Z-score logic             ├── Compile iOS/Android
         └── Auto-NC                    └── Auth flow
                                        
Week 4:  [A: Batch 3 Task 3 (Validação)] [B: Analytics CF] [C: Monitoring live]
         ├── Method validation          ├── Hourly aggregation
         └── Charts                     └── Zustand caching
                                        
Week 5:  [A: Batch 3 Task 4 (Liberação)] [B: Export CF] 
         ├── Dual-signature             ├── Job queue
         └── Approval UI                └── Cloud Storage

Week 6:  [A: Batch 3 Task 5 (Críticos)] [B: CI/CD pipeline]
         ├── Critical criteria          └── GitHub Actions
         └── Notifications
         
Week 7:  [A: Integration/smoke] [B: Final testing]
         ├── Cross-module tests
         └── Performance gates

Week 8:  [A: Deploy to prod] [B: Deploy to prod]
```

---

## Weekly Sync Checklist

Every **Friday 14:00 UTC**, update status in this file:

### Week W1 (2026-05-05 to 2026-05-11)

- [ ] **Stream C:** Bundle analysis complete. Identified issues: `xlsx` conflict, `pdf.worker` lazy-loading candidate. Firestore indexes queued.
- [ ] **Stream A:** Batch 3 Task 1 schema finalized. CIQBioService skeleton ready.
- [ ] **Stream B:** Mobile RN CLI project initialized. Firebase auth skeleton compiling on iOS/Android emulator.
- [ ] **Blockers:** None
- [ ] **Next Week:** C applies fixes, A starts implementation, B starts analytics schema

### Week W2 (2026-05-12 to 2026-05-18)

- [ ] Status: TBD

### Week W3+ 

- [ ] Status: TBD

---

## Critical Success Signals

### Stream A (Batch 3)
- ✅ Each task compiles without errors
- ✅ >80% test coverage per module
- ✅ No regressions in Batch 1/2 (detected by Stream C monitoring)
- ✅ Zero critical bugs in first 48h of deployment

### Stream B (Phase 3.1)
- ✅ Mobile app compiles (iOS emulator + Android emulator)
- ✅ Auth flow works (login → persist → relaunch → auto-login)
- ✅ Analytics CF runs hourly without timeout
- ✅ Export job queue operational
- ✅ GitHub Actions builds green

### Stream C (Hardening)
- ✅ Bundle <800 KB gzip
- ✅ LCP <2.5s on all pages
- ✅ INP <200ms on interactive operations
- ✅ Zero regressions vs baseline
- ✅ Monitoring alerts live

---

## Communication Protocol

### If Stream X Blocks Stream Y

**Example:** Stream C identifies that POPsList renders slowly, causing INP > 300ms. This blocks Stream A's Batch 3 Task 1 (which depends on CIQBioService → POPsList integration).

**Action:**
1. Stream C immediately creates issue in coordinator
2. Stream A adjusts timeline or waits for C's optimization fix
3. Friday sync escalates unresolved blockers

### If Resource Contention

If any stream needs additional agent capacity:
1. Notify in slack/coordinator
2. Friday sync reprioritizes if needed
3. Default: let streams run to completion, don't interrupt

---

## Deployment Gates (Before Prod)

### Stream A Before Deploy
```bash
✅ npm run build succeeds
✅ npm run test:unit (all tests >80% coverage)
✅ Smoke test: create CIQ Bio run → CEQ sample → Validation → approve laudo
✅ Lighthouse CI: >85 on all pages
✅ No regressions in Batch 1/2 (Stream C confirms)
✅ Cloud Functions deployed + secret rotation
✅ Firestore rules deployed + verified
```

### Stream B Before Deploy
```bash
✅ Mobile: iOS + Android emulator compile
✅ Auth: login flow tested end-to-end
✅ Analytics: hourly CF runs without timeout
✅ Export: job queue processes test data
✅ CI/CD: GitHub Actions builds green
✅ Monitoring: alerts configured for all 3 systems
```

### Stream C Continuous
```bash
✅ Monitoring live on production Batch 1/2
✅ Alerts configured for regressions
✅ Weekly reports on performance trends
```

---

## Escalation

**If critical blocker emerges:**

1. **Stream owner notifies coordinator immediately** (don't wait for Friday)
2. **Assess impact:** Does it block all downstream work?
3. **Action:**
   - If isolatable: fix locally, continue
   - If blocks another stream: pause and sync with other stream owner
   - If blocks all three: pause execution, sync with CTO

**Example escalation:** Stream B discovers Firebase auth issue that breaks Batch 3 Task 1 integration. Notify immediately, both streams sync, decide: fix or pivot.

---

## Success Definition

**All three streams complete successfully when:**

- ✅ Stream A: 5 modules (Batch 3) live in production
- ✅ Stream B: 3 platforms (Mobile, Analytics, Export) live in production  
- ✅ Stream C: Batch 1/2 optimized, monitoring operational, zero regressions
- ✅ Zero critical bugs in 72h post-deployment
- ✅ Web Vitals + performance metrics within target
- ✅ Test coverage >80% across all new code

**Estimated completion:** 2026-07-01 to 2026-07-15 (8-10 weeks)

---

**Coordinator:** GSD Executor  
**Created:** 2026-05-05  
**Last Updated:** TBD

