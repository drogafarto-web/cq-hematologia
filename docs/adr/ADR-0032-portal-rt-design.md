# ADR-0032: Portal-RT Design — Dark-First Operational Dashboard

**Date:** 2026-05-08  
**Status:** APPROVED  
**Phase:** Phase 4 (Portal-RT Wave 3.1)  
**Compliance:** RDC 978 Art. 128, DICQ 4.1.2.7  

---

## Problem Statement

Responsible Technicians (RTs) require real-time visibility into critical laboratory operations: pending result reviews, critical value escalations, quality issues, and supervisor presence. Current system lacks a dedicated RT dashboard, forcing RTs to navigate generic hub or use separate tools (Slack, email) for notifications.

**Regulatory Drivers:**
- RDC 978 Art. 128: RT is legally responsible for result review + validation
- DICQ 4.1.2.7: Documented supervisor presence and operational oversight required daily
- v1.4 Scope: Enable Portal-RT + Portal-Paciente as twin entry points (RT + Patient)

---

## Decision

Build a **dark-first, real-time Portal-RT dashboard** with the following characteristics:

1. **Architecture:** Firestore-driven with `onSnapshot` listeners for real-time escalation feed
2. **Data Flow:** Cloud Function callables for all mutations (server-side signature + timestamp)
3. **Access Control:** RT + Admin only, role-gated via `hasRole('rt') && isActiveMemberOfLab(labId)`
4. **Failure Mode:** Fail-closed (no escalation read if rules reject, silent error state with retry)
5. **Collections:** 
   - `portal-rt-state/{labId}/dashboards` — Dashboard layout + filters
   - `critical-values/{labId}/escalations` — Escalation queue (append-only until resolved)
   - `portal-rt-audit/{labId}/events` — Audit trail of RT actions

---

## Rationale

### Why Real-Time Firestore Updates?

**Decision:** Firestore `onSnapshot` listeners instead of HTTP polling or REST API.

**Rationale:**
- **Latency:** Sub-second updates (100–500ms typical) vs. 30s polling overhead
- **Regulatory:** RDC 978 Art. 128 requires immediate RT visibility into critical results
- **Cost:** Persistent connection cheaper than polling endpoints every 30s across 100 labs
- **Simplicity:** Zustand store directly reflects Firestore state; no redux/sync overhead

**Trade-off:** Persistent connection requires more memory; mitigated by selective listeners (only active RT on shift sees escalation feed).

### Why Server-Side Writes for Mutations?

**Decision:** All Portal-RT mutations (dashboard update, escalation acknowledge) via Cloud Function callables, never direct Firestore writes.

**Rationale:**
- **Signature:** Every RT action (acknowledge, resolve) gets HMAC signature (ADR-0005) + operatorId + timestamp → immutable audit trail
- **Regulatory:** RDC 978 Art. 128 requires non-repudiation (proof of who reviewed result, when)
- **Atomicity:** Multi-document updates (escalation status + audit entry) via writeBatch on function
- **Validation:** RT role + lab membership re-validated server-side (not just client-side rules check)

**Trade-off:** Higher latency (function invocation ~200ms) vs. direct write (~50ms); acceptable for operational dashboard (not real-time lab instruments).

### Why Fail-Closed?

**Decision:** If Firestore rules reject Portal-RT read, show error state + retry button (not blank escalation list).

**Rationale:**
- **Safety:** RT never sees "empty list" if rules block occurred (false negative = patient safety risk)
- **Audit:** Error state logged with rejection reason
- **UX:** Explicit signal to RT: "something is wrong, contact admin" instead of silent failure

**Example:** Lab member loses RT role while dashboard is open → escalation read fails → error message "You no longer have RT permissions; please refresh" + manual retry button.

### Why Dark-First Design?

**Decision:** Portal-RT uses dark theme (`bg-[#141417]`, white/90 text) by default, not light theme.

**Rationale:**
- **Reference:** Linear, Stripe, GitHub (dark-first operational dashboards)
- **Lab Environment:** Most labs use dark dashboards during operational hours (reduced eye strain, 24/7 operations)
- **Accessibility:** Dark background + white text (9:1 contrast) exceeds WCAG AAA (7:1 required)
- **Brand:** Consistent with v1.4 design system dark-first directive

---

## Implementation

### Collections & Rules

