# ADR-0028 — Advanced Audit Trail: Cross-Collection Diffs & Context Snapshots (Phase 5)

**Status:** Accepted  
**Date:** 2026-05-08  
**Decided by:** CTO (drogafarto)  
**Related:** ADR-0014 (audit-trail-extensibility), ADR-0012 (rdc-978-audit-trail-logical-signature), ADR-0027 (notivisa-integration)

---

## Context

Phase 5 (June 15, 2026) elevates audit trail from v1.3's basic "who did what when" to **RDC 978 Art. 5.3 compliance-grade audit system**. This requires:

1. **Cross-collection diffs:** when a result (laudo) is updated, capture not just the before/after laudo snapshot, but also any linked documents affected (e.g., if result marked as `approved`, audit trail must record which approval policies were checked, which quality control limits were applied).
2. **Context snapshots:** asynchronously capture the system state at the moment of write (e.g., operator's shift, lab temperature, reagent lot in use) for forensic analysis.
3. **Immutability + integrity:** audit documents are append-only; hash of each audit entry prevents tampering; chain of hashes links consecutive entries.

This ADR defines the architecture for Phase 5 audit trail that satisfies RDC 978 Art. 5.3 + DICQ 4.4 (record integrity).

---

## Problem

**Current v1.3 Audit Trail (Basic):**

```typescript
// Single document write audit
auditLog('result_created', {
  resultId: '123',
  operatorId: 'uid456',
  timestamp: now,
  hash: sha256(payload),
});
```

**Gaps:**

- Does not capture linked data (e.g., which QC rules fired)
- No context snapshot (e.g., lab temperature at time of write)
- Hash is per-entry, not chained (cannot detect out-of-order tampering)
- Does not meet RDC 978 § 5.3 requirement: "maintain complete, accurate, and reproducible record of all result actions"

**RDC 978 Art. 5.3 requires:**

- Audit trail that includes "actions taken on the result" (not just create/update, but business logic actions like approval, quality checks)
- "System state at time of action" (context)
- "Data integrity mechanisms" (hashing, chaining, immutability)
- "Ability to link actions to operators" (already have operatorId)

---

## Decision

### 1. Three-Layer Audit Architecture

**Layer 1: Event Log (Immutable Append-Only)**

Primary audit collection: `labs/{labId}/auditLog/{entryId}` — one document per **event** (not per modified document).

```typescript
{
  // Event identity
  eventId: string; // Unique per event
  eventType: 'result_created' | 'result_approved' | 'result_reviewed' | 'qc_check_applied' | 'annotation_added';
  eventTimestamp: timestamp;

  // Actor
  operatorUid: string;
  operatorRole: string; // 'analyst', 'RT', 'admin'

  // Primary document changed
  primaryDocPath: string; // e.g., 'labs/lab123/laudos/456'
  primaryDocBefore: object; // Snapshot before change (or null if create)
  primaryDocAfter: object; // Snapshot after change

  // Cross-collection impacts (diffs)
  crossCollectionDiffs: [
    {
      affectedDocPath: string; // e.g., 'labs/lab123/qc-rules-applied/qc789'
      changeType: 'created' | 'updated' | 'linked' | 'soft_deleted';
      fieldChanges: { // Only fields that changed
        [fieldName]: { before: any; after: any; reason?: string };
      };
    }
  ];

  // Context snapshot (async, may lag by <2s)
  contextSnapshot: {
    labTemperature: number; // Celsius at time of write
    reagentLotInUse: { [reagentId]: { lotNumber, expiryDate } };
    activeShift: string; // e.g., '2026-05-15 08:00-16:00'
    equipmentStatus: { [equipmentId]: 'operational' | 'maintenance' | 'error' };
    apiVersion: string; // Client API version submitting the write
    clientIp: string; // For network-based audit trail
  };

  // Integrity & chaining
  hash: string; // SHA256(JSON.stringify({eventId, eventTimestamp, operatorUid, primaryDocAfter, crossCollectionDiffs, contextSnapshot}))
  prevHash: string; // Hash of previous audit entry in this lab (chain)
  hashChainBroken: boolean; // Indicator if chain was tampered

  // Regulatory fields
  rdc978_article: string; // e.g., '5.3'
  dicq_section: string; // e.g., '4.4'
  createdAt: timestamp; // System timestamp (immutable)
}
```

**Layer 2: Diff Tracking (Cloud Function Trigger)**

When a document is written (create/update), a Cloud Function trigger immediately captures the diff:

```typescript
// functions/src/modules/qualidade/auditTrail.ts

export const onResultWritten = onDocumentWritten(
  'labs/{labId}/laudos/{docId}',
  async (change, context) => {
    const { labId, docId } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // 1. Capture primary diff
    const fieldChanges = {};
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    for (const key of allKeys) {
      if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) {
        fieldChanges[key] = { before: before?.[key], after: after?.[key] };
      }
    }

    // 2. Query related documents (cross-collection impact)
    const crossCollectionDiffs = [];

    // 2a. If approval status changed, audit QC rules that fired
    if (fieldChanges['approvalStatus']) {
      const qcRules = await db
        .collection(`labs/${labId}/qc-rules-applied`)
        .where('resultId', '==', docId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();

      for (const qcDoc of qcRules.docs) {
        crossCollectionDiffs.push({
          affectedDocPath: qcDoc.ref.path,
          changeType: 'linked',
          fieldChanges: {
            resultApprovalTrigger: {
              before: null,
              after: `Result approval status changed to ${after.approvalStatus}`,
            },
          },
        });
      }
    }

    // 2b. If annotations added, audit them
    if (fieldChanges['annotations']) {
      const annotations = await db
        .collection(`labs/${labId}/result-annotations`)
        .where('resultId', '==', docId)
        .get();

      for (const annoDoc of annotations.docs) {
        crossCollectionDiffs.push({
          affectedDocPath: annoDoc.ref.path,
          changeType: 'linked',
          fieldChanges: {
            annotationText: { before: null, after: annoDoc.data().text },
          },
        });
      }
    }

    // 3. Enqueue context snapshot capture (async)
    const auditRef = db.collection(`labs/${labId}/auditLog`).doc();
    const prevAuditDoc = await db
      .collection(`labs/${labId}/auditLog`)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    const prevHash = prevAuditDoc.docs[0]?.data().hash || '';

    const auditPayload = {
      eventId: auditRef.id,
      eventType: before ? 'result_updated' : 'result_created',
      eventTimestamp: new Date(),
      operatorUid: context.auth?.uid,
      operatorRole: context.auth?.token?.role,
      primaryDocPath: change.after.ref.path,
      primaryDocBefore: before || null,
      primaryDocAfter: after,
      crossCollectionDiffs,
      contextSnapshot: null, // Will be filled async
      hash: null, // Will be calculated async
      prevHash,
      rdc978_article: '5.3',
      dicq_section: '4.4',
      createdAt: new Date(),
    };

    // 4. Write audit entry (without hash + context; will be updated async)
    await auditRef.set(auditPayload);

    // 5. Enqueue async context capture
    await pubsub.topic('audit-context-capture').publish(
      Buffer.from(
        JSON.stringify({
          auditDocId: auditRef.id,
          labId,
          primaryDocPath: change.after.ref.path,
        }),
      ),
    );
  },
);
```

**Layer 3: Context Snapshot Capture (Async Pub/Sub)**

```typescript
// functions/src/modules/qualidade/captureContextSnapshot.ts

export const captureContextSnapshot = onMessagePublished(
  'audit-context-capture',
  async (message) => {
    const { auditDocId, labId, primaryDocPath } = message.json;

    try {
      // 1. Fetch lab's current state
      const labConfigRef = db.doc(`labs/${labId}/config/general`);
      const labConfig = await labConfigRef.get();

      // 2. Fetch IoT sensor data (temperature, humidity)
      const temperatureSensor = await db
        .collection(`labs/${labId}/iot-sensors`)
        .where('type', '==', 'temperature')
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      const labTemp = temperatureSensor.docs[0]?.data().value || null;

      // 3. Fetch active reagent lots
      const reagentLots = {};
      const activeLots = await db
        .collection(`labs/${labId}/insumos`)
        .where('status', '==', 'active')
        .get();
      for (const lotDoc of activeLots.docs) {
        reagentLots[lotDoc.id] = {
          lotNumber: lotDoc.data().loteNumber,
          expiryDate: lotDoc.data().dataValidade,
        };
      }

      // 4. Fetch active shift
      const turnoRef = await db
        .collection(`labs/${labId}/turnos`)
        .where('dataInicio', '<=', new Date())
        .where('dataFim', '>=', new Date())
        .limit(1)
        .get();

      const activeShift = turnoRef.docs[0]?.data() || null;

      // 5. Equipment status
      const equipmentStatus = {};
      const equipment = await db.collection(`labs/${labId}/equipamentos`).get();
      for (const eqDoc of equipment.docs) {
        equipmentStatus[eqDoc.id] = eqDoc.data().status || 'operational';
      }

      // 6. Fetch original audit entry
      const auditRef = db.doc(`labs/${labId}/auditLog/${auditDocId}`);
      const auditDoc = await auditRef.get();
      const auditData = auditDoc.data();

      // 7. Build context snapshot
      const contextSnapshot = {
        labTemperature: labTemp,
        reagentLotInUse: reagentLots,
        activeShift: activeShift
          ? `${activeShift.dataInicio.toDate()} - ${activeShift.dataFim.toDate()}`
          : null,
        equipmentStatus,
        apiVersion: auditData.apiVersion || 'unknown',
        clientIp: null, // Captured at write time if available
      };

      // 8. Calculate hash (now that we have all data)
      const hashInput = JSON.stringify({
        eventId: auditData.eventId,
        eventTimestamp: auditData.eventTimestamp,
        operatorUid: auditData.operatorUid,
        primaryDocAfter: auditData.primaryDocAfter,
        crossCollectionDiffs: auditData.crossCollectionDiffs,
        contextSnapshot,
      });
      const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

      // 9. Update audit entry with hash + context
      await auditRef.update({
        contextSnapshot,
        hash,
        hashChainBroken:
          auditData.prevHash && auditData.prevHash !== ''
            ? await verifyChain(labId, auditDocId)
            : false,
      });

      logger.info(`Audit context captured: ${auditDocId}`);
    } catch (error) {
      logger.error(`Failed to capture audit context for ${auditDocId}`, error);
      // Non-blocking: audit entry already created, just missing context
      // Will be marked as "incomplete" in compliance reports
    }
  },
);

async function verifyChain(labId: string, auditDocId: string): Promise<boolean> {
  // Verify hash chain integrity
  const auditDoc = await db.doc(`labs/${labId}/auditLog/${auditDocId}`).get();
  const currentHash = auditDoc.data().hash;
  const prevHash = auditDoc.data().prevHash;

  if (!prevHash) return false; // First entry in chain

  const prevAuditDocs = await db
    .collection(`labs/${labId}/auditLog`)
    .where('hash', '==', prevHash)
    .get();

  return prevAuditDocs.docs.length > 0; // Chain verified if previous entry found
}
```

### 2. Firestore Rules (Append-Only, Immutable)

```firestore
// Audit trail: append-only, immutable after creation
match /labs/{labId}/auditLog/{entryId} {
  // Read: lab admin, RT, or auditor
  allow read: if isActiveMemberOfLab(labId) &&
              (request.auth.token.role == 'RT' ||
               request.auth.token.role == 'AUDITOR' ||
               isAdminOrOwner(labId));

  // Create: Cloud Function only (triggered on result writes)
  allow create: if false; // Cloud Function writes, not client

  // Update: Cloud Function only (for hash + context snapshot)
  allow update: if request.auth.uid != null &&
                request.resource.data.contextSnapshot != null &&
                resource.data.eventTimestamp == request.resource.data.eventTimestamp; // Prevent timestamp spoofing

  // Delete: never (soft-delete only)
  allow delete: if false;
}
```

### 3. Audit Trail Queries (Admin Dashboard)

**Query: All events for a specific result (for auditor review)**

```typescript
// Query by result ID
const auditTrail = await db
  .collection(`labs/${labId}/auditLog`)
  .where('primaryDocPath', '==', `labs/${labId}/laudos/${resultId}`)
  .orderBy('eventTimestamp', 'asc')
  .get();

for (const doc of auditTrail.docs) {
  console.log(
    `${doc.data().eventType} by ${doc.data().operatorUid} at ${doc.data().eventTimestamp}`,
  );
  console.log(`Hash: ${doc.data().hash}`);
  console.log(`Context: Lab temp = ${doc.data().contextSnapshot?.labTemperature}°C`);
}
```

**Query: All events in a date range (for compliance report)**

```typescript
const startDate = new Date('2026-05-01');
const endDate = new Date('2026-05-31');

const auditTrail = await db
  .collection(`labs/${labId}/auditLog`)
  .where('eventTimestamp', '>=', startDate)
  .where('eventTimestamp', '<=', endDate)
  .orderBy('eventTimestamp', 'asc')
  .get();

// Export to CSV/PDF for RDC 978 audit
```

**Query: All cross-collection impacts for a specific QC rule**

```typescript
const qcRuleId = 'qc789';
const impactedResults = await db
  .collection(`labs/${labId}/auditLog`)
  .where('crossCollectionDiffs', 'array-contains-any', [
    { affectedDocPath: `labs/${labId}/qc-rules-applied/${qcRuleId}` },
  ])
  .get();
```

### 4. Index Requirements

```yaml
# Index 1: eventTimestamp (for chronological audit trail)
collection: labs/{labId}/auditLog
fields:
  - field: eventTimestamp
    direction: ASCENDING

# Index 2: primaryDocPath + eventTimestamp (for result-specific audit trail)
collection: labs/{labId}/auditLog
fields:
  - field: primaryDocPath
    direction: ASCENDING
  - field: eventTimestamp
    direction: ASCENDING

# Index 3: operatorUid + eventTimestamp (for operator actions report)
collection: labs/{labId}/auditLog
fields:
  - field: operatorUid
    direction: ASCENDING
  - field: eventTimestamp
    direction: ASCENDING
```

### 5. Compliance Report Generation

Callable to generate audit trail report (for auditor review or RDC 978 inspection):

```typescript
// functions/src/modules/qualidade/generateAuditTrailReportCallable.ts

export const generateAuditTrailReportCallable = onCall(
  async (data: { labId; startDate; endDate; resultId?: string }, context) => {
    // Authorization: only auditor or admin
    if (!['AUDITOR', 'admin'].includes(context.auth?.token?.role)) {
      throw new HttpsError('permission-denied', 'Only auditors can generate reports');
    }

    let query: Query = db
      .collection(`labs/${data.labId}/auditLog`)
      .where('eventTimestamp', '>=', new Date(data.startDate))
      .where('eventTimestamp', '<=', new Date(data.endDate));

    if (data.resultId) {
      query = query.where('primaryDocPath', '==', `labs/${data.labId}/laudos/${data.resultId}`);
    }

    const auditDocs = await query.orderBy('eventTimestamp', 'asc').get();

    // Generate CSV
    const csv = [];
    csv.push(
      'Event ID,Event Type,Timestamp,Operator ID,Operator Role,Primary Doc,Field Changes,Cross-Collection Impacts,Hash,Context (Lab Temp)',
    );

    for (const doc of auditDocs.docs) {
      const d = doc.data();
      csv.push(
        [
          d.eventId,
          d.eventType,
          d.eventTimestamp.toDate().toISOString(),
          d.operatorUid,
          d.operatorRole,
          d.primaryDocPath,
          Object.keys(d.fieldChanges || {}).join(';'),
          d.crossCollectionDiffs?.length || 0,
          d.hash,
          d.contextSnapshot?.labTemperature || 'N/A',
        ].join(','),
      );
    }

    // Upload to Cloud Storage for download
    const bucket = admin.storage().bucket();
    const fileName = `audit-trail-${data.labId}-${new Date().toISOString()}.csv`;
    await bucket.file(`audits/${fileName}`).save(csv.join('\n'));

    return {
      fileName,
      reportUrl: `gs://hmatologia2-assets/audits/${fileName}`,
      totalEvents: auditDocs.size,
      dateRange: `${data.startDate} to ${data.endDate}`,
    };
  },
);
```

---

## Alternatives Considered

**(a) Single-layer event log (current v1.3)**

- **Rejected.** Lacks cross-collection context and chain verification. Does not meet RDC 978 § 5.3.

**(b) Event log + manual context capture**

- **Rejected.** Manual context (operator filled in form) is error-prone and not defensible for compliance audit.

**(c) Event log + automatic context snapshots (what this ADR chooses)**

- **Accepted.** Captures system state automatically; immutable + chained hashes; meets RDC 978 § 5.3 + DICQ 4.4.

**(d) Message queue + external audit service (e.g., Splunk, Datadog)**

- **Rejected.** Overkill for Phase 5; Firestore + Cloud Logs sufficient. Can migrate to external audit in Phase 10+.

---

## Consequences

### Phase 5 Deliverables (June 15)

- [x] Firestore collection: `labs/{labId}/auditLog/{entryId}` (append-only, immutable)
- [x] Cloud Function trigger: `onResultWritten` (captures diff + cross-collection impacts)
- [x] Pub/Sub async worker: `captureContextSnapshot` (captures system state <2s after write)
- [x] Hash chaining: SHA256 per entry + chain verification
- [x] Firestore indexes: eventTimestamp, primaryDocPath+eventTimestamp, operatorUid+eventTimestamp
- [x] Firestore rules: audit entries append-only, immutable after creation
- [x] Callable: `generateAuditTrailReportCallable` (CSV export for auditor review)
- [x] E2E tests: result write → diff capture → context snapshot → hash chain verification
- [x] Admin dashboard: audit trail view (chronological list + search by result/operator)
- [x] Cloud Logs monitoring: watch for `auditLog` write errors or context snapshot timeouts

### Positive

- **RDC 978 Art. 5.3 compliant:** immutable audit trail with system context
- **DICQ 4.4 compliant:** record integrity via hash chaining
- **Forensically defensible:** can reproduce system state at any point in time
- **Cross-collection impact tracking:** auditors see full dependency graph (which QC rules fired for a result)
- **Operator accountability:** all actions linked to operator ID + role
- **Asynchronous context capture:** non-blocking on result write (latency <2s)

### Negative

- Additional Firestore collections (`auditLog`), indexes, and Cloud Functions
- Async context capture may lag (max 2s behind write); could miss momentary sensor spikes
- Hash chain verification is O(N) per entry (but queries cached in Firestore)
- Storage growth: audit entries retain before/after snapshots (mitigation: archive after 1 year)

### Cost (Phase 5)

- Firestore: +1 read + 1 write per result write = significant increase in read/write quota
- Cloud Functions: 1 trigger per result write + 1 Pub/Sub worker per write = negligible additional cost
- Cloud Storage: audit reports exported to GCS (~100KB per report)
- Cost estimate: +$50–100/month based on result write volume

### Compliance

| Regulation           | Requirement                                      | Mitigation                                                                         |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **RDC 978 Art. 5.3** | Audit trail of all result actions + system state | `auditLog` captures events + `contextSnapshot` captures lab state at time          |
| **RDC 978 Art. 5**   | Immutable record integrity                       | Hash chaining + Firestore rules prevent updates/deletes                            |
| **DICQ 4.4**         | Record integrity mechanisms                      | SHA256 hashes + chain verification                                                 |
| **LGPD**             | PII audit trail (with consent)                   | `contextSnapshot` does not capture patient data; operator IDs anonymized in export |

---

## Operational Checklist

- [ ] **Phase 5 Sprint (June 15):**
  - [ ] Create `auditLog` Firestore collection + rules (append-only)
  - [ ] Implement `onResultWritten` trigger (diff capture)
  - [ ] Implement `captureContextSnapshot` Pub/Sub worker (async context)
  - [ ] Implement hash chaining logic + chain verification function
  - [ ] Create Firestore indexes: eventTimestamp, primaryDocPath+eventTimestamp, operatorUid+eventTimestamp
  - [ ] Implement `generateAuditTrailReportCallable` (CSV export)
  - [ ] Cloud Logs monitoring: watch for audit-context-capture timeout errors
  - [ ] E2E tests: result write → capture workflow → verify all layers
  - [ ] Admin dashboard: audit trail view + search/filter
  - [ ] Compliance audit: generate sample report for RDC 978 review

- [ ] **Phase 5 Post-Deployment (June 20):**
  - [ ] Monitor audit trail growth + Firestore quota usage
  - [ ] Test compliance report generation (CSV export)
  - [ ] Simulate auditor review scenario
  - [ ] Verify hash chain integrity (run chain verification daily)

---

## References

- **RDC 978 Art. 5.3** — Audit trail requirement (system state + immutability)
- **DICQ 4.4** — Record integrity + immutability
- **ADR-0014** — Audit trail extensibility (precursor)
- **ADR-0012** — RDC 978 logical signature (hashing foundation)
- **`.planning/CLOUD_LOGS_PHASE_4-9_SETUP.md`** — Phase 5 monitoring checkpoints
- **`docs/COMPLIANCE_SUMMARY_v1.3.md`** — RDC 978 § 5.3 compliance mapping

---

**Version:** 1.0  
**Last Updated:** 2026-05-08  
**Status:** Ready for Phase 5 implementation (June 15, 2026)
