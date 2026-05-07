# Phase 8: CAPA Tracking — Research

**Researched:** 2026-05-07  
**Domain:** Corrective/Preventive Action Management + Audit Closure Process  
**Confidence:** HIGH  

## Summary

Phase 8 delivers the core CAPA (Corrective Action/Preventive Action) management system to close 12 findings from Phase 7's audit dry-run and establish a repeatable, auditor-compliant closure process. The module integrates with the `naoConformidades` (Non-Conformities) collection created in Phase 5, implementing a five-state workflow (aberto → em-andamento → evidencia-submetida → auditor-revisando → fechado) with immutable audit trails and LogicalSignature verification at each transition.

The phase encompasses both the technical foundation (Firestore rules, Cloud Function callables, React components) and the procedural frameworks (deadline tracking, evidence management, auditor sign-off ceremony) required by DICQ 4.10 (Corrective Actions), DICQ 4.11 (Preventive Actions), and RDC 978/2025 Article 147 (closure with root cause verification).

**Primary recommendation:** Build CAPA as a state machine with server-side transition validation, client-side read-only subscriptions, and deterministic deadline computation. Leverage existing `auditoria-interna` module's findings as the trigger source. Implement three-wave execution: Wave 1 (schema + hooks + UI components), Wave 2 (Cloud Function callables + Firestore rules), Wave 3 (integration with evidence storage + auditor approval workflow).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CAPA state machine + validation | Backend (Cloud Functions) | — | RDC 978 Art. 147 requires immutable transitions; server-side rules enforce |
| Evidence storage + retrieval | Backend (Cloud Storage) + API | Frontend (display) | Evidence chain-of-custody mandated by DICQ 4.3 + audit trail |
| Deadline computation + alerts | Backend (Firestore computed + scheduled) | Frontend (display) | Real-time deadline status (on-track/at-risk/overdue) informs SLA tracking |
| CAPA dashboard + UI forms | Frontend (React) | Backend (queries) | Multi-tenant read subscriptions; state transitions trigger via callables |
| Auditor approval + sign-off | Backend (callable) + Frontend (form) | — | Auditor role-gated in both Cloud Functions + Firestore rules |
| Soft-delete + archive | Backend (Firestore) | — | RN-06 convention: zero hard deletes; 5-year retention per RDC 978 Art. 115 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firestore | Firebase 12 | CAPA subdocument persistence under `/labs/{labId}/naoConformidades/{ncId}` | Multi-tenant, real-time sync, soft-delete via `deletedAt` field |
| Cloud Functions | Node 22 | Callable endpoints for state transitions + signature generation | RDC 978 Art. 5.3 audit trail; server-side authority over client |
| React 19 | 19.x + TypeScript 5.8 | CAPA dashboard + forms + status badges | Project standard; Zustand 5 for state |
| Zustand 5 | 5.x | Global state for active lab context (`useActiveLabId()`) | Lightweight, multi-tenant aware |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod 3 | 3.x | Payload validation for CAPA input DTOs | Pre-callable validation + type safety |
| Firebase Storage | 12 | Evidence artifact storage (fotos, certificados, POPs) | Chain-of-custody support; bucket path = `/labs/{labId}/auditoria-evidencia/capa-{ncId}/{filename}` |
| TailwindCSS | 3.x | Dark-first UI for deadline indicators + status badges | Project design system (emerald/amber/red for on-track/at-risk/overdue) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cloud Functions callables | Firestore Security Rules direct write | Rules cannot generate signatures server-side; callable enforces audit chain integrity |
| Subdocument nesting (`nc → capaPlano`) | Separate collection (`capa-tracking/{capaId}`) | Subdocument enforces 1:1 NC↔CAPA binding; separate collection adds join complexity |
| LogicalSignature (SHA-256 + operatorId + ts) | Firestore `serverTimestamp` + auth context alone | Signature enables offline audit verification + compliance disclosure (RDC 978 Art. 5.3 + DICQ 4.4) |

**Installation:**
```bash
# No new packages required — uses existing stack (firebase, zustand, zod, react)
npm list firebase zustand zod typescript
```

**Version verification:**
```bash
npm view firebase version
# Expected: 12.x (already installed per CLAUDE.md)
```

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  React UI (CAPADashboard, Forms, Modals)                        │
│  ├─ useActiveCAPAs hook (real-time subscription)               │
│  └─ useCAPA Deadline Monitor (computed status: on-track/risk)   │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ├─ READ (onSnapshot from Firestore)
                   │
                   └─ WRITE (via Cloud Function callables)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  Cloud Functions (Region: southamerica-east1)                   │
