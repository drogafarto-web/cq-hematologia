# Wave 3.1 — Portal RT Scaffold + Firestore Rules Proposal

**Status:** Phase 4 Kick-off  
**Date:** 2026-05-08  
**Component:** Portal RT (Responsible Technician dashboard)  
**Scope:** Scaffold + Rules foundation (no business logic)

---

## Summary

This document proposes the foundational Firestore rules and indexes for the Portal-RT module (Phase 4 focus: RT operational dashboard). The scaffold itself is feature-complete (shell + nav + tests); these rules define data access boundaries for future phases.

**Key decisions:**
- Rules block created but **not deployed** until Phase 4.2 (when critical-values module goes live)
- Three collections: `portal-rt-state/{labId}/dashboards`, `critical-values/{labId}/escalations`, `portal-rt-audit/{labId}/events`
- All writes via Cloud Function callable (server-side signature + server-side timestamp)
- RT role requirement: `hasRole('rt') && isActiveMemberOfLab(labId)`

---

## Firestore Collections & Access Pattern

### 1. `portal-rt-state/{labId}/dashboards/{dashboardId}`

**Purpose:** Persistent dashboard layout, filter preferences, bookmarks.

**Payload:**
```typescript
interface PortalRTDashboard {
  labId: string;
  dashboardId: string;        // e.g., "main-dashboard"
  rtId: string;                // operator UID
  layout: 'default' | 'custom';
  filters: {
    equipamentoId?: string;
    dataInicio?: Timestamp;
    dataFim?: Timestamp;
  };
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}
```

**Access:**
- **Read:** RT of lab, Admin, Auditor
- **Create:** Cloud Function `portal_rt_createDashboard` (server-side only)
- **Update:** Cloud Function `portal_rt_updateDashboard` (server-side only)
- **Delete:** Never (soft-delete only via `portal_rt_softDeleteDashboard`)

### 2. `critical-values/{labId}/escalations/{escalationId}`

**Purpose:** Critical value alerts awaiting RT approval/action.

**Payload:**
```typescript
interface CriticalValueEscalation {
  labId: string;
  escalationId: string;
  laudoId: string;              // reference to result
  patientId: string;
  criticidade: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'acknowledged' | 'resolved' | 'delegated';
  assignedTo?: string;          // RT UID or supervisor
  notificacao: {
    enviada: Timestamp;
    lida?: Timestamp;
    reconhecida?: Timestamp;
  };
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}
```

**Access:**
- **Read:** RT of lab, Admin, Supervisor (RDC 978 Art. 122), Auditor
- **Create:** Cloud Function `critical_notifyEscalation` (server-side only)
- **Update:** Cloud Function `critical_acknowledgeEscalation` (RT action)
- **Delete:** Never (soft-delete only)

**Note:** Escalation count in `usePortalRTNav` filters `status == 'pending'`.

### 3. `portal-rt-audit/{labId}/events/{eventId}`

**Purpose:** Audit trail of RT actions (view, approve, acknowledge, escalate).

**Payload:**
```typescript
interface PortalRTAuditEvent {
  labId: string;
  eventId: string;
  rtId: string;                 // operator
  action: 'view' | 'approve' | 'acknowledge' | 'escalate' | 'delegate';
  targetType: 'laudo' | 'escalation' | 'dashboard';
  targetId: string;
  details: Record<string, unknown>;
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}
```

**Access:**
- **Read:** RT of lab (own events only), Admin, Auditor
- **Create:** Cloud Function `portal_rt_auditLog` (server-side, called on every RT action)
- **Update:** Never
- **Delete:** Never (soft-delete only, DICQ 4.4 retention 5 years)

---

## Firestore Rules Block (to be deployed in Phase 4.2)

```firestore
// Portal RT Collections
match /portal-rt-state/{labId}/dashboards/{dashboardId} {
  // Read: RT + Admin + Auditor
  allow read: if isActiveMemberOfLab(labId) &&
              (getMemberRole(labId) in ['rt', 'admin', 'owner'] ||
               hasRole('auditor'));

  // Create/Update/Delete: Cloud Function only
  allow create, update, delete: if false;

  // Audit subcollection
  match /auditLog/{logId} {
    allow read: if parent.read;
    allow write: if isServer();
  }
}

match /critical-values/{labId}/escalations/{escalationId} {
  // Read: RT + Admin + Supervisor + Auditor
  allow read: if isActiveMemberOfLab(labId) &&
              (getMemberRole(labId) in ['rt', 'admin', 'owner', 'supervisor'] ||
               hasRole('auditor'));

  // Create: Cloud Function only
  allow create: if false;

  // Update: Cloud Function only (RT acks / resolves)
  allow update: if false;

  // Delete: Never
  allow delete: if false;
}

match /portal-rt-audit/{labId}/events/{eventId} {
  // Read: RT (own events only), Admin, Auditor
  allow read: if isActiveMemberOfLab(labId) &&
              (request.auth.uid == resource.data.rtId ||
               getMemberRole(labId) in ['admin', 'owner'] ||
               hasRole('auditor'));

  // Write: Cloud Function only
  allow create, update, delete: if isServer();
}
```

