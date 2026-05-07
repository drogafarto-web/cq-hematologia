---
title: "Wave 2 Real-Time Monitoring Dashboard"
purpose: "Daily status tracking for Phases 4-7 parallel execution"
update_frequency: "Every 4 hours during execution"
---

# Wave 2 Monitoring Dashboard — Phases 4-7 Status Tracking

**Use this dashboard to track Phase 4-7 execution in real-time.** Updated every 4 hours during execution phases.

---

## Current Status (As of 2026-05-07 Pre-Kickoff)

### Wave 2 Overall Health

```
🟢 GREEN — READY FOR EXECUTION (2026-05-20)
└─ Planning: 100%
└─ Infrastructure: 90% (3 soft items due 2026-05-19)
└─ Team: 100% (0 PTO conflicts)
└─ Risk: LOW (3.0/10)
```

**Next Milestone:** 2026-05-13 (CTO decision window)

---

## Phase Status Checklist (During Execution)

### Phase 4: Patient Portal + NOTIVISA Integration
**Period:** 2026-05-20 → 2026-06-02  
**Status:** ⏳ AWAITING KICKOFF

```
Task Status:
├─ 04-01 (Portal auth) ⏳ READY TO START
├─ 04-02 (Portal UI) ⏳ READY TO START
├─ 04-03 (NOTIVISA queue) ⏳ READY TO START
└─ 04-04 (E2E + Cloud Logs) ⏳ READY TO START

Metrics Baseline (capture on Day 1):
├─ LCP target: <2.0s
├─ INP target: <200ms
├─ CLS target: <0.05
├─ Unit test count: 38+
├─ E2E flows: 6
└─ Cloud Logs: 0 ERROR, <5% WARNING

Status Report Template (every 4h):
├─ Shipped today: [list deliverables]
├─ Blockers: [list or "none"]
├─ At-risk items: [or "none"]
├─ Metrics (current): [LCP, INP, test count]
└─ Confidence: [RED/YELLOW/GREEN]
```

**Go/No-Go Gate:** 2026-06-02 (pre-deploy decision)

---

### Phase 5: Critical Escalation + IA Training Dataset
**Period:** 2026-06-09 → 2026-06-30  
**Status:** ⏳ AWAITING PHASE 4 PRODUCTION VERIFICATION

```
Task Status:
├─ 05-01 (Critical thresholds) ⏳ NOT YET STARTED
├─ 05-02 (Critical detection) ⏳ NOT YET STARTED
├─ 05-03 (IA strip upload) ⏳ NOT YET STARTED
└─ 05-04 (IA versioning) ⏳ NOT YET STARTED

Pre-Execution Gate:
├─ Phase 4 live + 0 critical errors (24h): [TBD]
├─ Test data loaded: [TBD]
└─ Twilio provisioned (soft): [TBD]

Metrics Baseline (capture on Day 1):
├─ SMS latency target: <2 min
├─ IA confidence target: >85%
├─ SLA query latency: <2s
├─ Unit tests: 40+
├─ E2E flows: 8
└─ Cloud Logs: 0 ERROR, <5% WARNING

Status Report Template (every 4h):
├─ Shipped today: [list]
├─ Blockers: [or "none"]
├─ Metrics: [SMS latency, IA confidence, query latency]
└─ Confidence: [RED/YELLOW/GREEN]
```

**Go/No-Go Gate:** 2026-06-30 (pre-deploy decision)

---

### Phase 6: Liberación Completion + Críticos Polish
**Period:** 2026-07-01 → 2026-07-14  
**Status:** ⏳ AWAITING PHASE 5 PRODUCTION VERIFICATION

