---
macro_phase: MP-4
phase_label: Phase 10 — Critical Values State Machine + Escalation SLA
total_subagents: 6
waves: 2
parallel: true
autonomous: true
human_gates: 0
worker_model: claude-haiku-4-5-20251001
estimated_runtime: 1h
depends_on: [MP-3]
---

# MP-4 — Phase 10 Critical Values FSM

**Goal:** Formalize the lifecycle of a critical value as a finite-state machine (NORMAL → CRITICO → ALERTADO → RESOLVIDO) with strict transition rules, immutable post-CRITICO audit trail, configurable per-lab thresholds, an escalation SLA enforced by cron, and an operator-facing UI panel.
**Dependencies:** MP-3 (`escalateCritico` and routing service exist).
**Output:**

- New module `src/features/criticos-fsm/` with types, service, config
- 1 callable + 1 cron in `functions/src/modules/criticos-fsm/`
- 1 UI panel
- 1 test file with 30+ tests

**Relationship to MP-3 Críticos module:** MP-3's `criticos` module is detection-focused (threshold + routing + escalation channels). MP-4's `criticos-fsm` is workflow-focused (state machine + audit trail). They co-exist; the detection trigger from MP-3 produces the initial alert that MP-4's FSM ingests as `NORMAL → CRITICO`.

---

## Wave MP-4-W1 — FSM Core (3 SAs ‖)

---

### SA-37 — `src/features/criticos-fsm/types/index.ts`

**Path:** `src/features/criticos-fsm/types/index.ts`
**LOC target:** ~140
**Depends on:** none (W1)

**Contract:**

```typescript
export type CriticoFSMState = 'NORMAL' | 'CRITICO' | 'ALERTADO' | 'RESOLVIDO';

export type CriticoTransitionEvent =
  | { type: 'detect'; detectedAt: number; valor: number; analitoId: string }
  | { type: 'alert'; alertedAt: number; channelsDelivered: string[] }
  | { type: 'acknowledge'; acknowledgedAt: number; userId: string; comment: string }
  | { type: 'resolve'; resolvedAt: number; userId: string; resolution: string };

export interface LogicalSignature {
  hash: string;
  operatorId: string;
  ts: number;
}

export interface FSMTransitionRecord {
  from: CriticoFSMState;
  to: CriticoFSMState;
  at: number;
  event: CriticoTransitionEvent;
  operatorId: string;
  signature: LogicalSignature;
  immutable: boolean; // true once written for any state >= CRITICO
}

export interface CriticoCase {
  id: string;
  labId: string;
  resultId: string;
  analitoId: string;
  currentState: CriticoFSMState;
  history: FSMTransitionRecord[]; // append-only post-CRITICO
  detectedAt: number;
  resolvedAt: number | null;
  slaTargetMs: number; // typically 5 * 60_000
  slaBreached: boolean;
  criadoEm: number;
  criadoPor: string;
  deletadoEm?: number;
}

export function isValidStateTransition(from: CriticoFSMState, to: CriticoFSMState): boolean;

export function getNextState(
  from: CriticoFSMState,
  event: CriticoTransitionEvent,
): CriticoFSMState | null;

export function isTerminalState(s: CriticoFSMState): boolean;
```

**FSM rules:**

- `NORMAL → CRITICO` on `detect`
- `CRITICO → ALERTADO` on `alert`
- `ALERTADO → RESOLVIDO` on `acknowledge` (single-step model: ack also resolves) OR `ALERTADO → ALERTADO` on `acknowledge` then `→ RESOLVIDO` on `resolve` (two-step model). **Choose two-step.** The `acknowledge` event is allowed but stays in `ALERTADO`. `resolve` moves to `RESOLVIDO`.
- `RESOLVIDO` is terminal — `isTerminalState('RESOLVIDO') === true`.
- `NORMAL` is also terminal in the sense that the case lives in CRITICO/ALERTADO/RESOLVIDO once detected; a fresh NORMAL never transitions back.
- Any transition not enumerated above → `isValidStateTransition` returns `false`.

