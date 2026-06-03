# Phase 4 Patient Portal Rules Deployment Guide

**Date:** 2026-05-07  
**Phase:** Phase 4 (Patient Portal Foundation)  
**Components:** Firestore Rules + Indexes for patient portal access  
**Regulatory Alignment:** RDC 978 Arts. 164-165, 184-191; RDC 786 Art. 59; LGPD Arts. 8, 14

---

## Overview

This deployment adds Firestore security rules and indexes for the Phase 4 Patient Portal MVP:

- **`/laudos`** — Global patient laudo directory (read by patients, RT/admin)
- **`/labs/{labId}/patients`** — Patient registry (read by RT/admin only)
- **`/patient-auth-sessions`** — Portal session tracking (read by own session only)
- **`/patient-nps-feedback`** — Patient satisfaction surveys (write by patients, read by auditors)

All collections follow RDC 978 multi-tenant isolation and RN-06 soft-delete constraints.

---

## Pre-Deployment Checklist

- [ ] All three rule blocks added to `firestore.rules` ✓ (validated via edit)
- [ ] All three indexes added to `firestore.indexes.json` ✓ (validated via edit)
- [ ] Type-check passes: `npx tsc --noEmit`
- [ ] Unit tests pass: `npm test`
- [ ] Cloud Functions build passes: `cd functions && npm run build`
- [ ] No PENDING_SET secrets: `bash scripts/preflight-secrets-check.sh`

### Quick Pre-Check

```bash
# 1. Type-check
npx tsc --noEmit
if [ $? -eq 0 ]; then echo "✓ TypeScript OK"; fi

# 2. Unit tests (optional, for isolated feature tests)
npm test -- --testPathPattern="patient-portal" || npm test

# 3. Secret validation
bash scripts/preflight-secrets-check.sh
# Output should be 0 (green)
```

---

## Rule Syntax Validation (Emulator)

Before production deploy, validate rules syntax locally:

```bash
# Terminal 1: Start emulator
firebase emulators:start --only firestore --project hmatologia2

# Terminal 2: Run validation tests (if tests exist)
npm test -- --testPathPattern="firestore.rules" --testNamePattern="patient-portal"
```

**Expected output:** `PASS` all rules tests.

---

## Staging Deployment (Optional but Recommended)

Deploy to staging first to verify no cross-tenant or permission regressions:

```bash
firebase deploy \
  --only firestore:rules,firestore:indexes \
  --project hcquality-staging \
  --force
```

Wait 2–5 minutes for indexes to build. Monitor at:
https://console.firebase.google.com/project/hcquality-staging/firestore/indexes

All indexes should reach "Ready" state (green checkmark).

---

## Production Deployment

### Step 1: Deploy Rules + Indexes

```bash
firebase deploy \
  --only firestore:rules,firestore:indexes \
  --project hmatologia2 \
  --force
```

**Expected output:**

```
✔  Deploy complete!
...
i  functions: functions URL is <region>-hmatologia2.cloudfunctions.net
```

### Step 2: Wait for Index Build

Monitor index build at:
https://console.firebase.google.com/project/hmatologia2/firestore/indexes

Three new indexes should appear:

- `laudos (patientId, criadoEm desc)`
- `patient-auth-sessions (patientId, expiresAt asc)`
- `patient-nps-feedback (labId, criadoEm desc)`

All must reach "Ready" state before running smoke tests.

---

## Smoke Tests (Manual)

After indexes are ready, run these tests via Firestore Console or via test client:

### Test 1: Portal Patient Reads Own Laudo

**Scenario:** Patient logs in via portal; reads own laudo.

```
User: patient@example.com (ID: patient_uid_123)
Auth token: { portal: true, uid: patient_uid_123 }

Action: Read /laudos/laudo_456
Where: resource.data.patientId == "patient_uid_123"

Expected: ✅ READ ALLOWED
```

### Test 2: RT Reads All Lab Laudos

**Scenario:** RT/Admin accesses lab's complete laudo history.

```
User: rt@labclin.com (member of labId_789, role: 'rt')
Auth: { uid: rt_uid, labId: labId_789, role: 'rt' }

Action: Read /laudos where labId == "labId_789"

Expected: ✅ READ ALLOWED (all lab's laudos visible)
```

### Test 3: Non-Lab User Cannot Read Laudo

**Scenario:** User from different lab tries to read laudo.

```
User: other@different-lab.com (NOT member of labId_789)
Auth: { uid: other_uid }

Action: Read /laudos/laudo_456 (belongs to labId_789)

Expected: ❌ PERMISSION_DENIED (rule fails isActiveMemberOfLab)
```

### Test 4: Client Cannot Write Laudo

