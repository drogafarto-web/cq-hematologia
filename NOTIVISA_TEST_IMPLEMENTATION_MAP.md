# NOTIVISA Phase 4 — Test Implementation Map

**Document ID:** IMPL-MAP-NOTIVISA-001  
**Date:** 2026-05-08  
**Version:** 1.0  
**Purpose:** Maps test cases to implementation files and directory structure

---

## File Structure & Implementation Map

### Unit Test Files (8)

```
functions/src/modules/notivisa/callables/
├── authenticatePortal.ts ........................ (342 lines)
├── authenticatePortal.test.ts .................. (395 lines, NEW)
│   ├── Unit: 18 tests
│   ├── Coverage: 95% lines, 90% branches
│   └── Focus: Auth flow, MFA, session creation
│
├── getPatientData.ts ........................... (315 lines)
├── getPatientData.test.ts ..................... (380 lines, NEW)
│   ├── Unit: 16 tests
│   ├── Coverage: 92% lines, 88% branches
│   └── Focus: Data retrieval, validation, completeness
│
├── submitRequisition.ts ........................ (354 lines)
├── submitRequisition.test.ts .................. (450 lines, NEW)
│   ├── Unit: 22 tests
│   ├── Coverage: 96% lines, 92% branches
│   └── Focus: Submission, rate limiting, duplicate check
│
├── trackSampleStatus.ts ........................ (376 lines)
├── trackSampleStatus.test.ts .................. (420 lines, NEW)
│   ├── Unit: 20 tests
│   ├── Coverage: 94% lines, 90% branches
│   └── Focus: Polling, status progression, timeout
│
├── notivisaDraftCreate.ts ..................... (280 lines)
├── notivisaDraftCreate.test.ts ............... (340 lines, NEW)
│   ├── Unit: 14 tests
│   ├── Coverage: 91% lines, 87% branches
│   └── Focus: Draft creation, idempotency
│
├── getNotivisaDraft.ts ........................ (250 lines)
├── getNotivisaDraft.test.ts .................. (300 lines, NEW)
│   ├── Unit: 12 tests
│   ├── Coverage: 89% lines, 85% branches
│   └── Focus: Draft retrieval, audit log
│
├── rejectNotivisaDraft.ts ..................... (290 lines)
├── rejectNotivisaDraft.test.ts ............... (360 lines, NEW)
│   ├── Unit: 15 tests
│   ├── Coverage: 93% lines, 89% branches
│   └── Focus: Draft rejection, signature validation
│
├── listNotivisaOutbox.ts ...................... (240 lines)
├── listNotivisaOutbox.test.ts ................ (280 lines, NEW)
│   ├── Unit: 11 tests
│   ├── Coverage: 88% lines, 84% branches
│   └── Focus: Listing, pagination, filtering
│
└── INDEX.ts ................................... (51 lines, EXISTING)
```

**Total Unit Tests:** 128 tests, ~2,700 LOC (new)

---

### Mock & Fixture Files (4)

```
functions/src/modules/notivisa/
├── __mocks__/ (NEW DIRECTORY)
│   ├── firestore.ts ........................... (180 lines)
│   │   ├── createMockDb()
│   │   ├── createMockBatch()
│   │   ├── createMockSnapshot()
│   │   └── createMockQuery()
│   │
│   └── notivisaPortal.ts ..................... (140 lines)
│       ├── MockPortalResponses (submit, status, etc.)
│       └── generateStatusProgression()
│
├── __tests__/fixtures/ (NEW SUBDIRECTORY)
│   ├── notivisa-mocks.ts .................... (250 lines)
│   │   ├── ValidTestData
│   │   ├── ValidPayloads (complete, multi-result, etc.)
│   │   ├── InvalidPayloads (invalid CPF, empty, etc.)
│   │   ├── MockPortalResponses (all scenarios)
│   │   └── Helper functions
│   │
│   ├── notivisa-payloads.ts ................. (EXISTING, extend)
│   │   └── Add: ValidPayloads, InvalidPayloads
│   │
│   └── test-data.ts ......................... (280 lines)
│       ├── seedTestLab(db, labId)
│       ├── seedTestMember(db, labId, userId, role)
│       ├── seedTestPatient(db, labId, cpf, name)
│       ├── seedTestLaudo(db, labId, cpf, laudoId)
│       ├── seedTestPortalConfig(db, labId)
│       └── seedCompleteTestEnvironment(...)
│
└── validators.ts .............................. (188 lines, EXISTING)
    └── assertNotivisaAccess (use in tests)
```

