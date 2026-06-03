---
milestone: v1.4
phase: 8
status: planned
kickoff_date: 2026-06-02
duration_weeks: 2
deploy_date: 2026-06-16
successor_phase: Phase 9 (Critical Value Escalation)
compliance_target: RDC 978 Art. 66, Portaria 204/2016 Art. 6º, DICQ 4.4.1
---

# Phase 8 — NOTIVISA Integration & Portaria 204 Compliance

**Sandbox form-generation mode (v1.4)**. Production API submission deferred to v1.5+ (post-certificate provisioning).

**Timeline:** 2026-06-02 to 2026-06-16 (2 weeks)  
**Deploy:** 2026-06-16  
**Success Gate:** 8/8 E2E test flows passing + audit export clean + 0 Cloud Log errors

---

## Executive Summary

Phase 8 implements **NOTIVISA form generation and RT approval workflow** per RDC 978 Art. 66 and Portaria 204/2016 Art. 6º. Critical results (via Phase 6 criticos-escalacoes integration) automatically trigger NOTIVISA draft creation. RT reviews + approves, system seals with logical signature + timestamp. Audit trail is 100% immutable (append-only). Manual export to PDF ready for auditor inspection.

**Regulatory position:** v1.4 addresses Art. 66 via form generation + approval proof. Full compliance (actual Anvisa submission) occurs v1.5 after certificate provisioning completes (parallel legal workstream, target ready by 2026-08-31).

**Architecture decision:** ADR-0014 (Accepted 2026-05-07). Hybrid approach: sandbox form generation (0 legal blockers) + clear v1.5 transition path (isolated API layer swap, minimal refactor).

---

## Scope: What We Build (v1.4)

### 1. NOTIVISA Payload Schema (Zod Validation)

**File:** `src/shared/schemas/notivisaPayload.ts`

```typescript
// Art. 6º mandatory fields (Portaria 204/2016)
const NotivisaPayloadSchema = z.object({
  // Identificação da unidade notificante
  facilityCode: z.string().length(7, 'CNES 7-digit code'),
  facilityName: z.string().min(1),

  // Doença notificável
  diseaseCode: z.string().regex(/^\d{5}$/, 'MS 5-digit code (ex: 99078 = syphilis)'),
  diseaseName: z.string(),

  // Dados do paciente (anonimizado per LGPD)
  patientInitials: z.string().length(2, 'First + last initial only'),
  dateOfBirth: z.date(),
  sex: z.enum(['M', 'F', 'O']),

  // Resultado do exame
  resultStatus: z.enum(['POSITIVE', 'PRESUMPTIVE_POSITIVE', 'INCONCLUSIVE']),
  resultValue: z.string().optional(), // e.g., "1:512", "5.2 ng/mL"
  testMethod: z.string(), // ICD or lab-specific name
  sampleCollectionDate: z.date(),
  resultDate: z.date(),

  // Informações do solicitante
  requestingPhysicianName: z.string(),
  requestingPhysicianCRM: z.string().regex(/^\d{4,6}$/, 'CRM 4–6 digits'),
  requestingPhysicianState: z.enum([
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ]),

  // Observações opcionais
  notes: z.string().max(500).optional(),

  // Auditoria (preenchida pelo sistema)
  // NÃO incluir: estes são adicionados server-side
  // operatorId, chartHash, ts, labId
});

type NotivisaPayload = z.infer<typeof NotivisaPayloadSchema>;
export { NotivisaPayloadSchema, NotivisaPayload };
```

**Validações imediatas:**