---

## Helper Function Required

Add or update in `firestore.rules` header (already present in codebase):

```firestore
// Existing (verify present)
function isActiveMemberOfLab(labId) {
  return exists(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.active == true;
}

function getMemberRole(labId) {
  return get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.role;
}

function hasRole(role) {
  return request.auth.token[role] == true;
}

// Existing (verify present) — isServer() added in Wave 2
function isServer() {
  return request.auth == null || request.auth.token.server == true;
}
```

---

## Firestore Indexes

Create these composite indexes (via Firebase Console or `firestore.indexes.json`):

### portal-rt-state

```yaml
- collection: portal-rt-state/{labId}/dashboards
  fields:
    - field: rtId
      direction: ASCENDING
    - field: atualizadoEm
      direction: DESCENDING
```

### critical-values

```yaml
- collection: critical-values/{labId}/escalations
  fields:
    - field: status
      direction: ASCENDING
    - field: criadoEm
      direction: DESCENDING

- collection: critical-values/{labId}/escalations
  fields:
    - field: criticidade
      direction: DESCENDING
    - field: status
      direction: ASCENDING
```

### portal-rt-audit

```yaml
- collection: portal-rt-audit/{labId}/events
  fields:
    - field: rtId
      direction: ASCENDING
    - field: criadoEm
      direction: DESCENDING

- collection: portal-rt-audit/{labId}/events
  fields:
    - field: action
      direction: ASCENDING
    - field: criadoEm
      direction: DESCENDING
```

---

## Deployment Order (Phase 4.2)

1. **Claim provisioning** (if new): Run `provisionModulesClaims({ modules: { 'portal-rt': true } })` to add `portal-rt` claim to RT + Admin tokens
2. **Verify claim deployment**: Wait 5min for Firebase Auth token refresh cache; test 1 RT user has claim via `decode(idToken)`
3. **Deploy Firestore rules**: `firebase deploy --only firestore:rules --project hmatologia2`
4. **Deploy indexes**: `firebase deploy --only firestore:indexes --project hmatologia2`
5. **Verify access** (1h after deploy): Test in Firestore Console that RT can read dashboards + escalations
6. **Smoke test** (Phase 4.2 teams): Call `portal_rt_createDashboard` callable → confirm dashboard persists + readable
7. **Monitor Cloud Logs**: 24h post-deploy for permission-denied errors (red flag = claim not propagated or rule typo)

---

## Phase 4.2 Tasks (Linked)

- **04-02:** Implement `critical-values` module (escalation detection + callable `critical_notifyEscalation`)
- **04-03:** Implement `portal-rt-critical` sub-module (dashboard critical-values card + subscription)
- **04-04:** Implement `portal-rt-audit` logging (intercept RT actions → `portal_rt_auditLog` callable)

---

## Testing Checklist

- [ ] Emulator: RTs can read dashboards (rule test)
- [ ] Emulator: Admins can read dashboards (rule test)
- [ ] Emulator: Patients cannot read dashboards (rule test)
- [ ] Emulator: Escalations readable by RT (rule test)
- [ ] Emulator: Audit events readable by audit-creator only or admin/auditor (rule test)
- [ ] Unit test: `usePortalRTNav` escalation count updates (mock Firestore hook)
- [ ] E2E (Phase 4.2): Create dashboard via callable → list via hook → verify sub

---

## Notes for Merge

- **No Firestore changes yet** — this proposal is documented in git but NOT deployed
- **Phase 4.1 (this PR):** Shell + Nav + Tests only. Rules go to Phase 4.2 PR.
- **Rules activation gated** on Phase 4.2 start date (2026-05-27 per roadmap)
- **Compliance linkage:** Portal-RT audit trail supports RDC 978 Art. 167 (result audit) + DICQ 4.4 (auditoria)

---

## Co-authors

- Wave 3 Agent 1 (Claude Haiku 4.5) — scaffolding + proposal
- (Awaiting merge approval + Phase 4.2 implementation)