**Total Mock/Fixture Files:** 4 files, ~850 LOC (new)

---

### Integration Test Files (2)

```
functions/src/__tests__/
├── integration/ (EXISTING DIRECTORY)
│   ├── notivisa-e2e.test.ts ................. (EXISTING, extend)
│   │   └── Add: E2E Flow tests (5 tests)
│   │
│   ├── notivisa-integration.test.ts ........ (1,200 lines, NEW)
│   │   ├── Group 1: Sandbox Mode (40 tests)
│   │   ├── Group 2: Mock Responses (15 tests)
│   │   ├── Group 3: Authorization (4 tests)
│   │   ├── Group 4: Error Scenarios (18 tests)
│   │   ├── Group 5: Audit Trail (5 tests)
│   │   ├── Group 6: Happy Paths (3 tests)
│   │   └── Group 7: Firestore Rules (3 tests)
│   │
│   ├── setup.ts ............................. (NEW, optional)
│   │   └── beforeAll/afterAll hooks
│   │
│   └── utils.ts ............................ (NEW, optional)
│       └── Helper functions (seed, teardown)
│
└── fixtures/ (EXISTING DIRECTORY)
    ├── notivisa-payloads.ts ................. (EXISTING)
    └── (see mocks above)
```

**Total Integration Test Files:** 2 files + 1 optional, ~1,200+ LOC (new/extended)

---

### Jest Configuration Files (2)

```
functions/
├── jest.config.js ............................ (38 lines, EXISTING → UPDATE)
│   ├── Module: notivisa
│   ├── Coverage thresholds: 92% global, 92% notivisa/
│   ├── Test timeout: 15s (increased from 10s)
│   ├── Max workers: 4
│   ├── Reporters: jest-junit for CI/CD
│   └── Module name mapper: @modules, @shared aliases
│
├── jest.setup.js ............................ (150 lines, NEW)
│   ├── Environment variables (FIRESTORE_EMULATOR_HOST)
│   ├── Mock Cloud Logging (functions.logger)
│   ├── Global test utilities (createMockBatch, createMockAuth, etc.)
│   └── Console suppression (optional)
│
├── package.json ............................. (EXISTING → UPDATE)
│   ├── Add devDependencies:
│   │   ├── @jest/globals ^29.7.0
│   │   ├── @types/jest ^29.5.11
│   │   ├── jest-junit ^16.0.0
│   │   └── ts-jest ^29.1.1
│   │
│   └── Add scripts:
│       ├── test:notivisa
│       ├── test:notivisa:unit
│       ├── test:notivisa:integration
│       ├── test:notivisa:coverage
│       └── coverage:report
│
└── tsconfig.json ........................... (EXISTING)
    └── Verify: moduleResolution, esModuleInterop
```

**Total Configuration Files:** 2 files (1 new, 1 update), ~200 LOC

---

## Test File Implementation Details

### authenticatePortal.test.ts (NEW)

**Location:** `functions/src/modules/notivisa/callables/authenticatePortal.test.ts`

**Structure:**

