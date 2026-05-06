---
milestone: v1.3
phase: planning
version: 1.0
date_created: 2026-05-06
status: approved
---

# HC Quality v1.3 — Requirements

**Milestone:** v1.3 (CAPA Closure + Módulos Analíticos)  
**Period:** 2026-05-06 → 2026-08-31  
**Status:** Approved  
**Owner:** CTO + Engineering

---

## Core Goals

1. **Close 12 CAPAs** from Phase 7 audit dry-run (RFI resolution, evidence upload, auditor sign-off by 2026-08-05)
2. **Deliver 4 independent analytics modules** (Bioquímica, Liberação, Críticos, Reclamações) in parallel
3. **Achieve 90%+ compliance baseline** (from 71.3%) and prepare for external audit (target: 2026-08-31)

---

## Compliance Context

**Audit Findings (Phase 7 Dry-Run):**
- 12 Critical Findings (NCM) requiring CAPA
- 18 Minor Findings (NCm)
- 3 N.A. items
- **Current Baseline:** 71.3% conformance (82/115 items)

**CAPA Closure Timeline:**
| Priority | Count | Deadline | Owner | Phase |
|----------|-------|----------|-------|-------|
| Critical | 2 | 2026-05-30 | CTO + Ops | Phase 8 (Week 1) |
| High | 6 | 2026-06-30 | Team | Phase 8 (Week 4) |
| Medium | 3 | 2026-07-05 | Team | Phase 8 (Week 5) |
| Extended | 1 | 2026-08-05 | Team | Phase 8 (Week 13) |

**External Audit Readiness:** 2026-08-31 (post-CAPA closure with 2-week buffer)

---

## Phase 8: CAPA Closure & Auditor Engagement

### Requirements

**CAPA-01: RFI Processing** (Auditor Request for Information)
- [ ] Auditor sends formal RFI letter (email or video call)
- [ ] Evidence gathering per NC (photos, certificates, policies, logs)
- [ ] Response document compilation (max 10 business days per RFI)
- [ ] Acceptance: All 12 RFIs tracked in Firestore, evidence complete, zero missing items

**CAPA-02: Evidence Upload & Chain-Hash**
- [ ] Photos/documents uploaded to Cloud Storage `/labs/{labId}/auditoria-evidencia/capa-{ncId}/`
- [ ] Firestore records linked with immutable signatures (LogicalSignature)
- [ ] Archive retention: 5 years minimum (RDC 978 5.6)
- [ ] Acceptance: 100% chain-hash validation pass, audit trail complete

**CAPA-03: Status Tracking UI**
- [ ] Dashboard showing all 12 CAPAs with status (Open → In Progress → Evidence Submitted → Auditor Reviewing → Closed)
- [ ] Deadline indicators (on-track, at-risk, overdue)
- [ ] Evidence count per NC (photos, files, sign-offs)
- [ ] Acceptance: UI deployed, real-time updates from Firestore, zero stale data

**CAPA-04: Auditor Sign-Off & Closeout**
- [ ] Virtual or on-site auditor review of evidence (1 meeting)
- [ ] Sign-off via email or digital signature (LogicalSignature)
- [ ] Closeout report: baseline before/after, compliance % gain, process improvements logged
- [ ] Acceptance: All 12 CAPAs signed off, closeout report archived

---

## Phases 9–12: Analytics Modules (Independent, Parallelizable)

**Execution Strategy:** 4 phases run in parallel (separate agents/sprints). Each phase ~2-3 weeks.

### Phase 9: Bioquímica (Quantitative QC)

**BIO-01: Data Model & Firestore Schema**
- [ ] Collections: `/labs/{labId}/bioquimica/{runId}`, `/labs/{labId}/bioquimica-materiais`
- [ ] Types: `BioquimicaRun`, `BioquimicaMaterial`, `BioquimicaQCValue`, `BioquimicaAcceptance`
- [ ] Acceptance: TypeScript types validated, Firestore rules deny-by-default, soft-delete only

**BIO-02: Analyte Management**
- [ ] Predefined analytes (glucose, AST, albumin, etc.) with normal ranges
- [ ] Control material tracking (lot, expiration, supplier)
- [ ] QC value acceptance rules (mean ± 2SD, trend limits)
- [ ] Acceptance: Rules E2E tested, trend analysis correct

**BIO-03: Levey-Jennings Chart Integration**
- [ ] Extend existing `chart` module with Bioquímica QC data
- [ ] Chart rendering (mean line, ±1/±2/±3SD bands, out-of-control rules)
- [ ] Drill-down: click point → run details → remediation history
- [ ] Acceptance: Chart renders correctly, drill-down functional, <2s load time