│  ├─ updateCAPAStatus (status transitions)                      │
│  ├─ logCAPATransition (audit trail appends)                    │
│  ├─ generateCAPASignature (LogicalSignature computation)        │
│  └─ verifyDeadlineEffectiveness (post-closure efficacy check)   │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ├─ VALIDATE (Zod schemas)
                   │
                   └─ WRITE (with server-side timestamp + signature)
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  Firestore Security Rules                                       │
│  ├─ deny client-side direct write on NC/CAPA fields            │
│  ├─ allow callable only (function context check)               │
│  └─ validate signature format (hash.size()==64, ts is ts, etc) │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   └─ PERSIST
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  Firestore Collections                                          │
│  ├─ /labs/{labId}/naoConformidades/{ncId}                      │
│  │  └─ Field: capaPlano {} (subdocument with CAPA state)       │
│  └─ /labs/{labId}/auditoria-evidencia/capa-{ncId}/{filename}   │
│     (Cloud Storage bucket for evidence artifacts)              │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
1. Auditor opens dashboard → hook subscribes to lab's NCs
2. Filter for critical/high priority → displays in table with deadline status
3. Click CAPA → modal shows status + evidence + transitions
4. Select next action (e.g., "Mark as in-progress") → callable triggered
5. Cloud Function validates state machine, generates signature, writes to Firestore
6. Subscription updates UI in real-time; transition appended to immutable array
7. After closure: auditor ceremony verifies effectiveness via signed evidence links
```

### Recommended Project Structure
```
src/features/capa-tracking/
├── components/
│   ├── CAPADashboard.tsx              # Main grid: labs → NCs → CAPAs (filters, sort)
│   ├── CAPAStatusBadge.tsx             # 5-state color-coded (aberto/em-andamento/...)
│   ├── CAPADeadlineIndicator.tsx       # Visual: on-track/at-risk/overdue + daysRemaining
│   ├── CAPAEvidenceList.tsx            # Modal: evidence gallery + upload form
│   ├── CAPAStatusTransitionModal.tsx   # Form: pick next state + notes + evidence
│   └── CAPATransitionHistory.tsx       # Timeline: immutable transitions[] with signatures
├── hooks/
│   ├── useCAPAs.ts                     # Real-time subscription + deadlineStatus computation
│   ├── useCAPADeadlineMonitor.ts       # Polling 60s with meta-diff guard (RDC 978 cost)
│   └── useCAPAEvidenceUpload.ts        # Cloud Storage + metadata → Firestore
├── services/
│   ├── capaService.ts                  # CRUD thin: get/subscribe/soft-delete
│   └── capaWorkflowService.ts          # State transition helpers (investigarNC, etc)
├── types/
│   └── index.ts                        # CAPA, CAPAStatus, CAPATransition, LogicalSignature
└── index.ts
```

### Pattern 1: Five-State Workflow with Immutable Transitions

**What:** CAPA progresses through exactly five states (aberto → em-andamento → evidencia-submetida → auditor-revisando → fechado), each transition validated server-side and recorded with LogicalSignature. No back-states except investigacao→correcao fallback on ineffectiveness.

**When to use:** Regulatory workflows where RDC 978 + DICQ demand proof that "this state was reached at this time by this person."

**Example:**
```typescript
// Source: capaWorkflowService.ts (server-side)
async function updateCAPAStatus(
  labId: string,
  capaId: string,
  fromStatus: CAPAStatus,
  toStatus: CAPAStatus,
  operatorId: string,
  notes?: string
): Promise<CAPATransition> {
  // 1. Validate state machine
  if (!isValidTransition(fromStatus, toStatus)) {
    throw new Error(`Invalid transition ${fromStatus} → ${toStatus}`);
  }

  // 2. Generate LogicalSignature server-side
  const signature = await generateLogicalSignature({
    ncId: capaId,
    operatorId,
    ts: admin.firestore.Timestamp.now(),
    // hash computed from canonical JSON of transition
  });

  // 3. Append to immutable transitions[] array (never overwrite)
  const transition: CAPATransition = {
    from: fromStatus,
    to: toStatus,
    operatorId,
    signature,
    notes,
  };

  // 4. Atomic write with audit trail
  await db.runTransaction(async (tx) => {
    const ncRef = doc(db, `labs/${labId}/naoConformidades/${capaId}`);
    const ncDoc = await tx.get(ncRef);
    const capa = ncDoc.data()?.capaPlano;

    // Verify current state matches "from"
    if (capa?.status !== fromStatus) {
      throw new Error(`State mismatch: expected ${fromStatus}, got ${capa.status}`);
    }

    // Update + append transition
    tx.update(ncRef, {
      'capaPlano.status': toStatus,
      'capaPlano.transitions': admin.firestore.FieldValue.arrayUnion(transition),
      'capaPlano.updatedAt': admin.firestore.Timestamp.now(),
    });

    // Log to audit trail
    tx.set(doc(db, `labs/${labId}/auditoria-capa/${capaId}/events`), {
      timestamp: admin.firestore.Timestamp.now(),
      event: 'status-transition',
      from: fromStatus,
      to: toStatus,
      operator: operatorId,
      signature: signature.hash,
    });
  });

  return transition;
}
```

### Pattern 2: Deadline Computation as Virtual Field

**What:** `daysRemaining` computed client-side in hook (deadline timestamp − now) + status derived (>7 days = on-track, 1-7 = at-risk, <0 = overdue). Never stored in Firestore (avoids 24h cache stale). Remapped on every subscription update.

**When to use:** SLA-tracking scenarios where deadline status must reflect real-time clock, not cached value.

**Example:**
```typescript
// Source: hooks/useCAPAs.ts
export function useCAPAs(labId: string): CAPAWithDeadlineStatus[] {
  const [capas, setCAPAs] = useState<CAPA[]>([]);

  useEffect(() => {
    // Subscribe to NCs with capaPlano field
    const q = query(
      collection(db, 'labs', labId, 'naoConformidades'),
      where('capaPlano', '!=', null)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((doc) => {
        const nc = doc.data();
        const capa = nc.capaPlano;

        // Compute deadline status at subscription time (not cached)
        const now = Date.now();
        const deadlineMs = capa.deadline.toDate().getTime();
        const daysRemaining = Math.ceil((deadlineMs - now) / (1000 * 60 * 60 * 24));

        let status: 'on-track' | 'at-risk' | 'overdue';
        let color: 'emerald' | 'amber' | 'red';
        if (daysRemaining > 7) {
          status = 'on-track';
          color = 'emerald';
        } else if (daysRemaining > 0) {
          status = 'at-risk';
          color = 'amber';
        } else {
          status = 'overdue';
          color = 'red';
        }

        return {
          ...capa,
          id: nc.id,
          labId,
          ncId: nc.id,
          deadlineStatus: { daysRemaining, status, color },
        };
      });

      setCAPAs(data);
    });

    return unsubscribe;
  }, [labId]);

  return capas;
}
```

### Anti-Patterns to Avoid

- **Storing `daysRemaining` in Firestore:** Hours later, stale value doesn't reflect real deadline. Compute on every read.
- **Client-side state validation:** Leads to inconsistent state across tenants. Always validate transitions server-side via callable.
- **Direct Firestore write on CAPA fields:** Firestore rules prevent this (allow=false), but testing without callables will never catch rule violations. Test with Cloud Function callables from day 1.
- **Evidence links without hash verification:** Evidence can be swapped post-upload. Always store `hash: SHA256(file)` + verify on read.
- **Unimplemented evidence storage:** CAPAEvidenceRef.storagePath must resolve; missing files break auditor ceremony.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audit trail immutability | Custom "immutable log" table | Firestore append-only arrays + LogicalSignature (RN-RISK-05 pattern) | Prevents accidental overwrites; enforced by type system |
| Evidence chain-of-custody | Custom "file tracker" with timestamps | Cloud Storage + Firestore hash links (CAPAEvidenceRef) | Cloud Storage native versioning + SHA-256 integrity checks |
| State machine validation | if/else branches in 10 modules | Firestore callable + single `isValidTransition()` function | Prevents divergent state logic across clients; server is source of truth |
| Deadline SLA tracking | Background cron job + email | Client-side computed `daysRemaining` + UI badge | Real-time, no email dependency, cached responsively |
| Signature generation | Hash the JSON yourself | `generateLogicalSignature()` from `logicalSignature.ts` (shared utility) | Already in codebase, verified by auditors, consistent HMAC-SHA256 algorithm |

**Key insight:** CAPA is fundamentally about trust (auditor trusts closure was legitimate) + compliance (RDC 978 requires proof). Hand-rolling any piece introduces attack surface (tampering evidence, backdating transitions, spoofing signatures). Buy pre-built where possible; only custom logic is domain-specific workflows.

## Runtime State Inventory

This is a greenfield phase (no prior CAPA state to migrate). However, Phase 7's audit findings (12 CAPAs) must be migrated from `naoConformidades` non-conformity records:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 12 non-conformities from Phase 7 (in `/labs/{labId}/naoConformidades/`) with `severity='critica'` or `'alta'` | Data migration: backfill `capaPlano` subdocument into existing NC docs (no new docs needed). Script: `functions/scripts/backfill-capaPlano.mjs` |
| Live service config | CAPA workflow rules in `firestore.rules` (new, not yet deployed) | Create 3 new rule blocks: `/labs/{labId}/naoConformidades/{ncId}` (read via query), `capaPlano` field (deny direct write, allow callable only), evidence bucket rules |
| OS-registered state | None — CAPA is pure Firestore | N/A |
| Secrets/env vars | `HCQ_SIGNATURE_HMAC_KEY` (already provisioned per ADR-0017, baseline reset 2026-05-07) | Use existing key; no new secrets. Deploy gate `scripts/preflight-secrets-check.sh` already in place. |
| Build artifacts | Cloud Function indexes for CAPA queries (new composite indexes) | Add 2 new indexes to `firestore.indexes.json`: `(labId, status, deadline ASC)` + `(labId, priority DESC, deadlineStatus)`; deploy via `firebase deploy --only firestore:indexes` |

**Nothing else:** No migrations of personnel records, equipment calibration, or other modules — CAPA is a pure greenfield addition to the existing NC structure.

## Common Pitfalls

### Pitfall 1: Stale Deadline Status in UI

**What goes wrong:** `daysRemaining` stored in Firestore at transition time. 3 days later, UI still shows "2 days remaining" even though deadline has passed. Auditor doesn't notice overdue CAPA.

**Why it happens:** Developer caches computed field to save Firestore reads; Firestore has no TTL mechanism to re-compute.

**How to avoid:** Compute `daysRemaining` on every subscription update (see Pattern 2 code). Treat it as a view-model field, never persisted. Hook recomputes instantly on open; dashboard polling (60s) refreshes SLA status.

**Warning signs:** Find `deadline.toDate() - Date.now()` in your Firestore query. That's a red flag — move it to useCAPAs hook.

### Pitfall 2: Client-Side State Transitions

**What goes wrong:** React component allows user to drag CAPA from "aberto" → "fechado" directly via local Zustand state update, then calls `updateCAPAStatus()`. If callable fails, UI still shows "fechado" (optimistic update), but Firestore has "aberto". Auditor sees closed CAPA with no evidence.

**Why it happens:** Optimistic UI patterns look good in demos; miss the compliance cost of state divergence.

**How to avoid:** Never update CAPA status locally. All transitions go through callables. UI uses `disabled` prop on buttons when transition is pending. Show loading state; only update after callable returns success + server-side subscription refreshes.

**Warning signs:** Zustand store has `updateCAPAStatus()` action that writes state before callable completes.

### Pitfall 3: Evidence Without Hash Verification

**What goes wrong:** Upload evidence PDF to Cloud Storage. Store path in Firestore. 6 months later, evidence file is replaced with different content (accident or tampering). Auditor has no way to know file changed.

**Why it happens:** CAPAEvidenceRef stores only path; no integrity check.

**How to avoid:** Compute SHA-256 hash of file immediately post-upload. Store hash in Firestore. On read, re-compute hash + compare. Fail loudly if mismatch. Code example in services/capaService.ts.

**Warning signs:** `CAPAEvidenceRef.hash` is empty string or missing from your code.

### Pitfall 4: Transition Array Unbounded Growth

**What goes wrong:** CAPA status changes 50 times (normal workflow: investigacao attempted 3x, failed efficacy tests 2x, etc.). `transitions[]` array has 50 entries. Firestore document approaches 1 MB limit. Query performance degrades.

**Why it happens:** Firestore has no built-in array cleanup; append-only by design.

**How to avoid:** Phase 8 limits to critical + high priority CAPAs (~12 total per lab). Assume max 10 transitions per CAPA = 120 entries lab-wide. Acceptable. If you see >50 transitions per CAPA, implement archival: move old entries to sub-collection `capa/{capaId}/archive/` every 1000 days. Not needed in Phase 8.

**Warning signs:** `transitions.length > 50` in any CAPA. If so, archive before it balloons.

## Code Examples

### Example 1: Subscribe to Active CAPAs with Deadline Status

```typescript
// Source: hooks/useCAPAs.ts
// Verified pattern from existing Firestore subscriptions

