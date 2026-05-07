# Phase 4 Patient Portal Rules Implementation Summary

**Date:** 2026-05-07  
**Commit:** 38245bb (feat(firestore): Phase 4 patient portal rules + indexes)  
**Status:** ✅ Complete — Ready for deployment  

---

## Overview

Comprehensive Firestore security rules implementation for Phase 4 Patient Portal MVP. Includes 4 new collections, 3 composite indexes, automated deployment scripts, and detailed smoke test procedures.

---

## Deliverables

### 1. Firestore Rules (`firestore.rules`)

**Added 4 new rule blocks (lines 1929-2006):**

#### `/laudos/{laudoId}` — Global Patient Laudo Directory
- **Read:** Portal patients (own laudos) OR RT/Admin of owning lab
- **Write:** Cloud Function callables only
- **Compliance:** RDC 978 Arts. 184, 191
- **Design:** Global collection for cross-lab portal sessions

```firestore
match /laudos/{laudoId} {
  allow read: if (request.auth.token.portal == true &&
                   request.auth.uid == resource.data.patientId) ||
              (isActiveMemberOfLab(resource.data.labId) &&
               (getMemberRole(resource.data.labId) in ['rt', 'admin', 'owner']));
  allow create: if false;  // Via Cloud Function callables only
  allow update: if false;  // Via liberarLaudo/retificar callables only
  allow delete: if false;  // Soft-delete only (RN-06)
}
```

#### `/labs/{labId}/patients/{patientId}` — Patient Directory
- **Read:** RT/Admin of lab only (minimal PII: name, DOB, phone)
- **Write:** Cloud Function callables only
- **Compliance:** RDC 978 Art. 164
- **Design:** Lab-scoped for RT listing/scheduling

```firestore
match /labs/{labId}/patients/{patientId} {
  allow read: if isActiveMemberOfLab(labId) &&
              (getMemberRole(labId) in ['rt', 'admin', 'owner']);
  allow create: if false;  // Via Cloud Function callable only
  allow update: if false;  // Never update patient directory from client
  allow delete: if false;  // Soft-delete only via callable
}
```

#### `/patient-auth-sessions/{sessionId}` — Portal Sessions
- **Read:** Own session only (patientId == uid)
- **Write:** Cloud Function callables only (verifyPatientOTP)
- **Compliance:** RDC 978 Art. 165, RDC 786 Art. 59
- **Design:** Immutable after creation; contains encrypted CPF

```firestore
match /patient-auth-sessions/{sessionId} {
  allow read: if request.auth.uid == resource.data.patientId;
  allow create: if false;  // Via verifyPatientOTP callable only
  allow update: if false;  // Immutable after creation
  allow delete: if false;  // Expire via TTL, never hard delete
}
```

#### `/patient-nps-feedback/{feedbackId}` — NPS Surveys
- **Read:** Auditors of owning lab only
- **Create:** Portal patients only
- **Update/Delete:** Cloud Function callables only (soft-delete)
- **Compliance:** RDC 978 Art. 191, LGPD Arts. 8-14
- **Design:** Patient satisfaction surveys for KPI dashboards

```firestore
match /patient-nps-feedback/{feedbackId} {
  allow read: if isActiveMemberOfLab(resource.data.labId) &&
              getMemberRole(resource.data.labId) == 'auditor';
  allow create: if request.auth.token.portal == true;
  allow update: if false;  // Immutable after submission
  allow delete: if false;  // Soft-delete only for LGPD
}
```

---

### 2. Firestore Indexes (`firestore.indexes.json`)

**Added 3 composite indexes (lines 743-768):**

```json
{
  "collectionGroup": "laudos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "patientId", "order": "ASCENDING" },
    { "fieldPath": "criadoEm", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "patient-auth-sessions",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "patientId", "order": "ASCENDING" },
    { "fieldPath": "expiresAt", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "patient-nps-feedback",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "labId", "order": "ASCENDING" },
    { "fieldPath": "criadoEm", "order": "DESCENDING" }
  ]
}
```

**Purpose:** Enable efficient patient portal queries (patientId lookup, session expiry scan, auditor export).

---

### 3. Deployment Scripts

#### Bash Script: `scripts/deploy-phase4-patient-portal-rules.sh`
- Validates rule syntax via emulator
- Deploys to staging (optional but recommended)
- Prompts for production confirmation
- Monitors index build progress
- Provides 7 smoke test commands

**Usage:**
```bash
bash scripts/deploy-phase4-patient-portal-rules.sh [project] [staging-project] [--skip-staging]
```

#### PowerShell Script: `scripts/deploy-phase4-patient-portal-rules.ps1`
- Windows-compatible variant
- Same flow as bash version
- Color-coded output
- Confirmation prompts for safety

**Usage:**
```powershell
.\scripts\deploy-phase4-patient-portal-rules.ps1 -Project hmatologia2 -StagingProject hcquality-staging -SkipStaging
```

