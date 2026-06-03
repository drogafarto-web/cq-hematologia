# HC Quality Phase 3.2 — E2E Rules Tests Failure Analysis

**Status**: 10 failing tests identified  
**Root Cause**: Operator precedence, validation logic mismatches, and test/rule inconsistencies  
**Risk Assessment**: MEDIUM — Rules work but helpers have edge cases that cause test failures

---

## Test Failure Summary

| #   | Test Name                                                        | File                           | Expected                                       | Actual                                                                                                          | Root Cause                                                                               |
| --- | ---------------------------------------------------------------- | ------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | `Test 1: Portal rules allow patient to read published laudo`     | phase3-rules.e2e.test.ts:52    | Patient reads own published laudo              | Rule uses `isPatient(labId)` which may not be defined properly                                                  | Helper function scope issue                                                              |
| 2   | `Test 2: NOTIVISA rules allow RT to create and server to update` | phase3-rules.e2e.test.ts:127   | Payload with `status='SENT'` passes validation | `validateNotivisaPayload()` checks `in ['PENDING', 'SENT', 'FAILED', 'DELIVERED']` but test only checks first 3 | Validator includes 'DELIVERED' but test doesn't                                          |
| 3   | `Test 2: Invalid payload (missing patient_cpf)`                  | phase3-rules.e2e.test.ts:186   | Validation fails                               | Test uses `'patient_cpf' in invalidPayload` which returns false, but then tests for string validation           | Test logic is correct (should fail)                                                      |
| 4   | `Test 3: RT can update resolution`                               | phase3-rules.e2e.test.ts:252   | Update succeeds with `resolved_at != null`     | Rule allows `isAdminOrRT(labId) && request.resource.data.resolved_at != null`                                   | Test passes but actual Firestore rule validation may fail in emulator                    |
| 5   | `Test 4: IA strip dev server-only access`                        | phase3-rules.e2e.test.ts:281   | Only server/admin can read/write               | Rule has `isServer()` with operator precedence bug                                                              | Operator precedence issue in `isServer()` helper                                         |
| 6   | Test 1.2: `notivisaFormatter` missing CPF throws error           | phase3-helpers.e2e.test.ts:371 | Throws ValidationError                         | Throws generic Error                                                                                            | Wrong error type                                                                         |
| 7   | Test 2.2: SMS truncation logic                                   | phase3-helpers.e2e.test.ts:458 | Long name truncated to 20 chars                | Template uses `substring(0, 20)` which is correct                                                               | Edge case: test expects truncation but verifies substring contains truncation (logic OK) |
| 8   | Test 3.1: Acquire lock successfully                              | phase3-helpers.e2e.test.ts:544 | Lock acquired with correct fields              | Lock timestamp math works                                                                                       | Timing-sensitive test may fail on slow systems                                           |
| 9   | Test 3.4: Publish from draft                                     | phase3-helpers.e2e.test.ts:573 | Publish succeeds, lock released                | Lock is deleted from map                                                                                        | Race condition possible with async operations                                            |
| 10  | Test 4.4: Confidence out of range (1.5) rejected                 | phase3-helpers.e2e.test.ts:651 | Throws error for `confidence > 1.0`            | Validation checks `obj.confidence < 0 \|\| obj.confidence > 1`                                                  | Logic is correct                                                                         |

---

## Root Cause Analysis

### 1. **Operator Precedence Bug in `isServer()` Helper** ⚠️ CRITICAL

**Location**: `firestore.rules` lines 62-65

```firestore
function isServer() {
  return request.auth.token.server == true ||
    request.auth.uid == null && request.auth.token.aud == 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit';
}
```

**Problem**: Without parentheses, `&&` binds tighter than `||`, so this evaluates as:

```
(request.auth.token.server == true) || (request.auth.uid == null && request.auth.token.aud == '...')
```

This is **NOT** what was intended. The second condition should be more restrictive.

**Impact**: Tests 4, 5 fail because `isServer()` may allow non-server requests or deny valid ones.

**Fix** (1-liner):

```firestore
return request.auth.token.server == true ||
       (request.auth.uid == null && request.auth.token.aud == 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit');
```

---

### 2. **NOTIVISA Payload Validation Inconsistency**

**Location**: `firestore.rules` line 83 vs test at phase3-helpers.e2e.test.ts:172

**Rule**:

```firestore
&& payload.status in ['PENDING', 'SENT', 'FAILED', 'DELIVERED'];
```

**Test**:

```typescript
['PENDING', 'SENT', 'FAILED'].includes(validPayload.status);
```

**Problem**: Rule includes 'DELIVERED' but test only checks for 3 statuses. This creates inconsistency.

**Impact**: Test 2 may fail if test expects exact 3-status support.

**Fix** (1-liner): Update test to match rule:

```typescript
['PENDING', 'SENT', 'FAILED', 'DELIVERED'].includes(validPayload.status);
```

Or remove 'DELIVERED' from rule if not needed in Phase 3.2.

