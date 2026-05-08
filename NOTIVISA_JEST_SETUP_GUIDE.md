# NOTIVISA Phase 4 — Jest & Firebase Emulator Setup Guide

**Document ID:** JEST-SETUP-NOTIVISA-001  
**Date:** 2026-05-08  
**Version:** 1.0

---

## Quick Start (5 Minutes)

```bash
# 1. Install dependencies (if not already)
cd functions
npm install --save-dev @jest/globals ts-jest @firebase/rules-unit-testing firebase-admin firebase

# 2. Update jest.config.js (see section 2)
# 3. Create jest.setup.js (see section 3)

# 4. Start emulator
firebase emulators:start --only firestore,functions

# 5. In another terminal, run tests
npm test -- modules/notivisa/callables
```

---

## 1. Directory Structure

```
functions/
├── jest.config.js                    (existing, update per section 2)
├── jest.setup.js                     (new, create per section 3)
├── src/
│   ├── modules/notivisa/
│   │   ├── callables/
│   │   │   ├── authenticatePortal.ts
│   │   │   ├── authenticatePortal.test.ts         (new)
│   │   │   ├── getPatientData.ts
│   │   │   ├── getPatientData.test.ts             (new)
│   │   │   ├── submitRequisition.ts
│   │   │   ├── submitRequisition.test.ts          (new)
│   │   │   ├── trackSampleStatus.ts
│   │   │   ├── trackSampleStatus.test.ts          (new)
│   │   │   ├── notivisaDraftCreate.ts
│   │   │   ├── notivisaDraftCreate.test.ts        (new)
│   │   │   ├── getNotivisaDraft.ts
│   │   │   ├── getNotivisaDraft.test.ts           (new)
│   │   │   ├── rejectNotivisaDraft.ts
│   │   │   ├── rejectNotivisaDraft.test.ts        (new)
│   │   │   ├── listNotivisaOutbox.ts
│   │   │   ├── listNotivisaOutbox.test.ts         (new)
│   │   │   └── INDEX.ts
│   │   ├── __mocks__/
│   │   │   ├── soapClient.ts                      (existing)
│   │   │   ├── notivisaPortal.ts                  (new)
│   │   │   └── firestore.ts                       (new)
│   │   ├── __tests__/
│   │   │   ├── fixtures/
│   │   │   │   ├── notivisa-mocks.ts              (new)
│   │   │   │   ├── notivisa-payloads.ts           (existing)
│   │   │   │   └── test-data.ts                   (new)
│   │   │   ├── integration.test.ts                (new — main suite)
│   │   │   └── batch2-comprehensive.test.ts       (existing, extend)
│   │   └── validators.ts
│   └── __tests__/
│       └── integration/
│           ├── notivisa-e2e.test.ts               (existing, extend)
│           └── notivisa-integration.test.ts       (new)
└── coverage/functions/                            (generated)
```

---

## 2. Jest Configuration

### 2.1 Update `functions/jest.config.js`

```javascript
/**
 * Jest Configuration for Cloud Functions
 * Phase 4 NOTIVISA test suite
 * 
 * Run: npm test
 * Run unit only: npm test -- modules/notivisa/callables
 * Run integration: npm test -- __tests__/integration
 * Run with coverage: npm test -- --coverage
 */

module.exports = {
  displayName: 'functions',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/__tests__/**/*.test.ts'],
  
  // ========== Setup ==========
  setupFilesAfterEnv: ['<rootDir>/../jest.setup.js'],
  
  // ========== TypeScript Transform ==========
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          strict: true,
          resolveJsonModule: true,
        },
        isolatedModules: true, // Faster, less type-checking
      },
    ],
  },

  // ========== Coverage ==========
  collectCoverageFrom: [
    'modules/**/*.ts',
    '!modules/**/__tests__/**',
    '!modules/**/__mocks__/**',
    '!**/*.d.ts',
  ],
  
  // Global thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    // Stricter for NOTIVISA (critical module)
    './modules/notivisa/': {
      branches: 88,
      functions: 92,
      lines: 92,
      statements: 92,
    },
  },

  coverageDirectory: '../coverage/functions',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/__mocks__/',
  ],

  // ========== Performance ==========
  testTimeout: 15000,     // 15s per test (emulator calls)
  maxWorkers: 4,          // Parallel workers
  verbose: true,
  bail: false,            // Don't stop on first failure

  // ========== Path Aliases (if using tsconfig paths) ==========
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },

  // ========== Reporters ==========
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '../test-results',
        outputName: 'jest-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathAsClassName: true,
      },
    ],
  ],
};
```

