# Phase 3 E2E Test Suite

Smoke tests for Phase 3 schema extensions, rules, and helpers.

## Files

- **`phase3-schema.e2e.test.ts`** — Schema validation (Task 03-01)
- **`phase3-rules.e2e.test.ts`** — Rules validation (Task 03-02)
- **`phase3-helpers.e2e.test.ts`** — Helpers validation (Task 03-03)

## Run Tests

### All E2E Tests
```bash
npm run test:unit -- src/__tests__/e2e
```

### Phase 3 Tests Only
```bash
npm run test:unit -- src/__tests__/e2e/phase3
```

### With Coverage
```bash
npm run test:coverage -- src/__tests__/e2e
```

### Watch Mode
```bash
npm run test:unit:watch -- src/__tests__/e2e
```

## Test Coverage

| Test | Purpose | Status |
|------|---------|--------|
| **Schema (5 tests)** | Collections exist, indexes work, schema correct | ✅ Ready |
| **Rules (5 tests)** | RBAC enforced, patient/RT/admin access | ✅ Ready |
| **Helpers (18 tests)** | Formatters, validators, state machine | ✅ Ready |

**Total: 28 smoke tests**

## Dependencies

Tests require:
- Firebase Emulator (for local development)
- OR production Cloud Firestore in test mode (for staging/prod)

### Local Setup

1. Start Firebase Emulator:
```bash
firebase emulators:start
```

2. In another terminal, run tests:
```bash
FIREBASE_EMULATOR_HOST=localhost:8080 npm run test:unit -- src/__tests__/e2e
```

### Production Setup

Tests can run against production Cloud Firestore if:
- Database rules allow `read, write: if true` (for test-only collections)
- Test user has access to `TEST-LAB-*` collections
- Automatic cleanup runs after each test

## Test Isolation

All tests use `testLabId = 'TEST-LAB-PHASE3-001'` (or similar) to avoid collisions with real data.

Cleanup happens in `afterEach()` hooks:
```typescript
afterEach(async () => {
  // Delete all test data
  for (const colPath of testCollections) {
    const snapshot = await db.collection(colPath).limit(100).get();
    for (const doc of snapshot.docs) {
      await doc.ref.delete();
    }
  }
});
```

## Pre-Deploy Checklist

Before Phase 3 deploy (after tasks 03-01, 03-02, 03-03):

- [ ] All 5 schema collections created in Firestore
- [ ] All 5 composite indexes created (status: ENABLED)
- [ ] All rules blocks added to `firestore.rules`
- [ ] All helpers implemented in `src/shared/`
- [ ] 28/28 E2E tests passing
- [ ] 0 TypeScript errors
- [ ] No regressions in existing tests (run full suite)

## Post-Deploy Validation

After Phase 3 deploy, run this command to verify:

```bash
npm run test:unit -- src/__tests__/e2e/phase3 && echo "✅ Phase 3 smoke tests passed"
```

Success criteria:
- 28/28 tests passing
- No timeout errors
- No "collection not found" errors
- No rule violations

## Troubleshooting

### "Collection not found"
- Verify 03-01 task completed (schema collections created)
- Check Firestore Console for test collections

### "Permission denied"
- Verify 03-02 task completed (rules deployed)
- Check rule syntax: `npm run lint` (if firestore lint available)

### "Index not found"
- Verify 03-01 indexes created (check Firestore Console)
- Wait up to 5 minutes for index to build

### "Helper not found"
- Verify 03-03 task completed (helpers implemented)
- Import from `src/shared/` not `src/shared/index.ts` yet

## Notes

- **Mock Implementations**: `phase3-helpers.e2e.test.ts` includes mock implementations until real helpers are deployed. Replace with actual imports once Task 03-03 is complete.
- **Firebase Emulator**: Tests run fastest with local emulator. Cloud Firestore tests may take 2-5s per test.
- **Staging**: To test against staging before production, set `FIREBASE_PROJECT=hmatologia2-staging` and verify all tests pass.

## Integration with CI/CD

These tests should be added to the pre-deploy gate:

```bash
# In .github/workflows/deploy.yml or equivalent
npm run test:unit -- src/__tests__/e2e/phase3 || exit 1
```

Block deployment if any test fails.