**`portal-rt-state/{labId}/dashboards/{dashboardId}`**
```typescript
interface PortalRTDashboard {
  labId: string;
  dashboardId: string;                    // e.g., "main-dashboard"
  rtId: string;                           // operator UID
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

**Rules:**
- Read: `isActiveMemberOfLab(labId) && hasRole('rt')`
- Create: Cloud Function only
- Update: Cloud Function only
- Delete: Never (soft-delete via callable)

**`critical-values/{labId}/escalations/{escalationId}`**
```typescript
interface CriticalValueEscalation {
  labId: string;
  escalationId: string;
  laudoId: string;
  patientId: string;
  criticidade: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'acknowledged' | 'resolved' | 'delegated';
  assignedTo?: string;
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

**Rules:**
- Read: RT or Admin or Auditor (audit trail access)
- Create: Cloud Function only
- Update: Cloud Function (acknowledge/resolve) only
- Delete: Never (soft-delete only)

**`portal-rt-audit/{labId}/events/{eventId}`**
```typescript
interface PortalRTAuditEvent {
  labId: string;
  eventId: string;
  rtId: string;
  action: 'view' | 'approve' | 'acknowledge' | 'escalate' | 'delegate';
  targetType: 'laudo' | 'escalation' | 'dashboard';
  targetId: string;
  details: Record<string, unknown>;
  hmac: string;                           // ADR-0005 signature
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}
```

**Rules:**
- Read: Auditor only (immutable audit trail)
- Create: Cloud Function only
- Update/Delete: Never

### Cloud Function Callables

**`portal_rt_createDashboard(data)`**
- Input: `{ dashboardId, layout, filters }`
- Output: Dashboard document
- Validation: `hasRole('rt')`, `labId` from request context
- Signature: HMAC on (dashboardId + layout)

**`portal_rt_updateDashboard(data)`**
- Input: `{ dashboardId, filters }`
- Output: Updated dashboard
- Validation: RT is owner of dashboard OR admin
- Signature: HMAC on (dashboardId + filters)

**`critical_acknowledgeEscalation(data)`**
- Input: `{ escalationId, assignedTo? }`
- Output: Updated escalation
- Validation: RT or Admin
- Side-effect: Creates audit entry + marks `notificacao.reconhecida`
- Signature: HMAC on (escalationId + status)

### React Components (Dark-First)

**PortalRTShell.tsx**
- Layout: Sidebar nav + main content area
- Dark theme: `bg-[#141417]` background, `text-white/90`
- Responsive: Sidebar collapses to drawer on mobile

**RtNav.tsx**
- Escalation count badge (updates real-time via `useEscalationFeed`)
- Links to dashboards, escalations, settings
- User menu (profile, logout)

**EscalationList.tsx**
- Real-time feed via `onSnapshot`
- Sort by: `notificacao.enviada` (newest first)
- Filter: `criticidade`, `status`
- Empty state: "No escalations" message + last-check timestamp

**EscalationDetail.tsx**
- Full escalation + related laudo preview
- Actions: Acknowledge, Resolve, Delegate to colleague
- Audit trail: Show prior actions + timestamps

### Hooks

**`usePortalRTNav()`**
- Real-time escalation count
- `pending` status filter
- Unsubscribe on unmount (cleanup leak)

**`useEscalationFeed(filters)`**
- `onSnapshot` query: `status in ['pending', 'acknowledged']`
- Filter: By `criticidade`, `equipamentoId`, date range
- Returns: `[escalations, loading, error]`
- Cleanup: Returns unsubscribe function

**`useDashboardSettings(dashboardId)`**
- Persist filters + layout to Firestore
- Debounce: 1s (prevent every keystroke from writing)

### Tests (12 unit tests)

1. Nav displays correct pending count
2. Escalation feed real-time updates
3. Filter by criticidade works
4. Acknowledge action calls callable
5. Audit trail append on acknowledge
6. Error state on rules rejection
7. Unsubscribe cleanup on unmount
8. Dashboard settings persist
9. Mobile responsive layout
10. Dark theme contrast ≥9:1
11. Retry button on error
12. E2E: Patient critical result → escalation created → RT acknowledges

---

## Alternatives Considered

### 1. HTTP REST API + Polling

**Approach:** Portal-RT polls `/api/escalations?labId=X` every 30s.

**Pros:** Standard HTTP, simpler backend, cache-friendly  
**Cons:** 30s latency (patient safety risk), 24× more API calls per lab per day, higher cost  
**Rejected:** RDC 978 Art. 128 requires immediate visibility.

### 2. WebSocket Push (Real-Time Messaging)

**Approach:** Cloud Pub/Sub → WebSocket gateway → Portal-RT.

**Pros:** Explicit push (no polling), low latency  
**Cons:** Requires WebSocket infrastructure (Firebase Realtime DB OR custom Pub/Sub bridge), higher operational overhead  
**Rejected:** Firestore `onSnapshot` achieves same UX with lower complexity.

### 3. Light-First Design

**Approach:** Portal-RT uses light theme (white background, dark text).

**Pros:** "Professional" appearance, consistent with admin dashboards  
**Cons:** High contrast strain in 24/7 lab environment, doesn't match v1.4 design system  
**Rejected:** Dark-first is brand decision for v1.4.

---

## Dependencies

- **ADR-0005:** HMAC signing on audit entries
- **ADR-0030:** HMAC baseline extension (criticos chain includes portal-rt actions)
- **Firestore Rules:** Helper functions `isActiveMemberOfLab()`, `hasRole(role)`
- **Cloud Functions:** Runtime Node 22+, Firebase Admin SDK 12+

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Firestore listener leak (memory) | High | Return unsubscribe from hook; test cleanup |
| Rules reject RT read (false negative) | High | Fail-closed with error state; explicit retry button |
| Escalation count stale due to cloud lag | Medium | Add "last-updated" timestamp; TTL 5s for manual refresh |
| HMAC signature cost (every acknowledge) | Low | Function cached; signature computed once server-side |

---

## Success Criteria

- [x] Portal-RT loads in <2s (LCP target)
- [x] Escalation feed updates within 500ms of Firestore write
- [x] All RT actions signed with HMAC + operatorId
- [x] 12 unit tests passing
- [x] 4 E2E specs passing (auth, escalation workflow, error handling, rollback)
- [x] Dark theme contrast ≥9:1 (WCAG AAA)
- [x] Mobile responsive (sidebar → drawer)
- [x] Zero regressions in existing modules

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| **Architect** | CTO | 2026-05-08 |
| **Compliance** | Security Lead | 2026-05-08 |
| **QA** | Test Lead | 2026-05-08 |

---

## References

- RDC 978 Art. 128: RT responsibility for results
- DICQ 4.1.2.7: Turnos supervisor documentation
- ADR-0005: HMAC Signing & Non-Repudiation
- ADR-0030: HMAC Baseline Extension to Criticos
- Design System: Dark-first tokens (`bg-[#141417]`, `white/X`)
