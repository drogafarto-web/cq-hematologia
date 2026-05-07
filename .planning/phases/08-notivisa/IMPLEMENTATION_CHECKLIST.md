---
phase: 8
type: implementation-checklist
duration: 14 days (2 weeks)
waves: 3 sequential waves
---

# Phase 8 Implementation Checklist — NOTIVISA Integration

**Kickoff:** 2026-06-02  
**Deploy:** 2026-06-16  
**Success Gate:** All items ✅ + 8/8 E2E flows passing

---

## Wave 1: Schema, Types & Services (Days 1–3)

### Shared Schemas & Validation

- [ ] Create `src/shared/schemas/notivisaPayload.ts`
  - [ ] `NotivisaPayloadSchema` (Zod, Art. 6º fields)
  - [ ] Input validation tests (4 specs: valid payload, missing field, invalid CRM, invalid disease code)
  - [ ] Type export: `NotivisaPayload`
  - [ ] Review by QA for completeness

- [ ] Create `src/shared/data/notifiableDiseases.ts`
  - [ ] 99-disease array (Portaria 204/2016)
  - [ ] `NOTIFIABLE_DISEASE_MAP` lookup
  - [ ] `isNotifiableDisease()` + `isUrgentDisease()` helpers
  - [ ] Unit tests (3 specs: valid code found, invalid code rejected, urgent flag correct)

- [ ] Create `src/shared/types/notivisaDraft.ts`
  - [ ] `NotivisaDraft` interface (matches Firestore schema)
  - [ ] Discriminated union for status ('draft' | 'approved' | 'rejected' | 'submitted' | 'acknowledged')
  - [ ] Docstring annotations per RDC 978 articles

### Firestore Service Layer

- [ ] Create `src/shared/services/notivisaService.ts`
  - [ ] `notivisaDraftCreate` callable wrapper
  - [ ] `approveNotivisaDraft` callable wrapper
  - [ ] `rejectNotivisaDraft` callable wrapper
  - [ ] Error handling (auth, validation, network)
  - [ ] Retry logic (exponential backoff, max 3 attempts)
  - [ ] Unit tests (6 specs: happy path, auth error, payload validation, network error, timeout)

- [ ] Update `firestore.rules` with NOTIVISA paths
  - [ ] `/labs/{labId}/notivisa-outbox/{docId}` rules
  - [ ] Subcollection rules (audit, submissions)
  - [ ] `_state/notivisa-chain` rules
  - [ ] Validate against existing rules (no conflicts)

### Audit & Chain Hash Utilities

- [ ] Create `src/shared/utils/notivisaAudit.ts`
  - [ ] `createNotivisaAuditLog()` helper
  - [ ] Chain hash verification (prev → current)
  - [ ] Unit tests (3 specs: chain validation, hash format, immutability)

**Deliverable:** ✅ All types, schemas, and client-side services ready for Cloud Functions integration

---

## Wave 2: Cloud Functions (Days 4–7)

### Callable Function: `notivisaDraftCreate`

- [ ] Implement `functions/src/modules/notivisa/notivisaDraftCreate.ts`
  - [ ] Request type definition + validation
  - [ ] Auth guard (SuperAdmin OR lab owner/admin)
  - [ ] Disease code whitelist check
  - [ ] Payload schema validation (Zod)
  - [ ] Fetch lab metadata (facilityCode, name)
  - [ ] Generate LogicalSignature (chainHash, ts, operatorId)
  - [ ] Write atomically to Firestore (batch: draft + audit + chain state)
  - [ ] Return draftId + deadline
  - [ ] Error handling (8 paths: unauthenticated, unauthorized, disease code invalid, schema validation fail, lab not found, database error, timeout, quota exceeded)
  - [ ] Unit tests (6 specs: happy path, each error path)
  - [ ] Integration tests (3 specs: with real Firestore emulator, rule enforcement, audit trail)

- [ ] Register in `functions/src/index.ts`
  - [ ] Export `exports.notivisaDraftCreate = notivisaDraftCreate;`
  - [ ] Verify import paths

### Callable Function: `approveNotivisaDraft`

- [ ] Implement `functions/src/modules/notivisa/approveNotivisaDraft.ts`
  - [ ] Request type (labId, draftId, approvalNotes)
  - [ ] Auth guard (RT role OR SuperAdmin)
  - [ ] Fetch draft, validate status == 'draft'
  - [ ] Generate new LogicalSignature (includes approval metadata)
  - [ ] Update status → 'approved', set approvedBy, approvedAt
  - [ ] Write atomically (batch: update draft + audit log + chain state)
  - [ ] Return approval confirmation
  - [ ] Error handling (6 paths: unauthenticated, not-RT, draft not found, invalid status, signature error, db error)
  - [ ] Unit tests (5 specs: happy path, each error path)
  - [ ] Integration tests (2 specs: emulator, rule enforcement)

