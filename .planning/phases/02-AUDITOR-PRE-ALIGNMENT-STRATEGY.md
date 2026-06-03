# Phase 0b — Auditor Pre-Alignment Strategy (End-to-End)

**Purpose**: Establish formal alignment protocol with external auditor before Phase 1 (CAPA + RDC remediation). Lock evidence standards, RFI cadence, and DICQ target confirmation.

**Status**: 🔴 **PRE-EXECUTION** (kick-off Week 1, May 8–10)

**Owner**: CTO + QA Lead (Labclin RT as secondary)

**Duration**: 7–10 days (T-7 to post-call deliverables)

**Success Criteria**:

- ✅ Auditor verbal confirmation of Phase 0 scope (RDC blockers sufficient)
- ✅ DICQ 88% target agreed + timeline (audit-ready 2026-08-15)
- ✅ Evidence standards locked (LogicalSignature, chainHash, SGD naming)
- ✅ RFI cadence documented (5 business day SLA)
- ✅ Signed minutes + auditor pre-approval email archived

**Stakeholders**:

- **Internal**: CTO, QA Lead, RT (Labclin compliance officer)
- **External**: SBAC/DICQ auditor (1–2 auditor team lead + specialist)
- **Backup**: External regulatory consultant (if primary auditor unavailable)

**Critical Path**: This phase gates Phase 1 (CAPA) entry. Phase 0 can proceed in parallel (RDC blocker modules: turnos, LGPD, lab-apoio, risks) but Phase 1 is **blocked until auditor sign-off received**.

---

## Pre-Call Preparation (T-7 to T-1)

### T-7 Days: Identify & Schedule

**Tasks:**

1. **Auditor identification**
   - Primary: Labclin compliance officer (RT) + designated SBAC/DICQ auditor lead
   - Contact method: formal letter on lab letterhead requesting 90-min sync call
   - Preferred timing: morning (8–11 AM Brasília time) to maximize alertness
   - Fallback: async written RFI if in-person unavailable by Day 7

2. **Confirm availability**
   - Send calendar invite with tentative dates: May 8–10 (3 options)
   - Include agenda + artifact list (read-only links)
   - Request confirmation by EOD May 6

3. **Prepare artifact bundle** (finalize links)
   - `.planning/milestones/v1.3-COMPLETION-SUMMARY.md`
   - `.planning/milestones/v1.3-DEPLOYMENT_MONITORING_REPORT_24H.md`
   - `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md`
   - `.planning/milestones/v1.4-RDC-COVERAGE-MATRIX.md`
   - `.planning/milestones/v1.4-PHASE-0-PLAN.md`
   - `.planning/milestones/v1.4-RISK-REGISTER.md`
   - `.planning/milestones/v1.4-REQUIREMENTS.md`
   - `CLAUDE.md` (architecture + module reference)

### T-5 Days: Artifact Sharing & Internal Prep

**Tasks:**

1. **Share read-only access** to artifacts (Google Drive folder or GitHub wiki)
   - Create "HC Quality v1.4 — Auditor Alignment" shared folder
   - Email auditor with 5-day pre-read window
   - Include 2-page executive summary below (v1.3 recap + v1.4 vision)

2. **Export production evidence samples** (to present during call):
   - 3 audit trail entries (from `auditoria-interna` module v1.3) showing chainHash + operatorId + ts
   - 2 signed laudo samples (PDF with LogicalSignature payload in metadata or footer)
   - SGD Lista Mestra snapshot (MQ/PQ/IT/FR/POL hierarchy with versioning)
   - Sample risk entry (FMEA matrix 5×5, NPR calculation)
   - Personnel dossié skeleton (qualificação + treinamento + competência links)