```typescript
describe('authenticatePortal', () => {
  let mockDb: any;
  let mockBatch: any;
  let mockAuth: any;

  beforeEach(() => {
    // 1. Mock Firestore
    // 2. Mock batch operations
    // 3. Mock Cloud Logs
  });

  describe('Authorization & Input Validation', () => {
    test('should reject unauthenticated request');
    test('should validate labId not empty');
    test('should validate username min length');
    test('should validate password min length');
    test('should validate MFA code format if provided');
  });

  describe('Happy Path (Success Cases)', () => {
    test('should authenticate user and return auth token');
    test('should handle MFA successfully');
  });

  describe('Error Scenarios', () => {
    test('should return INVALID_CREDENTIALS');
    test('should return MFA_REQUIRED');
    test('should return MFA_INVALID');
    test('should return PORTAL_CONFIG_MISSING');
    test('should return PORTAL_UNREACHABLE');
    test('should return SESSION_CREATION_FAILED');
    test('should return PERMISSION_DENIED');
    test('should return INTERNAL_ERROR');
  });

  describe('Audit Logging', () => {
    test('should create session document with correct expiration');
    test('should log authentication attempt for audit trail');
  });
});
```

**Key Mocks to Create:**

- `admin.firestore()` → mockDb
- `admin.firestore().batch()` → mockBatch
- `functions.logger.info/warn/error` → jest.fn()
- Portal config fetch → snapshot
- Credentials validation → boolean

**Coverage Targets:**

- Line: 95% (achieved by testing all branches)
- Branch: 90% (test both MFA paths: required/optional/invalid)
- Critical: 100% (session creation + error returns)

**Test Count:** 18 tests

---

### submitRequisition.test.ts (NEW)

**Location:** `functions/src/modules/notivisa/callables/submitRequisition.test.ts`

**Structure:**

```typescript
describe('submitRequisition', () => {
  let mockDb: any;
  let mockBatch: any;
  let mockSession: any;

  beforeEach(() => {
    // 1. Mock Firestore with batch
    // 2. Mock session document
    // 3. Mock portal submission
  });

  describe('Authorization & Input Validation', () => {
    // 4 tests
  });

  describe('Happy Path', () => {
    test('should submit and return ok=true with requisitionId');
    test('should set status=submitted on portal success');
    test('should set status=queued on portal failure');
  });

  describe('Session Validation', () => {
    test('should return INVALID_SESSION if session not found');
    test('should return SESSION_EXPIRED if session > 1h old');
  });

  describe('Duplicate & Rate Limiting', () => {
    test('should return DUPLICATE_SUBMISSION for same laudo+patient');
    test('should return RATE_LIMITED if >20 submissions/hour');
  });

  describe('Payload Validation', () => {
    test('should validate notivisaPayloadSchema');
    test('should validate pacienteCpf format');
  });

  describe('Error Handling', () => {
    test('should return PORTAL_ERROR on HTTP error');
    test('should return PERMISSION_DENIED without notivisa claim');
  });

  describe('Audit Logging', () => {
    test('should create auditLog entry with action=SUBMITTED');
    test('should include payloadHash in details');
  });

  describe('Concurrency', () => {
    test('should handle concurrent submissions safely');
  });
});
```

**Key Mocks:**

- `admin.firestore().batch()` with commit()
- Session fetch + validation (exists, active, not expired)
- Duplicate check query (where + limit)
- Rate limit count query
- Portal submission (success/failure)
- Batch operations for document creation

**Coverage Targets:**

- Line: 96% (highest of all)
- Branch: 92% (multiple paths: success/queue, duplicate/new, etc.)
- Critical: 100% (session check, duplicate prevention, portal fallback)

**Test Count:** 22 tests (most complex)

---

### trackSampleStatus.test.ts (NEW)

**Location:** `functions/src/modules/notivisa/callables/trackSampleStatus.test.ts`

**Structure:**