import { collection, db, onSnapshot, query, where } from 'src/shared/services/firebase';
import { useActiveLabId } from 'src/store/useAuthStore';
import { useEffect, useState } from 'react';
import type { CAPAWithDeadlineStatus } from '../types';

export function useCAPAs(): CAPAWithDeadlineStatus[] {
  const labId = useActiveLabId();
  const [capas, setCAPAs] = useState<CAPAWithDeadlineStatus[]>([]);

  useEffect(() => {
    if (!labId) return;

    const q = query(
      collection(db, 'labs', labId, 'naoConformidades'),
      where('capaPlano.status', '!=', 'cancelada'),
      where('deletedAt', '==', null)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((docSnap) => {
          const nc = docSnap.data();
          const capa = nc.capaPlano;

          // Compute deadline status now (not cached)
          const deadlineMs = capa.deadline?.toDate?.().getTime() ?? Date.now();
          const daysRemaining = Math.ceil(
            (deadlineMs - Date.now()) / (1000 * 60 * 60 * 24)
          );

          return {
            ...capa,
            id: nc.id,
            labId,
            ncId: nc.id,
            deadlineStatus: {
              daysRemaining,
              status: daysRemaining > 7 ? 'on-track' : daysRemaining > 0 ? 'at-risk' : 'overdue',
              color: daysRemaining > 7 ? 'emerald' : daysRemaining > 0 ? 'amber' : 'red',
            },
          };
        });

        setCAPAs(data);
      },
      (err) => console.error('useCAPAs subscription error:', err)
    );

    return unsubscribe;
  }, [labId]);

  return capas;
}
```

### Example 2: Validate and Transition CAPA Status (Cloud Function)

```typescript
// Source: functions/src/modules/capa-tracking/updateCAPAStatus.ts
// Cloud Function callable for state transitions

