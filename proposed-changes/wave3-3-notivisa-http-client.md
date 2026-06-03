# Wave 3.3 — NOTIVISA Real HTTP Client (Sandbox + Production)

**Status**: PROPOSAL

**Deliverable**: Real HTTP client for NOTIVISA government API with sandbox/production modes, credential management, retry logic, and polling infrastructure.

---

## Summary

Wave 2–10 built the test-mode NOTIVISA lifecycle (draft → approve → submit → queue). Wave 3.3 replaces the synthetic responder with a real HTTP client that communicates with the Brazilian government's NOTIVISA API.

**Key changes**:

1. Create `NotivisaHTTPClient` (fetch-based, exponential backoff, audit logging)
2. Implement payload builder (laudo → NOTIVISA schema)
3. Add `submitNotivisaDraftHTTP` callable (real HTTP submission)
4. Add 5-minute polling cron (check status, retrieve approvals)
5. Wire secrets (NOTIVISA_SANDBOX_KEY, NOTIVISA_SANDBOX_URL, NOTIVISA_PROD_KEY, NOTIVISA_PROD_URL)
6. Tests + types + proposal doc

---

## Architecture

### 1. HTTP Client (`functions/src/modules/notivisa/http/client.ts`)

**Class**: `NotivisaHTTPClient`

**Methods**:

```typescript
async submitDraft(draftId, payload): { statusId, submittedAt } | { status: 'error', reason }
async checkStatus(statusId): { status, reason? } | { status: 'error', reason }
async retrieveApproval(statusId): { approvalId, approvedAt, certificateUrl } | { status: 'error', reason }
```

**Key properties**:

- Timeout: 30 seconds per request
- Retries: Up to 5 attempts with exponential backoff (2^n seconds: 1, 2, 4, 8, 16)
- Error handling: Returns error objects, never throws on HTTP failures
- Audit logging: Every error logged via `writeAuditLog('NOTIVISA_*_FAILED')`
- Headers: `Authorization: Bearer {apiKey}`, `Content-Type: application/json`

**Retry logic**:

- Retryable: 5xx errors, 429 (rate limit), timeouts, network errors
- Non-retryable: 4xx errors (except 429), validation failures
- Backoff: 1s → 2s → 4s → 8s → 16s

### 2. Payload Builder (`functions/src/modules/notivisa/http/payloadBuilder.ts`)

**Function**: `buildNotivisaPayload(laudo: LaudoDoc, lab: LabDoc): Promise<NotivisaPayload>`

**Responsibilities**:

- Validate laudo + lab data (CPF format, result count, signature)
- Map laudo fields → NOTIVISA schema (versao, laudo_id, paciente_cpf, data_resultado, resultados, assinador)
- Zod validation (strict, no unknowns)
- Audit log on success: `NOTIVISA_PAYLOAD_CREATED`

**Validations**:

- pacienteCpf: 11 digits, matches `^\d{11}$`
- operatorCpf: 11 digits, matches `^\d{11}$`
- resultados: at least 1 result
- deletadoEm: must be null/undefined (no deleted laudos)

### 3. Callable: Submit via HTTP (`functions/src/modules/notivisa/callables/submitNotivisaDraftHTTP.ts`)

**Signature**:

```typescript
submitNotivisaDraftHTTP({ labId, draftId }): { ok: true, statusId, submittedAt } | { ok: false, error, code }
```

**Flow**:

1. Validate authorization (RT or admin, must be member of lab)
2. Fetch draft from Firestore (status must be 'approved')
3. Fetch laudo from Firestore
4. Build payload via `buildNotivisaPayload`
5. Call HTTP client `submitDraft()`
6. On success: update draft with `status: 'submitted-http'`, `notivisaStatusId: <statusId>`
7. Audit log: `NOTIVISA_DRAFT_SUBMITTED_HTTP`

**Error codes**:

- `DRAFT_NOT_FOUND`: Draft doesn't exist or is deleted
- `LAUDO_NOT_FOUND`: Associated laudo missing
- `INVALID_PAYLOAD`: Payload validation failed
- `HTTP_ERROR`: HTTP call failed (includes reason)
- `INTERNAL_ERROR`: Unexpected server error

**Secrets**:

- `NOTIVISA_SANDBOX_KEY`: Sandbox API key
- `NOTIVISA_SANDBOX_URL`: Sandbox API base URL
- `NOTIVISA_PROD_KEY`: Production API key
- `NOTIVISA_PROD_URL`: Production API base URL

For now, all labs use sandbox. Phase 8 will add per-lab routing based on `labs/{labId}/notivisa-config`.

