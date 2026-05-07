---
phase: "4"
name: "CAPA Closure & Process Execution — Context"
status: "planning"
created: 2026-05-07
---

# Phase 4 Context — v1.4 Wave 2 Anchor

## Where We Are in v1.4

**v1.3 Complete (as of 2026-05-07):**
- 25 modules in production
- DICQ baseline: 78–82% (71.3% from formal audit dry-run)
- 12 critical audit findings documented (v1.2 Phase 7 audit)
- 3 micro-module foundations scaffolded (calibracao, personnel, management-review)
- Auditor pre-alignment ready

**v1.4 Phases 1–3 Complete:**
- Phase 1: v1.3 stabilization + deployment closure ✅
- Phase 2: v1.4 planning + requirements locked ✅
- Phase 3: Schema extensions + Firestore Rules v1.4 ✅

**v1.4 Phase 4 Now Starting:**
- Goal: Close 12 CAPAs + deliver micro-module completions
- Duration: 3.5–4 weeks (May 20 – June 15)
- Wave: 2 (CAPA Closure + Portal Expansion, parallel Phases 5–7)
- Critical Path: Auditor RFI availability

---

## Strategic Importance

Phase 4 is the **compliance anchor** of v1.4:
- Closes critical audit findings → auditor confidence
- Establishes personnel + governance foundation → all downstream compliance modules depend on this
- Demonstrates CAPA process (evidence gathering, auditor sign-off, remediation proof)
- Intermediate DICQ target: 78–82% → 84–86% (+4–6 points)

**If Phase 4 succeeds on time:**
- Phases 5–7 (portal, critical values, feedback) proceed with full confidence
- Phase 8+ (NOTIVISA, documentation, multi-equipment) have proven compliance rigor
- Final audit (Oct 2026) sees a system with closure discipline

**If Phase 4 slips >1 week:**
- Auditor RFI delays cascade (Wave 3 NOTIVISA prep blocked)
- Deferred CAPA evidence (NC-005–012) schedule at risk
- Overall v1.4 timeline slips 5–7 days

---

## Why These 12 CAPAs?

### Critical Findings (NC-001–004, NC-009, NC-012) — Phase 4 Closeable
These address **governance, personnel, and risk management** — foundational domains where evidence can be generated + auditor sign-off achieved in 4 weeks:

- **NC-001** (Management Review) — create template + mock meeting + formalize process
- **NC-002** (Calibracao) — upload certificates + alert system + audit report
- **NC-003** (Personnel Cargos) — document roles + authority matrix + org chart
- **NC-004** (Personnel Designacoes) — formal role assignments (RT, QA Mgr, Director) + certificates
- **NC-009** (CEQ Annual Report) — aggregate 2025 results + RT sign-off
- **NC-012** (Risk Management) — FMEA-lite matrix + controls + revalidation schedule

### Major Findings (NC-005–008, NC-010–011) — Phase 4 Deferred with Proof of Plan
These address **operations-heavy domains** requiring infrastructure + ongoing processes. Phase 4 delivers **phase plans + mock evidence** showing auditor that closure is committed + on-track:

- **NC-005** (NOTIVISA) → Phase 8 (critical value escalation triggers NOTIVISA draft)
- **NC-006** (SGD) → Phase 9 (document hierarchy + distribution + versioning)
- **NC-007** (Pre-analytic) → Phase 9 (sample collection + transport procedures)
- **NC-008** (Method Validation) → Phase 10 (analyte registry + Westgard CLSI validation)
- **NC-010** (PGRSS) → Phase 10 (waste segregation + contractor tracking)
- **NC-011** (Biossegurança) → Phase 10 (area classification + ISO 14644 inspections)

---

## Micro-Modules: Why These 6?

Each micro-module **closes 1–2 CAPAs** AND feeds **upstream DICQ blocks**:

| Module | NC Closed | DICQ Blocks Improved | RDC Articles | Why Phase 4 |
|--------|-----------|---------------------|--------------|-----------|
| `calibracao` | NC-002 | H (5.3.1.4) | 86 (equipment) | Essential for post-CIQ equipment validation; auditor will inspect |
| `personnel-cargos` | NC-003 | A, C (org) | 122–127 (roles) | Foundation for all personnel-based controls; blocks NC-001, NC-004 |
| `personnel-designacoes` | NC-004 | A, C (governance) | 122–127 (RT, QA mgr) | Formal accountability; auditor critical eye on laudo signers |
| `management-review` | NC-001 | A (4.15) | 86 (governance) | Annual governance ceremony; 15-entry aggregation foundation |
| `ceq-annual-report` | NC-009 | F (5.6.3.4) | 176 (annual report) | Demonstrates proficiency participation monitoring |
| `risk-management` | NC-012 | A, D (4.14.6) | 86 (risk component) | Living register; demonstrates proactive hazard management |

---

## Success Criteria (Quick Check)

**Phase 4 is complete when:**

1. ✅ **All 12 CAPAs closed** — auditor sign-off email received + logged
2. ✅ **6 micro-modules in production** — code merged + deployed + E2E passing
3. ✅ **DICQ improved** — blocks A/C/D +4–6 points measured
4. ✅ **Evidence audited** — chain-of-custody integrity verified (hashes, signatures)
5. ✅ **Zero P0 security findings** — rules + callables audit clean
6. ✅ **<3 RFI cycles** — auditor questions resolved efficiently

---

**Phase 4 Research Complete:** 2026-05-07  
**Ready for gsd-plan-phase skill invocation** to decompose into detailed PLAN.md files.