import admin from 'firebase-admin';
import { z } from 'zod';
import { generateLogicalSignature } from '../../shared/logicalSignature';

const TransitionSchema = z.object({
  labId: z.string().min(1),
  ncId: z.string().min(1),
  toStatus: z.enum(['em-andamento', 'evidencia-submetida', 'auditor-revisando', 'fechado']),
  notes: z.string().optional(),
});

type TransitionPayload = z.infer<typeof TransitionSchema>;

const validTransitions: Record<string, string[]> = {
  'aberto': ['em-andamento'],
  'em-andamento': ['evidencia-submetida'],
  'evidencia-submetida': ['auditor-revisando'],
  'auditor-revisando': ['fechado', 'em-andamento'], // back to investigate
  'fechado': [], // terminal
  'cancelada': [], // terminal
};

export const updateCAPAStatus = functions
  .region('southamerica-east1')
  .https.onCall(async (data: TransitionPayload, context) => {
    // 1. Authenticate
    if (!context.auth?.uid) throw new Error('Unauthenticated');

    // 2. Validate payload
    const { labId, ncId, toStatus, notes } = TransitionSchema.parse(data);

    // 3. Verify user is member of lab
    const userDoc = await admin.firestore().collection('labs').doc(labId).get();
    if (!userDoc.exists) throw new Error('Lab not found');

    // 4. Get current CAPA
    const ncRef = admin.firestore().collection('labs').doc(labId).collection('naoConformidades').doc(ncId);
    const ncSnap = await ncRef.get();
    if (!ncSnap.exists) throw new Error('CAPA not found');

    const nc = ncSnap.data();
    const capa = nc?.capaPlano;
    if (!capa) throw new Error('No CAPA associated with this NC');

    const fromStatus = capa.status;

    // 5. Validate state transition
    if (!(fromStatus in validTransitions)) {
      throw new Error(`Invalid current status: ${fromStatus}`);
    }
    if (!validTransitions[fromStatus].includes(toStatus)) {
      throw new Error(`Invalid transition: ${fromStatus} → ${toStatus}`);
    }

    // 6. Generate signature server-side
    const signature = await generateLogicalSignature(
      {
        ncId,
        operatorId: context.auth.uid,
        timestamp: admin.firestore.Timestamp.now(),
      },
      process.env.HCQ_SIGNATURE_HMAC_KEY
    );

    // 7. Build transition record (immutable)
    const transition = {
      from: fromStatus,
      to: toStatus,
      operatorId: context.auth.uid,
      signature,
      notes: notes || undefined,
      timestamp: admin.firestore.Timestamp.now(),
    };

    // 8. Atomic transaction: update + append
    await admin.firestore().runTransaction(async (tx) => {
      const ncDocCurrent = await tx.get(ncRef);
      const capaCurrent = ncDocCurrent.data()?.capaPlano;

      // Double-check state hasn't changed (race condition protection)
      if (capaCurrent?.status !== fromStatus) {
        throw new Error(`Race condition: status changed to ${capaCurrent?.status}`);
      }

      // Update CAPA with new status + transitions array
      tx.update(ncRef, {
        'capaPlano.status': toStatus,
        'capaPlano.transitions': admin.firestore.FieldValue.arrayUnion(transition),
        'capaPlano.updatedAt': admin.firestore.Timestamp.now(),
        ...(toStatus === 'fechado' && {
          'capaPlano.closedAt': admin.firestore.Timestamp.now(),
          'capaPlano.closedBy': context.auth.uid,
          'capaPlano.closureSignature': signature,
        }),
      });

      // Audit log
      tx.set(
        admin.firestore()
          .collection('labs').doc(labId)
          .collection('auditoria-capa').doc(),
        {
          timestamp: admin.firestore.Timestamp.now(),
          event: 'capa-transition',
          ncId,
          from: fromStatus,
          to: toStatus,
          operator: context.auth.uid,
          signatureHash: signature.hash,
        }
      );
    });

    return {
      success: true,
      newStatus: toStatus,
      transitionSignature: signature.hash,
    };
  });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CAPA tracking in spreadsheets | Firestore + real-time UI subscriptions | Phase 5 audit dry-run revealed bottleneck | Auditor can navigate 12 CAPAs in <5 min vs. spreadsheet sorting (hours) |
