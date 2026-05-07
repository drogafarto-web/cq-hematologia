# Wave 2 Rules — Exact Insertion Points

**File:** `C:\hc quality\firestore.rules`  
**Current Size:** 2,049 lines  
**Post-Wave2 Size:** ~2,234 lines  
**Total Addition:** ~185 lines (5 match blocks + rule logic)

---

## Helper Functions Status

### ✅ Already Present (No action needed)

**Function 1: `validateNotivisaPayload(payload)`**
```
Location: firestore.rules, Lines 78-84
Status: ✅ VERIFIED
Definition: Complete and correct
```

**Function 2: `validateDraftLock(d)`**
```
Location: firestore.rules, Lines 88-91
Status: ✅ VERIFIED
Definition: Complete and correct
Pessimistic lock logic: Correct
```

**All 8 existing helper functions:**
- `isAuthenticated()` — Line 26
- `isSuperAdmin()` — Line 30
- `isActiveMemberOfLab(labId)` — Line 35
- `getMemberRole(labId)` — Line 40
- `isAdminOrOwner(labId)` — Line 44
- `isAdmin(labId)` — Line 49
- `hasModuleAccess(module)` — Line 55
- `isServer()` — Line 62
- `isPatient(labId)` — Line 68
- `isAdminOrRT(labId)` — Line 73

✅ **Status:** All usable, no conflicts, no modifications needed.

---

## Insertion Points for 5 New Match Blocks

### Status: Collections Already Present!

**MAJOR FINDING:** All 5 Wave 2 collections are **ALREADY DEFINED** in firestore.rules!

This was done in Phase 3.1 Task 03-01 (Schema Extensions). The rules blocks are already at:
- Line 1949–1954: `/notivisa-outbox/events`
- Line 1961–1966: `/criticos-escalacoes/escalacoes`
- Line 1972–1975: `/imuno-ias-dev/images`
- Line 1982–1986: `/laudos-draft/rascunhos`

However, the current rules are **MINIMAL** and just have placeholders. Task 03-02 will **EXPAND** them with proper access controls.

---

## Detailed Insertion Points for Task 03-02

### ✅ Block 1: Portal Configuration — Already Present (Lines 1939–1943)

**Current state (simplified):**
```firestore-rules
1939    match /portal-configuracao/{docId} {
1940      allow read, write: if isActiveMemberOfLab(labId);  // ← Will refactor
1941    }
```

**Task 03-02 will expand to:**
```firestore-rules
      match /portal-configuracao/{docId} {
        // Patient: read lab portal config (for branding)
        allow read: if isPatient(labId) || isActiveMemberOfLab(labId);
        // RT/Admin: write config (rebranding)
        allow write: if isAdminOrRT(labId) && request.resource.data.updatedBy == request.auth.uid;
        allow delete: if false;
      }
```

**Changes to apply:** Replace lines 1939–1941 with expanded version (3 lines → 7 lines)

### ✅ Block 2: NOTIVISA Outbox — Already Present (Lines 1949–1954)

**Current state:**
```firestore-rules
1949    match /notivisa-outbox/events/{docId} {
1950      allow create: if isAdminOrRT(labId) && validateNotivisaPayload(request.resource.data);
1951      allow read: if isServer() || isActiveMemberOfLab(labId);
1952      allow update: if isServer();
1953      allow delete: if false;
1954    }
```

**Status:** ✅ **ALREADY COMPLETE** — No changes needed. This block is already correct per 03-02-PLAN.

### ✅ Block 3: Critical Escalations — Already Present (Lines 1961–1966)

**Current state:**
```firestore-rules
1961    match /criticos-escalacoes/escalacoes/{docId} {
1962      allow create: if isAdminOrRT(labId);
1963      allow read: if isActiveMemberOfLab(labId);
1964      allow update: if isAdminOrRT(labId) && request.resource.data.resolved_at != null;
1965      allow delete: if false;
1966    }
```

**Status:** ✅ **ALREADY COMPLETE** — No changes needed. This block is already correct per 03-02-PLAN.

### ✅ Block 4: IA Strip Dev — Already Present (Lines 1972–1975)

**Current state:**
```firestore-rules
1972    match /imuno-ias-dev/images/{docId} {
1973      allow read, write: if isServer() || isAdminOrRT(labId);
1974      allow delete: if false;
1975    }
```

**Status:** ⚠️ **NEEDS REFINEMENT** — Currently uses `isAdminOrRT()` but 03-02-PLAN specifies `isServer() || isAdmin(labId)`.

**Task 03-02 will change to:**
```firestore-rules
      match /imuno-ias-dev/images/{docId} {
        // Server/Admin only: all access (IA training pipeline)
        allow read, write: if isServer() || isAdmin(labId);
        allow delete: if false;
      }
```

**Change needed:** Line 1973 — replace `isAdminOrRT(labId)` with `isAdmin(labId)`

### ✅ Block 5: Laudo Draft — Already Present (Lines 1982–1986)

**Current state:**
```firestore-rules
1982    match /laudos-draft/rascunhos/{docId} {
1983      allow create, write: if isAdminOrRT(labId) && validateDraftLock(request.resource.data);
1984      allow read: if isActiveMemberOfLab(labId) || isPatient(labId);
1985      allow delete: if false;
1986    }
```

**Status:** ✅ **ALREADY COMPLETE** — No changes needed. This block is already correct per 03-02-PLAN.

---

## Summary of Changes Required for Task 03-02

The good news: **The blocks already exist.** Task 03-02 only needs to apply these refinements:

| Block | Location | Change | Status |
|-------|----------|--------|--------|
| Portal Config | Lines 1939–1941 | Expand comments + separate read/write | ⚠️ Minor |
| NOTIVISA Outbox | Lines 1949–1954 | ✅ Complete, no changes | ✅ Skip |
| Criticos Escalacoes | Lines 1961–1966 | ✅ Complete, no changes | ✅ Skip |
| IA Strip Dev | Lines 1972–1975 | Line 1973: change `isAdminOrRT` → `isAdmin` | ⚠️ 1 line |
| Laudo Draft | Lines 1982–1986 | ✅ Complete, no changes | ✅ Skip |

**Total changes for Task 03-02:** ~15 lines (mostly comment expansion + 1 logic fix)

---

## Verification Script

```bash
# Verify all 5 blocks are present
grep -n "match /labs/{labId}/portal-configuracao" firestore.rules
grep -n "match /labs/{labId}/notivisa-outbox/events" firestore.rules
grep -n "match /labs/{labId}/criticos-escalacoes/escalacoes" firestore.rules
grep -n "match /labs/{labId}/imuno-ias-dev/images" firestore.rules
grep -n "match /labs/{labId}/laudos-draft/rascunhos" firestore.rules

# Expected output: All 5 should return exactly 1 line number
```

<function_calls>
<invoke name="Bash">
<parameter name="command">grep -n "match /labs/{labId}" "C:\hc quality\firestore.rules" | head -5