- [ ] Register in `functions/src/index.ts`

### Callable Function: `rejectNotivisaDraft`

- [ ] Implement `functions/src/modules/notivisa/rejectNotivisaDraft.ts`
  - [ ] Request type (labId, draftId, rejectionReason)
  - [ ] Auth guard (RT role OR SuperAdmin)
  - [ ] Fetch draft, validate status == 'draft'
  - [ ] Generate new LogicalSignature (includes rejection metadata)
  - [ ] Update status → 'rejected', set rejectedBy, rejectedAt, rejectionReason
  - [ ] Write atomically (batch: update draft + audit log + chain state)
  - [ ] Return rejection confirmation
  - [ ] Error handling (6 paths: same as approve)
  - [ ] Unit tests (5 specs: happy path, each error path)
  - [ ] Integration tests (2 specs: emulator, rule enforcement)

- [ ] Register in `functions/src/index.ts`

### Cron Job: `notivisaStatusCheck` (v1.4 Placeholder)

- [ ] Implement `functions/src/modules/notivisa/notivisaStatusCheckCron.ts`
  - [ ] Scheduled: every 30 minutes
  - [ ] v1.4 logic: query approved drafts, count ready for submission
  - [ ] Log readiness (no actual submission)
  - [ ] Placeholder stub for v1.5 Anvisa API calls
  - [ ] Error handling (graceful failure, alerts SuperAdmin)
  - [ ] Unit tests (2 specs: happy path, error handling)

- [ ] Register in `functions/src/index.ts` with `pubsub.schedule`

### Functions Deployment & Testing

- [ ] Build functions: `cd functions && npm run build`
  - [ ] Zero TypeScript errors
  - [ ] Zero ESLint warnings (or documented baseline)
  
- [ ] Test locally: `firebase emulators:start`
  - [ ] All 18 callable tests PASS
  - [ ] All 4 integration tests PASS
  - [ ] Cron job triggers without error

- [ ] Code review by CTO
  - [ ] Verify auth guards
  - [ ] Verify chainHash logic
  - [ ] Verify batch atomicity
  - [ ] Verify error messages (no sensitive info leakage)

**Deliverable:** ✅ All callables tested, passing, ready for staging deploy

---

## Wave 3: UI, E2E Tests & Integration (Days 8–14)

### RT Portal UI Components

- [ ] Create `src/features/portal-rt/components/NotivisaDraftPanel.tsx`
  - [ ] Status badge (overdue/urgent/normal color coding)
  - [ ] Patient info display (anonymized: initials, sex, age)
  - [ ] Test method, result value, dates
  - [ ] Physician info, CRM state validation
  - [ ] Approval form (text area for notes)
  - [ ] Rejection form (conditional render, text area for reason)
  - [ ] Loading states (isApproving, isRejecting)
  - [ ] Error toast notifications
  - [ ] Dark-first WCAG AA styling
  - [ ] Component tests (5 specs: render, approval flow, rejection flow, error handling, accessibility)

- [ ] Create `src/features/portal-rt/hooks/useNotivisaDrafts.ts`
  - [ ] Real-time listener on `notivisa-outbox` collection
  - [ ] Filter by status (show drafts + approved only for RT)
  - [ ] Sort by deadline (urgent first)
  - [ ] Unsubscribe on unmount
  - [ ] Hook tests (3 specs: initial load, real-time updates, error state)

- [ ] Create `src/features/portal-rt/views/NotivisaQueueView.tsx`
  - [ ] Queue list (NotivisaDraftPanel × N)
  - [ ] Status counter (drafts, approved, overdue)
  - [ ] Filter toolbar (status, disease code, date range)
  - [ ] Empty state (no drafts)
  - [ ] Pagination (max 10 per page)
  - [ ] View tests (4 specs: list render, pagination, filters, empty state)

### PDF Export Service

- [ ] Implement `src/features/portal-rt/services/notivisaExportPdf.ts`
  - [ ] Generate PDF with pdfkit
  - [ ] Include all draft fields (disease, patient anon, test, physician, approval)
  - [ ] Include audit trail (chainHash, operator, ts)
  - [ ] Include "v1.4 Sandbox" disclaimer
  - [ ] Footer with "v1.5 will enable Anvisa API submission"
  - [ ] Unit tests (2 specs: happy path, error handling)

- [ ] Create `src/features/portal-rt/hooks/usePDFExport.ts`
  - [ ] Wrapper hook around PDF service
  - [ ] Loading state + error handling
  - [ ] Download trigger (button → PDF file download)
  - [ ] Hook tests (2 specs: successful export, error handling)

### E2E Test Suite (8 Critical Flows)