3. **Internal alignment** (CTO + QA Lead + RT pre-brief)
   - 30-min sync to lock trade-off positions
   - Define escalation thresholds (e.g., if auditor rejects LogicalSignature, what's Plan B?)
   - Prepare auditor education talking points (new tech stack, multi-tenant architecture, etc.)
   - Identify 2–3 "must-win" items and 2–3 "can-defer" items

4. **Tech setup for call**
   - Screen-share capability tested (Zoom/Teams)
   - Access to staging deployment (hmatologia2-staging, if exists) or production read-only
   - PDF samples prepped locally for share-screen walkthrough
   - Note-taking assigned (QA Lead or CTO scribe)

---

## Pre-Alignment Meeting Agenda (60–90 minutes)

### Opening (2 min) — Welcomes & Context

**Facilitator**: CTO

- Greet auditor + introduce Labclin team
- Confirm agenda + time box
- Set expectations: this is alignment, not sign-off; formal approval comes end-of-Wave-1 (May 24)
- Note recording (if agreed) for minutes

**Talking Points:**

- "HC Quality is a SaaS CIQ platform. v1.3 deployed 5 days ago with 78.5% DICQ coverage. v1.4 targets 88%+ and audit readiness by Aug 15."
- "This call confirms you agree with the scope. Phase 0 starts today (4 RDC blockers). Phase 1 (CAPA) is blocked waiting for your sign-off on evidence standards."

---

### Part 1 — v1.3 Recap (8–12 min)

**Speaker**: QA Lead + CTO

**Slides/Content:**

1. **v1.3 Deployment Summary**
   - Timeline: 2026-04-24 (Phase 1) → 2026-05-07 (Step 4 smoke tests)
   - 25 modules in production: CIQ core (coagulation, immunology, urinalysis, biochemistry) + governance (SGQ, auditoria, pops) + support (trainings, risks, labs-support, etc.)
   - Test coverage: 738/738 unit + E2E tests passing
   - RDC 978 compliance: ✅ Arts. 117, 167, 179–191 (phase 0 adds Arts. 36–39, 77, 86, 122)
   - DICQ 71.3% → 78.5% (+7.2 pts in v1.3 alone)

2. **Smoke Test Results (Step 4, May 7)**
   - 19/19 critical flows passing (commit `5efc16d`)
   - Cloud Logs 24h baseline: HEALTHY (0 critical incidents, commit `7c6e5d8`)
   - Production deploy gates: Rules ✅ | Functions ✅ | Hosting ✅
   - No rollbacks or hotfixes needed

3. **Live Demo (~3 min)**
   - Audit trail: show 3 chained events (NC creation → CAPA assignment → closure)
     - Each event contains: `{ hash: "sha256...", operatorId: "uid...", ts: timestamp, intent: "write|read" }`
     - ChainHash verification: `hash[n] = SHA256(json(event[n]) + hash[n-1])`
   - Signed laudo: PDF with LogicalSignature footer (operator name, timestamp, hash preview)
   - SGD hierarchy: DICQ-compliant MQ → PQ → IT → FR → POL structure (80 Riopomba docs migrated)

4. **Open Compliance Items v1.3 → v1.4**
   - DICQ gaps by block (see matrix slide):
     - Bloco A (Governança): 78% → 92% (Norteadores + Management Review missing)
     - Bloco B (SGD): 65% → 92% (Lista Mestra hierarchy base exists; versioning / distribution formalization pending)
     - Bloco D (Quality): 60% → 85% (Riscos skeleton + auditoria interna formalization)
   - RDC 978 articles addressed in v1.3 + Phase 0:
     - v1.3: Arts. 117 (technical responsibility), 167 (laudo), 179–191 (quality procedures)
     - Phase 0: Arts. 36–39 (lab-apoio), 77 (LGPD), 86 (risks), 122 (supervisão turnos)

**Auditor Checkpoint**: "Do you confirm v1.3 as a solid baseline for external audit readiness in Aug 2026?"

---

### Part 2 — v1.4 Plan Walkthrough (12–18 min)

**Speaker**: CTO + Stream leads (if prepared)

**Slides/Content:**

1. **22-Week Roadmap Overview (v1.4, May 7 → Sep 30)**

   **Phase 0 (Days 1–9, Week 1–2) — RDC Blockers** ✅ **LIVE NOW**
   - Supervisor técnico (RT) designation + signature flows (`turnos` module)
   - LGPD formal policy + DPIA (`sgq` documents POL-LGPD-001 + IT-LGPD-DPIA-001)
   - Lab apoio contracts + traceability (`lab-apoio` module, RDC Arts. 36–39)
   - Risk management skeleton (`risks` module, FMEA P×S×D, RDC Art. 86)
   - Expected DICQ lift: 78.5% → ~82–83%
   - **Hard stop: Day 9.** Stretch features (CSV import risks) deferred to v1.4.1.

   **Wave 1 — Foundation (Weeks 1–3, May 7–31)**
   - Phase 1: v1.3 stabilization (3–4 days)
   - Phase 2: v1.4 planning + requirements deep-dive (2–3 days)
   - Phase 3: schema extensions + cross-cutting prep (1 week)
     - New collections: portal-config, notivisa-outbox, laudos-draft, imuno-ias-dev
     - Shared helpers: notivisaFormatter, laudoDraftManager, iaStripValidator
   - **Gate**: Auditor RFI SLA locked, evidence standards confirmed

   **Wave 2–4 (Weeks 4–22, Jun–Sep)**
   - Phase 4: CAPA closure (12 findings from v1.3 audit, eficácia verification)
   - Phase 5: Patient portal (email-link auth, laudo acesso, feedback)
   - Phase 6: Pré-analytic expansion (coleta + transporte + rastreamento)
   - Phases 7–9: Pós-analytic (laudos finais, valores críticos, NOTIVISA sandbox)
   - Phases 10–13: Audit prep + IA foundation + final compliance push

2. **DICQ Target — 78.5% → 88%+**

   **By Block Progression:**

   ```
   Bloco A: 78% → 92% (Norteadores + Governança formalizada + Management Review)
   Bloco B: 65% → 92% (SGD finalized — Lista Mestra + versioning + distribuição)
   Bloco C: 80% → 92% (Personnel dossié + dossiê único + onboarding)
   Bloco D: 60% → 85% (Riscos + auditoria interna + indicadores)
   Bloco E: 64% → 75% (Coleta + transporte infra)
   Bloco F: 92% → 95% (CEQ validation cycles)
   Bloco G: 70% → 92% (Laudos finais + valores críticos)
   Bloco H: 75% → 88% (Lab apoio + calibração)
   Bloco I: 64% → 80% (Monitoramento ambiental)
   Bloco J: 70% → 78% (LGPD + segurança)

   Weighted Avg: 78.5% → ~88.5%
   ```

   **Why 88% and not 100%?**
   - DICQ items marked ⚪ (process/human, no software) excluded (e.g., 4.1.2.8 physical governance plan)
   - Some items deferred to v1.5 (e.g., fine-tuning IA, multi-tenant, customer portal expansion)
   - Conservative estimate; actual target 88–92%

3. **RDC 978 Mandatory Coverage**
   - v1.3 addressed: Arts. 117, 167, 179–191 (7 articles, all mandatory for CIQ operation)
   - Phase 0 addresses: Arts. 36–39 (lab apoio), 77 (LGPD), 86 (riscos), 122 (supervisão)
   - Remaining Phase 1+ (not RDC blockers, but DICQ drivers):
     - Art. 115 (retention 5 years) — handled via Firestore rules + audit trail
     - Art. 204 (NOTIVISA integration) — Phase 7–8

   **Claim: RDC 978 mandatory items will be 100% covered by audit date (Aug 15).**

4. **Key Dependencies & Dates**

   | Milestone              | Date                    | Owner       | Gate                                  |
   | ---------------------- | ----------------------- | ----------- | ------------------------------------- |
   | Phase 0 complete       | May 16 (Day 9)          | Stream A+B  | Callable deployment + smoke tests     |
   | Auditor RFI SLA locked | May 10 (this call + 1d) | Auditor     | Written confirmation                  |
   | Phase 1 kickoff        | May 17                  | Stream A    | Auditor pre-approval                  |
   | Wave 1 complete        | May 31                  | All streams | Requirements final                    |
   | Wave 2 kickoff         | Jun 2                   | All streams | No RDC blockers                       |
   | Audit prep target      | Aug 15                  | Stream A    | All phases 1–9 complete + smoke tests |
   | External audit         | Oct/Nov 2026            | Auditor     | DICQ ≥88% + RDC 100%                  |

5. **Deferred Items (What is NOT in v1.4 and Why)**
   - Multi-tenant v2: deferred to v1.5 (currently single-lab; architecture scalable)
   - Fine-tuning IA for strip immunology: deferred to v1.5 (Gemini Vision API baseline in v1.4)
   - NOTIVISA production integration: deferred to v1.4.1 (sandbox in v1.4)
   - Patient consent UI (LGPD Art. 8): deferred to v1.4.1 after portal MVP (Phase 5 email-link MVP only)
   - Predictive analytics + anomaly detection: backlog (Phase 14+)

**Auditor Checkpoint**: "Does this timeline feel achievable? Any RDC or DICQ blockers you anticipate?"

---

### Part 3 — Evidence Standards Lock (12–18 min)

**Speaker**: CTO + Security lead (if available)

**Slides/Content:**

This is the **critical technical alignment**. Show samples, discuss edge cases, lock decisions.

1. **Digital Signature Equivalent: LogicalSignature Format**

   **Current Implementation** (v1.3, in production):

   ```
   LogicalSignature {
     hash: "sha256(canonical_json(event) + previous_hash)",
     operatorId: "uid from request.auth.uid",
     ts: "firestore server timestamp"
   }
   ```

   **Auditor Questions & Answers (pre-drafted):**

   | Q                                             | Answer                                                                                                                                            | Rationale                                                                                                                          |
   | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
   | Is LogicalSignature acceptable for DICQ 4.4?  | Yes, per RDC 978 §5.3 (tamper-evident audit trail). Equivalent to digital signature if coupled with chainHash integrity check.                    | Non-repudiation via operatorId (employee ID in system); immutability via SHA-256 chain.                                            |
   | Do you need biometric signature?              | Current: password-protected + LogicalSignature. Biometric upgrade in v1.5 (mobile auth). For regulatory data today, password + hash = sufficient. | DICQ doesn't mandate biometric; RDC 978 §5.3 says "legible operator identification" — operatorId meets this.                       |
   | External notarization (timestamp authority)?  | Not required for internal audit trail (compliance baseline). External signing for laudos shared with patients (Phase 5) uses timestamp API.       | DICQ focuses on internal lab audit trail integrity, not external certification. Scaling decision if NOTIVISA prod adds constraint. |
   | Can auditor trust Firestore native timestamp? | Yes. Firestore server-side timestamps are cryptographically secure, part of Google Cloud's audit trail, and accepted by ISO 27001 auditors.       | We don't manipulate the timestamp on client; it's server-set.                                                                      |

   **Show Live Sample:**
   - Open a signed laudo PDF → show LogicalSignature in metadata
   - Show audit trail event → demonstrate chainHash chain (3 events, each hash = previous + current)
   - Auditor verifies: "Yes, I can see operator ID + timestamp + hash integrity check"

2. **Audit Trail Immutability: ChainHash Protocol**

   **Current Implementation** (v1.3):

   ```
   event[0]: { ..., hash: SHA256(json(event[0])) }
   event[1]: { ..., hash: SHA256(json(event[1]) + hash[0]) }
   event[2]: { ..., hash: SHA256(json(event[2]) + hash[1]) }
   ```

   **Auditor Questions:**

   | Q                                      | Answer                                                                                                                                                                                 | Evidence                                                                        |
   | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
   | Is Firestore `delete` ever allowed?    | NO. RN-06 (soft-delete only). Deleted documents remain with `deletadoEm` timestamp + reason.                                                                                           | Firestore rules block `delete` operation.                                       |
   | Can operator modify historical events? | NO. Firestore rules block write to event[n] if n < current. Events are append-only.                                                                                                    | Rules: `allow write: if !exists(resource.data)` (create-only).                  |
   | If firestore.rules are compromised?    | Catastrophic but same risk as any audit system. Mitigation: rules reviewed externally (this call), Cloud Audit Logs backup to Cloud Storage (cold archive), quarterly security review. | Rule files in source control, gated deploy process, 24h monitoring post-deploy. |

   **Auditor Decision**: "ChainHash + append-only rules acceptable as tamper-evidence? ✓ or needs adjustment?"

3. **Document Versioning (SGD Naming Convention)**

   **Current Scheme** (v1.3):

   ```
   MQ-HMATOLOGIA-2026-05-07-v1.0-APPROVED.pdf
   PQ-COLETA-SANGUE-2026-05-07-v1.1-REVIEW.pdf
   IT-SAUDE-OCUPACIONAL-2026-05-07-v1.0-OBSOLETE.pdf
   ```

   **Fields:**
   - Document type (MQ/PQ/IT/FR/POL)
   - Document name
   - Date drafted
   - Version (v1.0, v1.1, etc.)
   - Status (DRAFT, REVIEW, APPROVED, OBSOLETE)

   **Auditor Questions:**
   | Q | Answer | Notes |
   |---|--------|-------|
   | Is semver (v1.0) sufficient? | Yes. Major = approval cycle, Minor = editorial changes. DICQ 4.3 accepts this. | Labclin internal convention already. |
   | What triggers a version bump? | Major: board approval. Minor: typo, reference update (no control change). Auditor notified on major bump only. | RDC 978 Art. 115 requires "controlled documents" — this satisfies. |
   | How many versions retained? | All (immutable SGD). Obsolete marked + reason logged. | Drive importer preserves version history. |

   **Auditor Decision**: "Naming + versioning acceptable? ✓ or adjust?"

4. **Raw Data Access & Retention**

   **Policy** (drafted for v1.4 Phase 1):
   - **Retention**: 5 years minimum (RDC 978 Art. 115)
   - **Firestore primary storage**: all data live in Firestore (hot)
   - **Cloud Storage cold archive**: daily export snapshots, encrypted, 7-year retention (compliance buffer)
   - **Auditor access**: read-only Firestore dataset export (via Cloud Console) + Cloud Storage cold archive
   - **Data destruction**: after 5 years + audit closure, soft-delete flag + Cloud Storage expiry rule

   **Auditor Questions:**
   | Q | Answer |
   |---|--------|
   | Can auditor access raw Firestore data? | Yes. We provide read-only GCP service account for auditor use during audit window (60 days). |
   | Export format for offline review? | JSON-LD + CSV per collection. Timestamps in UTC ISO 8601. LogicalSignature integrity verifiable offline. |
   | If data is deleted, how do you prove it existed? | We don't after 5 years. During audit window, all data is live + read-only locked. After closure, destruction date logged. |

   **Auditor Decision**: "Retention + access policy acceptable? ✓ or needs written SLA?"

5. **RT (Responsible Technician) Signature & Approval Flows**

   **Current** (v1.3 → Phase 0):
   - RT designates via SGQ document (IT-DESIGNACAO-RT)
   - RT signs documents via LogicalSignature (password + 2FA on login)
   - RT cannot modify signed documents (Firestore rules enforce)
   - Audit trail shows: who signed, when, what changed

   **Phase 0 New**: `turnos` module adds supervisor shift signatures (same LogicalSignature pattern)

   **Auditor Questions:**
   | Q | Answer |
   |---|--------|
   | Is RT password-only sufficient? | Yes, coupled with LogicalSignature + audit trail. Biometric upgrade in v1.5. | DICQ/RDC don't mandate biometric today; password + audit = compliant. |
   | Does RT need a certificate-based signature? | No, not required. LogicalSignature is the certificate equivalent (non-repudiation via operatorId). | Scaling decision if ANVISA auditors later request PKI. |
   | Who can override RT signature? | No one. Docs are immutable after RT approval. Change = new version. | RDC 978 forbids modification of signed docs. |

   **Auditor Decision**: "RT signature flows acceptable? ✓ or needs additional safeguards?"

---

### Part 4 — RFI Cadence & Escalation (8–12 min)

**Speaker**: QA Lead + CTO

**Slides/Content:**

Lock the operational protocol for the next 22 weeks. This prevents scope creep + decision delays.

1. **RFI Submission Channel**

   **Recommended**: Shared SGD folder (`AUDITOR-RFI-INBOX`) + email notification
   - Folder structure:
     ```
     AUDITOR-RFI-INBOX/
       2026-05/
         RFI-001-LogicalSignature-Format.md
         RFI-002-Personnel-Dossiê-Scope.md
       2026-06/
         RFI-003-...
     ```
   - Each RFI: 1 document with template fields (see below)
   - Email: QA Lead forwards RFI link to auditor + gives summary

   **Auditor Preference?** Ask during call. Alternatives:
   - Weekly digest email (Sunday EOD) with all RFIs batched
   - Ad-hoc per item (as it arises)
   - Scheduled 30-min biweekly sync call (vs. async RFI)

2. **RFI Template**

   ```
   # RFI-XXX: [Short Title]

   **Date Submitted**: 2026-05-15
   **Due By**: 2026-05-22 (5 business days standard)
   **Requirement ID**: REQ-401 / DICQ 4.12
   **Phase**: Phase 4
   **Priority**: 🔴 Critical | 🟡 High | 🟢 Normal

   ## Question
   [Specific auditor question or evidence request]

   ## Background
   [Why this matters + context]

   ## Evidence Attached
   [Links to artifacts / production samples / spec docs]

   ## Decision Needed
   [What approval/clarification would unblock us?]

   ## Proposer Response (for auditor)
   [Our answer — filled by CTO/QA Lead before sending]
   ```

3. **SLA: 5 Business Days**
   - **Standard**: RFI submitted Mon → response by next Mon EOD
   - **Urgent** (🔴): RFI submitted Mon → response by Wed EOD (3 days)
   - **Extension** (by mutual agreement): written request + new date

   **Escalation Path:**
   - Day 3 (no response): QA Lead sends reminder email
   - Day 5 (no response): CTO calls auditor directly
   - Day 7 (no response): escalate to Labclin board (assumes auditor unable to engage; may trigger contingency plan)

   **Auditor Comfort?** "Can you commit to 5-day response SLA? If not, what's your capacity?"

4. **Batch Frequency**
   - **Recommended**: Weekly digest on Sunday EOD (batches ~3–5 RFIs per week)
   - **Rationale**: Reduces notification overhead; auditor can batch review
   - **Exception**: 🔴 Critical items (blocking Phase entry) submitted + flagged separately with 2-day SLA

   **Auditor Preference?** Options:
   - [ ] Weekly digest
   - [ ] Ad-hoc (as items arise)
   - [ ] Biweekly 30-min sync call (auditor leads RFI discussion + decisions together)

5. **RFI Archive & Decision Log**
   - All RFIs + responses archived in SGD (historical record for external auditors in Oct)
   - Decision log published weekly: "RFI-001: ✅ ACCEPTED | RFI-002: 🟡 CONDITIONAL | RFI-003: ⏸️ DEFERRED"
   - Auditor signs off on decision log (email confirmation sufficient)

**Auditor Checkpoint**: "Does this RFI protocol work for you? Any modifications?"

---

### Part 5 — DICQ 88% Target & Audit-Ready Timeline (6–10 min)

**Speaker**: CTO

**Slides/Content:**

Reaffirm the target + confirm auditor's confidence in the plan.

1. **DICQ 88% Achievable by Aug 15?**

   **Rationale:**
   - v1.3: 78.5% (baseline established, 0 execution risk)
   - Phase 0 (May 7–16): +3–4% via turnos + lab-apoio + risks (RDC blockers, low execution risk)
   - Phases 1–9 (May 17–Sep 1): +6–7% via CAPA closure + portals + pré-analytic + pós-analytic + governance formalization (medium risk, 22 weeks, 4 parallel streams)
   - Buffer (Sep 1–Aug 15): 2 weeks for unforeseen rework
   - **Expected**: 88.5% ± 2% (lower bound 86%, upper bound 91%)

   **Risk factors:**
   - [ ] Auditor unavailable (mitigated: async RFI + external consultant backup)
   - [ ] RDC article 204 (NOTIVISA prod) slips (mitigated: sandboxed in v1.4, prod deferred to v1.4.1)
   - [ ] Multi-equipment validation (Phase 10) overruns (mitigated: 2-week buffer)
   - [ ] IA OCR (Phase 8) unreliable (mitigated: Gemini Vision baseline, fine-tuning deferred)

2. **External Audit Window: Oct/Nov 2026**
   - **Audit-ready date**: Aug 15, 2026 (70 days before external audit)
   - **Auditor notification**: Aug 1 (30 days pre-audit notice per DICQ contract)
   - **Evidence prep**: Aug 15–Sep 30 (auditor review of artifacts, any pre-audit RFIs)
   - **On-site audit**: Oct/Nov (estimated 2 weeks, 1–2 auditors per DICQ protocol)
   - **Post-audit**: Nov/Dec (DICQ decision + accreditation ceremony if approved)

   **Labclin Milestone**: "We'll have software 100% ready by Aug 15. You'll have 6 weeks to review + ask pre-audit RFIs."

3. **What "Audit-Ready" Means**
   - ✅ All 25+ modules deployed + live in production
   - ✅ 88%+ DICQ coverage (every block ≥75%, most ≥90%)
   - ✅ 100% RDC mandatory articles covered
   - ✅ 0 P0 security findings (pre-audit security review completed)
   - ✅ Smoke test suite (100% critical flows passing)
   - ✅ Evidence bundle prepared (samples of audit trails, signed laudos, risk matrix, etc.)
   - ✅ Training complete (all operators certified in new workflows)
   - ✅ 24h Cloud Logs baseline established (no anomalies)

**Auditor Question**: "Do you agree this timeline is realistic? What might cause you to push back?"

---

### Part 6 — Open Questions & Concerns (5–10 min)

**Facilitator**: CTO

**Format**: Auditor leads; CTO + QA Lead answer. Document all questions + answers in minutes.

**Pre-Drafted Questions (if auditor doesn't surface others):**

1. **LogicalSignature rejection scenario**: If you determine LogicalSignature is NOT acceptable for DICQ 4.4, what's the adjustment we need to make? (E.g., external timestamp authority? Certificate-based signature?)

2. **Firestore rules compromise**: In an audit, how would you verify that our Firestore rules actually enforce append-only + chainHash integrity? (Answer: rules code + Cloud Audit Logs export + third-party security review.)

3. **Multi-equipment validation**: DICQ requires ≥3 instruments per analyte to claim "multi-equipment" support. Phase 10 includes validation. Is certification per instrument or per analyte? (Answer: per analyte type per instrument.)

4. **NOTIVISA sandbox vs. prod**: Phase 7–8 implements NOTIVISA sandbox (non-production gov API). Does this satisfy RDC 978 Art. 204, or must we have prod integration before audit? (Answer: sandbox sufficient for audit; prod integration is Phase 8 stretch → v1.4.1.)

5. **Personnel dossiê consolidation**: Phase 1 begins consolidating 5.1.9 (single personnel record). What if Labclin's HR system is separate from HC Quality? (Answer: HC Quality is the source-of-truth for regulatory files; HR system is HR-only; we sync on login.)

6. **Patient consent (LGPD Art. 8)**: Phase 0 formalizes LGPD policy (POL-LGPD-001) but Phase 5 (patient portal) is first time patient interacts with system. How do you want to handle retroactive consent? (Answer: during portal MVP (Phase 5), we show consent form on first login + log acceptance; pre-portal, consent is implicit in lab referral + DICQ privacy policy already in physical lab.)

**Action**: QA Lead notes all Q&A. These become "Auditor Interpretation" column in DICQ matrix + RFI archive.

---

### Part 7 — Checkpoint & Close (2–5 min)

**Facilitator**: CTO

**Closing Steps:**

1. **Recap key outcomes** (1 min)
   - Phase 0 scope confirmed ✓
   - Evidence standards locked ✓
   - RFI cadence agreed (5-day SLA) ✓
   - DICQ 88% timeline acceptable ✓
   - Audit-ready Aug 15, external Oct/Nov ✓

2. **Next Steps** (1 min)
   - [ ] Auditor provides written confirmation email (by EOD tomorrow, May 11)
   - [ ] QA Lead publishes meeting minutes in SGD + sends email summary to auditor for review
   - [ ] CTO schedules end-of-Wave-1 checkpoint (May 31, 30-min sync)
   - [ ] Phase 1 kickoff authorization: green light by May 17 (if auditor email confirms)

3. **Comms Channel Lock-In** (1 min)
   - Primary email: [QA Lead email]
   - Backup: [CTO email]
   - SGD folder: AUDITOR-RFI-INBOX (shared with auditor read-write)
   - Escalation call: CTO direct (+55 11 XXXX-XXXX) if SLA missed

4. **Confirm Next Sync**
   - Date: May 31, 2026 (end of Wave 1)
   - Duration: 30 min
   - Topic: Phase 1 summary + Wave 2 preview + any mid-stream RFIs

5. **Thank You & Formal Closing**
   - "Thank you for your partnership in this audit-readiness journey. We're confident in Aug 15 target."
   - Offer any follow-up support (e.g., artifact clarification, demo extension)

---

## Post-Call Deliverables (T+1 Day)

### 1. Meeting Minutes (QA Lead)

- **File**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-STRATEGY-MINUTES.md`
- **Contents**:
  - Attendees + date + duration
  - Agenda recap
  - Key decisions (by section):
    - ✅ LogicalSignature accepted? Y/N + auditor conditions
    - ✅ ChainHash + append-only rules accepted? Y/N + auditor conditions
    - ✅ SGD versioning acceptable? Y/N + adjustments
    - ✅ Retention + access policy locked? Y/N + SLA
    - ✅ RT signature flows acceptable? Y/N + upgrade timeline
  - RFI cadence (5-day SLA, weekly digest vs. ad-hoc)
  - All open questions + auditor answers
  - Action items (by owner + due date)
  - Next checkpoint: May 31 (30-min sync)

### 2. Auditor Pre-Approval Email (CTO sends, auditor confirms)

- **Email subject**: `HC Quality v1.4 — Auditor Pre-Alignment Confirmed`
- **Body** (short, 5–7 bullets):
  - ✅ Auditor confirms Phase 0 scope (4 RDC blockers) sufficient
  - ✅ DICQ 88% target + Aug 15 audit-ready timeline acceptable
  - ✅ Evidence standards locked (LogicalSignature, chainHash, SGD naming, retention policy)
  - ✅ RFI cadence: 5-day SLA, weekly digest (Sundays)
  - ✅ Phase 1 kickoff approved: May 17, 2026
  - Next sync: May 31, 30-min checkpoint
- **Auditor action**: Reply "Confirmed" or provide corrections within 24h

### 3. Update PROJECT.md & STATE.md (CTO)

- **PROJECT.md**: Add section "Auditor Alignment"

  ```
  ## Auditor Pre-Alignment (Phase 0b)

  **Status**: ✅ COMPLETE (May 10, 2026)
  **Auditor**: [Name] ([Organization])
  **Key Decision**: LogicalSignature + chainHash accepted as tamper-evidence
  **Evidence Standards**: Locked per meeting minutes
  **RFI Cadence**: 5-day SLA, weekly digest (Sundays)
  **Next Checkpoint**: May 31 (Wave 1 end review)
  **Phase 1 Gate**: Unblocked (May 17 kickoff approved)
  ```

- **STATE.md**: Add
  ```
  ## Auditor Alignment Status
  **auditor_alignment**: CONFIRMED
  **auditor_name**: [Name]
  **auditor_organization**: [Org]
  **evidence_standards_locked**: Y
  **rfi_sla**: 5 business days
  **audit_ready_target**: 2026-08-15
  **external_audit_window**: Oct/Nov 2026
  **dicq_target**: 88%+
  **phase_1_gates**: [✅ Auditor pre-approval]
  **last_update**: 2026-05-10
  ```

### 4. DICQ Coverage Matrix Update (QA Lead)

- Add "Auditor Interpretation" column to `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md`
- Fill in any auditor-specific guidance (e.g., "LogicalSignature is acceptable for 4.4 per auditor May 10 call")
- Cross-reference RFI archive (RFI-001 = LogicalSignature decision, etc.)

### 5. Risk Register Update (QA Lead)

- Mark **RISK-402** (auditor unavailable) as **RESOLVED**
- Add **RISK-403** (evidence standards conflict mid-phase) with LOW probability (locked today)
- Document contingency (async RFI for any Phase 1+ conflicts)

---

## Auditor Pre-Alignment Sign-Off Template

**File**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-SIGN-OFF.md`

```markdown
# Auditor Pre-Alignment Sign-Off

**Date**: May 10, 2026  
**Call Attendees**: [Auditor Name], [Auditor Title] | [CTO], [QA Lead], [RT Labclin]  
**Duration**: 60 minutes

---

## Alignment Confirmations

**1. Phase 0 Scope (RDC Blockers)**

- [ ] ✅ Auditor confirms: 4 RDC blockers (turnos, LGPD, lab-apoio, risks) are sufficient to unlock Phase 1
- [ ] ✅ Auditor confirms: soft-delete + audit trail handling is RDC-compliant

**Comment**: **************\_**************

---

**2. DICQ 88% Target + Timeline**

- [ ] ✅ Auditor agrees: DICQ 78.5% → 88%+ is achievable by Aug 15
- [ ] ✅ Auditor agrees: external audit Oct/Nov 2026 timeline acceptable
- [ ] ✅ Auditor confirms: no DICQ articles will be re-interpreted post-Phase 0 that would invalidate Phase 0 work

**Comment**: **************\_**************

---

**3. Evidence Standards Locked**

**3.1 LogicalSignature (Digital Signature Equivalent)**

- [ ] ✅ Auditor accepts: LogicalSignature { hash: SHA256, operatorId, ts } as tamper-evidence
- [ ] 🟡 Conditional: Auditor requests [specify adjustment: biometric?, external timestamp authority?]
- [ ] 🔴 Rejected: Auditor requires [specify alternative approach]

**Auditor Condition**: **************\_**************

---

**3.2 ChainHash + Append-Only Audit Trail**

- [ ] ✅ Auditor accepts: chainHash integrity + Firestore append-only rules as immutability guarantee
- [ ] 🟡 Conditional: Auditor requires additional safeguard [specify: cold archive, quarterly verification, etc.]
- [ ] 🔴 Rejected: Auditor requires [specify alternative]

**Auditor Condition**: **************\_**************

---

**3.3 SGD Document Versioning**

- [ ] ✅ Auditor accepts: DICQ naming (type-name-date-version-status) + semver (v1.0, v1.1)
- [ ] 🟡 Conditional: Auditor prefers [specify: date format, version scheme, etc.]

**Auditor Condition**: **************\_**************

---

**3.4 Data Retention & Auditor Access**

- [ ] ✅ Auditor accepts: 5-year hot storage (Firestore) + 7-year cold archive (Cloud Storage)
- [ ] ✅ Auditor accepts: read-only GCP service account for auditor use during audit window
- [ ] 🟡 Conditional: Auditor requests [specify: export format, access frequency, etc.]

**Auditor Condition**: **************\_**************

---

**3.5 RT (Responsible Technician) Signature**

- [ ] ✅ Auditor accepts: password-protected LogicalSignature (biometric upgrade in v1.5)
- [ ] 🟡 Conditional: Auditor requires [specify: certificate-based signature, multi-factor auth, etc.]

**Auditor Condition**: **************\_**************

---

**4. RFI Cadence & SLA**

- [ ] ✅ Auditor commits to **5 business day SLA** for RFI responses
  - Standard: RFI submitted Mon → response by Fri EOD
  - Urgent (🔴): RFI submitted Mon → response by Wed EOD
  - Extension: by mutual written agreement
- [ ] ✅ Auditor prefers: **[Weekly Digest | Ad-Hoc | Biweekly Sync Call]**
- [ ] ✅ RFI submission channel: SGD folder `AUDITOR-RFI-INBOX` + email notification

**Auditor Signature**: ************\_************ **Date**: ****\_****

---

**5. No Blocking Concerns**

- [ ] ✅ Auditor confirms: no show-stoppers identified that would block Phase 0 or Phase 1 entry
- [ ] 🟡 Caution: Auditor flags [specify risk items to monitor closely]
- [ ] 🔴 Critical Issue: [describe blocker + required remediation]

**Auditor Comment**: **************\_**************

---

## Next Checkpoints

| Date         | Duration | Owner         | Topic                                              |
| ------------ | -------- | ------------- | -------------------------------------------------- |
| May 31, 2026 | 30 min   | CTO + Auditor | Wave 1 completion review + Wave 2 preview          |
| Jun 30, 2026 | 30 min   | CTO + Auditor | Phase 2–3 summary + any mid-stream RFIs            |
| Aug 1, 2026  | 60 min   | CTO + Auditor | Audit prep final review (30 days pre-audit notice) |

---

## Authority & Approval

| Role                | Name               | Signature          | Date     |
| ------------------- | ------------------ | ------------------ | -------- |
| **Auditor Lead**    | ********\_******** | ********\_******** | **\_\_** |
| **Labclin CTO**     | ********\_******** | ********\_******** | **\_\_** |
| **Labclin QA Lead** | ********\_******** | ********\_******** | **\_\_** |

---

## Notes

[Auditor + CTO room for additional comments / decisions / exceptions]

---

---

---
```

---

## Contingency Plan — If Auditor Unavailable (Async Path)

**Trigger**: Auditor cannot meet within Week 1 (May 7–13)

**Steps**:

1. **Submit written RFI bundle** (CTO sends email)
   - Subject: `HC Quality v1.4 — Auditor Alignment RFI (Async Path)`
   - Contents:
     - Executive summary (v1.3 recap + v1.4 vision, 1 page)
     - 7 open questions (LogicalSignature, chainHash, versioning, retention, RT signature, NOTIVISA, personnel dossiê)
     - DICQ coverage matrix + RDC matrix
     - Evidence samples (PDF links to audit trails, signed laudos, risk matrix)
     - Proposed RFI SLA: **5 business days** to first response
   - Due date: 5 business days from receipt

2. **Engage external consultant** (QA Lead responsible)
   - Hire regulatory consultant (1–2 days) to validate Phase 0 scope independently
   - Consultant reviews evidence standards, confirms DICQ/RDC interpretation
   - Report: "Phase 0 RDC blockers are sufficient / need adjustment [specify]"
   - Cost: budget ~$2k–3k (approval from Labclin board)

3. **Flag RISK-402 as ACTIVE**
   - Update `v1.4-RISK-REGISTER.md`: Auditor alignment async (increased latency + interpretation risk)
   - Weekly re-attempt: CTO calls auditor every Monday until sync secured
   - Fallback: proceed with conservative interpretation of all RDC articles

4. **Proceed with Phase 0** (no blockers there)
   - Deploy 4 RDC blocker modules (turnos, LGPD, lab-apoio, risks)
   - Smoke tests + Cloud Logs 24h baseline
   - Pause Phase 1 entry pending async RFI response

5. **Phase 1 Kickoff Gate**
   - Minimum: **written email confirmation** from auditor agreeing Phase 0 scope + evidence standards
   - Acceptable: "Confirmed per RFI responses [date]"
   - Unacceptable: radio silence > 14 days (escalate to Labclin board + consider external consultant full audit)

---

## Success Metrics

| Metric                      | Target                                           | Verification                             |
| --------------------------- | ------------------------------------------------ | ---------------------------------------- |
| Auditor meeting scheduled   | May 10 (within Week 1)                           | Calendar invite confirmed by auditor     |
| Meeting executed            | 60–90 min sync                                   | Notes + recording archived               |
| LogicalSignature acceptance | ✅ Confirmed or adjusted                         | Minutes state auditor decision           |
| Evidence standards locked   | All 5 items (sig, chain, version, retention, RT) | Sign-off template completed              |
| RFI SLA agreed              | 5 business days                                  | Written confirmation email               |
| Phase 0 scope approved      | Auditor verbal confirmation                      | Email + sign-off template                |
| DICQ 88% timeline accepted  | Aug 15 audit-ready                               | Auditor acknowledges in minutes          |
| No blocking concerns        | Auditor confirms                                 | "No show-stoppers" statement in sign-off |
| Next checkpoint scheduled   | May 31                                           | Calendar invite sent                     |
| Phase 1 kickoff approved    | May 17                                           | Auditor pre-approval email received      |

---

## Risk & Mitigation

| Risk                                                       | Impact                                          | Probability | Mitigation                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| Auditor rejects LogicalSignature format                    | Critical — 5+ modules affected, rework 2+ weeks | Low         | External consultant pre-review, document auditor expectations in writing before Phase 0           |
| RFI SLA slips (>5 days)                                    | High — Phase gates delayed                      | Medium      | Weekly escalation call (CTO direct); external consultant backup                                   |
| Auditor interprets DICQ conservatively (adds requirements) | Medium — Phase scope inflates                   | Medium      | Lock all RFI responses in DICQ matrix "Auditor Interpretation" column; re-baseline after each RFI |
| Mid-phase auditor availability drops (illness, turnover)   | High — communication breaks                     | Low         | 30-min weekly async digest (email) + 2nd auditor contact identified upfront                       |
| External audit dates shift (Oct → Jan)                     | Medium — timeline pressure reduced              | Low         | Clarify during call; if shift happens, recalibrate Phase 9–13 timeline                            |

---

## Files Created / Updated

- **NEW**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-STRATEGY.md` (this file)
- **NEW**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-STRATEGY-MINUTES.md` (post-call)
- **NEW**: `.planning/phases/02-AUDITOR-PRE-ALIGNMENT-SIGN-OFF.md` (template, completed during call)
- **UPDATE**: `.planning/STATE.md` → add "auditor_alignment: CONFIRMED"
- **UPDATE**: `.planning/PROJECT.md` → add "Auditor Alignment" section
- **UPDATE**: `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md` → add "Auditor Interpretation" column
- **UPDATE**: `.planning/milestones/v1.4-RISK-REGISTER.md` → resolve RISK-402, add RISK-403

---

## Related Documents

- `.planning/milestones/v1.4-AUDITOR-ALIGNMENT-PLAN.md` — original draft (this file supersedes with end-to-end execution)
- `.planning/milestones/v1.4-PHASE-0-PLAN.md` — RDC blocker modules (Phase 0 timing locked here)
- `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md` — DICQ 88% trajectory (auditor interprets requirements)
- `.planning/milestones/v1.4-RDC-COVERAGE-MATRIX.md` — RDC 978 article mapping (auditor confirms completeness)
- `.planning/milestones/v1.4-RISK-REGISTER.md` — RISK-402 auditor alignment (resolved via this phase)
- `.planning/MILESTONES.md` → v1.4 entry links to this phase

---

## Owner & Approval

**Author**: CTO + QA Lead
**Status**: READY FOR EXECUTION
**Kick-off**: Week 1, May 8–10
**Expected Completion**: May 10 (call) + May 11 (deliverables)
