# NOTIVISA Integration Documentation — Deliverables Summary

**Delivery Date:** 2026-05-08  
**Comprehensive Architecture Package:** Complete  
**Status:** Ready for Phase 4 Deployment

---

## Documents Delivered

### 1. **NOTIVISA_INTEGRATION_ARCHITECTURE.md** (Primary Document)
**Status:** ✓ Complete  
**Purpose:** Comprehensive technical specification  
**Length:** ~7,000 words  

**Contents:**
- Executive summary (Phase 4–12 roadmap)
- Architecture overview (client → Cloud Functions → Firestore → Anvisa)
- API flow diagram (8 callable sequence)
- **All 8 Callable Functions Specification:**
  1. `notivisaDraftCreate` (form generation)
  2. `getNotivisaDraft` (draft retrieval)
  3. `approveNotivisaDraft` (RT signature)
  4. `submitNotivisa` (queue submission)
  5. `notivisaExportArchive` (auditor export)
  6. `notivisaSoftDelete` (soft delete)
  7. `notivisaWebhookHandler` (Anvisa callback, Phase 12+)
  8. `listNotivisaOutbox` (queue querying)
- Firestore data model (complete schema for all 3 collections)
- Queue processing strategy (exponential backoff algorithm, 5-min cycles)
- Error handling & retry logic (retryable vs. non-retryable classification)
- Security considerations (auth, tokens, rate limiting, signatures)
- RDC 978 Art. 66 compliance evidence
- DICQ compliance (audit trail, operator tracking, record integrity)
- Deployment checklist (pre/during/post)

**Audience:** Engineers, architects, auditors

---

### 2. **NOTIVISA_ARCHITECTURE_DIAGRAMS.md** (Visual Reference)
**Status:** ✓ Complete  
**Purpose:** ASCII diagrams for all flows and state machines  
**Length:** ~3,000 words

**Contents:**
1. **Client → Functions → Firestore Flow (Detailed)** — full request/response cycle with all functions annotated
2. **State Machine: NOTIVISA Entry Lifecycle** — status transitions (draft → approved → submitted → acknowledged/failed)
3. **Queue Processing: Exponential Backoff Timeline** — visual timeline showing retry schedule (1m → 5m → 15m → 45m → 120m)
4. **Authorization & Multi-Tenant Isolation** — layers of defense (auth → function check → lab membership → Firestore rules)
5. **Error Handling Decision Tree** — classification (retryable, non-retryable, escalation)
6. **Signature Verification Flow** — HMAC-SHA256 process for RT approval
7. **Webhook Signature Verification (Phase 12+)** — Anvisa callback verification
8. **Multi-Lab Architecture** — database partitioning for scalability (100+ labs)

**Audience:** Visual learners, architects, QA testers

---

### 3. **NOTIVISA_COMPLIANCE_MAPPING.md** (Regulatory)
**Status:** ✓ Complete  
**Purpose:** RDC 978 + DICQ compliance evidence matrix  
**Length:** ~2,500 words

**Contents:**
- **RDC 978 Art. 66 Coverage Matrix:**
  - Form generation compliance (Art. 6º schema, anonymization, disease codes)
  - 24h deadline enforcement (SLA tracking, escalation alerts)
  - Audit trail completeness (who/when/what/why/result)
  - Submission & receipt (Phase 12+)
  
- **DICQ 4.4 — Audit Trail Compliance:**
  - Audit log structure (append-only, immutable)
  - Immutability enforcement (Firestore rules)
  - Operator tracking (operatorId in every action)
  
- **DICQ 4.3 — Record Integrity:**
  - No overwrite pattern (soft-delete only, RN-06)
  - Signature protection (chainHash, ADR-0012)
  
- **Portaria 204/2016 MS — Disease Classification:**
  - 99 reportable diseases implemented
  - Lookup table structure
  
- **Compliance Audit Checklist:**
  - Pre-deployment verification
  - Post-deployment (Phase 4–12)
  
- **Auditor Sign-Off Template**

**Audience:** Auditors, regulatory affairs, compliance officers

---

### 4. **NOTIVISA_QUICK_REFERENCE.md** (Operations)
**Status:** ✓ Complete  
**Purpose:** Day-to-day operations guide  
**Length:** ~2,000 words

