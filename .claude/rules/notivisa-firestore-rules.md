# NOTIVISA Firestore Rules (Phase 8)

Add these rules to `firestore.rules` for NOTIVISA collections.

## Collections

- `notivisa-drafts/{labId}/drafts/{draftId}` — NOTIVISA draft forms
- `notivisa-queue/{labId}/events/{eventId}` — Submission queue
- `notivisa-outbox/{labId}/archives/{archiveId}` — Export records

## Rules Block

```firestore
// NOTIVISA Drafts Collection
match /notivisa-drafts/{labId}/drafts/{draftId} {
  // Read: lab admin, RT, or auditor
  allow read: if isActiveMemberOfLab(labId) && 
              (request.auth.token.role == 'RT' || 
               request.auth.token.role == 'AUDITOR' ||
               isAdminOrOwner(labId));
  
  // Create: Cloud Function only (not client)
  allow create: if false;
  
  // Update: RT/admin can mark approved or submitted
  allow update: if (isAdminOrOwner(labId) || request.auth.token.role == 'RT') &&
                   (request.resource.data.status in ['approved', 'submitted', 'rejected']) &&
                   resource.data.labId == labId;
  
  // Delete: never (soft-delete only)
  allow delete: if false;
  
  // Audit subcollection (immutable)
  match /auditLog/{logId} {
    allow read: if parent.read;
    allow create: if request.auth != null;
    allow update, delete: if false;
  }
}

// NOTIVISA Queue Collection
match /notivisa-queue/{labId}/events/{eventId} {
  // Read: lab admin, RT, or auditor
  allow read: if isActiveMemberOfLab(labId) && 
              (request.auth.token.role == 'RT' || 
               request.auth.token.role == 'AUDITOR' ||
               isAdminOrOwner(labId));
  
  // Create: Cloud Function only
  allow create: if false;
  
  // Update: Cloud Function only (status changes)
  allow update: if false;
  
  // Delete: never
  allow delete: if false;
}

// NOTIVISA Outbox (Export Records)
match /notivisa-outbox/{labId}/archives/{archiveId} {
  // Read: auditor who created it
  allow read: if isActiveMemberOfLab(labId) && 
              request.auth.token.role == 'AUDITOR' &&
              resource.data.exportedBy == request.auth.uid;
  
  // Create: Cloud Function only
  allow create: if false;
  
  // Update: never
  allow update: if false;
  
  // Delete: never
  allow delete: if false;
}

// NOTIVISA Lab Configuration
match /labs/{labId}/notivisa-config/{document=**} {
  // Read: lab admin
  allow read: if isAdminOrOwner(labId);
  
  // Create: lab admin
  allow create: if isAdminOrOwner(labId) &&
                   request.resource.data.labId == labId;
  
  // Update: lab admin
  allow update: if isAdminOrOwner(labId) &&
                   resource.data.labId == labId;
  
  // Delete: never
  allow delete: if false;
}
```

## Helper Functions (add to `firestore.rules` header)

```firestore
function isActiveMemberOfLab(labId) {
  return exists(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.status == 'active';
}

function isAdminOrOwner(labId) {
  return isActiveMemberOfLab(labId) && 
         (get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.role == 'admin' ||
          get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.role == 'owner');
}
```

## Firestore Indexes

Create these composite indexes for NOTIVISA queries:

### notivisa-drafts

```yaml
# Index 1: labId + status (for listing submitted)
- collection: notivisa-drafts/{labId}/drafts
  fields:
    - field: status
      direction: ASCENDING
    - field: criadoEm
      direction: DESCENDING

# Index 2: labId + laudoId + status (for idempotent draft check)
- collection: notivisa-drafts/{labId}/drafts
  fields:
    - field: laudoId
      direction: ASCENDING
    - field: status
      direction: ASCENDING
```

### notivisa-queue

```yaml
# Index 1: labId + status + nextRetry (for polling)
- collection: notivisa-queue/{labId}/events
  fields:
    - field: status
      direction: ASCENDING
    - field: nextRetry
      direction: ASCENDING

# Index 2: labId + createdAt (for rate limiting)
- collection: notivisa-queue/{labId}/events
  fields:
    - field: createdAt
      direction: DESCENDING
```

## Deployment Order

1. Deploy firestore rules with NOTIVISA blocks
2. Deploy indexes
3. Deploy Cloud Functions (callables + cron)
4. Verify access via Firestore Console (RT user can read/write drafts)
5. Smoke test: Create draft → Submit → Poll