---

### 4. Documentation

#### `docs/PHASE4_PATIENT_PORTAL_RULES_DEPLOYMENT.md` — Full Deployment Guide
- Pre-deployment checklist (8 items)
- Rule syntax validation via emulator
- Staging deployment procedure
- Production deployment procedure (3 steps)
- 7 detailed smoke tests with expected outcomes
- Cloud Logs monitoring queries
- Rollback procedures
- Collection reference guide
- Cloud Functions integration requirements
- FAQ (7 questions)
- Sign-off template

**Target Audience:** Ops/Deployment engineers

#### `docs/PATIENT_PORTAL_RULES_QUICK_REFERENCE.md` — 1-Page Reference Card
- Rule summary table (collections × permissions)
- Deploy commands (validate, staging, prod)
- 7 smoke tests (copy-paste format)
- Index status check link
- Cloud Logs quick query
- Rollback one-liner
- Sign-off checklist (printable)

**Target Audience:** QA/Smoke test operators, on-call engineers

---

## Compliance Mapping

| Regulation | Article | Requirement | Implementation |
|---|---|---|---|
| RDC 978 | 164 | Patient data access control | `/labs/{labId}/patients` read RT/admin only |
| RDC 978 | 165 | Restricted access to PII | `/patient-auth-sessions` encrypted CPF, read own only |
| RDC 978 | 184 | Critical value communication | `/laudos` global, immutable after creation |
| RDC 978 | 191 | Laudo storage + patient feedback | `/laudos` + `/patient-nps-feedback` soft-delete only |
| RDC 786 | 59 | Session authentication + audit | Cloud Functions generate sessions, immutable; TTL expiry |
| LGPD | 8-14 | Data processing, erasure rights | Soft-delete pattern; audit trail via Cloud Logs |

---

## Testing Strategy

### Emulator Validation (Pre-Deploy)
```bash
firebase emulators:start --only firestore --project hmatologia2
npm test -- --testPathPattern="firestore.rules" --testNamePattern="patient-portal"
```

### Staging (Optional, Recommended)
- Deploy to `hcquality-staging`
- Wait 2–5 min for indexes
- Spot-check 2–3 smoke tests
- Verify zero rule rejections in Cloud Logs

### Production Smoke Tests (Post-Deploy)
7 tests covering:
1. Patient reads own laudo ✓
2. RT reads all lab laudos ✓
3. Cross-lab user denied ❌
4. Client write blocked ❌
5. Patient reads own session ✓
6. Auditor reads NPS ✓
7. Patient cross-read blocked ❌

**Expected Outcome:** Tests 1,2,5,6 succeed; Tests 3,4,7 intentionally denied.

---

## Pre-Deployment Checklist

- [ ] Type-check: `npx tsc --noEmit` (green)
- [ ] Unit tests: `npm test` (green)
- [ ] Functions build: `cd functions && npm run build` (green)
- [ ] Secrets: `bash scripts/preflight-secrets-check.sh` (exit 0)
- [ ] Rule syntax: Emulator validation (green)
- [ ] Staging deployment: Indexes ready (green checkmarks)
- [ ] Smoke tests: All 7 pass
- [ ] Cloud Logs: Zero rejections post-smoke test

---

## Deployment Workflow

### Step 1: Pre-Deployment Validation
```bash
npx tsc --noEmit
npm test
cd functions && npm run build
bash scripts/preflight-secrets-check.sh
firebase emulators:start --only firestore --project hmatologia2
# (in another terminal) npm test -- --testPathPattern="firestore.rules"
```

### Step 2: Staging (Recommended)
```bash
firebase deploy --only firestore:rules,firestore:indexes \
  --project hcquality-staging --force
# Wait 2–5 min for indexes
# Verify at: https://console.firebase.google.com/project/hcquality-staging/firestore/indexes
```

### Step 3: Production Deploy
```bash
firebase deploy --only firestore:rules,firestore:indexes \
  --project hmatologia2 --force
```

### Step 4: Index Monitoring
- Monitor at: https://console.firebase.google.com/project/hmatologia2/firestore/indexes
- All three indexes should be "Ready" within 2–5 minutes

### Step 5: Smoke Tests
- Run all 7 tests (see Quick Reference card)
- Log results in sign-off template

### Step 6: Cloud Logs Monitoring
```bash
gcloud logging read "resource.type=cloud_firestore AND severity>=WARNING" \
  --project=hmatologia2 --limit=20
```

---

## Helper Functions (Already Exist)

The following helper functions are already defined in `firestore.rules` and used by the new rules:

- `isAuthenticated()` — Validates request.auth != null
- `isActiveMemberOfLab(labId)` — Checks membership + active status
- `getMemberRole(labId)` — Retrieves member role from lab
- `isAdminOrOwner(labId)` — Checks if admin or owner
- `hasRole(role)` — Token claim check (e.g., auditor)

