---
document: E2E Test Execution Schedule for v1.4
version: 1.0
created: 2026-05-07
updated: 2026-05-07
status: active
coordinator: Testing Orchestrator
---

# E2E Test Execution Schedule for v1.4 (Phases 4–15)

**Purpose:** Detailed weekly execution calendar with no conflicts, parallel streams, and deployment gates.

**Success Criterion:** 0 test conflicts with dev/deploy windows; all 96 E2E PASS before phase boundaries.

---

## Calendar Overview (22 weeks, 2026-05-07 → 2026-08-31)

```
May 2026:
  Week 1 (05-07 to 05-13)   — Phase 0–3 close ✅
  Week 2 (05-14 to 05-20)   — Phase 4 dev starts; E2E prep
  Week 3 (05-20 to 05-27)   — Phase 4 E2E run (May 24–27)
  Week 4 (05-27 to 06-02)   — Phase 5 E2E run (May 29–Jun 02)

June 2026:
  Week 5 (06-02 to 06-09)   — Phase 6 E2E run (Jun 03–09)
  Week 6 (06-09 to 06-16)   — Phase 7 E2E run (Jun 10–16)
  Week 7 (06-16 to 06-23)   — Phase 8 dev + Phase 9 dev; E2E prep
  Week 8 (06-23 to 06-30)   — Phase 8 E2E run (Jun 24–30)
  Week 9 (06-30 to 07-07)   — Phase 9 E2E run (Jun 30–Jul 07)

July 2026:
  Week 10 (07-07 to 07-14)  — Phase 10 dev; Phase 11 dev; E2E prep
  Week 11 (07-14 to 07-21)  — Phase 10 E2E run (Jul 14–21)
  Week 12 (07-21 to 07-28)  — Phase 11 E2E run (Jul 21–28)
  Week 13 (07-28 to 08-04)  — Phase 12 dev + Phase 13 prep; E2E prep
  Week 14 (08-04 to 08-11)  — Phase 12 E2E run (Aug 04–10)

August 2026:
  Week 15 (08-11 to 08-18)  — Phase 13 audit + Phase 14 dev; E2E prep
  Week 16 (08-18 to 08-25)  — Phase 13 E2E run (Aug 11–20); Phase 14 E2E run (Aug 21–25)
  Week 17 (08-25 to 09-01)  — Phase 15 LAUNCH + post-deploy (Aug 26–31)
```

---

## Detailed Weekly Execution Blocks (No Conflicts)

### Week 1–2: Phase 0–3 Close + Wave 2 Prep (2026-05-07 → 2026-05-20)

| Date                    | Activity                                   | Owner      | Duration | Status |
| ----------------------- | ------------------------------------------ | ---------- | -------- | ------ |
| 2026-05-07              | Phase 0–3 complete; v1.3 stabilization ✅  | DevOps     | 1 day    | ✅     |
| 2026-05-08 → 2026-05-19 | Phase 4–5 development (CAPA + Portal)      | Eng-W2-A/B | 12 days  | 🔄     |
| 2026-05-13              | E2E test fixtures prepared (10 test users) | QA-Lead    | 1 day    | 📋     |
| 2026-05-17              | Firestore indexes deployed for Phase 4–5   | DevOps     | 1 day    | 📋     |
| 2026-05-19              | Phase 4 code freeze (dev stops, E2E prep)  | Eng-W2-A   | 1 day    | 📋     |

---

### Phase 4 Execution Window (2026-05-20 → 2026-05-27)

#### Pre-E2E Gate (2026-05-20 → 2026-05-23)

| Date             | Checkpoint                            | Owner   | Pass Criterion             |
| ---------------- | ------------------------------------- | ------- | -------------------------- |
| 2026-05-20 (Mon) | Phase 4 code complete; staging deploy | DevOps  | 0 TypeScript errors        |
| 2026-05-21 (Tue) | `hcq-deploy-gates` pre-merge check    | SecOps  | All gates PASS ✓           |
| 2026-05-22 (Wed) | Manual smoke test (CAPA flow only)    | QA-Lead | Flow navigable, no crashes |
| 2026-05-23 (Thu) | Firestore rules audit for Phase 4     | SecOps  | 0 security regressions     |

#### E2E Execution Window (2026-05-24 → 2026-05-27)

| Time                           | Scenario                         | Duration | Owner    | Status |
| ------------------------------ | -------------------------------- | -------- | -------- | ------ |
| **Fri 05-24** (start 10am UTC) | P4-S1 (CAPA Creation)            | 8m       | Eng-W2-A | ⏳     |
| **Fri 05-24** (after S1)       | P4-S2 (CAPA Plan Review)         | 7m       | Eng-W2-A | ⏳     |
| **Fri 05-24** (after S2)       | P4-S3 (CAPA Execution Log)       | 9m       | Eng-W2-A | ⏳     |
| **Fri 05-24** (after S3)       | P4-S4 (CAPA Effectiveness Check) | 8m       | Eng-W2-A | ⏳     |
| **Sat 05-25** (start 10am UTC) | P4-S5 (Auditor Sign-Off)         | 8m       | Eng-W2-A | ⏳     |
| **Sat 05-25** (after S5)       | P4-S6 (CAPA Metrics Report)      | 6m       | Eng-W2-A | ⏳     |
| **Sat 05-25** (after S6)       | P4-S7 (CAPA Rollback)            | 8m       | QA-W2    | ⏳     |
| **Sat 05-25** (after S7)       | P4-S8 (CAPA Data Integrity)      | 5m       | SecOps   | ⏳     |
| **Total Phase 4 E2E**          | —                                | ~59m     | —        | —      |
| **Sun 05-26**                  | Analysis + fix flakies           | Eng-W2-A | 1 day    | ⏳     |
| **Mon 05-27**                  | Re-run failed scenarios (if any) | Eng-W2-A | <30m     | ⏳     |

#### Post-E2E Gate (2026-05-27)

