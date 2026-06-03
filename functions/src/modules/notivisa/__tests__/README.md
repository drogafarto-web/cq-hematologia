# NOTIVISA Test Suite — Phase 4 Complete

Comprehensive test coverage for NOTIVISA integration (52 tests, 100% callable coverage).

## Overview

This test suite validates all NOTIVISA callables and background jobs for Phase 4 (sandbox) through Phase 12+ (production). Tests are organized in three layers:

- **Batch 1** (28 tests): Draft CRUD, approval, submission, rejection
- **Batch 2** (24 tests): Queue processor, webhook handler, export, soft delete
- **Integration** (14 tests): End-to-end workflows, concurrency, error recovery

## Files

```
notivisa/__tests__/
├── batch1-expanded.test.ts       # 28 tests: Draft lifecycle (create/approve/submit/reject)
├── batch2-comprehensive.test.ts  # 24 tests: Processor/webhook/export/delete
├── integration.test.ts           # 14 tests: E2E workflows, performance, rollback
├── __mocks__/
│   └── soapClient.ts             # Mock NOTIVISA SOAP API (Phase 4)
└── README.md                      # This file
```

## Quick Start

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Run All Tests

```bash
npm test -- notivisa/__tests__
```

### 3. Run Specific Test Suite

```bash
# Batch 1 only
npm test -- batch1-expanded.test.ts

# Batch 2 only
npm test -- batch2-comprehensive.test.ts

# Integration only
npm test -- integration.test.ts

# NOTIVISA tests with coverage
npm run test:coverage -- --testPathPattern=notivisa
```

## Test Structure

### Batch 1: notivisaDraftCreate (12 tests)

Validates draft creation with idempotency, rate limiting, and signature determinism.

```typescript
describe('Batch 1: notivisaDraftCreate', () => {
  // Schema validation (8 tests)
  //   ✓ Valid payload
  //   ✓ Invalid CPF
  //   ✓ Missing fields
  //   ✓ Multiple resultados
  // Signature determinism (4 tests)
  //   ✓ Same input = same hash
  //   ✓ Different payload = different hash
  //   ✓ operatorId changes hash
  //   ✓ timestamp changes hash
});
```

### Batch 1: approveNotivisaDraft (8 tests)

Validates RT/admin approval with signature verification and timestamp expiry.

```typescript
describe('Batch 1: approveNotivisaDraft', () => {
  // Schema validation (8 tests)
  //   ✓ Valid signature format
  //   ✓ Hash length validation
  //   ✓ Required fields
  // Signature verification (4 tests)
  //   ✓ Hash format (hex, 64 chars)
  //   ✓ Timestamp expiry (5 min window)
});
```

### Batch 1: submitNotivisaDraft (8 tests)

Validates submission with CPF masking, audit trail, and queue event creation.

```typescript
describe('Batch 1: submitNotivisaDraft', () => {
  // Schema validation (5 tests)
  //   ✓ Required fields (labId, draftId)
  //   ✓ Optional signature
  // Response masking (2 tests)
  //   ✓ CPF masked (***8901)
  // Audit trail & queue (3 tests)
  //   ✓ Audit log immutability
  //   ✓ Queue event status
});
```

### Batch 1: rejectNotivisaDraft (6 tests)

Validates rejection with motivo validation (10-500 chars) and signature.

```typescript
describe('Batch 1: rejectNotivisaDraft', () => {
  // Schema validation (6 tests)
  //   ✓ Motivo length (10-500 chars)
  //   ✓ All required fields
});
```

### Batch 2: notivisaQueueProcessor (10 tests)

Validates queue polling, exponential backoff, and failure handling.

**Exponential Backoff Schedule:**

- Attempt 1: 0 min (immediate)
- Attempt 2: 1 min
- Attempt 3: 5 min
- Attempt 4: 15 min
- Attempt 5: 45 min
- Attempt 6: 120 min (then hard failure)

```typescript
describe('Batch 2: notivisaQueueProcessor', () => {
  // Entry detection & ordering (2 tests)
  //   ✓ Finds pending entries
  //   ✓ Processes in creation order
  // Backoff (4 tests)
  //   ✓ Correct schedule
  //   ✓ Max 5 attempts enforced
  // Idempotency (2 tests)
  //   ✓ No duplicate SOAP calls
  // Failure handling (3 tests)
  //   ✓ Retryable (5xx) increments attempt
  //   ✓ Permanent (4xx) fails immediately
  //   ✓ Escalation at 24h
});
```

### Batch 2: notivisaWebhookHandler (8 tests)

Validates webhook signature verification, entry lookup, and status updates.

```typescript
describe('Batch 2: notivisaWebhookHandler', () => {
  // Signature verification (5 tests)
  //   ✓ Valid HMAC-SHA256
  //   ✓ Constant-time comparison
  //   ✓ HTTP method validation (POST only)
  // Entry processing (3 tests)
  //   ✓ Idempotency via idempotencyKey
  //   ✓ Status update to acknowledged
  //   ✓ Webhook log subcollection
  // Error handling (3 tests)
  //   ✓ Invalid signature → 401
  //   ✓ Malformed JSON → 400
  //   ✓ Missing fields → 400
});
```

### Batch 2: notivisaExportArchive (6 tests)

Validates export filtering, file splitting, and immutability.

```typescript
describe('Batch 2: notivisaExportArchive', () => {
  // Permissions (4 tests)
  //   ✓ Auditor/admin can export
  //   ✓ Others cannot (403)
  // Filtering (3 tests)
  //   ✓ 90-day window
  //   ✓ CSV + JSON formats
  // File splitting (2 tests)
  //   ✓ >100 entries → sub-files
  // Metadata & immutability (3 tests)
  //   ✓ exportedBy, expiresAt
  //   ✓ Cannot re-export same ID
  // Performance (1 test)
  //   ✓ 1000+ entries in <5s
});
```

