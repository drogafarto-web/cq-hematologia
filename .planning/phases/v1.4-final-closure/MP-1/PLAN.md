---
macro_phase: MP-1
phase_label: Phase 11 PQ-24 Closure (Plano de Ação + Presença + Re-Auditoria)
total_subagents: 6
waves: 3
parallel: true
autonomous: true
human_gates: 0
worker_model: claude-haiku-4-5-20251001
estimated_runtime: 1h
depends_on: [MP-0]
---

# MP-1 — Phase 11 PQ-24 Closure

**Goal:** Land the 3 missing callables (createPlanoAcao, registerPresenca, createReAuditoria), the matching firestore.rules + indexes, the index.ts wiring, and a passing e2e test so the 5 untracked components committed in MP-0 are functional.
**Dependencies:** MP-0 (components must already be tracked so we can wire them up).
**Output:**

- 3 new callables in `functions/src/modules/auditoria/`
- Updated `firestore.rules` with 3 new collection blocks + auditoria-internas update
- Updated `firestore.indexes.json` with 4 composite indexes
- `functions/src/index.ts` exporting the 3 callables
- 5 components compile + import working hooks/services
- 1 e2e test green

---

## Wave MP-1-W1 (11A) — Callables (3 SAs ‖)

All 3 SAs run in parallel. They touch different files. Canonical sibling: `functions/src/modules/auditoria/auditoria.ts`.

---

### SA-05 — `functions/src/modules/auditoria/createPlanoAcao.ts`

**Path:** `functions/src/modules/auditoria/createPlanoAcao.ts`
**LOC target:** ~140
**Depends on:** none (W1)

**Contract:**

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { z } from 'zod';
import type { LogicalSignature } from './types';

const CreatePlanoAcaoInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  achadoId: z.string().min(1),
  descricao: z.string().min(20).max(1000),
  responsavel: z.string().min(1), // userId of responsible person
  prazo: z.number().int().positive(), // ms epoch
});

export const createPlanoAcao = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request: CallableRequest<unknown>) => {
    // returns { planoId: string }
  },
);
```

**Behavior:**

1. Reject if `!request.auth` → `HttpsError('unauthenticated', ...)`.
2. Validate input with `CreatePlanoAcaoInput.parse(request.data)`. On error → `HttpsError('invalid-argument', ...)`.
3. Confirm `isActiveMemberOfLab(labId, request.auth.uid)` (helper exists in sibling `auditoria.ts` — copy or import). Reject with `permission-denied` otherwise.
4. Verify the auditoria exists: `db.collection('labs').doc(labId).collection('auditorias-internas').doc(auditoriaId).get()`. Reject `not-found` if missing or `deletadoEm != null`.
5. Verify the achado exists under that auditoria (subcollection `achados/{achadoId}`). Reject `not-found` if missing.
6. Cross-check NCs: call `checkNCs(labId, achadoId)` from `../qualidade/naoConformidade` (same import pattern as `auditoria.ts`). The plano de ação must reference an open NC; if `checkNCs` returns no open NC for that achado, reject `failed-precondition`.
7. Generate server-side `LogicalSignature`:
   ```typescript
   const ts = Date.now();
   const hash = crypto
     .createHash('sha256')
     .update(`${labId}|${auditoriaId}|${achadoId}|${request.auth.uid}|${ts}`)
     .digest('hex');
   const signature: LogicalSignature = { hash, operatorId: request.auth.uid, ts };
   ```
8. Write to `/labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao/{planoId}` (auto-id) with payload:
   ```typescript
   {
     labId, auditoriaId, achadoId,
     descricao, responsavel, prazo,
     status: 'aberto',
     assinatura: signature,
     criadoEm: admin.firestore.FieldValue.serverTimestamp(),
     criadoPor: request.auth.uid,
     deletadoEm: null,
   }
   ```
9. Return `{ planoId: ref.id }`.

**Invariants:**

- onCall v2 with `cors: true` and `region: 'southamerica-east1'` — non-negotiable.
- Server-side signature (never trust client).
- Multi-tenant write under `/labs/{labId}/...`.
- No `deleteDoc` semantics (soft-delete only).

**Files to read first:**

- `functions/src/modules/auditoria/auditoria.ts` (canonical pattern: `createAuditoria`, `registerAchado`)
- `functions/src/modules/auditoria/types.ts` (for `LogicalSignature`)
- `functions/src/modules/qualidade/naoConformidade.ts` (for `checkNCs` signature)
- `./CLAUDE.md`
- `.claude/rules/firestore-security.md`

**Verification:**

- `(cd functions && npm run build)` exit 0
- `cd functions && npm test -- createPlanoAcao` (if test exists) → pass; if no test, this SA only verified by build + downstream MP-1-W3 e2e.

**Commit:** `feat(MP-1-W11A-SA-05): createPlanoAcao callable — server-side signature, NC cross-check`

---

### SA-06 — `functions/src/modules/auditoria/registerPresenca.ts`

**Path:** `functions/src/modules/auditoria/registerPresenca.ts`
**LOC target:** ~130
**Depends on:** none (W1)

**Contract:**

```typescript
const RegisterPresencaInput = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  sessaoId: z.string().min(1),
  reuniao: z.enum(['abertura', 'encerramento']),
  participantes: z
    .array(
      z.object({
        userId: z.string().min(1),
        nome: z.string().min(1),
        papel: z.string().min(1),
      }),
    )
    .min(1),
});

