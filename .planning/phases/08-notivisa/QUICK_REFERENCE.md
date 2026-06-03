---
phase: 8
type: quick-reference
audience: engineers
format: copy-paste ready
---

# Phase 8 NOTIVISA Integration — Quick Reference

Use this doc during implementation. All code snippets are copy-paste ready.

---

## File Structure

```
src/
├── shared/
│   ├── schemas/
│   │   └── notivisaPayload.ts          ← Zod schema (Art. 6º fields)
│   ├── data/
│   │   └── notifiableDiseases.ts       ← 99-disease whitelist
│   ├── types/
│   │   └── notivisaDraft.ts            ← Interface + discriminated union
│   ├── services/
│   │   └── notivisaService.ts          ← Callable wrappers + error handling
│   └── utils/
│       └── notivisaAudit.ts            ← ChainHash helpers
├── features/
│   └── portal-rt/
│       ├── components/
│       │   └── NotivisaDraftPanel.tsx  ← RT UI for approve/reject
│       ├── hooks/
│       │   ├── useNotivisaDrafts.ts    ← Real-time listener
│       │   └── usePDFExport.ts         ← PDF download hook
│       ├── services/
│       │   └── notivisaExportPdf.ts    ← PDF generation
│       └── views/
│           └── NotivisaQueueView.tsx   ← Queue list + filters
└── __tests__/
    ├── notivisa-integration.e2e.ts     ← 8 critical flows
    └── notivisa-criticos-integration.e2e.ts ← Phase 6 integration

functions/src/
├── modules/
│   └── notivisa/
│       ├── notivisaDraftCreate.ts       ← CF callable
│       ├── approveNotivisaDraft.ts      ← CF callable
│       ├── rejectNotivisaDraft.ts       ← CF callable
│       └── notivisaStatusCheckCron.ts   ← Cron job (v1.4 placeholder)
└── index.ts                             ← Register exports

firestore.rules                           ← Add NOTIVISA paths
```

---

## Zod Schema Template

```typescript
// src/shared/schemas/notivisaPayload.ts
import { z } from 'zod';

export const NotivisaPayloadSchema = z.object({
  facilityCode: z.string().length(7),
  facilityName: z.string().min(1),
  diseaseCode: z.string().regex(/^\d{5}$/),
  diseaseName: z.string(),
  patientInitials: z.string().length(2),
  dateOfBirth: z.date(),
  sex: z.enum(['M', 'F', 'O']),
  resultStatus: z.enum(['POSITIVE', 'PRESUMPTIVE_POSITIVE', 'INCONCLUSIVE']),
  resultValue: z.string().optional(),
  testMethod: z.string(),
  sampleCollectionDate: z.date(),
  resultDate: z.date(),
  requestingPhysicianName: z.string(),
  requestingPhysicianCRM: z.string().regex(/^\d{4,6}$/),
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
  notes: z.string().max(500).optional(),
});

export type NotivisaPayload = z.infer<typeof NotivisaPayloadSchema>;
```

---

## Notifiable Diseases Data

```typescript
// src/shared/data/notifiableDiseases.ts
export const NOTIFIABLE_DISEASES = [
  { code: '99078', name: 'Sífilis adquirida', urgent: false },
  { code: '99079', name: 'Sífilis congênita', urgent: true },
  { code: '99080', name: 'Sífilis em gestante', urgent: true },
  { code: '99050', name: 'Dengue em gestante', urgent: true },
  { code: '99051', name: 'Dengue grave', urgent: true },
  { code: '99068', name: 'HIV/AIDS', urgent: false },
  // ... (96 more from Portaria 204/2016)
];

export const NOTIFIABLE_DISEASE_MAP = new Map(NOTIFIABLE_DISEASES.map((d) => [d.code, d]));

export const isNotifiableDisease = (code: string): boolean => NOTIFIABLE_DISEASE_MAP.has(code);

export const isUrgentDisease = (code: string): boolean =>
  NOTIFIABLE_DISEASE_MAP.get(code)?.urgent ?? false;
```

---

## Firestore Types