**BIO-04: Cloud Function for Acceptance**
- [ ] Callable `bioquimicaAcceptance(runId)` validates QC rules
- [ ] Returns acceptance status + rule violated (if any)
- [ ] Updates NC if needed (automatic escalation)
- [ ] Acceptance: Function tested, integration with NC module verified

**BIO-05: UI & E2E Tests**
- [ ] Dark-first form for QC entry (analyte, material, value, operator, date)
- [ ] Accept/Reject button with confirmation modal
- [ ] Rejection auto-opens NC modal for comments
- [ ] E2E: 5+ critical flows (accept, reject, trending, drill-down, operator switch)
- [ ] Acceptance: UI pixel-perfect vs design tokens, 95% E2E pass rate

---

### Phase 10: Liberação (Report Release Workflow)

**LIB-01: Release Workflow State Machine**
- [ ] States: Draft → QC Approved → RT Reviewed → Released
- [ ] Transition guards (QC checklist ✓, RT signature required)
- [ ] Rollback: RT can uncertify + recalibrate if error found post-release
- [ ] Acceptance: State transitions audited, no orphaned states

**LIB-02: Authorization & Digital Signature**
- [ ] RT checks report completeness, accuracy, critical values
- [ ] RT signs with digital signature (LogicalSignature)
- [ ] Signature includes timestamp, authorizer identity (UID), hash of report content
- [ ] Acceptance: Signature validates in audit trail, non-repudiation confirmed

**LIB-03: Release Audit Log**
- [ ] Entry per release: operator, RT, timestamp, who/when
- [ ] Correction workflow: if error found, RT initiates correction, marks released version void
- [ ] Retention: 5 years in Cloud Storage + Firestore audit log
- [ ] Acceptance: Corrections logged, void version archived, recovery possible

**LIB-04: Integration with Críticos (Dependency)**
- [ ] Critical results block release until RT manually acknowledges (via phone/SMS + system confirmation)
- [ ] Non-critical results release normally
- [ ] Acceptance: Block/allow logic correct, E2E tested with mock SMS

**LIB-05: UI & E2E Tests**
- [ ] Release dashboard: list of pending reports, checklists, signature modal
- [ ] Dark-first, responsive (tablet + desktop)
- [ ] E2E: approve, reject, correct, critical-result-block, bulk-release (if allowed)
- [ ] Acceptance: 95% E2E pass rate, <2s load for typical worklist (50 reports)

---

### Phase 11: Críticos (Critical Result Escalation)

**CRI-01: Critical Value Configuration**
- [ ] Analyte + critical thresholds (low/high)
- [ ] Configurable per lab (some labs may use different thresholds)
- [ ] Default thresholds from SBAC/DICQ guidelines
- [ ] Acceptance: Config stored in `/labs/{labId}/criticos-config`, rules validate non-empty

**CRI-02: Auto-Escalation Logic**
- [ ] When QC or patient result crosses critical threshold:
  - [ ] Create Crítico record in Firestore
  - [ ] Trigger Cloud Function `escalateCriticoSMS`
  - [ ] Attempt SMS to RT (Twilio integration)
  - [ ] Fallback: Email + dashboard alert if SMS fails
  - [ ] RT must acknowledge within 5 minutes (configurable)
- [ ] Acceptance: Escalation happens <10s after result entry, SMS/email logs captured

**CRI-03: Escalation Audit Trail**
- [ ] Record: timestamp, analyte, value, threshold, attempt (SMS/email), status (delivered/failed), RT acknowledgment time
- [ ] Chain-hash signature on all events
- [ ] Retention: 5 years
- [ ] Acceptance: Audit trail immutable, no gaps in chain

**CRI-04: Dashboard & Alerts**
- [ ] Críticos dashboard: pending escalations, acknowledgment status, history
- [ ] Real-time alerts (toast notifications + email)
- [ ] Trending: % of critical results per analyte/operator/period
- [ ] Acceptance: Alerts arrive <5s after event, trending accurate, no stale data

**CRI-05: E2E Tests**
- [ ] Trigger: result crosses critical threshold → SMS sent → RT acknowledges
- [ ] Fallback: SMS fails → email sent
- [ ] Rejection: RT rejects escalation (escalates to supervisor)
- [ ] Trending: query analytics correct
- [ ] Acceptance: 4+ critical E2E flows, 95% pass rate

---

### Phase 12: Reclamações (Complaint Tracking & RCA)

**REC-01: Complaint Intake**
- [ ] Form: complaint date, operator, analyte, issue type (methodology, result accuracy, reagent, communication)
- [ ] Investigation urgency: immediate (if patient safety), routine (within 7d)
- [ ] Auto-opens NC if severity is high
- [ ] Acceptance: Form fields validated, NC linkage correct