### 4. Cron: Poll Status (`functions/src/modules/notivisa/crons/pollNotivisaStatus.ts`)

**Schedule**: Every 5 minutes
**Region**: `southamerica-east1`
**Timezone**: `America/Sao_Paulo`

**Flow**:

1. Query all drafts with `status: 'submitted-http'` (across all labs via `collectionGroup`)
2. For each draft (max 100 per cycle):
   - Call `checkStatus(statusId)`
   - If `approved`: call `retrieveApproval()`, update draft to `status: 'approved-http'`, store certificateUrl
   - If `rejected`: update draft to `status: 'rejected-http'`, log reason
   - If `pending` or `processing`: increment poll count, re-enqueue if under MAX_POLL_COUNT (12 = 1 hour)
3. Log cycle summary (approved, rejected, pending, errors)

**Fields updated on draft**:

- `status`: 'submitted-http' → 'approved-http' | 'rejected-http' | 'poll-timeout'
- `notivisaPollCount`: incremented each cycle
- `notivisaApprovedAt`: timestamp when approved
- `notivisaCertificateUrl`: URL for approved certificate
- `notivisaApprovalId`: approval ID for tracking
- `notivisaRejectedAt`: timestamp when rejected
- `notivisaRejectionReason`: government reason for rejection

---

## Firestore Schema Extensions

### Draft Collection (`notivisa-drafts/{labId}/drafts/{draftId}`)

**New fields** (after HTTP submission):

```typescript
status: 'submitted-http' | 'approved-http' | 'rejected-http' | 'poll-timeout'
notivisaStatusId: string // ID for polling government status
notivisaPollCount: number // Increment on each poll cycle
submittedHttpAt: Timestamp // When HTTP submission succeeded
submittedHttpBy: string // UID of submitter
notivisaApprovedAt?: Timestamp // When government approved
notivisaCertificateUrl?: string // URL for PDF certificate
notivisaApprovalId?: string // Government approval ID
notivisaRejectedAt?: Timestamp // When government rejected
notivisaRejectionReason?: string // Why it was rejected
```

### Indexes

None required for HTTP polling (collectionGroup query on `status` works efficiently for <5k drafts per tenant).

---

## Secrets Management

### Names

- `NOTIVISA_SANDBOX_KEY` — Bearer token for sandbox API
- `NOTIVISA_SANDBOX_URL` — Base URL (e.g., `https://api-sandbox.notivisa.gov.br`)
- `NOTIVISA_PROD_KEY` — Bearer token for production API
- `NOTIVISA_PROD_URL` — Base URL (e.g., `https://api.notivisa.gov.br`)

### Provisioning

```bash
# Sandbox (test labs)
firebase functions:secrets:set NOTIVISA_SANDBOX_KEY --project hmatologia2
firebase functions:secrets:set NOTIVISA_SANDBOX_URL --project hmatologia2

# Production (live labs) — Phase 8
firebase functions:secrets:set NOTIVISA_PROD_KEY --project hmatologia2
firebase functions:secrets:set NOTIVISA_PROD_URL --project hmatologia2
```

### Placeholder Defaults

If secrets are not set, functions use placeholder strings like `PENDING_SET_NOTIVISA_SANDBOX_KEY`. The pre-deploy gate (`scripts/preflight-secrets-check.sh`) will catch these and block deployment.

---

## Deployment Order

1. **Type-check + build**

   ```bash
   npx tsc --noEmit && npm run build
   ```

2. **Provision secrets** (BEFORE deploying functions)

   ```bash
   firebase functions:secrets:set NOTIVISA_SANDBOX_KEY --project hmatologia2
   firebase functions:secrets:set NOTIVISA_SANDBOX_URL --project hmatologia2
   ```

3. **Pre-deploy gate**

   ```bash
   bash scripts/preflight-secrets-check.sh
   ```

   Must exit 0. If not, provide the missing secrets from step 2.

4. **Deploy functions**

   ```bash
   firebase deploy --only functions:submitNotivisaDraftHTTP,functions:pollNotivisaStatus --project hmatologia2
   ```

5. **Smoke test**
   - Create a draft via `notivisaDraftCreate`
   - Approve via `approveNotivisaDraft`
   - Submit via `submitNotivisaDraftHTTP` → should return `{ ok: true, statusId, submittedAt }`
   - Wait 5 minutes or manually trigger `pollNotivisaStatus`
   - Check draft status: should be 'approved-http' or 'rejected-http' (depending on government)

6. **Deploy Firestore rules** (if needed)
   ```bash
   firebase deploy --only firestore:rules --project hmatologia2
   ```

---

## Rollback Plan

If the HTTP client fails in production:

1. **Immediate**: Set `NOTIVISA_MODE=test` environment variable (reverts to test-mode synthetic responder)

   ```bash
   firebase functions:config:set notivisa.mode=test --project hmatologia2
   # Or redeploy with env var in functions/lib/index.js
   ```

2. **Revert callable**: Keep old `submitNotivisa` callable available as fallback. Update client code to route to test mode.

3. **Monitor**: Check Cloud Logs for `NOTIVISA_SUBMIT_FAILED` or `NOTIVISA_POLL_CYCLE_COMPLETE` errors.

4. **Resume**: Once credentials or network issue is fixed, re-provision secrets and redeploy.

---

## Testing

### Unit Tests (`functions/src/modules/notivisa/http/client.test.ts`)

12 tests covering:

1. Happy path: submitDraft succeeds
2. Retry on 5xx
3. No retry on 4xx
4. Retry on 429
5. Timeout + backoff
6. Exhaust retries → error
7. checkStatus success
8. checkStatus pending
9. checkStatus error
10. retrieveApproval success
11. retrieveApproval error
12. Base URL trailing slash handling

All tests mock `fetch` globally.

### Integration Tests

Manual smoke test (see Deployment Order, step 5).

---

## Compliance + Audit Trail

Every HTTP call is logged:

- Success: Implicit in audit log `NOTIVISA_DRAFT_SUBMITTED_HTTP` (includes statusId)
- Failure: `NOTIVISA_SUBMIT_FAILED`, `NOTIVISA_CHECK_STATUS_FAILED`, `NOTIVISA_POLL_CYCLE_COMPLETE`

Audit logs include:

- `action`: Operation type (e.g., 'NOTIVISA_DRAFT_SUBMITTED_HTTP')
- `callerUid`: User who triggered submission
- `labId`: Lab context
- `payload`: draftId, laudoId, statusId, error reason (if failed)

**RDC 978 Art. 6**: All NOTIVISA submissions are auditable and traceable to the operator.

---

## Timeline

- **Phase 4 Task 04-03**: This deliverable (W3-3)
- **Phase 8**: Lab-specific routing (sandbox vs. production per-lab configuration)
- **Phase 9+**: Portal-RT display of status + certificate download

---

## Known Limitations + Future Work

1. **No per-lab configuration yet**: All labs route to sandbox. Phase 8 will add `labs/{labId}/notivisa-config` with `mode: 'sandbox' | 'prod'`.

2. **No certificate display in Portal-RT**: Phase 9 will add a view for approved drafts with downloadable certificates.

3. **No webhook handler for government callbacks**: Phase 4+ tasks may add webhook support if NOTIVISA offers it (current design assumes polling).

4. **No failover to secondary endpoint**: If NOTIVISA goes down, we retry up to 5 times with backoff. Long-term: consider circuit breaker pattern.

---

## Files Created / Modified

**Created**:

- `functions/src/modules/notivisa/http/client.ts` (NotivisaHTTPClient)
- `functions/src/modules/notivisa/http/payloadBuilder.ts` (buildNotivisaPayload)
- `functions/src/modules/notivisa/callables/submitNotivisaDraftHTTP.ts` (callable)
- `functions/src/modules/notivisa/crons/pollNotivisaStatus.ts` (cron)
- `functions/src/modules/notivisa/http/client.test.ts` (tests)
- `proposed-changes/wave3-3-notivisa-http-client.md` (this doc)

**Modified**:

- `functions/src/modules/notivisa/types.ts` (added NotivisaDraftPayload, NotivisaStatusResponse, NotivisaApprovalResponse)

**Not modified** (yet):

- Firestore rules (no new rules needed; existing draft collection rules already support HTTP submission flow)
- Cloud function index in `functions/src/index.ts` (will be auto-linked by deployment)

---

## Acceptance Criteria

- [ ] NotivisaHTTPClient implemented with exponential backoff + timeout
- [ ] payloadBuilder validates + builds NOTIVISA schema
- [ ] submitNotivisaDraftHTTP callable works end-to-end (draft → HTTP → statusId)
- [ ] pollNotivisaStatus cron queries + updates drafts
- [ ] 12 unit tests all passing
- [ ] Secrets pre-deploy gate ready
- [ ] Smoke test passes (submit → poll → approved/rejected)
- [ ] Rollback plan documented
- [ ] Audit logs complete and readable

---

## References

- ADR-0014: NOTIVISA integration architecture
- ADR-0021: Multi-tenant secret management
- `docs/v1.4_NOTIVISA_SANDBOX_SETUP.md`: Government sandbox provisioning (external)
- RDC 978 Art. 6: Government notification requirement