**Invariants:**

- Pure types + pure helpers. No imports.
- Determinism: `getNextState` is a total function over (state, event) pairs returning either a state or `null`.

**Files to read first:**

- `src/features/capa-tracking/types/index.ts` (canonical FSM pattern)
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-4-W1-SA-37): criticos-fsm types — 4-state FSM + transition records`

---

### SA-38 — `criticosFSMService.ts`

**Path:** `src/features/criticos-fsm/services/criticosFSMService.ts`
**LOC target:** ~220
**Depends on:** SA-37 (types)

**Contract:**

```typescript
import type {
  CriticoCase,
  CriticoTransitionEvent,
  FSMTransitionRecord,
  CriticoFSMState,
} from '../types';

export async function createCase(
  labId: string,
  input: {
    resultId: string;
    analitoId: string;
    valor: number;
    detectedAt: number;
    slaTargetMs?: number;
  },
): Promise<string>; // returns caseId

export async function transition(
  labId: string,
  caseId: string,
  event: CriticoTransitionEvent,
): Promise<{ newState: CriticoFSMState; record: FSMTransitionRecord }>;

export function subscribeCase(
  labId: string,
  caseId: string,
  callback: (c: CriticoCase | null) => void,
  onError?: (err: Error) => void,
): () => void; // unsubscribe

export async function softDeleteCase(labId: string, caseId: string): Promise<void>;

export async function listCases(
  labId: string,
  filter?: { state?: CriticoFSMState; from?: number; to?: number },
): Promise<CriticoCase[]>;
```

**Behavior:**

- Storage path: `/labs/{labId}/criticos-fsm-cases/{caseId}`. Sub-collection `/history/{recordId}` for transitions (preserves total ordering even if cases doc is large).
- `transition`:
  1. `runTransaction` over the case doc.
  2. Validate `isValidStateTransition(case.currentState, getNextState(case.currentState, event))`.
  3. If invalid, throw `Error('Invalid transition: <from> -> <to> for event <type>')`.
  4. Append a `FSMTransitionRecord` with `immutable: true` if (from or to) is in {CRITICO, ALERTADO, RESOLVIDO}.
  5. Update `currentState`, `history` array (cap at 50 in-doc; older items live in `/history` subcollection).
  6. Compute SLA breach: if `from === CRITICO` and `to === ALERTADO` and `event.alertedAt - case.detectedAt > slaTargetMs`, set `slaBreached: true`.
- `subscribeCase` uses `onSnapshot`; cleanup returned via the unsubscribe callback.
- `listCases` is paginated client-side after `getDocs` (≤500 docs/lab assumption).
- `softDeleteCase` sets `deletadoEm = Date.now()` — but only allowed if `currentState === 'NORMAL'` (cannot soft-delete an active or resolved CRITICO).

**Multi-tenant invariant:**

- Every `setDoc`, `updateDoc`, query path scoped under `/labs/{labId}/`.
- `labId` written as a redundant field on every write.

**Immutability invariant:**

- Once `currentState >= CRITICO`, `history[]` is append-only — `transition` must never overwrite an existing entry.

**Files to read first:**

- `src/features/capa-tracking/services/` (canonical service)
- `src/features/criticos/services/thresholdService.ts`
- `.claude/rules/firestore-security.md`
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-4-W1-SA-38): criticosFSMService — transactional transitions + append-only history`

---

### SA-39 — `thresholdsConfig.ts`

**Path:** `src/features/criticos-fsm/config/thresholdsConfig.ts`
**LOC target:** ~140
**Depends on:** SA-37 (types)

**Contract:**