| Checkpoint                          | Owner   | Pass Criterion                  |
| ----------------------------------- | ------- | ------------------------------- |
| All 8 E2E PASS                      | QA-Lead | P4-S1 through P4-S8 ✅          |
| 0 flaky tests flagged               | QA-Lead | Re-run successful               |
| Cloud Logs review (Phase 4 deploy)  | DevOps  | 0 P0 errors in logs             |
| HTML report generated               | QA-Lead | Report link in Slack            |
| Slack notification posted           | DevOps  | "@wave-2-team: Phase 4 PASS ✅" |
| **Phase 4 approved for production** | CTO     | Go/No-Go decision               |

---

### Phase 5 Execution Window (2026-05-29 → 2026-06-02)

#### Pre-E2E Gate (2026-05-28 → 2026-05-29)

| Date             | Checkpoint                            | Owner  | Pass Criterion      |
| ---------------- | ------------------------------------- | ------ | ------------------- |
| 2026-05-28 (Wed) | Phase 5 code complete; staging deploy | DevOps | 0 TypeScript errors |
| 2026-05-29 (Thu) | hcq-deploy-gates check                | SecOps | All gates PASS ✓    |

#### E2E Execution Window (2026-05-29 → 2026-06-02)

**Note:** Phase 5 runs in parallel with Phase 4 post-analysis (no conflict).

| Time                           | Scenario                            | Duration | Owner     | Status |
| ------------------------------ | ----------------------------------- | -------- | --------- | ------ |
| **Thu 05-29** (start 2pm UTC)  | P5-S1 (Patient Portal Registration) | 10m      | Eng-W2-B  | ⏳     |
| **Thu 05-29** (after S1)       | P5-S2 (Laudo Download)              | 8m       | Eng-W2-B  | ⏳     |
| **Fri 05-30** (start 10am UTC) | P5-S3 (Portal Branding)             | 7m       | Eng-W2-B  | ⏳     |
| **Fri 05-30** (after S3)       | P5-S4 (Laudo Sharing Link)          | 8m       | Eng-W2-B  | ⏳     |
| **Fri 05-30** (after S4)       | P5-S5 (Portal Access Control)       | 6m       | Eng-W2-B  | ⏳     |
| **Sat 05-31** (start 10am UTC) | P5-S6 (Laudo Search & Filter)       | 9m       | Eng-W2-B  | ⏳     |
| **Sat 05-31** (after S6)       | P5-S7 (Mobile Responsive Portal)    | 12m      | QA-Mobile | ⏳     |
| **Sun 06-01** (start 10am UTC) | P5-S8 (Portal Audit Trail)          | 5m       | SecOps    | ⏳     |
| **Total Phase 5 E2E**          | —                                   | ~65m     | —         | —      |
| **Sun 06-01**                  | Analysis + fix flakies              | Eng-W2-B | 1 day     | ⏳     |
| **Mon 06-02**                  | Re-run (if any)                     | Eng-W2-B | <30m      | ⏳     |

#### Post-E2E Gate (2026-06-02)

| Checkpoint           | Owner   | Pass Criterion         |
| -------------------- | ------- | ---------------------- |
| All 8 E2E PASS       | QA-Lead | P5-S1 through P5-S8 ✅ |
| 0 flaky tests        | QA-Lead | Re-run successful      |
| Cloud Logs clean     | DevOps  | 0 P0 errors            |
| **Phase 5 approved** | CTO     | Go/No-Go               |

---

### Phase 6 Execution Window (2026-06-03 → 2026-06-09)

#### Pre-E2E Gate (2026-06-02 → 2026-06-03)

| Date             | Checkpoint                            | Owner  | Pass Criterion      |
| ---------------- | ------------------------------------- | ------ | ------------------- |
| 2026-06-02 (Mon) | Phase 6 code complete; staging deploy | DevOps | 0 TypeScript errors |
| 2026-06-03 (Tue) | hcq-deploy-gates check                | SecOps | All gates PASS ✓    |

#### E2E Execution Window (2026-06-03 → 2026-06-09)

**Dependency:** Phase 5 PASS (portal exists for escalation links)

| Time                           | Scenario                            | Duration | Owner    | Status |
| ------------------------------ | ----------------------------------- | -------- | -------- | ------ |
| **Tue 06-03** (start 10am UTC) | P6-S1 (Critical Value SMS Alert)    | 10m      | Eng-W2-C | ⏳     |
| **Tue 06-03** (after S1)       | P6-S2 (Critical Value Email to RT)  | 9m       | Eng-W2-C | ⏳     |
| **Tue 06-03** (after S2)       | P6-S3 (Escalation SLA Tracking)     | 8m       | Eng-W2-C | ⏳     |
| **Wed 06-04** (start 10am UTC) | P6-S4 (Multiple Escalation Levels)  | 12m      | Eng-W2-C | ⏳     |
| **Wed 06-04** (after S4)       | P6-S5 (Escalation Dashboard)        | 7m       | Eng-W2-C | ⏳     |
| **Thu 06-05** (start 10am UTC) | P6-S6 (Critical Value Deescalation) | 8m       | Eng-W2-C | ⏳     |
| **Thu 06-05** (after S6)       | P6-S7 (SMS Template Customization)  | 6m       | Eng-W2-C | ⏳     |
| **Fri 06-06** (start 10am UTC) | P6-S8 (Escalation Audit Trail)      | 5m       | SecOps   | ⏳     |
| **Total Phase 6 E2E**          | —                                   | ~65m     | —        | —      |
| **Fri 06-06**                  | Analysis + fix flakies              | Eng-W2-C | 1 day    | ⏳     |
| **Mon 06-09**                  | Re-run (if any)                     | Eng-W2-C | <30m     | ⏳     |

#### Post-E2E Gate (2026-06-09)

| Checkpoint           | Owner   | Pass Criterion         |
| -------------------- | ------- | ---------------------- |
| All 8 E2E PASS       | QA-Lead | P6-S1 through P6-S8 ✅ |
| 0 flaky tests        | QA-Lead | Re-run successful      |
| Cloud Logs clean     | DevOps  | 0 P0 errors            |
| **Phase 6 approved** | CTO     | Go/No-Go               |