- [ ] Create `src/__tests__/notivisa-integration.e2e.ts`
  - [ ] **E2E-01: Auto-create NOTIVISA draft from critical result**
    - Precondition: Critical syphilis result in Phase 6
    - Action: Trigger handleCriticalResult()
    - Assert: Draft exists in notivisa-outbox, status='draft', chartHash length=64
    - Cleanup: Delete test lab + drafts
  
  - [ ] **E2E-02: RT approval workflow + signature sealing**
    - Precondition: Draft in status='draft'
    - Action: Call approveNotivisaDraft() as RT
    - Assert: Status='approved', approvedBy set, chainHash updated, audit log created
    - Cleanup: Delete draft
  
  - [ ] **E2E-03: Audit trail immutability**
    - Precondition: Draft with approval history
    - Action: Try to update audit log via Firestore rules
    - Assert: Rules reject (permission-denied)
    - Cleanup: Delete draft
  
  - [ ] **E2E-04: RT rejection with reason**
    - Precondition: Draft in status='draft'
    - Action: Call rejectNotivisaDraft() with reason
    - Assert: Status='rejected', rejectionReason set, chainHash updated
    - Cleanup: Delete draft
  
  - [ ] **E2E-05: PDF export of approved draft**
    - Precondition: Approved draft in Firestore
    - Action: Call generateNotivisaPDF()
    - Assert: PDF buffer valid, contains disease name + approval info + audit trail
    - Cleanup: None (PDF is ephemeral)
  
  - [ ] **E2E-06: Disease code validation (reject invalid codes)**
    - Precondition: Attempt draft creation with code='00000' (not in Portaria 204)
    - Action: Call notivisaDraftCreate()
    - Assert: Callable throws 'invalid-argument' error
    - Cleanup: Verify no draft created
  
  - [ ] **E2E-07: Notification deadline calculation (resultDate + 24h)**
    - Precondition: Draft with resultDate='2026-06-10T14:30:00Z'
    - Action: Call notivisaDraftCreate()
    - Assert: notificationDeadline='2026-06-11T14:30:00Z' (within 1s tolerance)
    - Cleanup: Delete draft
  
  - [ ] **E2E-08: Auth guard (only RT can approve)**
    - Precondition: Operador user (non-RT)
    - Action: Call approveNotivisaDraft() as Operador
    - Assert: Callable throws 'permission-denied' error
    - Cleanup: Delete draft
  

- [ ] Run E2E suite locally
  - [ ] Target: 8/8 PASS
  - [ ] Target: <2s per test
  - [ ] Document any flaky tests (timeout, race conditions)

### Integration Tests (Phase 6 Trigger)

- [ ] Create `src/__tests__/notivisa-criticos-integration.e2e.ts`
  - [ ] **Integration-01: Critical syphilis result triggers NOTIVISA draft**
    - Precondition: Phase 6 criticos-escalacoes with syphilis positive result
    - Action: Record critical result
    - Assert: NOTIVISA draft auto-created, RT notified
  
  - [ ] **Integration-02: Non-notifiable disease does NOT create NOTIVISA draft**
    - Precondition: Phase 6 criticos-escalacoes with dengue-negative result
    - Action: Record critical result
    - Assert: No draft created, no notification sent
  
  - [ ] **Integration-03: RT portal shows NOTIVISA queue alongside Laudos**
    - Precondition: RT logged into portal
    - Action: Navigate to NOTIVISA queue
    - Assert: List displays drafts + status badges, pagination works

- [ ] Run integration tests
  - [ ] Target: 3/3 PASS
  - [ ] Verify no interference with Phase 6 existing flows

### Cloud Logs Monitoring (24h Post-Deploy)

- [ ] Set up Cloud Logs filters
  - [ ] `resource.type="cloud_function"` AND `resource.labels.function_name=~"notivisa.*"`
  - [ ] Alert on ERROR severity
  - [ ] Alert on >5% warning rate

- [ ] Monitor deployment:
  - [ ] Day 1 (Jun 16, deploy day): <5 errors expected (startup stabilization)
  - [ ] Day 2–7 (Jun 17–22): 0 errors expected
  - [ ] Document any warnings (non-blocking alerts)

- [ ] Create Cloud Logs summary report
  - [ ] Timestamp range, function call counts, error rates
  - [ ] Screenshot for post-deployment sign-off

### Firestore Rules Validation

- [ ] Deploy rules: `firebase deploy --only firestore:rules`
  - [ ] Verify no conflicts with existing rules
  - [ ] Verify NOTIVISA paths protected (read: admin/RT, write: CF-only)
  - [ ] Simulate 5 access patterns:
    - [ ] Admin reads draft ✅
    - [ ] RT reads draft ✅
    - [ ] Operador reads draft ❌ (optional for RT)
    - [ ] Client creates draft ❌
    - [ ] Client updates audit ❌