```typescript
export interface FSMThresholdConfig {
  labId: string;
  slaTargetMs: number; // default 5*60_000
  autoEscalateAfterMs: number; // default 10*60_000 (cron escalation cap)
  perAnalito?: Record<
    string,
    {
      slaTargetMs?: number;
      autoEscalateAfterMs?: number;
    }
  >;
}

export const DEFAULT_FSM_THRESHOLD_CONFIG: FSMThresholdConfig;

export async function getFSMConfig(labId: string): Promise<FSMThresholdConfig>;

export async function setFSMConfig(
  labId: string,
  patch: Partial<Omit<FSMThresholdConfig, 'labId'>>,
): Promise<void>;

export function resolveSLA(
  config: FSMThresholdConfig,
  analitoId: string,
): { slaTargetMs: number; autoEscalateAfterMs: number };
```

**Behavior:**

- `DEFAULT_FSM_THRESHOLD_CONFIG = { labId: '__default__', slaTargetMs: 5*60_000, autoEscalateAfterMs: 10*60_000 }`.
- `getFSMConfig` reads `/labs/{labId}/fsm-config/main`. If missing, returns merged with default.
- `setFSMConfig` writes via `setDoc(..., { merge: true })`. Validation: numbers must be positive integers ≤ 24h.
- `resolveSLA` checks `perAnalito[analitoId]` first, then base config, then defaults.

**Invariants:**

- Pure config + a thin Firestore wrapper. No business logic.

**Files to read first:**

- `src/features/criticos/services/thresholdService.ts`
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-4-W1-SA-39): FSM thresholds config — per-lab + per-analito SLA overrides`

---

## Wave MP-4-W2 — Escalation + UI + Tests (3 SAs ‖)

---

### SA-40 — `escalacaoSLA.ts` (callable + scheduled cron)

**Path:** `functions/src/modules/criticos-fsm/escalacaoSLA.ts`
**LOC target:** ~200
**Depends on:** SA-38 (service shape mirrored), SA-39 (config)

**Contract:**

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Callable — manual trigger or invoked by criticoDetector
export const fsmEscalacao = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_FROM_NUMBER',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
    ],
  },
  async (request) => {
    // input: { labId, caseId }
    // returns: { delivered: string[], elapsedMs: number, slaBreached: boolean }
  },
);

// Cron — runs every minute, scans active CRITICO/ALERTADO cases past SLA
export const fsmEscalacaoSweep = onSchedule(
  { schedule: '* * * * *', timeZone: 'America/Sao_Paulo', region: 'southamerica-east1' },
  async () => {
    /* enumerate all labs, all cases in CRITICO/ALERTADO past SLA, escalate */
  },
);
```

**Behavior — `fsmEscalacao` (callable):**

1. Auth + lab membership.
2. Read case via `criticosFSMService.transition` style — direct firestore read here, since this is server-side.
3. If `currentState !== 'CRITICO'`, no-op return.
4. Resolve channels — duplicate the small fallback table from `criticosRoutingService` here (server-side; cross-package import not configured). Same channels: SMS → email → in-app.
5. For `severity === 'panic'` cases (read from `case.history[0].event.valor` against the threshold), escalate via SMS+email both regardless of routing.
6. Append a `transition` to ALERTADO with `immutable: true`. Update `slaBreached` based on `(now - case.detectedAt) > config.slaTargetMs`.
7. Return delivered channels + elapsedMs.

**Behavior — `fsmEscalacaoSweep` (cron, every minute):**

1. Enumerate `/labs` collection.
2. For each lab, query `/labs/{labId}/criticos-fsm-cases/` where `currentState in ['CRITICO']` AND `detectedAt < (now - autoEscalateAfterMs)`.
3. For each result, invoke the same escalation logic as the callable.
4. Cap at 50 cases per lab per tick to avoid runaway cost.
5. Log a summary: `{ labsScanned, casesEscalated, casesSkipped }`.

**Invariants:**

- onCall v2 + onSchedule v2 with `region: 'southamerica-east1'`; callable `cors: true`.
- Sub-200ms latency target NOT applicable here — escalation is async and cron-bounded.
- Idempotent: skips cases already past CRITICO state.