---

### Phase 7 Execution Window (2026-06-10 → 2026-06-16)

#### Pre-E2E Gate (2026-06-09 → 2026-06-10)

| Date             | Checkpoint                            | Owner  | Pass Criterion      |
| ---------------- | ------------------------------------- | ------ | ------------------- |
| 2026-06-09 (Tue) | Phase 7 code complete; staging deploy | DevOps | 0 TypeScript errors |
| 2026-06-10 (Wed) | hcq-deploy-gates check                | SecOps | All gates PASS ✓    |

#### E2E Execution Window (2026-06-10 → 2026-06-16)

**Dependency:** Phase 5 PASS (portal + laudo required)

| Time                           | Scenario                         | Duration | Owner    | Status |
| ------------------------------ | -------------------------------- | -------- | -------- | ------ |
| **Wed 06-10** (start 10am UTC) | P7-S1 (NPS Survey on Portal)     | 8m       | Eng-W2-D | ⏳     |
| **Wed 06-10** (after S1)       | P7-S2 (Feedback Form Submission) | 7m       | Eng-W2-D | ⏳     |
| **Thu 06-11** (start 10am UTC) | P7-S3 (Feedback Dashboard)       | 8m       | Eng-W2-D | ⏳     |
| **Thu 06-11** (after S3)       | P7-S4 (Feedback-to-NC Workflow)  | 9m       | Eng-W2-D | ⏳     |
| **Fri 06-12** (start 10am UTC) | P7-S5 (NPS Trend Report)         | 7m       | Eng-W2-D | ⏳     |
| **Fri 06-12** (after S5)       | P7-S6 (Feedback Anonymity)       | 6m       | Eng-W2-D | ⏳     |
| **Sat 06-13** (start 10am UTC) | P7-S7 (Satisfaction Survey Link) | 8m       | Eng-W2-D | ⏳     |
| **Sun 06-14** (start 10am UTC) | P7-S8 (Feedback Data Integrity)  | 5m       | SecOps   | ⏳     |
| **Total Phase 7 E2E**          | —                                | ~58m     | —        | —      |
| **Sun 06-14**                  | Analysis + fix flakies           | Eng-W2-D | 1 day    | ⏳     |
| **Mon 06-16**                  | Re-run (if any)                  | Eng-W2-D | <30m     | ⏳     |

#### Post-E2E Gate (2026-06-16)

| Checkpoint                       | Owner    | Pass Criterion                                   |
| -------------------------------- | -------- | ------------------------------------------------ |
| **ALL 32 WAVE 2 E2E PASS**       | QA-Lead  | P4-S[1-8] + P5-S[1-8] + P6-S[1-8] + P7-S[1-8] ✅ |
| 0 flaky tests across wave        | QA-Lead  | Re-runs all successful                           |
| Cloud Logs clean (Wave 2 deploy) | DevOps   | 0 P0 errors                                      |
| **Wave 2 approved for Phase 8**  | CTO      | Go/No-Go decision                                |
| **Phase 8 (NOTIVISA) unblocked** | Eng-W3-A | Can start dev                                    |

---

### Wave 3 Pre-Execution Window (2026-06-16 → 2026-06-23)

#### Setup for Phases 8–9 (2026-06-16 → 2026-06-23)

| Date       | Activity                                       | Owner       | Deliverable                 |
| ---------- | ---------------------------------------------- | ----------- | --------------------------- |
| 2026-06-16 | Phase 8–9 development starts                   | Eng-W3-A/B  | Code merge approved         |
| 2026-06-17 | NOTIVISA sandbox credentials from ANVISA (gov) | Procurement | Creds loaded in `.env.test` |
| 2026-06-18 | 50+ CIQ test records seeded (Firestore)        | QA-Lead     | Fixtures ready              |
| 2026-06-20 | Firestore indexes deployed for Phase 8–9       | DevOps      | Indexes built               |
| 2026-06-22 | Phase 8 code freeze                            | Eng-W3-A    | Code complete, E2E prep     |
| 2026-06-23 | Phase 9 code freeze                            | Eng-W3-B    | Code complete, E2E prep     |

---

### Phase 8 Execution Window (2026-06-24 → 2026-06-30)

#### Pre-E2E Gate (2026-06-23 → 2026-06-24)

| Date             | Checkpoint                                  | Owner  | Pass Criterion                      |
| ---------------- | ------------------------------------------- | ------ | ----------------------------------- |
| 2026-06-23 (Wed) | Phase 8 code complete; staging deploy       | DevOps | 0 TypeScript errors                 |
| 2026-06-24 (Thu) | hcq-deploy-gates check + NOTIVISA mock test | SecOps | All gates PASS ✓, mock API responds |

#### E2E Execution Window (2026-06-24 → 2026-06-30)

**Note:** Uses NOTIVISA mock API (gov sandbox may be unavailable).

| Time                           | Scenario                            | Duration | Owner    | Status |
| ------------------------------ | ----------------------------------- | -------- | -------- | ------ |
| **Thu 06-24** (start 10am UTC) | P8-S1 (NOTIVISA Payload Formatting) | 8m       | Eng-W3-A | ⏳     |
| **Thu 06-24** (after S1)       | P8-S2 (NOTIVISA Queue Creation)     | 6m       | Eng-W3-A | ⏳     |
| **Fri 06-25** (start 10am UTC) | P8-S3 (NOTIVISA Delivery Mock)      | 9m       | Eng-W3-A | ⏳     |
| **Fri 06-25** (after S3)       | P8-S4 (NOTIVISA Retry on Failure)   | 10m      | Eng-W3-A | ⏳     |
| **Fri 06-25** (after S4)       | P8-S5 (NOTIVISA Rollback)           | 7m       | Eng-W3-A | ⏳     |
| **Sat 06-26** (start 10am UTC) | P8-S6 (NOTIVISA Compliance Report)  | 8m       | Eng-W3-A | ⏳     |
| **Sat 06-26** (after S6)       | P8-S7 (NOTIVISA Schema Evolution)   | 6m       | Eng-W3-A | ⏳     |
| **Sun 06-27** (start 10am UTC) | P8-S8 (NOTIVISA Audit Trail)        | 5m       | SecOps   | ⏳     |
| **Total Phase 8 E2E**          | —                                   | ~59m     | —        | —      |
| **Sun 06-27**                  | Analysis + fix flakies              | Eng-W3-A | 1 day    | ⏳     |
| **Mon 06-30**                  | Re-run (if any)                     | Eng-W3-A | <30m     | ⏳     |