**Contents:**
- **At-a-Glance Flow** — visual summary of 8-step workflow
- **8 Callable Functions Summary** — quick specs (role, SLA, error codes)
- **Error Classification** — retryable vs. permanent with actions
- **Firestore Collections Quick Ref** — collection purposes, statuses, access
- **Supervisor Escalation Runbook** — Options A–D for common issues
- **Common Commands (CLI)** — Firestore queries, manual processor trigger, logs
- **Test Scenarios (Phase 4)** — 5 scenarios covering happy path, retries, errors, deadline, soft delete
- **Phase Transition Checklist** — Phase 4→8 and Phase 8→12
- **Contact & Escalation** — engineering, regulatory, auditors, Anvisa
- **Glossary** — 15+ key terms

**Audience:** Supervisors, RT staff, operations, support team

---

## Key Features Documented

### A. API Specification (Definitive)

**All 8 Callables Fully Specified:**
- Input/output schemas (Zod validation rules)
- Authorization requirements (role-based)
- Error codes (enumerated)
- Side effects (Firestore writes, audit logs, alerts)
- SLA/timeline
- Idempotency guarantees
- Examples (React hook usage pattern)

**Quality:** Production-ready, testable specifications

---

### B. Error Handling Strategy

**Comprehensive Classification:**
- **Retryable Errors:** 5xx, ETIMEDOUT, ECONNREFUSED
  - Backoff: 1m → 5m → 15m → 45m → 120m (5 attempts max)
  - Status: remains 'pending'
  - Escalation: none (automatic recovery)

- **Non-Retryable Errors:** 4xx, validation, auth
  - Backoff: none
  - Status: 'failed-permanent' immediately
  - Escalation: supervisor alert (SMS + email, Phase 8+)

- **Deadline Escalation:** >24h without ACK
  - Trigger: scheduled processor (every 5 min)
  - Status: escalatedToSupervisor=true
  - Escalation: supervisor alert with options for manual resolution

**Recovery Paths:** 4 supervisor options documented (auto-retry, manual fix, certificate renewal, manual submission)

---

### C. Security Model

**Multi-Layer Defense:**
1. **Request Auth:** Firebase ID token verified by Functions SDK
2. **Function-Level:** Custom claims (role, labIds) validated
3. **Lab Membership:** Query /labs/{labId}/members/{uid}
4. **Firestore Rules:** labId + role checks in rules
5. **Data Redundancy:** labId included in every document (prevents accidental cross-tenant)

**Token Management:**
- ID tokens issued by Firebase Auth (1h expiry, auto-refresh)
- Custom claims: role (RT, AUDITOR, admin, owner) + labIds
- Rate limiting: 50 submissions/lab/hour

**Signature Verification:**
- **Client Approvals:** HMAC-SHA256 over payload + operatorId + ts
- **Anvisa Webhooks:** HMAC-SHA256 over JSON body
- **Both:** Constant-time comparison (prevent timing attacks)

**Secret Management (Phase 12+):**
- Cloud Secret Manager for certificates, webhook secrets
- Pre-flight deployment gate validates all secrets provisioned
- Rotation policy: 90 days

---

### D. RDC 978 Art. 66 Compliance

**Full Compliance Chain:**
1. ✓ Form generation (Art. 6º schema, validated)
2. ✓ Patient anonymization (no PII in export)
3. ✓ Disease coding (99 Portaria 204/2016 codes)
4. ✓ Result recording (value, date, method)
5. ✓ RT approval (signature + chainHash)
6. ✓ 24h deadline (calculated, enforced, escalated if past)
7. ✓ Submission attempt (Phase 12+, with receipt code)
8. ✓ Audit trail (immutable, complete, operator-tracked)
9. ✓ Export for audit (CSV + JSON, 90-day retention)

**Evidence:** Complete from Phase 4 (form generation) through Phase 12+ (real API submission)

---

### E. DICQ Compliance (Audit Trail & Operator Tracking)

**4.4 Audit Trail:**
- ✓ Every action tagged with operatorId
- ✓ Timestamps server-side (not client)
- ✓ Action enumerated (CREATED, APPROVED, SUBMISSION_ATTEMPT, SOFT_DELETED, ESCALATION)
- ✓ Context recorded (details subcollection)
- ✓ All append-only (no update/delete after creation)
- ✓ Retention ≥90 days

**4.3 Record Integrity:**
- ✓ No unauthorized modifications (Firestore rules + soft-delete only)
- ✓ Signature protection (chainHash, ADR-0012)
- ✓ Append-only pattern (submissionAttempts[], auditLog[])

**4.1.2 Operator Tracking:**
- ✓ Every operator identified (request.auth.uid)
- ✓ Every action traced to operator
- ✓ Custom claims for role-based access

---

## Diagrams Included