**Files to read first:**

- `functions/src/modules/criticos/escalateCritico.ts` (just-written, MP-3 SA-30 — reuse SMS/email helpers if extracted)
- `functions/src/modules/criticos/cron.ts`
- Any sibling onSchedule example
- `./CLAUDE.md`

**Verification:**

- `(cd functions && npm run build)` exit 0
- `grep -c 'cors: true' functions/src/modules/criticos-fsm/escalacaoSLA.ts` ≥ 1

**Commit:** `feat(MP-4-W2-SA-40): fsmEscalacao callable + cron sweep — SLA-driven escalation`

---

### SA-41 — `CriticosFSMPanel.tsx`

**Path:** `src/features/criticos-fsm/components/CriticosFSMPanel.tsx`
**LOC target:** ~240
**Depends on:** SA-37, SA-38

**Contract:**

```typescript
type Props = {
  labId: string;
  caseId: string;
  onAcknowledged?: () => void;
  onResolved?: () => void;
};

export default function CriticosFSMPanel(props: Props): JSX.Element;
```

**Behavior:**

- Subscribes via `subscribeCase(labId, caseId, ...)` — unsubscribe in cleanup.
- Top: state visualization. 4 pill buttons in a row (`NORMAL` · `CRITICO` · `ALERTADO` · `RESOLVIDO`). Active state pill: `bg-violet-500 text-white`. Past states: `bg-emerald-500/30 text-emerald-200`. Future states: `bg-white/5 text-white/40`.
- Connectors between pills: short horizontal bar, colored by progress.
- Below: case metadata table (analito, valor, detectado em, SLA target, breach? badge).
- Action buttons (visible only in matching states):
  - `CRITICO` state: button `Acionar alerta` (calls callable `fsmEscalacao` with `caseId`).
  - `ALERTADO` state: button `Reconhecer` (calls `transition` with `acknowledge` event; opens a textarea modal for the comment).
  - `ALERTADO` state (after acknowledge): button `Resolver` (calls `transition` with `resolve` event; opens textarea modal for resolution).
  - `RESOLVIDO` state: read-only view; no actions.
- History timeline below: each `FSMTransitionRecord` rendered as a row with timestamp, from→to arrow, event type, operator id, comment/resolution. `tabular-nums`.
- "Imutável" badge on rows where `immutable === true`.

**Invariants:**

- Dark-first per MP-2 W4 invariants.
- WCAG AA: state pills have `aria-current="step"` for the active state.
- `prefers-reduced-motion`: connectors animate progress only if not reduced.
- Loading state: skeleton pills.
- Error state: red banner + retry.

**Files to read first:**

- `src/features/capa-tracking/components/` (FSM UI canonical)
- `src/features/criticos/components/EscalacaoDashboard.tsx`
- `DESIGN_SYSTEM.md`
- `.planning/phases/v1.4-final-closure/tokens-cache.json`
- `./CLAUDE.md`

**Verification:**

- `npx tsc --noEmit` exit 0

**Commit:** `feat(MP-4-W2-SA-41): CriticosFSMPanel — 4-state visualization + action buttons + history`

---

### SA-42 — `criticos-fsm.test.ts`

**Path:** `src/__tests__/criticos-fsm/criticos-fsm.test.ts`
**LOC target:** ~400
**Depends on:** SA-37, SA-38, SA-39, SA-40 (mocked), SA-41

**Tests (30+ minimum):**

**Pure FSM logic (15 tests on SA-37 helpers):**