```typescript
// src/shared/types/notivisaDraft.ts
import { Timestamp } from 'firebase/firestore';

export type NotivisaDraftStatus = 'draft' | 'approved' | 'rejected' | 'submitted' | 'acknowledged';

export interface NotivisaDraft {
  // Identity
  id: string;
  labId: string;
  criadoEm: Timestamp;
  deletadoEm?: Timestamp;

  // Workflow
  status: NotivisaDraftStatus;

  // Art. 6º Payload
  diseaseCode: string;
  diseaseName: string;
  facilityCode: string;
  facilityName: string;
  patientInitials: string;
  dateOfBirth: Timestamp;
  sex: 'M' | 'F' | 'O';
  resultStatus: 'POSITIVE' | 'PRESUMPTIVE_POSITIVE' | 'INCONCLUSIVE';
  resultValue?: string;
  testMethod: string;
  sampleCollectionDate: Timestamp;
  resultDate: Timestamp;
  requestingPhysicianName: string;
  requestingPhysicianCRM: string;
  requestingPhysicianState: string;
  notes?: string;

  // Approval (v1.4)
  approvedBy?: string;
  approvedAt?: Timestamp;
  approvalNotes?: string;

  // Rejection (v1.4)
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Audit
  chartHash: string;
  operatorId: string;
  ts: Timestamp;

  // Submission (v1.5+)
  submissionAttempts: Array<{
    attemptedAt: Timestamp;
    status: 'success' | 'error' | 'pending';
    httpStatus?: number;
    errorMessage?: string;
    receiptCode?: string;
  }>;

  // Anvisa response (v1.5+)
  receiptCodeFromAnvisa?: string;
  acknowledgedAt?: Timestamp;

  // Computed
  notificationDeadline: Timestamp;
  daysUntilDeadline: number;
  isOverdue: boolean;
}
```

---

## Cloud Function: `notivisaDraftCreate` Skeleton

```typescript
// functions/src/modules/notivisa/notivisaDraftCreate.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { NotivisaPayloadSchema } from '../../shared/schemas/notivisaPayload';
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
  facilityCode?: string;
  facilityName?: string;
}

export const notivisaDraftCreate = functions
  .region('southamerica-east1')
  .https.onCall(async (data: unknown, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User not authenticated');
      }

      const req = data as NotivisaDraftCreateRequest;
      const { labId, diseaseCode } = req;

      // 1. Auth: SuperAdmin OR lab admin/owner
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

      // 2. Validate disease code
      if (!NOTIFIABLE_DISEASE_MAP.has(diseaseCode)) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          `Disease code ${diseaseCode} not in Portaria 204/2016 whitelist`,
        );
      }

      // 3. Build & validate payload
      const labDoc = await admin.firestore().collection('labs').doc(labId).get();
      const labData = labDoc.data() || {};

      const payload = {
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

      const validPayload = NotivisaPayloadSchema.parse(payload);

      // 4. Calculate LogicalSignature
      const db = admin.firestore();
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

      // 5. Write atomically
      const outboxRef = db.collection('labs').doc(labId).collection('notivisa-outbox');
      const newDraftId = outboxRef.doc().id;

      const batch = db.batch();

      batch.set(outboxRef.doc(newDraftId), {
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
      });

      batch.set(outboxRef.doc(newDraftId).collection('audit').doc(ts.toMillis().toString()), {
        action: 'created',
        operatorId: context.auth.uid,
        ts,
        prevHash,
        chartHash: hash,
      });

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
        notificationDeadline: admin.firestore.Timestamp.fromDate(
          new Date(req.resultDate.toDate().getTime() + 24 * 60 * 60 * 1000),
        ),
      };
    } catch (error: any) {
      console.error('[notivisaDraftCreate] Error:', error.message);
      throw new functions.https.HttpsError(
        'internal',
        error.message || 'Failed to create NOTIVISA draft',
      );
    }
  });
```

---

## Firestore Rules (NOTIVISA Paths)

```firestore
match /labs/{labId}/notivisa-outbox/{docId} {
  allow read: if isAdminOrOwner(labId) ||
               request.auth.token.role == 'RT' ||
               request.auth.token.role == 'OPERADOR';

  allow create: if false; // CF only

  allow update: if (isAdminOrOwner(labId) || request.auth.token.role == 'RT') &&
                   (request.resource.data.status == 'approved' ||
                    request.resource.data.status == 'rejected') &&
                   request.resource.data.chartHash.size() == 64;

  allow delete: if false;

  match /audit/{logId} {
    allow read: if isAdminOrOwner(labId) || request.auth.token.role == 'RT';
    allow create: if request.auth != null;
    allow update, delete: if false;
  }

  match /submissions/{submissionId} {
    allow read: if isAdminOrOwner(labId);
    allow create, update, delete: if false; // CF only
  }
}

match /labs/{labId}/_state/notivisa-chain {
  allow read: if isAdminOrOwner(labId);
  allow create, update, delete: if false; // CF only
}
```