**Scenario:** Malicious client attempts direct laudo create.

```
User: any authenticated user
Auth: any token (portal or not)

Action: Create /laudos/new_laudo_999
Payload: { patientId: "...", labId: "...", ... }

Expected: ❌ PERMISSION_DENIED (allow create: if false)
```

### Test 5: Patient Reads Own Auth Session

**Scenario:** Patient checks session expiry during portal session.

```
User: patient@example.com (ID: patient_uid_123)
Auth: { portal: true, uid: patient_uid_123 }

Action: Read /patient-auth-sessions/session_456
Where: resource.data.patientId == "patient_uid_123"

Expected: ✅ READ ALLOWED
```

### Test 6: Auditor Reads NPS Feedback

**Scenario:** Auditor queries NPS feedback for KPI export.

```
User: auditor@labclin.com (member of labId_789, role: 'auditor')
Auth: { uid: auditor_uid, labId: labId_789, role: 'auditor' }

Action: Read /patient-nps-feedback where labId == "labId_789"

Expected: ✅ READ ALLOWED
```

### Test 7: Patient Cannot Read Other's Session

**Scenario:** Patient attempts to read another patient's session.

```
User: patient_a@example.com (ID: patient_uid_aaa)
Auth: { portal: true, uid: patient_uid_aaa }

Action: Read /patient-auth-sessions/session_bbb
Where: resource.data.patientId == "patient_uid_bbb"

Expected: ❌ PERMISSION_DENIED (read checks own patientId)
```

---

## Cloud Logs Monitoring

After deployment, monitor Cloud Logs for rule rejections:

```bash
# gcloud CLI query for rule rejections (24h window)
gcloud logging read "resource.type=cloud_firestore AND severity>=WARNING" \
  --project=hmatologia2 \
  --limit=50 \
  --format=json | jq '.[] | {timestamp: .timestamp, message: .textPayload, severity: .severity}'
```