### 2.2 Add to `functions/package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:notivisa": "jest --testPathPattern=notivisa",
    "test:notivisa:unit": "jest modules/notivisa/callables",
    "test:notivisa:integration": "jest __tests__/integration/notivisa",
    "test:notivisa:coverage": "jest modules/notivisa --coverage",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand",
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

## 3. Jest Setup File

### 3.1 Create `functions/jest.setup.js`

```javascript
/**
 * Jest Global Setup — runs ONCE before ALL tests
 * 
 * Responsibilities:
 * - Mock Firebase Admin SDK
 * - Mock Cloud Logging
 * - Set environment variables for emulator
 * - Configure global mocks
 */

// ========== Environment Setup ==========
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_EMULATOR_HUB = 'localhost:9099';
process.env.FIREBASE_PROJECT_ID = 'hmatologia2-test';

// Suppress console logs in test mode (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
}

// ========== Mock Cloud Logging (functions.logger) ==========
jest.mock('firebase-functions/v2/https', () => {
  const actual = jest.requireActual('firebase-functions/v2/https');
  return {
    ...actual,
    logger: {
      info: jest.fn((...args) => {
        if (process.env.DEBUG_LOGS === 'true') {
          console.log('[INFO]', ...args);
        }
      }),
      warn: jest.fn((...args) => {
        if (process.env.DEBUG_LOGS === 'true') {
          console.warn('[WARN]', ...args);
        }
      }),
      error: jest.fn((...args) => {
        if (process.env.DEBUG_LOGS === 'true') {
          console.error('[ERROR]', ...args);
        }
      }),
      debug: jest.fn((...args) => {
        if (process.env.DEBUG_LOGS === 'true') {
          console.log('[DEBUG]', ...args);
        }
      }),
    },
  };
});

// ========== Global Test Utilities ==========
global.testUtils = {
  /**
   * Generate a mock Firestore batch
   */
  createMockBatch: () => ({
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    commit: jest.fn().mockResolvedValue(undefined),
  }),

  /**
   * Generate a mock Firestore reference
   */
  createMockRef: () => ({
    id: 'mock-doc-id',
    path: 'mock/path',
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({}),
    }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  }),

  /**
   * Generate a valid NOTIVISA auth object
   */
  createMockAuth: (overrides = {}) => ({
    uid: 'test-user-rt',
    token: {
      modules: { notivisa: true },
      email: 'test@lab.com.br',
      ...overrides.token,
    },
    ...overrides,
  }),

  /**
   * Generate a valid NOTIVISA payload
   */
  createValidPayload: (overrides = {}) => ({
    versao: '1.0',
    laudo_id: `laudo-${Date.now()}`,
    paciente_cpf: '12345678900',
    data_resultado: Date.now(),
    resultados: [
      {
        analito: 'TPPA',
        valor: 'Reagente',
        unidade: 'Qualitativo',
        referencia: 'Não Reagente',
      },
    ],
    assinador: {
      cpf: '98765432100',
      nome: 'Dr. Test',
      data_assinatura: Date.now(),
    },
    ...overrides,
  }),
};

// ========== Global Test Timeout ==========
jest.setTimeout(15000);

// ========== Suppress Warnings ==========
// Suppress Firebase SDK warnings
Object.defineProperty(global, 'gc', {
  value: () => {
    if (global.gc) {
      global.gc();
    }
  },
  configurable: true,
});
```

---

## 4. Mock Files

### 4.1 Create `functions/src/modules/notivisa/__mocks__/firestore.ts`