### QA Sign-Off

- [ ] Code review checklist
  - [ ] All functions have proper error handling
  - [ ] All auth guards in place
  - [ ] All chainHash calculations correct
  - [ ] All immutable fields protected
  - [ ] No console.log in production code (only error channels)

- [ ] Security review
  - [ ] No SQL injection (using Zod validation)
  - [ ] No privilege escalation
  - [ ] No PII leakage in logs
  - [ ] Chainash format validated

- [ ] Performance review
  - [ ] Average callable latency <1s
  - [ ] Batch writes ≤100 docs
  - [ ] No unbounded queries

- [ ] Accessibility review
  - [ ] WCAG AA compliance on NotivisaDraftPanel
  - [ ] Keyboard navigation (Tab, Enter, Escape)
  - [ ] Color contrast: 4.5:1 text, 3:1 large text
  - [ ] Screen reader test (NVDA or VoiceOver)

### Documentation & Handoff

- [ ] Update root `CLAUDE.md`
  - [ ] Add `notivisa` to "Módulos em produção"
  - [ ] Update DICQ gain line (78.5% → 83%)
  - [ ] Update Phase timeline

- [ ] Create `src/features/notivisa/CLAUDE.md` (module guide)
  - [ ] Module scope (notivisa-outbox, audit trails, PDF export)
  - [ ] Regulatory references (RDC 978 Art. 66, Portaria 204/2016)
  - [ ] Multi-tenant paths
  - [ ] Soft-delete only rule
  - [ ] Westgard engine disabled (N/A for NOTIVISA)
  - [ ] Known limitations (v1.4: form generation only, no Anvisa submission)

- [ ] Create operational runbook
  - [ ] **Manual NOTIVISA submission fallback** (if RT can't approve via UI)
    - Export PDF from HC Quality
    - Log in to Anvisa portal
    - Upload form manually
  - [ ] **RT approval timeout escalation** (if draft overdue)
    - Automatic SMS reminder after 12h
    - Escalate to Lab Manager at 20h
    - Force-mark as "Escalated" at 24h (trigger manual Anvisa submission)
  - [ ] **Audit log review** (monthly compliance check)
    - Export notivisa-outbox audit logs
    - Verify all approved drafts have signatures
    - Report to Management Review

- [ ] Create troubleshooting guide
  - [ ] "Draft creation failed: disease code invalid" → check Portaria 204 list
  - [ ] "RT cannot approve: permission denied" → verify RT role claim in JWT
  - [ ] "Chainash mismatch on approval" → database inconsistency, contact CTO
  - [ ] "PDF generation failed: timeout" → increase timeout to 30s, retry

**Deliverable:** ✅ Full UI, E2E tests, integration tests, Cloud Logs passing, documentation complete

---

## Pre-Deploy Gate

**All of the following must be TRUE to proceed to production:**

| Item | Target | Status |
|------|--------|--------|
| E2E test suite | 8/8 PASS | ⏳ |
| Integration tests | 3/3 PASS | ⏳ |
| Cloud Logs (24h) | 0 errors | ⏳ |
| Firestore rules validation | 5/5 patterns OK | ⏳ |
| Code review | CTO sign-off | ⏳ |
| Security review | 0 findings | ⏳ |
| Performance review | <1s avg latency | ⏳ |
| Accessibility review | WCAG AA pass | ⏳ |
| Bundle size | No regression | ⏳ |
| Base test suite | 738/738 PASS (no regressions) | ⏳ |

---

## Post-Deploy Tasks (Day 15+)

- [ ] Update CORRECTIONS.md with Phase 8 completion
- [ ] Create ADR-0022 (NOTIVISA form generation v1.4 implementation notes)
- [ ] Schedule Phase 9 kickoff (2026-06-17)
- [ ] Brief Lab Manager on NOTIVISA workflow + escalation procedures
- [ ] Set up monitoring dashboard for notivisa-outbox status metrics
- [ ] Start certificate provisioning tracking (parallel legal workstream for v1.5)

---

## Acceptance Criteria (Definition of Done)

Phase 8 is COMPLETE when:

✅ All 14 checklist items PASS  
✅ 8/8 E2E flows PASS (100%)  
✅ 3/3 integration tests PASS (100%)  
✅ 0 critical bugs (P0/P1)  
✅ 0 Cloud Log errors (24h window)  
✅ Firestore rules deployed + validated  
✅ RT portal UI live + WCAG AA compliant  
✅ PDF export functional + auditable  
✅ DICQ baseline +4–5 points verified  
✅ RDC 978 Art. 66 addressed (form generation) + v1.5 plan documented  

---

**Checklist Created:** 2026-05-07  
**Status:** READY FOR EXECUTION  
**Next Review:** 2026-06-02 (Kickoff) → 2026-06-16 (Deploy)