---

## React Hook: Real-time Listener

```typescript
// src/features/portal-rt/hooks/useNotivisaDrafts.ts
import { useEffect, useState } from 'react';
import { onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { NotivisaDraft } from '../../../shared/types/notivisaDraft';

export function useNotivisaDrafts(statusFilter?: string) {
  const [drafts, setDrafts] = useState<NotivisaDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const labId = useActiveLabId();

  useEffect(() => {
    if (!labId) return;

    const outboxRef = collection(db, 'labs', labId, 'notivisa-outbox');

    let q = statusFilter
      ? query(
          outboxRef,
          where('status', '==', statusFilter),
          orderBy('notificationDeadline', 'asc'),
        )
      : query(
          outboxRef,
          where('status', 'in', ['draft', 'approved']),
          orderBy('notificationDeadline', 'asc'),
        );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => doc.data() as NotivisaDraft);
        setDrafts(data);
        setLoading(false);
      },
      (err) => {
        console.error('useNotivisaDrafts error:', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId, statusFilter]);

  return { drafts, loading, error };
}
```

---

## React Component: Approval Panel

```typescript
// Minimal version of NotivisaDraftPanel.tsx
import React, { useState } from 'react';
import { NotivisaDraft } from '../../../shared/types/notivisaDraft';
import { approveNotivisaDraftCallable } from '../../../shared/services/notivisaService';

interface Props {
  draft: NotivisaDraft;
  labId: string;
  onApproved: () => void;
}

export function NotivisaDraftPanel({ draft, labId, onApproved }: Props) {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const isOverdue = new Date(draft.notificationDeadline.toDate()) < new Date();

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
      console.error('Approval failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="border border-white/10 rounded-lg p-6 bg-white/2">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-white">{draft.diseaseName}</h3>
        <div className={`px-2 py-1 rounded text-xs ${
          isOverdue ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
        }`}>
          {isOverdue ? 'OVERDUE' : 'OK'}
        </div>
      </div>

      <p className="text-sm text-white/60">Patient: {draft.patientInitials}, {draft.sex}</p>
      <p className="text-sm text-white/60">Physician: {draft.requestingPhysicianName}</p>

      {draft.status === 'draft' && (
        <div className="mt-4 space-y-2">
          <textarea
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            placeholder="Notes..."
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm"
            rows={3}
          />
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded"
          >
            {isApproving ? 'Approving...' : 'Approve'}
          </button>
        </div>
      )}

      {draft.status === 'approved' && (
        <div className="mt-4 bg-emerald-500/10 rounded p-2 text-sm">
          <p className="text-emerald-300">Approved by {draft.approvedBy}</p>
        </div>
      )}
    </div>
  );
}
```

---

## E2E Test Template (Single Test)

```typescript
// src/__tests__/notivisa-integration.e2e.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as admin from 'firebase-admin';
import { notivisaDraftCreate } from '../functions/src/modules/notivisa/notivisaDraftCreate';

describe('NOTIVISA Integration E2E', () => {
  let testLabId: string;

  beforeEach(async () => {
    // Setup: create test lab + user
    testLabId = 'test-lab-' + Date.now();
    await admin.firestore().collection('labs').doc(testLabId).set({
      name: 'Test Lab',
      facilityCode: 'CNES001',
    });
  });

  afterEach(async () => {
    // Cleanup: soft-delete test data
    const outboxRef = admin
      .firestore()
      .collection('labs')
      .doc(testLabId)
      .collection('notivisa-outbox');
    const docs = await outboxRef.get();
    for (const doc of docs.docs) {
      await doc.ref.update({ deletadoEm: admin.firestore.Timestamp.now() });
    }
  });

  it('E2E-01: Create draft from syphilis critical result', async () => {
    const response = await notivisaDraftCreate({
      labId: testLabId,
      diseaseCode: '99078',
      patientInitials: 'JD',
      dateOfBirth: new Date(1980, 0, 15),
      sex: 'F',
      resultStatus: 'POSITIVE',
      resultValue: '1:512',
      testMethod: 'Treponema pallidum total antibody',
      sampleCollectionDate: new Date(),
      resultDate: new Date(),
      requestingPhysicianName: 'Dr. Silva',
      requestingPhysicianCRM: '123456',
      requestingPhysicianState: 'SP',
    });

    expect(response.success).toBe(true);
    expect(response.draftId).toBeDefined();
    expect(response.status).toBe('draft');

    // Verify in Firestore
    const draftSnap = await admin
      .firestore()
      .collection('labs')
      .doc(testLabId)
      .collection('notivisa-outbox')
      .doc(response.draftId)
      .get();

    expect(draftSnap.exists).toBe(true);
    const data = draftSnap.data();
    expect(data?.diseaseCode).toBe('99078');
    expect(data?.chartHash.length).toBe(64); // HMAC-SHA256
  });
});
```