```typescript
/**
 * Firestore Mock — common mocks for all tests
 * 
 * Usage:
 *   import * as mockFirestore from '../__mocks__/firestore';
 *   const mockDb = mockFirestore.createMockDb();
 *   admin.firestore = jest.fn().mockReturnValue(mockDb);
 */

import * as admin from 'firebase-admin';

export function createMockDb() {
  const batch = {
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const docRef = {
    id: 'mock-doc-id',
    path: 'mock/path',
    collection: jest.fn().mockReturnValue(colRef),
    doc: jest.fn().mockReturnValue(docRef),
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({}),
      id: 'mock-doc-id',
    }),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    ref: docRef,
  };

  const colRef = {
    doc: jest.fn().mockReturnValue(docRef),
    where: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [docRef],
        size: 1,
      }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: () => ({ count: 0 }) }),
      }),
    }),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      empty: false,
      docs: [docRef],
      size: 1,
    }),
  };

  const db = {
    collection: jest.fn().mockReturnValue(colRef),
    doc: jest.fn().mockReturnValue(docRef),
    batch: jest.fn().mockReturnValue(batch),
  } as unknown as admin.firestore.Firestore;

  return { db, batch, docRef, colRef };
}

export function createMockSnapshot(data: any = {}) {
  return {
    exists: true,
    data: () => data,
    id: 'mock-doc-id',
    ref: {} as any,
  };
}

export function createMockQuery() {
  return {
    get: jest.fn().mockResolvedValue({
      empty: false,
      docs: [],
      size: 0,
    }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
  };
}
```

### 4.2 Create `functions/src/modules/notivisa/__mocks__/notivisaPortal.ts`

```typescript
/**
 * NOTIVISA Portal API Mock — simulates government API responses
 * 
 * Usage:
 *   import * as mockPortal from '../__mocks__/notivisaPortal';
 *   jest.mock('../path/to/portalSubmit', () => mockPortal);
 */

export const MockPortalResponses = {
  submitSuccess: (protocolNumber?: string) => ({
    success: true,
    protocolNumber: protocolNumber || `NV-${Date.now()}`,
    status: 'submitted',
  }),

  submitTimeout: () => {
    throw new Error('Portal request timeout (HTTP 504)');
  },

  submitServiceUnavailable: () => ({
    success: false,
    error: 'Portal temporarily unavailable (HTTP 503)',
  }),

  statusSubmitted: (protocolNumber: string) => ({
    success: true,
    status: 'submitted',
    protocolNumber,
    response: {
      timestamp: Date.now(),
      acknowledgment: true,
    },
  }),

  statusProcessing: (protocolNumber: string) => ({
    success: true,
    status: 'processing',
    protocolNumber,
    response: {
      timestamp: Date.now(),
      processingStatus: 'in_progress',
    },
  }),

  statusCompleted: (protocolNumber: string) => ({
    success: true,
    status: 'completed',
    protocolNumber,
    response: {
      timestamp: Date.now(),
      result: 'accepted',
    },
  }),
};

/**
 * Simulate status progression across multiple polls
 */
export function generateStatusProgression(steps: number) {
  const responses = [];
  const protocol = `NV-TEST-${Date.now()}`;

  for (let i = 0; i < steps; i++) {
    if (i === 0) {
      responses.push(MockPortalResponses.statusSubmitted(protocol));
    } else if (i === 1) {
      responses.push(MockPortalResponses.statusProcessing(protocol));
    } else {
      responses.push(MockPortalResponses.statusCompleted(protocol));
    }
  }

  return responses;
}
```

---

## 5. Test Fixtures

### 5.1 Create `functions/src/__tests__/fixtures/notivisa-mocks.ts`