### Flow Diagrams
1. Client → Cloud Functions → Firestore (full request cycle)
2. State machine (status lifecycle)
3. Exponential backoff timeline (retry schedule)
4. Authorization layers (defense-in-depth)
5. Error decision tree (classify & escalate)
6. Signature verification (HMAC-SHA256 process)
7. Webhook verification (Anvisa callback)
8. Multi-lab architecture (database partitioning)

### ASCII Quality
- Clean, readable ASCII art
- Color-compatible (no ANSI codes, standard terminal)
- Suitable for documentation, slides, training

---

## Implementation Files Referenced

**Core Callables:**
- `functions/src/modules/notivisa/callables/notivisaDraftCreate.ts`
- `functions/src/modules/notivisa/callables/approveNotivisaDraft.ts` (stub, follows pattern)
- `functions/src/modules/notivisa/callables/submitNotivisa.ts` (stub, follows pattern)
- `functions/src/modules/notivisa/callables/getNotivisaDraft.ts`
- `functions/src/modules/notivisa/callables/listNotivisaOutbox.ts`
- `functions/src/modules/notivisa/callables/notivisaExportArchive.ts`
- `functions/src/modules/notivisa/callables/notivisaSoftDelete.ts`
- `functions/src/modules/notivisa/callables/notivisaWebhookHandler.ts`

**Scheduled Functions:**
- `functions/src/modules/notivisa/crons/notivisaQueueProcessor.ts`
- `functions/src/modules/notivisa/crons/notivisaStatusCheck.ts` (Phase 8+)

**Shared:**
- `src/shared/notivisa.ts` (payload schema + formatter)
- `functions/src/shared/notivisa.ts` (duplicate for functions)

**Tests:**
- `functions/src/modules/notivisa/__tests__/notivisa.test.ts`
- `functions/src/__tests__/integration/notivisa.test.ts`
- `functions/src/__tests__/integration/notivisa-e2e.test.ts`

**ADRs:**
- `docs/adr/ADR-0014-notivisa-integration-sandbox-to-production.md`
- `docs/adr/ADR-0021-notivisa-queue-pattern.md`
- `docs/adr/ADR-0026-notivisa-queue-processing-async-append-only.md`

**Rules:**
- `.claude/rules/notivisa-firestore-rules.md`

---

## Quality Checklist

### Documentation
- [x] Comprehensive (covers all 8 functions + architecture)
- [x] Specification-grade (I/O schemas, error codes, SLAs)
- [x] Compliant (RDC 978 Art. 66 + DICQ 4.4 mapped)
- [x] Operational (runbooks, CLI commands, test scenarios)
- [x] Visual (8 detailed ASCII diagrams)
- [x] Reference (glossary, quick reference, contacts)

### Audience Coverage
- [x] Engineers (detailed architecture + code specs)
- [x] Architects (design decisions, trade-offs)
- [x] Auditors (compliance evidence matrix)
- [x] Supervisors (escalation runbook, operations guide)
- [x] QA/Testers (5 test scenarios, happy path to error cases)
- [x] RT Staff (quick reference, form workflow)

### Regulatory
- [x] RDC 978 Art. 66 fully mapped
- [x] DICQ 4.3–4.4 fully mapped
- [x] Portaria 204/2016 diseases referenced
- [x] Audit trail structure (immutable, operator-tracked, complete)
- [x] Compliance sign-off template included

---

## How to Use These Documents

### For Engineers
1. **Start:** `NOTIVISA_INTEGRATION_ARCHITECTURE.md` (Section 3: Callable specs)
2. **Visualize:** `NOTIVISA_ARCHITECTURE_DIAGRAMS.md` (Section 1: Client flow)
3. **Test:** `NOTIVISA_QUICK_REFERENCE.md` (Section "Test Scenarios")
4. **Reference:** `NOTIVISA_QUICK_REFERENCE.md` (Section "Common Commands")

### For Supervisors/RT
1. **Learn:** `NOTIVISA_QUICK_REFERENCE.md` (Section 1: At-a-Glance)
2. **Escalate:** `NOTIVISA_QUICK_REFERENCE.md` (Section "Supervisor Escalation Runbook")
3. **Test:** `NOTIVISA_QUICK_REFERENCE.md` (Section "Test Scenarios")

### For Auditors
1. **Audit:** `NOTIVISA_COMPLIANCE_MAPPING.md` (Section 2: Compliance Evidence)
2. **Verify:** `NOTIVISA_COMPLIANCE_MAPPING.md` (Section 8: Checklist)
3. **Sign-Off:** `NOTIVISA_COMPLIANCE_MAPPING.md` (Section 10: Template)