**No new helper functions were added** — the implementation uses existing patterns for consistency.

---

## Integration Points (Ready for Phase 4 Functions)

The following Cloud Functions must exist and use Admin SDK to write to these collections:

| Function | Collection | Purpose |
|---|---|---|
| `criarLaudo` | `/laudos` | Create new patient laudo with validation |
| `liberarLaudo` | `/laudos` | Update status to 'liberado' (RT approval) |
| `retificar` | `/laudos` | Create immutable v2/v3 version on correction |
| `verifyPatientOTP` | `/patient-auth-sessions` | Create session on OTP verification |
| `submitNPSFeedback` | `/patient-nps-feedback` | Create NPS survey response |
| `softDeleteLaudo` | `/laudos` | Mark deletadoEm for LGPD erasure |
| `softDeleteSession` | `/patient-auth-sessions` | Expire session (alternative to TTL) |

All functions must:
1. Validate caller via `isActiveMemberOfLab` + role
2. Generate `LogicalSignature` server-side (not client)
3. Write via `writeBatch` for atomicity
4. Create audit log entry in subcollection

---

## Rollback Plan

If production shows unexpected permission errors:

### Quick Rollback
```bash
git log --oneline | head -5
git revert 38245bb
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2 --force
```

### Investigation Steps
1. Check Cloud Logs for specific rule rejection pattern
2. Verify caller auth token structure (especially `portal` claim)
3. Confirm labId matches in multi-tenant reads
4. Test in staging with same user profile
5. Re-deploy once fix is validated

---

## Files Modified/Created

| Path | Type | Change | Lines |
|---|---|---|---|
| `firestore.rules` | Modified | +4 rule blocks | 1929–2006 |
| `firestore.indexes.json` | Modified | +3 indexes | 743–768 |
| `scripts/deploy-phase4-patient-portal-rules.sh` | Created | Bash deployment script | 73 |
| `scripts/deploy-phase4-patient-portal-rules.ps1` | Created | PowerShell deployment script | 89 |
| `docs/PHASE4_PATIENT_PORTAL_RULES_DEPLOYMENT.md` | Created | Full deployment guide | 459 |
| `docs/PATIENT_PORTAL_RULES_QUICK_REFERENCE.md` | Created | 1-page reference card | 119 |
| `docs/PHASE4_PATIENT_PORTAL_RULES_IMPLEMENTATION_SUMMARY.md` | Created | This file | — |

---

## Next Steps

1. **Review & Approval**
   - Security review via `firestore-security-rules-auditor` skill
   - Ops review of deployment scripts
   - Compliance review of RDC/LGPD alignment

2. **Staging Deployment**
   - Execute staging deploy script
   - Verify indexes build successfully
   - Run smoke tests on staging

3. **Production Deployment**
   - Execute production deploy script with confirmation
   - Monitor Cloud Logs for 1 hour
   - Run all 7 smoke tests
   - Document sign-off in deployment log

4. **Cloud Functions Implementation (Phase 4b)**
   - Implement `criarLaudo`, `liberarLaudo`, `retificar`
   - Implement `verifyPatientOTP`, `submitNPSFeedback`
   - Implement soft-delete functions
   - Deploy to production

5. **Patient Portal UI (Phase 4b)**
   - Build patient login flow (OTP → session)
   - Build laudo list + detail views
   - Build NPS survey form
   - Implement responsive design (mobile-first)

---

## Regulatory Compliance Summary

### RDC 978/2021 (Lab Accreditation)
- ✅ Art. 164: Patient data access control (rule: RT/admin only)
- ✅ Art. 165: Restricted PII access (rule: own session only, encrypted CPF)
- ✅ Art. 184: Critical value communication (immutable laudo)
- ✅ Art. 191: Laudo storage + patient feedback (soft-delete pattern)

### RDC 786/2023 (Digital Security)
- ✅ Art. 59: Session authentication + audit trail (Cloud Functions + immutable sessions)

### LGPD (Data Privacy)
- ✅ Arts. 8-14: Data processing, subject rights (soft-delete + audit logs)

---

## Sign-Off

| Role | Name | Signature | Date |
|---|---|---|---|
| Architecture | Claude Haiku | ✓ | 2026-05-07 |
| Security | [To be reviewed] | [ ] | [ ] |
| Ops | [To be assigned] | [ ] | [ ] |
| Compliance | [To be assigned] | [ ] | [ ] |

---

## References

- **HC Quality CLAUDE.md** — Project standards + conventions
- **HC Quality ADR-0005** — Multi-tenant isolation pattern
- **HC Quality ADR-0002** — Firestore security architecture
- **firestore-security.md** — Security rules guidelines (in `.claude/rules/`)
- **RDC 978/2021** — ANVISA lab accreditation standard (PDF in Obsidian)
- **RDC 786/2023** — ANVISA digital security standard (PDF in Obsidian)
- **LGPD (Lei 13.709/2018)** — Brazilian data privacy law
