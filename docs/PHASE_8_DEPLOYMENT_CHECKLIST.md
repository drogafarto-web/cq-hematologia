# Phase 8 — NOTIVISA Deployment Checklist

**Phase:** 8 (Phase 4 + Phase 8 concurrent)  
**Timeline:** 2026-06-02 to 2026-06-16  
**Deploy Date:** 2026-06-16  
**Success Gate:** 8/8 E2E test flows passing + audit export clean + 0 Cloud Log errors (24h)

---

## Pre-Deployment Checklist (Before 2026-06-02)

### Government Registration Track (Start immediately — 3–5 day wait)

- [ ] Lab director + RT authorized + signed
- [ ] CNPJ verified as "ativa" (https://www.cnpj.net/)
- [ ] RT ANVISA account tested (login at https://portalanvisa.gov.br/)
- [ ] Authorization letter signed by RT (template in v1.4_NOTIVISA_SANDBOX_SETUP.md)
- [ ] NOTIVISA sandbox registration submitted
- [ ] **Blocking:** Awaiting ANVISA credentials (API key + endpoint URL)
- [ ] Credentials received + stored in Firebase Secrets Manager:
  - `NOTIVISA_SANDBOX_API_KEY` → `firebase functions:secrets:set`
  - `NOTIVISA_SANDBOX_ENDPOINT` → Firebase config

### Firestore Rules & Indexes

- [ ] Rules file (`firestore.rules`) updated with NOTIVISA blocks
  - [ ] `notivisa-drafts/{labId}/drafts/{draftId}` (read/update RT, admin, auditor)
  - [ ] `notivisa-queue/{labId}/events/{eventId}` (read-only for RT, admin, auditor)
  - [ ] `notivisa-outbox/{labId}/archives/{archiveId}` (read-only for auditor)
  - [ ] Helper functions: `isActiveMemberOfLab()`, `isAdminOrOwner()`
- [ ] Firestore indexes created (via `firestore.indexes.json`):
  - [ ] `notivisa-drafts` index: `status + criadoEm`
  - [ ] `notivisa-drafts` index: `laudoId + status`
  - [ ] `notivisa-queue` index: `status + nextRetry`
  - [ ] `notivisa-queue` index: `createdAt DESC`
- [ ] Rules tested locally:
  - [ ] `firebase emulators:exec --only firestore "npm test"`
  - [ ] RT can read/write drafts
  - [ ] Auditor can list outbox
  - [ ] Client cannot directly create drafts/events
- [ ] Type-check: `npx tsc --noEmit` ✓

### Cloud Functions (All 6 Callables)

- [ ] `functions/src/modules/notivisa/callables/submitNotivisa.ts` — Gateway callable
- [ ] `functions/src/modules/notivisa/callables/notivisaDraftCreate.ts` — Auto-draft creation
- [ ] `functions/src/modules/notivisa/callables/getNotivisaDraft.ts` — Fetch with audit log
- [ ] `functions/src/modules/notivisa/callables/rejectNotivisaDraft.ts` — RT rejection
- [ ] `functions/src/modules/notivisa/callables/listNotivisaOutbox.ts` — Auditor export
- [ ] `functions/src/modules/notivisa/crons/notivisaStatusCheck.ts` — 5-min polling cron
- [ ] Shared utilities:
  - [ ] `functions/src/shared/cryptoaudit.ts` — Logical signatures + chain hash
  - [ ] `functions/src/shared/notivisa.ts` — Payload schema + formatter
- [ ] All callables exported in `functions/src/index.ts`:
  ```typescript
  export { submitNotivisa } from './modules/notivisa/callables/submitNotivisa';
  export { notivisaDraftCreate } from './modules/notivisa/callables/notivisaDraftCreate';
  export { getNotivisaDraft } from './modules/notivisa/callables/getNotivisaDraft';
  export { rejectNotivisaDraft } from './modules/notivisa/callables/rejectNotivisaDraft';
  export { listNotivisaOutbox } from './modules/notivisa/callables/listNotivisaOutbox';
  export { notivisaStatusCheck } from './modules/notivisa/crons/notivisaStatusCheck';
  ```
- [ ] Build succeeds: `npm run build` ✓
- [ ] Unit tests pass: `npm test -- modules/notivisa` ✓

### Unit Tests (per callable)

- [ ] `submitNotivisa` tests:
  - [ ] Validates Zod schema on invalid input
  - [ ] Rate limits at 10/hour
  - [ ] Creates queue event on success
  - [ ] Returns idempotent eventId on retry
  - [ ] Rejects if draft not found
  - [ ] Rejects if RT approval required but missing
  - [ ] Logs audit event

- [ ] `notivisaDraftCreate` tests:
  - [ ] Creates draft from laudo + paciente data
  - [ ] Returns idempotent draftId on duplicate laudo
  - [ ] Validates payload against NOTIVISA schema
  - [ ] Rejects if laudo not found
  - [ ] Rejects if paciente missing CPF
  - [ ] Logs audit event with critico context

- [ ] `getNotivisaDraft` tests:
  - [ ] Fetches draft + audit log + linked event
  - [ ] Orders audit log by ts DESC
  - [ ] Masks pacient CPF in response
  - [ ] Rejects if not member of lab

- [ ] `rejectNotivisaDraft` tests:
  - [ ] Verifies signature correctness
  - [ ] Rejects if draft already submitted
  - [ ] Marks as rejected + logs reason
  - [ ] Returns reason in response

- [ ] `listNotivisaOutbox` tests:
  - [ ] Lists submitted drafts per lab
  - [ ] Paginates with pageToken
  - [ ] Filters by status, operatorId, date range
  - [ ] Rate limits at 10 requests/hour
  - [ ] Auditor only (rejects RT/technician)

- [ ] `notivisaStatusCheck` cron tests:
  - [ ] Polls government API per pending event
  - [ ] Updates status to acknowledged/rejected on response
  - [ ] Exponential backoff on transient errors
  - [ ] Marks failed after max attempts
  - [ ] Audits each status change
  - [ ] Handles network timeouts gracefully

**Test coverage target:** >90% lines, all critical paths

### Cloud Logs & Monitoring

- [ ] Cloud Monitoring alert policies configured:
  - [ ] P1: NOTIVISA API unreachable (3 consecutive failures)
  - [ ] P2: Validation error without recovery (>24h)
  - [ ] P2: Rate limit exceeded (>3 times in 24h)
  - [ ] P2: Queue backed up (>50 pending drafts)
- [ ] Cloud Scheduler job configured:
  - [ ] Name: `notivisa-polling`
  - [ ] Schedule: `every 5 minutes` (0 */5 * * * *)
  - [ ] Region: `southamerica-east1`
  - [ ] Function: `notivisaStatusCheck`
  - [ ] Timeout: 120 seconds
  - [ ] Retry: 3 times on failure (Cloud Scheduler built-in)

---

## Deployment Sequence (Wave 3: Days 1–8)

### Day 1 (June 2) — Rules & Indexes

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Deploy rules + indexes
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2

# ✓ Verify: Firebase Console → Firestore → Rules (NOTIVISA blocks visible)
```

### Day 2 (June 3) — Cloud Functions

```bash
# 1. Secret status check (mandatory)
bash scripts/preflight-secrets-check.sh
# Output must be green (NOTIVISA_SANDBOX_API_KEY provisioned)

# 2. Deploy callables + cron
firebase deploy --only functions:submitNotivisa,functions:notivisaDraftCreate,functions:getNotivisaDraft,functions:rejectNotivisaDraft,functions:listNotivisaOutbox,functions:notivisaStatusCheck --project hmatologia2

# ✓ Verify: Firebase Console → Functions → All 6 functions deployed + healthy
# ✓ Verify: Cloud Logs show no errors
```

### Day 3 (June 4) — RT Portal UI Components

- [ ] RT draft review UI component (`NotivisaDraftPanel.tsx`)
  - [ ] Display draft payload (disease, patient anonymized, results)
  - [ ] Show submission deadline + urgency badge
  - [ ] Approve button → calls `submitNotivisa()`
  - [ ] Reject button → calls `rejectNotivisaDraft()` with reason
  - [ ] Display audit trail (who approved/rejected, when)
- [ ] Auditor outbox UI component (`NotivisaOutboxList.tsx`)
  - [ ] List submitted notifications (paginated)
  - [ ] Filters: status, operator, date range
  - [ ] Export button → CSV/JSON/XLSX
  - [ ] Status badge (pending/acknowledged/rejected)
- [ ] Deploy to hosting:
  ```bash
  firebase deploy --only hosting --project hmatologia2
  ```

### Days 4–5 (June 5–6) — E2E Testing

**Test Plan: 8 Critical Flows**

1. **E2E-01: Draft creation from laudo**
   - Create laudo with notifiable disease
   - Verify draft auto-created in `notivisa-drafts`
   - Check payload schema compliance
   - ✓ Pass criteria: draft exists, status='draft'

2. **E2E-02: RT approval workflow**
   - Fetch draft
   - Call `submitNotivisa()` with RT signature
   - Verify draft status → 'submitted'
   - Verify queue event created (status='pending')
   - ✓ Pass criteria: eventId returned, nextPollAt set

3. **E2E-03: Audit trail immutability**
   - Create draft → approve → reject
   - Fetch audit log
   - Verify all actions logged (CREATED, SUBMITTED, REJECTED)
   - Attempt to modify audit log (should fail)
   - ✓ Pass criteria: 3+ audit entries, immutability enforced

4. **E2E-04: Rate limiting**
   - Submit 11 drafts in sequence
   - Verify 11th submission rejected with code='RATE_LIMITED'
   - Verify response code=429
   - ✓ Pass criteria: 11th submission blocked

5. **E2E-05: Idempotency (duplicate submission)**
   - Submit draft with idempotencyToken
   - Resubmit same token
   - Verify returns same eventId (no duplicate queue entry)
   - ✓ Pass criteria: only 1 queue event created

6. **E2E-06: Government API polling (mock)**
   - Create queue event (status='pending')
   - Mock government API response (status='acknowledged')
   - Run `notivisaStatusCheck()` cron
   - Verify event status updated to 'acknowledged'
   - ✓ Pass criteria: status='acknowledged', response logged

7. **E2E-07: Error recovery (transient failure)**
   - Create queue event
   - Mock government API returning 503
   - Run polling cron (should retry with backoff)
   - Verify event status='sent', nextRetry set
   - Verify audit log shows retry attempt
   - ✓ Pass criteria: event not marked failed, next retry scheduled

8. **E2E-08: Authorization (RT-only operations)**
   - Attempt `submitNotivisa()` as TECHNICIAN (should fail)
   - Attempt `rejectNotivisaDraft()` as TECHNICIAN (should fail)
   - Attempt `listNotivisaOutbox()` as TECHNICIAN (should fail)
   - ✓ Pass criteria: all 3 calls rejected with code='PERMISSION_DENIED'

**Test Execution:**
```bash
npm test -- __tests__/integration/notivisa-e2e.test.ts
# All 8 tests must PASS
```

### Day 6 (June 9) — Cloud Logs Monitoring (24h)

```bash
# Monitor Cloud Logs for errors
gcloud functions logs read notivisaDraftCreate,notivisaStatusCheck,submitNotivisa --region southamerica-east1 --limit 100 --follow

# Automated monitoring script (see CLOUD_LOGS_MONITORING_GUIDE.md)
bash scripts/monitor-cloud-logs.sh 24 30
```

**Pass criteria:**
- Error rate <1% (0 CRITICAL/ERROR for 24h preferred)
- All function invocations complete within 30s
- No HMAC signature failures
- No Firestore permission denials

### Day 7 (June 10) — Phase 6 Integration Test

**Integration with Phase 10 criticos module:**

- [ ] Simulate critical result detection
- [ ] Verify `notivisaDraftCreate()` auto-triggered
- [ ] Draft appears in RT UI
- [ ] RT approves → calls `submitNotivisa()`
- [ ] Draft status: draft → submitted → (polling) → acknowledged

**Test command:**
```bash
npm test -- __tests__/integration/criticos-notivisa-integration.test.ts
```

### Day 8 (June 16) — Production Deploy + Smoke Test

```bash
# Final type-check
npx tsc --noEmit

# Final build
npm run build

# Deploy all pieces
firebase deploy --project hmatologia2

# Smoke test (manual or automated)
# 1. Create test laudo (notifiable disease)
# 2. Verify draft auto-created
# 3. RT approves via UI
# 4. Verify submission to queue
# 5. Wait 5 min for cron polling
# 6. Verify status updated in UI
```

---

## Rollback Plan

### If E2E <90% Pass (Days 4–5)

1. Revert Cloud Functions:
   ```bash
   firebase deploy --only firestore:rules --project hmatologia2
   # Reverts rules to previous version (Firestore keeps history)
   ```
2. Investigate test failures
3. Fix + redeploy
4. Re-run E2E suite

**RTO:** 1 hour (quick revert)

### If Audit Chain Compromised (Post-Deploy)

1. Soft-delete all notivisa-drafts + notivisa-queue docs
2. Restore from backup (Phase 3.3+ includes backup strategy)
3. Rebuild chain integrity checker (ADR-0026)

**RTO:** 4 hours (manual recovery)

---

## Operational Runbook (Post-Deploy)

### Daily Checks

- [ ] Cloud Logs: 0 errors in past 24h
- [ ] Queue backlog: <5 pending events per lab
- [ ] Rate limit hits: <5 per day per lab
- [ ] Government API: responding within 10s

### Weekly Tasks

- [ ] Audit trail export: verify all drafts logged
- [ ] Signature verification: run batch validation
- [ ] Backup: confirm Firestore snapshots

### Incident Response

**Scenario: Government API down**
- Alert: P1 (blocking notifications)
- Action: Check `https://portalanvisa.gov.br/status` (if available)
- Mitigation: Queue events retry automatically (5 attempts max)
- Communication: Email RT that submissions paused temporarily

**Scenario: Rate limited**
- Alert: P2 (informational)
- Action: Review lab submission frequency
- Mitigation: Increase rate limit (if gov allows) or stagger submissions

**Scenario: Signature verification fails**
- Alert: P1 (security event)
- Action: Check Cloud Logs for details
- Mitigation: Soft-delete invalid draft, audit for tampering

---

## Success Criteria (Gate to Phase 9)

✅ **All of the following must be true:**

1. ✅ 8/8 E2E test flows PASS
2. ✅ 0 regressions (baseline 738 tests still passing)
3. ✅ Cloud Logs: 0 errors, <3% warning rate (24h monitoring)
4. ✅ Audit export PDF generates cleanly (tested)
5. ✅ RT UI accessible + WCAG AA compliant (tested)
6. ✅ Firestore rules deployed + tested
7. ✅ ADR-0014 compliance verified
8. ✅ Integration with Phase 10 criticos working (draft auto-creation)
9. ✅ DICQ gain documented (+4–5 points: 78.5% → ~83%)

---

## Timeline & Contingencies

| Date | Milestone | Contingency |
|------|-----------|-------------|
| 2026-05-10 | Gov registration submitted (3–5 day wait begins) | Contact ANVISA; escalate if >5 days |
| 2026-06-02 | Phase 8 kickoff (credentials must arrive) | Defer Phase 8 by 1 week if pending |
| 2026-06-02 | Deploy rules + indexes | Cancel Phase 8 if rules rollback fails |
| 2026-06-03 | Deploy Cloud Functions | Hotfix + redeploy if function errors |
| 2026-06-05–06 | E2E testing (8 flows) | Fix + retest if <90% pass |
| 2026-06-09 | 24h Cloud Logs monitoring | Alert on-call if errors exceed threshold |
| 2026-06-16 | Production deploy + smoke test | Rollback if smoke test fails |

---

## References

- **ADR-0014:** NOTIVISA Integration (Sandbox → Production Pathway)
- **ADR-0021:** NOTIVISA Queue & Retry Pattern
- **ADR-0026:** NOTIVISA Queue Processing (Async Append-Only)
- **PHASE_8_DETAILED_PLAN.md:** Full specification
- **PHASE_8_NOTIVISA_CALLABLES.md:** 6 callable specs
- **v1.4_NOTIVISA_SANDBOX_SETUP.md:** Government onboarding
- **CLOUD_LOGS_MONITORING_GUIDE.md:** Monitoring post-deploy
- **firestore.rules:** NOTIVISA security rules
