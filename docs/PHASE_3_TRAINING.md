# Phase 3 Training Guide — New Engineers Onboarding

**Version:** 1.0  
**Date:** 2026-05-07  
**Duration:** ~1 hour to master  
**Audience:** Full-stack engineers joining Phase 3 work on HC Quality  
**Prerequisite:** Node 22+, Firebase CLI, basic React + TypeScript knowledge

---

## Quick Navigation

1. [5-Step Onboarding Path (1 Day)](#5-step-onboarding-path--1-day)
2. [Architecture Deep-Dive](#architecture-deep-dive)
3. [Module-by-Module Guides](#module-by-module-guides)
4. [Common Tasks with Copy-Paste Code](#common-tasks-with-copy-paste-code)
5. [Troubleshooting FAQ](#troubleshooting-faq)
6. [Resources & Escalation](#resources--escalation)

---

## 5-Step Onboarding Path (1 Day)

Complete these in order. Each step builds on the previous.

### Hour 1: Read Architecture Overview (15 min reading + 15 min exploration)

**Read:** `c:/hc quality/docs/PHASE_3_HANDBOOK.md` (sections 1–4)

**Key takeaways:**
- 5 new Firestore collections (portal config, NOTIVISA queue, critical escalations, IA training, draft management)
- Multi-tenant isolation: all paths follow `/<collection>/{labId}/<sub>`
- Rules enforce RBAC via member doc + module claims
- Cloud Functions region: `southamerica-east1` (Node 22)
- Audit trail: append-only, immutable per RDC 978 Art. 5

**Do this now:**
1. Skim the "Firestore Collections API Reference" section in PHASE_3_HANDBOOK.md
2. Find `firestore.json` in root — note the region setting
3. Note the 3 new helper modules mentioned in "Wave 3: Shared Helpers"

---

### Hour 2: Hands-On Emulator + Schema Exploration (45 min)

**Start the Firebase Emulator locally:**

```bash
cd "C:\hc quality"
npm install
firebase emulators:start --import=./test-data --export-on-exit
```

Open http://localhost:4000 (Emulator UI). You should see:

- **Firestore tab:** Collections under `labs/{labId}/`
- **Auth tab:** Test users (usually 3–5 preconfigured)
- **Functions tab:** Logs for any callable invocations

**Explore these paths in order:**

1. `labs/labclin-riopomba/portal-configuracao/` — should have 1 doc with `primaryColor`, `logoCdnUrl`
2. `labs/labclin-riopomba/notivisa-outbox/events/` — queue of regulatory notifications (empty or ~3 samples)
3. `labs/labclin-riopomba/criticos-escalacoes/` — critical value alerts (empty initially)
4. `labs/labclin-riopomba/laudos-draft/` — in-progress results (locked for editing)

**Make a test write:**

```typescript
// In browser console on emulator UI or via a test script:
const db = getFirestore();
const docRef = doc(db, 'labs', 'labclin-riopomba', 'portal-configuracao', 'main');
const docSnap = await getDoc(docRef);
console.log(docSnap.data());
```

You should see the portal config structure.

---

### Hour 3: Firestore Rules + RBAC (30 min reading + 15 min exploration)

**Read:** `c:/hc quality/firestore.rules` (lines 1–80, focus on helpers section)

**Key helpers to understand:**

```firestore
function isAuthenticated()              // Returns true if user logged in
function isActiveMemberOfLab(labId)     // Checks if user exists in labs/{labId}/members/{uid}
function hasModuleAccess(module)        // Checks token.modules[module] == true
function isAdminOrRT(labId)             // Admin or RT (Responsável Técnico)
function isPatient(labId)               // Patient role (for patient portal)
function validateNotivisaPayload()      // Validates NOTIVISA event structure
```

**Test access in emulator:**

1. Switch to a different test user in Emulator Auth tab
2. Try to read `labs/labclin-riopomba/notivisa-outbox/events/`
3. Observe: rule might grant/deny based on module claim + role
4. Check error message in browser console

**Key rule pattern to recognize:**

```firestore
match /notivisa-outbox/{document=**} {
  allow read: if isActiveMemberOfLab(labId) && hasModuleAccess('notivisa');
  allow create: if false;  // Callables only
}
```

This means: "Read allowed only if you're an active lab member + have the notivisa claim. Writes must go through a Cloud Function."

---

### Hour 4: Cloud Functions Helpers + Unit Tests (30 min)

**Read:** `functions/src/` structure

```
functions/src/
├── modules/
│   ├── admin/                  # Claim provisioning
│   ├── notivisa/              # NOTIVISA regulatory queue
│   ├── criticos-escalacoes/   # SMS/email routing
│   ├── laudos-draft/          # State machine
│   └── educacao-continuada/   # Training (reference module)
├── helpers/
│   ├── notivisaValidator.ts   # NOTIVISA Art. 6º §1 schema
│   ├── smsFormatter.ts        # CPF masking + number formatting
│   ├── laudoParser.ts         # Result → notification
│   └── iaMetadataStripper.ts  # IA training safety
└── utils/
    └── cryptoAudit.ts         # HMAC chain validation (ADR-0017)
```

**Read helpers in order of complexity:**

1. `functions/src/helpers/smsFormatter.ts` — 20 lines, pure functions
2. `functions/src/helpers/notivisaValidator.ts` — Zod schema for NOTIVISA Art. 6º
3. `functions/src/helpers/cryptoAudit.ts` — HMAC baseline reset (see ADR-0017)

**Run unit tests:**

```bash
cd functions
npm test -- --run helpers/
```

Should see ~15 tests passing. Note test patterns — they're your copy-paste template.

---

### Hour 5: Deploy to Staging + Smoke Tests (30 min)

**Type-check the codebase:**

```bash
npx tsc --noEmit
```

Should show 0 errors (or list of pre-existing warnings documented in MEMORY.md).

**Build locally:**

```bash
npm run build
```

This creates `dist/` (React app) and runs `functions/build/` compilation.

**Run smoke tests:**

```bash
npm run test:smoke
```

Should pass ~12–18 tests covering:
- Auth (user can log in, claims are provisioned)
- Firestore rules (multi-tenant isolation, RBAC)
- Helper validation (NOTIVISA payload, CPF masking, HMAC chain)
- Cloud Functions (at least 2 callable invocations)

**Deploy to staging (if authorized):**

```bash
bash scripts/preflight-secrets-check.sh          # Check secrets first
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2-staging
firebase deploy --only functions --project hmatologia2-staging
firebase deploy --only hosting --project hmatologia2-staging
```

Then open https://hmatologia2-staging.web.app and test manually.

---

## Architecture Deep-Dive

### Multi-Tenant Isolation Pattern

Every collection follows this structure:

```
/labs
  /{labId}
    /portal-configuracao/{docId}    # Branding per lab
    /notivisa-outbox
      /events/{docId}               # Regulatory queue
    /criticos-escalacoes/{docId}    # Critical value rules
    /laudos-draft/{docId}           # Locked drafts
    /ias-training-data/{docId}      # IA metadata (stripped)
    /members/{uid}                  # Lab team (legacy, pre-exists)
```

**Defense-in-depth:** Payload includes `labId` **twice**:
1. In document path: `labs/{labId}/...`
2. In document content: `{ labId, ... }`

This prevents:
- A malicious admin from "moving" their write to another lab
- Firestore rules are enforced at path level
- Service layer validates `payload.labId == pathLabId`

---

### State Machine: Draft Locking

Laudos (results) go through this state:

```
┌─────────────┐
│   DRAFT     │  (Pessimistic lock: doc.lock = { uid, ts })
│  (locked)   │
└──────┬──────┘
       │ [operator releases]
       ↓
┌─────────────┐
│  UNLOCKED   │  (Editable, no lock)
└──────┬──────┘
       │ [RT reviews + signs]
       ↓
┌──────────────┐
│  PUBLISHED   │  (Signed, immutable)
└──────────────┘
```

Rules enforce:
- **DRAFT + locked by user X**: only X can update (pessimistic lock)
- **DRAFT + lock expired (>2h)**: admin can force-unlock + audit
- **PUBLISHED**: never update (`allow update: if false`)

---

### Callable Pattern: Server-Side Signature + Atomic Writes

Client-side code (React hook):

```typescript
// DO NOT sign on client anymore (Phase 0c)
const result = await functions.httpsCallable('notivisaEventCreate')({
  labId: 'labclin-riopomba',
  laudo_id: 'laudo-123',
  patient_cpf: '12345678901',
  // payload structure validated by Zod in Cloud Function
});
```

Server-side Cloud Function:

```typescript
// functions/src/modules/notivisa/notivisaEventCreate.ts

export const notivisaEventCreate = onCall(
  { region: 'southamerica-east1', secrets: ['NOTIVISA_KEY'] },
  async (req, ctx) => {
    const { labId, laudo_id, patient_cpf } = req.data;
    
    // 1. Validate claims
    if (!ctx.auth) throw new HttpsError('unauthenticated', 'Not logged in');
    if (ctx.auth.token.modules.notivisa !== true) {
      throw new HttpsError('permission-denied', 'No notivisa access');
    }
    
    // 2. Validate payload
    const parsed = NotivisaEventSchema.parse({
      laudo_id, patient_cpf, ...
    });
    
    // 3. Atomic write with server signature
    const batch = db.batch();
    const eventRef = db.collection('labs').doc(labId).collection('notivisa-outbox').doc();
    
    const signature = {
      hash: crypto
        .createHmac('sha256', process.env.NOTIVISA_KEY!)
        .update(JSON.stringify(parsed))
        .digest('hex'),
      operatorId: ctx.auth.uid,
      ts: admin.firestore.Timestamp.now(),
    };
    
    batch.set(eventRef, {
      labId,
      ...parsed,
      assinatura: signature,
      status: 'PENDING',
      attempts: 0,
    });
    
    // 4. Audit log
    batch.set(
      db.collection('labs').doc(labId).collection('auditLogs').doc(),
      {
        operation: 'notivisaEventCreate',
        labId,
        userId: ctx.auth.uid,
        timestamp: admin.firestore.Timestamp.now(),
      }
    );
    
    await batch.commit();
    return { eventId: eventRef.id };
  }
);
```

**Key takeaway:** Server owns the signature. Client never forges it. Rules block unsigned writes (`allow create: if false`).

---

### Firestore Security Rules Summary

**Core pattern (repeats for each module):**

```firestore
match /labs/{labId}/notivisa-outbox/events/{eventId} {
  // Read: Active member + module claim
  allow read: if isActiveMemberOfLab(labId) && hasModuleAccess('notivisa');
  
  // Create: Only via Cloud Function (pessimistic block)
  allow create: if false;
  
  // Update: Only if unlocked + owned by user (pessimistic lock pattern)
  allow update: if isActiveMemberOfLab(labId)
    && (resource.data.lock == null || resource.data.lock.uid == request.auth.uid)
    && request.resource.data.labId == labId;
  
  // Delete: Hard delete never
  allow delete: if false;
  
  // Subcollections (audit trail): append-only
  match /auditLog/{logId} {
    allow read: if isActiveMemberOfLab(labId);
    allow create: if isActiveMemberOfLab(labId) && request.resource.data.labId == labId;
    allow update: if false;
    allow delete: if false;
  }
}
```

---

## Module-by-Module Guides

### Module: portal-configuracao

**What it does:** Lab branding, UI theming, custom labels for patients.

**Key files:**
- `src/features/portal/services/portalConfigService.ts` — CRUD
- `functions/src/modules/portal/portalConfigUpdate.ts` — Callable for admin writes
- `firestore.rules` line ~380 — rules block

**Write access:** Admin + Owner only

**Read access:** Everyone in the lab (patients see branding for login page)

**Typical task:**

```typescript
// Get portal config for display
const config = await getPortalConfig('labclin-riopomba');
console.log(config.primaryColor);  // "#7c3aed"

// Update branding (admin only, via callable)
await functions.httpsCallable('portalConfigUpdate')({
  labId: 'labclin-riopomba',
  primaryColor: '#ec4899',
});
```

---

### Module: notivisa-outbox

**What it does:** Queue regulatory notifications to Brazilian NOTIVISA system (RDC 978 Art. 6º).

**Key files:**
- `functions/src/modules/notivisa/notivisaEventCreate.ts` — Receive from result system
- `functions/src/modules/notivisa/notivisaEventSend.ts` — Scheduled poller (every 15 min)
- `functions/src/helpers/notivisaValidator.ts` — Zod schema (11 required fields)
- `firestore.rules` line ~420 — rules block

**Event lifecycle:**

```
PENDING  →  [scheduled CF polls]  →  SENT  →  [webhook callback]  →  DELIVERED
    ↓
  FAILED  →  [retry up to 5x]  →  ...
```

**Critical field:** `patient_cpf` must be masked before transmission (only last 2 digits visible in logs).

**Typical debug task:**

```typescript
// Check stuck events
db.collection('labs')
  .doc('labclin-riopomba')
  .collection('notivisa-outbox')
  .collection('events')
  .where('status', '==', 'FAILED')
  .where('attempts', '>=', 3)
  .get()

// Force retry
await functions.httpsCallable('notivisaEventRetry')({
  labId: 'labclin-riopomba',
  eventId: 'event-123',
});
```

---

### Module: criticos-escalacoes

**What it does:** Critical value alerts. When a result exceeds safe limits, SMS/email escalation to operator.

**Key files:**
- `src/features/criticos/types/CriticoEscalacao.ts` — schema (thresholds per exame)
- `functions/src/modules/criticos/escalarValorCritico.ts` — Callable triggered by result publish
- `functions/src/modules/criticos/sendSmsEscalacao.ts` — SMS routing via Resend
- `functions/src/helpers/smsFormatter.ts` — CPF masking, number formatting

**Thresholds per exam:**

```typescript
interface CriticoEscalacao {
  labId: LabId;
  exame: string;           // e.g., "hemoglobina"
  limiteMin: number;       // Lower bound
  limiteMax: number;       // Upper bound
  escalarPara: string[];   // Array of user IDs or lab alerts
  metodoEscalacao: 'SMS' | 'EMAIL' | 'AMBOS';
  ativo: boolean;
  criadoEm: Timestamp;
}
```

**Typical task: Add SMS escalation for critical glucose**

```typescript
// 1. Create threshold rule
await functions.httpsCallable('criarCriticoEscalacao')({
  labId: 'labclin-riopomba',
  exame: 'glicose',
  limiteMin: 40,
  limiteMax: 400,
  escalarPara: ['operador-123@lab.com'],
  metodoEscalacao: 'SMS',
});

// 2. When a result is published with glicose > 400:
// → Firestore trigger → escalarValorCritico CF fires
// → sendSmsEscalacao invoked
// → Resend sends SMS to configured numbers
// → Audit log created
```

---

### Module: laudos-draft

**What it does:** Draft result management with pessimistic locking. Prevents simultaneous edits.

**State transitions:**

```
DRAFT (locked)  → [operator releases]  → UNLOCKED  → [RT publishes]  → PUBLISHED
```

**Lock timeout:** 2 hours (admin can force-unlock after expiry)

**Key files:**
- `src/features/laudos/services/laudoDraftService.ts` — Lock acquire/release
- `functions/src/modules/laudos/acquireLaudoDraftLock.ts` — Callable
- `functions/src/modules/laudos/forceClearExpiredLock.ts` — Admin utility
- `firestore.rules` line ~520 — pessimistic lock pattern

**Typical conflict resolution:**

```
Scenario: Operator A locked draft 1h ago, then disconnected.
          Operator B now needs to edit.

Command:
  const isExpired = (lockTs) => Date.now() - lockTs > 2 * 60 * 60 * 1000;
  
  if (isExpired(draft.lock.ts)) {
    await functions.httpsCallable('forceClearExpiredLock')({
      labId: 'labclin-riopomba',
      laudoId: 'laudo-123',
      reason: 'Lock timeout',  // audit trail
    });
    // Now Operator B can acquire
    await functions.httpsCallable('acquireLaudoDraftLock')({
      labId: 'labclin-riopomba',
      laudoId: 'laudo-123',
    });
  }
```

---

### Module: ias-training-data

**What it does:** Collects stripped AI training data (no PII) for model improvement.

**Data retained:** Exam values + OCR confidence scores, NOT patient ID/CPF/name.

**Key files:**
- `src/features/analyzer/services/analyzerService.ts` — Capture OCR result
- `functions/src/helpers/iaMetadataStripper.ts` — PII removal
- `functions/src/modules/ias/recordTrainingData.ts` — Server write

**Typical data point:**

```typescript
{
  labId: 'labclin-riopomba',
  equipment: 'yumizen-h550',
  exame: 'hemoglobina',
  ocrValue: 13.2,
  ocrConfidence: 0.98,
  humanVerified: true,
  verifiedValue: 13.2,
  timestamp: Timestamp.now(),
  // NO: patient_cpf, patient_name, or any identifier
}
```

**Compliance:** RDC 978 Art. 17 (Competency data for IA → no PII required)

---

## Common Tasks with Copy-Paste Code

### Task 1: Add a New Escalation Threshold

**Goal:** Critical hemoglobin value should trigger SMS to lab director.

**Steps:**

1. **Check existing thresholds in Firestore:**

```typescript
const db = getFirestore();
const thresholds = await getDocs(
  collection(db, 'labs', 'labclin-riopomba', 'criticos-escalacoes')
);
thresholds.forEach(doc => console.log(doc.data()));
```

2. **Create new threshold via callable:**

```typescript
const functions = getFunctions();
const result = await httpsCallable(functions, 'criarCriticoEscalacao')({
  labId: 'labclin-riopomba',
  exame: 'hemoglobina',
  limiteMin: 5.0,           // Critical low
  limiteMax: 20.0,          // Critical high
  escalarPara: ['diretor@lab.com.br'],
  metodoEscalacao: 'SMS',
  ativo: true,
});
console.log('Created escalation:', result.data.escalacaoId);
```

3. **Test:**

Create a result with `hemoglobina = 4.8`. Within 5 seconds, check Cloud Logs:

```bash
firebase functions:log --only escalarValorCritico --project hmatologia2 --tail
```

You should see:
```
escalarValorCritico: Valor crítico detectado: hemoglobina=4.8, limite=[5.0, 20.0]
escalarValorCritico: SMS enviado para diretor@lab.com.br
```

---

### Task 2: Debug a Stuck Draft Lock

**Scenario:** Laudo `laudo-456` has been locked for 3 hours. Operator can't edit it.

**Steps:**

1. **Check lock status:**

```typescript
const db = getFirestore();
const ref = doc(db, 'labs', 'labclin-riopomba', 'laudos-draft', 'laudo-456');
const snap = await getDoc(ref);
const lock = snap.data()?.lock;

if (lock) {
  console.log('Locked by:', lock.uid);
  console.log('Locked at:', lock.ts.toDate());
  console.log('Elapsed:', Date.now() - lock.ts.toDate().getTime(), 'ms');
}
```

2. **Force-unlock if expired (>2h):**

```typescript
const functions = getFunctions();
if (Date.now() - lock.ts.toDate().getTime() > 2 * 60 * 60 * 1000) {
  await httpsCallable(functions, 'forceClearExpiredLock')({
    labId: 'labclin-riopomba',
    laudoId: 'laudo-456',
    reason: 'Operator disconnected; timeout 2h exceeded',
  });
  console.log('Lock cleared. Audit logged.');
}
```

3. **Re-acquire lock:**

```typescript
await httpsCallable(functions, 'acquireLaudoDraftLock')({
  labId: 'labclin-riopomba',
  laudoId: 'laudo-456',
});
console.log('Lock acquired by current user.');
```

4. **Check audit trail:**

```bash
firebase firestore:export gs://hmatologia2-exports/$(date -u +%s) --project hmatologia2
# Then search logs for 'forceClearExpiredLock'
```

Or via Cloud Logs:

```bash
gcloud logging read \
  'severity=INFO AND jsonPayload.operation="forceClearExpiredLock"' \
  --project hmatologia2 \
  --limit 10 \
  --format json
```

---

### Task 3: Test NOTIVISA Payload Validation

**Goal:** Ensure a regulatory event passes Art. 6º §1 schema before sending.

**Steps:**

1. **Read the Zod schema:**

```typescript
// functions/src/helpers/notivisaValidator.ts
export const NotivisaEventSchema = z.object({
  laudo_id: z.string().min(1),
  patient_cpf: z.string().regex(/^\d{11}$/),
  patient_name: z.string().min(1),
  exam_code: z.string(),
  exam_result: z.number(),
  reference_range: z.object({
    min: z.number(),
    max: z.number(),
  }),
  // ... 6 more fields per RDC 978 Art. 6º §1
});
```

2. **Write a validation test:**

```typescript
// test/helpers/notivisaValidator.test.ts
import { NotivisaEventSchema } from '../../functions/src/helpers/notivisaValidator';

describe('notivisaValidator', () => {
  it('accepts valid NOTIVISA payload', () => {
    const payload = {
      laudo_id: 'laudo-123',
      patient_cpf: '12345678901',
      patient_name: 'João Silva',
      exam_code: 'HB',
      exam_result: 13.5,
      reference_range: { min: 12, max: 16 },
      // ... other fields
    };
    
    expect(() => NotivisaEventSchema.parse(payload)).not.toThrow();
  });

  it('rejects invalid CPF', () => {
    const payload = {
      // ... same as above
      patient_cpf: '123',  // Only 3 digits
    };
    
    expect(() => NotivisaEventSchema.parse(payload)).toThrow();
  });
});
```

3. **Run the test:**

```bash
npm run test -- notivisaValidator.test.ts
```

Expected output:
```
 ✓ notivisaValidator › accepts valid NOTIVISA payload
 ✓ notivisaValidator › rejects invalid CPF
 2 passed
```

---

### Task 4: Deploy Firestore Rules Hotfix

**Scenario:** You fixed a bug in the `portal-configuracao` rules. No schema change, just access control tightening.

**Steps:**

1. **Edit the rules file locally:**

```bash
# c:/hc quality/firestore.rules, around line 380
match /labs/{labId}/portal-configuracao/{docId} {
  allow read: if isActiveMemberOfLab(labId);
  // FIX: only owner can update branding
  allow update: if isActiveMemberOfLab(labId) && isAdminOrOwner(labId);
  allow create: if false;
  allow delete: if false;
}
```

2. **Test locally in emulator:**

```bash
firebase emulators:exec --only firestore "npm test"
```

All tests should pass.

3. **Pre-deploy check:**

```bash
bash scripts/preflight-secrets-check.sh
```

Output should be green (no pending secrets).

4. **Deploy rules only:**

```bash
firebase deploy --only firestore:rules --project hmatologia2
```

Wait for confirmation:
```
Deploy complete!
```

5. **Smoke test in production:**

Log in as admin in https://hmatologia2.web.app. Try to edit portal branding. Should work.

Log in as regular operator. Try to edit portal branding. Should get permission error.

---

## Troubleshooting FAQ

### "Draft lock expired but not cleaned up?"

**Symptoms:** `laudo-123` locked 4 hours ago, `lock.ts` is ancient timestamp.

**Root cause:** Operator disconnected before releasing lock.

**Fix:**

```bash
firebase firestore:export gs://hmatologia2-temp/$(date -u +%s) --project hmatologia2

# Then force-clear
firebase functions:call forceClearExpiredLock \
  --data='{"labId":"labclin-riopomba","laudoId":"laudo-123","reason":"Timeout"}' \
  --project hmatologia2
```

---

### "NOTIVISA validation fails on CPF masking?"

**Symptoms:** Event creation fails with `ValidationError: patient_cpf does not match regex`.

**Root cause:** CPF includes non-digits (spaces, hyphens) or wrong length.

**Fix:**

```typescript
// Sanitize before submitting
const cpfClean = cpf.replace(/\D/g, '');  // Remove non-digits
if (cpfClean.length !== 11) {
  throw new Error('CPF must be exactly 11 digits');
}

await functions.httpsCallable('notivisaEventCreate')({
  patient_cpf: cpfClean,  // Pass clean version
  // ...
});
```

---

### "Rules test failing: Expected {data: ...} but got undefined?"

**Symptoms:**

```
rules-test.js: Error: Expected object but got undefined
at setupRule() line 42
```

**Root cause:** Mock auth context missing `token.modules` claim.

**Fix:**

```typescript
// test/rules.test.ts
const mockAuth = {
  uid: 'user-123',
  token: {
    modules: { notivisa: true },  // Add this
    isSuperAdmin: false,
  },
};

testHelper.rules.firestore.rules(mockAuth).collection('labs').doc('lab-1')...
```

---

### "Functions deploy fails: Cannot find module '@types/node'?"

**Symptoms:**

```
error TS2688: Cannot find type definition file for 'node'
```

**Root cause:** `functions/tsconfig.json` excludes test files, or `node_modules/` missing.

**Fix:**

```bash
cd functions
npm install
npm run build
cd ..
```

---

### "Emulator Firestore won't start: Port 8080 already in use?"

**Symptoms:**

```
Could not initialize Firestore emulator on port 8080
```

**Fix:**

```bash
# Kill process on port 8080
netstat -ano | findstr :8080  # Windows
taskkill /PID <PID> /F

# Or use different port
firebase emulators:start --firestore-port=8081
```

---

### "Cloud Function timeout after 60s?"

**Symptoms:**

```
Error: Cloud Function timed out after 60 seconds
```

**Root cause:** Operation (e.g., PITR export, mass writes) exceeds default 60s timeout.

**Fix:** In Cloud Functions settings:

```typescript
export const myLongFunction = onCall(
  { region: 'southamerica-east1', timeoutSeconds: 300 },  // 5 min
  async (request) => {
    // ... long operation
  }
);
```

---

## Resources & Escalation

### Key Documentation

| Document | Purpose |
|---|---|
| [`c:/hc quality/docs/PHASE_3_HANDBOOK.md`](../PHASE_3_HANDBOOK.md) | Complete schema + rules reference |
| [`c:/hc quality/firestore.rules`](../../firestore.rules) | Security rules (searchable by module name) |
| [`c:/hc quality/docs/adr/ADR-0017-hmac-baseline-reset-2026-05-07.md`](../adr/ADR-0017-hmac-baseline-reset-2026-05-07.md) | HMAC signature history + incident report |
| [`c:/hc quality/docs/adr/ADR-0018-deploy-gate-secret-status-check.md`](../adr/ADR-0018-deploy-gate-secret-status-check.md) | Pre-deploy secret validation |
| [`c:/hc quality/.claude/rules/deploy-protocol.md`](../../.claude/rules/deploy-protocol.md) | Deploy order + PWA caching |
| [`c:/hc quality/.claude/rules/firestore-security.md`](../../.claude/rules/firestore-security.md) | Multi-tenant invariants + callable pattern |

### RDC 978 / DICQ / Compliance

| Regulation | Applies To | Link |
|---|---|---|
| RDC 978 Art. 6º §1 | NOTIVISA notifications | [`C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md`](C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_RDC_978_2025_Resumo.md) |
| RDC 978 Art. 17 | IA competency data | Same |
| DICQ 4.3 | Document control | [`C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md`](C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Compliance_DICQ.md) |
| DICQ 4.4 | Audit trail | Same |

### Escalation Path

**Level 1 — Self-resolve (docs + tests):**
- Read PHASE_3_HANDBOOK.md section 8 (Troubleshooting)
- Run `npm run test -- <module>.test.ts` to verify your code
- Check emulator logs: http://localhost:4000 → Logs tab

**Level 2 — Team help (Slack #phase-3):**
- Rules not matching expected behavior → ask for rules review
- Cloud Function timeout → ask for timeout increase (requires CTO ack)
- Multi-tenant isolation unclear → code review in PR

**Level 3 — CTO escalation (drogafarto@gmail.com):**
- Compliance question (RDC 978, DICQ)
- Security incident (rules bypass, data leak, HMAC collision)
- Architecture change needed (new collection, schema breaking change)

**Before escalating, provide:**
1. **What**: Clear description of the issue
2. **Where**: File paths + line numbers
3. **Expected**: What should happen
4. **Actual**: What is happening
5. **Attempted**: What you already tried
6. **Impact**: Does production fail or just this feature?

---

## Final Checklist: Ready for Phase 3?

After completing the onboarding path, you should be able to:

- [ ] Describe the 5 new Phase 3 collections in 1-2 sentences each
- [ ] Explain the multi-tenant isolation pattern (path + payload defense-in-depth)
- [ ] Read a Firestore rule and identify what roles/claims it requires
- [ ] Write a Cloud Function callable that validates input + writes atomically
- [ ] Deploy a hotfix to production (rules only) without breaking anything
- [ ] Troubleshoot a stuck draft lock using the force-clear procedure
- [ ] Run emulator + smoke tests locally and interpret results
- [ ] Name 3 compliance articles that Phase 3 addresses (RDC 978, DICQ)

If any of these feel unclear, re-read the relevant section or ask on Slack.

---

**Version History:**
- **2026-05-07**: Initial creation, Phase 3 complete
- Last updated: 2026-05-07

**Next update:** After Phase 4 module (patient portal) ships. Additional sections: "Portal module deep-dive", "Patient data privacy + PII handling".