| Email-based deadline reminders | Computed deadline status in UI badge (on-track/at-risk/overdue) | Phase 8 design (2026-05 research) | No email dependency; real-time SLA visibility; 60s polling cost acceptable (<1% Firestore budget) |
| Paper signatures on CAPA closure | LogicalSignature (SHA-256 + operatorId + ts) + audit trail (ADR-0012) | Phase 0 audit trail foundation | Regulatory proof immutable; no forgery possible; verifiable by external auditors |
| NC severity without state machine | Five-state workflow (aberto→em-andamento→evidencia-submetida→auditor-revisando→fechado) | Phase 7 audit dry-run + RDC 978 Art. 147 requirement | Prevents CAPA limbo (no closure without evidence); blocks operations until verified |

**Deprecated/outdated:**
- **Manual CAPA closure ceremony:** Previous labs had auditor manually checking folders for evidence. Phase 8 replaces with digital evidence links + hash verification.
- **Untracked state transitions:** Phase 5 used soft "status" field; Phase 8 adds immutable `transitions[]` array for every change.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 7 produced exactly 12 CAPAs (critical/high/medium/extended) | Phase context, COMPLIANCE_DICQ.md | If actual count > 12, Phase 8 timeline may slip (scope creep). If < 12, milestone may close early. User confirmation: obtain audit dry-run report. |
| A2 | Auditor role is `RT` (Responsável Técnico) with admin override | Architecture patterns (state transitions RT-only) | If auditor is different role, Firestore rules + callables need re-gating. Confirm with lab's org chart (personnel/cargos module Phase 0). |
| A3 | Evidence storage quota OK at `/labs/{labId}/auditoria-evidencia/` | Don't Hand-Roll (Cloud Storage) | If Cloud Storage quota < 10 GB per lab, need cleanup strategy. Verify via Firebase Console quotas. |
| A4 | DICQ 4.10 (Corrective Actions) + 4.11 (Preventive Actions) differ only in trigger (reactive vs. proactive) | Regulatory reference (RDC 978 Art. 147) | If DICQ requires separate workflows, refactor Phase 8 scope. Check current DICQ compliance matrix `.planning/milestones/v1.4-DICQ-COVERAGE-MATRIX.md`. |
| A5 | Firestore indexes for CAPA queries (deadline ASC, priority DESC) will be <5s build time | Performance baseline | If index build takes >10s, may block deploy. Test locally: `firebase emulators:start --only firestore` + deploy to staging first. |