### For Architects/CTO
1. **Strategy:** `NOTIVISA_INTEGRATION_ARCHITECTURE.md` (Executive Summary)
2. **Design:** `NOTIVISA_ARCHITECTURE_DIAGRAMS.md` (All 8 diagrams)
3. **Trade-Offs:** `docs/adr/ADR-0014, ADR-0021, ADR-0026` (referenced in architecture)

---

## File Locations

All documents in `C:\hc quality\docs\`:

```
docs/
├── NOTIVISA_INTEGRATION_ARCHITECTURE.md       (Primary, 7,000 words)
├── NOTIVISA_ARCHITECTURE_DIAGRAMS.md         (Visual, 3,000 words)
├── NOTIVISA_COMPLIANCE_MAPPING.md             (Regulatory, 2,500 words)
├── NOTIVISA_QUICK_REFERENCE.md                (Operations, 2,000 words)
├── NOTIVISA_DELIVERABLES_SUMMARY.md           (This file)
├── adr/
│   ├── ADR-0014-notivisa-integration-sandbox-to-production.md
│   ├── ADR-0021-notivisa-queue-pattern.md
│   └── ADR-0026-notivisa-queue-processing-async-append-only.md
└── (existing files: ARCHITECTURE_REVIEW.md, etc.)
```

---

## Recommendations for Next Steps

### Phase 4 (May 20–June 30, 2026)
1. **Review:** Engineering team reviews `NOTIVISA_INTEGRATION_ARCHITECTURE.md` + diagrams
2. **Test:** Execute 5 test scenarios from `NOTIVISA_QUICK_REFERENCE.md`
3. **Deploy:** Follow deployment checklist in architecture doc
4. **Monitor:** Use Cloud Logs queries from quick reference guide
5. **Document:** Keep running "Phase 4 Completion Summary" in Obsidian

### Phase 8 (July 1–31, 2026)
1. **Parallel:** Begin certificate provisioning (legal/ops track)
2. **Update:** Keep quick reference updated with production learnings
3. **Review:** Auditor pre-audit review at mid-point (July 15)
4. **Prepare:** Draft Phase 12 implementation plan (Aug–Sept)

### Phase 12 (Aug 1–Sept 15, 2026)
1. **Integrate:** Real Anvisa API (update `submitNotivisaToAnvisaReal()`)
2. **Test:** Sandbox submissions to Anvisa test environment
3. **Deploy:** Production API endpoint activation
4. **Verify:** End-to-end (form → submission → receipt → export)
5. **Audit:** Full auditor review post-deployment

---

## Document Maintenance

**Update Frequency:**
- `NOTIVISA_INTEGRATION_ARCHITECTURE.md`: Phase boundaries (static)
- `NOTIVISA_QUICK_REFERENCE.md`: Quarterly (operational changes)
- `NOTIVISA_COMPLIANCE_MAPPING.md`: Annual (regulatory updates)

**Owner:** Engineering Lead + Regulatory Affairs

**Review Gate:** Every phase transition (Phase 4→8→12)

---

**Status:** ✓ Complete & Ready for Phase 4 Deployment  
**Date Delivered:** 2026-05-08  
**Audience:** Engineers, Supervisors, Auditors, RT Staff, QA  
**Compliance:** RDC 978 Art. 66 + DICQ 4.3–4.4  

---

## Quick Links

| Document | Purpose | Audience |
|----------|---------|----------|
| [NOTIVISA_INTEGRATION_ARCHITECTURE.md](./NOTIVISA_INTEGRATION_ARCHITECTURE.md) | Complete technical spec | Engineers, Architects |
| [NOTIVISA_ARCHITECTURE_DIAGRAMS.md](./NOTIVISA_ARCHITECTURE_DIAGRAMS.md) | Visual flows & state machines | Visual learners, QA |
| [NOTIVISA_COMPLIANCE_MAPPING.md](./NOTIVISA_COMPLIANCE_MAPPING.md) | Regulatory compliance | Auditors, Compliance |
| [NOTIVISA_QUICK_REFERENCE.md](./NOTIVISA_QUICK_REFERENCE.md) | Day-to-day operations | Supervisors, Support |
| [ADR-0014](./adr/ADR-0014-notivisa-integration-sandbox-to-production.md) | Sandbox-to-production strategy | Decision context |
| [ADR-0021](./adr/ADR-0021-notivisa-queue-pattern.md) | Queue & retry pattern | Architecture |
| [ADR-0026](./adr/ADR-0026-notivisa-queue-processing-async-append-only.md) | Async outbox pattern | Implementation |
