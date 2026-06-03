# Patient Portal Rules — Quick Reference Card

**Print this page and keep at desk during smoke testing.**

---

## Rule Summary

| Collection                    | Read                      | Create  | Update  | Delete  |
| ----------------------------- | ------------------------- | ------- | ------- | ------- |
| `/laudos/{id}`                | Patient (own) OR RT/Admin | CF Only | CF Only | CF Only |
| `/labs/{labId}/patients/{id}` | RT/Admin                  | CF Only | CF Only | CF Only |
| `/patient-auth-sessions/{id}` | Patient (own)             | CF Only | CF Only | CF Only |
| `/patient-nps-feedback/{id}`  | Auditor                   | Patient | CF Only | CF Only |

CF = Cloud Function via callable

---

## Deploy Commands

### Validate (Local)

```bash
npx tsc --noEmit
firebase emulators:start --only firestore --project hmatologia2
npm test -- --testPathPattern="firestore.rules"
```

### Staging Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes \
  --project hcquality-staging --force
```

→ Wait 2–5 min for indexes to build → Monitor indexes → Green checkmarks ✓

### Prod Deploy

```bash
firebase deploy --only firestore:rules,firestore:indexes \
  --project hmatologia2 --force
```

---

## 7 Smoke Tests (Copy-Paste)

### Test 1: Patient Reads Own Laudo ✓

```
Scenario: Patient portal login, read own laudo
User: patient_uid (portal token: true)
Read: /laudos/laudo_123 where patientId == "patient_uid"
Expected: ✅ SUCCESS
```

### Test 2: RT Reads All Lab Laudos ✓

```
Scenario: RT accesses lab dashboard
User: rt_uid (labId, role='rt')
Read: /laudos where labId == "lab_789"
Expected: ✅ SUCCESS
```

### Test 3: Cross-Lab User Denied ❌

```
Scenario: User from lab A tries to read lab B's laudo
User: user_other_lab (NOT member of lab_789)
Read: /laudos/laudo_456 (belongs to lab_789)
Expected: ❌ PERMISSION_DENIED
```

### Test 4: Client Write Blocked ❌

```
Scenario: Malicious client tries direct create
User: any authenticated
Action: Create /laudos/new_id { patientId: "...", ... }
Expected: ❌ PERMISSION_DENIED
```

### Test 5: Patient Reads Own Session ✓

```
Scenario: Patient checks session in portal
User: patient_uid (portal token: true)
Read: /patient-auth-sessions/session_456 (patientId == "patient_uid")
Expected: ✅ SUCCESS
```

### Test 6: Auditor Reads NPS ✓

```
Scenario: Auditor exports satisfaction data
User: auditor_uid (labId, role='auditor')
Read: /patient-nps-feedback where labId == "lab_789"
Expected: ✅ SUCCESS
```

### Test 7: Patient Cross-Read Blocked ❌

```
Scenario: Patient tries to read another's session
User: patient_a (portal token: true)
Read: /patient-auth-sessions/session_bbb (patientId == "patient_b")
Expected: ❌ PERMISSION_DENIED
```

---

## Index Status Check

After deploy, verify all 3 indexes are Ready:

https://console.firebase.google.com/project/hmatologia2/firestore/indexes

Should see:

- ✓ laudos (patientId, criadoEm desc)
- ✓ patient-auth-sessions (patientId, expiresAt asc)
- ✓ patient-nps-feedback (labId, criadoEm desc)

---

## Cloud Logs (After Smoke Tests)

Search for rule rejections:

```bash
gcloud logging read "resource.type=cloud_firestore AND severity>=WARNING" \
  --project=hmatologia2 --limit=20 --format=json | jq '.[] | {ts: .timestamp, msg: .textPayload}'
```

**Expected:** Zero rejections (or only the intentional ones from Test 3/4/7).

---

## Rollback (If Issues)

```bash
git revert <commit-sha>
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2 --force
```

---

## Sign-Off Checklist

- [ ] Rules syntax validated ✓
- [ ] Staging indexed and ready ✓
- [ ] Production deployed ✓
- [ ] All 7 smoke tests passed ✓
- [ ] Cloud Logs clean ✓
- [ ] No regressions in existing rules ✓

**Deployment Date:** ****\_****  
**Tester Name:** ****\_****  
**Status:** [ ] GO LIVE [ ] ROLLBACK (reason: **\_\_\_\_**)