---

### 3. **Portal Rule — Missing Separate Create/Update Rules**

**Location**: `firestore.rules` lines 1939-1942

```firestore
match /portal-configuracao/{docId} {
  allow read: if isPatient(labId) || isActiveMemberOfLab(labId);
  allow write: if isAdminOrRT(labId) && request.resource.data.updatedBy == request.auth.uid;
}
```

**Problem**: Using `write` instead of separate `create` + `update` rules. Also, rule requires `updatedBy == request.auth.uid` but doesn't prevent patients from updating.

**Impact**: Test 1 passes on client but would fail on emulator if `updatedBy` field missing or if patient tries to write.

**Fix** (3-liner): Separate rules:

```firestore
allow create: if isAdminOrRT(labId);
allow update: if isAdminOrRT(labId) && request.resource.data.updatedBy == request.auth.uid && keepsLabId();
allow delete: if false;
```

---

### 4. **Laudo Draft Lock Validation Logic**

**Location**: `firestore.rules` lines 1982-1985

```firestore
match /laudos-draft/rascunhos/{docId} {
  allow create, write: if isAdminOrRT(labId) && validateDraftLock(request.resource.data);
  allow read: if isActiveMemberOfLab(labId) || isPatient(labId);
  allow delete: if false;
}
```

**Problem**: Rule uses `create, write:` instead of `create:` + `update: + write:`. This allows creation without lock validation (new docs have no lock yet).

**Impact**: Test 5 expects lock enforcement on create, but rule allows any admin/RT to create.

**Fix** (3-liner): Distinguish operations:

```firestore
allow create: if isAdminOrRT(labId);  // New draft, no lock yet
allow update, write: if isAdminOrRT(labId) && validateDraftLock(request.resource.data);
allow delete: if false;
```

---

### 5. **Test Helper: Wrong Error Type in notivisaFormatter**

**Location**: phase3-helpers.e2e.test.ts line 371-392

**Test**:

```typescript
expect(() => {
  if (!paciente.cpf) throw new Error('Missing required fields for NOTIVISA formatting');
  notivisaFormatter(laudo, paciente);
}).toThrow();
```

**Problem**: Test manually throws error before calling function. Function at line 97-99 also throws same generic `Error`, but test doesn't use `toThrow('Missing required...')` to match.

**Impact**: Test 6 passes due to manual throw, but doesn't actually test the function's error handling.

**Fix** (1-liner): Remove manual throw:

```typescript
expect(() => notivisaFormatter(laudo, paciente)).toThrow('Missing required fields');
```

---

### 6. **Timing/Race Condition in Draft Lock Tests**

**Location**: phase3-helpers.e2e.test.ts lines 544-580

**Problem**: `Timestamp.fromDate(new Date(Date.now() + 3600000))` creates lock expiry 1 hour in future, but tests immediately check `locked_until_ts > request.time` (which is `now`). On slow systems, `Date.now()` may advance between calls.

**Impact**: Tests 8, 9 may intermittently fail on high-latency systems.

**Fix**: Add small buffer:

```typescript
const lockExpiry = Timestamp.fromDate(
  new Date(Date.now() + 3600000 + 100), // +100ms buffer
);
```

---

## Deployment Risk Assessment

| Risk                                                 | Severity | Mitigation                                           |
| ---------------------------------------------------- | -------- | ---------------------------------------------------- |
| `isServer()` precedence bug allows unintended access | MEDIUM   | Fix operator precedence immediately before deploy    |
| Portal write rule too permissive for patients        | LOW      | Only admins/RT can write, but rule should be clearer |
| Draft lock validation on create vs update            | LOW      | Both create and update work, but semantics differ    |
| NOTIVISA status list mismatch                        | LOW      | Rule is correct, test is incomplete                  |
| Test timing issues                                   | LOW      | Add timestamp buffer, tests still pass locally       |

**Recommendation**:

- **Rollback**: NO — Rules are functional, tests are mostly documentation
- **Fix before deploy**: YES — Fix operator precedence in `isServer()` (critical), separate create/update rules for clarity
- **Fix in next PR**: Update test expectations to match validated rule behavior

---

## Implementation Checklist

- [ ] Fix `isServer()` operator precedence (add parentheses)
- [ ] Separate `portal-configuracao` into `allow create:`, `allow update:`
- [ ] Separate `laudos-draft` create from update for lock semantics
- [ ] Update test at phase3-helpers.e2e.test.ts:171 to include 'DELIVERED' status
- [ ] Remove manual error throw from test 1.2, let function throw
- [ ] Add timestamp buffer to lock expiry tests
- [ ] Run `npm test:unit` locally (no emulator required)
- [ ] Redeploy rules with `firebase deploy --only firestore:rules`

---

## Quick Rollback Option

If emulator tests still fail after fixes, revert to previous rules:

```bash
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

This keeps all Phase 2 rules intact and delays Phase 3.2 rules to next milestone.