```
Task Status:
├─ PDF generation ⏳ NOT YET STARTED
├─ Portal médico ⏳ NOT YET STARTED
├─ E2E test suite ⏳ NOT YET STARTED
└─ Lighthouse optimization ⏳ NOT YET STARTED

Pre-Execution Gate:
├─ Phase 5 live + 0 critical errors (24h): [TBD]
├─ Test data loaded: [TBD]
└─ puppeteer ready: [TBD]

Metrics Baseline (capture on Day 1):
├─ PDF generation target: <5s
├─ Lighthouse score target: >90
├─ LCP target: <2.5s
├─ Unit tests: 20+
├─ E2E flows: 8
└─ Cloud Logs: 0 ERROR, <5% WARNING

Status Report Template (every 4h):
├─ Shipped today: [list]
├─ Blockers: [or "none"]
├─ Metrics: [PDF latency, Lighthouse score]
└─ Confidence: [RED/YELLOW/GREEN]
```

**Go/No-Go Gate:** 2026-07-14 (pre-deploy decision)

---

### Phase 7: Export Wizard + Reclamações/Satisfação + Portal Paciente
**Period:** 2026-07-15 → 2026-07-28  
**Status:** ⏳ AWAITING PHASE 6 PRODUCTION VERIFICATION

```
Task Status:
├─ Export Wizard (4-step) ⏳ NOT YET STARTED
├─ XLSX export ⏳ NOT YET STARTED
├─ Portal paciente ⏳ NOT YET STARTED
└─ Trending dashboard ⏳ NOT YET STARTED

Pre-Execution Gate:
├─ Phase 6 live + 0 critical errors (24h): [TBD]
├─ Test data loaded: [TBD]
└─ Email batch infrastructure ready: [TBD]

Metrics Baseline (capture on Day 1):
├─ XLSX export target: <30s (1,000 rows)
├─ PDF batch compression: >50%
├─ Portal responsiveness: <2s (mobile)
├─ Unit tests: 35+
├─ E2E flows: 8
├─ Mobile devices tested: 3+
└─ Cloud Logs: 0 ERROR, <5% WARNING

Status Report Template (every 4h):
├─ Shipped today: [list]
├─ Blockers: [or "none"]
├─ Metrics: [XLSX latency, compression ratio, mobile latency]
└─ Confidence: [RED/YELLOW/GREEN]
```

**Go/No-Go Gate:** 2026-07-28 (pre-deploy decision)

---

## Daily Standup Template (10:00 BRT, Mon-Fri)

**Attendees:** Phase executor, Wave 2 Lead, Tech Lead (optional)  
**Duration:** 15 min  
**Format:**

```
Phase: [4/5/6/7]
Date: [YYYY-MM-DD]

Yesterday's Deliverables:
├─ Task: [specific commit/PR]
├─ Tests: [new tests, coverage impact]
├─ Blockers resolved: [or "none"]
└─ Metrics: [LCP, latency, coverage change]

Today's Priority:
├─ Task: [specific task for today]
├─ Expected completion: [EOD/EOW]
└─ Dependencies: [if any]

Blockers / At-Risk Items:
├─ [Issue]: [Description] → Mitigation
├─ [Issue]: [Description] → Mitigation
└─ Status: [GREEN/YELLOW/RED]

Confidence for Phase Completion:
└─ Current: [GREEN/YELLOW/RED] | Target: GREEN

Questions for Wave 2 Lead:
└─ [List or "none"]

Escalation Required:
└─ [Level: YELLOW/RED] | [Issue] | [Decision needed by date]
```

---

## Weekly Coordination Meeting (Fridays 15:00 BRT)

**Attendees:** Wave 2 Lead, Phase 4-7 leads, QA, DevOps, Tech Lead, CTO (optional)  
**Duration:** 45 min  
**Output:** Slack summary → #phase-4-7-updates