```typescript
describe('trackSampleStatus', () => {
  let mockDb: any;
  let mockSubmission: any;

  beforeEach(() => {
    // 1. Mock Firestore
    // 2. Mock submission document
    // 3. Mock portal poll
    // 4. Setup time mocking (jest.useFakeTimers)
  });

  describe('Status Retrieval', () => {
    test('should return current status without polling if terminal');
    test('should poll portal and update status');
    test('should set status=failed if polling >24 hours');
  });

  describe('Portal Polling', () => {
    test('should handle status progression');
    test('should map portal status to internal status');
    test('should handle malformed portal response');
  });

  describe('Session Validation', () => {
    test('should return SESSION_INVALID if session not found');
    test('should return SESSION_EXPIRED if session > 1h old');
  });

  describe('Timeout Handling', () => {
    test('should set status=failed if polling >24 hours');
  });

  describe('Audit Logging', () => {
    test('should create STATUS_UPDATED audit log');
    test('should include polling duration in details');
  });
});
```

**Key Mocks:**

- Submission fetch (terminal/non-terminal status)
- Portal poll response (submitted/processing/completed/rejected)
- Batch update for status changes
- Fake timers for 24-hour check
- Session validation (optional)

**Coverage Targets:**

- Line: 94%
- Branch: 90% (terminal vs. polling, success vs. timeout, etc.)
- Critical: 100% (terminal state detection, 24h timeout, polling fallback)

**Test Count:** 20 tests

---

### Other Unit Test Files (Summary)

| File                        | Tests  | Coverage      | Key Focus                        |
| --------------------------- | ------ | ------------- | -------------------------------- |
| notivisaDraftCreate.test.ts | 14     | 91% / 87%     | Idempotency, root creation       |
| getNotivisaDraft.test.ts    | 12     | 89% / 85%     | Fetch, audit log inclusion       |
| rejectNotivisaDraft.test.ts | 15     | 93% / 89%     | Signature validation, transition |
| listNotivisaOutbox.test.ts  | 11     | 88% / 84%     | Pagination, filtering            |
| **SUBTOTAL**                | **52** | **90% / 86%** | —                                |

---

## Integration Test File Implementation

### notivisa-integration.test.ts (NEW)

**Location:** `functions/src/__tests__/integration/notivisa-integration.test.ts`

**Total Lines:** ~1,200  
**Total Tests:** 88  
**Coverage:** 91%

**Structure:**

```typescript
/**
 * NOTIVISA Integration Test Suite (Phase 4)
 * Uses Firebase Emulator + mocks for comprehensive testing
 */

let testEnv: RulesTestEnvironment;
let app: FirebaseApp;
let db: Firestore;
let adminDb: admin.firestore.Firestore;
let functions: Functions;

beforeAll(async () => {
  // 1. Initialize test environment
  // 2. Initialize Firebase app (client)
  // 3. Connect to emulators
  // 4. Seed test data
});

afterAll(async () => {
  await testEnv.cleanup();
});

// ========== Group 1: Sandbox Mode (40 tests) ==========
describe('NOTIVISA Integration — Sandbox Mode (Isolated)', () => {
  describe('authenticatePortal isolated', () => {
    // 6 tests
  });
  describe('getPatientData isolated', () => {
    // 5 tests
  });
  describe('submitRequisition isolated', () => {
    // 6 tests
  });
  describe('trackSampleStatus isolated', () => {
    // 6 tests
  });
  // ... other callables
});

// ========== Group 2: Mock Portal Responses (15 tests) ==========
describe('NOTIVISA Integration — Mock Portal Responses', () => {
  test('should handle portal success response');
  test('should handle portal failure and queue for retry');
  test('should handle status progression (polling mock)');
  // ... 12 more tests
});

// ========== Group 3: Authorization (4 tests) ==========
describe('NOTIVISA Integration — Authorization', () => {
  test('should reject user without notivisa module claim');
  test('should reject user not in labs/{labId}/members');
  test('should allow RT role to submit');
  test('should allow AUDITOR role to reject draft');
});

// ========== Group 4: Error Scenarios (18 tests) ==========
describe('NOTIVISA Integration — Error Scenarios', () => {
  describe('Portal Unreachable', () => {
    // 2 tests
  });
  describe('Invalid Data', () => {
    // 3 tests
  });
  // ... remaining scenarios
});

// ========== Group 5: Audit Trail (5 tests) ==========
describe('NOTIVISA Integration — Audit Trail & Compliance', () => {
  test('should log logins to notivisa-audit-logs/logins');
  test('should log submissions with hash');
  test('should log status changes');
  test('should log rejection reason');
  test('should include complete audit context');
});

// ========== Group 6: Happy Path E2E (3 tests) ==========
describe('NOTIVISA Integration — E2E Happy Path', () => {
  test('E2E Flow 1: Full submission → tracking');
  test('E2E Flow 2: Draft → approval → archive');
  test('E2E Flow 3: Incomplete data rejection');
});

// ========== Group 7: Firestore Rules (3 tests) ==========
describe('NOTIVISA Integration — Firestore Rules', () => {
  test('should enforce notivisa-sessions read ACL');
  test('should prevent direct client creation of requisitions');
  test('should enforce soft-delete only');
});
```