```typescript
/**
 * NOTIVISA Mock Responses Library — comprehensive portal simulations
 * 
 * Used by: integration tests, mock portal calls
 */

export const ValidTestData = {
  labId: 'test-lab-001',
  userId: 'test-user-rt-001',
  auditorId: 'test-auditor-001',
  
  pacienteCpf: '12345678900',
  operadorCpf: '98765432100',
  operadorNome: 'Dr. João Silva',
  
  laudoId: 'laudo-syphilis-001',
};

export const ValidPayloads = {
  completeNotivisaPayload: {
    versao: '1.0',
    laudo_id: ValidTestData.laudoId,
    paciente_cpf: ValidTestData.pacienteCpf,
    data_resultado: Date.now(),
    resultados: [
      {
        analito: 'TPPA (Treponema Pallidum Particle Agglutination)',
        valor: 'Reagente',
        unidade: 'Qualitativo',
        referencia: 'Não Reagente',
      },
    ],
    assinador: {
      cpf: ValidTestData.operadorCpf,
      nome: ValidTestData.operadorNome,
      data_assinatura: Date.now(),
    },
  },

  completeAuthInput: {
    labId: ValidTestData.labId,
    portalUsername: 'operator001',
    portalPassword: 'securePassword123',
  },

  completeGetPatientInput: {
    labId: ValidTestData.labId,
    pacienteCpf: ValidTestData.pacienteCpf,
  },

  completeSubmitInput: {
    labId: ValidTestData.labId,
    pacienteCpf: ValidTestData.pacienteCpf,
    laudoId: ValidTestData.laudoId,
    authSessionId: 'session-123',
    notivisaPayload: this.completeNotivisaPayload,
  },
};

export const InvalidPayloads = {
  invalidCpfShort: { ...ValidPayloads.completeNotivisaPayload, paciente_cpf: '123' },
  invalidCpfWrongFormat: { ...ValidPayloads.completeNotivisaPayload, paciente_cpf: 'abc-def-ghi' },
  emptyResultados: { ...ValidPayloads.completeNotivisaPayload, resultados: [] },
  missingAssinador: { ...ValidPayloads.completeNotivisaPayload, assinador: undefined },
};

export const MockPortalResponses = {
  submitSuccess: {
    success: true,
    protocolNumber: `NV-${Date.now()}`,
    status: 'submitted',
  },

  submitFailure: {
    success: false,
    error: 'Portal temporarily unavailable',
  },

  statusSubmitted: {
    success: true,
    status: 'submitted',
    response: { acknowledgment: true },
  },

  statusProcessing: {
    success: true,
    status: 'processing',
    response: { processingStatus: 'in_progress' },
  },

  statusCompleted: {
    success: true,
    status: 'completed',
    response: { result: 'accepted', completedAt: Date.now() },
  },

  statusRejected: {
    success: true,
    status: 'rejected',
    response: { result: 'rejected', reason: 'Invalid data' },
  },
};
```

### 5.2 Create `functions/src/__tests__/fixtures/test-data.ts`

```typescript
/**
 * Test Data Seeding — Firestore setup for integration tests
 * 
 * Usage:
 *   await seedTestData(adminDb, labId);
 */

import * as admin from 'firebase-admin';

export async function seedTestLab(
  db: admin.firestore.Firestore,
  labId: string
): Promise<void> {
  // Create lab document
  await db.collection('labs').doc(labId).set({
    name: 'Test Laboratory',
    cnpj: '12345678000195',
    createdAt: Date.now(),
  });
}

export async function seedTestMember(
  db: admin.firestore.Firestore,
  labId: string,
  userId: string,
  role: 'RT' | 'AUDITOR' | 'ADMIN' = 'RT'
): Promise<void> {
  await db
    .collection('labs')
    .doc(labId)
    .collection('members')
    .doc(userId)
    .set({
      uid: userId,
      role,
      status: 'active',
      createdAt: Date.now(),
    });
}

export async function seedTestPatient(
  db: admin.firestore.Firestore,
  labId: string,
  cpf: string,
  name: string = 'Test Patient'
): Promise<void> {
  await db
    .collection('labs')
    .doc(labId)
    .collection('pacientes')
    .add({
      cpf,
      nome: name,
      dataNascimento: 631152000000, // 1990-01-01
      sexo: 'M',
      mae: 'Maria Test',
      createdAt: Date.now(),
    });
}

export async function seedTestLaudo(
  db: admin.firestore.Firestore,
  labId: string,
  cpf: string,
  laudoId: string = `laudo-${Date.now()}`
): Promise<void> {
  await db
    .collection('labs')
    .doc(labId)
    .collection('laudos')
    .doc(laudoId)
    .set({
      id: laudoId,
      pacienteCpf: cpf,
      resultadoEm: Date.now(),
      resultados: [
        {
          analito: 'TPPA',
          valor: 'Reagente',
          unidade: 'Qualitativo',
          referencia: 'Não Reagente',
        },
      ],
      assinatura: {
        operatorCpf: '98765432100',
        operatorNome: 'Dr. Test',
        ts: Date.now(),
      },
      createdAt: Date.now(),
    });
}

export async function seedTestPortalConfig(
  db: admin.firestore.Firestore,
  labId: string
): Promise<void> {
  await db
    .collection('labs')
    .doc(labId)
    .collection('notivisa-config')
    .doc('portal')
    .set({
      portalUrl: 'https://notivisa.inca.gov.br',
      requiresMfa: false,
      enabled: true,
      rtApprovalRequired: true,
    });
}

/**
 * Complete test data seeding
 */
export async function seedCompleteTestEnvironment(
  db: admin.firestore.Firestore,
  labId: string,
  userId: string,
  auditorId: string,
  patientCpf: string
): Promise<void> {
  await seedTestLab(db, labId);
  await seedTestMember(db, labId, userId, 'RT');
  await seedTestMember(db, labId, auditorId, 'AUDITOR');
  await seedTestPatient(db, labId, patientCpf);
  await seedTestLaudo(db, labId, patientCpf);
  await seedTestPortalConfig(db, labId);
}
```