```
Date: [YYYY-MM-DD]

Phase 4 Status:
├─ Completion: [0-100%]
├─ Blockers: [list or "none"]
├─ At-risk: [list or "none"]
└─ Confidence: [GREEN/YELLOW/RED]

Phase 5 Status:
├─ Completion: [0-100%]
├─ Blockers: [list or "none"]
├─ At-risk: [list or "none"]
└─ Confidence: [GREEN/YELLOW/RED]

Phase 6 Status:
├─ Completion: [0-100%]
├─ Blockers: [list or "none"]
├─ At-risk: [list or "none"]
└─ Confidence: [GREEN/YELLOW/RED]

Phase 7 Status:
├─ Completion: [0-100%]
├─ Blockers: [list or "none"]
├─ At-risk: [list or "none"]
└─ Confidence: [GREEN/YELLOW/RED]

Cross-Phase Dependencies:
├─ Phase 4→5 portal UI sign-off: [ON TRACK/AT RISK]
├─ Phase 5→6 critical engine: [ON TRACK/AT RISK]
├─ Phase 6→7 PDF export: [ON TRACK/AT RISK]
└─ Infrastructure (SMTP, queue): [ON TRACK/AT RISK]

Test Data & Infrastructure:
├─ Fixtures provisioned: [Phase 4/5/6/7]
├─ Cloud Logs baseline: [established/pending]
├─ Performance metrics: [LCP/INP/CLS captured/pending]
└─ Issue: [or "none"]

Auditor Alignment (if applicable):
├─ Next meeting: [date/time]
├─ Topic: [portal/critical/CAPA/feedback]
└─ Action items: [list or "none"]

Risk Register (Top 5):
├─ [Risk 1]: [Status] [Mitigation]
├─ [Risk 2]: [Status] [Mitigation]
├─ [Risk 3]: [Status] [Mitigation]
├─ [Risk 4]: [Status] [Mitigation]
└─ [Risk 5]: [Status] [Mitigation]

Next Week Goals:
├─ Phase 4: [milestone]
├─ Phase 5: [milestone]
├─ Phase 6: [milestone]
└─ Phase 7: [milestone]

Overall Wave 2 Status:
└─ Health: [GREEN/YELLOW/RED] | Confidence for on-time delivery: [%]
```

---

## Cloud Logs Monitoring (Per-Phase 24h Post-Deploy)

### Phase 4 Cloud Logs Baseline (2026-06-02 deploy → 2026-06-03 monitor)

```
Alert Policy:
├─ ERROR count: 0 (fail if >0)
├─ CRITICAL count: 0 (fail if >0)
├─ WARNING rate: <5% (warn if 5-10%)
└─ Unknown errors: <1% (fail if >1%)

Functions to Monitor:
├─ rtPortalLogin() ← Portal auth
├─ listLaudosDraft() ← Portal laudo list
├─ fetchLaudoForReview() ← Portal detail view
├─ processNotiVisaQueue() ← NOTIVISA processor (hourly cron)
└─ [Custom logging per task]

Metrics to Track:
├─ Invocation count: [per function]
├─ Average latency: [per function]
├─ Error rate: [per function]
├─ Cold start rate: [%]
└─ Quota usage: [% of 1M invocations/month]

Dashboard Commands:
```bash
# Phase 4 Cloud Logs (24h tail)
gcloud functions logs read --limit 1000 --region southamerica-east1 \
  --project hmatologia2 \
  --filter='resource.type=cloud_function AND severity>=WARNING' \
  --format=json | jq '.[].textPayload'

# Error-only filter
gcloud functions logs read --limit 500 --region southamerica-east1 \
  --project hmatologia2 \
  --filter='resource.type=cloud_function AND severity=ERROR' \
  --format=json
```

Acceptance Criteria:
├─ 0 ERROR/CRITICAL (fail if >0)
├─ <5% WARNING rate (ok if <10%, warn above)
├─ Average latency <2s per function (fail if >5s)
└─ No quota warnings (fail if approaching limit)

Sign-Off:
└─ [ ] QA Lead approved (24h logs clean)
```

### Phase 5 Cloud Logs Baseline (2026-06-30 deploy → 2026-07-01 monitor)