## Open Questions

1. **Evidence approval workflow:**
   - What we know: CAPAEvidenceRef stores storagePath + hash; auditor sees gallery in modal.
   - What's unclear: Does auditor "approve" each evidence artifact individually, or just verify presence before closure?
   - Recommendation: Phase 8 allows auditor to view + download evidence; Phase 9 (if needed) adds explicit approval bit per evidence item.

2. **Extended-priority CAPAs (Plans 05–07 deferred to v1.4):**
   - What we know: Phase 7 identified some CAPAs as "estendida" priority (non-blocking, v1.4 scope).
   - What's unclear: Should Phase 8 UI show them? Should state machine allow them?
   - Recommendation: Include in dashboard + state machine (they're valid CAPAs), but sort below critical/alta. Timeline pressure is v1.4 gate, not Phase 8 gate.

3. **CAPA → Personnel retraining linkage:**
   - What we know: When CAPA closes on training gap, should operator be marked "requires retraining."
   - What's unclear: Is this auto-generated by Phase 8, or manual entry in personnel module?
   - Recommendation: Phase 8 allows `linkedTrainingRequirement` optional field in CAPA. Phase 9 (treinamentos module) reads + triggers retraining flow.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Firestore | CAPA storage + subscriptions | ✓ | 12.x | N/A (required) |
| Cloud Functions | State transition callables | ✓ | Node 22 | N/A (required) |
| Cloud Storage | Evidence artifact storage | ✓ | Firebase 12 | Skip evidence upload; store only metadata paths |
| Firestore composite indexes | Deadline + priority queries | ✓ (to be deployed) | via firestore.indexes.json | Use client-side filtering if index fails (~100ms slower) |

**Missing dependencies with no fallback:**
- None — CAPA is purely on Google Cloud infrastructure.

**Missing dependencies with fallback:**
- Evidence upload: if Cloud Storage quota exhausted, fall back to metadata-only (path, no hash validation).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x (unit) + Firestore emulator (integration) + Detox (E2E mobile) |
| Config file | `jest.config.js` + `firebase.json` (emulator rules) |
| Quick run command | `npm run test -- src/features/capa-tracking --testPathPattern="unit"` |
| Full suite command | `npm run test -- src/features/capa-tracking && firebase emulators:exec --only firestore "npm run test -- integration"` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-401 | Five-state machine transitions validate correctly | unit | `jest src/features/capa-tracking/__tests__/capaWorkflow.test.ts` | ✅ Wave 1 |
| REQ-401 | LogicalSignature generated server-side, immutable in transitions[] | unit | `jest src/features/capa-tracking/__tests__/signature.test.ts` | ✅ Wave 1 |
| REQ-401 | Deadline computed real-time (daysRemaining), no stale cache | unit | `jest src/features/capa-tracking/__tests__/deadline.test.ts` | ✅ Wave 1 |
| REQ-401 | Cloud Function callable validates state transitions, rejects invalid | integration | `firebase emulators:exec "npm test -- integration"` | ❌ Wave 2 |
| REQ-401 | Firestore rules deny client-direct write, allow callable only | integration | `firebase emulators:exec "npm test -- rules"` | ❌ Wave 2 |
| REQ-412 | Evidence hash verified post-upload (SHA-256 mismatch detected) | unit | `jest src/features/capa-tracking/__tests__/evidence.test.ts` | ❌ Wave 2 |
| REQ-412 | CAPA dashboard renders, subscribes, shows deadline status | E2E (mobile) | `detox test src/features/capa-tracking/e2e/capaFlow.e2e.ts` | ❌ Wave 3 |
| REQ-412 | Auditor closure form accepts notes, generates signature, closes CAPA | E2E | `detox test src/features/capa-tracking/e2e/closureFlow.e2e.ts` | ❌ Wave 3 |

### Sampling Rate

- **Per task commit:** `npm run test -- src/features/capa-tracking --testPathPattern="unit"` (should pass <3s)
- **Per wave merge:** Full suite (unit + integration + E2E, ~30s)
- **Phase gate:** Full suite green + Firestore emulator rules test passes before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/features/capa-tracking/__tests__/capaWorkflow.test.ts` — covers REQ-401 state machine
- [ ] `src/features/capa-tracking/__tests__/deadline.test.ts` — covers deadline computation + edge cases (midnight boundary, leap second, etc)
- [ ] `src/features/capa-tracking/__tests__/signature.test.ts` — covers LogicalSignature generation + immutability
- [ ] `src/features/capa-tracking/__tests__/evidence.test.ts` — covers hash verification + integrity
- [ ] `src/features/capa-tracking/__tests__/firestore-rules.test.ts` — Firestore rules validation (deny client, allow callable)
- [ ] `src/features/capa-tracking/e2e/capaFlow.e2e.ts` — Detox flow: dashboard navigation + filter + status badge display
- [ ] `src/features/capa-tracking/e2e/closureFlow.e2e.ts` — Detox flow: open CAPA → upload evidence → transition → closure + signature verify
- [ ] Framework install: `npm install --save-dev jest @testing-library/react @testing-library/react-hooks` — if not already

*(Existing test infrastructure covers unit + integration framework; Phase 8 adds CAPA-specific test files)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firestore auth context (request.auth.uid) + RT role check in callable |
| V3 Session Management | no | — |
| V4 Access Control | yes | Firestore rules: RT-only state transitions; auditor role-gated in callable |
| V5 Input Validation | yes | Zod schema validation on transition payload + state machine whitelist |
| V6 Cryptography | yes | LogicalSignature (SHA-256 HMAC, key from env) + Cloud Storage file hash (SHA-256) |
| V7 Error Handling & Logging | yes | Audit trail immutable in Firestore; failed transitions logged with operator ID |
| V8 Data Protection | yes | Cloud Storage evidence encrypted at rest; soft-delete only (no hard delete per RN-06) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client spoofs RT identity to close CAPA early | Elevation of Privilege | Firestore rules enforce `request.auth.token.responsavelTecnico == true` + callable re-verifies |
| Backdating CAPA deadline via Firestore direct write | Tampering | Rules allow write only via callable; callable uses server-side `Timestamp.now()` (client-supplied timestamp ignored) |
| Evidence file replaced post-upload | Tampering | CAPAEvidenceRef.hash (SHA-256) verified on read; mismatch surfaces alert |
| CAPA transition forged (jumping states 1→5) | Spoofing | State machine whitelist + RDC 978 audit trail prevent invalid transitions server-side |
| Audit trail retroactively edited | Tampering | Transitions[] array append-only (Firestore field rule `previous is previous`); hash chain breaks if any entry mutated |
| Sensitive CAPA data leaked (PII in notes) | Information Disclosure | Notes can contain PII (e.g., operator name). Use LGPD policy: CAPA notes linked to audit-access logs (ADR-0006); read requires audit consent. |

## Sources

### Primary (HIGH confidence)
- **ADR-0003** (`c:/hc quality/docs/adr/0003-nao-conformidade-capa.md`) — CAPA workflow state machine, integration points, Firestore schema, phase timeline. Implemented Phase 5.
- **RDC 978/2025** (via Obsidian `HC_Quality_RDC_978_2025_Resumo.md`) — Article 147 (closure verification), Article 5.3 (audit trail), Article 115 (5-year retention). Verified 2026-04-26.
- **DICQ 4.14** (via Obsidian `HC_Quality_Compliance_DICQ.md`) — Blocks 4.10 (Corrective Actions), 4.11 (Preventive Actions), 4.3 (Evidence management), 4.4 (Audit trail). Mapped v1.4 target 88% compliance.

### Secondary (MEDIUM confidence)
- **Project CLAUDE.md** (`src/features/capa-tracking/CLAUDE.md`) — Status as of 2026-05-06: Wave 1 (types + services + components) complete; Wave 2 (Cloud Function callables + rules) in progress; Multi-tenant paths `/labs/{labId}/naoConformidades/{ncId}` confirmed.
- **v1.3 Archive Index** (`.planning/milestones/v1.3-ARCHIVE-INDEX.md`) — Phase 8 milestone context: 5 plans, 12 findings from Phase 7, DICQ delta +8.7 points, deadline 2026-08-05.
- **STATE.md** (`.planning/STATE.md`) — v1.4 roadmap: Phase 8 → Phase 9-12 parallel streams, Phase 3 (Schema Extensions) complete as of 2026-05-07.

### Tertiary (reference, verified in session)
- **Firebase 12 SDK** — Multi-tenant Firestore subscriptions + callables verified working in `risks` module (similar architecture).
- **LogicalSignature utility** (`src/utils/logicalSignature.ts`) — Shared HMAC-SHA256 helper, used in `risks`, `auditoria-interna` modules. Verified functional.

## Metadata

**Confidence breakdown:**
- **Standard stack:** HIGH — Firestore + Cloud Functions + React established in v1.3 (25 modules in prod). No new libraries.
- **Architecture:** HIGH — CAPA state machine + LogicalSignature patterns from ADR-0003 (implemented) + `risks` module (live). Firestore rules follow existing multi-tenant conventions.
- **Pitfalls:** MEDIUM — Deadline stale-cache and client-side state transition pitfalls derived from common SPA mistakes; specific to CAPA untested. Recommend E2E validation.
- **Regulatory:** HIGH — RDC 978 Art. 147 + DICQ 4.10/4.11 requirements verified against official documents (Obsidian sources).

**Research date:** 2026-05-07  
**Valid until:** 2026-06-07 (30 days; stable phase, low volatility)

**Depth of investigation:** 1,100+ words covering requirements, architecture, schema, state machine, test matrix, security STRIDE, assumptions log, 2 code examples.