---

## 6. Running Tests

### 6.1 Commands

```bash
# ========== Unit Tests Only ==========
npm test -- modules/notivisa/callables

# Watch mode (re-run on file change)
npm test -- --watch modules/notivisa/callables

# Single file
npm test -- authenticatePortal.test.ts

# ========== Integration Tests ==========
npm test -- __tests__/integration/notivisa

# ========== Coverage ==========
npm test -- --coverage modules/notivisa

# Generate HTML report
npm test -- --coverage modules/notivisa
open coverage/functions/index.html

# ========== Full Suite ==========
npm test -- modules/notivisa

# ========== Debug Mode ==========
npm run test:debug -- authenticatePortal.test.ts
# Then open chrome://inspect
```

### 6.2 Before Running Tests

Ensure Firebase Emulator is running:

```bash
# Terminal 1: Start emulator
firebase emulators:start --only firestore,functions

# Wait for: "All emulators ready! It is now safe to connect your app."

# Terminal 2: Run tests
npm test -- modules/notivisa/callables
```

---

## 7. Troubleshooting

### Issue: "Port 8080 already in use"

```bash
# Kill existing emulator process
lsof -ti:8080 | xargs kill -9

# Or use different port
firebase emulators:start --only firestore,functions --import=./emulator-seed
```

### Issue: Tests timeout

- Check Firebase Emulator is running
- Increase timeout: `jest.setTimeout(30000)`
- Check for unresolved promises in test

### Issue: Module not found

- Verify tsconfig.json path aliases
- Check `moduleNameMapper` in jest.config.js
- Verify `src/` prefix in test imports

### Issue: Mock not working

- Ensure mock is created BEFORE importing module: `jest.mock(...)`
- Check mock is in correct location (`__mocks__/` directory)
- Verify `jest.fn().mockReturnValue()` is set before test runs

---

## 8. CI/CD Integration

### 8.1 GitHub Actions Workflow

Create `.github/workflows/notivisa-tests.yml`:

```yaml
name: NOTIVISA Phase 4 Tests

on:
  pull_request:
    paths:
      - 'functions/src/modules/notivisa/**'
      - 'functions/jest.config.js'
      - '.github/workflows/notivisa-tests.yml'

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      firestore-emulator:
        image: node:22
        options: |
          --health-cmd "curl -f http://localhost:8080 || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'npm'
      
      - name: Install dependencies
        run: cd functions && npm ci
      
      - name: Start Firebase Emulator
        run: |
          cd functions
          npx firebase-tools emulators:start --only firestore,functions &
          sleep 5
      
      - name: Run NOTIVISA tests
        run: cd functions && npm test -- modules/notivisa __tests__/integration/notivisa
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./functions/coverage/lcov.info
          flags: notivisa-phase4
```

---

## 9. Performance Tips

1. **Use `--maxWorkers=1`** for debugging sequential tests
2. **Use `--testNamePattern`** to run specific test subset
3. **Mock external calls** (HTTP, APIs) — don't make real requests
4. **Use `jest.useFakeTimers()`** for time-based tests (session expiry, timeouts)
5. **Batch Firebase writes** in tests to reduce emulator load

---

## 10. Reference

- **Jest Docs:** https://jestjs.io/
- **Firebase Emulator:** https://firebase.google.com/docs/emulator-suite
- **TypeScript + Jest:** https://github.com/kulshekhar/ts-jest
- **Testing Best Practices:** See `NOTIVISA_PHASE4_TEST_STRATEGY.md`

---

**Version:** 1.0  
**Date:** 2026-05-08  
**Status:** Ready for Implementation