Similar structure as Phase 4, with functions:
```
├─ setCriticalThreshold() ← Config
├─ escalateCriticalValue() ← Escalation trigger
├─ detectCriticalValue() ← Real-time detection
├─ sendSMSAlert() ← SMS delivery
├─ sendEmailAlert() ← Email delivery
├─ uploadIATrainingImage() ← Strip upload
└─ [Custom logging]
```

### Phase 6 Cloud Logs Baseline (2026-07-14 deploy → 2026-07-15 monitor)

```
├─ generateLaudoPDF() ← PDF generation
├─ generateQRCode() ← QR code generation
├─ portalMedicoLogin() ← Portal médico auth
└─ [Custom logging]
```

### Phase 7 Cloud Logs Baseline (2026-07-28 deploy → 2026-07-29 monitor)

```
├─ exportToXLSX() ← Excel generation
├─ exportToPDF() ← PDF batch export
├─ exportToCSV() ← CSV export
├─ scheduleExport() ← Scheduled job
├─ submitFeedback() ← Feedback submission
├─ calculateTrending() ← Trending calculations
└─ [Custom logging]
```

---

## Performance Metrics Tracking

### LCP (Largest Contentful Paint) — Target <2.0s (Phase 4) / <2.5s (Phase 5-7)

```
Phase 4 (Portal):
├─ Desktop: [baseline TBD] target <2.0s
├─ Mobile: [baseline TBD] target <2.5s
└─ Trending: [chart by day]

Phase 5 (Critical):
├─ Dashboard load: [baseline TBD] target <2.0s
├─ SLA queries: [baseline TBD] target <2.5s
└─ Trending: [chart by day]

Phase 6 (PDF):
├─ PDF generation start: [baseline TBD] target <2.0s
└─ Trending: [chart by day]

Phase 7 (Export):
├─ Export wizard load: [baseline TBD] target <2.0s
├─ Mobile portal: [baseline TBD] target <2.5s
└─ Trending: [chart by day]

Regression Trigger:
└─ If LCP >2.5s (Phase 4) or >3.0s (Phase 5-7): Investigate + fix before deploy
```

### INP (Interaction to Next Paint) — Target <200ms

```
All Phases:
├─ Click-to-response: [baseline TBD] target <200ms
├─ Form submission: [baseline TBD] target <300ms
└─ Trending: [chart by day]

Regression Trigger:
└─ If INP >300ms: Optimize before deploy
```

### CLS (Cumulative Layout Shift) — Target <0.05 (strict) / <0.1 (acceptable)

```
All Phases:
├─ Portal layout stability: [baseline TBD] target <0.05
├─ Modal/dialog stability: [baseline TBD] target <0.05
└─ Trending: [chart by day]

Regression Trigger:
└─ If CLS >0.1: Block deploy until fixed
```

---

## Test Coverage Tracking

### Unit Tests (vitest)

```
Phase 4:
├─ Target: 38+ tests
├─ Current: [0 pre-kickoff]
├─ Coverage: [target 85%+]
└─ Trending: [pass/fail count per day]

Phase 5:
├─ Target: 40+ tests
├─ Coverage: [target 85%+]

Phase 6:
├─ Target: 20+ tests
├─ Coverage: [target 80%+]

Phase 7:
├─ Target: 35+ tests
├─ Coverage: [target 80%+]

Overall: 133+ tests target (all phases)

Regression Trigger:
└─ If coverage drops >5% or tests fail >2: Block deploy
```

### E2E Tests (Detox / Playwright)

```
Phase 4:
├─ Flows: [list 6 critical flows]
├─ Pass rate: [% of runs]
└─ Flakiness: [% of failed runs due to flakiness]

Phase 5:
├─ Flows: [list 8 critical flows]
├─ Pass rate: [% of runs]

Phase 6:
├─ Flows: [list 8 critical flows]
├─ Pass rate: [% of runs]

Phase 7:
├─ Flows: [list 8 critical flows]
├─ Pass rate: [% of runs]
├─ Mobile responsiveness: [tested on 3+ devices]

Regression Trigger:
└─ If any flow passes <95% on 3 runs: Investigate + fix before deploy
```