#### Post-E2E Gate (2026-06-30)

| Checkpoint           | Owner   | Pass Criterion         |
| -------------------- | ------- | ---------------------- |
| All 8 E2E PASS       | QA-Lead | P8-S1 through P8-S8 ✅ |
| 0 flaky tests        | QA-Lead | Re-run successful      |
| Cloud Logs clean     | DevOps  | 0 P0 errors            |
| **Phase 8 approved** | CTO     | Go/No-Go               |

---

### Phase 9 Execution Window (2026-06-30 → 2026-07-07)

#### Pre-E2E Gate (2026-06-29 → 2026-06-30)

| Date             | Checkpoint                            | Owner  | Pass Criterion      |
| ---------------- | ------------------------------------- | ------ | ------------------- |
| 2026-06-29 (Fri) | Phase 9 code complete; staging deploy | DevOps | 0 TypeScript errors |
| 2026-06-30 (Sat) | hcq-deploy-gates check                | SecOps | All gates PASS ✓    |

#### E2E Execution Window (2026-06-30 → 2026-07-07)

**Dependency:** Phase 8 PASS (NOTIVISA framework ready); 80 doc fixtures imported

**Note:** Runs in parallel with Phase 8 post-analysis (no conflict).

| Time                           | Scenario                                  | Duration | Owner    | Status |
| ------------------------------ | ----------------------------------------- | -------- | -------- | ------ |
| **Sat 06-30** (start 2pm UTC)  | P9-S1 (Import List Master)                | 12m      | Eng-W3-B | ⏳     |
| **Sun 07-01** (start 10am UTC) | P9-S2 (Document Versioning Workflow)      | 10m      | Eng-W3-B | ⏳     |
| **Sun 07-01** (after S2)       | P9-S3 (Document Distribution List)        | 8m       | Eng-W3-B | ⏳     |
| **Mon 07-02** (start 10am UTC) | P9-S4 (Document Obsolescence)             | 9m       | Eng-W3-B | ⏳     |
| **Mon 07-02** (after S4)       | P9-S5 (Distribution Proof PDF)            | 7m       | Eng-W3-B | ⏳     |
| **Tue 07-03** (start 10am UTC) | P9-S6 (List Master Hierarchy Rendering)   | 8m       | Eng-W3-B | ⏳     |
| **Tue 07-03** (after S6)       | P9-S7 (Document Access Audit)             | 6m       | Eng-W3-B | ⏳     |
| **Wed 07-04** (start 10am UTC) | P9-S8 (Document Immutability Enforcement) | 5m       | SecOps   | ⏳     |
| **Total Phase 9 E2E**          | —                                         | ~65m     | —        | —      |
| **Thu 07-04**                  | Analysis + fix flakies                    | Eng-W3-B | 1 day    | ⏳     |
| **Mon 07-07**                  | Re-run (if any)                           | Eng-W3-B | <30m     | ⏳     |

#### Post-E2E Gate (2026-07-07)

| Checkpoint           | Owner   | Pass Criterion         |
| -------------------- | ------- | ---------------------- |
| All 8 E2E PASS       | QA-Lead | P9-S1 through P9-S8 ✅ |
| 0 flaky tests        | QA-Lead | Re-run successful      |
| Cloud Logs clean     | DevOps  | 0 P0 errors            |
| **Phase 9 approved** | CTO     | Go/No-Go               |

---

### Phase 10 Execution Window (2026-07-14 → 2026-07-21)

#### Pre-E2E Gate (2026-07-13 → 2026-07-14)

| Date             | Checkpoint                             | Owner  | Pass Criterion      |
| ---------------- | -------------------------------------- | ------ | ------------------- |
| 2026-07-13 (Mon) | Phase 10 code complete; staging deploy | DevOps | 0 TypeScript errors |
| 2026-07-14 (Tue) | hcq-deploy-gates check                 | SecOps | All gates PASS ✓    |

#### E2E Execution Window (2026-07-14 → 2026-07-21)

**Dependency:** Phase 8 PASS (NOTIVISA ready), Phase 9 PASS (doc framework ready)

| Time                           | Scenario                                   | Duration | Owner    | Status |
| ------------------------------ | ------------------------------------------ | -------- | -------- | ------ |
| **Tue 07-14** (start 10am UTC) | P10-S1 (Equipment Registry with Analytes)  | 9m       | Eng-W3-C | ⏳     |
| **Tue 07-14** (after S1)       | P10-S2 (CIQ Result by Equipment)           | 8m       | Eng-W3-C | ⏳     |
| **Wed 07-15** (start 10am UTC) | P10-S3 (Equipment-Specific QC Rules)       | 9m       | Eng-W3-C | ⏳     |
| **Wed 07-15** (after S3)       | P10-S4 (Equipment Performance Comparison)  | 8m       | Eng-W3-C | ⏳     |
| **Thu 07-16** (start 10am UTC) | P10-S5 (Cross-Equipment Analyte Averaging) | 8m       | Eng-W3-C | ⏳     |
| **Thu 07-16** (after S5)       | P10-S6 (Equipment Maintenance Alert)       | 7m       | Eng-W3-C | ⏳     |
| **Fri 07-17** (start 10am UTC) | P10-S7 (Analyte Expansion)                 | 7m       | Eng-W3-C | ⏳     |
| **Sat 07-18** (start 10am UTC) | P10-S8 (Equipment Data Integrity)          | 5m       | SecOps   | ⏳     |
| **Total Phase 10 E2E**         | —                                          | ~61m     | —        | —      |
| **Sat 07-18**                  | Analysis + fix flakies                     | Eng-W3-C | 1 day    | ⏳     |
| **Mon 07-21**                  | Re-run (if any)                            | Eng-W3-C | <30m     | ⏳     |