---

## Deployment Checklist (One-Line Commands)

```bash
# Build & test locally
cd functions && npm run build && npm test

# Type-check entire project
npx tsc --noEmit

# Deploy Cloud Functions only
firebase deploy --only functions --project hmatologia2

# Deploy Firestore Rules only
firebase deploy --only firestore:rules --project hmatologia2

# Deploy both
firebase deploy --only functions,firestore:rules --project hmatologia2

# Monitor Cloud Logs (post-deploy)
gcloud functions describe notivisaDraftCreate --region southamerica-east1 --project hmatologia2
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=~notivisa" --limit 50 --project hmatologia2

# Run E2E tests
npm run test:e2e -- notivisa-integration.e2e.ts
```

---

## Common Error Messages & Fixes

| Error                                   | Cause                                    | Fix                                                             |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| `disease code not in Portaria 204`      | Invalid diseaseCode                      | Use valid code from `notifiableDiseases.ts`                     |
| `Only RTs can approve`                  | User role is not RT                      | Verify user has `role: 'RT'` in JWT custom claim                |
| `Draft not found`                       | draftId doesn't exist                    | Verify draftId from creation response                           |
| `Invalid status transition`             | Trying to approve already-approved draft | Check draft.status before calling approve                       |
| `Hash mismatch`                         | Chain hash calculation error             | Verify `createLogicalSignature` is called with correct prevHash |
| `Permission denied` on Firestore update | Rule violation                           | Verify rules are deployed + user auth context correct           |
| `Timeout: callable did not return`      | Function >60s                            | Increase timeout to 120s in `functions/src/modules/notivisa/*`  |
| `PDF generation failed`                 | pdfkit library issue                     | Verify `npm install pdfkit` in functions + import correct       |

---

## Key Regulatory References (Copy-Paste)

**RDC 978/2025 — Art. 66:**

> Eventos adversos graves e reações transfusionais graves, confirmados ou suspeitos, devem ser notificados ao Ministério da Saúde, via NOTIVISA.

**Portaria 204/2016 (MS):**

> Define 99 doenças notificáveis de interesse epidemiológico e de saúde pública, inclusive sífilis (adquirida, congênita, em gestante), dengue (em gestante, grave), HIV/AIDS, tuberculose.

**Art. 6º (Portaria 204):**

> Notificação deve incluir: identificação da unidade notificante, doença, dados do paciente (anonimizados), resultado do teste, data coleta, data resultado, solicitante (médico), observações.

---

## v1.4 vs v1.5 Roadmap

| Feature                 | v1.4      | v1.5      |
| ----------------------- | --------- | --------- |
| Draft generation        | ✅        | ✅        |
| RT approval             | ✅        | ✅        |
| Audit trail             | ✅        | ✅        |
| PDF export              | ✅        | ✅        |
| Anvisa API call         | ❌ (mock) | ✅ (real) |
| Certificate use         | ❌        | ✅        |
| Receipt tracking        | ❌        | ✅        |
| Status sync from Anvisa | ❌        | ✅        |

**v1.4 is COMPLETE when:** Draft → Approval → Audit trail + PDF export working 100%.  
**v1.5 adds:** Real Anvisa API integration (requires certificate provisioning).

---

## Quick Links

- **Full spec:** `.planning/phases/08-notivisa/PHASE_8_DETAILED_PLAN.md`
- **Implementation checklist:** `.planning/phases/08-notivisa/IMPLEMENTATION_CHECKLIST.md`
- **ADR (decision record):** `docs/adr/ADR-0014-notivisa-integration-sandbox-to-production.md`
- **Project CLAUDE.md:** `CLAUDE.md` (section "Módulos em produção")
- **Portaria 204/2016:** `C:\Users\labcl\Obsidian_Brain\01_Projetos\HC_Quality_Referencias_Normativas.md`

---

**Document:** Quick Reference for Phase 8 Execution  
**Created:** 2026-05-07  
**Status:** READY FOR ENGINEERS  
**Last Updated:** 2026-05-07