---

## Escalation Path & SLA

### Status Levels

```
🟢 GREEN — On track, no action needed
   └─ Definition: 0 blockers, on-schedule, metrics on-target
   └─ Update frequency: Daily standup

🟡 YELLOW — At-risk, 3+ day buffer to remediation
   └─ Definition: 1+ blockers, slipping, metrics drift
   └─ Action: Escalate to Wave 2 Lead same day
   └─ Update frequency: Daily standup + daily async update

🔴 RED — Blocking, <3 day buffer to remediation
   └─ Definition: 2+ blockers, major slip, metrics critical
   └─ Action: Escalate to Tech Lead + CTO <2h
   └─ Update frequency: Every 2h standup

⚫ CRITICAL — Deploy abort, immediate action
   └─ Definition: Unmitigatable regression, security breach, compliance gap
   └─ Action: Escalate to CTO + Phone call + Emergency meeting
   └─ Update frequency: Every 1h or real-time
```

### Escalation Matrix

| Status | Escalation Path | SLA | Owner |
|--------|-----------------|-----|-------|
| 🟢 GREEN | Daily standup | EOD update | Phase executor |
| 🟡 YELLOW | Wave 2 Lead → Slack + standup | Same day escalation | Phase lead |
| 🔴 RED | Tech Lead → Wave 2 Lead → CTO | <2h escalation | Tech Lead |
| ⚫ CRITICAL | CTO phone + emergency meeting | Immediate | CTO |

### Escalation Checklist (When Escalating)

```
Status: [YELLOW/RED/CRITICAL]
Phase: [4/5/6/7]
Issue: [Brief description]
Impact: [What's blocked?]
Mitigation: [What's the fix?]
ETA to resolution: [Days/hours]
Decision needed: [From whom?]
Deadline: [When?]

Escalated by: [Name]
Escalated to: [Name]
Timestamp: [YYYY-MM-DD HH:MM UTC]
```

---

## Handoff Checklist (Wave 2 → Wave 3)

Due 2026-07-28:

```
Deployment Verification:
├─ [ ] Phase 4 live (2026-06-02) + 48h stable
├─ [ ] Phase 5 live (2026-06-30) + 48h stable
├─ [ ] Phase 6 live (2026-07-14) + 48h stable
├─ [ ] Phase 7 live (2026-07-28) + 48h stable

Test Results:
├─ [ ] Unit tests: 133+ passing
├─ [ ] E2E flows: 30 passing
├─ [ ] Cloud Logs: 24h per phase clean (0 ERROR/CRITICAL)
├─ [ ] Performance: All metrics on-target

Compliance Verification:
├─ [ ] RDC 978 coverage: 100%
├─ [ ] DICQ coverage: 88%+
├─ [ ] LGPD compliance: Verified
├─ [ ] Audit trail: Complete

Documentation:
├─ [ ] Phase 4-7 runbooks created
├─ [ ] Known issues documented
├─ [ ] Performance baselines captured
├─ [ ] Lessons learned documented

Auditor Alignment:
├─ [ ] Phase 8 CAPA closure F-01→F-04 complete
├─ [ ] Auditor ceremony results captured
├─ [ ] F-05→F-07 status tracked (Phase 8)

Infrastructure:
├─ [ ] All secrets provisioned + rotated
├─ [ ] Cloud quotas confirmed sufficient
├─ [ ] Monitoring alerts tuned
├─ [ ] On-call rotations documented

Sign-Off:
├─ [ ] CTO approval (overall Wave 2)
├─ [ ] Tech Lead approval (architecture)
├─ [ ] QA Lead approval (testing)
├─ [ ] DevOps Lead approval (infrastructure)
```