#### Post-E2E Gate (2026-07-21)

| Checkpoint            | Owner   | Pass Criterion           |
| --------------------- | ------- | ------------------------ |
| All 8 E2E PASS        | QA-Lead | P10-S1 through P10-S8 ✅ |
| 0 flaky tests         | QA-Lead | Re-run successful        |
| Cloud Logs clean      | DevOps  | 0 P0 errors              |
| **Phase 10 approved** | CTO     | Go/No-Go                 |

---

### Phase 11 Execution Window (2026-07-21 → 2026-07-28)

#### Pre-E2E Gate (2026-07-20 → 2026-07-21)

| Date             | Checkpoint                             | Owner  | Pass Criterion      |
| ---------------- | -------------------------------------- | ------ | ------------------- |
| 2026-07-20 (Mon) | Phase 11 code complete; staging deploy | DevOps | 0 TypeScript errors |
| 2026-07-21 (Tue) | hcq-deploy-gates check                 | SecOps | All gates PASS ✓    |

#### E2E Execution Window (2026-07-21 → 2026-07-28)

**Dependency:** Phase 10 PASS; Gemini Vision mock integration ready; 20+ test strip images prepared

**Note:** Runs in parallel with Phase 10 post-analysis (no conflict).

| Time                           | Scenario                                 | Duration | Owner    | Status |
| ------------------------------ | ---------------------------------------- | -------- | -------- | ------ |
| **Tue 07-21** (start 2pm UTC)  | P11-S1 (Strip Image Upload)              | 8m       | Eng-W3-D | ⏳     |
| **Wed 07-22** (start 10am UTC) | P11-S2 (Gemini Vision Mock)              | 7m       | Eng-W3-D | ⏳     |
| **Wed 07-22** (after S2)       | P11-S3 (IA Dataset Aggregation)          | 8m       | Eng-W3-D | ⏳     |
| **Thu 07-23** (start 10am UTC) | P11-S4 (Strip Classification Confidence) | 7m       | Eng-W3-D | ⏳     |
| **Thu 07-23** (after S4)       | P11-S5 (Human Verification UI)           | 8m       | Eng-W3-D | ⏳     |
| **Fri 07-24** (start 10am UTC) | P11-S6 (IA Training Dataset Export)      | 9m       | Eng-W3-D | ⏳     |
| **Fri 07-24** (after S6)       | P11-S7 (Strip Metadata Capture)          | 6m       | Eng-W3-D | ⏳     |
| **Sat 07-25** (start 10am UTC) | P11-S8 (IA Data Integrity)               | 5m       | SecOps   | ⏳     |
| **Total Phase 11 E2E**         | —                                        | ~58m     | —        | —      |
| **Sat 07-25**                  | Analysis + fix flakies                   | Eng-W3-D | 1 day    | ⏳     |
| **Mon 07-28**                  | Re-run (if any)                          | Eng-W3-D | <30m     | ⏳     |

#### Post-E2E Gate (2026-07-28)

| Checkpoint                           | Owner    | Pass Criterion                                     |
| ------------------------------------ | -------- | -------------------------------------------------- |
| **ALL 32 WAVE 3 E2E PASS**           | QA-Lead  | P8-S[1-8] + P9-S[1-8] + P10-S[1-8] + P11-S[1-8] ✅ |
| 0 flaky tests across wave            | QA-Lead  | Re-runs all successful                             |
| Cloud Logs clean (Wave 3 deploy)     | DevOps   | 0 P0 errors                                        |
| **Wave 3 approved for Phase 12**     | CTO      | Go/No-Go decision                                  |
| **Phase 12 (Performance) unblocked** | Eng-W4-A | Can start dev                                      |

---

### Wave 4 Pre-Execution Window (2026-07-28 → 2026-08-04)

#### Setup for Phases 12–15 (2026-07-28 → 2026-08-04)

| Date       | Activity                                        | Owner            | Deliverable                 |
| ---------- | ----------------------------------------------- | ---------------- | --------------------------- |
| 2026-07-28 | Phase 12–13 development starts                  | Eng-W4-A/Auditor | Code merge approved         |
| 2026-07-29 | 500+ CIQ test records seeded (performance load) | QA-Lead          | Load fixtures ready         |
| 2026-07-30 | 100+ patient portal accounts created            | QA-Lead          | Portal accounts provisioned |
| 2026-08-01 | Firestore indexes verified for Phase 12 queries | DevOps           | Indexes built               |
| 2026-08-02 | Phase 12 code freeze                            | Eng-W4-A         | Code complete, E2E prep     |
| 2026-08-03 | Phase 13 prep (auditor alignment)               | Auditor          | Audit checklist finalized   |
| 2026-08-04 | Performance baseline capture (Lighthouse)       | QA-Perf          | Baseline metrics logged     |

---

### Phase 12 Execution Window (2026-08-04 → 2026-08-10)

#### Pre-E2E Gate (2026-08-03 → 2026-08-04)

| Date             | Checkpoint                             | Owner   | Pass Criterion                      |
| ---------------- | -------------------------------------- | ------- | ----------------------------------- |
| 2026-08-03 (Sun) | Phase 12 code complete; staging deploy | DevOps  | 0 TypeScript errors                 |
| 2026-08-04 (Mon) | hcq-deploy-gates + Lighthouse baseline | QA-Perf | All gates PASS ✓; baseline captured |

#### E2E Execution Window (2026-08-04 → 2026-08-10)