export const registerPresenca = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    // returns { reuniaoId: string }
  },
);
```

**Behavior:**

1. Standard auth + validation guards (same pattern as SA-05).
2. Verify auditoria + sessao both exist and are not soft-deleted.
3. Generate server-side `LogicalSignature` (same algorithm as SA-05; concatenate `labId|auditoriaId|sessaoId|reuniao|uid|ts`).
4. Write to `/labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/reunioes/{reuniaoId}` (auto-id) with:
   ```typescript
   {
     labId, auditoriaId, sessaoId,
     reuniao,                    // 'abertura' | 'encerramento'
     participantes,              // array as received
     assinatura: signature,
     criadoEm: serverTimestamp(),
     criadoPor: request.auth.uid,
     deletadoEm: null,
   }
   ```
5. Return `{ reuniaoId: ref.id }`.

**Invariants:**

- onCall v2, `cors: true`, region `southamerica-east1`.
- A reunião record is immutable post-creation (rules enforce this in SA-08).
- `participantes` must contain at least one entry; reject empty array.

**Files to read first:**

- `functions/src/modules/auditoria/auditoria.ts`
- `functions/src/modules/auditoria/types.ts`
- `./CLAUDE.md`

**Verification:**

- `(cd functions && npm run build)` exit 0
- Type-check passes for the new file

**Commit:** `feat(MP-1-W11A-SA-06): registerPresenca callable — abertura/encerramento + signed roster`

---

### SA-07 — `functions/src/modules/auditoria/createReAuditoria.ts`

**Path:** `functions/src/modules/auditoria/createReAuditoria.ts`
**LOC target:** ~150
**Depends on:** none (W1)

**Contract:**

```typescript
const CreateReAuditoriaInput = z.object({
  labId: z.string().min(1),
  auditoriaOriginalId: z.string().min(1),
  proximaAuditoriaPlanejada: z.number().int().positive(), // ms epoch
  responsavelTecnico: z.string().min(1),
  motivacao: z.string().min(20).max(1000),
});