---

## Key Contacts & Channels

### Slack Channels

- `#phase-4-7-updates` — Daily standup summaries
- `#wave-2-coordination` — Weekly coordination notes
- `#auditor-alignment` — Weekly auditor pre-alignment talking points
- `#cloud-logs-monitoring` — 24h post-deploy monitoring alerts

### Daily Standup (10:00 BRT, Mon-Fri)

- **Participants:** Phase executor, Wave 2 Lead, Tech Lead (optional)
- **Duration:** 15 min
- **Post to:** #phase-4-7-updates (Slack thread)

### Weekly Coordination (Fridays 15:00 BRT)

- **Participants:** All phase leads, QA, DevOps, Tech Lead, CTO (optional)
- **Duration:** 45 min
- **Post to:** #wave-2-coordination (Slack summary)

### Auditor Pre-Alignment (Mondays 10:00 BRT)

- **Participants:** CTO, RT Lead, External Auditor
- **Duration:** 45 min
- **Post to:** #auditor-alignment (Slack notes)

---

## Sample Weekly Summary (Template)

**Date:** 2026-05-31 (End of Week 1 Phase 4)

```
PHASE 4 STATUS — Week 1 Complete

Shipped:
├─ 04-01: Email-link auth callable + validation tests (18/20 unit tests passing)
├─ 04-02: Portal navbar + laudo card components (responsive on iPhone + iPad)
├─ 04-03: NOTIVISA queue scaffold + trigger rules (mock data processing verified)
└─ 04-04: E2E test framework + 2/6 critical flows drafted

Metrics (Baseline Captured):
├─ Portal LCP: 1.8s (desktop), 2.2s (mobile) → TARGET ✅
├─ Portal INP: 180ms (click latency) → TARGET ✅
├─ Portal CLS: 0.03 (layout shift) → TARGET ✅
├─ Unit test count: 12 (on pace for 38+ by Week 2.5)
├─ Code coverage: 82% (on target)
└─ Cloud Logs: 0 errors, 2 warnings (both expected)

Blockers:
├─ SMTP credentials delayed (provisioning on 2026-05-31) → MITIGATION: Test fallback with Resend
└─ Status: YELLOW → Expected to resolve EOD 2026-05-31

At-Risk Items:
├─ Portal mobile layout on Android 6.0 (9s load time) → Investigate Tuesday
├─ NOTIVISA API payload format validation (sandbox docs unclear) → Clarify with gov contact
└─ Status: YELLOW → Both expected to resolve by EOW

Dependencies:
├─ Phase 5 blocked until Phase 4 portal UI sign-off: ON TRACK (UI review Fri)
└─ Phase 4→5 handoff: GO for Phase 5 kickoff 2026-06-09

Confidence:
└─ Phase 4 on-time delivery (2026-06-02): 95% (GREEN)

Next Week Goals:
├─ Week 2: Complete all unit tests (38+), final E2E flows (6), responsive polish
├─ Deploy readiness: TBD (depends on Week 2 testing)
└─ Go/No-Go decision: 2026-06-02 EOD

Wave 2 Overall Status:
├─ Phase 4: ON TRACK 95%
├─ Phase 5: READY FOR KICKOFF (2026-06-09)
├─ Phase 6: READY (dependent on Phase 5)
├─ Phase 7: READY (dependent on Phase 6)
└─ Health: 🟢 GREEN | On-time delivery: 95%
```

---

**Dashboard Last Updated:** 2026-05-07 (pre-kickoff template)  
**Next Update:** 2026-05-21 (Phase 4 execution Day 1)  
**Update Frequency (During Execution):** Every 4 hours + daily standup + weekly coordination

---

This dashboard is your real-time command center for Wave 2. Keep it updated, escalate early (YELLOW), respond fast (RED), and you'll maintain momentum.