**REC-02: RCA Workflow**
- [ ] Root Cause Analysis: identify root cause (training gap, procedure deviation, equipment failure, reagent issue)
- [ ] Action plan: what will be done, who, when
- [ ] Effectiveness check: how will we verify closure?
- [ ] Acceptance: RCA form structured, all fields required

**REC-03: Closure & Evidence**
- [ ] Close complaint: mark resolved, attach evidence (training certificate, calibration report, procedure update)
- [ ] Follow-up: confirm resolution with operator/patient if needed
- [ ] Archive: complaint + RCA + evidence in Storage 5 years
- [ ] Acceptance: Closure audited, no incomplete complaints >30d old

**REC-04: Trending & Analytics**
- [ ] Dashboard: complaints per analyte, operator, issue type, period
- [ ] Trend detection: if same issue >2x → escalate to management
- [ ] Reports: monthly summary, high-complaint analytes, repeat issues
- [ ] Acceptance: Queries correct, reports generated <5s

**REC-05: E2E Tests & UI**
- [ ] E2E: intake, RCA, closure, trending query
- [ ] UI: dark-first form, RCA modal, trending chart
- [ ] Acceptance: 4+ flows, 95% pass rate, <2s load time for typical complaint list (100 items)

---

## Non-Negotiable Guardrails

✅ **Compliance First**
- All modules comply with RDC 978/2025 + DICQ 4.3
- CAPA closure: 100% evidence completeness before external audit

✅ **Chain-Hash Integrity**
- All audit events (release, escalation, complaint) signed with HMAC-SHA256
- Firestore audit trail immutable (soft-delete only)

✅ **Multi-Tenant Isolation**
- No cross-lab data leakage
- RLS rules on all sensitive collections

✅ **Performance & Accessibility**
- LCP <2.5s, CLS <0.1, INP <200ms (per `.claude/rules/performance.md`)
- WCAG AA contrast ratio 4.5:1
- Dark-first UI with proper color tokens

✅ **E2E Coverage**
- Minimum 80% on critical user flows
- Target: 95% on all new code

✅ **Type Safety**
- TypeScript strict mode
- No `any` in new code

---

## Success Criteria (Milestone Exit)

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| **CAPA Closure** | 12/12 CAPAs closed with 100% evidence | Firestore audit trail + auditor sign-off |
| **Modules Live** | 4/4 modules (Bio, Lib, Cri, Rec) in production | Firebase deploy success + E2E tests pass |
| **Test Coverage** | ≥95% on new code | `npm run coverage` |
| **Compliance Baseline** | ≥90% (from 71.3%) | Projected post-CAPA audit re-run (optional) |
| **Performance** | LCP <2.5s on all routes | Lighthouse CI passing |
| **External Audit Ready** | Auditor signs off on CAPA evidence + schedule date | Email confirmation + calendar hold |

---

## Open Questions (Resolved via Discuss/Plan Phases)

- [ ] **Bioquímica analytes in scope:** All CIQ analytes or subset? (Chemistry analyzer vs hematology)
- [ ] **Críticos thresholds:** Auto-escalation via SMS or manual RT check first?
- [ ] **Críticos SMS provider:** Twilio contract in place? Fallback email cost acceptable?
- [ ] **Reclamações trending:** Quarterly reports or weekly dashboard?
- [ ] **External auditor:** Same auditor as dry-run? Estimated cost + timeline?
- [ ] **Release rollback:** Can RT uncertify and re-release same report version, or must create amended report?

---

## Out of Scope (v1.3)

- Multi-site management (deferred to post-audit)
- Mobile app enhancements (separate milestone)
- Third-party lab integration / CEQ Phase 2 (separate spike)
- Data migration / legacy LIS integration (separate project)
- Patient-facing portal (separate phase)

---

## Timeline at a Glance

```
2026-05-06 ──────────────────────── 2026-08-05 ────────────── 2026-08-31
v1.3 Start                          CAPA Closure Deadline     External Audit Readiness
         │                                  │                         │
         ├─ Week 1-4: Phase 8 Critical     │                         │
         ├─ Week 1-4: Phases 9-12 Start (parallel)                   │
         ├─ Week 4-8: Phase 8 High/Medium  │                         │
         ├─ Week 4-8: Phases 9-12 Execution (parallel)               │
         ├─ Week 9-13: Phase 8 Extended    │                         │
         ├─ Week 9-13: Phases 9-12 Polish/E2E                        │
         └─ Week 13: Final CAPA & Module QA ────────────────────────→ Launch
```

---

**Total Requirements:** 24 (4 CAPA + 5×BIO + 5×LIB + 5×CRI + 5×REC)  
**Approval Status:** ✅ Approved (2026-05-06)  
**Next Step:** `/gsd-plan-phase 8` after roadmap review