export const createReAuditoria = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    // returns { auditoriaId: string }
  },
);
```

**Behavior:**

1. Standard auth + validation guards.
2. Read original auditoria from `/labs/{labId}/auditorias-internas/{auditoriaOriginalId}`. Reject `not-found` if missing.
3. Validate `original.status === 'finalizada'` — reject `failed-precondition` otherwise.
4. Validate that all NCs from `original.achados` are closed: query `/labs/{labId}/ncs/` filtered by `auditoriaOriginalId == auditoriaOriginalId` and assert every doc has `status == 'fechada'`. Reject `failed-precondition` listing open NC ids if any remain open.
5. Generate server-side `LogicalSignature`.
6. Create new auditoria document under `/labs/{labId}/auditorias-internas/{newAuditoriaId}` with:
   ```typescript
   {
     labId,
     reAuditoriaDe: auditoriaOriginalId,    // links the new audit to its origin
     proximaAuditoriaPlanejada,
     responsavelTecnico,
     motivacao,
     status: 'planejada',
     assinatura: signature,
     criadoEm: serverTimestamp(),
     criadoPor: request.auth.uid,
     deletadoEm: null,
     // Other auditoria fields default — copy minimal shape from createAuditoria
   }
   ```
7. Return `{ auditoriaId: ref.id }`.

**Invariants:**

- onCall v2 with `cors: true` and `region: 'southamerica-east1'`.
- Cannot create a re-auditoria of a re-auditoria? — allowed per current spec; do not block.
- The `reAuditoriaDe` field is the explicit chain link consumed by `ReAuditoriaChain.tsx`.

**Files to read first:**

- `functions/src/modules/auditoria/auditoria.ts` (`createAuditoria` shape)
- `functions/src/modules/auditoria/types.ts`
- `functions/src/modules/qualidade/naoConformidade.ts` (NC query shape)
- `./CLAUDE.md`

**Verification:**

- `(cd functions && npm run build)` exit 0

**Commit:** `feat(MP-1-W11A-SA-07): createReAuditoria callable — open-NC gate + reAuditoriaDe chain link`

---

## Wave MP-1-W2 (11B) — Rules + Indexes (1 SA, sequential after W1)

---

### SA-08 — Append Firestore rules + indexes for phase-11 PQ-24

**Path:** `firestore.rules` + `firestore.indexes.json`
**LOC target:** ~80 in rules, ~60 in indexes
**Depends on:** SA-05, SA-06, SA-07 (the callables must compile so rules reference real fields)

**Rules to append (use existing helpers `isActiveMemberOfLab`, `validSignature`, `labIdMatches`, `keepsLabId`, `keepsCreatedAt` — read header of `firestore.rules` first):**

```
// PQ-24: Reuniões (presença abertura/encerramento)
match /labs/{labId}/auditorias-internas/{auditoriaId}/sessoes/{sessaoId}/reunioes/{reuniaoId} {
  allow read:   if isActiveMemberOfLab(labId);
  allow create: if false;                      // server-only (callable registerPresenca)
  allow update: if false;                      // immutable
  allow delete: if false;                      // soft-delete only (no field flip allowed in rules)
}

// PQ-24: Planos de Ação
match /labs/{labId}/auditorias-internas/{auditoriaId}/planos-acao/{planoId} {
  allow read:   if isActiveMemberOfLab(labId);
  allow create: if false;                      // server-only (callable createPlanoAcao)
  allow update: if isActiveMemberOfLab(labId)
                && labIdMatches(request.resource.data)
                && keepsLabId() && keepsCreatedAt()
                && request.resource.data.status in ['aberto', 'em-andamento', 'concluido', 'cancelado']
                && (
                  // Only RT/admin can transition to concluido
                  request.resource.data.status != 'concluido'
                  || request.auth.token.role in ['rt', 'admin']
                );
  allow delete: if false;
}
```

**Update existing rule** for `match /labs/{labId}/auditorias-internas/{auditoriaId}` — locate the block in `firestore.rules` and confirm it allows the `reAuditoriaDe` field on create. If the existing block has an explicit allowlist of fields, add `reAuditoriaDe`. If it uses a denylist or wildcard, no change needed — but document the fact in the commit message.

**Indexes to append to `firestore.indexes.json` (use the existing schema in that file as the template — it is an array of `{ collectionGroup, queryScope, fields: [{ fieldPath, order }] }`):**

1. `reunioes` collection group:
   - `auditoriaId` ASC + `criadoEm` DESC
2. `planos-acao` collection group:
   - `status` ASC + `prazo` ASC
3. `auditorias-internas` collection group:
   - `labId` ASC + `ano` ASC + `status` ASC
4. `presencas` (or whichever path the existing presença subcollection uses if any — verify in current rules; if not, skip):
   - `sessaoId` ASC + `criadoEm` DESC

For each, set `queryScope: 'COLLECTION_GROUP'` since paths are nested under `{labId}/{auditoriaId}/...`.

**Invariants:**

- Append only — never rewrite blocks unrelated to PQ-24.
- Every rule references at least one helper from the file header.
- `validSignature(request.resource.data.assinatura)` is enforced at the callable level (server-only create), so rules need not duplicate.
- `firestore.indexes.json` must remain valid JSON.

**Files to read first:**

- `firestore.rules` (full file — locate helpers and existing `auditorias-internas` block)
- `firestore.indexes.json`
- `.claude/rules/firestore-security.md`
- `.claude/rules/notivisa-firestore-rules.md` (style reference for grouped indexes)

**Verification:**

- `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'))"` exit 0
- `firebase emulators:exec --only firestore "npm test -- firestore-rules"` (or equivalent project rule-test command) — pass
- If no rule-test infra exists, run `firebase deploy --only firestore:rules --dry-run --project hmatologia2` and confirm no syntax errors

