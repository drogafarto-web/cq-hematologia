# Smoke Test Suite — Phase 3.1 + Stream A Validation

Comprehensive Vitest automation suite for Phase 3.1 (Mobile, Analytics, Export) and Phase 2 Batch 3 (CEQ Z-Score, CIQ Bio Integration).

## Structure

```
test/smoke/
├── 03.1-mobile.smoke.ts        Firebase auth, token persistence, navigation, TypeScript validation
├── 03.1-analytics.smoke.ts     Cloud Function compilation, aggregation performance, Zustand cache
├── 03.1-export.smoke.ts        Export job flow, XLSX generation, signed URLs, status transitions
├── 02-03-ceq.smoke.ts          Z-score calculation, NC auto-creation, blocking behavior
├── 02-03-batch3.smoke.ts       CIQ Bio schema, gates, NC blocking, cross-module safety
├── fixtures/
│   └── sampleData.ts           Test data factory + helpers
└── README.md                   This file
```

## Quick Start

### Run All Smoke Tests

```bash
npm run test:smoke
```

### Watch Mode (Development)

```bash
npm run test:smoke:watch
```

### With Coverage Report

```bash
npm run test:smoke:ci
```

### Against Staging (Firebase Emulator)

```bash
# 1. Start Firebase Emulator
firebase emulators:start --project hmatologia2

# 2. In another terminal
npm run test:smoke:staging
```

## What Each Suite Tests

### 03.1 Mobile Smoke Tests
- [ ] Firebase auth initializes without errors
- [ ] Auth store persists token in localStorage
- [ ] Auth state hydrates correctly on page reload
- [ ] Navigation routing logic (login → hub → module)
- [ ] Multi-lab selection screen
- [ ] TypeScript types for auth, navigation, state

**Run alone:**
```bash
npm run test:smoke -- 03.1-mobile
```

### 03.1 Analytics Smoke Tests
- [ ] Cloud Function compiles with proper signature
- [ ] Aggregation query executes <2 seconds
- [ ] Zustand cache stores metrics correctly
- [ ] React hook subscribes and renders
- [ ] Manual refresh callable responds <100ms (cached)
- [ ] Metrics consistency (compliance ≤ 100%, valid + invalid = total)

**Run alone:**
```bash
npm run test:smoke -- 03.1-analytics
```

### 03.1 Export Smoke Tests
- [ ] Export job created in Firestore
- [ ] Pub/Sub message enqueued for processing
- [ ] XLSX generation completes <5 seconds
- [ ] Signed URL generated with 7-day expiry
- [ ] Job status transitions: queued → processing → completed
- [ ] File size and duration formatting

**Run alone:**
```bash
npm run test:smoke -- 03.1-export
```

### 02-03 CEQ Smoke Tests
- [ ] Z-score calculation: test vectors |Z|<2, |Z|=2.5, |Z|≥3
- [ ] |Z| ≥ 3 creates NC with `severidade='grave'`
- [ ] NC with `bloqueiaOperacoes=true`
- [ ] All 35 unit tests pass
- [ ] Cloud Functions deploy without errors
- [ ] Real-world PT scenarios (hemoglobin, glucose, creatinine)

**Run alone:**
```bash
npm run test:smoke -- 02-03-ceq
```

**Test Coverage:** 35+ test vectors across satisfactory, questionable, and unsatisfactory ranges, plus edge cases.

### 02-03 Batch 3 Smoke Tests
- [ ] CIQ Bio schema validates
- [ ] `popId` + `equipId` gates enforce constraints
- [ ] CEQ auto-NC blocks CIQ Bio run creation
- [ ] No cross-module regressions (CEQ, NC, Auth intact)
- [ ] Multi-tenant isolation preserved
- [ ] Soft-delete (no hard deletes)

**Run alone:**
```bash
npm run test:smoke -- 02-03-batch3
```

## Test Data Fixtures

All tests use the `TestDataFactory` from `fixtures/sampleData.ts`:

```typescript
import { TestDataFactory } from './fixtures/sampleData';

// Create sample lab
const lab = TestDataFactory.lab({ name: 'Custom Lab' });

// Create CEQ data
const participacao = TestDataFactory.ceqParticipacao();
const amostra = TestDataFactory.ceqAmostra();
const resultado = TestDataFactory.ceqResultadoUnsatisfactory();

// Create export job
const job = TestDataFactory.exportJob({ status: 'completed' });

// Create equipment
const equipamento = TestDataFactory.equipamento();

// Create POP
const pop = TestDataFactory.pop();

// Create NC
const nc = TestDataFactory.naoConformidade();
```

## Debugging

### Inspect a specific test

```bash
npm run test:smoke:watch
# Type test name to filter
```

### Check coverage gap

```bash
npm run test:smoke:ci
# Open coverage/index.html in browser
```

### Run with verbose output

```bash
npm run test:smoke -- --reporter=verbose
```

### Check for slow tests

```bash
npm run test:smoke -- --reporter=verbose | grep -i slow
```

## Performance Targets

| Component | Target | Tested |
|-----------|--------|--------|
| Z-score calculation | <1ms | ✓ |
| Analytics aggregation query | <2s | ✓ |
| Analytics callable (cached) | <100ms | ✓ |
| XLSX generation | <5s | ✓ |
| Firebase auth init | <100ms | ✓ |
| Auth state hydration | <200ms | ✓ |

## Adding New Smoke Tests

### Template

```typescript
import { describe, it, expect } from 'vitest';
import { TestDataFactory } from './fixtures/sampleData';

describe('New Feature Smoke Tests', () => {
  it('should validate core functionality', () => {
    const data = TestDataFactory.lab();
    expect(data.id).toBeDefined();
  });
});
```

### Checklist

1. Create file: `test/smoke/{phase}-{feature}.smoke.ts`
2. Add to `fixtures/sampleData.ts` if new data type needed
3. Run: `npm run test:smoke`
4. Ensure coverage ≥80%
5. Add to this README

## CI/CD Integration

### GitHub Actions

Smoke tests run automatically on:
- Push to `develop` branch
- Pull request to `main`

**Workflow:** `.github/workflows/smoke-tests.yml`

Output:
- JUnit XML report (`test-results.xml`)
- Coverage badge
- Fail on <80% coverage or any test failure

### Firebase Emulator Tests

Tests marked with `@emulator` tag run against Firebase Emulator:

```bash
FIREBASE_EMULATOR_HOST=localhost:9999 npm run test:smoke:staging
```

## Maintenance

### Monthly Review

1. Run all smoke tests: `npm run test:smoke:ci`
2. Check coverage trends
3. Update this README if structure changes

### Before Major Releases

1. Run smoke tests: `npm run test:smoke`
2. Run with coverage: `npm run test:smoke:ci`
3. Manual smoke test (visit `/hub`, test each module)
4. Document any new fixtures or patterns

## Known Limitations

1. **Firebase Emulator**: Cloud Function tests use mocks, not real CF execution
2. **Auth Tests**: No real Firebase auth flow (use mocks for isolated unit testing)
3. **Firestore Indexes**: Validation is structural only, not actual index deployment
4. **Storage**: Signed URL tests use mock URLs (real URLs require GCS credentials)

See individual test files for `FIXME` comments on planned enhancements.

## Related Documentation

- **CEQ Module:** `src/features/ceq/CLAUDE.md`
- **Deploy Protocol:** `.claude/rules/deploy-protocol.md`
- **Firestore Security:** `.claude/rules/firestore-security.md`
- **Module Protection:** `.claude/rules/module-protection.md`

## Support

For issues:

1. Check test output: `npm run test:smoke -- --reporter=verbose`
2. Inspect fixture: `test/smoke/fixtures/sampleData.ts`
3. Review related module CLAUDE.md
4. Open issue with test name + error output

---

**Last Updated:** 2026-05-05  
**Coverage:** 80%+  
**Status:** Passing ✓