Or use [Cloud Logs Dashboard](https://console.cloud.google.com/logs/query):

```sql
resource.type="cloud_firestore"
AND jsonPayload.permission_denied: true
AND (
  jsonPayload.operation.path=~"laudos/.*"
  OR jsonPayload.operation.path=~"patient-auth-sessions/.*"
  OR jsonPayload.operation.path=~"patient-nps-feedback/.*"
)
```

**Expected:** Zero rejections during smoke tests (or only intentional PERMISSION_DENIED from Test 3/4/7).

---

## Rollback Procedure

If production shows rule rejections or permission issues:

### Quick Rollback

```bash
# Revert rules and indexes to previous version
git revert <commit-sha>
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2 --force
```

### Staged Rollback (safer)

1. Document the issue in Cloud Logs
2. Revert to staging for testing
3. Fix rules locally
4. Re-deploy to staging for 1 hour
5. If clear, re-deploy to production

---

## Post-Deployment Verification

### 1. Rule Syntax Verification

```bash
firebase deploy --only firestore:rules --project hmatologia2 --dry-run
# Output should show no syntax errors
```

### 2. Index Status

Check Firebase Console:

- All three new indexes in "Ready" state
- No "Error" or "Building" state after 10 minutes

### 3. Laudo Reads Work

In Firestore Console, test a sample read:

```
Collection: laudos
Query: patientId == "test_patient_uid"
Filter: labId == "test_lab_id"

Expected: Document visible to portal user, hidden to non-lab users
```

### 4. No Permission Errors in Logs

```bash
# Should return 0 results (no errors)
gcloud logging read "resource.type=cloud_firestore AND textPayload=~'.*PERMISSION_DENIED.*'" \
  --project=hmatologia2 \
  --limit=10
```

---

## Collections Reference

### `/laudos/{laudoId}`

**Type:** Global collection (not under /labs/)  
**Permissions:**

- **Read:** Portal patient (token.portal=true, patientId=uid) OR RT/Admin of owning lab
- **Create/Update/Delete:** Cloud Function only

**Indexes:**

- (patientId, criadoEm desc)

**Typical fields:**

```json
{
  "patientId": "patient_uid_123",
  "labId": "lab_789",
  "laudoNumber": "2026-05-0042",
  "status": "liberado",
  "criadoEm": timestamp,
  "deletadoEm": null
}
```

---

### `/labs/{labId}/patients/{patientId}`

**Type:** Lab-scoped collection  
**Permissions:**

- **Read:** RT/Admin of lab only
- **Create/Update/Delete:** Cloud Function only

**Indexes:** None (small collections, <1k per lab)

**Typical fields:**

```json
{
  "patientId": "patient_uid_123",
  "nomeCompleto": "João Silva",
  "dataNascimento": "1990-03-15",
  "telefonePrincipal": "+55 11 99999-8888",
  "labId": "lab_789",
  "criadoEm": timestamp,
  "deletadoEm": null
}
```

---

### `/patient-auth-sessions/{sessionId}`

**Type:** Global collection  
**Permissions:**

- **Read:** Own session only (patientId=uid)
- **Create/Update/Delete:** Cloud Function only (verifyPatientOTP callable)

**Indexes:**

- (patientId, expiresAt asc)

**Typical fields:**

```json
{
  "patientId": "patient_uid_123",
  "sessionToken": "encrypted_token_...",
  "cpfEncrypted": "encrypted_cpf_...",
  "expiresAt": timestamp,
  "createdAt": timestamp
}
```

---

### `/patient-nps-feedback/{feedbackId}`

**Type:** Global collection  
**Permissions:**

- **Read:** Auditor of owning lab
- **Create:** Portal patients only
- **Update/Delete:** Cloud Function only (soft-delete)

**Indexes:**

- (labId, criadoEm desc)

**Typical fields:**

```json
{
  "feedbackId": "nps_2026_05_0123",
  "patientId": "patient_uid_123",
  "labId": "lab_789",
  "score": 8,
  "comment": "Excelente atendimento!",
  "criadoEm": timestamp,
  "deletadoEm": null
}
```

---

## Integration with Cloud Functions

Ensure the following callables exist and use Admin SDK with server-side signature generation:

- **`criarLaudo`** — Creates laudos; must verify RT/admin auth
- **`verifyPatientOTP`** — Creates patient-auth-sessions; generates encrypted CPF
- **`submitNPSFeedback`** — Creates patient-nps-feedback; validates score 0-10
- **`softDeleteLaudo`** — Updates laudos.deletadoEm via batch write

All must:

1. Validate caller via `isActiveMemberOfLab` + role
2. Generate `LogicalSignature` server-side
3. Write via `writeBatch` for atomicity
4. Audit via `auditLog` subcollection

---

## FAQ

**Q: Why is `/laudos` global and not `/labs/{labId}/laudos`?**

A: Global by design for cross-lab patient portal sessions. A patient may visit multiple labs in a single session; a global collection avoids N queries (one per lab) or complex WHERE multi-valued array filters.

**Q: How is patientId stored securely?**

A: In `/patient-auth-sessions`, the `patientId` matches `request.auth.uid` (Firebase UID from email/phone auth). Full CPF is encrypted at rest. Rules never expose encryption keys.

**Q: Can a patient delete their laudo?**

A: No. Soft-delete only via Cloud Function, which requires RT/admin authorization. LGPD erasure requests are handled via separate `deleteTitularData` callable with 30-day grace period.

**Q: What if indexes don't build within 5 minutes?**

A: Firebase usually builds small indexes instantly. If delayed:

1. Check Cloud Logs for errors: https://console.cloud.google.com/logs/query
2. Verify index definition (JSON syntax)
3. Try manual index creation via Console
4. Contact Firebase Support if still stuck after 30 min

**Q: Do I need to migrate existing laudos to global collection?**

A: No. Phase 4 MVP assumes new patient portal. Existing laudos remain at `/labs/{labId}/laudos`. Migration to global collection is Phase 4b (backlog).

---

## Emergency Contacts

- **On-Call CTO:** See `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`
- **Firebase Support:** https://firebase.google.com/support
- **Incident Severity Matrix:** Green/Yellow/Red/Black in response playbook

---

## Sign-Off

- **Deployed by:** [Your Name]
- **Date:** [Deployment Date]
- **Status:** [ ] Staging OK [ ] Production OK [ ] All Smoke Tests Pass
- **Notes:**

```markdown
- [ ] Rules syntax validated via emulator
- [ ] Staging deployed and indexes ready
- [ ] Production deployed
- [ ] All 7 smoke tests passed
- [ ] Cloud Logs monitored for 1 hour, zero rejections
- [ ] Patient portal read path verified end-to-end
```

---

## References

- **RDC 978/2021** (ANVISA) — Lab accreditation standard, Arts. 164-165 (patient data access control), 184-191 (laudo transmission, storage, critical values)
- **RDC 786/2023** (ANVISA) — Digital security, Art. 59 (session authentication, audit trail)
- **LGPD** (Lei 13.709/2018) — Data privacy law, Arts. 8-14 (data processing, user rights)
- **HC Quality ADR-0005** — Multi-tenant isolation pattern
- **HC Quality ADR-0002** — Firestore security architecture
- **DICQ 4.3** (Documento de Integração de Controle de Qualidade) — Lab quality control documentation standard (Phase 2+)