**Commit:** `feat(MP-1-W11B-SA-08): firestore rules + 4 composite indexes for PQ-24 reunioes/planos-acao`

---

## Wave MP-1-W3 (11C) — Wire + Tests (2 SAs ‖, after W2)

---

### SA-09 — Export new callables from `functions/src/index.ts`

**Path:** `functions/src/index.ts`
**LOC target:** +6 lines
**Depends on:** SA-05, SA-06, SA-07

**Actions:**

1. Read `functions/src/index.ts`.
2. Append three exports (matching the existing export style in that file — likely `export { fooCallable } from './modules/...'`):
   ```typescript
   export { createPlanoAcao } from './modules/auditoria/createPlanoAcao';
   export { registerPresenca } from './modules/auditoria/registerPresenca';
   export { createReAuditoria } from './modules/auditoria/createReAuditoria';
   ```
3. Verify each callable has `cors: true` set in source (grep `functions/src/modules/auditoria/createPlanoAcao.ts` etc for `cors: true`). If any is missing, fail this SA — do not silently fix in W1 files.
4. Run `(cd functions && npm run build)` and confirm 0 errors.

**Invariants:**

- Alphabetic or grouped style — match the file's existing convention.
- No reformatting of unrelated exports.

**Files to read first:**

- `functions/src/index.ts`
- `functions/src/modules/auditoria/createPlanoAcao.ts` (just-written)
- `functions/src/modules/auditoria/registerPresenca.ts`
- `functions/src/modules/auditoria/createReAuditoria.ts`

**Verification:**

- `(cd functions && npm run build)` exit 0
- `grep -c 'cors: true' functions/src/modules/auditoria/{createPlanoAcao,registerPresenca,createReAuditoria}.ts` returns 3
- `grep -E 'createPlanoAcao|registerPresenca|createReAuditoria' functions/src/index.ts` returns 3 lines

**Commit:** `feat(MP-1-W11C-SA-09): export PQ-24 callables from functions index`

---

### SA-10 — Verify imports + create service/hook stubs + e2e test

**Path:** `src/features/auditoria-interna/services/auditoriaService.ts` (extend if exists, create if not), `src/features/auditoria-interna/hooks/useAuditoria.ts` (extend if exists), `src/__tests__/phase11/auditoriaPQ24.test.ts` (new)
**LOC target:** ~60 service additions + ~80 hook additions + ~120 test
**Depends on:** SA-09

**Step 1 — Verify component imports.** For each of the 5 phase-11 components committed in MP-0/SA-02, list every `import` line referencing `../services/...` or `../hooks/...` or `../types/...`. Build the contract surface that must exist downstream.

Expected surface (verify against actual imports — adjust if components import different names):

```typescript
// src/features/auditoria-interna/services/auditoriaService.ts (additions)
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../core/firebase'; // adjust to project's firebase init path

export async function createPlanoAcao(input: {
  labId: string;
  auditoriaId: string;
  achadoId: string;
  descricao: string;
  responsavel: string;
  prazo: number;
}): Promise<{ planoId: string }> {
  const fn = httpsCallable<typeof input, { planoId: string }>(functions, 'createPlanoAcao');
  const res = await fn(input);
  return res.data;
}

export async function registerPresenca(input: {
  labId: string;
  auditoriaId: string;
  sessaoId: string;
  reuniao: 'abertura' | 'encerramento';
  participantes: { userId: string; nome: string; papel: string }[];
}): Promise<{ reuniaoId: string }> {
  /* identical pattern */
}

export async function createReAuditoria(input: {
  labId: string;
  auditoriaOriginalId: string;
  proximaAuditoriaPlanejada: number;
  responsavelTecnico: string;
  motivacao: string;
}): Promise<{ auditoriaId: string }> {
  /* identical pattern */
}
```

**Step 2 — Hook surface.** Add to `src/features/auditoria-interna/hooks/useAuditoria.ts`:

```typescript
export function usePlanosAcao(labId: string, auditoriaId: string): {
  planos: PlanoAcao[];
  loading: boolean;
  error: Error | null;
  createPlano: (input: ...) => Promise<void>;   // wraps service.createPlanoAcao + optimistic update
};

export function usePresenca(labId: string, auditoriaId: string, sessaoId: string): {
  reunioes: Reuniao[];
  registerReuniao: (input: ...) => Promise<void>;
};

export function useReAuditoriaChain(labId: string, auditoriaId: string): {
  chain: AuditoriaInterna[];   // origin → ... → current, ordered by criadoEm
  loading: boolean;
};
```

If `useAuditoria.ts` doesn't exist, create it. If it exists, append. Use `onSnapshot` for realtime reads, always returning the unsubscribe in `useEffect` cleanup (per `.claude/rules/performance.md`).

**Step 3 — Compile check.** Run `npx tsc --noEmit` and confirm 0 errors attributable to the 5 components or the new files. Fix import paths inside the 5 components only if the type-checker complains.

**Step 4 — E2E test (`src/__tests__/phase11/auditoriaPQ24.test.ts`).** Use vitest + the project's existing test-utils (read sibling tests in `src/__tests__/` first to learn the harness). Write the following scenarios using mocked callables:

```typescript
describe('phase-11 PQ-24 e2e', () => {
  it('createPlanoAcao: rejects when achado has no open NC', async () => {
    /* mock callable to throw FailedPrecondition */
  });
  it('createPlanoAcao: succeeds and returns planoId', async () => {});
  it('registerPresenca: writes reuniao and returns reuniaoId', async () => {});
  it('registerPresenca: rejects empty participantes', async () => {});
  it('createReAuditoria: rejects when original has open NCs', async () => {});
  it('createReAuditoria: succeeds and links via reAuditoriaDe', async () => {});
  it('PlanoAcaoForm renders and submits via service', async () => {
    /* RTL render */
  });
  it('ReAuditoriaChain renders chain length ≥ 2', async () => {});
});
```

8 tests minimum. All must pass.

**Invariants:**

- No new dependency added to `package.json` for the test harness — use what's already there.
- Mock callables; do not require Firebase emulator for this SA.
- Component edits only if the type-checker forces them. Surgical only.

**Files to read first:**

- All 5 phase-11 components (committed in MP-0/SA-02)
- An existing service in `src/features/<other-module>/services/` for callable-wrapping pattern (e.g. `src/features/criticos/services/thresholdService.ts`)
- An existing test in `src/__tests__/` for harness style
- `./CLAUDE.md`
- `.claude/rules/performance.md`

**Verification:**

- `npx tsc --noEmit` exit 0
- `npm test -- src/__tests__/phase11/auditoriaPQ24.test.ts` → 8/8 pass

**Commit:** `feat(MP-1-W11C-SA-10): wire PQ-24 service/hooks + 8 e2e tests for phase-11 components`

---

## Verification Gate MP-1

```bash
# G-Build
npx tsc --noEmit
(cd functions && npm run build)

# G-CORS (every new callable must have cors:true)
grep -c 'cors: true' functions/src/modules/auditoria/createPlanoAcao.ts
grep -c 'cors: true' functions/src/modules/auditoria/registerPresenca.ts
grep -c 'cors: true' functions/src/modules/auditoria/createReAuditoria.ts
# Each must return ≥1

# G-Index export
grep -E 'createPlanoAcao|registerPresenca|createReAuditoria' functions/src/index.ts | wc -l   # 3

# G-Rules (deploy dry-run)
firebase deploy --only firestore:rules --dry-run --project hmatologia2

# G-Indexes valid JSON
node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8'))"

# G-Tests
npm test -- src/__tests__/phase11/auditoriaPQ24.test.ts
```

**Pass criteria:**

- [ ] 6 SA commits landed
- [ ] All 3 callables export with `cors: true` and `region: 'southamerica-east1'`
- [ ] `firestore.rules` adds 3 collection blocks + (if needed) updates auditoria-internas for `reAuditoriaDe`
- [ ] `firestore.indexes.json` adds 4 composite indexes and parses as JSON
- [ ] `functions/src/index.ts` exports the 3 callables
- [ ] 5 phase-11 components compile against new service/hook surface
- [ ] 8/8 tests in `auditoriaPQ24.test.ts` pass
- [ ] No regression vs MP-0 baseline (TSC errors, test count)
