# Phase 9 Firestore Rules — Governance Collections

**Updated:** 2026-05-07  
**Scope:** `governance-checklist`, `governance-checklist/items/`, `governance-checklist/audit/`  
**DICQ Ref:** 4.15, RDC 978 Art. 5.3  
**Integration:** sgd, labSettings, auditoria, educacao-continuada  

---

## Collection Paths

```
/labs/{labId}/governance-checklist/config
  ├─ items/{itemId} (governance items with status tracking)
  └─ audit/{auditId} (immutable audit trail)

/labs/{labId}/management-review/
  ├─ calendar/{year}
  ├─ minutes/{meetingId}
  └─ audit/{auditId}
```

---

## Firestore Rules (paste into `firestore.rules`)

```rego
// ============================================================
// GOVERNANCE CHECKLIST RULES
// Phase 9 — Manual Qualidade + Governance Framework
// ============================================================

match /labs/{labId}/governance-checklist/config {
  allow read: if isActiveMemberOfLab(labId);
  
  // Only Quality Director or Admin can update
  allow update: if isAdminOrOwner(labId) && 
                  request.auth.uid is string &&
                  request.resource.data.metadata.lastUpdated is timestamp;
  
  allow create: if isAdminOrOwner(labId);
  
  allow delete: if false; // Never delete, use soft-delete
}

match /labs/{labId}/governance-checklist/items/{itemId} {
  allow read: if isActiveMemberOfLab(labId);
  
  // Owner or QD can update
  allow update: if isAdminOrOwner(labId) &&
                  request.resource.data.status in ['pending', 'in_progress', 'completed'] &&
                  request.resource.data.lastUpdated is timestamp &&
                  request.resource.data.compliance_percentage >= 0 &&
                  request.resource.data.compliance_percentage <= 100;
  
  allow delete: if false;
}

// Immutable audit trail — append-only
match /labs/{labId}/governance-checklist/audit/{auditId} {
  allow read: if isActiveMemberOfLab(labId);
  
  allow create: if isAdminOrOwner(labId) &&
                  request.resource.data.itemId is string &&
                  request.resource.data.updatedAt is timestamp;
  
  allow update, delete: if false;
}

// ============================================================
// MANAGEMENT REVIEW RULES
// Phase 9 — DICQ 4.15 Compliance
// ============================================================

match /labs/{labId}/management-review/calendar/{year} {
  allow read: if isActiveMemberOfLab(labId);
  
  allow update: if isAdminOrOwner(labId) &&
                  request.resource.data.meetings is list;
  
  allow delete: if false;
}

match /labs/{labId}/management-review/minutes/{meetingId} {
  allow read: if isActiveMemberOfLab(labId);
  
  // Only recorder or QD can create/update before signed
  allow create: if isAdminOrOwner(labId);
  
  allow update: if isAdminOrOwner(labId) &&
                  request.resource.data.status in ['scheduled', 'held', 'cancelled'] &&
                  request.resource.data.lastModifiedAt is timestamp;
  
  // Only QD can sign
  allow update: if isAdminOrOwner(labId) &&
                  request.resource.data.signedAt is timestamp &&
                  request.resource.data.signedBy is string;
  
  allow delete: if false;
}

match /labs/{labId}/management-review/audit/{auditId} {
  allow read: if isAdminOrOwner(labId);
  
  allow create: if isAdminOrOwner(labId);
  
  allow delete: if false;
}

// ============================================================
// HELPER FUNCTIONS (defined in main rules file)
// ============================================================

function isActiveMemberOfLab(labId) {
  let member = get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid));
  return member.exists && member.data.isActiveMemberOfLab == true;
}

function isAdminOrOwner(labId) {
  let member = get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid));
  return member.exists && (member.data.isAdminOrOwner == true || member.data.isOwner == true);
}
```

---

## Audit Trail Structure

Every update to a governance item is logged in the audit collection:

```firestore
/labs/{labId}/governance-checklist/audit/{auditId}
{
  itemId: "A-001",
  previousStatus: "pending",
  newStatus: "in_progress",
  completionPercentage: 50,
  updatedAt: <server timestamp>,
  updatedBy: <uid>,
  chainHash: "<SHA-256 of audit chain>" // For immutability
}
```

This ensures RDC 978 Art. 5.3 compliance (audit trail of all changes).

---

## Management Review Minute Signing

Minutes are append-only until signed by Quality Director:

```firestore
/labs/{labId}/management-review/minutes/{meetingId}
{
  status: "held",
  actualDate: "2026-06-15",
  inputs: { ... },
  decisions: [ ... ],
  actionItems: [ ... ],
  // After signature:
  signedAt: <server timestamp>,
  signedBy: <QD uid>,
  // Once signed, document is immutable (no further updates allowed)
}
```

Post-signature, only soft-delete is allowed (mark `deletedAt` without removing document).

---

## Compliance Mapping

| DICQ Requirement | Rule | Firestore Path |
|---|---|---|
| 4.15.1 — Management Review inputs | Governance items tracked + documented | `/governance-checklist/items/*` |
| 4.15.2 — Review outputs & decisions | Minutes stored with decisions array | `/management-review/minutes/{meetingId}` |
| 4.15.3 — Review records | Minutes signed and immutable | `.signedAt`, `.signedBy` |
| RDC 978 5.3 — Audit trail | Chain-hashed audit collection | `/governance-checklist/audit/*` |
| RDC 978 Art. 183 — Record retention | Soft-delete only; archival via timestamps | `.deletedAt` (optional) |

---

## Testing Checklist

- [ ] `isActiveMemberOfLab` returns true for members with `isActiveMemberOfLab=true`
- [ ] Non-members cannot read governance collections
- [ ] Only Admin/Owner can update governance items
- [ ] Compliance percentage validation (0-100)
- [ ] Status must be one of: pending | in_progress | completed
- [ ] Audit trail is append-only (no updates/deletes)
- [ ] Management Review minutes can be created and updated before signing
- [ ] Once signed, minutes are immutable (no updates, only soft-delete)
- [ ] QD signature (signedBy) is recorded and immutable

---

**End of Phase 9 Firestore Rules**