**Setup Functions (use from test-data.ts):**

```typescript
await seedCompleteTestEnvironment(
  adminDb,
  'test-lab-001',
  'test-user-rt-001',
  'test-auditor-001',
  '12345678900',
);
```

**Key Assertions:**

```typescript
expect(result.ok).toBe(true);
expect(result.status).toBe('submitted');
expect(result.requisitionId).toBeDefined();
expect(auditLog.action).toBe('SUBMITTED');
expect(auditLog.operatorId).toBe(uid);
```

---

## Mock Files Implementation

### **mocks**/firestore.ts

```typescript
export function createMockDb() {
  const batch = {
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const docRef = {
    id: 'mock-doc-id',
    collection: jest.fn().mockReturnValue(colRef),
    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const colRef = {
    doc: jest.fn().mockReturnValue(docRef),
    where: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({ empty: false, docs: [docRef] }),
    }),
    get: jest.fn().mockResolvedValue({ empty: false, docs: [docRef] }),
  };

  return {
    db: {
      collection: jest.fn().mockReturnValue(colRef),
      batch: jest.fn().mockReturnValue(batch),
    },
    batch,
    docRef,
    colRef,
  };
}
```

### **mocks**/notivisaPortal.ts

```typescript
export const MockPortalResponses = {
  submitSuccess: (protocolNumber?: string) => ({
    success: true,
    protocolNumber: protocolNumber || `NV-${Date.now()}`,
    status: 'submitted',
  }),

  statusCompleted: (protocolNumber: string) => ({
    success: true,
    status: 'completed',
    response: { result: 'accepted' },
  }),

  // ... other responses
};
```

---

## Fixture Files Implementation

### **tests**/fixtures/test-data.ts

```typescript
export async function seedCompleteTestEnvironment(
  db: admin.firestore.Firestore,
  labId: string,
  userId: string,
  auditorId: string,
  patientCpf: string,
): Promise<void> {
  // Create lab, members, patient, laudo, config in order
  await seedTestLab(db, labId);
  await seedTestMember(db, labId, userId, 'RT');
  await seedTestMember(db, labId, auditorId, 'AUDITOR');
  await seedTestPatient(db, labId, patientCpf);
  await seedTestLaudo(db, labId, patientCpf);
  await seedTestPortalConfig(db, labId);
}
```

---

## Jest Configuration Implementation

### jest.config.js (UPDATE)

Change these sections:

```javascript
// BEFORE
testTimeout: 10000,
maxWorkers: 'auto',

// AFTER
testTimeout: 15000,        // Increased for emulator
maxWorkers: 4,             // Parallel but limited

// ADD
coverageThreshold: {
  global: { branches: 85, functions: 90, lines: 90, statements: 90 },
  './modules/notivisa/': { branches: 88, functions: 92, lines: 92, statements: 92 },
},

// ADD
reporters: [
  'default',
  ['jest-junit', {
    outputDirectory: '../test-results',
    outputName: 'jest-results.xml',
  }],
],
```

### jest.setup.js (NEW)