**Precondition:** 500+ CIQ records in Firestore; Firestore indexes built; bundle analysis tool ready

| Time                           | Scenario                              | Duration | Owner     | Status |
| ------------------------------ | ------------------------------------- | -------- | --------- | ------ |
| **Mon 08-04** (start 10am UTC) | P12-S1 (Dashboard Load Performance)   | 10m      | Eng-W4-A  | ⏳     |
| **Mon 08-04** (after S1)       | P12-S2 (Analytics Export 500 records) | 9m       | Eng-W4-A  | ⏳     |
| **Tue 08-05** (start 10am UTC) | P12-S3 (Firestore Query Optimization) | 8m       | Eng-W4-A  | ⏳     |
| **Tue 08-05** (after S3)       | P12-S4 (Bundle Size Audit)            | 7m       | Eng-W4-A  | ⏳     |
| **Wed 08-06** (start 10am UTC) | P12-S5 (Code Splitting by Route)      | 8m       | Eng-W4-A  | ⏳     |
| **Wed 08-06** (after S5)       | P12-S6 (Mobile Performance iPhone 12) | 12m      | QA-Mobile | ⏳     |
| **Thu 08-07** (start 10am UTC) | P12-S7 (Lighthouse Audit)             | 8m       | QA-Perf   | ⏳     |
| **Fri 08-08** (start 10am UTC) | P12-S8 (Web Vitals Baseline Capture)  | 10m      | Eng-W4-A  | ⏳     |
| **Total Phase 12 E2E**         | —                                     | ~72m     | —         | —      |
| **Fri 08-08**                  | Analysis + fix perf regressions       | Eng-W4-A | 1 day     | ⏳     |
| **Mon 08-11**                  | Re-run (if any)                       | Eng-W4-A | <30m      | ⏳     |

#### Post-E2E Gate (2026-08-10)

| Checkpoint                                  | Owner    | Pass Criterion                  |
| ------------------------------------------- | -------- | ------------------------------- |
| All 8 E2E PASS                              | QA-Lead  | P12-S1 through P12-S8 ✅        |
| Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1 | QA-Perf  | Baseline maintained or improved |
| Bundle size ≤380 KB gzip                    | Eng-W4-A | No regressions vs Phase 3       |
| 0 Lighthouse <90 scores                     | QA-Perf  | All ≥90                         |
| Cloud Logs clean                            | DevOps   | 0 P0 errors                     |
| **Phase 12 approved**                       | CTO      | Go/No-Go                        |

---

### Phase 13 Execution Window (2026-08-11 → 2026-08-20)

#### Pre-Audit Gate (2026-08-10 → 2026-08-11)

| Date             | Checkpoint                                          | Owner         | Pass Criterion          |
| ---------------- | --------------------------------------------------- | ------------- | ----------------------- |
| 2026-08-10 (Sat) | All evidence compiled (SGD, training, dossiè, etc.) | Auditor       | Evidence packages ready |
| 2026-08-11 (Sun) | Auditor alignment call (1h)                         | Auditor + CTO | Audit scope finalized   |

#### Compliance Audit Execution (2026-08-11 → 2026-08-20)

**Note:** This is not automated E2E; auditor manually validates DICQ blocks A–E + RDC 978.

| Date                    | Activity                                             | Owner   | Deliverable           |
| ----------------------- | ---------------------------------------------------- | ------- | --------------------- |
| 2026-08-11 → 2026-08-13 | **Block A Audit** (Requirements traceability)        | Auditor | Audit memo A ✓        |
| 2026-08-13 → 2026-08-14 | **Block B Audit** (Organization + Management)        | Auditor | Audit memo B ✓        |
| 2026-08-14 → 2026-08-15 | **Block C Audit** (Personnel + Dossiè)               | Auditor | Audit memo C ✓        |
| 2026-08-15 → 2026-08-16 | **Block D Audit** (Infrastructure + Facilities)      | Auditor | Audit memo D ✓        |
| 2026-08-16 → 2026-08-17 | **Block E Audit** (Quality System)                   | Auditor | Audit memo E ✓        |
| 2026-08-17 → 2026-08-18 | **RDC 978 Critical Articles** (25+ articles mapped)  | Auditor | RDC checklist ✓       |
| 2026-08-18 → 2026-08-19 | **CAPA Closure Verification** (12 findings reviewed) | Auditor | CAPA summary ✓        |
| 2026-08-20              | **Compliance Certification Sign-Off**                | Auditor | Pre-audit memo signed |

#### Post-Audit Gate (2026-08-20)

| Checkpoint                | Owner   | Pass Criterion                      |
| ------------------------- | ------- | ----------------------------------- |
| DICQ ≥88% verified        | Auditor | All 5 blocks A–E scored ✓           |
| RDC 978 100% coverage     | Auditor | All critical articles traced ✓      |
| CAPA closure 12/12        | Auditor | All findings effectively closed ✓   |
| **Pre-audit memo signed** | Auditor | "Ready for external audit" declared |
| **Phase 13 approved**     | CTO     | Go/No-Go                            |

---

### Phase 14 Execution Window (2026-08-21 → 2026-08-25)

#### Pre-E2E Gate (2026-08-20 → 2026-08-21)

| Date             | Checkpoint                             | Owner  | Pass Criterion                    |
| ---------------- | -------------------------------------- | ------ | --------------------------------- |
| 2026-08-20 (Wed) | Phase 14 code complete; staging deploy | DevOps | 0 TypeScript errors               |
| 2026-08-21 (Thu) | hcq-deploy-gates + security scanner    | SecOps | All gates PASS ✓; OWASP ZAP ready |

#### E2E Execution Window (2026-08-21 → 2026-08-25)

**Precondition:** Staging app deployed; OWASP ZAP, CSP headers, CSRF token validation ready