1. `isValidStateTransition('NORMAL','CRITICO')` true
2. `isValidStateTransition('NORMAL','ALERTADO')` false
3. `isValidStateTransition('NORMAL','RESOLVIDO')` false
4. `isValidStateTransition('CRITICO','ALERTADO')` true
5. `isValidStateTransition('CRITICO','RESOLVIDO')` false
6. `isValidStateTransition('ALERTADO','ALERTADO')` true (acknowledge stays)
7. `isValidStateTransition('ALERTADO','RESOLVIDO')` true
8. `isValidStateTransition('RESOLVIDO','*')` false for any target
9. `getNextState('NORMAL', detect)` === 'CRITICO'
10. `getNextState('CRITICO', alert)` === 'ALERTADO'
11. `getNextState('ALERTADO', acknowledge)` === 'ALERTADO'
12. `getNextState('ALERTADO', resolve)` === 'RESOLVIDO'
13. `getNextState('NORMAL', resolve)` === null
14. `isTerminalState('RESOLVIDO')` true
15. `isTerminalState('CRITICO')` false

**Service / immutability (10 tests, mocking firestore):** 16. `createCase` writes case with `currentState: 'NORMAL'` and immediately transitions to `'CRITICO'` via internal `detect` event. 17. `transition` with valid event updates state. 18. `transition` with invalid event throws. 19. After CRITICO entered, `history[0].immutable === true`. 20. Attempting to overwrite an existing `history[i]` entry is rejected by the service. 21. `softDeleteCase` works in NORMAL. 22. `softDeleteCase` rejects in CRITICO. 23. `softDeleteCase` rejects in ALERTADO. 24. `softDeleteCase` rejects in RESOLVIDO. 25. SLA breach computed correctly when alert event arrives after slaTargetMs.

**Escalation (5 tests, mocking callables):** 26. `fsmEscalacao` (mocked) attempts SMS first, then email, on a CRITICO case. 27. `fsmEscalacao` no-ops when state is already ALERTADO. 28. Cron sweep skips cases newer than autoEscalateAfterMs. 29. Cron sweep batches at most 50 cases per lab per tick. 30. After successful escalation, case state is ALERTADO and `slaBreached` reflects elapsed time vs target.

**Integration smoke (3 tests, RTL on the panel):** 31. Panel renders all 4 pills. 32. Action button `Acionar alerta` is visible only in CRITICO state. 33. After mocked transition, panel re-renders with the new state.

**Harness:**

- vitest. Mock firestore via `vi.mock('firebase/firestore', ...)`.
- Mock callables via `vi.mock('firebase/functions', ...)`.

**Verification:**

- `npm test -- src/__tests__/criticos-fsm/` → 30+ tests pass

**Commit:** `test(MP-4-W2-SA-42): criticos-fsm — 30+ tests covering FSM/immutability/escalation`

---

## Verification Gate MP-4

```bash
# G-Build
npx tsc --noEmit
(cd functions && npm run build)

# G-CORS
grep -c 'cors: true' functions/src/modules/criticos-fsm/escalacaoSLA.ts
# ≥1

# G-Secrets
grep -E 'TWILIO_|SMTP_' functions/src/modules/criticos-fsm/escalacaoSLA.ts
# Lists all 7 expected secrets

# G-Tests
npm test -- src/__tests__/criticos-fsm/criticos-fsm.test.ts

# G-Immutability invariant (static check)
# Confirm no service code path writes to history[] except via append:
grep -rn 'history\[' src/features/criticos-fsm/services/  # should show only push/append patterns, never history[i] = ...
```

**Pass criteria:**

- [ ] 6 SA commits landed
- [ ] FSM types + helpers compile and are pure (no Firebase imports)
- [ ] Service uses transactions for state changes
- [ ] All transitions enforced via `isValidStateTransition` (no bypass)
- [ ] Post-CRITICO history records are immutable (write-once, append-only)
- [ ] `fsmEscalacao` callable has `cors: true` + secrets declared
- [ ] Cron sweep schedules at `* * * * *`
- [ ] CriticosFSMPanel renders 4-state visualization with WCAG-AA pills
- [ ] 30+ tests pass in `criticos-fsm.test.ts`
- [ ] No regression vs MP-3 baseline
