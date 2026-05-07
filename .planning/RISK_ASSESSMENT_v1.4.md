# Risk Assessment v1.4 — Phase 5, 6, 8 Implementation Risks

**Document:** RISK_ASSESSMENT_v1.4.md  
**Date:** 2026-05-07  
**Scope:** Phases 5 (Critical Results State Machine), 6 (Audit Trail), 8 (CAPA/Risk/NCQ Integration)  
**Target:** CTO + Tech Lead risk review (monthly checkpoint)

---

## Executive Summary

Three architectural decisions (ADR-0013, 0014, 0015) introduce systemic risks across v1.4 Phase 5–8. This assessment identifies **Top 5 risks**, probability/impact matrix, and mitigation strategies.

**Overall Risk Profile:** Medium (Probability: 45%, Impact: High). Mitigations are standard + well-documented. No showstoppers identified.

---

## Top 5 Risks

### RISK-1: Cloud Function Latency (Critical Results State Machine)

**Description:**  
ADR-0013 (Critical Results State Machine) requires Cloud Function callable on every critico status transition (normal → critico → alertado → resolvido). Each CF invocation adds ~500ms latency (cold start + HMAC signature + Firestore write).

User scenario: Lab receives critical result at 14:22 → CF is slow → notification sent at 14:27 (5 minutes late) → RDC 978 Art. 184 requires "immediate" notification (undefined, but <30 min is standard assumption).

**Trigger:** If Cloud Functions are under load (parallel results processing), cold starts pile up. Probability increases during peak hours (morning, afternoon shift changes).

**Impact if occurs:**
- SLA breach (notify within 15 min, actually 20+ min due to CF queue).
- Auditor notices: "Your critical result response is slow."
- Mitigates compliance posture (RDC 978 Art. 184 intent is "clinician reacts immediately").

**Probability:** 30% (will occur during peak hours at least once/month)  
**Impact:** Medium (SLA miss, not safety risk; no patient harm documented)  
**Risk Severity:** **MEDIUM**

**Mitigation:**
- M1.1: Cloud Functions memory allocation set to 2GB (faster cold starts, higher cost ~$5/day).
- M1.2: Pre-warm function via Cloud Scheduler (invoke dummy trigger every 10 min during work hours).
- M1.3: Monitor function execution time (Cloud Logs + Pub/Sub alert if >1s).
- M1.4: Fallback: If CF takes >5s, client-side timeout → UX shows "notification pending" (background retry).
- M1.5: Document SLA in operational manual: "Critical notifications sent within 5–10 min of detection (including CF latency)."

**Owner:** DevOps (infrastructure); CTO (SLA definition)  
**Acceptance Criteria:** 95th percentile CF latency <1s during peak hours.

---

### RISK-2: Decentralized Audit Trail Query Complexity

**Description:**  
ADR-0014 (Audit Trail Extensibility) chooses decentralized pattern: audit logs live in each module (criticos.transitions, nao-conformidades.transitions, notivisa.submissionAttempts, etc.).