| Time                           | Scenario                                      | Duration          | Owner    | Status |
| ------------------------------ | --------------------------------------------- | ----------------- | -------- | ------ |
| **Thu 08-21** (start 10am UTC) | P14-S1 (SQL Injection Resistance)             | 8m                | SecOps   | ⏳     |
| **Thu 08-21** (after S1)       | P14-S2 (XSS Vulnerability Scan)               | 10m               | SecOps   | ⏳     |
| **Fri 08-22** (start 10am UTC) | P14-S3 (CSRF Token Validation)                | 7m                | SecOps   | ⏳     |
| **Fri 08-22** (after S3)       | P14-S4 (Firestore Rules Penetration Test)     | 12m               | SecOps   | ⏳     |
| **Sat 08-23** (start 10am UTC) | P14-S5 (API Rate Limiting)                    | 8m                | Eng-W4-B | ⏳     |
| **Sat 08-23** (after S5)       | P14-S6 (Full Regression Suite 19 smoke tests) | 25m               | QA-Lead  | ⏳     |
| **Sun 08-24** (start 10am UTC) | P14-S7 (Cloud Logs Review 48h tail)           | 10m               | DevOps   | ⏳     |
| **Sun 08-24** (after S7)       | P14-S8 (Deployment Rehearsal)                 | 15m               | DevOps   | ⏳     |
| **Total Phase 14 E2E**         | —                                             | ~95m              | —        | —      |
| **Mon 08-25**                  | Analysis + final remediation                  | SecOps + Eng-W4-B | 1 day    | ⏳     |

#### Post-E2E Gate (2026-08-25)

| Checkpoint                      | Owner   | Pass Criterion               |
| ------------------------------- | ------- | ---------------------------- |
| All 8 E2E PASS                  | QA-Lead | P14-S1 through P14-S8 ✅     |
| 0 SQL injection vulnerabilities | SecOps  | Penetration test clean       |
| 0 XSS vulnerabilities           | SecOps  | OWASP ZAP <20 warnings       |
| 19/19 smoke tests PASS          | QA-Lead | Full regression suite green  |
| Cloud Logs: 0 P0 errors         | DevOps  | 48h tail analysis complete   |
| Deployment rehearsal success    | DevOps  | Dry-run deploy complete      |
| **Phase 14 approved**           | CTO     | Go/No-Go; ready for Phase 15 |

---

### Phase 15: v1.4 Launch & Post-Deploy Monitoring (2026-08-26 → 2026-08-31)

#### Production Deployment (2026-08-26 → 2026-08-27)

**Schedule (coordinated with minimal user impact):**

| Date          | Time (UTC) | Step                                   | Owner    | Duration | Rollback Plan                |
| ------------- | ---------- | -------------------------------------- | -------- | -------- | ---------------------------- |
| **Tue 08-26** | 10:00      | **Deploy Firestore Rules**             | DevOps   | 5min     | Restore from backup rules    |
| **Tue 08-26** | 10:10      | **Deploy Cloud Functions**             | DevOps   | 15min    | Rollback function versions   |
| **Tue 08-26** | 10:30      | **Deploy Hosting (Web App + PWA)**     | DevOps   | 3min     | Restore previous SW cache    |
| **Tue 08-26** | 10:35      | **Verify all deploys successful**      | DevOps   | 5min     | Full rollback if any failure |
| **Tue 08-26** | 10:40      | **24h Cloud Logs monitoring starts**   | DevOps   | 24h      | Continuous monitoring        |
| **Wed 08-27** | 10:40      | **Smoke test suite on prod (19/19)**   | QA-Lead  | 30min    | If <19/19 pass, escalate P0  |
| **Wed 08-27** | 11:15      | **Performance check (Web Vitals RUM)** | Eng-W4-B | 15min    | Monitor Firebase Analytics   |

#### E2E Execution Window (2026-08-26 → 2026-08-31)

**Note:** All scenarios run against prod AFTER 24h monitoring window clean.

| Time                                            | Scenario                                   | Duration                     | Owner    | Status |
| ----------------------------------------------- | ------------------------------------------ | ---------------------------- | -------- | ------ |
| **Tue 08-26** (10:00 UTC)                       | P15-S1 (Deploy Rules to Prod)              | 5m                           | DevOps   | ⏳     |
| **Tue 08-26** (10:10 UTC)                       | P15-S2 (Deploy Functions to Prod)          | 15m                          | DevOps   | ⏳     |
| **Tue 08-26** (10:30 UTC)                       | P15-S3 (Deploy Hosting to Prod)            | 3m                           | DevOps   | ⏳     |
| **Tue 08-26** (10:40 UTC → Wed 08-27 10:40 UTC) | P15-S4 (24h Cloud Logs Monitoring)         | 1440m                        | DevOps   | ⏳     |
| **Wed 08-27** (10:40 UTC)                       | P15-S5 (Smoke Test Suite on Prod 19/19)    | 30m                          | QA-Lead  | ⏳     |
| **Wed 08-27** (11:15 UTC)                       | P15-S6 (Post-Launch Performance Check)     | 15m                          | Eng-W4-B | ⏳     |
| **Thu 08-28** (on-demand)                       | P15-S7 (Incident Response Drill if needed) | <30m                         | IR Lead  | ⏳     |
| **Fri 08-29**                                   | P15-S8 (v1.4 Launch Sign-Off Memo)         | 1h                           | CTO      | ⏳     |
| **Total Phase 15 E2E**                          | —                                          | ~2+ hours (+ 24h monitoring) | —        | —      |

#### Post-Launch Gate (2026-08-31)

| Checkpoint                            | Owner    | Pass Criterion                                     |
| ------------------------------------- | -------- | -------------------------------------------------- |
| **Rules deploy success**              | DevOps   | 0 errors, <5min deploy time                        |
| **Functions deploy success**          | DevOps   | 0 errors, <15min deploy time, cold-start <10s      |
| **Hosting deploy success**            | DevOps   | 0 errors, <3min deploy time, PWA update propagated |
| **24h Cloud Logs clean**              | DevOps   | 0 P0 errors, <5 P1 warnings (all documented)       |
| **19/19 smoke tests PASS on prod**    | QA-Lead  | Full regression verified on prod                   |
| **Web Vitals maintained**             | Eng-W4-B | LCP <2.5s, INP <200ms, CLS <0.1                    |
| **0 security findings from Phase 14** | SecOps   | No new vulnerabilities in prod                     |
| **v1.4 Launch Sign-Off Memo filed**   | CTO      | Ready for external audit (target 2026-10-15)       |

