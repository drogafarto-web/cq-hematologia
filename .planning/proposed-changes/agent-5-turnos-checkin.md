# Agent 5 — Turnos supervisor presence enforcement

Phase 5 / RDC 978 Art. 122 — adds physical-presence check-in/check-out as an
enforcement primitive on top of the v1.3 designation-only baseline.

## Summary of new artifacts (already committed)

- `functions/src/modules/turnos/supervisorCheckout.ts` — new callable.
  - `supervisorCheckin.ts` already existed in-tree but was NOT exported in
    `functions/src/modules/turnos/index.ts` nor wired in `functions/src/index.ts`.
  - This change wires both into the public surface.
- `src/features/turnos/services/turnosCallables.ts` — adds `callSupervisorCheckin`
  + `callSupervisorCheckout`.
- `src/features/turnos/hooks/useSupervisorPresenca.ts` — read presença/current,
  derive flags, call mutations.
- `src/features/turnos/components/SupervisorPresencaActions.tsx` — Check-in /
  Check-out buttons in dark-first style.
- `src/features/turnos/components/TurnosList.tsx` — adds a "Presença" column.
- `functions/src/modules/turnos/__tests__/supervisorCheckinCheckout.test.ts` —
  unit tests (happy + unauthorized) for both callables.

## Required `functions/src/index.ts` exports (do NOT yet edit — proposal)

In the existing turnos block (around line 191), extend to:

```ts
export {
  turnos_createTurno,
  turnos_updateTurno,
  turnos_softDeleteTurno,
  turnos_backfill90Days,
  turnos_supervisorCheckin,    // NEW — RDC 978 Art. 122 presence check-in
  turnos_supervisorCheckout,   // NEW — RDC 978 Art. 122 presence check-out
  onTurnoEventCreated,
} from './modules/turnos/index';
```

Keep them inside the same comment block. Update header comment to add:

```
//   turnos_supervisorCheckin        — supervisor presencial check-in (RDC 978 Art. 122)
//   turnos_supervisorCheckout       — supervisor presencial check-out (RDC 978 Art. 122)
```

## Required `firestore.rules` additions (do NOT yet edit — proposal)

The existing `/turnos/{turnoId}` block in `firestore.rules` (current line 1772–1789)
already declares `allow create, update, delete: if false` for `turnos` and the
`events/` subcollection. Two new subcollections need rules added inside that
match block:

```firestore
      // ── /turnos — Supervisor Shift Registry (Phase 0 / Plan 00-01) ───────────
      // RDC 978/2025 Art. 122: supervisor presencial por turno.
      // DL-1 applied: client-side writes denied; Admin SDK (callable) only.
      match /turnos/{turnoId} {
        allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
        allow create: if false;  // Via turnos_createTurno callable only (DL-1)
        allow update: if false;  // Via turnos_updateTurno callable only (DL-1)
        allow delete: if false;  // Via turnos_softDeleteTurno callable only (DL-1)

        // Audit trail (append-only, chainHash continuity)
        match /events/{eventId} {
          allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
          allow create: if false;
          allow update: if false;
          allow delete: if false;
        }

        // ── NEW (Phase 5 — RDC 978 Art. 122 presence enforcement) ─────────────
        // Singleton presença doc per turno; written exclusively by
        // turnos_supervisorCheckin / turnos_supervisorCheckout / turnos_designateSubstitute callables.
        match /presenca/{docId} {
          allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
          allow create, update, delete: if false; // Callables only (DL-1)
        }

        // Append-only chain-hashed presence audit trail. Reads are open to
        // active lab members; writes are server-only (callables).
        match /presenca-events/{eventId} {
          allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
          allow create, update, delete: if false; // Callables only (DL-1)
        }
      }
```

And, sibling to `/turnos/`, the lab-wide single-source-of-truth doc
`/labs/{labId}/supervisor-status/current` (read by other modules to gate
runs/laudos writes once Wave 1 lands):

```firestore
      // ── /supervisor-status — Lab-wide active supervisor cache ──────────────
      // RDC 978/2025 Art. 122: hasActiveSupervisor consumed by runs/laudos rules.
      match /supervisor-status/{docId} {
        allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
        allow create, update, delete: if false; // Callables only (DL-1)
      }
```

`validSignature` is intentionally not applied to presença/events because the
HMAC chain is `chainHash` (server-computed) rather than the per-doc
`assinatura: { hash, operatorId, ts }` shape. The chain is bound by the
documents' write being server-only — `if false` for client writes is the
strongest contract we can express in rules.

## Indexes

No composite indexes required for this change. The existing
`presenca-events.timestamp DESC` query is single-field (auto-indexed).

## Deployment order (when ready, separate task)

1. Add the rules block above + deploy `firestore:rules`.
2. Add the index.ts exports above + `cd functions && npm run build` + deploy
   `functions:turnos_supervisorCheckin,turnos_supervisorCheckout`.
3. Deploy hosting.