Auditor scenario: "Show me all events related to patient X's critical result." 
- Decentralized requires: query criticos, query liberacao, query notivisa, merge + sort.
- Easy to miss a module (auditor asks "why isn't the training event here?" → training module wasn't queried).
- Risk: Incomplete audit export → auditor sees incomplete timeline → compliance gap → penalty.

**Trigger:** New module added in Phase 9–10 (e.g., mobile patient app logs). Audit export CF not updated → new module events are invisible.

**Impact if occurs:**
- Auditor finds incomplete audit trail (missing events).
- RDC 978 Art. 5.3 / LGPD compliance questioned.
- Remediation: Manual audit of all modules, time-consuming.

**Probability:** 40% (will happen if new module added without audit integration)  
**Impact:** Medium (compliance gap, not safety issue; recoverable)  
**Risk Severity:** **MEDIUM**

**Mitigation:**
- M2.1: Create `AUDIT_TRAIL_MODULES_REGISTRY.ts` (list of all modules that generate audit events). Audit export CF iterates registry (not hardcoded module list).
- M2.2: Module CLAUDE.md must declare: "This module generates audit events in [field]." Template enforces.
- M2.3: Pre-launch gate: audit export CF tested against all 25+ modules (integration test).
- M2.4: Phase 6.1 (post-launch) contingency: build centralized `/audit-trail` mirror (async via Pub/Sub) if auditor feedback says "decentralized is too hard."
- M2.5: Document audit querying procedure: `docs/AUDIT_TRAIL_QUERYING.md` with examples.

**Owner:** Architecture (ADR-0014 executor); QA (pre-launch testing)  
**Acceptance Criteria:** Audit export CF passes 100% of modules; no module events missing.

---

### RISK-3: CAPA-Risk Circular Linkage Ambiguity

**Description:**  
ADR-0015 (CAPA vs Risk vs NCQ Integration) introduces bidirectional references:
- Risk.tratamento.capaIds points to CAPA(s)
- CAPA.linkage.riskIds points back to Risk(s)
- NCQ also references CAPA and/or Risk

Developer scenario: "I need to close Risk-123. Do I update Risk.status directly, or transition linked CAPA-456, which then cascades to Risk?"

Answer: Policy says "CAPA transitions first (em_execucao → concluida → verificada); when CAPA.verificacaoEficacia.resultado === 'eficaz', then Risk.status → fechado (via CF trigger)."

Risk: If developer closes Risk without verifying CAPA, audit trail shows "risk closed without efficacy check" (RDC 978 violation).

**Trigger:** New developer on Phase 8, doesn't read ADR-0015 carefully, creates CF that closes Risk directly.

**Impact if occurs:**
- Audit trail broken (Risk closed without CAPA verification).
- RDC 978 Art. 86 component 3 (verification of treatment) not documented.
- Remediation: Manually re-open Risk + re-verify CAPA + re-document.

**Probability:** 25% (will happen once during Phase 8, caught in code review)  
**Impact:** Medium (audit compliance, caught early, manual fix OK)  
**Risk Severity:** **LOW-MEDIUM**

**Mitigation:**
- M3.1: Document state machine policy in `.claude/docs/CAPA_ARCHITECTURE.md` (explicitly state cascading rule).
- M3.2: Firestore Rules enforce: Risk.status update is only allowed via CF (client cannot update directly).
- M3.3: CF `closeRisk` validates: "if closing, check that linked CAPAs are all verified." Throws error otherwise.
- M3.4: Code review checklist: "Does this CF touch Risk-CAPA linkage? If yes, check ADR-0015."
- M3.5: Unit test: `testRiskCAPALinkagePolicy()` validates all valid transition paths.

**Owner:** Architecture (CF design); Code Review (enforcement)  
**Acceptance Criteria:** Zero Risk closures without verified CAPA (audit trail shows proper sequence).

---

### RISK-4: Migration Burden (v1.3 → v1.4 CAPA Migration)

**Description:**  
ADR-0015 Phase 8 requires migrating ~50 v1.3 NCQs with nested CAPA data to new top-level `/capas` collection. Migration script must be correct (data integrity risk).

Scenario: Migration script copies nested NCQ.capa → /capas, but misses some fields (e.g., CAPA.transitions array). Result: v1.4 /capas doc is incomplete → audit trail broken → compliance gap.

**Trigger:** Migration script is not fully tested before production run. Edge cases (CAPAs with no transitions, double-nested objects) cause silent data loss.

**Impact if occurs:**
- v1.3 CAPA data is incomplete in v1.4.
- Audit trail missing history (transitions array lost).
- Remediation: Restore from backup, re-migrate, time-consuming.
- Worst case: Deploy rollback (lose v1.4 work).

**Probability:** 15% (migration failures happen, but usually caught in staging)  
**Impact:** High (potential full rollback)  
**Risk Severity:** **MEDIUM**

**Mitigation:**
- M4.1: Migration script is thoroughly tested on staging replica (with v1.3 production data snapshot).
- M4.2: Pre-migration backup: full Firestore backup (Cloud Console → automated GCS export).
- M4.3: Dry-run: run migration script in dryRun mode (logs what would be migrated, no actual writes).
- M4.4: Verification script: after migration, query /capas and nao-conformidades; cross-check counts.
- M4.5: Rollback plan: if migration fails, restore Firestore from backup + re-run in next deployment window (48h delay is acceptable for this non-critical migration).
- M4.6: Documentation: `docs/CAPA_MIGRATION_PROCEDURE.md` (step-by-step, with verification checks).

**Owner:** DevOps (backup + restore); Engineer (migration script)  
**Acceptance Criteria:** Migration verified on staging; dry-run output matches actual run; counts match.

---

### RISK-5: HMAC Chain Continuity Break (Audit Trail)

**Description:**  
ADR-0012 + 0014 use LogicalSignature (HMAC chain) to ensure audit trail integrity. Each transition includes `prev_hash` reference to previous event.

Chain continuity scenario: Phase 6 adds HMAC to criticos.transitions, but Phase 5 (earlier) already wrote criticos without HMAC (no signature). When Phase 6 code reads Phase 5 criticos, it doesn't find prev_hash.

Result: HMAC chain is broken (Phase 5 events have no signature; Phase 6 can't chain to them).

Auditor verifies chain: "Is HMAC chain intact?" Answer: "No, there's a gap between Phase 5 and Phase 6 events."

**Trigger:** Phase 5 launches (May 21–June 4) without HMAC. Phase 6 launches (June 5–July 16) with HMAC. In between, production has criticos without signatures.

**Impact if occurs:**
- HMAC chain integrity is broken → can't certify "no tampering" for early events.
- RDC 978 Art. 5.3 (audit trail integrity) is questionable for Phase 5 events.
- Remediation: Manually verify Phase 5 criticos (labor-intensive), or accept gap in compliance.

**Probability:** 35% (if Phase 5 doesn't anticipate HMAC pattern)  
**Impact:** Medium (compliance gap, Phase 5 events are less critical, remediation is acceptable)  
**Risk Severity:** **MEDIUM**

**Mitigation:**
- M5.1: ADR-0013 states: "Phase 5 criticos.transitions include LogicalSignature from day 1 (anticipate Phase 6)." Signature is computed + stored immediately.
- M5.2: If Phase 5 launches without signatures, Phase 6.1 (immediate post-launch) retrofits signatures to existing Phase 5 criticos (batch job).
- M5.3: Firestore Rules enforce: all transitions[] entries must have signature field (nullable initially, but populated by CF).
- M5.4: Testing: E2E test `testHMACChainContinuity()` simulates Phase 5 + Phase 6 transition; verifies chain integrity.

**Owner:** Architecture (ADR-0013 design); Phase 6 executor (retrofit if needed)  
**Acceptance Criteria:** HMAC chain is continuous (no gaps); auditor can verify integrity.

---

## Probability / Impact Matrix

```
             Low Impact          Medium Impact       High Impact
High Prob.   [None]              RISK-2 (40%, M)     [None]
                                 RISK-5 (35%, M)

Medium Prob. RISK-3 (25%, LM)     RISK-1 (30%, M)     RISK-4 (15%, H)
                                                      [Accept with mitigation]

Low Prob.    [None]              [None]              [None]
```

**Risk Color Coding:**
- 🔴 RED (High impact + Medium/High prob): Unacceptable, requires resolution before v1.4 launch.
- 🟡 YELLOW (Medium impact + Medium prob): Acceptable with mitigation; monitor during execution.
- 🟢 GREEN (Low/Medium impact + Low prob): Low risk, standard engineering practices apply.

**Assessment:** All 5 risks are **YELLOW or GREEN**. None are RED (unacceptable).

---

## Summary Table

| Risk | Phase | Probability | Impact | Severity | Owner | Mitigation Count |
|---|---|---|---|---|---|---|
| RISK-1 (CF Latency) | 5 | 30% | Medium | **MEDIUM** | DevOps | 5 mitigations |
| RISK-2 (Audit Query) | 6 | 40% | Medium | **MEDIUM** | Architecture | 5 mitigations |
| RISK-3 (CAPA-Risk Link) | 8 | 25% | Medium | **LOW-MED** | Architecture | 5 mitigations |
| RISK-4 (Migration) | 8 | 15% | High | **MEDIUM** | DevOps | 6 mitigations |
| RISK-5 (HMAC Chain) | 5–6 | 35% | Medium | **MEDIUM** | Architecture | 4 mitigations |

---

## Acceptance Criteria (Phase 5, 6, 8 Gates)

### Phase 5 Gate (June 4, 2026)

- ✅ CF latency tested (95th percentile <1s) on staging.
- ✅ HMAC signatures computed + stored for all criticos.transitions.
- ✅ E2E test: critico normal → critico → alertado → resolvido (all transitions logged with signatures).
- ✅ SLA documentation updated: "Notifications sent within 5–10 min."

### Phase 6 Gate (July 16, 2026)

- ✅ Audit export CF tested against all modules (100% coverage).
- ✅ Dry-run audit export on production data replica (verified on staging).
- ✅ `AUDIT_TRAIL_MODULES_REGISTRY` is live + enforced.
- ✅ Documentation: `AUDIT_TRAIL_QUERYING.md` complete + link in ops manual.

### Phase 8 Gate (June 11, 2026)

- ✅ Migration script tested on staging (50 NCQs migrated correctly).
- ✅ Backup + rollback procedure documented + tested.
- ✅ Firestore Rules enforce Risk.status update via CF only.
- ✅ CAPA-Risk linkage validation unit test passes all cases.
- ✅ Code review checklist updated: CAPA-Risk linkage check is mandatory.

---

## Monthly Checkpoint Schedule

| Date | Phase | Check | Owner |
|---|---|---|---|
| **2026-05-21** | 5 kickoff | Is CF infrastructure provisioned? Scaling plan confirmed? | DevOps |
| **2026-06-04** | 5 complete | CF latency SLA met? HMAC signatures retroactive applied if needed? | Tech Lead |
| **2026-06-18** | 6 kickoff | Audit module registry built? CF signature ready? | Architecture |
| **2026-07-16** | 6 complete | Audit export tested 100% modules? Documentation complete? | QA |
| **2026-05-21** | 8 kickoff | Migration script staging test passed? Backup ready? | DevOps |
| **2026-06-11** | 8 complete | Migration run successful? CAPA linkage validated? | Tech Lead |

---

## Escalation Contacts

| Risk | Escalation to | Condition |
|---|---|---|
| RISK-1 (CF latency) | CTO | 95th percentile latency >2s for 2+ consecutive days |
| RISK-2 (Audit query) | CTO | Auditor feedback says "decentralized is impractical" |
| RISK-3 (CAPA-Risk link) | Tech Lead | Code review finds Risk closed without CAPA verification |
| RISK-4 (Migration) | CTO | Migration fails; rollback needed |
| RISK-5 (HMAC chain) | CTO | HMAC chain integrity verified as broken |

---

## References

- ADR-0013 (Critical Results State Machine)
- ADR-0014 (Audit Trail Extensibility)
- ADR-0015 (CAPA vs Risk vs NCQ Integration)
- ADR-0012 (LogicalSignature audit trail)
- RDC 978/2025 (Art. 86, 184–191, 5.3)
- v1.4-ROADMAP (Phases 5, 6, 8)

---

**Document Status:** FINAL  
**Next Review:** 2026-05-21 (Phase 5 Kickoff)  
**Approval:** CTO signature on acceptance of risks + mitigation plans