---

## Conflict Prevention Matrix

### No Overlapping Deploys

| Phase           | Dev Window    | Code Freeze | E2E Window    | Deploy Window  | Next Phase Ready     |
| --------------- | ------------- | ----------- | ------------- | -------------- | -------------------- |
| 4               | 05-07 → 05-19 | 05-19       | 05-24 → 05-27 | 05-27          | 05-28                |
| 5               | 05-07 → 05-29 | 05-29       | 05-29 → 06-02 | 06-02          | 06-03                |
| 6               | 05-20 → 06-02 | 06-02       | 06-03 → 06-09 | 06-09          | 06-10                |
| 7               | 05-27 → 06-09 | 06-09       | 06-10 → 06-16 | 06-16          | 06-17                |
| **Wave 2 Gate** | —             | —           | —             | **2026-06-16** | **Phase 8 unblocks** |

**Rule:** Phase dev starts 2 days after prior E2E completes; no overlapping Windows.

---

## Resource Allocation

### Teams Per Week

| Week        | Eng-W2-A   | Eng-W2-B   | Eng-W2-C   | Eng-W2-D   | QA-Lead | SecOps  | DevOps |
| ----------- | ---------- | ---------- | ---------- | ---------- | ------- | ------- | ------ |
| 20 (05-20)  | Dev P4     | Dev P5     | Dev P6     | Dev P7     | Prep    | Prep    | Prep   |
| 21 (05-27)  | **E2E P4** | Dev P5     | Dev P6     | Dev P7     | **E2E** | **E2E** | Deploy |
| 22 (06-03)  | Deploy     | **E2E P5** | Dev P6     | Dev P7     | **E2E** | **E2E** | Deploy |
| 23 (06-10)  | Deploy     | Deploy     | **E2E P6** | Dev P7     | **E2E** | **E2E** | Deploy |
| 24 (06-17)  | Deploy     | Deploy     | Deploy     | **E2E P7** | **E2E** | **E2E** | Deploy |
| **W2 Gate** | ✅         | ✅         | ✅         | ✅         | ✅      | ✅      | ✅     |

(Continues for Waves 3–4 with similar allocation)

---

## Escalation Thresholds & Response Times

| Severity         | Indicator                      | Escalation                    | Response                                     |
| ---------------- | ------------------------------ | ----------------------------- | -------------------------------------------- |
| **P0 (Blocker)** | Any E2E fails after 2 retries  | Immediate to Wave Coordinator | <30min decision (pause wave or fix + re-run) |
| **P1 (High)**    | >2 E2E timeouts in same phase  | Within 2h to Eng lead         | <4h root cause analysis                      |
| **P2 (Medium)**  | 1 flaky E2E (2 failures total) | Daily standup                 | Document + mitigate by phase end             |
| **P3 (Low)**     | Cloud Logs warning (non-error) | Weekly summary                | Track trend, may be informational            |

---

## Sign-Off Checklist (Per Wave)

```
WAVE 2 (Phases 4–7) Sign-Off
═══════════════════════════════
☐ Phase 4: 8/8 E2E PASS
☐ Phase 5: 8/8 E2E PASS
☐ Phase 6: 8/8 E2E PASS
☐ Phase 7: 8/8 E2E PASS
☐ Total: 32/32 E2E PASS (100%)
☐ 0 P0/P1 escalations remaining
☐ Cloud Logs: 0 P0 errors (Wave 2 deploy window)
☐ Slack notification: "Wave 2: 32/32 PASS ✅"
☐ Wave Coordinator approval: Phase 8 unblocked

WAVE 3 (Phases 8–11) Sign-Off
═══════════════════════════════
☐ Phase 8: 8/8 E2E PASS
☐ Phase 9: 8/8 E2E PASS
☐ Phase 10: 8/8 E2E PASS
☐ Phase 11: 8/8 E2E PASS
☐ Total: 32/32 E2E PASS (100%)
☐ 0 P0/P1 escalations remaining
☐ Cloud Logs: 0 P0 errors (Wave 3 deploy window)
☐ Slack notification: "Wave 3: 32/32 PASS ✅"
☐ Wave Coordinator approval: Phase 12 unblocked

WAVE 4 (Phases 12–15) Sign-Off
═════════════════════════════════
☐ Phase 12: 8/8 E2E PASS (Web Vitals met)
☐ Phase 13: DICQ ≥88% verified (auditor)
☐ Phase 14: 8/8 E2E PASS (security audit clean)
☐ Phase 15: 8/8 E2E PASS (prod deployment clean)
☐ Total: 32/32 E2E PASS (100%)
☐ 19/19 smoke tests PASS on prod
☐ 0 P0 security findings
☐ Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1 maintained
☐ 24h Cloud Logs: 0 P0 errors
☐ Slack notification: "Wave 4: 32/32 PASS + LAUNCH ✅"
☐ CTO approval: v1.4 launch signed off
☐ External audit scheduled (target 2026-10-15)

FINAL MASTER SIGN-OFF
═════════════════════════════════
☐ Wave 2 (32 E2E) signed
☐ Wave 3 (32 E2E) signed
☐ Wave 4 (32 E2E) signed
☐ TOTAL: 96/96 E2E PASS
☐ DICQ: 88–92% achieved
☐ RDC 978: 100% critical articles covered
☐ v1.4 audit-ready declared
☐ External audit scheduled
```

---

**Document Status:** APPROVED  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-05-20 (Phase 4 E2E start)  
**Contact:** Testing Orchestrator (Slack: #hc-quality-testing)