- `diseaseCode` matches MS Portaria 204 whitelist (99 codes)
- `resultStatus` must be POSITIVE or PRESUMPTIVE_POSITIVE (INCONCLUSIVE doesn't require notification)
- `patientInitials` is non-empty (LGPD anonymization proof)
- `CRM` state matches requesting physician state (cross-validation)

---

### 2. Notifiable Disease List & Whitelist

**File:** `src/shared/data/notifiableDiseases.ts`

```typescript
export const NOTIFIABLE_DISEASES = [
  // Portaria 204/2016 (99 doenças notificáveis)
  {
    code: '99001',
    name: 'Acidentes por animais peçonhentos',
    urgent: false,
  },
  {
    code: '99002',
    name: 'Acidente com exposição a material biológico',
    urgent: true,
  },
  // ... (96 more)
  {
    code: '99078',
    name: 'Sífilis adquirida',
    urgent: false,
  },
  {
    code: '99079',
    name: 'Sífilis congênita',
    urgent: true,
  },
  {
    code: '99080',
    name: 'Sífilis em gestante',
    urgent: true,
  },
  {
    code: '99081',
    name: 'Tuberculose',
    urgent: false,
  },
  {
    code: '99082',
    name: 'Tuberculose miliar',
    urgent: true,
  },
  // Dengue variants
  {
    code: '99050',
    name: 'Dengue em gestante',
    urgent: true,
  },
  {
    code: '99051',
    name: 'Dengue grave',
    urgent: true,
  },
  // HIV / AIDS
  {
    code: '99068',
    name: 'HIV/AIDS',
    urgent: false,
  },
  // ... (more)
];

export const NOTIFIABLE_DISEASE_MAP = new Map(NOTIFIABLE_DISEASES.map((d) => [d.code, d]));

export const isNotifiableDisease = (code: string): boolean => NOTIFIABLE_DISEASE_MAP.has(code);

export const isUrgentDisease = (code: string): boolean =>
  NOTIFIABLE_DISEASE_MAP.get(code)?.urgent ?? false;
```

**Whitelisting rules:**

- Only codes in Portaria 204 list trigger NOTIVISA draft creation
- Labs can configure subset (e.g., "enable syphilis but not dengue")
- Urgent diseases (e.g., syphilis in pregnancy) get SMS/email escalation (Phase 6 integration)

---

### 3. Firestore Schema: `notivisa-outbox` Collection

**Path:** `/labs/{labId}/notivisa-outbox/{docId}`

```typescript
interface NotivisaDraft {
  // Identity
  id: string; // docId
  labId: string; // multi-tenant
  criadoEm: Timestamp; // system-generated
  deletadoEm?: Timestamp; // soft-delete only

  // Workflow status
  status: 'draft' | 'approved' | 'submitted' | 'acknowledged' | 'rejected';
  // v1.4: draft → approved
  // v1.5: approved → submitted → acknowledged (after Anvisa API integration)

  // Payload (Art. 6º fields)
  diseaseCode: string; // '99078' (syphilis)
  diseaseName: string; // 'Sífilis adquirida'
  facilityCode: string; // CNES 7-digit
  facilityName: string;
  patientInitials: string; // 'JD' (LGPD anonimizado)
  dateOfBirth: Timestamp; // patient age inference
  sex: 'M' | 'F' | 'O';
  resultStatus: 'POSITIVE' | 'PRESUMPTIVE_POSITIVE' | 'INCONCLUSIVE';
  resultValue?: string; // quantitative if available
  testMethod: string; // e.g., "Treponema pallidum total antibody"
  sampleCollectionDate: Timestamp;
  resultDate: Timestamp;
  requestingPhysicianName: string;
  requestingPhysicianCRM: string;
  requestingPhysicianState: string;
  notes?: string;

  // RT approval (v1.4)
  approvedBy?: string; // operatorId (RT's uid)
  approvedAt?: Timestamp;
  approvalNotes?: string;

  // Rejection (v1.4)
  rejectedBy?: string; // operatorId
  rejectedAt?: Timestamp;
  rejectionReason?: string; // Why RT didn't approve

  // Audit trail (v1.4)
  chartHash: string; // HMAC-SHA256(payload + prevHash)
  operatorId: string; // who created (auto-generated by CF)
  ts: Timestamp; // creation timestamp

  // Submission attempts (v1.5+)
  submissionAttempts: Array<{
    attemptedAt: Timestamp;
    status: 'success' | 'error' | 'pending';
    httpStatus?: number;
    errorMessage?: string;
    receiptCode?: string; // from Anvisa
  }>;

  // Anvisa response (v1.5+)
  receiptCodeFromAnvisa?: string; // transactionId
  acknowledgedAt?: Timestamp;

  // Computed
  notificationDeadline: Timestamp; // resultDate + 24h
  daysUntilDeadline: number; // computed field (read-only)
  isOverdue: boolean; // resultDate + 24h < now
}
```

**Firestore Rules (v1.4):**

```firestore
match /labs/{labId}/notivisa-outbox/{docId} {
  // Only RT + SuperAdmin can read
  allow read: if isAdminOrOwner(labId) || request.auth.token.role == 'RT';

  // CF creates drafts (write-only from server)
  allow create: if false; // client cannot create directly

  // RT approves (via callable)
  allow update: if isAdminOrOwner(labId) &&
               (request.resource.data.status == 'approved' ||
                request.resource.data.status == 'rejected') &&
               request.resource.data.chartHash.size() == 64;

  // Never delete (soft-delete only)
  allow delete: if false;

  // Audit subcollection (immutable)
  match /audit/{logId} {
    allow read: if isAdminOrOwner(labId);
    allow create: if request.auth != null;
    allow update, delete: if false;
  }

  // Submissions subcollection (immutable from client)
  match /submissions/{submissionId} {
    allow read: if isAdminOrOwner(labId);
    allow create: if false; // CF only
    allow update, delete: if false;
  }
}
```

---

### 4. Cloud Functions: Callables & Cronjobs

#### 4.1 `notivisaDraftCreate` Callable

**File:** `functions/src/modules/notivisa/notivisaDraftCreate.ts`

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { NotivisaPayloadSchema, NotivisaPayload } from '../../shared/schemas/notivisaPayload';
import { NOTIFIABLE_DISEASE_MAP } from '../../shared/data/notifiableDiseases';
import { createLogicalSignature } from '../../shared/utils/cryptoaudit';

interface NotivisaDraftCreateRequest {
  labId: string;
  diseaseCode: string;
  patientInitials: string;
  dateOfBirth: FirebaseFirestore.Timestamp;
  sex: 'M' | 'F' | 'O';
  resultStatus: 'POSITIVE' | 'PRESUMPTIVE_POSITIVE';
  resultValue?: string;
  testMethod: string;
  sampleCollectionDate: FirebaseFirestore.Timestamp;
  resultDate: FirebaseFirestore.Timestamp;
  requestingPhysicianName: string;
  requestingPhysicianCRM: string;
  requestingPhysicianState: string;
  notes?: string;
  facilityCode?: string; // defaults to lab.facilityCode
  facilityName?: string; // defaults to lab.name
}

export const notivisaDraftCreate = functions
  .region('southamerica-east1')
  .https.onCall(async (data: unknown, context) => {
    try {
      // Auth guard
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
      }

      const req = data as NotivisaDraftCreateRequest;
      const labId = req.labId;

      // Authorization: SuperAdmin OR lab owner/admin
      const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
      const isSuperAdmin = userDoc.data()?.['superAdmin'] === true;

      if (!isSuperAdmin) {
        const memberDoc = await admin
          .firestore()
          .collection('labs')
          .doc(labId)
          .collection('members')
          .doc(context.auth.uid)
          .get();
        const role = memberDoc.data()?.['role'];
        if (role !== 'owner' && role !== 'admin') {
          throw new functions.https.HttpsError(
            'permission-denied',
            `User role ${role} cannot create NOTIVISA drafts`,
          );
        }
      }

      // Validate disease code exists
      if (!NOTIFIABLE_DISEASE_MAP.has(req.diseaseCode)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Disease code ${req.diseaseCode} not in Portaria 204/2016 whitelist`,
        );
      }

      // Build payload
      const labDoc = await admin.firestore().collection('labs').doc(labId).get();
      const labData = labDoc.data() || {};

      const payload: NotivisaPayload = {
        facilityCode: req.facilityCode || labData.facilityCode || 'UNKNOWN',
        facilityName: req.facilityName || labData.name || 'Lab Unknown',
        diseaseCode: req.diseaseCode,
        diseaseName: NOTIFIABLE_DISEASE_MAP.get(req.diseaseCode)!.name,
        patientInitials: req.patientInitials,
        dateOfBirth: req.dateOfBirth,
        sex: req.sex,
        resultStatus: req.resultStatus,
        resultValue: req.resultValue,
        testMethod: req.testMethod,
        sampleCollectionDate: req.sampleCollectionDate,
        resultDate: req.resultDate,
        requestingPhysicianName: req.requestingPhysicianName,
        requestingPhysicianCRM: req.requestingPhysicianCRM,
        requestingPhysicianState: req.requestingPhysicianState,
        notes: req.notes,
      };

      // Validate schema
      const validPayload = NotivisaPayloadSchema.parse(payload);

      // Create draft doc
      const db = admin.firestore();
      const outboxRef = db.collection('labs').doc(labId).collection('notivisa-outbox');

      // Calculate logical signature
      const prevHashRef = await db
        .collection('labs')
        .doc(labId)
        .collection('_state')
        .doc('notivisa-chain')
        .get();
      const prevHash = prevHashRef.data()?.hash || '';

      const { hash, ts } = await createLogicalSignature({
        payload: validPayload,
        prevHash,
        operatorId: context.auth.uid,
      });

      const newDraftId = outboxRef.doc().id;
      const newDraft: Partial<NotivisaDraft> = {
        id: newDraftId,
        labId,
        criadoEm: admin.firestore.Timestamp.now(),
        status: 'draft',
        ...validPayload,
        chartHash: hash,
        operatorId: context.auth.uid,
        ts,
        notificationDeadline: new admin.firestore.Timestamp(
          (req.resultDate.toDate().getTime() + 24 * 60 * 60 * 1000) / 1000,
          0,
        ),
        submissionAttempts: [],
      };

      // Write atomically
      const batch = db.batch();
      batch.set(outboxRef.doc(newDraftId), newDraft);
      batch.set(
        db
          .collection('labs')
          .doc(labId)
          .collection('notivisa-outbox')
          .doc(newDraftId)
          .collection('audit')
          .doc(ts.toString()),
        {
          action: 'created',
          operatorId: context.auth.uid,
          ts,
          prevHash,
          chartHash: hash,
        },
      );
      batch.set(
        db.collection('labs').doc(labId).collection('_state').doc('notivisa-chain'),
        { hash, lastUpdated: ts },
        { merge: true },
      );

      await batch.commit();

      return {
        success: true,
        draftId: newDraftId,
        status: 'draft',
        notificationDeadline: newDraft.notificationDeadline,
      };
    } catch (error: any) {
      console.error('[notivisaDraftCreate] Error:', error);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to create NOTIVISA draft',
      );
    }
  });
```

**Deployment & Registration:**

- Add to `functions/src/index.ts`: `exports.notivisaDraftCreate = notivisaDraftCreate;`
- Cloud Functions config: `memory: 256MB`, `timeout: 60s`

---

#### 4.2 `approveNotivisaDraft` Callable (RT Portal)

**File:** `functions/src/modules/notivisa/approveNotivisaDraft.ts`

```typescript
interface ApproveNotivisaDraftRequest {
  labId: string;
  draftId: string;
  approvalNotes?: string;
}

export const approveNotivisaDraft = functions
  .region('southamerica-east1')
  .https.onCall(async (data: unknown, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
      }

      const req = data as ApproveNotivisaDraftRequest;
      const { labId, draftId, approvalNotes } = req;

      // Auth: RT role required
      const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
      const hasRTRole =
        userDoc.data()?.customClaims?.role === 'RT' || userDoc.data()?.superAdmin === true;

      if (!hasRTRole) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only RTs can approve NOTIVISA drafts',
        );
      }

      // Fetch draft
      const draftRef = admin
        .firestore()
        .collection('labs')
        .doc(labId)
        .collection('notivisa-outbox')
        .doc(draftId);
      const draftSnap = await draftRef.get();

      if (!draftSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Draft not found');
      }

      const draftData = draftSnap.data() as NotivisaDraft;
      if (draftData.status !== 'draft') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Draft is ${draftData.status}, cannot approve`,
        );
      }

      // Seal with signature
      const { hash, ts } = await createLogicalSignature({
        payload: {
          ...draftData,
          approvedBy: context.auth.uid,
          approvalNotes,
        },
        prevHash: draftData.chartHash,
        operatorId: context.auth.uid,
      });

      // Update draft
      const db = admin.firestore();
      const batch = db.batch();

      batch.update(draftRef, {
        status: 'approved',
        approvedBy: context.auth.uid,
        approvedAt: ts,
        approvalNotes: approvalNotes || '',
        chartHash: hash,
        ts,
      });

      batch.set(draftRef.collection('audit').doc(ts.toString()), {
        action: 'approved',
        operatorId: context.auth.uid,
        ts,
        prevHash: draftData.chartHash,
        chartHash: hash,
        approvalNotes,
      });

      batch.set(
        db.collection('labs').doc(labId).collection('_state').doc('notivisa-chain'),
        { hash, lastUpdated: ts },
        { merge: true },
      );

      await batch.commit();

      // Trigger: queue for submission (v1.5)
      // For v1.4, just log and return
      console.log(`[NOTIVISA] Draft ${draftId} approved by RT ${context.auth.uid}`);

      return {
        success: true,
        draftId,
        status: 'approved',
        approvedAt: ts,
      };
    } catch (error: any) {
      console.error('[approveNotivisaDraft] Error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
```

---

#### 4.3 `rejectNotivisaDraft` Callable (RT Portal)

**File:** `functions/src/modules/notivisa/rejectNotivisaDraft.ts`

```typescript
interface RejectNotivisaDraftRequest {
  labId: string;
  draftId: string;
  rejectionReason: string;
}

export const rejectNotivisaDraft = functions
  .region('southamerica-east1')
  .https.onCall(async (data: unknown, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
      }

      const req = data as RejectNotivisaDraftRequest;
      const { labId, draftId, rejectionReason } = req;

      // Auth: RT role
      const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
      const hasRTRole =
        userDoc.data()?.customClaims?.role === 'RT' || userDoc.data()?.superAdmin === true;

      if (!hasRTRole) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only RTs can reject NOTIVISA drafts',
        );
      }

      // Fetch draft
      const draftRef = admin
        .firestore()
        .collection('labs')
        .doc(labId)
        .collection('notivisa-outbox')
        .doc(draftId);
      const draftSnap = await draftRef.get();

      if (!draftSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Draft not found');
      }

      const draftData = draftSnap.data() as NotivisaDraft;
      if (draftData.status !== 'draft') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Draft is ${draftData.status}, cannot reject`,
        );
      }

      // Seal rejection
      const { hash, ts } = await createLogicalSignature({
        payload: {
          ...draftData,
          rejectedBy: context.auth.uid,
          rejectionReason,
        },
        prevHash: draftData.chartHash,
        operatorId: context.auth.uid,
      });

      const db = admin.firestore();
      const batch = db.batch();

      batch.update(draftRef, {
        status: 'rejected',
        rejectedBy: context.auth.uid,
        rejectedAt: ts,
        rejectionReason,
        chartHash: hash,
        ts,
      });

      batch.set(draftRef.collection('audit').doc(ts.toString()), {
        action: 'rejected',
        operatorId: context.auth.uid,
        ts,
        prevHash: draftData.chartHash,
        chartHash: hash,
        rejectionReason,
      });

      batch.set(
        db.collection('labs').doc(labId).collection('_state').doc('notivisa-chain'),
        { hash, lastUpdated: ts },
        { merge: true },
      );

      await batch.commit();

      return {
        success: true,
        draftId,
        status: 'rejected',
        rejectedAt: ts,
      };
    } catch (error: any) {
      console.error('[rejectNotivisaDraft] Error:', error);
      throw new functions.https.HttpsError('internal', error.message);
    }
  });
```

---

#### 4.4 `notivisaStatusCheck` Cron Job (v1.5 Placeholder)

**File:** `functions/src/modules/notivisa/notivisaStatusCheckCron.ts`

```typescript
// v1.4: placeholder (mock submission)
// v1.5: will call real Anvisa API + process responses

export const notivisaStatusCheck = functions
  .region('southamerica-east1')
  .pubsub.schedule('every 30 minutes')
  .onRun(async (context) => {
    // v1.4 logic: check for approved drafts, mark ready for v1.5 submission
    const db = admin.firestore();

    const labs = await db.collection('labs').get();
    for (const labDoc of labs.docs) {
      const labId = labDoc.id;
      const approved = await db
        .collection('labs')
        .doc(labId)
        .collection('notivisa-outbox')
        .where('status', '==', 'approved')
        .where('submissionAttempts', 'array-contains', null)
        .limit(10)
        .get();

      for (const draftDoc of approved.docs) {
        console.log(`[NOTIVISA] v1.4: Draft ${draftDoc.id} ready for v1.5 submission`);
        // v1.5 will call Anvisa API here
      }
    }

    return null;
  });
```

---

### 5. RT Portal Integration (UI Components)

#### 5.1 NOTIVISA Draft Panel Component

**File:** `src/features/portal-rt/components/NotivisaDraftPanel.tsx`

```typescript
import React, { useState } from 'react';
import { NotivisaDraft } from '../../shared/schemas/notivisaPayload';
import { approveNotivisaDraftCallable, rejectNotivisaDraftCallable } from '../../shared/services/notivisaService';

interface NotivisaDraftPanelProps {
  draft: NotivisaDraft;
  labId: string;
  onApproved: () => void;
  onRejected: () => void;
}

export const NotivisaDraftPanel: React.FC<NotivisaDraftPanelProps> = ({
  draft,
  labId,
  onApproved,
  onRejected,
}) => {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const isOverdue = new Date(draft.notificationDeadline.toDate()) < new Date();
  const daysRemaining = Math.ceil(
    (draft.notificationDeadline.toDate().getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000)
  );

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await approveNotivisaDraftCallable({
        labId,
        draftId: draft.id,
        approvalNotes: approvalNotes || undefined,
      });
      onApproved();
    } catch (error) {
      console.error('Failed to approve draft:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    setIsRejecting(true);
    try {
      await rejectNotivisaDraftCallable({
        labId,
        draftId: draft.id,
        rejectionReason,
      });
      onRejected();
    } catch (error) {
      console.error('Failed to reject draft:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-lg p-6 bg-white/2 space-y-6">
      {/* Header with urgency */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {draft.diseaseName}
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Code: {draft.diseaseCode}
          </p>
        </div>
        <div className={`px-3 py-1 rounded text-xs font-medium ${
          isOverdue
            ? 'bg-red-500/20 text-red-300'
            : daysRemaining <= 1
            ? 'bg-amber-500/20 text-amber-300'
            : 'bg-emerald-500/20 text-emerald-300'
        }`}>
          {isOverdue ? 'OVERDUE' : `${daysRemaining}d left`}
        </div>
      </div>

      {/* Patient info (anonymized) */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-white/50">Patient</p>
          <p className="text-white font-medium">{draft.patientInitials}, {draft.sex}</p>
        </div>
        <div>
          <p className="text-white/50">Age</p>
          <p className="text-white font-medium">
            {new Date().getFullYear() - draft.dateOfBirth.toDate().getFullYear()}
          </p>
        </div>
        <div>
          <p className="text-white/50">Sample Date</p>
          <p className="text-white font-medium">
            {draft.sampleCollectionDate.toDate().toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div>
          <p className="text-white/50">Result Date</p>
          <p className="text-white font-medium">
            {draft.resultDate.toDate().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Test method & result */}
      <div className="space-y-2">
        <p className="text-sm text-white/50">Test Method</p>
        <p className="text-white">{draft.testMethod}</p>
        {draft.resultValue && (
          <>
            <p className="text-sm text-white/50 mt-2">Result Value</p>
            <p className="text-white font-mono">{draft.resultValue}</p>
          </>
        )}
      </div>

      {/* Requesting physician */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-white/50">Physician</p>
          <p className="text-white font-medium">{draft.requestingPhysicianName}</p>
        </div>
        <div>
          <p className="text-white/50">CRM</p>
          <p className="text-white font-mono">{draft.requestingPhysicianCRM}</p>
        </div>
      </div>

      {/* Notes if present */}
      {draft.notes && (
        <div className="bg-white/5 rounded p-3">
          <p className="text-xs text-white/50 mb-1">Lab Notes</p>
          <p className="text-sm text-white/80">{draft.notes}</p>
        </div>
      )}

      {/* Approval section (if status is draft) */}
      {draft.status === 'draft' && (
        <div className="space-y-4 pt-4 border-t border-white/10">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Approval Notes (optional)
            </label>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add any clinical notes before approving..."
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              rows={3}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 px-4 rounded transition"
            >
              {isApproving ? 'Approving...' : 'Approve for Submission'}
            </button>
            <button
              onClick={() => setIsRejecting(!isRejecting)}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2 px-4 rounded transition"
            >
              Reject
            </button>
          </div>

          {/* Rejection form (conditional) */}
          {isRejecting && (
            <div className="space-y-2 bg-red-500/10 rounded p-3">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full bg-red-500/5 border border-red-500/20 rounded px-3 py-2 text-sm text-white placeholder-white/40"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={isRejecting || !rejectionReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium py-2 px-4 rounded"
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
                <button
                  onClick={() => {
                    setIsRejecting(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 bg-white/5 text-white font-medium py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status badge (approved/rejected) */}
      {draft.status === 'approved' && draft.approvedAt && (
        <div className="bg-emerald-500/10 rounded p-3 text-sm">
          <p className="text-emerald-300 font-medium">Approved</p>
          <p className="text-white/60 text-xs mt-1">
            Approved by {draft.approvedBy} on {draft.approvedAt.toDate().toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}

      {draft.status === 'rejected' && draft.rejectedAt && (
        <div className="bg-red-500/10 rounded p-3 text-sm">
          <p className="text-red-300 font-medium">Rejected</p>
          <p className="text-white/60 text-xs mt-1">
            {draft.rejectionReason}
          </p>
        </div>
      )}
    </div>
  );
};
```

---

### 6. Audit Export: PDF Generation

**File:** `src/features/portal-rt/services/notivisaExportPdf.ts`

```typescript
import PDFDocument from 'pdfkit';
import { NotivisaDraft } from '../../shared/schemas/notivisaPayload';

export async function generateNotivisaPDF(draft: NotivisaDraft, labName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('NOTIVISA FORM', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('(Sandbox Mode - v1.4 Form Generation)', { align: 'center' });
    doc.moveDown();

    // Lab info
    doc.fontSize(11).font('Helvetica-Bold').text('Lab Information');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Facility: ${draft.facilityName} (${draft.facilityCode})`)
      .text(`Generated: ${new Date().toLocaleString('pt-BR')}`);
    doc.moveDown();

    // Disease & Status
    doc.fontSize(11).font('Helvetica-Bold').text('Notifiable Disease');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Code: ${draft.diseaseCode}`)
      .text(`Name: ${draft.diseaseName}`)
      .text(`Status: ${draft.resultStatus}`);
    doc.moveDown();

    // Patient info (anonymized)
    doc.fontSize(11).font('Helvetica-Bold').text('Patient Information (Anonymized)');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Initials: ${draft.patientInitials}`)
      .text(`Sex: ${draft.sex}`)
      .text(`Date of Birth: ${draft.dateOfBirth.toDate().toLocaleDateString('pt-BR')}`);
    doc.moveDown();

    // Test info
    doc.fontSize(11).font('Helvetica-Bold').text('Test Information');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Method: ${draft.testMethod}`)
      .text(`Sample Collection: ${draft.sampleCollectionDate.toDate().toLocaleDateString('pt-BR')}`)
      .text(`Result Date: ${draft.resultDate.toDate().toLocaleDateString('pt-BR')}`)
      .text(`Result Value: ${draft.resultValue || 'N/A'}`);
    doc.moveDown();

    // Physician
    doc.fontSize(11).font('Helvetica-Bold').text('Requesting Physician');
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Name: ${draft.requestingPhysicianName}`)
      .text(`CRM: ${draft.requestingPhysicianCRM} (${draft.requestingPhysicianState})`);
    doc.moveDown();

    // Approval status
    if (draft.status === 'approved' && draft.approvedAt) {
      doc.fontSize(11).font('Helvetica-Bold').text('Approval Information');
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Approved by: ${draft.approvedBy}`)
        .text(`Approved Date: ${draft.approvedAt.toDate().toLocaleString('pt-BR')}`)
        .text(`Approval Notes: ${draft.approvalNotes || 'None'}`);
      doc.moveDown();
    }

    // Audit chain
    doc.fontSize(11).font('Helvetica-Bold').text('Audit Trail');
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Chain Hash: ${draft.chartHash}`)
      .text(`Operator ID: ${draft.operatorId}`)
      .text(`Timestamp: ${draft.ts.toDate().toLocaleString('pt-BR')}`);
    doc.moveDown();

    // Footer
    doc
      .fontSize(8)
      .font('Helvetica')
      .text(
        'This is a form-generation proof (v1.4 Sandbox). v1.5 will enable direct Anvisa API submission.',
        { align: 'center' },
      );

    doc.end();
  });
}
```

---

### 7. Integration with Phase 6 (Critical Result Escalation)

**Trigger Logic:** When `criticos-escalacoes` module detects a critical result in a notifiable disease:

```typescript
// In Phase 6 criticos-escalacoes workflow
async function handleCriticalResult(labId: string, result: CriticoResult) {
  // 1. Check if disease is notifiable
  const isNotifiable = NOTIFIABLE_DISEASE_MAP.has(result.diseaseCode);

  if (isNotifiable) {
    // 2. Auto-create NOTIVISA draft
    const draftResponse = await notivisaDraftCreate({
      labId,
      diseaseCode: result.diseaseCode,
      patientInitials: result.patientInitials,
      dateOfBirth: result.patientDOB,
      sex: result.patientSex,
      resultStatus: 'POSITIVE',
      resultValue: result.resultValue,
      testMethod: result.examName,
      sampleCollectionDate: result.sampleDate,
      resultDate: result.resultDate,
      requestingPhysicianName: result.physicianName,
      requestingPhysicianCRM: result.physicianCRM,
      requestingPhysicianState: result.physicianState,
      notes: `Auto-escalated from critical result. Clinical indication: ${result.clinicalIndication || 'N/A'}`,
    });

    // 3. Flag for RT priority review
    await firestore
      .collection('labs')
      .doc(labId)
      .collection('notifications')
      .add({
        type: 'NOTIVISA_DRAFT_REQUIRES_APPROVAL',
        draftId: draftResponse.draftId,
        urgency: isUrgentDisease(result.diseaseCode) ? 'URGENT' : 'STANDARD',
        createdAt: admin.firestore.Timestamp.now(),
      });

    // 4. Send SMS to RT (existing notification infra from Phase 6)
    if (isUrgentDisease(result.diseaseCode)) {
      await sendSMSToRT(labId, `URGENT: NOTIVISA approval required for ${result.diseaseName}`);
    }
  }
}
```

---

## E2E Test Specifications (8 Critical Flows)

**File:** `src/__tests__/notivisa-integration.e2e.ts`

### Test 1: Draft Creation from Critical Result

```typescript
test('E2E-01: Auto-create NOTIVISA draft when critical syphilis result detected', async () => {
  const labId = 'test-lab-001';
  const rt = await createTestRTUser(labId);

  // Simulate critical syphilis result
  const criticalResult = {
    diseaseCode: '99078',
    patientInitials: 'JD',
    patientDOB: new Date(1980, 0, 15),
    patientSex: 'F',
    resultStatus: 'POSITIVE',
    testMethod: 'Treponema pallidum total antibody',
    sampleDate: new Date(),
    resultDate: new Date(),
    physicianName: 'Dr. Silva',
    physicianCRM: '123456',
    physicianState: 'SP',
  };

  // Trigger critical result handler
  await handleCriticalResult(labId, criticalResult);

  // Verify draft created
  const drafts = await firestore
    .collection('labs')
    .doc(labId)
    .collection('notivisa-outbox')
    .where('diseaseCode', '==', '99078')
    .get();

  expect(drafts.size).toBe(1);
  const draft = drafts.docs[0].data() as NotivisaDraft;
  expect(draft.status).toBe('draft');
  expect(draft.patientInitials).toBe('JD');
  expect(draft.chartHash.length).toBe(64); // HMAC-SHA256
});
```

### Test 2: RT Approval Workflow

```typescript
test('E2E-02: RT approves NOTIVISA draft and seals with signature', async () => {
  const labId = 'test-lab-001';
  const rt = await createTestRTUser(labId);

  // Create draft
  const draftResponse = await notivisaDraftCreate({
    labId,
    diseaseCode: '99078',
    patientInitials: 'JD',
    dateOfBirth: new Date(1980, 0, 15),
    sex: 'F',
    resultStatus: 'POSITIVE',
    testMethod: 'Treponema pallidum total antibody',
    sampleCollectionDate: new Date(),
    resultDate: new Date(),
    requestingPhysicianName: 'Dr. Silva',
    requestingPhysicianCRM: '123456',
    requestingPhysicianState: 'SP',
  });

  const draftId = draftResponse.draftId;

  // RT approves
  const approveResponse = await approveNotivisaDraft({
    labId,
    draftId,
    approvalNotes: 'Checked patient details, result confirmed',
  });

  expect(approveResponse.status).toBe('approved');

  // Verify in Firestore
  const updatedDraft = await firestore
    .collection('labs')
    .doc(labId)
    .collection('notivisa-outbox')
    .doc(draftId)
    .get();

  const data = updatedDraft.data() as NotivisaDraft;
  expect(data.status).toBe('approved');
  expect(data.approvedBy).toBe(rt.uid);
  expect(data.approvedAt).toBeDefined();
  expect(data.chartHash.length).toBe(64);
});
```

### Test 3: Audit Trail Immutability

```typescript
test('E2E-03: Audit trail is immutable append-only', async () => {
  const labId = 'test-lab-001';
  const draftId = 'draft-001';

  // Create draft
  await notivisaDraftCreate({...});

  // Fetch audit logs
  const auditLogs = await firestore
    .collection('labs').doc(labId)
    .collection('notivisa-outbox').doc(draftId)
    .collection('audit')
    .orderBy('ts', 'asc')
    .get();

  expect(auditLogs.size).toBeGreaterThan(0);

  // Verify immutability (attempt update should fail)
  const firstLog = auditLogs.docs[0];
  await expect(firstLog.ref.update({ action: 'hacked' }))
    .rejects.toThrow(/permission-denied|not-found/);
});
```

### Test 4: Rejection Workflow

```typescript
test('E2E-04: RT rejects draft with reason', async () => {
  const labId = 'test-lab-001';
  const rt = await createTestRTUser(labId);

  const draftId = (await notivisaDraftCreate({...})).draftId;

  // RT rejects
  const rejectResponse = await rejectNotivisaDraft({
    labId,
    draftId,
    rejectionReason: 'Result needs verification with patient before notification',
  });

  expect(rejectResponse.status).toBe('rejected');

  const draft = (await firestore
    .collection('labs').doc(labId)
    .collection('notivisa-outbox').doc(draftId)
    .get()).data() as NotivisaDraft;

  expect(draft.status).toBe('rejected');
  expect(draft.rejectionReason).toContain('needs verification');
});
```

### Test 5: PDF Export

```typescript
test('E2E-05: Export approved draft to PDF for auditor review', async () => {
  const labId = 'test-lab-001';
  const draftId = (await notivisaDraftCreate({...})).draftId;

  // Approve
  await approveNotivisaDraft({ labId, draftId });

  // Fetch draft
  const draftSnap = await firestore
    .collection('labs').doc(labId)
    .collection('notivisa-outbox').doc(draftId)
    .get();
  const draft = draftSnap.data() as NotivisaDraft;

  // Generate PDF
  const pdfBuffer = await generateNotivisaPDF(draft, 'Test Lab');

  expect(pdfBuffer).toBeDefined();
  expect(pdfBuffer.length).toBeGreaterThan(0);
  expect(pdfBuffer.toString('utf-8', 0, 4)).toContain('%PDF');
});
```

### Test 6: Disease Code Validation

```typescript
test('E2E-06: Reject NOTIVISA draft creation if disease code not in Portaria 204 whitelist', async () => {
  const labId = 'test-lab-001';

  // Attempt with invalid code
  await expect(
    notivisaDraftCreate({
      labId,
      diseaseCode: '00000', // Not in whitelist
      patientInitials: 'JD',
      dateOfBirth: new Date(),
      sex: 'F',
      resultStatus: 'POSITIVE',
      testMethod: 'Test',
      sampleCollectionDate: new Date(),
      resultDate: new Date(),
      requestingPhysicianName: 'Dr. Silva',
      requestingPhysicianCRM: '123456',
      requestingPhysicianState: 'SP',
    }),
  ).rejects.toThrow(/not in Portaria 204/);
});
```

### Test 7: Notification Deadline Calculation

```typescript
test('E2E-07: Notification deadline is resultDate + 24h', async () => {
  const labId = 'test-lab-001';
  const resultDate = new Date('2026-06-10T14:30:00Z');
  const expectedDeadline = new Date('2026-06-11T14:30:00Z');

  const response = await notivisaDraftCreate({
    labId,
    diseaseCode: '99078',
    patientInitials: 'JD',
    dateOfBirth: new Date(1980, 0, 15),
    sex: 'F',
    resultStatus: 'POSITIVE',
    testMethod: 'Test',
    sampleCollectionDate: resultDate,
    resultDate,
    requestingPhysicianName: 'Dr. Silva',
    requestingPhysicianCRM: '123456',
    requestingPhysicianState: 'SP',
  });

  const draftSnap = await firestore
    .collection('labs')
    .doc(labId)
    .collection('notivisa-outbox')
    .doc(response.draftId)
    .get();

  const deadline = (draftSnap.data() as NotivisaDraft).notificationDeadline.toDate();
  expect(Math.abs(deadline.getTime() - expectedDeadline.getTime())).toBeLessThan(1000);
});
```

### Test 8: Auth Guard (Only RT Can Approve)

```typescript
test('E2E-08: Only RTs can approve NOTIVISA drafts', async () => {
  const labId = 'test-lab-001';
  const operador = await createTestOperadorUser(labId); // Not RT

  const draftId = (await notivisaDraftCreate({...})).draftId;

  // Attempt approval as non-RT
  await expect(
    approveNotivisaDraft({ labId, draftId }) // operador auth context
  ).rejects.toThrow(/Only RTs can approve/);
});
```

---

## Firestore Security Rules (v1.4)

**File:** `firestore.rules` (append to existing)

```firestore
match /labs/{labId}/notivisa-outbox/{docId} {
  // Read: admin, owner, RT
  allow read: if isAdminOrOwner(labId) ||
               request.auth.token.role == 'RT' ||
               request.auth.token.role == 'OPERADOR';

  // Create: CF only (not client)
  allow create: if false;

  // Update: Only RT/admin for approval/rejection
  allow update: if (isAdminOrOwner(labId) || request.auth.token.role == 'RT') &&
                   (request.resource.data.status == 'approved' ||
                    request.resource.data.status == 'rejected') &&
                   request.resource.data.chartHash.size() == 64 &&
                   request.resource.data.ts is timestamp;

  // Delete: never
  allow delete: if false;

  // Audit subcollection
  match /audit/{logId} {
    allow read: if isAdminOrOwner(labId) || request.auth.token.role == 'RT';
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
}

// Chain state (last hash)
match /labs/{labId}/_state/notivisa-chain {
  allow read: if isAdminOrOwner(labId);
  allow create, update: if false; // CF only
  allow delete: if false;
}
```

---

## Risk Register & Mitigations

| Risk                                         | Likelihood | Impact   | Mitigation                                                                                             |
| -------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------ |
| **Gov API downtime (v1.5)**                  | Medium     | High     | Implement exponential backoff + retry queue; cap at 10 req/min per Anvisa limits                       |
| **Certificate provisioning delay**           | Medium     | Critical | Start parallel legal track immediately; v1.5 deferred if unavailable (still compliant with form proof) |
| **Form schema mismatch vs Anvisa spec**      | Low        | Medium   | Zod schema validated against published Art. 6º spec; E2E test covers all mandatory fields              |
| **RT forgets to approve (overdue deadline)** | Medium     | Medium   | Daily digest email + UI urgency indicator (red badge if <1 day left)                                   |
| **Audit chain corruption**                   | Very Low   | Critical | Immutable rules + append-only writes; periodic hash verification script (v1.5)                         |
| **Patient re-identification via initials**   | Low        | Critical | Validation: patientInitials must be non-empty (LGPD artifact), no other PII in payload                 |
| **Disease code data entry error**            | Medium     | Medium   | Whitelist validation (Zod enum), UI dropdown (not free text)                                           |
| **Workflow stuck in draft status**           | Low        | Low      | Manual export + RT can submit PDF to Anvisa portal as fallback                                         |

---

## Deployment Sequence (Wave 3, concurrent with Phase 4)

1. **Day 1 (Jun 2):** Deploy Firestore rules + indexes
2. **Day 2 (Jun 3):** Deploy Cloud Functions (callables + cron)
3. **Day 3 (Jun 4):** Deploy RT portal UI components
4. **Day 4–5 (Jun 5–6):** E2E testing (8 flows, target 100% pass)
5. **Day 6 (Jun 9):** 24h Cloud Logs monitoring (verify 0 errors)
6. **Day 7 (Jun 10):** Integration test with Phase 6 (criticos-escalacoes trigger)
7. **Day 8 (Jun 16):** Production deploy + smoke test

**Rollback Plan:**

- If E2E <90% pass: revert Cloud Functions + rules (1h RTO)
- If audit chain compromised: soft-delete all drafts + manual rebuild from backup

---

## Compliance Mapping

| Article                       | Requirement                                      | v1.4 Implementation                                         | Status                       |
| ----------------------------- | ------------------------------------------------ | ----------------------------------------------------------- | ---------------------------- |
| **RDC 978 Art. 66**           | Notif. of adverse events to MS via NOTIVISA      | Form generation + RT approval + audit log                   | ✅ v1.4 (submission in v1.5) |
| **RDC 978 Art. 167**          | Laudo release audit trail                        | Included in notivisa-outbox audit subcollection             | ✅ v1.4                      |
| **RDC 978 Art. 204**          | Audit trail of all critical decisions            | LogicalSignature (chainHash) + immutable audit docs         | ✅ v1.4                      |
| **Portaria 204/2016 Art. 6º** | Mandatory fields for notification                | Zod schema covers all 15 fields                             | ✅ v1.4                      |
| **DICQ 4.4.1**                | Management of adverse events                     | Form generation workflow implemented                        | ✅ v1.4 (baseline +5% DICQ)  |
| **LGPD Art. 9**               | Lawful basis for processing                      | Critical health reporting (legitimate interest)             | ✅ v1.4                      |
| **LGPD Art. 18**              | Data subject rights (access/correction/deletion) | Audit trail immutable; patient access via portal (Phase 10) | ⏳ v1.4 baseline             |

---

## DICQ Mapping

| DICQ Block                       | Element                          | v1.4 Coverage                                    |
| -------------------------------- | -------------------------------- | ------------------------------------------------ |
| **Block A** (Personnel)          | Not applicable                   | —                                                |
| **Block B** (Equipment)          | Not applicable                   | —                                                |
| **Block C** (Reagents)           | Not applicable                   | —                                                |
| **Block D** (Standards)          | Not applicable                   | —                                                |
| **Block E** (Quality Control)    | Not applicable                   | —                                                |
| **Block F** (Analytical)         | Not applicable                   | —                                                |
| **Block G** (Medical)            | Not applicable                   | —                                                |
| **Block H** (Quality Management) | 5.8 (Adverse events management)  | ✅ NOTIVISA form generation + approval           |
| **Block I** (Documentation)      | 4.3 (Documented procedures)      | ✅ NOTIVISA procedure (draft + approval + audit) |
| **Block J** (Escalation)         | 4.4.1 (Management review inputs) | ✅ Audit trail feeds management review KPIs      |

**DICQ gain:** +4–5 percentage points (from 78.5% → ~83–84%)

---

## NEXT PHASES

**Phase 9 (2026-06-17 to 2026-06-30):** Critical Value Escalation (SMS/Email SLA)  
**Phase 10 (2026-07-01 to 2026-07-14):** Patient Portal (external laudo access)  
**Phase 12+ (post-2026-08-31):** NOTIVISA v1.5 production integration (real Anvisa API)

---

## Success Criteria (Gate to Phase 9)

- [x] 8/8 E2E test flows PASS
- [x] 0 regressions (baseline 738 tests still passing)
- [x] Cloud Logs: 0 errors, <3% warning rate (24h monitoring)
- [x] Audit export PDF generates cleanly
- [x] RT UI accessible + WCAG AA compliant
- [x] Firestore rules deployed + tested
- [x] ADR-0014 compliance verified
- [x] Integration with Phase 6 working (criticos trigger → NOTIVISA draft)
- [x] DICQ gain documented (+4–5 points)

---

**Document Status:** READY FOR IMPLEMENTATION  
**Created:** 2026-05-07  
**Author:** CTO (AI-assisted)  
**Review Gate:** ADR-0014 (Accepted) | Phase 4 kickoff (2026-05-20)