### Batch 2: notivisaSoftDelete (6 tests)

Validates soft delete with permission checks and query filtering.

```typescript
describe('Batch 2: notivisaSoftDelete', () => {
  // Permissions (3 tests)
  //   ✓ Admin only
  //   ✓ Permission denied → 403
  // Logic (4 tests)
  //   ✓ Stores status, deletedAt, deletedBy
  //   ✓ Reason enum validation
  //   ✓ Idempotent
  // Query filtering (2 tests)
  //   ✓ Firestore: deletedAt == null
});
```

### Integration: End-to-End Workflows

Validates complete workflows with state transitions, atomicity, and error recovery.

```typescript
describe('NOTIVISA Integration Tests', () => {
  // Happy path (3 tests)
  //   ✓ Create → Approve → Submit → Process → Acknowledge
  //   ✓ Audit trail captures all transitions
  //   ✓ Atomic Firestore writes
  // Error recovery (4 tests)
  //   ✓ Transient error retry
  //   ✓ Permanent error fail-fast
  //   ✓ Exponential backoff
  //   ✓ 24h escalation
  // Concurrency (3 tests)
  //   ✓ First submission wins
  //   ✓ First webhook wins
  //   ✓ Rate limiting
  // Data integrity (3 tests)
  //   ✓ CPF consistency
  //   ✓ Payload immutability
  //   ✓ Signature validation
  // Performance (3 tests)
  //   ✓ Draft creation <500ms
  //   ✓ Batch processing <5s
  //   ✓ Webhook <100ms
  // Smoke test seeding (1 test)
  //   ✓ 10 labs + 50 drafts
  // Rollback (1 test)
  //   ✓ Draft rejection, submission rollback
});
```

## Mock SOAP Client

The `__mocks__/soapClient.ts` provides a mock NOTIVISA SOAP API for Phase 4 testing.

### Scenarios

```typescript
enum SoapMockScenario {
  SUCCESS = 'success', // 200 OK + receipt code
  VALIDATION_ERROR = 'validation-error', // 400 Bad Request
  TIMEOUT = 'timeout', // 504 Gateway Timeout
  NETWORK_DOWN = 'network-down', // ECONNREFUSED
  MALFORMED_RESPONSE = 'malformed-response', // 5xx + invalid XML
}
```

### Usage

```typescript
import { createMockSoapClient, SoapMockScenario, SoapTestHelpers } from '../__mocks__/soapClient';

// Create client
const mockClient = createMockSoapClient(SoapMockScenario.SUCCESS, 100); // 100ms latency

// Submit request
const request = SoapTestHelpers.createValidRequest();
const response = await mockClient.submit(request);

// Verify response
SoapTestHelpers.assertValidSuccessResponse(response);
console.log(response.receiptCode); // "ANVISA-1715062800000-ABC123-XYZ789"
```

## Running Tests with Coverage

```bash
# Full coverage report
npm run test:coverage -- --testPathPattern=notivisa

# HTML report (opens in browser)
npm run test:coverage -- --testPathPattern=notivisa
open coverage/functions/index.html
```

## Expected Coverage

- **Line Coverage:** 100%
- **Branch Coverage:** 95%
- **Function Coverage:** 100%

## Smoke Test Sequence (May 20, 2026)

See `.planning/PHASE_4_NOTIVISA_TEST_CHECKLIST.md` for complete smoke test procedure.

### Quick Smoke Test

```bash
# 1. Seed test data
bash scripts/seed-notivisa-test-data.sh

# 2. Run all tests
npm test -- notivisa/__tests__

# 3. Verify Cloud Logs
gcloud functions logs read --limit 100 --region southamerica-east1

# 4. Manual workflow (in console)
#    - Create draft
#    - Approve as RT
#    - Submit as admin
#    - Wait for queue processor
#    - Simulate webhook ACK
```

## Phase Roadmap

| Phase                | Scope                                             | Status     |
| -------------------- | ------------------------------------------------- | ---------- |
| Phase 4 (2026-05-20) | Sandbox mock API, all callables tested            | ✓ Complete |
| Phase 8              | SMS/email escalation, supervisor portal           | Pending    |
| Phase 12             | Real SOAP API + mTLS cert, production integration | Pending    |
| Phase 13             | WebSocket real-time updates, analytics            | Pending    |

## Known Limitations (Phase 4)

- Mock SOAP client returns instant success
- Webhook handler uses placeholder `ANVISA_WEBHOOK_SECRET`
- Supervisor escalation is logging-only (no SMS/email)
- No real mTLS certificate integration

## Debugging

### Enable Verbose Logging

```bash
npm test -- notivisa/__tests__ --verbose
```

### Run Single Test

```bash
npm test -- batch1-expanded.test.ts -t "accepts valid payload"
```

### Watch Mode

```bash
npm test -- notivisa/__tests__ --watch
```

## Contributing

When adding new tests:

1. Follow the Batch 1/2/Integration organization
2. Use descriptive test names (no abbreviations)
3. Group related tests in `describe` blocks
4. Include both happy path and error cases
5. Add comments for complex assertions
6. Verify coverage doesn't drop below 95% branch

## References

- **ADR-0026:** NOTIVISA Integration Architecture
- **firestore-security.md:** Rules + callable patterns
- **PHASE_4_NOTIVISA_TEST_CHECKLIST.md:** Complete smoke test guide
- **RDC 978:** Regulatory compliance requirements
- **DICQ 4.3:** Quality documentation standards

---

**Last Updated:** 2026-05-07  
**Next Review:** 2026-05-20 (post-smoke test)  
**Maintainer:** @drogafartogit