```javascript
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_PROJECT_ID = 'hmatologia2-test';

jest.mock('firebase-functions/v2/https', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

global.testUtils = {
  createMockBatch: () => ({
    /* ... */
  }),
  createMockAuth: () => ({
    /* ... */
  }),
  createValidPayload: () => ({
    /* ... */
  }),
};
```

### package.json (UPDATE)

```json
{
  "scripts": {
    "test:notivisa": "jest --testPathPattern=notivisa",
    "test:notivisa:unit": "jest modules/notivisa/callables",
    "test:notivisa:integration": "jest __tests__/integration/notivisa",
    "test:notivisa:coverage": "jest modules/notivisa --coverage",
    "coverage:report": "open coverage/functions/index.html"
  },
  "devDependencies": {
    "@jest/globals": "^29.7.0",
    "@types/jest": "^29.5.11",
    "jest": "^29.7.0",
    "jest-junit": "^16.0.0",
    "ts-jest": "^29.1.1"
  }
}
```

---

## File Count & Lines of Code

| Category    | Files  | LOC       | New    | Update |
| ----------- | ------ | --------- | ------ | ------ |
| Unit Tests  | 8      | 2,700     | 8      | —      |
| Mocks       | 2      | 330       | 2      | —      |
| Fixtures    | 2      | 530       | 1      | 1      |
| Integration | 2      | 1,200     | 1      | 1      |
| Config      | 3      | 350       | 1      | 2      |
| **TOTAL**   | **17** | **5,110** | **13** | **4**  |

---

## Implementation Order

### Day 1: Unit Tests (4 callable files)

```bash
# Create:
touch functions/src/modules/notivisa/callables/{
  authenticatePortal.test.ts,
  getPatientData.test.ts,
  submitRequisition.test.ts,
  trackSampleStatus.test.ts
}

# Run:
npm test -- authenticatePortal.test.ts --watch
```

### Day 2: Remaining Unit Tests (4 callable files)

```bash
# Create:
touch functions/src/modules/notivisa/callables/{
  notivisaDraftCreate.test.ts,
  getNotivisaDraft.test.ts,
  rejectNotivisaDraft.test.ts,
  listNotivisaOutbox.test.ts
}

# Run all unit tests:
npm test -- modules/notivisa/callables
# Expected: 128 tests pass, 92% coverage
```

### Day 3: Mocks + Fixtures + Integration

```bash
# Create:
mkdir -p functions/src/modules/notivisa/__mocks__
mkdir -p functions/src/__tests__/integration

touch functions/src/modules/notivisa/__mocks__/{
  firestore.ts,
  notivisaPortal.ts
}

touch functions/src/__tests__/fixtures/{
  test-data.ts,
  notivisa-mocks.ts
}

touch functions/src/__tests__/integration/notivisa-integration.test.ts

# Run integration tests:
npm test -- __tests__/integration/notivisa-integration.test.ts
# Expected: 88 tests pass, 91% coverage
```

### Day 4: Jest Config + Verification

```bash
# Update:
functions/jest.config.js
functions/jest.setup.js
functions/package.json

# Verify:
npm test -- modules/notivisa --coverage
# Expected: 92% global, 92% notivisa/module
```

---

## Quick Command Reference

```bash
# Start emulator
firebase emulators:start --only firestore,functions

# Run all NOTIVISA tests
npm test -- modules/notivisa __tests__/integration/notivisa

# Run unit only
npm test -- modules/notivisa/callables

# Run integration only
npm test -- __tests__/integration/notivisa-integration.test.ts

# Watch mode
npm test -- --watch modules/notivisa/callables

# Coverage report
npm test -- --coverage modules/notivisa
open coverage/functions/index.html

# Single callable
npm test -- authenticatePortal.test.ts

# Debug mode
npm run test:debug -- authenticatePortal.test.ts
# Then: chrome://inspect
```

---

**Version:** 1.0  
**Date:** 2026-05-08  
**Status:** COMPLETE — Implementation Ready
